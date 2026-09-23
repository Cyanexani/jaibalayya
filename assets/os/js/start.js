/* The start screen: a grid of live tiles.
     tap              open the app
     hold             Bloom (shortcuts fan out)
     hold and drag    move the tile
     right-click      Bloom, for mouse users
   "customize" in a Bloom enters edit mode: resize, unpin, drag freely. */

import { h, fill, tilt, untilt, animate, on, morph } from './util.js';
import { store, watch } from './store.js';
import { byId, iconHtml } from './registry.js';
import { TILES, badgeFor, newsFace, liveFace } from './live.js';
import * as N from './notify.js';
import { activity } from './activity.js';
import { openBloom } from './bloom.js';
import { go } from './router.js';
import { pushOverlay } from './overlays.js';
import { toast } from './notify.js';
import { tileFrame } from './customtile.js';

const HOLD_MS = 450;
const SIZE_ORDER = ['m', 's', 'w', 'l'];

export function createStart({ screen }) {
  const tilesEl = h('div', { class: 'tiles', role: 'list', 'aria-label': 'Start tiles' });
  const moreBtn = h('button', { class: 'start__more', type: 'button', onclick: () => go('#/apps') },
    h('span', { class: 'ring' }, h('i', { class: 'fa-solid fa-arrow-right' })), 'All apps');
  const el = h('div', { class: 'start' }, h('div', { class: 'tiles-wrap' }, tilesEl), moreBtn);

  let press = null;
  let bloom = null;
  let editing = false;
  let selected = null;
  let popEdit = null;
  let ring = null;
  let lastTapped = null;

  /* ---------------- rendering ---------------- */
  function makeTile({ id, size }) {
    const app = byId(id);
    const tile = h('div', {
      class: 'tile', role: 'button', tabindex: '0',
      'data-id': id, 'data-size': size,
      'aria-label': app.built ? app.name : `${app.name}, notes page until phase ${app.phase}`,
      vars: { '--app-color': app.color }
    },
    h('div', { class: 'tile__inner' },
      h('div', { class: 'tile__face tile__face--front' }),
      h('div', { class: 'tile__face tile__face--back' })),
    h('div', { class: 'tile__dot', 'aria-hidden': 'true' }),
    h('div', { class: 'tile__edit' },
      h('button', { class: 'tile__unpin', type: 'button', 'data-edit': 'unpin', 'aria-label': `Unpin ${app.name}` }, h('i', { class: 'fa-solid fa-thumbtack-slash' })),
      h('button', { class: 'tile__resize', type: 'button', 'data-edit': 'resize', 'aria-label': `Resize ${app.name}` }, h('i', { class: 'fa-solid fa-up-right-and-down-left-from-center' }))));
    paintFront(tile);
    return tile;
  }

  function paintFront(tile) {
    const app = byId(tile.dataset.id);
    const size = tile.dataset.size;
    const spec = TILES[app.tile];
    const face = tile.querySelector('.tile__face--front');
    if (app.custom) { face.replaceChildren(tileFrame(app.custom, size)); return; }
    const custom = spec?.front?.(size);
    if (custom) { face.replaceChildren(custom); return; }
    const badge = badgeFor(app.id);
    // The number rolls up when it changes; repaints right after keep the roll going.
    if (badge && badge !== tile.dataset.badge) tile._bumpUntil = Date.now() + 500;
    const bumped = badge && Date.now() < (tile._bumpUntil || 0);
    tile.dataset.badge = badge || '';
    fill(face,
      h('div', { class: 'tile__icon', html: iconHtml(app) }),
      h('div', { class: 'tile__label' }, app.name),
      badge ? h('span', { class: bumped ? 'tile__badge is-bump' : 'tile__badge' }, String(badge)) : null);
  }

  function paintBack(tile) {
    const app = byId(tile.dataset.id);
    const back = TILES[app.tile]?.back?.(tile.dataset.size);
    tile.querySelector('.tile__face--back').replaceChildren(back || '');
    tile.dataset.live = back ? '1' : '';
    if (!back) tile.classList.remove('is-flipped');
    return !!back;
  }

  function render() {
    const layout = (store.get('layout') || []).filter((t) => byId(t.id));
    tilesEl.replaceChildren(...layout.map(makeTile));
  }

  function saveLayout() {
    store.set('layout', [...tilesEl.children].map((t) => ({ id: t.dataset.id, size: t.dataset.size })));
  }

  /* ---------------- live tiles ---------------- */
  const due = new WeakMap();
  setInterval(() => {
    if (document.hidden || editing || press) return;
    const now = Date.now();
    for (const tile of tilesEl.children) {
      const spec = TILES[byId(tile.dataset.id)?.tile];
      if (!spec?.every || !spec.back || tile.dataset.news || tile.classList.contains('is-live')) continue;
      const at = due.get(tile);
      if (!at) { due.set(tile, now + 1200 + Math.random() * spec.every); continue; }
      if (now < at) continue;
      if (tile.classList.contains('is-flipped')) tile.classList.remove('is-flipped');
      else if (paintBack(tile)) tile.classList.add('is-flipped');
      due.set(tile, now + spec.every * (0.7 + Math.random() * 0.6));
    }
  }, 1000);

  function refreshMinute() {
    for (const tile of tilesEl.children) {
      if (TILES[byId(tile.dataset.id)?.tile]?.refresh === 'minute') paintFront(tile);
    }
  }
  setTimeout(() => { refreshMinute(); setInterval(refreshMinute, 60000); }, (60 - new Date().getSeconds()) * 1000 + 50);
  on('os-content', () => { for (const t of tilesEl.querySelectorAll('[data-id="hub"]')) paintBack(t); });
  // Alarms, events and weather change what the Clock, Calendar and Weather tiles show.
  for (const ev of ['weather', 'clock', 'events']) on(ev, refreshMinute);
  // Unread mail and missed calls change the Mail and Phone badges.
  for (const ev of ['mail', 'calls', 'calls-seen']) on(ev, () => { for (const t of tilesEl.querySelectorAll('[data-id="mail"], [data-id="phone"]')) paintFront(t); });

  /* ---------------- notifications on tiles ----------------
     count / flip: flip straight to the new item, keep flipping for about
     a minute, then settle on the normal face with the count.
     quiet (or anything during quiet hours): no flip, just the count or a marker. */
  const newsTimers = new WeakMap();
  const NEWS_FOR = 60000;
  const paintDot = (tile) => tile.classList.toggle('has-dot', N.markerFor(tile.dataset.id));

  function stopNews(tile) {
    clearInterval(newsTimers.get(tile));
    newsTimers.delete(tile);
    delete tile.dataset.news;
    if (!tile.classList.contains('is-live')) tile.classList.remove('is-flipped');
  }

  function showNews(tile, n) {
    const back = tile.querySelector('.tile__face--back');
    back.replaceChildren(newsFace(n, tile.dataset.size));
    tile.dataset.news = '1';
    // Arrival: the tile dips and springs back while it flips over with a small overshoot.
    tile.classList.remove('is-arriving');
    void tile.offsetWidth;
    tile.classList.add('is-arriving', 'is-flipped');
    clearTimeout(tile._arrive);
    tile._arrive = setTimeout(() => tile.classList.remove('is-arriving'), 800);
    clearInterval(newsTimers.get(tile));
    const until = Date.now() + NEWS_FOR;
    newsTimers.set(tile, setInterval(() => {
      if (tile.classList.contains('is-live')) return;
      if (Date.now() > until || !N.latestFor(tile.dataset.id)) return stopNews(tile);
      if (tile.classList.contains('is-flipped')) tile.classList.remove('is-flipped');
      else { back.replaceChildren(newsFace(N.latestFor(tile.dataset.id) || n, tile.dataset.size)); tile.classList.add('is-flipped'); }
    }, 3500));
  }

  on('tile-news', (n) => {
    const tile = tilesEl.querySelector(`[data-id="${n.app}"]`);
    if (!tile) return;
    paintDot(tile); // the count itself was repainted by the 'notifications' handler
    if (n.level === 'quiet' || N.mode() === 'quiet' || tile.classList.contains('is-live')) return;
    showNews(tile, n);
  });
  on('tile-read', (app) => {
    const tile = tilesEl.querySelector(`[data-id="${app}"]`);
    if (tile) { stopNews(tile); paintFront(tile); paintDot(tile); }
  });
  // Repaint counts and markers (custom tiles are skipped: repainting reloads their frame).
  on('notifications', () => { for (const t of tilesEl.children) { if (!byId(t.dataset.id)?.custom) paintFront(t); paintDot(t); } });

  /* ---------------- live tiles: a running timer, now playing, a call ---------------- */
  function paintLive() {
    const ringing = activity.get('ringing');
    for (const tile of tilesEl.children) {
      const face = liveFace(tile.dataset.id, tile.dataset.size);
      tile.classList.toggle('is-ringing', !!ringing && ringing.app === tile.dataset.id);
      if (face) {
        const count = badgeFor(tile.dataset.id);
        if (count) face.append(h('span', { class: 'tile__count' }, count));
        const back = tile.querySelector('.tile__face--back');
        // Already live: update in place (no image reload, progress bars glide).
        if (tile.classList.contains('is-live') && back.childNodes.length === 1) morph(back.firstChild, face);
        else back.replaceChildren(face);
        tile.classList.add('is-live', 'is-flipped');
      } else if (tile.classList.contains('is-live')) {
        tile.classList.remove('is-live', 'is-flipped');
        paintBack(tile);
      }
    }
  }
  setInterval(() => { if (!document.hidden) paintLive(); }, 1000);
  for (const ev of ['activity', 'player', 'radio', 'podcasts', 'clock']) on(ev, paintLive);

  /* ---------------- geometry ---------------- */
  function metrics() {
    const g = tilesEl.getBoundingClientRect();
    const cs = getComputedStyle(tilesEl);
    const cols = parseInt(cs.getPropertyValue('--cols'), 10) || 6;
    const gap = parseFloat(cs.columnGap) || 6;
    return { g, cols, gap, cell: (g.width - gap * (cols - 1)) / cols };
  }

  /** Reorder with a FLIP animation so tiles glide into their new spots. */
  function flip(mutate) {
    const before = new Map([...tilesEl.children].map((t) => [t, t.getBoundingClientRect()]));
    mutate();
    for (const t of tilesEl.children) {
      const a = before.get(t);
      if (!a) continue;
      const b = t.getBoundingClientRect();
      const dx = a.left - b.left, dy = a.top - b.top;
      if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
        animate(t, [{ translate: `${dx}px ${dy}px` }, { translate: '0 0' }], { duration: 280, easing: 'cubic-bezier(.2,.8,.2,1)' });
      }
    }
  }

  /* ---------------- hold ring ---------------- */
  function showRing(e) {
    hideRing();
    const sr = screen.getBoundingClientRect();
    ring = h('div', { class: 'holdring', style: { left: `${e.clientX - sr.left}px`, top: `${e.clientY - sr.top}px` } });
    screen.append(ring);
  }
  function hideRing() { ring?.remove(); ring = null; }

  /* ---------------- opening ---------------- */
  function openTile(tile) {
    lastTapped = tile;
    go(`#/app/${tile.dataset.id}`);
  }

  function openBloomFor(tile) {
    bloom?.close(true);
    const app = byId(tile.dataset.id);
    navigator.vibrate?.(10);
    bloom = openBloom({
      tileEl: tile, app, screen, metrics: metrics(),
      onCustomize: () => startEdit(tile),
      onOpen: () => openTile(tile),
      onClosed: () => { bloom = null; }
    });
  }

  /* ---------------- pointer handling ---------------- */
  function onDown(e) {
    if (e.button !== 0 || press) return;
    const tile = e.target.closest('.tile');
    if (!tile || !tilesEl.contains(tile) || e.target.closest('[data-edit]')) return;
    press = { tile, x: e.clientX, y: e.clientY, id: e.pointerId, held: false, dragging: false, edit: editing };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    if (editing) return;
    tilt(tile, e);
    showRing(e);
    press.timer = setTimeout(() => {
      if (!press) return;
      press.held = true;
      hideRing();
      untilt(press.tile);
      openBloomFor(press.tile);
    }, HOLD_MS);
  }

  function onMove(e) {
    const p = press;
    if (!p || e.pointerId !== p.id) return;
    const dist = Math.hypot(e.clientX - p.x, e.clientY - p.y);
    if (p.dragging) { moveDrag(e); return; }
    if (p.edit) { if (dist > 6) startDrag(e); return; }
    if (!p.held) { if (dist > 8) cancelPress(); return; }
    if (dist > 12) { bloom?.close(true); startDrag(e); }
  }

  function onUp(e) {
    const p = press;
    if (!p || e.pointerId !== p.id) return;
    detach();
    press = null;
    if (p.dragging) { endDrag(p); return; }
    clearTimeout(p.timer);
    hideRing();
    untilt(p.tile);
    if (p.edit) { select(p.tile); return; }
    if (!p.held) openTile(p.tile);
  }

  function onCancel(e) {
    const p = press;
    if (!p || e.pointerId !== p.id) return;
    if (p.dragging) { detach(); press = null; endDrag(p); return; }
    cancelPress();
  }

  function detach() {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onCancel);
  }

  function cancelPress() {
    if (!press) return;
    clearTimeout(press.timer);
    hideRing();
    untilt(press.tile);
    detach();
    press = null;
  }

  tilesEl.addEventListener('pointerdown', onDown);
  // Once a hold or drag has started, stop the page from scrolling under the finger.
  el.addEventListener('touchmove', (e) => { if (press && (press.held || press.dragging || press.edit)) e.preventDefault(); }, { passive: false });
  tilesEl.addEventListener('contextmenu', (e) => {
    const tile = e.target.closest('.tile');
    if (!tile) return;
    e.preventDefault();
    if (press?.held || editing) return;
    cancelPress();
    openBloomFor(tile);
  });
  tilesEl.addEventListener('keydown', (e) => {
    const tile = e.target.closest('.tile');
    if (!tile || e.target !== tile) return;
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); editing ? select(tile) : openTile(tile); }
    if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) { e.preventDefault(); openBloomFor(tile); }
  });

  /* ---------------- dragging ---------------- */
  let raf = 0;
  function startDrag(e) {
    const p = press;
    p.dragging = true;
    clearTimeout(p.timer);
    hideRing();
    untilt(p.tile);
    const r = p.tile.getBoundingClientRect();
    const sr = screen.getBoundingClientRect();
    p.off = { x: e.clientX - r.left, y: e.clientY - r.top };
    p.ghost = p.tile.cloneNode(true);
    p.ghost.classList.remove('is-selected', 'is-tilting');
    p.ghost.classList.add('tile-ghost');
    p.ghost.style.transform = '';
    Object.assign(p.ghost.style, { left: `${r.left - sr.left}px`, top: `${r.top - sr.top}px`, width: `${r.width}px`, height: `${r.height}px` });
    screen.append(p.ghost);
    p.tile.classList.add('is-placeholder');
    p.lastSwap = 0;
    p.lx = e.clientX; p.ly = e.clientY;
    const loop = () => {
      if (!press?.dragging) return;
      const s = el.getBoundingClientRect();
      if (press.ly < s.top + 48) el.scrollTop -= 7;
      else if (press.ly > s.bottom - 48) el.scrollTop += 7;
      trySwap(press.lx, press.ly);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
  }

  function moveDrag(e) {
    const p = press;
    const sr = screen.getBoundingClientRect();
    p.ghost.style.left = `${e.clientX - sr.left - p.off.x}px`;
    p.ghost.style.top = `${e.clientY - sr.top - p.off.y}px`;
    p.lx = e.clientX; p.ly = e.clientY;
  }

  function trySwap(x, y) {
    const p = press;
    const now = performance.now();
    if (!p || now - p.lastSwap < 240) return;
    const under = document.elementFromPoint(x, y)?.closest?.('.tile');
    if (!under || under === p.tile || !tilesEl.contains(under)) return;
    const kids = [...tilesEl.children];
    const from = kids.indexOf(p.tile), to = kids.indexOf(under);
    flip(() => (from < to ? under.after(p.tile) : under.before(p.tile)));
    p.lastSwap = now;
  }

  function endDrag(p) {
    cancelAnimationFrame(raf);
    const r = p.tile.getBoundingClientRect();
    const sr = screen.getBoundingClientRect();
    const dx = r.left - sr.left - parseFloat(p.ghost.style.left);
    const dy = r.top - sr.top - parseFloat(p.ghost.style.top);
    animate(p.ghost, [{ transform: 'scale(1.06)' }, { transform: `translate(${dx}px, ${dy}px) scale(1)` }],
      { duration: 180, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'forwards' })
      .then(() => { p.ghost.remove(); p.tile.classList.remove('is-placeholder'); });
    saveLayout();
  }

  /* ---------------- edit mode ---------------- */
  function select(tile) {
    selected?.classList.remove('is-selected');
    selected = tile;
    tile.classList.add('is-selected');
  }

  function startEdit(tile) {
    if (!editing) {
      editing = true;
      tilesEl.classList.add('is-editing');
      popEdit = pushOverlay(stopEdit);
    }
    select(tile);
    tile.focus({ preventScroll: true });
  }

  function stopEdit() {
    if (!editing) return;
    editing = false;
    tilesEl.classList.remove('is-editing');
    selected?.classList.remove('is-selected');
    selected = null;
    popEdit?.();
    popEdit = null;
    saveLayout();
  }

  tilesEl.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-edit]');
    if (!btn) return;
    e.stopPropagation();
    const tile = btn.closest('.tile');
    if (btn.dataset.edit === 'unpin') unpinTile(tile);
    else resizeTile(tile);
  });
  el.addEventListener('click', (e) => {
    if (editing && !e.target.closest('.tile')) stopEdit();
  });

  function resizeTile(tile) {
    const app = byId(tile.dataset.id);
    const allowed = SIZE_ORDER.filter((s) => app.sizes.includes(s));
    const next = allowed[(allowed.indexOf(tile.dataset.size) + 1) % allowed.length];
    flip(() => {
      tile.dataset.size = next;
      tile.classList.remove('is-flipped');
      paintFront(tile);
    });
    saveLayout();
  }

  function unpinTile(tile) {
    tile.classList.add('is-removing');
    setTimeout(() => {
      flip(() => tile.remove());
      if (selected === tile) selected = null;
      saveLayout();
      if (!tilesEl.children.length) stopEdit();
    }, 220);
  }

  /* ---------------- density: more columns on wide screens ---------------- */
  // On a phone the grid is 6 (or 4) small tiles across. On a wide screen
  // (full screen mode, a tablet) it gains columns so tiles stay tile-sized,
  // up to 12, and the grid is centred.
  const wrap = el.querySelector('.tiles-wrap');
  function fitColumns() {
    const w = el.clientWidth - 48;
    const base = store.get('moreTiles') ? 6 : 4;
    if (w < 560) {
      tilesEl.style.removeProperty('--cols');
      wrap.style.maxWidth = '';
      return;
    }
    const target = store.get('moreTiles') ? 92 : 128;
    const cols = Math.max(base, Math.min(12, Math.round(w / target / 2) * 2));
    tilesEl.style.setProperty('--cols', String(cols));
    wrap.style.maxWidth = `${cols * (target + 10)}px`;
  }
  new ResizeObserver(fitColumns).observe(el);
  watch('moreTiles', fitColumns);

  /* ---------------- public ---------------- */
  render();
  watch('layout', (v) => {
    // Only re-render when something outside this module replaced the layout.
    const now = [...tilesEl.children].map((t) => `${t.dataset.id}:${t.dataset.size}`).join();
    if ((v || []).map((t) => `${t.id}:${t.size}`).join() !== now) render();
  });

  return {
    el,
    tilesEl,
    get lastTapped() { const t = lastTapped; lastTapped = null; return t; },
    isBusy: () => !!(press && (press.held || press.dragging || press.edit)) || !!bloom || editing,
    cancelPress,
    isPinned: (id) => !!tilesEl.querySelector(`[data-id="${id}"]`),
    pin(id) {
      if (tilesEl.querySelector(`[data-id="${id}"]`)) return;
      const app = byId(id);
      const tile = makeTile({ id, size: app.sizes.includes('m') ? 'm' : app.sizes[0] });
      tilesEl.append(tile);
      saveLayout();
      toast(`${app.name} pinned to start`);
    },
    unpin(id) {
      const tile = tilesEl.querySelector(`[data-id="${id}"]`);
      if (!tile) return;
      tile.remove();
      saveLayout();
      toast(`${byId(id).name} unpinned`);
    },
    scrollToTile(id) {
      const tile = tilesEl.querySelector(`[data-id="${id}"]`);
      if (!tile) return;
      tile.scrollIntoView({ block: 'center', behavior: 'smooth' });
      animate(tile, [{ transform: 'scale(.6)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 380, delay: 250, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' });
    },
    scrollTop() { el.scrollTo({ top: 0, behavior: 'smooth' }); }
  };
}
