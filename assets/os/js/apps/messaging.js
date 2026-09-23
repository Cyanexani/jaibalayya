/* Messaging: conversations kept in this browser. Messages to the made-up
   contacts stay here; "send as a text" hands a message to your device's
   own messaging app. */

import { h, on, emit } from '../util.js';
import { appbar, header, pageRouter, screenOf, dialog } from '../controls.js';
import { store } from '../store.js';
import * as C from '../contacts.js';

const threads = () => C.threads();
const saveThreads = (t) => { store.set('threads', t); emit('threads'); };
const when = (ts) => {
  const d = new Date(ts);
  return d.toDateString() === new Date().toDateString() ? d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
};

export default function mount(ctx) {
  const { el, go } = ctx;
  let view = null;

  function list() {
    view = 'list';
    const t = threads();
    const ids = Object.keys(t).filter((id) => t[id].length).sort((a, b) => t[b].at(-1).at - t[a].at(-1).at);
    const page = h('div', { class: 'page has-appbar' },
      header('Messaging', 'threads'),
      ids.length ? ids.map((id) => {
        const c = C.contact(id) || { name: 'Unknown', color: '#555' };
        const last = t[id].at(-1);
        return h('button', { class: 'list-row', type: 'button', onclick: () => go(`#/app/messaging/thread/${id}`) },
          h('span', { class: 'list-row__icon', style: { background: c.color } }, C.initials(c.name)),
          h('span', { class: 'list-row__body' }, h('b', {}, c.name), h('span', {}, `${last.me ? 'you: ' : ''}${last.text}`)),
          h('span', { class: 'list-row__end' }, when(last.at)));
      }) : h('p', { class: 'empty' }, h('b', {}, 'No conversations'), 'Tap + to start one.'));
    return screenOf(page, appbar({
      buttons: [{ icon: 'fa-solid fa-plus', label: 'new', onClick: () => go('#/app/messaging/new') }],
      menu: [{ label: 'about Messaging', onClick: () => go('#/info/messaging') }]
    }));
  }

  function pick() {
    view = 'pick';
    return screenOf(h('div', { class: 'page' }, header('Messaging', 'new message'),
      h('p', { class: 'hint', style: { margin: '0 0 8px' } }, 'Pick someone from People.'),
      ...C.contacts().filter((c) => c.phone).map((c) => h('button', { class: 'list-row', type: 'button', onclick: () => go(`#/app/messaging/thread/${c.id}`, { replace: true }) },
        h('span', { class: 'list-row__icon', style: { background: c.color } }, C.initials(c.name)),
        h('span', { class: 'list-row__body' }, h('b', {}, c.name), h('span', {}, c.phone))))));
  }

  function thread(id) {
    view = 'thread';
    const c = C.contact(id);
    if (!c) return list();
    const bubbles = h('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px', paddingBottom: '8px' } });
    const paint = () => {
      const msgs = threads()[id] || [];
      bubbles.replaceChildren(...msgs.map((m) => h('div', {
        style: {
          alignSelf: m.me ? 'flex-end' : 'flex-start', maxWidth: '78%', padding: '8px 12px',
          background: m.me ? 'var(--accent)' : 'var(--chrome-2)', color: m.me ? '#fff' : 'var(--fg)', fontSize: '15px', lineHeight: 1.4
        }
      }, m.text, h('div', { style: { fontSize: '11px', opacity: 0.75, marginTop: '4px', textAlign: m.me ? 'right' : 'left' } }, when(m.at)))));
      requestAnimationFrame(() => { page.scrollTop = page.scrollHeight; });
    };
    const input = h('textarea', { class: 'textbox', rows: 2, placeholder: 'type a message', 'aria-label': 'Message', style: { minHeight: '52px' } });
    const send = () => {
      const text = input.value.trim();
      if (!text) return;
      const t = threads();
      t[id] = [...(t[id] || []), { id: `m${Date.now()}`, me: true, text, at: Date.now() }];
      saveThreads(t);
      input.value = '';
      paint();
    };
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } });
    const page = h('div', { class: 'page has-appbar' },
      h('p', { class: 'app-title' }, c.name),
      c.demo ? h('p', { class: 'notice' }, 'This is a made-up contact, so messages stay in Metro OS. Use “send as a text” to message a real number from your phone.') : null,
      bubbles, input);
    paint();
    const wrap = screenOf(page, appbar({
      buttons: [
        { icon: 'fa-solid fa-paper-plane', label: 'send', onClick: send },
        { icon: 'fa-solid fa-mobile-screen', label: 'send as a text', onClick: () => { const a = h('a', { href: `sms:${(c.phone || '').replace(/[^\d+]/g, '')}?body=${encodeURIComponent(input.value)}` }); document.body.append(a); a.click(); a.remove(); } },
        { icon: 'fa-solid fa-phone', label: 'call', onClick: () => go(`#/app/phone/call/${encodeURIComponent(c.phone)}`) }
      ],
      menu: [{ label: 'delete conversation', onClick: async () => { if (await dialog(el, { title: 'Delete this conversation?', body: c.name, ok: 'delete' })) { const t = threads(); delete t[id]; saveThreads(t); ctx.back(); } } }]
    }));
    setTimeout(() => input.focus(), 320);
    return wrap;
  }

  const route = pageRouter(el, (sub) => {
    if (sub[0] === 'new') return pick();
    if (sub[0] === 'thread' && sub[1]) return thread(sub[1]);
    if (sub[0] === 'thread') {
      const t = threads();
      const latest = Object.keys(t).sort((a, b) => (t[b].at(-1)?.at || 0) - (t[a].at(-1)?.at || 0))[0];
      if (latest) return thread(latest);
    }
    return list();
  });
  const off = on('threads', () => { if (view === 'list') route(['list', Date.now()], { dir: 0, force: true }); });

  return { route(sub, opts) { route(sub.length ? sub : ['list'], { ...opts, force: !sub.length }); }, destroy: off };
}
