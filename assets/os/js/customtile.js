/* Renders a custom live tile (from Live Tile Studio or the Store) inside a
   sandboxed frame. The sandbox allows the tile's own scripts but gives it
   no access to Metro OS, its storage or your data. */

const esc = (s) => String(s).replace(/</g, '\\3c ');

export function tileDoc({ html = '', css = '' }, size = 'm') {
  const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#1ba1e2';
  return `<!doctype html><html data-size="${size}"><head><meta charset="utf-8"><style>
html,body{margin:0;height:100%;overflow:hidden;background:transparent;color:#fff;
font-family:"Noto Sans","Segoe UI",system-ui,sans-serif;-webkit-font-smoothing:antialiased}
:root{--accent:${esc(accent)}}
*{box-sizing:border-box}
${css}
</style></head><body>${html}</body></html>`;
}

export function tileFrame(t, size) {
  const f = document.createElement('iframe');
  f.setAttribute('sandbox', 'allow-scripts');
  f.setAttribute('title', t.name || 'Custom tile');
  f.setAttribute('tabindex', '-1');
  f.srcdoc = tileDoc(t, size);
  f.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;border:0;pointer-events:none;background:transparent';
  return f;
}
