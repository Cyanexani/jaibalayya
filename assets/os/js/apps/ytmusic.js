/* YouTube Music: your playlists and liked videos, played in YouTube's own
   player (kept visible, as YouTube requires). Plays the next item in the
   list automatically. */

import { h, on, copyText } from '../util.js';
import { pivot, appbar, textbox, button, loader, header, pageRouter, screenOf } from '../controls.js';
import * as Y from '../ytmusic.js';

export default function mount(ctx) {
  const { el, go } = ctx;
  let pv = null;
  let view = null;
  let player = null;
  let queue = [];
  let index = 0;
  const holder = h('div', { style: { position: 'relative', aspectRatio: '16 / 9', background: '#000', margin: '0 0 10px' } }, h('div', { id: `yt-${Date.now()}` }));
  const nowLine = h('p', { class: 'meta-line' });

  function setup() {
    view = 'setup';
    const box = textbox({ label: 'OAuth Client ID', value: Y.clientId(), placeholder: '….apps.googleusercontent.com' });
    return screenOf(h('div', { class: 'page' },
      header('YouTube Music', 'connect'),
      h('p', { class: 'lede' }, 'Connect your own Google account to see your playlists and liked videos. Access is read-only, and only an app ID goes into this page.'),
      h('ol', { class: 'md', style: { paddingLeft: '20px' } },
        h('li', {}, 'In Google Cloud Console, enable the YouTube Data API v3.'),
        h('li', {}, 'Create an OAuth client ID of type “Web application”.'),
        h('li', {}, 'Add this Authorized JavaScript origin:'),
        h('li', { style: { listStyle: 'none', marginLeft: '-20px' } }, h('code', {}, location.origin), ' ', h('button', { class: 'chip-btn', type: 'button', onclick: () => copyText(location.origin).then(() => ctx.toast('Copied')) }, 'copy')),
        h('li', {}, 'Paste the Client ID here and connect.')),
      box,
      h('div', { class: 'btn-row' },
        button('connect Google', () => { Y.setClientId(box.input.value); Y.connect().catch((e) => ctx.toast(e.message)); }, { accent: true, icon: 'fa-brands fa-youtube' }),
        button('open Google Cloud', () => window.open('https://console.cloud.google.com/apis/credentials', '_blank', 'noopener'))),
      h('p', { class: 'hint' }, 'Google sign-ins last an hour; after that, tap connect again.')));
  }

  async function playList(items, i = 0) {
    queue = items;
    index = i;
    await startPlayer();
  }

  async function startPlayer() {
    const it = queue[index];
    if (!it) return;
    nowLine.textContent = `${it.title} · ${it.channel}`;
    const YT = await Y.loadPlayerApi();
    if (player) { player.loadVideoById(it.id); return; }
    player = new YT.Player(holder.firstChild, {
      videoId: it.id, width: '100%', height: '100%',
      playerVars: { autoplay: 1, playsinline: 1, rel: 0 },
      events: {
        onStateChange: (e) => { if (e.data === YT.PlayerState.ENDED && index < queue.length - 1) { index++; startPlayer(); } if (e.data === YT.PlayerState.PLAYING) window.dispatchEvent(new Event('metro:video-play')); }
      }
    });
    const f = holder.querySelector('iframe');
    if (f) Object.assign(f.style, { position: 'absolute', inset: 0, width: '100%', height: '100%' });
  }

  const rowFor = (list) => (it, i) => h('button', { class: 'list-row', type: 'button', onclick: () => { playList(list, i); pv?.select('now-playing'); } },
    h('span', { class: 'list-row__icon' }, it.thumb ? h('img', { src: it.thumb, alt: '' }) : h('i', { class: 'fa-solid fa-music' })),
    h('span', { class: 'list-row__body' }, h('b', {}, it.title), h('span', {}, it.channel)));

  const listPane = (load) => (pane) => {
    pane.append(loader());
    load().then((items) => pane.replaceChildren(...(items.length ? items.map(rowFor(items)) : [h('p', { class: 'empty' }, 'Nothing here yet.')])))
      .catch((e) => pane.replaceChildren(h('p', { class: 'empty' }, e.message)));
  };

  function main(tab) {
    view = 'main';
    pv = pivot({
      appTitle: 'YouTube Music',
      items: [
        { id: 'now-playing', title: 'now playing', render: (p) => p.append(holder, nowLine, h('p', { class: 'hint' }, 'Pick a playlist or a liked video. The next one plays automatically.')) },
        {
          id: 'playlists', title: 'playlists', render: (pane) => {
            pane.append(loader());
            Y.playlists().then((pls) => pane.replaceChildren(...(pls.length ? pls.map((p) => h('button', { class: 'list-row', type: 'button', onclick: async () => { const items = await Y.playlistItems(p.id); playList(items, 0); pv.select('now-playing'); } },
              h('span', { class: 'list-row__icon' }, p.thumb ? h('img', { src: p.thumb, alt: '' }) : h('i', { class: 'fa-solid fa-list' })),
              h('span', { class: 'list-row__body' }, h('b', {}, p.title), h('span', {}, `${p.count} items`)))) : [h('p', { class: 'empty' }, 'No playlists on this account.')])))
              .catch((e) => pane.replaceChildren(h('p', { class: 'empty' }, e.message)));
          }
        },
        { id: 'liked', title: 'liked', render: listPane(Y.liked) }
      ],
      active: tab,
      onChange: (id) => go(`#/app/ytmusic/${id}`, { replace: true })
    });
    return screenOf(pv, appbar({
      buttons: [
        { icon: 'fa-solid fa-backward-step', label: 'previous', onClick: () => { if (index > 0) { index--; startPlayer(); } } },
        { icon: 'fa-solid fa-play', label: 'play/pause', onClick: () => { if (!player) return; player.getPlayerState() === 1 ? player.pauseVideo() : player.playVideo(); } },
        { icon: 'fa-solid fa-forward-step', label: 'next', onClick: () => { if (index < queue.length - 1) { index++; startPlayer(); } } }
      ],
      menu: [{ label: 'disconnect Google', onClick: () => Y.disconnect() }, { label: 'about YouTube Music', onClick: () => go('#/info/ytmusic') }]
    }));
  }

  const route = pageRouter(el, (sub) => {
    if (!Y.connected() || sub[0] === 'setup') return setup();
    const tab = ['now-playing', 'playlists', 'liked'].includes(sub[0]) ? sub[0] : 'playlists';
    if (view === 'main' && pv) { pv.select(tab, true); return null; }
    return main(tab);
  });
  const offs = [
    on('ytmusic', () => { view = null; route([Y.connected() ? 'playlists' : 'setup', Date.now()], { dir: 0, force: true }); }),
    on('ytmusic-error', (err) => ctx.toast(`Google sign-in didn’t finish (${err}).`))
  ];

  return {
    route,
    // YouTube's player must stay visible while it plays, so leaving the app pauses it.
    hide() { player?.pauseVideo?.(); },
    destroy() { player?.destroy?.(); offs.forEach((f) => f()); }
  };
}
