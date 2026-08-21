/*
 * USB / local storage browsing via tizen.filesystem.
 * Exposes a small promise-based API: listStorages(), listDir(pathSegments)
 */
(function (global) {
  const VIDEO_EXT = ['mp4', 'mkv', 'avi', 'mov', 'webm', 'ts', 'm2ts', 'wmv', 'flv', 'm4v'];
  const AUDIO_EXT = ['mp3', 'flac', 'wav', 'aac', 'ogg', 'm4a', 'wma'];
  const IMAGE_EXT = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'];
  const SUB_EXT = ['srt', 'vtt', 'ass', 'ssa'];

  function extOf(name) {
    const m = /\.([a-z0-9]+)$/i.exec(name || '');
    return m ? m[1].toLowerCase() : '';
  }
  function kindOf(name) {
    const ext = extOf(name);
    if (VIDEO_EXT.includes(ext)) return 'video';
    if (AUDIO_EXT.includes(ext)) return 'audio';
    if (IMAGE_EXT.includes(ext)) return 'image';
    if (SUB_EXT.includes(ext)) return 'subtitle';
    return 'other';
  }
  function isPlayableKind(kind) { return kind === 'video' || kind === 'audio' || kind === 'image'; }
  function humanSize(bytes) {
    if (!bytes && bytes !== 0) return '';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let i = 0, n = bytes;
    while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
    return `${n.toFixed(n >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
  }
  function prettyName(fileName) {
    return fileName.replace(/\.[a-z0-9]+$/i, '').replace(/[._]/g, ' ').trim();
  }
  function baseNameOf(fileName) {
    return fileName.replace(/\.[a-z0-9]+$/i, '').toLowerCase();
  }

  // Tizen's File.toURI() has a documented real-world quirk on some firmware
  // of not reliably percent-encoding spaces/parens/etc in the path — the
  // <video> element then rejects the URL outright with
  // MEDIA_ERR_SRC_NOT_SUPPORTED, which reads exactly like a codec problem
  // even though the file itself is perfectly playable. Decoding then
  // re-encoding each path segment is idempotent: already-correct URIs pass
  // through unchanged, raw/broken ones get fixed.
  function normalizeUri(uri) {
    const schemeMatch = /^([a-z][a-z0-9+.-]*:\/\/)(.*)$/i.exec(uri || '');
    if (!schemeMatch) return uri;
    const [, scheme, rest] = schemeMatch;
    const fixed = rest.split('/').map((seg) => {
      if (!seg) return seg;
      let decoded = seg;
      try { decoded = decodeURIComponent(seg); } catch (e) { /* not valid %-encoding, treat as raw */ }
      return encodeURIComponent(decoded);
    }).join('/');
    return scheme + fixed;
  }

  // Sidecar-subtitle matching, following the convention every major player
  // uses: "Movie.srt" or "Movie.en.srt" next to "Movie.mkv". Prefers an
  // English-tagged file if more than one language is present.
  function findSubtitleFor(videoName, subtitleItems) {
    if (!subtitleItems || !subtitleItems.length) return null;
    const base = baseNameOf(videoName);
    const candidates = subtitleItems.filter((s) => baseNameOf(s.name).startsWith(base));
    if (!candidates.length) return null;
    const exact = candidates.find((s) => baseNameOf(s.name) === base);
    if (exact) return exact;
    const english = candidates.find((s) => /\.(en|eng)$/i.test(baseNameOf(s.name)));
    return english || candidates[0];
  }

  // Every subtitle file in the folder, most relevant first. findSubtitleFor
  // picks the one to load automatically; this is the list the player cycles
  // through when that guess wasn't the file you wanted — or matched nothing,
  // which is what happens whenever subtitles are named by language
  // ("English.srt") rather than after the video.
  function orderSubtitlesFor(videoName, subtitleItems) {
    if (!subtitleItems || !subtitleItems.length) return [];
    const best = findSubtitleFor(videoName, subtitleItems);
    const base = baseNameOf(videoName);
    const isRelated = (s) => s !== best && baseNameOf(s.name).startsWith(base);
    return (best ? [best] : [])
      .concat(subtitleItems.filter(isRelated))
      .concat(subtitleItems.filter((s) => s !== best && !isRelated(s)));
  }

  const UsbSource = { extOf, kindOf, humanSize, prettyName, findSubtitleFor, orderSubtitlesFor, normalizeUri };

  // Returns ALL storages tizen.filesystem reports (not just external/mounted).
  // Filtering happens in the caller so the UI can show raw diagnostics when
  // nothing matches — real hardware sometimes reports fields with different
  // casing/values than the docs suggest, and this makes that visible on-screen.
  UsbSource.listStorages = function () {
    return new Promise((resolve, reject) => {
      if (!global.tizen || !global.tizen.filesystem) return reject(new Error('filesystem API unavailable'));
      tizen.filesystem.listStorages(
        (storages) => resolve(storages),
        (err) => reject(err)
      );
    });
  };

  // storageLabel: the storage's own root location (e.g. "removable/usb1"), fixed per drive.
  // subPath: array of folder-name segments *below* the storage root ([] = root).
  // Returned items carry `subPath` (never the storage label) so breadcrumbs / re-navigation
  // stay stable regardless of the underlying storage's internal naming.
  UsbSource.listDir = function (storageLabel, subPath) {
    if (BeamEnv.isPreview) return UsbSource._listMock(subPath);

    return new Promise((resolve, reject) => {
      const location = [storageLabel].concat(subPath).join('/');
      tizen.filesystem.resolve(
        location,
        (dirHandle) => {
          dirHandle.listFiles(
            (entries) => {
              const all = entries.map((e) => ({
                name: e.name,
                isDir: e.isDirectory,
                size: e.fileSize,
                kind: e.isDirectory ? 'dir' : kindOf(e.name),
                subPath: subPath.concat([e.name]),
                uri: normalizeUri(e.toURI()),
              }));
              const items = all
                .filter((it) => it.isDir || isPlayableKind(it.kind))
                .sort((a, b) => (a.isDir === b.isDir ? a.name.localeCompare(b.name) : a.isDir ? -1 : 1));
              // Sidecar subtitles (Movie.srt next to Movie.mkv) aren't shown
              // as their own cards but are kept for auto-matching at playback.
              const subtitles = all.filter((it) => !it.isDir && it.kind === 'subtitle');
              resolve({ items, subtitles });
            },
            (err) => reject(err)
          );
        },
        (err) => reject(err),
        'r'
      );
    });
  };

  UsbSource._listMock = function (subPath) {
    return new Promise((resolve) => {
      let node = tizen.filesystem._mockTree;
      for (const seg of subPath) {
        node = (node.children || []).find((c) => c.name === seg);
      }
      const children = (node && node.children) || [];
      const all = children.map((c) => ({
        name: c.name,
        isDir: c.type === 'dir',
        size: c.size,
        kind: c.type === 'dir' ? 'dir' : kindOf(c.name),
        subPath: subPath.concat([c.name]),
        uri: c.type === 'dir' ? null : (c.previewUri || 'mock://' + subPath.concat([c.name]).join('/')),
      }));
      const items = all.filter((it) => it.isDir || isPlayableKind(it.kind));
      const subtitles = all.filter((it) => !it.isDir && it.kind === 'subtitle');
      setTimeout(() => resolve({ items, subtitles }), 180);
    });
  };

  // Capacity/free-space stats via tizen.systeminfo's STORAGE property.
  // Returns the first removable unit's {capacity, availableCapacity} in bytes,
  // or null if the platform doesn't expose it (never throws).
  UsbSource.getStorageStats = function () {
    if (BeamEnv.isPreview) {
      return Promise.resolve({ capacity: 64 * 1024 ** 3, availableCapacity: 41.3 * 1024 ** 3 });
    }
    return new Promise((resolve) => {
      if (!global.tizen || !global.tizen.systeminfo) return resolve(null);
      try {
        tizen.systeminfo.getPropertyValue(
          'STORAGE',
          (info) => {
            const units = (info && info.storages) || [];
            const removable = units.find((u) => u.isRemovable || u.isRemoveable) || units[units.length - 1];
            resolve(removable ? { capacity: removable.capacity, availableCapacity: removable.availableCapacity } : null);
          },
          () => resolve(null)
        );
      } catch (e) { resolve(null); }
    });
  };

  global.UsbSource = UsbSource;
  if (typeof module !== 'undefined' && module.exports) module.exports = UsbSource;
})(typeof window !== 'undefined' ? window : globalThis);
