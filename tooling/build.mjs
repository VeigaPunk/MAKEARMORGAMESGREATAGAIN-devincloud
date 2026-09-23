import { spawnSync } from 'node:child_process';
import { cp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root=path.resolve(fileURLToPath(new URL('..',import.meta.url)));
const workspace=path.join(root,'MAGA-everything/02-code/armor-games');
const apps=['boxhead','impossible','burger-tycoon','chicken-invaders','chicken-invaders-original','swords-and-sandals'];
const build=spawnSync('npm',['run','build','--workspaces','--if-present','--','--base=./'],{cwd:workspace,stdio:'inherit',shell:process.platform==='win32'});
if(build.status!==0)process.exit(build.status??1);
// The playable collection lives in arcade/ and is committed: rebuilding refreshes it in place.
const out=path.join(root,'arcade');
for(const app of [...apps,'hardest'])await rm(path.join(out,app),{recursive:true,force:true});
for(const app of apps)await cp(path.join(workspace,'apps',app,'dist'),path.join(out,app),{recursive:true});
await mkdir(path.join(out,'hardest'),{recursive:true});
for(const name of ['index.html','engine.js','game.js','save.js','manifest.js','pars.js','levels'])await cp(path.join(root,'hardest',name),path.join(out,'hardest',name),{recursive:true});
const games=[...apps,'hardest'];
for(const game of games){
 const file=path.join(out,game,'index.html');let html=await readFile(file,'utf8');
 html=html.replace('</head>','<link rel="icon" href="../favicon.svg"><script defer src="../return.js"></script></head>');
 await writeFile(file,html);
}
await writeFile(path.join(out,'release.json'),JSON.stringify({version:'1.1.0',distribution:'private',games},null,2)+'\n');
console.log(`\nBuilt ${games.length} games into arcade/ (committed artifact). Serve the arcade/ folder to play.`);
