// SPDX-License-Identifier: Apache-2.0
// Replaces the asset of a playing character and keeps its playback, in a real page on both backends.
//
//   node examples/spine-reset/verify-preserve.mjs <absolute Playwright index.mjs> <new absolute output directory> [software]
//
// Without the third argument the installed Edge is launched headed, as verify.mjs does. With `software` the
// browser that Playwright bundles runs headless with software rendering; the report names which one ran.
import fs from 'node:fs';import path from 'node:path';import {fileURLToPath,pathToFileURL} from 'node:url';import assert from 'node:assert/strict';import {PNG} from 'pngjs';
import {createExampleServer} from '../../tools/serve-example.mjs';import {author} from './author.mjs';

const root=fileURLToPath(new URL('../..',import.meta.url)),[playwrightPath,out,renderer]=process.argv.slice(2);
if(!playwrightPath||!out||!path.isAbsolute(playwrightPath)||!path.isAbsolute(out)||fs.existsSync(out)||![undefined,'software'].includes(renderer))
 throw new Error('Usage: node examples/spine-reset/verify-preserve.mjs <absolute Playwright index.mjs> <new absolute output directory> [software]');
author(path.join(root,'work/spine-reset'));fs.mkdirSync(out,{recursive:true});
const {chromium}=await import(pathToFileURL(playwrightPath).href),server=createExampleServer(root);
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const software=['--enable-unsafe-webgpu','--enable-features=Vulkan','--use-webgpu-adapter=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'];
const report={profile:'spine-preserve-native/1',node:process.version,renderer:renderer==='software'?'bundled Chromium, headless, software rendering':'installed Edge, headed, default launch',cases:[],
 limits:['One slot and one track','Host submit may fail after draw issue; no CPU/GPU rollback','No Editor export, phone or performance acceptance']};
const red=[255,0,0,255],green=[0,255,0,255],yellow=[255,255,0,255],blue=[0,0,255,255],black=[0,0,0,255];
// The root moves 6 units in 0.1 s. After 0.06 s the body's centre is 3.6 right of where it starts, at x = 19.6.
// Version two's body is 12 wide: it covers x = 24 when its time was kept, and x = 11 when it began again.
const kept=[[24,24],[11,24],[19,12],[48,24],[1,1]];
function colours(bytes,width,points){return points.map(([x,y])=>Array.from(bytes.slice((y*width+x)*4,(y*width+x)*4+4)));}
function same(actual,expected,label){assert.ok(actual.every((pixel,index)=>pixel.every((value,channel)=>Math.abs(value-expected[index][channel])<=1)),label+': '+JSON.stringify(actual)+' expected '+JSON.stringify(expected));}
let browser;
try{
 browser=await chromium.launch(renderer==='software'?{args:software}:{channel:'msedge',headless:false});report.browser=browser.version();
 for(const backend of ['webgpu','webgl2']){
  const context=await browser.newContext({viewport:{width:1000,height:850},deviceScaleFactor:1}),page=await context.newPage(),row={backend,status:'INCOMPLETE',errors:[],checks:[]};
  report.cases.push(row);page.on('pageerror',error=>row.errors.push(String(error)));page.setDefaultTimeout(30000);
  const call=(name,...args)=>page.evaluate(([name,args])=>window.api[name](...args),[name,args]);
  const shot=async(label,expected)=>{const png=PNG.sync.read(await page.locator('canvas').screenshot());fs.writeFileSync(path.join(out,backend+'-'+label+'.rgba'),png.data);assert.equal(png.width,64);same(colours(png.data,64,kept),expected,backend+' '+label);row.checks.push(label);};
  const track=state=>state.active.snapshot.tracks[0];
  try{
   await page.goto('http://127.0.0.1:'+server.address().port+'/examples/spine-reset/index.html?backend='+backend);
   await page.evaluate(async()=>{window.api=await import('./main.mjs');return window.api.ready;});
   // A command that has not been applied is not a position to continue from.
   await call('skin');
   const refused=await page.evaluate(()=>window.api.preserve().then(()=>'accepted',error=>error.code));
   assert.equal(refused,'SPINE_RESET_PRESERVE_STATE');assert.equal((await call('inspect')).active.version,'v1');
   row.checks.push('pending-command-refused');
   for(let index=0;index<3;index++)await call('step',.02);
   const before=await call('inspect');
   assert.equal(before.active.version,'v1');assert.ok(Math.abs(track(before).trackTime-.06)<1e-9);assert.deepEqual(before.active.snapshot.skins,['hat']);
   await shot('playing-v1',[red,black,blue,red,black]);

   const staged=await call('preserve');
   assert.equal(staged.ready.generation,staged.session.generation);assert.equal(staged.active.version,'v1');
   await shot('staged-old',[red,black,blue,red,black]);
   const cpu=await call('commit');
   // The new player stands where the old one stood: same tracks, skins and tick, and nothing delivered for the change.
   assert.equal(cpu.active.version,'v2');assert.equal(cpu.active.ownership,'owned');
   assert.deepEqual(cpu.active.snapshot.tracks,before.active.snapshot.tracks);assert.deepEqual(cpu.active.snapshot.skins,['hat']);
   assert.equal(cpu.active.snapshot.tickId,before.active.snapshot.tickId);assert.deepEqual(cpu.active.snapshot.events,[]);
   assert.equal(cpu.events.filter(event=>event.owner==='replacement').length,0);assert.equal(cpu.initialDisposed,false);
   await shot('cpu-only-old',[red,black,blue,red,black]);row.checks.push('cpu-commit-keeps-playback');
   const submitted=await call('submit');assert.equal(submitted.generation,submitted.session.generation);
   // Green where a body that kept its time is, nothing where one that began again would be.
   await shot('submitted-v2-kept',[green,black,yellow,red,black]);

   // The loop goes on from 0.06 s: its end and its first beat come next, and the beat at 0.05 s is not delivered twice.
   for(let index=0;index<3;index++)await call('step',.02);
   let heard=(await call('inspect')).events;
   // Authored times are stored as single-precision values.
   const times=owner=>heard.filter(event=>event.owner===owner&&event.kind==='event').map(event=>Math.round(event.event.time*1e6)/1e6),replacement=()=>times('replacement');
   assert.deepEqual(replacement(),[0]);assert.equal(heard.filter(event=>event.owner==='replacement'&&event.kind==='complete').length,1);
   for(let index=0;index<2;index++)await call('step',.02);
   heard=(await call('inspect')).events;assert.deepEqual(replacement(),[0,.05]);
   assert.deepEqual(times('initial'),[0,.05]);
   row.checks.push('events-continue-without-replay');

   // Back to version one from a player the slot owns: the owned predecessor retires, the playback is kept again.
   const again=await call('inspect');await call('preserve','v1');
   const back=await call('commit');
   assert.equal(back.active.version,'v1');assert.deepEqual(back.active.snapshot.tracks,again.active.snapshot.tracks);assert.equal(back.previousOwnedDisposed,true);
   assert.equal(back.loaders.v2.liveInstances,0);await call('submit');row.checks.push('owned-predecessor-retired');
   const closed=await call('close');assert.equal(closed.phase,'closed');assert.equal(closed.loaders.v1.liveInstances,0);row.checks.push('closed');
   assert.deepEqual(row.errors,[]);row.status='PASS';
  }catch(error){row.status='FAIL';row.error=String(error.stack??error);await page.screenshot({path:path.join(out,backend+'-stopped.png')}).catch(()=>{});}
  await context.close();
 }
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
report.status=report.cases.length===2&&report.cases.every(row=>row.status==='PASS')?'PASS':'FAIL';
fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({status:report.status,browser:report.browser,renderer:report.renderer,cases:report.cases.map(row=>({backend:row.backend,status:row.status,checks:row.checks.length,error:row.error?.split('\n').slice(0,2).join(' | ')}))}));
if(report.status!=='PASS')process.exitCode=1;
