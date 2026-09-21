/* Calendar: a month view with an agenda for the chosen day. Events stay
   in this browser; timed events send a reminder when they start. */

import { h, emit } from '../util.js';
import { store } from '../store.js';
import { header, appbar, textbox, toggle, pageRouter, screenOf, dialog } from '../controls.js';

export const events = () => store.get('events') || [];
const save = (list) => { store.set('events', list); emit('events'); };
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const todayIso = () => iso(new Date());
const sortEvents = (list) => [...list].sort((a, b) => (a.date + (a.allDay ? '00:00' : a.start || '99')).localeCompare(b.date + (b.allDay ? '00:00' : b.start || '99')));
export const eventsOn = (date) => sortEvents(events().filter((e) => e.date === date));

/** The next event from now (for the tile and the Bloom). */
export function nextEvent() {
  const now = new Date();
  const nowKey = `${iso(now)}T${now.toTimeString().slice(0, 5)}`;
  return sortEvents(events()).find((e) => `${e.date}T${e.allDay ? '23:59' : e.end || e.start || '23:59'}` >= nowKey) || null;
}

export default function mount(ctx) {
  const { el, go } = ctx;
  let selected = todayIso();
  let month = new Date();
  month.setDate(1);

  function monthPage() {
    const title = month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    const first = new Date(month);
    const startDow = (first.getDay() + 6) % 7; // weeks start on Monday
    const grid = h('div', { class: 'cal-grid' });
    for (const d of ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']) grid.append(h('span', { class: 'dow' }, d));
    const start = new Date(first);
    start.setDate(1 - startDow);
    const withEvents = new Set(events().map((e) => e.date));
    for (let i = 0; i < 42; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const key = iso(d);
      const cls = ['cal-day', d.getMonth() !== month.getMonth() ? 'is-other' : '', key === todayIso() ? 'is-today' : '', key === selected ? 'is-selected' : ''].filter(Boolean).join(' ');
      grid.append(h('button', {
        type: 'button', class: cls, 'aria-label': d.toDateString(), 'aria-pressed': String(key === selected),
        onclick: () => { selected = key; if (d.getMonth() !== month.getMonth()) { month = new Date(d.getFullYear(), d.getMonth(), 1); } redraw(); }
      }, String(d.getDate()), withEvents.has(key) ? h('i', { 'aria-hidden': 'true' }) : null));
    }
    const dayEvents = eventsOn(selected);
    const label = new Date(`${selected}T12:00`).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
    const page = h('div', { class: 'page has-appbar' },
      h('p', { class: 'app-title' }, 'Calendar'),
      h('div', { class: 'cal-head' },
        h('button', { type: 'button', 'aria-label': 'Previous month', onclick: () => { month = new Date(month.getFullYear(), month.getMonth() - 1, 1); redraw(); } }, h('i', { class: 'fa-solid fa-chevron-left' })),
        h('h1', {}, title),
        h('button', { type: 'button', 'aria-label': 'Next month', onclick: () => { month = new Date(month.getFullYear(), month.getMonth() + 1, 1); redraw(); } }, h('i', { class: 'fa-solid fa-chevron-right' }))),
      grid,
      h('div', { class: 'cal-agenda' },
        h('h2', { class: 'group-title', style: { marginTop: '0' } }, label.toLowerCase()),
        dayEvents.length
          ? dayEvents.map((e) => h('button', { class: 'event-row', type: 'button', onclick: () => go(`#/app/calendar/event/${e.id}`) },
            h('time', {}, e.allDay ? 'all day' : e.start),
            h('span', {}, h('b', {}, e.title || 'Untitled'), [e.end && !e.allDay ? `until ${e.end}` : '', e.location].filter(Boolean).join(' · '))))
          : h('p', { class: 'hint' }, 'Nothing planned. Tap + to add an event.')));
    return screenOf(page, appbar({
      buttons: [
        { icon: 'fa-solid fa-plus', label: 'new event', onClick: () => go('#/app/calendar/new') },
        { icon: 'fa-solid fa-calendar-day', label: 'today', onClick: () => { selected = todayIso(); month = new Date(); month.setDate(1); redraw(); } }
      ],
      menu: [{ label: 'about Calendar', onClick: () => go('#/info/calendar') }]
    }));
  }

  function editor(id) {
    const existing = events().find((e) => e.id === id);
    const e = existing ? { ...existing } : { id: `e${Date.now().toString(36)}`, title: '', date: selected, allDay: false, start: '09:00', end: '10:00', location: '', notes: '' };
    const input = (type, key, label) => {
      const i = h('input', { class: 'textbox', type, value: e[key] || '', 'aria-label': label });
      i.addEventListener('change', () => { e[key] = i.value; });
      return h('label', { class: 'field' }, h('span', { class: 'field__label' }, label), i);
    };
    const times = h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' } }, input('time', 'start', 'Starts'), input('time', 'end', 'Ends'));
    times.hidden = e.allDay;
    const page = h('div', { class: 'page has-appbar' },
      header('Calendar', existing ? 'edit event' : 'new event'),
      textbox({ label: 'Title', value: e.title, placeholder: 'what’s happening?', onInput: (v) => { e.title = v; } }),
      input('date', 'date', 'Date'),
      toggle({ label: 'All day', value: e.allDay, onChange: (v) => { e.allDay = v; times.hidden = v; } }),
      times,
      textbox({ label: 'Location', value: e.location, onInput: (v) => { e.location = v; } }),
      textbox({ label: 'Notes', value: e.notes, multiline: true, onInput: (v) => { e.notes = v; } }),
      h('p', { class: 'hint' }, 'Timed events send a reminder when they start, while Metro OS is open.'));
    setTimeout(() => page.querySelector('input')?.focus(), 320);
    return screenOf(page, appbar({
      buttons: [
        { icon: 'fa-solid fa-check', label: 'save', onClick: () => { save([...events().filter((x) => x.id !== e.id), { ...e, title: e.title.trim() || 'Untitled' }]); selected = e.date; ctx.back(); } },
        existing ? { icon: 'fa-solid fa-trash', label: 'delete', onClick: async () => { if (await dialog(el, { title: 'Delete this event?', body: e.title, ok: 'delete' })) { save(events().filter((x) => x.id !== e.id)); ctx.back(); } } } : null,
        { icon: 'fa-solid fa-xmark', label: 'cancel', onClick: () => ctx.back() }
      ].filter(Boolean)
    }));
  }

  const route = pageRouter(el, (sub) => {
    if (sub[0] === 'new') return editor(null);
    if (sub[0] === 'event' && sub[1]) return editor(sub[1]);
    if (sub[0] === 'today') { selected = todayIso(); month = new Date(); month.setDate(1); }
    return monthPage();
  });
  function redraw() { route(['month', Date.now()], { dir: 0, force: true }); }

  return {
    route(sub, opts) {
      // Coming back from the editor: redraw so new events show.
      route(sub.length ? sub : ['month'], { ...opts, force: !sub.length });
    }
  };
}
