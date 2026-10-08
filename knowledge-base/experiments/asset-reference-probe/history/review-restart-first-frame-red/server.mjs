import http from 'node:http';
import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import crypto from 'node:crypto';
const root=fileURLToPath(new URL('.',import.meta.url));
const evidence=path.resolve(root,'../../evidence');
export const runToken=crypto.randomBytes(24).toString('hex');
const sources=JSON.parse(await readFile(path.join(root,'sources.json'),'utf8'));
const allowed=new Set(['index.html','probe.js','reference-chain.mjs','ui-pass.mjs','integration-tests.mjs','demo-controller.mjs','lifecycle-tests.mjs','sources.json',...sources.files.map(x=>x.path)]);
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json','.gltf':'model/gltf+json'};
export const server=http.createServer(async(req,res)=>{
  try {
    const url=new URL(req.url,'http://127.0.0.1');
    if(req.method==='POST'&&url.pathname==='/report'){
      if(req.headers['x-run-token']!==runToken){res.writeHead(403).end();return;}
      const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>256000){res.writeHead(413).end();return;}chunks.push(chunk);}
      const report=JSON.parse(Buffer.concat(chunks).toString('utf8'));
      if(!report.runId||!report.counts||!Array.isArray(report.results)){res.writeHead(400).end();return;}
      await mkdir(evidence,{recursive:true});const target=path.join(evidence,'asset-reference-probe-results.json');
      try{await copyFile(target,path.join(evidence,`asset-reference-probe-results-preserved-${crypto.randomUUID()}.json`));}catch(e){if(e.code!=='ENOENT')throw e;}
      await writeFile(target,JSON.stringify(report,null,2)+'\n');res.writeHead(200).end('saved');return;
    }
    if(req.method!=='GET'){res.writeHead(405).end();return;}
    const relative=decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname).slice(1);
    if(!allowed.has(relative)){res.writeHead(404).end();return;}
    const data=await readFile(path.join(root,relative));res.writeHead(200,{'Content-Type':mime[path.extname(relative)]||'text/plain','Cache-Control':'no-store'}).end(data);
  }catch(e){res.writeHead(e.code==='ENOENT'?404:400).end('Request rejected');}
});
await new Promise(resolve=>server.listen(Number(process.env.ASSET_PROBE_PORT||0),'127.0.0.1',resolve));
export const port=server.address().port;
if(process.argv[1]===fileURLToPath(import.meta.url))console.log(`Local reference demo: http://127.0.0.1:${port}/`);
