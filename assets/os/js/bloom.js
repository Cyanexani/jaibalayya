/* Bloom: hold a tile and its shortcuts fan out around it on the start
   grid, over a blurred start screen. Shortcuts snap to the same grid as
   the tiles, cluster as close to the held tile as they can, and move to
   the other side when the tile is near an edge. */

import { h, animate } from './util.js';
import { renderLive } from './live.js';
import { go } from './router.js';
import { pushOverlay } from './overlays.js';
import { store } from './store.js';

const SIZE = { s: [1, 1], m: [2, 2], w: [4, 2] };

function systemShortcuts(app) {
  return [
    { icon: 'fa-solid fa-circle-info', label: 'about this app', go: `#/info/${app.id}`, size: 's', sys: true },
    { icon: 'fa-solid fa-up-down-left-right', label: 'customize: move, resize, unpin', action: 'customize', size: 's', sys: true }
  ];
}

/** Work out where each shortcut goes, in grid cells. */
function layout({ sats, cols, tile, rowMin, rowMax }) {
  const occ = new Set();
  const key = (c, r) => `${c},${r}`;
  const mark = (c, r, w, hh) => { for (let i = 0; i < w; i++) for (let j = 0; j < hh; j++) occ.add(key(c + i, r + j)); };
  mark(tile.c, tile.r, tile.w, tile.h);
  const tcx = tile.c + tile.w / 2, tcy = tile.r + tile.h / 2;

  const fits = (c, r, w, hh) => {
    if (c < 0 || c + w > cols || r < rowMin || r + hh - 1 > rowMax) return false;
    for (let i = 0; i < w; i++) for (let j = 0; j < hh; j++) if (occ.has(key(c + i, r + j))) return false;
    return true;
  };
  const touches = (c, r, w, hh) => {
    for (let i = -1; i <= w; i++) {
      for (let j = -1; j <= hh; j++) {
        const inside = i >= 0 && i < w && j >= 0 && j < hh;
        const corner = (i === -1 || i === w) && (j === -1 || j === hh);
        if (!inside && !corner && occ.has(key(c + i, r + j))) return true;
      }
    }
    return false;
  };

  const order = sats.map((s, i) => ({ s, i })).sort((a, b) => {
    const [aw, ah] = SIZE[a.s.size]; const [bw, bh] = SIZE[b.s.size];
    return bw * bh - aw * ah || a.i - b.i;
  });
  const placed = [];
  for (const { s } of order) {
    let [w, hh] = SIZE[s.size] || SIZE.s;
    w = Math.min(w, cols);
    let best = null;
    for (const needTouch of [true, false]) {
      let bestScore = Infinity;
      for (let r = rowMin; r <= rowMax - hh + 1; r++) {
        for (let c = 0; c <= cols - w; c++) {
          if (!fits(c, r, w, hh) || (needTouch && !touches(c, r, w, hh))) continue;
          const dx = c + w / 2 - tcx, dy = (r + hh / 2 - tcy) * 1.08;
          const score = Math.hypot(dx, dy);
          if (score < bestScore) { bestScore = score; best = { c, r, w, h: hh }; }
        }
      }
      if (best) break;
    }
    if (!best) continue;
    mark(best.c, best.r, best.w, best.h);
    placed.push({ sat: s, ...best });
  }
  return placed;
}

export function openBloom({ tileEl, app, screen, metrics, onCustomize, onOpen, onClosed }) {
  const { g, cols, gap, cell } = metrics;
  const sr = screen.getBoundingClientRect();
  const tr = tileEl.getBoundingClientRect();
  const step = cell + gap;
  const tile = {
    c: Math.round((tr.left - g.left) / step),
    r: Math.round((tr.top - g.top) / step),
    w: Math.max(1, Math.round((tr.width + gap) / step)),
    h: Math.max(1, Math.round((tr.height + gap) / step))
  };
  let rowMin = Math.ceil((sr.top + 4 - g.top) / step);
  let rowMax = Math.floor((sr.bottom - 26 - g.top - cell) / step);
  rowMin = Math.min(rowMin, tile.r);
  rowMax = Math.max(rowMax, tile.r + tile.h - 1);

  const sats = [...(app.bloom || []), ...systemShortcuts(app)];
  const placed = layout({ sats, cols, tile, rowMin, rowMax });

  const px = (c, r) => ({ x: g.left - sr.left + c * step, y: g.top - sr.top + r * step });
  const span = (n) => n * cell + (n - 1) * gap;

  const root = h('div', { class: 'bloom', role: 'dialog', 'aria-label': `${app.name} shortcuts`, vars: { '--app-color': app.color } });
  const scrim = h('div', { class: 'bloom__scrim' });
  const origin = h('div', {
    class: 'bloom__origin', role: 'button', tabindex: '0', 'aria-label': `Open ${app.name}`,
    style: { left: `${tr.left - sr.left}px`, top: `${tr.top - sr.top}px`, width: `${tr.width}px`, height: `${tr.height}px` }
  });
  const clone = tileEl.cloneNode(true);
  clone.classList.remove('is-tilting', 'is-selected');
  clone.style.transform = '';
  clone.removeAttribute('tabindex');
  clone.setAttribute('aria-hidden', 'true');
  origin.append(clone);
  root.append(scrim, origin);

  // Presses that began before the Bloom opened (the hold itself) must not activate anything.
  let armed = null;
  root.addEventListener('pointerdown', (e) => { armed = e.target; });
  const activated = (e, el) => e.detail === 0 || (armed && el.contains(armed));

  const tcx = tr.left - sr.left + tr.width / 2, tcy = tr.top - sr.top + tr.height / 2;
  const cleanups = [];
  const satEls = placed.map(({ sat, c, r, w, h: hh }, i) => {
    const { x, y } = px(c, r);
    const size = sat.size === 'w' ? 'w' : sat.size === 'm' ? 'm' : 's';
    const btn = h('button', {
      class: `bloom__sat bloom__sat--${size}${sat.sys ? ' bloom__sat--sys' : ''}`,
      type: 'button', 'aria-label': sat.label, title: sat.label,
      style: { left: `${x}px`, top: `${y}px`, width: `${span(w)}px`, height: `${span(hh)}px` }
    });
    const liveEl = sat.live ? renderLive(sat.live, sat, app) : null;
    if (liveEl) {
      btn.append(liveEl);
      if (liveEl.cleanup) cleanups.push(liveEl.cleanup);
    } else {
      btn.append(h('span', { class: 'sat__icon' }, h('i', { class: sat.icon, 'aria-hidden': 'true' })), h('span', { class: 'sat__label' }, sat.label));
    }
    btn.addEventListener('click', (e) => {
      if (e.target.closest('[data-act]') || !activated(e, btn)) return;
      if (sat.action === 'customize') { close(true); onCustomize?.(); return; }
      if (sat.go) { close(true); go(sat.go); }
    });
    root.append(btn);
    const cx = x + span(w) / 2, cy = y + span(hh) / 2;
    animate(btn, [
      { transform: `translate(${tcx - cx}px, ${tcy - cy}px) scale(.3)`, opacity: 0 },
      { transform: 'none', opacity: 1 }
    ], { duration: 320, delay: 40 + i * 28, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' });
    btn._from = { x: tcx - cx, y: tcy - cy };
    return btn;
  });

  const hints = store.get('bloomHints') || 0;
  if (hints < 4) {
    store.set('bloomHints', hints + 1);
    root.append(h('div', { class: 'bloom__hint' }, 'tap a shortcut · drag the tile to move it · tap outside to close'));
  }

  origin.addEventListener('click', (e) => { if (activated(e, origin)) { close(true); onOpen?.(); } });
  origin.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); close(true); onOpen?.(); } });
  scrim.addEventListener('click', () => close());
  root.addEventListener('keydown', (e) => {
    const all = [origin, ...satEls];
    const i = all.indexOf(document.activeElement);
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); all[(i + 1) % all.length].focus(); }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); all[(i - 1 + all.length) % all.length].focus(); }
  });

  screen.append(root);
  requestAnimationFrame(() => { origin.style.transform = 'scale(1.05)'; });
  (satEls[0] || origin).focus({ preventScroll: true });

  const pop = pushOverlay(() => close());
  let closed = false;

  function close(fast = false) {
    if (closed) return;
    closed = true;
    pop();
    cleanups.forEach((fn) => fn());
    root.classList.add('is-closing');
    origin.style.transform = '';
    const d = fast ? 120 : 180;
    satEls.forEach((btn, i) => animate(btn,
      [{ transform: 'none', opacity: 1 }, { transform: `translate(${btn._from.x}px, ${btn._from.y}px) scale(.3)`, opacity: 0 }],
      { duration: d, delay: fast ? 0 : (satEls.length - i) * 10, easing: 'ease-in', fill: 'forwards' }));
    setTimeout(() => { root.remove(); onClosed?.(); }, d + (fast ? 10 : satEls.length * 10 + 20));
    if (!fast) tileEl.focus?.({ preventScroll: true });
  }

  return { close, el: root };
}
