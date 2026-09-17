/* ==========================================================================
   METRO OS — DEVICE RENDERER + INTERACTIVE SIMULATOR
   The phones on this site are not screenshots: they are real DOM running a
   miniature Metro shell. The same builders render the static mockups and the
   interactive device on the Experience page.
   ========================================================================== */
(function () {
  'use strict';

  var M = window.METRO || {};
  var $  = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var IMG = 'assets/img/';

  function ico(n, cls) {
    return '<svg' + (cls ? ' class="' + cls + '"' : '') + ' aria-hidden="true"><use href="#i-' + n + '"></use></svg>';
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function now() { var d = new Date(); return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function today() { return new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' }); }

  /* ======================================================================
     DATA
     ====================================================================== */
  var APPS = [
    { n: 'Alarms',       i: 'alarm',      c: 'cyan' },
    { n: 'Browser',      i: 'globe',      c: 'blue',    go: 'browser' },
    { n: 'Calculator',   i: 'calculator', c: 'violet' },
    { n: 'Calendar',     i: 'calendar',   c: 'teal',    go: 'calendar' },
    { n: 'Camera',       i: 'camera',     c: 'purple',  go: 'camera' },
    { n: 'Files',        i: 'files',      c: 'amber',   go: 'files' },
    { n: 'FM Radio',     i: 'radio',      c: 'crimson' },
    { n: 'Maps',         i: 'maps',       c: 'crimson', go: 'maps' },
    { n: 'Messaging',    i: 'message',    c: 'blue',    go: 'messages' },
    { n: 'Music',        i: 'music',      c: 'magenta', go: 'music' },
    { n: 'Notes',        i: 'note',       c: 'amber' },
    { n: 'People',       i: 'people',     c: 'violet',  go: 'people' },
    { n: 'Phone',        i: 'phone',      c: 'cobalt',  go: 'phone' },
    { n: 'Photos',       i: 'photos',     c: 'teal',    go: 'photos' },
    { n: 'Podcasts',     i: 'mic',        c: 'purple' },
    { n: 'Recorder',     i: 'mic',        c: 'emerald' },
    { n: 'Settings',     i: 'settings',   c: 'slate',   go: 'settings' },
    { n: 'Store',        i: 'store',      c: 'emerald', go: 'store' },
    { n: 'Video',        i: 'video',      c: 'crimson' },
    { n: 'Wallet',       i: 'wallet',     c: 'emerald' },
    { n: 'Weather',      i: 'cloud',      c: 'cyan',    go: 'weather' }
  ];

  var CONTACTS = [
    { n: 'Aarav Mehta',  s: 'Available',        c: 'blue' },
    { n: 'Ananya Iyer',  s: 'Available',        c: 'violet' },
    { n: 'Devika Rao',   s: 'In a meeting',     c: 'magenta' },
    { n: 'Harshith N.',  s: 'Last seen 2h ago', c: 'teal' },
    { n: 'Kabir Singh',  s: 'Busy',             c: 'amber' },
    { n: 'Meera Nair',   s: 'Available',        c: 'emerald' },
    { n: 'Rohan Desai',  s: 'Available',        c: 'cobalt' },
    { n: 'Srihitha K.',  s: 'Online',           c: 'purple' }
  ];

  var TRACKS = [
    { t: 'A Brighter Tomorrow', a: 'Cyanex',           al: 'Signal Fade',   art: IMG + 'art-1.webp', len: '3:56' },
    { t: 'Midnight Drive',      a: 'The Astro Collective', al: 'Neon Coast', art: IMG + 'art-2.webp', len: '4:12' },
    { t: 'Sunset Drive',        a: 'Halcyon Field',     al: 'Long Exposure', art: IMG + 'art-3.webp', len: '3:24' },
    { t: 'Still Here',          a: 'Novo',              al: 'Quiet Machines', art: IMG + 'art-4.webp', len: '5:08' }
  ];

  var PHOTOS = ['pic-1', 'pic-2', 'pic-3', 'pic-4', 'pic-5', 'pic-6'].map(function (p) { return IMG + p + '.webp'; });

  var WEATHER = [
    { d: 'Today', t: 27, c: 'Mostly clear',   i: 'moon' },
    { d: 'Thu',   t: 29, c: 'Sunny',          i: 'sun' },
    { d: 'Fri',   t: 24, c: 'Light showers',  i: 'cloud' },
    { d: 'Sat',   t: 26, c: 'Partly cloudy',  i: 'cloud' },
    { d: 'Sun',   t: 30, c: 'Clear',          i: 'sun' }
  ];

  var CHAT = [
    { me: 0, t: 'heyy — did the nightly flash cleanly?', at: '10:14' },
    { me: 0, t: 'tiles look unreal on this panel', at: '10:15' },
    { me: 1, t: 'yes! resize gesture is in too', at: '10:16' },
    { me: 0, t: 'ok sending you my start layout 😄', at: '10:17' },
    { me: 1, t: 'pin it to the wiki when you can', at: '10:18' }
  ];

  var TILEC = { blue: 'var(--tile-blue)', cobalt: 'var(--tile-cobalt)', cyan: 'var(--tile-cyan)', violet: 'var(--tile-violet)', purple: 'var(--tile-purple)', magenta: 'var(--tile-magenta)', emerald: 'var(--tile-emerald)', teal: 'var(--tile-teal)', amber: 'var(--tile-amber)', crimson: 'var(--tile-crimson)', slate: 'var(--tile-slate)', ink: 'var(--tile-ink)', accent: 'var(--mui-accent)' };
  function col(c) { return TILEC[c] || TILEC.blue; }

  /* ======================================================================
     TILE BUILDERS
     ====================================================================== */
  function tile(o, live) {
    var tag = live ? 'button' : 'span';
    var attrs = ' class="mtile mtile--' + (o.s || 'm') + '" style="--mt:' + col(o.c) + '"';
    if (live) attrs += ' type="button" data-go="' + (o.go || o.id) + '" aria-label="' + esc(o.aria || o.label || o.id) + '"';
    return '<' + tag + attrs + '>' + tileFace(o) + '</' + tag + '>';
  }

  function tileFace(o) {
    var k = o.kind || 'icon';
    if (k === 'icon') {
      return '<span class="mtile__in">' + ico(o.icon, 'mtile__ico') +
        (o.badge ? '<b class="mtile__badge">' + o.badge + '</b>' : '') +
        '<span class="mtile__lab">' + esc(o.label) + '</span></span>';
    }
    if (k === 'weather') {
      return '<span class="mtile__in">' +
        '<span style="display:flex;align-items:flex-start;justify-content:space-between">' +
        '<b class="mtile__num" data-sim-temp>27&deg;</b>' + ico('moon', 'mtile__ico--sm') + '</span>' +
        '<span class="mtile__lab">weather</span></span>';
    }
    if (k === 'calendar') {
      return '<span class="mtile__faces">' +
        '<span class="mtile__face"><span class="mtile__in">' +
          '<span class="mtile__txt" data-sim-day>Tue</span><b class="mtile__num" data-sim-date>15</b>' +
          '<span class="mtile__lab">calendar</span></span></span>' +
        '<span class="mtile__face mtile__face--b" style="background:' + col('teal') + '"><span class="mtile__in">' +
          '<span class="mtile__txt">Design sync<br>11:00 &ndash; 12:00</span>' +
          '<span class="mtile__lab">calendar</span></span></span></span>';
    }
    if (k === 'people') {
      var cells = CONTACTS.slice(0, 4).map(function (p) {
        return '<span style="background:' + col(p.c) + ';display:grid;place-items:center;font-size:calc(var(--u)*4)">' + p.n.charAt(0) + '</span>';
      }).join('');
      return '<span class="mtile__in" style="padding:0">' +
        '<span style="position:absolute;inset:0;display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr">' + cells + '</span>' +
        '<span style="position:absolute;inset:0;background:linear-gradient(0deg,rgba(0,0,0,.6),transparent 52%)"></span>' +
        '<span class="mtile__lab" style="position:absolute;left:calc(var(--u)*1.8);bottom:calc(var(--u)*1.4)">people</span></span>';
    }
    if (k === 'music') {
      var t = TRACKS[0];
      return '<span class="mtile__in" style="padding:0">' +
        '<span style="position:absolute;inset:0;display:flex">' +
        '<img class="mtile__img" style="position:relative;width:38%;flex:none" src="' + t.art + '" alt="" loading="lazy" decoding="async">' +
        '<span style="flex:1;padding:calc(var(--u)*2);display:flex;flex-direction:column;justify-content:center;gap:calc(var(--u)*.6)">' +
        '<b class="mtile__txt" style="font-size:calc(var(--u)*3.8)" data-sim-track>' + esc(t.t) + '</b>' +
        '<span class="mtile__txt" style="opacity:.62" data-sim-artist>' + esc(t.a) + '</span>' +
        '<span style="display:flex;gap:calc(var(--u)*2.4);margin-top:calc(var(--u)*1)">' +
        ico('prev', 'mtile__ico--sm') + ico('pause', 'mtile__ico--sm') + ico('next', 'mtile__ico--sm') + '</span></span></span>' +
        '<span class="mtile__lab" style="position:absolute;left:calc(var(--u)*1.8);bottom:calc(var(--u)*1)">music</span></span>';
    }
    if (k === 'photos') {
      return '<span class="mtile__in" style="padding:0">' +
        '<img class="mtile__img" src="' + PHOTOS[0] + '" alt="" loading="lazy" decoding="async" data-cycle-img=\'' + JSON.stringify(PHOTOS) + '\'>' +
        '<span class="mtile__scrim"></span>' +
        '<span class="mtile__lab" style="position:absolute;left:calc(var(--u)*1.8);bottom:calc(var(--u)*1.4)">photos</span></span>';
    }
    return '';
  }

  var START_TILES = [
    { id: 'phone',    s: 's', c: 'cobalt',  icon: 'phone',   label: 'phone' },
    { id: 'messages', s: 's', c: 'blue',    icon: 'message', label: 'messages', badge: 3 },
    { id: 'people',   s: 'm', c: 'violet',  kind: 'people',  label: 'people' },
    { id: 'calendar', s: 's', c: 'teal',    kind: 'calendar', label: 'calendar' },
    { id: 'weather',  s: 's', c: 'cyan',    kind: 'weather', label: 'weather' },
    { id: 'music',    s: 'w', c: 'magenta', kind: 'music',   label: 'music' },
    { id: 'photos',   s: 'm', c: 'ink',     kind: 'photos',  label: 'photos' },
    { id: 'camera',   s: 's', c: 'purple',  icon: 'camera',  label: 'camera' },
    { id: 'store',    s: 's', c: 'emerald', icon: 'store',   label: 'store' },
    { id: 'files',    s: 's', c: 'amber',   icon: 'files',   label: 'files' },
    { id: 'maps',     s: 's', c: 'crimson', icon: 'maps',    label: 'maps' },
    { id: 'settings', s: 's', c: 'slate',   icon: 'settings', label: 'settings' },
    { id: 'browser',  s: 's', c: 'blue',    icon: 'globe',   label: 'browser' },
    { id: 'notes',    s: 's', c: 'amber',   icon: 'note',    label: 'notes' },
    { id: 'weather2', s: 's', c: 'teal',    icon: 'alarm',   label: 'alarms', go: 'soon' }
  ];

  /* ======================================================================
     SCREENS
     ====================================================================== */
  var S = {};

  S.start = function (live) {
    return '<div class="mui-start">' +
      '<h2 class="mui__title mui__title--start">Start</h2>' +
      '<div class="mui-start__grid">' + START_TILES.map(function (t) { return tile(t, live); }).join('') + '</div>' +
      '<p class="mui__app-title" style="padding-top:calc(var(--u)*3);opacity:.5">' +
      (live ? 'swipe left for all apps' : 'press and hold to resize') + '</p></div>';
  };

  S.apps = function (live) {
    var letters = {}, out = '';
    APPS.forEach(function (a) { var l = a.n.charAt(0).toLowerCase(); (letters[l] = letters[l] || []).push(a); });
    Object.keys(letters).forEach(function (l) {
      out += '<div class="mui-letter">' + l + '</div>';
      out += letters[l].map(function (a) {
        return '<' + (live ? 'button' : 'span') + ' class="mui-row"' + (live ? ' type="button" data-go="' + (a.go || 'soon') + '"' : '') + '>' +
          '<span class="mui-row__ico" style="--ri:' + col(a.c) + '">' + ico(a.i) + '</span>' +
          '<span class="mui-row__t">' + esc(a.n) + '</span></' + (live ? 'button' : 'span') + '>';
      }).join('');
    });
    return '<h2 class="mui__title">apps</h2>' +
      '<div class="mui-search">Search apps' + ico('search') + '</div>' +
      '<div class="mui-list">' + out + '</div>';
  };

  S.settings = function (live) {
    var sw = (M.accents || ['blue']).map(function (a) {
      return '<button type="button" class="mui-swatch" data-accent-set="' + a + '" aria-label="' + a + ' accent" ' +
        'style="background:var(--acc-' + a + ')"></button>';
    }).join('');
    return '<p class="mui__app-title">METRO OS</p><h2 class="mui__title">settings</h2>' +
      '<div class="mui-list">' +
        '<div class="mui-setting"><span class="mui-row__ico" style="--ri:' + col('violet') + '">' + ico('palette') + '</span>' +
        '<span><span class="mui-row__t">accent colour</span><span class="mui-row__s">changes this whole site</span></span></div></div>' +
      '<div class="mui-swatches">' + sw + '</div>' +
      '<div class="mui-list">' +
        '<div class="mui-setting"><span class="mui-row__ico" style="--ri:' + col('slate') + '">' + ico('sun') + '</span>' +
          '<span><span class="mui-row__t">light theme</span><span class="mui-row__s">background</span></span>' +
          '<button type="button" class="mui-toggle" data-sim-toggle="light" aria-pressed="false" aria-label="Light theme"></button></div>' +
        '<div class="mui-setting"><span class="mui-row__ico" style="--ri:' + col('teal') + '">' + ico('grid') + '</span>' +
          '<span><span class="mui-row__t">show more tiles</span><span class="mui-row__s">start screen</span></span>' +
          '<button type="button" class="mui-toggle" data-sim-toggle="dense" aria-pressed="false" aria-label="Show more tiles"></button></div>' +
        '<div class="mui-setting"><span class="mui-row__ico" style="--ri:' + col('cyan') + '">' + ico('bell') + '</span>' +
          '<span><span class="mui-row__t">notifications</span><span class="mui-row__s">all apps</span></span>' +
          '<button type="button" class="mui-toggle" data-sim-toggle="notify" aria-pressed="true" aria-label="Notifications"></button></div>' +
        '<div class="mui-setting"><span class="mui-row__ico" style="--ri:' + col('emerald') + '">' + ico('shield') + '</span>' +
          '<span><span class="mui-row__t">privacy</span><span class="mui-row__s">nothing leaves the device</span></span></div>' +
        '<div class="mui-setting"><span class="mui-row__ico" style="--ri:' + col('cobalt') + '">' + ico('mark-solid') + '</span>' +
          '<span><span class="mui-row__t">about</span><span class="mui-row__s">Metro OS 0.5 &middot; preview</span></span></div>' +
      '</div>';
  };

  S.music = function (live) {
    var t = TRACKS[0];
    return '<p class="mui__app-title">MUSIC</p><h2 class="mui__title">now playing</h2>' +
      '<div class="mui-np">' +
        '<img class="mui-np__art" src="' + t.art + '" alt="Album artwork" data-sim-art loading="lazy" decoding="async">' +
        '<div><div class="mui-np__t" data-sim-title>' + esc(t.t) + '</div>' +
        '<div class="mui-np__a" data-sim-by>' + esc(t.a) + '</div></div>' +
        '<div class="mui-bar" data-sim-bar><span class="mui-bar__f"></span><span class="mui-bar__k"></span></div>' +
        '<div class="mui-times"><span data-sim-elapsed>1:24</span><span data-sim-len>' + t.len + '</span></div>' +
        '<div class="mui-np__ctl">' +
          '<button type="button" aria-label="Shuffle">' + ico('shuffle') + '</button>' +
          '<button type="button" data-sim-prev aria-label="Previous track">' + ico('prev') + '</button>' +
          '<button type="button" class="mui-np__play" data-sim-play aria-label="Pause">' + ico('pause') + '</button>' +
          '<button type="button" data-sim-next aria-label="Next track">' + ico('next') + '</button>' +
          '<button type="button" aria-label="Repeat">' + ico('repeat') + '</button>' +
        '</div>' +
        '<div class="mui-row" style="gap:calc(var(--u)*2);opacity:.6">' + ico('cast') + '<span class="mui-row__s">Playing on this device</span></div>' +
      '</div>';
  };

  S.people = function (live) {
    var rows = CONTACTS.map(function (p, i) {
      return '<' + (live ? 'button' : 'span') + ' class="mui-row"' + (live ? ' type="button" data-go="contact:' + i + '"' : '') + '>' +
        '<span class="mui-row__ico" style="--ri:' + col(p.c) + '">' + p.n.charAt(0) + '</span>' +
        '<span><span class="mui-row__t">' + esc(p.n) + '</span><span class="mui-row__s">' + esc(p.s) + '</span></span></' + (live ? 'button' : 'span') + '>';
    }).join('');
    return '<p class="mui__app-title">PEOPLE</p><h2 class="mui__title">people</h2>' +
      '<div class="mui__pivots"><b>all</b><span>favourites</span><span>groups</span></div>' +
      '<div class="mui-list">' + rows + '</div>';
  };

  S.contact = function (live, i) {
    var p = CONTACTS[i] || CONTACTS[0];
    return '<p class="mui__app-title">PEOPLE</p>' +
      '<div style="padding:0 calc(var(--u)*5)">' +
      '<div style="width:100%;aspect-ratio:1;background:' + col(p.c) + ';display:grid;place-items:center;font-size:calc(var(--u)*24);font-weight:200">' + p.n.charAt(0) + '</div></div>' +
      '<h2 class="mui__title" style="padding-top:calc(var(--u)*3)">' + esc(p.n.split(' ')[0].toLowerCase()) + '</h2>' +
      '<div class="mui-list">' +
      '<div class="mui-row"><span class="mui-row__s">' + esc(p.s) + '</span></div>' +
      ['Send a message|message|' + col('blue'), 'Call mobile|phone|' + col('emerald'), 'Add to favourites|star|' + col('amber'), 'Share contact|swap|' + col('violet')]
        .map(function (r) { var f = r.split('|');
          return '<span class="mui-row"><span class="mui-row__ico" style="--ri:' + f[2] + '">' + ico(f[1]) + '</span><span class="mui-row__t">' + f[0] + '</span></span>'; }).join('') +
      '</div>';
  };

  S.photos = function (live) {
    var g = PHOTOS.concat(PHOTOS).map(function (p, i) {
      return '<' + (live ? 'button type="button" data-go="photo:' + (i % PHOTOS.length) + '"' : 'span') + ' style="padding:0;border:0;background:none">' +
        '<img src="' + p + '" alt="" loading="lazy" decoding="async" style="aspect-ratio:1;object-fit:cover;width:100%"></' + (live ? 'button' : 'span') + '>';
    }).join('');
    return '<p class="mui__app-title">PHOTOS</p><h2 class="mui__title">photos</h2>' +
      '<div class="mui__pivots"><b>all</b><span>albums</span><span>places</span></div>' +
      '<div class="mui-grid">' + g + '</div>';
  };

  S.photo = function (live, i) {
    return '<div style="position:absolute;inset:0;display:flex;flex-direction:column;justify-content:flex-end;background:#000">' +
      '<img src="' + PHOTOS[i || 0] + '" alt="Photo" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover">' +
      '<div style="position:relative;padding:calc(var(--u)*4);background:linear-gradient(0deg,rgba(0,0,0,.8),transparent)">' +
      '<div class="mui-row__t">Today &middot; 10:24</div><div class="mui-row__s">Metro OS Camera</div></div></div>';
  };

  S.messages = function (live) {
    return '<p class="mui__app-title">MESSAGING</p><h2 class="mui__title">srihitha</h2>' +
      '<div class="mui-chat">' + CHAT.map(function (m) {
        return '<div class="mui-bubble' + (m.me ? ' mui-bubble--me' : '') + '">' + esc(m.t) + '<time>' + m.at + '</time></div>';
      }).join('') + '</div>' +
      '<div class="mui-search" style="background:#12192a;color:rgba(255,255,255,.55)">type a message' + ico('plus') + '</div>';
  };

  S.phone = function (live) {
    var rows = CONTACTS.slice(0, 5).map(function (p, i) {
      return '<span class="mui-row"><span class="mui-row__ico" style="--ri:' + col(p.c) + '">' + p.n.charAt(0) + '</span>' +
        '<span><span class="mui-row__t">' + esc(p.n) + '</span><span class="mui-row__s">' + (i % 2 ? 'Outgoing' : 'Incoming') + ' &middot; ' + (9 + i) + ':' + pad(i * 11) + '</span></span>' +
        '<span class="mui-row__end">' + ico('phone') + '</span></span>';
    }).join('');
    return '<p class="mui__app-title">PHONE</p><h2 class="mui__title">history</h2><div class="mui-list">' + rows + '</div>';
  };

  S.calendar = function () {
    var items = [['09:30', 'Stand-up', 'Contributors'], ['11:00', 'Design sync', 'Tile engine'], ['14:00', 'Triage', 'Issues'], ['18:30', 'Community call', 'Discord']];
    return '<p class="mui__app-title">CALENDAR</p><h2 class="mui__title">today</h2><div class="mui-list">' +
      items.map(function (it) {
        return '<span class="mui-row"><span class="mui-row__ico" style="--ri:' + col('teal') + ';font-size:calc(var(--u)*3)">' + it[0] + '</span>' +
          '<span><span class="mui-row__t">' + it[1] + '</span><span class="mui-row__s">' + it[2] + '</span></span></span>';
      }).join('') + '</div>';
  };

  S.weather = function () {
    return '<p class="mui__app-title">WEATHER</p><h2 class="mui__title">hyderabad</h2>' +
      '<div style="padding:0 calc(var(--u)*5) calc(var(--u)*3);display:flex;align-items:flex-end;gap:calc(var(--u)*3)">' +
      '<b style="font-size:calc(var(--u)*22);font-weight:200;line-height:.9">27&deg;</b>' +
      '<span class="mui-row__s" style="padding-bottom:calc(var(--u)*2)">Mostly clear<br>Feels like 29&deg;</span></div>' +
      '<div class="mui-list">' + WEATHER.map(function (w) {
        return '<span class="mui-row"><span class="mui-row__ico" style="--ri:' + col('cyan') + '">' + ico(w.i) + '</span>' +
          '<span><span class="mui-row__t">' + w.d + '</span><span class="mui-row__s">' + w.c + '</span></span>' +
          '<span class="mui-row__end">' + w.t + '&deg;</span></span>';
      }).join('') + '</div>';
  };

  S.browser = function () {
    return '<p class="mui__app-title">BROWSER</p><h2 class="mui__title">tabs</h2>' +
      '<div class="mui-search">metro-os.dev' + ico('search') + '</div>' +
      '<div class="mui-list">' + ['Metro OS — Documentation', 'Tile engine RFC #128', 'Build from source', 'Community wiki'].map(function (t) {
        return '<span class="mui-row"><span class="mui-row__ico" style="--ri:' + col('blue') + '">' + ico('globe') + '</span><span class="mui-row__t">' + t + '</span></span>';
      }).join('') + '</div>';
  };

  S.files = function () {
    var f = [['Downloads', 'folder', 12], ['Pictures', 'folder', 340], ['Music', 'folder', 96], ['metro-os-0.5.zip', 'file', 1], ['start-layout.json', 'file', 1]];
    return '<p class="mui__app-title">FILES</p><h2 class="mui__title">this device</h2><div class="mui-list">' +
      f.map(function (x) {
        return '<span class="mui-row"><span class="mui-row__ico" style="--ri:' + col('amber') + '">' + ico(x[1] === 'folder' ? 'files' : 'note') + '</span>' +
          '<span><span class="mui-row__t">' + x[0] + '</span><span class="mui-row__s">' + (x[1] === 'folder' ? x[2] + ' items' : '18.4 MB') + '</span></span></span>';
      }).join('') + '</div>';
  };

  S.maps = function () {
    return '<p class="mui__app-title">MAPS</p><h2 class="mui__title">nearby</h2>' +
      '<div style="margin:0 calc(var(--u)*5);aspect-ratio:1;background:' +
      'repeating-linear-gradient(0deg,#0e1728 0 calc(var(--u)*6),#0b1220 calc(var(--u)*6) calc(var(--u)*6.4)),' +
      'repeating-linear-gradient(90deg,#0e1728 0 calc(var(--u)*6),#0b1220 calc(var(--u)*6) calc(var(--u)*6.4));' +
      'position:relative;display:grid;place-items:center">' +
      '<span style="width:calc(var(--u)*6);height:calc(var(--u)*6);background:var(--mui-accent);transform:rotate(45deg)"></span></div>' +
      '<div class="mui-list"><span class="mui-row"><span class="mui-row__ico" style="--ri:' + col('crimson') + '">' + ico('pin') + '</span>' +
      '<span><span class="mui-row__t">You are here</span><span class="mui-row__s">Offline map data</span></span></span></div>';
  };

  S.store = function () {
    return '<p class="mui__app-title">STORE</p><h2 class="mui__title">community</h2>' +
      '<div class="mui-grid mui-grid--2" style="padding-top:calc(var(--u)*1)">' +
      [['Tiles+', 'violet'], ['Retro Pack', 'magenta'], ['Podcasts', 'emerald'], ['Lens', 'cyan']].map(function (a) {
        return '<span style="background:' + col(a[1]) + ';display:flex;align-items:flex-end;padding:calc(var(--u)*2);font-size:calc(var(--u)*3.2)">' + a[0] + '</span>';
      }).join('') + '</div>' +
      '<p class="mui__app-title" style="padding-top:calc(var(--u)*3)">Sideload-friendly. No account needed.</p>';
  };

  S.camera = function () {
    return '<div style="position:absolute;inset:0;background:#05070c;display:flex;flex-direction:column;justify-content:flex-end">' +
      '<img src="' + PHOTOS[2] + '" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.9">' +
      '<div style="position:relative;display:flex;align-items:center;justify-content:space-around;padding:calc(var(--u)*5);background:linear-gradient(0deg,rgba(0,0,0,.75),transparent)">' +
      ico('photos', 'mtile__ico') +
      '<span style="width:calc(var(--u)*14);height:calc(var(--u)*14);border-radius:50%;border:calc(var(--u)*.8) solid #fff"></span>' +
      ico('swap', 'mtile__ico') + '</div></div>';
  };

  S.soon = function () {
    return '<p class="mui__app-title">METRO OS</p><h2 class="mui__title">not yet</h2>' +
      '<p style="padding:0 calc(var(--u)*5);font-size:calc(var(--u)*3.8);color:rgba(255,255,255,.55);line-height:1.5">' +
      'This app is on the roadmap but not in the preview build. Track it on GitHub &mdash; or build it yourself.</p>';
  };

  S.search = function () {
    var groups = [
      ['apps', [['Messaging', 'message', 'blue'], ['Music', 'music', 'magenta']]],
      ['people', [['Meera Nair', 'user', 'emerald']]],
      ['files', [['start-layout.json', 'note', 'amber']]],
      ['on the web', [['metro os tile engine', 'globe', 'cobalt']]]
    ];
    var out = groups.map(function (g) {
      return '<div class="mui__app-title" style="padding-top:calc(var(--u)*3)">' + g[0] + '</div>' +
        g[1].map(function (r) {
          return '<span class="mui-row"><span class="mui-row__ico" style="--ri:' + col(r[2]) + '">' + ico(r[1]) + '</span>' +
            '<span class="mui-row__t">' + r[0] + '</span></span>';
        }).join('');
    }).join('');
    return '<h2 class="mui__title">search</h2>' +
      '<div class="mui-search">me<span style="border-left:1px solid #111;margin-left:1px;animation:fade 1s steps(2) infinite">&nbsp;</span>' + ico('search') + '</div>' +
      '<div class="mui-list">' + out + '</div>';
  };

  S.lock = function (live) {
    return '<div class="mui-lock">' +
      '<img class="mui-lock__bg" src="' + IMG + 'wall-lock.webp" alt="" loading="lazy" decoding="async">' +
      '<span class="mui-lock__scrim"></span>' +
      '<div class="mui-lock__in">' +
        '<div class="mui-lock__time" data-sim-time>' + now() + '</div>' +
        '<div class="mui-lock__date" data-sim-date-full>' + today() + '</div>' +
        '<div class="mui-lock__notes">' +
          '<span>' + ico('message') + ' 3</span><span>' + ico('mail') + ' 5</span><span>' + ico('calendar') + ' 2</span></div>' +
        '<p class="mui-lock__hint"><span>' + (live ? 'swipe up to unlock' : 'a moment of calm') + '</span></p>' +
      '</div></div>';
  };

  /* ======================================================================
     SHELL
     ====================================================================== */
  function statusBar() {
    return '<div class="mui__status"><span data-sim-time>' + now() + '</span>' +
      '<span class="mui__status-r">' + ico('signal') + ico('wifi') + ico('battery') + '</span></div>';
  }
  function navBar(live) {
    var b = live ? 'button type="button"' : 'span';
    return '<div class="mui__nav">' +
      '<' + b + (live ? ' data-nav="back" aria-label="Back"' : '') + '>' + ico('arrow-left') + '</' + (live ? 'button' : 'span') + '>' +
      '<' + b + (live ? ' data-nav="home" aria-label="Start"' : '') + '>' + ico('mark-solid', 'mui__home') + '</' + (live ? 'button' : 'span') + '>' +
      '<' + b + (live ? ' data-nav="search" aria-label="Search"' : '') + '>' + ico('search') + '</' + (live ? 'button' : 'span') + '>' +
      '</div>';
  }

  function device(screen, opts) {
    opts = opts || {};
    var live = !!opts.live;
    var body = (S[screen] || S.start)(live, opts.arg);
    var lock = screen === 'lock';
    return '<div class="phone__frame" data-phone-frame>' +
      '<div class="phone__screen">' +
        '<span class="phone__notch"></span>' +
        '<div class="mui">' +
          statusBar() +
          '<div class="mui__view"><div class="scr is-entering">' + body + '</div></div>' +
          (lock ? '' : navBar(live)) +
        '</div>' +
        '<span class="phone__glare"></span>' +
      '</div></div>';
  }

  /* ======================================================================
     STATIC MOCKUPS  — <div data-phone="start">
     ====================================================================== */
  function mountStatic() {
    $$('[data-phone]').forEach(function (el) {
      var name = el.dataset.phone;
      var arg = null;
      if (name.indexOf(':') > -1) { arg = parseInt(name.split(':')[1], 10); name = name.split(':')[0]; }
      el.insertAdjacentHTML('afterbegin', device(name, { live: false, arg: arg }));
      el.setAttribute('aria-hidden', 'true');
      // a decorative mockup must not hold focus: nothing inside it does anything,
      // and focusable nodes inside aria-hidden are an accessibility violation
      $$('button, a, input, select, textarea, [tabindex]', el).forEach(function (n) {
        n.setAttribute('tabindex', '-1');
        if (n.tagName === 'BUTTON') n.disabled = true;
      });
      var s = el.querySelector('.scr');
      if (s) s.classList.remove('is-entering');
    });
  }

  /* ======================================================================
     INTERACTIVE SIMULATOR — <div data-simulator>
     ====================================================================== */
  function mountSim() {
    var host = $('[data-simulator]');
    if (!host) return;

    var state = { screen: 'lock', arg: null, stack: [], playing: true, track: 0, elapsed: 84, light: false, dense: false };
    var timer = null;

    host.innerHTML = '<div class="phone phone--fluid phone--reflect" data-sim-phone>' + device('lock', { live: true }) + '</div>';
    var phone = $('[data-sim-phone]', host);

    function view() { return $('.mui__view', phone); }
    function mui() { return $('.mui', phone); }

    function render(fresh) {
      var v = view();
      var old = $('.scr', v);
      var next = document.createElement('div');
      next.className = 'scr' + (M.reduced && M.reduced() ? '' : ' is-entering');
      next.innerHTML = (S[state.screen] || S.start)(true, state.arg);
      if (old) old.remove();
      v.appendChild(next);
      // lock screen hides the nav bar
      var nav = $('.mui__nav', phone);
      if (state.screen === 'lock' && nav) nav.remove();
      if (state.screen !== 'lock' && !nav) mui().insertAdjacentHTML('beforeend', navBar(true));
      syncDense();
      tickClock();
      if (state.screen === 'music') startPlayback();
      host.dispatchEvent(new CustomEvent('sim:screen', { detail: { screen: state.screen } }));
      var label = $('[data-sim-label]');
      if (label) label.textContent = state.screen === 'contact' ? 'people · profile' : state.screen;
    }

    function go(target) {
      var name = target, arg = null;
      if (target.indexOf(':') > -1) { name = target.split(':')[0]; arg = parseInt(target.split(':')[1], 10); }
      if (!S[name]) name = 'soon';
      if (state.screen !== name || state.arg !== arg) state.stack.push({ s: state.screen, a: state.arg });
      state.screen = name; state.arg = arg;
      render();
    }
    function back() {
      var p = state.stack.pop();
      state.screen = p ? p.s : 'start';
      state.arg = p ? p.a : null;
      if (state.screen === 'lock') state.screen = 'start';
      render();
    }
    function home() { state.stack = []; state.screen = 'start'; state.arg = null; render(); }

    function syncDense() {
      var g = $('.mui-start__grid', phone);
      if (g) g.style.setProperty('grid-template-columns', state.dense ? 'repeat(6,1fr)' : 'repeat(4,1fr)');
      mui().classList.toggle('mui--light', state.light);
    }

    function tickClock() {
      $$('[data-sim-time]', phone).forEach(function (el) { el.textContent = now(); });
      var d = new Date();
      $$('[data-sim-date-full]', phone).forEach(function (el) { el.textContent = today(); });
      $$('[data-sim-day]', phone).forEach(function (el) { el.textContent = d.toLocaleDateString(undefined, { weekday: 'short' }); });
      $$('[data-sim-date]', phone).forEach(function (el) { el.textContent = String(d.getDate()); });
    }

    /* playback ---------------------------------------------------------- */
    function fmtTime(s) { return Math.floor(s / 60) + ':' + pad(Math.floor(s % 60)); }
    function trackLen(t) { var p = TRACKS[t].len.split(':'); return (+p[0]) * 60 + (+p[1]); }
    function paintPlayback() {
      var bar = $('[data-sim-bar]', phone); if (!bar) return;
      var len = trackLen(state.track);
      var pct = Math.min(100, (state.elapsed / len) * 100);
      bar.style.setProperty('--p', pct.toFixed(2) + '%');
      var e = $('[data-sim-elapsed]', phone); if (e) e.textContent = fmtTime(state.elapsed);
      var l = $('[data-sim-len]', phone); if (l) l.textContent = TRACKS[state.track].len;
    }
    function paintTrack() {
      var t = TRACKS[state.track];
      var a = $('[data-sim-art]', phone); if (a) a.src = t.art;
      var ti = $('[data-sim-title]', phone); if (ti) ti.textContent = t.t;
      var by = $('[data-sim-by]', phone); if (by) by.textContent = t.a;
      paintPlayback();
    }
    function startPlayback() {
      paintTrack();
      clearInterval(timer);
      if (M.reduced && M.reduced()) return;
      timer = setInterval(function () {
        if (!state.playing || state.screen !== 'music') return;
        state.elapsed += 1;
        if (state.elapsed > trackLen(state.track)) { state.elapsed = 0; state.track = (state.track + 1) % TRACKS.length; paintTrack(); }
        paintPlayback();
      }, 1000);
    }

    /* interaction -------------------------------------------------------- */
    host.addEventListener('click', function (e) {
      var nav = e.target.closest('[data-nav]');
      if (nav) {
        if (nav.dataset.nav === 'back') back();
        else if (nav.dataset.nav === 'home') home();
        else go('search');
        return;
      }
      var goBtn = e.target.closest('[data-go]');
      if (goBtn) { go(goBtn.dataset.go); return; }

      var tg = e.target.closest('[data-sim-toggle]');
      if (tg) {
        var on = tg.getAttribute('aria-pressed') !== 'true';
        tg.setAttribute('aria-pressed', String(on));
        if (tg.dataset.simToggle === 'light') state.light = on;
        if (tg.dataset.simToggle === 'dense') state.dense = on;
        syncDense();
        return;
      }
      if (e.target.closest('[data-sim-play]')) {
        state.playing = !state.playing;
        var b = e.target.closest('[data-sim-play]');
        b.innerHTML = ico(state.playing ? 'pause' : 'play');
        b.setAttribute('aria-label', state.playing ? 'Pause' : 'Play');
        return;
      }
      if (e.target.closest('[data-sim-next]')) { state.track = (state.track + 1) % TRACKS.length; state.elapsed = 0; paintTrack(); return; }
      if (e.target.closest('[data-sim-prev]')) { state.track = (state.track - 1 + TRACKS.length) % TRACKS.length; state.elapsed = 0; paintTrack(); return; }
      if (state.screen === 'lock' && e.target.closest('.mui-lock')) home();
    });

    /* accent swatches inside settings mirror the site accent */
    document.addEventListener('metro:accent', function () {
      $$('[data-accent-set]', phone).forEach(function (b) {
        b.setAttribute('aria-pressed', String(b.dataset.accentSet === document.documentElement.getAttribute('data-accent')));
      });
    });

    /* swipe -------------------------------------------------------------- */
    var sx = 0, sy = 0, tracking = false;
    phone.addEventListener('pointerdown', function (e) { tracking = true; sx = e.clientX; sy = e.clientY; });
    phone.addEventListener('pointerup', function (e) {
      if (!tracking) return; tracking = false;
      var dx = e.clientX - sx, dy = e.clientY - sy;
      if (Math.abs(dx) < 42 && Math.abs(dy) < 42) return;
      if (Math.abs(dy) > Math.abs(dx)) {
        if (dy < -42 && state.screen === 'lock') home();
        return;
      }
      if (dx < 0) { if (state.screen === 'start') go('apps'); }
      else { if (state.screen === 'apps') home(); else if (state.screen !== 'start' && state.screen !== 'lock') back(); }
    });

    /* keyboard ----------------------------------------------------------- */
    host.setAttribute('tabindex', '0');
    host.addEventListener('keydown', function (e) {
      var k = e.key;
      if (k === 'Escape') { e.preventDefault(); back(); }
      else if (k === 'Home') { e.preventDefault(); home(); }
      else if (k === 'ArrowLeft') { e.preventDefault(); if (state.screen === 'apps') home(); else back(); }
      else if (k === 'ArrowRight') { e.preventDefault(); if (state.screen === 'start') go('apps'); }
      else if (k === 'ArrowUp' && state.screen === 'lock') { e.preventDefault(); home(); }
    });

    /* external shortcuts (buttons outside the phone) ---------------------- */
    $$('[data-sim-jump]').forEach(function (b) {
      b.addEventListener('click', function () { go(b.dataset.simJump); host.focus({ preventScroll: true }); });
    });

    setInterval(tickClock, 20000);
    render();
  }

  /* ======================================================================
     Image cycling inside tiles (photos)
     ====================================================================== */
  function cycleTileImages() {
    if (M.reduced && M.reduced()) return;
    $$('[data-cycle-img]').forEach(function (img) {
      var list; try { list = JSON.parse(img.dataset.cycleImg); } catch (e) { return; }
      var i = 0;
      setInterval(function () {
        i = (i + 1) % list.length;
        img.style.opacity = '0';
        setTimeout(function () { img.src = list[i]; img.style.opacity = ''; }, 200);
      }, 4200 + Math.random() * 1600);
      img.style.transition = 'opacity 200ms linear';
    });
  }

  function init() {
    mountStatic();
    mountSim();
    cycleTileImages();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
