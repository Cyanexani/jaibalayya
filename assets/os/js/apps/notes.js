/* Notes: quick notes saved on this device. Pin one and it shows in the
   Notes Bloom on start. */

import { h, on, emit } from '../util.js';
import { store } from '../store.js';
import { header, appbar, pageRouter, screenOf, dialog } from '../controls.js';

export const notesList = () => store.get('notes') || [];
const save = (list) => { store.set('notes', list); emit('notes'); };
export const pinnedNote = () => notesList().find((n) => n.pinned) || null;
export const titleOf = (n) => (n.text.trim().split('\n')[0] || 'Untitled note').slice(0, 80);

function when(ts) {
  const d = new Date(ts);
  return d.toDateString() === new Date().toDateString()
    ? d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

export default function mount(ctx) {
  const { el, go } = ctx;

  function list() {
    const items = [...notesList()].sort((a, b) => (b.pinned - a.pinned) || (b.modified - a.modified));
    const page = h('div', { class: 'page has-appbar' },
      header('Notes', 'notes'),
      items.length
        ? items.map((n) => h('button', { class: 'list-row', type: 'button', onclick: () => go(`#/app/notes/${n.id}`) },
          h('span', { class: 'list-row__body' },
            h('b', {}, n.pinned ? h('i', { class: 'fa-solid fa-thumbtack pin-mark', 'aria-label': 'pinned' }) : null, titleOf(n)),
            h('span', {}, n.text.trim().split('\n').slice(1).join(' ').slice(0, 90) || ' ')),
          h('span', { class: 'list-row__end' }, when(n.modified))))
        : h('p', { class: 'empty' }, h('b', {}, 'No notes yet'), 'Tap + to write one. Notes stay in this browser.'));
    return screenOf(page, appbar({
      buttons: [{ icon: 'fa-solid fa-plus', label: 'new', onClick: () => go('#/app/notes/new') }],
      menu: [{ label: 'about Notes', onClick: () => go('#/info/notes') }]
    }));
  }

  function editor(id) {
    let note = notesList().find((n) => n.id === id);
    if (!note) return list();
    const area = h('textarea', { 'aria-label': 'Note', placeholder: 'Start typing. The first line is the title.' });
    area.value = note.text;
    let t = 0;
    area.addEventListener('input', () => {
      clearTimeout(t);
      t = setTimeout(() => {
        note = { ...note, text: area.value, modified: Date.now() };
        save(notesList().map((n) => (n.id === note.id ? note : n)));
      }, 300);
    });
    const pinBtnLabel = () => (note.pinned ? 'unpin' : 'pin');
    const bar = appbar({
      buttons: [
        { icon: 'fa-solid fa-check', label: 'done', onClick: () => ctx.back() },
        {
          icon: 'fa-solid fa-thumbtack', label: pinBtnLabel(),
          onClick: () => {
            const pin = !note.pinned;
            save(notesList().map((n) => ({ ...n, pinned: n.id === note.id ? pin : (pin ? false : n.pinned) })));
            note = { ...note, pinned: pin };
            ctx.toast(pin ? 'Pinned. It shows in the Notes Bloom on start.' : 'Unpinned');
          }
        },
        {
          icon: 'fa-solid fa-trash', label: 'delete',
          onClick: async () => {
            if (!(await dialog(el, { title: 'Delete this note?', body: titleOf(note), ok: 'delete' }))) return;
            save(notesList().filter((n) => n.id !== note.id));
            ctx.back();
          }
        }
      ]
    });
    const wrap = screenOf(h('div', { class: 'note-editor' }, h('p', { class: 'app-title' }, 'Notes'), area), bar);
    wrap.cleanup = () => {
      clearTimeout(t);
      const text = area.value;
      if (!text.trim()) save(notesList().filter((n) => n.id !== note.id));
      else if (text !== notesList().find((n) => n.id === note.id)?.text) {
        save(notesList().map((n) => (n.id === note.id ? { ...n, text, modified: Date.now() } : n)));
      }
    };
    setTimeout(() => { area.focus(); if (!note.text) area.setSelectionRange(0, 0); }, 320);
    return wrap;
  }

  const route = pageRouter(el, (sub) => {
    if (sub[0] === 'new') {
      const note = { id: `n${Date.now().toString(36)}`, text: '', pinned: false, created: Date.now(), modified: Date.now() };
      save([note, ...notesList()]);
      setTimeout(() => go(`#/app/notes/${note.id}`, { replace: true }), 0);
      return null;
    }
    if (sub[0] === 'pinned') {
      const p = pinnedNote();
      if (p) { setTimeout(() => go(`#/app/notes/${p.id}`, { replace: true }), 0); return null; }
      ctx.toast('No pinned note yet. Open a note and tap pin.');
      return list();
    }
    return sub[0] ? editor(sub[0]) : list();
  });

  // Refresh the list when notes change elsewhere (e.g. after leaving the editor).
  let current = [];
  on('notes', () => { if (!current[0]) route([], { dir: 0, force: true }); });

  return {
    route(sub, opts) { current = sub; route(sub, opts); }
  };
}
