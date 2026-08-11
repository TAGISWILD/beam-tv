/*
 * Tests for the offline filename metadata parser.
 *
 * Needs no tooling or install — run it directly:
 *   node --test js/metadata.test.js
 *
 * The cases below are the ones that actually bite. Most filename parsers pass
 * the easy "Title.Year.Resolution" shape and then quietly mangle films whose
 * titles contain a year, hyphenated titles, and episode names.
 */
const assert = require('node:assert/strict');
const test = require('node:test');

const BeamMeta = require('./metadata');

test('parses the standard release shape', () => {
  const m = BeamMeta.parse('Interstellar.2014.2160p.BluRay.x265-GROUP.mkv');
  assert.equal(m.title, 'Interstellar');
  assert.equal(m.year, 2014);
  assert.equal(m.resolution, '4K');
  assert.equal(m.source, 'Blu-ray');
  assert.equal(m.codec, 'HEVC');
});

test('keeps a future-looking number in the title instead of reading it as a year', () => {
  // The classic false positive: 2049 parses as a year but no film released
  // then, so amputating the title at it would leave "Blade Runner".
  const m = BeamMeta.parse('Blade.Runner.2049.2017.1080p.mkv');
  assert.equal(m.title, 'Blade Runner 2049');
  assert.equal(m.year, 2017);
  assert.equal(m.resolution, '1080p');
});

test('keeps a title that is itself a bare year', () => {
  const m = BeamMeta.parse('1917.2019.1080p.BluRay.mkv');
  assert.equal(m.title, '1917');
  assert.equal(m.year, 2019);
});

test('does not mistake a hyphenated title for a release-group suffix', () => {
  const m = BeamMeta.parse('Spider-Man.Across.the.Spider-Verse.2023.2160p.mkv');
  assert.equal(m.title, 'Spider-Man Across the Spider-Verse');
  assert.equal(m.year, 2023);
});

test('extracts season, episode and episode title', () => {
  const m = BeamMeta.parse('Severance.S02E01.Hello.Ms.Cobel.1080p.WEB-DL.mkv');
  assert.equal(m.title, 'Severance');
  assert.equal(m.season, 2);
  assert.equal(m.episode, 1);
  assert.equal(m.episodeTitle, 'Hello Ms Cobel');
  assert.equal(BeamMeta.describe(m), 'S2 E1 · Hello Ms Cobel');
});

test('handles the 1x02 episode form', () => {
  const m = BeamMeta.parse('The.Wire.1x02.mkv');
  assert.equal(m.title, 'The Wire');
  assert.equal(m.season, 1);
  assert.equal(m.episode, 2);
});

test('strips bracketed release-group and checksum noise', () => {
  const m = BeamMeta.parse('Dune.Part.Two.2024.1080p.[YTS.MX].mp4');
  assert.equal(m.title, 'Dune Part Two');
  assert.equal(m.year, 2024);
});

test('reads a parenthesised year', () => {
  const m = BeamMeta.parse('The Matrix (1999).mkv');
  assert.equal(m.title, 'The Matrix');
  assert.equal(m.year, 1999);
});

test('surfaces dynamic range and resolution as badges, tech as chips', () => {
  const m = BeamMeta.parse('Dune.2021.2160p.HDR10.Atmos.Remux.HEVC.mkv');
  assert.deepEqual(m.badges, ['4K', 'HDR']);
  assert.deepEqual(m.chips, ['Remux', 'HEVC', 'Atmos']);
});

test('leaves an ordinary home-video name alone', () => {
  const m = BeamMeta.parse('Family Trip 2025.mp4');
  assert.equal(m.title, 'Family Trip');
  assert.equal(m.year, 2025);
  assert.deepEqual(m.badges, []);
});

test('falls back to the bare filename when there is nothing to parse', () => {
  const m = BeamMeta.parse('vacation_clip.mov');
  // Only the opening word is capitalised — see capitalizeFirst. "Vacation Clip"
  // would mean per-word casing, which breaks more names than it fixes.
  assert.equal(m.title, 'Vacation clip');
  assert.equal(m.year, null);
  assert.equal(BeamMeta.describe(m), '');
});

test('preserves author casing rather than re-capitalising it', () => {
  assert.equal(BeamMeta.parse('WALL-E.2008.1080p.mkv').title, 'WALL-E');
  // Starts lowercase but carries an interior capital: must not become "IPhone".
  assert.equal(BeamMeta.parse('iPhone test clip.mov').title, 'iPhone test clip');
});
