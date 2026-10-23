// SPDX-License-Identifier: Apache-2.0
// Bounded public-example collector. It freezes built inputs and never builds.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { canonicalTextBytes, fingerprintFile, logicalPath, ownerRelativePath, physicalPathKey, samePhysicalPath } from './lib/file-identity.mjs';

const root=path.resolve(fileURLToPath(new URL('..',import.meta.url)));
const args=new Map(),named=new Set(['--playwright','--output']);
for(let index=2;index<process.argv.length;index+=2){
 const name=process.argv[index],value=process.argv[index+1];
 if(!named.has(name)||args.has(name)||!value||value.startsWith('--'))throw new TypeError('Usage: node tools/verify-multi-pointer.mjs --playwright <installed-module> --output <new-absolute-directory-outside-repository>');
 args.set(name,value);
}
if(args.size!==2)throw new TypeError('Both --playwright and --output are required.');
function directory(value){
 physicalPathKey(value);
 const absolute=path.resolve(value),state=fs.lstatSync(absolute);
 if(!state.isDirectory()||state.isSymbolicLink()||!samePhysicalPath(absolute,fs.realpathSync(absolute)))throw new TypeError('A canonical physical directory is required.');
 return absolute;
}
directory(root);
const pw=directory(args.get('--playwright'));
physicalPathKey(args.get('--output'));
const output=path.resolve(args.get('--output')),parent=directory(path.dirname(output));
logicalPath(path.basename(output));
let inside=samePhysicalPath(root,output);
try{ownerRelativePath(root,output);inside=true;}catch(error){if(!(error instanceof RangeError))throw error;}
if(inside)throw new TypeError('Output must be outside the repository.');
if(fs.readdirSync(parent).some(name=>process.platform==='win32'?name.toLowerCase()===path.basename(output).toLowerCase():name===path.basename(output)))throw new TypeError('Output already exists; evidence is never overwritten.');
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const pwManifest=fingerprintFile(pw,'package.json');
assert.equal(JSON.parse(fs.readFileSync(path.join(pw,'package.json'),'utf8')).version,'1.62.1','Installed Playwright must be 1.62.1.');
const pwEntry=fingerprintFile(pw,'index.mjs');
const html='examples/multi-pointer/index.html',main='examples/multi-pointer/main.mjs';
const aliases={
 '#egret-textured-frame-state':'/packages/engine/dist/internal/texturedFrameState.js',
 '#egret-pointer-input':'/packages/engine/dist/pointerInput.js',
 '@egret/engine':'/packages/engine/dist/index.js',
 '@egret/engine/input':'/packages/engine/dist/input.js',
 '@egret/engine/web':'/packages/engine/dist/web/index.js',
 '@egret/engine/web/pointer':'/packages/engine/dist/web/pointer.js',
 '@egret/runtime':'/packages/runtime/dist/index.js',
 '@egret/runtime/input':'/packages/runtime/dist/input/index.js',
 '@egret/contracts':'/packages/contracts/dist/index.js',
 '@egret/contracts/resources':'/packages/contracts/dist/resources/index.js'
};
const files=new Map(),sources=new Map(),inputBytes=new Map();let totalBytes=0;
function readPinned(file){
 logicalPath(file);
 if(inputBytes.has(file))return inputBytes.get(file);
 if(inputBytes.size>=1024)throw new RangeError('Collector input file limit exceeded.');
 const pin=fingerprintFile(root,file);
 if(pin.bytes>4*1024*1024||totalBytes+pin.bytes>64*1024*1024)throw new RangeError('Collector input byte limit exceeded.');
 const bytes=fs.readFileSync(path.join(root,file));
 assert.equal(bytes.length,pin.bytes);assert.equal(sha(bytes),pin.sha256,'Input changed during read: '+file);
 const value={pin,bytes};inputBytes.set(file,value);totalBytes+=pin.bytes;return value;
}
// Restricted literal reader adapted from tools/verify-bitmap-resource-slot.mjs.
// Exact module/alias admission remains specific to this finite example closure.
function literalImports(file, source) {
  const tokens = [];
  let at = 0;
  while (at < source.length) {
    const char = source[at];
    if (/\s/.test(char)) { at++; continue; }
    if (source.slice(at, at + 2) === '//') { const end = source.indexOf('\n', at + 2); at = end < 0 ? source.length : end; continue; }
    if (source.slice(at, at + 2) === '/*') { const end = source.indexOf('*/', at + 2); if (end < 0) throw new Error('Unterminated comment'); at = end + 2; continue; }
    if (char === '"' || char === "'") {
      const quote = char, start = ++at;
      while (at < source.length && source[at] !== quote) { if (source[at] === '\\') at++; at++; }
      if (at >= source.length) throw new Error('Unterminated string');
      tokens.push({ kind: 'string', value: source.slice(start, at++) }); continue;
    }
    if (char === '`') {
      const start = ++at;
      while (at < source.length && source[at] !== '`') { if (source[at] === '\\') at++; at++; }
      if (at >= source.length || /\bimport\b/.test(source.slice(start, at))) throw new Error('Unsupported template import syntax');
      at++; tokens.push({ kind: 'template', value: '' }); continue;
    }
    if (char === '/' && ['(', '=', ':', ',', 'return', '[', '!', '?', '|', '&'].includes(tokens.at(-1)?.value)) {
      at++; let bracket = false, finished = false;
      while (at < source.length) {
        const next = source[at++];
        if (next === '\\') { at++; continue; }
        if (next === '[') bracket = true;
        if (next === ']') bracket = false;
        if (next === '/' && !bracket) { finished = true; break; }
      }
      if (!finished) throw new Error('Unterminated regular expression');
      while (/[A-Za-z]/.test(source[at] ?? '')) at++;
      tokens.push({ kind: 'regex', value: '' }); continue;
    }
    if (/[A-Za-z_$]/.test(char)) {
      const start = at++;
      while (/[A-Za-z0-9_$]/.test(source[at] ?? '')) at++;
      tokens.push({ kind: 'word', value: source.slice(start, at) }); continue;
    }
    tokens.push({ kind: 'punctuation', value: char }); at++;
  }
  const result = [];
  function literal(token) {
    if (token?.kind !== 'string' || !token.value || /[\\\s%?:\0]/.test(token.value)) throw new Error('Only simple literal imports are admitted');
    result.push(token.value);
  }
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index];
    if (token.kind !== 'word') continue;
    if (token.value === 'import') {
      const next = tokens[index + 1];
      if (next?.value === '.') continue;
      if (next?.value === '(') {
        literal(tokens[index + 2]);
        if (tokens[index + 3]?.value !== ')') throw new Error('Nonliteral/options dynamic import refused');
      } else if (next?.kind === 'string') literal(next);
      else {
        let end = index + 1;
        while (end < tokens.length && !['from', ';'].includes(tokens[end].value)) end++;
        if (tokens[end]?.value !== 'from') throw new Error('Unresolved static import');
        literal(tokens[end + 1]);
      }
    } else if (token.value === 'export' && ['{', '*'].includes(tokens[index + 1]?.value)) {
      let end = index + 1;
      while (end < tokens.length && !['from', ';'].includes(tokens[end].value)) end++;
      if (tokens[end]?.value === 'from') literal(tokens[end + 1]);
    }
  }
  return result;
}
function copy(file){
 logicalPath(file);if(files.has(file))return;
 assert.ok(file===html||file===main||/^packages\/(engine|runtime|contracts)\/dist\/[\w/.-]+\.js$/.test(file),'Unadmitted browser module: '+file);
 if(files.size>=512)throw new RangeError('Browser module closure exceeds 512 files.');
 const {pin,bytes}=readPinned(file);files.set(file,pin);
 if(file===html)return;
 for(const specifier of literalImports(file,bytes.toString('utf8'))){
  const next=specifier.startsWith('.')?path.posix.normalize(path.posix.join(path.posix.dirname(file),specifier)):aliases[specifier]?.slice(1);
  assert.ok(next,'Unmapped literal import '+specifier+' in '+file);copy(next);
 }
}
const htmlBytes=readPinned(html).bytes;
const maps=[...htmlBytes.toString('utf8').matchAll(/<script type="importmap">([^<]+)<\/script>/g)];
assert.equal(maps.length,1,'One exact example import map required.');
assert.deepEqual(JSON.parse(maps[0][1]),{imports:aliases},'Example import map differs from the collector profile.');
copy(html);copy(main);
for(const file of files.keys()){
 if(!file.startsWith('packages/'))continue;
 const source=file.replace('/dist/web/','/web/').replace('/dist/rendering/','/rendering/').replace('/dist/','/src/').replace(/\.js$/,'.ts');
 sources.set(source,readPinned(source).pin);
}
for(const file of ['tools/verify-multi-pointer.mjs','tools/lib/file-identity.mjs','package.json','pnpm-lock.yaml','tsconfig.json','tsconfig.base.json',html,main,
 'packages/contracts/package.json','packages/contracts/tsconfig.json','packages/runtime/package.json','packages/runtime/tsconfig.json',
 'packages/engine/package.json','packages/engine/tsconfig.json','packages/engine/tsconfig.web.json','packages/engine/tsconfig.rendering.json'])sources.set(file,readPinned(file).pin);
const collector=sources.get('tools/verify-multi-pointer.mjs');
// Exclusive directory creation and exact byte copies preserve the prelaunch cut.
fs.mkdirSync(output);const snapshot=path.join(output,'snapshot'),sourceSnapshot=path.join(output,'source');
fs.mkdirSync(snapshot);fs.mkdirSync(sourceSnapshot);
function writeCopy(owner,row){
 const destination=path.join(owner,row.path);assert.equal(ownerRelativePath(owner,destination),row.path);
 fs.mkdirSync(path.dirname(destination),{recursive:true});fs.writeFileSync(destination,inputBytes.get(row.path).bytes,{flag:'wx'});
 assert.deepEqual(fingerprintFile(owner,row.path),row);
}
for(const row of files.values())writeCopy(snapshot,row);
for(const row of sources.values())writeCopy(sourceSnapshot,row);
const report={format:'egret.multi-pointer-browser/1',status:'RUNNING',startedAt:new Date().toISOString(),collector,
 environment:{node:process.version,platform:process.platform,architecture:process.arch,playwright:'1.62.1',channel:'msedge',headless:true,extraFlags:[],physicalDevice:false,input:'Playwright mouse and CDP touch injection; not physical fingers',viewport:{width:900,height:850},deviceScaleFactor:2},
 toolDependencies:{playwright:[pwManifest,pwEntry]},
 protocolQualification:{scope:'Observed browser version only; CDP injection does not qualify physical-device touch.',
 source:'https://chromium.googlesource.com/chromium/src/+/refs/heads/main/content/browser/devtools/protocol/input_handler.cc',
 explanation:'Chromium CreateWebTouchEvents removes the supplied IDs for a nonempty touchEnd; an empty touchEnd releases all remaining contacts. The protocol prose and SyntheticPointerActions branch differ. This collector verifies the behavior on its recorded Edge build without enabling feature flags.'},
 files:[...files.values()],source:[...sources.values()],sourceFreeze:{beforeBrowserLaunch:true,files:inputBytes.size,bytes:totalBytes},
 checks:[],errors:[],cleanup:{contexts:false,browser:false,server:false},snapshotIntegrity:false};
fs.writeFileSync(path.join(output,'source-freeze.json'),canonicalTextBytes(JSON.stringify({collector,files:report.files,source:report.source,toolDependencies:report.toolDependencies},null,2)),{flag:'wx'});
const record=(name,value)=>report.checks.push({name,...value}),served=new Set(),contexts=[];
let browser,server;
try{
 const {chromium}=await import(pathToFileURL(path.join(pw,'index.mjs')).href);
 server=http.createServer((req,res)=>{
  try{
   const url=new URL(req.url,'http://127.0.0.1'),file=decodeURIComponent(url.pathname).slice(1);
   if(!['GET','HEAD'].includes(req.method)||url.search||!files.has(file)){res.writeHead(404);res.end();return;}
   const row=files.get(file),bytes=fs.readFileSync(path.join(snapshot,file));
   assert.equal(bytes.length,row.bytes);assert.equal(sha(bytes),row.sha256,'Served snapshot changed: '+file);served.add(file);
   res.writeHead(200,{'Content-Type':file.endsWith('.html')?'text/html; charset=utf-8':'text/javascript; charset=utf-8','Cache-Control':'no-store'});res.end(req.method==='HEAD'?undefined:bytes);
  }catch(error){report.errors.push('server: '+String(error));res.writeHead(500);res.end();}
 });
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
 const url='http://127.0.0.1:'+server.address().port+'/'+html;
 browser=await chromium.launch({channel:'msedge',headless:true});report.environment.browser=browser.version();
 async function pageFor(touch=false){const context=await browser.newContext({viewport:{width:900,height:850},deviceScaleFactor:2,hasTouch:touch});contexts.push(context);const page=await context.newPage();page.on('pageerror',e=>report.errors.push(String(e)));await page.goto(url);await page.evaluate(async()=>await(await import('./main.mjs')).ready);return {context,page};}
 const snapshotOf=page=>page.evaluate(async()=> (await import('./main.mjs')).readSnapshot());
 // Identity-matched terminal notifications are independent of the example's UI cleanup.
 function terminalsFor(state,sessions,kind,reason){
  return sessions.map(session=>{
   const terminals=state.notifications.filter(n=>n.generation===session.generation&&n.id===session.id&&(n.kind==='end'||n.kind==='cancel'));
   assert.equal(terminals.length,1,'Exactly one terminal for session '+session.generation+':'+session.id);
   const terminal=terminals[0];assert.equal(terminal.kind,kind);assert.equal(terminal.reason,reason);assert.equal(terminal.pointerId,session.pointerId);
   return terminal;
  });
 }
 const {page}=await pageFor();let rect=await page.locator('#scene').boundingBox();assert.ok(rect);
 const point=(r,x,y=80)=>({x:r.x+x*r.width/320,y:r.y+y*r.height/160});
 const left=point(rect,60),right=point(rect,220);
 await page.mouse.move(left.x,left.y);await page.mouse.down();let state=await snapshotOf(page);assert.equal(state.active.length,1);assert.equal(state.active[0].region,'left');
 const mouseSession=state.active[0],mouseId=mouseSession.pointerId;assert.equal(await page.locator('#scene').evaluate((c,id)=>c.hasPointerCapture(id),mouseId),true);
 await page.mouse.move(rect.x+rect.width+20,rect.y+20);state=await snapshotOf(page);assert.equal(state.active[0].region,'left');assert.ok(state.active[0].globalX>320);
 await page.mouse.up();state=await snapshotOf(page);assert.equal(state.active.length,0);assert.equal(state.notifications.filter(n=>n.kind==='end').length,1);assert.deepEqual(state.diagnostics,[]);
 assert.equal(await page.locator('#scene').evaluate((c,id)=>c.hasPointerCapture(id),mouseId),false);
 record('native mouse capture and outside release',{pass:true,terminal:state.notifications.at(-1)});
 // Independent pixel references confirm both authored scene regions are rendered.
 const pixels=await page.evaluate(()=>{const c=document.querySelector('#scene'),x=c.getContext('2d');return [x.getImageData(c.width*60/320,c.height*80/160,1,1).data,x.getImageData(c.width*220/320,c.height*80/160,1,1).data].map(v=>Array.from(v));});
 assert.deepEqual(pixels,[[8,126,139,255],[196,82,51,255]]);record('two authored Canvas regions',{pass:true,pixels});
 await page.screenshot({path:path.join(output,'two-regions.png')});
 await page.evaluate(async()=>await(await import('./main.mjs')).close());state=await snapshotOf(page);assert.equal(state.state,'closed');assert.equal(await page.locator('#scene').evaluate(c=>c.style.getPropertyValue('touch-action')),'');assert.equal(await page.locator('#scene').evaluate((c,id)=>c.hasPointerCapture(id),mouseId),false);record('Engine close and inline style restoration',{pass:true,terminals:terminalsFor(state,[mouseSession],'end',undefined),nativeCapture:false});
 const mobile=await pageFor(true),p=mobile.page,cdp=await mobile.context.newCDPSession(p);rect=await p.locator('#scene').boundingBox();
 report.environment.browserProtocol=await cdp.send('Browser.getVersion');
 const lp=point(rect,60),rp=point(rect,220);const contact=(id,pos)=>({id,x:pos.x,y:pos.y,radiusX:3,radiusY:3,force:0.5});
 let contacts=[contact(10,lp),contact(11,rp)];await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:contacts});state=await snapshotOf(p);assert.equal(state.active.length,2);assert.deepEqual(state.active.map(n=>n.region).sort(),['left','right']);assert.ok(state.active.every(n=>n.pointerType==='touch'));
 const touchSessions=state.active.slice(),touchIds=touchSessions.map(n=>n.pointerId);assert.deepEqual(await p.locator('#scene').evaluate((c,ids)=>ids.map(id=>c.hasPointerCapture(id)),touchIds),[true,true]);
 record('two browser touch contacts including secondary pointer',{pass:true,active:state.active,nativeCapture:[true,true]});
 contacts=[contact(10,{x:rect.x+rect.width+15,y:lp.y}),contact(11,rp)];await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:contacts});state=await snapshotOf(p);assert.equal(state.active.length,2);assert.equal(state.active.find(n=>n.region==='left').globalX>320,true);
 // This Edge's Chromium CreateWebTouchEvents path removes the IDs supplied to touchEnd.
 // Official protocol prose differs; retain this as exact-version injected input evidence.
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[contacts[0]]});state=await snapshotOf(p);record('partial release observed state',{active:state.active,notifications:state.notifications});assert.equal(state.active.length,1);assert.equal(state.active[0].region,'right');terminalsFor(state,touchSessions.filter(n=>n.region==='left'),'end',undefined);assert.equal(state.notifications.filter(n=>n.generation===touchSessions.find(s=>s.region==='right').generation&&n.id===touchSessions.find(s=>s.region==='right').id&&(n.kind==='end'||n.kind==='cancel')).length,0);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});state=await snapshotOf(p);assert.equal(state.active.length,0);assert.deepEqual(await p.locator('#scene').evaluate((c,ids)=>ids.map(id=>c.hasPointerCapture(id)),touchIds),[false,false]);record('independent captured movement and release',{pass:true,terminals:terminalsFor(state,touchSessions,'end',undefined),nativeCapture:[false,false]});
 // Five simultaneous browser-injected contacts are distinct from physical capacity evidence.
 contacts=Array.from({length:5},(_,i)=>contact(20+i,point(rect,30+i*55)));
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:contacts});state=await snapshotOf(p);assert.equal(state.active.length,5);const fiveSessions=state.active.slice();assert.equal(new Set(fiveSessions.map(n=>n.generation+':'+n.id)).size,5);record('five browser-injected contacts',{pass:true,maximum:state.maximumContacts});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});state=await snapshotOf(p);assert.equal(state.active.length,0);const systemTerminals=terminalsFor(state,fiveSessions,'cancel','pointercancel');assert.equal(systemTerminals.length,5);record('system touch cancellation',{pass:true,cancels:systemTerminals.length,terminals:systemTerminals});
 contacts=[contact(40,lp),contact(41,rp)];await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:contacts});const beforeViewport=await snapshotOf(p);assert.equal(beforeViewport.active.length,2);
 await p.setViewportSize({width:800,height:850});await p.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));state=await snapshotOf(p);assert.equal(state.active.length,0);assert.ok(state.viewportRevision>beforeViewport.viewportRevision);const viewportTerminals=terminalsFor(state,beforeViewport.active,'cancel','viewport');assert.ok(viewportTerminals.every(n=>n.viewportRevision===beforeViewport.viewportRevision));record('viewport cancellation poststate and new revision',{pass:true,oldRevision:beforeViewport.viewportRevision,revision:state.viewportRevision,terminals:viewportTerminals});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});assert.equal((await snapshotOf(p)).active.length,0);
 rect=await p.locator('#scene').boundingBox();await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[contact(50,point(rect,60))]});state=await snapshotOf(p);assert.equal(state.active.length,1);assert.equal(state.active[0].region,'left');const heldSession=state.active[0];assert.equal(await p.locator('#scene').evaluate((c,id)=>c.hasPointerCapture(id),heldSession.pointerId),true);record('fresh down after resize',{pass:true});
 await p.evaluate(async()=>await(await import('./main.mjs')).close());state=await snapshotOf(p);assert.equal(state.active.length,0);assert.equal(state.state,'closed');assert.deepEqual(state.diagnostics,[]);const closeTerminals=terminalsFor(state,[heldSession],'cancel','dispose');assert.equal(await p.locator('#scene').evaluate((c,id)=>c.hasPointerCapture(id),heldSession.pointerId),false);assert.equal(await p.locator('#scene').evaluate(c=>c.style.getPropertyValue('touch-action')),'');record('close with browser contact held',{pass:true,terminals:closeTerminals,nativeCapture:false,inlineTouchAction:''});await cdp.detach();
 assert.deepEqual(report.errors,[]);assert.equal(report.checks.length,11);assert.equal(report.checks.filter(item=>item.pass===true).length,10);report.status='PASS';
}catch(error){
 report.status='FAIL';report.failure={name:error?.name??'Error',message:String(error?.message??error),stack:error?.stack};
}finally{
 const cleanupErrors=[];
 for(const context of contexts){try{await context.close();}catch(error){cleanupErrors.push('context: '+String(error));}}
 report.cleanup.contexts=cleanupErrors.length===0;
 try{await browser?.close();report.cleanup.browser=true;}catch(error){cleanupErrors.push('browser: '+String(error));}
 try{
  if(server?.listening)await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
  report.cleanup.server=true;
 }catch(error){cleanupErrors.push('server: '+String(error));}
 report.errors.push(...cleanupErrors);
 try{
  for(const row of files.values())assert.deepEqual(fingerprintFile(snapshot,row.path),row,'Frozen browser file changed: '+row.path);
  for(const row of sources.values())assert.deepEqual(fingerprintFile(sourceSnapshot,row.path),row,'Frozen source file changed: '+row.path);
  report.snapshotIntegrity=true;
 }catch(error){report.errors.push('snapshot integrity: '+String(error));}
 if(report.errors.length||!Object.values(report.cleanup).every(Boolean)||!report.snapshotIntegrity)report.status='FAIL';
 if(report.status!=='PASS')process.exitCode=1;
 report.served=[...served].sort();report.endedAt=new Date().toISOString();
 fs.writeFileSync(path.join(output,'result.json'),canonicalTextBytes(JSON.stringify(report,null,2)),{flag:'wx'});
 console.log(JSON.stringify({output,status:report.status,checks:report.checks.length,passed:report.checks.filter(item=>item.pass===true).length,failure:report.failure,errors:report.errors,cleanup:report.cleanup,snapshotIntegrity:report.snapshotIntegrity}));
}
