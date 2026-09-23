/* Contacts shared by People, Phone, Messaging and Mail. Starts with a few
   made-up people (555-01xx numbers and example.com addresses are reserved
   for fiction); anything you add or edit stays in this browser. */

import { emit } from './util.js';
import { store } from './store.js';
import { CONTACTS, THREAD } from './demo.js';

const uid = () => `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

function seed() {
  return CONTACTS.map((c, i) => ({
    id: `demo${i}`,
    name: c.name,
    phone: `+1 555 01${String(10 + i).padStart(2, '0')}`,
    email: `${c.name.split(' ')[0].toLowerCase()}@example.com`,
    color: c.color,
    status: c.status,
    favourite: i < 3,
    demo: true
  }));
}

export function contacts() {
  let list = store.get('contacts');
  if (!list) { list = seed(); store.set('contacts', list); }
  return [...list].sort((a, b) => a.name.localeCompare(b.name));
}
export const contact = (id) => contacts().find((c) => c.id === id) || null;
export const byPhone = (num) => contacts().find((c) => c.phone && c.phone.replace(/\D/g, '').endsWith(num.replace(/\D/g, '').slice(-7))) || null;

export function saveContact(c) {
  const list = contacts().filter((x) => x.id !== c.id);
  const rec = { ...c, id: c.id || uid(), color: c.color || '#1a68e0' };
  list.push(rec);
  store.set('contacts', list);
  emit('contacts');
  return rec;
}
export function removeContact(id) {
  store.set('contacts', contacts().filter((c) => c.id !== id));
  emit('contacts');
}

export const initials = (name = '?') => name.trim().split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase() || '?';

/* call log (Phone) */
export function calls() {
  let list = store.get('calls');
  if (!list) {
    const now = Date.now();
    const c = contacts();
    list = [
      { id: 'k1', who: c[0]?.id, number: c[0]?.phone, kind: 'missed', at: now - 3.2 * 3600e3 },
      { id: 'k2', who: c[5]?.id, number: c[5]?.phone, kind: 'outgoing', at: now - 26 * 3600e3, length: 312 },
      { id: 'k3', who: c[2]?.id, number: c[2]?.phone, kind: 'incoming', at: now - 50 * 3600e3, length: 95 }
    ];
    store.set('calls', list);
  }
  return [...list].sort((a, b) => b.at - a.at);
}
export function logCall(entry) {
  store.set('calls', [{ id: uid(), at: Date.now(), ...entry }, ...calls()].slice(0, 100));
  emit('calls');
}
export function markSeen() {
  store.set('calls', calls().map((k) => ({ ...k, seen: true })));
  emit('calls-seen'); // badge only; the history itself hasn't changed
}

/* conversations (Messaging, and "reply" from an incoming call) */
export function threads() {
  let t = store.get('threads');
  if (!t) {
    const rohan = contacts().find((c) => c.name === THREAD.with);
    const today = new Date().toISOString().slice(0, 10);
    t = rohan ? { [rohan.id]: THREAD.messages.map((m, i) => ({ id: `m${i}`, me: m.me, text: m.text, at: new Date(`${today}T${m.at}`).getTime() })) } : {};
    store.set('threads', t);
  }
  return t;
}
export function addMessage(contactId, msg) {
  const t = threads();
  t[contactId] = [...(t[contactId] || []), { id: `m${Date.now()}${Math.random().toString(36).slice(2, 5)}`, at: Date.now(), ...msg }];
  store.set('threads', t);
  emit('threads');
}
