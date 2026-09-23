/* Settings. Main page is a pivot (system / applications); each system
   entry is its own page with its own link, e.g. #/app/settings/theme. */

import { h } from '../util.js';
import { store, ACCENTS, setWallpaperImage } from '../store.js';
import { FONTS, allWallpapers, deviceWantsLessMotion } from '../theme.js';
import { header, toggle, picker, textbox, button, row, groupTitle, pivot, dialog, enter } from '../controls.js';
import { sortedApps, iconHtml, statusText } from '../registry.js';
import { loadOS } from '../content.js';
import { play } from '../sound.js';
import { REPO_URL } from '../config.js';
import * as N from '../notify.js';
import { byId } from '../registry.js';

const accentOptions = () => Object.entries(ACCENTS).map(([value, swatch]) => ({ value, label: value, swatch }));
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

export default function mount(ctx) {
  const { el, go, shell } = ctx;
  let page = null;
  let key = null;

  function show(node, dir) {
    const next = node;
    if (page) page.remove();
    page = next;
    el.append(page);
    if (dir !== 0) enter(page.classList.contains('page') ? page : page.querySelector('.pivot__item:not([hidden])') || page);
  }

  /* ---------------- main ---------------- */
  function main() {
    const theme = store.get('theme');
    return pivot({
      appTitle: 'Settings',
      items: [
        {
          id: 'system', title: 'system',
          render(pane) {
            pane.append(
              row({ title: 'start + theme', sub: `${theme} · ${store.get('accent')} · ${store.get('moreTiles') ? 'more' : 'fewer'} tiles`, href: '#/app/settings/theme' }),
              row({ title: 'lock screen', sub: store.get('lock.pin') ? 'PIN on' : 'swipe up to unlock', href: '#/app/settings/lock' }),
              row({ title: 'you', sub: store.get('user.name') || 'name, location and units', href: '#/app/settings/you' }),
              row({ title: 'notifications', sub: `${N.MODE_LABEL[N.mode()]}${store.get('notify.schedule')?.on ? ' · quiet hours scheduled' : ''}`, href: '#/app/settings/notifications' }),
              row({ title: 'sounds', sub: store.get('sound') ? 'on' : 'off', href: '#/app/settings/sounds' }),
              row({ title: 'make it yours', sub: 'run the short setup again', href: '#/setup' }),
              row({ title: 'about', sub: 'version, credits, reset', href: '#/app/settings/about' }));
          }
        },
        {
          id: 'applications', title: 'applications',
          render(pane) {
            pane.append(h('p', { class: 'hint', style: { margin: '0 0 8px' } }, 'Every app has notes: what it does, what’s new, what improved, what was removed and what’s coming.'));
            for (const app of sortedApps()) {
              pane.append(row({ title: app.name, sub: statusText(app), href: `#/info/${app.id}`, iconHtml: iconHtml(app) }));
            }
          }
        }
      ]
    });
  }

  /* ---------------- start + theme ---------------- */
  function themePage(open) {
    const fileInput = h('input', { type: 'file', accept: 'image/*', hidden: true });
    fileInput.addEventListener('change', async () => {
      const file = fileInput.files?.[0];
      if (!file) return;
      const url = await shrink(file);
      if (url && setWallpaperImage(url)) {
        store.set('wallpaper', 'photo');
        wall.set('photo');
        ctx.toast('Wallpaper set');
      } else ctx.toast('That image is too large to keep. Try a smaller one.');
    });
    const accent = picker({ label: 'Accent colour', value: store.get('accent'), options: accentOptions(), grid: true, full: true, onChange: (v) => store.set('accent', v), host: el });
    const wall = picker({
      label: 'Wallpaper', value: store.get('wallpaper'),
      options: Object.entries(allWallpapers()).map(([value, w]) => ({ value, label: w.label })),
      full: true, host: el,
      onChange: (v) => (v === 'photo' ? fileInput.click() : store.set('wallpaper', v))
    });
    const p = h('div', { class: 'page' },
      header('Settings', 'start + theme'),
      picker({ label: 'Background', value: store.get('theme'), options: [{ value: 'dark', label: 'dark' }, { value: 'light', label: 'light' }], onChange: (v) => store.set('theme', v) }),
      accent,
      picker({ label: 'Font', value: store.get('font'), options: Object.entries(FONTS).map(([value, f]) => ({ value, label: f.label })), onChange: (v) => store.set('font', v) }),
      toggle({ label: 'Show more tiles', value: store.get('moreTiles'), hint: 'Six small tiles across instead of four.', onChange: (v) => store.set('moreTiles', v) }),
      picker({
        label: 'Tile colour', value: store.get('tileStyle'),
        options: [{ value: 'solid', label: 'accent colour' }, { value: 'app', label: 'each app’s own colour' }, { value: 'glass', label: 'see-through (shows wallpaper)' }],
        onChange: (v) => store.set('tileStyle', v)
      }),
      wall, fileInput,
      h('div', { class: 'btn-row' }, button('choose a photo', () => fileInput.click(), { icon: 'fa-solid fa-image' })),
      picker({
        label: 'Motion', value: store.get('motion'),
        options: [
          { value: 'full', label: 'full motion' },
          { value: 'reduced', label: 'less motion' },
          { value: 'system', label: `follow my device (${deviceWantsLessMotion() ? 'less motion' : 'full motion'})` }
        ],
        onChange: (v) => store.set('motion', v)
      }),
      h('p', { class: 'hint' }, 'Less motion turns off turnstiles, flips and slides. “Follow my device” uses your system’s reduce-motion setting.'));
    if (open === 'accent') setTimeout(() => accent.querySelector('.picker').click(), 350);
    if (open === 'wallpaper') setTimeout(() => wall.querySelector('.picker').click(), 350);
    return p;
  }

  /* ---------------- lock screen ---------------- */
  function lockPage() {
    const pinBox = textbox({ label: 'PIN (4 digits)', type: 'password', placeholder: store.get('lock.pin') ? '••••' : 'none set' });
    pinBox.input.inputMode = 'numeric';
    pinBox.input.maxLength = 4;
    const colour = picker({ label: 'Lock screen colour', value: store.get('lock.color'), options: accentOptions(), grid: true, full: true, host: el, onChange: (v) => store.set('lock.color', v) });
    colour.hidden = store.get('lock.background') !== 'color';
    return h('div', { class: 'page' },
      header('Settings', 'lock screen'),
      toggle({ label: 'Show the lock screen when Metro OS opens', value: store.get('lock.onOpen'), onChange: (v) => store.set('lock.onOpen', v) }),
      toggle({ label: 'Lock when you switch tabs', value: store.get('lock.autoLock'), hint: 'Locks Metro OS whenever this tab goes to the background.', onChange: (v) => store.set('lock.autoLock', v) }),
      groupTitle('pin'),
      pinBox,
      h('div', { class: 'btn-row' },
        button('save PIN', () => {
          const v = pinBox.input.value;
          if (!/^\d{4}$/.test(v)) return ctx.toast('A PIN is four digits.');
          store.set('lock.pin', v);
          pinBox.input.value = '';
          pinBox.input.placeholder = '••••';
          ctx.toast('PIN saved');
        }),
        button('remove PIN', () => { store.set('lock.pin', ''); pinBox.input.placeholder = 'none set'; ctx.toast('PIN removed'); })),
      h('p', { class: 'hint' }, 'The PIN keeps casual eyes out. It isn’t real security: anyone can clear this site’s data in their browser.'),
      groupTitle('background'),
      picker({
        label: 'Background', value: store.get('lock.background'),
        options: [{ value: 'wallpaper', label: 'my wallpaper' }, { value: 'color', label: 'a solid colour' }],
        onChange: (v) => { store.set('lock.background', v); colour.hidden = v !== 'color'; }
      }),
      colour,
      picker({
        label: 'Detailed status', value: store.get('lock.status'),
        options: [{ value: 'hub', label: 'Metro OS news' }, { value: 'music', label: 'Music' }, { value: 'calendar', label: 'Calendar' }, { value: 'none', label: 'none' }],
        onChange: (v) => store.set('lock.status', v)
      }),
      h('div', { class: 'btn-row' }, button('preview the lock screen', () => shell.lock.lock({ sound: true }), { icon: 'fa-solid fa-lock' })));
  }

  /* ---------------- you ---------------- */
  function youPage() {
    const where = h('p', { class: 'lede', style: { margin: '4px 0 8px' } }, placeText());
    function placeText() {
      const u = store.get('user');
      if (u.place) return u.place;
      if (u.lat != null) return `${u.lat.toFixed(2)}, ${u.lon.toFixed(2)}`;
      return 'not set';
    }
    return h('div', { class: 'page' },
      header('Settings', 'you'),
      textbox({ label: 'Your name', value: store.get('user.name'), placeholder: 'what should Metro OS call you?', onInput: (v) => store.set('user.name', v.trim()) }),
      groupTitle('location'),
      where,
      textbox({ label: 'City', value: store.get('user.place'), placeholder: 'e.g. Hyderabad', onChange: (v) => { store.set('user.place', v.trim()); where.textContent = placeText(); } }),
      h('div', { class: 'btn-row' }, button('use my location', () => {
        if (!navigator.geolocation) return ctx.toast('This browser can’t share a location.');
        navigator.geolocation.getCurrentPosition(
          (pos) => { store.set('user.lat', pos.coords.latitude); store.set('user.lon', pos.coords.longitude); where.textContent = placeText(); ctx.toast('Location saved on this device'); },
          () => ctx.toast('Location permission was declined.'),
          { timeout: 10000 });
      }, { icon: 'fa-solid fa-location-crosshairs' })),
      h('p', { class: 'hint' }, 'Weather (phase 1) uses this. It stays in this browser.'),
      groupTitle('units'),
      picker({ label: 'Measurement system', value: store.get('user.units'), options: [{ value: 'metric', label: 'metric (°C, km)' }, { value: 'imperial', label: 'imperial (°F, miles)' }], onChange: (v) => store.set('user.units', v) }));
  }

  /* ---------------- sounds ---------------- */
  function soundsPage() {
    return h('div', { class: 'page' },
      header('Settings', 'sounds'),
      toggle({ label: 'System sounds', value: store.get('sound'), hint: 'Lock, unlock and notification sounds. They’re generated live, not recordings.', onChange: (v) => store.set('sound', v) }),
      h('div', { class: 'btn-row' },
        button('unlock', () => play('unlock'), { icon: 'fa-solid fa-play' }),
        button('lock', () => play('lock'), { icon: 'fa-solid fa-play' }),
        button('notification', () => play('notify'), { icon: 'fa-solid fa-play' })));
  }

  /* ---------------- about ---------------- */
  function aboutPage() {
    const ver = h('p', { class: 'lede' }, 'Metro OS');
    loadOS().then((doc) => { const v = doc.versions[0]; if (v) ver.textContent = `Metro OS ${v.version} · ${v.date}`; });
    return h('div', { class: 'page' },
      header('Settings', 'about'),
      ver,
      h('p', { class: 'hint' }, 'A working Metro-style phone in the browser. Not affiliated with Microsoft.'),
      row({ title: "what's new", sub: 'release notes', href: '#/app/hub/whats-new' }),
      row({ title: 'roadmap', sub: 'now, next, later', href: '#/app/hub/roadmap' }),
      row({ title: 'credits', sub: 'fonts, icons, licences', href: '#/app/hub/credits' }),
      row({ title: 'source code', sub: REPO_URL.replace('https://', ''), onClick: () => window.open(REPO_URL, '_blank', 'noopener') }),
      groupTitle('reset'),
      h('p', { class: 'hint' }, 'Clears your layout, theme, notifications and PIN from this browser.'),
      h('div', { class: 'btn-row' }, button('reset Metro OS', async () => {
        const ok = await dialog(el, { title: 'Reset Metro OS?', body: 'Your tiles, theme, PIN and notifications will go back to how they started.', ok: 'reset' });
        if (ok) store.reset();
      })));
  }

  /* ---------------- notifications ---------------- */
  function notificationsPage() {
    const sched = { on: false, from: '22:00', to: '07:00', ...(store.get('notify.schedule') || {}) };
    const saveSched = () => store.set('notify.schedule', { ...sched });
    const time = (key, label) => {
      const i = h('input', { class: 'textbox', type: 'time', value: sched[key], 'aria-label': label });
      i.addEventListener('change', () => { sched[key] = i.value || sched[key]; saveSched(); });
      return h('label', { class: 'field' }, h('span', { class: 'field__label' }, label), i);
    };
    const times = h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' } }, time('from', 'From'), time('to', 'To'));
    times.hidden = !sched.on;
    const flag = (key, label, fallback, hint) => toggle({ label, value: N.setting(key, fallback), hint, onChange: (v) => store.set(`notify.${key}`, v) });

    const APPS = ['messaging', 'phone', 'mail', 'people', 'calendar', 'clock', 'weather', 'podcasts', 'store', 'files', 'hub'];
    const allowed = store.get('notify.apps') || {};

    const later = (fn) => { ctx.toast('Go to start to watch the tiles. It arrives in 3 seconds.'); setTimeout(fn, 3000); };
    const sampleMessage = () => later(async () => {
      const C = await import('../contacts.js');
      const c = C.contacts().filter((x) => x.phone)[Math.floor(Math.random() * 4)];
      const text = ['are we still on for 6?', 'sent you the tile layout', 'pin it to the wiki when you can', 'call me when you’re free'][Math.floor(Math.random() * 4)];
      C.addMessage(c.id, { me: false, text });
      N.notify({ app: 'messaging', level: 'count', title: c.name, body: text, route: `#/app/messaging/thread/${c.id}` });
    });
    const sampleCall = (app) => later(async () => (await import('../calls.js')).incomingCall({ app }));

    return h('div', { class: 'page' },
      header('Settings', 'notifications'),
      picker({
        label: 'Mode', value: store.get('notify.mode') || 'normal',
        options: [{ value: 'normal', label: 'normal: sound and banners' }, { value: 'silent', label: 'silent: banners, no sound' }, { value: 'quiet', label: 'quiet hours: nothing interrupts' }],
        onChange: (v) => N.setMode(v)
      }),
      h('p', { class: 'hint' }, 'You can also switch modes from the action center. Alarms and timers ring in every mode.'),
      groupTitle('quiet hours'),
      toggle({ label: 'Turn on quiet hours on a schedule', value: sched.on, onChange: (v) => { sched.on = v; times.hidden = !v; saveSched(); } }),
      times,
      flag('favourites', 'Favourites ring through', true, 'People you’ve starred can still call you.'),
      flag('repeat', 'Repeat callers ring through', true, 'A second call from the same person within 3 minutes rings.'),
      flag('autoReply', 'Reply to missed calls automatically', false, '“I’m in quiet hours. I’ll call you back.”'),
      groupTitle('when silent'),
      flag('vibrate', 'Vibrate', true, 'Only on devices that can vibrate.'),
      groupTitle('previews'),
      picker({ label: 'On the lock screen', value: N.setting('lockPreviews', 'hide'), options: [{ value: 'hide', label: 'only “new message”' }, { value: 'show', label: 'show the message' }], onChange: (v) => store.set('notify.lockPreviews', v) }),
      picker({ label: 'On tiles and banners', value: N.setting('tilePreviews', 'show'), options: [{ value: 'show', label: 'show the message' }, { value: 'hide', label: 'only who it’s from' }], onChange: (v) => store.set('notify.tilePreviews', v) }),
      groupTitle('apps'),
      ...APPS.map((id) => toggle({
        label: byId(id)?.name || id, value: allowed[id] !== false,
        onChange: (v) => store.set('notify.apps', { ...(store.get('notify.apps') || {}), [id]: v })
      })),
      h('p', { class: 'hint' }, 'Apps that aren’t listed never send notifications.'),
      groupTitle('try it'),
      h('p', { class: 'hint', style: { margin: '0 0 8px' } }, 'Sample notifications from the made-up contacts, so you can see each kind. They arrive after 3 seconds; go to start to watch.'),
      h('div', { class: 'btn-row' },
        button('incoming call', () => sampleCall('phone'), { icon: 'fa-solid fa-phone' }),
        button('call in Messaging', () => sampleCall('messaging'), { icon: 'fa-solid fa-message' }),
        button('new message', sampleMessage, { icon: 'fa-solid fa-comment' }),
        button('reminder', () => later(() => N.notify({ app: 'calendar', level: 'flip', title: 'Design review', body: 'in 10 min · sample', route: '#/app/calendar' })), { icon: 'fa-solid fa-calendar' }),
        button('rain alert', () => later(() => N.notify({ app: 'weather', level: 'flip', title: 'Rain likely', body: 'around 4 pm · sample', route: '#/app/weather/hourly' })), { icon: 'fa-solid fa-cloud-rain' }),
        button('app update (quiet)', () => later(() => N.notify({ app: 'hub', level: 'quiet', title: 'Sample update', body: 'A quiet notification: marker only', route: '#/app/hub/whats-new' })), { icon: 'fa-solid fa-arrows-rotate' })));
  }

  const PAGES = { theme: themePage, lock: lockPage, you: youPage, sounds: soundsPage, notifications: notificationsPage, about: aboutPage };

  return {
    route(sub, { dir = 1 } = {}) {
      const k = sub.join('/');
      if (k === key && page) return;
      key = k;
      const make = PAGES[sub[0]];
      show(make ? make(sub[1]) : main(), dir);
    }
  };
}

/** Downscale a photo so it fits comfortably in local storage. */
function shrink(file) {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const max = 1280;
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k);
      c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
  });
}

export { cap };
