/* Lock screen: big clock, date, a detailed status from one app, and
   notification counts. Swipe up (or click, press a key, scroll) to unlock.
   An optional PIN is a privacy screen, not real security. */

import { h, fill, clock, longDate, animate, on } from './util.js';
import { store } from './store.js';
import { lockBackground } from './theme.js';
import { byId, iconHtml } from './registry.js';
import { play } from './sound.js';
import { loadOS } from './content.js';
import { player } from './music.js';
import * as notes from './notify.js';

export function createLock({ os, onUnlock }) {
  let el = null;
  let timer = 0;

  const isLocked = () => !!el;

  async function statusText() {
    const which = store.get('lock.status');
    if (which === 'hub') {
      const os = await loadOS();
      const v = os.versions[0];
      return v ? { title: `Metro OS ${v.version}`, body: v.title } : null;
    }
    if (which === 'music') {
      const r = player.track;
      return r ? { title: r.meta?.title || r.name, body: r.meta?.artist || '' } : { title: 'Music', body: 'Nothing playing' };
    }
    if (which === 'calendar') return { title: 'Calendar', body: 'Nothing planned today' };
    return null;
  }

  function paintIcons(box) {
    const counts = new Map();
    for (const n of notes.list()) if (!n.read) counts.set(n.app, (counts.get(n.app) || 0) + 1);
    box.replaceChildren(...[...counts].slice(0, 5).map(([id, n]) => {
      const app = byId(id);
      return h('span', {}, h('span', { html: app ? iconHtml(app) : '', style: { width: '16px', display: 'inline-grid' } }), String(n));
    }));
  }

  function lock({ sound = false, hint = false } = {}) {
    if (el) return;
    const c = clock();
    const timeEl = h('div', { class: 'lock__time' }, c.time, c.period ? h('span', { class: 'lock__ampm' }, c.period) : null);
    const dateEl = h('div', { class: 'lock__date' }, longDate());
    const status = h('div', { class: 'lock__status' });
    const icons = h('div', { class: 'lock__icons' });
    el = h('div', {
      class: 'lock', role: 'dialog', 'aria-label': 'Lock screen. Swipe up, click, or press Enter to unlock.', tabindex: '0',
      style: { background: `${lockBackground()} center / cover no-repeat` }
    },
    h('div', { class: 'lock__bar' },
      h('span', {}, h('i', { class: 'fa-solid fa-signal' }), ' ', h('i', { class: navigator.onLine ? 'fa-solid fa-wifi' : 'fa-solid fa-plane' })),
      h('span', {}, c.full)),
    timeEl, dateEl, status, icons,
    hint ? h('div', { class: 'lock__hint' }, h('i', { class: 'fa-solid fa-chevron-up' }), 'swipe up to begin') : null);
    os.append(el);
    el.focus({ preventScroll: true });
    if (sound) play('lock');

    statusText().then((s) => {
      if (!s || !el) return;
      fill(status, h('b', {}, s.title), s.body);
    });
    paintIcons(icons);

    timer = setInterval(() => {
      const n = clock();
      timeEl.firstChild.textContent = n.time;
      dateEl.textContent = longDate();
    }, 10000);

    wire(el);
  }

  function wire(lockEl) {
    let start = null;
    lockEl.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.pin')) return;
      start = { y: e.clientY, t: performance.now(), id: e.pointerId };
      lockEl.setPointerCapture(e.pointerId);
      lockEl.style.transition = 'none';
    });
    lockEl.addEventListener('pointermove', (e) => {
      if (!start || e.pointerId !== start.id) return;
      const dy = Math.min(0, e.clientY - start.y);
      lockEl.style.transform = `translateY(${dy}px)`;
    });
    lockEl.addEventListener('pointerup', (e) => {
      if (!start || e.pointerId !== start.id) return;
      const dy = e.clientY - start.y;
      const v = dy / (performance.now() - start.t);
      start = null;
      lockEl.style.transition = '';
      if (dy < -lockEl.clientHeight * 0.22 || v < -0.6) proceed();
      else if (Math.abs(dy) < 6) bounce();
      else animate(lockEl, [{ transform: lockEl.style.transform }, { transform: 'none' }], { duration: 220, easing: 'cubic-bezier(.2,.8,.2,1)' }).then(() => { lockEl.style.transform = ''; });
    });
    lockEl.addEventListener('keydown', (e) => {
      if (['Enter', ' ', 'ArrowUp', 'PageUp'].includes(e.key)) { e.preventDefault(); proceed(); }
    });
    lockEl.addEventListener('wheel', (e) => { if (e.deltaY > 30) proceed(); }, { passive: true });
  }

  function bounce() {
    el.classList.remove('is-bouncing');
    void el.offsetWidth;
    el.classList.add('is-bouncing');
    el.style.transform = '';
  }

  function proceed() {
    if (!el) return;
    if (store.get('lock.pin')) return showPin();
    unlock();
  }

  function showPin() {
    el.style.transform = '';
    if (el.querySelector('.pin')) return;
    let typed = '';
    const dots = h('div', { class: 'pin__dots' });
    const paint = () => dots.replaceChildren(...[0, 1, 2, 3].map((i) => h('i', { class: i < typed.length ? 'is-filled' : '' })));
    paint();
    const keys = [['1', ''], ['2', 'abc'], ['3', 'def'], ['4', 'ghi'], ['5', 'jkl'], ['6', 'mno'], ['7', 'pqrs'], ['8', 'tuv'], ['9', 'wxyz'], ['back', ''], ['0', ''], ['ok', '']];
    const pad = h('div', { class: 'pin__pad' }, keys.map(([k, sub]) => h('button', {
      type: 'button', 'aria-label': k === 'back' ? 'Delete' : k === 'ok' ? 'Cancel' : k,
      onclick: () => press(k)
    }, k === 'back' ? h('i', { class: 'fa-solid fa-delete-left' }) : k === 'ok' ? h('i', { class: 'fa-solid fa-xmark' }) : k, sub ? h('small', {}, sub) : null)));
    const pin = h('div', { class: 'pin' }, h('div', { class: 'pin__prompt' }, 'Enter PIN'), dots, pad);
    el.append(pin);
    const onKey = (e) => {
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === 'Backspace') press('back');
      else if (e.key === 'Escape') press('ok');
    };
    el.addEventListener('keydown', onKey);
    function press(k) {
      if (k === 'ok') { pin.remove(); el.removeEventListener('keydown', onKey); return; }
      if (k === 'back') typed = typed.slice(0, -1);
      else if (typed.length < 4) typed += k;
      paint();
      if (typed.length === 4) {
        if (typed === store.get('lock.pin')) { el.removeEventListener('keydown', onKey); unlock(); }
        else {
          dots.classList.remove('is-wrong'); void dots.offsetWidth; dots.classList.add('is-wrong');
          navigator.vibrate?.(60);
          setTimeout(() => { typed = ''; paint(); }, 450);
        }
      }
    }
  }

  function unlock() {
    if (!el) return;
    const lockEl = el;
    el = null;
    clearInterval(timer);
    play('unlock');
    animate(lockEl, [{ transform: lockEl.style.transform || 'none' }, { transform: 'translateY(-105%)' }], { duration: 280, easing: 'cubic-bezier(.4,0,1,1)', fill: 'forwards' })
      .then(() => lockEl.remove());
    onUnlock?.();
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && store.get('lock.autoLock')) lock();
  });
  on('notifications', () => { const icons = el?.querySelector('.lock__icons'); if (icons) paintIcons(icons); });

  return { lock, unlock, isLocked };
}
