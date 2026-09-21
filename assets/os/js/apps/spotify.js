/* Spotify: now playing, playlists and liked songs from your own Spotify
   account, controlling Spotify on your phone or computer. */

import { h, on, copyText } from '../util.js';
import { pivot, appbar, textbox, button, loader, header, pageRouter, screenOf } from '../controls.js';
import * as S from '../spotify.js';

export default function mount(ctx) {
  const { el, go } = ctx;
  let pv = null;
  let view = null;
  let poll = 0;

  function setup() {
    view = 'setup';
    const box = textbox({ label: 'Client ID', value: S.clientId(), placeholder: '32 letters and numbers' });
    return screenOf(h('div', { class: 'page' },
      header('Spotify', 'connect'),
      h('p', { class: 'lede' }, 'Connect your own Spotify account. You only need an app ID; no secret key goes into this page.'),
      h('ol', { class: 'md', style: { paddingLeft: '20px' } },
        h('li', {}, 'Open the Spotify Developer Dashboard and create an app (any name).'),
        h('li', {}, 'Add this Redirect URI to the app:'),
        h('li', { style: { listStyle: 'none', marginLeft: '-20px' } }, h('code', {}, S.redirectUri()), ' ', h('button', { class: 'chip-btn', type: 'button', onclick: () => copyText(S.redirectUri()).then(() => ctx.toast('Copied')) }, 'copy')),
        h('li', {}, 'Tick “Web API”, save, then copy the Client ID here.')),
      box,
      h('div', { class: 'btn-row' },
        button('connect Spotify', () => { S.setClientId(box.input.value); S.connect().catch((e) => ctx.toast(e.message)); }, { accent: true, icon: 'fa-brands fa-spotify' }),
        button('open the dashboard', () => window.open('https://developer.spotify.com/dashboard', '_blank', 'noopener'))),
      h('p', { class: 'hint' }, 'Metro OS controls Spotify running on one of your devices. Playback controls need Spotify Premium.')));
  }

  function nowPane(pane) {
    const box = h('div', {}, loader());
    pane.append(box);
    const paint = async () => {
      try {
        const p = await S.nowPlaying();
        if (!p?.item) { box.replaceChildren(h('p', { class: 'empty' }, h('b', {}, 'Nothing playing'), 'Start Spotify on your phone or computer, then pick something here.')); return; }
        const it = p.item;
        const art = it.album?.images?.[0]?.url || it.images?.[0]?.url;
        box.replaceChildren(
          art ? h('img', { class: 'np__art', src: art, alt: '' }) : null,
          h('div', { class: 'np__title' }, it.name),
          h('div', { class: 'np__artist' }, (it.artists || []).map((a) => a.name).join(', ') || it.show?.name || ''),
          h('p', { class: 'meta-line' }, `on ${p.device?.name || 'your device'}`),
          h('div', { class: 'np__controls' },
            h('button', { type: 'button', 'aria-label': 'Previous', onclick: () => act('previous') }, h('i', { class: 'fa-solid fa-backward-step' })),
            h('button', { class: 'big', type: 'button', 'aria-label': p.is_playing ? 'Pause' : 'Play', onclick: () => act(p.is_playing ? 'pause' : 'play') }, h('i', { class: p.is_playing ? 'fa-solid fa-pause' : 'fa-solid fa-play' })),
            h('button', { type: 'button', 'aria-label': 'Next', onclick: () => act('next') }, h('i', { class: 'fa-solid fa-forward-step' }))));
      } catch (e) { box.replaceChildren(h('p', { class: 'empty' }, e.message)); }
    };
    const act = async (a) => { try { await S.control(a); setTimeout(paint, 500); } catch (e) { ctx.toast(e.message); } };
    paint();
    clearInterval(poll);
    poll = setInterval(() => { if (!el.hidden) paint(); }, 8000);
  }

  const listPane = (load, rowFor) => (pane) => {
    pane.append(loader());
    load().then((items) => pane.replaceChildren(...(items.length ? items.map(rowFor) : [h('p', { class: 'empty' }, 'Nothing here yet.')])))
      .catch((e) => pane.replaceChildren(h('p', { class: 'empty' }, e.message)));
  };
  const play = (fn) => fn().then(() => { ctx.toast('Playing on your Spotify device'); go('#/app/spotify/now-playing', { replace: true }); }).catch((e) => ctx.toast(e.message));

  function main(tab) {
    view = 'main';
    pv = pivot({
      appTitle: 'Spotify',
      items: [
        { id: 'now-playing', title: 'now playing', render: nowPane },
        {
          id: 'playlists', title: 'playlists', render: listPane(S.playlists, (p) => h('button', { class: 'list-row', type: 'button', onclick: () => play(() => S.playContext(p.uri)) },
            h('span', { class: 'list-row__icon' }, p.images?.[0] ? h('img', { src: p.images[0].url, alt: '' }) : h('i', { class: 'fa-solid fa-list' })),
            h('span', { class: 'list-row__body' }, h('b', {}, p.name), h('span', {}, `${p.tracks?.total ?? ''} songs`))))
        },
        {
          id: 'liked', title: 'liked songs', render: (pane) => listPane(S.liked, (t, i, all) => h('button', { class: 'list-row', type: 'button', onclick: () => play(() => S.playTracks(all.map((x) => x.uri), i)) },
            h('span', { class: 'list-row__icon' }, t.album?.images?.[2] ? h('img', { src: t.album.images[2].url, alt: '' }) : h('i', { class: 'fa-solid fa-music' })),
            h('span', { class: 'list-row__body' }, h('b', {}, t.name), h('span', {}, t.artists.map((a) => a.name).join(', ')))))(pane)
        }
      ],
      active: tab,
      onChange: (id) => go(`#/app/spotify/${id}`, { replace: true })
    });
    return screenOf(pv, appbar({
      buttons: [{ icon: 'fa-solid fa-arrows-rotate', label: 'refresh', onClick: () => { view = null; route([tab, Date.now()], { dir: 0, force: true }); } }],
      menu: [{ label: 'disconnect Spotify', onClick: () => { S.disconnect(); view = null; route(['setup'], { dir: 0, force: true }); } }, { label: 'about Spotify', onClick: () => go('#/info/spotify') }]
    }));
  }

  const route = pageRouter(el, (sub) => {
    if (!S.connected() || sub[0] === 'setup') return setup();
    const tab = ['now-playing', 'playlists', 'liked'].includes(sub[0]) ? sub[0] : 'now-playing';
    if (view === 'main' && pv) { pv.select(tab, true); return null; }
    return main(tab);
  });
  const off = on('spotify', () => { view = null; route([S.connected() ? 'now-playing' : 'setup', Date.now()], { dir: 0, force: true }); });

  return { route, hide() { clearInterval(poll); }, destroy() { clearInterval(poll); off(); } };
}
