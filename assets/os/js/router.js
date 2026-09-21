/* Hash routing with direction. Every screen in the OS has a link:
     #/               start
     #/apps           app list
     #/app/<id>/...   an app (and its sub-pages)
     #/info/<id>/...  an app's notes: overview, what's new, improved, …
     #/setup          optional first-run setup
   history.state carries an index so we know whether a change went
   forward (turnstile in) or back (turnstile out). */

let index = 0;
const listeners = new Set();

export function parse(hash = location.hash) {
  const path = decodeURIComponent(hash.replace(/^#\/?/, '')).split('?')[0];
  const parts = path.split('/').filter(Boolean);
  return { hash: '#/' + parts.join('/'), parts };
}

export const current = () => parse();

function dispatch(dir) {
  const route = parse();
  for (const fn of listeners) fn(route, dir);
}

export function onRoute(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function go(hash, { replace = false } = {}) {
  const target = parse(hash).hash;
  if (target === parse().hash && !replace) return;
  if (replace) {
    history.replaceState({ i: index }, '', target);
    dispatch(0);
  } else {
    index += 1;
    history.pushState({ i: index }, '', target);
    dispatch(1);
  }
}

export function back() {
  if (index > 0) history.back();
  else if (parse().hash !== '#/') go('#/', { replace: true });
}

export const canGoBack = () => index > 0;

export function start() {
  const route = parse();
  // A deep link keeps start underneath it, so "back" lands somewhere sensible.
  if (route.hash !== '#/') {
    history.replaceState({ i: 0 }, '', '#/');
    index = 1;
    history.pushState({ i: 1 }, '', route.hash);
  } else {
    history.replaceState({ i: 0 }, '', '#/');
    index = 0;
  }

  window.addEventListener('popstate', (e) => {
    const i = e.state?.i;
    if (typeof i !== 'number') {
      // typed or clicked a plain #link: treat it as a forward step
      index += 1;
      history.replaceState({ i: index }, '', parse().hash);
      dispatch(1);
      return;
    }
    const dir = i > index ? 1 : i < index ? -1 : 0;
    index = i;
    dispatch(dir);
  });

  // In-page links like <a href="#/info/music"> go through the router.
  document.addEventListener('click', (e) => {
    const a = e.target.closest?.('a[href^="#/"]');
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    go(a.getAttribute('href'));
  });

  dispatch(0);
}
