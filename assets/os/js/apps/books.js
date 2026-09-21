/* Books: public-domain books read from Wikisource (which, unlike Project
   Gutenberg, lets other websites load its texts). A shelf of classics,
   search, and a reader that remembers your chapter and place. */

import { h } from '../util.js';
import { pivot, appbar, textbox, loader, pageRouter, screenOf } from '../controls.js';
import { store } from '../store.js';

const API = 'https://en.wikisource.org/w/api.php';
const SHELF = [
  ['Pride and Prejudice', 'Jane Austen'],
  ['Frankenstein, or the Modern Prometheus (Revised Edition, 1831)', 'Mary Shelley'],
  ['Dracula', 'Bram Stoker'],
  ["Alice's Adventures in Wonderland (1866)", 'Lewis Carroll'],
  ['The Adventures of Sherlock Holmes', 'Arthur Conan Doyle'],
  ['Moby-Dick (1851) US edition', 'Herman Melville'],
  ['The Time Machine', 'H. G. Wells'],
  ['Little Women', 'Louisa May Alcott']
];

async function api(params) {
  const q = new URLSearchParams({ format: 'json', formatversion: '2', origin: '*', ...params });
  const r = await fetch(`${API}?${q}`);
  if (!r.ok) throw new Error('Wikisource is unreachable right now.');
  return r.json();
}

const natural = (a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });

/** A work's chapters: its subpages if it has them, else the page itself. */
async function chapters(title) {
  const j = await api({ action: 'query', list: 'allpages', apprefix: `${title}/`, aplimit: '200', apnamespace: '0' });
  const pages = (j.query?.allpages || []).map((p) => p.title).filter((t) => !/\/(Index|Contents|Preface to)/i.test(t)).sort(natural);
  return pages.length ? pages : [title];
}

/** Fetch a page and keep only readable text (no scripts, no site chrome). */
async function readPage(title) {
  const j = await api({ action: 'parse', page: title, prop: 'text', redirects: '1', disableeditsection: '1' });
  if (j.error) throw new Error('That page isn’t on Wikisource.');
  const doc = new DOMParser().parseFromString(j.parse.text, 'text/html');
  doc.querySelectorAll('script, style, link, .ws-noexport, .noprint, .mw-editsection, .reference, sup.reference, table.headertemplate, #headertemplate, .wst-header, .navbox, .mw-empty-elt').forEach((n) => n.remove());
  const out = document.createElement('div');
  const allowed = new Set(['P', 'H2', 'H3', 'H4', 'BLOCKQUOTE', 'UL', 'OL', 'LI', 'EM', 'I', 'B', 'STRONG', 'BR', 'SPAN', 'DIV', 'CENTER', 'SMALL', 'POEM', 'DD', 'DL']);
  const copy = (src, dest) => {
    for (const n of src.childNodes) {
      if (n.nodeType === 3) dest.append(n.textContent);
      else if (n.nodeType === 1) {
        if (!allowed.has(n.tagName)) { copy(n, dest); continue; }
        const tag = ['SPAN', 'DIV', 'CENTER', 'POEM', 'SMALL', 'DD', 'DL'].includes(n.tagName) ? (n.tagName === 'DIV' || n.tagName === 'CENTER' ? 'div' : 'span') : n.tagName.toLowerCase();
        const el = document.createElement(tag);
        copy(n, el);
        if (el.textContent.trim() || tag === 'br') dest.append(el);
      }
    }
  };
  copy(doc.body, out);
  return out;
}

const progress = () => store.get('books.progress') || {};
function saveProgress(title, author, chapter, count, scroll) {
  store.set('books.progress', { ...progress(), [title]: { title, author, chapter, count, scroll, at: Date.now() } });
  store.set('books.last', title);
}
export const lastBook = () => { const t = store.get('books.last'); return t ? progress()[t] : null; };

export default function mount(ctx) {
  const { el, go } = ctx;
  let pv = null;
  let view = null;

  const bookRow = (title, author) => {
    const p = progress()[title];
    return h('button', { class: 'list-row', type: 'button', onclick: () => go(`#/app/books/read/${encodeURIComponent(title)}`) },
      h('span', { class: 'list-row__icon' }, h('i', { class: 'fa-solid fa-book' })),
      h('span', { class: 'list-row__body' }, h('b', {}, title.replace(/\s*\(.*?\)\s*/g, ' ').trim()),
        h('span', {}, [author, p ? `chapter ${p.chapter + 1} of ${p.count}` : ''].filter(Boolean).join(' · '))));
  };

  function main(tab) {
    view = 'main';
    pv = pivot({
      appTitle: 'Books',
      items: [
        {
          id: 'library', title: 'library', render: (pane) => {
            const mine = Object.values(progress()).sort((a, b) => b.at - a.at);
            if (mine.length) pane.append(h('h2', { class: 'group-title', style: { marginTop: 0 } }, 'reading'), ...mine.map((p) => bookRow(p.title, p.author)));
            pane.append(h('h2', { class: 'group-title' }, 'classics'), ...SHELF.filter(([t]) => !progress()[t]).map(([t, a]) => bookRow(t, a)),
              h('p', { class: 'hint' }, 'Public-domain books from Wikisource, loaded as you read.'));
          }
        },
        {
          id: 'search', title: 'search', render: (pane) => {
            const results = h('div');
            let t = 0;
            pane.append(textbox({
              label: 'Search Wikisource', placeholder: 'a title or author', onInput: (q) => {
                clearTimeout(t);
                if (q.trim().length < 2) return results.replaceChildren();
                t = setTimeout(async () => {
                  results.replaceChildren(loader());
                  try {
                    const j = await api({ action: 'query', list: 'search', srsearch: q.trim(), srlimit: '20', srnamespace: '0' });
                    const hits = (j.query?.search || []).filter((r) => !r.title.includes('/'));
                    results.replaceChildren(...(hits.length ? hits.map((r) => bookRow(r.title, '')) : [h('p', { class: 'empty' }, 'Nothing found.')]));
                  } catch (e) { results.replaceChildren(h('p', { class: 'empty' }, e.message)); }
                }, 400);
              }
            }), results);
          }
        }
      ],
      active: tab,
      onChange: (id) => go(`#/app/books/${id}`, { replace: true })
    });
    return screenOf(pv, appbar({ buttons: [], menu: [{ label: 'about Books', onClick: () => go('#/info/books') }] }));
  }

  function reader(title) {
    view = 'reader';
    const author = SHELF.find(([t]) => t === title)?.[1] || progress()[title]?.author || '';
    const saved = progress()[title];
    let list = [];
    let index = saved?.chapter || 0;
    const size = () => store.get('books.size') || 19;
    const body = h('div', { class: 'md', style: { fontFamily: '"Literata", Georgia, serif', lineHeight: 1.7 } }, loader());
    const heading = h('p', { class: 'meta-line' });
    const page = h('div', { class: 'page has-appbar' }, h('p', { class: 'app-title' }, title.replace(/\s*\(.*?\)\s*/g, ' ').trim()), heading, body);
    const applySize = () => { body.style.fontSize = `${size()}px`; };
    applySize();
    if (!document.querySelector('link[data-literata]')) {
      document.head.append(h('link', { rel: 'stylesheet', 'data-literata': '', href: 'https://fonts.googleapis.com/css2?family=Literata:ital,opsz,wght@0,7..72,400;0,7..72,600;1,7..72,400&display=swap' }));
    }
    let t = 0;
    page.addEventListener('scroll', () => {
      clearTimeout(t);
      t = setTimeout(() => saveProgress(title, author, index, list.length, page.scrollTop / Math.max(1, page.scrollHeight - page.clientHeight)), 400);
    });
    async function show(i, restore = 0) {
      index = Math.max(0, Math.min(i, list.length - 1));
      body.replaceChildren(loader());
      heading.textContent = list.length > 1 ? `${list[index].split('/').pop()} · ${index + 1} of ${list.length}` : author;
      try {
        const text = await readPage(list[index]);
        body.replaceChildren(text, h('div', { class: 'btn-row', style: { marginTop: '24px' } },
          index > 0 ? h('button', { class: 'btn', type: 'button', onclick: () => show(index - 1) }, 'previous') : null,
          index < list.length - 1 ? h('button', { class: 'btn btn--accent', type: 'button', onclick: () => show(index + 1) }, 'next chapter') : h('p', { class: 'hint' }, 'The end.')));
        page.scrollTop = restore ? restore * (page.scrollHeight - page.clientHeight) : 0;
        saveProgress(title, author, index, list.length, restore);
      } catch (e) {
        body.replaceChildren(h('p', { class: 'empty' }, e.message));
      }
    }
    chapters(title).then((l) => { list = l; show(index, saved?.scroll || 0); }).catch((e) => body.replaceChildren(h('p', { class: 'empty' }, e.message)));
    return screenOf(page, appbar({
      buttons: [
        { icon: 'fa-solid fa-chevron-left', label: 'previous', onClick: () => index > 0 && show(index - 1) },
        { icon: 'fa-solid fa-font', label: 'text size', onClick: () => { store.set('books.size', size() >= 25 ? 16 : size() + 3); applySize(); } },
        { icon: 'fa-solid fa-chevron-right', label: 'next', onClick: () => index < list.length - 1 && show(index + 1) }
      ],
      menu: [{ label: 'open on Wikisource', onClick: () => window.open(`https://en.wikisource.org/wiki/${encodeURIComponent(list[index] || title)}`, '_blank', 'noopener') }]
    }));
  }

  const route = pageRouter(el, (sub) => {
    if (sub[0] === 'read' && sub[1]) return reader(decodeURIComponent(sub.slice(1).join('/')));
    if (sub[0] === 'continue') {
      const last = lastBook();
      if (last) return reader(last.title);
      ctx.toast('Nothing on the go yet. Pick a book to start.');
    }
    const tab = sub[0] === 'search' ? 'search' : 'library';
    if (view === 'main' && pv) { pv.select(tab, true); return null; }
    return main(tab);
  });

  return { route };
}
