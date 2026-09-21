/* Store: wallpapers and live tiles shared by the community. The catalog
   is store/catalog.json in the Metro OS repository; new entries arrive as
   pull requests and are reviewed before they appear. */

import { h, emit } from '../util.js';
import { pivot, appbar, loader, button, pageRouter, screenOf } from '../controls.js';
import { store } from '../store.js';
import { tileFrame } from '../customtile.js';
import { REPO_URL } from '../config.js';

let catalogP = null;
const catalog = () => (catalogP ||= fetch('store/catalog.json', { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : Promise.reject(new Error('The Store catalog didn’t load.')))));

const installedWalls = () => store.get('installedWallpapers') || {};
const customTiles = () => store.get('customTiles') || [];

export default function mount(ctx) {
  const { el, go, shell } = ctx;
  let pv = null;
  let built = false;

  function installWallpaper(w, apply = true) {
    store.set('installedWallpapers', { ...installedWalls(), [`store-${w.id}`]: { label: w.name, css: w.css } });
    if (apply) store.set('wallpaper', `store-${w.id}`);
    ctx.toast(apply ? `${w.name} is your wallpaper` : `${w.name} installed`);
    refresh();
  }
  function installTile(t) {
    const id = `store-${t.id}`;
    if (!customTiles().some((x) => x.id === id)) store.set('customTiles', [...customTiles(), { id, name: t.name, color: t.color, html: t.html, css: t.css, from: t.author }]);
    emit('custom-tiles');
    shell.home.start.pin(`tile:${id}`);
    refresh();
  }

  function wallCard(w) {
    const has = !!installedWalls()[`store-${w.id}`];
    return h('div', { style: { margin: '0 0 14px' } },
      h('div', { style: { height: '120px', background: w.css, border: '1px solid var(--line)' } }),
      h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px' } },
        h('div', {}, h('b', { style: { fontWeight: 400, fontSize: '18px' } }, w.name), h('div', { class: 'meta-line' }, `by ${w.author}`)),
        button(has ? 'use' : 'install', () => installWallpaper(w))));
  }

  function tileCard(t) {
    const has = customTiles().some((x) => x.id === `store-${t.id}`);
    return h('div', { style: { display: 'flex', gap: '12px', alignItems: 'center', margin: '0 0 12px' } },
      h('div', { style: { position: 'relative', width: '96px', height: '96px', flex: 'none', background: t.color } }, tileFrame(t, 'm')),
      h('div', { style: { flex: 1, minWidth: 0 } }, h('b', { style: { fontWeight: 400, fontSize: '18px' } }, t.name), h('div', { class: 'meta-line' }, `by ${t.author}`),
        h('div', { class: 'btn-row', style: { margin: '6px 0 0' } }, button(has ? 'pin again' : 'install + pin', () => installTile(t)))));
  }

  function catalogPane(kind) {
    return (pane) => {
      pane.append(loader());
      catalog().then((c) => pane.replaceChildren(...(c[kind] || []).map(kind === 'wallpapers' ? wallCard : tileCard)))
        .catch((e) => pane.replaceChildren(h('p', { class: 'empty' }, e.message)));
    };
  }

  function installedPane(pane) {
    const walls = Object.entries(installedWalls());
    const tilesIn = customTiles().filter((t) => t.id.startsWith('store-'));
    if (!walls.length && !tilesIn.length) { pane.append(h('p', { class: 'empty' }, h('b', {}, 'Nothing installed yet'), 'Everything is up to date.')); return; }
    pane.append(h('p', { class: 'hint', style: { margin: '0 0 8px' } }, 'Everything is up to date.'),
      ...walls.map(([id, w]) => h('div', { class: 'list-row', style: { cursor: 'default' } },
        h('span', { class: 'list-row__icon', style: { background: w.css } }),
        h('span', { class: 'list-row__body' }, h('b', {}, w.label), h('span', {}, 'wallpaper')),
        button('remove', () => { const all = installedWalls(); delete all[id]; store.set('installedWallpapers', all); if (store.get('wallpaper') === id) store.set('wallpaper', 'none'); refresh(); }))),
      ...tilesIn.map((t) => h('div', { class: 'list-row', style: { cursor: 'default' } },
        h('span', { class: 'list-row__icon', style: { background: t.color, position: 'relative' } }, tileFrame(t, 's')),
        h('span', { class: 'list-row__body' }, h('b', {}, t.name), h('span', {}, 'live tile')),
        button('remove', () => { shell.home.start.unpin(`tile:${t.id}`); store.set('customTiles', customTiles().filter((x) => x.id !== t.id)); emit('custom-tiles'); refresh(); }))));
  }

  function submitPane(pane) {
    pane.append(
      h('p', { class: 'lede' }, 'Made something? Share it.'),
      h('ol', { class: 'md', style: { paddingLeft: '20px' } },
        h('li', {}, 'Make a tile in Live Tile Studio, then choose “copy as JSON” from its menu. For a wallpaper, write a CSS background.'),
        h('li', {}, 'Open store/catalog.json on GitHub and add your entry.'),
        h('li', {}, 'Submit the change as a pull request. It’s reviewed, then appears here for everyone.')),
      h('div', { class: 'btn-row' },
        button('edit the catalog on GitHub', () => window.open(`${REPO_URL}/edit/main/store/catalog.json`, '_blank', 'noopener'), { accent: true, icon: 'fa-brands fa-github' }),
        button('open Live Tile Studio', () => go('#/app/studio'))));
  }

  function main(tab) {
    pv = pivot({
      appTitle: 'Store',
      items: [
        { id: 'wallpapers', title: 'wallpapers', render: catalogPane('wallpapers') },
        { id: 'tiles', title: 'live tiles', render: catalogPane('tiles') },
        { id: 'installed', title: 'installed', render: installedPane },
        { id: 'submit', title: 'share yours', render: submitPane }
      ],
      active: tab,
      onChange: (id) => go(`#/app/store/${id}`, { replace: true })
    });
    return screenOf(pv, appbar({ buttons: [], menu: [{ label: 'about Store', onClick: () => go('#/info/store') }] }));
  }

  let current = 'wallpapers';
  const route = pageRouter(el, (sub) => {
    const map = { top: 'tiles', updates: 'installed' };
    current = map[sub[0]] || (['wallpapers', 'tiles', 'installed', 'submit'].includes(sub[0]) ? sub[0] : 'wallpapers');
    if (built && pv) { pv.select(current, true); return null; }
    built = true;
    return main(current);
  });
  function refresh() { built = false; route([current, Date.now()], { dir: 0, force: true }); }

  return { route };
}
