/* Incoming calls. A website can't receive real calls, so these are the
   "try it" calls from Settings › notifications and the Phone menu, from
   the made-up contacts. They follow the phone mode:
     normal   ringtone + banner (full screen when locked) + ringing tile
     silent   the same without sound; missed calls say "while silent"
     quiet    straight to missed, unless it's a favourite or a repeat caller */

import { h, emit } from './util.js';
import { store } from './store.js';
import { play } from './sound.js';
import * as N from './notify.js';
import * as C from './contacts.js';
import { activity, elapsed } from './activity.js';

let host = null;
let lockApi = null;
let ringing = null;
let callEl = null;
let callTick = 0;
const lastRing = new Map();

export function initCalls(osEl, lock) { host = osEl; lockApi = lock; }
export const isRinging = () => !!ringing;

const viaLabel = (app) => (app === 'messaging' ? 'Messaging call' : 'Phone call');

export function incomingCall({ contactId, app = 'phone' } = {}) {
  if (ringing || activity.get('call')) return;
  const c = (contactId && C.contact(contactId)) || C.contacts().find((x) => x.phone);
  if (!c) return;
  const m = N.mode();
  const repeat = Date.now() - (lastRing.get(c.id) || 0) < 3 * 60e3;
  lastRing.set(c.id, Date.now());
  const breaksThrough = (c.favourite && N.setting('favourites', true)) || (repeat && N.setting('repeat', true));

  if (m === 'quiet' && !breaksThrough) {
    missed(c, app, { quiet: true });
    if (N.setting('autoReply', false)) reply(c, 'I’m in quiet hours. I’ll call you back.');
    return;
  }

  const silent = m === 'silent';
  const el = lockApi?.isLocked() ? fullScreen(c, app, silent) : banner(c, app, silent);
  host.append(el);
  activity.set('ringing', { app, name: c.name, silent });
  const ringTimer = silent
    ? (N.setting('vibrate', true) ? setInterval(() => navigator.vibrate?.([400, 200, 400]), 2400) : 0)
    : setInterval(() => play('ring', { force: true }), 2400);
  if (!silent) play('ring', { force: true });
  const timer = setTimeout(() => { stopRinging(); missed(c, app, { silent }); }, 20000);
  ringing = { c, app, el, timer, ringTimer };
}

function stopRinging() {
  if (!ringing) return;
  clearTimeout(ringing.timer);
  clearInterval(ringing.ringTimer);
  navigator.vibrate?.(0);
  ringing.el.remove();
  ringing = null;
  activity.clear('ringing');
}

function actions(c, app) {
  return h('div', { class: 'call__acts' },
    h('button', { class: 'call__btn call__btn--yes', type: 'button', onclick: () => answer(c, app) }, h('i', { class: 'fa-solid fa-phone' }), 'answer'),
    h('button', { class: 'call__btn call__btn--no', type: 'button', onclick: () => decline(c) }, h('i', { class: 'fa-solid fa-phone-slash' }), 'decline'),
    h('button', { class: 'call__btn', type: 'button', onclick: () => { stopRinging(); reply(c, 'Can’t talk right now. I’ll call you back.'); } }, h('i', { class: 'fa-solid fa-message' }), 'reply'));
}

function avatar(c, size) {
  return h('span', { class: 'call__av', style: { background: c.color, width: `${size}px`, height: `${size}px`, fontSize: `${size * 0.38}px` } }, C.initials(c.name));
}

function banner(c, app, silent) {
  const el = h('div', { class: 'callbar', role: 'alertdialog', 'aria-label': `Incoming call from ${c.name}` },
    h('div', { class: 'callbar__who' }, avatar(c, 40),
      h('div', {}, h('b', {}, c.name), h('span', {}, `${viaLabel(app)}${silent ? ' · silent' : ''}`))),
    actions(c, app));
  el.querySelector('.call__btn--yes').focus({ preventScroll: true });
  return el;
}

function fullScreen(c, app, silent) {
  return h('div', { class: 'callscreen', role: 'alertdialog', 'aria-label': `Incoming call from ${c.name}` },
    h('p', { class: 'callscreen__via' }, `${viaLabel(app)}${silent ? ' · silent' : ''}`),
    avatar(c, 110),
    h('h2', { class: 'callscreen__name' }, c.name),
    h('p', { class: 'callscreen__num' }, c.phone || ''),
    actions(c, app));
}

function answer(c, app) {
  stopRinging();
  C.logCall({ who: c.id, number: c.phone, kind: 'incoming' });
  activity.set('call', { app, name: c.name });
  showCall();
}

/** The in-call screen. Leaving it keeps the call going (chip in the status bar). */
export function showCall() {
  const a = activity.get('call');
  if (!a || callEl) return;
  const c = C.contacts().find((x) => x.name === a.name) || { name: a.name, color: '#1a68e0' };
  const time = h('p', { class: 'callscreen__num' }, elapsed(a.since));
  callEl = h('div', { class: 'callscreen', role: 'dialog', 'aria-label': `On a call with ${a.name}` },
    h('p', { class: 'callscreen__via' }, `${viaLabel(a.app)} · made-up call`),
    avatar(c, 110),
    h('h2', { class: 'callscreen__name' }, a.name),
    time,
    h('div', { class: 'call__acts' },
      h('button', { class: 'call__btn', type: 'button', onclick: hideCall }, h('i', { class: 'fa-solid fa-arrow-down' }), 'back to Metro OS'),
      h('button', { class: 'call__btn call__btn--no', type: 'button', onclick: endCall }, h('i', { class: 'fa-solid fa-phone-slash' }), 'end call')));
  host.append(callEl);
  clearInterval(callTick);
  callTick = setInterval(() => { time.textContent = elapsed(a.since); }, 1000);
}
export function hideCall() { clearInterval(callTick); callEl?.remove(); callEl = null; }
export function endCall() { hideCall(); activity.clear('call'); }

function decline(c) {
  stopRinging();
  C.logCall({ who: c.id, number: c.phone, kind: 'declined' });
}

function missed(c, app, { silent = false, quiet = false } = {}) {
  C.logCall({ who: c.id, number: c.phone, kind: 'missed', silent, quiet });
  N.notify({
    app, level: 'count', kind: 'call',
    title: 'Missed call',
    body: `${c.name}${silent ? ' · while silent' : quiet ? ' · during quiet hours' : ''}`,
    route: app === 'messaging' ? `#/app/messaging/thread/${c.id}` : '#/app/phone/history'
  });
}

function reply(c, text) {
  const threads = store.get('threads') || {};
  threads[c.id] = [...(threads[c.id] || []), { id: `m${Date.now()}`, me: true, text, at: Date.now() }];
  store.set('threads', threads);
  emit('threads');
  N.toast(`Sent to ${c.name}: “${text}”`);
}
