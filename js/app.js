(function () {
  const ICONS = {
    home: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5 10v10h5v-6h4v6h5V10"/>',
    usb: '<rect x="7" y="2" width="10" height="6" rx="1"/><path d="M12 8v7"/><circle cx="12" cy="19" r="3"/><path d="M9 12h-2a2 2 0 0 0-2 2v1"/><path d="M15 12h2a2 2 0 0 1 2 2v1"/>',
    network: '<path d="M5 12.5a11 11 0 0 1 14 0"/><path d="M8.5 16a6 6 0 0 1 7 0"/><path d="M12 19.5h.01"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 0 1-4 0v-.09A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.55-1H3a2 2 0 0 1 0-4h.09A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.55V3a2 2 0 0 1 4 0v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9c.14.36.44.63.8.8V9c.71.2 1.55.2 1.55 1v4a1.7 1.7 0 0 0-1.55 1z"/>',
    folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/>',
    // Sprocket holes down both edges. The previous path drew two horizontal
    // and two vertical lines across a rectangle, which is a 3x3 grid — it read
    // as a spreadsheet, and it was the glyph on every video card in the app.
    film: '<rect x="2.5" y="4" width="19" height="16" rx="2"/><path d="M7.5 4v16M16.5 4v16M2.5 8h5M2.5 12h5M2.5 16h5M16.5 8h5M16.5 12h5M16.5 16h5"/>',
    music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
    photo: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="9" r="1.8"/><path d="m21 15-5-5-9 9"/>',
    play: '<polygon points="6 3 20 12 6 21 6 3"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    server: '<rect x="3" y="4" width="18" height="6" rx="1.5"/><rect x="3" y="14" width="18" height="6" rx="1.5"/><path d="M7 7h.01M7 17h.01"/>',
    back: '<path d="M15 18l-6-6 6-6"/>',
    hdd: '<rect x="2" y="7" width="20" height="10" rx="2"/><circle cx="7" cy="12" r="1.4"/><path d="M11 12h9"/>',
    scan: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3.5"/><path d="M12 3v3M12 18v3M21 12h-3M6 12H3"/>',
  };
  function icon(name, size) {
    size = size || 24;
    return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ''}</svg>`;
  }

  /* A filename hashes to a hue so an item keeps a stable identity colour across
   * sessions. Two things changed about how that hue is *spent*:
   *
   * The old palette spread across the full wheel (maroon, olive, green, purple)
   * at 38% saturation and painted every card with it. Sixty saturated cards
   * side by side don't read as designed, they read as confetti — no two
   * neighbours belong to the same shelf. So the hue set is now a tight
   * blue-through-violet band, and cards take a near-neutral 16% wash of it:
   * enough to tell two folders apart, not enough to compete.
   *
   * The saturated version moved to the hero, where exactly one is on screen at
   * a time. There, a large tinted surface reads as the item's identity, which
   * is what the colour was reaching for in the first place.
   */
  const HUES = [212, 232, 258, 284, 196, 172, 316];
  function hashHue(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
    return HUES[h % HUES.length];
  }
  // Two forms of the same thing: the bare value for assigning to
  // element.style.background, and the full declaration for an inline style
  // attribute. Deriving the value by string-stripping the declaration is what
  // left the hero's art panel unpainted — the trailing semicolon came along
  // with it and made the property value invalid.
  function thumbGradient(name) {
    const hue = hashHue(name || 'x');
    return `linear-gradient(150deg, hsl(${hue} 22% 21%), hsl(${hue} 26% 12%))`;
  }
  function thumbStyle(name) {
    return `background: ${thumbGradient(name)};`;
  }
  function heroWash(name) {
    const hue = hashHue(name || 'x');
    return `linear-gradient(100deg, hsl(${hue} 46% 21%) 0%, hsl(${hue} 38% 13%) 44%, rgba(0,0,0,0) 76%)`;
  }

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $all = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  function toast(msg, ms) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove('show'), ms || 2600);
  }

  function showScreen(id) {
    $all('.screen').forEach((s) => s.classList.toggle('active', s.id === 'screen-' + id));
    if (id !== 'player' && id !== 'photo') App._lastNonPlayerScreen = id;
    App.activeScreen = id;
    window.BeamPlayerActive = id === 'player' || id === 'photo';
    const chromeless = id === 'player' || id === 'photo';
    const sidebar = $('#sidebar');
    // display:none, not opacity/visibility: reports from the real TV showed
    // the sidebar's background panel still rendering as an empty bar during
    // playback (icons/labels gone but the panel itself visible) — a
    // compositing quirk with opacity+visibility on Tizen's embedded WebKit.
    // display:none removes it from the render tree outright, so there's no
    // partial-render state possible. Costs the fade transition, but this has
    // to be unconditionally correct on real hardware.
    sidebar.style.display = chromeless ? 'none' : 'flex';
    // Direct call, not requestAnimationFrame: content is already synchronously
    // in the DOM by the time showScreen() runs, and rAF can go unfired for an
    // arbitrarily long time when the callback is scheduled while the page/tab
    // isn't the active rendering target — which left focus stranded on
    // whatever screen the user had left.
    spatialNav.focusFirst();
  }

  const GLYPH_BY_KIND = { audio: 'music', image: 'photo', video: 'film' };

  /* ---------------- Rails ----------------
   * Keeps the focused element inside its clipping ancestor by translating the
   * track under it, rather than scrolling. Two reasons it isn't scrollTop:
   *
   *  - A transform is handled entirely by the compositor: holding down a D-pad
   *    direction slides an already-rasterised layer instead of re-painting the
   *    strip on every step.
   *  - Scrolling is all-or-nothing per container. The hero has to stay put
   *    while the grid beneath it moves, and a scroll on the screen would carry
   *    the hero away with it.
   *
   * Offsets are read from offsetLeft/offsetTop, which report *layout* position
   * and are unaffected by the transform already applied — so this stays
   * correct across repeated moves without having to track a virtual origin.
   */
  const RAIL_PAD = 26;
  const BeamRails = {
    reveal(el) {
      let node = el;
      while (node && node.parentElement) {
        const rail = node.parentElement;
        if (rail.classList && rail.classList.contains('rail')) this._slide(rail, node, el);
        node = rail;
      }
    },
    /*
     * Distance from `target` to `rail`, accumulated along the offsetParent
     * chain rather than read straight off target.offsetTop.
     *
     * A single read is only correct when the rail *is* the target's
     * offsetParent. On Home it isn't: a card sits inside a horizontal row rail
     * nested in the vertical screen rail, and because .rail is
     * position:relative every rail establishes its own positioning context. So
     * a card in a row reported an offsetTop of ~10px — its position inside its
     * row — to the outer vertical rail, which concluded everything was already
     * on screen and never scrolled past the first row.
     *
     * Intermediate non-positioned boxes (.row, the tracks) need no special
     * handling: offsetTop is measured to the offsetParent's padding box and so
     * already carries their contribution.
     */
    _offsetWithin(rail, target, horizontal) {
      let total = 0;
      let node = target;
      while (node && node !== rail) {
        total += horizontal ? node.offsetLeft : node.offsetTop;
        node = node.offsetParent;
      }
      return total;
    },
    // The unit the rail pages by: the track's own child that contains the
    // target. For the vertical screen rail that's the whole .row, so bringing a
    // card into view brings its "Movies" / "TV Shows" heading with it. For a
    // horizontal row rail the track's child *is* the card, so this is a no-op
    // there. Without it, revealing the first row scrolled 27px past the top to
    // manufacture padding above the card and cropped the heading off-screen.
    _blockOf(track, target) {
      let block = target;
      while (block.parentElement && block.parentElement !== track) block = block.parentElement;
      return block;
    },
    _slide(rail, track, target) {
      const horizontal = rail.classList.contains('rail-x');
      const start = this._offsetWithin(rail, target, horizontal);
      const blockStart = this._offsetWithin(rail, this._blockOf(track, target), horizontal);
      const size = horizontal ? target.offsetWidth : target.offsetHeight;
      const viewport = horizontal ? rail.clientWidth : rail.clientHeight;
      const content = horizontal ? track.scrollWidth : track.scrollHeight;

      let offset = rail._railOffset || 0;
      if (blockStart - offset < RAIL_PAD) offset = blockStart - RAIL_PAD;
      if (start + size - offset > viewport - RAIL_PAD) offset = start + size - viewport + RAIL_PAD;
      offset = Math.min(Math.max(0, content - viewport), Math.max(0, offset));

      rail._railOffset = offset;
      track.style.transform = horizontal ? `translateX(${-offset}px)` : `translateY(${-offset}px)`;
    },
  };
  spatialNav.onReveal = (el) => BeamRails.reveal(el);

  function railEl(axis, track) {
    const rail = document.createElement('div');
    rail.className = 'rail rail-' + axis;
    rail.appendChild(track);
    return rail;
  }

  /* ---------------- Hero ----------------
   * One panel per screen, re-pointed at whatever is focused. Built once per
   * render and then mutated in place: rebuilding it on every focus change
   * would mean discarding and re-creating a 316px-tall subtree on each D-pad
   * press, which is exactly the kind of per-keypress work this pass exists to
   * remove.
   */
  function heroEl() {
    const el = document.createElement('div');
    el.className = 'hero';
    el.innerHTML = `
      <div class="hero-wash"></div>
      <div class="hero-body">
        <div class="hero-eyebrow"></div>
        <div class="hero-title"></div>
        <div class="hero-sub"></div>
        <div class="hero-chips"></div>
        <div class="hero-resume hidden"></div>
      </div>
      <div class="hero-art"></div>`;
    return el;
  }

  // Guards the async artwork fetch below: focus can move several times before
  // a frame-grab resolves, and without a token an older, slower item's art
  // would land on the hero after a newer one had already claimed it.
  let heroToken = 0;

  function updateHero(hero, d) {
    if (!hero || !d) return;
    const my = ++heroToken;
    $('.hero-wash', hero).style.background = heroWash(d.hueKey || d.title || '');
    $('.hero-eyebrow', hero).textContent = d.eyebrow || '';
    $('.hero-title', hero).textContent = d.title || '';
    $('.hero-sub', hero).textContent = d.sub || '';

    const chips = $('.hero-chips', hero);
    chips.innerHTML = (d.chips || []).map((c) => `<span class="chip">${escapeHtml(c)}</span>`).join('');

    const resume = $('.hero-resume', hero);
    if (d.progress != null && d.progress > 0.01) {
      resume.classList.remove('hidden');
      resume.innerHTML = `<span>${escapeHtml(d.resumeLabel || 'Resume')}</span>
        <span class="bar"><i style="width:${Math.round(d.progress * 100)}%"></i></span>`;
    } else {
      resume.classList.add('hidden');
      resume.innerHTML = '';
    }

    const art = $('.hero-art', hero);
    // Explicit glyph wins over the kind-derived one: a Settings or Network
    // hero has no media "kind" and was falling through to a folder icon.
    art.innerHTML = icon(d.glyph || GLYPH_BY_KIND[d.kind] || 'folder', 62);
    art.classList.remove('has-art');
    art.style.backgroundImage = 'none';
    art.style.background = thumbGradient(d.hueKey || d.title || '');

    const applyArt = (url) => {
      if (!url || my !== heroToken || !art.isConnected) return;
      art.style.backgroundImage = `url("${url}")`;
      art.classList.add('has-art');
    };
    // Priority fetch: the hero is by definition the thing the viewer is
    // looking at, so its artwork jumps ahead of the cards still warming up.
    if (d.artUri) ThumbGrabber.grabImageThumb(d.artUri, true).then(applyArt);
    else if (d.uri && d.kind === 'image') ThumbGrabber.grabImageThumb(d.uri, true).then(applyArt);
    else if (d.uri && d.kind === 'video') ThumbGrabber.grabFrame(d.uri, true).then(applyArt);
  }

  // Cards carry their own hero descriptor, so the wiring is one listener rather
  // than every render remembering to hook up its own.
  document.addEventListener('nav-focus', (e) => {
    const el = e.target;
    if (!el || !el._hero) return;
    const screen = el.closest ? el.closest('.screen') : null;
    const hero = screen ? $('.hero', screen) : null;
    if (hero) updateHero(hero, el._hero);
  });

  /*
   * Builds a card from a display descriptor rather than from a raw filesystem
   * entry. Six different things are shown as cards — USB files, folders, DLNA
   * items, collapsed TV shows, Continue Watching entries, and source tiles —
   * and giving each of those its own bespoke card markup is how the old
   * "VIDEO · 17 GB" subtitle ended up on things that had neither a kind worth
   * naming nor a size worth reading. Callers describe *what to show*; this
   * decides how a card looks.
   *
   * d: { title, sub, kind, isDir, badges, uri, thumbUri, progress, hero, onSelect }
   */
  function cardEl(d) {
    const { title, sub, kind, isDir, badges, uri, thumbUri, progress, onSelect } = d;
    const el = document.createElement('div');
    el.className = 'card focusable' + (isDir ? ' folder' : '');
    // An explicit glyph wins over the kind-derived default, so cards that are
    // actions rather than media (Scan Network, Add Manually, Browse Files) show
    // what they do instead of a folder icon they inherited from isDir.
    const glyph = d.glyph
      ? icon(d.glyph, isDir ? 46 : 40)
      : (isDir ? icon('folder', 46) : icon(GLYPH_BY_KIND[kind] || 'film', 40));
    el.innerHTML = `
      <div class="thumb" style="${thumbStyle(d.hueKey || title)}">
        <div class="shine"></div>
        <span class="glyph">${glyph}</span>
        ${(badges || []).length ? `<div class="badges">${badges.map((b) => `<span class="badge${b === 'HDR' || b === 'HDR10+' || b === 'Dolby Vision' ? ' hdr' : ''}">${escapeHtml(b)}</span>`).join('')}</div>` : ''}
        ${!isDir && kind === 'video' ? `<span class="play-badge">${icon('play', 16)}</span>` : ''}
        ${progress != null ? `<div class="progress"><i style="width:${Math.round(progress * 100)}%"></i></div>` : ''}
      </div>
      <div class="meta">
        <div class="name">${escapeHtml(title)}</div>
        <div class="sub">${escapeHtml(sub || '')}</div>
      </div>`;
    el._hero = d.hero || null;
    el.addEventListener('nav-select', onSelect);
    el.addEventListener('click', onSelect);

    if (!isDir && typeof ThumbGrabber !== 'undefined') {
      const thumbEl = el.querySelector('.thumb');
      const applyImage = (url) => {
        thumbEl.style.backgroundImage = `url("${url}")`;
        thumbEl.style.backgroundSize = 'cover';
        thumbEl.style.backgroundPosition = 'center';
        thumbEl.classList.add('has-thumb');
      };
      // Stored rather than started. Firing here meant building a card *was*
      // requesting a thumbnail, so rendering a 200-file folder enqueued 200
      // jobs — each video one a real hardware decode — and the queue then
      // outlived the screen the viewer was looking at by a wide margin.
      // primeThumbs() and the nav-focus handler below decide when these run.
      el._loadThumb = (priority) => {
        const done = (url) => { if (url && el.isConnected) applyImage(url); };
        // Only *video frame-grabbing* is gated on the preference, not artwork
        // in general: decoding a frame is the expensive path (it occupies the
        // TV's single hardware decoder), whereas a poster sidecar or a photo is
        // an ordinary image decode and stays on regardless.
        const allowFrameGrab = !App.prefs || App.prefs.thumbnails;
        if (thumbUri) {
          // Server-provided art (DLNA albumArtURI) — cheap and reliable, skip
          // frame-grabbing entirely.
          ThumbGrabber.grabImageThumb(thumbUri, priority).then(done);
        } else if (kind === 'image' && uri) {
          ThumbGrabber.grabImageThumb(uri, priority).then(done);
        } else if (kind === 'video' && uri && allowFrameGrab) {
          ThumbGrabber.grabFrame(uri, priority).then(done);
        }
      };
    }
    return el;
  }

  // How many thumbnails to fetch without being asked. Roughly one screenful of
  // the 6-column grid, so what's actually on screen at render time is covered
  // and nothing below the fold costs anything until focus heads that way.
  const EAGER_THUMBS = 12;
  const READ_AHEAD = 6;

  function loadThumb(el, priority) {
    const fn = el && el._loadThumb;
    if (!fn) return;
    el._loadThumb = null; // one shot — ThumbGrabber memoizes, but don't re-ask
    fn(priority);
  }

  function primeThumbs(container) {
    $all('.card', container).slice(0, EAGER_THUMBS).forEach((el) => loadThumb(el));
  }

  // Focus is the read-ahead signal: the focused card jumps its lane's queue,
  // and the next few in DOM order are warmed at normal priority so travelling
  // along a row stays ahead of the viewer rather than chasing them.
  document.addEventListener('nav-focus', (e) => {
    const card = e.target && e.target.classList && e.target.classList.contains('card') ? e.target : null;
    if (!card) return;
    loadThumb(card, true);
    let n = card;
    for (let i = 0; i < READ_AHEAD && (n = n.nextElementSibling); i++) loadThumb(n);
  });

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  const KIND_LABEL = { video: 'Video', audio: 'Music', image: 'Photo' };

  /*
   * The single place a media file becomes a card. Everything a viewer reads —
   * the title, the "2014 · HEVC" line, the 4K/HDR badges, the hero copy — comes
   * out of BeamMeta's parse of the filename, so a file named the way people
   * actually name files presents as a library entry rather than as a path.
   */
  function fileCard(item, opts) {
    const o = opts || {};
    const meta = item.meta || BeamMeta.parse(item.name);
    const sizeLabel = item.size != null ? UsbSource.humanSize(item.size) : '';
    return cardEl({
      // Overridable because context changes what identifies an item. In a
      // Movies row the show/film title is the identity; inside one show's
      // episode list every card would repeat that same title, and the thing
      // that actually distinguishes them is the episode.
      title: o.titleOverride || meta.title,
      sub: o.subOverride || BeamMeta.describe(meta) || KIND_LABEL[item.kind] || '',
      kind: item.kind,
      isDir: false,
      badges: meta.badges,
      uri: item.uri,
      thumbUri: item.posterUri || item.thumbUri,
      progress: o.progress,
      hueKey: meta.title,
      hero: {
        eyebrow: o.eyebrow || KIND_LABEL[item.kind] || '',
        title: o.titleOverride || meta.title,
        // The hero has room for the full descriptor plus the file size, which
        // is genuinely useful here (deciding between two copies of a film) in
        // a way it never was as a card subtitle.
        sub: [BeamMeta.describe(meta), sizeLabel].filter(Boolean).join('  ·  '),
        chips: meta.badges.concat(meta.chips),
        kind: item.kind,
        uri: item.uri,
        artUri: item.posterUri || item.thumbUri,
        hueKey: meta.title,
        progress: o.progress,
        resumeLabel: o.resumeLabel,
      },
      onSelect: o.onSelect,
    });
  }

  function folderCard(item, opts) {
    const o = opts || {};
    const name = item.name;
    return cardEl({
      title: name,
      sub: o.sub || 'Folder',
      kind: 'dir',
      isDir: true,
      hueKey: name,
      hero: {
        eyebrow: 'Folder',
        title: name,
        sub: o.sub || 'Open to see what’s inside',
        chips: [],
        kind: 'dir',
        hueKey: name,
      },
      onSelect: o.onSelect,
    });
  }

  const App = {
    activeScreen: 'home',
    usbState: { storageLabel: null, path: [] },
    dlnaState: { server: null, trail: [{ id: '0', name: 'Root' }] },
    player: null,
    navGen: 0,
    pip: false,
    // Grouped library for the drive scanned this session, or null before the
    // first scan / after a drive change. See ensureLibrary().
    library: null,
    prefs: null,
  };

  // Every async render (renderUsbDir, renderHome, ...) grabs a token when it
  // starts and checks it's still current before touching the DOM/focus at
  // the end. If the user has since navigated elsewhere, a slower-resolving
  // older render just discards its result instead of clobbering whatever
  // screen is now showing — this is what caused focus to randomly land back
  // on a stale card from a screen the user had already left.
  function beginNav() { return ++App.navGen; }
  function staleNav(token) { return token !== App.navGen; }

  // ---------------- Sidebar ----------------
  function initSidebar() {
    const items = [
      { id: 'home', label: 'Home', icon: 'home' },
      { id: 'usb', label: 'USB', icon: 'usb' },
      { id: 'network', label: 'Network', icon: 'network' },
      { id: 'settings', label: 'Settings', icon: 'settings' },
    ];
    const nav = $('#sidebar');
    items.forEach((it) => {
      const el = document.createElement('div');
      el.className = 'nav-item focusable' + (it.id === 'home' ? ' current' : '');
      el.dataset.target = it.id;
      el.innerHTML = `${icon(it.icon, 26)}<span class="label">${it.label}</span>`;
      el.addEventListener('nav-select', () => navigateTo(it.id));
      el.addEventListener('click', () => navigateTo(it.id));
      nav.insertBefore(el, $('.nav-spacer', nav));
    });
  }

  function setActiveNav(id) {
    $all('.nav-item').forEach((el) => el.classList.toggle('current', el.dataset.target === id));
  }

  function navigateTo(id) {
    setActiveNav(id);
    if (id === 'home') renderHome();
    else if (id === 'usb') { App.usbState = { storageLabel: null, path: [] }; renderUsbRoot(); }
    else if (id === 'network') renderNetworkHome();
    else if (id === 'settings') renderSettings();
  }

  // ---------------- Home ----------------
  // Locating the removable drive was duplicated between Home and the USB
  // screen with the same regex in both. It's one question with one answer, and
  // the storage list is also where a "no drive plugged in" state is decided,
  // so it returns the raw list too rather than making callers ask twice.
  // Never throws: a platform with no filesystem API is a "no drive" answer,
  // not an error worth surfacing.
  // `all` comes back regardless of whether a match was found, because the USB
  // screen shows the raw storage table as on-screen diagnostics when nothing
  // matches — real firmware reports type/state values that don't always agree
  // with the documentation, and that table is the only way to see it happening
  // on a TV with no console attached.
  async function findUsbStorage() {
    try {
      const storages = await UsbSource.listStorages();
      const removable = storages.filter((s) => /external|removable|mmc|usb/i.test(String(s.type))
        || /removable/i.test(String(s.label)));
      return { label: removable.length ? removable[0].label : null, all: storages };
    } catch (e) {
      return { label: null, all: [], error: e };
    }
  }

  // A scan walks the whole drive, so it happens once per drive per session and
  // is reused by Home and by anything else that wants the grouped library.
  // Keyed by label so swapping drives re-scans rather than showing the old one.
  async function ensureLibrary(label, onProgress) {
    if (App.library && App.library.label === label) return App.library;
    const token = App.navGen;
    const result = await BeamLibrary.scan(label, {
      onProgress,
      shouldCancel: () => token !== App.navGen,
    });
    if (result.cancelled) return null;
    App.library = Object.assign({ label }, result);
    return App.library;
  }

  // Checks each Continue-Watching entry against what's actually reachable
  // right now — a USB entry only shows if that file still resolves on a
  // mounted drive, a DLNA entry only if its server is still saved. Stale
  // entries (drive unplugged, server removed) are silently dropped, not shown
  // then failing when clicked.
  async function getAvailableHistory() {
    const history = App.player.getWatchHistory();
    if (!history.length) return [];

    const usb = await findUsbStorage();
    const usbLabel = usb.label;
    const dlnaServerIds = new Set(DlnaSource.loadServers().map((s) => s.id));

    const checks = history.map(async (h) => {
      if (h.key.startsWith('usb:')) {
        if (!usbLabel) return null;
        if (BeamEnv.isPreview) return h; // mock fs has no real resolve semantics
        const subPath = h.key.slice(4).split('/');
        try {
          await new Promise((resolve, reject) => tizen.filesystem.resolve([usbLabel].concat(subPath).join('/'), resolve, reject, 'r'));
          return h;
        } catch (e) { return null; }
      }
      if (h.key.startsWith('dlna:')) {
        const serverId = h.key.split(':')[1];
        return dlnaServerIds.has(serverId) ? h : null;
      }
      return null;
    });
    return (await Promise.all(checks)).filter(Boolean);
  }

  /*
   * Home is now a library rather than a pair of source tiles. It walks the
   * drive once (BeamLibrary.scan) and presents what it found as rows, so the
   * screen opens onto the viewer's actual films and shows instead of onto two
   * buttons and a paragraph of instructions.
   *
   * The rows are built progressively, in the order they can be known:
   * Continue Watching needs only localStorage and lands immediately, while the
   * library rows wait on the walk. That ordering matters because it means the
   * screen is useful before the scan finishes rather than after.
   */
  async function renderHome() {
    const myNav = beginNav();
    const root = $('#screen-home .content');
    root.innerHTML = '';

    const hero = heroEl();
    root.appendChild(hero);
    const stack = document.createElement('div');
    stack.className = 'rail-track';
    root.appendChild(railEl('y', stack));
    showScreen('home');

    updateHero(hero, {
      eyebrow: 'Beam', title: 'Your library', glyph: 'hdd',
      sub: 'Looking for media…', kind: 'dir', hueKey: 'beam',
    });

    const history = await getAvailableHistory();
    if (staleNav(myNav)) return;
    if (history.length) {
      stack.appendChild(rowEl('Continue Watching', history.map(cardFromHistory)));
      spatialNav.focusFirst();
      primeThumbs(root);
    }

    const usb = await findUsbStorage();
    if (staleNav(myNav)) return;

    if (!usb.label) {
      stack.appendChild(rowEl('Sources', [browseCard(), networkCard()]));
      stack.appendChild(htmlToEl(emptyHtml('usb', 'No USB drive found',
        'Plug a USB flash drive or hard disk into your TV’s USB port and it will appear here automatically. You can also add a network media server.')));
      if (!history.length) spatialNav.focusFirst();
      return;
    }

    const note = htmlToEl('<div class="scan-note">Scanning your drive…</div>');
    stack.appendChild(note);
    if (!history.length) spatialNav.focusFirst();

    const lib = await ensureLibrary(usb.label, (p) => {
      if (!staleNav(myNav) && note.isConnected) {
        note.textContent = `Scanning your drive… ${p.files} files in ${p.dirs} folders`;
      }
    });
    if (staleNav(myNav) || !lib) return;
    note.remove();

    App.usbState.storageLabel = usb.label;
    App.usbState.driveName = usb.label.split('/').pop() || 'USB Drive';

    if (lib.recent.length) stack.appendChild(rowEl('Recently Added', lib.recent.map((f) => libraryCard(f))));
    if (lib.movies.length) stack.appendChild(rowEl('Movies', lib.movies.map((f) => libraryCard(f))));
    if (lib.shows.length) stack.appendChild(rowEl('TV Shows', lib.shows.map(showCard)));
    if (lib.music.length) stack.appendChild(rowEl('Music', lib.music.map((f) => libraryCard(f))));
    if (lib.photos.length) stack.appendChild(rowEl('Photos', lib.photos.map((f) => libraryCard(f, lib.photos))));
    stack.appendChild(rowEl('Sources', [browseCard(), networkCard()]));

    const total = lib.movies.length + lib.shows.length + lib.music.length + lib.photos.length;
    if (!total) {
      stack.appendChild(htmlToEl(emptyHtml('folder', 'Nothing playable found',
        `Beam walked ${App.usbState.driveName} but found no video, audio, or image files it can play.`)));
    }
    if (lib.truncated) {
      stack.appendChild(htmlToEl('<div class="scan-note">This drive is very large, so only the first several thousand files were catalogued. Use Browse Files to reach the rest.</div>'));
    }

    spatialNav.focusFirst();
    primeThumbs(root);
  }

  // A library file, playing in place rather than needing its folder opened
  // first. Photos are handed their siblings so prev/next still works when
  // they're reached from a Home row instead of from a folder listing.
  function libraryCard(f, photoSiblings) {
    return fileCard(f, {
      onSelect: () => {
        if (f.kind === 'image') {
          const siblings = photoSiblings || [f];
          openPhotoViewer(siblings, Math.max(0, siblings.indexOf(f)), () => renderHome());
        } else {
          const sub = f.kind === 'video' ? UsbSource.findSubtitleFor(f.name, f.subtitles) : null;
          openPlayer({
            key: 'usb:' + f.subPath.join('/'), title: f.name, uri: f.uri,
            subtitleUri: sub ? sub.uri : undefined, sourceType: f.kind,
            subtitleCandidates: f.kind === 'video' ? UsbSource.orderSubtitlesFor(f.name, f.subtitles) : [],
            backTo: () => renderHome(),
          });
        }
      },
    });
  }

  // One card per show, not per episode: a complete season otherwise floods the
  // row with 24 near-identical entries and buries everything else on the screen.
  function showCard(show) {
    const seasons = show.seasonCount === 1 ? '1 season' : show.seasonCount + ' seasons';
    const eps = show.episodes.length === 1 ? '1 episode' : show.episodes.length + ' episodes';
    const first = show.episodes[0];
    return cardEl({
      title: show.title,
      sub: seasons + ' · ' + eps,
      kind: 'video',
      isDir: false,
      hueKey: show.title,
      uri: first && first.uri,
      thumbUri: show.posterUri,
      hero: {
        eyebrow: 'TV Show', title: show.title,
        sub: seasons + '  ·  ' + eps,
        chips: first ? first.meta.badges.concat(first.meta.chips) : [],
        kind: 'video', uri: first && first.uri, artUri: show.posterUri, hueKey: show.title,
      },
      onSelect: () => renderShow(show),
    });
  }

  function browseCard() {
    return cardEl({
      title: 'Browse Files', sub: 'Folder by folder', kind: 'dir', isDir: true, glyph: 'hdd', hueKey: 'browse',
      hero: { eyebrow: 'USB', title: 'Browse Files', glyph: 'hdd', sub: 'Walk the drive folder by folder', kind: 'dir', hueKey: 'browse' },
      onSelect: () => navigateTo('usb'),
    });
  }

  function networkCard() {
    return cardEl({
      title: 'Network', sub: 'DLNA & Beam Server', kind: 'dir', isDir: true, glyph: 'network', hueKey: 'network',
      hero: { eyebrow: 'Network', title: 'Network Servers', glyph: 'network', sub: 'Play from a computer on your network', kind: 'dir', hueKey: 'network' },
      onSelect: () => navigateTo('network'),
    });
  }

  function cardFromHistory(h) {
    const pct = h.duration ? h.t / h.duration : 0;
    return fileCard(
      { name: h.title, uri: h.uri, kind: h.sourceType === 'audio' ? 'audio' : 'video' },
      {
        progress: pct,
        eyebrow: 'Continue Watching',
        resumeLabel: h.duration ? 'Resume from ' + formatTime(h.t) : 'Resume',
        onSelect: () => resumeFromHistory(h),
      }
    );
  }

  function resumeFromHistory(h) {
    toast('Resuming ' + BeamMeta.parse(h.title).title);
    playByKey(h);
  }

  function rowEl(title, cards) {
    const row = document.createElement('div');
    row.className = 'row';
    row.innerHTML = `<div class="row-header"><div class="row-title">${escapeHtml(title)}</div><div class="row-count">${cards.length}</div></div>`;
    const track = document.createElement('div');
    track.className = 'card-track';
    cards.forEach((c) => track.appendChild(c));
    row.appendChild(railEl('x', track));
    return row;
  }

  // ---------------- Show (episode list) ----------------
  // Rendered onto the USB screen rather than as a seventh screen: it's the same
  // shape as a folder listing (hero, breadcrumb, grid) and adding a screen
  // would mean another permanent section in tv.html for no structural gain.
  function renderShow(show) {
    beginNav();
    const root = $('#screen-usb .content');
    root.innerHTML = '';
    const hero = heroEl();
    root.appendChild(hero);

    root.appendChild(breadcrumbEl(['Home', show.title], (i) => {
      if (i === 0) navigateTo('home');
    }));

    const seasons = show.seasonCount === 1 ? '1 season' : show.seasonCount + ' seasons';
    updateHero(hero, {
      eyebrow: 'TV Show', title: show.title,
      sub: seasons + '  ·  ' + show.episodes.length + ' episodes',
      kind: 'video', hueKey: show.title,
      uri: show.episodes[0] && show.episodes[0].uri,
      artUri: show.posterUri,
    });

    const grid = document.createElement('div');
    grid.className = 'grid-track';
    show.episodes.forEach((ep) => {
      grid.appendChild(fileCard(ep, {
        eyebrow: show.title,
        titleOverride: ep.meta.episodeTitle || 'Episode ' + ep.meta.episode,
        subOverride: 'Season ' + ep.meta.season
          + (ep.meta.episodeTitle ? ' · Episode ' + ep.meta.episode : ''),
        onSelect: () => {
          const sub = UsbSource.findSubtitleFor(ep.name, ep.subtitles);
          openPlayer({
            key: 'usb:' + ep.subPath.join('/'), title: ep.name, uri: ep.uri,
            subtitleUri: sub ? sub.uri : undefined, sourceType: 'video',
            subtitleCandidates: UsbSource.orderSubtitlesFor(ep.name, ep.subtitles),
            backTo: () => renderShow(show),
          });
        },
      }));
    });
    root.appendChild(railEl('y', grid));

    showScreen('usb');
    primeThumbs(root);
  }

  // ---------------- USB ----------------
  function diagnosticsHtml(storages) {
    if (!storages || !storages.length) return '<p style="margin-top:18px;color:var(--ink-3);font-size:14px;">tizen.filesystem.listStorages() returned an empty list.</p>';
    const rows = storages.map((s) => `<tr>
        <td style="padding:4px 14px 4px 0;color:var(--ink-1);">${escapeHtml(s.label)}</td>
        <td style="padding:4px 14px;color:var(--ink-2);">${escapeHtml(String(s.type))}</td>
        <td style="padding:4px 14px;color:var(--ink-2);">${escapeHtml(String(s.state))}</td>
      </tr>`).join('');
    return `<div style="margin-top:22px;">
      <p style="color:var(--ink-3);font-size:14px;margin-bottom:10px;">Raw storages reported by tizen.filesystem.listStorages():</p>
      <table style="font-size:15px;border-collapse:collapse;"><tr style="color:var(--ink-3);font-size:13px;">
        <td style="padding:4px 14px 4px 0;">label</td><td style="padding:4px 14px;">type</td><td style="padding:4px 14px;">state</td>
      </tr>${rows}</table></div>`;
  }

  async function renderUsbRoot() {
    const myNav = beginNav();
    const root = $('#screen-usb .content');
    root.innerHTML = loadingHtml('Scanning for USB drives…');
    showScreen('usb');

    const usb = await findUsbStorage();
    if (staleNav(myNav)) return;
    if (!usb.label) {
      root.innerHTML = emptyHtml('usb', 'No USB drive found',
        'Plug a USB flash drive or hard disk into your TV’s USB port. It will show up here automatically once mounted.')
        + diagnosticsHtml(usb.all);
      spatialNav.focusFirst();
      return;
    }
    App.usbState.storageLabel = usb.label;
    App.usbState.driveName = usb.label.split('/').pop() || 'USB Drive';
    await renderUsbDir([]);
  }

  // Capacity used to live in a static subtitle above the content. That heading
  // block is gone (see tv.html), so the drive's free space rides along with the
  // breadcrumb instead — same information, on a row that already exists, and no
  // longer costing the grid a hundred vertical pixels.
  async function renderCapacityInto(el) {
    try {
      const stats = await UsbSource.getStorageStats();
      if (!stats || !stats.capacity || !el.isConnected) return;
      const used = stats.capacity - stats.availableCapacity;
      const pct = Math.round((used / stats.capacity) * 100);
      el.innerHTML = `${UsbSource.humanSize(stats.availableCapacity)} free of ${UsbSource.humanSize(stats.capacity)}
        <span class="cap-bar"><i style="width:${pct}%"></i></span>`;
    } catch (e) { /* stats unavailable on this platform — the row just stays empty */ }
  }

  async function renderUsbDir(subPath) {
    const myNav = beginNav();
    App.usbState.path = subPath;
    const root = $('#screen-usb .content');
    root.innerHTML = loadingHtml('Loading…');
    try {
      const { items, subtitles } = await UsbSource.listDir(App.usbState.storageLabel, subPath);
      if (staleNav(myNav)) return;
      root.innerHTML = '';

      const hero = heroEl();
      root.appendChild(hero);

      const bar = document.createElement('div');
      bar.className = 'crumb-bar';
      const crumbs = [App.usbState.driveName].concat(subPath);
      bar.appendChild(breadcrumbEl(crumbs, (i) => renderUsbDir(subPath.slice(0, i))));
      const cap = document.createElement('div');
      cap.className = 'crumb-cap';
      bar.appendChild(cap);
      root.appendChild(bar);
      renderCapacityInto(cap);

      // Seeded before the grid is built and regardless of whether the folder
      // has anything in it, so the panel is never a blank slab — focus lands on
      // the breadcrumb first, which carries no hero of its own, and an empty
      // folder has no card to ever supply one.
      const here = subPath.length ? subPath[subPath.length - 1] : App.usbState.driveName;
      const counts = { folders: 0, files: 0 };
      items.forEach((it) => { if (it.isDir) counts.folders++; else counts.files++; });
      updateHero(hero, {
        eyebrow: 'USB',
        title: here,
        sub: [
          counts.folders ? counts.folders + (counts.folders === 1 ? ' folder' : ' folders') : '',
          counts.files ? counts.files + (counts.files === 1 ? ' item' : ' items') : '',
        ].filter(Boolean).join('  ·  ') || 'Empty folder',
        kind: 'dir',
        hueKey: here,
      });

      if (!items.length) {
        root.appendChild(htmlToEl(emptyHtml('folder', 'Empty folder', 'No playable video, audio, or photo files here.')));
      } else {
        const grid = document.createElement('div');
        grid.className = 'grid-track';
        const images = items.filter((it) => !it.isDir && it.kind === 'image');

        items.forEach((it) => {
          if (it.isDir) {
            grid.appendChild(folderCard(it, { onSelect: () => renderUsbDir(it.subPath) }));
          } else {
            grid.appendChild(fileCard(it, {
              onSelect: () => openMediaItem(it, images, subtitles, () => renderUsbDir(subPath)),
            }));
          }
        });
        root.appendChild(railEl('y', grid));
      }
      showScreen('usb');
      primeThumbs(root);
    } catch (e) {
      if (!staleNav(myNav)) root.innerHTML = emptyHtml('usb', 'Error reading folder', e.message || String(e));
    }
  }

  // Routes a selected file to the video/audio player or the photo viewer,
  // and for images hands along the folder's other images for prev/next.
  // For video, auto-matches a sidecar subtitle file (Movie.srt next to
  // Movie.mkv) if one exists in the same folder.
  function openMediaItem(item, imageSiblings, subtitles, backTo) {
    const key = 'usb:' + item.subPath.join('/');
    if (item.kind === 'image') {
      const idx = Math.max(0, imageSiblings.findIndex((s) => s.uri === item.uri));
      openPhotoViewer(imageSiblings, idx, backTo);
    } else {
      const sub = item.kind === 'video' ? UsbSource.findSubtitleFor(item.name, subtitles) : null;
      openPlayer({
        key, title: item.name, uri: item.uri,
        subtitleUri: sub ? sub.uri : undefined, sourceType: item.kind,
        subtitleCandidates: item.kind === 'video' ? UsbSource.orderSubtitlesFor(item.name, subtitles) : [],
        backTo,
      });
    }
  }

  // ---------------- Network / DLNA ----------------
  // A card for anything on the Network screen. Previously each of these built
  // its own .card markup inline with hand-written inline-style gradients, which
  // is why they kept their old 240px proportions and picked up none of the
  // hero, badge, or type-scale work — three near-copies of cardEl that had to
  // be found and updated separately every time a card changed.
  function actionCard({ title, sub, glyph, heroSub, onSelect, hueKey }) {
    return cardEl({
      title, sub, kind: 'dir', isDir: true, glyph, hueKey: hueKey || title,
      hero: { eyebrow: 'Network', title, sub: heroSub || sub, glyph, kind: 'dir', hueKey: hueKey || title },
      onSelect,
    });
  }

  function renderNetworkHome() {
    beginNav();
    const root = $('#screen-network .content');
    root.innerHTML = '';
    const servers = DlnaSource.loadServers();

    const hero = heroEl();
    root.appendChild(hero);
    updateHero(hero, {
      eyebrow: 'Network', title: 'Network Servers', glyph: 'server',
      sub: servers.length
        ? `${servers.length} server${servers.length === 1 ? '' : 's'} saved`
        : 'No servers saved yet',
      kind: 'dir', hueKey: 'network',
    });

    // Guidance goes above the grid, not below it. The .rail-y wrapping the grid
    // claims all remaining height (flex:1), so anything appended after it gets
    // pushed to the very bottom of the screen — far from the cards it's
    // explaining, and separated from them by a field of empty space.
    if (!servers.length) {
      root.appendChild(htmlToEl('<div class="scan-note">Choose <strong>Scan Network</strong> to find a Beam Companion Server automatically, or add any DLNA server manually by its description.xml URL.</div>'));
    }

    const grid = document.createElement('div');
    grid.className = 'grid-track';
    servers.forEach((s) => {
      grid.appendChild(actionCard({
        title: s.name, sub: 'DLNA / UPnP', glyph: 'server', hueKey: s.name,
        heroSub: 'Open to browse this server’s media',
        onSelect: () => openDlnaServer(s),
      }));
    });
    grid.appendChild(actionCard({
      title: 'Scan Network', sub: 'Find servers automatically', glyph: 'scan',
      heroSub: 'Look for a Beam Companion Server on this network',
      onSelect: renderNetworkScan,
    }));
    grid.appendChild(actionCard({
      title: 'Add Manually', sub: 'By description URL', glyph: 'plus',
      heroSub: 'Enter a DLNA server’s description.xml address yourself',
      onSelect: renderAddServerForm,
    }));
    root.appendChild(railEl('y', grid));
    showScreen('network');
  }

  // Real SSDP is unreachable to a Tizen web app (no raw UDP socket access —
  // a platform limitation, not something worth re-litigating). This finds
  // the TV's own subnet via systeminfo and unicast-probes it for Beam
  // Companion Servers, which is the practical substitute: no typing needed
  // for the common case, at the cost of only finding that one known port.
  async function renderNetworkScan() {
    const myNav = beginNav();
    const root = $('#screen-network .content');
    root.innerHTML = `
      <h2 class="page-title" style="font-size:32px;margin-bottom:8px;">Scanning Network…</h2>
      <p class="page-subtitle" id="scan-progress" style="margin-bottom:30px;">Looking for Beam Companion Servers on your network.</p>
    `;
    showScreen('network');

    const result = await DlnaSource.scanNetwork((scanned, total) => {
      if (staleNav(myNav)) return;
      const el = $('#scan-progress');
      if (el) el.textContent = `Checked ${scanned} of ${total} devices…`;
    });
    if (staleNav(myNav)) return;

    root.innerHTML = `<h2 class="page-title" style="font-size:32px;margin-bottom:8px;">Scan Results</h2>`;

    if (result.error === 'no-network-info') {
      root.appendChild(htmlToEl(emptyHtml('network', 'Couldn’t read network info', 'This TV didn’t report a Wi-Fi or Ethernet IP address, so a subnet scan isn’t possible. Add your server manually instead.')));
      root.appendChild(htmlToEl(`<div class="btn primary focusable" id="scan-fallback-add" style="margin-top:18px;">${icon('plus', 18)} Add Server Manually</div>`));
      $('#scan-fallback-add').addEventListener('nav-select', renderAddServerForm);
      $('#scan-fallback-add').addEventListener('click', renderAddServerForm);
      showScreen('network');
      return;
    }

    if (!result.found.length) {
      root.appendChild(htmlToEl(emptyHtml('network', 'No servers found', 'Make sure the Beam Companion Server is running on a computer on this same network, then try again.')));
      const retryBtn = htmlToEl(`<div class="btn focusable" id="scan-retry" style="margin-top:18px;">${icon('scan', 18)} Scan Again</div>`);
      root.appendChild(retryBtn);
      $('#scan-retry').addEventListener('nav-select', renderNetworkScan);
      $('#scan-retry').addEventListener('click', renderNetworkScan);
      showScreen('network');
      return;
    }

    const grid = document.createElement('div');
    grid.className = 'grid-track';
    result.found.forEach((found) => {
      const el = document.createElement('div');
      el.className = 'card focusable';
      el.innerHTML = `<div class="thumb" style="background:linear-gradient(135deg,var(--accent-2),var(--accent));color:#06070c;">${icon('server', 40)}</div>
        <div class="meta"><div class="name">${escapeHtml(found.name)}</div><div class="sub">Found at ${escapeHtml(found.ip)}</div></div>`;
      const addIt = async () => {
        toast('Adding ' + found.name + '…');
        try {
          const entry = await DlnaSource.addServer(found.name, found.descriptionUrl);
          toast('Added ' + entry.name);
          renderNetworkHome();
        } catch (e) {
          toast('Couldn’t connect: ' + (e.message || e));
        }
      };
      el.addEventListener('nav-select', addIt);
      el.addEventListener('click', addIt);
      grid.appendChild(el);
    });
    root.appendChild(grid);
    showScreen('network');
  }

  function renderAddServerForm() {
    const root = $('#screen-network .content');
    root.innerHTML = `
      <h2 class="page-title" style="font-size:32px;margin-bottom:8px;">Add Network Server</h2>
      <p class="page-subtitle" style="margin-bottom:30px;">Enter your server’s address — the IP and port is enough, Beam finds the rest.<br>
      For example <strong>192.168.1.10:8200</strong> (a router or NAS running MiniDLNA) or <strong>192.168.1.10:32469</strong> (Plex).
      If your server shows a full description URL in its settings, pasting that works too.</p>
      <div class="form-field">
        <label>Server name (optional)</label>
        <input class="input-box focusable" id="f-name" type="text" placeholder="Living Room Plex">
      </div>
      <div class="form-field">
        <label>Server address</label>
        <input class="input-box focusable" id="f-url" type="text" placeholder="192.168.1.10:8200">
        <div class="hint">Press OK to open the keyboard, Enter again to confirm.</div>
      </div>
      <div class="btn primary focusable" id="f-submit">${icon('plus', 18)} Add Server</div>
    `;
    $('#f-name').addEventListener('click', () => spatialNav.beginEditing($('#f-name')));
    $('#f-url').addEventListener('click', () => spatialNav.beginEditing($('#f-url')));
    $('#f-submit').addEventListener('nav-select', submitAddServer);
    $('#f-submit').addEventListener('click', submitAddServer);
    showScreen('network');
  }

  async function submitAddServer() {
    const name = $('#f-name').value.trim();
    const url = $('#f-url').value.trim();
    if (!url) { toast('Please enter a server address'); return; }
    toast('Connecting…');
    try {
      const entry = await DlnaSource.addServer(name, url);
      toast('Added ' + entry.name);
      renderNetworkHome();
    } catch (e) {
      toast('Couldn’t connect: ' + (e.message || e));
    }
  }

  function openDlnaServer(server) {
    App.dlnaState = { server, trail: [{ id: '0', name: server.name }] };
    renderDlnaDir();
  }

  async function renderDlnaDir() {
    const myNav = beginNav();
    const root = $('#screen-network .content');
    root.innerHTML = loadingHtml('Browsing ' + App.dlnaState.server.name + '…');
    showScreen('network');
    const { server, trail } = App.dlnaState;
    const objectId = trail[trail.length - 1].id;
    try {
      const { items, subtitles } = await DlnaSource.browse(server, objectId);
      if (staleNav(myNav)) return;
      root.innerHTML = '';
      root.appendChild(breadcrumbEl(trail.map((t) => t.name), (i) => {
        App.dlnaState.trail = App.dlnaState.trail.slice(0, i + 1);
        renderDlnaDir();
      }));
      if (trail.length === 1) {
        const removeBtn = document.createElement('div');
        removeBtn.className = 'btn focusable';
        removeBtn.style.marginBottom = '22px';
        removeBtn.textContent = 'Remove this server';
        const doRemove = () => { DlnaSource.removeServer(server.id); toast('Removed ' + server.name); renderNetworkHome(); };
        removeBtn.addEventListener('nav-select', doRemove);
        removeBtn.addEventListener('click', doRemove);
        root.appendChild(removeBtn);
      }
      if (!items.length) {
        root.appendChild(htmlToEl(emptyHtml('folder', 'Empty folder', 'Nothing playable in this folder.')));
      } else {
        const grid = document.createElement('div');
        grid.className = 'grid-track';
        const images = items.filter((it) => !it.isDir && it.kind === 'image');
        items.forEach((it) => {
          grid.appendChild(it.isDir
            ? folderCard(it, { onSelect: () => drillDlna(it) })
            : fileCard(it, { eyebrow: server.name, onSelect: () => playDlnaFile(it, images, subtitles) }));
        });
        root.appendChild(railEl('y', grid));
      }
      primeThumbs(root);
    } catch (e) {
      if (!staleNav(myNav)) root.innerHTML = emptyHtml('network', 'Couldn’t browse server', e.message || String(e));
    }
  }

  function drillDlna(item) {
    App.dlnaState.trail.push({ id: item.id, name: item.name });
    renderDlnaDir();
  }

  function playDlnaFile(item, imageSiblings, subtitleSiblings) {
    const key = 'dlna:' + App.dlnaState.server.id + ':' + item.id;
    if (item.kind === 'image') {
      const idx = Math.max(0, imageSiblings.findIndex((s) => s.uri === item.uri));
      openPhotoViewer(imageSiblings, idx, () => renderDlnaDir());
      return;
    }
    const sidecarSub = item.kind === 'video' ? UsbSource.findSubtitleFor(item.name, subtitleSiblings) : null;
    const subtitleUri = item.embeddedSubtitleUri || (sidecarSub ? sidecarSub.uri : undefined);
    // A subtitle carried on the item's own <res> has no folder entry behind
    // it, so it's added to the choices by hand or it couldn't be cycled back
    // to after switching away from it.
    const candidates = (item.embeddedSubtitleUri ? [{ name: 'Embedded subtitles', uri: item.embeddedSubtitleUri }] : [])
      .concat(item.kind === 'video' ? UsbSource.orderSubtitlesFor(item.name, subtitleSiblings) : []);
    openPlayer({
      key, title: item.name, uri: item.uri, subtitleUri, sourceType: item.kind,
      subtitleCandidates: candidates, backTo: () => renderDlnaDir(),
    });
  }

  /* ---------------- Settings ----------------
   * Preferences are stored under one key as one object rather than a key per
   * setting, so reading them costs a single localStorage hit at boot instead of
   * one per option — and adding a setting later doesn't mean another read.
   */
  const PREFS_KEY = 'beam.prefs.v1';
  const PREF_DEFAULTS = {
    thumbnails: true,   // generate artwork by decoding a video frame
    sounds: true,       // navigation click / select sounds
    subtitleSize: 34,   // ::cue font-size in stage px
    autoplayNext: true, // roll into the next episode when one ends
  };

  function loadPrefs() {
    try {
      return Object.assign({}, PREF_DEFAULTS, JSON.parse(localStorage.getItem(PREFS_KEY)) || {});
    } catch (e) {
      return Object.assign({}, PREF_DEFAULTS);
    }
  }
  function savePrefs(next) {
    App.prefs = Object.assign({}, App.prefs, next);
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(App.prefs)); } catch (e) { /* storage full or blocked */ }
    applyPrefs();
  }
  function applyPrefs() {
    // Subtitle size is a CSS custom property so ::cue picks it up without the
    // player having to be reopened for a change to take effect.
    document.documentElement.style.setProperty('--cue-size', App.prefs.subtitleSize + 'px');
    if (window.BeamSound) window.BeamSound.muted = !App.prefs.sounds;
  }

  // A settings row: label, explanation, and a control on the right. Returns the
  // control so the caller can wire it without another query.
  function settingRow(label, hint, controlHtml) {
    const row = htmlToEl(`
      <div class="setting">
        <div class="setting-text">
          <div class="setting-label">${escapeHtml(label)}</div>
          <div class="setting-hint">${escapeHtml(hint)}</div>
        </div>
        ${controlHtml}
      </div>`);
    return { row, control: row.querySelector('.setting-control') };
  }

  function toggleRow(label, hint, value, onChange) {
    const { row, control } = settingRow(label, hint,
      `<div class="setting-control btn focusable toggle${value ? ' on' : ''}">${value ? 'On' : 'Off'}</div>`);
    const flip = () => {
      const next = !control.classList.contains('on');
      control.classList.toggle('on', next);
      control.textContent = next ? 'On' : 'Off';
      onChange(next);
    };
    control.addEventListener('nav-select', flip);
    control.addEventListener('click', flip);
    return row;
  }

  // Cycles through fixed choices on each press rather than opening a submenu.
  // One button and one keypress per step beats a modal that needs opening,
  // navigating and dismissing for a three-value setting.
  function cycleRow(label, hint, choices, value, onChange) {
    let index = Math.max(0, choices.findIndex((c) => c.value === value));
    const { row, control } = settingRow(label, hint,
      `<div class="setting-control btn focusable">${escapeHtml(choices[index].label)}</div>`);
    const step = () => {
      index = (index + 1) % choices.length;
      control.textContent = choices[index].label;
      onChange(choices[index].value);
    };
    control.addEventListener('nav-select', step);
    control.addEventListener('click', step);
    return row;
  }

  function actionRow(label, hint, buttonLabel, onRun) {
    const { row, control } = settingRow(label, hint,
      `<div class="setting-control btn focusable">${escapeHtml(buttonLabel)}</div>`);
    control.addEventListener('nav-select', onRun);
    control.addEventListener('click', onRun);
    return row;
  }

  function renderSettings() {
    beginNav();
    const root = $('#screen-settings .content');
    const servers = DlnaSource.loadServers();
    const history = App.player.getWatchHistory();
    root.innerHTML = '';

    const hero = heroEl();
    root.appendChild(hero);
    updateHero(hero, {
      eyebrow: 'Settings', title: 'Settings', glyph: 'settings',
      sub: 'Playback, appearance and stored data', kind: 'dir', hueKey: 'settings',
    });

    const stack = document.createElement('div');
    stack.className = 'rail-track';

    const playback = htmlToEl('<div class="row"><div class="row-header"><div class="row-title">Playback</div></div></div>');
    playback.appendChild(toggleRow(
      'Resume where I left off',
      'Start a video at the point you stopped watching it.',
      App.prefs.autoplayNext,
      (v) => savePrefs({ autoplayNext: v })
    ));
    playback.appendChild(cycleRow(
      'Subtitle size',
      'Applies immediately, including to a video already playing.',
      [{ label: 'Small', value: 28 }, { label: 'Medium', value: 34 }, { label: 'Large', value: 44 }, { label: 'Extra large', value: 56 }],
      App.prefs.subtitleSize,
      (v) => savePrefs({ subtitleSize: v })
    ));
    stack.appendChild(playback);

    const appearance = htmlToEl('<div class="row"><div class="row-header"><div class="row-title">Appearance</div></div></div>');
    appearance.appendChild(toggleRow(
      'Generate artwork from video',
      'Beam decodes a frame from each video to use as its thumbnail. Turn this off if browsing large folders feels slow on this TV.',
      App.prefs.thumbnails,
      (v) => savePrefs({ thumbnails: v })
    ));
    appearance.appendChild(toggleRow(
      'Navigation sounds',
      'Play a click when moving between items.',
      App.prefs.sounds,
      (v) => savePrefs({ sounds: v })
    ));
    stack.appendChild(appearance);

    const data = htmlToEl('<div class="row"><div class="row-header"><div class="row-title">Library &amp; data</div></div></div>');
    data.appendChild(actionRow(
      'Rescan drive',
      App.library
        ? `Catalogued ${App.library.files.length} files on ${App.library.label}.`
        : 'Beam has not catalogued a drive in this session yet.',
      'Rescan',
      () => { App.library = null; toast('Rescanning drive…'); navigateTo('home'); }
    ));
    data.appendChild(actionRow(
      'Watch history',
      history.length ? `${history.length} item${history.length === 1 ? '' : 's'} remembered.` : 'Nothing watched yet.',
      'Clear',
      () => { localStorage.removeItem('beam.resume.v1'); toast('Watch history cleared'); renderSettings(); }
    ));
    data.appendChild(actionRow(
      'Network servers',
      servers.length ? `${servers.length} server${servers.length === 1 ? '' : 's'} saved.` : 'No servers saved.',
      'Remove all',
      () => { localStorage.removeItem('beam.dlna.servers'); toast('Servers removed'); renderSettings(); }
    ));
    stack.appendChild(data);

    const about = htmlToEl(`<div class="row">
      <div class="row-header"><div class="row-title">About</div></div>
      <p class="about-text">Beam is an open-source media player for Samsung Tizen TVs. It plays video, audio and photos from USB storage and from media servers on your local network.</p>
      <p class="about-text">Titles, years and quality badges are read from your filenames on the TV itself. Beam has no accounts, no cloud service, no advertising, no analytics and no DRM.</p>
    </div>`);
    stack.appendChild(about);

    root.appendChild(railEl('y', stack));
    showScreen('settings');
  }

  // ---------------- Helpers ----------------
  function breadcrumbEl(segments, onClick) {
    const el = document.createElement('div');
    el.className = 'breadcrumb';
    segments.forEach((s, i) => {
      const span = document.createElement('span');
      span.className = 'seg focusable';
      span.textContent = s;
      span.tabIndex = 0;
      span.addEventListener('nav-select', () => onClick(i));
      span.addEventListener('click', () => onClick(i));
      el.appendChild(span);
      if (i < segments.length - 1) {
        const sep = document.createElement('span');
        sep.className = 'sep';
        sep.textContent = '›';
        el.appendChild(sep);
      }
    });
    return el;
  }
  function loadingHtml(msg) {
    return `<div class="empty-state fade-in"><div class="icon-badge pulse">${icon('film', 30)}</div><h3>${msg}</h3></div>`;
  }
  function emptyHtml(iconName, title, body) {
    return `<div class="empty-state fade-in"><div class="icon-badge">${icon(iconName, 30)}</div><h3>${title}</h3><p>${body}</p></div>`;
  }
  function htmlToEl(html) {
    const d = document.createElement('div');
    d.innerHTML = html;
    return d.firstElementChild;
  }

  // ---------------- Player screen ----------------
  let hideControlsTimer = null;
  function openPlayer(source) {
    App.pip = false;
    $('#screen-player').classList.remove('pip');
    App._playerBackTo = source.backTo;
    // -1 means "no subtitles showing", which is also where a video with no
    // auto-matched sidecar starts.
    App._subtitleChoices = source.subtitleCandidates || [];
    App._subtitleIndex = source.subtitleUri
      ? App._subtitleChoices.findIndex((c) => c.uri === source.subtitleUri)
      : -1;
    showScreen('player');
    $('#player-title').textContent = UsbSource.prettyName(source.title);
    const audioArt = $('#player-audio-art');
    const isAudio = source.sourceType === 'audio';
    audioArt.classList.toggle('hidden', !isAudio);
    if (isAudio) audioArt.setAttribute('style', thumbStyle(source.title));
    App.player.open(source).then((resumeAt) => {
      if (resumeAt > 2) toast('Resuming from ' + formatTime(resumeAt));
    }).catch((e) => toast('Playback failed: ' + e.message));
    showPlayerControls();
  }

  function formatTime(sec) {
    sec = Math.floor(sec || 0);
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(s).padStart(2, '0');
  }

  function showPlayerControls() {
    $('#player-controls').classList.remove('hidden');
    clearTimeout(hideControlsTimer);
    hideControlsTimer = setTimeout(() => $('#player-controls').classList.add('hidden'), 4000);
  }

  function closePlayer() {
    App.player.close();
    $('#player-video').removeAttribute('src');
    const back = App._playerBackTo;
    navigateBackFromPlayer(back);
  }

  function navigateBackFromPlayer(back) {
    if (back) back(); else navigateTo(App._lastNonPlayerScreen || 'home');
  }

  // ---------------- Picture-in-picture ----------------
  // Shrinks the fullscreen player into a corner overlay and reactivates the
  // screen behind it, rather than making PiP a special third screen state —
  // the underlying screen gets completely normal D-pad navigation while the
  // video keeps playing untouched (same <video> element, just restyled).
  function enterPip() {
    if (App.activeScreen !== 'player' || !App.player.current) return;
    if (App.player.current.sourceType === 'image') return; // photo viewer has its own screen, N/A
    App.pip = true;
    $('#screen-player').classList.add('pip');
    const under = App._lastNonPlayerScreen || 'home';
    $all('.screen').forEach((s) => { if (s.id !== 'screen-player') s.classList.toggle('active', s.id === 'screen-' + under); });
    App.activeScreen = under;
    window.BeamPlayerActive = false;
    $('#sidebar').style.display = 'flex';
    spatialNav.focusFirst();
    updateSidebarExpansion();
  }

  function exitPip() {
    App.pip = false;
    $('#screen-player').classList.remove('pip');
    showScreen('player');
  }

  function togglePip() {
    if (App.pip) exitPip(); else enterPip();
    if (window.BeamSound) window.BeamSound.pip();
  }

  // A single play/pause press still just plays/pauses; a second press within
  // this window is read as a double-press and toggles PiP instead. Yellow
  // still works too (colored keys aren't reachable on every remote — some
  // universal/hotel remotes have no colored keys at all — so play/pause,
  // which every remote has, is the one guaranteed to reach every viewer).
  // The single-press action is deliberately delayed rather than fired
  // immediately-then-undone on a second press: undoing a play() that has
  // already started decoding is a visible flicker, whereas delaying it
  // briefly is imperceptible for a genuine single press.
  const PLAY_PAUSE_DOUBLE_MS = 320;
  let ppPending = false;
  let ppTimer = null;
  function handlePlayPausePress() {
    if (!App.player || !App.player.current) return;
    if (ppPending) {
      clearTimeout(ppTimer);
      ppPending = false;
      togglePip();
      return;
    }
    ppPending = true;
    ppTimer = setTimeout(() => {
      ppPending = false;
      App.player.togglePlay();
      showPlayerControls();
      if (window.BeamSound) window.BeamSound.select();
    }, PLAY_PAUSE_DOUBLE_MS);
  }

  // Tizen remote color keys: Red 403, Green 404, Yellow 405, Blue 406.
  // Bound globally (not gated on BeamPlayerActive) since it has to work both
  // from fullscreen playback and while browsing with PiP already active.
  document.addEventListener('keydown', (e) => {
    const isPipKey = e.keyCode === 405 || e.key === 'y' || e.key === 'Y';
    if (!isPipKey) return;
    if (App.activeScreen === 'player' || App.pip) { e.preventDefault(); togglePip(); }
  });

  // Dedicated hardware play/pause key: also bound globally, not gated on
  // BeamPlayerActive — it should reach the current video (and be
  // double-press-able into/out of PiP) whether the player is fullscreen or
  // already shrunk into a corner while the user browses.
  document.addEventListener('keydown', (e) => {
    const isHwPlayPause = e.code === 'MediaPlayPause' || e.keyCode === 10252;
    if (!isHwPlayPause) return;
    if (App.activeScreen !== 'player' && !App.pip) return;
    e.preventDefault();
    handlePlayPausePress();
  });

  // Off -> each subtitle file in the folder -> Off. With a single sidecar
  // (the common case) this is an ordinary on/off toggle; with several, it is
  // also the way to pick a different one — including subtitles named by
  // language rather than after the video, which never auto-match.
  function cycleSubtitles() {
    const choices = App._subtitleChoices || [];
    if (!choices.length) {
      // Nothing to cycle. A track can still exist here if the source handed
      // one over without a folder listing behind it.
      if (App.player.hasSubtitles()) {
        const mode = App.player.toggleSubtitles();
        toast(mode === 'showing' ? 'Subtitles on' : 'Subtitles off');
      } else {
        toast('No subtitle files found for this video');
      }
      return;
    }
    const next = App._subtitleIndex + 1 >= choices.length ? -1 : App._subtitleIndex + 1;
    App._subtitleIndex = next;
    if (next === -1) {
      App.player.clearSubtitles();
      toast('Subtitles off');
      return;
    }
    const choice = choices[next];
    App.player.loadSubtitle(choice.uri)
      .then(() => toast(choices.length > 1 ? 'Subtitles: ' + choice.name : 'Subtitles on'))
      .catch((e) => {
        App._subtitleIndex = -1;
        toast('Couldn\u2019t load ' + choice.name + ': ' + (e.message || e));
      });
  }

  function initPlayerKeys() {
    document.addEventListener('keydown', (e) => {
      if (!window.BeamPlayerActive) return;
      if (App.activeScreen === 'photo') { handlePhotoKey(e); return; }
      if (e.keyCode === 10009 || e.key === 'Backspace' || e.key === 'Escape') {
        e.preventDefault(); if (window.BeamSound) window.BeamSound.back(); closePlayer(); return;
      }
      // MediaPlayPause is handled by the always-on global listener above —
      // deliberately not repeated here, or a real hardware key press while
      // fullscreen would fire handlePlayPausePress() twice per press.
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault(); handlePlayPausePress(); return;
      }
      if (e.key === 'ArrowRight' || e.keyCode === 417) { e.preventDefault(); App.player.seekBy(10); showPlayerControls(); if (window.BeamSound) window.BeamSound.move(); return; }
      if (e.key === 'ArrowLeft' || e.keyCode === 412) { e.preventDefault(); App.player.seekBy(-10); showPlayerControls(); if (window.BeamSound) window.BeamSound.move(); return; }
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); showPlayerControls(); return; }
      // Blue color key: keyCode 406 on Tizen remotes, 'c'/'C' in the browser
      // preview — steps through the subtitle files sitting next to the video.
      if (e.keyCode === 406 || e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        cycleSubtitles();
        return;
      }
    }, true);
  }

  function initPlayerUi() {
    const v = $('#player-video');
    App.player = new BeamPlayer(v);
    App.player.onTimeUpdate = (video) => {
      const bar = $('#player-progress-fill');
      if (video.duration) bar.style.width = (video.currentTime / video.duration * 100) + '%';
      $('#player-time').textContent = formatTime(video.currentTime) + ' / ' + formatTime(video.duration);
    };
    App.player.onEnded = () => closePlayer();
    App.player.onError = (err) => {
      const messages = {
        1: 'Playback was aborted.',
        2: 'Network error while loading this file.',
        3: 'This file is corrupt or uses an unsupported codec.',
        4: 'This format isn’t supported on this TV.',
      };
      toast(messages[err && err.code] || 'This file couldn’t be played.', 4000);
      console.error(err);
      setTimeout(() => { if (App.activeScreen === 'player') closePlayer(); }, 2200);
    };
    v.addEventListener('play', () => $('#player-playicon').classList.add('is-playing'));
    v.addEventListener('pause', () => $('#player-playicon').classList.remove('is-playing'));
    initPlayerKeys();
  }

  function playByKey(h) {
    // The resume map now stores the actual playback uri, so Home can resume
    // directly without re-browsing USB/DLNA.
    openPlayer({ key: h.key, title: h.title, uri: h.uri, sourceType: h.sourceType, backTo: () => renderHome() });
  }

  // ---------------- Photo viewer ----------------
  function openPhotoViewer(images, index, backTo) {
    App.photoState = { images, index, backTo };
    showScreen('photo');
    renderPhotoAt(index);
  }

  function renderPhotoAt(index) {
    const { images } = App.photoState;
    if (!images.length) return;
    const i = ((index % images.length) + images.length) % images.length;
    App.photoState.index = i;
    const item = images[i];
    const img = $('#photo-img');
    img.classList.remove('loaded');
    const loadHandler = () => { img.classList.add('loaded'); img.removeEventListener('load', loadHandler); };
    img.addEventListener('load', loadHandler);
    img.src = item.uri;
    img.alt = item.name;
    $('#photo-title').textContent = UsbSource.prettyName(item.name);
    $('#photo-counter').textContent = (i + 1) + ' / ' + images.length;
  }

  function closePhotoViewer() {
    const back = App.photoState && App.photoState.backTo;
    App.photoState = null;
    if (back) back(); else navigateTo(App._lastNonPlayerScreen || 'home');
  }

  function handlePhotoKey(e) {
    if (e.keyCode === 10009 || e.key === 'Backspace' || e.key === 'Escape') {
      e.preventDefault(); if (window.BeamSound) window.BeamSound.back(); closePhotoViewer(); return;
    }
    if (e.key === 'ArrowRight') { e.preventDefault(); renderPhotoAt(App.photoState.index + 1); if (window.BeamSound) window.BeamSound.move(); return; }
    if (e.key === 'ArrowLeft') { e.preventDefault(); renderPhotoAt(App.photoState.index - 1); if (window.BeamSound) window.BeamSound.move(); return; }
  }

  spatialNav.onBack = () => {
    if (App.activeScreen === 'player') { closePlayer(); return; }
    if (App.activeScreen === 'photo') { closePhotoViewer(); return; }
    if (App.activeScreen !== 'home') navigateTo('home');
  };

  // Sidebar collapses to icons-only whenever focus isn't actually inside it,
  // expanding to show labels only while the user is navigating it directly —
  // reclaims screen width for content without reintroducing the old overlap
  // bug, since #sidebar's width and #main's left offset both animate off the
  // same --sidebar-w custom property in lockstep.
  function updateSidebarExpansion() {
    const sidebar = $('#sidebar');
    const expanded = !!(spatialNav.current && sidebar.contains(spatialNav.current));
    sidebar.classList.toggle('collapsed', !expanded);
    document.documentElement.style.setProperty(
      '--sidebar-w',
      expanded ? 'var(--sidebar-w-expanded)' : 'var(--sidebar-w-collapsed)'
    );
  }
  document.addEventListener('nav-focus', updateSidebarExpansion);

  // Boot splash: the visual sequence is entirely CSS keyframes (see
  // #splash in theme.css) and plays on its own the moment the element
  // paints — this just fires the laser sound in sync with it, then fades
  // and removes the overlay once the sequence has had time to land. Removed
  // outright (not just left at opacity:0) so a full-screen z-index:500 layer
  // doesn't linger over the app, even inert, for the rest of the session.
  function playSplash() {
    const splash = $('#splash');
    if (!splash) return;
    if (window.BeamSound) window.BeamSound.laser();
    setTimeout(() => {
      splash.classList.add('hide');
      splash.addEventListener('transitionend', () => splash.remove(), { once: true });
    }, 950);
  }

  document.addEventListener('DOMContentLoaded', () => {
    // Before anything renders: the type scale and sound both read from prefs,
    // so loading them after the first paint would show one frame of defaults.
    App.prefs = loadPrefs();
    applyPrefs();
    playSplash();
    initSidebar();
    initPlayerUi();
    renderHome();
    spatialNav.focusFirst();
    updateSidebarExpansion();
  });
})();
