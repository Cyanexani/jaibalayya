/* Alarms, the timer, the stopwatch and calendar reminders. Runs whenever
   Metro OS is open, whatever app is showing. Browsers can't wake a closed
   tab, so an alarm that passed while Metro OS was closed is reported as
   missed instead of ringing late. */

import { h, emit, on, clock } from './util.js';
import { store } from './store.js';
import { play } from './sound.js';
import { notify } from './notify.js';

const MISSED_AFTER = 10 * 60 * 1000;
let host = null;
let ringing = null;

/* ---------------- alarms ---------------- */
// { id, time: 'HH:MM', days: [0-6] (empty = once), label, on, nextAt }

export const alarms = () => store.get('alarms') || [];

export function nextOccurrence(a, from = Date.now()) {
  const [hh, mm] = a.time.split(':').map(Number);
  const d = new Date(from);
  d.setSeconds(0, 0);
  d.setHours(hh, mm);
  for (let i = 0; i < 8; i++) {
    const t = new Date(d);
    t.setDate(d.getDate() + i);
    if (t.getTime() <= from) continue;
    if (!a.days?.length || a.days.includes(t.getDay())) return t.getTime();
  }
  return null;
}

export function saveAlarm(a) {
  const list = alarms().filter((x) => x.id !== a.id);
  const rec = { ...a, id: a.id || `a${Date.now().toString(36)}` };
  rec.nextAt = rec.on ? nextOccurrence(rec) : null;
  list.push(rec);
  list.sort((x, y) => x.time.localeCompare(y.time));
  store.set('alarms', list);
  emit('clock');
  return rec;
}
export function deleteAlarm(id) { store.set('alarms', alarms().filter((a) => a.id !== id)); emit('clock'); }
export function nextAlarm() {
  return alarms().filter((a) => a.on && a.nextAt).sort((a, b) => a.nextAt - b.nextAt)[0] || null;
}

/* ---------------- timer ---------------- */
// { duration (ms), endAt | null, remaining (ms, when paused), label }

export const timer = () => store.get('timer') || { duration: 5 * 60000, endAt: null, remaining: 5 * 60000 };
export function timerLeft(t = timer()) { return t.endAt ? Math.max(0, t.endAt - Date.now()) : t.remaining; }
export function startTimer(ms) {
  const t = timer();
  const duration = ms ?? t.duration;
  const remaining = ms != null ? ms : (t.remaining || duration);
  store.set('timer', { duration, endAt: Date.now() + remaining, remaining });
  emit('clock');
}
export function pauseTimer() { const t = timer(); store.set('timer', { ...t, remaining: timerLeft(t), endAt: null }); emit('clock'); }
export function resetTimer(ms) { const t = timer(); const d = ms ?? t.duration; store.set('timer', { duration: d, endAt: null, remaining: d }); emit('clock'); }

/* ---------------- stopwatch ---------------- */
// { running, startAt, base (ms before the current run), laps: [ms] }

export const stopwatch = () => store.get('stopwatch') || { running: false, startAt: 0, base: 0, laps: [] };
export function swElapsed(s = stopwatch()) { return s.base + (s.running ? Date.now() - s.startAt : 0); }
export function swToggle() {
  const s = stopwatch();
  store.set('stopwatch', s.running ? { ...s, running: false, base: swElapsed(s) } : { ...s, running: true, startAt: Date.now() });
  emit('clock');
}
export function swLap() { const s = stopwatch(); if (s.running) { store.set('stopwatch', { ...s, laps: [swElapsed(s), ...s.laps] }); emit('clock'); } }
export function swReset() { store.set('stopwatch', { running: false, startAt: 0, base: 0, laps: [] }); emit('clock'); }

export function fmtDuration(ms, { hundredths = false } = {}) {
  const total = Math.max(0, ms);
  const hh = Math.floor(total / 3600000);
  const mm = Math.floor((total % 3600000) / 60000);
  const ss = Math.floor((total % 60000) / 1000);
  const cs = Math.floor((total % 1000) / 10);
  const p = (n) => String(n).padStart(2, '0');
  const base = hh ? `${hh}:${p(mm)}:${p(ss)}` : `${p(mm)}:${p(ss)}`;
  return hundredths ? `${base}.${p(cs)}` : base;
}

/* ---------------- ringing ---------------- */

function ring({ title, sub, onSnooze }) {
  if (!host) return;
  stopRinging();
  const beep = setInterval(() => play('alarm', { force: true }), 1100);
  play('alarm', { force: true });
  navigator.vibrate?.([400, 200, 400, 200, 400]);
  const el = h('div', { class: 'ringing', role: 'alertdialog', 'aria-label': title },
    h('div', { class: 'ringing__time' }, clock().time),
    h('div', { class: 'ringing__title' }, title),
    sub ? h('div', { class: 'ringing__sub' }, sub) : null,
    h('div', { class: 'ringing__actions' },
      onSnooze ? h('button', { class: 'btn', type: 'button', onclick: () => { stopRinging(); onSnooze(); } }, 'snooze 9 min') : null,
      h('button', { class: 'btn btn--light', type: 'button', onclick: stopRinging }, 'dismiss')));
  host.append(el);
  el.querySelector('button:last-child')?.focus();
  ringing = { el, beep };
}

export function stopRinging() {
  if (!ringing) return;
  clearInterval(ringing.beep);
  ringing.el.remove();
  ringing = null;
}

/* ---------------- the tick ---------------- */

function tick() {
  const now = Date.now();

  // alarms
  let changed = false;
  const list = alarms().map((a) => {
    if (!a.on || !a.nextAt || now < a.nextAt) return a;
    changed = true;
    const late = now - a.nextAt > MISSED_AFTER;
    if (late) {
      notify({ app: 'clock', title: 'Missed alarm', body: `${a.time}${a.label ? ` · ${a.label}` : ''} passed while Metro OS was closed.`, route: '#/app/clock/alarms', quiet: true });
    } else {
      ring({
        title: a.label || 'Alarm', sub: a.time,
        onSnooze: () => { store.set('snooze', now + 9 * 60000); }
      });
      notify({ app: 'clock', title: a.label || 'Alarm', body: a.time, route: '#/app/clock/alarms', quiet: true });
    }
    const repeat = a.days?.length > 0;
    return { ...a, on: repeat, nextAt: repeat ? nextOccurrence(a, now) : null };
  });
  if (changed) { store.set('alarms', list); emit('clock'); }

  // snooze
  const snooze = store.get('snooze');
  if (snooze && now >= snooze) {
    store.set('snooze', null);
    ring({ title: 'Snoozed alarm', sub: clock().time, onSnooze: () => store.set('snooze', Date.now() + 9 * 60000) });
  }

  // timer
  const t = timer();
  if (t.endAt && now >= t.endAt) {
    store.set('timer', { ...t, endAt: null, remaining: t.duration });
    const late = now - t.endAt > MISSED_AFTER;
    if (!late) ring({ title: 'Time’s up', sub: `${fmtDuration(t.duration)} timer` });
    notify({ app: 'clock', title: 'Timer finished', body: `${fmtDuration(t.duration)} timer`, route: '#/app/clock/timer', level: late ? 'flip' : 'quiet' });
    emit('clock');
  }

  // calendar: a heads-up 10 minutes before each timed event, and again when it starts
  const events = store.get('events') || [];
  const fired = store.get('remindersFired') || {};
  let firedChanged = false;
  for (const ev of events) {
    if (ev.allDay || !ev.start) continue;
    const at = new Date(`${ev.date}T${ev.start}`).getTime();
    const where = ev.location ? ` · ${ev.location}` : '';
    if (now >= at - 10 * 60000 && now < at && !fired[`pre${ev.id}${at}`]) {
      fired[`pre${ev.id}${at}`] = 1;
      firedChanged = true;
      notify({ app: 'calendar', level: 'flip', key: `event-${ev.id}`, title: ev.title || 'Event', body: `in ${Math.max(1, Math.round((at - now) / 60000))} min${where}`, route: `#/app/calendar/event/${ev.id}` });
    }
    if (now >= at && now - at < MISSED_AFTER && !fired[ev.id + at]) {
      fired[ev.id + at] = 1;
      firedChanged = true;
      notify({ app: 'calendar', level: 'flip', key: `event-${ev.id}`, title: ev.title || 'Event', body: `now · ${ev.start}${where}`, route: `#/app/calendar/event/${ev.id}` });
    }
  }
  if (firedChanged) store.set('remindersFired', fired);
}

export function initClockService(osEl) {
  host = osEl;
  // Recompute alarm times in case they were saved on another day.
  const list = alarms().map((a) => (a.on && (!a.nextAt || a.nextAt < Date.now() - MISSED_AFTER) ? { ...a, nextAt: nextOccurrence(a) } : a));
  store.set('alarms', list);
  setInterval(tick, 1000);
  tick();
  on('clock', () => {});
}
