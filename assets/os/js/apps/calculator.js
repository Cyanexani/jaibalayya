/* Calculator: a standard calculator (keyboard works too) and a unit
   converter. Expressions are parsed by a small parser, never eval(). */

import { h } from '../util.js';
import { pivot, picker, textbox, screenOf, pageRouter } from '../controls.js';
import { store } from '../store.js';

/* ---------- expression evaluation (shunting-yard) ---------- */
const PREC = { '+': 1, '−': 1, '×': 2, '÷': 2 };
function evaluate(expr) {
  const tokens = expr.match(/\d+\.?\d*(?:e[+-]?\d+)?|\.\d+|[+−×÷()%]/g) || [];
  const out = [], ops = [];
  let prev = null;
  for (const t of tokens) {
    if (/^[\d.]/.test(t)) out.push(parseFloat(t));
    else if (t === '%') { if (out.length) out.push(out.pop() / 100); }
    else if (t === '(') ops.push(t);
    else if (t === ')') { while (ops.length && ops.at(-1) !== '(') out.push(ops.pop()); ops.pop(); }
    else {
      if (t === '−' && (prev === null || (prev in PREC) || prev === '(')) { out.push(0); }
      while (ops.length && ops.at(-1) !== '(' && PREC[ops.at(-1)] >= PREC[t]) out.push(ops.pop());
      ops.push(t);
    }
    prev = t;
  }
  while (ops.length) out.push(ops.pop());
  const st = [];
  for (const t of out) {
    if (typeof t === 'number') { st.push(t); continue; }
    const b = st.pop(), a = st.pop();
    if (a === undefined || b === undefined) return NaN;
    st.push(t === '+' ? a + b : t === '−' ? a - b : t === '×' ? a * b : a / b);
  }
  return st.length === 1 ? st[0] : NaN;
}
const show = (n) => {
  if (!Number.isFinite(n)) return 'Error';
  const r = Math.round(n * 1e10) / 1e10;
  return Math.abs(r) >= 1e12 || (Math.abs(r) < 1e-6 && r !== 0) ? r.toExponential(6) : r.toLocaleString(undefined, { maximumFractionDigits: 10 });
};

/* ---------- units ---------- */
const UNITS = {
  length: { m: 1, km: 1000, cm: 0.01, mm: 0.001, mi: 1609.344, yd: 0.9144, ft: 0.3048, in: 0.0254 },
  weight: { kg: 1, g: 0.001, mg: 1e-6, t: 1000, lb: 0.45359237, oz: 0.028349523125, st: 6.35029318 },
  volume: { L: 1, mL: 0.001, 'm³': 1000, 'gal (US)': 3.785411784, 'qt (US)': 0.946352946, 'cup (US)': 0.2365882365, 'fl oz (US)': 0.0295735295625 },
  speed: { 'km/h': 1, 'm/s': 3.6, mph: 1.609344, knot: 1.852 },
  area: { 'm²': 1, 'km²': 1e6, ha: 1e4, acre: 4046.8564224, 'ft²': 0.09290304 },
  data: { B: 1, KB: 1e3, MB: 1e6, GB: 1e9, TB: 1e12, KiB: 1024, MiB: 1048576, GiB: 1073741824 },
  temperature: { '°C': 'c', '°F': 'f', K: 'k' }
};
function convert(cat, v, from, to) {
  if (cat !== 'temperature') return (v * UNITS[cat][from]) / UNITS[cat][to];
  const c = from === '°C' ? v : from === '°F' ? (v - 32) * 5 / 9 : v - 273.15;
  return to === '°C' ? c : to === '°F' ? c * 9 / 5 + 32 : c + 273.15;
}

export default function mount(ctx) {
  const { el, go } = ctx;
  let pv = null;

  /* ---------- standard ---------- */
  let expr = '';
  let just = false;
  const exprEl = h('div', { class: 'calc__expr', 'aria-live': 'polite' });
  const valEl = h('div', { class: 'calc__value' }, show(store.get('calc.last') ?? 0));
  const paint = () => {
    exprEl.textContent = expr;
    const v = evaluate(expr.replace(/[+−×÷(]$/, ''));
    valEl.textContent = expr ? (Number.isFinite(v) ? show(v) : valEl.textContent) : '0';
  };
  function press(k) {
    if (k === 'C') { expr = ''; just = false; }
    else if (k === '⌫') expr = expr.slice(0, -1);
    else if (k === '=') {
      const v = evaluate(expr);
      if (Number.isFinite(v)) { store.set('calc.last', v); expr = String(Math.round(v * 1e10) / 1e10).replace('-', '−'); just = true; }
      paint();
      valEl.textContent = show(v);
      return;
    } else if (k === '±') {
      const m = expr.match(/(−?)(\d*\.?\d*)$/);
      if (m && m[2]) expr = expr.slice(0, -m[0].length) + (m[1] ? '' : '−') + m[2];
    } else {
      if (just && /[\d.]/.test(k)) expr = '';
      just = false;
      if (/[+−×÷]/.test(k) && /[+−×÷]$/.test(expr)) expr = expr.slice(0, -1);
      if (k === '.' && /\d*\.\d*$/.test(expr.split(/[+−×÷()]/).pop() || '') && (expr.split(/[+−×÷()]/).pop() || '').includes('.')) return;
      expr += k;
    }
    paint();
  }
  const KEYS = ['C', '⌫', '%', '÷', '7', '8', '9', '×', '4', '5', '6', '−', '1', '2', '3', '+', '±', '0', '.', '='];
  const standard = h('div', { class: 'calc' },
    h('div', { class: 'calc__display' }, exprEl, valEl),
    h('div', { class: 'calc__keys' }, KEYS.map((k) => h('button', {
      type: 'button', class: k === '=' ? 'eq' : /[÷×−+%⌫C]/.test(k) ? 'op' : '',
      'aria-label': { '⌫': 'delete', '±': 'plus or minus', '÷': 'divide', '×': 'multiply', '−': 'minus' }[k] || k,
      onclick: () => press(k)
    }, k))));

  const onKey = (e) => {
    if (e.target.matches?.('input, textarea') || !el.isConnected || el.hidden) return;
    const map = { '*': '×', '/': '÷', '-': '−', Enter: '=', '=': '=', Backspace: '⌫', Delete: 'C', Escape: null };
    const k = e.key in map ? map[e.key] : e.key;
    if (k && (/^[\d.+%()]$/.test(k) || ['×', '÷', '−', '=', '⌫', 'C'].includes(k))) { e.preventDefault(); press(k); }
  };

  /* ---------- converter ---------- */
  function converter(pane) {
    const state = store.get('calc.convert') || { cat: 'length', from: 'km', to: 'mi', value: '1' };
    const out = h('div', { class: 'convert-result' });
    const host = h('div');
    const save = () => store.set('calc.convert', state);
    const paintOut = () => {
      const v = parseFloat(state.value);
      out.textContent = Number.isFinite(v) ? `${show(convert(state.cat, v, state.from, state.to))} ${state.to}` : '—';
    };
    const build = () => {
      const names = Object.keys(UNITS[state.cat]);
      if (!names.includes(state.from)) state.from = names[0];
      if (!names.includes(state.to)) state.to = names[1];
      const opts = names.map((n) => ({ value: n, label: n }));
      host.replaceChildren(
        picker({ label: 'Convert', value: state.cat, options: Object.keys(UNITS).map((c) => ({ value: c, label: c })), full: true, host: el, onChange: (v) => { state.cat = v; save(); build(); } }),
        textbox({ label: 'Value', value: state.value, type: 'number', onInput: (v) => { state.value = v; save(); paintOut(); } }),
        picker({ label: 'From', value: state.from, options: opts, full: opts.length > 6, host: el, onChange: (v) => { state.from = v; save(); paintOut(); } }),
        picker({ label: 'To', value: state.to, options: opts, full: opts.length > 6, host: el, onChange: (v) => { state.to = v; save(); paintOut(); } }),
        out);
      paintOut();
    };
    build();
    pane.append(host);
  }

  function main(tab) {
    pv = pivot({
      appTitle: 'Calculator',
      items: [
        { id: 'standard', title: 'standard', render: (p) => { p.style.padding = '0'; p.append(standard); paint(); } },
        { id: 'convert', title: 'convert', render: converter }
      ],
      active: tab,
      onChange: (id) => go(`#/app/calculator/${id === 'standard' ? '' : id}`, { replace: true })
    });
    return screenOf(pv);
  }

  let built = false;
  const route = pageRouter(el, (sub) => {
    const tab = sub[0] === 'convert' ? 'convert' : 'standard';
    if (built && pv) { pv.select(tab, true); return null; }
    built = true;
    return main(tab);
  });

  return {
    route,
    show() { document.addEventListener('keydown', onKey, true); },
    hide() { document.removeEventListener('keydown', onKey, true); },
    destroy() { document.removeEventListener('keydown', onKey, true); }
  };
}
