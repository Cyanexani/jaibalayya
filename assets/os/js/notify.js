/* Notifications. Every notification has a level:
     count   something waiting for you     tile flips, then keeps a count
     flip    something to know now         tile flips, no count
     quiet   for your information          no banner; a marker on the tile
   (Live activity, like a running timer, isn't a notification: see live.js.)
   The phone mode decides how loud they are:
     normal  banner + sound               silent  banner, no sound
     quiet   nothing moves (quiet hours); a summary when quiet hours end */

import { h, emit, on, animate } from './util.js';
import { store } from './store.js';
import { byId, iconHtml } from './registry.js';
import { play } from './sound.js';
import { go } from './router.js';

let host = null;
let current = null;
const queue = [];

export function initNotify(osEl) {
  host = osEl;
  let wasQuiet = mode() === 'quiet';
  setInterval(() => {
    const q = mode() === 'quiet';
    if (wasQuiet && !q) summarise();
    if (wasQuiet !== q) emit('notify-mode', mode());
    wasQuiet = q;
  }, 30000);
}

/* ---------------- modes ---------------- */

export const MODE_LABEL = { normal: 'normal', silent: 'silent', quiet: 'quiet hours' };
export const MODE_ICON = { normal: 'fa-solid fa-bell', silent: 'fa-solid fa-bell-slash', quiet: 'fa-solid fa-moon' };

export function inQuietHours(now = new Date()) {
  const q = store.get('notify.schedule');
  if (!q?.on) return false;
  const mins = (t) => { const [a, b] = t.split(':').map(Number); return a * 60 + b; };
  const m = now.getHours() * 60 + now.getMinutes();
  const from = mins(q.from || '22:00'), to = mins(q.to || '07:00');
  return from <= to ? m >= from && m < to : m >= from || m < to;
}

/** The mode in effect: what you picked, or quiet hours if the schedule says so. */
export function mode() {
  const m = store.get('notify.mode') || 'normal';
  return m !== 'quiet' && inQuietHours() ? 'quiet' : m;
}
export function setMode(m) {
  const wasQuiet = mode() === 'quiet';
  store.set('notify.mode', m);
  if (wasQuiet && mode() !== 'quiet') summarise();
  emit('notify-mode', mode());
}
export function cycleMode() {
  const order = ['normal', 'silent', 'quiet'];
  setMode(order[(order.indexOf(store.get('notify.mode') || 'normal') + 1) % order.length]);
}

export const setting = (key, fallback) => { const v = store.get(`notify.${key}`); return v === undefined ? fallback : v; };
export const appAllowed = (app) => (store.get('notify.apps') || {})[app] !== false;

/* ---------------- the list ---------------- */

export const list = () => store.get('notifications') || [];
export const unread = () => list().filter((n) => !n.read).length;
/** Not yet looked at in the action center (drives the status bar dot). */
export const unseen = () => list().filter((n) => !n.read && !n.seen).length;

function save(items) {
  store.set('notifications', items.slice(0, 60));
  emit('notifications');
}

/** Unread "count" notifications for an app (what the tile's number shows). */
export const countFor = (app) => list().filter((n) => n.app === app && !n.read && n.level === 'count' && n.kind !== 'call').length;
/** Unread missed calls for an app (shown as ↙n next to the count). */
export const missedFor = (app) => list().filter((n) => n.app === app && !n.read && n.kind === 'call').length;
/** A tile shows a small marker for unread quiet things (and flips that arrived during quiet hours). */
export const markerFor = (app) => list().some((n) => n.app === app && !n.read && (n.level === 'quiet' || (n.level === 'flip' && n.duringQuiet)));
/** The newest unread item for an app, for the tile's flip face. */
export const latestFor = (app) => list().find((n) => n.app === app && !n.read && n.level !== 'quiet') || null;

export function notify({ app = 'hub', title, body = '', route = '', level, quiet = false, key = null, kind = null }) {
  const lvl = level || (quiet ? 'quiet' : 'count');
  if (!appAllowed(app)) return null;
  const m = mode();
  const n = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    app, title, body, route, level: lvl, key, kind, at: Date.now(), read: false, duringQuiet: m === 'quiet'
  };
  save([n, ...list().filter((x) => !(key && x.key === key))]);
  emit('tile-news', n);
  if (lvl !== 'quiet' && m !== 'quiet') {
    banner(n);
    if (m === 'normal') play('notify');
    else if (setting('vibrate', true)) navigator.vibrate?.(120);
  }
  return n;
}

export function dismiss(id) { save(list().filter((n) => n.id !== id)); }
export function clearAll() { save([]); }
export function markAllRead() { if (unread()) save(list().map((n) => ({ ...n, read: true }))); }
/** Looking at the action center clears the status bar dot; tile counts stay until you open the app. */
export function markAllSeen() { if (unseen()) save(list().map((n) => ({ ...n, seen: true }))); }
export function markAppRead(app) {
  if (!list().some((n) => n.app === app && !n.read)) return;
  save(list().map((n) => (n.app === app ? { ...n, read: true } : n)));
  emit('tile-read', app);
}

export function open(n) {
  save(list().map((x) => (x.id === n.id ? { ...x, read: true } : x)));
  if (n.route === 'action-center') emit('open-action-center');
  else if (n.route) go(n.route);
}

/** When quiet hours end: one notification that sums up what came in. */
function summarise() {
  const held = list().filter((n) => n.duringQuiet && !n.read && n.level !== 'quiet');
  if (!held.length) return;
  const byApp = new Map();
  for (const n of held) byApp.set(n.app, (byApp.get(n.app) || 0) + 1);
  const parts = [...byApp].map(([app, c]) => `${c} from ${byId(app)?.name || app}`);
  notify({ app: 'settings', level: 'flip', title: 'While you were in quiet hours', body: parts.join(', '), route: 'action-center', key: 'quiet-summary' });
}

/* ---------------- banners ---------------- */

function banner(n) {
  if (!host) return;
  if (current) { queue.push(n); return; }
  const app = byId(n.app);
  const previews = setting('previews', 'show') === 'show';
  const el = h('div', { class: 'toast', role: 'status' },
    h('span', { html: app ? iconHtml(app) : '', style: { width: '18px', display: 'inline-grid', placeItems: 'center' } }),
    h('span', {}, h('b', {}, n.title), n.body && previews ? ` ${n.body}` : ''));
  current = el;
  let startY = null;
  el.addEventListener('pointerdown', (e) => { startY = e.clientY; el.setPointerCapture(e.pointerId); });
  el.addEventListener('pointerup', (e) => {
    if (startY == null) return;
    const dy = e.clientY - startY;
    startY = null;
    leave();
    if (dy > -12) open(n);
  });
  host.append(el);
  const timer = setTimeout(leave, 4800);
  function leave() {
    clearTimeout(timer);
    if (!el.isConnected) return;
    el.classList.add('is-leaving');
    setTimeout(() => {
      el.remove();
      if (current === el) current = null;
      const next = queue.shift();
      if (next) banner(next);
    }, 260);
  }
}

/** A plain one-line message (e.g. "link copied"). Not a notification. */
export function toast(text) {
  if (!host) return;
  const el = h('div', { class: 'toast toast--plain', role: 'status' }, text);
  host.append(el);
  setTimeout(() => { el.classList.add('is-leaving'); setTimeout(() => el.remove(), 260); }, 2200);
  animate(el, [{ opacity: 0 }, { opacity: 1 }], 120);
}

on('store', ({ path }) => { if (path.startsWith('notify.schedule')) emit('notify-mode', mode()); });
