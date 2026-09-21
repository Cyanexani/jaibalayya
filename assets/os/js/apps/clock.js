/* Clock: alarms, a timer and a stopwatch. The engine lives in
   clockservice.js so they keep running when you leave the app. */

import { h, on } from '../util.js';
import { pivot, appbar, header, toggle, textbox, chips, button, pageRouter, screenOf, dialog } from '../controls.js';
import * as clk from '../clockservice.js';

const DAYS = [['sun', 0], ['mon', 1], ['tue', 2], ['wed', 3], ['thu', 4], ['fri', 5], ['sat', 6]];
const dayText = (days) => {
  if (!days?.length) return 'once';
  if (days.length === 7) return 'every day';
  if (days.join() === '1,2,3,4,5') return 'weekdays';
  if (days.join() === '0,6') return 'weekends';
  return days.map((d) => DAYS[d][0]).join(', ');
};
function untilText(at) {
  if (!at) return '';
  const m = Math.round((at - Date.now()) / 60000);
  if (m < 60) return `in ${m} min`;
  const hrs = Math.floor(m / 60);
  return hrs < 24 ? `in ${hrs} h ${m % 60} min` : `in ${Math.round(hrs / 24)} days`;
}

export default function mount(ctx) {
  const { el, go } = ctx;
  let pv = null;
  let tickId = 0;
  const paints = new Set();

  /* ---------- alarms ---------- */
  function alarmsPane(pane) {
    const list = h('div');
    const paint = () => {
      const all = clk.alarms();
      list.replaceChildren(...(all.length ? all.map((a) => {
        const sw = toggle({ label: `${a.time} on`, value: a.on, onChange: (v) => clk.saveAlarm({ ...a, on: v }) });
        sw.querySelector('.field__label').remove();
        sw.querySelector('.toggle__state').remove();
        sw.style.margin = '0';
        const row = h('div', { class: a.on ? 'alarm-row' : 'alarm-row is-off' },
          h('button', { type: 'button', style: { border: 0, background: 'none', textAlign: 'left', cursor: 'pointer', padding: 0, color: 'inherit' }, onclick: () => go(`#/app/clock/alarm/${a.id}`) },
            h('b', {}, a.time),
            h('span', {}, [a.label, dayText(a.days), a.on ? untilText(a.nextAt) : 'off'].filter(Boolean).join(' · '))),
          sw);
        return row;
      }) : [h('p', { class: 'empty' }, h('b', {}, 'No alarms'), 'Tap + to add one. Alarms ring while Metro OS is open in a tab.')]));
    };
    paint();
    paints.add(paint);
    pane.append(list);
  }

  /* ---------- timer ---------- */
  function timerPane(pane) {
    const R = 84, C = 2 * Math.PI * R;
    const bar = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    const ring = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    ring.setAttribute('viewBox', '0 0 180 180');
    ring.setAttribute('class', 'progress-ring');
    ring.innerHTML = `<circle class="track" cx="90" cy="90" r="${R}"></circle>`;
    Object.entries({ class: 'bar', cx: 90, cy: 90, r: R, 'stroke-dasharray': C }).forEach(([k, v]) => bar.setAttribute(k, v));
    ring.append(bar);
    const time = h('div', { class: 'bigtime', 'aria-live': 'off' });
    const startBtn = button('start', () => (clk.timer().endAt ? clk.pauseTimer() : clk.startTimer()), { accent: true });
    const presets = h('div', { class: 'presets' }, [1, 3, 5, 10, 15, 30].map((m) => button(`${m} min`, () => clk.startTimer(m * 60000))));
    const custom = textbox({ label: 'Custom (minutes)', type: 'number', placeholder: 'e.g. 25' });
    custom.input.min = 1;
    custom.input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && +custom.input.value > 0) clk.startTimer(+custom.input.value * 60000); });
    const paint = () => {
      const t = clk.timer();
      const left = clk.timerLeft(t);
      time.textContent = clk.fmtDuration(left);
      bar.setAttribute('stroke-dashoffset', String(C * (1 - left / (t.duration || 1))));
      startBtn.lastChild.textContent = t.endAt ? 'pause' : left < t.duration ? 'resume' : 'start';
    };
    paint();
    paints.add(paint);
    pane.append(ring, time,
      h('div', { class: 'btn-row' }, startBtn, button('reset', () => clk.resetTimer())),
      presets, custom,
      h('p', { class: 'hint' }, 'The timer keeps going if you leave the app, and rings wherever you are in Metro OS.'));
  }

  /* ---------- stopwatch ---------- */
  function stopwatchPane(pane) {
    const time = h('div', { class: 'bigtime' });
    const laps = h('div', { class: 'laps' });
    const startBtn = button('start', () => clk.swToggle(), { accent: true });
    const paint = () => {
      const s = clk.stopwatch();
      time.textContent = clk.fmtDuration(clk.swElapsed(s), { hundredths: true });
      startBtn.lastChild.textContent = s.running ? 'stop' : s.base ? 'resume' : 'start';
      if (laps.childElementCount !== s.laps.length) {
        laps.replaceChildren(...s.laps.map((ms, i) => {
          const prev = s.laps[i + 1] || 0;
          return h('div', {}, h('span', {}, `lap ${s.laps.length - i}`), h('span', {}, `+${clk.fmtDuration(ms - prev, { hundredths: true })}`), h('span', {}, clk.fmtDuration(ms, { hundredths: true })));
        }));
      }
    };
    paint();
    paints.add(paint);
    pane.append(time, h('div', { class: 'btn-row' }, startBtn, button('lap', clk.swLap), button('reset', clk.swReset)), laps);
  }

  /* ---------- alarm editor ---------- */
  function editor(id) {
    const existing = clk.alarms().find((a) => a.id === id);
    const draft = existing ? { ...existing } : { time: '07:00', days: [1, 2, 3, 4, 5], label: '', on: true };
    const time = h('input', { class: 'textbox', type: 'time', value: draft.time, 'aria-label': 'Time', style: { fontSize: '32px', fontWeight: 300 } });
    time.addEventListener('change', () => { draft.time = time.value || draft.time; });
    const page = h('div', { class: 'page has-appbar' },
      header('Clock', existing ? 'edit alarm' : 'new alarm'),
      h('label', { class: 'field' }, h('span', { class: 'field__label' }, 'Time'), time),
      chips({ label: 'Repeat (none selected = once)', options: DAYS.map(([l, v]) => ({ label: l, value: v })), value: draft.days, onChange: (v) => { draft.days = v; } }),
      textbox({ label: 'Name', value: draft.label, placeholder: 'e.g. gym', onInput: (v) => { draft.label = v.trim(); } }),
      toggle({ label: 'Sound', value: true, on: 'On', off: 'Off', hint: 'Alarms ring even when system sounds are off.', onChange: () => {} }));
    const bar = appbar({
      buttons: [
        { icon: 'fa-solid fa-check', label: 'save', onClick: () => { clk.saveAlarm({ ...draft, on: true }); ctx.toast(`Alarm set for ${draft.time}`); ctx.back(); } },
        existing ? { icon: 'fa-solid fa-trash', label: 'delete', onClick: async () => { if (await dialog(el, { title: 'Delete this alarm?', body: `${draft.time} ${draft.label}`, ok: 'delete' })) { clk.deleteAlarm(id); ctx.back(); } } } : null,
        { icon: 'fa-solid fa-xmark', label: 'cancel', onClick: () => ctx.back() }
      ].filter(Boolean)
    });
    return screenOf(page, bar);
  }

  /* ---------- main pivot ---------- */
  function main(tab) {
    paints.clear();
    pv = pivot({
      appTitle: 'Clock',
      items: [
        { id: 'alarms', title: 'alarms', render: alarmsPane },
        { id: 'timer', title: 'timer', render: timerPane },
        { id: 'stopwatch', title: 'stopwatch', render: stopwatchPane }
      ],
      active: tab,
      onChange: (id) => go(`#/app/clock/${id}`, { replace: true })
    });
    const bar = appbar({
      buttons: [{ icon: 'fa-solid fa-plus', label: 'new alarm', onClick: () => go('#/app/clock/alarm/new') }],
      menu: [{ label: 'about Clock', onClick: () => go('#/info/clock') }]
    });
    return screenOf(pv, bar);
  }

  let onMain = false;
  const route = pageRouter(el, (sub) => {
    if (sub[0] === 'alarm') { onMain = false; return editor(sub[1] === 'new' ? null : sub[1]); }
    const tab = ['alarms', 'timer', 'stopwatch'].includes(sub[0]) ? sub[0] : 'alarms';
    if (onMain && pv) { pv.select(tab, true); return null; }
    onMain = true;
    return main(tab);
  });

  const paintAll = () => paints.forEach((p) => p());
  on('clock', paintAll);

  let active = false;
  function loop() {
    if (!active) return;
    paintAll();
    tickId = setTimeout(loop, clk.stopwatch().running ? 50 : 500);
  }

  return {
    route(sub, opts) {
      if (sub[0] === 'timer' && /^\d+$/.test(sub[1] || '')) {
        clk.startTimer(+sub[1] * 60000);
        ctx.toast(`${sub[1]}-minute timer started`);
        sub = ['timer'];
      }
      route(sub, opts);
    },
    show() { if (!active) { active = true; loop(); } },
    hide() { active = false; clearTimeout(tickId); }
  };
}
