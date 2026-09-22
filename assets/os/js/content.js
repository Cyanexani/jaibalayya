/* The notes behind every app live in plain files:
     content/os.md            Metro OS as a whole (hub app, companion panel)
     content/apps/<id>.md     one per app
   Each file has an optional front matter block and `## section` headings.
   The `## history` section lists versions as `### 0.1 · 2026-09-21 · headline`.
   Info pages, the companion panel, search and update notifications all read
   from here, so one edit to a file updates all of them. */

import { markdown, plain } from './markdown.js';
import { slug, emit } from './util.js';
import { APPS } from './registry.js';

const cache = new Map();
let osDoc = null;

function parse(id, text) {
  let meta = {};
  let body = text.replace(/\r/g, '');
  const fm = body.match(/^---\n([\s\S]*?)\n---\n?/);
  if (fm) {
    for (const line of fm[1].split('\n')) {
      const m = line.match(/^(\w[\w-]*):\s*(.*)$/);
      if (m) meta[m[1]] = m[2].trim();
    }
    body = body.slice(fm[0].length);
  }
  const sections = [];
  let cur = null;
  const intro = [];
  for (const line of body.split('\n')) {
    const m = line.match(/^##\s+(.+)$/);
    if (m) {
      cur = { title: m[1].trim(), id: slug(m[1]), src: [] };
      sections.push(cur);
    } else if (cur) cur.src.push(line);
    else intro.push(line);
  }
  for (const s of sections) {
    s.md = s.src.join('\n').trim();
    s.html = markdown(s.md);
    s.text = plain(s.md);
    delete s.src;
  }
  const history = sections.find((s) => s.id === 'history');
  const versions = [];
  if (history) {
    for (const m of history.md.matchAll(/^###\s+(.+)$/gm)) {
      const [version, date, ...rest] = m[1].split('·').map((x) => x.trim());
      versions.push({ version, date: date || '', title: rest.join(' · ') || '' });
    }
  }
  return { id, meta, intro: markdown(intro.join('\n')), sections, versions, draft: meta.status === 'draft' };
}

async function fetchDoc(id, url) {
  if (cache.has(id)) return cache.get(id);
  const p = fetch(url, { cache: 'no-cache' })
    .then((r) => (r.ok ? r.text() : Promise.reject(new Error(r.status))))
    .then((t) => parse(id, t))
    .catch(() => parse(id, `---\nstatus: missing\n---\n## overview\nThe notes for this app haven't been written yet.`));
  cache.set(id, p);
  return p;
}

export const loadApp = (id) => fetchDoc(id, `content/apps/${id}.md`);
export async function loadOS() {
  const doc = await fetchDoc('os', 'content/os.md');
  if (!osDoc) { osDoc = doc; emit('os-content'); }
  return doc;
}
export const loadAll = () => Promise.all(APPS.map((a) => loadApp(a.id)));

/** Latest OS release, synchronously, once os.md has loaded (for live tiles). */
export function latestRelease() {
  return osDoc?.versions?.[0] || null;
}

export function section(doc, id) {
  return doc.sections.find((s) => s.id === id) || null;
}

/* ---------- search ---------- */
export async function searchNotes(q) {
  const query = q.trim().toLowerCase();
  if (query.length < 2) return [];
  const docs = [await loadOS(), ...(await loadAll())];
  const hits = [];
  for (const doc of docs) {
    for (const s of doc.sections) {
      const at = s.text.toLowerCase().indexOf(query);
      const inTitle = s.title.toLowerCase().includes(query);
      if (at < 0 && !inTitle) continue;
      const from = Math.max(0, at - 50);
      const snippet = at < 0 ? s.text.slice(0, 110) : (from ? '…' : '') + s.text.slice(from, at + query.length + 70) + '…';
      hits.push({ doc: doc.id, section: s.id, title: s.title, snippet, score: inTitle ? 2 : 1 });
    }
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, 30);
}

/* ---------- update notifications ---------- */
/** Compare each app's newest version with what this visitor has seen.
    First visit: remember everything quietly. Later visits: announce changes. */
export async function checkUpdates({ store, notify, byId }) {
  const docs = await loadAll();
  const os = await loadOS();
  const seen = { ...store.get('seen') };
  const firstTime = Object.keys(seen).length === 0;
  const changes = [];
  for (const doc of [os, ...docs]) {
    const v = doc.versions[0];
    if (!v) continue;
    if (!firstTime && seen[doc.id] !== v.version) changes.push({ doc, v });
    seen[doc.id] = v.version;
  }
  store.set('seen', seen);
  const osChange = changes.find((c) => c.doc.id === 'os');
  const appChanges = changes.filter((c) => c.doc.id !== 'os');
  // A few app updates get one notification each; a big release gets one summary.
  if (appChanges.length > 3) {
    const names = appChanges.map((c) => byId(c.doc.id)?.name).filter(Boolean);
    notify({
      app: 'hub', level: 'quiet',
      title: `${names.length} apps updated`,
      body: `${names.slice(0, 4).join(', ')}${names.length > 4 ? ` and ${names.length - 4} more` : ''}`,
      route: '#/app/hub/whats-new'
    });
  } else {
    for (const { doc, v } of appChanges) {
      const app = byId(doc.id);
      notify({ app: app?.id || 'hub', level: 'quiet', title: `${app?.name || doc.id} ${v.version}`, body: v.title || 'See what changed', route: `#/info/${doc.id}/whats-new` });
    }
  }
  if (osChange) {
    notify({ app: 'hub', level: 'quiet', title: `Metro OS ${osChange.v.version}`, body: osChange.v.title || 'See what changed', route: '#/app/hub/whats-new' });
  }
}
