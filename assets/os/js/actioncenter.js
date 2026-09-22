/* Action center: pull down from the status bar (or tap it).
   Quick actions on top, notifications grouped by app underneath. */

import { h, clock, longDate, ago, on } from './util.js';
import { store, watch } from './store.js';
import { motionMode } from './theme.js';
import { isFull, toggleFull } from './fullscreen.js';
import { byId, iconHtml } from './registry.js';
import { go } from './router.js';
import { pushOverlay } from './overlays.js';
import * as notes from './notify.js';

export function createActionCenter({ os, statusbar, lockNow }) {
  const scrim = h('div', { class: 'ac__scrim' });
  const time = h('div', { class: 'ac__time' });
  const date = h('div', { class: 'ac__date' });
  const quick = h('div', { class: 'ac__quick' });
  const expandBtn = h('button', { class: 'ac__expand', type: 'button' });
  const listEl = h('div', { class: 'ac__list', 'aria-live': 'polite' });
  const handle = h('div', { class: 'ac__handle', 'aria-hidden': 'true' });
  const panel = h('div', { class: 'ac__panel', role: 'dialog', 'aria-label': 'Action center' },
    h('div', { class: 'ac__head' },
      h('div', {}, time, date),
      h('button', { class: 'ac__settings', type: 'button', onclick: () => { close(); go('#/app/settings'); } },
        h('i', { class: 'fa-solid fa-gear' }), 'all settings')),
    quick, expandBtn, listEl,
    h('div', { class: 'ac__foot' },
      h('button', { type: 'button', onclick: () => { notes.clearAll(); } }, 'clear all'),
      h('button', { type: 'button', onclick: () => close() }, 'close')),
    handle);
  const el = h('div', { class: 'ac', 'aria-hidden': 'true' }, scrim, panel);
  os.append(el);

  let isOpen = false;
  let expanded = false;
  let pop = null;

  const QUICK = [
    { icon: () => (store.get('theme') === 'dark' ? 'fa-solid fa-moon' : 'fa-solid fa-sun'), label: () => `${store.get('theme')} theme`, on: () => true, act: () => store.set('theme', store.get('theme') === 'dark' ? 'light' : 'dark') },
    { icon: () => notes.MODE_ICON[notes.mode()], label: () => notes.MODE_LABEL[notes.mode()], on: () => notes.mode() !== 'normal', act: () => notes.cycleMode() },
    { icon: () => (isFull() ? 'fa-solid fa-compress' : 'fa-solid fa-expand'), label: () => 'full screen', on: () => isFull(), act: () => { close(); toggleFull(); } },
    { icon: () => 'fa-solid fa-lock', label: () => 'lock now', on: () => false, act: () => { close(); lockNow(); } },
    { icon: () => 'fa-solid fa-circle-half-stroke', label: () => `brightness ${Math.round((store.get('brightness') ?? 1) * 100)}%`, on: () => (store.get('brightness') ?? 1) < 1, act: () => { const b = store.get('brightness') ?? 1; store.set('brightness', b > 0.9 ? 0.75 : b > 0.6 ? 0.5 : 1); } },
    { icon: () => 'fa-solid fa-person-running', label: () => (motionMode() === 'full' ? 'full motion' : 'less motion'), on: () => motionMode() === 'full', act: () => store.set('motion', motionMode() === 'full' ? 'reduced' : 'full') },
    { icon: () => 'fa-solid fa-table-cells', label: () => (store.get('moreTiles') ? 'more tiles' : 'fewer tiles'), on: () => store.get('moreTiles'), act: () => store.set('moreTiles', !store.get('moreTiles')) },
    { icon: () => 'fa-solid fa-link', label: () => 'copy this link', on: () => false, act: () => navigator.clipboard?.writeText(location.href).then(() => notes.toast('Link copied')) }
  ];

  function paintQuick() {
    const shown = expanded ? QUICK : QUICK.slice(0, 4);
    quick.replaceChildren(...shown.map((q) => h('button', {
      class: q.on() ? 'qa is-on' : 'qa', type: 'button', 'aria-pressed': String(!!q.on()),
      onclick: () => { q.act(); setTimeout(paintQuick, 30); }
    }, h('i', { class: q.icon() }), h('span', {}, q.label()))));
    expandBtn.textContent = expanded ? 'collapse' : 'expand';
  }
  expandBtn.addEventListener('click', () => { expanded = !expanded; paintQuick(); });

  function paintList() {
    const items = notes.list();
    if (!items.length) { listEl.replaceChildren(h('p', { class: 'ac__empty' }, 'No new notifications.')); return; }
    const groups = new Map();
    for (const n of items) {
      if (!groups.has(n.app)) groups.set(n.app, []);
      groups.get(n.app).push(n);
    }
    listEl.replaceChildren(...[...groups].map(([appId, list]) => {
      const app = byId(appId);
      return h('div', { class: 'ac__group' },
        h('div', { class: 'ac__group-title' }, h('span', { html: app ? iconHtml(app) : '', style: { width: '14px', display: 'inline-grid' } }), app?.name || 'Metro OS'),
        list.map((n) => noteEl(n)));
    }));
  }

  function noteEl(n) {
    const btn = h('button', { class: 'note', type: 'button' },
      h('b', {}, n.title), n.body ? h('span', {}, n.body) : null, h('time', {}, ago(n.at)));
    let sx = null, moved = 0;
    btn.addEventListener('pointerdown', (e) => { sx = e.clientX; moved = 0; });
    btn.addEventListener('pointermove', (e) => {
      if (sx == null) return;
      moved = e.clientX - sx;
      if (moved > 0) btn.style.transform = `translateX(${moved}px)`;
    });
    btn.addEventListener('pointerup', () => {
      if (sx == null) return;
      sx = null;
      if (moved > 80) { btn.classList.add('is-leaving'); setTimeout(() => notes.dismiss(n.id), 280); }
      else btn.style.transform = '';
    });
    btn.addEventListener('click', () => {
      if (Math.abs(moved) > 8) return;
      close();
      notes.open(n);
    });
    return btn;
  }

  function paintHead() {
    time.textContent = clock().full;
    date.textContent = longDate();
  }

  function open() {
    if (isOpen) return;
    isOpen = true;
    paintHead(); paintQuick(); paintList();
    el.classList.add('is-open');
    el.setAttribute('aria-hidden', 'false');
    panel.style.transform = '';
    pop = pushOverlay(close);
    notes.markAllSeen();
    panel.querySelector('button')?.focus({ preventScroll: true });
  }

  function close() {
    if (!isOpen) return;
    isOpen = false;
    el.classList.remove('is-open');
    el.setAttribute('aria-hidden', 'true');
    panel.style.transform = '';
    pop?.(); pop = null;
  }

  scrim.addEventListener('click', close);

  /* pull down from the status bar */
  let pull = null;
  statusbar.addEventListener('pointerdown', (e) => {
    pull = { y: e.clientY, id: e.pointerId, h: panel.offsetHeight || 400 };
    statusbar.setPointerCapture(e.pointerId);
  });
  statusbar.addEventListener('pointermove', (e) => {
    if (!pull || e.pointerId !== pull.id) return;
    const dy = e.clientY - pull.y;
    // On wide screens the panel slides in from the right; no drag preview there.
    if (dy > 6 && os.clientWidth < 700) {
      el.classList.add('is-open');
      panel.classList.add('is-dragging');
      panel.style.transform = `translateY(${Math.min(0, -pull.h + dy)}px)`;
    }
  });
  statusbar.addEventListener('pointerup', (e) => {
    if (!pull || e.pointerId !== pull.id) return;
    const dy = e.clientY - pull.y;
    pull = null;
    panel.classList.remove('is-dragging');
    if (dy < 6 || dy > 50) { el.classList.remove('is-open'); open(); }
    else { panel.style.transform = ''; el.classList.remove('is-open'); }
  });

  /* push it back up by the handle */
  let push = null;
  handle.addEventListener('pointerdown', (e) => { push = { y: e.clientY, id: e.pointerId }; handle.setPointerCapture(e.pointerId); panel.classList.add('is-dragging'); });
  handle.addEventListener('pointermove', (e) => {
    if (!push) return;
    panel.style.transform = `translateY(${Math.min(0, e.clientY - push.y)}px)`;
  });
  handle.addEventListener('pointerup', (e) => {
    if (!push) return;
    const dy = e.clientY - push.y;
    push = null;
    panel.classList.remove('is-dragging');
    if (dy < -40 || Math.abs(dy) < 4) close();
    else panel.style.transform = '';
  });

  on('notifications', () => { if (isOpen) paintList(); });
  watch('theme', () => isOpen && paintQuick());
  on('notify-mode', () => isOpen && paintQuick());
  document.addEventListener('fullscreenchange', () => isOpen && paintQuick());
  setInterval(() => isOpen && paintHead(), 15000);

  return { open, close, get isOpen() { return isOpen; } };
}
