/* Live Tile Studio: design your own live tiles in HTML and CSS, preview
   them at every size, pin them to start. Tiles run sandboxed. */

import { h, emit } from '../util.js';
import { pivot, appbar, header, textbox, picker, pageRouter, screenOf, dialog } from '../controls.js';
import { store, ACCENTS } from '../store.js';
import { tileFrame } from '../customtile.js';

export const TEMPLATES = [
  {
    name: 'Big clock', color: '#1a68e0',
    html: '<div class="t"><b id="time"></b><span id="day"></span></div>\n<script>\nfunction tick() {\n  const n = new Date();\n  time.textContent = n.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });\n  day.textContent = n.toLocaleDateString([], { weekday: "long", day: "numeric" });\n}\ntick();\nsetInterval(tick, 10000);\n</script>',
    css: '.t { position: absolute; inset: 0; padding: 8px; display: flex; flex-direction: column; justify-content: flex-end; }\nb { font-weight: 300; font-size: 34vh; line-height: 1; }\nspan { font-size: 12px; opacity: .85; }\n[data-size="s"] span { display: none; }'
  },
  {
    name: 'Countdown', color: '#d80073',
    html: '<div class="t" data-until="2026-12-31"><b id="n"></b><span>days to go</span></div>\n<script>\nconst el = document.querySelector("[data-until]");\nconst days = Math.ceil((new Date(el.dataset.until) - new Date()) / 864e5);\nn.textContent = Math.max(0, days);\n</script>',
    css: '.t { position: absolute; inset: 0; padding: 8px; display: flex; flex-direction: column; justify-content: center; align-items: flex-start; }\nb { font-weight: 300; font-size: 40vh; line-height: 1; }\nspan { font-size: 12px; opacity: .85; }'
  },
  {
    name: 'Day progress', color: '#008a00',
    html: '<div class="t"><span>today</span><b id="p"></b><i><u id="bar"></u></i></div>\n<script>\nfunction tick() {\n  const n = new Date();\n  const pct = Math.round(((n.getHours() * 60 + n.getMinutes()) / 1440) * 100);\n  p.textContent = pct + "%";\n  bar.style.width = pct + "%";\n}\ntick();\nsetInterval(tick, 60000);\n</script>',
    css: '.t { position: absolute; inset: 0; padding: 8px; display: flex; flex-direction: column; justify-content: flex-end; gap: 4px; }\nb { font-weight: 300; font-size: 30vh; line-height: 1; }\nspan { font-size: 12px; opacity: .85; }\ni { display: block; height: 4px; background: rgba(255,255,255,.3); }\nu { display: block; height: 100%; background: #fff; }'
  },
  {
    name: 'Note to self', color: '#fa6800',
    html: '<div class="t"><b>Make it yours.</b><span>edit this tile in Live Tile Studio</span></div>',
    css: '.t { position: absolute; inset: 0; padding: 10px; display: flex; flex-direction: column; justify-content: space-between; }\nb { font-weight: 400; font-size: 17px; line-height: 1.25; }\nspan { font-size: 11px; opacity: .8; }\n[data-size="s"] span { display: none; }\n[data-size="s"] b { font-size: 11px; }'
  },
  {
    name: 'Gradient', color: '#6a00ff',
    html: '<div class="t"><span>Metro OS</span></div>',
    css: 'body { background: linear-gradient(135deg, #6a00ff, #d80073); }\n.t { position: absolute; left: 8px; bottom: 6px; font-size: 12px; }'
  }
];

export const tiles = () => store.get('customTiles') || [];
const saveTiles = (list) => { store.set('customTiles', list); emit('custom-tiles'); };

const SIZES = [['s', 70, 70], ['m', 146, 146], ['w', 300, 146], ['l', 300, 300]];

function preview(t) {
  return h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'flex-start', margin: '10px 0' } },
    SIZES.map(([size, w, hh]) => h('div', { style: { position: 'relative', width: `${w}px`, height: `${hh}px`, background: t.color || 'var(--accent)', flex: 'none' }, title: size },
      tileFrame(t, size))));
}

export default function mount(ctx) {
  const { el, go, shell } = ctx;
  let view = null;
  let pv = null;

  function main(tab) {
    view = 'main';
    pv = pivot({
      appTitle: 'Live Tile Studio',
      items: [
        {
          id: 'mine', title: 'my tiles', render: (p) => {
            const list = tiles();
            if (!list.length) p.append(h('p', { class: 'empty' }, h('b', {}, 'No tiles yet'), 'Start from a template, or install one from the Store.'));
            for (const t of list) {
              p.append(h('button', { class: 'list-row', type: 'button', onclick: () => go(`#/app/studio/edit/${t.id}`) },
                h('span', { class: 'list-row__icon', style: { background: t.color, position: 'relative' } }, tileFrame(t, 's')),
                h('span', { class: 'list-row__body' }, h('b', {}, t.name), h('span', {}, t.from ? `from the Store · ${t.from}` : 'made by you'))));
            }
          }
        },
        {
          id: 'templates', title: 'templates', render: (p) => {
            p.append(h('p', { class: 'hint', style: { margin: '0 0 8px' } }, 'Pick one to start. Tiles are HTML and CSS; scripts run sandboxed.'));
            TEMPLATES.forEach((tpl, i) => p.append(h('button', { class: 'list-row', type: 'button', onclick: () => create(tpl) },
              h('span', { class: 'list-row__icon', style: { background: tpl.color, position: 'relative' } }, tileFrame(tpl, 's')),
              h('span', { class: 'list-row__body' }, h('b', {}, tpl.name), h('span', {}, `template ${i + 1}`)))));
          }
        }
      ],
      active: tab,
      onChange: (id) => go(`#/app/studio/${id}`, { replace: true })
    });
    return screenOf(pv, appbar({
      buttons: [
        { icon: 'fa-solid fa-plus', label: 'new tile', onClick: () => go('#/app/studio/templates') },
        { icon: 'fa-solid fa-store', label: 'community', onClick: () => go('#/app/store/tiles') }
      ],
      menu: [{ label: 'about Live Tile Studio', onClick: () => go('#/info/studio') }]
    }));
  }

  function create(tpl) {
    const t = { id: `t${Date.now().toString(36)}`, name: tpl.name, color: tpl.color, html: tpl.html, css: tpl.css };
    saveTiles([...tiles(), t]);
    go(`#/app/studio/edit/${t.id}`);
  }

  function editor(id) {
    view = 'edit';
    const t0 = tiles().find((x) => x.id === id);
    if (!t0) { ctx.toast('That tile isn’t on this device.'); return main('mine'); }
    const t = { ...t0 };
    const prev = h('div');
    let timer = 0;
    const repaint = () => { clearTimeout(timer); timer = setTimeout(() => prev.replaceChildren(preview(t)), 350); };
    prev.append(preview(t));
    const code = (label, key) => {
      const box = textbox({ label, value: t[key], multiline: true, onInput: (v) => { t[key] = v; repaint(); } });
      Object.assign(box.input.style, { fontFamily: 'ui-monospace, Consolas, monospace', fontSize: '13px', minHeight: '140px' });
      box.input.spellcheck = false;
      return box;
    };
    const pinned = () => shell.home.start.isPinned(`tile:${t.id}`);
    const page = h('div', { class: 'page has-appbar' },
      header('Live Tile Studio', 'edit tile'),
      textbox({ label: 'Name', value: t.name, onInput: (v) => { t.name = v; } }),
      picker({ label: 'Tile colour', value: Object.keys(ACCENTS).find((k) => ACCENTS[k] === t.color) || 'cobalt', options: Object.entries(ACCENTS).map(([value, swatch]) => ({ value, label: value, swatch })), grid: true, full: true, host: el, onChange: (v) => { t.color = ACCENTS[v]; repaint(); } }),
      h('span', { class: 'field__label' }, 'Preview: small, medium, wide, large'), prev,
      code('HTML', 'html'), code('CSS', 'css'),
      h('p', { class: 'hint' }, 'Your tile gets data-size="s|m|w|l" on its <html> element and --accent in CSS. Scripts run in a sandbox with no access to Metro OS.'));
    const save = () => { saveTiles(tiles().map((x) => (x.id === t.id ? { ...t, name: t.name.trim() || 'My tile' } : x))); };
    const wrap = screenOf(page, appbar({
      buttons: [
        { icon: 'fa-solid fa-check', label: 'save', onClick: () => { save(); ctx.toast('Saved'); } },
        { icon: 'fa-solid fa-thumbtack', label: 'pin to start', onClick: () => { save(); if (pinned()) ctx.toast('Already on start'); else shell.home.start.pin(`tile:${t.id}`); } },
        { icon: 'fa-solid fa-trash', label: 'delete', onClick: async () => { if (!(await dialog(el, { title: 'Delete this tile?', body: t.name, ok: 'delete' }))) return; shell.home.start.unpin(`tile:${t.id}`); saveTiles(tiles().filter((x) => x.id !== t.id)); ctx.back(); } }
      ],
      menu: [{ label: 'copy as JSON (to share in the Store)', onClick: () => navigator.clipboard?.writeText(JSON.stringify({ id: t.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), name: t.name, author: store.get('user.name') || 'you', color: t.color, html: t.html, css: t.css }, null, 2)).then(() => ctx.toast('Copied. Paste it into store/catalog.json in a pull request.')) }]
    }));
    wrap.cleanup = () => { clearTimeout(timer); save(); };
    return wrap;
  }

  const route = pageRouter(el, (sub) => {
    if (sub[0] === 'edit' && sub[1]) return editor(sub[1]);
    if (sub[0] === 'community') { setTimeout(() => go('#/app/store/tiles', { replace: true }), 0); return null; }
    const tab = sub[0] === 'templates' || sub[0] === 'new' ? 'templates' : 'mine';
    if (view === 'main' && pv) { pv.select(tab, true); return null; }
    return main(tab);
  });

  return { route(sub, opts) { route(sub, { ...opts, force: view !== 'main' && !sub.length }); } };
}
