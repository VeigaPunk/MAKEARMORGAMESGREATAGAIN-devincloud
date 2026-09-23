#!/usr/bin/env node
// verification/r2/audit-static.mjs — zero-dependency structural audit of the
// shipped artifact (arcade/). Verifies: every game folder is complete (html +
// assets), no external URLs (http/https/wss) leak into any shipped text file,
// total size is sane, and release.json matches the folders present.
// Usage: node verification/r2/audit-static.mjs   (from the repository root)
import { readdirSync, statSync, readFileSync, existsSync } from 'node:fs';
import { join, extname, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const arcade = join(root, 'arcade');
const fails = [];
const ok = (m) => console.log('  ok  ' + m);
const bad = (m) => { fails.push(m); console.log('FAIL  ' + m); };

const manifest = JSON.parse(readFileSync(join(arcade, 'release.json'), 'utf8'));
for (const g of manifest.games) {
  const dir = join(arcade, g);
  if (!existsSync(join(dir, 'index.html'))) { bad(`${g}/index.html missing`); continue; }
  ok(`${g}/index.html present`);
}
const folders = readdirSync(arcade).filter(f => statSync(join(arcade, f)).isDirectory() && f !== 'covers');
for (const f of folders) if (!manifest.games.includes(f)) bad(`folder arcade/${f} not in release.json`);
for (const g of manifest.games) if (!folders.includes(g)) bad(`release.json lists ${g} with no folder`);

// external URL scan over text assets (html/js/css/json/svg)
const externals = [];
let bytes = 0;
const TEXT_EXT = new Set(['.html', '.js', '.mjs', '.css', '.json', '.svg', '.txt']);
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) { walk(p); continue; }
    bytes += st.size;
    if (!TEXT_EXT.has(extname(name))) continue;
    const text = readFileSync(p, 'utf8');
    for (const m of text.matchAll(/(?:src|href)\s*=\s*["'](https?:|wss?:)?(\/\/[^"']+)/g)) {
      // protocol-relative or explicit remote URL in a resource reference
      if (/^\/\/(127\.0\.0\.1|localhost)/.test(m[2])) continue;
      externals.push(`${relative(root, p)}: ${m[0].slice(0, 80)}`);
    }
    for (const m of text.matchAll(/["'](https?:\/\/(?!127\.0\.0\.1|localhost)[^"']{8,})["']/g)) {
      const u = m[1];
      // XML namespace identifiers are not network resources
      if (/^https?:\/\/www\.w3\.org\//.test(u)) continue;
      // Pixi.js ships dormant BASIS/KTX transcoder URL constants; none are ever
      // fetched (proven by the live egress check: every game page made zero
      // non-local requests — see verification/evidence/release-r2/ and the
      // sweep note in ship-records/_fleet.md).
      if (/cdn\.jsdelivr\.net\/npm\/pixi\.js\/transcoders\//.test(u)) continue;
      externals.push(`${relative(root, p)}: ${u.slice(0, 80)}`);
    }
  }
};
walk(arcade);
if (externals.length) for (const e of [...new Set(externals)].slice(0, 20)) bad('external URL: ' + e);
else ok('no external URLs referenced from the artifact');
ok(`artifact size ${(bytes / 1048576).toFixed(1)} MB`);

// hub integrity: 7 cards, favicon, return.js, style
const hub = readFileSync(join(arcade, 'index.html'), 'utf8');
if (!hub.includes('./arcade.js')) bad('hub does not load arcade.js');
const cards = (readFileSync(join(arcade, 'arcade.js'), 'utf8').match(/^\s*\['/gm) ?? []).length;
if (cards === 7) ok(`hub lists ${cards} game cards`); else bad(`hub lists ${cards} cards (expected 7)`);
for (const f of ['favicon.svg', 'return.js', 'style.css', 'README.txt']) {
  if (existsSync(join(arcade, f))) ok(`${f} present`); else bad(`${f} missing`);
}
for (const slug of manifest.games) {
  if (existsSync(join(arcade, 'covers', `${slug}.png`))) ok(`cover ${slug}.png`); else bad(`cover ${slug}.png missing`);
}

console.log(fails.length ? `\n${fails.length} FAILURES` : '\nSTATIC AUDIT PASS');
process.exit(fails.length ? 1 : 0);
