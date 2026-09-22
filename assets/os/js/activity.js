/* Things happening right now (a call, a recording) that tiles and the
   status bar show live. Apps set and clear their own activity. */

import { emit } from './util.js';

const current = new Map();

export const activity = {
  set(app, info) { current.set(app, { since: Date.now(), ...info }); emit('activity', app); },
  clear(app) { if (current.delete(app)) emit('activity', app); },
  get: (app) => current.get(app) || null,
  all: () => [...current.entries()]
};

export const elapsed = (since) => {
  const s = Math.floor((Date.now() - since) / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
