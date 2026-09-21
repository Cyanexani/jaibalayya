/* Metro controls used by apps: headers, toggles, pickers, text boxes,
   buttons, rows, pivots, app bar, dialogs and the dots loader. */

import { h, $$, animate, fill } from './util.js';

export function header(appTitle, pageTitle) {
  return h('div', {},
    h('p', { class: 'app-title' }, appTitle),
    pageTitle ? h('h1', { class: 'page-title' }, pageTitle) : null);
}

export function toggle({ label, value, onChange, hint, on = 'On', off = 'Off' }) {
  const state = h('span', { class: 'toggle__state' }, value ? on : off);
  const sw = h('button', { class: 'switch', type: 'button', role: 'switch', 'aria-checked': String(!!value), 'aria-label': label });
  const el = h('div', { class: 'toggle' },
    h('span', { class: 'field__label' }, label),
    state, sw,
    hint ? h('p', { class: 'hint' }, hint) : null);
  const set = (v) => {
    value = v;
    sw.setAttribute('aria-checked', String(v));
    state.textContent = v ? on : off;
  };
  el.addEventListener('click', () => { set(!value); onChange?.(value); });
  el.set = set;
  return el;
}

/** Inline list picker for short lists; opens a full-screen picker for long ones. */
export function picker({ label, value, options, onChange, full = options.length > 6, grid = false, host }) {
  const current = () => options.find((o) => o.value === value) || options[0];
  const box = h('button', { class: 'picker', type: 'button', 'aria-haspopup': 'listbox' });
  const paint = () => {
    const o = current();
    fill(box, o.swatch ? h('span', { class: 'swatch', style: { background: o.swatch } }) : null, h('span', {}, o.label));
  };
  paint();
  const el = h('div', { class: 'field' }, h('span', { class: 'field__label' }, label), box);
  let list = null;
  const choose = (v) => {
    value = v;
    paint();
    onChange?.(v);
  };
  box.addEventListener('click', () => {
    if (full) return openFull();
    if (list) { list.remove(); list = null; return; }
    list = h('div', { class: 'picker-list', role: 'listbox' },
      options.map((o) => h('button', {
        type: 'button', role: 'option', 'aria-selected': String(o.value === value),
        onclick: () => { choose(o.value); list.remove(); list = null; }
      }, o.swatch ? h('span', { class: 'swatch', style: { background: o.swatch, width: '18px', height: '18px' } }) : null, o.label)));
    el.append(list);
  });
  function openFull() {
    const target = host || box.closest('.view') || document.body;
    const pane = h('div', { class: 'fullpicker', role: 'dialog', 'aria-label': label },
      h('p', { class: 'app-title', style: { margin: '6px 0 14px' } }, label),
      grid
        ? h('div', { class: 'fullpicker__grid', role: 'listbox' },
          options.map((o, i) => h('button', {
            type: 'button', role: 'option', 'aria-label': o.label, 'aria-selected': String(o.value === value),
            style: { background: o.swatch, animationDelay: `${Math.floor(i / 4) * 40 + (i % 4) * 15}ms` },
            onclick: () => { choose(o.value); close(); }
          })))
        : h('div', { class: 'fullpicker__list', role: 'listbox' },
          options.map((o, i) => h('button', {
            type: 'button', role: 'option', 'aria-selected': String(o.value === value),
            style: { animationDelay: `${i * 20}ms` },
            onclick: () => { choose(o.value); close(); }
          }, o.label))));
    const close = () => { pane.remove(); window.removeEventListener('metro:back', onBack, true); };
    const onBack = (e) => { e.preventDefault(); close(); };
    window.addEventListener('metro:back', onBack, true);
    target.append(pane);
    pane.querySelector('[aria-selected="true"]')?.focus();
  }
  el.set = (v) => { value = v; paint(); };
  return el;
}

export function textbox({ label, value = '', placeholder = '', onInput, onChange, type = 'text', multiline = false, hint }) {
  const input = h(multiline ? 'textarea' : 'input', { class: 'textbox', type: multiline ? null : type, placeholder, 'aria-label': label });
  input.value = value;
  if (onInput) input.addEventListener('input', () => onInput(input.value));
  if (onChange) input.addEventListener('change', () => onChange(input.value));
  const el = h('label', { class: 'field' }, h('span', { class: 'field__label' }, label), input, hint ? h('p', { class: 'hint' }, hint) : null);
  el.input = input;
  return el;
}

export const button = (label, onClick, { accent = false, icon } = {}) =>
  h('button', { class: accent ? 'btn btn--accent' : 'btn', type: 'button', onclick: onClick }, icon ? h('i', { class: icon }) : null, label);

export function row({ title, sub, href, onClick, icon, iconHtml, color }) {
  const tag = href ? 'a' : 'button';
  return h(tag, { class: icon || iconHtml ? 'row row--icon' : 'row', href, type: href ? null : 'button', onclick: onClick },
    icon || iconHtml ? h('span', { class: 'row__icon', style: color ? { background: color } : null, html: iconHtml || `<i class="${icon}"></i>` }) : null,
    h('span', {}, h('b', {}, title), sub ? h('span', {}, sub) : null));
}

export const groupTitle = (text) => h('h2', { class: 'group-title' }, text);

export function loader() {
  return h('div', { class: 'dots', role: 'progressbar', 'aria-label': 'Loading' }, h('i'), h('i'), h('i'), h('i'), h('i'));
}

/* ---------- pivot ---------- */
export function pivot({ appTitle, items, active, onChange }) {
  let index = Math.max(0, items.findIndex((i) => i.id === active));
  const heads = h('div', { class: 'pivot__heads', role: 'tablist' });
  const body = h('div', { class: 'pivot__body' });
  const el = h('div', { class: 'pivot' },
    h('div', { class: 'pivot__top' }, h('p', { class: 'app-title' }, appTitle)),
    heads, body);
  const rendered = new Map();

  function paintHeads() {
    // Metro pivots rotate: the active header is always first.
    const order = items.map((_, i) => items[(index + i) % items.length]);
    heads.replaceChildren(...order.map((it) => h('button', {
      class: it === items[index] ? 'pivot__head is-active' : 'pivot__head',
      type: 'button', role: 'tab', 'aria-selected': String(it === items[index]),
      onclick: () => select(items.indexOf(it), 1)
    }, it.title)));
  }
  function select(i, dir = 1, silent = false) {
    if (i === index && rendered.size) return;
    const prev = body.querySelector('.pivot__item:not([hidden])');
    index = (i + items.length) % items.length;
    const it = items[index];
    let pane = rendered.get(it.id);
    if (!pane) {
      pane = h('div', { class: 'pivot__item', role: 'tabpanel' });
      it.render(pane);
      rendered.set(it.id, pane);
      body.append(pane);
    }
    if (prev && prev !== pane) prev.hidden = true;
    pane.hidden = false;
    pane.classList.remove('in-right', 'in-left');
    void pane.offsetWidth;
    if (prev && prev !== pane) pane.classList.add(dir > 0 ? 'in-right' : 'in-left');
    paintHeads();
    if (!silent) onChange?.(it.id);
  }

  // swipe between pivot items
  let sx = 0, sy = 0, tracking = false;
  body.addEventListener('pointerdown', (e) => { sx = e.clientX; sy = e.clientY; tracking = true; });
  body.addEventListener('pointerup', (e) => {
    if (!tracking) return;
    tracking = false;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.4) select(index + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1);
  });
  body.addEventListener('pointercancel', () => { tracking = false; });

  el.select = (id, silent) => {
    const i = items.findIndex((x) => x.id === id);
    if (i >= 0) select(i, i >= index ? 1 : -1, silent);
  };
  el.pane = (id) => rendered.get(id);
  select(index, 1, true);
  return el;
}

/* ---------- app bar ---------- */
export function appbar({ buttons = [], menu = [] }) {
  const el = h('div', { class: 'appbar' });
  const row = h('div', { class: 'appbar__row' },
    buttons.map((b) => h('button', {
      class: 'appbar__btn', type: 'button', 'aria-label': b.label, disabled: b.disabled,
      onclick: () => { el.classList.remove('is-open'); b.onClick(); }
    }, h('span', { class: 'ring' }, h('i', { class: b.icon })), h('em', {}, b.label))),
    h('button', { class: 'appbar__more', type: 'button', 'aria-label': 'More', onclick: () => el.classList.toggle('is-open') }, '•••'));
  el.append(row);
  if (menu.length) {
    el.append(h('div', { class: 'appbar__menu' },
      menu.map((m) => h('button', { type: 'button', onclick: () => { el.classList.remove('is-open'); m.onClick(); } }, m.label))));
  }
  return el;
}

/* ---------- dialog ---------- */
export function dialog(host, { title, body, ok = 'ok', cancel = 'cancel' }) {
  return new Promise((resolve) => {
    const scrim = h('div', { class: 'dialog-scrim' });
    const box = h('div', { class: 'dialog', role: 'alertdialog', 'aria-label': title },
      h('h2', {}, title),
      h('p', {}, body),
      h('div', { class: 'btn-row' },
        button(ok, () => done(true)),
        cancel ? button(cancel, () => done(false)) : null));
    const onBack = (e) => { e.preventDefault(); done(false); };
    function done(v) {
      window.removeEventListener('metro:back', onBack, true);
      animate(box, [{ opacity: 1 }, { opacity: 0 }], 120).then(() => { scrim.remove(); box.remove(); });
      resolve(v);
    }
    window.addEventListener('metro:back', onBack, true);
    scrim.addEventListener('click', () => done(false));
    host.append(scrim, box);
    box.querySelector('button')?.focus();
  });
}

/** Animate a freshly rendered page in (children flip in one after another). */
export function enter(el) {
  el.classList.remove('enter');
  void el.offsetWidth;
  el.classList.add('enter');
  setTimeout(() => el.classList.remove('enter'), 700);
}

export { $$ };
