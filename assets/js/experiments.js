/* ==========================================================================
   METRO OS — EXPERIMENTS
   Four opt-in interactions, each behind a flag on <html> that is applied
   before first paint (see the inline boot script in layout.html) and stored
   in localStorage alongside the accent.

     tilt       press response — the tile tips toward the press
     jump       Ctrl/Cmd+K quick jump across every page and section
     turnstile  WP7 turnstile between pages instead of the shipped slide
     lock       the page locks itself when left alone, like the phone

   Nothing here is required by the design: with every flag off, or with
   JavaScript disabled, the site behaves exactly as it ships.
   ========================================================================== */
(function () {
  'use strict';

  var M = window.METRO || {};
  var $  = M.$  || function (s, c) { return (c || document).querySelector(s); };
  var $$ = M.$$ || function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var icon = M.icon || function (n) { return '<svg aria-hidden="true" focusable="false"><use href="#i-' + n + '"></use></svg>'; };
  var reduced = M.reduced || function () { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; };
  var clamp = M.clamp || function (v, a, b) { return Math.min(b, Math.max(a, v)); };
  var html = document.documentElement;

  /* ======================================================================
     FLAGS
     ====================================================================== */
  var KEY = 'metro-x';
  var DEFAULTS = { tilt: 1, jump: 1, turnstile: 1, lock: 0 };
  var NAMES = ['tilt', 'jump', 'turnstile', 'lock'];
  var flags = {};

  function read() {
    var out = {};
    var saved = {};
    try { saved = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { saved = {}; }
    NAMES.forEach(function (n) {
      out[n] = (n in saved) ? (saved[n] ? 1 : 0) : DEFAULTS[n];
    });
    return out;
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(flags)); } catch (e) {}
  }
  function apply() {
    NAMES.forEach(function (n) {
      if (flags[n]) html.setAttribute('data-x-' + n, '');
      else html.removeAttribute('data-x-' + n);
    });
    $$('[data-x-toggle]').forEach(function (b) {
      b.setAttribute('aria-checked', String(!!flags[b.dataset.xToggle]));
    });
    document.dispatchEvent(new CustomEvent('metro:x', { detail: { flags: flags } }));
  }
  function set(name, on) {
    if (NAMES.indexOf(name) === -1) return;
    flags[name] = on ? 1 : 0;
    save(); apply();
    if (name === 'lock') { flags.lock ? lockArm() : lockDisarm(); }
  }

  function initPanel() {
    document.addEventListener('click', function (e) {
      var b = e.target.closest('[data-x-toggle]');
      if (!b) return;
      set(b.dataset.xToggle, b.getAttribute('aria-checked') !== 'true');
    });
  }

  /* ======================================================================
     1 — TILT
     One pointer listener for the whole document. The transform is written
     inline and cleared on release, so nothing persists in the DOM.
     ====================================================================== */
  var TILT_SEL = '.btn, .chip, .navpanel__tile, [data-app], .linkcard, .accents__swatch, .xswitch, [data-tilt]';
  var held = null, holdTimer = null;

  function tiltTo(el, x, y) {
    var r = el.getBoundingClientRect();
    if (!r.width || !r.height) return;
    var deg = clamp(560 / Math.max(r.width, r.height), 3.2, 9);
    var px = clamp((x - (r.left + r.width / 2)) / (r.width / 2), -1, 1);
    var py = clamp((y - (r.top + r.height / 2)) / (r.height / 2), -1, 1);
    el.classList.remove('x-release');
    el.classList.add('x-press');
    el.style.transform = 'perspective(700px) rotateX(' + (-py * deg).toFixed(2) + 'deg) rotateY(' +
      (px * deg).toFixed(2) + 'deg) scale(.985)';
  }
  function tiltRelease() {
    if (!held) return;
    var el = held;
    held = null;
    el.classList.remove('x-press');
    el.classList.add('x-release');
    el.style.transform = '';
    clearTimeout(holdTimer);
    holdTimer = setTimeout(function () { el.classList.remove('x-release'); }, 420);
  }
  function initTilt() {
    document.addEventListener('pointerdown', function (e) {
      if (!flags.tilt || reduced() || e.button) return;
      var el = e.target.closest(TILT_SEL);
      if (!el || el.closest('[data-simulator], [data-phone]')) return;
      tiltRelease();
      held = el;
      tiltTo(el, e.clientX, e.clientY);
    }, { passive: true });

    ['pointerup', 'pointercancel', 'pointerleave', 'blur', 'scroll'].forEach(function (t) {
      window.addEventListener(t, tiltRelease, { passive: true });
    });
    document.addEventListener('metro:x', function () { if (!flags.tilt) tiltRelease(); });
  }

  /* ======================================================================
     2 — QUICK JUMP
     The index is generated at build time from src/pages (title, description
     and every anchored section). If it cannot be fetched — opened from
     file://, say — the site's own navigation is used instead.
     ====================================================================== */
  var box = null, input = null, list = null, rows = [], sel = 0, opener = null, index = null, loading = null;
  var lockedByUs = false;
  var here = (location.pathname.split('/').pop() || 'index.html');

  function fallbackIndex() {
    return $$('.navpanel__tile, .nav__link').reduce(function (acc, a) {
      var url = (a.getAttribute('href') || '').split('#')[0];
      if (!url || url.indexOf('http') === 0) return acc;
      if (acc.some(function (p) { return p.url === url; })) return acc;
      acc.push({ name: (a.textContent || '').trim().replace(/^\d+\s*/, ''), url: url, desc: '', sections: [] });
      return acc;
    }, []);
  }

  function loadIndex() {
    if (index) return Promise.resolve(index);
    if (loading) return loading;
    loading = fetch('assets/search-index.json')
      .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
      .then(function (d) { index = d; return index; })
      .catch(function () { index = fallbackIndex(); return index; });
    return loading;
  }

  function build() {
    box = document.createElement('div');
    box.className = 'xjump';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-label', 'Quick jump');
    box.innerHTML =
      '<div class="xjump__panel">' +
        '<div class="xjump__head">' + icon('search') +
          '<input class="xjump__input" type="text" role="combobox" aria-expanded="true" aria-controls="xjump-list" ' +
            'aria-autocomplete="list" autocomplete="off" spellcheck="false" placeholder="Jump to a page or section…" ' +
            'aria-label="Jump to a page or section">' +
          '<span class="xjump__esc">Esc</span>' +
        '</div>' +
        '<div class="xjump__list" id="xjump-list" role="listbox" aria-label="Results"></div>' +
        '<div class="xjump__foot">' +
          '<span class="xjump__hint"><span class="xjump__key">↑</span><span class="xjump__key">↓</span> move</span>' +
          '<span class="xjump__hint"><span class="xjump__key">Enter</span> open</span>' +
          '<span class="xjump__hint"><span class="xjump__key">Ctrl</span><span class="xjump__key">K</span> anywhere</span>' +
        '</div>' +
      '</div>';
    document.body.appendChild(box);
    input = $('.xjump__input', box);
    list = $('.xjump__list', box);

    input.addEventListener('input', function () { render(input.value); });
    box.addEventListener('click', function (e) { if (e.target === box) close(); });
    list.addEventListener('click', function (e) {
      var row = e.target.closest('.xjump__row');
      if (row) go(rows[parseInt(row.dataset.i, 10)]);
    });
    list.addEventListener('mousemove', function (e) {
      var row = e.target.closest('.xjump__row');
      if (row) select(parseInt(row.dataset.i, 10));
    });
  }

  function candidates(q) {
    var pages = index || [];
    var out = [];
    q = q.trim().toLowerCase();

    var current = pages.filter(function (p) { return p.url === here; })[0];
    if (current && current.sections) {
      current.sections.forEach(function (s) {
        // no meta line: the group heading above already says where these are
        out.push({ kind: 'here', name: s.title, meta: '', url: current.url + '#' + s.id, letter: s.title.charAt(0) });
      });
    }
    pages.forEach(function (p) {
      out.push({ kind: 'page', name: p.name, meta: p.desc || '', url: p.url, letter: p.name.charAt(0), current: p.url === here });
      if (p.url !== here) {
        (p.sections || []).forEach(function (s) {
          out.push({ kind: 'sec', name: s.title, meta: p.name, url: p.url + '#' + s.id, letter: s.title.charAt(0) });
        });
      }
    });

    if (!q) return out.filter(function (r) { return r.kind !== 'sec'; });

    return out.map(function (r) {
        var n = r.name.toLowerCase(), m = (r.meta || '').toLowerCase();
        var score = -1;
        if (n.indexOf(q) === 0) score = 0;
        else if (n.indexOf(q) > 0) score = 1;
        else if (m.indexOf(q) > -1) score = 2;
        return { r: r, score: score };
      })
      .filter(function (x) { return x.score > -1; })
      .sort(function (a, b) { return a.score - b.score; })
      .map(function (x) { return x.r; })
      .slice(0, 40);
  }

  function render(q) {
    rows = candidates(q || '');
    if (!rows.length) {
      list.innerHTML = '<p class="xjump__empty">Nothing matches &ldquo;' + (q || '').replace(/[<>&]/g, '') + '&rdquo;.</p>';
      return;
    }
    var out = '', group = null;
    rows.forEach(function (r, i) {
      var label = r.kind === 'here' ? 'On this page' : (r.kind === 'page' ? 'Pages' : 'Sections');
      if (label !== group) { group = label; out += '<p class="xjump__group eyebrow">' + label + '</p>'; }
      out += '<button class="xjump__row' + (r.kind !== 'page' ? ' xjump__row--sec' : '') + '" type="button" role="option"' +
        ' id="xjump-o' + i + '" data-i="' + i + '" style="--i:' + Math.min(i, 12) + '"' +
        ' aria-selected="false"' + (r.current ? ' aria-current="page"' : '') + '>' +
        '<span class="xjump__ltr" aria-hidden="true">' + r.letter + '</span>' +
        '<span class="xjump__text"><span class="xjump__name">' + r.name + '</span>' +
        (r.meta ? '<span class="xjump__meta">' + r.meta + '</span>' : '') + '</span></button>';
    });
    list.innerHTML = out;
    select(0);
  }

  function select(i) {
    var els = $$('.xjump__row', list);
    if (!els.length) return;
    sel = (i + els.length) % els.length;
    els.forEach(function (el, n) {
      var on = n === sel;
      el.classList.toggle('is-sel', on);
      el.setAttribute('aria-selected', String(on));
    });
    input.setAttribute('aria-activedescendant', 'xjump-o' + sel);
    var el = els[sel];
    var r = el.getBoundingClientRect(), lr = list.getBoundingClientRect();
    if (r.top < lr.top) list.scrollTop -= lr.top - r.top + 8;
    else if (r.bottom > lr.bottom) list.scrollTop += r.bottom - lr.bottom + 8;
  }

  function go(r) {
    if (!r) return;
    close();
    if (r.url.split('#')[0] === here) {
      var hash = r.url.indexOf('#') > -1 ? r.url.slice(r.url.indexOf('#')) : '';
      var t = hash && document.querySelector(hash);
      if (t) {
        t.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' });
        t.setAttribute('tabindex', '-1');
        t.focus({ preventScroll: true });
        history.replaceState(null, '', hash);
        return;
      }
    }
    location.href = r.url;
  }

  function open() {
    if (!flags.jump) return;
    if (!box) build();
    opener = document.activeElement;
    box.classList.add('is-open');
    // the nav panel may already be holding the scroll lock — only take it if it is free,
    // so closing this overlay cannot unlock the page underneath something else
    lockedByUs = !document.body.classList.contains('is-locked');
    if (lockedByUs) document.body.classList.add('is-locked');
    input.value = '';
    list.innerHTML = '<p class="xjump__empty">Loading&hellip;</p>';
    loadIndex().then(function () { if (box.classList.contains('is-open')) render(''); });
    input.focus();
  }
  function close() {
    if (!box || !box.classList.contains('is-open')) return;
    box.classList.remove('is-open');
    if (lockedByUs) { document.body.classList.remove('is-locked'); lockedByUs = false; }
    if (opener && opener.focus) opener.focus();
  }
  function isOpen() { return !!box && box.classList.contains('is-open'); }

  function typingInField(el) {
    return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
  }

  function initJump() {
    document.addEventListener('click', function (e) {
      if (e.target.closest('[data-x-jump]')) { e.preventDefault(); open(); }
    });

    document.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && (e.key === 'k' || e.key === 'K')) {
        if (!flags.jump) return;
        e.preventDefault();
        isOpen() ? close() : open();
        return;
      }
      if (!isOpen()) {
        if (flags.jump && e.key === '/' && !typingInField(document.activeElement)) { e.preventDefault(); open(); }
        return;
      }
      if (e.key === 'Escape') { e.preventDefault(); close(); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); select(sel + 1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); select(sel - 1); }
      else if (e.key === 'Home') { e.preventDefault(); select(0); }
      else if (e.key === 'End') { e.preventDefault(); select(rows.length - 1); }
      else if (e.key === 'Enter') { e.preventDefault(); go(rows[sel]); }
      else if (e.key === 'Tab') { e.preventDefault(); input.focus(); }
    });
  }

  /* ======================================================================
     4 — IDLE LOCK SCREEN
     ====================================================================== */
  var IDLE = 75000;
  var lockEl = null, idleTimer = null, locked = false, armed = false;
  var WAKE = ['pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll'];

  function lockBuild() {
    lockEl = document.createElement('div');
    lockEl.className = 'xlock';
    lockEl.setAttribute('aria-hidden', 'true');
    lockEl.innerHTML =
      '<div class="xlock__top">' + icon('lock') + '<span class="eyebrow">Metro OS &middot; locked</span></div>' +
      '<div>' +
        '<p class="xlock__time" data-x-clock="time">--:--</p>' +
        '<p class="xlock__date" data-x-clock="full"></p>' +
      '</div>' +
      '<div class="xlock__foot">' +
        '<span class="xlock__note">' + icon('chevron-up') + ' Press any key, scroll or tap to continue</span>' +
      '</div>';
    document.body.appendChild(lockEl);
  }
  function lockClock() {
    if (!lockEl) return;
    var d = new Date();
    var pad = function (n) { return n < 10 ? '0' + n : '' + n; };
    $('[data-x-clock="time"]', lockEl).textContent = pad(d.getHours()) + ':' + pad(d.getMinutes());
    $('[data-x-clock="full"]', lockEl).textContent =
      d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
  }
  function lockShow() {
    // a hidden tab is allowed to lock — that is what the phone does, and any
    // input on return wakes it — but never lock over an open panel or dialog
    if (locked || isOpen() || document.body.classList.contains('is-locked')) return;
    if (!lockEl) lockBuild();
    lockClock();
    locked = true;
    // next frame, so the transition runs from the off-screen position — and
    // only if nothing woke the page in the meantime
    requestAnimationFrame(function () { if (locked) lockEl.classList.add('is-on'); });
  }
  function lockHide() {
    if (!locked) return;
    locked = false;
    lockEl.classList.remove('is-on');
  }
  function idleReset() {
    clearTimeout(idleTimer);
    if (locked) lockHide();
    if (armed && flags.lock) idleTimer = setTimeout(lockShow, IDLE);
  }
  function lockArm() {
    if (armed) return;
    armed = true;
    WAKE.forEach(function (t) { window.addEventListener(t, idleReset, { passive: true }); });
    document.addEventListener('visibilitychange', idleReset);
    idleReset();
  }
  function lockDisarm() {
    armed = false;
    clearTimeout(idleTimer);
    WAKE.forEach(function (t) { window.removeEventListener(t, idleReset); });
    document.removeEventListener('visibilitychange', idleReset);
    lockHide();
  }

  /* ======================================================================
     START
     ====================================================================== */
  flags = read();
  apply();

  function start() {
    initPanel(); initTilt(); initJump();
    if (flags.lock) lockArm();
  }

  window.METRO_X = {
    flags: function () { return flags; },
    set: set,
    openJump: open,
    closeJump: close,
    lock: { show: lockShow, hide: lockHide, idleMs: IDLE }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
