/* Wallet: membership and loyalty cards (library card, gym, coffee shop),
   plus a made-up payment card to show the design. Metro OS never asks for
   payment card numbers. */

import { h, on, emit } from '../util.js';
import { pivot, appbar, textbox, pageRouter, screenOf, dialog } from '../controls.js';
import { store } from '../store.js';
import { ACCENTS } from '../store.js';

const DEMO_CARD = { id: 'demo', name: 'Demo Card', number: '•••• 4821', kind: 'payment', color: '#3a2f6b', demo: true };
const cards = () => [DEMO_CARD, ...(store.get('wallet.cards') || [])];
const saveCards = (list) => { store.set('wallet.cards', list.filter((c) => !c.demo)); emit('wallet'); };

function activity() {
  let a = store.get('wallet.activity');
  if (!a) {
    const now = Date.now();
    a = [
      { what: 'Coffee Corner', amount: '−3.40', at: now - 5 * 3600e3 },
      { what: 'Metro Books', amount: '−12.99', at: now - 30 * 3600e3 },
      { what: 'Refund · Gadget Store', amount: '+24.00', at: now - 80 * 3600e3 }
    ];
    store.set('wallet.activity', a);
  }
  return a;
}

const cardFace = (c) => h('div', {
  style: {
    position: 'relative', aspectRatio: '1.586', padding: '16px', margin: '0 0 12px', color: '#fff', overflow: 'hidden',
    background: `linear-gradient(135deg, ${c.color}, color-mix(in srgb, ${c.color} 55%, #000))`, display: 'flex', flexDirection: 'column'
  }
},
h('div', { style: { fontSize: '14px', opacity: 0.85 } }, c.kind === 'payment' ? 'payment card' : 'membership'),
h('div', { style: { fontSize: '26px', fontWeight: 300 } }, c.name),
h('div', { style: { marginTop: 'auto', fontSize: '22px', letterSpacing: '2px', fontVariantNumeric: 'tabular-nums' } }, c.number || ''),
c.demo ? h('div', { style: { fontSize: '12px', opacity: 0.8 } }, 'not a real card') : c.holder ? h('div', { style: { fontSize: '13px', opacity: 0.85 } }, c.holder) : null);

export default function mount(ctx) {
  const { el, go } = ctx;
  let pv = null;
  let view = null;

  function main(tab) {
    view = 'main';
    pv = pivot({
      appTitle: 'Wallet',
      items: [
        { id: 'cards', title: 'cards', render: (p) => p.append(...cards().map((c) => h('button', { type: 'button', style: { display: 'block', width: '100%', border: 0, padding: 0, background: 'none', cursor: 'pointer' }, onclick: () => go(`#/app/wallet/card/${c.id}`) }, cardFace(c)))) },
        {
          id: 'activity', title: 'activity', render: (p) => p.append(
            h('p', { class: 'hint', style: { margin: '0 0 8px' } }, 'Made-up activity for the demo card.'),
            ...activity().map((x) => h('div', { class: 'list-row', style: { cursor: 'default' } },
              h('span', { class: 'list-row__icon' }, h('i', { class: 'fa-solid fa-receipt' })),
              h('span', { class: 'list-row__body' }, h('b', {}, x.what), h('span', {}, new Date(x.at).toLocaleString())),
              h('span', { class: 'list-row__end', style: { fontSize: '16px', color: x.amount.startsWith('+') ? '#60a917' : 'var(--fg)' } }, x.amount))))
        }
      ],
      active: tab,
      onChange: (id) => go(`#/app/wallet/${id}`, { replace: true })
    });
    return screenOf(pv, appbar({
      buttons: [{ icon: 'fa-solid fa-plus', label: 'add card', onClick: () => go('#/app/wallet/add') }],
      menu: [{ label: 'about Wallet', onClick: () => go('#/info/wallet') }]
    }));
  }

  function cardPage(id) {
    view = 'card';
    const c = cards().find((x) => x.id === id);
    if (!c) return main('cards');
    return screenOf(h('div', { class: 'page has-appbar' }, h('p', { class: 'app-title' }, 'Wallet'), cardFace(c),
      c.demo ? h('p', { class: 'notice' }, 'This card shows the design only. Metro OS never asks for payment card numbers.') : h('p', { class: 'lede' }, 'Show this screen at the counter.')),
    c.demo ? null : appbar({ buttons: [{ icon: 'fa-solid fa-trash', label: 'remove', onClick: async () => { if (await dialog(el, { title: `Remove ${c.name}?`, body: 'It will be removed from this browser.', ok: 'remove' })) { saveCards(cards().filter((x) => x.id !== id)); ctx.back(); } } }] }));
  }

  function addPage() {
    view = 'add';
    const colors = Object.values(ACCENTS);
    const c = { id: `w${Date.now().toString(36)}`, name: '', number: '', holder: store.get('user.name') || '', kind: 'membership', color: colors[Math.floor(Math.random() * colors.length)] };
    const preview = h('div');
    const paint = () => preview.replaceChildren(cardFace({ ...c, name: c.name || 'Card name' }));
    paint();
    return screenOf(h('div', { class: 'page has-appbar' }, h('p', { class: 'app-title' }, 'Wallet · add a membership card'), preview,
      textbox({ label: 'Name', placeholder: 'e.g. City Library', onInput: (v) => { c.name = v; paint(); } }),
      textbox({ label: 'Member number', placeholder: 'as printed on the card', onInput: (v) => { c.number = v; paint(); } }),
      textbox({ label: 'Name on card', value: c.holder, onInput: (v) => { c.holder = v; paint(); } }),
      h('p', { class: 'hint' }, 'For library, gym and loyalty cards only. Don’t add bank or credit cards.')),
    appbar({
      buttons: [
        { icon: 'fa-solid fa-check', label: 'save', onClick: () => { if (!c.name.trim()) return ctx.toast('Give the card a name.'); saveCards([...cards(), c]); ctx.back(); } },
        { icon: 'fa-solid fa-xmark', label: 'cancel', onClick: () => ctx.back() }
      ]
    }));
  }

  const route = pageRouter(el, (sub) => {
    if (sub[0] === 'card') return cardPage(sub[1] || 'demo');
    if (sub[0] === 'add') return addPage();
    const tab = sub[0] === 'activity' ? 'activity' : 'cards';
    if (view === 'main' && pv) { pv.select(tab, true); return null; }
    return main(tab);
  });
  const off = on('wallet', () => { if (view === 'main') { view = null; route(['cards', Date.now()], { dir: 0, force: true }); } });

  return { route(sub, opts) { route(sub.length ? sub : ['cards'], { ...opts, force: view !== 'main' && !sub.length }); }, destroy: off };
}
