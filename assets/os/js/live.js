/* Live content: what tiles show on their faces, and what the live Bloom
   shortcuts render. Phase 1 apps show real data (your alarms, events,
   weather, notes, photos and music); later-phase apps show demo data. */

import { h, clock, weekday, on } from './util.js';
import { store } from './store.js';
import { PHOTOS, CONTACTS, THREAD, MAIL, initials } from './demo.js';
import { latestRelease } from './content.js';
import { player, getLibrary, artFor, fmt } from './music.js';
import { nextAlarm } from './clockservice.js';
import { cached as weatherCache, describe } from './weather.js';
import { files, blobUrl } from './db.js';

/* small synchronous caches for things that live in IndexedDB */
let latestOwnPhoto = null;
async function refreshPhoto() {
  const [p] = await files.list('photo');
  latestOwnPhoto = p ? blobUrl(p) : null;
}
refreshPhoto();
on('files', (d) => { if (!d.kind || d.kind === 'photo') refreshPhoto(); });

const events = () => store.get('events') || [];
function nextEvent() {
  const now = new Date();
  const key = `${now.toISOString().slice(0, 10)}T${now.toTimeString().slice(0, 5)}`;
  return events()
    .map((e) => ({ ...e, k: `${e.date}T${e.allDay ? '00:00' : e.start || '00:00'}`, endK: `${e.date}T${e.allDay ? '23:59' : e.end || e.start || '23:59'}` }))
    .filter((e) => e.endK >= key)
    .sort((a, b) => a.k.localeCompare(b.k))[0] || null;
}
function eventWhen(e) {
  const today = new Date().toISOString().slice(0, 10);
  const day = e.date === today ? 'today' : new Date(`${e.date}T12:00`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
  return `${day}${e.allDay ? '' : ` · ${e.start}`}`;
}
const pinned = () => (store.get('notes') || []).find((n) => n.pinned) || null;
const alarmText = () => { const a = nextAlarm(); return a ? `${a.time}${a.label ? ` · ${a.label}` : ''}` : null; };
const photoSrc = () => latestOwnPhoto || PHOTOS[Math.floor(Math.random() * PHOTOS.length)];

/* ======================================================================
   Tiles: front(size) / back(size); `every` = flip interval; `refresh`
   = repaint the front every minute.
   ====================================================================== */
export const TILES = {
  hub: {
    every: 7000,
    back(size) {
      const rel = latestRelease();
      if (!rel) return null;
      return h('div', { class: 'tile__text' }, h('b', {}, size === 's' ? rel.version : `new in ${rel.version}`), size === 's' ? null : rel.title);
    }
  },
  clock: {
    refresh: 'minute',
    front(size) {
      if (size === 's') return null;
      const c = clock();
      const al = alarmText();
      return h('div', {},
        h('div', { class: 'tile__big' }, c.time),
        h('div', { class: 'tile__label' }, al ? `⏰ ${al}` : size === 'w' ? `${weekday()} · no alarms set` : c.period || 'clock'));
    }
  },
  calendar: {
    refresh: 'minute',
    front(size) {
      if (size === 's') return null;
      const d = new Date();
      const e = nextEvent();
      // With an event: the event on top, the date small in the corner (like the classic calendar tile).
      if (e) {
        return h('div', {},
          h('div', { class: 'tile__text' }, h('b', {}, e.title), eventWhen(e)),
          h('div', { class: 'tile__num' }, String(d.getDate())),
          h('div', { class: 'tile__label' }, weekday(d)));
      }
      return h('div', {},
        h('div', { class: 'tile__big' }, String(d.getDate())),
        h('div', { class: 'tile__label' }, weekday(d)));
    }
  },
  weather: {
    refresh: 'minute',
    front(size) {
      const c = weatherCache();
      if (!c || size === 's') return null;
      const cur = c.data.current;
      const d = describe(cur.weather_code, cur.is_day);
      return h('div', {},
        h('div', { class: 'tile__big' }, `${Math.round(cur.temperature_2m)}°`),
        h('i', { class: d.icon, style: { position: 'absolute', right: '10px', top: '10px', fontSize: '26px' } }),
        h('div', { class: 'tile__label' }, `${c.place} · ${d.text}`));
    },
    every: 9000,
    back(size) {
      const c = weatherCache();
      if (!c || size === 's') return null;
      const dl = c.data.daily;
      return h('div', { class: 'tile__text' }, h('b', {}, 'tomorrow'),
        `${describe(dl.weather_code[1]).text}, ${Math.round(dl.temperature_2m_max[1])}° / ${Math.round(dl.temperature_2m_min[1])}°`);
    }
  },
  photos: {
    every: 6500,
    back(size) {
      if (size === 's') return null;
      return h('div', { class: 'tile__shade' },
        h('img', { class: 'tile__img is-panning', src: photoSrc(), alt: '', loading: 'lazy' }),
        h('div', { class: 'tile__label' }, 'Photos'));
    }
  },
  music: {
    every: 8000,
    back(size) {
      if (size === 's') return null;
      const r = player.track || getLibrary()[0];
      if (!r) return null;
      return h('div', { class: 'tile__shade' },
        h('img', { class: 'tile__img', src: artFor(r), alt: '', loading: 'lazy' }),
        h('div', { class: 'tile__label' }, `${player.playing ? '▶ ' : ''}${r.meta?.title || r.name}${size === 'w' ? ` · ${r.meta?.artist || ''}` : ''}`));
    }
  },
  notes: {
    every: 9000,
    back(size) {
      const n = pinned();
      if (!n || size === 's') return null;
      return h('div', { class: 'tile__text' }, h('b', {}, n.text.split('\n')[0].slice(0, 40)), n.text.split('\n').slice(1).join(' ').slice(0, 80));
    }
  },
  people: {
    every: 9000,
    back(size) {
      if (size === 's') return null;
      const pick = [...CONTACTS].sort(() => Math.random() - 0.5).slice(0, 6);
      return h('div', { class: 'tile__mosaic' }, pick.map((c) => h('span', { style: { background: c.color } }, initials(c.name))));
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
      return h('div', { class: 'tile__text' }, h('b', {}, MAIL[0].from), MAIL[0].subject);
    }
  }
};

/* ======================================================================
   Live Bloom shortcuts. Controls inside use data-act so clicks don't
   trigger the shortcut's navigation.
   ====================================================================== */
const sub = (text, extra = {}) => h('div', { class: 'sat-live__sub', ...extra }, text);
const foot = (text) => sub(text, { style: { marginTop: 'auto' } });

function nowPlaying() {
  const el = h('div', { class: 'sat-live sat-live--shade' });
  const paint = () => {
    const r = player.track;
    if (!r) {
      el.replaceChildren(h('img', { class: 'sat-live__art', src: artFor(null), alt: '' }),
        h('div', { class: 'sat-live__body' }, h('div', { class: 'sat-live__title' }, player.hasMusic ? 'Nothing playing' : 'No music yet'), sub(player.hasMusic ? 'tap ▶ to shuffle your music' : 'tap to add songs from your device')),
        player.hasMusic ? h('div', { class: 'sat-live__controls', style: { position: 'relative' } }, h('button', { type: 'button', 'data-act': 'shuffle', 'aria-label': 'Shuffle all' }, h('i', { class: 'fa-solid fa-play' }))) : null);
      return;
    }
    const d = player.duration || 1;
    el.replaceChildren(
      h('img', { class: 'sat-live__art', src: artFor(r), alt: '' }),
      h('div', { class: 'sat-live__body' },
        h('div', { class: 'sat-live__title' }, r.meta?.title || r.name),
        sub(`${r.meta?.artist || ''} · ${fmt(player.elapsed)} / ${fmt(player.duration)}`)),
      h('div', { class: 'sat-live__controls', style: { position: 'relative' } },
        h('button', { type: 'button', 'data-act': 'prev', 'aria-label': 'Previous' }, h('i', { class: 'fa-solid fa-backward-step' })),
        h('button', { type: 'button', 'data-act': 'toggle', 'aria-label': player.playing ? 'Pause' : 'Play' }, h('i', { class: player.playing ? 'fa-solid fa-pause' : 'fa-solid fa-play' })),
        h('button', { type: 'button', 'data-act': 'next', 'aria-label': 'Next' }, h('i', { class: 'fa-solid fa-forward-step' }))),
      h('div', { class: 'sat-live__progress', style: { position: 'relative' }, vars: { '--p': `${(player.elapsed / d) * 100}%` } }, h('i')));
  };
  paint();
  el.addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (!act) return;
    e.stopPropagation();
    if (act === 'shuffle') player.playAll({ shuffle: true });
    else player[act]();
  });
  el.cleanup = on('player', paint);
  return el;
}

const RENDER = {
  nowPlaying,
  recommended() {
    const lib = getLibrary();
    if (!lib.length) return h('div', { class: 'sat-live' }, sub('recommended'), h('div', { class: 'sat-live__title' }, 'Your albums show here'), foot('add music to start'));
    const r = lib[Math.floor(Math.random() * lib.length)];
    return h('div', { class: 'sat-live sat-live--shade' },
      h('img', { class: 'sat-live__art', src: artFor(r), alt: '' }),
      h('div', { class: 'sat-live__body', style: { marginTop: 'auto' } }, sub('from your music'), h('div', { class: 'sat-live__title' }, r.meta?.album || r.meta?.title || r.name)));
  },
  hubLatest() {
    const rel = latestRelease();
    return h('div', { class: 'sat-live' }, sub("what's new"), h('div', { class: 'sat-live__title' }, rel ? `${rel.version}: ${rel.title}` : 'Metro OS'), foot(rel?.date || ''));
  },
  storage() {
    const el = h('div', { class: 'sat-live' }, sub('storage used'), h('div', { class: 'sat-live__big' }, '…'));
    navigator.storage?.estimate?.().then(({ usage = 0, quota = 0 }) => {
      const kb = usage / 1024;
      el.querySelector('.sat-live__big').textContent = kb > 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(kb))} KB`;
      if (quota) el.append(foot(`of ${(quota / 1073741824).toFixed(0)} GB this browser allows`));
    });
    return el;
  },
  nextAlarm() {
    const a = nextAlarm();
    if (!a) return h('div', { class: 'sat-live' }, sub('next alarm'), h('div', { class: 'sat-live__big' }, '—'), foot('tap to set one'));
    const mins = Math.round((a.nextAt - Date.now()) / 60000);
    return h('div', { class: 'sat-live' }, sub('next alarm'), h('div', { class: 'sat-live__big' }, a.time),
      foot(`${a.label ? `${a.label} · ` : ''}in ${mins < 60 ? `${mins} min` : `${Math.floor(mins / 60)} h ${mins % 60} min`}`));
  },
  today() {
    const d = new Date();
    const e = nextEvent();
    return h('div', { class: 'sat-live' }, h('div', { class: 'sat-live__big' }, String(d.getDate())), sub(weekday(d)),
      foot(e ? `${e.title} · ${eventWhen(e)}` : 'nothing planned'));
  },
  tomorrow() {
    const c = weatherCache();
    if (!c) return h('div', { class: 'sat-live' }, sub('tomorrow'), h('div', { class: 'sat-live__big' }, h('i', { class: 'fa-solid fa-cloud-sun' })), foot('tap to pick your city'));
    const dl = c.data.daily;
    const w = describe(dl.weather_code[1]);
    return h('div', { class: 'sat-live' }, sub(`tomorrow · ${c.place}`),
      h('div', { class: 'sat-live__big' }, `${Math.round(dl.temperature_2m_max[1])}°`),
      foot(`${w.text} · low ${Math.round(dl.temperature_2m_min[1])}°`));
  },
  pinnedNote() {
    const n = pinned();
    if (!n) return h('div', { class: 'sat-live' }, sub('pinned note'), h('div', { class: 'sat-live__title' }, 'Nothing pinned'), foot('open a note and tap pin'));
    return h('div', { class: 'sat-live' }, sub('pinned'), h('div', { class: 'sat-live__title' }, n.text.split('\n')[0].slice(0, 40)), sub(n.text.split('\n').slice(1).join(' ').slice(0, 70)));
  },
  latestPhoto() {
    return h('div', { class: 'sat-live sat-live--shade' },
      h('img', { class: 'sat-live__art', src: latestOwnPhoto || PHOTOS[0], alt: '' }),
      h('div', { class: 'sat-live__body', style: { marginTop: 'auto' } }, sub(latestOwnPhoto ? 'latest photo' : 'sample photo')));
  },
  /* demo-data apps (later phases) */
  missedCall() {
    return h('div', { class: 'sat-live' }, sub('missed call'), h('div', { class: 'sat-live__title' }, CONTACTS[0].name), foot('mobile · 10:14'));
  },
  latestThread() {
    const last = THREAD.messages.at(-1);
    return h('div', { class: 'sat-live' }, h('div', { class: 'sat-live__title' }, THREAD.with), sub(`“${last.text}”`), foot(`${last.at} · tap to reply`));
  },
  unread() {
    return h('div', { class: 'sat-live' }, h('div', { class: 'sat-live__big' }, String(MAIL.length)), sub('unread'), foot(MAIL[0].subject));
  },
  continueWatching() {
    return h('div', { class: 'sat-live sat-live--shade' }, h('img', { class: 'sat-live__art', src: PHOTOS[3], alt: '' }),
      h('div', { class: 'sat-live__body', style: { marginTop: 'auto' } }, sub('continue watching'), h('div', { class: 'sat-live__title' }, 'City at night · 12 min left')));
  },
  station() {
    return h('div', { class: 'sat-live' }, sub('on air'), h('div', { class: 'sat-live__title' }, 'Lo-fi Beats FM'), foot('arrives in phase 2'));
  },
  continueEpisode() {
    return h('div', { class: 'sat-live' }, sub('continue episode'), h('div', { class: 'sat-live__title' }, 'Designing for glanceable screens'), foot('18 min left'),
      h('div', { class: 'sat-live__progress', vars: { '--p': '62%' } }, h('i')));
  },
  continueReading() {
    return h('div', { class: 'sat-live' }, sub('continue reading'), h('div', { class: 'sat-live__title' }, 'Pride and Prejudice'), foot('Jane Austen · 34%'));
  },
  card() {
    return h('div', { class: 'sat-live', style: { background: 'linear-gradient(135deg,#1a1a2e,#3a2f6b)' } },
      sub('Demo Card'), h('div', { class: 'sat-live__title', style: { marginTop: 'auto', letterSpacing: '2px' } }, '•••• 4821'), sub('not a real card'));
  }
};

export function renderLive(name, sat, app) {
  const fn = RENDER[name];
  return fn ? fn(sat, app) : null;
}
