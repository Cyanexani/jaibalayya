/* Weather: now, hourly and 10-day, from Open-Meteo. Pick a city or use
   your location; both stay in this browser. */

import { h, on } from '../util.js';
import { pivot, appbar, header, textbox, button, loader, pageRouter, screenOf } from '../controls.js';
import * as wx from '../weather.js';
import { store } from '../store.js';

const dayName = (iso, i) => (i === 0 ? 'today' : i === 1 ? 'tomorrow' : new Date(`${iso}T12:00`).toLocaleDateString(undefined, { weekday: 'long' }).toLowerCase());
const hourName = (iso) => new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric' });

export default function mount(ctx) {
  const { el, go } = ctx;
  let pv = null;
  let onMain = false;

  function noPlace() {
    return h('div', { class: 'page' },
      header('Weather', 'where are you?'),
      h('p', { class: 'lede' }, 'Pick a city or use your location. It stays in this browser.'),
      h('div', { class: 'btn-row' },
        button('choose a city', () => go('#/app/weather/city'), { accent: true, icon: 'fa-solid fa-magnifying-glass' }),
        button('use my location', () => wx.useMyLocation().then(() => load(true)).catch((e) => ctx.toast(e.message)), { icon: 'fa-solid fa-location-crosshairs' })));
  }

  function nowPane(pane, f) {
    const c = f.data.current;
    const u = wx.units();
    const d = wx.describe(c.weather_code, c.is_day);
    const today = f.data.daily;
    pane.append(
      h('div', { class: 'wx-now' }, h('div', { class: 'wx-temp' }, `${Math.round(c.temperature_2m)}°`), h('i', { class: `wx-icon ${d.icon}`, 'aria-hidden': 'true' })),
      h('div', { class: 'wx-cond' }, `${d.text} · ${Math.round(today.temperature_2m_max[0])}° / ${Math.round(today.temperature_2m_min[0])}°`),
      h('div', { class: 'wx-details' },
        h('div', {}, h('b', {}, `${Math.round(c.apparent_temperature)}${u.temp}`), 'feels like'),
        h('div', {}, h('b', {}, `${c.relative_humidity_2m}%`), 'humidity'),
        h('div', {}, h('b', {}, `${Math.round(c.wind_speed_10m)} ${u.wind}`), 'wind'),
        h('div', {}, h('b', {}, `${today.precipitation_probability_max[0] ?? 0}%`), 'chance of rain'),
        h('div', {}, h('b', {}, new Date(today.sunrise[0]).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })), 'sunrise'),
        h('div', {}, h('b', {}, new Date(today.sunset[0]).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })), 'sunset')),
      h('p', { class: 'hint' }, `Updated ${new Date(f.at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })} · data from Open-Meteo`));
  }

  function hourlyPane(pane, f) {
    const hr = f.data.hourly;
    const now = Date.now();
    const start = Math.max(0, hr.time.findIndex((t) => new Date(t).getTime() > now - 3600000));
    const strip = h('div', { class: 'wx-hours' });
    for (let i = start; i < Math.min(hr.time.length, start + 24); i++) {
      const d = wx.describe(hr.weather_code[i], hr.is_day[i]);
      strip.append(h('div', { class: 'wx-hour' }, i === start ? 'now' : hourName(hr.time[i]), h('i', { class: d.icon, 'aria-hidden': 'true' }), h('b', {}, `${Math.round(hr.temperature_2m[i])}°`), `${hr.precipitation_probability[i] ?? 0}%`));
    }
    pane.append(strip, h('p', { class: 'hint' }, 'Next 24 hours. The percentage is the chance of rain.'));
  }

  function dailyPane(pane, f) {
    const d = f.data.daily;
    pane.append(...d.time.map((t, i) => {
      const w = wx.describe(d.weather_code[i]);
      return h('div', { class: 'wx-day' },
        h('b', {}, dayName(t, i)),
        h('i', { class: w.icon, 'aria-hidden': 'true' }),
        h('span', {}, `${w.text} · ${d.precipitation_probability_max[i] ?? 0}%`),
        h('em', {}, `${Math.round(d.temperature_2m_max[i])}°`, h('small', {}, `${Math.round(d.temperature_2m_min[i])}°`)));
    }));
  }

  function main(tab) {
    const f = wx.cached();
    const u = store.get('user');
    if (u.lat == null && !u.place) return noPlace();
    if (!f) {
      load();
      return h('div', { class: 'page' }, header('Weather', u.place || 'my location'), loader());
    }
    pv = pivot({
      appTitle: `Weather · ${f.place}`,
      items: [
        { id: 'now', title: 'now', render: (p) => nowPane(p, f) },
        { id: 'hourly', title: 'hourly', render: (p) => hourlyPane(p, f) },
        { id: 'daily', title: '10 days', render: (p) => dailyPane(p, f) }
      ],
      active: tab,
      onChange: (id) => go(`#/app/weather/${id}`, { replace: true })
    });
    const bar = appbar({
      buttons: [
        { icon: 'fa-solid fa-arrows-rotate', label: 'refresh', onClick: () => load(true) },
        { icon: 'fa-solid fa-location-dot', label: 'change city', onClick: () => go('#/app/weather/city') }
      ],
      menu: [
        { label: `switch to ${store.get('user.units') === 'imperial' ? 'metric (°C)' : 'imperial (°F)'}`, onClick: () => { store.set('user.units', store.get('user.units') === 'imperial' ? 'metric' : 'imperial'); load(true); } },
        { label: 'about Weather', onClick: () => go('#/info/weather') }
      ]
    });
    return screenOf(pv, bar);
  }

  function cityPage() {
    const results = h('div');
    let timer = 0;
    const box = textbox({
      label: 'City', placeholder: 'start typing a city…',
      onInput: (q) => {
        clearTimeout(timer);
        if (q.trim().length < 2) { results.replaceChildren(); return; }
        timer = setTimeout(async () => {
          results.replaceChildren(loader());
          try {
            const places = await wx.searchPlaces(q.trim());
            results.replaceChildren(...(places.length ? places.map((p) => h('button', {
              class: 'list-row', type: 'button',
              onclick: () => { wx.setPlace(p); ctx.toast(`Weather for ${p.name}`); onMain = false; go('#/app/weather', { replace: true }); load(true); }
            }, h('span', { class: 'list-row__icon' }, h('i', { class: 'fa-solid fa-location-dot' })), h('span', { class: 'list-row__body' }, h('b', {}, p.name), h('span', {}, p.region)))) : [h('p', { class: 'empty' }, 'No places found.')]));
          } catch {
            results.replaceChildren(h('p', { class: 'empty' }, 'Couldn’t search right now. Check your connection.'));
          }
        }, 300);
      }
    });
    setTimeout(() => box.input.focus(), 350);
    return h('div', { class: 'page' },
      header('Weather', 'change city'),
      box,
      h('div', { class: 'btn-row' }, button('use my location', () => wx.useMyLocation().then(() => { onMain = false; go('#/app/weather', { replace: true }); load(true); }).catch((e) => ctx.toast(e.message)), { icon: 'fa-solid fa-location-crosshairs' })),
      results);
  }

  let tab = 'now';
  const route = pageRouter(el, (sub) => {
    if (sub[0] === 'city') { onMain = false; return cityPage(); }
    tab = sub[0] === 'tomorrow' ? 'daily' : ['now', 'hourly', 'daily'].includes(sub[0]) ? sub[0] : 'now';
    if (onMain && pv) { pv.select(tab, true); return null; }
    onMain = true;
    return main(tab);
  });

  async function load(force = false) {
    try {
      await wx.forecast({ force });
    } catch {
      ctx.toast('Couldn’t reach the weather service.');
    }
  }

  // New data arrived: redraw the main screen on the same tab.
  on('weather', () => {
    if (!onMain) return;
    onMain = false;
    pv = null;
    route([tab], { dir: 0, force: true });
  });

  return {
    route(sub, opts) { route(sub, opts); },
    show() { if (onMain) load(); }
  };
}
