/*
 * Manual-entry UPnP/DLNA client.
 * Auto SSDP discovery isn't available to a Tizen *web* app (no raw UDP
 * multicast socket in the public Web Device API) so the user supplies the
 * server's description.xml URL instead (shown by most DLNA servers, e.g.
 * Plex, Serviio, Universal Media Server, Windows Media Player).
 */
(function (global) {
  const STORE_KEY = 'beam.dlna.servers';

  function loadServers() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY)) || []; }
    catch (e) { return []; }
  }
  function saveServers(list) {
    localStorage.setItem(STORE_KEY, JSON.stringify(list));
  }

  function xhr(url, opts) {
    opts = opts || {};
    return new Promise((resolve, reject) => {
      const x = new XMLHttpRequest();
      x.open(opts.method || 'GET', url, true);
      if (opts.headers) Object.entries(opts.headers).forEach(([k, v]) => x.setRequestHeader(k, v));
      x.timeout = opts.timeout || 8000;
      x.ontimeout = () => reject(new Error('timeout'));
      x.onerror = () => reject(new Error('network error'));
      x.onload = () => {
        if (x.status >= 200 && x.status < 300) resolve(x.responseText);
        else reject(new Error('HTTP ' + x.status));
      };
      x.send(opts.body || null);
    });
  }

  function absoluteUrl(base, maybeRelative) {
    try { return new URL(maybeRelative, base).toString(); }
    catch (e) { return maybeRelative; }
  }

  // Parses the device description XML to find the ContentDirectory controlURL
  async function resolveControlUrl(descriptionUrl) {
    const xmlText = await xhr(descriptionUrl);
    const doc = new DOMParser().parseFromString(xmlText, 'text/xml');
    const services = Array.from(doc.getElementsByTagName('service'));
    const cd = services.find((s) => {
      const t = s.getElementsByTagName('serviceType')[0];
      return t && /ContentDirectory/i.test(t.textContent);
    });
    if (!cd) throw new Error('No ContentDirectory service found on this server');
    const controlPath = cd.getElementsByTagName('controlURL')[0].textContent;
    const friendlyNameEl = doc.getElementsByTagName('friendlyName')[0];
    return {
      controlUrl: absoluteUrl(descriptionUrl, controlPath),
      friendlyName: friendlyNameEl ? friendlyNameEl.textContent : 'DLNA Server',
    };
  }

  function browseEnvelope(objectId) {
    return `<?xml version="1.0" encoding="utf-8"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">
  <s:Body>
    <u:Browse xmlns:u="urn:schemas-upnp-org:service:ContentDirectory:1">
      <ObjectID>${objectId}</ObjectID>
      <BrowseFlag>BrowseDirectChildren</BrowseFlag>
      <Filter>*</Filter>
      <StartingIndex>0</StartingIndex>
      <RequestedCount>0</RequestedCount>
      <SortCriteria></SortCriteria>
    </u:Browse>
  </s:Body>
</s:Envelope>`;
  }

  async function browse(controlUrl, objectId) {
    const body = browseEnvelope(objectId);
    const respText = await xhr(controlUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset="utf-8"',
        SOAPAction: '"urn:schemas-upnp-org:service:ContentDirectory:1#Browse"',
      },
      body,
    });
    const envelope = new DOMParser().parseFromString(respText, 'text/xml');
    const resultEl = envelope.getElementsByTagName('Result')[0];
    if (!resultEl) throw new Error('Malformed Browse response');
    const didl = new DOMParser().parseFromString(resultEl.textContent, 'text/xml');

    const containers = Array.from(didl.getElementsByTagName('container')).map((c) => ({
      isDir: true,
      kind: 'dir',
      id: c.getAttribute('id'),
      name: (c.getElementsByTagName('dc:title')[0] || c.getElementsByTagName('title')[0] || {}).textContent || 'Folder',
    }));
    // Subtitle mimetypes, both as a lone sidecar item (some servers expose
    // "Movie.srt" as its own <item>, mirroring a filesystem) and as a second
    // <res> on the same <item> as the video (Plex/Serviio commonly do this
    // instead). Either shape is handled below.
    const SUB_MIME = /srt|subrip|vtt|smi|sami|ssa|ass/i;
    const allItems = Array.from(didl.getElementsByTagName('item')).map((it) => {
      const resList = Array.from(it.getElementsByTagName('res'));
      const isSub = (r) => SUB_MIME.test(r.getAttribute('protocolInfo') || '');
      const primaryRes = resList.find((r) => !isSub(r)) || resList[0];
      const subRes = resList.find((r) => r !== primaryRes && isSub(r));
      const title = (it.getElementsByTagName('dc:title')[0] || it.getElementsByTagName('title')[0] || {}).textContent || 'Untitled';
      const protocolInfo = (primaryRes && primaryRes.getAttribute('protocolInfo')) || '';
      const kind = resList.length === 1 && isSub(primaryRes) ? 'subtitle'
        : /image/i.test(protocolInfo) ? 'image' : /audio/i.test(protocolInfo) ? 'audio' : 'video';
      // Servers (Plex, Serviio, etc.) commonly expose a small pre-made
      // thumbnail here — far cheaper and more reliable than frame-grabbing a
      // remote video, which usually fails anyway (no CORS on a LAN server).
      const artEl = it.getElementsByTagName('upnp:albumArtURI')[0] || it.getElementsByTagName('albumArtURI')[0];
      return {
        isDir: false,
        kind,
        id: it.getAttribute('id'),
        name: title,
        uri: primaryRes ? primaryRes.textContent : null,
        size: primaryRes ? Number(primaryRes.getAttribute('size')) : undefined,
        thumbUri: artEl ? artEl.textContent : null,
        embeddedSubtitleUri: subRes ? subRes.textContent : undefined,
      };
    });
    const subtitles = allItems.filter((it) => it.kind === 'subtitle');
    const items = allItems.filter((it) => it.kind !== 'subtitle');
    return { items: containers.concat(items), subtitles };
  }

  const mockDlnaTree = {
    root: { name: 'Living Room Plex', children: ['movies', 'shows'] },
    movies: { name: 'Movies', children: [], files: ['Oppenheimer (2023).mkv', 'Poor Things (2023).mp4'] },
    shows: { name: 'TV Shows', children: [], files: ['The Bear S03E01.mkv'] },
  };

  const DlnaSource = { loadServers, saveServers };

  DlnaSource.addServer = async function (name, descriptionUrl) {
    const meta = await resolveControlUrl(descriptionUrl);
    const servers = loadServers();
    const entry = { id: 'srv_' + Date.now(), name: name || meta.friendlyName, descriptionUrl, controlUrl: meta.controlUrl };
    servers.push(entry);
    saveServers(servers);
    return entry;
  };

  DlnaSource.removeServer = function (id) {
    saveServers(loadServers().filter((s) => s.id !== id));
  };

  const COMPANION_PORT = 8200; // Beam Companion Server's fixed port

  // Real SSDP (multicast UDP) is unreachable from a Tizen web app — no raw
  // socket access in the public Web Device API, this is a hard platform
  // wall, not something more code works around. This is the closest
  // practical substitute that *is* reachable: get the TV's own subnet from
  // systeminfo, then unicast-probe every host on it for our companion
  // server's known port. Slower than real discovery and only finds servers
  // on that exact port, but needs zero typing for the common case (pointing
  // Beam at your own Mac/PC running the companion server).
  function getLocalSubnetPrefix() {
    return new Promise((resolve) => {
      if (!global.tizen || !global.tizen.systeminfo) return resolve(null);
      const validIp = (ip) => ip && /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip) && ip !== '0.0.0.0';
      const tryProp = (prop) => new Promise((res) => {
        try {
          tizen.systeminfo.getPropertyValue(prop, (info) => res(info), () => res(null));
        } catch (e) { res(null); }
      });
      tryProp('WIFI_NETWORK').then((wifi) => {
        if (validIp(wifi && wifi.ipAddress)) return resolve(wifi.ipAddress.split('.').slice(0, 3).join('.'));
        return tryProp('ETHERNET_NETWORK').then((eth) => {
          if (validIp(eth && eth.ipAddress)) return resolve(eth.ipAddress.split('.').slice(0, 3).join('.'));
          resolve(null);
        });
      });
    });
  }

  function probeCompanion(ip) {
    return xhr(`http://${ip}:${COMPANION_PORT}/description.xml`, { timeout: 450 })
      .then((xml) => {
        const m = /<friendlyName>(.*?)<\/friendlyName>/.exec(xml);
        return { ip, name: m ? m[1] : ip, descriptionUrl: `http://${ip}:${COMPANION_PORT}/description.xml` };
      })
      .catch(() => null);
  }

  // onProgress(scanned, total) lets the UI show a live counter during the scan.
  DlnaSource.scanNetwork = async function (onProgress) {
    if (BeamEnv.isPreview) {
      return new Promise((resolve) => {
        let n = 0;
        const timer = setInterval(() => {
          n += 40;
          if (onProgress) onProgress(Math.min(n, 254), 254);
          if (n >= 254) {
            clearInterval(timer);
            resolve({ found: [{ ip: '10.0.0.50', name: 'Beam Companion (Mock Mac)', descriptionUrl: 'http://10.0.0.50:8200/description.xml' }] });
          }
        }, 120);
      });
    }
    const prefix = await getLocalSubnetPrefix();
    if (!prefix) return { error: 'no-network-info', found: [] };
    const candidates = [];
    for (let i = 1; i <= 254; i++) candidates.push(prefix + '.' + i);
    const found = [];
    let cursor = 0, scanned = 0;
    const CONCURRENCY = 24;
    await new Promise((resolveAll) => {
      const launch = () => {
        if (cursor >= candidates.length) return;
        const ip = candidates[cursor++];
        probeCompanion(ip).then((result) => {
          scanned++;
          if (onProgress) onProgress(scanned, candidates.length);
          if (result) found.push(result);
          if (scanned >= candidates.length) resolveAll();
          else launch();
        });
      };
      for (let c = 0; c < CONCURRENCY; c++) launch();
    });
    return { found };
  };

  DlnaSource.browse = async function (server, objectId) {
    if (BeamEnv.isPreview) {
      return new Promise((resolve) => {
        const node = mockDlnaTree[objectId] || mockDlnaTree.root;
        const items = []
          .concat((node.children || []).map((cid) => ({ isDir: true, kind: 'dir', id: cid, name: mockDlnaTree[cid].name })))
          .concat((node.files || []).map((f, i) => ({ isDir: false, kind: 'video', id: objectId + '_' + i, name: f, uri: '#mock-video' })));
        setTimeout(() => resolve({ items, subtitles: [] }), 200);
      });
    }
    return browse(server.controlUrl, objectId || '0');
  };

  global.DlnaSource = DlnaSource;
})(window);
