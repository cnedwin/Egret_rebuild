// Independently authored first-party native Canvas collector. Apache-2.0.
// This collector imports the existing sealed SDK graph unchanged; it never builds it.
import { readFile, writeFile, mkdir, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { admitCollection, projectApplication, projectImportMap, classifyConsole } from './hit-test-canvas-contract.mjs';

const ownRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const args=new Map();
for(let i=2;i<process.argv.length;i+=2){const key=process.argv[i],value=process.argv[i+1];if(!/^--(repository|application-root|playwright|channel|output)$/.test(key)||!value||args.has(key))throw new Error('Expected unique named collector arguments');args.set(key,value);}
for(const key of ['--repository','--playwright','--output'])if(!args.has(key))throw new Error('Missing '+key);
const repository=await realpath(args.get('--repository'));
const applicationRoot=await realpath(args.get('--application-root')??ownRoot);
const output=path.resolve(args.get('--output'));
const contains=(root,item)=>{const r=path.resolve(root).toLowerCase(),p=path.resolve(item).toLowerCase();return p===r||p.startsWith(r+path.sep);};
if(contains(repository,output)||contains(applicationRoot,output))throw new Error('Fresh output must be outside SDK and application inputs');
await mkdir(path.dirname(output),{recursive:true});
await mkdir(output); // Exclusive creation: evidence is never overwritten or reused.
const recipe=JSON.parse(await readFile(path.join(applicationRoot,'tests/fixtures/hit-test-canvas/cases.json')));
const pending=new Set(),owned=[],failures=[];
async function bounded(promise,label,ms=recipe.bounds.awaitMs){
  const task=Promise.resolve(promise);pending.add(task);task.then(()=>pending.delete(task),()=>pending.delete(task));
  let timer;try{return await Promise.race([task,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Deadline: '+label)),ms);})]);}finally{clearTimeout(timer);}
}
async function acquire(label,create,retire){
  const record={label,retire,value:undefined,retired:false};owned.push(record);
  record.promise=Promise.resolve().then(create).then(value=>{record.value=value;return value;});
  return{record,value:await bounded(record.promise,label)};
}
async function retire(record){
  if(record===undefined)return true;
  if(record.cleanup===undefined)record.cleanup=record.promise.then(value=>record.retire(value),()=>{}).then(()=>{record.retired=true;});
  try{await bounded(record.cleanup,'retire '+record.label,recipe.bounds.cleanupMs);return true;}catch(cause){failures.push({label:record.label,cause:String(cause)});return false;}
}
async function pin(file,role){const resolved=await realpath(file),info=await stat(resolved);if(!info.isFile()||info.size>16777216)throw new Error('Input identity budget: '+file);const bytes=await readFile(resolved);if(bytes.length!==info.size)throw new Error('Input changed while reading');return{path:resolved,bytes:bytes.length,sha256:hash(bytes),role};}
async function save(name,kind,bytes){const body=Buffer.from(bytes);await writeFile(path.join(output,name),body,{flag:'wx'});return{kind,path:name,bytes:body.length,sha256:hash(body)};}

// The observer delegates original EventTarget methods and only counts six app pairs.
function installPairObserver({budget}){
  const proto=EventTarget.prototype,add=proto.addEventListener,remove=proto.removeEventListener;
  const selected=new Set(['toggle-upper','toggle-gate','toggle-children','close']);
  const pairs=[];let registrations=0,removals=0,overflow=false,canvas;
  const capture=options=>typeof options==='boolean'?options:options?.capture===true;
  function admit(target,type){
    if(target===window&&type==='pagehide')return true;
    if(target instanceof Element&&target.id==='scene'&&type==='pointerdown'){canvas=target;return true;}
    return target instanceof Element&&selected.has(target.id)&&type==='click';
  }
  function observedAdd(type,callback,options){
    const result=Reflect.apply(add,this,arguments);
    if(admit(this,type)&&callback!=null&&!pairs.some(p=>p.target===this&&p.type===type&&p.callback===callback&&p.capture===capture(options))){
      registrations++;if(pairs.length>=budget)overflow=true;else pairs.push({target:this,type,callback,capture:capture(options)});
    }return result;
  }
  function observedRemove(type,callback,options){
    const result=Reflect.apply(remove,this,arguments);
    if(admit(this,type)){const index=pairs.findIndex(p=>p.target===this&&p.type===type&&p.callback===callback&&p.capture===capture(options));if(index>=0){pairs.splice(index,1);removals++;}}
    return result;
  }
  proto.addEventListener=observedAdd;proto.removeEventListener=observedRemove;
  const port=Object.freeze({
    snapshot:()=>({registrations,removals,outstanding:pairs.length,overflow}),
    surface:()=>canvas?{width:canvas.width,height:canvas.height,connected:canvas.isConnected}:null,
    restore(){proto.addEventListener=add;proto.removeEventListener=remove;const restored=proto.addEventListener===add&&proto.removeEventListener===remove;pairs.length=0;canvas=undefined;delete window.__egretHitTestPairs;return restored;},
  });
  Object.defineProperty(window,'__egretHitTestPairs',{value:port,configurable:true});
}

let graph,browser,browserRecord,server,serverRecord,origin,inputBefore=[],inputAfter=[];
const report={schemaVersion:1,runId:randomUUID(),createdAt:new Date().toISOString(),inputs:{before:[],after:[]},contexts:[],retirement:{browserClosed:false,serverClosed:false,pendingActors:1},scope:recipe.lifecycleScope};
const appPaths=['examples/hit-test/index.html','examples/hit-test/main.mjs','examples/hit-test/application.mjs','examples/hit-test/scene.mjs','tests/hit-test-scene.test.mjs'];
const verifierPaths=['tools/verify-hit-test-canvas.mjs','tools/hit-test-canvas-contract.mjs','tests/fixtures/hit-test-canvas/cases.json','tests/fixtures/hit-test-canvas/reference.mjs','tests/hit-test-canvas-verifier.test.mjs'];
const graphPath=path.join(repository,'tools/sequence-player/file-graph.mjs');
const appSource={};
const routes=new Map();
let runnerError;
try{
  const helper=await import(pathToFileURL(graphPath).href);
  const entries={engine:path.join(repository,'packages/engine/dist/index.js'),web:path.join(repository,'packages/engine/dist/web/index.js'),runtime:path.join(repository,'packages/runtime/dist/index.js'),contracts:path.join(repository,'packages/contracts/dist/index.js'),state:path.join(repository,'packages/engine/dist/internal/texturedFrameState.js')};
  graph=await helper.sealGraph({repositoryRoot:repository,entryPaths:{canvas:[entries.engine,entries.web]},aliases:{'@egret/engine':entries.engine,'@egret/engine/web':entries.web,'@egret/runtime':entries.runtime,'@egret/contracts':entries.contracts,'#egret-textured-frame-state':entries.state}});
  if(graph.inventory.length+appPaths.length+verifierPaths.length+1>256)throw new Error('Finite input inventory exceeded');
  inputBefore=[...graph.inventory,...await Promise.all(appPaths.map(p=>pin(path.join(applicationRoot,p),'first-party-application'))),...await Promise.all(verifierPaths.map(p=>pin(path.join(applicationRoot,p),'first-party-verifier'))),await pin(graphPath,'existing-unmodified-graph-helper')].sort((a,b)=>a.path.localeCompare(b.path));
  report.inputs.before=inputBefore;report.sdkGraph={modules:graph.modules,closures:graph.closures,totalBytes:graph.totalBytes};
  for(const key of ['index.html','main.mjs','application.mjs','scene.mjs'])appSource[key]=await readFile(path.join(applicationRoot,'examples/hit-test',key),'utf8');
  for(const [route,value] of graph.routes)routes.set(route,value);
  routes.set('/reference.mjs',{bytes:await readFile(path.join(applicationRoot,'tests/fixtures/hit-test-canvas/reference.mjs')),contentType:'text/javascript; charset=utf-8'});
  const imports={'@egret/engine':graph.routeFor(entries.engine),'@egret/engine/web':graph.routeFor(entries.web),'@egret/runtime':graph.routeFor(entries.runtime),'@egret/contracts':graph.routeFor(entries.contracts),'#egret-textured-frame-state':graph.routeFor(entries.state)};
  if(Object.values(imports).some(v=>typeof v!=='string'))throw new Error('Sealed graph import-map route absent');
  for(const id of ['baseline',...recipe.controls.map(c=>c.id)]){
    const projected=projectApplication({scene:appSource['scene.mjs'],application:appSource['application.mjs']},id);
    const adapter=projectImportMap(appSource['index.html'],imports),html=adapter.html;
    (report.importMapAdaptations??=[]).push({context:id,...adapter.adaptation});
    for(const [name,text] of Object.entries({'index.html':html,'main.mjs':appSource['main.mjs'],'application.mjs':projected.application,'scene.mjs':projected.scene}))routes.set('/'+id+'/'+name,{bytes:Buffer.from(text),contentType:name.endsWith('.html')?'text/html; charset=utf-8':'text/javascript; charset=utf-8'});
  }
  report.servedApplication=[...routes].filter(([route])=>!route.startsWith('/m/')).map(([route,v])=>({route,bytes:v.bytes.length,sha256:hash(v.bytes)}));
  const acquiredServer=await acquire('loopback server',()=>new Promise((resolve,reject)=>{
    const instance=createServer((request,response)=>{
      const route=routes.get(request.url);if(request.method!=='GET'||!route){response.writeHead(404,{'content-type':'text/plain'});response.end('Unselected route');return;}
      response.writeHead(200,{'content-type':route.contentType,'cache-control':'no-store'});response.end(route.bytes);
    });instance.once('error',reject);instance.listen(0,'127.0.0.1',()=>resolve(instance));
  }),instance=>new Promise((resolve,reject)=>{instance.close(error=>error?reject(error):resolve());instance.closeAllConnections();}));
  server=acquiredServer.value;serverRecord=acquiredServer.record;origin='http://127.0.0.1:'+server.address().port;
  const playwrightLocation=await realpath(args.get('--playwright'));
  const playwright=await import(pathToFileURL(path.join(playwrightLocation,'index.mjs')).href);
  const acquiredBrowser=await acquire('browser',()=>playwright.chromium.launch({headless:true,channel:args.get('--channel')??'msedge'}),instance=>instance.close());
  browser=acquiredBrowser.value;browserRecord=acquiredBrowser.record;
  report.environment={node:process.version,browserVersion:browser.version(),channel:args.get('--channel')??'msedge',headless:true,viewport:{width:900,height:700},deviceScaleFactor:1,playwrightPath:playwrightLocation};
  for(const id of ['baseline',...recipe.controls.map(c=>c.id)])await collectContext(id);
}catch(cause){runnerError=String(cause);report.runnerError=runnerError;}
finally{
  // Retire every acquired actor, including resources that arrive after a deadline.
  for(const record of [...owned].reverse())await retire(record);
  for(const before of inputBefore){try{const after=await pin(before.path,before.role);inputAfter.push({...before,bytes:after.bytes,sha256:after.sha256});}catch(cause){failures.push({label:'input readback',path:before.path,cause:String(cause)});}}
  report.inputs.after=inputAfter;
  report.retirement={browserClosed:browserRecord?.retired===true,serverClosed:serverRecord?.retired===true,pendingActors:pending.size+owned.filter(r=>!r.retired).length};
  report.retirementFailures=failures;
}
const admitted=await admitCollection(report,{recipe,readArtifact:name=>readFile(path.join(output,name))});
// A runner failure or failed retirement cannot be converted into expected sensitivity.
const result=runnerError||failures.length?{status:'INCOMPLETE',nativeInputAccepted:false,issues:[{code:'RUNNER_FAILURE',cause:runnerError??failures}]}:admitted;
await writeFile(path.join(output,'collection.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
await writeFile(path.join(output,'result.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({status:result.status,nativeInputAccepted:result.nativeInputAccepted,contexts:report.contexts.length,output}));
if(result.status!=='PASS_DESKTOP_HT1_CANVAS_SUBSET')process.exitCode=1;

async function collectContext(id){
  const contextReport={id,contextId:randomUUID(),rows:[],artifacts:[],errors:[],advisories:[],recordOverflow:false,cleanup:{contextClosed:false,observerRestored:false,pendingActors:1}};report.contexts.push(contextReport);
  let context,page,contextRecord,pageRecord,beforeScreenshot,afterScreenshot,observerRestored=false;
  const end=Date.now()+recipe.bounds.contextMs;
  const action=(promise,label)=>bounded(promise,id+'/'+label,Math.max(1,Math.min(recipe.bounds.awaitMs,end-Date.now())));
  const diagnostic=(kind,message,bucket='errors')=>{if(contextReport.errors.length+contextReport.advisories.length>=recipe.bounds.records){contextReport.recordOverflow=true;return;}contextReport[bucket].push({kind,message});};
  const main='/'+id+'/main.mjs';let requestCount=0;
  const referenceState={upperVisible:true,gateVisible:true,feedbackColor:0x404040};
  const read=()=>action(page.evaluate(async route=>(await import(route)).readSnapshot(),main),'scalar snapshot');
  const ledger=()=>action(page.evaluate(()=>window.__egretHitTestPairs.snapshot()),'native pair ledger');
  const pointer=async point=>{
    const box=await action(page.locator('#scene').boundingBox(),'canvas bounds');if(!box||box.width!==640||box.height!==400)throw new Error('Unexpected Canvas CSS geometry');
    const position=[box.x+point[0]*2,box.y+point[1]*2];await action(page.mouse.click(...position),'native pointer');return{method:'page.mouse.click',logical:point,page:position,box};
  };
  const button=async selector=>{const box=await action(page.locator(selector).boundingBox(),'button bounds');if(!box)throw new Error('Missing native button');const position=[box.x+box.width/2,box.y+box.height/2];await action(page.mouse.click(...position),'native '+selector);return{method:'page.mouse.click',selector,page:position,box};};
  const sample=points=>action(page.evaluate(async({points,state})=>{
    const reference=await import('/reference.mjs');let surface=window.__egretHitTestReference;
    if(!surface){surface=document.createElement('canvas');surface.width=320;surface.height=200;window.__egretHitTestReference=surface;}
    const native=surface.getContext('2d');reference.paintReference(native,state);
    const target=document.querySelector('#scene').getContext('2d');
    return{target:points.map(point=>({point,rgba:Array.from(target.getImageData(point[0],point[1],1,1).data)})),reference:reference.sampleReference(native,points)};
  },{points,state:{...referenceState}}),'literal native RGBA samples');
  try{
    const acquired=await acquire(id+'/context',()=>browser.newContext({viewport:{width:900,height:700},deviceScaleFactor:1}),instance=>instance.close());context=acquired.value;contextRecord=acquired.record;
    await action(context.addInitScript(installPairObserver,{budget:recipe.bounds.ledger}),'observer bootstrap');
    await action(context.route('**/*',route=>{
      requestCount++;const url=route.request().url();let selected=false;try{const parsed=new URL(url);selected=parsed.origin===origin&&routes.has(parsed.pathname)&&parsed.search==='';}catch{}
      if(requestCount>recipe.bounds.requests||!selected){diagnostic('UNSELECTED_REQUEST',url);return route.abort();}return route.continue();
    }),'loopback-only requests');
    const acquiredPage=await acquire(id+'/page',()=>context.newPage(),instance=>instance.close());page=acquiredPage.value;pageRecord=acquiredPage.record;
    page.on('console',message=>{const classified=classifyConsole(message.type(),message.text());if(classified)diagnostic(classified.record.kind,classified.record.message,classified.bucket);});
    page.on('pageerror',cause=>diagnostic('PAGE_ERROR',String(cause)));
    page.on('requestfailed',request=>diagnostic('REQUEST_FAILED',request.url()+': '+request.failure()?.errorText));
    page.on('response',response=>{if(response.status()>=400)diagnostic('HTTP_ERROR',response.url()+': '+response.status());});
    await action(page.goto(origin+'/'+id+'/index.html',{waitUntil:'load',timeout:recipe.bounds.awaitMs}),'HTML entry');
    await action(page.waitForFunction(async route=>(await import(route)).readSnapshot().phase==='ready',main,{timeout:recipe.bounds.awaitMs}),'Ready');
    const initial=await sample(recipe.initialSamples.map(s=>s.point));
    const geometry=await action(page.evaluate(()=>{const canvas=document.querySelector('#scene'),rect=canvas.getBoundingClientRect();return{logical:[canvas.width,canvas.height],css:[rect.width,rect.height],viewport:[innerWidth,innerHeight],deviceScaleFactor:devicePixelRatio};}),'backing geometry');
    contextReport.rows.push({id:'B01',snapshot:await read(),geometry,samples:initial.target,reference:initial.reference,ledger:await ledger()});
    beforeScreenshot=await action(page.screenshot(),'supplemental initial screenshot');
    const partial=recipe.controls.find(c=>c.id===id)?.row==='B02';
    for(const row of recipe.rows.slice(1,-1)){
      if(partial&&row.id!=='B02')break;
      const observed={id:row.id,steps:[]};contextReport.rows.push(observed);
      for(const expected of row.steps){
        let toggleInput;
        if(expected.toggle){const flag={upper:'upperVisible',gate:'gateVisible',children:'touchChildren'}[expected.toggle];toggleInput=await button('#toggle-'+expected.toggle);referenceState[flag]=!referenceState[flag];}
        const before=await read(),input=await pointer(expected.point),after=await read();
        // Reference state follows predeclared outcomes, never target snapshots/query results.
        referenceState.feedbackColor=expected.feedback;
        const pixels=await sample([expected.point,[284,28]]);
        observed.steps.push({before,after,input,...(toggleInput?{toggleInput}:{}),scenePixel:pixels.target[0].rgba,feedback:pixels.target[1].rgba,referenceScenePixel:pixels.reference[0].rgba,referenceFeedback:pixels.reference[1].rgba});
      }
    }
    if(!partial){
      const before=await read(),canvasBox=await action(page.locator('#scene').boundingBox(),'former Canvas bounds');
      const buttonBoxes=await Promise.all(['#toggle-upper','#toggle-gate','#toggle-children','#close'].map(async selector=>({selector,box:await action(page.locator(selector).boundingBox(),'former button bounds')})));
      const input=await button('#close');
      await action(page.waitForFunction(async route=>(await import(route)).readSnapshot().phase==='closed',main,{timeout:recipe.bounds.awaitMs}),'closed');
      await action(page.evaluate(async route=>{await(await import(route)).close();return true;},main),'shared close settlement');
      const after=await read(),surface=await action(page.evaluate(()=>window.__egretHitTestPairs.surface()),'retired Canvas dimensions'),pairs=await ledger(),probes=[];
      const formerPosition=[canvasBox.x+56*2,canvasBox.y+48*2];await action(page.mouse.click(...formerPosition),'closed former Canvas probe');probes.push({method:'page.mouse.click',kind:'former-canvas',logical:[56,48],page:formerPosition,box:canvasBox});
      for(const entry of buttonBoxes){if(!entry.box)throw new Error('Former native button box absent');const position=[entry.box.x+entry.box.width/2,entry.box.y+entry.box.height/2];await action(page.mouse.click(...position),'closed '+entry.selector);probes.push({method:'page.mouse.click',selector:entry.selector,page:position,box:entry.box});}
      contextReport.rows.push({id:'B10',before,after,afterProbe:await read(),input,probes,surface,ledger:pairs,settled:true});
    }
    afterScreenshot=await action(page.screenshot(),'supplemental final screenshot');
  }catch(cause){diagnostic('COLLECTION_FAILURE',String(cause));}
  finally{
    // Cleanup is independent of baseline/control comparison and never a control PASS.
    if(page){try{await bounded(page.evaluate(async route=>{await(await import(route)).close();return true;},main),id+'/cleanup app',recipe.bounds.cleanupMs);}catch(cause){diagnostic('APP_CLEANUP',String(cause));}
      try{observerRestored=await bounded(page.evaluate(()=>{delete window.__egretHitTestReference;return window.__egretHitTestPairs?.restore()===true;}),id+'/restore observer',recipe.bounds.cleanupMs);}catch(cause){diagnostic('OBSERVER_CLEANUP',String(cause));}}
    const pageClosed=await retire(pageRecord),contextClosed=await retire(contextRecord);
    contextReport.cleanup={contextClosed:contextClosed&&pageClosed,observerRestored,pendingActors:pending.size+owned.filter(r=>r.label.startsWith(id+'/')&&!r.retired).length};
  }
  contextReport.requestCount=requestCount;
  if(beforeScreenshot&&afterScreenshot){
    const groups=[{row:contextReport.rows[0],points:recipe.initialSamples.map(s=>s.point),target:contextReport.rows[0].samples.flatMap(s=>s.rgba),reference:contextReport.rows[0].reference.flatMap(s=>s.rgba)}];
    for(const row of contextReport.rows.slice(1))for(const [index,step] of (row.steps??[]).entries())groups.push({row:step,points:[recipe.rows.find(r=>r.id===row.id).steps[index].point,[284,28]],target:[...step.scenePixel,...step.feedback],reference:[...step.referenceScenePixel,...step.referenceFeedback]});
    const raw=[];
    for(const role of ['target','reference']){
      const bytes=Buffer.from(groups.flatMap(group=>group[role])),artifact=await save(id+'.'+role+'.rgba',role+'-rgba',bytes);raw.push(artifact);let offset=0;
      for(const group of groups){const length=group[role].length;(group.row.raw??={})[role]={artifact:artifact.path,sha256:artifact.sha256,offset,length,points:group.points,geometry:recipe.dimensions};offset+=length;}
    }
    contextReport.artifacts=[await save(id+'.before.png','before',beforeScreenshot),await save(id+'.after.png','after',afterScreenshot),await save(id+'.rows.json','rows',JSON.stringify(contextReport.rows,null,2)+'\n'),...raw];
  }
}
