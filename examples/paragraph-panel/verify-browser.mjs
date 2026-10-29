// SPDX-License-Identifier: Apache-2.0
// One optional browser acceptance pass; independent of historical source-policy tests.
import fs from 'node:fs';import path from 'node:path';import http from 'node:http';import assert from 'node:assert/strict';import{createHash}from'node:crypto';import{pathToFileURL}from'node:url';
const [playwrightRoot,output,...extra]=process.argv.slice(2);
if(!playwrightRoot||!output||extra.length)throw Error('Usage: node examples/paragraph-panel/verify-browser.mjs <playwright-root> <new-output-directory>');
assert.equal(JSON.parse(fs.readFileSync(path.join(playwrightRoot,'package.json'),'utf8')).version,'1.62.1');
const root=path.resolve(import.meta.dirname,'../..'),out=path.resolve(output);fs.mkdirSync(out);
const {createExampleServer}=await import(pathToFileURL(path.join(root,'tools/serve-example.mjs')));
const {chromium}=await import(pathToFileURL(path.resolve(playwrightRoot,'index.mjs')));
const sha=b=>createHash('sha256').update(b).digest('hex');
const source=new Map(),reports=[],requested=[];let browser,server,context;
const result={schema:'egret.readonly-paragraph-browser/1',startedUtc:new Date().toISOString(),environment:{node:process.version,playwright:'1.62.1',channel:'msedge',headless:true,extraFlags:[],physicalDevice:false},scope:'Actual CPU paragraph shaping/raster inside WebGL2 and WebGPU UI; no independent font/ink oracle, phone, IME, GPU-time or performance acceptance.',reports};
// Resolve the server's one pinned virtual dependency alias without freezing unrelated files.
function physical(relative){return relative.startsWith('vendor/robust-predicates/')?path.join(root,'packages/engine/node_modules/robust-predicates',relative.slice('vendor/robust-predicates/'.length)):path.join(root,relative);}
function box(snapshot,id){return snapshot.article.boxes.find(b=>b.id===id);}
async function evaluate(page,method,...args){return page.evaluate(async({method,args})=>Promise.race([Promise.resolve().then(()=>globalThis.__egretParagraphPanel[method](...args)),new Promise((_,reject)=>setTimeout(()=>reject(Error('ACCEPTANCE_TIMEOUT_'+method)),20000))]),{method,args});}
try{
 const handler=createExampleServer(root);server=http.createServer((request,response)=>{requested.push(request.url);handler.emit('request',request,response);});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 browser=await chromium.launch({channel:'msedge',headless:true});result.environment.browser=browser.version();
 for(const backend of ['webgl2','webgpu']){
  const row={backend,checks:[],states:[]};reports.push(row);context=await browser.newContext({viewport:{width:1400,height:1000},deviceScaleFactor:1});const page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(String(error)));page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  await page.route('**/*',async route=>{
   const url=new URL(route.request().url());assert.equal(url.hostname,'127.0.0.1');
   const relative=decodeURIComponent(url.pathname).slice(1),file=physical(relative);
   if(fs.existsSync(file)&&fs.statSync(file).isFile()){
    const bytes=fs.readFileSync(file),prior=source.get(relative);if(prior)assert.equal(sha(bytes),prior.sha256,'No source drift during acceptance');else source.set(relative,{path:relative,bytes:bytes.length,sha256:sha(bytes)});
   }
   await route.continue();
  });
  await page.goto('http://127.0.0.1:'+server.address().port+'/examples/paragraph-panel/index.html?backend='+backend);
  await page.waitForFunction(()=>globalThis.__egretParagraphPanel!==undefined);
  await page.evaluate(()=>globalThis.__egretParagraphPanel.ready);let initial=await evaluate(page,'inspect');assert.equal(initial.state,'ready');assert.equal(initial.fontBytes,17148712);assert.equal(initial.runtimeBytes,8696388);
  async function capture(name,snapshot,screenshot=false){const raw=await evaluate(page,'readback'),bytes=Buffer.from(raw.base64,'base64');assert.equal(bytes.length,1100*760*4);const record={name,sha256:sha(bytes),byteLength:bytes.length,articleRevision:snapshot.article.committedRevision,listRevision:snapshot.list.committedRevision,providerCalls:snapshot.providerCalls,paragraphHeight:box(snapshot,'introduction').height,footerY:box(snapshot,'article-footer').y,density:snapshot.density,cache:snapshot.cache};row.states.push(record);if(screenshot)await page.locator('#scene').screenshot({path:path.join(out,backend+'-'+name+'.png')});return record;}
  const original=await capture('initial',initial,true);row.checks.push('real-fonts-Latin-CJK-Arabic-rendered');
  let current=await evaluate(page,'action','static'),state=await capture('unchanged',current);assert.equal(state.sha256,original.sha256);assert.equal(current.providerCalls,initial.providerCalls);row.checks.push('unchanged-no-shape-or-raster');
  const narrow=await evaluate(page,'action','narrow');state=await capture('narrow',narrow,true);assert.ok(state.paragraphHeight>original.paragraphHeight);assert.ok(state.footerY>original.footerY);assert.notEqual(state.sha256,original.sha256);row.checks.push('width-wrap-and-following-geometry');
  const larger=await evaluate(page,'action','larger');state=await capture('larger',larger);assert.ok(state.paragraphHeight>box(narrow,'introduction').height);row.checks.push('font-metrics-drive-height');
  const spaced=await evaluate(page,'action','line-height');state=await capture('minimum-line-height',spaced);const last=spaced.preparations.filter(p=>p.id==='introduction').at(-1);assert.ok(last.metrics.lines.every(line=>line.height>=43.999));row.checks.push('minimum-line-height');
  const dense=await evaluate(page,'action','density');const denseState=await capture('density-two',dense);assert.equal(denseState.paragraphHeight,state.paragraphHeight);assert.equal(denseState.footerY,state.footerY);assert.equal(dense.density,2);row.checks.push('density-preserves-logical-layout');
  const beforeFail=await evaluate(page,'inspect'),failed=await evaluate(page,'action','fail');const failureState=await capture('failed-update',failed);assert.equal(failureState.sha256,denseState.sha256);assert.equal(failed.article.committedRevision,beforeFail.article.committedRevision);assert.equal(failed.expectedFailures.length,1);row.checks.push('failed-update-keeps-committed-image');
  await evaluate(page,'beginDelayedUpdate');await page.waitForFunction(()=>globalThis.__egretParagraphPanel.inspect().gateEntered);const pending=await evaluate(page,'pendingFrame');const pendingState=await capture('pending-update',pending);assert.equal(pendingState.sha256,failureState.sha256);row.checks.push('pending-update-keeps-committed-image');
  const completed=await evaluate(page,'finishDelayedUpdate');const completedState=await capture('completed-update',completed);assert.ok(completed.article.committedRevision>pending.article.committedRevision);assert.notEqual(completedState.sha256,pendingState.sha256);row.checks.push('completed-update-publishes-new-image-and-layout');
  await evaluate(page,'beginDelayedUpdate');await page.waitForFunction(()=>globalThis.__egretParagraphPanel.inspect().gateEntered);const replaced=await evaluate(page,'supersedeDelayedUpdate');await capture('superseded-update',replaced);assert.equal(replaced.width,300);assert.equal(replaced.article.committedRevision,replaced.article.desiredRevision);row.supersededUpdates=replaced.supersededUpdates;assert.equal(row.supersededUpdates.at(-1).oldProviderSettled,true);row.checks.push('stale-update-cannot-overwrite-new-width');
  const scrolled=await evaluate(page,'action','scroll');await capture('scrolled',scrolled);assert.ok(scrolled.list.scrollOffset>0);assert.ok(scrolled.unbinds.length>replaced.unbinds.length);row.checks.push('paragraph-height-virtualization-recycles');
  const rowHit=scrolled.list.rows.find(r=>r.visible);assert.ok(rowHit);const rect=await page.locator('#scene').boundingBox();await page.mouse.click(rect.x+646+Math.min(100,rowHit.box.width/2),rect.y+28+Math.max(1,rowHit.box.y+rowHit.box.height/2));await page.waitForTimeout(10);const clicked=await evaluate(page,'inspect');assert.ok(clicked.events.some(e=>e.kind==='begin'));row.checks.push('committed-row-hit-through-browser-pointer');
  // Exercise actual SDK controls before retiring the same UI/asset owners.
  const beforeLayout=await evaluate(page,'inspect');const beforeHeight=box(beforeLayout,'introduction').height;
  let aligned;
  for(const expected of ['center','right','start','end','justify','left']){
   aligned=await evaluate(page,'action','align');assert.equal(aligned.textAlign,expected);
   assert.equal(box(aligned,'introduction').height,beforeHeight);await capture('align-'+expected,aligned,expected==='center');
  }
  row.checks.push('six-alignments-preserve-ui-height');
  const clamped=await evaluate(page,'action','clamp');const clampedState=await capture('two-line-clamp',clamped,true);
  const clippedMetrics=clamped.preparations.filter(p=>p.id==='introduction').at(-1).metrics;
  assert.equal(clippedMetrics.truncated,true);assert.equal(clippedMetrics.lines.length,2);assert.ok(box(clamped,'introduction').height<beforeHeight);
  assert.ok(box(clamped,'article-footer').y<box(beforeLayout,'article-footer').y);row.checks.push('ellipsis-line-cap-updates-sibling-geometry');
  const sameClamp=await evaluate(page,'action','static');const sameState=await capture('unchanged-clamp',sameClamp);
  assert.equal(sameState.sha256,clampedState.sha256);assert.equal(sameClamp.providerCalls,clamped.providerCalls);row.checks.push('unchanged-clamp-reuses-prepared-content');
  const failedClamp=await evaluate(page,'action','fail');const failedClampState=await capture('failed-clamp-update',failedClamp);
  assert.equal(failedClampState.sha256,clampedState.sha256);assert.equal(failedClamp.article.committedRevision,clamped.article.committedRevision);
  row.checks.push('clamped-failure-retains-image-and-layout');
  const restored=await evaluate(page,'action','clamp');await capture('line-cap-cleared',restored);
  assert.equal(restored.maxLines,null);assert.equal(box(restored,'introduction').height,beforeHeight);row.checks.push('clearing-line-cap-restores-natural-height');
  row.lineBidi=await page.evaluate(async()=>{
   const manifest=await(await fetch('./vendor/manifest.json')).json();
   const ck=await globalThis.CanvasKitInit({locateFile:()=>new URL('./vendor/'+manifest.runtime.wasm,location.href).href});
   const fonts=ck.TypefaceFontProvider.Make();
   let provider;
   try {
    const inputs=[];
    for(const font of manifest.fonts.slice(0,2)){const data=new Uint8Array(await(await fetch('./vendor/'+font.path)).arrayBuffer());fonts.registerFont(data,font.family);inputs.push({family:font.family,identity:font.sha256,data});}
    const {verifyLineBidi}=await import('./verify-line-bidi.mjs');const bidi=verifyLineBidi(ck,fonts);
    const {createCanvasKitParagraphProvider}=await import('@egret/engine/web/paragraph');
    const {CancellationController,copyImageData2DPixels}=await import('@egret/engine');
    provider=createCanvasKitParagraphProvider({canvasKit:ck,fonts:inputs,buildIdentity:manifest.runtime.buildIdentity});
    const make=changes=>provider.prepare({text:'ABC',width:95,fontFamilies:inputs.map(f=>f.family),fontSize:20,locale:'en',direction:'ltr',fillColor:0xffffff,density:1,...changes},{signal:new CancellationController().signal});
    let hardBreakCases=0;
    for(const direction of ['ltr','rtl'])for(const [text,reference,cap=1]of [['A\nB','A\u2026'],['A\r\nB','A\u2026'],['A\rB','A\u2026'],['A\u2028B','A\u2026'],['A\u2029B','A\u2026'],['\nB','\u2026'],[' \nB',' \u2026'],['A\nB\nC','A\nB\u2026',2]]){
     // The separately shaped marker does not inherit literal B/ellipsis pair kerning.
     const actual=await make({text,maxLines:cap,direction}),expected=await make(cap===1?{text:reference,direction}:{text:'A\nB\nD',maxLines:cap,direction});
     if(cap===2){const unmarked=await make({text:'A\nB',direction});const a=copyImageData2DPixels(actual.image),b=copyImageData2DPixels(unmarked.image);if(a.length===b.length&&a.every((v,i)=>v===b[i]))throw Error('BROWSER_TWO_LINE_MARKER_MISSING');}
     if(actual.metrics.truncated!==true||actual.metrics.lines.length!==cap||actual.offsetX!==expected.offsetX||actual.offsetY!==expected.offsetY||!actual.image||!expected.image)throw Error('BROWSER_HARD_BREAK_MARKER');
     const x=copyImageData2DPixels(actual.image),y=copyImageData2DPixels(expected.image);if(x.length!==y.length||!x.every((v,i)=>v===y[i]))throw Error('BROWSER_HARD_BREAK_PIXELS');hardBreakCases++;
    }
    let hardBreakAlignments=0;
    for(const direction of ['ltr','rtl'])for(const textAlign of ['left','center','right']){
     const a=await make({text:'A\nA\nC',maxLines:2,direction,textAlign}),b=await make({text:'A\nA…',direction,textAlign});
     const x=copyImageData2DPixels(a.image),y=copyImageData2DPixels(b.image);
     if(a.offsetX!==b.offsetX||a.offsetY!==b.offsetY||x.length!==y.length||!x.every((v,i)=>v===y[i]))throw Error('BROWSER_HARD_BREAK_ALIGNMENT');hardBreakAlignments++;
    }
    let markerWidthCases=0;
    for(const direction of ['ltr','rtl'])for(const textAlign of ['left','center','right']){
     const a=await make({text:'MMMM\nB',width:75,maxLines:1,direction,textAlign}),b=await make({text:'MMM…',width:75,direction,textAlign});
     const x=copyImageData2DPixels(a.image),y=copyImageData2DPixels(b.image);
     if(a.metrics.truncated!==true||a.offsetX!==b.offsetX||a.offsetY!==b.offsetY||x.length!==y.length||!x.every((v,i)=>v===y[i]))throw Error('BROWSER_MARKER_WIDTH_RESERVATION');markerWidthCases++;
    }
    let narrowRefused=false;try{await make({text:'MMMMMMMM',width:.25,maxLines:1});}catch(error){if(error.code!=='PARAGRAPH_ELLIPSIS_DOES_NOT_FIT')throw error;narrowRefused=true;}
    if(!narrowRefused)throw Error('BROWSER_NARROW_MARKER_NOT_REFUSED');const recovered=await make({text:'short',maxLines:1});
    if(recovered.metrics.truncated!==false||!recovered.image)throw Error('BROWSER_NARROW_RECOVERY');
    const authored=await make({text:'A\r\nB\rC'});if(JSON.stringify(authored.metrics.lines.map(l=>[l.start,l.end]))!=='[[0,1],[3,4],[5,6]]')throw Error('BROWSER_AUTHORED_UTF16');
    return {...bidi,layoutControls:{hardBreakCases,hardBreakAlignments,markerWidthCases,narrowRefused,recovered:true,authoredUtf16:true}};
   } finally {provider?.dispose();fonts.delete();}
  });
  assert.equal(row.lineBidi.reflows,90);row.checks.push('native-final-line-bidi-glyph-rect-hit-reflow');
  assert.equal(row.lineBidi.layoutControls.hardBreakCases,16);assert.equal(row.lineBidi.layoutControls.hardBreakAlignments,6);assert.equal(row.lineBidi.layoutControls.markerWidthCases,6);assert.equal(row.lineBidi.layoutControls.narrowRefused,true);row.checks.push('hard-break-marker-and-recoverable-narrow-refusal');
  const closed=await evaluate(page,'close');assert.equal(closed.state,'closed');assert.equal(closed.cache.callerLeases,0);assert.equal(closed.cache.imageBytes,0);assert.equal(closed.scopeState,'closed');assert.deepEqual(closed.errors,[]);assert.deepEqual(errors,[]);row.checks.push('close-releases-owned-images-and-leases');row.closed=closed.cache;row.browserErrors=errors;row.status='PASS';await context.close();context=undefined;
 }
 for(const entry of source.values())assert.equal(sha(fs.readFileSync(physical(entry.path))),entry.sha256,'Actual dependency changed after capture');result.sources=[...source.values()].sort((a,b)=>a.path.localeCompare(b.path));result.requested=[...new Set(requested)].sort();result.status='PASS';
}catch(error){result.status='FAIL';result.failure={message:error.message,stack:error.stack};if(context){try{const p=context.pages()[0];result.failedState=await evaluate(p,'inspect');result.cleanup=await evaluate(p,'close');await p.screenshot({path:path.join(out,'failed.png'),fullPage:true});}catch{}}process.exitCode=1;}
finally{await context?.close();await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));result.endedUtc=new Date().toISOString();fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(result,null,2)+'\n');}
console.log(JSON.stringify({status:result.status,reports:reports.map(r=>({backend:r.backend,status:r.status,checks:r.checks.length})),failure:result.failure}));
