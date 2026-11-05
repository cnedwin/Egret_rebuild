// SPDX-License-Identifier: Apache-2.0
// Actual font resources and existing UI; no phone, IME, font-universe or timing claim.
import fs from 'node:fs';import path from 'node:path';import {pathToFileURL} from 'node:url';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const [playwrightRoot,output,...extra]=process.argv.slice(2);
if(!playwrightRoot||!output||extra.length)throw Error('Usage: node examples/paragraph-panel/verify-fonts.mjs <playwright-root> <new-output-directory>');
assert.equal(JSON.parse(fs.readFileSync(path.join(playwrightRoot,'package.json'),'utf8')).version,'1.62.1');
const root=path.resolve(import.meta.dirname,'../..'),out=path.resolve(output);fs.mkdirSync(out);
const {authorFontExample}=await import(pathToFileURL(path.join(root,'tools/content/author-font-example.mjs')));
const authored=await authorFontExample();
const {createExampleServer}=await import(pathToFileURL(path.join(root,'tools/serve-example.mjs')));
const {chromium}=await import(pathToFileURL(path.resolve(playwrightRoot,'index.mjs')));
const hash=b=>createHash('sha256').update(b).digest('hex');
const report={schema:'egret.font-resource-browser/1',scope:'Actual font pipeline, layout, shared browser rendering and lifecycle; no device, IME, performance or comprehensive script coverage qualification.',startedAt:new Date().toISOString(),status:'RUNNING',checks:[],errors:[],environment:{node:process.version,channel:'msedge',headless:true,extraFlags:[],physicalDevice:false},frames:[]};
const inputs=new Map(),sourceErrors=[];
function physical(p){return p.startsWith('vendor/robust-predicates/')?path.join(root,'packages/engine/node_modules/robust-predicates',p.slice(25)):path.join(root,p);}
function snapshot(p){const file=physical(p);if(!fs.existsSync(file)||!fs.statSync(file).isFile())return;const bytes=fs.readFileSync(file),pin={path:p,bytes:bytes.length,sha256:hash(bytes)},old=inputs.get(p);if(old)assert.deepEqual(pin,old,'Actual input drift');else inputs.set(p,pin);}
for(const p of ['examples/paragraph-panel/verify-fonts.mjs','tools/serve-example.mjs','tools/lib/file-identity.mjs','tools/lib/local-package.mjs','tools/content/author-font-example.mjs','tools/content/build.mjs','tools/content/store.mjs','tools/content/importers.mjs','tools/content/input.mjs','tools/content/png.mjs'])snapshot(p);
const server=createExampleServer(root);server.on('request',(request,response)=>{response.on('finish',()=>{try{if(response.statusCode===200)snapshot(decodeURIComponent(new URL(request.url,'http://localhost').pathname).slice(1));}catch(error){sourceErrors.push(String(error));}});});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({channel:'msedge',headless:true});report.environment.browser=browser.version();const config=authored.configPath;
const check=(name,condition)=>{assert.ok(condition,name);report.checks.push(name);};
async function frame(page,name){const r=await page.evaluate(()=>__egretParagraphPanel.readback());const bytes=Buffer.from(r.base64,'base64');fs.writeFileSync(path.join(out,name+'.rgba'),bytes);report.frames.push({name,width:r.width,height:r.height,sha256:hash(bytes)});return bytes;}
try{
 for(const backend of ['webgl2','webgpu']){
  const context=await browser.newContext({viewport:{width:1200,height:1000},deviceScaleFactor:1});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  try{
   await page.goto(base+'/examples/paragraph-panel/index.html?backend='+backend+'&fontConfig='+config);await page.waitForFunction(()=>globalThis.__egretParagraphPanel,{timeout:30000});await page.evaluate(()=>__egretParagraphPanel.ready);
   const first=await page.evaluate(()=>__egretParagraphPanel.inspect()),before=await frame(page,backend+'-initial');check(backend+' ready',first.state==='ready');check(backend+' initial managed fonts',first.fontSets.sets===1&&first.fontLoader.sourceBytes>8388608);
   await page.evaluate(()=>__egretParagraphPanel.action('fonts'));const replaced=await page.evaluate(()=>__egretParagraphPanel.inspect()),after=await frame(page,backend+'-replacement');check(backend+' new generation key',replaced.fontSet!==first.fontSet);check(backend+' real font/layout change',JSON.stringify(first.article.boxes)!==JSON.stringify(replaced.article.boxes)&&!before.equals(after));
   let rightEqual=true;for(let y=0;y<760;y++)if(!before.subarray((y*1100+646)*4,(y*1100+1100)*4).equals(after.subarray((y*1100+646)*4,(y*1100+1100)*4)))rightEqual=false;check(backend+' independently committed list pixels unchanged',rightEqual);
   for(let i=0;i<10;i++)await page.evaluate(()=>__egretParagraphPanel.action('fonts'));const many=await page.evaluate(()=>__egretParagraphPanel.inspect());check(backend+' repeated switch retires unused sets',many.fontSets.sets<=3&&many.fontLoader.groups<=3);
   await page.evaluate(()=>__egretParagraphPanel.action('static'));check(backend+' no page errors',errors.length===0);
   const closed=await page.evaluate(()=>__egretParagraphPanel.close());check(backend+' cleanup',closed.state==='closed'&&closed.errors.length===0&&closed.fontSets.sets===0&&closed.fontLoader.sourceBytes===0&&closed.fontSource.current.jobs===0);
  }finally{await context.close();}
  // A fresh transport prevents warm resources from hiding actual failed or cancelled fetches.
  for(const mode of ['fail','cancel','supersede']){
   const ctx=await browser.newContext({viewport:{width:1200,height:1000}}),p=await ctx.newPage();let release,entered;const gate=new Promise(r=>{release=r;}),hit=new Promise(r=>{entered=r;});
   try{
    await p.goto(base+'/examples/paragraph-panel/index.html?backend='+backend+'&fontConfig='+config);await p.waitForFunction(()=>globalThis.__egretParagraphPanel);await p.evaluate(()=>__egretParagraphPanel.ready);const old=await p.evaluate(()=>__egretParagraphPanel.inspect());
    let first=true;await p.route('**/build/blobs/sha256/*',async route=>{if(!first)return route.continue();first=false;entered();if(mode==='fail')return route.fulfill({status:503,body:'font unavailable'});await gate;try{await route.continue();}catch{}});
    const promise=p.evaluate(()=>__egretParagraphPanel.replaceFonts().then(()=>({ok:true}),error=>({ok:false,error:error.message})));await hit;
    if(mode!=='fail'){
      const pending=await p.evaluate(()=>__egretParagraphPanel.inspect());check(backend+' '+mode+' pending retains committed boxes',JSON.stringify(pending.article.boxes)===JSON.stringify(old.article.boxes));
      if(mode==='cancel')await p.evaluate(()=>__egretParagraphPanel.cancelFontReplacement());
      else {const latest=p.evaluate(()=>__egretParagraphPanel.replaceFonts());release();await latest;}
      release();
    }
    const result=await promise;check(backend+' '+mode+' old candidate rejected',!result.ok);const current=await p.evaluate(()=>__egretParagraphPanel.inspect());check(backend+' '+mode+' committed state',mode==='supersede'?current.fontSet!==old.fontSet:current.fontSet===old.fontSet&&JSON.stringify(current.article.boxes)===JSON.stringify(old.article.boxes));
    const end=await p.evaluate(()=>__egretParagraphPanel.close());check(backend+' '+mode+' cleanup',end.fontSets.sets===0&&end.fontLoader.sourceBytes===0&&end.errors.length===0);
   }finally{release();await ctx.close();}
  }
 }
 for(const pin of inputs.values())assert.equal(hash(fs.readFileSync(physical(pin.path))),pin.sha256,'Input changed after execution');assert.deepEqual(sourceErrors,[]);report.inputs=[...inputs.values()].sort((a,b)=>a.path.localeCompare(b.path));
 report.status='PASS';
}catch(error){report.status='FAIL';report.errors.push(String(error.stack??error));process.exitCode=1;}finally{await browser.close();await new Promise(resolve=>server.close(resolve));report.finishedAt=new Date().toISOString();fs.writeFileSync(path.join(out,'browser-report.json'),JSON.stringify(report,null,2)+'\n');console.log(report.status+' '+report.checks.length+' browser checks; '+path.join(out,'browser-report.json'));}
