/* Camera: photos and videos from your device's camera, saved to Photos in
   this browser. The camera turns off as soon as you leave the app. */

import { h, animate } from '../util.js';
import { files, blobUrl } from '../db.js';
import { play } from '../sound.js';
import { activity } from '../activity.js';

const stamp = () => new Date().toISOString().replace(/[-:T]/g, '').slice(0, 15).replace(/(\d{8})(\d{6})/, '$1_$2');

export default function mount(ctx) {
  const { el, go } = ctx;
  const video = h('video', { autoplay: true, playsinline: true, muted: true });
  const flash = h('div', { class: 'cam__flash' });
  const thumb = h('button', { class: 'cam__thumb', type: 'button', 'aria-label': 'Open the last photo', onclick: () => go('#/app/photos/latest') });
  const shutter = h('button', { class: 'cam__shutter', type: 'button', 'aria-label': 'Take a photo' });
  const modeBtn = h('button', { type: 'button', 'aria-label': 'Video mode', 'aria-pressed': 'false', title: 'photo / video' }, h('i', { class: 'fa-solid fa-video' }));
  const flipBtn = h('button', { type: 'button', 'aria-label': 'Switch camera', title: 'switch camera' }, h('i', { class: 'fa-solid fa-camera-rotate' }));
  const recBadge = h('div', { class: 'cam__rec', hidden: true });
  const msg = h('div', { class: 'cam__msg', hidden: true });
  const root = h('div', { class: 'cam' }, video, flash, recBadge, msg,
    h('div', { class: 'cam__bar' }, thumb, shutter, h('div', { class: 'cam__tools' }, modeBtn, flipBtn)));
  el.append(root);

  let stream = null;
  let facing = 'environment';
  let mode = 'photo';
  let recorder = null;
  let recStart = 0;
  let recTimer = 0;
  let wanted = false;

  async function start() {
    stop();
    msg.hidden = true;
    if (!navigator.mediaDevices?.getUserMedia) return fail('This browser can’t use a camera.');
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing }, audio: mode === 'video' });
      if (!wanted) return stop();
      video.srcObject = stream;
      video.classList.toggle('is-mirrored', facing === 'user');
    } catch (e) {
      fail(e.name === 'NotAllowedError' ? 'Camera permission was declined.' : 'No camera was found, or it’s in use by another app.');
    }
  }
  function stop() {
    stream?.getTracks().forEach((t) => t.stop());
    stream = null;
    video.srcObject = null;
  }
  function fail(text) {
    stop();
    msg.hidden = false;
    msg.replaceChildren(h('h2', {}, 'camera unavailable'), h('p', {}, text),
      h('div', { class: 'btn-row' }, h('button', { class: 'btn btn--light', type: 'button', onclick: start }, 'try again')));
  }

  async function paintThumb() {
    const [last] = await files.list('photo');
    thumb.style.backgroundImage = last ? `url("${blobUrl(last)}")` : '';
  }

  function takePhoto() {
    if (!stream) return;
    const c = document.createElement('canvas');
    c.width = video.videoWidth;
    c.height = video.videoHeight;
    const g = c.getContext('2d');
    if (facing === 'user') { g.translate(c.width, 0); g.scale(-1, 1); }
    g.drawImage(video, 0, 0);
    play('shutter', { force: false });
    flash.classList.remove('go'); void flash.offsetWidth; flash.classList.add('go');
    c.toBlob(async (blob) => {
      if (!blob) return;
      await files.put({ kind: 'photo', name: `IMG_${stamp()}.jpg`, mime: 'image/jpeg', blob });
      paintThumb();
      animate(thumb, [{ transform: 'scale(1.3)' }, { transform: 'none' }], 250);
    }, 'image/jpeg', 0.9);
  }

  function toggleRecording() {
    if (!stream) return;
    if (recorder) { recorder.stop(); return; }
    const chunks = [];
    try { recorder = new MediaRecorder(stream); } catch { return ctx.toast('Video recording isn’t supported in this browser.'); }
    recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    recorder.onstop = async () => {
      clearInterval(recTimer);
      activity.clear('recording');
      recBadge.hidden = true;
      shutter.classList.remove('is-recording');
      const type = recorder.mimeType || 'video/webm';
      recorder = null;
      const blob = new Blob(chunks, { type });
      await files.put({ kind: 'video', name: `VID_${stamp()}.${type.includes('mp4') ? 'mp4' : 'webm'}`, mime: type, blob });
      ctx.toast('Video saved to Photos');
    };
    recorder.start(1000);
    activity.set('recording', { app: 'camera' });
    recStart = Date.now();
    recBadge.hidden = false;
    shutter.classList.add('is-recording');
    const tick = () => { const s = Math.floor((Date.now() - recStart) / 1000); recBadge.textContent = `● ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
    tick();
    recTimer = setInterval(tick, 500);
  }

  function setMode(m) {
    if (recorder) return;
    mode = m;
    modeBtn.setAttribute('aria-pressed', String(m === 'video'));
    shutter.classList.toggle('is-video', m === 'video');
    shutter.setAttribute('aria-label', m === 'video' ? 'Start or stop recording' : 'Take a photo');
    if (wanted) start();
  }

  shutter.addEventListener('click', () => (mode === 'video' ? toggleRecording() : takePhoto()));
  modeBtn.addEventListener('click', () => setMode(mode === 'photo' ? 'video' : 'photo'));
  flipBtn.addEventListener('click', () => { if (recorder) return; facing = facing === 'user' ? 'environment' : 'user'; start(); });
  const onKey = (e) => { if ((e.key === ' ' || e.key === 'Enter') && e.target === document.body) { e.preventDefault(); shutter.click(); } };

  return {
    route(sub) {
      if (sub[0] === 'video') setMode('video');
      else if (sub[0] === 'photo') setMode('photo');
      if (sub[0] === 'front' && facing !== 'user') { facing = 'user'; if (wanted) start(); }
    },
    show() { wanted = true; start(); paintThumb(); document.addEventListener('keydown', onKey); },
    hide() { wanted = false; if (recorder) recorder.stop(); stop(); document.removeEventListener('keydown', onKey); },
    destroy() { wanted = false; stop(); document.removeEventListener('keydown', onKey); }
  };
}
