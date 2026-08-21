/*
 * Tests for sidecar subtitle conversion.
 *
 * Needs no tooling or install — run it directly:
 *   node --test js/subtitles.test.js
 *
 * The regression that motivated this file: srtTimeToVtt() called
 * String.replace() with a plain string, which swaps only the first match, so
 * "00:00:01,000 --> 00:00:04,000" became "00:00:01.000 --> 00:00:04,000".
 * WebVTT requires a period in BOTH timestamps; a cue whose timing line fails
 * to parse is discarded, so SRT subtitles silently rendered nothing at all.
 */
const assert = require('node:assert/strict');
const test = require('node:test');

const { BeamSubtitles } = require('./player');
const { srtToVtt, assToVtt, isAssOrSsa, toVtt } = BeamSubtitles;

// A cue is only playable if its timing line matches the WebVTT grammar.
const VTT_TIMING_RE = /^\d{2}:\d{2}:\d{2}\.\d{3} --> \d{2}:\d{2}:\d{2}\.\d{3}/;
function timingLines(vtt) {
  return vtt.split('\n').filter((l) => l.includes('-->'));
}

const SAMPLE_SRT = [
  '1',
  '00:00:01,000 --> 00:00:04,000',
  'Hello there.',
  '',
  '2',
  '00:00:05,500 --> 00:00:08,250',
  'Second line.',
  '',
].join('\n');

test('converts both timestamps on a cue, not just the start', () => {
  const vtt = srtToVtt(SAMPLE_SRT);
  assert.ok(vtt.includes('00:00:01.000 --> 00:00:04.000'));
  assert.ok(!vtt.includes(','), 'no comma may survive in a converted cue');
});

test('every cue in a converted file is valid WebVTT', () => {
  const lines = timingLines(srtToVtt(SAMPLE_SRT));
  assert.equal(lines.length, 2);
  for (const line of lines) assert.match(line, VTT_TIMING_RE);
});

test('starts with the WEBVTT header', () => {
  assert.ok(srtToVtt(SAMPLE_SRT).startsWith('WEBVTT\n'));
});

test('keeps dialogue that is nothing but digits', () => {
  // "1999" on its own line looks exactly like a cue index. It is only an
  // index when a timing line follows it.
  const srt = '1\n00:00:01,000 --> 00:00:04,000\n1999\n';
  assert.ok(srtToVtt(srt).includes('1999'));
});

test('accepts files that use a period separator instead of a comma', () => {
  const srt = '1\n00:00:01.000 --> 00:00:04.000\nDot separated.\n';
  assert.match(timingLines(srtToVtt(srt))[0], VTT_TIMING_RE);
});

test('tolerates a leading byte order mark', () => {
  const vtt = srtToVtt('﻿' + SAMPLE_SRT);
  assert.ok(vtt.startsWith('WEBVTT\n'));
  assert.match(timingLines(vtt)[0], VTT_TIMING_RE);
});

const SAMPLE_ASS = [
  '[Script Info]',
  'Title: Example',
  '',
  '[Events]',
  'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
  'Dialogue: 0,0:00:01.00,0:00:04.00,Default,,0,0,0,,{\\an8}Styled line',
  'Dialogue: 0,0:00:05.00,0:00:08.50,Default,,0,0,0,,First\\NSecond',
  'Dialogue: 0,0:00:09.00,0:00:11.00,Default,,0,0,0,,Yes, with a comma',
].join('\n');

test('converts ASS dialogue timings to WebVTT', () => {
  const lines = timingLines(assToVtt(SAMPLE_ASS));
  assert.equal(lines.length, 3);
  for (const line of lines) assert.match(line, VTT_TIMING_RE);
  assert.ok(lines[0].startsWith('00:00:01.000 --> 00:00:04.000'));
});

test('drops ASS override tags but keeps the text', () => {
  const vtt = assToVtt(SAMPLE_ASS);
  assert.ok(vtt.includes('Styled line'));
  assert.ok(!vtt.includes('{\\an8}'));
});

test('turns ASS line breaks into real newlines', () => {
  assert.ok(assToVtt(SAMPLE_ASS).includes('First\nSecond'));
});

test('keeps commas inside ASS dialogue text', () => {
  // Text is the last field but may itself contain commas — splitting on
  // every comma would truncate the line at "Yes".
  assert.ok(assToVtt(SAMPLE_ASS).includes('Yes, with a comma'));
});

test('recognizes ASS and SSA content', () => {
  assert.equal(isAssOrSsa(SAMPLE_ASS), true);
  assert.equal(isAssOrSsa(SAMPLE_SRT), false);
});

test('routes each format to the right converter', () => {
  assert.match(timingLines(toVtt(SAMPLE_SRT))[0], VTT_TIMING_RE);
  assert.match(timingLines(toVtt(SAMPLE_ASS))[0], VTT_TIMING_RE);
});

test('passes existing WebVTT through untouched', () => {
  const vtt = 'WEBVTT\n\n00:00:01.000 --> 00:00:04.000\nAlready fine.\n';
  assert.equal(toVtt(vtt), vtt);
});
