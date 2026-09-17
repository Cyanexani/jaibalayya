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
  // a partial may include another partial, so keep expanding until none are
  // left rather than replacing once
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
  }

  const stamp = new Date().toLocaleTimeString();
  console.log(`[${stamp}] built ${count} page${count === 1 ? '' : 's'}`);
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
