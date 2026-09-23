#!/usr/bin/env node
/**
 * Ship build — bundles each monorepo app into a self-contained page under
 * games/<slug>/ that runs from file:// with zero network, zero install.
 *
 * Dev tooling only (needs the monorepo's node_modules: esbuild via vite's
 * devDependencies). The produced pages have no build step for the player:
 * one index.html per game with the IIFE bundle inlined, art inlined as data
 * URIs (pixi Assets.load) or copied alongside (relative <img> refs).
 *
 * Usage:  node tools/ship-build.mjs [--only <slug>]
 */
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, readdirSync, rmSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const MONO = join(ROOT, 'MAGA-everything', '02-code', 'armor-games');
const GAMES = join(ROOT, 'games');
const require = createRequire(join(MONO, 'package.json'));
const esbuild = require('esbuild');

/** shipped identity per app — original evocations, dev badge stripped */
const APPS = [
  { slug: 'boxhead', app: 'apps/boxhead', title: 'BLOCKHEAD: ARENA NIGHTS' },
  { slug: 'impossible', app: 'apps/impossible', title: 'IMPOSSIBLE RUN' },
  { slug: 'burger-tycoon', app: 'apps/burger-tycoon', title: 'BURGER TYCOON' },
  { slug: 'chicken-invaders', app: 'apps/chicken-invaders', title: 'GALACTIC CHICKEN: NEXT WAVE' },
  { slug: 'cluck-horizon', app: 'apps/chicken-invaders-original', title: 'CLUCK HORIZON' },
  { slug: 'swords-and-sandals', app: 'apps/swords-and-sandals', title: 'SANDALS OF STEEL: REIGN OF THE COLOSSUS' },
];

const onlyIdx = process.argv.indexOf('--only');
const only = onlyIdx >= 0 ? process.argv[onlyIdx + 1] : null;

function inlineArt(js, appDir) {
  // pixi Assets.load('/art/x.svg') fetches — file:// blocks fetch. Inline as
  // base64 data URIs (Image-element loading accepts data URIs without fetch).
  const artDir = join(MONO, appDir, 'public', 'art');
  if (!existsSync(artDir)) return js;
  for (const f of readdirSync(artDir)) {
    if (!f.endsWith('.svg')) continue;
    const b64 = readFileSync(join(artDir, f)).toString('base64');
    js = js.split(`'/art/${f}'`).join(`'data:image/svg+xml;base64,${b64}'`);
    js = js.split(`"/art/${f}"`).join(`"data:image/svg+xml;base64,${b64}"`);
  }
  return js;
}

function transformHtml(html, title, js) {
  let out = html;
  out = out.replace(/<script type="importmap">[\s\S]*?<\/script>\s*/g, '');
  out = out.replace(/<script type="module"[^>]*src="[^"]*"[^>]*><\/script>\s*/g, '');
  // dev-only rights badge (kept in dev pages; shipped pages carry a footer note)
  out = out.replace(/<div class="badge">[\s\S]*?<\/div>\s*/g, '');
  out = out.replace(/\s*\.badge\s*\{[^}]*\}\s*/g, '\n');
  out = out.replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`);
  const script = `<script>\n${js}\n</script>\n`;
  out = out.replace('</body>', `${script}</body>`);
  return out;
}

function copyPublic(appDir, dest) {
  const pub = join(MONO, appDir, 'public');
  if (!existsSync(pub)) return;
  for (const entry of readdirSync(pub, { withFileTypes: true })) {
    if (entry.isDirectory() || entry.name === 'vendor') continue; // pixi is bundled
    copyFileSync(join(pub, entry.name), join(dest, entry.name));
  }
}

let built = 0;
for (const cfg of APPS) {
  if (only && cfg.slug !== only) continue;
  const appDir = join(MONO, cfg.app);
  const dest = join(GAMES, cfg.slug);
  mkdirSync(dest, { recursive: true });
  rmSync(join(dest, 'levels'), { recursive: true, force: true });

  const result = await esbuild.build({
    entryPoints: [join(appDir, 'src', 'main.ts')],
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: 'es2020',
    write: false,
    minify: false,
    legalComments: 'none',
    sourcemap: false,
    define: { 'process.env.NODE_ENV': '"production"' },
    logLevel: 'warning',
  });
  let js = result.outputFiles[0].text;
  js = inlineArt(js, cfg.app);
  const html = readFileSync(join(appDir, 'index.html'), 'utf8');
  const outHtml = transformHtml(html, cfg.title, js);
  writeFileSync(join(dest, 'index.html'), outHtml);
  copyPublic(cfg.app, dest);
  built += 1;
  console.log(`${cfg.slug}: ${(outHtml.length / 1024).toFixed(0)} KB html`);
}

// hardest: zero-dependency classic-script tree, copied verbatim (retitle only)
if (!only || only === 'hardest') {
  const dest = join(GAMES, 'hardest');
  mkdirSync(join(dest, 'levels'), { recursive: true });
  for (const f of ['engine.js', 'game.js', 'manifest.js', 'pars.js']) {
    copyFileSync(join(ROOT, 'hardest', f), join(dest, f));
  }
  const html = readFileSync(join(ROOT, 'hardest', 'index.html'), 'utf8')
    .replace(/<title>[^<]*<\/title>/, '<title>THE WORLD\u2019S CRUELEST GAME</title>');
  writeFileSync(join(dest, 'index.html'), html);
  for (const f of readdirSync(join(ROOT, 'hardest', 'levels'))) {
    copyFileSync(join(ROOT, 'hardest', 'levels', f), join(dest, 'levels', f));
  }
  built += 1;
  console.log('hardest: copied');
}

console.log(`ship build done: ${built} game${built === 1 ? '' : 's'}`);
