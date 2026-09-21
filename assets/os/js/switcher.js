/* App switcher: hold the back button. Cards are live copies of the open
   apps; tap one to return to it, swipe it up (or tap ×) to close it. */

import { h, animate } from './util.js';
import { pushOverlay } from './overlays.js';
import { iconHtml } from './registry.js';

export function openSwitcher({ screen, views, onPick, onCloseApp }) {
  const sr = screen.getBoundingClientRect();
  const track = h('div', { class: 'switcher__track' });
  const root = h('div', { class: 'switcher', role: 'dialog', 'aria-label': 'Open apps' });

  if (!views.length) {
    root.append(h('p', { class: 'switcher__empty' }, 'No apps open. Tap a tile to open one.'));
  } else {
    root.append(track);
    for (const v of views) track.append(card(v));
  }
  screen.append(root);
  const pop = pushOverlay(close);
  root.addEventListener('click', (e) => { if (e.target === root || e.target === track) close(); });

  // start on the most recent app (last in the list)
  requestAnimationFrame(() => {
    for (const c of track.children) scaleShot(c);
    track.lastElementChild?.scrollIntoView({ inline: 'center', block: 'nearest' });
    track.lastElementChild?.querySelector('.card__shot')?.focus({ preventScroll: true });
  });

  function scaleShot(c) {
    const shot = c.querySelector('.card__shot');
    const k = shot.clientWidth / sr.width;
    const copy = shot.firstElementChild;
    if (copy) copy.style.transform = `scale(${k})`;
  }

  function card(v) {
    const copy = v.el.cloneNode(true);
    copy.hidden = false;
    copy.removeAttribute('id');
    copy.setAttribute('aria-hidden', 'true');
    copy.inert = true;
    Object.assign(copy.style, { width: `${sr.width}px`, height: `${sr.height}px`, transform: 'scale(.6)', animation: 'none' });
    const shot = h('div', { class: 'card__shot', tabindex: '0', role: 'button', 'aria-label': `Switch to ${v.title}`, style: { aspectRatio: `${sr.width} / ${sr.height}` } }, copy);
    const el = h('div', { class: 'card' },
      h('div', { class: 'card__title' }, h('span', { html: v.app ? iconHtml(v.app) : '', style: { width: '16px', display: 'inline-grid' } }), v.title),
      shot,
      h('button', { class: 'card__close', type: 'button', 'aria-label': `Close ${v.title}` }, h('i', { class: 'fa-solid fa-xmark' })));

    const pick = () => { close(); onPick(v); };
    shot.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } if (e.key === 'Delete') kill(); });
    el.querySelector('.card__close').addEventListener('click', kill);

    let sy = null, dy = 0;
    shot.addEventListener('pointerdown', (e) => { sy = e.clientY; dy = 0; shot.setPointerCapture(e.pointerId); });
    shot.addEventListener('pointermove', (e) => {
      if (sy == null) return;
      dy = Math.min(0, e.clientY - sy);
      shot.style.transform = `translateY(${dy}px)`;
      shot.style.opacity = String(1 + dy / 400);
    });
    shot.addEventListener('pointerup', () => {
      if (sy == null) return;
      sy = null;
      if (dy < -90) kill();
      else if (Math.abs(dy) < 6) pick();
      else { shot.style.transform = ''; shot.style.opacity = ''; }
    });

    function kill() {
      animate(shot, [{ transform: shot.style.transform || 'none', opacity: 1 }, { transform: 'translateY(-120%)', opacity: 0 }], { duration: 220, easing: 'ease-in', fill: 'forwards' })
        .then(() => {
          el.remove();
          onCloseApp(v);
          if (!track.children.length) close();
        });
    }
    return el;
  }

  let closed = false;
  function close() {
    if (closed) return;
    closed = true;
    pop();
    animate(root, [{ opacity: 1 }, { opacity: 0 }], 150).then(() => root.remove());
  }
  return close;
}
