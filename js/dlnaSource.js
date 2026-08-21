/*
 * UPnP/DLNA client.
 * Auto SSDP discovery isn't available to a Tizen *web* app (no raw UDP
 * multicast socket in the public Web Device API), so servers are found two
 * other ways: a unicast sweep of the TV's own subnet for the well-known
 * description paths (see scanNetwork), or the user typing an address. The
 * address can be as loose as "192.168.1.10" — DESCRIPTION_PATHS covers
 * finding the actual description file from there.
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
    const controlEl = cd.getElementsByTagName('controlURL')[0];
    if (!controlEl) throw new Error('ContentDirectory service has no controlURL');
    const controlPath = controlEl.textContent;
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

  // Where device descriptions actually live. Beam can't ask a server for its
  // description URL — that answer comes over SSDP, which a Tizen web app
  // cannot speak (see the note on scanNetwork below) — so this is the list of
  // well-known locations used by the servers people actually run. Anything
  // not on this list still works; the user just has to paste the full URL.
  const DESCRIPTION_PATHS = [
    '/description.xml',       // Beam Companion Server, Plex
    '/rootDesc.xml',          // MiniDLNA / ReadyMedia — most routers and NAS boxes
    '/DeviceDescription.xml', // Twonky and several NAS-bundled servers
    '/description/fetch',     // Universal Media Server
  ];

  // Accepts what people actually type. All of these reach the same server:
  //   192.168.1.10            192.168.1.10:8200
  //   http://192.168.1.10:8200        upnp://http://192.168.1.10:8200
  // Returns a URL string, or null when there's nothing usable in the input.
  function normalizeServerUrl(input) {
    let raw = String(input == null ? '' : input).trim();
    if (!raw) return null;
    // Some server UIs display their address with a upnp:// prefix, which is
    // not a fetchable scheme — strip it and keep whatever followed.
    raw = raw.replace(/^upnp:\/\//i, '');
    if (!/^https?:\/\//i.test(raw)) raw = 'http://' + raw.replace(/^\/+/, '');
    try {
      const u = new URL(raw);
      if (!u.hostname) return null;
      return u.toString();
    } catch (e) { return null; }
  }

  // The URLs worth fetching for a given input: what the user typed (when it
  // actually names a file), then each well-known path under the same origin.
  function candidateDescriptionUrls(normalized) {
    const u = new URL(normalized);
    const out = [];
    if (u.pathname && u.pathname !== '/') out.push(u.toString());
    // No port typed means we don't know which server it is — try the default
    // DLNA port too, since a bare host almost never serves a description on 80.
    const origins = [u.origin];
    if (!u.port) origins.push(u.protocol + '//' + u.hostname + ':' + PRIMARY_PORT);
    origins.forEach((origin) => {
      DESCRIPTION_PATHS.forEach((path) => out.push(origin + path));
    });
    return out.filter((v, i, arr) => arr.indexOf(v) === i);
  }

  // A 200 response proves something is listening, not that it's a DLNA
  // server — MiniDLNA serves an HTML status page on / and Plex serves its web
  // UI, both of which would otherwise be added as bogus "servers".
  function looksLikeDeviceDescription(xmlText) {
    return /<friendlyName>/i.test(xmlText) || /urn:schemas-upnp-org:device/i.test(xmlText);
  }

  const DlnaSource = { loadServers, saveServers, normalizeServerUrl };

  DlnaSource.addServer = async function (name, inputUrl) {
    const normalized = normalizeServerUrl(inputUrl);
    if (!normalized) {
      throw new Error('That doesn\u2019t look like an address. Try something like 192.168.1.10:8200');
    }
    const candidates = candidateDescriptionUrls(normalized);
    let lastError = null;
    for (const candidate of candidates) {
      let meta;
      try {
        meta = await resolveControlUrl(candidate);
      } catch (e) { lastError = e; continue; }
      const servers = loadServers();
      const entry = {
        id: 'srv_' + Date.now(),
        name: name || meta.friendlyName,
        descriptionUrl: candidate,
        controlUrl: meta.controlUrl,
      };
      servers.push(entry);
      saveServers(servers);
      return entry;
    }
    const tried = candidates.map((c) => new URL(c).pathname).join(', ');
    throw new Error(
      'No DLNA server answered at ' + new URL(normalized).host + '. Tried: ' + tried +
      (lastError ? ' (last error: ' + lastError.message + ')' : '')
    );
  };

  DlnaSource.removeServer = function (id) {
    saveServers(loadServers().filter((s) => s.id !== id));
  };

  // 8200 is both Beam Companion Server's fixed port and MiniDLNA's default,
  // which is why it gets its own fast pass across the whole subnet.
  const PRIMARY_PORT = 8200;
  // Only probed when the fast pass comes up empty — each extra port multiplies
  // the number of requests a scan makes by another 254.
  const SECONDARY_PORTS = [32469, 9000, 5001, 8895];

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

  // Probing one exact URL. Anything that isn't recognizably a UPnP device
  // description counts as a miss, however cheerfully it answered.
  function probeUrl(url) {
    return xhr(url, { timeout: 450 })
      .then((xml) => {
        if (!looksLikeDeviceDescription(xml)) return null;
        const m = /<friendlyName>(.*?)<\/friendlyName>/i.exec(xml);
        return { name: m ? m[1].trim() : null, descriptionUrl: url };
      })
      .catch(() => null);
  }

  // One host, every known description path on a port, first hit wins. Probing
  // only /description.xml here is what made Beam blind to MiniDLNA, which
  // serves /rootDesc.xml on this very same port.
  async function probeHost(ip, port) {
    for (const path of DESCRIPTION_PATHS) {
      const hit = await probeUrl(`http://${ip}:${port}${path}`);
      if (hit) return { ip, name: hit.name || ip, descriptionUrl: hit.descriptionUrl };
    }
    return null;
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
    const hosts = [];
    for (let i = 1; i <= 254; i++) hosts.push(prefix + '.' + i);

    // Progress is reported across every pass we intend to run, so the counter
    // doesn't jump back to zero when the scan widens to the secondary ports.
    const totalUnits = hosts.length * (1 + SECONDARY_PORTS.length);
    let doneUnits = 0;

    const sweep = (port) => new Promise((resolveAll) => {
      const found = [];
      let cursor = 0, finished = 0;
      const CONCURRENCY = 24;
      const launch = () => {
        if (cursor >= hosts.length) return;
        const ip = hosts[cursor++];
        probeHost(ip, port).then((result) => {
          finished++;
          doneUnits++;
          if (onProgress) onProgress(doneUnits, totalUnits);
          if (result) found.push(result);
          if (finished >= hosts.length) resolveAll(found);
          else launch();
        });
      };
      for (let c = 0; c < CONCURRENCY; c++) launch();
    });

    const found = await sweep(PRIMARY_PORT);
    if (found.length) {
      if (onProgress) onProgress(totalUnits, totalUnits);
      return { found };
    }
    // Nothing on the common port — widen to the other servers' defaults
    // rather than reporting an empty network.
    for (const port of SECONDARY_PORTS) {
      const more = await sweep(port);
      more.forEach((hit) => found.push(hit));
    }
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

  // Exported so address handling can be unit-tested with `node --test`.
  DlnaSource._candidateDescriptionUrls = candidateDescriptionUrls;
  DlnaSource._descriptionPaths = DESCRIPTION_PATHS;

  global.DlnaSource = DlnaSource;
  if (typeof module !== 'undefined' && module.exports) module.exports = DlnaSource;
})(typeof window !== 'undefined' ? window : globalThis);
