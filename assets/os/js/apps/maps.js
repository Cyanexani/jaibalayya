/* Maps: OpenStreetMap, drawn with Leaflet. Search places as you type
   (Photon), find yourself, save places, and hand off to OpenStreetMap
   for directions. Tiles are dimmed to match the dark theme. */

import { h } from '../util.js';
import { appbar, loader, pageRouter, screenOf } from '../controls.js';
import { store } from '../store.js';
import { pushOverlay } from '../overlays.js';

const LEAFLET = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/';
let leafletReady = null;
function loadLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  if (!leafletReady) {
    leafletReady = new Promise((resolve, reject) => {
      document.head.append(h('link', { rel: 'stylesheet', href: `${LEAFLET}leaflet.min.css`, crossorigin: '' }));
      const s = h('script', { src: `${LEAFLET}leaflet.min.js`, crossorigin: '' });
      s.onload = () => resolve(window.L);
      s.onerror = () => reject(new Error('The map library didn’t load. Check your connection.'));
      document.head.append(s);
    });
  }
  return leafletReady;
}

const saved = () => store.get('places') || [];
const label = (p) => [p.name, p.street && `${p.street}${p.housenumber ? ` ${p.housenumber}` : ''}`, p.city || p.county, p.country].filter(Boolean).filter((x, i, a) => a.indexOf(x) === i).join(', ');

async function photon(q, near) {
  const bias = near ? `&lat=${near.lat}&lon=${near.lng}` : '';
  const r = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=6${bias}`);
  if (!r.ok) throw new Error('Search is unavailable right now.');
  const j = await r.json();
  return j.features.map((f) => ({ ...f.properties, lat: f.geometry.coordinates[1], lon: f.geometry.coordinates[0] }));
}

export default function mount(ctx) {
  const { el, go } = ctx;
  const mapEl = h('div', { style: { position: 'absolute', inset: '0', background: 'var(--chrome)' } });
  const search = h('input', { class: 'textbox', type: 'search', placeholder: 'search places', 'aria-label': 'Search places' });
  const results = h('div', { style: { background: 'var(--bg)', maxHeight: '50%', overflowY: 'auto', padding: '0 12px' } });
  const card = h('div', { class: 'notice', hidden: true, style: { position: 'absolute', left: '10px', right: '10px', bottom: '118px', zIndex: 500, margin: 0 } });
  const top = h('div', { style: { position: 'absolute', left: '10px', right: '10px', top: '10px', zIndex: 500 } }, search, results);
  const wrap = screenOf(h('div', { class: 'subscreen maps', style: { overflow: 'hidden' } }, mapEl, top, card), appbar({
    buttons: [
      { icon: 'fa-solid fa-location-crosshairs', label: 'my location', onClick: locate },
      { icon: 'fa-solid fa-bookmark', label: 'saved', onClick: showSaved },
      { icon: 'fa-solid fa-magnifying-glass', label: 'search', onClick: () => search.focus() }
    ],
    menu: [{ label: 'about Maps', onClick: () => go('#/info/maps') }]
  }));
  el.append(wrap);

  let map = null, L = null, marker = null, meMarker = null, pending = null;

  async function init() {
    if (map) { map.invalidateSize(); return; }
    mapEl.append(loader());
    try { L = await loadLeaflet(); } catch (e) { mapEl.replaceChildren(h('p', { class: 'empty', style: { padding: '80px 18px' } }, e.message)); return; }
    mapEl.replaceChildren();
    const last = store.get('maps.view') || { lat: 20, lng: 0, zoom: 2 };
    map = L.map(mapEl, { zoomControl: false, attributionControl: true }).setView([last.lat, last.lng], last.zoom);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors' }).addTo(map);
    map.on('moveend', () => { const c = map.getCenter(); store.set('maps.view', { lat: c.lat, lng: c.lng, zoom: map.getZoom() }); });
    map.on('click', () => { results.replaceChildren(); });
    for (const p of saved()) L.circleMarker([p.lat, p.lon], { radius: 6, color: '#fff', weight: 2, fillColor: 'var(--accent)', fillOpacity: 1 }).addTo(map).on('click', () => showPlace(p));
    if (pending) { const p = pending; pending = null; p(); }
  }

  function showPlace(p) {
    if (!map) { pending = () => showPlace(p); return; }
    results.replaceChildren();
    marker?.remove();
    marker = L.marker([p.lat, p.lon]).addTo(map);
    map.flyTo([p.lat, p.lon], Math.max(map.getZoom(), p.type === 'country' ? 5 : p.type === 'city' ? 12 : 16), { duration: 0.8 });
    const isSaved = saved().some((s) => Math.abs(s.lat - p.lat) < 1e-5 && Math.abs(s.lon - p.lon) < 1e-5);
    card.hidden = false;
    card.replaceChildren(
      h('b', {}, p.name || 'Dropped pin'), label(p) || `${p.lat.toFixed(5)}, ${p.lon.toFixed(5)}`,
      h('div', { class: 'btn-row', style: { margin: '10px 0 0' } },
        h('button', { class: 'btn', type: 'button', onclick: () => { toggleSave(p); showPlace(p); } }, isSaved ? 'saved ✓' : 'save'),
        h('button', { class: 'btn', type: 'button', onclick: () => window.open(`https://www.openstreetmap.org/directions?to=${p.lat},${p.lon}`, '_blank', 'noopener') }, 'directions'),
        h('button', { class: 'btn', type: 'button', onclick: () => { card.hidden = true; marker?.remove(); } }, h('i', { class: 'fa-solid fa-xmark' }))));
  }

  function toggleSave(p) {
    const list = saved();
    const i = list.findIndex((s) => Math.abs(s.lat - p.lat) < 1e-5 && Math.abs(s.lon - p.lon) < 1e-5);
    store.set('places', i >= 0 ? list.filter((_, j) => j !== i) : [{ name: p.name || 'Saved place', lat: p.lat, lon: p.lon, city: p.city, country: p.country, street: p.street }, ...list]);
    ctx.toast(i >= 0 ? 'Removed from saved places' : 'Saved');
  }

  function showSaved() {
    const list = saved();
    results.replaceChildren(...(list.length ? list.map((p) => h('button', { class: 'list-row', type: 'button', onclick: () => showPlace(p) },
      h('span', { class: 'list-row__icon' }, h('i', { class: 'fa-solid fa-bookmark' })), h('span', { class: 'list-row__body' }, h('b', {}, p.name), h('span', {}, label(p)))))
      : [h('p', { class: 'empty', style: { padding: '10px 0' } }, 'No saved places yet. Search for one and tap save.')]));
    const pop = pushOverlay(() => results.replaceChildren());
    results.addEventListener('click', pop, { once: true });
  }

  function locate() {
    if (!navigator.geolocation) return ctx.toast('This browser can’t share a location.');
    ctx.toast('Finding you…');
    navigator.geolocation.getCurrentPosition((pos) => {
      const at = () => {
        const ll = [pos.coords.latitude, pos.coords.longitude];
        meMarker?.remove();
        meMarker = L.circle(ll, { radius: Math.max(20, pos.coords.accuracy), color: '#1ba1e2', fillOpacity: 0.2 }).addTo(map);
        map.flyTo(ll, 15, { duration: 0.8 });
      };
      map ? at() : (pending = at);
    }, () => ctx.toast('Location permission was declined.'), { timeout: 10000, enableHighAccuracy: true });
  }

  let t = 0;
  search.addEventListener('input', () => {
    clearTimeout(t);
    const q = search.value.trim();
    if (q.length < 2) return results.replaceChildren();
    t = setTimeout(async () => {
      results.replaceChildren(loader());
      try {
        const list = await photon(q, map?.getCenter());
        results.replaceChildren(...(list.length ? list.map((p) => h('button', { class: 'list-row', type: 'button', onclick: () => { search.blur(); showPlace(p); } },
          h('span', { class: 'list-row__icon' }, h('i', { class: 'fa-solid fa-location-dot' })), h('span', { class: 'list-row__body' }, h('b', {}, p.name || label(p)), h('span', {}, label(p)))))
          : [h('p', { class: 'empty', style: { padding: '10px 0' } }, 'No places found.')]));
      } catch (e) { results.replaceChildren(h('p', { class: 'empty' }, e.message)); }
    }, 350);
  });

  return {
    route(sub) {
      if (sub[0] === 'me') locate();
      if (sub[0] === 'saved') showSaved();
      if (sub[0] === 'search') setTimeout(() => search.focus(), 350);
      if (sub[0] === 'place' && sub[1]) { const [lat, lon] = sub[1].split(',').map(Number); if (Number.isFinite(lat)) showPlace({ lat, lon, name: 'Shared place' }); }
    },
    show() { setTimeout(init, 320); }
  };
}
