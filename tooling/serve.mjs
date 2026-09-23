import http from 'node:http';
import path from 'node:path';
import { readFile, stat } from 'node:fs/promises';
const root=path.resolve('arcade'),port=Number(process.env.PORT??4173),host=process.env.HOST??'127.0.0.1';
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.json':'application/json; charset=utf-8','.woff2':'font/woff2'};
try{await stat(path.join(root,'index.html'));}catch{console.error('No arcade found. Run node tooling/build.mjs first.');process.exit(1);}
const server=http.createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://localhost');const filename=decodeURIComponent(url.pathname);
  let file=path.resolve(root,'.'+filename);
  if(!file.startsWith(root+path.sep)&&file!==root){res.writeHead(403);return res.end('Forbidden');}
  const info=await stat(file);
  if(info.isDirectory()){
   if(!url.pathname.endsWith('/')){res.writeHead(302,{Location:url.pathname+'/'+url.search});return res.end();}
   file=path.join(file,'index.html');
  }
  const bytes=await readFile(file);
  res.writeHead(200,{'Content-Type':types[path.extname(file)]??'application/octet-stream','Content-Length':bytes.length,'X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin','Cache-Control':'no-cache'});
  res.end(req.method==='HEAD'?undefined:bytes);
 }catch{res.writeHead(404,{'Content-Type':'text/plain'});res.end('Not found');}
});
server.listen(port,host,()=>console.log(`Arcade ready: http://${host}:${port} (serving arcade/)`));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>process.exit(0)));
