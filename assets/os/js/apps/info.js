/* An app's notes page: a pivot of the sections in content/apps/<id>.md
   (overview, what's new, improved, removed, coming next, known issues,
   history). Apps that haven't shipped yet open here instead. */

import { h, copyText, linkFor } from '../util.js';
import { loadApp } from '../content.js';
import { pivot, appbar, loader } from '../controls.js';
import { statusLong } from '../registry.js';
import { issueUrl } from '../config.js';

export default function mount(ctx) {
  const { el, app } = ctx;
  let doc = null;
  let pv = null;
  let wanted = null;
  let pending = false;
  let requested = '';
  let noticeEl = null;

  el.append(h('div', { class: 'page' }, h('p', { class: 'app-title' }, `${app.name} · notes`), loader()));

  const bar = appbar({
    buttons: [
      app.built ? { icon: 'fa-solid fa-arrow-up-right-from-square', label: 'open app', onClick: () => ctx.go(`#/app/${app.id}`) } : null,
      { icon: 'fa-solid fa-link', label: 'copy link', onClick: copy },
      { icon: 'fa-solid fa-comment-dots', label: 'feedback', onClick: () => window.open(issueUrl(`${app.name}: `), '_blank', 'noopener') }
    ].filter(Boolean),
    menu: [
      { label: 'notes for every app', onClick: () => ctx.go('#/app/hub/apps') },
      { label: 'Metro OS roadmap', onClick: () => ctx.go('#/app/hub/roadmap') }
    ]
  });

  function copy() {
    const id = doc?.sections[0] ? (wanted || doc.sections[0].id) : '';
    copyText(linkFor(`#/info/${app.id}${id ? '/' + id : ''}`)).then((ok) => ctx.toast(ok ? 'Link copied' : 'Couldn’t copy the link'));
  }

  function notice() {
    if (app.built && !pending) return null;
    const what = requested ? ` You asked for “${requested.replace(/[/-]/g, ' ')}”, which` : ' The app';
    return h('div', { class: 'notice' },
      h('b', {}, statusLong(app)),
      `${what} isn't built yet. Until it is, ${app.name} opens these notes so you can see what's planned.`);
  }

  loadApp(app.id).then((d) => {
    doc = d;
    const items = doc.sections.map((s, i) => ({
      id: s.id,
      title: s.title,
      render(pane) {
        if (i === 0) {
          noticeEl = h('div', {}, notice());
          pane.append(noticeEl);
          if (doc.draft) pane.append(h('p', { class: 'draft-badge' }, h('i', { class: 'fa-solid fa-pen-ruler' }), 'draft notes: to be replaced with the real ones'));
        }
        pane.append(h('div', { class: 'md', html: s.html }));
      }
    }));
    pv = pivot({
      appTitle: `${app.name} · notes`,
      items,
      active: wanted || items[0]?.id,
      onChange: (id) => { wanted = id; ctx.go(`#/info/${app.id}/${id}`, { replace: true }); }
    });
    el.replaceChildren(pv, bar);
  });

  return {
    route(sub, opts = {}) {
      wanted = sub[0] || null;
      pending = !!opts.pending;
      requested = opts.requested || '';
      if (noticeEl) noticeEl.replaceChildren(notice() || '');
      if (pv) pv.select(wanted || doc.sections[0]?.id, true);
    }
  };
}
