// SPDX-License-Identifier: Apache-2.0
// Loopback-only example server; never expose repository metadata or arbitrary files.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {fileURLToPath} from 'node:url';
import {localPackage} from './lib/local-package.mjs';
import {logicalPath,samePhysicalPath,fingerprintFile,ownerRelativePath} from './lib/file-identity.mjs';
const root=fileURLToPath(new URL('..',import.meta.url));
const types={'.html':'text/html; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8','.png':'image/png','.json':'application/json; charset=utf-8','.ttf':'font/ttf','.woff2':'font/woff2','.otf':'font/otf','.md':'text/plain; charset=utf-8','.wasm':'application/wasm'};
export function createExampleServer(repository=root){
 return http.createServer((request,response)=>{
  const finish=(status,text)=>{response.writeHead(status,{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'});response.end(text);};
  if(!['GET','HEAD'].includes(request.method))return finish(405,'GET or HEAD required');
  let relative;
  try{relative=decodeURIComponent(new URL(request.url,'http://127.0.0.1').pathname).slice(1);if(!relative)relative='examples/resource-scene/index.html';logicalPath(relative);}catch{return finish(400,'Invalid path');}
  const dependency='packages/engine/node_modules/robust-predicates/';
  // The public example uses the same pinned owner through a short import-map alias.
  if(relative.startsWith('vendor/robust-predicates/'))relative=dependency+relative.slice('vendor/robust-predicates/'.length);
  // Only this example's generated manifest/artifact layout is exposed under work.
  const allowed=/^examples\/sequence-controls\/(?:index\.html|main\.mjs|selection\.mjs|fixture\.mjs)$/.test(relative)
   ||/^work\/sequence-controls\/run-[A-Za-z0-9]{6}\/(?:browser-config\.json|candidate\.json|build\/generations\/[a-f0-9]{64}\/manifest\.json|build\/blobs\/sha256\/[a-f0-9]{64})$/.test(relative)
   ||/^examples\/ui-data-panel\/(?:index\.html|main\.mjs|fixture\.mjs)$/.test(relative)
   ||/^examples\/paragraph-panel\/(?:index\.html|main\.mjs|README(?:\.zh-CN)?\.md|vendor\/(?:manifest\.json|runtime\/canvaskit\.(?:js|wasm)|fonts\/[A-Za-z0-9_.-]+\.(?:ttf|otf)))$/.test(relative)
   ||/^examples\/multi-pointer\/(?:index\.html|main\.mjs)$/.test(relative)
   ||/^examples\/resource-scene\/(?:[\w-]+\.(?:html|mjs)|assets\/[\w.-]+\.(?:png|woff2))$/.test(relative)
   ||/^packages\/(?:engine|runtime|contracts)\/dist\/[\w/.-]+\.js$/.test(relative)
   ||relative==='examples/canvas-text/assets/ahem.ttf'||relative==='tools/browser-png/assets/rgb-red-green.png'
   ||relative.startsWith(dependency)&&/^[\w/-]+\.js$/.test(relative.slice(dependency.length));
  if(!allowed)return finish(404,'Not served');
  try{
   let file;
   if(relative.startsWith(dependency)){
    const owner=localPackage(repository,path.join(repository,'node_modules/robust-predicates'),'robust-predicates','3.0.3');
    if(!samePhysicalPath(fs.realpathSync(path.join(repository,dependency)),owner))return finish(404,'Not served');
    file=path.join(owner,relative.slice(dependency.length));
    fingerprintFile(repository,ownerRelativePath(repository,file));
   }else{
    fingerprintFile(repository,relative);
    file=path.join(repository,relative);
   }
   const bytes=fs.readFileSync(file);
   response.writeHead(200,{'Content-Type':types[path.extname(file)]??'application/octet-stream','Content-Length':bytes.length,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
   response.end(request.method==='HEAD'?undefined:bytes);
  }catch{return finish(404,'Missing example file; run pnpm setup:dev.');}
 });
}
if(process.argv[1]&&samePhysicalPath(path.resolve(process.argv[1]),fileURLToPath(import.meta.url))){
 const args=process.argv.slice(2);if(args.length&&!(args.length===2&&args[0]==='--port'&&/^\d+$/.test(args[1])))throw Error('Usage: pnpm example:browser [--port 4173]');
 const port=args.length?Number(args[1]):4173;if(port<0||port>65535)throw Error('Invalid port');
 if(!fs.existsSync(path.join(root,'packages/engine/dist/index.js')))throw Error('Run pnpm setup:dev before opening the example.');
 const server=createExampleServer();server.on('error',error=>{console.error(error.message);process.exitCode=1;});
 server.listen(port,'127.0.0.1',()=>console.log('Open http://127.0.0.1:'+server.address().port+'/examples/resource-scene/index.html (Ctrl+C to stop)'));
}
