/* Everything the OS remembers, kept in localStorage.
   store.get('lock.pin') / store.set('accent', 'lime') — every set() emits a
   'store' event so the shell can react. */

import { emit, on } from './util.js';

const KEY = 'metro-os:v1';
const WALL_KEY = 'metro-os:v1:wallpaper';

export const ACCENTS = {
  lime: '#a4c400', green: '#60a917', emerald: '#008a00', teal: '#00aba9',
  cyan: '#1ba1e2', cobalt: '#0050ef', indigo: '#6a00ff', violet: '#aa00ff',
  pink: '#f472d0', magenta: '#d80073', crimson: '#a20025', red: '#e51400',
  orange: '#fa6800', amber: '#f0a30a', yellow: '#e3c800', brown: '#825a2c',
  olive: '#6d8764', steel: '#647687', mauve: '#76608a', taupe: '#87794e'
};

export const DEFAULT_LAYOUT = [
  { id: 'hub', size: 'w' }, { id: 'clock', size: 'm' },
  { id: 'phone', size: 's' }, { id: 'messaging', size: 's' }, { id: 'weather', size: 'm' }, { id: 'calendar', size: 'm' },
  { id: 'mail', size: 's' }, { id: 'browser', size: 's' },
  { id: 'music', size: 'm' }, { id: 'photos', size: 'w' },
  { id: 'people', size: 'm' }, { id: 'camera', size: 's' }, { id: 'store', size: 's' }, { id: 'maps', size: 'm' },
  { id: 'notes', size: 's' }, { id: 'calculator', size: 's' },
  { id: 'radio', size: 's' }, { id: 'books', size: 's' }, { id: 'video', size: 's' },
  { id: 'recorder', size: 's' }, { id: 'settings', size: 's' }, { id: 'files', size: 's' }
];

const DEFAULTS = {
  theme: 'dark',
  accent: 'cyan',
  font: 'noto',
  moreTiles: true,
  tileStyle: 'solid',        // solid | app | glass
  wallpaper: 'none',          // none | wave | aurora | ember | dusk | accent | photo
  motion: 'full',             // full | reduced | system (follow the device's reduce-motion setting)
  brightness: 1,
  sound: true,
  lock: {
    onOpen: true,
    autoLock: false,
    pin: '',
    background: 'wallpaper',  // wallpaper | color
    color: 'cobalt',
    status: 'hub'
  },
  user: { name: '', place: '', lat: null, lon: null, units: 'metric' },
  layout: DEFAULT_LAYOUT,
  notifications: [],
  seen: {},
  setupDone: false,
  visits: 0
};

function isObj(v) { return v && typeof v === 'object' && !Array.isArray(v); }
function merge(base, over) {
  if (!isObj(over)) return base;
  for (const [k, v] of Object.entries(over)) base[k] = isObj(v) && isObj(base[k]) ? merge(base[k], v) : v;
  return base;
}
function read() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; }
}

const state = merge(structuredClone(DEFAULTS), read());
// 0.1 builds stored a reduceMotion boolean; carry it over once.
if (typeof state.reduceMotion === 'boolean') {
  if (state.reduceMotion) state.motion = 'reduced';
  delete state.reduceMotion;
}

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* private mode or full: keep going in memory */ }
}

export const store = {
  get(path) {
    return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), state);
  },
  set(path, value) {
    const keys = path.split('.');
    let o = state;
    for (const k of keys.slice(0, -1)) {
      if (!isObj(o[k])) o[k] = {};
      o = o[k];
    }
    o[keys.at(-1)] = value;
    save();
    emit('store', { path, value });
  },
  defaults: DEFAULTS,
  reset() {
    try { localStorage.removeItem(KEY); localStorage.removeItem(WALL_KEY); } catch { /* ignore */ }
    location.hash = '';
    location.reload();
  }
};

/** Run fn whenever a path (or anything under it) changes. */
export function watch(prefix, fn) {
  return on('store', ({ path, value }) => {
    if (path === prefix || path.startsWith(prefix + '.') || prefix.startsWith(path + '.')) fn(value, path);
  });
}

export function getWallpaperImage() {
  try { return localStorage.getItem(WALL_KEY) || ''; } catch { return ''; }
}
export function setWallpaperImage(dataUrl) {
  try { localStorage.setItem(WALL_KEY, dataUrl); return true; } catch { return false; }
}
