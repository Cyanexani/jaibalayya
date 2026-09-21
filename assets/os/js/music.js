/* The music engine behind the Music app, its tile, its Bloom and the lock
   screen. Plays songs the user added (stored on this device). Emits
   'player' whenever anything changes. Uses the Media Session API so the
   system's media keys and lock screen controls work too. */

import { emit, on } from './util.js';
import { files, blobUrl, pickFiles } from './db.js';
import { readTags } from './id3.js';
import { store } from './store.js';

const FALLBACK_ART = [1, 2, 3, 4].map((n) => `assets/img/art-${n}.webp`);
const audio = new Audio();
audio.preload = 'metadata';

let library = [];         // music records, newest first
let loaded = false;

export const fallbackArt = (id = '') => FALLBACK_ART[[...id].reduce((a, c) => a + c.charCodeAt(0), 0) % FALLBACK_ART.length];

export function artFor(rec) {
  if (!rec) return FALLBACK_ART[0];
  if (rec.meta?.picture) {
    if (!rec._art) rec._art = URL.createObjectURL(rec.meta.picture);
    return rec._art;
  }
  return fallbackArt(rec.id);
}

export async function loadLibrary() {
  library = await files.list('music');
  loaded = true;
  emit('library');
  return library;
}
export const getLibrary = () => library;
on('files', (d) => { if (!d.kind || d.kind === 'music') loadLibrary(); });

export async function addSongs() {
  const picked = await pickFiles({ accept: 'audio/*' });
  let added = 0;
  for (const f of picked) {
    const tags = await readTags(f);
    await files.put({
      kind: 'music', name: f.name, mime: f.type || 'audio/mpeg', blob: f,
      meta: { title: tags.title, artist: tags.artist, album: tags.album, picture: tags.picture }
    });
    added++;
  }
  if (added) await loadLibrary();
  return added;
}

/* ------------------------------------------------------------------ */

export const player = {
  queue: [],       // record ids
  index: -1,
  get track() { return library.find((r) => r.id === this.queue[this.index]) || null; },
  get playing() { return !audio.paused && !audio.ended; },
  get elapsed() { return audio.currentTime || 0; },
  get duration() { return Number.isFinite(audio.duration) ? audio.duration : (this.track?.meta?.duration || 0); },
  get hasMusic() { return library.length > 0; },

  async setQueue(ids, start = 0, autoplay = true) {
    if (!loaded) await loadLibrary();
    this.queue = ids.filter((id) => library.some((r) => r.id === id));
    this.index = this.queue.length ? Math.min(start, this.queue.length - 1) : -1;
    await load(autoplay);
  },
  async playAll({ shuffle = false } = {}) {
    if (!loaded) await loadLibrary();
    const ids = library.map((r) => r.id);
    if (shuffle) ids.sort(() => Math.random() - 0.5);
    await this.setQueue(ids, 0, true);
  },
  toggle() {
    if (!this.track) return this.playAll();
    if (audio.paused) audio.play().catch(() => {});
    else audio.pause();
  },
  play() { if (this.track) audio.play().catch(() => {}); else this.playAll(); },
  pause() { audio.pause(); },
  async next() {
    if (!this.queue.length) return;
    this.index = (this.index + 1) % this.queue.length;
    await load(true);
  },
  async prev() {
    if (audio.currentTime > 3 || !this.queue.length) { audio.currentTime = 0; return; }
    this.index = (this.index - 1 + this.queue.length) % this.queue.length;
    await load(true);
  },
  seek(t) { if (Number.isFinite(t)) audio.currentTime = Math.max(0, Math.min(t, this.duration || t)); },
  move(from, to) {
    const id = this.queue[this.index];
    const [x] = this.queue.splice(from, 1);
    this.queue.splice(to, 0, x);
    this.index = this.queue.indexOf(id);
    saveState();
    emit('player');
  },
  async jump(i) { this.index = i; await load(true); }
};

async function load(autoplay) {
  const rec = player.track;
  if (!rec) {
    audio.removeAttribute('src');
    audio.load();
    emit('player');
    return;
  }
  audio.src = blobUrl(rec);
  saveState();
  setSession(rec);
  emit('player');
  if (autoplay) {
    try { await audio.play(); } catch { /* autoplay blocked until the user taps */ }
  }
}

function saveState() {
  store.set('music', { queue: player.queue, index: player.index });
}

function setSession(rec) {
  if (!('mediaSession' in navigator)) return;
  navigator.mediaSession.metadata = new MediaMetadata({
    title: rec.meta?.title || rec.name,
    artist: rec.meta?.artist || '',
    album: rec.meta?.album || '',
    artwork: [{ src: new URL(artFor(rec), location.href).href, sizes: '512x512' }]
  });
}

if ('mediaSession' in navigator) {
  const ms = navigator.mediaSession;
  ms.setActionHandler('play', () => player.play());
  ms.setActionHandler('pause', () => player.pause());
  ms.setActionHandler('nexttrack', () => player.next());
  ms.setActionHandler('previoustrack', () => player.prev());
  try { ms.setActionHandler('seekto', (d) => player.seek(d.seekTime)); } catch { /* older browsers */ }
}

let lastTick = 0;
audio.addEventListener('timeupdate', () => {
  const now = performance.now();
  if (now - lastTick > 900) { lastTick = now; emit('player'); }
});
for (const ev of ['play', 'pause', 'loadedmetadata']) audio.addEventListener(ev, () => emit('player'));
audio.addEventListener('loadedmetadata', () => {
  const rec = player.track;
  if (rec && !rec.meta?.duration && Number.isFinite(audio.duration)) {
    files.update(rec.id, { meta: { ...rec.meta, duration: audio.duration } });
  }
});
audio.addEventListener('ended', () => { if (player.index < player.queue.length - 1) player.next(); else emit('player'); });

/* restore the last queue (paused) */
loadLibrary().then(() => {
  const saved = store.get('music');
  if (saved?.queue?.length) {
    player.queue = saved.queue.filter((id) => library.some((r) => r.id === id));
    player.index = Math.min(saved.index ?? 0, player.queue.length - 1);
    if (player.track) { audio.src = blobUrl(player.track); setSession(player.track); }
    emit('player');
  }
});

export const fmt = (s) => {
  s = Math.max(0, Math.floor(s || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
