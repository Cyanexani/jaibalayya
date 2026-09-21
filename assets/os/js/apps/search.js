/* Search: finds apps and anything written in the notes (changelogs,
   roadmaps, known issues). Recent searches stay on this device. */

import { h, fill } from '../util.js';
import { store } from '../store.js';
import { APPS, byId, iconHtml } from '../registry.js';
import { searchNotes } from '../content.js';
import { files } from '../db.js';
import { header, row, groupTitle, loader } from '../controls.js';

export default function mount(ctx) {
  const { el, go } = ctx;
  const input = h('input', { class: 'textbox', type: 'search', placeholder: 'apps, changelogs, roadmap…', 'aria-label': 'Search Metro OS', enterkeyhint: 'search' });
  const results = h('div', { 'aria-live': 'polite' });
  const page = h('div', { class: 'page' }, header('Search', null), h('div', { style: { margin: '10px 0 6px' } }, input), results);
  el.append(page);

  let timer = 0;
  let token = 0;

  const remember = (q) => {
    q = q.trim();
    if (q.length < 2) return;
    const recent = [q, ...(store.get('recentSearches') || []).filter((x) => x !== q)].slice(0, 8);
    store.set('recentSearches', recent);
  };

  function showRecent() {
    const recent = store.get('recentSearches') || [];
    fill(results,
      recent.length ? groupTitle('recent') : h('p', { class: 'hint' }, 'Try “bloom”, “roadmap”, “removed”, or an app name.'),
      ...recent.map((q) => row({ title: q, onClick: () => { input.value = q; run(); } })),
      recent.length ? h('button', { class: 'btn', type: 'button', style: { marginTop: '10px' }, onclick: () => { store.set('recentSearches', []); showRecent(); } }, 'clear recent') : null);
  }

  async function run() {
    const q = input.value.trim();
    const my = ++token;
    if (!q) return showRecent();
    const ql = q.toLowerCase();
    const apps = APPS.filter((a) => a.name.toLowerCase().includes(ql) || a.id.includes(ql));
    fill(results,
      apps.length ? groupTitle('apps') : null,
      ...apps.map((a) => row({ title: a.name, sub: a.built ? 'open' : `notes · phase ${a.phase}`, iconHtml: iconHtml(a), onClick: () => { remember(q); go(`#/app/${a.id}`); } })),
      q.length > 1 ? loader() : null);
    if (q.length < 2) return;
    const [hits, docs] = await Promise.all([searchNotes(q), files.list('document')]);
    if (my !== token) return;
    results.querySelector('.dots')?.remove();

    // Your own things: notes and documents in this browser.
    const snippet = (text) => {
      const at = text.toLowerCase().indexOf(ql);
      return at < 0 ? text.slice(0, 90) : `${at > 30 ? '…' : ''}${text.slice(Math.max(0, at - 30), at + 70)}`;
    };
    const mine = [
      ...(store.get('notes') || []).filter((n) => n.text.toLowerCase().includes(ql))
        .map((n) => ({ title: `Notes › ${n.text.trim().split('\n')[0].slice(0, 50) || 'Untitled'}`, sub: snippet(n.text), route: `#/app/notes/${n.id}` })),
      ...docs.filter((d) => `${d.name} ${d.text || ''}`.toLowerCase().includes(ql))
        .map((d) => ({ title: `Documents › ${d.name.replace(/\.(md|txt)$/i, '')}`, sub: snippet(d.text || ''), route: `#/app/documents/${d.id}` }))
    ];
    if (mine.length) {
      results.append(groupTitle('yours'));
      for (const m of mine.slice(0, 12)) results.append(row({ title: m.title, sub: m.sub, onClick: () => { remember(q); go(m.route); } }));
    }
    if (hits.length) {
      results.append(groupTitle('in the notes'));
      for (const hit of hits) {
        const app = hit.doc === 'os' ? null : byId(hit.doc);
        const route = hit.doc === 'os' ? `#/app/hub/${hit.section}` : `#/info/${hit.doc}/${hit.section}`;
        results.append(row({ title: `${app ? app.name : 'Metro OS'} › ${hit.title}`, sub: hit.snippet, onClick: () => { remember(q); go(route); } }));
      }
    } else if (!apps.length && !mine.length) {
      results.append(h('p', { class: 'hint' }, `Nothing found for “${q}”.`));
    }
  }

  input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(run, 140); });
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { remember(input.value); run(); } });

  function voice() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { ctx.toast('Voice search needs a browser with speech recognition, such as Chrome or Edge.'); return; }
    const rec = new SR();
    rec.lang = navigator.language || 'en-US';
    rec.interimResults = true;
    input.placeholder = 'listening…';
    rec.onresult = (e) => { input.value = [...e.results].map((r) => r[0].transcript).join(''); run(); };
    rec.onend = () => { input.placeholder = 'apps, changelogs, roadmap…'; remember(input.value); };
    rec.onerror = () => ctx.toast('Couldn’t hear anything. Check the microphone permission.');
    rec.start();
  }

  showRecent();

  return {
    route(sub) { if (sub[0] === 'voice') setTimeout(voice, 350); },
    show() { setTimeout(() => input.focus({ preventScroll: true }), 320); }
  };
}
