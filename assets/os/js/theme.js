/* Applies theme settings to the document: light/dark, accent colour,
   font, tile density and style, wallpaper, motion and brightness. */

import { store, watch, ACCENTS, getWallpaperImage } from './store.js';

export const FONTS = {
  noto: { label: 'Noto Sans', family: '"Noto Sans"', css: 'Noto+Sans:ital,wght@0,300;0,400;0,600;0,700;1,400' },
  open: { label: 'Open Sans', family: '"Open Sans"', css: 'Open+Sans:ital,wght@0,300;0,400;0,600;0,700;1,400' },
  inter: { label: 'Inter', family: '"Inter"', css: 'Inter:wght@300;400;600;700' },
  segoe: { label: 'Segoe UI (if your computer has it)', family: '"Segoe UI"', css: null }
};

export const WALLPAPERS = {
  none: { label: 'none', css: 'none' },
  wave: {
    label: 'wave',
    css: 'radial-gradient(120% 70% at 85% 100%, #2f6bff 0%, transparent 60%), radial-gradient(90% 60% at 0% 35%, #0c2d91 0%, transparent 70%), radial-gradient(60% 40% at 60% 55%, #1b4fe0 0%, transparent 70%), linear-gradient(165deg, #01030c 0%, #081a55 50%, #1847d8 100%)'
  },
  aurora: {
    label: 'aurora',
    css: 'radial-gradient(90% 60% at 20% 20%, #00b4a0 0%, transparent 60%), radial-gradient(80% 60% at 90% 70%, #6a2cff 0%, transparent 65%), linear-gradient(180deg, #02060a, #071a24 60%, #0d0b2a)'
  },
  ember: {
    label: 'ember',
    css: 'radial-gradient(100% 70% at 80% 90%, #ff5a1f 0%, transparent 60%), radial-gradient(70% 50% at 10% 30%, #a20025 0%, transparent 70%), linear-gradient(180deg, #0b0203, #2a0608 60%, #5a1405)'
  },
  dusk: {
    label: 'dusk',
    css: 'radial-gradient(90% 60% at 70% 20%, #d80073 0%, transparent 60%), radial-gradient(90% 70% at 10% 90%, #3a1c8f 0%, transparent 70%), linear-gradient(180deg, #0a0414, #1d0b35 60%, #32104a)'
  },
  accent: {
    label: 'accent glow',
    css: 'radial-gradient(100% 70% at 80% 100%, var(--accent) 0%, transparent 65%), linear-gradient(170deg, #000 30%, color-mix(in srgb, var(--accent) 45%, #000))'
  },
  photo: { label: 'my photo', css: null }
};

const loadedFonts = new Set(['noto']);
const root = document.documentElement;
const reduceQuery = matchMedia('(prefers-reduced-motion: reduce)');

/** True when the device (e.g. Windows "Animation effects" off) asks for less motion. */
export const deviceWantsLessMotion = () => reduceQuery.matches;

/** 'full' or 'reduced', after resolving "follow my device". */
export function motionMode() {
  const m = store.get('motion');
  if (m === 'full' || m === 'reduced') return m;
  return reduceQuery.matches ? 'reduced' : 'full';
}

export const accentHex = (name) => ACCENTS[name] || name || ACCENTS.cyan;

function wallpaperCss(name) {
  if (name === 'photo') {
    const img = getWallpaperImage();
    return img ? `url("${img}")` : WALLPAPERS.wave.css;
  }
  return (WALLPAPERS[name] || WALLPAPERS.none).css;
}

export function lockBackground() {
  const lock = store.get('lock');
  if (lock.background === 'color') return accentHex(lock.color);
  const wall = store.get('wallpaper');
  return wall === 'none' ? WALLPAPERS.wave.css : wallpaperCss(wall);
}

function applyFont() {
  const key = store.get('font');
  const f = FONTS[key] || FONTS.noto;
  if (f.css && !loadedFonts.has(key)) {
    loadedFonts.add(key);
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${f.css}&display=swap`;
    document.head.append(link);
  }
  root.style.setProperty('--font', `${f.family}, "Noto Sans", "Segoe UI", system-ui, sans-serif`);
}

export function applyTheme() {
  root.dataset.theme = store.get('theme');
  root.style.setProperty('--accent', accentHex(store.get('accent')));
  root.dataset.cols = store.get('moreTiles') ? '6' : '4';
  root.dataset.tiles = store.get('tileStyle');
  root.dataset.motion = motionMode();
  root.style.setProperty('--wallpaper', wallpaperCss(store.get('wallpaper')));
  root.style.setProperty('--dim', String(1 - (store.get('brightness') ?? 1)));
  applyFont();
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = store.get('theme') === 'light' ? '#ffffff' : '#000000';
}

export function initTheme() {
  applyTheme();
  for (const key of ['theme', 'accent', 'font', 'moreTiles', 'tileStyle', 'wallpaper', 'motion', 'brightness']) {
    watch(key, applyTheme);
  }
  reduceQuery.addEventListener?.('change', applyTheme);
}
