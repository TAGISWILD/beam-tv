/*
 * Tests for sidecar subtitle matching and ordering.
 *
 * Needs no tooling or install — run it directly:
 *   node --test js/usbSource.test.js
 */
const assert = require('node:assert/strict');
const test = require('node:test');

const { findSubtitleFor, orderSubtitlesFor } = require('./usbSource');

const subs = (...names) => names.map((name) => ({ name, uri: 'file:///' + name }));

test('matches a subtitle named after the video', () => {
  const found = findSubtitleFor('Arrival.mkv', subs('Arrival.srt', 'Other.srt'));
  assert.equal(found.name, 'Arrival.srt');
});

test('prefers the English track when several languages sit alongside', () => {
  const found = findSubtitleFor('Arrival.mkv', subs('Arrival.fr.srt', 'Arrival.en.srt'));
  assert.equal(found.name, 'Arrival.en.srt');
});

test('prefers an exact name over a language-tagged one', () => {
  const found = findSubtitleFor('Arrival.mkv', subs('Arrival.en.srt', 'Arrival.srt'));
  assert.equal(found.name, 'Arrival.srt');
});

test('matches nothing when subtitles are named by language alone', () => {
  // The case that leaves a viewer with no subtitles and no way to say which
  // file they wanted — which is why orderSubtitlesFor offers the rest.
  assert.equal(findSubtitleFor('Arrival.mkv', subs('English.srt', 'French.srt')), null);
});

test('offers every subtitle in the folder even when none match the video', () => {
  const list = orderSubtitlesFor('Arrival.mkv', subs('English.srt', 'French.srt'));
  assert.deepEqual(list.map((s) => s.name), ['English.srt', 'French.srt']);
});

test('puts the auto-matched file first', () => {
  const list = orderSubtitlesFor('Arrival.mkv', subs('English.srt', 'Arrival.srt', 'French.srt'));
  assert.equal(list[0].name, 'Arrival.srt');
  assert.equal(list.length, 3);
});

test('ranks same-name variants above unrelated files', () => {
  const list = orderSubtitlesFor('Arrival.mkv', subs('Zulu.srt', 'Arrival.fr.srt', 'Arrival.srt'));
  assert.deepEqual(list.map((s) => s.name), ['Arrival.srt', 'Arrival.fr.srt', 'Zulu.srt']);
});

test('lists each subtitle exactly once', () => {
  const list = orderSubtitlesFor('Arrival.mkv', subs('Arrival.srt', 'Arrival.en.srt', 'Other.srt'));
  assert.equal(new Set(list.map((s) => s.name)).size, list.length);
});

test('returns an empty list when the folder has no subtitles', () => {
  assert.deepEqual(orderSubtitlesFor('Arrival.mkv', []), []);
  assert.deepEqual(orderSubtitlesFor('Arrival.mkv', undefined), []);
});
