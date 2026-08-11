/*
 * Thumbnail generation for video frames and photo files, both rasterized
 * down to a small JPEG via <canvas> so cards never hold a full-resolution
 * decode in memory. Falls back silently (resolves null) on any failure.
 *
 * Three things here are shaped specifically by what a TV is, rather than by
 * what a desktop browser would tolerate:
 *
 *  - Video frame-grabs run strictly one at a time. A TV has a *single*
 *    hardware video decoder, so two concurrent grabs were never actually
 *    parallel — they contended for the same unit, and both finished later
 *    than if they had simply queued. Image decodes are unrelated to that
 *    unit, so they get their own lane and no longer sit behind a 17GB MKV
 *    waiting on a seek.
 *
 *  - Results are handed out as blob object URLs, not data URLs. A data URL
 *    is a base64 string ~1.33x the size of the JPEG that has to be held in
 *    JS, copied into a CSS property, and re-parsed by the CSS engine per
 *    element. An object URL is an 40-odd character handle to bytes the
 *    engine already holds.
 *
 *  - The cache is capped and evicted, revoking object URLs as it goes.
 *    Unbounded growth across a long browsing session is how you arrive at
 *    an out-of-memory reload two hundred folders in.
 */
(function (global) {
  const cache = new Map();   // uri -> objectURL | null. Map keeps insertion order = eviction order.
  const pending = new Map(); // uri -> Promise
  const THUMB_WIDTH = 320;
  const MAX_CACHED = 240;
  const VIDEO_TIMEOUT_MS = 7000;

  const lanes = {
    video: { limit: 1, active: 0, queue: [] },
    image: { limit: 2, active: 0, queue: [] },
  };

  function pump(lane) {
    while (lane.active < lane.limit && lane.queue.length) {
      const job = lane.queue.shift();
      lane.active++;
      job().then(null, () => {}).then(() => { lane.active--; pump(lane); });
    }
  }

  // `priority` puts a job at the front of its lane. The card the viewer is
  // actually looking at must not wait behind three dozen off-screen ones —
  // without this, focusing a card deep in a large folder meant its artwork
  // arrived only after every card before it had been decoded.
  function enqueue(laneName, job, priority) {
    const lane = lanes[laneName];
    return new Promise((resolve) => {
      const wrapped = () => job().then(resolve, () => resolve(null));
      if (priority) lane.queue.unshift(wrapped); else lane.queue.push(wrapped);
      pump(lane);
    });
  }

  function remember(uri, url) {
    cache.set(uri, url);
    while (cache.size > MAX_CACHED) {
      const oldestKey = cache.keys().next().value;
      const oldestUrl = cache.get(oldestKey);
      cache.delete(oldestKey);
      // Without the revoke the bytes stay alive for the lifetime of the
      // document even with every reference dropped — an object URL is a
      // document-scoped strong reference, not something GC reclaims on its own.
      if (oldestUrl) { try { URL.revokeObjectURL(oldestUrl); } catch (e) { /* already gone */ } }
    }
    return url;
  }

  // Resolves to an object URL, or a data URL where canvas.toBlob is missing
  // (it landed later than toDataURL and some embedded WebKit builds predate
  // it). The data-URL path is a correctness fallback, not the intended route.
  function rasterize(source, naturalW, naturalH) {
    const w = THUMB_WIDTH;
    const h = Math.max(1, Math.round(w * ((naturalH || 9) / (naturalW || 16))));
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    canvas.getContext('2d').drawImage(source, 0, 0, w, h);
    if (!canvas.toBlob) return Promise.resolve(canvas.toDataURL('image/jpeg', 0.7));
    return new Promise((resolve) => {
      canvas.toBlob(
        (blob) => resolve(blob ? URL.createObjectURL(blob) : null),
        'image/jpeg',
        0.7
      );
    });
  }

  function memoized(uri, laneName, priority, run) {
    if (cache.has(uri)) return Promise.resolve(cache.get(uri));
    if (pending.has(uri)) return pending.get(uri);
    const p = enqueue(laneName, run, priority).then((result) => remember(uri, result));
    pending.set(uri, p);
    p.then(null, () => {}).then(() => pending.delete(uri));
    return p;
  }

  function grabFrame(uri, priority) {
    return memoized(uri, 'video', priority, () => new Promise((resolve) => {
      const v = document.createElement('video');
      v.muted = true;
      v.playsInline = true;
      v.preload = 'metadata';
      let settled = false;

      const finish = (result) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        v.removeAttribute('src');
        v.load();
        resolve(result);
      };

      const timer = setTimeout(() => finish(null), VIDEO_TIMEOUT_MS);

      v.addEventListener('loadedmetadata', () => {
        const dur = v.duration;
        const target = isFinite(dur) && dur > 1 ? Math.min(dur * 0.12, 30) : 0.1;
        try { v.currentTime = target; } catch (e) { finish(null); }
      });
      v.addEventListener('seeked', () => {
        // tainted canvas (no CORS) or decode error resolves null, same as any
        // other failure — a missing thumbnail is a cosmetic outcome, never an
        // error the viewer should see.
        rasterize(v, v.videoWidth, v.videoHeight).then(finish, () => finish(null));
      });
      v.addEventListener('error', () => finish(null));
      v.src = uri;
      v.load();
    }));
  }

  // Downscales a photo file to a small thumbnail instead of ever handing the
  // full-resolution original to a card's background-image — a folder of
  // 12MP camera photos rendered at full size is exactly what was choking
  // the TV.
  function grabImageThumb(uri, priority) {
    return memoized(uri, 'image', priority, () => new Promise((resolve) => {
      const img = new Image();
      const finish = (result) => { img.src = ''; resolve(result); };
      img.onload = () => rasterize(img, img.naturalWidth, img.naturalHeight).then(finish, () => finish(null));
      img.onerror = () => finish(null);
      img.src = uri;
    }));
  }

  global.ThumbGrabber = { grabFrame, grabImageThumb };
})(window);
