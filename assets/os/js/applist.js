/* The app list: every app, alphabetical, with letter headers. Tap a letter
   for the jump grid; hold an app for pin / info / what's new / copy link. */

import { h, $$, tilt, untilt, copyText, linkFor } from './util.js';
import { sortedApps, iconHtml, byId } from './registry.js';
import { go } from './router.js';
import { pushOverlay } from './overlays.js';
import { contextMenu } from './contextmenu.js';
import { toast } from './notify.js';

const LETTERS = '#abcdefghijklmnopqrstuvwxyz'.split('');
const letterOf = (name) => {
  const c = name[0].toLowerCase();
  return c >= 'a' && c <= 'z' ? c : '#';
};

export function createAppList({ screen, start, recedeEl }) {
  const input = h('input', { type: 'search', placeholder: 'search apps', 'aria-label': 'Search apps', enterkeyhint: 'search' });
  const list = h('div', { role: 'list' });
  const el = h('div', { class: 'applist' },
    h('div', { class: 'applist__search' }, input, h('i', { class: 'fa-solid fa-magnifying-glass', 'aria-hidden': 'true' })),
    list);
  let lastTapped = null;
  let suppressClick = false;

  function render(filter = '') {
    const q = filter.trim().toLowerCase();
    const apps = sortedApps().filter((a) => !q || a.name.toLowerCase().includes(q));
    const out = [];
    let letter = null;
    for (const app of apps) {
      const l = letterOf(app.name);
      if (!q && l !== letter) {
        letter = l;
        out.push(h('button', { class: 'applist__letter', type: 'button', 'data-letter': l, 'aria-label': `Jump to a letter (current: ${l})` }, l));
      }
      out.push(h('button', {
        class: 'applist__item', type: 'button', role: 'listitem', 'data-id': app.id,
        vars: { '--app-color': app.color }
      },
      h('span', { class: 'applist__icon', html: iconHtml(app) }),
      h('span', { class: 'applist__name' }, app.name, app.built ? null : h('small', {}, `notes · phase ${app.phase}`))));
    }
    if (!out.length) out.push(h('p', { class: 'applist__empty' }, `No apps match “${filter}”.`));
    list.replaceChildren(...out);
  }

  input.addEventListener('input', () => render(input.value));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') list.querySelector('.applist__item')?.click();
    if (e.key === 'Escape' && input.value) { e.stopPropagation(); input.value = ''; render(); }
  });

  /* ---------- tap, hold ---------- */
  let hold = null;
  list.addEventListener('pointerdown', (e) => {
    const item = e.target.closest('.applist__item, .applist__letter');
    if (!item || e.button !== 0) return;
    tilt(item, e, 6);
    hold = { item, x: e.clientX, y: e.clientY, timer: 0 };
    if (item.classList.contains('applist__item')) {
      hold.timer = setTimeout(() => {
        untilt(item);
        suppressClick = true;
        openMenu(item);
        hold = null;
      }, 450);
    }
  });
  const endHold = () => { if (hold) { clearTimeout(hold.timer); untilt(hold.item); hold = null; } };
  list.addEventListener('pointermove', (e) => {
    if (hold && Math.hypot(e.clientX - hold.x, e.clientY - hold.y) > 8) endHold();
  });
  list.addEventListener('pointerup', endHold);
  list.addEventListener('pointercancel', endHold);
  list.addEventListener('contextmenu', (e) => {
    const item = e.target.closest('.applist__item');
    if (!item) return;
    e.preventDefault();
    endHold();
    openMenu(item);
  });
  list.addEventListener('click', (e) => {
    if (suppressClick) { suppressClick = false; return; }
    const letter = e.target.closest('.applist__letter');
    if (letter) return openJumpList();
    const item = e.target.closest('.applist__item');
    if (!item) return;
    lastTapped = item;
    go(`#/app/${item.dataset.id}`);
  });

  function openMenu(item) {
    const id = item.dataset.id;
    const app = byId(id);
    const pinned = start.isPinned(id);
    contextMenu({
      screen, anchor: item, recede: recedeEl,
      items: [
        pinned
          ? { label: 'unpin from start', action: () => start.unpin(id) }
          : { label: 'pin to start', action: () => { start.pin(id); go('#/'); setTimeout(() => start.scrollToTile(id), 420); } },
        { label: 'app info', action: () => go(`#/info/${id}`) },
        { label: "what's new", action: () => go(`#/info/${id}/whats-new`) },
        { label: 'copy link', action: () => copyText(linkFor(`#/info/${id}`)).then((ok) => toast(ok ? `Link to ${app.name} copied` : 'Couldn’t copy the link')) }
      ]
    });
  }

  /* ---------- jump list ---------- */
  function openJumpList() {
    const present = new Set(sortedApps().map((a) => letterOf(a.name)));
    const grid = h('div', { class: 'jumplist', role: 'dialog', 'aria-label': 'Jump to a letter' },
      LETTERS.map((l, i) => h('button', {
        type: 'button', class: present.has(l) ? 'has' : '', disabled: !present.has(l),
        style: { animationDelay: `${Math.floor(i / 4) * 28 + (i % 4) * 12}ms` },
        onclick: () => { close(); jumpTo(l); }
      }, l)));
    screen.append(grid);
    const pop = pushOverlay(close);
    grid.querySelector('.has')?.focus({ preventScroll: true });
    function close() { pop(); grid.remove(); }
  }

  function jumpTo(l) {
    const head = list.querySelector(`[data-letter="${l}"]`);
    if (head) el.scrollTo({ top: head.offsetTop - 8 });
  }

  render();

  return {
    el,
    get lastTapped() { const t = lastTapped; lastTapped = null; return t; },
    items: () => $$('.applist__item, .applist__letter', list),
    cancelPress: endHold,
    focusSearch() { input.focus(); },
    reset() { if (input.value) { input.value = ''; render(); } }
  };
}
