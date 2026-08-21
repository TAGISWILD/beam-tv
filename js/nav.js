/*
 * Geometry-based spatial navigation for D-pad remotes.
 * Any element with class="focusable" inside the active .screen (or inside
 * a temporary overlay marked [data-nav-scope]) is a navigation candidate.
 */
(function (global) {
  const KEP = {
    ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
    Up: 'up', Down: 'down', Left: 'left', Right: 'right',
  };

  class SpatialNav {
    constructor() {
      this.current = null;
      this.onSelect = null; // callback(el)
      this.onBack = null;   // callback()
      this.editing = false; // true while a real <input> has native focus
      this._bind();
    }

    _bind() {
      document.addEventListener('keydown', (e) => this._handleKey(e), true);
    }

    // _candidates() runs getComputedStyle() over every focusable on the screen,
    // and each of those forces the engine to flush pending style invalidation —
    // which setFocus() guarantees is pending, because it just added/removed a
    // class. So every keypress paid a full style recalc across the whole grid,
    // twice (move() calls _bestCandidate for the same-region set and possibly
    // again for all). Measured at ~1.4ms per move for 61 cards on desktop; on
    // TV silicon that's the difference between "instant" and "noticeable".
    //
    // The list only changes when a screen re-renders, so it's cached and
    // invalidated explicitly. Deliberately NOT a MutationObserver: every
    // setFocus() mutates a class attribute, so an observer would invalidate
    // the cache on the very action it exists to make cheap.
    invalidate() { this._cache = null; }

    _scopeRoot() {
      const overlay = document.querySelector('[data-nav-scope]:not(.hidden)');
      if (overlay) return overlay;
      return document.querySelector('.screen.active') || document;
    }

    _candidates() {
      const root = this._scopeRoot();
      // Keyed on the scope root as well as existence: a cache built for the USB
      // screen must not be reused the moment an overlay or another screen
      // becomes the scope, even if nothing re-rendered.
      if (!this._cache || this._cache.root !== root) {
        this._cache = { root, nodes: this._collectCandidates(root) };
      }
      // isConnected is a plain property read — unlike offsetParent and
      // getComputedStyle below it flushes neither style nor layout — so
      // re-checking it on every call costs essentially nothing, and it makes a
      // stale cache (some future render path forgetting to invalidate) degrade
      // into "doesn't see new items yet" rather than "navigates into detached
      // nodes whose geometry is all zeros", which would send focus to a corner.
      return this._cache.nodes.filter((el) => el.isConnected);
    }

    _collectCandidates(root) {
      // The sidebar lives outside every .screen, so without this Left-arrow
      // could never reach it once focus moved into a screen's content — it
      // was structurally unreachable via the remote. It naturally drops out
      // of the list below (offsetParent goes null) while a chromeless screen
      // (player/photo) hides it with display:none.
      const sidebar = document.getElementById('sidebar');
      const nodes = Array.from(root.querySelectorAll('.focusable'));
      if (sidebar && root !== sidebar && !root.contains(sidebar)) {
        nodes.push(...sidebar.querySelectorAll('.focusable'));
      }
      return nodes.filter((el) => {
        if (el.offsetParent === null && el.tagName !== 'BODY') return false;
        const style = getComputedStyle(el);
        return style.visibility !== 'hidden' && style.display !== 'none';
      });
    }

    focusFirst(container) {
      // Every render path ends here, which makes this the one reliable place to
      // drop the candidate cache — the DOM it was built from has just been
      // replaced wholesale by whatever render is calling us.
      this.invalidate();
      const root = container || this._scopeRoot();
      const el = root.querySelector('.focusable[data-autofocus]') || root.querySelector('.focusable');
      if (el) this.setFocus(el);
    }

    setFocus(el) {
      if (!el || el === this.current) return;
      if (this.current) this.current.classList.remove('focused');
      this.current = el;
      el.classList.add('focused');
      // Samsung's Voice Guide, like every screen reader, follows real DOM
      // focus. Moving only a CSS class left it with nothing to announce, so
      // D-pad navigation was completely silent to it. Focusables are kept out
      // of the tab order — the D-pad drives everything — so tabindex="-1" is
      // all that's needed to make them focusable programmatically.
      if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
      try {
        // preventScroll matters: the rails position content with transforms,
        // and letting focus() scroll would fight onReveal below.
        el.focus({ preventScroll: true });
      } catch (e) {
        // Older WebKit builds don't accept the options argument.
        try { el.focus(); } catch (e2) { /* element can't take focus */ }
      }
      // Bringing focus into view is delegated rather than done with
      // scrollIntoView. The app moves its rows and grids with transforms on a
      // rail (see BeamRails in app.js) because a transform is compositable and
      // a scroll offset is not — and the two actively fight: scrollIntoView
      // would scroll the whole screen, hero included, to chase an element the
      // rail was already about to slide into place. Falls back to the native
      // behaviour when no reveal handler is installed.
      if (this.onReveal) {
        this.onReveal(el);
      } else if (typeof el.scrollIntoViewIfNeeded === 'function') {
        el.scrollIntoViewIfNeeded({ block: 'nearest' });
      } else {
        el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      }
      el.dispatchEvent(new CustomEvent('nav-focus', { bubbles: true }));
      if (global.BeamSound) global.BeamSound.move();
    }

    // Layout-space geometry (offsetTop/Left chain) rather than
    // getBoundingClientRect(), so a focused card's hover transform
    // (translateY/scale) never skews direction math for its neighbors.
    _layoutRect(el) {
      let x = 0, y = 0, node = el;
      while (node) { x += node.offsetLeft; y += node.offsetTop; node = node.offsetParent; }
      return { left: x, top: y, width: el.offsetWidth, height: el.offsetHeight };
    }

    _bestCandidate(candidates, direction) {
      const from = this._layoutRect(this.current);
      const fx = from.left + from.width / 2;
      const fy = from.top + from.height / 2;

      let best = null;
      let bestScore = Infinity;

      for (const el of candidates) {
        const r = this._layoutRect(el);
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        const dx = cx - fx;
        const dy = cy - fy;

        let primary, perpendicular, aligned;
        if (direction === 'left') { primary = -dx; perpendicular = Math.abs(dy); aligned = dx < -1; }
        else if (direction === 'right') { primary = dx; perpendicular = Math.abs(dy); aligned = dx > 1; }
        else if (direction === 'up') { primary = -dy; perpendicular = Math.abs(dx); aligned = dy < -1; }
        else { primary = dy; perpendicular = Math.abs(dx); aligned = dy > 1; }

        if (!aligned) continue;
        const score = primary * 1.0 + perpendicular * 2.2;
        if (score < bestScore) { bestScore = score; best = el; }
      }
      return best;
    }

    move(direction) {
      if (!this.current) {
        this.focusFirst();
        return;
      }
      const all = this._candidates().filter((el) => el !== this.current);

      // Prefer staying within the same region (sidebar vs. screen content)
      // before ever considering a cross-region jump. Without this, moving
      // Down from a breadcrumb sitting near the top of a screen could score
      // a sidebar item as "closer" than the content grid directly below it
      // (short vertical distance beats a tall card's far-off center), which
      // reads as the remote randomly teleporting to the sidebar instead of
      // going where it visibly points.
      const sidebar = document.getElementById('sidebar');
      const currentInSidebar = !!(sidebar && sidebar.contains(this.current));
      const sameRegion = all.filter((el) => !!(sidebar && sidebar.contains(el)) === currentInSidebar);

      const best = this._bestCandidate(sameRegion, direction) || this._bestCandidate(all, direction);
      if (best) this.setFocus(best);
    }

    // Puts a text <input> into real editable focus so the platform's
    // on-screen keyboard appears and arrow/backspace keys work as text
    // editing instead of spatial navigation. Enter (or blur) commits.
    beginEditing(input) {
      this.editing = true;
      input.focus();
      if (input.setSelectionRange) input.setSelectionRange(input.value.length, input.value.length);
      let exited = false;
      // Sets state synchronously rather than solely reacting to the 'blur'
      // event — some WebKit/embedded builds are inconsistent about firing
      // blur promptly (or at all) for a programmatic .blur() call, and this
      // flag is what unblocks the D-pad again, so it can't be left hostage
      // to that event actually arriving.
      const exit = () => {
        if (exited) return;
        exited = true;
        this.editing = false;
        input.removeEventListener('blur', exit);
        input.removeEventListener('keydown', onKey);
        input.dispatchEvent(new CustomEvent('field-committed', { bubbles: true }));
      };
      input.addEventListener('blur', exit);
      const onKey = (ke) => {
        // Enter confirms. The remote's dedicated Back button (keyCode 10009 /
        // XF86Back) also exits editing — without this, Back did nothing while
        // typing (the global handler skips input while `editing` is true) and
        // there was no way out of a text field short of pressing Enter.
        // Deliberately NOT keying off plain 'Backspace' here: that has to stay
        // reserved for deleting a character, or typing would be unusable.
        if (ke.key === 'Enter' || ke.keyCode === 10009 || ke.key === 'XF86Back' || ke.key === 'Escape') {
          ke.preventDefault();
          input.blur();
          exit();
        }
      };
      input.addEventListener('keydown', onKey);
    }

    _handleKey(e) {
      if (this.editing) return; // let the native input handle its own keys
      if (global.BeamPlayerActive) return; // player screen handles its own keys
      const dir = KEP[e.key];
      if (dir) {
        e.preventDefault();
        this.move(dir);
        return;
      }
      if (e.key === 'Enter' || e.keyCode === 13) {
        e.preventDefault();
        if (this.current) {
          if (this.current.tagName === 'INPUT') { this.beginEditing(this.current); return; }
          if (global.BeamSound) global.BeamSound.select();
          this.current.dispatchEvent(new CustomEvent('nav-select', { bubbles: true }));
          if (this.onSelect) this.onSelect(this.current);
        }
        return;
      }
      // Tizen remote "Return/Back" key: keyCode 10009, browsers: Backspace/Escape
      if (e.keyCode === 10009 || e.key === 'Backspace' || e.key === 'Escape' || e.key === 'XF86Back') {
        e.preventDefault();
        if (global.BeamSound) global.BeamSound.back();
        if (this.onBack) this.onBack();
      }
    }
  }

  global.spatialNav = new SpatialNav();
})(window);
