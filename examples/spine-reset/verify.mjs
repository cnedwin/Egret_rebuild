// SPDX-License-Identifier: Apache-2.0
// Actual ordinary example operations, genuine Host staging, no native interception.
import fs from 'node:fs';import path from 'node:path';import {fileURLToPath,pathToFileURL} from 'node:url';import assert from 'node:assert/strict';import {PNG} from 'pngjs';
import {createExampleServer} from '../../tools/serve-example.mjs';import {fingerprintFile,samePhysicalPath,ownerRelativePath} from '../../tools/lib/file-identity.mjs';import {author} from './author.mjs';
const root=fileURLToPath(new URL('../..',import.meta.url));
export async function verify({playwrightPath,out}){
 assert.equal(process.version,'v26.7.0');assert.equal(process.execArgv.length,0);assert.ok(!process.env.NODE_OPTIONS&&!process.env.NODE_PATH);
 assert.equal(JSON.parse(fs.readFileSync(path.join(path.dirname(playwrightPath),'package.json'),'utf8')).version,'1.62.1');
 assert.ok(path.isAbsolute(out)&&!fs.existsSync(out));let within=samePhysicalPath(root,out);try{ownerRelativePath(root,out);within=true;}catch(error){if(!(error instanceof RangeError))throw error;}assert.equal(within,false);
 author(path.join(root,'work/spine-reset'));fs.mkdirSync(out,{recursive:true});
 const initial=new Map(),used=new Set(),requests=[];
 function collect(dir){for(const item of fs.readdirSync(path.join(root,dir),{withFileTypes:true})){const file=dir+'/'+item.name;if(item.isDirectory())collect(file);else if(item.isFile())initial.set(file,fingerprintFile(root,file));}}
 for(const dir of ['packages/engine/dist','packages/runtime/dist','packages/contracts/dist','packages/spine/dist','examples/spine-reset','work/spine-reset','node_modules/robust-predicates','node_modules/@esotericsoftware/spine-core/dist'])collect(dir);
 const fixed=['examples/spine-reset/verify.mjs','examples/spine-reset/author.mjs','examples/spine-reset/content.mjs','tools/serve-example.mjs','tools/lib/local-package.mjs','tools/lib/file-identity.mjs','node_modules/robust-predicates/package.json','node_modules/@esotericsoftware/spine-core/package.json','node_modules/pngjs/package.json','package.json','packages/contracts/package.json'];
 for(const file of fixed){initial.set(file,fingerprintFile(root,file));used.add(file);}
 const {chromium}=await import(pathToFileURL(playwrightPath).href),server=createExampleServer(root);
 server.on('request',req=>{let file=new URL(req.url,'http://local').pathname.slice(1);if(file.startsWith('vendor/robust-predicates/'))file='node_modules/robust-predicates/'+file.slice('vendor/robust-predicates/'.length);if(file.startsWith('vendor/spine-core/'))file='node_modules/@esotericsoftware/spine-core/dist/'+file.slice('vendor/spine-core/'.length);assert.ok(initial.has(file),'Unfrozen input '+file);used.add(file);requests.push(file);});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const report={profile:'spine-reset-native/1',node:process.version,launch:{channel:'msedge',headless:false,additionalFlags:[]},cases:[],failures:[],limits:['One CPU RESET slot','Host submit may fail after draw issue; no CPU/GPU rollback','No device recovery, Editor export, phone or performance acceptance']};
 const points=[[12,24],[16,12],[48,24],[48,12],[1,1]],expected={v1:[[255,0,0,255],[0,0,255,255],[255,0,0,255],[0,0,255,255],[0,0,0,255]],v2:[[0,255,0,255],[255,255,0,255],[255,0,0,255],[0,0,255,255],[0,0,0,255]]};
 function match(bytes,kind){assert.equal(bytes.length,64*48*4);return points.every(([x,y],i)=>expected[kind][i].every((v,c)=>Math.abs(bytes[(y*64+x)*4+c]-v)<=1));}
 let browser;
 try{
  browser=await chromium.launch({channel:'msedge',headless:false});report.browser=browser.version();
  for(const backend of ['webgpu','webgl2']){
   const context=await browser.newContext({viewport:{width:1000,height:850},deviceScaleFactor:1}),page=await context.newPage(),row={backend,errors:[],checks:[]};report.cases.push(row);page.on('pageerror',e=>row.errors.push(String(e)));page.setDefaultTimeout(30000);
   try{
    await page.goto('http://127.0.0.1:'+server.address().port+'/examples/spine-reset/index.html?backend='+backend);
    const pixels=await page.evaluate(async()=>{window.api=await import('./main.mjs');return window.api.ready;});
    const save=(label,p,kind)=>{fs.writeFileSync(path.join(out,backend+'-'+label+'.rgba'),Buffer.from(p.bytes));assert.ok(match(p.bytes,kind),backend+' '+label+' expected '+kind);row.checks.push(label);};
    const shot=async(label,kind)=>{const b=await page.locator('canvas').screenshot();fs.writeFileSync(path.join(out,backend+'-'+label+'.png'),b);const p=PNG.sync.read(b);assert.equal(p.width,64);assert.equal(p.height,48);assert.ok(match(p.data,kind),backend+' '+label+' expected '+kind);row.checks.push(label);};
    save('initial',pixels,'v1');row.failed=await page.evaluate(()=>window.api.fail());assert.equal(row.failed.active.version,'v1');assert.equal(row.failed.lastError,'SPINE_INSTANCE_ANIMATION_INVALID');await shot('failed-old','v1');
    row.staged=await page.evaluate(()=>window.api.prepare());assert.equal(row.staged.ready.generation,row.staged.session.generation);assert.equal(row.staged.active.version,'v1');await shot('staged-old','v1');
    row.cancelled=await page.evaluate(()=>window.api.cancel());assert.equal(row.cancelled.initialDisposed,false);await shot('cancelled-old','v1');
    save('cancelled-candidate-replay',await page.evaluate(()=>window.api.replayCandidate()),'v2');save('old-replay',await page.evaluate(()=>window.api.replayOld()),'v1');
    await page.evaluate(()=>window.api.prepare());row.stale=await page.evaluate(()=>window.api.stale());assert.equal(row.stale.code,'DISPLAY_SUBTREE_STALE');assert.equal(row.stale.active.version,'v1');await shot('stale-old','v1');
    await page.evaluate(()=>window.api.prepare());row.cpu=await page.evaluate(()=>window.api.commit());assert.equal(row.cpu.active.version,'v2');assert.equal(row.cpu.active.snapshot.tickId,0);assert.deepEqual(row.cpu.active.snapshot.events,[]);assert.equal(row.cpu.initialDisposed,false);assert.equal(row.cpu.siblingDisposed,false);await shot('cpu-only-old','v1');
    row.submitted=await page.evaluate(()=>window.api.submit());assert.equal(row.submitted.generation,row.submitted.session.generation);await shot('submit-direct-v2','v2');save('submitted-v2',await page.evaluate(()=>window.api.pixels()),'v2');
    await page.evaluate(()=>window.api.prepare('v1'));row.retired=await page.evaluate(()=>window.api.commit());assert.equal(row.retired.previousOwnedDisposed,true);assert.equal(row.retired.siblingDisposed,false);assert.equal(row.retired.groupDisposed,false);assert.equal(row.retired.loaders.v2.liveInstances,0);assert.equal(row.retired.loaders.v2.groups,0);await shot('owned-retired-before-submit','v2');
    await page.evaluate(()=>window.api.submit());await shot('submit-direct-v1','v1');const wrong=await page.evaluate(()=>window.api.pixels());save('second-version-v1',wrong,'v1');assert.equal(match(wrong.bytes,'v2'),false);row.checks.push('wrong-version-control-rejected');
    save('retired-v2-replay',await page.evaluate(()=>window.api.replayRetired()),'v2');save('initial-borrowed-replay',await page.evaluate(()=>window.api.replayOld()),'v1');
    row.closed=await page.evaluate(()=>window.api.close());assert.equal(row.closed.phase,'closed');assert.equal(row.closed.host.host.pendingFrames,0);assert.equal(row.closed.host.host.state,'closed');
    for(const loader of Object.values(row.closed.loaders))for(const [key,value]of Object.entries(loader))assert.equal(value,key==='isDisposed'?true:0,key);
    assert.deepEqual(row.closed.diagnostics,[]);assert.deepEqual(row.errors,[]);row.passed=true;
   }catch(error){row.failure=String(error.stack??error);report.failures.push({backend,error:row.failure});}
   finally{await context.close();}
  }
 }finally{
  await browser?.close();await new Promise(resolve=>server.close(resolve));report.browserClosed=true;report.serverClosed=true;report.requests=requests;report.status=report.failures.length?'FAIL':'PASS';
  // The author's public contracts/resources static closure is also requested by
  // the browser. Refuse missing Node-side first-party inputs instead of inferring coverage.
  const nodeSeen=new Set();
  function nodeClosure(file){if(nodeSeen.has(file))return;nodeSeen.add(file);assert.ok(used.has(file),'Node author input absent from executed pins: '+file);const source=fs.readFileSync(path.join(root,file),'utf8');for(const m of source.matchAll(/(?:import|export)\s+[^;]*?\sfrom\s*['"]([^'"]+)['"]/g)){if(m[1].startsWith('.'))nodeClosure(path.posix.normalize(path.posix.join(path.posix.dirname(file),m[1])));}}
  nodeClosure('packages/contracts/dist/resources/index.js');
  report.externalTools={playwright:'1.62.1',pngjs:'7.0.0',scope:'Installed Playwright/PNG authoring and screenshot decoder are external tools; package versions are checked, not every tool implementation byte.'};
  const pins=[...used].sort().map(file=>{assert.deepEqual(fingerprintFile(root,file),initial.get(file),'Changed executed input '+file);return initial.get(file);});fs.writeFileSync(path.join(out,'inputs.json'),JSON.stringify({profile:'spine-reset-executed-inputs/1',pins},null,2)+'\n');fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(report,null,2)+'\n');
 }
 if(report.failures.length)throw Error('Native RESET failed: '+out);return report;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){if(process.argv.length!==4)throw Error('Usage: node verify.mjs <Playwright index.mjs> <new absolute output directory>');await verify({playwrightPath:path.resolve(process.argv[2]),out:path.resolve(process.argv[3])});console.log('Spine RESET native PASS');}
