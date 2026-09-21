/* "Make it yours": a short, optional setup. Nobody is forced through it;
   it's offered from a notification and from Settings. */

import { h } from '../util.js';
import { store, ACCENTS } from '../store.js';
import { FONTS } from '../theme.js';
import { header, toggle, picker, textbox, button, groupTitle, enter } from '../controls.js';

const STEPS = ['welcome', 'display', 'lock', 'you', 'done'];

export default function mount(ctx) {
  const { el, go } = ctx;
  let step = 'welcome';
  let page = null;
  const backBtn = button('back', () => move(-1));
  const nextBtn = button('next', () => move(1));
  const bar = h('div', { class: 'bottombar' }, backBtn, nextBtn);

  const accentOptions = Object.entries(ACCENTS).map(([value, swatch]) => ({ value, label: value, swatch }));

  const PAGES = {
    welcome: () => h('div', { class: 'page has-appbar' },
      h('h1', { class: 'page-title', style: { marginTop: '8px', textTransform: 'none' } }, 'Make it yours'),
      h('p', { class: 'lede' }, 'Four quick screens: how Metro OS looks, how it locks, and a little about you. Everything stays in this browser.'),
      h('p', { class: 'hint' }, 'You can skip this and change any of it later in Settings.')),
    display: () => h('div', { class: 'page has-appbar' },
      header('Display', null),
      h('p', { class: 'lede' }, 'Theme, accent colour and type.'),
      picker({ label: 'Background', value: store.get('theme'), options: [{ value: 'dark', label: 'dark' }, { value: 'light', label: 'light' }], onChange: (v) => store.set('theme', v) }),
      picker({ label: 'Accent colour', value: store.get('accent'), options: accentOptions, grid: true, full: true, host: el, onChange: (v) => store.set('accent', v) }),
      picker({ label: 'Font', value: store.get('font'), options: Object.entries(FONTS).map(([value, f]) => ({ value, label: f.label })), onChange: (v) => store.set('font', v) }),
      toggle({ label: 'Show more tiles', value: store.get('moreTiles'), hint: 'Six small tiles across instead of four.', onChange: (v) => store.set('moreTiles', v) })),
    lock: () => h('div', { class: 'page has-appbar' },
      header('Lock screen', null),
      toggle({ label: 'Show the lock screen when Metro OS opens', value: store.get('lock.onOpen'), onChange: (v) => store.set('lock.onOpen', v) }),
      toggle({ label: 'Lock when you switch tabs', value: store.get('lock.autoLock'), onChange: (v) => store.set('lock.autoLock', v) }),
      picker({
        label: 'Background', value: store.get('lock.background'),
        options: [{ value: 'wallpaper', label: 'my wallpaper' }, { value: 'color', label: 'a solid colour' }],
        onChange: (v) => store.set('lock.background', v)
      }),
      h('p', { class: 'hint' }, 'You can add a PIN in Settings › lock screen.')),
    you: () => h('div', { class: 'page has-appbar' },
      header('You', null),
      textbox({ label: 'Your name', value: store.get('user.name'), placeholder: 'optional', onInput: (v) => store.set('user.name', v.trim()) }),
      textbox({ label: 'City', value: store.get('user.place'), placeholder: 'for Weather, optional', onChange: (v) => store.set('user.place', v.trim()) }),
      groupTitle('units'),
      picker({ label: 'Measurement system', value: store.get('user.units'), options: [{ value: 'metric', label: 'metric' }, { value: 'imperial', label: 'imperial' }], onChange: (v) => store.set('user.units', v) })),
    done: () => h('div', { class: 'page has-appbar' },
      h('h1', { class: 'page-title', style: { marginTop: '8px', textTransform: 'none' } }, `You're all set${store.get('user.name') ? ', ' + store.get('user.name') : ''}.`),
      h('p', { class: 'lede' }, 'Hold any tile to see its shortcuts. Hold and drag to move it.'))
  };

  function render(dir = 1) {
    const next = PAGES[step]();
    page?.remove();
    page = next;
    el.prepend(page);
    if (!bar.isConnected) el.append(bar);
    backBtn.textContent = step === 'welcome' ? 'skip' : 'back';
    nextBtn.textContent = step === 'done' ? 'done' : step === 'welcome' ? 'get started' : 'next';
    if (dir) enter(page);
  }

  function move(d) {
    const i = STEPS.indexOf(step);
    if (d < 0 && i === 0) return finish();
    if (d > 0 && step === 'done') return finish();
    step = STEPS[Math.max(0, Math.min(STEPS.length - 1, i + d))];
    go(`#/setup/${step}`, { replace: true });
  }

  function finish() {
    store.set('setupDone', true);
    go('#/', { replace: true });
  }

  return {
    route(sub, { dir = 1 } = {}) {
      const s = STEPS.includes(sub[0]) ? sub[0] : 'welcome';
      const d = STEPS.indexOf(s) >= STEPS.indexOf(step) ? 1 : -1;
      step = s;
      render(page ? d : dir);
    },
    back() {
      if (step === 'welcome') return false;
      move(-1);
      return true;
    }
  };
}
