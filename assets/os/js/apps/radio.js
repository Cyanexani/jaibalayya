/* Radio: live stations from the Radio Browser directory. Top stations,
   stations near you, search, and favourites. */

import { h, on } from '../util.js';
import { pivot, appbar, textbox, loader, pageRouter, screenOf } from '../controls.js';
import * as R from '../radio.js';

const country = () => (navigator.language || 'en-US').split('-')[1] || 'US';

export default function mount(ctx) {
  const { el, go } = ctx;
  let pv = null;
  let built = false;
  const offs = [];

  function stationRow(s) {
    const active = R.radio.station?.id === s.id;
    const icon = h('span', { class: 'list-row__icon' }, s.icon ? h('img', { src: s.icon, alt: '', loading: 'lazy', referrerpolicy: 'no-referrer', onerror: (e) => e.target.replaceWith(h('i', { class: 'fa-solid fa-radio' })) }) : h('i', { class: 'fa-solid fa-radio' }));
    return h('div', { class: 'queue-row' },
      h('button', { class: active ? 'list-row is-active' : 'list-row', type: 'button', onclick: () => R.radio.play(s) },
        icon,
        h('span', { class: 'list-row__body' }, h('b', {}, s.name), h('span', {}, [s.country, s.tags, s.bitrate ? `${s.bitrate} kbps` : ''].filter(Boolean).join(' · ')))),
      h('button', { class: 'grip', type: 'button', 'aria-label': R.isFavourite(s.id) ? `Remove ${s.name} from favourites` : `Add ${s.name} to favourites`, onclick: () => R.toggleFavourite(s) },
        h('i', { class: R.isFavourite(s.id) ? 'fa-solid fa-heart' : 'fa-regular fa-heart' })));
  }

  function listPane(load) {
    return (pane) => {
      pane.append(loader());
      load().then((list) => {
        pane.replaceChildren(...(list.length ? list.map(stationRow) : [h('p', { class: 'empty' }, 'No stations found.')]));
      }).catch((e) => pane.replaceChildren(h('p', { class: 'empty' }, e.message)));
    };
  }

  function searchPane(pane) {
    const results = h('div');
    let t = 0;
    const box = textbox({
      label: 'Search stations', placeholder: 'name, e.g. jazz, BBC, lofi', onInput: (q) => {
        clearTimeout(t);
        if (q.trim().length < 2) return results.replaceChildren();
        t = setTimeout(() => {
          results.replaceChildren(loader());
          R.search(q.trim()).then((l) => results.replaceChildren(...(l.length ? l.map(stationRow) : [h('p', { class: 'empty' }, 'No stations found.')])))
            .catch((e) => results.replaceChildren(h('p', { class: 'empty' }, e.message)));
        }, 350);
      }
    });
    pane.append(box,
      h('div', { class: 'chips', style: { margin: '6px 0 10px' } }, ['jazz', 'lofi', 'news', 'classical', 'rock', 'bollywood', 'electronic'].map((tag) =>
        h('button', { class: 'chip-btn', type: 'button', onclick: () => { results.replaceChildren(loader()); R.byTag(tag).then((l) => results.replaceChildren(...l.map(stationRow))); } }, tag))),
      results);
  }

  function favouritesPane(pane) {
    const paint = () => pane.replaceChildren(...(R.favourites().length ? R.favourites().map(stationRow) : [h('p', { class: 'empty' }, h('b', {}, 'No favourites yet'), 'Tap ♡ next to a station to keep it here.')]));
    paint();
    offs.push(on('radio', paint));
  }

  const nowBar = h('div', { class: 'notice', style: { margin: '0 18px 8px', display: 'flex', alignItems: 'center', gap: '10px' } });
  function paintNow() {
    const s = R.radio.station;
    if (!s) { nowBar.hidden = true; return; }
    nowBar.hidden = false;
    nowBar.replaceChildren(
      h('button', { class: 'btn', type: 'button', 'aria-label': R.radio.playing ? 'Pause' : 'Play', onclick: () => R.radio.toggle(), style: { minWidth: '44px', padding: '0 12px' } },
        h('i', { class: R.radio.loading ? 'fa-solid fa-spinner fa-spin' : R.radio.playing ? 'fa-solid fa-pause' : 'fa-solid fa-play' })),
      h('span', { style: { minWidth: 0 } }, h('b', {}, s.name), R.radio.playing ? 'on air' : 'paused'));
  }
  offs.push(on('radio', paintNow));
  offs.push(on('radio-error', (s) => ctx.toast(`${s.name} isn’t streaming right now. Try another station.`)));

  function main(tab) {
    pv = pivot({
      appTitle: 'Radio',
      items: [
        { id: 'top', title: 'top', render: listPane(R.top) },
        { id: 'near', title: 'near you', render: listPane(() => R.byCountry(country())) },
        { id: 'search', title: 'search', render: searchPane },
        { id: 'favourites', title: 'favourites', render: favouritesPane }
      ],
      active: tab,
      onChange: (id) => go(`#/app/radio/${id}`, { replace: true })
    });
    paintNow();
    pv.insertBefore(nowBar, pv.querySelector('.pivot__body'));
    return screenOf(pv, appbar({ buttons: [], menu: [{ label: 'about Radio', onClick: () => go('#/info/radio') }] }));
  }

  const route = pageRouter(el, (sub) => {
    const tab = sub[0] === 'now' ? 'top' : ['top', 'near', 'search', 'favourites'].includes(sub[0]) ? sub[0] : 'top';
    if (built && pv) { pv.select(tab, true); return null; }
    built = true;
    return main(tab);
  });

  return {
    route(sub, opts) {
      route(sub, opts);
      if (sub[0] === 'now' && R.radio.station) R.radio.play();
    },
    destroy() { offs.forEach((f) => f()); }
  };
}
