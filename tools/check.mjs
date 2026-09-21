// Checks run before every deploy (and handy locally: `node tools/check.mjs`):
//   1. every app in the registry has content/apps/<id>.md with a ## history section
//   2. every local file referenced from index.html and the JS modules exists
//   3. every module imported by a module exists
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, normalize } from 'node:path';

let failed = 0;
const fail = (msg) => { console.error(`✗ ${msg}`); failed++; };

const registry = readFileSync('assets/os/js/registry.js', 'utf8');
const ids = [...registry.matchAll(/\bid: '([a-z0-9-]+)'/g)].map((m) => m[1]);
for (const id of ids) {
  const file = `content/apps/${id}.md`;
  if (!existsSync(file)) { fail(`${id}: missing ${file}`); continue; }
  if (!/^## history$/m.test(readFileSync(file, 'utf8'))) fail(`${id}: ${file} has no "## history" section`);
}
if (!existsSync('content/os.md')) fail('missing content/os.md');

const builtIds = [...registry.matchAll(/id: '([a-z0-9-]+)'[^}]*?built: true/g)].map((m) => m[1]);
for (const id of builtIds) if (!existsSync(`assets/os/js/apps/${id}.js`)) fail(`${id} is marked built but assets/os/js/apps/${id}.js is missing`);

const html = readFileSync('index.html', 'utf8');
for (const [, ref] of html.matchAll(/(?:href|src)="((?:assets|content)\/[^"#?]+)"/g)) {
  if (!existsSync(ref)) fail(`index.html references missing ${ref}`);
}

function walk(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}
for (const file of walk('assets/os/js').filter((f) => f.endsWith('.js'))) {
  const src = readFileSync(file, 'utf8');
  for (const [, spec] of src.matchAll(/(?:from|import\()\s*'(\.{1,2}\/[^'$]+)'/g)) {
    const target = normalize(join(dirname(file), spec));
    if (!existsSync(target)) fail(`${file} imports missing ${spec}`);
  }
  for (const [, ref] of src.matchAll(/'((?:assets)\/[^'${}]+\.(?:webp|jpg|png|svg))'/g)) {
    if (!existsSync(ref)) fail(`${file} references missing ${ref}`);
  }
}

// 4. the Store catalog parses, ids are unique, and entries have what they need
if (existsSync('store/catalog.json')) {
  try {
    const cat = JSON.parse(readFileSync('store/catalog.json', 'utf8'));
    for (const kind of ['wallpapers', 'tiles']) {
      const list = cat[kind] || [];
      const seen = new Set();
      for (const x of list) {
        if (!x.id || !x.name || !x.author) fail(`store/catalog.json: a ${kind} entry is missing id, name or author`);
        if (seen.has(x.id)) fail(`store/catalog.json: duplicate ${kind} id "${x.id}"`);
        seen.add(x.id);
        if (kind === 'wallpapers' && !x.css) fail(`store/catalog.json: wallpaper "${x.id}" needs css`);
        if (kind === 'tiles' && (!x.html || !x.color)) fail(`store/catalog.json: tile "${x.id}" needs html and color`);
      }
    }
  } catch (e) {
    fail(`store/catalog.json is not valid JSON: ${e.message}`);
  }
}

if (failed) { console.error(`\n${failed} problem(s).`); process.exit(1); }
console.log(`✓ ${ids.length} apps have notes; all referenced files and modules exist; the Store catalog is valid.`);
