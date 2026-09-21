/* The Metro OS hub: a panorama of everything about the OS itself, read
   from content/os.md. The "apps" section also lists every app with its
   status and a link to its notes. */

import { h, clamp } from '../util.js';
import { loadOS } from '../content.js';
import { loader, appbar } from '../controls.js';
import { sortedApps, iconHtml, statusText, PHASES } from '../registry.js';
import { issueUrl } from '../config.js';

export default function mount(ctx) {
  const { el } = ctx;
  let index = 0;
  let sections = [];
  let pano, track, title, bg, dots;
  let wanted = null;

  el.append(h('div', { class: 'page' }, h('p', { class: 'app-title' }, 'Metro OS'), loader()));

  function appsList() {
    const byPhase = new Map();
    for (const app of sortedApps()) {
      const key = app.built ? 'ready' : app.phase;
      if (!byPhase.has(key)) byPhase.set(key, []);
      byPhase.get(key).push(app);
    }
    const order = ['ready', 1, 2, 3, 4].filter((k) => byPhase.has(k));
    return h('div', {}, order.map((k) => [
      h('h3', { class: 'group-title', style: { fontSize: '17px', margin: '18px 0 4px' } }, k === 'ready' ? 'ready now' : `phase ${k}: ${PHASES[k].toLowerCase()}`),
      byPhase.get(k).map((app) => h('a', { class: 'row row--icon', href: `#/info/${app.id}` },
        h('span', { class: 'row__icon', html: iconHtml(app) }),
        h('span', {}, h('b', { style: { fontSize: '19px' } }, app.name), h('span', {}, statusText(app)))))
    ]));
  }

  function build(doc) {
    sections = doc.sections;
    bg = h('div', { class: 'pano__bg', 'aria-hidden': 'true' });
    title = h('h1', { class: 'pano__title' }, 'metro os');
    track = h('div', { class: 'pano__track' });
    dots = h('div', { class: 'pano__dots', 'aria-hidden': 'true' }, sections.map(() => h('i')));
    for (const s of sections) {
      const sec = h('section', { class: 'pano__section', 'data-id': s.id, 'aria-label': s.title },
        h('h2', {}, s.title),
        h('div', { class: 'md', html: s.html }),
        s.id === 'apps' ? appsList() : null);
      track.append(sec);
    }
    pano = h('div', { class: 'pano', tabindex: '0' }, bg, title, track, dots);
    const bar = appbar({
      buttons: [
        { icon: 'fa-solid fa-road', label: 'roadmap', onClick: () => ctx.go('#/app/hub/roadmap', { replace: true }) },
        { icon: 'fa-solid fa-table-cells', label: 'all apps', onClick: () => ctx.go('#/app/hub/apps', { replace: true }) },
        { icon: 'fa-solid fa-comment-dots', label: 'feedback', onClick: () => window.open(issueUrl('Metro OS: '), '_blank', 'noopener') }
      ],
      menu: [{ label: 'settings', onClick: () => ctx.go('#/app/settings') }]
    });
    el.replaceChildren(pano, bar);
    wire();
    const i = sections.findIndex((s) => s.id === wanted);
    setIndex(i >= 0 ? i : 0, false);
  }

  const secW = () => track.firstElementChild?.offsetWidth || el.clientWidth * 0.88;

  function setIndex(i, notify = true) {
    index = clamp(i, 0, sections.length - 1);
    const w = secW();
    track.style.transform = `translateX(${-index * w}px)`;
    title.style.transform = `translateX(${-index * w * 0.3}px)`;
    bg.style.transform = `translateX(${-index * w * 0.12}px)`;
    [...dots.children].forEach((d, n) => d.classList.toggle('is-active', n === index));
    [...track.children].forEach((s, n) => { s.inert = n !== index; });
    if (notify) ctx.go(`#/app/hub/${sections[index].id}`, { replace: true });
  }

  function wire() {
    let p = null;
    pano.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || e.target.closest('a, button')) return;
      p = { x: e.clientX, y: e.clientY, id: e.pointerId, mode: null, t: performance.now() };
    });
    pano.addEventListener('pointermove', (e) => {
      if (!p || e.pointerId !== p.id) return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      if (!p.mode) {
        if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.2) { p.mode = 'x'; pano.classList.add('is-dragging'); track.classList.add('is-dragging'); pano.setPointerCapture(e.pointerId); }
        else if (Math.abs(dy) > 10) { p = null; return; }
      }
      if (p?.mode === 'x') {
        const w = secW();
        let x = -index * w + dx;
        const min = -(sections.length - 1) * w;
        if (x > 0) x *= 0.3;
        if (x < min) x = min + (x - min) * 0.3;
        track.style.transform = `translateX(${x}px)`;
        title.style.transform = `translateX(${x * 0.3}px)`;
        bg.style.transform = `translateX(${x * 0.12}px)`;
      }
    });
    const end = (e) => {
      if (!p || e.pointerId !== p.id) return;
      const dx = e.clientX - p.x;
      const v = dx / (performance.now() - p.t);
      const wasX = p.mode === 'x';
      p = null;
      pano.classList.remove('is-dragging');
      track.classList.remove('is-dragging');
      if (!wasX) return;
      const step = dx < -secW() * 0.2 || v < -0.5 ? 1 : dx > secW() * 0.2 || v > 0.5 ? -1 : 0;
      setIndex(index + step);
    };
    pano.addEventListener('pointerup', end);
    pano.addEventListener('pointercancel', end);
    pano.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') setIndex(index + 1);
      if (e.key === 'ArrowLeft') setIndex(index - 1);
    });
    let lock = false;
    pano.addEventListener('wheel', (e) => {
      if (lock || Math.abs(e.deltaX) < 25 || Math.abs(e.deltaX) < Math.abs(e.deltaY)) return;
      lock = true;
      setTimeout(() => { lock = false; }, 500);
      setIndex(index + (e.deltaX > 0 ? 1 : -1));
    }, { passive: true });
    window.addEventListener('resize', () => setIndex(index, false));
  }

  loadOS().then(build);

  return {
    route(sub) {
      wanted = sub[0] || null;
      if (!sections.length) return;
      const i = sections.findIndex((s) => s.id === wanted);
      if (i >= 0 && i !== index) setIndex(i, false);
    },
    show() { pano?.focus({ preventScroll: true }); }
  };
}
