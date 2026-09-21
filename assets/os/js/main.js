/* Boot: theme → shell → lock screen (unless opened on a deep link) →
   router. Then, when idle, check the notes for new versions. */

import { initTheme } from './theme.js';
import { setFull } from './fullscreen.js';
import { h } from './util.js';
import { createShell } from './shell.js';
import * as router from './router.js';
import { store } from './store.js';
import { loadOS, checkUpdates } from './content.js';
import { notify } from './notify.js';
import { byId } from './registry.js';
import { initClockService } from './clockservice.js';
import { refreshSoon } from './weather.js';

initTheme();
const shell = createShell(document.getElementById('device'));
loadOS();
initClockService(shell.os);

// "full screen" beside the framed phone (shown from tablet width up).
const fsBtn = h('button', { class: 'stage__fs', type: 'button', title: 'Full screen (F)', onclick: () => setFull(true) },
  h('i', { class: 'fa-solid fa-expand', 'aria-hidden': 'true' }), 'full screen');
document.getElementById('stage').append(fsBtn);

const deepLink = router.current().hash !== '#/';
const visits = (store.get('visits') || 0) + 1;
store.set('visits', visits);
const firstVisit = visits === 1;

if (!deepLink && store.get('lock.onOpen')) shell.lock.lock({ hint: visits <= 3 });
router.start();

if (firstVisit) {
  const welcome = () => {
    notify({ app: 'hub', title: 'Welcome to Metro OS.', body: 'Hold any tile for its shortcuts; hold and drag to move it.', route: '#/app/hub/gestures' });
    notify({ app: 'settings', title: 'Make it yours', body: 'Accent colour, wallpaper and lock screen.', route: '#/setup', quiet: true });
  };
  if (shell.lock.isLocked()) window.addEventListener('metro:unlocked', welcome, { once: true });
  else setTimeout(welcome, 900);
}

const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 2000));
idle(() => { checkUpdates({ store, notify, byId }); refreshSoon(); });
