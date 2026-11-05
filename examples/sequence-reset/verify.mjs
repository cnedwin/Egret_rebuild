// SPDX-License-Identifier: Apache-2.0
// Finite literal pixel collector for real shared Hosts, with pre-launch input identities.
import fs from 'node:fs';import path from 'node:path';import {fileURLToPath,pathToFileURL} from 'node:url';import assert from 'node:assert/strict';import {PNG} from 'pngjs';
import {createExampleServer} from '../../tools/serve-example.mjs';import {fingerprintFile,samePhysicalPath,ownerRelativePath,canonicalTextBytes} from '../../tools/lib/file-identity.mjs';import {author} from './author.mjs';
const root=fileURLToPath(new URL('../..',import.meta.url));
export async function verify({playwrightPath,out}){
 assert.equal(process.version,'v26.7.0');assert.equal(process.execArgv.length,0);assert.ok(!process.env.NODE_OPTIONS&&!process.env.NODE_PATH);
 assert.equal(JSON.parse(fs.readFileSync(path.join(path.dirname(playwrightPath),'package.json'),'utf8')).version,'1.62.1');
 assert.ok(path.isAbsolute(out)&&!fs.existsSync(out));let within=samePhysicalPath(root,out);try{ownerRelativePath(root,out);within=true;}catch(error){if(!(error instanceof RangeError))throw error;}assert.equal(within,false);
 const generatedParent=path.join(root,'work/sequence-reset');fs.mkdirSync(generatedParent,{recursive:true});const built=await author(generatedParent);fs.mkdirSync(out,{recursive:true});
 const initial=new Map(),used=new Set(),requests=[];
 function collect(dir){for(const item of fs.readdirSync(path.join(root,dir),{withFileTypes:true})){const file=dir+'/'+item.name;if(item.isDirectory())collect(file);else if(item.isFile())initial.set(file,fingerprintFile(root,file));}}
 for(const dir of ['packages/engine/dist','packages/runtime/dist','packages/contracts/dist','packages/project/dist','packages/engine/src','packages/engine/web','packages/engine/rendering','packages/runtime/src','packages/contracts/src','packages/project/src','examples/sequence-reset','examples/sequence-controls/sources','tools/content','node_modules/robust-predicates'])if(fs.existsSync(path.join(root,dir)))collect(dir);
 collect(ownerRelativePath(root,built.runRoot));
 for(const file of ['tools/serve-example.mjs','tools/build-content.mjs','tools/lib/file-identity.mjs','tools/lib/local-package.mjs','node_modules/robust-predicates/package.json','node_modules/pngjs/package.json','package.json']){initial.set(file,fingerprintFile(root,file));used.add(file);}
 for(const file of initial.keys())if(file.startsWith('packages/project/')||file.startsWith('tools/content/')||file.startsWith('examples/sequence-reset/')||file.startsWith('examples/sequence-controls/sources/'))used.add(file);
 const {chromium}=await import(pathToFileURL(playwrightPath).href),server=createExampleServer(root);
 server.on('request',req=>{let file=new URL(req.url,'http://local').pathname.slice(1);if(file.startsWith('vendor/robust-predicates/'))file='node_modules/robust-predicates/'+file.slice('vendor/robust-predicates/'.length);assert.ok(initial.has(file),'Unfrozen input '+file);used.add(file);requests.push(file);});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const report={profile:'sequence-reset-native/1',node:process.version,launch:{channel:'msedge',headless:true,additionalFlags:[]},generations:built.config,cases:[],failures:[],limits:['Finite two-instance CPU RESET and actual shared Host pixels','CPU publication has no post-submit rollback','No device recovery, phone, performance or complete M2.4 acceptance']};
 const colors={red:[255,0,0,255],green:[0,255,0,255],blue:[0,0,255,255],yellow:[255,255,0,255],cyan:[0,255,255,255],magenta:[255,0,255,255],black:[0,0,0,255]},points=[[12,12],[44,12],[1,1]];
 function match(bytes,a,b){assert.equal(bytes.length,64*32*4);const expected=[colors[a],colors[b],colors.black];for(const [i,[x,y]]of points.entries())for(let c=0;c<4;c++)assert.equal(bytes[(y*64+x)*4+c],expected[i][c],'literal sample '+i+' channel '+c);}
 let browser;
 try{
  browser=await chromium.launch({channel:'msedge',headless:true});report.browser=browser.version();
  for(const backend of ['webgpu','webgl2']){
   const context=await browser.newContext({viewport:{width:1000,height:850},deviceScaleFactor:1}),page=await context.newPage(),row={backend,errors:[],checks:[]};report.cases.push(row);page.on('pageerror',e=>row.errors.push(String(e)));page.setDefaultTimeout(30000);
   try{
    await page.goto('http://127.0.0.1:'+server.address().port+'/examples/sequence-reset/index.html?backend='+backend+'&config=/'+ownerRelativePath(root,built.runRoot)+'/config.json');
    const save=(label,p,a,b)=>{fs.writeFileSync(path.join(out,backend+'-'+label+'.rgba'),Buffer.from(p.bytes));match(p.bytes,a,b);row.checks.push(label);};
    const shot=async(label,a,b)=>{const bytes=await page.locator('canvas').screenshot();fs.writeFileSync(path.join(out,backend+'-'+label+'.png'),bytes);const png=PNG.sync.read(bytes);assert.equal(png.width,64);assert.equal(png.height,32);match(png.data,a,b);row.checks.push(label);};
    save('initial',await page.evaluate(async()=>{window.api=await import('./main.mjs');return window.api.ready;}),'red','red');
    await page.evaluate(()=>window.api.begin('v2',true));save('old-while-loading',await page.evaluate(()=>window.api.step()),'green','green');
    row.loading=await page.evaluate(()=>window.api.inspect());assert.equal(row.loading.ticket,'loading');assert.equal(row.loading.active.status.state,'running');assert.deepEqual(row.loading.events,[]);
    await page.evaluate(()=>window.api.cancel());save('cancelled-old',await page.evaluate(()=>window.api.pixels()),'green','green');
    await page.evaluate(()=>window.api.begin('v2',true));save('old-second-load',await page.evaluate(()=>window.api.step()),'blue','blue');await page.evaluate(()=>window.api.release());row.staged=await page.evaluate(()=>window.api.stage());assert.equal(row.staged.active.version,'v1');assert.equal(row.staged.active.status.state,'paused');assert.deepEqual(row.staged.events,[]);await shot('staged-old','blue','blue');
    await page.evaluate(()=>window.api.cancel());save('cancelled-candidate-retained',await page.evaluate(()=>window.api.replayCandidate()),'cyan','blue');save('initial-retained',await page.evaluate(()=>window.api.replayOld()),'red','red');save('old-restored',await page.evaluate(()=>window.api.pixels()),'blue','blue');
    await page.evaluate(()=>window.api.prepare());row.cpu=await page.evaluate(()=>window.api.commit());assert.equal(row.cpu.active.version,'v2');assert.equal(row.cpu.active.status.positionSeconds,0);assert.equal(row.cpu.active.status.state,'paused');assert.equal(row.cpu.initial.state,'paused');assert.deepEqual(row.cpu.events,[]);await shot('cpu-only-old','blue','blue');
    row.submitted=await page.evaluate(()=>window.api.submit());await shot('submitted-cyan','cyan','blue');save('submitted',await page.evaluate(()=>window.api.pixels()),'cyan','blue');
    await page.evaluate(()=>window.api.resume());save('resumed-quarter',await page.evaluate(()=>window.api.step()),'cyan','yellow');save('resumed-half',await page.evaluate(()=>window.api.step()),'magenta','red');row.resumed=await page.evaluate(()=>window.api.inspect());assert.deepEqual(row.resumed.events.map(e=>e.id),['half']);
    await page.evaluate(()=>window.api.prepare('v1'));row.retired=await page.evaluate(()=>window.api.commit());assert.equal(row.retired.previousOwnedDisposed,true);assert.equal(row.retired.groupDisposed,false);await shot('retired-before-submit','magenta','red');await page.evaluate(()=>window.api.submit());save('replacement-back',await page.evaluate(()=>window.api.pixels()),'red','red');
    save('owned-retained-replay',await page.evaluate(()=>window.api.replayRetired()),'magenta','red');save('borrowed-retained-replay',await page.evaluate(()=>window.api.replayOld()),'red','red');
    row.closed=await page.evaluate(()=>window.api.close());assert.equal(row.closed.phase,'closed');assert.equal(row.closed.host.host.state,'closed');assert.equal(row.closed.host.host.pendingFrames,0);assert.ok(row.closed.textures.every(Boolean));assert.equal(row.closed.groupDisposed,true);assert.equal(row.closed.initial.isDisposed,true);assert.equal(row.closed.sibling.isDisposed,true);assert.deepEqual(row.closed.diagnostics,[]);
    for(const t of Object.values(row.closed.transports)){assert.equal(t.sourceClosed,true);assert.equal(t.providerClosed,true);for(const port of [t.source,t.provider])assert.ok(Object.values(port.current).every(x=>x===0));}
    assert.deepEqual(row.errors,[]);row.passed=true;
   }catch(error){row.failure=String(error.stack??error);report.failures.push({backend,error:row.failure});}
   finally{await context.close();row.contextClosed=true;}
  }
 }finally{
  await browser?.close();await new Promise(resolve=>server.close(resolve));report.browserClosed=true;report.serverClosed=true;report.requests=requests;report.status=report.failures.length?'FAIL':'PASS';
  for(const file of [...used])if(file.startsWith('packages/')&&file.includes('/dist/')&&file.endsWith('.js')){const source=file.replace('/dist/web/','/web/').replace('/dist/rendering/','/rendering/').replace('/dist/','/src/').replace(/\.js$/,'.ts'),declaration=file.replace(/\.js$/,'.d.ts');for(const extra of [source,declaration]){assert.ok(initial.has(extra),'Source/declaration not frozen: '+extra);used.add(extra);}}
  const pins=[...used].sort().map(file=>{assert.deepEqual(fingerprintFile(root,file),initial.get(file),'Changed executed input '+file);return initial.get(file);});
  fs.writeFileSync(path.join(out,'inputs.json'),canonicalTextBytes(JSON.stringify({profile:'sequence-reset-inputs/1',pins},null,2)));fs.writeFileSync(path.join(out,'result.json'),canonicalTextBytes(JSON.stringify(report,null,2)));
 }
 if(report.failures.length)throw Error('Native sequence RESET failed: '+out);return report;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){if(process.argv.length!==4)throw Error('Usage: node verify.mjs <Playwright index.mjs> <new absolute output directory>');await verify({playwrightPath:path.resolve(process.argv[2]),out:path.resolve(process.argv[3])});console.log('Sequence RESET native PASS');}
