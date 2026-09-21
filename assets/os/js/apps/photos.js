/* Photos: pictures and videos from the Camera, ones you add from your
   device, and a few samples. Everything stays in this browser. */

import { h, on } from '../util.js';
import { pivot, appbar, pageRouter, screenOf, dialog } from '../controls.js';
import { files, blobUrl, pickFiles, download } from '../db.js';
import { store, setWallpaperImage } from '../store.js';
import { pushOverlay } from '../overlays.js';

const SAMPLES = [1, 2, 3, 4, 5, 6].map((n) => ({ id: `sample-${n}`, kind: 'photo', name: `Sample ${n}`, src: `assets/img/pic-${n}.webp`, sample: true, created: 0 }));
const srcOf = (p) => p.src || blobUrl(p);

export async function allPhotos() {
  const own = [...(await files.list('photo')), ...(await files.list('video'))].sort((a, b) => b.created - a.created);
  return [...own, ...SAMPLES];
}

/** Downscale an image source to a data URL small enough for a wallpaper. */
function toWallpaper(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const k = Math.min(1, 1280 / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k);
      c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      resolve(c.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

export default function mount(ctx) {
  const { el, go } = ctx;
  let items = [];
  let pv = null;
  let onMain = false;

  async function add() {
    const picked = await pickFiles({ accept: 'image/*,video/*' });
    for (const f of picked) await files.put({ kind: f.type.startsWith('video/') ? 'video' : 'photo', name: f.name, mime: f.type, blob: f });
    if (picked.length) ctx.toast(`${picked.length} added`);
  }

  function grid(list) {
    if (!list.length) return h('p', { class: 'empty' }, h('b', {}, 'No photos yet'), 'Take one with Camera or add some from your device.');
    return h('div', { class: 'photo-grid' }, list.map((p) => h('button', { type: 'button', 'aria-label': p.name, onclick: () => openViewer(p.id) },
      p.kind === 'video' ? h('video', { src: srcOf(p), muted: true, preload: 'metadata' }) : h('img', { src: srcOf(p), alt: '', loading: 'lazy' }),
      p.kind === 'video' ? h('span', { class: 'badge' }, h('i', { class: 'fa-solid fa-play' })) : null)));
  }

  function main(tab) {
    const own = items.filter((p) => !p.sample);
    const camera = own.filter((p) => /^(IMG|VID)_/.test(p.name));
    const added = own.filter((p) => !/^(IMG|VID)_/.test(p.name));
    pv = pivot({
      appTitle: 'Photos',
      items: [
        { id: 'all', title: 'all', render: (p) => p.append(grid(items)) },
        {
          id: 'albums', title: 'albums', render: (p) => p.append(h('div', { class: 'album-grid' },
            [['camera roll', camera], ['added', added], ['samples', SAMPLES]].filter(([, l]) => l.length).map(([name, l]) => h('button', { type: 'button', onclick: () => go(`#/app/photos/album/${name.replace(' ', '-')}`) },
              l[0].kind === 'video' ? h('video', { src: srcOf(l[0]), muted: true, style: { width: '100%', aspectRatio: '1', objectFit: 'cover' } }) : h('img', { src: srcOf(l[0]), alt: '' }),
              h('b', {}, name), h('span', {}, `${l.length} item${l.length === 1 ? '' : 's'}`)))))
        }
      ],
      active: tab,
      onChange: (id) => go(`#/app/photos/${id}`, { replace: true })
    });
    return screenOf(pv, appbar({
      buttons: [
        { icon: 'fa-solid fa-plus', label: 'add', onClick: add },
        { icon: 'fa-solid fa-camera', label: 'camera', onClick: () => go('#/app/camera') }
      ],
      menu: [{ label: 'about Photos', onClick: () => go('#/info/photos') }]
    }));
  }

  function album(name) {
    const own = items.filter((p) => !p.sample);
    const list = name === 'camera-roll' ? own.filter((p) => /^(IMG|VID)_/.test(p.name)) : name === 'added' ? own.filter((p) => !/^(IMG|VID)_/.test(p.name)) : SAMPLES;
    return screenOf(h('div', { class: 'page' }, h('p', { class: 'app-title' }, 'Photos'), h('h1', { class: 'page-title' }, name.replace('-', ' ')), grid(list)));
  }

  /* ---------- viewer ---------- */
  function openViewer(id) {
    let i = Math.max(0, items.findIndex((p) => p.id === id));
    const media = h('div', { style: { display: 'contents' } });
    const cap = h('div', { class: 'viewer__cap' });
    const viewer = h('div', { class: 'viewer', role: 'dialog', 'aria-label': 'Photo' }, media, cap);
    const bar = appbar({
      buttons: [
        { icon: 'fa-solid fa-image', label: 'wallpaper', onClick: setWall },
        { icon: 'fa-solid fa-download', label: 'save', onClick: () => { const p = items[i]; if (p.sample) ctx.toast('Samples are part of Metro OS.'); else download(p); } },
        { icon: 'fa-solid fa-trash', label: 'delete', onClick: remove }
      ]
    });
    bar.style.zIndex = '31';
    const paint = () => {
      const p = items[i];
      media.replaceChildren(p.kind === 'video'
        ? h('video', { src: srcOf(p), controls: true, autoplay: true, playsinline: true })
        : h('img', { src: srcOf(p), alt: p.name }));
      cap.textContent = `${p.name}${p.created ? ` · ${new Date(p.created).toLocaleString()}` : ''} · ${i + 1} of ${items.length}`;
    };
    async function setWall() {
      const p = items[i];
      if (p.kind === 'video') return ctx.toast('Pick a photo for the wallpaper.');
      const url = await toWallpaper(srcOf(p));
      if (url && setWallpaperImage(url)) { store.set('wallpaper', 'photo'); ctx.toast('Set as wallpaper'); } else ctx.toast('Couldn’t use that photo.');
    }
    async function remove() {
      const p = items[i];
      if (p.sample) return ctx.toast('Samples can’t be deleted.');
      if (!(await dialog(el, { title: 'Delete this?', body: `${p.name} will be removed from this browser.`, ok: 'delete' }))) return;
      await files.remove(p.id);
      items.splice(i, 1);
      if (!items.length) return close();
      i = Math.min(i, items.length - 1);
      paint();
    }
    let sx = null;
    viewer.addEventListener('pointerdown', (e) => { sx = e.clientX; });
    viewer.addEventListener('pointerup', (e) => {
      if (sx == null) return;
      const dx = e.clientX - sx;
      sx = null;
      if (Math.abs(dx) > 50) { i = (i + (dx < 0 ? 1 : -1) + items.length) % items.length; paint(); }
    });
    const onKey = (e) => {
      if (e.key === 'ArrowRight') { i = (i + 1) % items.length; paint(); }
      if (e.key === 'ArrowLeft') { i = (i - 1 + items.length) % items.length; paint(); }
    };
    document.addEventListener('keydown', onKey);
    const pop = pushOverlay(close);
    function close() { pop(); document.removeEventListener('keydown', onKey); viewer.remove(); bar.remove(); }
    paint();
    el.append(viewer, bar);
  }

  const route = pageRouter(el, (sub) => {
    if (sub[0] === 'album') { onMain = false; return album(sub[1]); }
    const tab = sub[0] === 'albums' ? 'albums' : 'all';
    if (onMain && pv) { pv.select(tab, true); return null; }
    onMain = true;
    return main(tab);
  });

  let lastSub = [];
  async function refresh(sub = lastSub, opts = {}) {
    items = await allPhotos();
    onMain = false;
    route(sub, { dir: 0, ...opts, force: true });
  }
  const off = on('files', (d) => { if (!d.kind || d.kind === 'photo' || d.kind === 'video') refresh(); });

  return {
    async route(sub, opts) {
      lastSub = sub[0] === 'latest' || sub[0] === 'view' ? [] : sub;
      items = await allPhotos();
      route(lastSub, opts);
      if (sub[0] === 'latest' && items.length) openViewer(items[0].id);
      if (sub[0] === 'view' && sub[1]) openViewer(sub[1]);
    },
    destroy: off
  };
}
