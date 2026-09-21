/* Documents: write plain-text documents, saved in this browser as you
   type. Export as .txt or .md. */

import { h, on } from '../util.js';
import { header, appbar, pageRouter, screenOf, dialog, enter } from '../controls.js';
import { files, download, bytes } from '../db.js';

const words = (s) => (s.trim() ? s.trim().split(/\s+/).length : 0);

export default function mount(ctx) {
  const { el, go } = ctx;
  let onList = false;

  async function listPage() {
    const docs = await files.list('document');
    const page = h('div', { class: 'page has-appbar' },
      header('Documents', 'documents'),
      docs.length
        ? docs.sort((a, b) => b.modified - a.modified).map((d) => h('button', { class: 'list-row', type: 'button', onclick: () => go(`#/app/documents/${d.id}`) },
          h('span', { class: 'list-row__icon' }, h('i', { class: 'fa-solid fa-file-lines' })),
          h('span', { class: 'list-row__body' }, h('b', {}, d.name.replace(/\.(md|txt)$/i, '')), h('span', {}, `${words(d.text || '')} words · ${new Date(d.modified).toLocaleString()}`))))
        : h('p', { class: 'empty' }, h('b', {}, 'No documents yet'), 'Tap + to start writing. Documents are saved in this browser as you type.'));
    return screenOf(page, appbar({
      buttons: [{ icon: 'fa-solid fa-plus', label: 'new', onClick: () => go('#/app/documents/new') }],
      menu: [{ label: 'all files', onClick: () => go('#/app/files/documents') }, { label: 'about Documents', onClick: () => go('#/info/documents') }]
    }));
  }

  async function editor(id) {
    let doc = await files.get(id);
    if (!doc) { ctx.toast('That document isn’t on this device.'); return listPage(); }
    const title = h('input', { class: 'doc-title', value: doc.name.replace(/\.(md|txt)$/i, ''), 'aria-label': 'Title', placeholder: 'Untitled' });
    const body = h('textarea', { 'aria-label': 'Document', placeholder: 'Start writing…' });
    body.value = doc.text || '';
    const status = h('p', { class: 'meta-line' });
    const paintStatus = (saved) => { status.textContent = `${words(body.value)} words · ${bytes(new Blob([body.value]).size)}${saved ? ' · saved' : ''}`; };
    paintStatus(true);
    let t = 0;
    const saveSoon = () => {
      clearTimeout(t);
      paintStatus(false);
      t = setTimeout(async () => {
        doc = await files.put({ ...doc, name: `${title.value.trim() || 'Untitled'}.md`, text: body.value });
        paintStatus(true);
      }, 400);
    };
    title.addEventListener('input', saveSoon);
    body.addEventListener('input', saveSoon);
    const wrap = screenOf(h('div', { class: 'doc-editor' }, h('p', { class: 'app-title' }, 'Documents'), title, status, body),
      appbar({
        buttons: [
          { icon: 'fa-solid fa-check', label: 'done', onClick: () => ctx.back() },
          { icon: 'fa-solid fa-download', label: 'export', onClick: () => download({ ...doc, name: `${title.value.trim() || 'Untitled'}.md`, text: body.value, mime: 'text/markdown' }) },
          { icon: 'fa-solid fa-trash', label: 'delete', onClick: async () => { if (await dialog(el, { title: 'Delete this document?', body: title.value || 'Untitled', ok: 'delete' })) { clearTimeout(t); await files.remove(doc.id); ctx.back(); } } }
        ],
        menu: [{ label: 'export as plain text (.txt)', onClick: () => download({ ...doc, name: `${title.value.trim() || 'Untitled'}.txt`, text: body.value, mime: 'text/plain' }) }]
      }));
    wrap.cleanup = async () => {
      clearTimeout(t);
      const current = await files.get(doc.id);
      if (!current) return;
      if (!title.value.trim() && !body.value.trim()) return files.remove(doc.id);
      if (current.text !== body.value || current.name !== `${title.value.trim() || 'Untitled'}.md`) files.put({ ...current, name: `${title.value.trim() || 'Untitled'}.md`, text: body.value });
    };
    setTimeout(() => (doc.text ? body : title).focus(), 320);
    return wrap;
  }

  // Pages load asynchronously: the router gets a holder right away, which is
  // filled once the page is ready (the holder stays the node it manages).
  const route = pageRouter(el, (sub) => {
    const holder = h('div', { class: 'subscreen' });
    const make = sub[0] && sub[0] !== 'recent' ? editor(sub[0]) : listPage();
    onList = !sub[0] || sub[0] === 'recent';
    make.then((node) => {
      holder.append(node);
      if (node.cleanup) holder.cleanup = node.cleanup;
      enter(node.querySelector('.page, .doc-editor') || node);
    });
    return holder;
  });

  const off = on('files', (d) => { if (onList && d.kind === 'document') route(['recent', Date.now()], { dir: 0, force: true }); });

  return {
    async route(sub, opts) {
      if (sub[0] === 'new') {
        const doc = await files.put({ kind: 'document', name: 'Untitled.md', mime: 'text/markdown', text: '' });
        return ctx.go(`#/app/documents/${doc.id}`, { replace: true });
      }
      route(sub, opts);
    },
    destroy: off
  };
}
