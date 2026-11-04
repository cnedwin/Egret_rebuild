// SPDX-License-Identifier: Apache-2.0
// Finite public-SDK shared-renderer pixel verification; no physical-device or performance claim.
import fs from 'node:fs';import path from 'node:path';import http from 'node:http';
import assert from 'node:assert/strict';import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';import {createHash} from 'node:crypto';
import {fingerprintFile,logicalPath,ownerRelativePath,samePhysicalPath} from './lib/file-identity.mjs';
import {localPackage} from './lib/local-package.mjs';
import {fixture,atlas} from '../packages/spine/test/fixtures.mjs';
import {renderingSource} from '../packages/spine/test/renderingFixture.mjs';

const root=fileURLToPath(new URL('..',import.meta.url)),args=new Map();
for(let i=2;i<process.argv.length;i+=2){const key=process.argv[i],value=process.argv[i+1];if(!['--playwright','--output'].includes(key)||args.has(key)||!value||!path.isAbsolute(value))throw Error('Expected unique --playwright and --output absolute paths');args.set(key,value);}
assert.equal(args.size,2);assert.equal(process.version,'v26.7.0');assert.equal(process.execArgv.length,0);
for(const key of ['NODE_OPTIONS','NODE_PATH'])assert.ok(!process.env[key]);
const output=path.resolve(args.get('--output')),parent=fs.realpathSync(path.dirname(output));
assert.ok(samePhysicalPath(parent,path.dirname(output)));logicalPath(path.basename(output));assert.ok(!fs.existsSync(output));
let inside=samePhysicalPath(root,output);try{ownerRelativePath(root,output);inside=true;}catch(error){if(!(error instanceof RangeError))throw error;}assert.ok(!inside);
fs.mkdirSync(output);const snapshot=path.join(output,'snapshot');fs.mkdirSync(snapshot);
const sha=b=>createHash('sha256').update(b).digest('hex'),routes=new Map(),pins=new Map(),aliases={};
function pin(file){const relative=ownerRelativePath(root,file);if(pins.has(relative))return pins.get(relative);const row=fingerprintFile(root,relative);assert.ok(pins.size<2048&&row.bytes<=4194304);const bytes=fs.readFileSync(file);assert.equal(sha(bytes),row.sha256);const target=path.join(snapshot,relative);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,bytes,{flag:'wx'});pins.set(relative,row);return row;}
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
 const text=bytes.toString('utf8');
 const dynamic=[...text.matchAll(/\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g)];
 const allowed=route==='/packages/engine/dist/web/WebGPUHost.js'?['./sharedB1.js','./b1.js']:route==='/packages/engine/dist/web/WebGL2Host.js'?['./sharedWebGL2Scene.js']:[];
 assert.equal((text.match(/\bimport\s*\(/g)??[]).length,dynamic.length,'Nonliteral dynamic import');
 for(const match of dynamic){assert.ok(allowed.includes(match[1]),'Unreviewed dynamic target');module(new URL(match[1],'http://snapshot'+route).pathname);}
 for(const match of text.matchAll(/^(?:import|export)\s+[^;]*?\sfrom\s*['"]([^'"]+)['"];?/gm)){const specifier=match[1],next=specifier.startsWith('.')?new URL(specifier,'http://snapshot'+route).pathname:aliases[specifier];assert.ok(next,'Unmapped import '+specifier);module(next);}
 const map=file+'.map';if(route.startsWith('/packages/')&&fs.existsSync(map)){pin(map);for(const source of JSON.parse(fs.readFileSync(map,'utf8')).sources??[])pin(path.resolve(path.dirname(map),source));}
}
module(aliases['@egret/engine']);module(aliases['@egret/spine/web']);module(aliases['@egret/spine']);module(aliases['@egret/contracts/resources']);
module(aliases['@egret/engine/webgpu']);module(aliases['@egret/engine/webgl2']);
for(const file of ['tools/verify-spine-rendering.mjs','packages/spine/test/renderingBrowser.mjs','packages/spine/test/renderingFixture.mjs','packages/spine/test/playbackFixture.mjs','packages/spine/test/fixtures.mjs','pnpm-lock.yaml','third-party/spine-core-4.3.13.LICENSE'])pin(path.join(root,file));
// Authored shared-linear references: alpha128/255, blue light128/255, dark(128,64,32)/255; linear compositing then sRGB resolve, tolerance2 for target quantization.
const blue=[0,0,255,255],red=[255,0,0,255],bg=[32,64,96,255];
const basePoints=[[10,12,red],[14,12,blue],[18,12,blue],[24,24,bg],[1,1,[0,255,0,255]]];
const cases=[
 {name:'outfit',outfit:true,skins:['blue-first','red-second'],replay:true,outfitReplay:true,expected:[[10,12,blue],[14,12,red],[18,12,red]],changedExpected:basePoints},
 {name:'outfit-last-red',outfit:true,skins:['blue-first','red-first'],expected:basePoints},
 {name:'outfit-last-blue',outfit:true,skins:['red-first','blue-first'],expected:[[10,12,blue],[14,12,blue],[18,12,blue]]},
 {name:'outfit-fallback',outfit:true,skins:['blue-first'],expected:[[10,12,blue],[14,12,blue],[18,12,blue]]},
 {name:'wrong-outfit-order',outfit:true,skins:['red-first','blue-first'],control:true,expected:basePoints},
 {name:'normal',expected:basePoints,replay:true},
 {name:'mesh',mesh:true,expected:basePoints},
 {name:'weighted',mesh:true,weighted:true,expected:basePoints},
 {name:'clip',clip:true,expected:[[10,12,bg],[14,12,blue],[18,12,bg]]},
 {name:'rect-clip',rectClip:true,expected:[[10,12,red],[14,12,bg],[18,12,bg]]},
 {name:'negative',flip:true,expected:[[6,12,blue],[10,12,blue],[14,12,red],[24,24,bg]]},
 {name:'dpr2',ratio:2,expected:basePoints},
 {name:'linear',linear:true,expected:basePoints},
 {name:'linear-pattern',linear:true,pattern:true,expected:[[15,11,[227,239,205,255]]]},
 {name:'wrong-filter',pattern:true,control:true,expected:[[15,11,[227,239,205,255]]]},
 {name:'trim',trim:true,expected:[[13,12,red],[17,12,blue],[19,12,bg],[17,9,bg]]},
 {name:'transparent',tint:true,transparent:true,expected:[[18,12,[94,69,94,128]],[24,24,[0,0,0,0]]]},
 ...[['normal',[224,99,137,255]],['additive',[255,99,137,255]],['multiply',[224,0,0,255]],['screen',[255,99,137,255]]].map(([blend,expected])=>({name:'tint-'+blend,blend,tint:true,expected:[[14,12,expected],[18,12,{normal:[139,109,151,255],additive:[141,117,164,255],multiply:[27,50,84,255],screen:[140,115,157,255]}[blend]]]})),
 {name:'rotation',pattern:true,expected:[[13,9,[255,255,0,255]],[19,9,[0,255,255,255]],[13,15,[255,255,255,255]],[19,15,[255,0,255,255]]]},
 ...[{name:'wrong-page',wrongPage:true},{name:'wrong-order',swap:true},{name:'wrong-tint',tint:true},{name:'wrong-blend',blend:'additive'},{name:'wrong-clip',clip:true}].map(def=>({...def,control:true,expected:basePoints}))
];
for(const def of cases){const pagePixels=def.wrongPage?{e_a:Array(4).fill(blue).flat(),e_b:Array(4).fill(red).flat()}:def.pattern?{e_b:[0,255,255,255,255,0,255,255,255,255,0,255,255,255,255,255]}:{};const atlasText=def.linear?atlas.replaceAll('Nearest,Nearest','Linear,Linear'):def.trim?atlas.replace('blue\nbounds: 0,0,2,2','blue\nbounds: 0,0,2,2\noffsets: 1,1,4,4'):atlas;const data=fixture({skeleton:renderingSource(def),pagePixels,atlasText});
 const fixtureDir=path.join(output,'fixtures',def.name);fs.mkdirSync(fixtureDir,{recursive:true});fs.writeFileSync(path.join(fixtureDir,'manifest.json'),JSON.stringify(data.manifest,null,2));for(const entry of data.manifest.entries){const file=path.join(fixtureDir,entry.artifact.path);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,data.values.get(entry.id));}routes.set('/'+def.name+'/manifest.json',{bytes:Buffer.from(JSON.stringify(data.manifest)),type:'application/json'});for(const entry of data.manifest.entries)routes.set('/'+def.name+'/'+entry.artifact.path,{bytes:Buffer.from(data.values.get(entry.id)),type:entry.artifact.mediaType});}
routes.set('/browser.mjs',{bytes:fs.readFileSync(path.join(snapshot,'packages/spine/test/renderingBrowser.mjs')),type:'text/javascript'});
routes.set('/index.html',{bytes:Buffer.from('<!doctype html><meta charset="utf-8"><link rel="icon" href="data:,"><title>Spine shared rendering</title><script type="importmap">'+JSON.stringify({imports:aliases})+'</script><script type="module">import {runCase} from "/browser.mjs";globalThis.runCase=runCase;</script>'),type:'text/html'});
const pw=fs.realpathSync(args.get('--playwright')),pwMeta=JSON.parse(fs.readFileSync(path.join(pw,'package.json')));assert.equal(pwMeta.name,'playwright');assert.equal(pwMeta.version,'1.62.1');
const report={format:'egret.spine-rendering-browser/1',status:'RUNNING',startedAt:new Date().toISOString(),environment:{node:process.version,playwright:pwMeta.version,channel:'msedge',headless:true,extraFlags:[],device:false},scope:'Original numerical and pixel references for ordered shared Spine composition; not complete Spine/device/performance qualification',source:[...pins.values()],cases:[],errors:[],cleanup:{context:false,browser:false,server:false}};
fs.writeFileSync(path.join(output,'source-freeze.json'),JSON.stringify({source:report.source,aliases},null,2)+'\n',{flag:'wx'});
let browser,context,page,server;
try{server=http.createServer((req,res)=>{const row=routes.get(req.url);if(!row){res.writeHead(404);res.end();return;}res.writeHead(200,{'content-type':row.type,'cache-control':'no-store'});res.end(row.bytes);});await new Promise((yes,no)=>{server.once('error',no);server.listen(0,'127.0.0.1',yes);});
 const {chromium}=await import(pathToFileURL(path.join(pw,'index.mjs')).href);browser=await chromium.launch({channel:'msedge',headless:true,timeout:15000});report.environment.browser=browser.version();context=await browser.newContext();page=await context.newPage();page.setDefaultTimeout(30000);page.on('pageerror',e=>report.errors.push(String(e)));await page.goto('http://127.0.0.1:'+server.address().port+'/index.html');await page.waitForFunction(()=>!!globalThis.runCase);
 for(const backend of ['webgl2','webgpu'])for(const def of cases){const result=await page.evaluate(({backend,def})=>globalThis.runCase(backend,def),{backend,def});report.cases.push(result);const rawFile=backend+'-'+def.name+'.json';fs.writeFileSync(path.join(output,rawFile),JSON.stringify(result)+'\n');assert.equal(result.closed,true);assert.deepEqual(result.diagnostics,[]);for(const[key,value]of Object.entries(result.logical))assert.equal(value,key==='isDisposed'?true:0,key);const image=result.initial;assert.equal(image.width,32*(def.ratio??1));assert.equal(image.height,image.width);assert.equal(image.alphaMode,'premultiplied');let mismatches=0;const samples=[];for(const[x,y,expected]of def.expected){const px=Math.floor((x+.5)*(def.ratio??1)),py=Math.floor((y+.5)*(def.ratio??1)),offset=(py*image.width+px)*4,actual=image.bytes.slice(offset,offset+4);const pass=expected.every((v,i)=>Math.abs(v-actual[i])<=2);if(!pass)mismatches++;samples.push({x,y,expected,actual,pass});}result.samples=samples;result.control=!!def.control;assert.ok(def.control?mismatches>0:mismatches===0,backend+' '+def.name+': '+JSON.stringify(samples));if(def.skins)assert.deepEqual(result.selection,def.skins);if(def.outfitReplay){assert.deepEqual(result.changedSelection,['default']);for(const[x,y,expected]of def.changedExpected){const offset=(y*result.moved.width+x)*4;assert.ok(expected.every((value,index)=>Math.abs(value-result.moved.bytes[offset+index])<=2),'changed outfit pixels');}}if(def.replay){assert.notDeepEqual(result.moved.bytes,image.bytes);assert.deepEqual(result.replayed.bytes,image.bytes);assert.equal(result.retired.view,true);assert.equal(result.retired.player,true);}result.status=def.control?'CONTROL_REJECTED':'PASS';}
 assert.deepEqual(report.errors,[]);report.status='PASS';
}catch(e){report.status='FAIL';report.failure={message:e.message,stack:e.stack};}finally{for(const[key,close]of [['context',()=>context?.close()],['browser',()=>browser?.close()],['server',()=>server?.listening?new Promise((yes,no)=>{server.close(e=>e?no(e):yes());server.closeAllConnections();}):undefined]])try{await close();report.cleanup[key]=true;}catch(e){report.errors.push(key+': '+e.message);}try{for(const row of pins.values()){assert.deepEqual(fingerprintFile(root,row.path),row);assert.deepEqual(fingerprintFile(snapshot,row.path),row);}report.sourceIntegrity=true;}catch(e){report.errors.push('identity: '+e.message);}if(report.errors.length||!Object.values(report.cleanup).every(Boolean)||!report.sourceIntegrity)report.status='FAIL';report.endedAt=new Date().toISOString();fs.writeFileSync(path.join(output,'result.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({status:report.status,cases:report.cases.map(r=>({name:r.name,backend:r.backend,status:r.status})),files:pins.size,cleanup:report.cleanup,errors:report.errors,failure:report.failure}));if(report.status!=='PASS')process.exitCode=1;}
