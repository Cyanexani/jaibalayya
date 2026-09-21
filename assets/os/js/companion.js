/* The companion panel beside the phone on wide screens. It turns whatever
   is open on the phone into a readable web page: the app's overview,
   what's new, what improved, what was removed, what's coming, history. */

import { h } from './util.js';
import { byId, iconHtml, statusLong, statusText } from './registry.js';
import { loadApp, loadOS } from './content.js';
import { REPO_URL } from './config.js';

const panel = document.getElementById('companion');
let token = 0;
let last = null;
let shownDoc = null;

const visible = () => panel && getComputedStyle(panel).display !== 'none';

export async function updateCompanion(route) {
  last = route;
  if (!visible()) return;
  const my = ++token;
  const [a, b, c] = route.parts;
  const app = (a === 'app' || a === 'info') ? byId(b) : null;
  const isOS = !app || app.id === 'hub';
  const docId = isOS ? 'os' : app.id;
  const sectionId = isOS ? (app?.id === 'hub' ? c : null) : (a === 'info' ? c : null);

  if (shownDoc !== docId) {
    const doc = isOS ? await loadOS() : await loadApp(app.id);
    if (my !== token) return;
    panel.replaceChildren(isOS ? renderOS(doc) : renderApp(app, doc));
    panel.scrollTop = 0;
    shownDoc = docId;
  }
  highlight(sectionId);
}

function highlight(id) {
  for (const a of panel.querySelectorAll('.cmp__toc a')) a.classList.toggle('is-active', a.dataset.section === id);
  if (id) panel.querySelector(`#cmp-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function sections(doc, hrefFor) {
  return [
    h('nav', { class: 'cmp__toc', 'aria-label': 'Sections' },
      doc.sections.map((s) => h('a', { href: hrefFor(s.id), 'data-section': s.id }, s.title))),
    ...doc.sections.map((s) => h('section', { class: 'cmp__section', id: `cmp-${s.id}` },
      h('h2', {}, s.title),
      h('div', { class: 'md', html: s.html })))
  ];
}

function tips() {
  return h('div', { class: 'cmp__tips' },
    h('b', {}, 'Using the phone: '),
    'tap a tile to open it. ', h('b', {}, 'Hold'), ' a tile (or right-click it) for its shortcuts. ',
    h('b', {}, 'Hold and drag'), ' to move it. Swipe left, or press the arrow under the tiles, for all apps. ',
    'Pull down from the top for the action center. ', h('kbd', {}, 'Esc'), ' goes back, ', h('kbd', {}, '/'), ' searches.');
}

function foot() {
  return h('p', { class: 'cmp__foot' },
    'Metro OS is an independent project and is not affiliated with Microsoft. Icons by ',
    h('a', { href: 'https://fontawesome.com/license/free', target: '_blank', rel: 'noopener' }, 'Font Awesome Free'),
    ' (CC BY 4.0). Type set in Noto Sans (SIL OFL). ',
    h('a', { href: REPO_URL, target: '_blank', rel: 'noopener' }, 'Source on GitHub'), '.');
}

function renderOS(doc) {
  return h('article', {},
    h('nav', { class: 'cmp__crumbs' }, h('a', { href: '#/' }, 'Metro OS'), h('span', {}, '/'), h('a', { href: '#/apps' }, 'all apps')),
    h('header', { class: 'cmp__head' },
      h('div', { class: 'cmp__icon', html: iconHtml(byId('hub')) }),
      h('h1', { class: 'cmp__title' }, 'Metro OS')),
    h('div', { class: 'cmp__meta' },
      doc.versions[0] ? h('span', { class: 'chip' }, doc.versions[0].version) : null,
      h('span', {}, 'A working Metro phone, in your browser')),
    doc.meta.summary ? h('p', { class: 'cmp__summary' }, doc.meta.summary) : null,
    tips(),
    h('div', { style: { height: '24px' } }),
    ...sections(doc, (id) => `#/app/hub/${id}`),
    foot());
}

function renderApp(app, doc) {
  return h('article', {},
    h('nav', { class: 'cmp__crumbs' },
      h('a', { href: '#/' }, 'Metro OS'), h('span', {}, '/'),
      h('a', { href: '#/apps' }, 'all apps'), h('span', {}, '/'),
      h('a', { href: `#/info/${app.id}` }, app.name)),
    h('header', { class: 'cmp__head' },
      h('div', { class: 'cmp__icon', html: iconHtml(app) }),
      h('h1', { class: 'cmp__title' }, app.name)),
    h('div', { class: 'cmp__meta' },
      h('span', { class: app.built ? 'chip' : 'chip chip--soon' }, statusText(app)),
      h('span', {}, statusLong(app)),
      doc.draft ? h('span', {}, '· draft notes') : null),
    doc.meta.summary ? h('p', { class: 'cmp__summary' }, doc.meta.summary) : null,
    ...sections(doc, (id) => `#/info/${app.id}/${id}`),
    foot());
}

// Re-render when the window grows wide enough to show the panel.
let wasVisible = visible();
window.addEventListener('resize', () => {
  const v = visible();
  if (v && !wasVisible && last) { shownDoc = null; updateCompanion(last); }
  wasVisible = v;
});
