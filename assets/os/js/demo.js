/* Demo data for apps that arrive in later phases, so their tiles and Bloom
   shortcuts have something to show. Names and photos are Metro OS's own
   (carried over from the old site); nothing here is real. */

const IMG = 'assets/img/';

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
