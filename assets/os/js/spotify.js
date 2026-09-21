/* Spotify connection using the sign-in flow designed for browsers
   (authorization code with PKCE): you paste your app's Client ID, no
   secret key is ever needed. Tokens stay in this browser. */

import { store } from './store.js';
import { emit } from './util.js';

const AUTH = 'https://accounts.spotify.com/authorize';
const TOKEN = 'https://accounts.spotify.com/api/token';
const API = 'https://api.spotify.com/v1';
const SCOPES = 'user-read-playback-state user-modify-playback-state user-read-currently-playing playlist-read-private user-library-read';

export const redirectUri = () => `${location.origin}${location.pathname}`;
export const clientId = () => store.get('spotify.clientId') || '';
export const setClientId = (id) => store.set('spotify.clientId', id.trim());
export const connected = () => !!store.get('spotify.token')?.refresh;

const b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const random = (n = 64) => b64url(crypto.getRandomValues(new Uint8Array(n))).slice(0, n);

export async function connect() {
  if (!clientId()) throw new Error('Add your Spotify Client ID first.');
  const verifier = random(64);
  const challenge = b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
  const state = `spotify-${random(16)}`;
  sessionStorage.setItem('spotify.verifier', verifier);
  sessionStorage.setItem('spotify.state', state);
  const q = new URLSearchParams({ response_type: 'code', client_id: clientId(), scope: SCOPES, redirect_uri: redirectUri(), code_challenge_method: 'S256', code_challenge: challenge, state });
  location.assign(`${AUTH}?${q}`);
}

/** Called at startup: finishes sign-in when Spotify sends the user back. */
export async function handleRedirect() {
  const q = new URLSearchParams(location.search);
  const state = q.get('state') || '';
  if (!state.startsWith('spotify-')) return false;
  const clean = () => history.replaceState(null, '', `${location.pathname}#/app/spotify`);
  if (q.get('error') || state !== sessionStorage.getItem('spotify.state')) { clean(); return 'declined'; }
  const body = new URLSearchParams({ grant_type: 'authorization_code', code: q.get('code'), redirect_uri: redirectUri(), client_id: clientId(), code_verifier: sessionStorage.getItem('spotify.verifier') || '' });
  const r = await fetch(TOKEN, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
  clean();
  if (!r.ok) return 'failed';
  saveToken(await r.json());
  return 'connected';
}

function saveToken(j) {
  const old = store.get('spotify.token') || {};
  store.set('spotify.token', { access: j.access_token, refresh: j.refresh_token || old.refresh, expires: Date.now() + (j.expires_in - 60) * 1000 });
  emit('spotify');
}

export function disconnect() { store.set('spotify.token', null); emit('spotify'); }

async function token() {
  const t = store.get('spotify.token');
  if (!t?.refresh) throw new Error('Not connected to Spotify.');
  if (Date.now() < t.expires) return t.access;
  const r = await fetch(TOKEN, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: t.refresh, client_id: clientId() }) });
  if (!r.ok) { disconnect(); throw new Error('Spotify signed you out. Connect again.'); }
  saveToken(await r.json());
  return store.get('spotify.token').access;
}

export async function api(path, { method = 'GET', body } = {}) {
  const r = await fetch(`${API}${path}`, { method, headers: { Authorization: `Bearer ${await token()}`, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  if (r.status === 204) return null;
  if (r.status === 404 && path.startsWith('/me/player')) throw new Error('No active Spotify device. Open Spotify on your phone or computer first.');
  if (r.status === 403 && path.startsWith('/me/player')) throw new Error('Controlling playback needs Spotify Premium.');
  if (!r.ok) throw new Error(`Spotify said no (${r.status}).`);
  const text = await r.text();
  return text ? JSON.parse(text) : null;
}

export const nowPlaying = () => api('/me/player?additional_types=track,episode');
export const playlists = () => api('/me/playlists?limit=50').then((j) => j.items);
export const liked = () => api('/me/tracks?limit=50').then((j) => j.items.map((i) => i.track));
export const control = (action) => api(`/me/player/${action}`, { method: action === 'next' || action === 'previous' ? 'POST' : 'PUT' });
export const playContext = (uri) => api('/me/player/play', { method: 'PUT', body: { context_uri: uri } });
export const playTracks = (uris, offset = 0) => api('/me/player/play', { method: 'PUT', body: { uris, offset: { position: offset } } });
