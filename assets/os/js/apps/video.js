/* Video: your own videos (from Camera or added in Files/Photos) and a set
   of openly licensed films from Wikimedia Commons (the Blender Foundation's
   open movies), with their credits. Picks up where you stopped. */

import { h, on } from '../util.js';
import { pivot, appbar, loader, pageRouter, screenOf } from '../controls.js';
import { files, blobUrl, pickFiles } from '../db.js';
import { store } from '../store.js';

const COMMONS = 'https://commons.wikimedia.org/w/api.php';
let openMovies = null;

async function loadOpenMovies() {
  if (openMovies) return openMovies;
  const q = new URLSearchParams({
    action: 'query', format: 'json', formatversion: '2', origin: '*',
    generator: 'search', gsrsearch: 'Blender Open Movie filetype:video', gsrnamespace: '6', gsrlimit: '24',
    prop: 'imageinfo', iiprop: 'url|extmetadata|mediatype|size', iiurlwidth: '640'
  });
  const r = await fetch(`${COMMONS}?${q}`);
  if (!r.ok) throw new Error('Wikimedia Commons is unreachable right now.');
  const j = await r.json();
  const strip = (html = '') => new DOMParser().parseFromString(html, 'text/html').body.textContent.trim();
  openMovies = (j.query?.pages || [])
    .map((p) => ({ p, ii: p.imageinfo?.[0] }))
    // Commons appends tracking parameters to URLs, so check the path, not the whole URL.
    .filter(({ ii }) => ii && ii.url && /\.(webm|ogv|mp4)$/i.test(new URL(ii.url).pathname))
    .map(({ p, ii }) => {
      const m = ii.extmetadata || {};
      return {
        id: `commons:${p.pageid}`,
        name: p.title.replace(/^File:/, '').replace(/\.(webm|ogv|mp4)$/i, '').replace(/\s*-\s*(Blender )?Open Movie.*$/i, '').trim(),
        src: ii.url, poster: ii.thumburl || '', page: ii.descriptionurl,
        credit: `${(strip(m.Artist?.value) || 'Blender Foundation').split(/[;\n]/)[0].slice(0, 60)} · ${strip(m.LicenseShortName?.value) || 'free licence'}`,
        length: ii.duration || 0
      };
    })
    .filter((v, i, all) => all.findIndex((x) => x.name.toLowerCase() === v.name.toLowerCase()) === i);
  return openMovies;
}

const positions = () => store.get('video.positions') || {};
export const lastWatched = () => store.get('video.last') || null;

export default function mount(ctx) {
  const { el, go } = ctx;
  let pv = null;
  let view = null;
  let playerEl = null;

  const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  function tileFor(v) {
    const pos = positions()[v.id];
    return h('button', { type: 'button', onclick: () => play(v) },
      v.poster ? h('img', { src: v.poster, alt: '', loading: 'lazy' }) : h('video', { src: v.src, muted: true, preload: 'metadata', style: { width: '100%', aspectRatio: '16/9', objectFit: 'cover', display: 'block' } }),
      h('b', {}, v.name),
      h('span', {}, pos && v.length ? `${fmt(Math.max(0, v.length - pos))} left` : v.credit || new Date(v.created).toLocaleDateString()));
  }

  async function mine() {
    return (await files.list('video')).map((r) => ({ id: r.id, name: r.name.replace(/\.[^.]+$/, ''), src: blobUrl(r), created: r.created, length: r.meta?.duration || 0 }));
  }

  function main(tab) {
    view = 'main';
    pv = pivot({
      appTitle: 'Video',
      items: [
        {
          id: 'mine', title: 'my videos', render: (pane) => {
            pane.append(loader());
            mine().then((list) => pane.replaceChildren(list.length
              ? h('div', { class: 'album-grid' }, list.map(tileFor))
              : h('p', { class: 'empty' }, h('b', {}, 'No videos yet'), 'Record one with Camera, or tap + to add one from your device.')));
          }
        },
        {
          id: 'open', title: 'open movies', render: (pane) => {
            pane.append(loader());
            loadOpenMovies().then((list) => pane.replaceChildren(
              h('p', { class: 'hint', style: { margin: '0 0 10px' } }, 'Freely licensed short films, most of them Blender open movies, streamed from Wikimedia Commons with their credits.'),
              h('div', { class: 'album-grid' }, list.map(tileFor))))
              .catch((e) => pane.replaceChildren(h('p', { class: 'empty' }, e.message)));
          }
        }
      ],
      active: tab,
      onChange: (id) => go(`#/app/video/${id}`, { replace: true })
    });
    return screenOf(pv, appbar({
      buttons: [{
        icon: 'fa-solid fa-plus', label: 'add video', onClick: async () => {
          const picked = await pickFiles({ accept: 'video/*' });
          for (const f of picked) await files.put({ kind: 'video', name: f.name, mime: f.type, blob: f });
          if (picked.length) { ctx.toast('Added'); view = null; route(['mine'], { dir: 0, force: true }); }
        }
      }],
      menu: [{ label: 'about Video', onClick: () => go('#/info/video') }]
    }));
  }

  function play(v) {
    store.set('video.last', { id: v.id, name: v.name, src: v.id.startsWith('commons:') ? v.src : null, poster: v.poster || '', credit: v.credit || '', page: v.page || '', length: v.length || 0 });
    playerEl?.remove();
    const video = h('video', { src: v.src, controls: true, autoplay: true, playsinline: true, poster: v.poster || null });
    const pos = positions()[v.id];
    video.addEventListener('loadedmetadata', () => { if (pos && pos < video.duration - 5) video.currentTime = pos; });
    let t = 0;
    video.addEventListener('timeupdate', () => {
      const now = Date.now();
      if (now - t > 3000) { t = now; store.set('video.positions', { ...positions(), [v.id]: video.currentTime }); }
    });
    video.addEventListener('ended', () => store.set('video.positions', { ...positions(), [v.id]: 0 }));
    video.addEventListener('play', () => window.dispatchEvent(new Event('metro:video-play')));
    const box = h('div', { class: 'viewer', role: 'dialog', 'aria-label': v.name },
      video,
      h('div', { class: 'viewer__cap' }, v.name, v.credit ? h('div', {}, v.credit, v.page ? ' · ' : '', v.page ? h('a', { href: v.page, target: '_blank', rel: 'noopener', style: { color: '#fff' } }, 'source') : null) : null));
    playerEl = box;
    el.append(box);
    const onBack = (e) => { e.preventDefault(); close(); };
    window.addEventListener('metro:back', onBack, true);
    function close() {
      window.removeEventListener('metro:back', onBack, true);
      store.set('video.positions', { ...positions(), [v.id]: video.currentTime });
      video.pause();
      box.remove();
      if (playerEl === box) playerEl = null;
    }
    box.addEventListener('click', (e) => { if (e.target === box) close(); });
  }

  const route = pageRouter(el, (sub) => {
    const tab = sub[0] === 'open' ? 'open' : 'mine';
    if (view === 'main' && pv) { pv.select(tab, true); return null; }
    return main(tab);
  });

  const off = on('files', (d) => { if (d.kind === 'video' && view === 'main') { view = null; route(['mine'], { dir: 0, force: true }); } });

  return {
    async route(sub, opts) {
      route(sub[0] === 'continue' || sub[0] === 'recent' ? ['mine'] : sub, opts);
      if (sub[0] === 'continue') {
        const last = lastWatched();
        if (!last) return ctx.toast('Nothing to continue yet.');
        if (last.src) return play(last);
        const r = await files.get(last.id);
        if (r) play({ id: r.id, name: last.name, src: blobUrl(r), length: last.length });
      }
    },
    hide() { playerEl?.querySelector('video')?.pause(); },
    destroy: off
  };
}
