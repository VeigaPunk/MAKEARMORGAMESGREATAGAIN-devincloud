// verification/r2/drive-covers.mjs — renders the furoshiki cover set from
// covers.html (the authored art source) via the browser canvas and writes
// the PNGs into arcade/covers/. Re-runnable: node verification/r2/drive-covers.mjs
import { connect } from './cdp.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const src = new URL(`file:///${join(repo, 'verification', 'r2', 'covers.html').replace(/\\/g, '/')}`).href.replace('file:///C:', 'file:///C:');
const c = await connect('');
await c.send('Page.navigate', { url: src });
await new Promise(r => setTimeout(r, 1200));
const slugs = await c.eval('window.__slugs()');
if (!Array.isArray(slugs) || !slugs.length) throw new Error('cover generator not loaded');
for (const slug of slugs) {
  const dataUrl = await c.eval(`window.__cover('${slug}')`);
  const b64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  const out = join(repo, 'arcade', 'covers', `${slug}.png`);
  writeFileSync(out, Buffer.from(b64, 'base64'));
  console.log(`${slug}: ${(b64.length / 1024).toFixed(0)} KB → ${out.split('\\').pop()}`);
}
await c.close();
console.log('COVERS RENDERED');
process.exit(0);
