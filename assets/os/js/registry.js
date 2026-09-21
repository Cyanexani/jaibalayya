/* Every app in Metro OS: name, icon, colour, which build phase it lands in,
   the tile sizes it allows, and its Bloom (the shortcuts that fan out when
   you hold its tile). Apps marked built: true have a real module in
   ./apps/<id>.js; the rest open their notes page until their phase ships. */

export const PHASES = {
  0: 'Foundation',
  1: 'Works with nothing extra',
  2: 'Free online services',
  3: 'Demo data',
  4: 'Accounts and community'
};

export const MARK_SVG = '<svg viewBox="0 0 100 100" aria-hidden="true" fill="currentColor"><path d="M50 3 73 26 50 49 27 26Z"/><path d="M26 27 49 50 26 73 3 50Z" opacity=".85"/><path d="M74 27 97 50 74 73 51 50Z" opacity=".85"/><path d="M50 51 73 74 50 97 27 74Z"/></svg>';

const s = (icon, label, go, extra = {}) => ({ icon, label, go, size: 's', ...extra });
const live = (live, label, go, size = 'm', extra = {}) => ({ live, label, go, size, ...extra });

export const APPS = [
  /* ---------- system ---------- */
  {
    id: 'hub', name: 'Metro OS', icon: 'mark', color: '#1a68e0', phase: 0, built: true, category: 'system',
    sizes: ['s', 'm', 'w', 'l'], tile: 'hub',
    bloom: [
      live('hubLatest', "what's new", '#/app/hub/whats-new', 'm'),
      s('fa-solid fa-road', 'roadmap', '#/app/hub/roadmap'),
      s('fa-solid fa-download', 'get it', '#/app/hub/get-it'),
      s('fa-solid fa-hand-pointer', 'gestures', '#/app/hub/gestures')
    ]
  },
  {
    id: 'settings', name: 'Settings', icon: 'fa-solid fa-gear', color: '#515c6b', phase: 0, built: true, category: 'system',
    sizes: ['s', 'm'],
    bloom: [
      s('fa-solid fa-palette', 'start + theme', '#/app/settings/theme'),
      s('fa-solid fa-droplet', 'accent colour', '#/app/settings/theme/accent'),
      s('fa-solid fa-image', 'wallpaper', '#/app/settings/theme/wallpaper'),
      s('fa-solid fa-lock', 'lock screen', '#/app/settings/lock')
    ]
  },
  {
    id: 'search', name: 'Search', icon: 'fa-solid fa-magnifying-glass', color: '#008299', phase: 0, built: true, category: 'system',
    sizes: ['s', 'm'],
    bloom: [
      s('fa-solid fa-clock-rotate-left', 'recent searches', '#/app/search'),
      s('fa-solid fa-microphone', 'search by voice', '#/app/search/voice')
    ]
  },
  {
    id: 'files', name: 'Files', icon: 'fa-solid fa-folder', color: '#e39400', phase: 1, built: true, category: 'system',
    sizes: ['s', 'm'],
    bloom: [
      s('fa-solid fa-file-circle-plus', 'new file', '#/app/files/new'),
      s('fa-solid fa-clock-rotate-left', 'recent', '#/app/files/recent'),
      live('storage', 'storage used', '#/app/files/storage', 'm')
    ]
  },
  {
    id: 'store', name: 'Store', icon: 'fa-solid fa-store', color: '#008a00', phase: 4, category: 'system',
    sizes: ['s', 'm', 'w'],
    bloom: [
      s('fa-solid fa-arrows-rotate', 'updates', '#/app/store/updates'),
      s('fa-solid fa-star', 'top picks', '#/app/store/top'),
      s('fa-solid fa-box-open', 'installed', '#/app/store/installed')
    ]
  },
  {
    id: 'studio', name: 'Live Tile Studio', icon: 'fa-solid fa-table-cells-large', color: '#6a00ff', phase: 4, category: 'system',
    sizes: ['s', 'm'],
    bloom: [
      s('fa-solid fa-plus', 'new tile', '#/app/studio/new'),
      s('fa-solid fa-shapes', 'my tiles', '#/app/studio/mine'),
      s('fa-solid fa-users', 'community tiles', '#/app/studio/community')
    ]
  },
  {
    id: 'feedback', name: 'Feedback', icon: 'fa-solid fa-comment-dots', color: '#00aba9', phase: 4, category: 'system',
    sizes: ['s', 'm'],
    bloom: [
      s('fa-solid fa-bug', 'report a bug', '#/app/feedback/bug'),
      s('fa-solid fa-lightbulb', 'suggest a feature', '#/app/feedback/idea'),
      s('fa-solid fa-square-poll-vertical', 'vote on the roadmap', '#/app/hub/roadmap')
    ]
  },

  /* ---------- people and messages (demo data) ---------- */
  {
    id: 'phone', name: 'Phone', icon: 'fa-solid fa-phone', color: '#0050ef', phase: 3, category: 'people',
    sizes: ['s', 'm'], badge: 1,
    bloom: [
      live('missedCall', 'recent calls', '#/app/phone/history', 'm'),
      s('fa-solid fa-grip', 'keypad', '#/app/phone/keypad'),
      s('fa-solid fa-star', 'call a favourite', '#/app/phone/favourites')
    ]
  },
  {
    id: 'messaging', name: 'Messaging', icon: 'fa-solid fa-message', color: '#1ba1e2', phase: 3, category: 'people',
    sizes: ['s', 'm', 'w'], badge: 2, tile: 'messaging',
    bloom: [
      live('latestThread', 'latest conversation', '#/app/messaging/thread', 'w'),
      s('fa-solid fa-pen', 'new message', '#/app/messaging/new')
    ]
  },
  {
    id: 'people', name: 'People', icon: 'fa-solid fa-user-group', color: '#fa6800', phase: 3, category: 'people',
    sizes: ['s', 'm', 'w'], tile: 'people',
    bloom: [
      s('fa-solid fa-user', 'me', '#/app/people/me'),
      s('fa-solid fa-star', 'favourites', '#/app/people/favourites'),
      s('fa-solid fa-newspaper', "what's new", '#/app/people/whats-new')
    ]
  },
  {
    id: 'mail', name: 'Mail', icon: 'fa-solid fa-envelope', color: '#0072c6', phase: 3, category: 'people',
    sizes: ['s', 'm', 'w'], badge: 3, tile: 'mail',
    bloom: [
      live('unread', 'unread', '#/app/mail/inbox', 'm'),
      s('fa-solid fa-arrows-rotate', 'sync', '#/app/mail/sync'),
      s('fa-solid fa-magnifying-glass', 'search mail', '#/app/mail/search'),
      s('fa-solid fa-pen-to-square', 'compose', '#/app/mail/compose'),
      s('fa-solid fa-gear', 'mail settings', '#/app/mail/settings')
    ]
  },

  /* ---------- media ---------- */
  {
    id: 'music', name: 'Music', icon: 'fa-solid fa-headphones', color: '#d80073', phase: 1, built: true, category: 'media',
    sizes: ['s', 'm', 'w'], tile: 'music',
    bloom: [
      live('nowPlaying', 'now playing', '#/app/music/now-playing', 'w'),
      live('recommended', 'recommended', '#/app/music/recommended', 'm'),
      s('fa-solid fa-shuffle', 'shuffle all', '#/app/music/shuffle'),
      s('fa-solid fa-list', 'queue', '#/app/music/queue'),
      s('fa-solid fa-tower-broadcast', 'radio', '#/app/radio')
    ]
  },
  {
    id: 'video', name: 'Video', icon: 'fa-solid fa-film', color: '#a20025', phase: 2, category: 'media',
    sizes: ['s', 'm', 'w'],
    bloom: [
      live('continueWatching', 'continue watching', '#/app/video/continue', 'w'),
      s('fa-solid fa-clock-rotate-left', 'recent', '#/app/video/recent')
    ]
  },
  {
    id: 'photos', name: 'Photos', icon: 'fa-solid fa-image', color: '#008a8a', phase: 1, built: true, category: 'media',
    sizes: ['s', 'm', 'w', 'l'], tile: 'photos',
    bloom: [
      live('latestPhoto', 'latest photo', '#/app/photos/latest', 'm'),
      s('fa-solid fa-images', 'albums', '#/app/photos/albums'),
      s('fa-solid fa-camera', 'camera', '#/app/camera')
    ]
  },
  {
    id: 'camera', name: 'Camera', icon: 'fa-solid fa-camera', color: '#5b2d90', phase: 1, built: true, category: 'media',
    sizes: ['s', 'm'],
    bloom: [
      s('fa-solid fa-camera', 'take a photo', '#/app/camera/photo'),
      s('fa-solid fa-video', 'record video', '#/app/camera/video'),
      s('fa-solid fa-camera-rotate', 'front camera', '#/app/camera/front')
    ]
  },
  {
    id: 'recorder', name: 'Recorder', icon: 'fa-solid fa-microphone', color: '#60a917', phase: 1, built: true, category: 'media',
    sizes: ['s', 'm'],
    bloom: [
      s('fa-solid fa-circle', 'record now', '#/app/recorder/record'),
      s('fa-solid fa-play', 'last recording', '#/app/recorder/last')
    ]
  },
  {
    id: 'radio', name: 'Radio', icon: 'fa-solid fa-radio', color: '#e51400', phase: 2, category: 'media',
    sizes: ['s', 'm'],
    bloom: [
      live('station', 'now on air', '#/app/radio/now', 'm'),
      s('fa-solid fa-heart', 'favourite stations', '#/app/radio/favourites')
    ]
  },
  {
    id: 'podcasts', name: 'Podcasts', icon: 'fa-solid fa-podcast', color: '#aa00ff', phase: 2, category: 'media',
    sizes: ['s', 'm'],
    bloom: [
      live('continueEpisode', 'continue episode', '#/app/podcasts/continue', 'w'),
      s('fa-solid fa-bolt', 'new episodes', '#/app/podcasts/new')
    ]
  },
  {
    id: 'books', name: 'Books', icon: 'fa-solid fa-book-open', color: '#825a2c', phase: 2, category: 'media',
    sizes: ['s', 'm'],
    bloom: [
      live('continueReading', 'continue reading', '#/app/books/continue', 'm'),
      s('fa-solid fa-book', 'library', '#/app/books/library')
    ]
  },
  {
    id: 'spotify', name: 'Spotify', icon: 'fa-brands fa-spotify', color: '#1db954', phase: 4, category: 'media',
    sizes: ['s', 'm', 'w'],
    bloom: [
      live('nowPlaying', 'now playing', '#/app/spotify/now-playing', 'w'),
      s('fa-solid fa-list', 'playlists', '#/app/spotify/playlists'),
      s('fa-solid fa-heart', 'liked songs', '#/app/spotify/liked')
    ]
  },
  {
    id: 'ytmusic', name: 'YouTube Music', icon: 'fa-brands fa-youtube', color: '#cc0000', phase: 4, category: 'media',
    sizes: ['s', 'm', 'w'],
    bloom: [
      live('nowPlaying', 'now playing', '#/app/ytmusic/now-playing', 'w'),
      s('fa-solid fa-list', 'playlists', '#/app/ytmusic/playlists'),
      s('fa-solid fa-heart', 'liked songs', '#/app/ytmusic/liked')
    ]
  },

  /* ---------- everyday tools ---------- */
  {
    id: 'clock', name: 'Clock', icon: 'fa-solid fa-clock', color: '#3a3aa8', phase: 1, built: true, category: 'tools',
    sizes: ['s', 'm', 'w'], tile: 'clock',
    bloom: [
      live('nextAlarm', 'next alarm', '#/app/clock/alarms', 'm'),
      s('fa-solid fa-hourglass-half', '5-minute timer', '#/app/clock/timer/5'),
      s('fa-solid fa-stopwatch', 'stopwatch', '#/app/clock/stopwatch')
    ]
  },
  {
    id: 'calendar', name: 'Calendar', icon: 'fa-solid fa-calendar-days', color: '#0063b1', phase: 1, built: true, category: 'tools',
    sizes: ['s', 'm', 'w'], tile: 'calendar',
    bloom: [
      live('today', 'today', '#/app/calendar/today', 'm'),
      s('fa-solid fa-plus', 'new event', '#/app/calendar/new')
    ]
  },
  {
    id: 'weather', name: 'Weather', icon: 'fa-solid fa-cloud-sun', color: '#2d7dd2', phase: 1, built: true, category: 'tools',
    sizes: ['s', 'm', 'w'], tile: 'weather',
    bloom: [
      live('tomorrow', 'tomorrow', '#/app/weather/tomorrow', 'm'),
      s('fa-solid fa-chart-line', 'hourly', '#/app/weather/hourly'),
      s('fa-solid fa-location-dot', 'change city', '#/app/weather/city')
    ]
  },
  {
    id: 'maps', name: 'Maps', icon: 'fa-solid fa-map-location-dot', color: '#d13438', phase: 2, category: 'tools',
    sizes: ['s', 'm', 'w'],
    bloom: [
      s('fa-solid fa-location-crosshairs', 'my location', '#/app/maps/me'),
      s('fa-solid fa-magnifying-glass', 'search places', '#/app/maps/search'),
      s('fa-solid fa-bookmark', 'saved places', '#/app/maps/saved')
    ]
  },
  {
    id: 'calculator', name: 'Calculator', icon: 'fa-solid fa-calculator', color: '#647687', phase: 1, built: true, category: 'tools',
    sizes: ['s', 'm'],
    bloom: [
      s('fa-solid fa-equals', 'last result', '#/app/calculator'),
      s('fa-solid fa-ruler', 'unit converter', '#/app/calculator/convert')
    ]
  },
  {
    id: 'notes', name: 'Notes', icon: 'fa-solid fa-note-sticky', color: '#c78c00', phase: 1, built: true, category: 'tools',
    sizes: ['s', 'm'], tile: 'notes',
    bloom: [
      s('fa-solid fa-plus', 'new note', '#/app/notes/new'),
      live('pinnedNote', 'pinned note', '#/app/notes/pinned', 'm')
    ]
  },
  {
    id: 'documents', name: 'Documents', icon: 'fa-solid fa-file-lines', color: '#c1272d', phase: 1, built: true, category: 'tools',
    sizes: ['s', 'm'],
    bloom: [
      s('fa-solid fa-file-circle-plus', 'new document', '#/app/documents/new'),
      s('fa-solid fa-clock-rotate-left', 'recent', '#/app/documents/recent')
    ]
  },
  {
    id: 'browser', name: 'Browser', icon: 'fa-solid fa-globe', color: '#0078d7', phase: 4, category: 'tools',
    sizes: ['s', 'm'],
    bloom: [
      s('fa-solid fa-plus', 'new tab', '#/app/browser/new'),
      s('fa-solid fa-bookmark', 'bookmarks', '#/app/browser/bookmarks')
    ]
  },
  {
    id: 'wallet', name: 'Wallet', icon: 'fa-solid fa-wallet', color: '#76608a', phase: 3, category: 'tools',
    sizes: ['s', 'm', 'w'],
    bloom: [
      live('card', 'default card', '#/app/wallet/card', 'w'),
      s('fa-solid fa-receipt', 'recent activity', '#/app/wallet/activity')
    ]
  }
];

const BY_ID = new Map(APPS.map((a) => [a.id, a]));
export const byId = (id) => BY_ID.get(id);

/** Apps sorted the way the app list shows them. */
export const sortedApps = () => [...APPS].sort((a, b) => a.name.localeCompare(b.name));

/** Icon markup for an app (Font Awesome class or the Metro OS mark). */
export function iconHtml(app) {
  if (app.icon === 'mark') return MARK_SVG;
  return `<i class="${app.icon}" aria-hidden="true"></i>`;
}

export const statusText = (app) => (app.built ? 'ready' : `phase ${app.phase}`);
export const statusLong = (app) => (app.built ? 'Ready to use' : `Arrives in phase ${app.phase}: ${PHASES[app.phase].toLowerCase()}`);
