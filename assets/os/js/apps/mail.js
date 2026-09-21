/* Mail: a Metro mail app with a made-up inbox. Writing works for real:
   "send" opens your device's own mail app with the message filled in, and a
   copy is kept under sent. Drafts save as you type. */

import { h, on, emit } from '../util.js';
import { pivot, appbar, textbox, pageRouter, screenOf, dialog } from '../controls.js';
import { store } from '../store.js';
import * as C from '../contacts.js';

const DEMO = [
  { from: 'Metro OS builds', addr: 'builds@example.com', subject: 'Nightly 0.2 is ready', body: 'Phase 1 is in: eleven apps that work with nothing extra. Hold the Clock tile and try the 5-minute timer.' },
  { from: 'Ananya Iyer', addr: 'ananya@example.com', subject: 'Tile layout for the demo day', body: 'Can we put Weather next to Calendar? The flip looks great when they line up.' },
  { from: 'Kabir Singh', addr: 'kabir@example.com', subject: 'Re: accent colours on light theme', body: 'Mauve works better than steel on white. Sending screenshots later.' }
];

function box() {
  let b = store.get('mail');
  if (!b) {
    const now = Date.now();
    b = { inbox: DEMO.map((m, i) => ({ ...m, id: `d${i}`, at: now - (i + 1) * 5.3 * 3600e3, read: false })), sent: [], drafts: [] };
    store.set('mail', b);
  }
  return b;
}
const save = (b) => { store.set('mail', b); emit('mail'); };
export const unreadCount = () => box().inbox.filter((m) => !m.read).length;
const when = (ts) => {
  const d = new Date(ts);
  return d.toDateString() === new Date().toDateString() ? d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
};

export default function mount(ctx) {
  const { el, go } = ctx;
  let pv = null;
  let view = null;
  let query = '';

  const row = (m, folder) => h('button', { class: 'list-row', type: 'button', onclick: () => go(folder === 'drafts' ? `#/app/mail/compose/draft/${m.id}` : `#/app/mail/read/${folder}/${m.id}`) },
    h('span', { class: 'list-row__body' },
      h('b', { style: { fontWeight: m.read === false ? 600 : 400 } }, folder === 'inbox' ? m.from : `to ${m.to || '(no one yet)'}`),
      h('span', { style: { color: m.read === false ? 'var(--accent)' : null } }, m.subject || '(no subject)'),
      h('span', {}, (m.body || '').slice(0, 80))),
    h('span', { class: 'list-row__end' }, when(m.at)));

  function folderPane(folder) {
    return (p) => {
      const q = query.toLowerCase();
      const items = box()[folder].filter((m) => !q || `${m.from} ${m.to} ${m.subject} ${m.body}`.toLowerCase().includes(q)).sort((a, b) => b.at - a.at);
      if (query) p.append(h('p', { class: 'hint', style: { margin: '0 0 6px' } }, `Showing results for “${query}”. `, h('a', { href: '#/app/mail/inbox', onclick: () => { query = ''; } }, 'clear')));
      p.append(...(items.length ? items.map((m) => row(m, folder)) : [h('p', { class: 'empty' }, folder === 'inbox' ? 'Nothing here.' : `No ${folder} yet.`)]));
      if (folder === 'inbox') p.append(h('p', { class: 'hint' }, 'This inbox is made up. Connecting a real account is planned for a later phase.'));
    };
  }

  function main(tab) {
    view = 'main';
    pv = pivot({
      appTitle: 'Mail',
      items: ['inbox', 'sent', 'drafts'].map((f) => ({ id: f, title: f, render: folderPane(f) })),
      active: tab,
      onChange: (id) => go(`#/app/mail/${id}`, { replace: true })
    });
    return screenOf(pv, appbar({
      buttons: [
        { icon: 'fa-solid fa-pen-to-square', label: 'compose', onClick: () => go('#/app/mail/compose') },
        { icon: 'fa-solid fa-magnifying-glass', label: 'search', onClick: () => go('#/app/mail/search') },
        { icon: 'fa-solid fa-arrows-rotate', label: 'sync', onClick: () => ctx.toast('This inbox is made up, so there’s nothing to sync.') }
      ],
      menu: [{ label: 'mark all as read', onClick: () => { const b = box(); b.inbox.forEach((m) => { m.read = true; }); save(b); } }, { label: 'about Mail', onClick: () => go('#/info/mail') }]
    }));
  }

  function read(folder, id) {
    view = 'read';
    const b = box();
    const m = b[folder]?.find((x) => x.id === id);
    if (!m) return main('inbox');
    if (folder === 'inbox' && !m.read) { m.read = true; save(b); }
    const page = h('div', { class: 'page has-appbar' },
      h('p', { class: 'app-title' }, 'Mail'),
      h('h1', { class: 'page-title', style: { textTransform: 'none', fontSize: '28px' } }, m.subject || '(no subject)'),
      h('p', { class: 'meta-line' }, folder === 'inbox' ? `${m.from} <${m.addr}>` : `to ${m.to}`, ' · ', new Date(m.at).toLocaleString()),
      h('div', { class: 'md', style: { marginTop: '14px', whiteSpace: 'pre-wrap' } }, m.body));
    return screenOf(page, appbar({
      buttons: [
        folder === 'inbox' ? { icon: 'fa-solid fa-reply', label: 'reply', onClick: () => go(`#/app/mail/compose/${encodeURIComponent(m.addr)}/${encodeURIComponent(`Re: ${m.subject}`)}`) } : null,
        { icon: 'fa-solid fa-trash', label: 'delete', onClick: async () => { if (await dialog(el, { title: 'Delete this message?', body: m.subject, ok: 'delete' })) { b[folder] = b[folder].filter((x) => x.id !== id); save(b); ctx.back(); } } }
      ].filter(Boolean)
    }));
  }

  function compose(to = '', subject = '', draftId = null) {
    view = 'compose';
    const b = box();
    const draft = draftId ? b.drafts.find((d) => d.id === draftId) : null;
    const msg = draft ? { ...draft } : { id: `x${Date.now().toString(36)}`, to, subject, body: '' };
    let t = 0;
    const keepDraft = () => {
      clearTimeout(t);
      t = setTimeout(() => {
        if (!msg.to && !msg.subject && !msg.body) return;
        const bb = box();
        bb.drafts = [{ ...msg, at: Date.now() }, ...bb.drafts.filter((d) => d.id !== msg.id)];
        save(bb);
      }, 500);
    };
    const suggestions = h('div');
    const toBox = textbox({
      label: 'To', value: msg.to, type: 'email', placeholder: 'name@example.com', onInput: (v) => {
        msg.to = v.trim(); keepDraft();
        const q = v.trim().toLowerCase();
        suggestions.replaceChildren(...(q.length > 1 ? C.contacts().filter((c) => c.email && (c.name.toLowerCase().includes(q) || c.email.includes(q))).slice(0, 3)
          .map((c) => h('button', { class: 'chip-btn', type: 'button', style: { marginRight: '6px' }, onclick: () => { msg.to = c.email; toBox.input.value = c.email; suggestions.replaceChildren(); } }, c.name)) : []));
      }
    });
    const page = h('div', { class: 'page has-appbar' },
      h('p', { class: 'app-title' }, 'Mail · new message'),
      toBox, suggestions,
      textbox({ label: 'Subject', value: msg.subject, onInput: (v) => { msg.subject = v; keepDraft(); } }),
      textbox({ label: 'Message', value: msg.body, multiline: true, onInput: (v) => { msg.body = v; keepDraft(); } }),
      h('p', { class: 'hint' }, 'Send opens your device’s mail app with this message filled in.'));
    const wrap = screenOf(page, appbar({
      buttons: [
        {
          icon: 'fa-solid fa-paper-plane', label: 'send', onClick: () => {
            if (!/.+@.+\..+/.test(msg.to)) return ctx.toast('Add an email address to send to.');
            clearTimeout(t);
            const a = h('a', { href: `mailto:${encodeURIComponent(msg.to)}?subject=${encodeURIComponent(msg.subject)}&body=${encodeURIComponent(msg.body)}` });
            document.body.append(a); a.click(); a.remove();
            const bb = box();
            bb.sent = [{ ...msg, at: Date.now() }, ...bb.sent];
            bb.drafts = bb.drafts.filter((d) => d.id !== msg.id);
            save(bb);
            ctx.toast('Handed to your mail app. A copy is under sent.');
            ctx.back();
          }
        },
        { icon: 'fa-solid fa-trash', label: 'discard', onClick: () => { clearTimeout(t); const bb = box(); bb.drafts = bb.drafts.filter((d) => d.id !== msg.id); save(bb); ctx.back(); } }
      ]
    }));
    wrap.cleanup = () => clearTimeout(t);
    setTimeout(() => (msg.to ? page.querySelectorAll('input, textarea')[msg.subject ? 2 : 1] : toBox.input)?.focus(), 320);
    return wrap;
  }

  function searchPage() {
    view = 'search';
    const box2 = textbox({ label: 'Search mail', value: query, placeholder: 'sender, subject or words', onChange: (v) => { query = v.trim(); go('#/app/mail/inbox', { replace: true }); } });
    box2.input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { query = box2.input.value.trim(); view = null; go('#/app/mail/inbox', { replace: true }); } });
    setTimeout(() => box2.input.focus(), 320);
    return screenOf(h('div', { class: 'page' }, h('p', { class: 'app-title' }, 'Mail'), h('h1', { class: 'page-title' }, 'search'), box2));
  }

  const route = pageRouter(el, (sub) => {
    if (sub[0] === 'read') return read(sub[1], sub[2]);
    if (sub[0] === 'compose') return sub[1] === 'draft' ? compose('', '', sub[2]) : compose(decodeURIComponent(sub[1] || ''), decodeURIComponent(sub[2] || ''));
    if (sub[0] === 'search') return searchPage();
    if (sub[0] === 'settings') ctx.toast('Account settings arrive with real accounts in a later phase.');
    if (sub[0] === 'sync') ctx.toast('This inbox is made up, so there’s nothing to sync.');
    const tab = ['inbox', 'sent', 'drafts'].includes(sub[0]) ? sub[0] : 'inbox';
    if (view === 'main' && pv) { pv.select(tab, true); return null; }
    return main(tab);
  });
  const off = on('mail', () => { if (view === 'main') { view = null; route(['inbox', Date.now()], { dir: 0, force: true }); } });

  return { route(sub, opts) { route(sub.length ? sub : ['inbox'], { ...opts, force: view !== 'main' && !sub.length }); }, destroy: off };
}
