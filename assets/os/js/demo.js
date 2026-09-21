/* Demo data for apps that arrive in later phases, so their tiles and Bloom
   shortcuts have something to show. Names, tracks and artwork are Metro OS's
   own (carried over from the old site); nothing here is real. */

import { emit } from './util.js';

const IMG = 'assets/img/';

export const TRACKS = [
  { title: 'A Brighter Tomorrow', artist: 'Cyanex', album: 'Signal Fade', art: IMG + 'art-1.webp', len: 236 },
  { title: 'Midnight Drive', artist: 'The Astro Collective', album: 'Neon Coast', art: IMG + 'art-2.webp', len: 252 },
  { title: 'Sunset Drive', artist: 'Halcyon Field', album: 'Long Exposure', art: IMG + 'art-3.webp', len: 204 },
  { title: 'Still Here', artist: 'Novo', album: 'Quiet Machines', art: IMG + 'art-4.webp', len: 308 }
];

export const PHOTOS = [1, 2, 3, 4, 5, 6].map((n) => `${IMG}pic-${n}.webp`);

export const CONTACTS = [
  { name: 'Aarav Mehta', status: 'Available', color: '#1a68e0' },
  { name: 'Ananya Iyer', status: 'Available', color: '#6f42d6' },
  { name: 'Devika Rao', status: 'In a meeting', color: '#d0208a' },
  { name: 'Harshith N.', status: 'Last seen 2h ago', color: '#0b7373' },
  { name: 'Kabir Singh', status: 'Busy', color: '#a06308' },
  { name: 'Meera Nair', status: 'Available', color: '#0a7a4d' },
  { name: 'Rohan Desai', status: 'Available', color: '#0a56d6' },
  { name: 'Srihitha K.', status: 'Online', color: '#8a2be2' }
];

export const THREAD = {
  with: 'Rohan Desai',
  messages: [
    { me: false, text: 'did the nightly flash cleanly?', at: '10:14' },
    { me: true, text: 'yes! resize gesture is in too', at: '10:16' },
    { me: false, text: 'pin it to the wiki when you can', at: '10:18' }
  ]
};

export const MAIL = [
  { from: 'Metro OS builds', subject: 'Nightly 0.1 is ready', at: '09:12' },
  { from: 'Ananya Iyer', subject: 'Tile layout for the demo day', at: '08:40' },
  { from: 'Kabir Singh', subject: 'Re: accent colours on light theme', at: 'Yesterday' }
];

export const initials = (name) => name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();

/* ---------- a tiny pretend player so the Music Bloom has live controls ---------- */
export const player = {
  index: 0,
  playing: false,
  elapsed: 42,
  timer: 0,
  get track() { return TRACKS[this.index]; },
  toggle() { this.playing ? this.pause() : this.play(); },
  play() {
    if (this.playing) return;
    this.playing = true;
    this.timer = setInterval(() => {
      this.elapsed += 1;
      if (this.elapsed >= this.track.len) this.next();
      else emit('player');
    }, 1000);
    emit('player');
  },
  pause() {
    this.playing = false;
    clearInterval(this.timer);
    emit('player');
  },
  next() { this.index = (this.index + 1) % TRACKS.length; this.elapsed = 0; emit('player'); },
  prev() {
    if (this.elapsed > 3) this.elapsed = 0;
    else this.index = (this.index - 1 + TRACKS.length) % TRACKS.length, this.elapsed = 0;
    emit('player');
  }
};

export const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
