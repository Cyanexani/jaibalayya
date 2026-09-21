/* Podcasts engine: search and episodes come from Apple's public podcast
   directory; audio streams straight from each show's host. Remembers where
   you stopped in every episode. */

import { emit, on } from './util.js';
import { store } from './store.js';

const audio = new Audio();
audio.preload = 'metadata';
let current = store.get('podcasts.current') || null;

export async function searchShows(q) {
  const r = await fetch(`https://itunes.apple.com/search?media=podcast&entity=podcast&limit=30&term=${encodeURIComponent(q)}`);
  if (!r.ok) throw new Error('Podcast search is unavailable right now.');
  const j = await r.json();
  return j.results.map((s) => ({ id: String(s.collectionId), title: s.collectionName, author: s.artistName, art: s.artworkUrl600 || s.artworkUrl100, genre: s.primaryGenreName }));
}

export async function episodes(showId, limit = 40) {
  const r = await fetch(`https://itunes.apple.com/lookup?id=${encodeURIComponent(showId)}&entity=podcastEpisode&limit=${limit}`);
  if (!r.ok) throw new Error('Couldn’t load episodes.');
  const j = await r.json();
  const [show, ...eps] = j.results;
  return {
    show: show ? { id: String(show.collectionId), title: show.collectionName, author: show.artistName, art: show.artworkUrl600 || show.artworkUrl100 } : null,
    episodes: eps.filter((e) => e.episodeUrl).map((e) => ({
      id: String(e.trackId), title: e.trackName, date: e.releaseDate, url: e.episodeUrl,
      length: Math.round((e.trackTimeMillis || 0) / 1000), text: (e.description || e.shortDescription || '').slice(0, 400),
      show: e.collectionName, showId: String(e.collectionId), art: e.artworkUrl600 || e.artworkUrl160
    }))
  };
}

export const following = () => store.get('podcasts.following') || [];
export const isFollowing = (id) => following().some((s) => s.id === id);
export function toggleFollow(show) {
  store.set('podcasts.following', isFollowing(show.id) ? following().filter((s) => s.id !== show.id) : [show, ...following()]);
  emit('podcasts-follow');
}

const positions = () => store.get('podcasts.positions') || {};
export const positionOf = (id) => positions()[id] || 0;

export const pod = {
  get episode() { return current; },
  get playing() { return !audio.paused; },
  get elapsed() { return audio.currentTime || positionOf(current?.id); },
  get duration() { return Number.isFinite(audio.duration) ? audio.duration : current?.length || 0; },
  get rate() { return audio.playbackRate; },
  async play(ep) {
    if (ep && ep.id !== current?.id) {
      current = ep;
      store.set('podcasts.current', ep);
      audio.src = ep.url;
      audio.currentTime = positionOf(ep.id);
    }
    if (!current) return;
    if (!audio.src) { audio.src = current.url; audio.currentTime = positionOf(current.id); }
    audio.playbackRate = store.get('podcasts.rate') || 1;
    try { await audio.play(); } catch { emit('podcast-error'); }
  },
  pause() { audio.pause(); },
  toggle() { this.playing ? this.pause() : this.play(); },
  skip(s) { audio.currentTime = Math.max(0, Math.min((audio.currentTime || 0) + s, this.duration || 1e9)); },
  seek(t) { audio.currentTime = t; },
  cycleRate() {
    const rates = [1, 1.25, 1.5, 2, 0.8];
    const next = rates[(rates.indexOf(audio.playbackRate) + 1) % rates.length] || 1;
    audio.playbackRate = next;
    store.set('podcasts.rate', next);
    emit('podcasts');
  }
};

let lastSave = 0;
audio.addEventListener('timeupdate', () => {
  const now = Date.now();
  if (now - lastSave > 4000 && current) {
    lastSave = now;
    store.set('podcasts.positions', { ...positions(), [current.id]: audio.currentTime });
  }
  emit('podcasts');
});
audio.addEventListener('play', () => {
  emit('media-start', 'podcasts');
  if ('mediaSession' in navigator && current) navigator.mediaSession.metadata = new MediaMetadata({ title: current.title, artist: current.show, artwork: current.art ? [{ src: current.art, sizes: '600x600' }] : [] });
});
for (const ev of ['play', 'pause', 'ended']) audio.addEventListener(ev, () => {
  if (current) store.set('podcasts.positions', { ...positions(), [current.id]: ev === 'ended' ? 0 : audio.currentTime });
  emit('podcasts');
});
on('media-start', (who) => { if (who !== 'podcasts' && !audio.paused) audio.pause(); });
