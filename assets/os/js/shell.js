/* The shell: status bar, screen, navigation bar, and the routing between
   home (start + app list), apps and notes pages, with Metro transitions. */

import { h, clock, on, animate, holdable } from './util.js';
import { store } from './store.js';
import { byId, MARK_SVG } from './registry.js';
import * as router from './router.js';
import { createHome } from './home.js';
import { createActionCenter } from './actioncenter.js';
import { createLock } from './lock.js';
import { openSwitcher } from './switcher.js';
import { closeTop, closeAll } from './overlays.js';
import * as notes from './notify.js';
import { updateCompanion } from './companion.js';
import { toggleFull } from './fullscreen.js';

export function createShell(device) {
  /* ---------- chrome ---------- */
  const sbTime = h('span', { class: 'statusbar__time' });
  const sbIcons = h('span', { class: 'statusbar__icons' });
  const statusbar = h('div', { class: 'statusbar', role: 'button', tabindex: '0', 'aria-label': 'Open the action center' }, sbIcons, sbTime);
  const screen = h('div', { class: 'screen' });
  const viewsEl = h('div', { class: 'views' });
  const backBtn = h('button', { type: 'button', 'aria-label': 'Back (hold for open apps)' }, h('i', { class: 'fa-solid fa-arrow-left' }));
  const startBtn = h('button', { type: 'button', 'aria-label': 'Start', html: `<span class="navbar__mark">${MARK_SVG}</span>` });
  const searchBtn = h('button', { type: 'button', 'aria-label': 'Search' }, h('i', { class: 'fa-solid fa-magnifying-glass' }));
  const navbar = h('nav', { class: 'navbar', 'aria-label': 'Navigation' }, backBtn, startBtn, searchBtn);
  const os = h('div', { class: 'os' }, statusbar, screen, navbar, h('div', { class: 'brightness', 'aria-hidden': 'true' }));
  device.append(os);
  notes.initNotify(os);

  const home = createHome({ screen });
  screen.append(home.el, viewsEl);
  const lock = createLock({ os, onUnlock: () => setTimeout(() => window.dispatchEvent(new Event('metro:unlocked')), 300) });
  const ac = createActionCenter({ os, statusbar, lockNow: () => lock.lock({ sound: true }) });

  /* ---------- status bar ---------- */
  let battery = null;
  navigator.getBattery?.().then((b) => {
    battery = b;
    b.addEventListener('levelchange', paintStatus);
    b.addEventListener('chargingchange', paintStatus);
    paintStatus();
  }).catch(() => {});
  function paintStatus() {
    sbTime.textContent = clock().full;
    const icons = [
      h('i', { class: 'fa-solid fa-signal', title: 'signal' }),
      h('i', { class: navigator.onLine ? 'fa-solid fa-wifi' : 'fa-solid fa-plane', title: navigator.onLine ? 'online' : 'offline' })
    ];
    if (notes.unread()) icons.push(h('i', { class: 'fa-solid fa-comment is-dot', title: `${notes.unread()} new notifications` }));
    if (battery) {
      const lvl = battery.level;
      const cls = battery.charging ? 'fa-bolt' : lvl > 0.85 ? 'fa-battery-full' : lvl > 0.6 ? 'fa-battery-three-quarters' : lvl > 0.35 ? 'fa-battery-half' : lvl > 0.12 ? 'fa-battery-quarter' : 'fa-battery-empty';
      icons.push(h('span', {}, h('i', { class: `fa-solid ${cls}` }), ` ${Math.round(lvl * 100)}%`));
    }
    sbIcons.replaceChildren(...icons);
  }
  paintStatus();
  setInterval(paintStatus, 10000);
  window.addEventListener('online', paintStatus);
  window.addEventListener('offline', paintStatus);
  on('notifications', paintStatus);
  statusbar.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ac.open(); } });

  /* ---------- views ---------- */
  const views = new Map();
  let current = null;
  let queue = Promise.resolve();

  const api = { home, lock, ac, screen, os, views };

  function ctxFor(spec, el) {
    return {
      el, app: spec.app, screen, shell: api, store,
      go: router.go, back: router.back,
      toast: notes.toast, notify: notes.notify
    };
  }

  function pageOut(el, dir) {
    return animate(el, [
      { transform: 'none', opacity: 1 },
      { transform: `perspective(1200px) rotateY(${dir < 0 ? 80 : -80}deg)`, opacity: 0 }
    ], { duration: 170, easing: 'ease-in', fill: 'forwards' });
  }
  function pageIn(el, dir) {
    return animate(el, [
      { transform: `perspective(1200px) rotateY(${dir < 0 ? -80 : 80}deg)`, opacity: 0 },
      { transform: 'none', opacity: 1 }
    ], { duration: 300, easing: 'cubic-bezier(.2,.8,.2,1)' });
  }

  async function toHome(pane, dir) {
    home.show(pane);
    if (!current) return;
    const v = current;
    current = null;
    const a = await pageOut(v.el, dir <= 0 ? -1 : 1);
    v.el.hidden = true;
    a?.cancel?.();
    v.inst.hide?.();
    home.el.inert = false;
    home.turnstileIn();
  }

  async function toView(spec, dir) {
    let v = views.get(spec.key);
    const first = !v;
    if (!v) {
      const el = h('section', { class: 'view', 'data-key': spec.key, hidden: true, 'aria-label': spec.title });
      viewsEl.append(el);
      try {
        const mod = await spec.loader();
        const inst = (await mod.default(ctxFor(spec, el))) || {};
        v = { key: spec.key, el, inst, app: spec.app, title: spec.title };
        views.set(spec.key, v);
      } catch (err) {
        console.error(err);
        el.remove();
        notes.toast('That screen failed to load.');
        return router.go('#/', { replace: true });
      }
    }
    v.hash = router.current().hash;
    v.lastUsed = Date.now();
    v.inst.route?.(spec.sub || [], { dir, first, pending: spec.pending, requested: spec.requested });
    if (current === v) return;
    const prev = current;
    current = v;
    if (!prev) {
      await home.turnstileOut();
      home.el.inert = true;
    } else {
      const a = await pageOut(prev.el, dir);
      prev.el.hidden = true;
      a?.cancel?.();
      prev.inst.hide?.();
    }
    v.el.hidden = false;
    v.inst.show?.();
    pageIn(v.el, dir);
  }

  const infoLoader = () => import('./apps/info.js');

  async function handle(route, dir) {
    closeAll();
    const [a, b, ...rest] = route.parts;
    const app = byId(b);
    let title = 'Metro OS';
    if (!a) await toHome('start', dir);
    else if (a === 'apps') { title = 'All apps · Metro OS'; await toHome('apps', dir); }
    else if (a === 'setup') { title = 'Setup · Metro OS'; await toView({ key: 'setup', title: 'Setup', loader: () => import('./apps/setup.js'), sub: route.parts.slice(1) }, dir); }
    else if (a === 'info' && app) {
      title = `${app.name} notes · Metro OS`;
      await toView({ key: `info:${app.id}`, app, title: `${app.name} notes`, loader: infoLoader, sub: rest }, dir);
    } else if (a === 'app' && app) {
      title = `${app.name} · Metro OS`;
      if (app.built) await toView({ key: `app:${app.id}`, app, title: app.name, loader: () => import(`./apps/${app.id}.js`), sub: rest }, dir);
      else await toView({ key: `info:${app.id}`, app, title: `${app.name} notes`, loader: infoLoader, sub: [], pending: true, requested: rest.join('/') }, dir);
    } else {
      return router.go('#/', { replace: true });
    }
    document.title = title;
    updateCompanion(route);
  }

  router.onRoute((route, dir) => {
    queue = queue.then(() => handle(route, dir)).catch((err) => console.error(err));
  });

  function destroyView(v) {
    v.inst.destroy?.();
    v.el.remove();
    views.delete(v.key);
    if (current === v) {
      current = null;
      home.el.inert = false;
      home.turnstileIn();
      router.go('#/', { replace: true });
    }
  }

  /* ---------- navigation bar ---------- */
  function handleBack() {
    const ev = new Event('metro:back', { cancelable: true });
    window.dispatchEvent(ev);
    if (ev.defaultPrevented) return;
    if (closeTop()) return;
    if (current?.inst.back?.()) return;
    if (!current) {
      if (home.pane === 'apps') home.goStart();
      return;
    }
    router.back();
  }

  function showSwitcher() {
    closeAll();
    const list = [...views.values()].filter((v) => v.key !== 'setup').sort((a, b) => a.lastUsed - b.lastUsed);
    openSwitcher({ screen, views: list, onPick: (v) => router.go(v.hash), onCloseApp: destroyView });
  }

  holdable(backBtn, { ms: 500, onTap: handleBack, onHold: showSwitcher });
  backBtn.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleBack(); } });
  startBtn.addEventListener('click', () => {
    closeAll();
    if (current) router.go('#/');
    else home.goStart();
  });
  searchBtn.addEventListener('click', () => router.go('#/app/search'));

  document.addEventListener('keydown', (e) => {
    const t = e.target;
    const typing = t.matches?.('input, textarea, [contenteditable="true"]');
    if (e.defaultPrevented) return;
    if (!typing && (e.key === 'f' || e.key === 'F') && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      toggleFull();
      return;
    }
    if (lock.isLocked()) return;
    if (e.key === 'Escape') {
      if (typing) { t.blur(); return; }
      e.preventDefault();
      handleBack();
    }
    if (!typing && e.key === '/' ) { e.preventDefault(); router.go('#/app/search'); }
  });

  return { ...api, handleBack, showSwitcher };
}
