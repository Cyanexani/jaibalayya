/* Phone: history, speed dial and a keypad. A browser can't place calls, so
   "call" hands the number to your device's own phone app (on a phone) and
   logs it here. */

import { h, on } from '../util.js';
import { pivot, appbar, pageRouter, screenOf } from '../controls.js';
import * as C from '../contacts.js';

const KEYS = [['1', ''], ['2', 'abc'], ['3', 'def'], ['4', 'ghi'], ['5', 'jkl'], ['6', 'mno'], ['7', 'pqrs'], ['8', 'tuv'], ['9', 'wxyz'], ['*', ''], ['0', '+'], ['#', '']];
const when = (ts) => {
  const d = new Date(ts);
  return d.toDateString() === new Date().toDateString() ? d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
};

export default function mount(ctx) {
  const { el, go } = ctx;
  let pv = null;
  let view = null;
  let typed = '';

  function call(number) {
    const who = C.byPhone(number);
    C.logCall({ who: who?.id, number, kind: 'outgoing' });
    const a = h('a', { href: `tel:${number.replace(/[^\d+*#]/g, '')}` });
    document.body.append(a); a.click(); a.remove();
    ctx.toast(`Calling ${who?.name || number} with your device’s phone app`);
  }

  const historyRow = (k) => {
    const c = k.who ? C.contact(k.who) : null;
    const icon = { missed: 'fa-solid fa-phone-slash', incoming: 'fa-solid fa-arrow-down', outgoing: 'fa-solid fa-arrow-up', declined: 'fa-solid fa-xmark' }[k.kind] || 'fa-solid fa-phone';
    return h('button', { class: 'list-row', type: 'button', onclick: () => call(k.number) },
      h('span', { class: 'list-row__icon', style: { background: k.kind === 'missed' ? '#c8322f' : c?.color || 'var(--accent)' } }, h('i', { class: icon })),
      h('span', { class: 'list-row__body' }, h('b', {}, c?.name || k.number), h('span', {}, `${k.kind}${k.silent ? ' while silent' : k.quiet ? ' in quiet hours' : ''} · ${when(k.at)}`)));
  };

  function keypad(pane) {
    const display = h('div', { class: 'bigtime', style: { minHeight: '72px', wordBreak: 'break-all' } });
    const who = h('p', { class: 'meta-line', style: { minHeight: '18px' } });
    const paint = () => { display.textContent = typed || ' '; who.textContent = typed.length > 3 ? (C.byPhone(typed)?.name || '') : ''; };
    const grid = h('div', { class: 'pin__pad', style: { padding: 0 } }, KEYS.map(([k, sub]) => h('button', {
      type: 'button', style: { background: 'var(--chrome)', color: 'var(--fg)' }, onclick: () => { typed += k; paint(); }
    }, k, sub ? h('small', {}, sub) : null)));
    pane.append(display, who, grid,
      h('div', { class: 'btn-row' },
        h('button', { class: 'btn btn--accent', type: 'button', style: { flex: 1 }, onclick: () => typed && call(typed) }, h('i', { class: 'fa-solid fa-phone' }), 'call'),
        h('button', { class: 'btn', type: 'button', 'aria-label': 'Delete', onclick: () => { typed = typed.slice(0, -1); paint(); } }, h('i', { class: 'fa-solid fa-delete-left' }))));
    paint();
  }

  function main(tab) {
    view = 'main';
    // Seeing the history clears the missed-call badge.
    const unseen = C.calls().filter((k) => k.kind === 'missed' && !k.seen);
    if (unseen.length) C.markSeen();
    pv = pivot({
      appTitle: 'Phone',
      items: [
        { id: 'history', title: 'history', render: (p) => p.append(...C.calls().map(historyRow), h('p', { class: 'hint' }, 'Calls are placed by your device’s phone app. The first few entries are made up.')) },
        { id: 'favourites', title: 'speed dial', render: (p) => { const f = C.contacts().filter((c) => c.favourite && c.phone); p.append(...(f.length ? f.map((c) => h('button', { class: 'list-row', type: 'button', onclick: () => call(c.phone) }, h('span', { class: 'list-row__icon', style: { background: c.color } }, C.initials(c.name)), h('span', { class: 'list-row__body' }, h('b', {}, c.name), h('span', {}, c.phone)))) : [h('p', { class: 'empty' }, 'Star someone in People to add them here.')])); } },
        { id: 'keypad', title: 'keypad', render: keypad }
      ],
      active: tab,
      onChange: (id) => go(`#/app/phone/${id}`, { replace: true })
    });
    return screenOf(pv, appbar({
      buttons: [{ icon: 'fa-solid fa-address-book', label: 'people', onClick: () => go('#/app/people') }],
      menu: [
        { label: 'try an incoming call', onClick: () => { ctx.toast('Ringing in 3 seconds. Go to start to watch the tile.'); setTimeout(async () => (await import('../calls.js')).incomingCall({ app: 'phone' }), 3000); } },
        { label: 'about Phone', onClick: () => go('#/info/phone') }
      ]
    }));
  }

  const route = pageRouter(el, (sub) => {
    const tab = ['history', 'favourites', 'keypad'].includes(sub[0]) ? sub[0] : 'history';
    if (view === 'main' && pv) { pv.select(tab, true); return null; }
    return main(tab);
  });
  const off = on('calls', () => { if (view === 'main') { view = null; route(['history', Date.now()], { dir: 0, force: true }); } });

  return {
    route(sub, opts) {
      if (sub[0] === 'call' && sub[1]) { route(['history'], opts); call(decodeURIComponent(sub[1])); return; }
      route(sub, opts);
    },
    destroy: off
  };
}
