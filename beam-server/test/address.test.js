/*
 * Tests for which local address the GUI advertises.
 *
 * Run with `npm test` from beam-server/.
 *
 * Context (issue #5): the TV finds this server by sweeping its own IPv4 /24 —
 * 254 unicast probes. There is no IPv6 equivalent, since a /64 holds 2^64
 * addresses, so an IPv6 server has to be typed in by hand. That only works if
 * the address shown is one another device can actually reach.
 */
const assert = require('node:assert/strict');
const test = require('node:test');

const { pickIpv6 } = require('../main/server');

test('returns a routable global IPv6 address', () => {
  const found = pickIpv6({
    en0: [{ family: 'IPv6', address: '2001:db8::1', internal: false, scopeid: 0 }],
  });
  assert.equal(found, '2001:db8::1');
});

test('accepts the numeric family some Node releases report', () => {
  const found = pickIpv6({ en0: [{ family: 6, address: '2001:db8::5', internal: false, scopeid: 0 }] });
  assert.equal(found, '2001:db8::5');
});

test('skips link-local addresses, which need a zone index to be usable', () => {
  // "fe80::1%en0" names an interface on the machine using it, so the TV
  // cannot do anything with it.
  const found = pickIpv6({ en0: [{ family: 'IPv6', address: 'fe80::1', internal: false, scopeid: 4 }] });
  assert.equal(found, null);
});

test('skips loopback', () => {
  const found = pickIpv6({ lo0: [{ family: 'IPv6', address: '::1', internal: true, scopeid: 0 }] });
  assert.equal(found, null);
});

test('skips IPv4 entries', () => {
  const found = pickIpv6({ en0: [{ family: 'IPv4', address: '192.168.1.10', internal: false }] });
  assert.equal(found, null);
});

test('prefers a routable address over a link-local one on the same interface', () => {
  const found = pickIpv6({
    en0: [
      { family: 'IPv6', address: 'fe80::abc', internal: false, scopeid: 4 },
      { family: 'IPv6', address: 'fd00::7', internal: false, scopeid: 0 },
    ],
  });
  assert.equal(found, 'fd00::7');
});

test('returns null when the host has no IPv6 at all', () => {
  assert.equal(pickIpv6({}), null);
  assert.equal(pickIpv6(undefined), null);
});
