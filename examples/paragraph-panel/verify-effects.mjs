// SPDX-License-Identifier: Apache-2.0
// Independent procedural pixel oracle plus genuine backend/UI/lifecycle execution.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';import {pathToFileURL} from 'node:url';
import {fingerprintFile} from '../../tools/lib/file-identity.mjs';
const [playwrightRoot,output]=process.argv.slice(2);
if(!playwrightRoot||!output)throw Error('Usage: node examples/paragraph-panel/verify-effects.mjs <playwright-root> <new-output-directory>');
assert.equal(JSON.parse(fs.readFileSync(path.join(playwrightRoot,'package.json'),'utf8')).version,'1.62.1');
const root=path.resolve(import.meta.dirname,'../..'),out=path.resolve(output);fs.mkdirSync(out);
const {createExampleServer}=await import(pathToFileURL(root+'/tools/serve-example.mjs'));
const {chromium}=await import(pathToFileURL(path.resolve(playwrightRoot,'index.mjs')));
const hash=b=>createHash('sha256').update(b).digest('hex'),inputs=new Map();
const result={schema:'egret.shared-effects-browser/1',startedUtc:new Date().toISOString(),environment:{node:process.version,playwright:'1.62.1',channel:'msedge',headless:true,extraFlags:[],physicalDevice:false},scope:'Bounded Alpha-mask/box-blur pixels, existing readonly UI, staged/cancelled submissions and actual native generation recovery. No phone, IME, sustained or performance qualification.',reports:[]};
function physical(p){return p.startsWith('vendor/robust-predicates/')?path.join(root,'packages/engine/node_modules/robust-predicates',p.slice(25)):path.join(root,p);}
function snapshot(p){const file=physical(p);if(!fs.existsSync(file)||!fs.statSync(file).isFile())return;const bytes=fs.readFileSync(file),record={sha256:hash(bytes),bytes:bytes.length};const old=inputs.get(p);if(old)assert.equal(old.sha256,record.sha256,'served input changed');else inputs.set(p,record);}
const sourceErrors=[];result.executionInputs=['examples/paragraph-panel/verify-effects.mjs','tools/serve-example.mjs','tools/lib/file-identity.mjs'].map(p=>fingerprintFile(root,p));
const server=createExampleServer(root);server.on('request',(req,res)=>{res.on('finish',()=>{try{if(res.statusCode===200){const p=decodeURIComponent(new URL(req.url,'http://localhost').pathname).slice(1);snapshot(p);}}catch(error){sourceErrors.push(String(error));}});});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;let browser;
const encode=v=>Math.round(255*(v<=0.0031308?12.92*v:1.055*Math.pow(v,1/2.4)-0.055));
function oracle(name,ratio){
 const size=64*ratio,n=size*size;let red=new Float64Array(n);
 const shifted=name==='translated',rotated=name==='rotated';
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){let px=(x+.5)/ratio,py=(y+.5)/ratio;if(shifted)px-=5;if(rotated)[px,py]=[py,64-px];if(px>=16&&px<32&&py>=16&&py<32)red[y*size+x]=1;}
 function blur(radius){for(const axis of [0,1]){const next=new Float64Array(n);for(let y=0;y<size;y++)for(let x=0;x<size;x++){let sum=0;for(let i=-radius;i<=radius;i++){const u=x+(axis===0?i:0),v=y+(axis===1?i:0);if(u>=0&&v>=0&&u<size&&v<size)sum+=red[v*size+u];}next[y*size+x]=sum/(2*radius+1);}red=next;}}
 if(name==='nested'){blur(ratio);blur(ratio);}else if(['blur','both','clip','staged','recovery'].includes(name))blur(2*ratio);else if(name==='cap')blur(Math.min(16,8*ratio));
 const masked=['mask','both','nested','translated','rotated','old-frame','staged','recovery'].includes(name);
 const bytes=new Uint8Array(n*4);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){let value=red[y*size+x],px=(x+.5)/ratio,py=(y+.5)/ratio;if(shifted)px-=5;if(rotated)[px,py]=[py,64-px];
  if(masked)value*=px<16||px>=24||py<16||py>=32?0:py<24?1:128/255;
  if(name==='clip'&&(px<20||px>=28||py<20||py>=28))value=0;
  bytes.set([encode(value),0,0,255],(y*size+x)*4);
 }return bytes;
}
function verifyPixels(frame,name,ratio,label){const bytes=Buffer.from(frame.bytes),expected=oracle(name,ratio);assert.equal(frame.width,64*ratio);assert.equal(bytes.length,expected.length);let maxError=0;for(let i=0;i<bytes.length;i++)maxError=Math.max(maxError,Math.abs(bytes[i]-expected[i]));assert.ok(maxError<=4,label+' independent pixel error '+maxError);fs.writeFileSync(path.join(out,label+'.rgba'),bytes);return {name,pixels:bytes.length/4,maxChannelError:maxError,tolerance:4,sha256:hash(bytes)};}
try{
 browser=await chromium.launch({channel:'msedge',headless:true});result.environment.browser=browser.version();
 for(const backend of ['webgl2','webgpu'])for(const ratio of [1,3]){
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));page.setDefaultTimeout(30000);
  await page.goto(base+'/examples/paragraph-panel/effects-fixture.html?backend='+backend+'&ratio='+ratio);await page.waitForFunction(()=>globalThis.__egretEffects);await page.evaluate(()=>__egretEffects.ready);
  const row={backend,ratio,checks:[],errors};result.reports.push(row);
  for(const name of ['plain','mask','blur','both','clip','nested','translated','rotated','old-frame','staged','cap']){const frame=await page.evaluate(name=>__egretEffects.run(name),name);row.checks.push(verifyPixels(frame,name,ratio,backend+'-'+ratio+'-'+name));}
  const first=await page.evaluate(()=>__egretEffects.run('both'));const repeat=await page.evaluate(()=>__egretEffects.run('both'));assert.deepEqual(first.bytes,repeat.bytes);assert.equal(first.resources.totals.pageWriteCalls,repeat.resources.totals.pageWriteCalls);assert.equal(first.resources.current.reusable.idleBytes,repeat.resources.current.reusable.idleBytes);row.checks.push({name:'unchanged-pixels-and-warm-page-target-reuse'});
  const cancelled=await page.evaluate(()=>__egretEffects.cancel());assert.match(cancelled.code,/ABORT|REVOK|CANCEL/);assert.equal(cancelled.resources.current.pending.frames,0);row.checks.push({name:'cancelled-upload-drains',code:cancelled.code});
  const recovered=await page.evaluate(()=>__egretEffects.recover());assert.ok(recovered.after>recovered.before);row.checks.push({...verifyPixels(recovered,'recovery',ratio,backend+'-'+ratio+'-recovery'),before:recovered.before,after:recovered.after});
  const closed=await page.evaluate(()=>__egretEffects.close());assert.equal(closed.resources.current.pending.frames,0);assert.equal(closed.resources.current.reusable.idleBytes,0);assert.equal(closed.resources.current.reusable.leasedBytes,0);assert.equal(closed.resources.current.unknownNative.objects,0);row.checks.push({name:'closed-native-owners-drain',resources:closed.resources});assert.deepEqual(errors,[]);await page.close();console.log(backend,ratio,'native PASS',row.checks.length);
 }
 for(const backend of ['webgl2','webgpu']){
  const page=await browser.newPage(),row={backend,ui:true,checks:[]};result.reports.push(row);await page.goto(base+'/examples/paragraph-panel/index.html?content=equipment&effects=1&backend='+backend);await page.waitForFunction(()=>globalThis.__egretParagraphPanel);await page.evaluate(()=>__egretParagraphPanel.ready);
  const crops=[];
  for(const mode of ['both','mask','blur','off']){const state=await page.evaluate(()=>__egretParagraphPanel.inspect());assert.equal(state.effectMode,mode);const frame=await page.evaluate(()=>__egretParagraphPanel.readback());const bytes=Buffer.from(frame.base64,'base64');const crop=left=>{const b=[];for(let y=28;y<732;y++)b.push(bytes.subarray((y*1100+left)*4,(y*1100+left+420)*4));return hash(Buffer.concat(b));};crops.push({mode,article:crop(24),list:crop(646)});await page.screenshot({path:path.join(out,backend+'-ui-'+mode+'.png')});row.checks.push({name:'ui-'+mode,articleRevision:state.article.committedRevision,listRevision:state.list.committedRevision});if(mode!=='off')await page.evaluate(()=>__egretParagraphPanel.action('effects'));}
  assert.equal(new Set(crops.map(x=>x.article)).size,4);assert.equal(new Set(crops.map(x=>x.list)).size,4);row.crops=crops;
  await page.evaluate(()=>__egretParagraphPanel.action('effects'));const before=await page.evaluate(()=>__egretParagraphPanel.inspect());const same=await page.evaluate(()=>__egretParagraphPanel.action('static'));assert.equal(before.providerCalls,same.providerCalls);row.checks.push({name:'static-ui-reuses-paragraph-results'});
  const failed=await page.evaluate(()=>__egretParagraphPanel.action('fail'));assert.equal(failed.errors.length,0);assert.ok(failed.expectedFailures.length);row.checks.push({name:'failed-ui-replacement-keeps-committed-content'});
  for(const action of ['clamp','equipment','scroll','static']){const state=await page.evaluate(action=>__egretParagraphPanel.action(action),action);assert.equal(state.state,'ready');assert.deepEqual(state.errors,[]);row.checks.push({name:'effect-ui-'+action,rows:state.list.residentRows});}
  const close=await page.evaluate(()=>__egretParagraphPanel.close());assert.equal(close.state,'closed');assert.deepEqual(close.errors,[]);row.checks.push({name:'ui-cleanup'});await page.close();console.log(backend,'UI PASS',row.checks.length);
 }
 for(const [p,record]of inputs)assert.equal(hash(fs.readFileSync(physical(p))),record.sha256,'input changed after collection');
 assert.deepEqual(sourceErrors,[]);for(const pin of result.executionInputs)assert.deepEqual(fingerprintFile(root,pin.path),pin);
 result.status='PASS';
}catch(error){result.status='FAIL';result.error=String(error.stack??error);console.error(result.error);process.exitCode=1;}
finally{await browser?.close();await new Promise(r=>server.close(r));result.finishedUtc=new Date().toISOString();result.source=[...inputs].map(([path,r])=>({path,sha256:r.sha256,bytes:r.bytes}));fs.writeFileSync(path.join(out,'summary.json'),JSON.stringify(result,null,2)+'\n');}
