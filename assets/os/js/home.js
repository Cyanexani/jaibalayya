/* Home = start screen and app list side by side. Swipe (or scroll
   sideways) between them; the wallpaper drifts slower than the tiles. */

import { h, animate } from './util.js';
import { createStart } from './start.js';
import { createAppList } from './applist.js';
import { go, back, canGoBack } from './router.js';

export function createHome({ screen }) {
  const wall = h('div', { class: 'home__wall', 'aria-hidden': 'true' });
  const startPane = h('div', { class: 'home__pane' });
  const appsPane = h('div', { class: 'home__pane' });
  const track = h('div', { class: 'home__track' }, startPane, appsPane);
  const el = h('div', { class: 'home' }, wall, track);

  const start = createStart({ screen });
  const apps = createAppList({ screen, start, recedeEl: appsPane });
  startPane.append(start.el);
  appsPane.append(apps.el);

  let pane = 'start';
  let appsFromStart = false;
  let held = [];

  function setPane(p) {
    pane = p;
    track.style.transform = p === 'apps' ? 'translateX(-50%)' : '';
    wall.style.transform = p === 'apps' ? 'translateX(-9%)' : '';
    startPane.inert = p !== 'start';
    appsPane.inert = p !== 'apps';
    if (p === 'start') apps.reset();
  }

  function toPane(target) {
    if (target === pane) return setPane(pane);
    if (target === 'apps') { appsFromStart = true; go('#/apps'); }
    else if (appsFromStart && canGoBack()) { appsFromStart = false; back(); }
    else go('#/', { replace: true });
  }

  /* ---------- sideways swipe ---------- */
  let pan = null;
  el.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || e.target.closest('.jumplist, .ctx, .applist__search, .bloom')) return;
    pan = { x: e.clientX, y: e.clientY, id: e.pointerId, mode: null, w: el.clientWidth };
  });
  window.addEventListener('pointermove', (e) => {
    if (!pan || e.pointerId !== pan.id) return;
    const dx = e.clientX - pan.x, dy = e.clientY - pan.y;
    if (!pan.mode) {
      if (start.isBusy()) { pan = null; return; }
      if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.3) {
        pan.mode = 'x';
        start.cancelPress();
        apps.cancelPress();
        track.classList.add('is-dragging');
        wall.style.transition = 'none';
      } else if (Math.abs(dy) > 12) { pan = null; return; }
    }
    if (pan?.mode === 'x') {
      const base = pane === 'apps' ? -pan.w : 0;
      let x = base + dx;
      if (x > 0) x *= 0.25;
      if (x < -pan.w) x = -pan.w + (x + pan.w) * 0.25;
      track.style.transform = `translateX(${x}px)`;
      wall.style.transform = `translateX(${(x / pan.w) * 9}%)`;
    }
  });
  const endPan = (e) => {
    if (!pan || e.pointerId !== pan.id) return;
    const p = pan;
    pan = null;
    if (p.mode !== 'x') return;
    track.classList.remove('is-dragging');
    wall.style.transition = '';
    const dx = e.clientX - p.x;
    const limit = p.w * 0.18;
    const target = pane === 'start' ? (dx < -limit ? 'apps' : 'start') : (dx > limit ? 'start' : 'apps');
    // swallow the click that follows a swipe
    const stop = (ev) => { ev.stopPropagation(); ev.preventDefault(); };
    window.addEventListener('click', stop, { capture: true, once: true });
    setTimeout(() => window.removeEventListener('click', stop, { capture: true }), 50);
    toPane(target);
  };
  window.addEventListener('pointerup', endPan);
  window.addEventListener('pointercancel', endPan);

  let wheelLock = false;
  el.addEventListener('wheel', (e) => {
    if (wheelLock || Math.abs(e.deltaX) < 25 || Math.abs(e.deltaX) < Math.abs(e.deltaY)) return;
    wheelLock = true;
    setTimeout(() => { wheelLock = false; }, 600);
    toPane(e.deltaX > 0 ? 'apps' : 'start');
  }, { passive: true });

  /* ---------- turnstile ---------- */
  function visibleItems() {
    const items = pane === 'apps' ? apps.items() : [...start.tilesEl.children];
    const sr = screen.getBoundingClientRect();
    return { sr, items: items.filter((it) => { const r = it.getBoundingClientRect(); return r.bottom > sr.top && r.top < sr.bottom && r.width; }) };
  }

  async function turnstileOut() {
    const tapped = pane === 'apps' ? apps.lastTapped : start.lastTapped;
    const { sr, items } = visibleItems();
    let max = 0;
    const plan = items.map((it) => {
      const r = it.getBoundingClientRect();
      const delay = Math.max(0, (r.top - sr.top) * 0.16 + (r.left - sr.left) * 0.06);
      if (it !== tapped) max = Math.max(max, delay);
      it.style.transformOrigin = `${sr.left - r.left}px 50%`;
      return { it, delay };
    });
    held = await Promise.all(plan.map(({ it, delay }) => animate(it, [
      { transform: 'perspective(1200px) rotateY(0deg)', opacity: 1 },
      { transform: 'perspective(1200px) rotateY(-80deg)', opacity: 0 }
    ], { duration: 190, delay: it === tapped ? max + 60 : delay, easing: 'ease-in', fill: 'forwards' })));
  }

  function turnstileIn() {
    const old = held;
    held = [];
    const { sr, items } = visibleItems();
    for (const it of items) {
      const r = it.getBoundingClientRect();
      it.style.transformOrigin = `${sr.left - r.left}px 50%`;
      animate(it, [
        { transform: 'perspective(1200px) rotateY(80deg)', opacity: 0 },
        { transform: 'none', opacity: 1 }
      ], { duration: 320, delay: (r.top - sr.top) * 0.14 + (r.left - sr.left) * 0.05, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' })
        .then(() => { it.style.transformOrigin = ''; });
    }
    old.forEach((a) => a?.cancel?.());
    for (const it of [...start.tilesEl.children, ...apps.items()]) if (!items.includes(it)) it.style.transformOrigin = '';
  }

  setPane('start');

  return {
    el,
    start,
    apps,
    get pane() { return pane; },
    show(p) {
      if (p === 'apps' && pane !== 'apps') appsFromStart = appsFromStart || false;
      setPane(p);
    },
    turnstileOut,
    turnstileIn,
    goStart() {
      if (pane === 'apps') toPane('start');
      else start.scrollTop();
    }
  };
}
