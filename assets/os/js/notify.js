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

/* ---------------- banners ----------------
   One banner at a time. More from the same app update it in place
   ("+2"); other apps wait in line, and the current banner hurries up so
   the line keeps moving. Drag it up to dismiss, tap to open. */

function banner(n) {
  if (!host) return;
  if (current && current.n.app === n.app) { current.update(n); return; }
  if (current) {
    const same = queue.find((q) => q.app === n.app);
    if (same) Object.assign(same, { ...n, more: (same.more || 0) + 1 });
    else queue.push({ ...n, more: 0 });
    current.hurry();
    return;
  }
  show(n);
}

function show(n) {
  const app = byId(n.app);
  const previews = setting('tilePreviews', 'show') === 'show';
  const title = h('b', { class: 'banner__title' });
  const body = h('span', { class: 'banner__body' });
  const more = h('span', { class: 'banner__more' });
  const bar = h('i', { class: 'banner__timer', 'aria-hidden': 'true' });
  const el = h('div', { class: 'banner', role: 'status', vars: { '--app-color': app?.color || 'var(--accent)' } },
    h('span', { class: 'banner__icon', html: app ? iconHtml(app) : '' }),
    h('span', { class: 'banner__text' }, title, body),
    more, bar);
  let latest = n;
  let extra = n.more || 0;
  let dwell = queue.length ? 2600 : 4600;
  let timer = 0;
  const paint = () => {
    title.textContent = latest.title;
    body.textContent = previews && latest.body ? latest.body : '';
    more.textContent = extra ? `+${extra}` : '';
  };
  const arm = (ms = dwell) => {
    clearTimeout(timer);
    timer = setTimeout(leave, ms);
    el.style.setProperty('--dwell', `${ms}ms`);
    bar.style.animation = 'none';
    void bar.offsetWidth;
    bar.style.animation = '';
  };
  paint();
  host.append(el);
  arm();

  // drag up to dismiss; a tap (no drag) opens it
  let sy = null, dy = 0;
  el.addEventListener('pointerdown', (e) => {
    sy = e.clientY; dy = 0;
    el.setPointerCapture(e.pointerId);
    el.classList.add('is-dragging');
    clearTimeout(timer);
  });
  el.addEventListener('pointermove', (e) => {
    if (sy == null) return;
    dy = e.clientY - sy;
    el.style.transform = `translateY(${dy < 0 ? dy : dy * 0.2}px)`;
  });
  const release = () => {
    if (sy == null) return;
    sy = null;
    el.classList.remove('is-dragging');
    if (dy < -24) return leave();
    el.style.transform = '';
    if (Math.abs(dy) < 6) { leave(); open(latest); } else arm(2000);
  };
  el.addEventListener('pointerup', release);
  el.addEventListener('pointercancel', () => { dy = 0; release(); });

  current = {
    n,
    update(next) {
      latest = next;
      extra++;
      paint();
      el.classList.remove('is-bump'); void el.offsetWidth; el.classList.add('is-bump');
      arm();
    },
    hurry() {
      if (dwell <= 2000) return;
      dwell = 2000;
      arm(1400);
    }
  };

  let gone = false;
  function leave() {
    if (gone) return;
    gone = true;
    clearTimeout(timer);
    el.classList.add('is-leaving');
    setTimeout(() => {
      el.remove();
      if (current?.n === n) current = null;
      const next = queue.shift();
      if (next) show(next);
    }, 230);
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
