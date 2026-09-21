/* Podcasts: find and follow shows, play episodes, pick up where you
   stopped. Speed control and 15/30-second skips. */

import { h, on } from '../util.js';
import { pivot, appbar, textbox, loader, header, pageRouter, screenOf } from '../controls.js';
import * as P from '../podcasts.js';

const fmt = (s) => {
  s = Math.max(0, Math.floor(s || 0));
  const hh = Math.floor(s / 3600), mm = Math.floor((s % 3600) / 60), ss = s % 60;
  return hh ? `${hh}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}` : `${mm}:${String(ss).padStart(2, '0')}`;
};
const ago = (iso) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

export default function mount(ctx) {
  const { el, go } = ctx;
  let pv = null;
  let view = null;
  const offs = [];

  const showRow = (s) => h('button', { class: 'list-row', type: 'button', onclick: () => go(`#/app/podcasts/show/${s.id}`) },
    h('span', { class: 'list-row__icon' }, h('img', { src: s.art, alt: '', loading: 'lazy' })),
    h('span', { class: 'list-row__body' }, h('b', {}, s.title), h('span', {}, s.author || '')));

  function episodeRow(e) {
    const pos = P.positionOf(e.id);
    const left = e.length ? Math.max(0, e.length - pos) : 0;
    return h('button', { class: P.pod.episode?.id === e.id ? 'list-row is-active' : 'list-row', type: 'button', onclick: () => { P.pod.play(e); go('#/app/podcasts/playing'); } },
      h('span', { class: 'list-row__icon' }, e.art ? h('img', { src: e.art, alt: '', loading: 'lazy' }) : h('i', { class: 'fa-solid fa-podcast' })),
      h('span', { class: 'list-row__body' }, h('b', {}, e.title), h('span', {}, `${e.show ? `${e.show} · ` : ''}${ago(e.date)}${e.length ? ` · ${pos > 30 ? `${fmt(left)} left` : fmt(e.length)}` : ''}`)));
  }

  function followingPane(pane) {
    const paint = () => pane.replaceChildren(...(P.following().length ? P.following().map(showRow)
      : [h('p', { class: 'empty' }, h('b', {}, 'Not following anything yet'), 'Search for a show and tap follow.')]));
    paint();
    offs.push(on('podcasts-follow', paint));
  }

  function newPane(pane) {
    if (!P.following().length) { pane.append(h('p', { class: 'empty' }, 'Follow a few shows and their newest episodes show up here.')); return; }
    pane.append(loader());
    Promise.all(P.following().slice(0, 12).map((s) => P.episodes(s.id, 5).catch(() => ({ episodes: [] }))))
      .then((all) => {
        const eps = all.flatMap((x) => x.episodes).sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 40);
        pane.replaceChildren(...(eps.length ? eps.map(episodeRow) : [h('p', { class: 'empty' }, 'No new episodes.')]));
      });
  }

  function searchPane(pane) {
    const results = h('div');
    let t = 0;
    pane.append(textbox({
      label: 'Find a show', placeholder: 'e.g. design, history, science', onInput: (q) => {
        clearTimeout(t);
        if (q.trim().length < 2) return results.replaceChildren();
        t = setTimeout(() => {
          results.replaceChildren(loader());
          P.searchShows(q.trim()).then((l) => results.replaceChildren(...(l.length ? l.map(showRow) : [h('p', { class: 'empty' }, 'No shows found.')])))
            .catch((e) => results.replaceChildren(h('p', { class: 'empty' }, e.message)));
        }, 350);
      }
    }), results);
  }

  function main(tab) {
    view = 'main';
    pv = pivot({
      appTitle: 'Podcasts',
      items: [
        { id: 'following', title: 'following', render: followingPane },
        { id: 'new', title: 'new episodes', render: newPane },
        { id: 'search', title: 'search', render: searchPane }
      ],
      active: tab,
      onChange: (id) => go(`#/app/podcasts/${id}`, { replace: true })
    });
    return screenOf(pv, appbar({
      buttons: [{ icon: 'fa-solid fa-play', label: 'now playing', onClick: () => go('#/app/podcasts/playing') }],
      menu: [{ label: 'about Podcasts', onClick: () => go('#/info/podcasts') }]
    }));
  }

  function showPage(id) {
    view = 'show';
    const body = h('div', {}, loader());
    const followBtn = h('button', { class: 'btn', type: 'button' }, 'follow');
    let show = null;
    const paintFollow = () => { followBtn.textContent = show && P.isFollowing(show.id) ? 'following ✓' : 'follow'; };
    followBtn.addEventListener('click', () => { if (show) { P.toggleFollow(show); paintFollow(); } });
    P.episodes(id).then(({ show: s, episodes }) => {
      show = s;
      paintFollow();
      body.replaceChildren(
        s ? h('div', { style: { display: 'flex', gap: '14px', alignItems: 'center', margin: '4px 0 12px' } },
          h('img', { src: s.art, alt: '', style: { width: '110px', height: '110px', objectFit: 'cover' } }),
          h('div', {}, h('div', { style: { fontSize: '22px', fontWeight: 300, lineHeight: 1.2 } }, s.title), h('div', { class: 'meta-line' }, s.author), h('div', { class: 'btn-row', style: { margin: '8px 0 0' } }, followBtn))) : null,
        ...(episodes.length ? episodes.map(episodeRow) : [h('p', { class: 'empty' }, 'No playable episodes found.')]));
    }).catch((e) => body.replaceChildren(h('p', { class: 'empty' }, e.message)));
    return screenOf(h('div', { class: 'page' }, h('p', { class: 'app-title' }, 'Podcasts'), body));
  }

  function playing() {
    view = 'playing';
    const art = h('img', { class: 'np__art', alt: '' });
    const title = h('div', { class: 'np__title' });
    const showName = h('div', { class: 'np__artist' });
    const range = h('input', { type: 'range', min: 0, max: 1000, value: 0, 'aria-label': 'Position' });
    const cur = h('span'), dur = h('span');
    const playBtn = h('button', { class: 'big', type: 'button', onclick: () => P.pod.toggle() });
    const rateBtn = h('button', { type: 'button', 'aria-label': 'Playback speed', onclick: () => P.pod.cycleRate(), style: { fontSize: '15px' } });
    let seeking = false;
    range.addEventListener('input', () => { seeking = true; cur.textContent = fmt((range.value / 1000) * P.pod.duration); });
    range.addEventListener('change', () => { P.pod.seek((range.value / 1000) * P.pod.duration); seeking = false; });
    const page = h('div', { class: 'np' }, h('p', { class: 'app-title' }, 'Podcasts'), art, title, showName,
      h('div', { class: 'np__bar' }, range, h('div', { class: 'np__times' }, cur, dur)),
      h('div', { class: 'np__controls' },
        h('button', { type: 'button', 'aria-label': 'Back 15 seconds', onclick: () => P.pod.skip(-15) }, h('i', { class: 'fa-solid fa-rotate-left' })),
        playBtn,
        h('button', { type: 'button', 'aria-label': 'Forward 30 seconds', onclick: () => P.pod.skip(30) }, h('i', { class: 'fa-solid fa-rotate-right' })),
        rateBtn));
    const paint = () => {
      const e = P.pod.episode;
      if (!e) { title.textContent = 'Nothing playing'; showName.textContent = 'Find a show and pick an episode.'; art.removeAttribute('src'); return; }
      if (art.getAttribute('src') !== e.art) art.src = e.art || '';
      title.textContent = e.title;
      showName.textContent = e.show || '';
      if (!seeking) { range.value = P.pod.duration ? (P.pod.elapsed / P.pod.duration) * 1000 : 0; cur.textContent = fmt(P.pod.elapsed); }
      dur.textContent = fmt(P.pod.duration);
      playBtn.replaceChildren(h('i', { class: P.pod.playing ? 'fa-solid fa-pause' : 'fa-solid fa-play' }));
      playBtn.setAttribute('aria-label', P.pod.playing ? 'Pause' : 'Play');
      rateBtn.textContent = `${P.pod.rate || 1}×`;
    };
    paint();
    const wrap = screenOf(page, appbar({ buttons: [{ icon: 'fa-solid fa-list', label: 'following', onClick: () => go('#/app/podcasts') }] }));
    wrap.cleanup = on('podcasts', paint);
    return wrap;
  }

  const route = pageRouter(el, (sub) => {
    if (sub[0] === 'show' && sub[1]) return showPage(sub[1]);
    if (sub[0] === 'playing' || sub[0] === 'continue') {
      if (sub[0] === 'continue' && P.pod.episode) P.pod.play();
      return playing();
    }
    const tab = ['following', 'new', 'search'].includes(sub[0]) ? sub[0] : 'following';
    if (view === 'main' && pv) { pv.select(tab, true); return null; }
    return main(tab);
  });

  offs.push(on('podcast-error', () => ctx.toast('That episode couldn’t play. The show’s host may be blocking it.')));
  return { route, destroy() { offs.forEach((f) => f()); } };
}
