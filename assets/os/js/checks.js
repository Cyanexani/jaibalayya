/* Background checks that turn into notifications. They run when Metro OS
   is idle after opening, then every few hours while it stays open.
     podcasts   a new episode from a show you follow      quiet
     store      a new wallpaper or tile in the catalog     quiet
     files      storage almost full                        flip, once a day
     people     someone's birthday today                   flip, once a day */

import { store } from './store.js';
import { notify } from './notify.js';

const today = () => new Date().toISOString().slice(0, 10);

async function podcasts() {
  const following = store.get('podcasts.following') || [];
  if (!following.length) return;
  const seen = { ...(store.get('podcasts.latestSeen') || {}) };
  let told = 0;
  for (const show of following.slice(0, 10)) {
    try {
      const r = await fetch(`https://itunes.apple.com/lookup?id=${encodeURIComponent(show.id)}&entity=podcastEpisode&limit=1`);
      const j = await r.json();
      const ep = j.results.find((x) => x.wrapperType === 'podcastEpisode' || x.kind === 'podcast-episode');
      if (!ep) continue;
      const id = String(ep.trackId);
      if (seen[show.id] && seen[show.id] !== id && told < 3) {
        told++;
        notify({ app: 'podcasts', level: 'quiet', title: show.title, body: `New: ${ep.trackName}`, route: `#/app/podcasts/show/${show.id}`, key: `pod-${show.id}` });
      }
      seen[show.id] = id;
    } catch { /* offline or the directory is down: try next time */ }
  }
  store.set('podcasts.latestSeen', seen);
}

async function storeCatalog() {
  try {
    const r = await fetch('store/catalog.json', { cache: 'no-cache' });
    if (!r.ok) return;
    const cat = await r.json();
    const ids = [...(cat.wallpapers || []).map((w) => `w:${w.id}`), ...(cat.tiles || []).map((t) => `t:${t.id}`)];
    const seen = store.get('store.seen');
    store.set('store.seen', ids);
    if (!seen) return; // first visit: nothing is "new"
    const fresh = ids.filter((id) => !seen.includes(id));
    if (!fresh.length) return;
    const names = fresh.map((id) => [...(cat.wallpapers || []), ...(cat.tiles || [])].find((x) => id.endsWith(`:${x.id}`))?.name).filter(Boolean);
    notify({ app: 'store', level: 'quiet', title: fresh.length === 1 ? 'New in the Store' : `${fresh.length} new in the Store`, body: names.slice(0, 3).join(', '), route: '#/app/store', key: 'store-new' });
  } catch { /* try next time */ }
}

async function storage() {
  if (store.get('files.fullNotified') === today()) return;
  const est = await navigator.storage?.estimate?.().catch(() => null);
  if (!est?.quota || est.usage / est.quota < 0.9) return;
  store.set('files.fullNotified', today());
  notify({ app: 'files', level: 'flip', title: 'Storage almost full', body: `${Math.round((est.usage / est.quota) * 100)}% of what this browser allows`, route: '#/app/files/storage', key: 'storage' });
}

function birthdays() {
  if (store.get('people.birthdaysNotified') === today()) return;
  store.set('people.birthdaysNotified', today());
  const md = today().slice(5);
  for (const c of store.get('contacts') || []) {
    if (c.birthday === md) notify({ app: 'people', level: 'flip', title: `${c.name.split(' ')[0]}’s birthday`, body: 'today · send a message?', route: `#/app/people/contact/${c.id}`, key: `bday-${c.id}` });
  }
}

export function runChecks() {
  birthdays();
  storage();
  storeCatalog();
  podcasts();
}

export function startChecks() {
  runChecks();
  setInterval(runChecks, 3 * 3600e3);
}
