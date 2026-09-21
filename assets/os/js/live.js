/* Live content: what tiles show on their back face, and what the live
   Bloom shortcuts render. Everything returns plain DOM. */

import { h, clock, weekday, on } from './util.js';
import { player, TRACKS, PHOTOS, CONTACTS, THREAD, MAIL, initials, fmt } from './demo.js';
import { latestRelease } from './content.js';

const html = (markup) => { const t = document.createElement('template'); t.innerHTML = markup.trim(); return t.content.firstElementChild; };

/* ======================================================================
   Tiles: each entry may define front(size) and back(size).
   `every` = how often (ms) the tile flips between faces.
   ====================================================================== */
export const TILES = {
  hub: {
    every: 7000,
    back(size) {
      const rel = latestRelease();
      if (!rel) return null;
      return h('div', { class: 'tile__text' },
        h('b', {}, size === 's' ? rel.version : `new in ${rel.version}`),
        size === 's' ? null : rel.title);
    }
  },
  clock: {
    front(size) {
      if (size === 's') return null;
      const c = clock();
      return h('div', {},
        h('div', { class: 'tile__big' }, c.time),
        h('div', { class: 'tile__label' }, size === 'w' ? `${weekday()} · no alarms set` : c.period || 'clock'));
    },
    refresh: 'minute'
  },
  calendar: {
    front(size) {
      if (size === 's') return null;
      const d = new Date();
      return h('div', {},
        h('div', { class: 'tile__big' }, String(d.getDate())),
        h('div', { class: 'tile__label' }, size === 'w' ? `${weekday(d)} · nothing planned` : weekday(d)));
    },
    refresh: 'minute'
  },
  photos: {
    every: 6500,
    back(size) {
      if (size === 's') return null;
      const src = PHOTOS[Math.floor(Math.random() * PHOTOS.length)];
      return h('div', { class: 'tile__shade' },
        h('img', { class: 'tile__img is-panning', src, alt: '', loading: 'lazy' }),
        h('div', { class: 'tile__label' }, 'Photos'));
    }
  },
  music: {
    every: 8000,
    back(size) {
      if (size === 's') return null;
      const t = player.track;
      return h('div', { class: 'tile__shade' },
        h('img', { class: 'tile__img', src: t.art, alt: '', loading: 'lazy' }),
        h('div', { class: 'tile__label' }, size === 'w' ? `${t.title} · ${t.artist}` : t.title));
    }
  },
  people: {
    every: 9000,
    back(size) {
      if (size === 's') return null;
      const pick = [...CONTACTS].sort(() => Math.random() - 0.5).slice(0, 6);
      return h('div', { class: 'tile__mosaic' },
        pick.map((c) => h('span', { style: { background: c.color } }, initials(c.name))));
    }
  },
  messaging: {
    every: 7500,
    back(size) {
      if (size === 's') return null;
      const last = THREAD.messages.at(-1);
      return h('div', { class: 'tile__text' }, h('b', {}, THREAD.with), last.text);
    }
  },
  mail: {
    every: 8500,
    back(size) {
      if (size === 's') return null;
      const m = MAIL[0];
      return h('div', { class: 'tile__text' }, h('b', {}, m.from), m.subject);
    }
  }
};

/* ======================================================================
   Live Bloom shortcuts: renderer(sat, app) → element (fills the shortcut)
   Controls inside use data-act so clicks don't trigger navigation.
   ====================================================================== */
function nowPlaying() {
  const el = h('div', { class: 'sat-live sat-live--shade' });
  const paint = () => {
    const t = player.track;
    el.replaceChildren(
      h('img', { class: 'sat-live__art', src: t.art, alt: '' }),
      h('div', { class: 'sat-live__body' },
        h('div', { class: 'sat-live__title' }, t.title),
        h('div', { class: 'sat-live__sub' }, `${t.artist} · ${fmt(player.elapsed)} / ${fmt(t.len)}`)),
      h('div', { class: 'sat-live__controls', style: { position: 'relative' } },
        h('button', { type: 'button', 'data-act': 'prev', 'aria-label': 'Previous' }, h('i', { class: 'fa-solid fa-backward-step' })),
        h('button', { type: 'button', 'data-act': 'toggle', 'aria-label': player.playing ? 'Pause' : 'Play' },
          h('i', { class: player.playing ? 'fa-solid fa-pause' : 'fa-solid fa-play' })),
        h('button', { type: 'button', 'data-act': 'next', 'aria-label': 'Next' }, h('i', { class: 'fa-solid fa-forward-step' }))),
      h('div', { class: 'sat-live__progress', style: { position: 'relative' }, vars: { '--p': `${(player.elapsed / t.len) * 100}%` } }, h('i')));
  };
  paint();
  el.addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (!act) return;
    e.stopPropagation();
    player[act]();
  });
  const off = on('player', paint);
  el.cleanup = off;
  return el;
}

const RENDER = {
  nowPlaying,
  recommended() {
    const t = TRACKS[(player.index + 2) % TRACKS.length];
    return h('div', { class: 'sat-live sat-live--shade' },
      h('img', { class: 'sat-live__art', src: t.art, alt: '' }),
      h('div', { class: 'sat-live__body', style: { marginTop: 'auto' } },
        h('div', { class: 'sat-live__sub' }, 'recommended'),
        h('div', { class: 'sat-live__title' }, t.album)));
  },
  hubLatest() {
    const rel = latestRelease();
    return h('div', { class: 'sat-live' },
      h('div', { class: 'sat-live__sub' }, "what's new"),
      h('div', { class: 'sat-live__title' }, rel ? `${rel.version}: ${rel.title}` : 'Metro OS'),
      h('div', { class: 'sat-live__sub', style: { marginTop: 'auto' } }, rel?.date || ''));
  },
  storage() {
    const el = h('div', { class: 'sat-live' },
      h('div', { class: 'sat-live__sub' }, 'storage used'),
      h('div', { class: 'sat-live__big' }, '…'));
    navigator.storage?.estimate?.().then(({ usage = 0, quota = 0 }) => {
      const kb = usage / 1024;
      el.querySelector('.sat-live__big').textContent = kb > 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(kb))} KB`;
      if (quota) el.append(h('div', { class: 'sat-live__sub', style: { marginTop: 'auto' } }, `of ${(quota / 1073741824).toFixed(0)} GB this browser allows`));
    });
    return el;
  },
  missedCall() {
    const c = CONTACTS[0];
    return h('div', { class: 'sat-live' },
      h('div', { class: 'sat-live__sub' }, 'missed call'),
      h('div', { class: 'sat-live__title' }, c.name),
      h('div', { class: 'sat-live__sub', style: { marginTop: 'auto' } }, 'mobile · 10:14'));
  },
  latestThread() {
    const last = THREAD.messages.at(-1);
    return h('div', { class: 'sat-live' },
      h('div', { class: 'sat-live__title' }, THREAD.with),
      h('div', { class: 'sat-live__sub' }, `“${last.text}”`),
      h('div', { class: 'sat-live__sub', style: { marginTop: 'auto' } }, `${last.at} · tap to reply`));
  },
  unread() {
    return h('div', { class: 'sat-live' },
      h('div', { class: 'sat-live__big' }, String(MAIL.length)),
      h('div', { class: 'sat-live__sub' }, 'unread'),
      h('div', { class: 'sat-live__sub', style: { marginTop: 'auto' } }, MAIL[0].subject));
  },
  continueWatching() {
    return h('div', { class: 'sat-live sat-live--shade' },
      h('img', { class: 'sat-live__art', src: PHOTOS[3], alt: '' }),
      h('div', { class: 'sat-live__body', style: { marginTop: 'auto' } },
        h('div', { class: 'sat-live__sub' }, 'continue watching'),
        h('div', { class: 'sat-live__title' }, 'City at night · 12 min left')));
  },
  latestPhoto() {
    return h('div', { class: 'sat-live sat-live--shade' },
      h('img', { class: 'sat-live__art', src: PHOTOS[0], alt: '' }),
      h('div', { class: 'sat-live__body', style: { marginTop: 'auto' } }, h('div', { class: 'sat-live__sub' }, 'latest photo')));
  },
  station() {
    return h('div', { class: 'sat-live' },
      h('div', { class: 'sat-live__sub' }, 'on air'),
      h('div', { class: 'sat-live__title' }, 'Lo-fi Beats FM'),
      h('div', { class: 'sat-live__controls' }, h('button', { type: 'button', 'data-act': 'none', 'aria-label': 'Play' }, h('i', { class: 'fa-solid fa-play' }))));
  },
  continueEpisode() {
    return h('div', { class: 'sat-live' },
      h('div', { class: 'sat-live__sub' }, 'continue episode'),
      h('div', { class: 'sat-live__title' }, 'Designing for glanceable screens'),
      h('div', { class: 'sat-live__sub', style: { marginTop: 'auto' } }, '18 min left'),
      h('div', { class: 'sat-live__progress', vars: { '--p': '62%' } }, h('i')));
  },
  continueReading() {
    return h('div', { class: 'sat-live' },
      h('div', { class: 'sat-live__sub' }, 'continue reading'),
      h('div', { class: 'sat-live__title' }, 'Pride and Prejudice'),
      h('div', { class: 'sat-live__sub', style: { marginTop: 'auto' } }, 'Jane Austen · 34%'));
  },
  nextAlarm() {
    return h('div', { class: 'sat-live' },
      h('div', { class: 'sat-live__sub' }, 'next alarm'),
      h('div', { class: 'sat-live__big' }, '—'),
      h('div', { class: 'sat-live__sub', style: { marginTop: 'auto' } }, 'none set yet'));
  },
  today() {
    const d = new Date();
    return h('div', { class: 'sat-live' },
      h('div', { class: 'sat-live__big' }, String(d.getDate())),
      h('div', { class: 'sat-live__sub' }, weekday(d)),
      h('div', { class: 'sat-live__sub', style: { marginTop: 'auto' } }, 'nothing planned'));
  },
  tomorrow() {
    return h('div', { class: 'sat-live' },
      h('div', { class: 'sat-live__sub' }, 'tomorrow'),
      h('div', { class: 'sat-live__big' }, h('i', { class: 'fa-solid fa-cloud-sun' })),
      h('div', { class: 'sat-live__sub', style: { marginTop: 'auto' } }, 'set your city in phase 1'));
  },
  pinnedNote() {
    return h('div', { class: 'sat-live' },
      h('div', { class: 'sat-live__sub' }, 'pinned'),
      h('div', { class: 'sat-live__title' }, 'Ideas for Bloom'),
      h('div', { class: 'sat-live__sub' }, 'hold → options, drag → move'));
  },
  card() {
    return h('div', { class: 'sat-live', style: { background: 'linear-gradient(135deg,#1a1a2e,#3a2f6b)' } },
      h('div', { class: 'sat-live__sub' }, 'Demo Card'),
      h('div', { class: 'sat-live__title', style: { marginTop: 'auto', letterSpacing: '2px' } }, '•••• 4821'),
      h('div', { class: 'sat-live__sub' }, 'not a real card'));
  }
};

export function renderLive(name, sat, app) {
  const fn = RENDER[name];
  return fn ? fn(sat, app) : null;
}

export { html };
