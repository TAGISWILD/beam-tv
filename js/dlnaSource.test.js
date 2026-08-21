/*
 * Tests for DLNA server address handling.
 *
 * Needs no tooling or install — run it directly:
 *   node --test js/dlnaSource.test.js
 *
 * These cases come from a real bug report: a MiniDLNA server on a Keenetic
 * router at 192.168.1.1:8200 that the stock Samsung player could see and Beam
 * could not. Two separate causes — the address forms below were all rejected,
 * and the network scan only ever asked for /description.xml while MiniDLNA
 * serves /rootDesc.xml on that same port.
 */
const assert = require('node:assert/strict');
const test = require('node:test');

const DlnaSource = require('./dlnaSource');
const { normalizeServerUrl, _candidateDescriptionUrls: candidates, _descriptionPaths: PATHS } = DlnaSource;

test('accepts a full description URL unchanged', () => {
  const u = normalizeServerUrl('http://192.168.1.1:8200/rootDesc.xml');
  assert.equal(u, 'http://192.168.1.1:8200/rootDesc.xml');
});

test('adds a scheme to a bare host:port', () => {
  assert.equal(normalizeServerUrl('192.168.1.1:8200'), 'http://192.168.1.1:8200/');
});

test('strips the upnp:// prefix some server UIs display', () => {
  assert.equal(normalizeServerUrl('upnp://http://192.168.1.1:8200'), 'http://192.168.1.1:8200/');
});

test('ignores surrounding whitespace', () => {
  assert.equal(normalizeServerUrl('  192.168.1.1:8200  '), 'http://192.168.1.1:8200/');
});

test('rejects input with no host in it', () => {
  assert.equal(normalizeServerUrl(''), null);
  assert.equal(normalizeServerUrl('   '), null);
  assert.equal(normalizeServerUrl(null), null);
});

test('tries the MiniDLNA path for an origin with no path', () => {
  const urls = candidates('http://192.168.1.1:8200/');
  assert.ok(urls.includes('http://192.168.1.1:8200/rootDesc.xml'));
  assert.ok(urls.includes('http://192.168.1.1:8200/description.xml'));
});

test('tries a typed path first, then falls back to the well-known ones', () => {
  const urls = candidates('http://192.168.1.1:8200/wrong.xml');
  assert.equal(urls[0], 'http://192.168.1.1:8200/wrong.xml');
  assert.ok(urls.includes('http://192.168.1.1:8200/rootDesc.xml'));
});

test('also tries the default DLNA port when none was typed', () => {
  // A bare host almost never serves a device description on port 80.
  const urls = candidates('http://192.168.1.1/');
  assert.ok(urls.some((u) => u.startsWith('http://192.168.1.1:8200/')));
});

test('produces no duplicate URLs', () => {
  const urls = candidates('http://192.168.1.1:8200/description.xml');
  assert.equal(new Set(urls).size, urls.length);
});

test('covers every well-known description path', () => {
  const urls = candidates('http://192.168.1.1:8200/');
  for (const path of PATHS) {
    assert.ok(urls.includes('http://192.168.1.1:8200' + path), 'missing ' + path);
  }
});

test('every address form a user might type resolves to the same candidate set', () => {
  // The three forms from the bug report, all of which previously failed.
  const forms = ['http://192.168.1.1:8200', '192.168.1.1:8200', 'upnp://http://192.168.1.1:8200'];
  const sets = forms.map((f) => candidates(normalizeServerUrl(f)).join('|'));
  assert.equal(new Set(sets).size, 1, 'all three forms should behave identically');
  assert.ok(sets[0].includes('/rootDesc.xml'));
});

// ---- IPv6 (issue #5) -------------------------------------------------------
// A /64 holds 2^64 addresses, so the unicast sweep scanNetwork() does over an
// IPv4 /24 has no IPv6 equivalent — typing the address is the only route, and
// these are the forms a server's settings page actually shows.

test('brackets a bare IPv6 literal so it forms a legal URL host', () => {
  assert.equal(normalizeServerUrl('2001:db8::1'), 'http://[2001:db8::1]/');
});

test('accepts an already-bracketed IPv6 address with a port', () => {
  assert.equal(normalizeServerUrl('[2001:db8::1]:8200'), 'http://[2001:db8::1]:8200/');
});

test('accepts a full IPv6 description URL', () => {
  const u = normalizeServerUrl('http://[2001:db8::1]:8200/rootDesc.xml');
  assert.equal(u, 'http://[2001:db8::1]:8200/rootDesc.xml');
});

test('keeps the path when bracketing a bare IPv6 literal', () => {
  assert.equal(normalizeServerUrl('2001:db8::1/rootDesc.xml'), 'http://[2001:db8::1]/rootDesc.xml');
});

test('tries the default DLNA port for a portless IPv6 address', () => {
  const urls = candidates(normalizeServerUrl('2001:db8::1'));
  assert.ok(urls.includes('http://[2001:db8::1]:8200/rootDesc.xml'));
});

test('does not mistake an IPv4 host:port for an IPv6 literal', () => {
  assert.equal(normalizeServerUrl('192.168.1.1:8200'), 'http://192.168.1.1:8200/');
});
