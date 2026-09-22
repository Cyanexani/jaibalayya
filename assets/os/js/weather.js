/* Weather data from Open-Meteo (free, no key, no account). The forecast is
   cached for 30 minutes so tiles and Bloom shortcuts don't refetch. */

import { store } from './store.js';
import { emit } from './util.js';
import { notify } from './notify.js';

const TTL = 30 * 60 * 1000;
let inflight = null;

/* WMO weather codes → words and icons */
const CODES = {
  0: ['clear', 'sun', 'moon'],
  1: ['mainly clear', 'sun', 'moon'],
  2: ['partly cloudy', 'cloud-sun', 'cloud-moon'],
  3: ['cloudy', 'cloud', 'cloud'],
  45: ['fog', 'smog', 'smog'], 48: ['freezing fog', 'smog', 'smog'],
  51: ['light drizzle', 'cloud-rain', 'cloud-rain'], 53: ['drizzle', 'cloud-rain', 'cloud-rain'], 55: ['heavy drizzle', 'cloud-rain', 'cloud-rain'],
  56: ['freezing drizzle', 'cloud-rain', 'cloud-rain'], 57: ['freezing drizzle', 'cloud-rain', 'cloud-rain'],
  61: ['light rain', 'cloud-rain', 'cloud-rain'], 63: ['rain', 'cloud-showers-heavy', 'cloud-showers-heavy'], 65: ['heavy rain', 'cloud-showers-heavy', 'cloud-showers-heavy'],
  66: ['freezing rain', 'cloud-rain', 'cloud-rain'], 67: ['freezing rain', 'cloud-showers-heavy', 'cloud-showers-heavy'],
  71: ['light snow', 'snowflake', 'snowflake'], 73: ['snow', 'snowflake', 'snowflake'], 75: ['heavy snow', 'snowflake', 'snowflake'], 77: ['snow grains', 'snowflake', 'snowflake'],
  80: ['showers', 'cloud-sun-rain', 'cloud-moon-rain'], 81: ['showers', 'cloud-showers-heavy', 'cloud-showers-heavy'], 82: ['heavy showers', 'cloud-showers-heavy', 'cloud-showers-heavy'],
  85: ['snow showers', 'snowflake', 'snowflake'], 86: ['heavy snow showers', 'snowflake', 'snowflake'],
  95: ['thunderstorm', 'cloud-bolt', 'cloud-bolt'], 96: ['thunderstorm, hail', 'cloud-bolt', 'cloud-bolt'], 99: ['thunderstorm, hail', 'cloud-bolt', 'cloud-bolt']
};

export function describe(code, isDay = 1) {
  const c = CODES[code] || ['—', 'cloud', 'cloud'];
  return { text: c[0], icon: `fa-solid fa-${isDay ? c[1] : c[2]}` };
}

export const units = () => (store.get('user.units') === 'imperial'
  ? { temp: '°F', wind: 'mph', q: '&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch' }
  : { temp: '°C', wind: 'km/h', q: '' });

export async function searchPlaces(name) {
  const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=6&language=${navigator.language?.slice(0, 2) || 'en'}`);
  if (!r.ok) throw new Error('search failed');
  const j = await r.json();
  return (j.results || []).map((p) => ({
    name: p.name,
    region: [p.admin1, p.country].filter(Boolean).join(', '),
    lat: p.latitude,
    lon: p.longitude
  }));
}

export function setPlace({ name, lat, lon }) {
  store.set('user.place', name);
  store.set('user.lat', lat);
  store.set('user.lon', lon);
  store.set('weatherCache', null);
  emit('weather');
}

export const cached = () => store.get('weatherCache');

/** Where we are: saved coordinates, or look up the saved city name. */
async function coords() {
  const u = store.get('user');
  if (u.lat != null && u.lon != null) return { lat: u.lat, lon: u.lon, name: u.place || 'My location' };
  if (u.place) {
    const [p] = await searchPlaces(u.place);
    if (p) { setPlace(p); return { lat: p.lat, lon: p.lon, name: p.name }; }
  }
  return null;
}

export async function forecast({ force = false } = {}) {
  const c = cached();
  const unitKey = store.get('user.units');
  if (!force && c && Date.now() - c.at < TTL && c.units === unitKey) return c;
  if (inflight) return inflight;
  inflight = (async () => {
    const where = await coords();
    if (!where) return null;
    const u = units();
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${where.lat}&longitude=${where.lon}`
      + '&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,is_day'
      + '&hourly=temperature_2m,weather_code,precipitation_probability,is_day'
      + '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset'
      + `&timezone=auto&forecast_days=10${u.q}`;
    const r = await fetch(url);
    if (!r.ok) throw new Error('forecast failed');
    const data = await r.json();
    const out = { at: Date.now(), units: unitKey, place: where.name, data };
    store.set('weatherCache', out);
    emit('weather');
    rainAlert(out);
    return out;
  })().finally(() => { inflight = null; });
  return inflight;
}

/** Quietly refresh in the background when a location is known. */
export function refreshSoon() {
  const u = store.get('user');
  if (u.lat == null && !u.place) return;
  const c = cached();
  if (c && Date.now() - c.at < TTL) return;
  forecast().catch(() => {});
}

export function useMyLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('This browser can’t share a location.'));
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPlace({ name: 'My location', lat: +pos.coords.latitude.toFixed(4), lon: +pos.coords.longitude.toFixed(4) });
        resolve();
      },
      () => reject(new Error('Location permission was declined.')),
      { timeout: 10000 });
  });
}

/** "Rain likely around 4 pm": once a day, when the next 6 hours look wet. */
function rainAlert(f) {
  const today = new Date().toISOString().slice(0, 10);
  if (store.get('weather.rainNotified') === today) return;
  const hr = f.data.hourly;
  const now = Date.now();
  for (let i = 0; i < hr.time.length; i++) {
    const t = new Date(hr.time[i]).getTime();
    if (t < now || t > now + 6 * 3600e3) continue;
    if ((hr.precipitation_probability[i] ?? 0) >= 60) {
      store.set('weather.rainNotified', today);
      notify({
        app: 'weather', level: 'flip', key: 'rain',
        title: 'Rain likely',
        body: `around ${new Date(t).toLocaleTimeString(undefined, { hour: 'numeric' })} · ${hr.precipitation_probability[i]}% in ${f.place}`,
        route: '#/app/weather/hourly'
      });
      return;
    }
  }
}
