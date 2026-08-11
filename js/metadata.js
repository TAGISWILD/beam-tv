/*
 * Offline filename metadata parsing.
 *
 * Turns "Interstellar.2014.2160p.BluRay.x265-GROUP.mkv" into a title, a year,
 * and a set of badges, using nothing but the string itself — no network call,
 * no API key, no account. That constraint is the point: it's what lets cards
 * and the hero panel look like a real media library while keeping Beam's
 * "no cloud service" promise intact.
 *
 * The approach is the one every scene-naming parser converges on: normalise
 * separators, then find the leftmost token that is recognisably *metadata*
 * rather than title. Everything before that cut is the title; the tokens from
 * the cut onwards are classified into resolution / HDR / codec / audio /
 * source. This works because release naming universally puts the title first.
 *
 * Loaded as a browser global (BeamMeta) on the TV, and as a CommonJS module
 * under `node --test js/metadata.test.js`.
 */
(function (global) {
  // Ordered longest-match-first within each group, since e.g. "hdr10+" must be
  // tested before "hdr10", which must be tested before "hdr".
  const RESOLUTION = [
    [/^(2160p?|4k|uhd)$/i, '4K'],
    [/^(1440p|2k)$/i, '1440p'],
    [/^1080[pi]$/i, '1080p'],
    [/^720[pi]$/i, '720p'],
    [/^(480[pi]|576[pi]|sd)$/i, 'SD'],
  ];
  const HDR = [
    [/^(dolby.?vision|dovi)$/i, 'Dolby Vision'],
    [/^hdr10\+$/i, 'HDR10+'],
    [/^(hdr10|hdr)$/i, 'HDR'],
  ];
  const CODEC = [
    [/^(x265|h\.?265|hevc)$/i, 'HEVC'],
    [/^(x264|h\.?264|avc)$/i, 'H.264'],
    [/^av1$/i, 'AV1'],
    [/^(xvid|divx)$/i, 'XviD'],
  ];
  const AUDIO = [
    [/^atmos$/i, 'Atmos'],
    [/^truehd$/i, 'TrueHD'],
    [/^dts[-.]?hd(ma)?$/i, 'DTS-HD'],
    [/^dts$/i, 'DTS'],
    [/^(ac3|eac3|ddp?|dd\+|dd5)$/i, 'Dolby Digital'],
    [/^flac$/i, 'FLAC'],
    [/^aac$/i, 'AAC'],
    [/^mp3$/i, 'MP3'],
  ];
  const SOURCE = [
    [/^(bluray|bdrip|brrip|bdremux)$/i, 'Blu-ray'],
    [/^remux$/i, 'Remux'],
    [/^(webdl|webrip|web)$/i, 'WEB'],
    [/^hdtv$/i, 'HDTV'],
    [/^(dvdrip|dvd)$/i, 'DVD'],
    [/^cam$/i, 'CAM'],
  ];
  // Recognised as "not part of the title" so they mark the cut, but not
  // surfaced anywhere — nobody browsing their own library needs to be told a
  // file is a REPACK.
  const NOISE = /^(proper|repack|extended|unrated|uncut|directors?|cut|imax|remastered|multi|complete|internal|limited|dubbed|subbed|retail|ws|hybrid|\d+bit|10bit|8bit|dl|rarbg|yts|yify|ita|eng|hindi|dual|audio)$/i;

  const SEASON_EPISODE = /^s(\d{1,2})[\s.]?e(\d{1,3})$/i;
  const SEASON_EPISODE_X = /^(\d{1,2})x(\d{2,3})$/i;
  const SEASON_ONLY = /^s(\d{1,2})$/i;
  const EPISODE_ONLY = /^e(\d{1,3})$/i;
  const YEAR = /^((?:19|20)\d{2})$/;

  // A year can only be a year if it isn't in the future. This is what keeps
  // "Blade Runner 2049" and "2067" from having their titles amputated —
  // 2049 parses as a number but no film released then, so it stays title.
  function plausibleYear(token) {
    const m = YEAR.exec(token);
    if (!m) return null;
    const y = Number(m[1]);
    return y <= new Date().getFullYear() + 1 ? y : null;
  }

  function matchTable(table, token) {
    for (const [re, label] of table) if (re.test(token)) return label;
    return null;
  }

  // Release groups arrive glued to the previous token with a hyphen
  // ("x264-SPARKS"), so a token also counts as metadata when the part before
  // its first hyphen does. Testing the prefix rather than splitting on every
  // hyphen is what keeps real hyphenated titles ("Spider-Man", "Ant-Man")
  // from being mistaken for a group suffix.
  function classify(token) {
    const candidates = [token];
    const dash = token.indexOf('-');
    if (dash > 0) candidates.push(token.slice(0, dash));

    for (const t of candidates) {
      const year = plausibleYear(t);
      if (year) return { type: 'year', value: year };
      if (SEASON_EPISODE.test(t)) {
        const m = SEASON_EPISODE.exec(t);
        return { type: 'episode', season: Number(m[1]), episode: Number(m[2]) };
      }
      if (SEASON_EPISODE_X.test(t)) {
        const m = SEASON_EPISODE_X.exec(t);
        return { type: 'episode', season: Number(m[1]), episode: Number(m[2]) };
      }
      if (SEASON_ONLY.test(t)) return { type: 'season', season: Number(SEASON_ONLY.exec(t)[1]) };
      if (EPISODE_ONLY.test(t)) return { type: 'episodeOnly', episode: Number(EPISODE_ONLY.exec(t)[1]) };
      const res = matchTable(RESOLUTION, t); if (res) return { type: 'resolution', value: res };
      const hdr = matchTable(HDR, t); if (hdr) return { type: 'hdr', value: hdr };
      const codec = matchTable(CODEC, t); if (codec) return { type: 'codec', value: codec };
      const audio = matchTable(AUDIO, t); if (audio) return { type: 'audio', value: audio };
      const source = matchTable(SOURCE, t); if (source) return { type: 'source', value: source };
      if (NOISE.test(t)) return { type: 'noise' };
    }
    return null;
  }

  function stripExtension(name) {
    return String(name || '').replace(/\.[a-z0-9]{1,5}$/i, '');
  }

  // Capitalises the first word only, and only when it has no capitals of its
  // own. Deliberately minimal: a per-word title-caser looks tempting but gets
  // interior articles wrong ("Across The Spider-Verse") and overrides casing
  // the person chose on purpose ("iPhone test clip" -> "iPhone Test Clip").
  // Whatever casing is already in a filename is better information than a
  // guess, so the only thing worth fixing is an all-lowercase opening word.
  function capitalizeFirst(words) {
    if (!words.length) return words;
    const [first, ...rest] = words;
    // Entirely lowercase, or leave it alone. Testing only the *first* letter
    // isn't enough: "iPhone" starts lowercase but carries a deliberate capital
    // later, and uppercasing its head yields "IPhone".
    if (!/^[a-z]+$/.test(first)) return words;
    return [first[0].toUpperCase() + first.slice(1), ...rest];
  }

  function parse(fileName) {
    const bare = stripExtension(fileName);

    // Bracketed segments are release-group and checksum noise essentially
    // without exception ("[YTS.MX]", "[1A2B3C4D]"), so they go before
    // tokenising. Parenthesised segments are kept: that's where a year most
    // often lives, and "(2014)" is the least ambiguous year signal there is.
    const cleaned = bare
      .replace(/\[[^\]]*\]/g, ' ')
      .replace(/\{[^}]*\}/g, ' ')
      .replace(/[._]+/g, ' ')
      .replace(/[()]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const tokens = cleaned.split(' ').filter(Boolean);
    const found = {
      year: null, season: null, episode: null,
      resolution: null, hdr: null, codec: null, audio: null, source: null,
    };
    let cut = tokens.length;

    tokens.forEach((token, i) => {
      const c = classify(token);
      if (!c) return;
      if (i < cut) cut = i;
      if (c.type === 'year' && found.year == null) found.year = c.value;
      else if (c.type === 'episode') { found.season = c.season; found.episode = c.episode; }
      else if (c.type === 'season' && found.season == null) found.season = c.season;
      else if (c.type === 'episodeOnly' && found.episode == null) found.episode = c.episode;
      else if (c.type === 'resolution' && !found.resolution) found.resolution = c.value;
      else if (c.type === 'hdr' && !found.hdr) found.hdr = c.value;
      else if (c.type === 'codec' && !found.codec) found.codec = c.value;
      else if (c.type === 'audio' && !found.audio) found.audio = c.value;
      else if (c.type === 'source' && !found.source) found.source = c.value;
    });

    // A cut at 0 would leave no title at all. That happens for real files whose
    // title *is* a bare year — "1917.2019.1080p.mkv", "2012 (2009).mkv" — so
    // the first token is handed back to the title and its year reading dropped.
    if (cut === 0 && tokens.length) {
      cut = 1;
      if (found.year === plausibleYear(tokens[0])) {
        const later = tokens.slice(1).map(plausibleYear).find(Boolean);
        found.year = later || null;
      }
    }

    const title = capitalizeFirst(tokens.slice(0, cut)).join(' ').replace(/[-–\s]+$/, '').trim();

    // An episode title sits between the SxxExx marker and the next piece of
    // metadata: "Severance.S02E01.Hello.Ms.Cobel.1080p" -> "Hello Ms Cobel".
    let episodeTitle = null;
    if (found.episode != null) {
      const markerIndex = tokens.findIndex((t) => {
        const c = classify(t);
        return c && (c.type === 'episode' || c.type === 'episodeOnly');
      });
      if (markerIndex >= 0) {
        const rest = [];
        for (let i = markerIndex + 1; i < tokens.length; i++) {
          if (classify(tokens[i])) break;
          rest.push(tokens[i]);
        }
        if (rest.length) episodeTitle = capitalizeFirst(rest).join(' ');
      }
    }

    return Object.assign(found, {
      title: title || stripExtension(fileName),
      episodeTitle,
      // Short, high-signal, for the corner of a card. Resolution and dynamic
      // range are the only two a viewer scanning a grid actually reads.
      badges: [found.resolution, found.hdr].filter(Boolean),
      // Longer technical set, for the hero panel where there's room.
      chips: [found.source, found.codec, found.audio].filter(Boolean),
    });
  }

  // The one-line human descriptor under a card's name. Deliberately not the
  // old "VIDEO · 17 GB": the kind is already obvious from the artwork and the
  // grid it's in, and a file size tells a viewer nothing about whether they
  // want to watch the thing.
  function describe(meta, extra) {
    const parts = [];
    if (meta.season != null && meta.episode != null) {
      parts.push('S' + meta.season + ' E' + meta.episode);
      if (meta.episodeTitle) parts.push(meta.episodeTitle);
    } else if (meta.year) {
      parts.push(String(meta.year));
    }
    if (extra) parts.push(extra);
    return parts.join(' · ');
  }

  const BeamMeta = { parse, describe };
  global.BeamMeta = BeamMeta;
  if (typeof module !== 'undefined' && module.exports) module.exports = BeamMeta;
})(typeof window !== 'undefined' ? window : globalThis);
