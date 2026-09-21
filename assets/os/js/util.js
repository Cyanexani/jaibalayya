/* Small DOM + timing helpers shared by the whole shell. */

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/** Build an element: h('div', { class: 'x', onclick: fn }, child, 'text', [more]) */
export function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'vars') for (const [n, val] of Object.entries(v)) el.style.setProperty(n, val);
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  append(el, kids);
  return el;
}

export function append(el, kids) {
  for (const kid of [kids].flat(Infinity)) {
    if (kid == null || kid === false) continue;
    el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
  return el;
}

/** Like el.replaceChildren(), but skips null/false instead of printing "null". */
export function fill(el, ...kids) {
  el.replaceChildren();
  return append(el, kids);
}

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const pad2 = (n) => String(n).padStart(2, '0');
export const slug = (s) => String(s).toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/* ---------- events ---------- */
export const bus = new EventTarget();
export const emit = (name, detail) => bus.dispatchEvent(new CustomEvent(name, { detail }));
export function on(name, fn) {
  const handler = (e) => fn(e.detail);
  bus.addEventListener(name, handler);
  return () => bus.removeEventListener(name, handler);
}

/* ---------- motion ---------- */
/** The resolved motion setting (theme.js turns "follow my device" into full/reduced). */
export function reducedMotion() {
  return document.documentElement.dataset.motion === 'reduced';
}

/** Web Animations wrapper that respects reduced motion and never rejects. */
export function animate(el, frames, opts) {
  if (!el || !el.animate) return Promise.resolve();
  const o = typeof opts === 'number' ? { duration: opts } : { ...opts };
  if (reducedMotion()) { o.duration = 1; o.delay = 0; }
  const a = el.animate(frames, o);
  return a.finished.then(() => a, () => a);
}

/* ---------- time ---------- */
export function clock(d = new Date()) {
  const parts = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).formatToParts(d);
  const time = parts.filter((p) => p.type !== 'dayPeriod').map((p) => p.value).join('').trim();
  const period = parts.find((p) => p.type === 'dayPeriod')?.value || '';
  return { time, period, full: period ? `${time} ${period}` : time };
}
export const weekday = (d = new Date()) => d.toLocaleDateString(undefined, { weekday: 'long' });
export const longDate = (d = new Date()) => d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
export function ago(ts) {
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return new Date(ts).toLocaleDateString();
}

/* ---------- press feedback: the Metro tilt ---------- */
export function tilt(el, e, strength = 9) {
  const r = el.getBoundingClientRect();
  const x = (e.clientX - r.left) / r.width - 0.5;
  const y = (e.clientY - r.top) / r.height - 0.5;
  const edge = Math.max(Math.abs(x), Math.abs(y));
  el.classList.add('is-tilting');
  el.style.transform = edge < 0.18
    ? 'scale(.96)'
    : `perspective(600px) rotateX(${(-y * strength).toFixed(2)}deg) rotateY(${(x * strength).toFixed(2)}deg) scale(.985)`;
}
export function untilt(el) {
  if (!el) return;
  el.classList.remove('is-tilting');
  el.style.transform = '';
}

/** Long-press helper: calls onHold after `ms` unless the pointer moves or lifts. */
export function holdable(el, { ms = 450, move = 8, onHold, onTap, filter } = {}) {
  let timer = 0, start = null, held = false, target = null;
  const clear = () => { clearTimeout(timer); timer = 0; };
  el.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    target = filter ? filter(e) : el;
    if (!target) return;
    start = { x: e.clientX, y: e.clientY };
    held = false;
    clear();
    timer = setTimeout(() => { held = true; timer = 0; onHold?.(target, e); }, ms);
  });
  el.addEventListener('pointermove', (e) => {
    if (!start || !timer) return;
    if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > move) { clear(); start = null; }
  });
  const end = (e) => {
    const wasTap = timer && start;
    clear();
    if (wasTap && e.type === 'pointerup' && !held) onTap?.(target, e);
    start = null;
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
  el.addEventListener('contextmenu', (e) => {
    const t = filter ? filter(e) : el;
    if (!t) return;
    e.preventDefault();
    if (!held) { clear(); start = null; onHold?.(t, e); }
    held = false;
  });
}

export function copyText(text) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text).then(() => true, () => false);
  return Promise.resolve(false);
}

/** Absolute URL of this site for a route, used for share links. */
export function linkFor(hash) {
  return location.href.split('#')[0] + hash;
}
