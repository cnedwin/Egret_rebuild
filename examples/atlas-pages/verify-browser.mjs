// SPDX-License-Identifier: Apache-2.0
// Finite real-browser resource/pixel check, without native interception.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';import {pathToFileURL} from 'node:url';
import {createExampleServer} from '../../tools/serve-example.mjs';import {authorAtlasPagesExample} from './author.mjs';import {referencePixels} from './fixture.mjs';
const [playwrightRoot,output,...extra]=process.argv.slice(2);if(!playwrightRoot||!output||extra.length)throw Error('Usage: node examples/atlas-pages/verify-browser.mjs <playwright-root> <new-output-directory>');
assert.equal(JSON.parse(fs.readFileSync(path.join(playwrightRoot,'package.json'),'utf8')).version,'1.62.1');
const {chromium}=await import(pathToFileURL(path.join(playwrightRoot,'index.mjs'))),root=path.resolve(import.meta.dirname,'../..'),out=path.resolve(output);fs.mkdirSync(out);
const sha=b=>createHash('sha256').update(b).digest('hex'),sources=new Map(),reports=[];
const result={schema:'egret.atlas-pages-browser/1',startedUtc:new Date().toISOString(),environment:{node:process.version,playwright:'1.62.1',channel:'msedge',headless:true,extraFlags:[],physicalDevice:false},scope:'Actual immutable build artifacts, native decode and shared-rendered multipage pixels; controlled HTTP failure/cancellation. No Spine, phone, physical memory or performance acceptance.',reports};
const physical=p=>p.startsWith('vendor/robust-predicates/')?path.join(root,'packages/engine/node_modules/robust-predicates',p.slice(25)):path.join(root,p);
const call=(page,name)=>page.evaluate(async name=>globalThis.__egretAtlasPages[name](),name);
let browser,context,server;
try{
 const authored=await authorAtlasPagesExample(),config='/'+path.relative(root,authored.configuration).split(path.sep).join('/'),second=authored.result.manifest.entries.find(e=>e.id==='e_second').artifact.path;
 const secondPath='/'+path.relative(root,path.join(authored.runRoot,second)).split(path.sep).join('/');result.generationId=authored.result.generationId;
 server=createExampleServer(root);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));browser=await chromium.launch({channel:'msedge',headless:true});result.environment.browser=browser.version();
 for(const [backend,mode]of [['webgl2','ordinary'],['webgpu','ordinary'],['webgl2','http-failure'],['webgl2','pending-close']]){
  const row={backend,mode,checks:[]};reports.push(row);context=await browser.newContext({viewport:{width:1000,height:720},deviceScaleFactor:1});const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));
  let observe,release;const observed=new Promise(resolve=>observe=resolve),released=new Promise(resolve=>release=resolve);
  await page.route('**/*',async route=>{const url=new URL(route.request().url());assert.equal(url.hostname,'127.0.0.1');const p=decodeURIComponent(url.pathname).slice(1),file=physical(p);if(fs.existsSync(file)&&fs.statSync(file).isFile()){const bytes=fs.readFileSync(file),pin={path:p,bytes:bytes.length,sha256:sha(bytes)},prior=sources.get(p);if(prior)assert.deepEqual(pin,prior,'Source drift');else sources.set(p,pin);}if(url.pathname===secondPath&&mode==='http-failure'){await route.fulfill({status:503,body:'Assigned resource failure'});return;}if(url.pathname===secondPath&&mode==='pending-close'){observe();await released;}await route.continue().catch(error=>{if(mode!=='pending-close')throw error;});});
  await page.goto('http://127.0.0.1:'+server.address().port+'/examples/atlas-pages/index.html?backend='+backend+'&config='+encodeURIComponent(config));await page.waitForFunction(()=>globalThis.__egretAtlasPages!==undefined);
  if(mode==='ordinary'){
   await page.evaluate(()=>globalThis.__egretAtlasPages.ready);const state=await call(page,'inspect');assert.equal(state.state,'ready');assert.deepEqual(state.pages,['characters','effects']);assert.equal(state.frames.length,4);row.checks.push('actual-build-manifest-native-decode-and-page-scoping');
   const pixels=Uint8Array.from(await page.evaluate(()=>Array.from(globalThis.__egretAtlasPages.readback())));assert.equal(pixels.length,480*140*4);const points=[];for(const [x,y,rgba] of referencePixels){const actual=Array.from(pixels.slice((y*480+x)*4,(y*480+x)*4+4));assert.deepEqual(actual,rgba,'Literal pixel '+x+','+y);points.push({x,y,reference:rgba,actual});}row.pixels={bytes:pixels.length,sha256:sha(pixels),points};fs.writeFileSync(path.join(out,backend+'.rgba'),pixels);await page.locator('#scene').screenshot({path:path.join(out,backend+'.png')});row.checks.push('seven-predeclared-zero-tolerance-trim-rotation-pixels');
  }else if(mode==='http-failure'){
   const failed=await page.evaluate(()=>globalThis.__egretAtlasPages.ready.then(()=>false,()=>true));assert.equal(failed,true);assert.equal((await call(page,'inspect')).state,'failed');row.checks.push('actual-http-failure-no-partial-ready');
  }else{
   await Promise.race([observed,new Promise((_,reject)=>setTimeout(()=>reject(Error('Pending page not observed')),15000))]);const closing=call(page,'close');release();await closing;row.checks.push('close-during-actual-held-page-fetch');
  }
  const closed=await call(page,'close');assert.equal(closed.state,'closed');assert.equal(closed.loaderDisposed,true);for(const counters of [closed.loader.source.current,closed.loader.provider.current])for(const [name,value]of Object.entries(counters))assert.equal(value,0,'Closed '+name);if(mode==='ordinary')assert.deepEqual(closed.errors,[]);assert.deepEqual(errors,[]);row.closed=closed;row.checks.push('owned-loader-and-host-close');row.status='PASS';await context.close();context=undefined;
 }
 for(const pin of sources.values())assert.equal(sha(fs.readFileSync(physical(pin.path))),pin.sha256);result.sources=[...sources.values()].sort((a,b)=>a.path.localeCompare(b.path));result.status='PASS';
}catch(error){result.status='FAIL';result.failure={message:error.message,stack:error.stack};process.exitCode=1;if(context){try{result.failedState=await call(context.pages()[0],'inspect');result.cleanup=await call(context.pages()[0],'close');await context.pages()[0].screenshot({path:path.join(out,'failed.png')});}catch{}}}
finally{await context?.close();await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));result.endedUtc=new Date().toISOString();fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(result,null,2)+'\n');}
console.log(JSON.stringify({status:result.status,reports:reports.map(r=>({backend:r.backend,mode:r.mode,status:r.status,checks:r.checks.length})),failure:result.failure}));
