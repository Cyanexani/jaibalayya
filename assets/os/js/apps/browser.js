/* Browser: reads Wikipedia inside Metro OS (it allows that), opens Metro OS
   links in place, and opens every other website in a normal browser tab,
   since most sites refuse to be shown inside another page. */

import { h } from '../util.js';
import { appbar, loader, pageRouter, screenOf } from '../controls.js';
import { store } from '../store.js';

const WIKI = 'https://en.wikipedia.org';
const bookmarks = () => store.get('browser.bookmarks') || [];
const history = () => store.get('browser.history') || [];
const remember = (item) => store.set('browser.history', [item, ...history().filter((x) => x.url !== item.url)].slice(0, 30));

async function wiki(params) {
  const q = new URLSearchParams({ format: 'json', formatversion: '2', origin: '*', ...params });
  const r = await fetch(`${WIKI}/w/api.php?${q}`);
  if (!r.ok) throw new Error('Wikipedia is unreachable right now.');
  return r.json();
}

function clean(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('script, style, link, .mw-editsection, .reference, sup.reference, .navbox, .metadata, .mw-empty-elt, .hatnote, .infobox, table, .thumb, figure, .reflist, .refbegin, .mw-references-wrap, #toc, .toc, .sistersitebox, .noprint').forEach((n) => n.remove());
  const out = document.createElement('div');
  const ok = new Set(['P', 'H2', 'H3', 'H4', 'UL', 'OL', 'LI', 'B', 'I', 'EM', 'STRONG', 'A', 'BLOCKQUOTE', 'BR', 'DL', 'DD', 'DT']);
  const copy = (src, dest) => {
    for (const n of src.childNodes) {
      if (n.nodeType === 3) { dest.append(n.textContent); continue; }
      if (n.nodeType !== 1) continue;
      if (!ok.has(n.tagName)) { copy(n, dest); continue; }
      const el = document.createElement(n.tagName === 'DL' ? 'div' : n.tagName.toLowerCase());
      if (n.tagName === 'A') {
        const href = n.getAttribute('href') || '';
        if (href.startsWith('/wiki/') && !href.includes(':')) el.setAttribute('data-wiki', decodeURIComponent(href.slice(6).split('#')[0]));
        else if (/^https?:/.test(href)) el.setAttribute('data-ext', href);
        el.setAttribute('href', '#');
      }
      copy(n, el);
      if (el.textContent.trim() || el.tagName === 'BR') dest.append(el);
    }
  };
  copy(doc.body, out);
  return out;
}

export default function mount(ctx) {
  const { el, go } = ctx;
  const address = h('input', { class: 'textbox', type: 'search', placeholder: 'search Wikipedia or type a web address', 'aria-label': 'Address', enterkeyhint: 'go' });
  const content = h('div', { class: 'md' });
  let current = null; // { title } of the open article

  const page = h('div', { class: 'page has-appbar' }, h('p', { class: 'app-title' }, 'Browser'), h('div', { style: { margin: '6px 0 12px' } }, address), content);

  function openExternal(url) {
    remember({ url, title: url.replace(/^https?:\/\//, '').slice(0, 60) });
    window.open(url, '_blank', 'noopener');
    ctx.toast('Opened in a new browser tab');
  }

  function submit() {
    const v = address.value.trim();
    if (!v) return;
    if (v.startsWith('#/')) return go(v);
    if (/^https?:\/\//i.test(v) || /^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(v)) return openExternal(/^https?:/i.test(v) ? v : `https://${v}`);
    search(v);
  }
  address.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); address.blur(); } });

  function home() {
    current = null;
    address.value = '';
    const row = (icon, title, sub, onclick) => h('button', { class: 'list-row', type: 'button', onclick },
      h('span', { class: 'list-row__icon' }, h('i', { class: icon })), h('span', { class: 'list-row__body' }, h('b', {}, title), h('span', {}, sub)));
    content.replaceChildren(
      h('h2', { class: 'group-title', style: { marginTop: 0 } }, 'bookmarks'),
      ...(bookmarks().length ? bookmarks().map((b) => row('fa-solid fa-bookmark', b.title, 'Wikipedia', () => article(b.title))) : [h('p', { class: 'hint' }, 'Tap ★ on an article to keep it here.')]),
      h('h2', { class: 'group-title' }, 'recent'),
      ...(history().length ? history().slice(0, 8).map((x) => row(x.wiki ? 'fa-brands fa-wikipedia-w' : 'fa-solid fa-globe', x.title, x.wiki ? 'Wikipedia' : x.url, () => (x.wiki ? article(x.wiki) : openExternal(x.url)))) : [h('p', { class: 'hint' }, 'Nothing yet.')]),
      h('h2', { class: 'group-title' }, 'metro os'),
      row('fa-solid fa-road', 'Roadmap', 'what’s coming', () => go('#/app/hub/roadmap')),
      row('fa-solid fa-bullhorn', 'What’s new', 'release notes', () => go('#/app/hub/whats-new')),
      h('p', { class: 'hint', style: { marginTop: '14px' } }, 'Wikipedia opens here. Other websites open in a normal browser tab, because most sites don’t allow being shown inside another page.'));
  }

  async function search(q) {
    current = null;
    content.replaceChildren(loader());
    try {
      const j = await wiki({ action: 'query', list: 'search', srsearch: q, srlimit: '15' });
      const hits = j.query?.search || [];
      content.replaceChildren(
        ...hits.map((r) => h('button', { class: 'list-row', type: 'button', onclick: () => article(r.title) },
          h('span', { class: 'list-row__body' }, h('b', {}, r.title), h('span', {}, new DOMParser().parseFromString(r.snippet, 'text/html').body.textContent)))),
        hits.length ? null : h('p', { class: 'empty' }, 'No Wikipedia articles found.'),
        h('div', { class: 'btn-row' }, h('button', { class: 'btn', type: 'button', onclick: () => openExternal(`https://duckduckgo.com/?q=${encodeURIComponent(q)}`) }, h('i', { class: 'fa-solid fa-globe' }), 'search the web in a new tab')));
    } catch (e) { content.replaceChildren(h('p', { class: 'empty' }, e.message)); }
  }

  async function article(title) {
    content.replaceChildren(loader());
    address.value = title;
    try {
      const j = await wiki({ action: 'parse', page: title, prop: 'text', redirects: '1', disableeditsection: '1' });
      if (j.error) throw new Error('That article doesn’t exist.');
      current = { title: j.parse.title };
      remember({ url: `${WIKI}/wiki/${encodeURIComponent(j.parse.title)}`, title: j.parse.title, wiki: j.parse.title });
      const body = clean(j.parse.text);
      body.addEventListener('click', (e) => {
        const a = e.target.closest('a');
        if (!a) return;
        e.preventDefault();
        if (a.dataset.wiki) article(a.dataset.wiki.replace(/_/g, ' '));
        else if (a.dataset.ext) openExternal(a.dataset.ext);
      });
      content.replaceChildren(h('h1', { class: 'page-title', style: { textTransform: 'none', fontSize: '34px' } }, j.parse.title), body,
        h('p', { class: 'hint', style: { marginTop: '20px' } }, 'From Wikipedia, available under CC BY-SA 4.0. ',
          h('a', { href: `${WIKI}/wiki/${encodeURIComponent(j.parse.title)}`, target: '_blank', rel: 'noopener' }, 'Open the full article')));
      page.scrollTop = 0;
    } catch (e) { content.replaceChildren(h('p', { class: 'empty' }, e.message)); }
  }

  el.append(screenOf(page, appbar({
    buttons: [
      { icon: 'fa-solid fa-house', label: 'home', onClick: home },
      { icon: 'fa-solid fa-star', label: 'bookmark', onClick: () => { if (!current) return ctx.toast('Open an article to bookmark it.'); const has = bookmarks().some((b) => b.title === current.title); store.set('browser.bookmarks', has ? bookmarks().filter((b) => b.title !== current.title) : [{ title: current.title }, ...bookmarks()]); ctx.toast(has ? 'Bookmark removed' : 'Bookmarked'); } },
      { icon: 'fa-solid fa-arrow-up-right-from-square', label: 'open in tab', onClick: () => (current ? openExternal(`${WIKI}/wiki/${encodeURIComponent(current.title)}`) : ctx.toast('Nothing open.')) }
    ],
    menu: [{ label: 'clear history', onClick: () => { store.set('browser.history', []); home(); } }, { label: 'about Browser', onClick: () => go('#/info/browser') }]
  })));
  home();

  const route = (sub) => {
    if (sub[0] === 'new') { home(); setTimeout(() => address.focus(), 320); }
    if (sub[0] === 'bookmarks') home();
    if (sub[0] === 'wiki' && sub[1]) article(decodeURIComponent(sub.slice(1).join('/')));
  };
  return { route };
}
