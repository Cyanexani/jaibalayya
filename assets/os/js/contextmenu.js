/* The Metro context menu: hold an item and a menu drops in under it while
   the list behind it recedes. */

import { h } from './util.js';
import { pushOverlay } from './overlays.js';

export function contextMenu({ screen, anchor, items, recede }) {
  const sr = screen.getBoundingClientRect();
  const scrim = h('div', { class: 'ctx-scrim' });
  const menu = h('div', { class: 'ctx', role: 'menu' },
    items.map((it) => h('button', {
      type: 'button', role: 'menuitem',
      onclick: () => { close(); it.action(); }
    }, it.label)));
  screen.append(scrim, menu);

  // Where the anchor will sit once the list behind has receded to 94%.
  let ar = anchor.getBoundingClientRect();
  if (recede) {
    const pr = recede.getBoundingClientRect();
    const cy = pr.top + pr.height / 2;
    ar = { top: cy + (ar.top - cy) * 0.94, bottom: cy + (ar.bottom - cy) * 0.94 };
    recede.classList.add('is-receded');
  }
  // On wide screens the menu is narrower than the screen: line it up with the item.
  const mw = menu.offsetWidth;
  if (mw < sr.width - 4) {
    const left = anchor.getBoundingClientRect().left - sr.left - 12;
    menu.style.left = `${Math.max(0, Math.min(left, sr.width - mw))}px`;
  }
  const mh = menu.offsetHeight;
  let top = ar.bottom - sr.top + 6;
  if (top + mh > sr.height - 8) top = ar.top - sr.top - mh - 6;
  menu.style.top = `${Math.max(8, top)}px`;

  const pop = pushOverlay(close);
  scrim.addEventListener('pointerdown', (e) => { e.preventDefault(); close(); });
  menu.addEventListener('keydown', (e) => {
    const btns = [...menu.querySelectorAll('button')];
    const i = btns.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); btns[(i + 1) % btns.length].focus(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); btns[(i - 1 + btns.length) % btns.length].focus(); }
  });
  menu.querySelector('button')?.focus({ preventScroll: true });

  let closed = false;
  function close() {
    if (closed) return;
    closed = true;
    pop();
    scrim.remove();
    menu.remove();
    recede?.classList.remove('is-receded');
  }
  return close;
}
