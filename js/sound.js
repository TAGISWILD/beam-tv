/*
 * Tiny synthesized UI sound engine — no audio assets to bundle or fetch,
 * just short WebAudio oscillator blips. Kept deliberately quiet (~5-9% gain)
 * and short (35-80ms) so they read as a snappy tactile confirmation rather
 * than something that fights the actual media audio during playback.
 */
(function (global) {
  let ctx = null;
  function ensureCtx() {
    const AC = global.AudioContext || global.webkitAudioContext;
    if (!AC) return null;
    if (!ctx) ctx = new AC();
    // AudioContext starts (or drifts back to) 'suspended' until a user
    // gesture unlocks it on some WebKit builds — a remote keydown counts as
    // one, so resuming on every call is cheap insurance rather than
    // requiring some separate one-time unlock step.
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }

  function tone({ freq, duration, gain, type, glideTo }) {
    // Muted at the source rather than at each of the dozen call sites in
    // app.js and nav.js. Checked here so nothing has to remember to ask, and
    // so a disabled setting also avoids constructing an AudioContext at all.
    if (global.BeamSound && global.BeamSound.muted) return;
    const c = ensureCtx();
    if (!c) return;
    const osc = c.createOscillator();
    const amp = c.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, c.currentTime);
    if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, c.currentTime + duration);
    // Linear ramp in, exponential ramp out: a hard onset reads as "snappy",
    // an exponential (not linear) decay avoids an audible click at the tail.
    amp.gain.setValueAtTime(0.0001, c.currentTime);
    amp.gain.linearRampToValueAtTime(gain, c.currentTime + 0.004);
    amp.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + duration);
    osc.connect(amp).connect(c.destination);
    osc.start();
    osc.stop(c.currentTime + duration + 0.02);
  }

  global.BeamSound = {
    // Set from the Settings screen's "Navigation sounds" toggle (see
    // applyPrefs in app.js). The boot laser deliberately respects it too.
    muted: false,
    move()   { tone({ freq: 1180, duration: 0.035, gain: 0.05, type: 'sine' }); },
    select() { tone({ freq: 720,  duration: 0.06,  gain: 0.09, type: 'sine', glideTo: 1180 }); },
    back()   { tone({ freq: 520,  duration: 0.07,  gain: 0.08, type: 'sine', glideTo: 260 }); },
    pip()    { tone({ freq: 900,  duration: 0.09,  gain: 0.08, type: 'sine', glideTo: 1500 }); },
    // Sawtooth (not sine) is what gives this its "buzzy zap" laser texture
    // rather than a soft chirp — a one-time boot moment, so it's allowed to
    // be louder/longer than every other UI sound here.
    laser()  { tone({ freq: 2000, duration: 0.28, gain: 0.14, type: 'sawtooth', glideTo: 140 }); },
  };
})(window);
