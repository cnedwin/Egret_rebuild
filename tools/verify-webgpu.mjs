import { createServer } from 'node:http';
import { readFile, writeFile, readdir, mkdir, cp, realpath } from 'node:fs/promises';
import { resolve, dirname, sep, extname, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { assertPixel, assertZero, pixel, composition } from './webgpu-oracle.mjs';

const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const option=(name,fallback)=>{const i=process.argv.indexOf(name);return i<0?fallback:process.argv[i+1];};
const inside=(base,file)=>file.startsWith(base+sep);
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const output=resolve(option('--output','../runs/webgpu-native-task4'));
const copied=resolve(root,'../runs/webgpu-native-counterexamples');
// Private altered product copies and raw evidence can never become publication inputs.
if(output===root || inside(root,output) || copied===root || inside(root,copied))throw new Error('Output and counterexample trees must be outside the repository');
await mkdir(output,{recursive:true});
const report={status:'INCOMPLETE',timestamp:new Date().toISOString(),launch:{headless:true,channel:option('--channel','msedge'),additionalFlags:[],freshProfile:true,deviceScaleFactor:1},fixtures:[],fixtureFailures:[],composition:[],counterexamples:[],requests:[],unexpectedErrors:[],limits:'Browser composition only; no physical scanout, hardware, phone, performance, UI, 3D or migration acceptance'};
const save=(name,data)=>writeFile(resolve(output,name),JSON.stringify(data,null,2));
const files=async base=>{const found=[];for(const entry of await readdir(base,{withFileTypes:true})){const p=resolve(base,entry.name);if(entry.isDirectory())found.push(...await files(p));else found.push(p);}return found;};
async function identity() {
  const list=[];
  for(const directory of ['packages/engine/src','packages/engine/web','packages/engine/rendering','packages/engine/dist','packages/runtime/src','packages/runtime/dist','packages/contracts/src','packages/contracts/dist','examples/webgpu'])list.push(...await files(resolve(root,directory)));
  list.push(...(await files(resolve(root,'tools'))).filter(p=>p.endsWith('.mjs')));
  list.push(...['package.json','pnpm-lock.yaml','tsconfig.json','packages/engine/package.json'].map(p=>resolve(root,p)));
  const dependency=resolve(root,'packages/engine/node_modules/robust-predicates');
  for(const name of ['index.js','esm/orient2d.js','esm/orient3d.js','esm/incircle.js','esm/insphere.js','esm/util.js','package.json'])list.push(resolve(dependency,name));
  return Object.fromEntries(await Promise.all(list.sort().map(async p=>[relative(root,p).replaceAll('\\','/'),hash(await readFile(p))])));
}
const before=await identity();report.identityBefore=before;
report.head=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
report.node=process.version;
const passSource=await readFile(resolve(root,'packages/engine/web/webgpuPass.ts'),'utf8');
report.wgslHash=hash(passSource.match(/const SHADER = `([\s\S]*?)`;/)[1]);
const entries={'@egret/engine':'packages/engine/dist/index.js','@egret/engine/web':'packages/engine/dist/web/index.js','@egret/runtime':'packages/runtime/dist/index.js','@egret/contracts':'packages/contracts/dist/index.js'};
async function closure(entry) {
  const visited=new Set();
  async function walk(file){if(visited.has(file))return;visited.add(file);
    const source=await readFile(file,'utf8');
    for(const match of source.matchAll(/(?:import|export)\s+(?:[^'";]*?\s+from\s+)?['"]([^'"]+)['"]/g)) {
      const spec=match[1];const target=spec.startsWith('.')?resolve(dirname(file),spec):entries[spec]?resolve(root,entries[spec]):null;
      if(!target)throw new Error(`Unexpected external import in isolated entry: ${spec}`);
      await walk(target);
    }
  }
  await walk(resolve(root,entry));
  const paths=[...visited].map(p=>relative(root,p).replaceAll('\\','/')).sort();
  if(paths.some(p=>/webgpu|rendering|robust-predicates/i.test(p)))throw new Error('Static Canvas/root dependency isolation failed');
  return paths;
}
report.isolation={staticRoot:await closure(entries['@egret/engine']),staticCanvas:await closure(entries['@egret/engine/web'])};
const manifest=JSON.parse(await readFile(resolve(root,'packages/engine/package.json'),'utf8'));
if(manifest.exports['./webgpu'].import!=='./dist/web/webgpu.js'||manifest.exports['./webgpu'].types!=='./dist/web/webgpu.d.ts')throw new Error('WebGPU package export mismatch');

const modeDefinitions=[
  {name:'no-op',fixture:'painter',assertion:'painter-colored-interior',file:'web/webgpuPass.js',from:'pass.draw(range.vertexCount, 1, range.firstVertex, 0);',to:'void range;'},
  {name:'reversed-order',fixture:'painter',assertion:'painter-overlap',file:'web/webgpuPass.js',from:'for (const range of ranges)',to:'for (const range of [...ranges].reverse())'},
  {name:'removed-diamond-clip',fixture:'nested',assertion:'diamond-outside',file:'web/WebGPUHost.js',from:'prepareRectangles2D(copied.frame,',to:'prepareRectangles2D({ ...copied.frame, commands: copied.frame.commands.map(command => ({ ...command, clips: [] })) },'},
  {name:'double-premultiply',fixture:'painter',assertion:'painter-overlap',file:'web/webgpuPass.js',from:'data[offset++] = red;\n            data[offset++] = green;\n            data[offset++] = blue;',to:'data[offset++] = red * alpha;\n            data[offset++] = green * alpha;\n            data[offset++] = blue * alpha;'},
  {name:'translated',fixture:'painter',assertion:'painter-colored-interior',file:'web/webgpuPass.js',from:'data[offset++] = p.x;',to:'data[offset++] = p.x + 16 / width;'},
  {name:'missing-clear',fixture:'red-clear',assertion:'empty-nonzero-clear',file:'web/WebGPUHost.js',from:"loadOp: 'clear'",to:"loadOp: 'load'"},
  {name:'nominal-dpr-substitution',fixture:'dpr',assertion:'nominal-dpr-boundary-marker',file:'web/webgpuPass.js',from:'2 * point.x / width - 1',to:'2 * point.x * (width / 10.2) / 1.5 / width - 1'}
];
// Exact finite patches touch disposable copies only. Their URL space has its own root.
async function prepareMode(mode) {
  const base=resolve(copied,mode.name,'engine/dist');await mkdir(dirname(base),{recursive:true});
  await cp(resolve(root,'packages/engine/dist'),base,{recursive:true,force:true});
  const treeHashes=async()=>Object.fromEntries(await Promise.all((await files(base)).sort().map(async file=>[relative(base,file).replaceAll('\\','/'),hash(await readFile(file))])));
  const copiedBefore=await treeHashes();
  const target=resolve(base,mode.file),original=await readFile(target,'utf8');
  if(original.split(mode.from).length!==2)throw new Error(`Counterexample ${mode.name} patch does not have exactly one target`);
  const changed=original.replace(mode.from,mode.to);await writeFile(target,changed);
  const copiedAfter=await treeHashes(),changedFiles=Object.keys(copiedBefore).filter(file=>copiedBefore[file]!==copiedAfter[file]);
  if(changedFiles.length!==1 || changedFiles[0]!==mode.file)throw new Error('Private mutation changed more than its one documented file');
  const receipt={...mode,scope:'Actual native copied-production mutation',privateTree:base,originalHash:hash(original),changedHash:hash(changed),copiedBefore,copiedAfter,changedFiles,patch:{remove:mode.from,insert:mode.to},originalPreserved:hash(await readFile(resolve(root,'packages/engine/dist',mode.file)))===hash(original),restoration:'Original never edited; private altered copy retained outside repository and publication; final originals rehash separately required'};
  await writeFile(resolve(copied,mode.name,'receipt.json'),JSON.stringify(receipt,null,2));return receipt;
}
let origin,browser,server;
try {
  const modulePath=resolve(option('--playwright',''));
  if(!option('--playwright'))throw new Error('--playwright installed module directory is required');
  const playwright=await import(pathToFileURL(resolve(modulePath,'index.mjs')).href);
  const dependencyRequire=createRequire(resolve(modulePath,'package.json'));
  const pngPath=option('--pngjs')?resolve(option('--pngjs')):dirname(dependencyRequire.resolve('pngjs/package.json'));
  const {PNG}=dependencyRequire(pngPath);
  report.playwright=JSON.parse(await readFile(resolve(modulePath,'package.json'),'utf8')).version;
  report.decoder={name:'pngjs',version:JSON.parse(await readFile(resolve(pngPath,'package.json'),'utf8')).version,license:'MIT',API:'public PNG.sync.read; no gamma adjustment; RGBA channel order'};
  server=createServer(async(req,res)=>{
    try {
      const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
      let base=root,urlpath=pathname;
      const privateMatch=pathname.match(/^\/private-counterexamples\/([a-z-]+)\/(.*)$/);
      if(privateMatch) {
        if(!modeDefinitions.some(m=>m.name===privateMatch[1]))throw new Error('Unknown private mode');
        base=resolve(copied,privateMatch[1],'engine/dist');urlpath='/'+privateMatch[2];
      }
      const file=resolve(base,'.'+urlpath);
      if(!inside(base,file) || !inside(await realpath(base),await realpath(file))){res.writeHead(403);res.end();return;}
      let body=await readFile(file);
      if(pathname==='/examples/webgpu/index.html') {
        const mode=new URL(req.url,'http://localhost').searchParams.get('mode');
        if(mode){if(!modeDefinitions.some(m=>m.name===mode))throw new Error('Unknown page mode');
          body=Buffer.from(body.toString().replaceAll('/packages/engine/dist/',`/private-counterexamples/${mode}/`));}
      }
      res.writeHead(200,{'content-type':{'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.svg':'image/svg+xml'}[extname(file)]??'application/octet-stream','cache-control':'no-store'});res.end(body);
    }catch{res.writeHead(404);res.end('Not found');}
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));origin=`http://127.0.0.1:${server.address().port}`;report.origin=origin;
  browser=await playwright.chromium.launch({channel:report.launch.channel,headless:true});report.browser=await browser.version();
  const context=await browser.newContext({viewport:{width:800,height:650},deviceScaleFactor:1});
  let window='startup';
  async function pageFor(url) {
    const page=await context.newPage();page.setDefaultTimeout(20000);
    const inventory=[];
    page.on('request',r=>inventory.push({url:r.url(),type:r.resourceType(),window}));
    page.on('pageerror',e=>report.unexpectedErrors.push({window,type:'pageerror',message:e.message}));
    page.on('console',m=>{if(m.type()==='error')report.unexpectedErrors.push({window,type:'console',message:m.text()});});
    page.on('requestfailed',r=>report.unexpectedErrors.push({window,type:'requestfailed',url:r.url(),message:r.failure()?.errorText}));
    page.on('response',r=>{if(r.status()>=400)report.unexpectedErrors.push({window,type:'HTTP',url:r.url(),status:r.status()});});
    await page.goto(url);report.requests.push({url,inventory});return page;
  }
  window='unchanged-canvas-isolation';const canvasPage=await pageFor(`${origin}/examples/canvas-scene/index.html`);
  await canvasPage.waitForFunction(()=>document.querySelector('#scene').getContext('2d').getImageData(80,60,1,1).data[2]>100);
  const canvasRequests=report.requests.at(-1).inventory;
  if(canvasRequests.some(r=>/webgpu|rendering|robust-predicates/i.test(r.url)))throw new Error('Fresh unchanged Canvas example fetched GPU dependency');
  report.isolation.actualCanvasRequests=canvasRequests;await canvasPage.close();
  window='public-webgpu-baseline';const page=await pageFor(`${origin}/examples/webgpu/index.html?harness=1`);await page.waitForFunction(()=>window.ready===true);
  const nativeTimeout=async promise=>{let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(`INCOMPLETE: native operation timed out in ${window}`)),20000);})]);}finally{clearTimeout(timer);}};
  const evaluate=(fn,arg)=>nativeTimeout(page.evaluate(fn,arg));
  function chunks(buffer){const result=[];let p=8;while(p+12<=buffer.length){const length=buffer.readUInt32BE(p),name=buffer.toString('ascii',p+4,p+8);result.push({name,length});p+=length+12;}return result;}
  async function screenshots(frame,label,whichPage=page) {
    for(const background of [0,255]) {
      const metadata=await nativeTimeout(whichPage.evaluate(v=>fixtures.background(v),background));
      const {rect,backing,browserDPR}=metadata;
      if(rect.x!==0||rect.y!==0||rect.width!==backing[0]||rect.height!==backing[1]||browserDPR!==1)throw new Error('Screenshot does not have exact CSS/backing 1:1 scale');
      const name=`${label}-${background===0?'black':'white'}.png`;
      const bytes=await whichPage.screenshot({path:resolve(output,name),type:'png',scale:'device',clip:rect});const decoded=PNG.sync.read(bytes);
      if(decoded.width!==backing[0]||decoded.height!==backing[1])throw new Error('PNG screenshot scale mismatch');
      const checks=frame.definition.samples.map(s=>({...assertPixel(pixel(decoded.data,decoded.width,s.x,s.y),composition(s.rgba,background),s.name),x:s.x,y:s.y,classification:s.classification}));
      report.composition.push({name,frameId:frame.frameId,serial:frame.serial,enableReadback:!!frame.readback,background,metadata,scale:'device',png:{width:decoded.width,height:decoded.height,depth:decoded.depth,colorType:decoded.colorType,gamma:decoded.gamma??null,chunks:chunks(bytes),channels:'RGBA; decoder synthesizes opaque alpha for RGB'},checks});
    }
  }
  async function record(frame,label) {
    if(frame.readback){await writeFile(resolve(output,`${label}.rgba`),Uint8Array.from(frame.readback.bytes));frame.readback={...frame.readback,bytes:undefined};}
    report.fixtures.push({label,...frame});await screenshots(frame,label);
  }
  const names=['painter','opaque-painter','inherited','zero-alpha','red-clear','affine','reflection','shear','nested','fan-rectangle','fan-polygon','dpr','rational','adjacent','near-collinear'];
  for(const readback of [true,false]) {
    for(const name of names) {
      window=`${name}-${readback?'readback':'composition-only'}`;
      let frame;
      try{frame=await evaluate(([name,enabled])=>fixtures.boot(name,enabled),[name,readback]);}
      catch(error){const detail=await evaluate(()=>fixtures.failureDetails());report.fixtureFailures.push({name,readback,message:error.message,detail});await save(`${name}-${readback}-failure.json`,detail);await evaluate(()=>fixtures.close());continue;}
      const label=`${name}-${readback?'readback':'disabled'}`;
      if(readback && ['rational','adjacent','near-collinear'].includes(name)) {
        const canvas=await evaluate(name=>fixtures.canvasComparison(name),name),gpu=frame.readback;
        const strict=frame.definition.samples.map(s=>{
          const rgba=pixel(canvas.bytes,canvas.width,s.x,s.y),premultiplied=rgba.slice(0,3).map(v=>Math.round(v*rgba[3]/255)).concat(rgba[3]);
          return assertPixel(premultiplied,s.rgba,`canvas-${s.name}`);
        });
        const differences=[];
        for(let y=0;y<gpu.height;y++)for(let x=0;x<gpu.width;x++) {
          const a=pixel(gpu.bytes,gpu.width,x,y),b=pixel(canvas.bytes,canvas.width,x,y),p=b.slice(0,3).map(v=>Math.round(v*b[3]/255)).concat(b[3]);
          if(a.some((v,i)=>Math.abs(v-p[i])>2))differences.push({x,y,gpu:a,canvasPremultiplied:p});
        }
        await writeFile(resolve(output,`${label}-canvas-straight.rgba`),Uint8Array.from(canvas.bytes));
        report.canvasComparisons??=[];report.canvasComparisons.push({name,strictChecks:strict,differences,scope:name==='adjacent'?'Separate adjacent-command seam and exterior antialias diagnostics':'Independent rational/ordinary near-collinear strict coverage; outer-edge diagnostics',tolerance:2});
      }
      await record(frame,label);
    }
    window=`reset-sequence-${readback}`;
    // Painter plus separate nested-fixture coverage seeds the reset sequence without suppressing any failed selected fixture.
    // Seed a translucent frame as well as bright clipped geometry before clearing.
    await evaluate(enabled=>fixtures.boot('fan-polygon',enabled),readback);
    for(const [w,h] of [[48,40],[37,29],[48,40]])await record(await evaluate(([w,h])=>fixtures.reset(w,h),[w,h]),`reset-${readback}-${w}-${h}-${report.fixtures.length}`);
    window=`immutable-snapshot-${readback}`;const snapshot=await evaluate(()=>fixtures.snapshot());
    report.snapshots??=[];report.snapshots.push({readback,immutableIdentityPreserved:snapshot.immutableIdentityPreserved,frameIds:[snapshot.first.frameId,snapshot.second.frameId,snapshot.third.frameId],serials:[snapshot.first.serial,snapshot.second.serial,snapshot.third.serial]});
    // A is rerendered to associate each screenshot with the exact displayed frame.
    // The snapshot routine already compared both A submissions and all raw bytes.
    await record(snapshot.third,`snapshot-B-${readback}`);
    await record(await evaluate(()=>fixtures.replaySnapshotA()),`snapshot-A1-${readback}`);
    await record(await evaluate(()=>fixtures.replaySnapshotA()),`snapshot-A2-${readback}`);
    await evaluate(()=>fixtures.close());
  }
  window='native-lifecycle-named-windows';report.native=await evaluate(()=>fixtures.lifecycle());
  const dependencyRequests=report.requests.find(r=>r.url.includes('/examples/webgpu/')).inventory.map(r=>new URL(r.url).pathname).filter(p=>p.includes('robust-predicates'));
  if(new Set(dependencyRequests).size!==6 || !dependencyRequests.some(p=>p.endsWith('/index.js')))throw new Error('Public robust-predicates root graph was not completely loaded');
  report.isolation.actualDependencyModules=[...new Set(dependencyRequests)];
  await page.close();
  for(const mode of modeDefinitions) {
    window=`counterexample-${mode.name}`;const receipt=await prepareMode(mode);
    const negativePage=await pageFor(`${origin}/examples/webgpu/index.html?harness=1&mode=${mode.name}`);await negativePage.waitForFunction(()=>window.ready===true);
    const outcome=await nativeTimeout(negativePage.evaluate(async m=>{try{await fixtures.boot(m.fixture,true,{},m.assertion);return{failed:false};}catch(e){return{failed:true,assertion:e.assertion,message:e.message,expected:e.expected,actual:e.actual};}},mode));
    if(!outcome.failed || outcome.assertion!==mode.assertion)throw new Error(`Counterexample ${mode.name} did not fail its intended pixel assertion: ${JSON.stringify(outcome)}`);
    report.counterexamples.push({...receipt,outcome,intendedAssertionFailed:true});
    const observed=await negativePage.evaluate(()=>fixtures.lastObservation());
    await writeFile(resolve(output,`counterexample-${mode.name}.rgba`),Uint8Array.from(observed.bytes));
    await negativePage.evaluate(()=>fixtures.background(0));await negativePage.screenshot({path:resolve(output,`counterexample-${mode.name}.png`),type:'png',scale:'device',clip:{x:0,y:0,width:observed.width,height:observed.height}});
    await negativePage.evaluate(()=>fixtures.close());await negativePage.close();
  }
  // A cached-byte no-clear negative checks exhaustive zero-reset logic, explicitly assertion-only.
  const cached=new Uint8Array(48*40*4);cached[4*(16*48+16)]=64;cached[4*(16*48+16)+2]=128;cached[4*(16*48+16)+3]=191;
  let synthetic;try{assertZero(cached,'empty-reset-all-zero');}catch(error){synthetic={assertion:error.assertion,message:error.message,expected:error.expected,actual:error.actual};}
  if(!synthetic)throw new Error('Cached missing-clear assertion unexpectedly passed');
  report.counterexamples.push({name:'cached-missing-clear-reset',scope:'Assertion-only synthetic cached bytes; not native GPU mutation',outcome:synthetic,intendedAssertionFailed:true});
  if(report.unexpectedErrors.length)throw new Error(`Unexpected browser errors: ${JSON.stringify(report.unexpectedErrors)}`);
  report.status=report.fixtureFailures.length?'FAIL':'PASS';
} catch(error) {
  report.failure={name:error.name,message:error.message,stack:error.stack};
  report.status=/INCOMPLETE|WEBGPU_UNAVAILABLE|ADAPTER_UNAVAILABLE|ENGINE_START_FAILED|browserType.launch/.test(error.message)?'INCOMPLETE':'FAIL';
  process.exitCode=1;
} finally {
  try{await browser?.close();}catch(error){report.unexpectedErrors.push({window:'cleanup',message:error.message});report.status='FAIL';process.exitCode=1;}
  if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}
  const after=await identity();report.identityAfter=after;report.originalProductPreserved=JSON.stringify(before)===JSON.stringify(after);
  if(!report.originalProductPreserved){report.status='FAIL';process.exitCode=1;}
  report.counts={frames:report.fixtures.length,failedRequiredFixtures:report.fixtureFailures.length,rawChecks:report.fixtures.reduce((n,f)=>n+f.checks.length,0),screenshots:report.composition.length,compositionChecks:report.composition.reduce((n,f)=>n+f.checks.length,0),counterexamples:report.counterexamples.length,unexpectedErrors:report.unexpectedErrors.length};
  report.exitStatus=report.status==='PASS'?0:1;process.exitCode=report.exitStatus;
  await save('result.json',report);await save('requests.json',report.requests);
  console.log(JSON.stringify({status:report.status,exitStatus:report.exitStatus,counts:report.counts,failure:report.failure,originalProductPreserved:report.originalProductPreserved,output},null,2));
}
