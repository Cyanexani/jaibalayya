/* Notifications: the toast banner that drops from the top, and the list
   the action center shows. Stored so they survive a reload. */

import { h, emit, animate } from './util.js';
import { store } from './store.js';
import { byId, iconHtml } from './registry.js';
import { play } from './sound.js';
import { go } from './router.js';

let host = null;
let current = null;

export function initNotify(osEl) { host = osEl; }

export const list = () => store.get('notifications') || [];
export const unread = () => list().filter((n) => !n.read).length;

function save(items) {
  store.set('notifications', items.slice(0, 40));
  emit('notifications');
}

export function notify({ app = 'hub', title, body = '', route = '', quiet = false }) {
  const n = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, app, title, body, route, at: Date.now(), read: false };
  save([n, ...list()]);
  if (!quiet) {
    banner(n);
    play('notify');
  }
  return n;
}

export function dismiss(id) { save(list().filter((n) => n.id !== id)); }
export function clearAll() { save([]); }
export function markAllRead() {
  if (!unread()) return;
  save(list().map((n) => ({ ...n, read: true })));
}

export function open(n) {
  save(list().map((x) => (x.id === n.id ? { ...x, read: true } : x)));
  if (n.route) go(n.route);
}

function banner(n) {
  if (!host) return;
  current?.remove();
  const app = byId(n.app);
  const el = h('div', { class: 'toast', role: 'status' },
    h('span', { html: app ? iconHtml(app) : '', style: { width: '18px', display: 'inline-grid', placeItems: 'center' } }),
    h('span', {}, h('b', {}, n.title), n.body ? ` ${n.body}` : ''));
  current = el;
  let startY = null;
  el.addEventListener('pointerdown', (e) => { startY = e.clientY; el.setPointerCapture(e.pointerId); });
  el.addEventListener('pointerup', (e) => {
    // Only a press that started on the banner counts; a stray release must not open it.
    if (startY == null) return;
    const dy = e.clientY - startY;
    startY = null;
    if (dy < -12) return leave();
    leave();
    open(n);
  });
  host.append(el);
  const timer = setTimeout(leave, 5200);
  function leave() {
    clearTimeout(timer);
    if (!el.isConnected) return;
    el.classList.add('is-leaving');
    setTimeout(() => el.remove(), 260);
    if (current === el) current = null;
  }
}

/** A quiet one-line message (e.g. "link copied"). */
export function toast(text) {
  if (!host) return;
  const el = h('div', { class: 'toast toast--plain', role: 'status' }, text);
  host.append(el);
  setTimeout(() => { el.classList.add('is-leaving'); setTimeout(() => el.remove(), 260); }, 2200);
  animate(el, [{ opacity: 0 }, { opacity: 1 }], 120);
}
