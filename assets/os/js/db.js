/* On-device file storage (IndexedDB). Photos, videos, music, recordings,
   documents and imports all live here, in this browser only.
   A record: { id, kind, name, mime, size, created, modified, blob?, text?, meta? }
   kinds: photo | video | music | recording | document | other */

import { emit } from './util.js';

const DB_NAME = 'metro-os';
const VERSION = 1;
let dbp = null;

function open() {
  if (!dbp) {
    dbp = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('files')) {
          const s = db.createObjectStore('files', { keyPath: 'id' });
          s.createIndex('kind', 'kind');
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbp;
}

function run(mode, fn) {
  return open().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction('files', mode);
    const req = fn(tx.objectStore('files'));
    tx.oncomplete = () => resolve(req?.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  }));
}

const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const urls = new Map();

export const files = {
  async put(rec) {
    const now = Date.now();
    const r = { ...rec, id: rec.id || uid(), created: rec.created || now, modified: now };
    r.size = r.blob ? r.blob.size : new Blob([r.text || '']).size;
    await run('readwrite', (s) => s.put(r));
    if (urls.has(r.id) && rec.blob) { URL.revokeObjectURL(urls.get(r.id)); urls.delete(r.id); }
    emit('files', { id: r.id, kind: r.kind });
    return r;
  },
  get: (id) => run('readonly', (s) => s.get(id)),
  async list(kind) {
    const all = await run('readonly', (s) => (kind ? s.index('kind').getAll(kind) : s.getAll()));
    return (all || []).sort((a, b) => b.created - a.created);
  },
  async update(id, patch) {
    const r = await files.get(id);
    return r ? files.put({ ...r, ...patch }) : null;
  },
  async remove(id) {
    const r = await files.get(id);
    await run('readwrite', (s) => s.delete(id));
    if (urls.has(id)) { URL.revokeObjectURL(urls.get(id)); urls.delete(id); }
    emit('files', { id, kind: r?.kind, removed: true });
  }
};

/** An object URL for a record's blob, cached per record. */
export function blobUrl(rec) {
  if (!rec?.blob) return '';
  if (!urls.has(rec.id)) urls.set(rec.id, URL.createObjectURL(rec.blob));
  return urls.get(rec.id);
}

/** Save a record (or any blob/text) to the user's device. */
export function download(rec) {
  const blob = rec.blob || new Blob([rec.text || ''], { type: rec.mime || 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = rec.name || 'file';
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

export function kindOf(mime = '', name = '') {
  if (mime.startsWith('image/')) return 'photo';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'music';
  if (mime.startsWith('text/') || /\.(md|txt)$/i.test(name)) return 'document';
  return 'other';
}

export function bytes(n = 0) {
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${(n / 1024).toFixed(n < 10240 ? 1 : 0)} KB`;
  if (n < 1073741824) return `${(n / 1048576).toFixed(1)} MB`;
  return `${(n / 1073741824).toFixed(2)} GB`;
}

/** Let the user pick files from their device. */
export function pickFiles({ accept = '', multiple = true } = {}) {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.multiple = multiple;
    input.addEventListener('change', () => resolve([...(input.files || [])]), { once: true });
    input.addEventListener('cancel', () => resolve([]), { once: true });
    input.click();
  });
}
