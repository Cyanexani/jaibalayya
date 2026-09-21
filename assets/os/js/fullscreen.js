/* Full screen mode: the OS fills the whole window (no phone frame, no notes
   panel) and, where the browser allows it, goes truly full screen too.
   Leaving browser full screen (Esc) also leaves full screen mode. */

import { emit } from './util.js';
import { toast } from './notify.js';

const root = document.documentElement;
let viaBrowser = false;

export const isFull = () => root.dataset.full === 'on';

export function setFull(on) {
  if (on === isFull()) return;
  if (on) {
    root.dataset.full = 'on';
    // Must be called straight from the click/key handler, before any await.
    const req = root.requestFullscreen?.({ navigationUI: 'hide' });
    Promise.resolve(req)
      .then(() => { viaBrowser = !!document.fullscreenElement; })
      .catch(() => { viaBrowser = false; })
      .finally(() => toast(viaBrowser ? 'Full screen. Press Esc to leave.' : 'Full screen. Press F to leave.'));
  } else {
    delete root.dataset.full;
    viaBrowser = false;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  }
  emit('fullscreen', on);
  window.dispatchEvent(new Event('resize'));
}

export const toggleFull = () => setFull(!isFull());

document.addEventListener('fullscreenchange', () => {
  if (!document.fullscreenElement && viaBrowser) {
    viaBrowser = false;
    delete root.dataset.full;
    emit('fullscreen', false);
    window.dispatchEvent(new Event('resize'));
  }
});
