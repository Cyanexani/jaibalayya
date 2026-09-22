/* Recorder: voice notes from your microphone, saved in this browser. */

import { h, on } from '../util.js';
import { header, appbar, pageRouter, screenOf, dialog, promptDialog } from '../controls.js';
import { files, blobUrl, download, bytes } from '../db.js';
import { contextMenu } from '../contextmenu.js';
import { activity } from '../activity.js';

const fmtS = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export default function mount(ctx) {
  const { el, go, screen } = ctx;
  let rec = null;           // { mr, stream, ctx, raf, start }
  const audio = new Audio();
  let playingId = null;

  const button = h('button', { class: 'rec-button', type: 'button', 'aria-label': 'Record' }, h('span'));
  const time = h('div', { class: 'rec-time' }, '0:00');
  const meter = h('div', { class: 'meter', 'aria-hidden': 'true' }, Array.from({ length: 24 }, () => h('i')));
  const list = h('div');
  const page = h('div', { class: 'page has-appbar' },
    header('Recorder', 'recorder'),
    h('div', { class: 'rec-hero' }, button, time, meter),
    h('h2', { class: 'group-title' }, 'recordings'),
    list);
  el.append(screenOf(page, appbar({ buttons: [], menu: [{ label: 'about Recorder', onClick: () => go('#/info/recorder') }] })));

  async function start() {
    if (rec) return;
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) return ctx.toast('This browser can’t record audio.');
    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch { return ctx.toast('Microphone permission was declined.'); }
    const chunks = [];
    const mr = new MediaRecorder(stream);
    mr.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    mr.onstop = async () => {
      const type = mr.mimeType || 'audio/webm';
      const n = (await files.list('recording')).length + 1;
      await files.put({ kind: 'recording', name: `Recording ${n}.${type.includes('mp4') ? 'm4a' : 'webm'}`, mime: type, blob: new Blob(chunks, { type }), meta: { duration: (Date.now() - startAt) / 1000 } });
      ctx.toast('Recording saved');
    };
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    const an = ac.createAnalyser();
    an.fftSize = 64;
    ac.createMediaStreamSource(stream).connect(an);
    const data = new Uint8Array(an.frequencyBinCount);
    const bars = [...meter.children];
    const startAt = Date.now();
    const draw = () => {
      an.getByteFrequencyData(data);
      bars.forEach((b, i) => { b.style.height = `${Math.max(4, (data[i] / 255) * 100)}%`; });
      time.textContent = fmtS((Date.now() - startAt) / 1000);
      rec.raf = requestAnimationFrame(draw);
    };
    rec = { mr, stream, ac, raf: 0 };
    mr.start(500);
    activity.set('recording', { app: 'recorder' });
    button.classList.add('is-recording');
    button.setAttribute('aria-label', 'Stop recording');
    draw();
  }

  function stop() {
    if (!rec) return;
    cancelAnimationFrame(rec.raf);
    rec.mr.stop();
    rec.stream.getTracks().forEach((t) => t.stop());
    rec.ac.close();
    rec = null;
    activity.clear('recording');
    button.classList.remove('is-recording');
    button.setAttribute('aria-label', 'Record');
    [...meter.children].forEach((b) => { b.style.height = '2px'; });
  }

  button.addEventListener('click', () => (rec ? stop() : start()));

  async function paintList() {
    const items = await files.list('recording');
    list.replaceChildren(...(items.length ? items.map((r) => {
      const row = h('button', { class: playingId === r.id ? 'list-row is-active' : 'list-row', type: 'button', onclick: () => togglePlay(r) },
        h('span', { class: 'list-row__icon' }, h('i', { class: playingId === r.id && !audio.paused ? 'fa-solid fa-pause' : 'fa-solid fa-play' })),
        h('span', { class: 'list-row__body' }, h('b', {}, r.name.replace(/\.[^.]+$/, '')), h('span', {}, `${new Date(r.created).toLocaleString()} · ${bytes(r.size)}`)),
        h('span', { class: 'list-row__end' }, r.meta?.duration ? fmtS(r.meta.duration) : ''));
      row.addEventListener('contextmenu', (e) => { e.preventDefault(); menu(r, row); });
      return row;
    }) : [h('p', { class: 'empty' }, 'Nothing recorded yet. Tap the button to start. Right-click or hold a recording for more.')]));
  }

  function menu(r, anchor) {
    contextMenu({
      screen, anchor, items: [
        { label: 'rename', action: async () => { const name = await promptDialog(el, { title: 'Rename recording', value: r.name.replace(/\.[^.]+$/, '') }); if (name) files.update(r.id, { name: `${name}.${r.name.split('.').pop()}` }); } },
        { label: 'save to device', action: () => download(r) },
        { label: 'delete', action: async () => { if (await dialog(el, { title: 'Delete this recording?', body: r.name, ok: 'delete' })) files.remove(r.id); } }
      ]
    });
  }

  function togglePlay(r) {
    if (playingId === r.id && !audio.paused) { audio.pause(); return; }
    if (playingId !== r.id) { audio.src = blobUrl(r); playingId = r.id; }
    audio.play().catch(() => {});
  }
  for (const ev of ['play', 'pause', 'ended']) audio.addEventListener(ev, paintList);

  const off = on('files', (d) => { if (!d.kind || d.kind === 'recording') paintList(); });
  paintList();

  return {
    async route(sub) {
      if (sub[0] === 'record') start();
      if (sub[0] === 'last') { const [r] = await files.list('recording'); if (r) togglePlay(r); else ctx.toast('No recordings yet.'); }
    },
    // Recording keeps going when you leave (a red chip or the live tile shows it); playback stops.
    hide() { audio.pause(); },
    destroy() { stop(); audio.pause(); off(); }
  };
}
