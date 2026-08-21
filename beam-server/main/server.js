/*
 * The Beam Companion Server itself — a minimal UPnP ContentDirectory-alike
 * implementing exactly the two endpoints js/dlnaSource.js on the TV client
 * actually calls (GET /description.xml, POST a Browse SOAP action to the
 * advertised controlURL), plus a range-aware file stream endpoint. Not a
 * full SSDP/UPnP MediaServer implementation — the TV client never does
 * multicast discovery (no raw socket access from a Tizen web app), it only
 * ever unicast-probes a known port and reads these two HTTP endpoints, so
 * that's all this needs to speak.
 */
const fs = require('fs');
const os = require('os');
const express = require('express');

function escapeXml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
}

function localIp() {
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return '127.0.0.1';
}

// Node reports family as the string 'IPv6' on most releases and the number 6
// on some, so both are accepted rather than trusting either.
function isIpv6(iface) {
  return iface.family === 'IPv6' || iface.family === 6;
}

// The TV can't discover an IPv6 server the way it discovers an IPv4 one: the
// unicast sweep in js/dlnaSource.js walks 254 addresses, and the IPv6
// equivalent is 2^64 per subnet. So the address is shown in the GUI for the
// user to type instead — which only helps if it's an address that means
// something on another device. A link-local fe80:: address doesn't: it needs a
// zone index ("fe80::1%en0") naming an interface on the machine using it.
function pickIpv6(ifaces) {
  for (const name of Object.keys(ifaces || {})) {
    for (const iface of ifaces[name] || []) {
      if (!isIpv6(iface) || iface.internal) continue;
      if (/^fe80:/i.test(iface.address)) continue;
      if (iface.scopeid) continue;
      return iface.address;
    }
  }
  return null;
}

function localIpv6() {
  return pickIpv6(os.networkInterfaces());
}

function buildDidl(containers, items, baseUrl) {
  const parts = [
    '<DIDL-Lite xmlns="urn:schemas-upnp-org:metadata-1-0/DIDL-Lite/" ' +
    'xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:upnp="urn:schemas-upnp-org:metadata-1-0/upnp/">',
  ];
  containers.forEach((c) => {
    parts.push(`<container id="${escapeXml(c.id)}" parentID="0" restricted="1" childCount="1">` +
      `<dc:title>${escapeXml(c.name)}</dc:title>` +
      `<upnp:class>object.container.storageFolder</upnp:class></container>`);
  });
  items.forEach((it) => {
    const uri = `${baseUrl}/stream/${it.id}`;
    const upnpClass = it.kind === 'image' ? 'object.item.imageItem' : it.kind === 'audio' ? 'object.item.audioItem' : 'object.item.videoItem';
    parts.push(`<item id="${escapeXml(it.id)}" parentID="0" restricted="1">` +
      `<dc:title>${escapeXml(it.name)}</dc:title>` +
      `<upnp:class>${upnpClass}</upnp:class>` +
      `<res protocolInfo="http-get:*:${escapeXml(it.mime)}:*" size="${it.size}">${escapeXml(uri)}</res>` +
      '</item>');
  });
  parts.push('</DIDL-Lite>');
  return parts.join('');
}

// getSettings() is read fresh on every request (not captured once) so a
// friendly-name or port edit in the GUI is reflected immediately without
// needing to restart the underlying HTTP server.
function createServer({ library, getSettings }) {
  const app = express();
  // The client always sends the SOAP body as text/xml — matching any
  // content-type here rather than being strict about it means a body
  // still parses even if some real-world client sends a slightly different
  // charset/quoting on that header.
  app.use(express.text({ type: () => true, limit: '2mb' }));

  app.get('/description.xml', (req, res) => {
    const { friendlyName } = getSettings();
    res.type('application/xml').send(`<?xml version="1.0"?>
<root xmlns="urn:schemas-upnp-org:device-1-0">
  <specVersion><major>1</major><minor>0</minor></specVersion>
  <device>
    <deviceType>urn:schemas-upnp-org:device:MediaServer:1</deviceType>
    <friendlyName>${escapeXml(friendlyName)}</friendlyName>
    <manufacturer>Beam</manufacturer>
    <modelName>Beam Companion Server</modelName>
    <modelDescription>Shares local folders for the Beam TV app</modelDescription>
    <UDN>uuid:beam-companion-server</UDN>
    <serviceList>
      <service>
        <serviceType>urn:schemas-upnp-org:service:ContentDirectory:1</serviceType>
        <serviceId>urn:upnp-org:serviceId:ContentDirectory</serviceId>
        <SCPDURL>/cd.xml</SCPDURL>
        <controlURL>/ctrl</controlURL>
        <eventSubURL>/evt</eventSubURL>
      </service>
    </serviceList>
  </device>
</root>`);
  });

  app.post('/ctrl', (req, res) => {
    const body = typeof req.body === 'string' ? req.body : '';
    const m = /<ObjectID>(.*?)<\/ObjectID>/.exec(body);
    const objectId = m ? m[1] : '0';
    try {
      const { containers, items } = library.browse(objectId);
      const { port } = getSettings();
      const baseUrl = `http://${localIp()}:${port}`;
      const didl = buildDidl(containers, items, baseUrl);
      const total = containers.length + items.length;
      res.type('application/xml').send(`<?xml version="1.0" encoding="utf-8"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">
  <s:Body>
    <u:BrowseResponse xmlns:u="urn:schemas-upnp-org:service:ContentDirectory:1">
      <Result>${escapeXml(didl)}</Result>
      <NumberReturned>${total}</NumberReturned>
      <TotalMatches>${total}</TotalMatches>
      <UpdateID>1</UpdateID>
    </u:BrowseResponse>
  </s:Body>
</s:Envelope>`);
    } catch (e) {
      res.status(500).type('text/plain').send('Browse failed: ' + e.message);
    }
  });

  // Range-aware so <video> seeking works — a player that can only ever
  // request the whole file from byte 0 can't scrub, and re-downloads
  // everything up to a seek point every time.
  app.get('/stream/:id', (req, res) => {
    const file = library.fileFor(req.params.id);
    if (!file) return res.status(404).end();
    let stat;
    try { stat = fs.statSync(file.absPath); } catch (e) { return res.status(404).end(); }

    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Type', file.mime);

    const range = req.headers.range;
    if (range) {
      const m = /bytes=(\d*)-(\d*)/.exec(range);
      const start = m && m[1] ? parseInt(m[1], 10) : 0;
      let end = m && m[2] ? parseInt(m[2], 10) : stat.size - 1;
      if (Number.isNaN(start) || Number.isNaN(end) || start > end || start >= stat.size) {
        res.status(416).setHeader('Content-Range', `bytes */${stat.size}`);
        return res.end();
      }
      if (end >= stat.size) end = stat.size - 1;
      res.status(206);
      res.setHeader('Content-Range', `bytes ${start}-${end}/${stat.size}`);
      res.setHeader('Content-Length', end - start + 1);
      fs.createReadStream(file.absPath, { start, end }).pipe(res);
    } else {
      res.setHeader('Content-Length', stat.size);
      fs.createReadStream(file.absPath).pipe(res);
    }
  });

  return app;
}

module.exports = { createServer, localIp, localIpv6, pickIpv6 };
