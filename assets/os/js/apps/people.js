/* People: your contacts, favourites and a "me" card. Call, message or
   email anyone in one tap. Starts with a few made-up people. */

import { h, on } from '../util.js';
import { pivot, appbar, header, textbox, toggle, pageRouter, screenOf, dialog } from '../controls.js';
import { store } from '../store.js';
import * as C from '../contacts.js';

const COLORS = ['#1a68e0', '#6f42d6', '#d0208a', '#0b7373', '#a06308', '#0a7a4d', '#0a56d6', '#8a2be2', '#c8322f'];
const avatar = (c, size = 46) => h('span', { class: 'list-row__icon', style: { background: c.color, width: `${size}px`, height: `${size}px`, fontSize: `${size * 0.38}px` } }, C.initials(c.name));

export default function mount(ctx) {
  const { el, go } = ctx;
  let pv = null;
  let view = null;

  const row = (c) => h('button', { class: 'list-row', type: 'button', onclick: () => go(`#/app/people/contact/${c.id}`) },
    avatar(c), h('span', { class: 'list-row__body' }, h('b', {}, c.name), h('span', {}, c.status || c.phone || c.email || '')),
    c.favourite ? h('span', { class: 'list-row__end' }, h('i', { class: 'fa-solid fa-star', style: { color: 'var(--accent)' } })) : null);

  function main(tab) {
    view = 'main';
    const all = C.contacts();
    pv = pivot({
      appTitle: 'People',
      items: [
        { id: 'all', title: 'all', render: (p) => p.append(...all.map(row)) },
        { id: 'favourites', title: 'favourites', render: (p) => { const f = all.filter((c) => c.favourite); p.append(...(f.length ? f.map(row) : [h('p', { class: 'empty' }, 'Open someone and tap the star.')])); } },
        { id: 'me', title: 'me', render: mePane },
        {
          id: 'whats-new', title: "what's new", render: (p) => p.append(
            h('p', { class: 'hint', style: { margin: '0 0 8px' } }, 'Updates from people you know would appear here. Social networks no longer share these with apps, so this shows your contacts’ status instead.'),
            ...all.filter((c) => c.status).map((c) => h('div', { class: 'list-row', style: { cursor: 'default' } }, avatar(c), h('span', { class: 'list-row__body' }, h('b', {}, c.name), h('span', {}, c.status)))))
        }
      ],
      active: tab,
      onChange: (id) => go(`#/app/people/${id}`, { replace: true })
    });
    return screenOf(pv, appbar({
      buttons: [{ icon: 'fa-solid fa-plus', label: 'new contact', onClick: () => go('#/app/people/edit/new') }],
      menu: [{ label: 'about People', onClick: () => go('#/info/people') }]
    }));
  }

  function mePane(p) {
    const name = store.get('user.name');
    p.append(h('div', { style: { display: 'flex', gap: '14px', alignItems: 'center', margin: '6px 0 14px' } },
      avatar({ name: name || 'Me', color: 'var(--accent)' }, 84),
      h('div', {}, h('div', { style: { fontSize: '28px', fontWeight: 300 } }, name || 'Your name'), h('div', { class: 'meta-line' }, store.get('user.place') || ''))),
    textbox({ label: 'Your name', value: name, onChange: (v) => store.set('user.name', v.trim()) }),
    h('p', { class: 'hint' }, 'Metro OS uses this to greet you. It stays in this browser.'));
  }

  function contactPage(id) {
    view = 'contact';
    const c = C.contact(id);
    if (!c) return main('all');
    const action = (icon, label, sub, onclick) => h('button', { class: 'list-row', type: 'button', onclick },
      h('span', { class: 'list-row__icon' }, h('i', { class: icon })), h('span', { class: 'list-row__body' }, h('b', {}, label), h('span', {}, sub)));
    const page = h('div', { class: 'page has-appbar' },
      h('p', { class: 'app-title' }, 'People'),
      h('div', { style: { display: 'flex', gap: '14px', alignItems: 'center', margin: '8px 0 16px' } }, avatar(c, 96),
        h('div', {}, h('h1', { class: 'page-title', style: { margin: 0, textTransform: 'none', fontSize: '34px' } }, c.name), c.demo ? h('span', { class: 'chip chip--soon' }, 'made-up contact') : null)),
      c.phone ? action('fa-solid fa-phone', 'call', c.phone, () => go(`#/app/phone/call/${encodeURIComponent(c.phone)}`)) : null,
      c.phone ? action('fa-solid fa-message', 'message', c.phone, () => go(`#/app/messaging/thread/${c.id}`)) : null,
      c.email ? action('fa-solid fa-envelope', 'email', c.email, () => go(`#/app/mail/compose/${encodeURIComponent(c.email)}`)) : null,
      c.note ? h('p', { class: 'lede', style: { marginTop: '14px' } }, c.note) : null);
    return screenOf(page, appbar({
      buttons: [
        { icon: c.favourite ? 'fa-solid fa-star' : 'fa-regular fa-star', label: c.favourite ? 'unfavourite' : 'favourite', onClick: () => { C.saveContact({ ...c, favourite: !c.favourite }); route(['contact', id, Date.now()], { dir: 0, force: true }); } },
        { icon: 'fa-solid fa-pen', label: 'edit', onClick: () => go(`#/app/people/edit/${id}`) },
        { icon: 'fa-solid fa-trash', label: 'delete', onClick: async () => { if (await dialog(el, { title: `Delete ${c.name}?`, body: 'They’ll be removed from People, Phone and Messaging.', ok: 'delete' })) { C.removeContact(id); ctx.back(); } } }
      ]
    }));
  }

  function editPage(id) {
    view = 'edit';
    const c = id === 'new' ? { name: '', phone: '', email: '', note: '', favourite: false, color: COLORS[Math.floor(Math.random() * COLORS.length)] } : { ...C.contact(id) };
    const page = h('div', { class: 'page has-appbar' },
      header('People', id === 'new' ? 'new contact' : 'edit contact'),
      textbox({ label: 'Name', value: c.name, onInput: (v) => { c.name = v; } }),
      textbox({ label: 'Phone', value: c.phone, type: 'tel', onInput: (v) => { c.phone = v.trim(); } }),
      textbox({ label: 'Email', value: c.email, type: 'email', onInput: (v) => { c.email = v.trim(); } }),
      textbox({ label: 'Birthday (month-day, optional)', value: c.birthday || '', placeholder: '09-22', onInput: (v) => { c.birthday = /^\d{2}-\d{2}$/.test(v.trim()) ? v.trim() : ''; } }),
      textbox({ label: 'Notes', value: c.note, multiline: true, onInput: (v) => { c.note = v; } }),
      toggle({ label: 'Favourite', value: c.favourite, onChange: (v) => { c.favourite = v; } }));
    setTimeout(() => page.querySelector('input')?.focus(), 320);
    return screenOf(page, appbar({
      buttons: [
        { icon: 'fa-solid fa-check', label: 'save', onClick: () => { if (!c.name.trim()) return ctx.toast('Give them a name.'); const saved = C.saveContact({ ...c, name: c.name.trim(), demo: false }); ctx.go(`#/app/people/contact/${saved.id}`, { replace: true }); } },
        { icon: 'fa-solid fa-xmark', label: 'cancel', onClick: () => ctx.back() }
      ]
    }));
  }

  const route = pageRouter(el, (sub) => {
    if (sub[0] === 'contact' && sub[1]) return contactPage(sub[1]);
    if (sub[0] === 'edit' && sub[1]) return editPage(sub[1]);
    const tab = ['all', 'favourites', 'me', 'whats-new'].includes(sub[0]) ? sub[0] : 'all';
    if (view === 'main' && pv) { pv.select(tab, true); return null; }
    return main(tab);
  });
  const off = on('contacts', () => { if (view === 'main') { view = null; route(['all', Date.now()], { dir: 0, force: true }); } });

  return { route, destroy: off };
}
