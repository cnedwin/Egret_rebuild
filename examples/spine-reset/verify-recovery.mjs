// SPDX-License-Identifier: Apache-2.0
// Fixed actual native loss routes and ordinary application recovery.
import fs from 'node:fs';import path from 'node:path';import {fileURLToPath,pathToFileURL} from 'node:url';import assert from 'node:assert/strict';import {PNG} from 'pngjs';
import {createExampleServer} from '../../tools/serve-example.mjs';import {fingerprintFile,samePhysicalPath,ownerRelativePath} from '../../tools/lib/file-identity.mjs';import {author} from './author.mjs';
const root=fileURLToPath(new URL('../..',import.meta.url));
// A collector deadline stops waiting, never settles or substitutes browser/native work.
// Promise.race observes late rejection; finally clears the timer on every early result.
async function bounded(label,promise,ms=15000){
 let timer;const deadline=new Promise((_,reject)=>{timer=setTimeout(()=>reject(Object.assign(Error('COLLECTOR_DEADLINE:'+label),{incomplete:true,operation:label,timeoutMs:ms})),ms);});
 try{return await Promise.race([promise,deadline]);}finally{clearTimeout(timer);}
}
export async function verify({playwrightPath,out}){
 assert.equal(JSON.parse(fs.readFileSync(path.join(root,'node_modules/pngjs/package.json'),'utf8')).version,'7.0.0');assert.equal(process.version,'v26.7.0');assert.equal(process.execArgv.length,0);assert.ok(!process.env.NODE_OPTIONS&&!process.env.NODE_PATH);
 assert.equal(JSON.parse(fs.readFileSync(path.join(path.dirname(playwrightPath),'package.json'),'utf8')).version,'1.62.1');
 assert.ok(path.isAbsolute(out)&&!fs.existsSync(out));let within=samePhysicalPath(root,out);try{ownerRelativePath(root,out);within=true;}catch(error){if(!(error instanceof RangeError))throw error;}assert.equal(within,false);
 author(path.join(root,'work/spine-reset'));fs.mkdirSync(out,{recursive:true});
 const initial=new Map(),used=new Set(),requests=[];
 function collect(dir){for(const item of fs.readdirSync(path.join(root,dir),{withFileTypes:true})){const file=dir+'/'+item.name;if(item.isDirectory())collect(file);else if(item.isFile())initial.set(file,fingerprintFile(root,file));}}
 for(const dir of ['packages/engine/dist','packages/runtime/dist','packages/contracts/dist','packages/spine/dist','examples/spine-reset','work/spine-reset','node_modules/robust-predicates','node_modules/@esotericsoftware/spine-core/dist'])collect(dir);
 const fixed=['examples/spine-reset/verify-recovery.mjs','packages/contracts/dist/resources/index.js','packages/contracts/dist/resources/manifestAdmission.js','packages/contracts/dist/resources/sha256.js','examples/spine-reset/author.mjs','examples/spine-reset/content.mjs','tools/serve-example.mjs','tools/lib/local-package.mjs','tools/lib/file-identity.mjs','node_modules/robust-predicates/package.json','node_modules/@esotericsoftware/spine-core/package.json','node_modules/pngjs/package.json','package.json','packages/contracts/package.json'];
 for(const file of fixed){initial.set(file,fingerprintFile(root,file));used.add(file);}
 // The observer is a browser input only; the three contracts modules above already ran in the Node author.
 initial.set('tools/shared-rendering/resource-recovery-observations.mjs',fingerprintFile(root,'tools/shared-rendering/resource-recovery-observations.mjs'));
 const {chromium}=await import(pathToFileURL(playwrightPath).href),server=createExampleServer(root);
 server.on('request',req=>{let file=new URL(req.url,'http://local').pathname.slice(1);if(file.startsWith('vendor/robust-predicates/'))file='node_modules/robust-predicates/'+file.slice('vendor/robust-predicates/'.length);if(file.startsWith('vendor/spine-core/'))file='node_modules/@esotericsoftware/spine-core/dist/'+file.slice('vendor/spine-core/'.length);requests.push(file);if(!initial.has(file)){report.failures.push({phase:'input-closure',file,error:'Unfrozen browser request'});return;}used.add(file);});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const report={profile:'spine-recovery-native/1',node:process.version,launch:{channel:'msedge',headless:false,additionalFlags:[]},cases:[],failures:[],limits:['One CPU RESET slot','Host submit may fail after draw issue; no CPU/GPU rollback','Controlled real GPUDevice.destroy / WEBGL_lose_context only; no spontaneous driver, phone, Editor export or performance acceptance']};
 const points=[[18,24],[18,12],[48,24],[48,12],[1,1]],expected={v1:[[255,0,0,255],[0,0,255,255],[255,0,0,255],[0,0,255,255],[0,0,0,255]],v2:[[0,255,0,255],[255,255,0,255],[255,0,0,255],[0,0,255,255],[0,0,0,255]]};
 function match(bytes,kind){assert.equal(bytes.length,64*48*4);return points.every(([x,y],i)=>expected[kind][i].every((v,c)=>Math.abs(bytes[(y*64+x)*4+c]-v)<=1));}
 let browser;
 try{
  browser=await chromium.launch({channel:'msedge',headless:false});report.browser=browser.version();
  // One harness-only deadline control. This creates no GPU and simulates no loss.
  const controlContext=await browser.newContext(),controlPage=await controlContext.newPage();
  report.deadlineControl={scope:'Owned page Promise never resolves; not GPU/native fault simulation',expectedDeadline:false,originalPromiseSettled:false,realmClosed:false};
  try{
   try{await bounded('harness-never-resolves',controlPage.evaluate(()=>{window.harnessEntered=true;return new Promise(()=>{});}),250);throw Error('DEADLINE_NOT_OBSERVED');}
   catch(error){if(!error.incomplete)throw error;report.deadlineControl.expectedDeadline=true;report.deadlineControl.timeoutMs=error.timeoutMs;}
   assert.equal(await bounded('harness-snapshot',controlPage.evaluate(()=>window.harnessEntered),2000),true);
  }finally{await bounded('harness-realm-close',controlContext.close(),5000);report.deadlineControl.realmClosed=true;}

  for(const backend of ['webgpu','webgl2']){
   const context=await browser.newContext({viewport:{width:1000,height:850},deviceScaleFactor:1}),page=await context.newPage(),row={backend,errors:[],checks:[]};report.cases.push(row);page.on('pageerror',e=>row.errors.push(String(e)));page.setDefaultTimeout(30000);
   const evaluate=(fn,arg)=>bounded(backend+':evaluate',page.evaluate(fn,arg));
   try{

    // Delay only the application's module loading so the existing observer is installed
    // before genuine Host startup. No product/native method or promise is substituted.
    await page.route('**/examples/spine-reset/index.html?*',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text()).replace('<script type="module" src="./main.mjs"></script>','')});});
    await page.goto('http://127.0.0.1:'+server.address().port+'/examples/spine-reset/index.html?backend='+backend);
    const initialPixels=await evaluate(async backend=>{window.native=(await import('./recovery-native.mjs')).install(backend);window.api=await import('./main.mjs');return window.api.ready;},backend);
    const save=(label,p,kind)=>{fs.writeFileSync(path.join(out,backend+'-'+label+'.rgba'),Buffer.from(p.bytes));assert.ok(match(p.bytes,kind),backend+' '+label+' expected '+kind);row.checks.push(label);};
    const shot=async(label,kind)=>{const b=await page.locator('canvas').screenshot();fs.writeFileSync(path.join(out,backend+'-'+label+'.png'),b);const p=PNG.sync.read(b);assert.equal(p.width,64);assert.equal(p.height,48);assert.ok(match(p.data,kind),backend+' '+label+' expected '+kind);row.checks.push(label);};
    const sameCpu=(a,b)=>{assert.deepEqual(b.active,a.active);assert.deepEqual(b.sibling,a.sibling);assert.deepEqual(b.events,a.events);assert.deepEqual(b.clock,a.clock);assert.deepEqual(b.loaders,a.loaders);assert.equal(b.groupDisposed,false);assert.equal(b.siblingDisposed,false);};
    const loss=async()=>{const before=await evaluate(()=>window.api.session());const proof=await evaluate(g=>window.native.lose(g),before.generation);row.losses??=[];row.losses.push({generation:before.generation,proof});return before.generation;};
    const restore=async()=>{await evaluate(()=>window.native.restore());return evaluate(()=>window.api.recover());};
    save('initial',initialPixels,'v1');
    await evaluate(()=>{window.api.skin();window.api.advance(.06);});
    // A nonzero genuine track, explicit skin and consumed authored event precede loss.
    row.before=await evaluate(()=>window.api.inspect());assert.ok(row.before.active.snapshot.elapsedSeconds>0);assert.equal(row.before.active.snapshot.skin,'hat');assert.ok(row.before.active.snapshot.tracks[0].trackTime>0);assert.ok(row.before.events.some(e=>e.kind==='event'));
    save('running-before',await evaluate(()=>window.api.pixels()),'v1');
    const g1=await loss();row.recovered=await restore();sameCpu(row.before,row.recovered);assert.equal(row.recovered.session.generation,g1+1);assert.equal(row.recovered.flow.nativeSettled,true);await shot('running-restored','v1');
    save('running-readback',await evaluate(()=>window.api.pixels()),'v1');
    row.continued=await evaluate(()=>window.api.advance(.01));assert.ok(row.continued.active.snapshot.tickId>row.before.active.snapshot.tickId);assert.deepEqual(row.continued.events,row.before.events);
    // A ready upload in the old Host generation cannot authorize the CPU RESET.
    await evaluate(()=>window.api.prepareRecovery());const pendingBefore=await evaluate(()=>window.api.inspect());await loss();
    row.stale=await evaluate(()=>{try{window.api.commitRecovery();return {accepted:true};}catch(e){return {code:e.code,state:window.api.inspect()};}});assert.equal(row.stale.code,'FLOW_STALE_GENERATION');assert.equal(row.stale.state.flow.cpuPublished,false);assert.deepEqual(row.stale.state.active,pendingBefore.active);
    row.precommitRecovery=await restore();assert.deepEqual(row.precommitRecovery.active,pendingBefore.active);assert.deepEqual(row.precommitRecovery.events,pendingBefore.events);await shot('stale-preserved','v1');
    // Retry intentionally resets, then nonzero gameplay advances independently again.
    await evaluate(()=>window.api.replace());await evaluate(()=>window.api.advance(.06));save('owned-running',await evaluate(()=>window.api.pixels()),'v2');
    row.ownedBefore=await evaluate(()=>window.api.inspect());await loss();row.ownedAfter=await restore();sameCpu(row.ownedBefore,row.ownedAfter);assert.equal(row.ownedAfter.active.ownership,'owned');await shot('owned-restored','v2');
    // CPU publication before loss remains published. Recovery uses that actual player.
    await evaluate(()=>window.api.prepareRecovery('v1'));row.cpu=await evaluate(()=>window.api.commitRecovery());assert.equal(row.cpu.flow.cpuPublished,true);assert.equal(row.cpu.flow.nativeSubmitted,false);await loss();
    row.postcommit=await evaluate(async()=>{try{await window.api.submitRecovery();return {accepted:true};}catch(e){return {code:e.code,state:window.api.inspect()};}});assert.equal(row.postcommit.code,'FLOW_STALE_GENERATION');assert.equal(row.postcommit.state.flow.cpuPublished,true);assert.equal(row.postcommit.state.flow.nativeSubmitted,false);
    row.postcommitRecovery=await restore();sameCpu(row.cpu,row.postcommitRecovery);await shot('postcommit-restored','v1');save('postcommit-readback',await evaluate(()=>window.api.pixels()),'v1');
    await evaluate(()=>window.api.prepareRecovery());row.cancelled=await evaluate(()=>window.api.cancelRecovery());assert.equal(row.cancelled.flow.phase,'cancelled');assert.equal(row.cancelled.active.version,'v1');
    // Close with one genuine ready-held upload. Original Host work must settle.
    await evaluate(()=>window.api.prepareRecovery());await evaluate(()=>window.native.closing());row.closed=await evaluate(()=>window.api.close());row.nativeClosed=await evaluate(async()=>{const value=await window.native.close();window.nativeClosed=true;return value;});
    assert.equal(row.closed.phase,'closed');assert.equal(row.closed.flow.closed,true);assert.equal(row.closed.host.host.pendingFrames,0);assert.equal(row.closed.host.host.state,'closed');
    for(const loader of Object.values(row.closed.loaders))for(const [key,value]of Object.entries(loader))assert.equal(value,key==='isDisposed'?true:0,key);
    if(backend==='webgpu'){assert.equal(row.nativeClosed.issuedRequests,5);assert.equal(row.nativeClosed.restored,true);assert.equal(row.nativeClosed.pendingRequests,0);assert.equal(row.nativeClosed.pendingLost,0);assert.deepEqual(row.nativeClosed.failures,[]);}
    assert.deepEqual(row.errors,[]);row.passed=true;
   }catch(error){row.failure=String(error.stack??error);row.incomplete=Boolean(error.incomplete);if(row.incomplete)row.unsettledNative='unknown';report.failures.push({backend,error:row.failure,incomplete:row.incomplete});}
   finally{
    try{const cleanup=await evaluate(async()=>{const failures=[];window.native?.closing();try{await window.api?.close();}catch(e){failures.push(String(e));}try{if(!window.nativeClosed){await window.native?.close();window.nativeClosed=true;}}catch(e){failures.push(String(e));}return {failures,observations:window.native?.snapshot()};});row.cleanup=cleanup;for(const failure of cleanup.failures)report.failures.push({backend,cleanup:failure});}
    catch(error){row.cleanupError=String(error);row.cleanup={incomplete:true,unsettledNative:'unknown',hostClosed:'unverified',descriptorRestored:'unverified'};report.failures.push({backend,cleanup:row.cleanupError,incomplete:true});}
    // Snapshot failure cannot prevent independent realm disposal.
    try{row.finalObservation=await bounded(backend+':final-snapshot',page.evaluate(()=>({application:window.api?.inspect(),native:window.native?.snapshot()})),2000);}
    catch(error){row.snapshotError=String(error);report.failures.push({backend,snapshot:row.snapshotError,incomplete:true});}
    try{await bounded(backend+':realm-close',context.close(),5000);row.realmClosed=true;}
    catch(error){row.realmClosed=false;report.failures.push({backend,realmClose:String(error),incomplete:true});}
   }
  }
 }catch(error){report.failures.push({phase:'collector',error:String(error.stack??error),incomplete:Boolean(error.incomplete)});}
 finally{
  try{if(browser){await bounded('browser-close',browser.close(),5000);report.browserClosed=true;}}catch(error){report.browserClosed=false;report.failures.push({phase:'browser-close',error:String(error),incomplete:true});}
  try{await bounded('server-close',new Promise(resolve=>server.close(resolve)),5000);report.serverClosed=true;}catch(error){report.serverClosed=false;report.failures.push({phase:'server-close',error:String(error),incomplete:true});}
  report.requests=requests;report.status=report.failures.some(value=>value.incomplete)?'INCOMPLETE':report.failures.length?'FAIL':'PASS';
  // The author's public contracts/resources static closure is also requested by
  // the browser. Refuse missing Node-side first-party inputs instead of inferring coverage.
  const nodeSeen=new Set();
  function nodeClosure(file){if(nodeSeen.has(file))return;nodeSeen.add(file);assert.ok(used.has(file),'Node author input absent from executed pins: '+file);const source=fs.readFileSync(path.join(root,file),'utf8');for(const m of source.matchAll(/(?:import|export)\s+[^;]*?\sfrom\s*['"]([^'"]+)['"]/g)){if(m[1].startsWith('.'))nodeClosure(path.posix.normalize(path.posix.join(path.posix.dirname(file),m[1])));}}
  try{nodeClosure('packages/contracts/dist/resources/index.js');}catch(error){report.failures.push({phase:'node-input-closure',error:String(error)});}
  report.externalTools={playwright:'1.62.1',pngjs:'7.0.0',scope:'Installed Playwright/PNG authoring and screenshot decoder are external tools; package versions are checked, not every tool implementation byte.'};
  const pins=[];
  for(const file of [...used].sort()){
   const frozen=initial.get(file);if(frozen)pins.push(frozen);
   try{assert.deepEqual(fingerprintFile(root,file),frozen,'Changed executed input '+file);}
   catch(error){report.failures.push({phase:'input-integrity',file,error:String(error)});}
  }
  report.status=report.failures.some(value=>value.incomplete)?'INCOMPLETE':report.failures.length?'FAIL':'PASS';
  fs.writeFileSync(path.join(out,'inputs.json'),JSON.stringify({profile:'spine-recovery-executed-inputs/1',pins},null,2)+'\n');
  fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(report,null,2)+'\n');
 }
 if(report.failures.length)throw Error('Native recovery failed: '+out);return report;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){if(process.argv.length!==4)throw Error('Usage: node verify.mjs <Playwright index.mjs> <new absolute output directory>');await verify({playwrightPath:path.resolve(process.argv[2]),out:path.resolve(process.argv[3])});console.log('Spine recovery native PASS');}
