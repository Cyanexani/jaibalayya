/* ==========================================================================
   METRO OS — CORE BEHAVIOUR
   Fast, direct, purposeful. No framework, no bundler, no layout thrash.
   Every motion path here checks prefers-reduced-motion before it runs.
   ========================================================================== */
(function () {
  'use strict';

  /* ---------- config ----------------------------------------------------- */
  var CONFIG = window.METRO_CONFIG || {};
  var GH_REPO = CONFIG.githubRepo || '';

  /* ---------- helpers ---------------------------------------------------- */
  var $  = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var mqReduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  var reduced = function () { return mqReduce.matches; };
  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };
  var rand  = function (a, b) { return a + Math.random() * (b - a); };

  var raf = window.requestAnimationFrame.bind(window);

  /* ======================================================================
     BOOT
     ====================================================================== */
  function boot() {
    document.documentElement.classList.add('is-ready');
    document.documentElement.classList.remove('no-js');
  }

  /* ======================================================================
     ACCENT — the site is personalisable, like the OS it remembers
     ====================================================================== */
  var ACCENTS = ['blue', 'cyan', 'violet', 'magenta', 'emerald', 'amber', 'crimson', 'steel'];

  function readAccent() {
    try { return localStorage.getItem('metro-accent') || 'blue'; } catch (e) { return 'blue'; }
  }
  function setAccent(name, persist) {
    if (ACCENTS.indexOf(name) === -1) name = 'blue';
    document.documentElement.setAttribute('data-accent', name);
    if (persist !== false) { try { localStorage.setItem('metro-accent', name); } catch (e) {} }
    $$('[data-accent-set]').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.accentSet === name));
    });
    document.dispatchEvent(new CustomEvent('metro:accent', { detail: { accent: name } }));
  }
  function initAccent() {
    setAccent(readAccent(), false);
    document.addEventListener('click', function (e) {
      var b = e.target.closest('[data-accent-set]');
      if (b) setAccent(b.dataset.accentSet, true);
    });
  }

  /* ======================================================================
     NAVIGATION
     ====================================================================== */
  function initNav() {
    var nav = $('.nav');
    var burger = $('.nav__burger');
    var panel = $('.navpanel');
    if (!nav) return;

    var last = 0;
    function onScroll() {
      var y = window.scrollY;
      nav.classList.toggle('is-stuck', y > 24);
      if (!panel || !panel.classList.contains('is-open')) {
        nav.classList.toggle('is-hidden', y > 460 && y > last + 4);
      }
      last = y;
    }
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });

    if (!burger || !panel) return;

    function close() {
      panel.classList.remove('is-open');
      burger.setAttribute('aria-expanded', 'false');
      document.body.classList.remove('is-locked');
      burger.focus();
    }
    function open() {
      panel.classList.add('is-open');
      burger.setAttribute('aria-expanded', 'true');
      document.body.classList.add('is-locked');
      nav.classList.remove('is-hidden');
      var first = panel.querySelector('a, button');
      if (first) first.focus();
    }
    burger.addEventListener('click', function () {
      panel.classList.contains('is-open') ? close() : open();
    });
    panel.addEventListener('click', function (e) { if (e.target.closest('a')) close(); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && panel.classList.contains('is-open')) close();
      if (e.key === 'Tab' && panel.classList.contains('is-open')) {
        var f = $$('a, button', panel).filter(function (el) { return el.offsetParent !== null; });
        if (!f.length) return;
        var first = f[0], lastEl = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); lastEl.focus(); }
        else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); first.focus(); }
      }
    });
  }

  /* ======================================================================
     SCROLL PROGRESS
     ====================================================================== */
  function initProgress() {
    var bar = $('.scrollbar-top');
    if (!bar) return;
    function update() {
      var h = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.transform = 'scaleX(' + (h > 0 ? clamp(window.scrollY / h, 0, 1) : 0) + ')';
    }
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
  }

  /* ======================================================================
     SCROLL EFFECTS — reveal + parallax in one rAF pass
     A single measured sweep rather than IntersectionObserver: a jump to an
     anchor or a fast flick can skip an observer callback, and a section that
     never reveals is a blank page. This cannot miss.
     ====================================================================== */
  function initScrollFX() {
    var pending = $$('[data-reveal]');

    // apply group stagger up front so the delays are correct however we arrive
    $$('[data-reveal-group]').forEach(function (group) {
      var step = parseInt(group.dataset.revealGroup, 10) || 60;
      $$('[data-reveal]', group).forEach(function (child, i) {
        child.style.setProperty('--rd', Math.min(i * step, 600) + 'ms');
      });
    });

    if (reduced()) {
      pending.forEach(function (el) { el.classList.add('is-in'); });
      pending = [];
    }

    var paraItems = reduced() ? [] : $$('[data-parallax]').map(function (el) {
      return { el: el, speed: parseFloat(el.dataset.parallax) || 0.1, max: parseFloat(el.dataset.parallaxMax) || 160 };
    });

    var ticking = false;

    function frame() {
      ticking = false;
      var vh = window.innerHeight;

      for (var i = pending.length - 1; i >= 0; i--) {
        var el = pending[i];
        // enters when its top crosses 92% of the viewport — or is already above it
        if (el.getBoundingClientRect().top < vh * 0.92) {
          el.classList.add('is-in');
          pending.splice(i, 1);
        }
      }

      for (var j = 0; j < paraItems.length; j++) {
        var it = paraItems[j];
        var r = it.el.getBoundingClientRect();
        if (r.bottom < -240 || r.top > vh + 240) continue;
        var mid = r.top + r.height / 2 - vh / 2;
        it.el.style.transform = 'translate3d(0,' + clamp(-mid * it.speed, -it.max, it.max).toFixed(2) + 'px,0)';
      }
    }

    function request() { if (!ticking) { ticking = true; raf(frame); } }

    frame();
    window.addEventListener('scroll', request, { passive: true });
    window.addEventListener('resize', request);
    window.addEventListener('hashchange', request);
    window.addEventListener('load', request);
    // catch late layout shifts (fonts, images) without polling forever
    [120, 400, 1200].forEach(function (t) { setTimeout(request, t); });
  }

  /* ======================================================================
     LIVE TILES — content that changes without opening anything
     ====================================================================== */
  function initLiveTiles() {
    if (reduced()) return;

    $$('[data-flip]').forEach(function (tile) {
      var every = parseInt(tile.dataset.flip, 10) || 5200;
      var kick = function () {
        setTimeout(function () {
          tile.classList.toggle('is-flipped');
          tile.classList.toggle('is-flip');
          kick();
        }, rand(every * 0.72, every * 1.5));
      };
      kick();
    });

    $$('[data-cycle]').forEach(function (el) {
      var values;
      try { values = JSON.parse(el.dataset.cycle); } catch (e) { return; }
      if (!values || values.length < 2) return;
      var every = parseInt(el.dataset.cycleEvery, 10) || 5000;
      var i = 0;
      setInterval(function () {
        i = (i + 1) % values.length;
        if (el.tagName === 'IMG') { el.src = values[i]; }
        else {
          el.style.opacity = '0';
          setTimeout(function () { el.textContent = values[i]; el.style.opacity = ''; }, 180);
        }
      }, every + rand(-400, 400));
      el.style.transition = 'opacity 180ms linear';
    });
  }

  /* ======================================================================
     CLOCK — real time, in the tiles and on the devices
     ====================================================================== */
  function initClock() {
    var nodes = $$('[data-clock]');
    if (!nodes.length) return;
    function pad(n) { return n < 10 ? '0' + n : '' + n; }
    function tick() {
      var d = new Date();
      nodes.forEach(function (el) {
        var f = el.dataset.clock;
        if (f === 'time') el.textContent = pad(d.getHours()) + ':' + pad(d.getMinutes());
        else if (f === 'day') el.textContent = d.toLocaleDateString(undefined, { weekday: 'short' });
        else if (f === 'date') el.textContent = String(d.getDate());
        else if (f === 'full') el.textContent = d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
        else if (f === 'short') el.textContent = d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
        else if (f === 'year') el.textContent = String(d.getFullYear());
      });
    }
    tick();
    setInterval(tick, 10000);
  }

  /* ======================================================================
     COUNTERS
     ====================================================================== */
  function initCounters() {
    var els = $$('[data-count]');
    if (!els.length) return;
    if (reduced() || !('IntersectionObserver' in window)) {
      els.forEach(function (el) { el.textContent = fmt(parseFloat(el.dataset.count), el); });
      return;
    }
    function fmtN(v, el) {
      var dec = parseInt(el.dataset.countDec, 10) || 0;
      var s = v.toFixed(dec);
      return (el.dataset.countSep === 'off') ? s : s.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var el = en.target, target = parseFloat(el.dataset.count), t0 = null, dur = 1400;
        function step(t) {
          if (!t0) t0 = t;
          var p = clamp((t - t0) / dur, 0, 1);
          var e = 1 - Math.pow(1 - p, 3);
          el.textContent = fmtN(target * e, el);
          if (p < 1) raf(step);
        }
        raf(step);
        io.unobserve(el);
      });
    }, { threshold: 0.4 });
    els.forEach(function (el) { io.observe(el); });
    function fmt(v, el) { return fmtN(v, el); }
  }

  /* ======================================================================
     DRAG-TO-SCROLL for horizontal rails
     ====================================================================== */
  function initHScroll() {
    $$('.hscroll').forEach(function (rail) {
      var down = false, startX = 0, startLeft = 0, moved = 0;
      rail.addEventListener('pointerdown', function (e) {
        if (e.pointerType === 'touch') return;
        down = true; moved = 0; startX = e.clientX; startLeft = rail.scrollLeft;
        rail.classList.add('is-dragging');
      });
      window.addEventListener('pointerup', function () {
        if (!down) return;
        down = false; rail.classList.remove('is-dragging');
      });
      rail.addEventListener('pointermove', function (e) {
        if (!down) return;
        var dx = e.clientX - startX;
        moved = Math.abs(dx);
        if (moved > 4) e.preventDefault();
        rail.scrollLeft = startLeft - dx;
      });
      rail.addEventListener('click', function (e) { if (moved > 6) { e.preventDefault(); e.stopPropagation(); } }, true);
    });
  }

  /* ======================================================================
     LIGHTBOX (gallery)
     ====================================================================== */
  function initLightbox() {
    var triggers = $$('[data-lightbox]');
    if (!triggers.length) return;
    var box = document.createElement('div');
    box.className = 'lightbox';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-label', 'Screenshot viewer');
    box.innerHTML =
      '<button class="lightbox__close" aria-label="Close viewer">' + icon('close') + '</button>' +
      '<button class="lightbox__nav lightbox__nav--prev" aria-label="Previous">' + icon('chevron-left') + '</button>' +
      '<button class="lightbox__nav lightbox__nav--next" aria-label="Next">' + icon('chevron-right') + '</button>' +
      '<div><img alt=""><p class="lightbox__cap"></p></div>';
    document.body.appendChild(box);

    var img = $('img', box), cap = $('.lightbox__cap', box), idx = 0, opener = null;

    function show(i) {
      idx = (i + triggers.length) % triggers.length;
      var t = triggers[idx];
      img.src = t.dataset.lightbox;
      img.alt = t.dataset.lightboxAlt || '';
      cap.textContent = t.dataset.lightboxCap || '';
    }
    function open(i, from) {
      opener = from; show(i);
      box.classList.add('is-open');
      document.body.classList.add('is-locked');
      $('.lightbox__close', box).focus();
    }
    function close() {
      box.classList.remove('is-open');
      document.body.classList.remove('is-locked');
      if (opener) opener.focus();
    }
    triggers.forEach(function (t, i) {
      t.addEventListener('click', function (e) { e.preventDefault(); open(i, t); });
    });
    $('.lightbox__close', box).addEventListener('click', close);
    $('.lightbox__nav--prev', box).addEventListener('click', function () { show(idx - 1); });
    $('.lightbox__nav--next', box).addEventListener('click', function () { show(idx + 1); });
    box.addEventListener('click', function (e) { if (e.target === box) close(); });
    document.addEventListener('keydown', function (e) {
      if (!box.classList.contains('is-open')) return;
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowRight') show(idx + 1);
      if (e.key === 'ArrowLeft') show(idx - 1);
    });
  }

  /* ======================================================================
     ACCORDIONS (changelog, faq)
     ====================================================================== */
  function initAccordion() {
    $$('[data-accordion] [data-acc-head]').forEach(function (head) {
      head.addEventListener('click', function () {
        var item = head.closest('[data-acc-item]');
        var open = item.classList.toggle('is-open');
        head.setAttribute('aria-expanded', String(open));
      });
    });
  }

  /* ======================================================================
     TABS / FILTERS
     ====================================================================== */
  function initFilters() {
    $$('[data-filter-group]').forEach(function (group) {
      var targets = $$('[data-filter-item]', document.querySelector(group.dataset.filterTarget) || document);
      $$('[data-filter]', group).forEach(function (btn) {
        btn.addEventListener('click', function () {
          var key = btn.dataset.filter;
          $$('[data-filter]', group).forEach(function (b) { b.classList.toggle('is-on', b === btn); b.setAttribute('aria-pressed', String(b === btn)); });
          targets.forEach(function (t) {
            var match = key === 'all' || (t.dataset.filterItem || '').split(' ').indexOf(key) > -1;
            t.style.display = match ? '' : 'none';
          });
        });
      });
    });
  }

  /* ======================================================================
     COPY BUTTONS
     ====================================================================== */
  function initCopy() {
    document.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-copy]');
      if (!btn) return;
      var text = btn.dataset.copy;
      if (!text) {
        var src = document.querySelector(btn.dataset.copyFrom);
        text = src ? src.textContent.trim() : '';
      }
      if (!text || !navigator.clipboard) return;
      navigator.clipboard.writeText(text).then(function () {
        var old = btn.getAttribute('data-label') || btn.textContent;
        btn.setAttribute('data-label', old);
        btn.textContent = 'Copied';
        setTimeout(function () { btn.textContent = old; }, 1600);
      });
    });
  }

  /* ======================================================================
     OPTIONAL LIVE GITHUB NUMBERS
     Placeholders stay put unless a real repository answers.
     ====================================================================== */
  function initGithub() {
    if (!GH_REPO) return;
    var nodes = $$('[data-gh]');
    if (!nodes.length) return;
    fetch('https://api.github.com/repos/' + GH_REPO, { headers: { Accept: 'application/vnd.github+json' } })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
      .then(function (d) {
        var map = { stars: d.stargazers_count, forks: d.forks_count, issues: d.open_issues_count, watchers: d.subscribers_count };
        nodes.forEach(function (el) {
          var v = map[el.dataset.gh];
          if (typeof v === 'number') { el.dataset.count = v; el.textContent = v.toLocaleString(); el.closest('[data-gh-live]') && el.closest('[data-gh-live]').setAttribute('data-live-ok', 'true'); }
        });
      })
      .catch(function () { /* offline or no such repo — keep the static figures */ });
  }

  /* ======================================================================
     APP SHOWCASE — a tile grid driving one detail panel
     ====================================================================== */
  var STATUS = {
    available: { label: 'Available',      cls: 'pill--done' },
    dev:       { label: 'In development', cls: 'pill--progress' },
    planned:   { label: 'Planned',        cls: 'pill--planned' }
  };

  function initAppGrid() {
    var grid = $('[data-appgrid]');
    var detail = $('[data-appdetail]');
    if (!grid || !detail) return;

    function render(tile) {
      var d = tile.dataset;
      var st = STATUS[d.appStatus] || STATUS.planned;
      var media = d.appShot
        ? '<div class="appdetail__shot"><img src="' + d.appShot + '" alt="' + (d.appShotAlt || '') + '" loading="lazy" decoding="async"></div>'
        : '<div class="appdetail__shot" style="aspect-ratio:9/16;display:grid;place-items:center;background:' + (d.appColor || 'var(--tile-slate)') + '">' +
          icon(d.appIcon, 'appdetail__glyph') + '</div>';
      var feats = (d.appFeatures || '').split('|').filter(Boolean).map(function (f) {
        return '<li>' + f + '</li>';
      }).join('');
      detail.innerHTML = media +
        '<div class="appdetail__body">' +
          '<div class="appdetail__title">' +
            '<span class="appdetail__ico" style="--tile-bg:' + (d.appColor || 'var(--accent)') + '">' + icon(d.appIcon) + '</span>' +
            '<div><h3 class="h3">' + d.app + '</h3><span class="pill ' + st.cls + '">' + st.label + '</span></div>' +
          '</div>' +
          '<p class="body-copy">' + (d.appDesc || '') + '</p>' +
          (feats ? '<ul class="bullets">' + feats + '</ul>' : '') +
          '<dl class="kv"><dt>Package</dt><dd>' + (d.appPkg || '&mdash;') + '</dd>' +
          '<dt>Maintainer</dt><dd>' + (d.appOwner || 'Community') + '</dd></dl>' +
        '</div>';
      $$('[data-app]', grid).forEach(function (t) {
        var on = t === tile;
        t.classList.toggle('is-active', on);
        t.setAttribute('aria-pressed', String(on));
      });
    }

    grid.addEventListener('click', function (e) {
      var t = e.target.closest('[data-app]');
      if (t) render(t);
    });
    var first = $('[data-app]', grid);
    if (first) render(first);
  }

  /* ======================================================================
     ICONS — one sprite, referenced everywhere
     ====================================================================== */
  function icon(name, cls) {
    return '<svg' + (cls ? ' class="' + cls + '"' : '') + ' aria-hidden="true" focusable="false"><use href="#i-' + name + '"></use></svg>';
  }

  /* ======================================================================
     ANCHORS — smooth, focus-safe
     ====================================================================== */
  function initAnchors() {
    document.addEventListener('click', function (e) {
      var a = e.target.closest('a[href^="#"]');
      if (!a) return;
      var id = a.getAttribute('href');
      if (id.length < 2) return;
      var t = document.querySelector(id);
      if (!t) return;
      e.preventDefault();
      t.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' });
      t.setAttribute('tabindex', '-1');
      t.focus({ preventScroll: true });
      history.replaceState(null, '', id);
    });
  }

  /* ======================================================================
     EXPOSE + START
     ====================================================================== */
  window.METRO = { $: $, $$: $$, icon: icon, reduced: reduced, setAccent: setAccent, accents: ACCENTS, clamp: clamp };

  function start() {
    boot();
    initAccent(); initNav(); initProgress(); initScrollFX();
    initLiveTiles(); initClock(); initCounters(); initHScroll(); initLightbox();
    initAccordion(); initFilters(); initCopy(); initAnchors(); initGithub(); initAppGrid();
    document.dispatchEvent(new CustomEvent('metro:ready'));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
