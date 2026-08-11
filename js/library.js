/*
 * Library scanning: walks a USB drive once and groups everything it finds into
 * the rows Home shows — Continue Watching, Recently Added, Movies, TV Shows,
 * Music, Photos.
 *
 * This exists because folder-by-folder drilling was making the viewer do the
 * library's job. A drive whose media sits three folders deep presented an
 * almost empty Home screen and no way to see what was on it without a dozen
 * remote presses.
 *
 * Everything is derived locally — grouping comes from BeamMeta's filename
 * parse, artwork from poster/folder image sidecars sitting next to the media,
 * exactly the convention Kodi and Plex already read. No network calls.
 *
 * The walk is deliberately bounded and interruptible. A USB drive can hold a
 * hundred thousand files, and a TV app that walks all of them synchronously is
 * an app that appears to have hung.
 */
(function (global) {
  const MAX_DEPTH = 6;
  const MAX_FILES = 4000;
  const MAX_DIRS = 1200;
  // Cover art conventionally lives under one of these names beside the media.
  const POSTER_NAMES = ['poster', 'folder', 'cover', 'fanart', 'thumb', 'backdrop'];
  // Directories that are never media and are frequently enormous. Walking
  // these is pure cost — recycle bins in particular can hold an entire
  // second copy of the drive.
  const SKIP_DIRS = /^(\$recycle\.bin|system volume information|@eadir|\.trashes?|\.spotlight-v100|\.fseventsd|lost\+found|android|\.thumbnails)$/i;

  function isHidden(name) { return /^[.$]/.test(name); }

  function baseName(name) { return String(name).replace(/\.[a-z0-9]{1,5}$/i, '').toLowerCase(); }

  /*
   * Picks cover art for one media file out of the images sitting in the same
   * folder, preferring most-specific-first:
   *   1. an image named exactly like the file  (Interstellar.jpg)
   *   2. a conventional folder-level name      (poster.jpg, folder.jpg)
   * Returns null when the folder has no usable art, which is the common case
   * and simply means the card keeps its generated gradient.
   */
  function pickPoster(fileName, imagesInFolder) {
    if (!imagesInFolder || !imagesInFolder.length) return null;
    const base = baseName(fileName);
    const exact = imagesInFolder.find((img) => baseName(img.name) === base);
    if (exact) return exact.uri;
    const conventional = imagesInFolder.find((img) => POSTER_NAMES.includes(baseName(img.name)));
    return conventional ? conventional.uri : null;
  }

  /*
   * Breadth-first so that shallow, and therefore usually more interesting,
   * folders are reported before deep ones — a scan that gets truncated by the
   * caps still produces a useful library rather than everything from one
   * arbitrarily deep branch.
   *
   * `onProgress` is called as directories complete so the UI can show real
   * movement; `shouldCancel` is polled between directories so navigating away
   * abandons the walk instead of letting it run to completion unobserved.
   */
  async function scan(storageLabel, options) {
    const opts = options || {};
    const onProgress = opts.onProgress || function () {};
    const shouldCancel = opts.shouldCancel || function () { return false; };

    const files = [];
    let dirsVisited = 0;
    let truncated = false;
    const queue = [[]];

    while (queue.length) {
      if (shouldCancel()) return { cancelled: true, files: [] };
      if (dirsVisited >= MAX_DIRS || files.length >= MAX_FILES) { truncated = true; break; }

      const subPath = queue.shift();
      if (subPath.length > MAX_DEPTH) continue;

      let listing;
      try {
        listing = await UsbSource.listDir(storageLabel, subPath);
      } catch (e) {
        continue; // an unreadable folder is skipped, never fatal to the scan
      }
      dirsVisited++;

      const items = listing.items || [];
      const imagesHere = items.filter((it) => !it.isDir && it.kind === 'image');

      for (const it of items) {
        if (isHidden(it.name)) continue;
        if (it.isDir) {
          if (!SKIP_DIRS.test(it.name)) queue.push(it.subPath);
          continue;
        }
        if (it.kind !== 'video' && it.kind !== 'audio' && it.kind !== 'image') continue;
        files.push({
          name: it.name,
          uri: it.uri,
          subPath: it.subPath,
          kind: it.kind,
          size: it.size,
          modified: it.modified || null,
          folder: subPath.length ? subPath[subPath.length - 1] : null,
          parentPath: subPath,
          meta: BeamMeta.parse(it.name),
          posterUri: it.kind === 'image' ? null : pickPoster(it.name, imagesHere),
          subtitles: listing.subtitles || [],
        });
        if (files.length >= MAX_FILES) { truncated = true; break; }
      }

      onProgress({ dirs: dirsVisited, files: files.length, queued: queue.length });
      // Yields to the event loop between directories. Without this the walk
      // monopolises the single JS thread and the TV drops every frame and
      // every keypress for its whole duration — the app looks frozen even
      // though it's working.
      await new Promise((r) => setTimeout(r, 0));
    }

    return Object.assign({ cancelled: false, truncated, files }, group(files));
  }

  /*
   * A video is an episode when its filename yielded a season *and* an episode
   * number, and a movie otherwise. Filename-derived rather than
   * folder-derived on purpose: folder layouts vary wildly between people's
   * drives, but "S02E01" means the same thing in everyone's collection.
   */
  function group(files) {
    const movies = [];
    const episodes = [];
    const music = [];
    const photos = [];

    for (const f of files) {
      if (f.kind === 'audio') music.push(f);
      else if (f.kind === 'image') photos.push(f);
      else if (f.meta.season != null && f.meta.episode != null) episodes.push(f);
      else movies.push(f);
    }

    // Episodes collapse into one card per show, so a season of 24 files takes
    // one grid slot instead of flooding the row.
    const showsByTitle = new Map();
    for (const ep of episodes) {
      const key = ep.meta.title.toLowerCase();
      if (!showsByTitle.has(key)) {
        showsByTitle.set(key, { title: ep.meta.title, episodes: [], posterUri: null });
      }
      const show = showsByTitle.get(key);
      show.episodes.push(ep);
      if (!show.posterUri && ep.posterUri) show.posterUri = ep.posterUri;
    }

    const shows = Array.from(showsByTitle.values());
    for (const show of shows) {
      show.episodes.sort((a, b) => (a.meta.season - b.meta.season) || (a.meta.episode - b.meta.episode));
      show.seasonCount = new Set(show.episodes.map((e) => e.meta.season)).size;
    }

    const byName = (a, b) => a.meta.title.localeCompare(b.meta.title);
    movies.sort(byName);
    music.sort(byName);
    photos.sort(byName);
    shows.sort((a, b) => a.title.localeCompare(b.title));

    // Newest first where the platform gave us a modified date, and a stable
    // no-op ordering where it didn't — rather than a random-looking order that
    // would make a "Recently Added" row actively misleading.
    const dated = files.filter((f) => f.modified);
    const recent = dated.length
      ? dated.slice().sort((a, b) => new Date(b.modified) - new Date(a.modified)).slice(0, 20)
      : [];

    return { movies, shows, music, photos, recent };
  }

  global.BeamLibrary = { scan, group, pickPoster };
})(window);
