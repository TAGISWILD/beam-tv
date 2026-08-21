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
