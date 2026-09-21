/* Internet radio from the free, community-run Radio Browser directory.
   Only https streams are used, so they play on an https site. */

import { emit, on } from './util.js';
import { store } from './store.js';

const SERVERS = ['https://de1.api.radio-browser.info', 'https://fi1.api.radio-browser.info', 'https://nl1.api.radio-browser.info'];
const audio = new Audio();
audio.preload = 'none';
let current = store.get('radio.last') || null;
let loading = false;

async function api(path) {
  for (const base of SERVERS) {
    try {
      const r = await fetch(`${base}/json/${path}`);
      if (r.ok) return (await r.json()).filter((s) => (s.url_resolved || '').startsWith('https://'));
    } catch { /* try the next server */ }
  }
  throw new Error('The radio directory is unreachable right now.');
}

const slim = (s) => ({ id: s.stationuuid, name: s.name.trim(), url: s.url_resolved, icon: s.favicon || '', country: s.country, tags: (s.tags || '').split(',').slice(0, 3).join(', '), codec: s.codec, bitrate: s.bitrate });

export const top = () => api('stations/topclick/60?hidebroken=true').then((l) => l.map(slim));
export const search = (q) => api(`stations/search?name=${encodeURIComponent(q)}&limit=60&hidebroken=true&order=clickcount&reverse=true`).then((l) => l.map(slim));
export const byCountry = (cc) => api(`stations/bycountrycodeexact/${encodeURIComponent(cc)}?limit=60&hidebroken=true&order=clickcount&reverse=true`).then((l) => l.map(slim));
export const byTag = (tag) => api(`stations/bytagexact/${encodeURIComponent(tag)}?limit=60&hidebroken=true&order=clickcount&reverse=true`).then((l) => l.map(slim));

export const radio = {
  get station() { return current; },
  get playing() { return !audio.paused; },
  get loading() { return loading; },
  async play(station) {
    if (station) {
      current = station;
      store.set('radio.last', station);
      audio.src = station.url;
    }
    if (!current) return;
    if (!audio.src) audio.src = current.url;
    loading = true;
    emit('radio');
    try { await audio.play(); } catch { emit('radio-error', current); }
    loading = false;
    emit('radio');
  },
  pause() { audio.pause(); },
  toggle() { this.playing ? this.pause() : this.play(); }
};

export const favourites = () => store.get('radio.favourites') || [];
export const isFavourite = (id) => favourites().some((s) => s.id === id);
export function toggleFavourite(station) {
  const list = favourites();
  store.set('radio.favourites', isFavourite(station.id) ? list.filter((s) => s.id !== station.id) : [station, ...list]);
  emit('radio');
}

audio.addEventListener('play', () => emit('media-start', 'radio'));
for (const ev of ['play', 'pause', 'error']) audio.addEventListener(ev, () => emit('radio'));
on('media-start', (who) => { if (who !== 'radio' && !audio.paused) audio.pause(); });

if ('mediaSession' in navigator) {
  audio.addEventListener('play', () => {
    navigator.mediaSession.metadata = new MediaMetadata({ title: current?.name || 'Radio', artist: current?.tags || 'Live radio', album: 'Metro OS Radio' });
  });
}
