/*
 * Playback engine: wraps the native <video> element (Tizen's platform
 * decoder handles MKV/H.265/AC3 etc. natively — no need for AVPlay for
 * direct file/HTTP playback), adds SRT->WebVTT subtitle conversion and
 * resume-where-you-left-off support.
 */
(function (global) {
  const RESUME_KEY = 'beam.resume.v1';
  const SAVE_INTERVAL_MS = 5000;

  function loadResumeMap() {
    try { return JSON.parse(localStorage.getItem(RESUME_KEY)) || {}; }
    catch (e) { return {}; }
  }
  function saveResumeMap(map) { localStorage.setItem(RESUME_KEY, JSON.stringify(map)); }

  // A cue timing line, in either of the two separators seen in the wild:
  // SRT's comma (the standard) and the period some tools emit instead.
  const SRT_TIMING_RE = /^\d{2}:\d{2}:\d{2}[.,]\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}[.,]\d{3}/;

  // Both timestamps on the line need converting. A plain string argument to
  // String.replace() only swaps the FIRST match, which left every cue's END
  // time as "00:00:04,000" — malformed WebVTT, so the parser dropped the cue
  // and no subtitles rendered at all.
  function srtTimeToVtt(t) { return t.replace(/,/g, '.'); }

  function srtToVtt(srtText) {
    const lines = srtText.replace(/^\uFEFF/, '').replace(/\r/g, '').split('\n');
    const out = ['WEBVTT', ''];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (SRT_TIMING_RE.test(line)) {
        out.push(srtTimeToVtt(line));
        continue;
      }
      // A bare number is only a cue index when the very next line is that
      // cue's timing line. Checking that is what keeps a line of dialogue
      // that happens to be all digits ("1999") from being swallowed.
      if (/^\d+$/.test(line.trim()) && SRT_TIMING_RE.test(lines[i + 1] || '')) continue;
      out.push(line);
    }
    return out.join('\n');
  }

  function isAssOrSsa(text) {
    return /^﻿?\[Script Info\]/im.test(text) || /^\s*Dialogue:/im.test(text);
  }

  // ASS/SSA -> WebVTT: styling, positioning and karaoke tags are dropped
  // rather than translated — the goal is readable captions, not a full
  // renderer. Only the [Events] Dialogue lines and their timing survive.
  function assToVtt(assText) {
    const lines = assText.replace(/\r/g, '').split('\n');
    const out = ['WEBVTT', ''];
    // Dialogue format is comma-separated with a fixed field order; Text is
    // always the last field but may itself contain commas, so it's split
    // with a limit rather than naively on every comma.
    const fieldsRe = /^Dialogue:\s*(?:[^,]*,){9}(.*)$/;
    const timeRe = /^Dialogue:\s*[^,]*,\s*(\d+:\d{2}:\d{2}\.\d{2}),\s*(\d+:\d{2}:\d{2}\.\d{2}),/;
    const toVttTime = (t) => {
      // ASS uses H:MM:SS.cc (centiseconds); VTT needs HH:MM:SS.mmm.
      const m = /^(\d+):(\d{2}):(\d{2})\.(\d{2})$/.exec(t);
      if (!m) return '00:00:00.000';
      const h = String(m[1]).padStart(2, '0');
      return `${h}:${m[2]}:${m[3]}.${m[4]}0`;
    };
    for (const line of lines) {
      const timeMatch = timeRe.exec(line);
      const fieldsMatch = fieldsRe.exec(line);
      if (!timeMatch || !fieldsMatch) continue;
      const text = fieldsMatch[1]
        .replace(/\{[^}]*\}/g, '')   // override tags, e.g. {\an8}
        .replace(/\\N|\\n/g, '\n')   // ASS line breaks
        .trim();
      if (!text) continue;
      out.push(`${toVttTime(timeMatch[1])} --> ${toVttTime(timeMatch[2])}`, text, '');
    }
    return out.join('\n');
  }

  // Single entry point for every sidecar format Beam claims to support.
  // WebVTT passes through untouched; ASS/SSA and SRT are converted.
  function toVtt(text) {
    if (/^\s*WEBVTT/i.test(text)) return text;
    return isAssOrSsa(text) ? assToVtt(text) : srtToVtt(text);
  }

  class Player {
    constructor(videoEl) {
      this.video = videoEl;
      this.current = null; // { key, title, uri }
      this._saveTimer = null;
      this._trackUrl = null;
      this.subtitleUri = null;
      this.onTimeUpdate = null;
      this.onEnded = null;
      this.onError = null;
      // Added once here rather than per-open(): these previously got
      // re-registered on every open() call and were never removed, so a
      // session with many videos played would accumulate duplicate
      // listeners — each 'ended' firing N times (N toasts, N navigations)
      // by the time you'd watched N videos.
      this.video.addEventListener('timeupdate', () => this.onTimeUpdate && this.onTimeUpdate(this.video));
      this.video.addEventListener('ended', () => { this._saveProgress(); this.onEnded && this.onEnded(); });
      this.video.addEventListener('error', () => this.onError && this.onError(this.video.error));
      this._registerHardwareKeys();
    }

    _registerHardwareKeys() {
      if (!BeamEnv.isTV || !tizen.tvinputdevice.registerKey) return;
      // Colored remote keys are reserved by the platform and never reach the
      // app as keydown events unless explicitly registered — ColorF2Yellow
      // (picture-in-picture) would silently do nothing without this.
      const keys = [
        'MediaPlayPause', 'MediaPlay', 'MediaPause', 'MediaStop', 'MediaRewind', 'MediaFastForward',
        'ColorF0Red', 'ColorF1Green', 'ColorF2Yellow', 'ColorF3Blue',
      ];
      keys.forEach((k) => { try { tizen.tvinputdevice.registerKey(k); } catch (e) { /* not supported on this key */ } });
    }

    getResumeSeconds(key) {
      const map = loadResumeMap();
      return (map[key] && map[key].t) || 0;
    }

    getWatchHistory() {
      const map = loadResumeMap();
      return Object.values(map).sort((a, b) => b.at - a.at);
    }

    _saveProgress() {
      if (!this.current || !this.video.duration) return;
      const map = loadResumeMap();
      const ratio = this.video.currentTime / this.video.duration;
      if (ratio > 0.96) {
        delete map[this.current.key];
      } else {
        map[this.current.key] = {
          key: this.current.key,
          title: this.current.title,
          uri: this.current.uri,
          t: this.video.currentTime,
          duration: this.video.duration,
          at: Date.now(),
          sourceType: this.current.sourceType,
        };
      }
      saveResumeMap(map);
    }

    async open({ key, title, uri, subtitleUri, sourceType }) {
      this.close();
      this.current = { key, title, uri, sourceType };
      this.video.src = uri;

      // Fire play() as the very first thing, synchronously within the same
      // call stack as the user's OK-press. Any `await` before this (e.g. a
      // subtitle fetch) breaks the browser's user-gesture/autoplay chain and
      // silently blocks playback until a second, fresh key press.
      const playAttempt = this.video.play().catch((e) => console.warn('play() rejected', e));

      const resumeAt = this.getResumeSeconds(key);
      const onLoaded = () => {
        if (resumeAt > 2) this.video.currentTime = resumeAt;
        this.video.removeEventListener('loadedmetadata', onLoaded);
      };
      this.video.addEventListener('loadedmetadata', onLoaded);
      this._saveTimer = setInterval(() => this._saveProgress(), SAVE_INTERVAL_MS);

      if (subtitleUri) {
        try { await this.loadSubtitle(subtitleUri); }
        catch (e) { console.warn('subtitle load failed', e); }
      }

      await playAttempt;
      return resumeAt;
    }

    // Fetches a sidecar file, converts whatever format it turns out to be, and
    // attaches it as the video's one subtitle track. Safe to call mid-playback:
    // any previously attached track is torn down first, which is what makes
    // switching between subtitle files possible without reopening the video.
    async loadSubtitle(subtitleUri) {
      const text = await (await fetch(subtitleUri)).text();
      const vtt = toVtt(text);
      this.clearSubtitles();
      const blob = new Blob([vtt], { type: 'text/vtt' });
      this._trackUrl = URL.createObjectURL(blob);
      const track = document.createElement('track');
      track.kind = 'subtitles';
      track.label = 'Subtitles';
      track.default = true;
      track.src = this._trackUrl;
      this.video.appendChild(track);
      // `default` alone is not reliably honored by every WebKit build (some
      // Tizen firmwares need `.track.mode` set explicitly, and only after the
      // track has actually loaded its cues) — so it's forced on both now and
      // again on 'load' to cover either case. Setting it only after the
      // element is in the DOM, since a detached <track> has no usable
      // TextTrack to set a mode on.
      if (track.track) track.track.mode = 'showing';
      track.addEventListener('load', () => { if (track.track) track.track.mode = 'showing'; });
      this.subtitleUri = subtitleUri;
      return subtitleUri;
    }

    // Detaches the current subtitle track entirely — distinct from hiding it,
    // which leaves the cues loaded and hasSubtitles() answering true.
    clearSubtitles() {
      Array.from(this.video.querySelectorAll('track')).forEach((t) => t.remove());
      if (this._trackUrl) { URL.revokeObjectURL(this._trackUrl); this._trackUrl = null; }
      this.subtitleUri = null;
    }

    close() {
      if (this._saveTimer) { clearInterval(this._saveTimer); this._saveTimer = null; }
      if (this.current) this._saveProgress();
      this.video.pause();
      this.video.removeAttribute('src');
      this.clearSubtitles();
      this.video.load();
      this.current = null;
    }

    togglePlay() { this.video.paused ? this.video.play() : this.video.pause(); }
    seekBy(sec) { this.video.currentTime = Math.max(0, Math.min(this.video.duration || Infinity, this.video.currentTime + sec)); }

    hasSubtitles() { return !!this.video.querySelector('track'); }

    // Returns the new state ('showing' | 'hidden') so the caller can toast
    // it, or null when there's no subtitle track loaded for this file at all
    // — distinct from "hidden", since the UI needs to tell those apart.
    toggleSubtitles() {
      const track = this.video.querySelector('track');
      if (!track) return null;
      track.track.mode = track.track.mode === 'showing' ? 'hidden' : 'showing';
      return track.track.mode;
    }
  }

  // Exported so the conversion logic can be unit-tested with `node --test`,
  // the same way js/metadata.js is.
  const BeamSubtitles = { srtToVtt, assToVtt, isAssOrSsa, toVtt };

  global.BeamPlayer = Player;
  global.BeamSubtitles = BeamSubtitles;
  if (typeof module !== 'undefined' && module.exports) module.exports = { Player, BeamSubtitles };
})(typeof window !== 'undefined' ? window : globalThis);
