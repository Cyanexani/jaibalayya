#!/usr/bin/env node
/**
 * Metro OS — static site builder.
 *
 * Zero dependencies. Assembles src/pages/*.html into the repository root using
 * src/layout.html plus the shared partials, so navigation, head and footer live
 * in exactly one place.
 *
 *   node tools/build.mjs          build every page
 *   node tools/build.mjs --watch  rebuild on change
 */
import { readFileSync, writeFileSync, readdirSync, statSync, watch } from 'node:fs';
import { join, basename, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');
const PAGES = join(SRC, 'pages');
const PARTIALS = join(SRC, 'partials');

const read = (p) => readFileSync(p, 'utf8');

function partials() {
  const map = {};
  for (const f of readdirSync(PARTIALS)) {
    if (f.endsWith('.html')) map[basename(f, '.html')] = read(join(PARTIALS, f));
  }
  return map;
}

function parseMeta(src) {
  const m = src.match(/^<!--meta\s*([\s\S]*?)-->\s*/);
  if (!m) return [{}, src];
  let meta = {};
  try { meta = JSON.parse(m[1]); }
  catch (e) { throw new Error('Invalid meta JSON: ' + e.message); }
  return [meta, src.slice(m[0].length)];
}

function expandPartials(html, parts, depth = 0) {
  // partials may include partials (the footer pulls in the experiments panel),
  // so keep expanding until none are left rather than replacing once
  if (depth > 6) throw new Error('Partial nesting too deep — is a partial including itself?');
  if (!/\{\{>\s*[\w-]+\s*\}\}/.test(html)) return html;
  return expandPartials(
    html.replace(/\{\{>\s*([\w-]+)\s*\}\}/g, (_, name) => {
      if (!(name in parts)) throw new Error(`Missing partial: ${name}`);
      return parts[name];
    }),
    parts,
    depth + 1
  );
}

/* ---------------------------------------------------------------------------
   Search index for the quick-jump experiment: every page plus every anchored
   section, generated here so the list can never drift from the pages.
   --------------------------------------------------------------------------- */
const ENTITIES = {
  '&mdash;': '—', '&ndash;': '–', '&nbsp;': ' ', '&amp;': '&', '&middot;': '·',
  '&ldquo;': '“', '&rdquo;': '”', '&rsquo;': '’', '&hellip;': '…', '&nearr;': '↗'
};

function plain(html) {
  let s = html.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '');
  for (const [ent, ch] of Object.entries(ENTITIES)) s = s.split(ent).join(ch);
  return s.replace(/\s+/g, ' ').trim();
}

function sectionsOf(content) {
  const out = [];
  const seen = new Set();
  const secRe = /<section([^>]*)>/gi;

  for (let m; (m = secRe.exec(content)); ) {
    const attrs = m[1];
    // page heads and call-to-action blocks are the page itself, not a place to jump to
    if (/class="[^"]*\b(phead|cta)\b/.test(attrs)) continue;
    // anchor on the section's own id where it has one, else on the heading it
    // is labelled by — both are real targets in the built page
    const id = (attrs.match(/\sid="([^"]+)"/) || [])[1] ||
               (attrs.match(/aria-labelledby="([^"]+)"/) || [])[1];
    if (!id || id === 'main' || seen.has(id)) continue;

    const after = content.slice(m.index, m.index + 4000);
    const head = after.match(/<h([234])[^>]*>([\s\S]*?)<\/h\1>/i);
    if (!head) continue;
    const title = plain(head[2]);
    if (!title || title.length > 70) continue;

    seen.add(id);
    out.push({ id, title });
  }
  return out;
}

function pageName(page, title) {
  if (page === 'home') return 'Home';
  const head = String(title).split('—')[0].trim();
  return head || page;
}

function applyCurrent(html, page) {
  // mark the active navigation entries for assistive tech and styling
  return html.replace(
    new RegExp(`(<a[^>]*data-nav-key="${page}")`, 'g'),
    '$1 aria-current="page"'
  );
}

function build() {
  const layout = read(join(SRC, 'layout.html'));
  const parts = partials();
  const files = readdirSync(PAGES).filter((f) => f.endsWith('.html'));
  let count = 0;
  const index = [];

  for (const file of files) {
    const [meta, content] = parseMeta(read(join(PAGES, file)));
    const page = meta.page || basename(file, '.html');
    let out = expandPartials(
      layout.replace(/\{\{content\}\}/g, () => content.trimEnd()),
      parts
    )
      .replace(/\{\{title\}\}/g, meta.title || 'Metro OS')
      .replace(/\{\{desc\}\}/g, meta.desc || '')
      .replace(/\{\{page\}\}/g, page);

    out = applyCurrent(out, page);
    writeFileSync(join(ROOT, file), out);
    count++;

    if (page !== '404') {
      index.push({
        name: pageName(page, meta.title || page),
        url: file,
        desc: (meta.desc || '').split('.')[0].trim(),
        sections: sectionsOf(content)
      });
    }
  }

  const order = ['index.html', 'experience.html', 'apps.html', 'gallery.html', 'roadmap.html', 'download.html'];
  index.sort((a, b) => {
    const ai = order.indexOf(a.url), bi = order.indexOf(b.url);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi) || a.name.localeCompare(b.name);
  });
  writeFileSync(join(ROOT, 'assets', 'search-index.json'), JSON.stringify(index));

  const stamp = new Date().toLocaleTimeString();
  const secs = index.reduce((n, p) => n + p.sections.length, 0);
  console.log(`[${stamp}] built ${count} page${count === 1 ? '' : 's'} · indexed ${index.length} pages, ${secs} sections`);
}

build();

if (process.argv.includes('--watch')) {
  console.log('watching src/ …');
  let t = null;
  for (const dir of [PAGES, PARTIALS, SRC]) {
    watch(dir, { recursive: false }, () => {
      clearTimeout(t);
      t = setTimeout(() => { try { build(); } catch (e) { console.error(e.message); } }, 60);
    });
  }
}
