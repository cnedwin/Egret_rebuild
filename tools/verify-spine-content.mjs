// SPDX-License-Identifier: Apache-2.0
// Finite public-SDK asset verification; no animation, renderer or device claim.
import fs from 'node:fs';import path from 'node:path';import http from 'node:http';
import assert from 'node:assert/strict';import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';import {createHash} from 'node:crypto';
import {fingerprintFile,logicalPath,ownerRelativePath,samePhysicalPath} from './lib/file-identity.mjs';
import {localPackage} from './lib/local-package.mjs';
import {fixture} from '../packages/spine/test/fixtures.mjs';

const root=fileURLToPath(new URL('..',import.meta.url)),args=new Map();
for(let i=2;i<process.argv.length;i+=2){const key=process.argv[i],value=process.argv[i+1];if(!['--playwright','--output'].includes(key)||args.has(key)||!value||!path.isAbsolute(value))throw Error('Expected unique --playwright and --output absolute paths');args.set(key,value);}
assert.equal(args.size,2);assert.equal(process.version,'v26.7.0');assert.equal(process.execArgv.length,0);
for(const key of ['NODE_OPTIONS','NODE_PATH'])assert.ok(!process.env[key]);
const output=path.resolve(args.get('--output')),parent=fs.realpathSync(path.dirname(output));
assert.ok(samePhysicalPath(parent,path.dirname(output)));logicalPath(path.basename(output));assert.ok(!fs.existsSync(output));
let inside=samePhysicalPath(root,output);try{ownerRelativePath(root,output);inside=true;}catch(error){if(!(error instanceof RangeError))throw error;}assert.ok(!inside);
fs.mkdirSync(output);const snapshot=path.join(output,'snapshot');fs.mkdirSync(snapshot);
const sha=b=>createHash('sha256').update(b).digest('hex'),routes=new Map(),pins=new Map(),aliases={};
function pin(file){const relative=ownerRelativePath(root,file);if(pins.has(relative))return pins.get(relative);const row=fingerprintFile(root,relative);assert.ok(pins.size<512&&row.bytes<=4194304);const bytes=fs.readFileSync(file);assert.equal(sha(bytes),row.sha256);const target=path.join(snapshot,relative);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,bytes,{flag:'wx'});pins.set(relative,row);return row;}
const require=createRequire(path.join(root,'package.json'));
for(const name of ['contracts','runtime','engine','spine']){const pkg=JSON.parse(fs.readFileSync(path.join(root,'packages',name,'package.json')));pin(path.join(root,'packages',name,'package.json'));for(const [key,value]of Object.entries(pkg.exports)){aliases[pkg.name+(key==='.'?'':key.slice(1))]='/packages/'+name+'/'+value.import.slice(2);}for(const [key,value]of Object.entries(pkg.imports??{}))aliases[key]='/packages/'+name+'/'+value.import.slice(2);}
const vendors=[];
for(const [name,version,key]of [['@esotericsoftware/spine-core','4.3.13','spine-core'],['robust-predicates','3.0.3','robust-predicates']]){
 const entry=require.resolve(name),owner=localPackage(root,path.resolve(path.dirname(entry),name.includes('spine-core')?'..':'.'),name,version),entryRelative=ownerRelativePath(owner,entry),route='/vendor/'+key+'/'+entryRelative;
 aliases[name]=route;vendors.push({owner,prefix:'/vendor/'+key+'/'});pin(path.join(owner,'package.json'));
}
function physical(route){if(route.startsWith('/packages/'))return path.join(root,route.slice(1));const vendor=vendors.find(v=>route.startsWith(v.prefix));assert.ok(vendor,'Undeclared module route '+route);const relative=route.slice(vendor.prefix.length);logicalPath(relative);return path.join(vendor.owner,relative);}
function module(route){if(routes.has(route))return;assert.ok(route.endsWith('.js'));const file=physical(route),row=pin(file),bytes=fs.readFileSync(path.join(snapshot,row.path));routes.set(route,{bytes,type:'text/javascript; charset=utf-8'});
 // Emitted ESM uses literal top-level clauses; dynamic imports are not admitted.
 const text=bytes.toString('utf8');assert.ok(!/\bimport\s*\(/.test(text));
 for(const match of text.matchAll(/^(?:import|export)\s+[^;]*?\sfrom\s*['"]([^'"]+)['"];?/gm)){const specifier=match[1],next=specifier.startsWith('.')?new URL(specifier,'http://snapshot'+route).pathname:aliases[specifier];assert.ok(next,'Unmapped import '+specifier);module(next);}
 const map=file+'.map';if(route.startsWith('/packages/')&&fs.existsSync(map)){pin(map);for(const source of JSON.parse(fs.readFileSync(map,'utf8')).sources??[])pin(path.resolve(path.dirname(map),source));}
}
module(aliases['@egret/engine']);module(aliases['@egret/spine/web']);module(aliases['@egret/contracts/resources']);
for(const file of ['tools/verify-spine-content.mjs','packages/spine/test/fixtures.mjs','pnpm-lock.yaml','third-party/spine-core-4.3.13.LICENSE'])pin(path.join(root,file));
const data=fixture();
for(const mode of ['ordinary','failure','held'])for(const entry of data.manifest.entries){const bytes=data.values.get(entry.id);routes.set('/'+mode+'/'+entry.artifact.path,{bytes:Buffer.from(bytes),type:entry.artifact.mediaType});}
const main=`
import {createEngine} from '@egret/engine';import {admitResourceManifest} from '@egret/contracts/resources';import {createManifestSpineContentLoader} from '@egret/spine/web';
const admission=admitResourceManifest(${JSON.stringify(data.manifest)});if(!admission.ok)throw Error('Fixture manifest refused');
const diagnostics=[],engine=await createEngine({host:{surface:{},start(){},stop(){},async close(){},setTimeout(callback,ms){const token=setTimeout(callback,ms);return ()=>clearTimeout(token);}},onDiagnostic:d=>diagnostics.push({code:d.code})});
const loaders=[],groups=[];
function make(mode){const loader=createManifestSpineContentLoader(engine,engine.createScope(),admission.value,{baseUrl:new URL('./'+mode+'/',location.href).href,networkRetries:0});loaders.push(loader);return loader;}
const original=make('ordinary'),first=original.load(engine.createScope(),['e_json']),second=original.load(engine.createScope(),['e_json']);groups.push(first,second);await Promise.all([first.ready,second.ready]);
function inspect(loader){return {loader:loader.getStatus(),transport:loader.getTransportStatus()};}
globalThis.spineContent={ready:{info:first.getSpine('e_json').info,shared:first.getSpine('e_json').info===second.getSpine('e_json').info,status:inspect(original)},
async failure(){const loader=make('failure'),group=loader.load(engine.createScope(),['e_json']);groups.push(group);let refused=false;try{await group.ready;}catch{refused=true;}await loader.close();return {refused,retired:group.isDisposed,originalLive:!first.getSpine('e_json').isDisposed,status:inspect(loader)};},
startHeld(){const loader=make('held'),scope=engine.createScope(),group=loader.load(scope,['e_json']);groups.push(group);const settled=group.ready.then(()=>({unexpected:true}),()=>({refused:true}));this.cancelHeld=()=>{scope.dispose();this.cancelledHeld=(async()=>{const result=await settled;await loader.close();return {...result,retired:group.isDisposed,status:inspect(loader),originalLive:!first.getSpine('e_json').isDisposed};})();return {cancelIssued:true,scopeState:scope.state};};return true;},
async close(){for(const group of groups)group.dispose();for(const loader of loaders)await loader.close();await engine.dispose();return {loaders:loaders.map(inspect),groups:groups.map(g=>g.isDisposed),diagnostics};}};
document.querySelector('pre').textContent=JSON.stringify(globalThis.spineContent.ready,null,2);
`;
const html=Buffer.from('<!doctype html><meta charset="utf-8"><link rel="icon" href="data:,"><title>Spine content verification</title><script type="importmap">'+JSON.stringify({imports:aliases})+'</script><pre>Loading public asset SDK</pre><script type="module">'+main+'</script>');routes.set('/index.html',{bytes:html,type:'text/html; charset=utf-8'});
const pw=fs.realpathSync(args.get('--playwright')),pwMeta=JSON.parse(fs.readFileSync(path.join(pw,'package.json')));assert.equal(pwMeta.name,'playwright');assert.equal(pwMeta.version,'1.62.1');
const pwPin={bytes:fs.statSync(path.join(pw,'package.json')).size,sha256:sha(fs.readFileSync(path.join(pw,'package.json')))};
let browser,context,page,held,server;let entered;const heldEntered=new Promise(yes=>entered=yes);
const report={format:'egret.spine-content-browser/1',status:'RUNNING',startedAt:new Date().toISOString(),environment:{node:process.version,playwright:pwMeta.version,channel:'msedge',headless:true,extraFlags:[],device:false},scope:'Public resource ingress, native PNG decoding and logical lifecycle only; no Spine pose, graphics, physical memory or timing acceptance',source:[...pins.values()],checks:[],errors:[],cleanup:{application:false,context:false,browser:false,server:false}};
fs.writeFileSync(path.join(output,'source-freeze.json'),JSON.stringify({source:report.source,aliases,playwright:pwPin},null,2)+'\n',{flag:'wx'});
function drained(value){for(const [key,count]of Object.entries(value.loader))if(key!=='isDisposed')assert.equal(count,0,'loader '+key);assert.equal(value.loader.isDisposed,true);for(const subsystem of ['source','provider'])for(const [key,count]of Object.entries(value.transport[subsystem].current))assert.equal(count,0,subsystem+' '+key);}
function bounded(promise,label){let timer;return Promise.race([promise,new Promise((_,no)=>{timer=setTimeout(()=>no(Error('Deadline '+label)),20000);})]).finally(()=>clearTimeout(timer));}
try{
 server=http.createServer((req,res)=>{const row=['GET','HEAD'].includes(req.method)?routes.get(req.url):undefined;if(!row){res.writeHead(404);res.end();return;}if(req.url==='/failure/assets/b'){res.writeHead(503);res.end('Assigned transport failure');return;}if(req.url==='/held/assets/b'){assert.ok(!held);held={response:res,closed:false,bytes:row.bytes};res.once('close',()=>held.closed=true);entered();return;}res.writeHead(200,{'content-type':row.type,'cache-control':'no-store'});res.end(req.method==='HEAD'?undefined:row.bytes);});
 await new Promise((yes,no)=>{server.once('error',no);server.listen(0,'127.0.0.1',yes);});
 const {chromium}=await import(pathToFileURL(path.join(pw,'index.mjs')).href);browser=await chromium.launch({channel:'msedge',headless:true,timeout:15000});report.environment.browser=browser.version();context=await browser.newContext();page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',error=>report.errors.push(String(error)));
 await page.goto('http://127.0.0.1:'+server.address().port+'/index.html');await page.waitForFunction(()=>!!globalThis.spineContent);
 report.ordinary=await page.evaluate(()=>globalThis.spineContent.ready);assert.equal(report.ordinary.info.boneCount,2);assert.equal(report.ordinary.info.slotCount,2);assert.deepEqual(report.ordinary.info.pages.map(p=>p.name),['a.png','b.png']);assert.equal(report.ordinary.shared,true);assert.equal(report.ordinary.status.loader.liveSetups,1);assert.ok(report.ordinary.status.transport.provider.highWater.activeDecodes>0);report.checks.push('genuine Core JSON, native PNG decode, multipage binding and shared setup');
 report.transportFailure=await bounded(page.evaluate(()=>globalThis.spineContent.failure()),'transport refusal');assert.equal(report.transportFailure.refused,true);assert.equal(report.transportFailure.retired,true);assert.equal(report.transportFailure.originalLive,true);drained(report.transportFailure.status);report.checks.push('actual HTTP503 rejects candidate and preserves old group');
 await page.evaluate(()=>globalThis.spineContent.startHeld());await bounded(heldEntered,'held request');report.cancelIssued=await page.evaluate(()=>globalThis.spineContent.cancelHeld());assert.deepEqual(report.cancelIssued,{cancelIssued:true,scopeState:'closed'});held.response.writeHead(200,{'content-type':'image/png'});held.response.end(held.bytes);report.cancelled=await bounded(page.evaluate(()=>globalThis.spineContent.cancelledHeld),'pending cancellation');assert.equal(report.cancelled.refused,true);assert.equal(report.cancelled.retired,true);assert.equal(report.cancelled.originalLive,true);drained(report.cancelled.status);report.held={entered:true,lateResponseIssued:true,transportClosed:held.closed};report.checks.push('actual pending request cancellation refuses late candidate and drains');
 report.closed=await bounded(page.evaluate(()=>globalThis.spineContent.close()),'application close');for(const value of report.closed.loaders)drained(value);assert.ok(report.closed.groups.every(Boolean));assert.deepEqual(report.closed.diagnostics,[]);report.cleanup.application=true;assert.deepEqual(report.errors,[]);report.status='PASS';
}catch(error){report.status='FAIL';report.failure={name:error.name,message:error.message,stack:error.stack};}
finally{
 if(held&&!held.response.writableEnded)held.response.end(held.bytes);
 if(page&&!report.cleanup.application)try{report.failedClose=await bounded(page.evaluate(()=>globalThis.spineContent?.close()),'failed close');if(report.failedClose){for(const value of report.failedClose.loaders)drained(value);report.cleanup.application=true;}}catch(error){report.errors.push('application: '+error.message);}
 for(const [key,close]of [['context',()=>context?.close()],['browser',()=>browser?.close()],['server',()=>server?.listening?new Promise((yes,no)=>{server.close(error=>error?no(error):yes());server.closeAllConnections();}):undefined]])try{await close();report.cleanup[key]=true;}catch(error){report.errors.push(key+': '+error.message);}
 try{for(const row of pins.values()){assert.deepEqual(fingerprintFile(root,row.path),row);assert.deepEqual(fingerprintFile(snapshot,row.path),row);}assert.equal(sha(fs.readFileSync(path.join(pw,'package.json'))),pwPin.sha256);report.sourceIntegrity=true;}catch(error){report.errors.push('identity: '+error.message);}
 if(report.errors.length||!Object.values(report.cleanup).every(Boolean)||!report.sourceIntegrity)report.status='FAIL';report.endedAt=new Date().toISOString();fs.writeFileSync(path.join(output,'result.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({status:report.status,checks:report.checks,files:pins.size,cleanup:report.cleanup,failure:report.failure,errors:report.errors}));if(report.status!=='PASS')process.exitCode=1;
}
