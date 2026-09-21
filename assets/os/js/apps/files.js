/* Files: everything Metro OS keeps in this browser, by type. Open things
   in the right app, rename, save to your device, delete, or add files. */

import { h, on } from '../util.js';
import { pivot, appbar, header, pageRouter, screenOf, dialog, promptDialog, button } from '../controls.js';
import { files, blobUrl, download, bytes, kindOf, pickFiles } from '../db.js';
import { contextMenu } from '../contextmenu.js';
import { player, loadLibrary } from '../music.js';
import { readTags } from '../id3.js';
import { pushOverlay } from '../overlays.js';

const KINDS = [
  ['all', 'all', null],
  ['documents', 'documents', 'document'],
  ['photos', 'photos', 'photo'],
  ['music', 'music', 'music'],
  ['recordings', 'recordings', 'recording'],
  ['videos', 'videos', 'video'],
  ['other', 'other', 'other']
];
const ICON = { document: 'fa-file-lines', photo: 'fa-image', music: 'fa-music', recording: 'fa-microphone', video: 'fa-film', other: 'fa-file' };

export default function mount(ctx) {
  const { el, go, screen } = ctx;
  let all = [];
  let pv = null;
  let onMain = false;

  async function add() {
    const picked = await pickFiles();
    for (const f of picked) {
      const kind = kindOf(f.type, f.name);
      if (kind === 'document') await files.put({ kind, name: f.name, mime: f.type || 'text/plain', text: await f.text() });
      else if (kind === 'music') { const tags = await readTags(f); await files.put({ kind, name: f.name, mime: f.type, blob: f, meta: tags }); }
      else await files.put({ kind, name: f.name, mime: f.type, blob: f });
    }
    if (picked.length) ctx.toast(`${picked.length} file${picked.length === 1 ? '' : 's'} added`);
  }

  async function open(r) {
    if (r.kind === 'document') return go(`#/app/documents/${r.id}`);
    if (r.kind === 'photo' || r.kind === 'video') return go(`#/app/photos/view/${r.id}`);
    if (r.kind === 'music') { await loadLibrary(); player.setQueue([r.id], 0); return go('#/app/music/now-playing'); }
    if (r.kind === 'recording') return preview(r, 'audio');
    download(r);
  }

  function preview(r, tag) {
    const media = h(tag, { src: blobUrl(r), controls: true, autoplay: true });
    const box = h('div', { class: 'viewer', role: 'dialog', 'aria-label': r.name }, h('div', { class: 'viewer__cap' }, r.name), media);
    box.addEventListener('click', (e) => { if (e.target === box) close(); });
    const pop = pushOverlay(close);
    function close() { pop(); media.pause?.(); box.remove(); }
    el.append(box);
  }

  function menu(r, anchor) {
    contextMenu({
      screen, anchor, items: [
        { label: 'open', action: () => open(r) },
        { label: 'rename', action: async () => { const name = await promptDialog(el, { title: 'Rename', value: r.name }); if (name) files.update(r.id, { name }); } },
        { label: 'save to device', action: () => download(r) },
        { label: 'delete', action: async () => { if (await dialog(el, { title: 'Delete this file?', body: `${r.name} will be removed from this browser.`, ok: 'delete' })) files.remove(r.id); } }
      ]
    });
  }

  function rows(list) {
    if (!list.length) return [h('p', { class: 'empty' }, h('b', {}, 'Nothing here yet'), 'Things you make in Metro OS apps show up here. Tap + to add files from your device.')];
    return list.map((r) => {
      const thumb = r.kind === 'photo' ? h('img', { src: blobUrl(r), alt: '', loading: 'lazy' }) : h('i', { class: `fa-solid ${ICON[r.kind] || ICON.other}` });
      const row = h('button', { class: 'list-row', type: 'button', onclick: () => open(r) },
        h('span', { class: 'list-row__icon' }, thumb),
        h('span', { class: 'list-row__body' }, h('b', {}, r.name), h('span', {}, `${r.kind} · ${bytes(r.size)} · ${new Date(r.modified || r.created).toLocaleDateString()}`)));
      row.addEventListener('contextmenu', (e) => { e.preventDefault(); menu(r, row); });
      let t = 0;
      row.addEventListener('pointerdown', () => { t = setTimeout(() => { row.dataset.held = '1'; menu(r, row); }, 450); });
      row.addEventListener('pointerup', () => clearTimeout(t));
      row.addEventListener('pointerleave', () => clearTimeout(t));
      row.addEventListener('click', (e) => { if (row.dataset.held) { e.stopImmediatePropagation(); delete row.dataset.held; } }, true);
      return row;
    });
  }

  function main(tab) {
    pv = pivot({
      appTitle: 'Files',
      items: KINDS.map(([id, title, kind]) => ({ id, title, render: (p) => p.append(...rows(kind ? all.filter((r) => r.kind === kind) : all)) })),
      active: tab,
      onChange: (id) => go(`#/app/files/${id}`, { replace: true })
    });
    return screenOf(pv, appbar({
      buttons: [
        { icon: 'fa-solid fa-plus', label: 'add files', onClick: add },
        { icon: 'fa-solid fa-file-circle-plus', label: 'new document', onClick: () => go('#/app/documents/new') },
        { icon: 'fa-solid fa-hard-drive', label: 'storage', onClick: () => go('#/app/files/storage') }
      ],
      menu: [{ label: 'about Files', onClick: () => go('#/info/files') }]
    }));
  }

  function storagePage() {
    const usage = h('p', { class: 'lede' }, 'Checking…');
    const barFill = h('i', { style: { width: '0%' } });
    const byKind = h('div');
    const persisted = h('p', { class: 'hint' });
    navigator.storage?.estimate?.().then(({ usage: u = 0, quota = 0 }) => {
      usage.textContent = `${bytes(u)} used${quota ? ` of ${bytes(quota)} this browser allows` : ''}`;
      if (quota) barFill.style.width = `${Math.max(1, (u / quota) * 100)}%`;
    });
    const totals = {};
    for (const r of all) totals[r.kind] = (totals[r.kind] || 0) + (r.size || 0);
    byKind.append(...Object.entries(totals).map(([k, n]) => h('div', { class: 'list-row', style: { cursor: 'default' } },
      h('span', { class: 'list-row__icon' }, h('i', { class: `fa-solid ${ICON[k] || ICON.other}` })),
      h('span', { class: 'list-row__body' }, h('b', {}, k), h('span', {}, `${all.filter((r) => r.kind === k).length} items`)),
      h('span', { class: 'list-row__end' }, bytes(n)))));
    const paintPersist = () => navigator.storage?.persisted?.().then((p) => { persisted.textContent = p ? 'Your files are kept: the browser won’t clear them to free up space.' : 'The browser may clear these files if it runs low on space.'; });
    paintPersist();
    return screenOf(h('div', { class: 'page' },
      header('Files', 'storage'),
      usage, h('div', { class: 'storage-bar' }, barFill),
      byKind.childElementCount ? byKind : h('p', { class: 'hint' }, 'Nothing stored yet.'),
      h('h2', { class: 'group-title' }, 'keep my files'),
      persisted,
      h('div', { class: 'btn-row' }, button('ask the browser to keep them', () => navigator.storage?.persist?.().then((ok) => { ctx.toast(ok ? 'Files will be kept' : 'The browser said no. It may ask again later.'); paintPersist(); })))));
  }

  const route = pageRouter(el, (sub) => {
    if (sub[0] === 'storage') { onMain = false; return storagePage(); }
    const tab = sub[0] === 'recent' ? 'all' : KINDS.some(([id]) => id === sub[0]) ? sub[0] : 'all';
    if (onMain && pv) { pv.select(tab, true); return null; }
    onMain = true;
    return main(tab);
  });

  let lastSub = [];
  const off = on('files', async () => { all = await files.list(); if (onMain) { onMain = false; route(lastSub, { dir: 0, force: true }); } });

  return {
    async route(sub, opts) {
      all = await files.list();
      lastSub = sub[0] === 'new' ? [] : sub;
      route(lastSub, opts);
      if (sub[0] === 'new') add();
    },
    destroy: off
  };
}
