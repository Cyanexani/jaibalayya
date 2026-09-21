/* YouTube Music connection: Google's browser sign-in (token client) with
   your own OAuth Client ID, read-only access to your YouTube playlists and
   liked videos. Playback uses YouTube's own embedded player. */

import { store } from './store.js';
import { emit } from './util.js';

const SCOPE = 'https://www.googleapis.com/auth/youtube.readonly';
const API = 'https://www.googleapis.com/youtube/v3';
let tokenClient = null;

export const clientId = () => store.get('ytmusic.clientId') || '';
export const setClientId = (id) => store.set('ytmusic.clientId', id.trim());

const tokenInfo = () => { try { return JSON.parse(sessionStorage.getItem('ytmusic.token') || 'null'); } catch { return null; } };
export const connected = () => { const t = tokenInfo(); return !!t && Date.now() < t.expires; };

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement('script');
    s.src = src; s.async = true;
    s.onload = resolve;
    s.onerror = () => reject(new Error('Couldn’t reach Google. Check your connection.'));
    document.head.append(s);
  });
}

export async function connect() {
  if (!clientId()) throw new Error('Add your Google OAuth Client ID first.');
  await loadScript('https://accounts.google.com/gsi/client');
  tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: clientId(),
    scope: SCOPE,
    callback: (resp) => {
      if (resp.error) { emit('ytmusic-error', resp.error); return; }
      sessionStorage.setItem('ytmusic.token', JSON.stringify({ access: resp.access_token, expires: Date.now() + (resp.expires_in - 60) * 1000 }));
      emit('ytmusic');
    }
  });
  tokenClient.requestAccessToken();
}

export function disconnect() {
  const t = tokenInfo();
  if (t && window.google?.accounts?.oauth2) window.google.accounts.oauth2.revoke(t.access, () => {});
  sessionStorage.removeItem('ytmusic.token');
  emit('ytmusic');
}

async function api(path) {
  const t = tokenInfo();
  if (!t || Date.now() >= t.expires) { sessionStorage.removeItem('ytmusic.token'); emit('ytmusic'); throw new Error('Your Google sign-in expired. Connect again.'); }
  const r = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${t.access}` } });
  if (!r.ok) throw new Error(`YouTube said no (${r.status}).`);
  return r.json();
}

const item = (id, s) => ({ id, title: s.title, channel: s.videoOwnerChannelTitle || s.channelTitle || '', thumb: s.thumbnails?.medium?.url || s.thumbnails?.default?.url || '' });
export const playlists = () => api('/playlists?part=snippet,contentDetails&mine=true&maxResults=50')
  .then((j) => j.items.map((p) => ({ id: p.id, title: p.snippet.title, count: p.contentDetails.itemCount, thumb: p.snippet.thumbnails?.medium?.url || '' })));
export const playlistItems = (id) => api(`/playlistItems?part=snippet&maxResults=50&playlistId=${encodeURIComponent(id)}`)
  .then((j) => j.items.filter((i) => i.snippet.resourceId?.videoId).map((i) => item(i.snippet.resourceId.videoId, i.snippet)));
export const liked = () => api('/videos?part=snippet&myRating=like&maxResults=50').then((j) => j.items.map((v) => item(v.id, v.snippet)));

/* ---------- the embedded player ---------- */
let ytReady = null;
export function loadPlayerApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (!ytReady) {
    ytReady = new Promise((resolve) => {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => { prev?.(); resolve(window.YT); };
      loadScript('https://www.youtube.com/iframe_api');
    });
  }
  return ytReady;
}
