// SPDX-License-Identifier: Apache-2.0
// Original finite native collector. Source review and a reviewed standalone snapshot precede execution.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createHash, randomUUID} from 'node:crypto';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {createServer} from 'node:http';

const hash = raw => createHash('sha256').update(raw).digest('hex');
const decode = raw => new TextDecoder('utf-8', {fatal:true}).decode(raw);
const equal = (actual, expected, label) => { if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(label + ': ' + JSON.stringify({actual, expected})); };
const requireThat = (value, label) => { if (!value) throw new Error(label); };
const args = new Map(); let snapshotOnly = false;
for (let index=2; index<process.argv.length; index++) {
  const key=process.argv[index];
  if (key==='--snapshot-only' && !snapshotOnly) {snapshotOnly=true; continue;}
  if (!['--repository','--application-root','--snapshot','--output','--playwright'].includes(key) || args.has(key) || !process.argv[index+1]) throw new Error('Unique named arguments required');
  args.set(key,process.argv[++index]);
}
for (const key of ['--repository','--snapshot']) requireThat(path.isAbsolute(args.get(key)??''),'Absolute '+key+' required');
if(args.has('--application-root'))requireThat(path.isAbsolute(args.get('--application-root')),'Absolute --application-root required');
const repository=fs.realpathSync(args.get('--repository'));
const applicationRoot=fs.realpathSync(args.get('--application-root')??path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'));
const physical=process.platform==='win32'?path.win32:path.posix;
const inputOwnerRoots=[repository,applicationRoot];
// Authenticate the shared helper through builtins, before evaluating any local module.
let helper=repository;
for (const [index,part] of 'tools/lib/file-identity.mjs'.split('/').entries()) {
  requireThat(fs.readdirSync(helper).includes(part),'File-identity exact spelling differs');
  helper=physical.join(helper,part); const stat=fs.lstatSync(helper);
  requireThat(!stat.isSymbolicLink() && (index<2?stat.isDirectory():stat.isFile()),'File-identity owner component differs');
}
requireThat(physical.relative(repository,fs.realpathSync(helper)).split(physical.sep).join('/')==='tools/lib/file-identity.mjs','File-identity physical owner differs');
const helperRaw=fs.readFileSync(helper),helperURL=pathToFileURL(helper);
requireThat(helperRaw.length===5065&&hash(helperRaw)==='999b355c6e0d03f17853ee05f33abc9fecbb34ad80607963e11f913a4f815569','File-identity raw bootstrap differs');
requireThat(physical.relative(helper,fileURLToPath(helperURL))==='','File-identity URL round trip differs');
const identity=await import(helperURL.href);
const inside=(owner,file)=>{if(identity.samePhysicalPath(owner,file))return true;try{identity.ownerRelativePath(owner,file);return true;}catch{return false;}};
function rawInput(owner,relative,expected) {
  identity.logicalPath(relative); const pin=identity.fingerprintFile(owner,relative);
  const raw=fs.readFileSync(path.join(owner,relative));
  equal({bytes:raw.length,sha256:hash(raw)},{bytes:pin.bytes,sha256:pin.sha256},'Input changed during read '+relative);
  if(expected)equal({bytes:pin.bytes,sha256:pin.sha256},expected,'Selected raw identity '+relative);
  return {raw,pin};
}
function newExternal(file) {
  requireThat(path.isAbsolute(file??''),'Absolute private destination required');
  identity.logicalPath(path.basename(file));
  const target=path.join(fs.realpathSync(path.dirname(file)),path.basename(file));
  requireThat(!inputOwnerRoots.some(root=>inside(root,target)),'Destination belongs to an input owner');
  requireThat(!fs.existsSync(target),'Destination already exists'); return target;
}
const boundary=rawInput(applicationRoot,'tools/resource-scene-boundary.mjs',{bytes:25753,sha256:'10c52ae5f7c33d1550c9231956297bb041c7a8cb67af8c19b0fdf41842bc4cd4'});
const oracleInput=rawInput(applicationRoot,'tools/resource-scene/oracle.mjs',{bytes:5536,sha256:'cbe5e58f681d032eecfb726bbe6e18945d4488b818f7b932f3f4606cd2e0c887'});
const mainInput=rawInput(applicationRoot,'examples/resource-scene/main.mjs',{bytes:38946,sha256:'3621c5714c04efab75b7cb199c6ecb4b14d931d47acd167be3fb241729298bc5'});
const projectedSelf=rawInput(applicationRoot,'tools/verify-resource-scene.mjs');
const executingFile=fs.realpathSync(fileURLToPath(import.meta.url));
const executingOwner=fs.realpathSync(path.resolve(path.dirname(executingFile),'..'));
const executingSelf=rawInput(executingOwner,'tools/verify-resource-scene.mjs');
requireThat(identity.samePhysicalPath(executingFile,path.join(executingOwner,'tools/verify-resource-scene.mjs')),'Collector physical owner differs');
requireThat(executingSelf.raw.equals(projectedSelf.raw),'Executing collector differs from selected application collector');
inputOwnerRoots.push(executingOwner);
const manifestInput=rawInput(applicationRoot,'tools/resource-scene/reference/manifest.json',{bytes:4364,sha256:'3fd92da19b29877da856e104d857b606305745baf280a9f3258d41a166247e8a'});
const reference=JSON.parse(decode(manifestInput.raw));
const referenceInputs=reference.strings.map(row=>rawInput(applicationRoot,'tools/resource-scene/reference/'+row.rgba.path,{bytes:row.rgba.bytes,sha256:row.rgba.sha256}));
const nativeCollector={ownerRoot:executingOwner,path:'tools/verify-resource-scene.mjs',bytes:executingSelf.pin.bytes,sha256:executingSelf.pin.sha256,applicationRoot,projectedByteIdentical:true};
const nativeClosure={nativeCollector,boundary:boundary.pin,oracle:oracleInput.pin,main:mainInput.pin,reference:manifestInput.pin,referenceRgba:referenceInputs.map(value=>value.pin),helper:{path:'tools/lib/file-identity.mjs',bytes:helperRaw.length,sha256:hash(helperRaw)}};
let expectedRaw,expected;
if(!snapshotOnly){expectedRaw=fs.readFileSync(args.get('--snapshot'));expected=JSON.parse(decode(expectedRaw));equal(nativeClosure,expected.nativeClosure,'Reviewed native collector closure differs before dynamic import');}
const {collectResourceSceneSource}=await import(pathToFileURL(path.join(applicationRoot,'tools/resource-scene-boundary.mjs')).href);
const collected=await collectResourceSceneSource({repository,applicationRoot});
inputOwnerRoots.push(...Object.values(collected.snapshot.owners));
const currentSnapshot={schemaVersion:1,kind:'RESOURCE_SCENE_COMPLETE_NATIVE_INPUT_SNAPSHOT',nativeClosure,source:collected.snapshot};
if(snapshotOnly){const target=newExternal(args.get('--snapshot'));fs.writeFileSync(target,JSON.stringify(currentSnapshot,null,2)+'\n',{flag:'wx'});const bytes=fs.readFileSync(target);console.log(JSON.stringify({status:'SOURCE_SNAPSHOT_ONLY_NO_BROWSER',path:target,bytes:bytes.length,sha256:hash(bytes)}));process.exit(0);}
equal(currentSnapshot,expected,'Complete reviewed snapshot differs');
for(const key of ['--playwright','--output'])requireThat(path.isAbsolute(args.get(key)??''),'Absolute '+key+' required');
const playwrightRoot=fs.realpathSync(args.get('--playwright'));
inputOwnerRoots.push(playwrightRoot);
const output=newExternal(args.get('--output'));fs.mkdirSync(output);
const pwPackage=rawInput(playwrightRoot,'package.json'),pwMeta=JSON.parse(decode(pwPackage.raw)),pwEntry=rawInput(playwrightRoot,'index.mjs');
requireThat(pwMeta.name==='playwright'&&pwMeta.version==='1.62.1','Original Playwright 1.62.1 required');
const playwright=await import(pathToFileURL(path.join(playwrightRoot,'index.mjs')).href);
const oracle=await import(pathToFileURL(path.join(applicationRoot,'tools/resource-scene/oracle.mjs')).href);
equal(oracle.SCENE_GEOMETRY.frame,{width:192,height:128,pixelRatio:1,clear:[0,0,0,255]},'Independent frame geometry');
const CANVAS_READBACK_ADVISORY="Canvas2D: Multiple readback operations using getImageData are faster with the willReadFrequently attribute set to true. See: https://html.spec.whatwg.org/multipage/canvas.html#concept-canvas-will-read-frequently";
const isReadbackAdvisory=(run,row)=>run.profile==='canvas-2d'&&row.type==='warning'&&row.text===CANVAS_READBACK_ADVISORY;
const unexpectedConsole=run=>run.console.filter(row=>!isReadbackAdvisory(run,row));
const report={schemaVersion:1,runId:randomUUID(),status:'RUNNING',snapshot:{path:args.get('--snapshot'),bytes:expectedRaw.length,sha256:hash(expectedRaw)},environment:{node:process.version,platform:os.platform(),arch:os.arch(),release:os.release(),browserChannel:'msedge',extraLaunchFlags:[],playwrightVersion:pwMeta.version,playwrightPackage:pwPackage.pin,playwrightEntry:pwEntry.pin,viewport:{width:960,height:800},deviceScaleFactor:1,locale:'zh-CN'},runs:[],failures:[],retirementFailures:[],sourceControls:'Separate original boundary tests/results required; not claimed by this native run',limits:['Finite literal interior points and two fixed CJK ROIs only; full RGBA retention is not exhaustive image acceptance.','Recorded desktop Edge/Win32 environment only; no physical screen/phone/SDK, fallback, performance, Spine or whole-engine result.','No remote CI or publication/Main delivery claim.']};
report.consolePolicy={retainedReadbackAdvisory:{profile:'canvas-2d',type:'warning',text:CANVAS_READBACK_ADVISORY,classification:'retained-readback-advisory'},allErrors:'reject',otherWarnings:'reject',GPUWarnings:'reject',originalRows:'retained unchanged; no console event suppression',contextSettings:'unchanged default CanvasHost path'};
const pending=new Set(),owners=[];
async function bounded(original,label,milliseconds=20000){const task=Promise.resolve(original);pending.add(task);void task.then(()=>pending.delete(task),()=>pending.delete(task));let timer;try{return await Promise.race([task,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Deadline: '+label)),milliseconds);})]);}finally{clearTimeout(timer);}}
async function acquire(label,create,close){const owner={label,promise:Promise.resolve().then(create),close,retired:false};owners.push(owner);return bounded(owner.promise,'acquire '+label);}
async function retire(owner){owner.retirement??=owner.promise.then(value=>owner.close(value),()=>undefined).then(()=>{owner.retired=true;});try{await bounded(owner.retirement,'retire '+owner.label);}catch(cause){report.retirementFailures.push({owner:owner.label,message:String(cause)});}}
const R=[255,0,0,255],G=[0,255,0,255],B=[0,0,255,255],Y=[255,255,0,255],K=[0,0,0,255],W=[255,255,255,255],DARK=[32,32,32,255],CARD=[64,64,64,255];
const LEFT='pilot-left',RIGHT='pilot-right';
const BASE={leftOutfit:'A',leftAtlas:'v1',leftPose:0,rightPose:0,selected:'left',ahem:'X X',view:'normal'};
function pointOracle(profile,state){
 const p=[['badge-red',10,10,R],['badge-green',22,10,G],['ahem-first',35,11,W],['ahem-gap',43,11,state.ahem==='XX'?W:K],['ahem-second',51,11,state.ahem==='XX'?K:W],['right-torso',136,72,R],['right-head',136,54,[255,192,128,255]],['right-leg',125,87,state.rightPose? (state.selected==='right'?W:CARD):DARK],['depth-front',96,64,profile==='canvas-2d'?K:R],['depth-back',32,24,profile==='canvas-2d'?K:B]];
 if(state.view==='rotation')p.push(['left-rotated-torso',80,96,Y]);
 else {p.push(['left-torso',56,72,({A:R,B:G,C:B,D:Y})[state.leftOutfit]],['left-head',56,54,state.leftAtlas==='v1'?[255,192,128,255]:[0,255,255,255]],['left-leg',45,87,state.leftPose?(state.selected==='left'?W:CARD):DARK]);if(state.view==='clip'){for(const row of p)if(['left-torso','left-head'].includes(row[0]))row[3]=CARD;p.push(['left-kept',52,72,Y]);}if(state.view==='absent')for(const row of p)if(row[0].startsWith('left-'))row[3]=CARD;}
 return p;
}
function comparePixels(raw,profile,state,fault){
 const samples=pointOracle(profile,state).map(([name,x,y,expected])=>{const rgba=Array.from(raw.subarray((y*192+x)*4,(y*192+x)*4+4));return {name,point:[x,y],expected,rgba,mismatchChannels:rgba.reduce((n,v,c)=>n+Number(v!==expected[c]),0)};});
 const mismatches=samples.filter(row=>row.mismatchChannels);
 let assigned=[];
 if(fault==='wrong-outfit')assigned=[['left-torso',G]];
 if(fault==='wrong-time')assigned=[['left-leg',W],['right-leg',CARD]];
 if(fault==='wrong-depth')assigned=[['depth-front',B]];
 if(fault){equal(mismatches.map(row=>row.name).sort(),assigned.map(row=>row[0]).sort(),'Assigned negative mismatch set');for(const [name,actual]of assigned)equal(samples.find(row=>row.name===name).rgba,actual,'Assigned negative wrong color '+name);}
 else requireThat(mismatches.length===0,'Literal pixel mismatch '+JSON.stringify(mismatches));
 const row=reference.strings.find(value=>value.id===state.selected),ref=referenceInputs[reference.strings.indexOf(row)].raw;
 let changed=0,maxDifference=0;
 for(let sy=4;sy<20;sy++)for(let sx=4;sx<68;sx++){
   const a=ref[(sy*128+sx)*4+3],x=sx+68,y=sy+4,blue=profile==='webgpu-scene-textured'&&y>=16;
   const expected=[a,a,blue?255:a,255],offset=(y*192+x)*4,tolerance=a>0&&a<255?1:0;
   for(let c=0;c<4;c++){const delta=Math.abs(raw[offset+c]-expected[c]);maxDifference=Math.max(maxDifference,delta);if(delta)changed++;requireThat(delta<=(c===3?0:tolerance),'Independent CJK pixel mismatch '+JSON.stringify({x,y,c,expected:expected[c],actual:raw[offset+c],tolerance:c===3?0:tolerance}));}
 }
 return {samples,mismatches,cjk:{id:row.id,sourceRgba:row.rgba,sourceROI:[4,4,64,16],sceneROI:[72,8,64,16],pixels:1024,partialAlphaRGBTolerance:1,opaqueAndAlphaTolerance:0,changedChannels:changed,maxDifference}};
}
let origin;

function currentEpoch(view){return view.epochs.find(row=>row.epoch===view.currentEpoch);}
function assertHost(status,closed){
 if(status===null)return;
 requireThat(status?.host && status.textured && status.scene,'Actual GPU host status missing');
 requireThat(status.host.pendingFrames===0 && status.host.pendingUploadBytes===0 && status.host.pendingReadbackBytes===0 && status.textured.pendingGeometryBytes===0 && status.scene.pendingSceneBytes===0 && status.scene.pendingUniformBytes===0 && status.scene.pendingDepthBytes===0,'GPU original work pending');
 requireThat(status.host.firstFailure===null && status.host.callbackFailureCount===0,'GPU original failure/diagnostic');
 if(closed)requireThat(status.host.cleanupOutcome==='safe','GPU cleanup not proven safe');
}
function assertRetired(epoch,profile,expectedLoads,expectedDisposals){
 requireThat(epoch.retired&&epoch.safeSurface&&epoch.session?.state==='closed','Epoch not retired safely');
 requireThat(epoch.session.pendingSources===0&&epoch.session.pendingTasks===0&&epoch.pendingPresentations===0,'Original epoch tasks pending');
 equal(epoch.cleanup,[],'Epoch cleanup failures');
 equal(epoch.session.cleanupErrors,[],'Session cleanup failures');
 equal(epoch.session.diagnostics,[],'Unexpected retired SDK diagnostics');
 requireThat(epoch.fonts.length===2&&epoch.fonts.every(row=>row.loaded&&row.exactSelectedFace&&row.removed&&!row.member),'Owned font cleanup/readiness');
 requireThat(epoch.inputState==='closed','Native input not closed');
 equal(epoch.canvas,{connected:false,width:0,height:0},'Safe surface retirement');
 requireThat(epoch.warmLeases===0&&epoch.warmPending===0&&epoch.warmRequests.every(row=>row.outcome!=='pending'),'Warm original work pending');
 requireThat(epoch.reads.length===expectedLoads&&epoch.loads.length===expectedLoads,'Original PNG ledger count');
 requireThat(epoch.reads.every(row=>row.bytesVerified&&row.outcome!=='pending'&&(!row.held||row.gateSettled)),'Original fetched/held bytes incomplete');
 requireThat(epoch.loads.every(row=>row.outcome!=='pending'&&(!row.textureIssued||row.textureDisposed===true)),'Original provider load/Texture retirement');
 requireThat(epoch.disposals.length===expectedDisposals&&epoch.disposals.every(row=>row.outcome==='fulfilled'),'Provider disposer count/outcome');
 requireThat(epoch.loads.filter(row=>row.textureIssued).length===expectedDisposals,'Texture issue/dispose correspondence');
 requireThat(epoch.requests.every(row=>row.outcome!=='pending'),'Logical request pending');
 requireThat(epoch.presentations.every(row=>row.outcome==='fulfilled'&&row.idle),'Original presentation not fulfilled/idle');
 if(profile==='webgpu-scene-textured')assertHost(epoch.hostStatus,true);
}
async function run(browser,profile,kind){
 const context=await acquire(profile+'/'+kind,()=>browser.newContext({viewport:{width:960,height:800},deviceScaleFactor:1,locale:'zh-CN'}),value=>value.close());
 const owner=owners.at(-1),page=await context.newPage();
 const result={profile,kind,ordinaryCredit:kind==='ordinary',rawFrames:[],checks:[],observations:[],requests:[],pageErrors:[],console:[],requestedRoutes:[],completed:false};report.runs.push(result);
 page.on('pageerror',error=>result.pageErrors.push(String(error)));
 page.on('console',message=>{if(['error','warning'].includes(message.type()))result.console.push({type:message.type(),text:message.text()});});
 page.on('request',request=>{if(request.url().startsWith(origin+'/'))result.requestedRoutes.push(new URL(request.url()).pathname);});
 const evaluate=(fn,arg,label='page observation')=>bounded(page.evaluate(fn,arg),profile+'/'+kind+'/'+label);
 const call=(method,...values)=>evaluate(({method,values})=>globalThis.egretResourceScene[method](...values),{method,values},method);
 const inspect=()=>call('inspect');
 const wait=async(predicate,arg,label)=>bounded(page.waitForFunction(predicate,arg,{timeout:15000}),label);
 const waitRequest=async(id)=>{await wait(id=>globalThis.egretResourceScene.inspect().epochs.flatMap(e=>e.requests).find(row=>row.id===id)?.outcome && globalThis.egretResourceScene.inspect().epochs.flatMap(e=>e.requests).find(row=>row.id===id).outcome!=='pending',id,'original request settlement');const view=await inspect(),row=view.epochs.flatMap(e=>e.requests).find(r=>r.id===id);requireThat(row,'Original request absent');result.requests.push(row);return row;};
 const begin=async(method,key)=>evaluate(({method,key,left})=>{const api=globalThis.egretResourceScene;const promise=method==='reenter'?api.reenter(left):api[method](left,key);globalThis.__resourceSceneNativeProbe.tasks.push(promise);void promise.catch(()=>undefined);const rows=api.inspect().epochs.at(-1).requests;return rows.at(-1).id;},{method,key,left:LEFT},'begin original '+method);
 const held=async(name,after)=>{await wait(({name,after})=>globalThis.egretResourceScene.inspect().epochs.at(-1).reads.some(row=>row.id>after&&row.name===name&&row.held&&row.phase==='held'&&row.bytesVerified),{name,after},'actual bytes held '+name);const view=await inspect();return currentEpoch(view).reads.find(row=>row.id>after&&row.name===name&&row.held&&row.phase==='held');};
 const readsMax=async()=>{const v=await inspect();return Math.max(0,...currentEpoch(v).reads.map(r=>r.id));};
 const waitOriginal=async(id)=>wait(id=>{const e=globalThis.egretResourceScene.inspect().epochs.at(-1),i=e.reads.findIndex(r=>r.id===id);return i>=0&&e.reads[i].outcome!=='pending'&&e.loads[i]?.outcome!=='pending';},id,'original provider/source settlement');
 const seen=new Set();
 async function retain(group,state,fault){
   await evaluate(async()=>{await globalThis.egretResourceScene.presentationIdle;},null,'original presentation-idle Promise getter');
   const value=await call('readback');
   requireThat(value&&Array.isArray(value.bytes)&&value.bytes.length<=8388608&&value.bytes.every(x=>Number.isInteger(x)&&x>=0&&x<=255),'Original native bytes invalid');
   const bytes=Buffer.from(value.bytes),filename=String(result.rawFrames.length).padStart(3,'0')+'-'+group+'.rgba';
   const disk=path.join(output,profile+'-'+kind+'-'+filename);
   // Original full bytes are written before dimensions, ledger, points or glyph assertions.
   fs.writeFileSync(disk,bytes,{flag:'wx'});
   const artifact={group,label:value.label,hostId:value.hostId,epoch:value.epoch,frameId:value.frameId,serial:value.serial,width:value.width,height:value.height,filename:path.basename(disk),bytes:bytes.length,sha256:hash(bytes)};result.rawFrames.push(artifact);
   const saved=fs.readFileSync(disk);requireThat(saved.equals(bytes),'Saved original RGBA changed');
   requireThat(value.width===192&&value.height===128&&bytes.length===98304,'Original full readback dimensions');
   const view=await inspect();result.observations.push({group,view});
   for(const epoch of view.epochs)equal(epoch.session?.diagnostics,[],'Unexpected observed SDK diagnostics epoch '+epoch.epoch);
   const all=[...view.epochs.flatMap(e=>e.presentations),...view.replays.flatMap(e=>e.presentations)],fresh=all.filter(row=>row.outcome==='fulfilled'&&!seen.has(row.id));
   requireThat(fresh.length===1,'Every actual submission must be retained exactly once: '+JSON.stringify(fresh.map(r=>({id:r.id,label:r.label}))));
   const row=fresh[0];equal([value.label,value.hostId,value.frameId,value.serial],[row.label,row.hostId,row.frameId,row.serial],'Readback original presentation identity');
   requireThat(row.idle&&row.outcome==='fulfilled'&&(profile==='canvas-2d'||row.readback==='fulfilled'),'Original readback/idle barrier');seen.add(row.id);
   requireThat(!view.traceExhausted&&view.faults.length===0,'Trace exhausted or unexpected application fault');
   const comparison=comparePixels(saved,profile,state,fault);result.checks.push({group,presentationId:row.id,...comparison});
   return view;
 }
 async function frame(group,state,choice='normal'){result.observations.push({group,invokedSceneChoice:choice});await call('checkpoint',group,choice);return retain(group,state);}
 async function nativeClick(x,y,actor,state,group){
   const before=await inspect(),epoch=currentEpoch(before),count=epoch.events.length,oldFrame=epoch.presentations.length;
   await bounded(page.locator('#scene').scrollIntoViewIfNeeded(),'native canvas scroll into viewport');
   const box=await page.locator('#scene').boundingBox();requireThat(box&&box.width>0&&box.height>0,'Native canvas geometry');
   const point={x:box.x+x*box.width/192,y:box.y+y*box.height/128};
   const layout=await evaluate(point=>{const c=document.querySelector('#scene'),s=getComputedStyle(c),rect=c.getBoundingClientRect(),top=document.elementFromPoint(point.x,point.y);return {width:c.width,height:c.height,transform:s.transform,border:[s.borderTopWidth,s.borderRightWidth,s.borderBottomWidth,s.borderLeftWidth],padding:[s.paddingTop,s.paddingRight,s.paddingBottom,s.paddingLeft],rect:{x:rect.x,y:rect.y,width:rect.width,height:rect.height},viewport:{width:innerWidth,height:innerHeight,scrollX,scrollY},point,top:{isCanvas:top===c,tagName:top?.tagName??null,id:top?.id??null}};},point,'original native pointer layout');
   result.observations.push({group:group+'-native-layout',logicalPoint:[x,y],box,layout});
   requireThat(layout.width===192&&layout.height===128&&layout.transform==='none'&&[...layout.border,...layout.padding].every(v=>parseFloat(v)===0),'Unsupported CSS pointer mapping');
   requireThat([point.x,point.y,layout.viewport.width,layout.viewport.height].every(Number.isFinite)&&point.x>=0&&point.y>=0&&point.x<layout.viewport.width&&point.y<layout.viewport.height&&layout.top.isCanvas,'Native pointer point is outside viewport or covered by another DOM element');
   requireThat(['x','y','width','height'].every(key=>Math.abs(box[key]-layout.rect[key])<0.001),'Native canvas moved after bounding box observation');
   await bounded(page.mouse.move(point.x,point.y),'native pointer move');
   await bounded(page.mouse.down({button:'left'}),'native pointer down');await bounded(page.mouse.up({button:'left'}),'native pointer up');
   if(actor){await wait(({oldFrame})=>{const e=globalThis.egretResourceScene.inspect().epochs.at(-1);return e.presentations.length>oldFrame&&e.presentations.at(-1).outcome==='fulfilled'&&e.pendingPresentations===0;},{oldFrame},'native selection presentation');await retain(group,state);}
   const after=await inspect(),events=currentEpoch(after).events.slice(count),entity=events.filter(row=>row.actor!==null);
   if(actor){equal(entity.map(row=>row.kind),['begin','end','activate'],'Native actor event sequence');requireThat(entity.every(row=>row.actor===actor&&row.pointerType==='mouse'&&row.button===0&&Math.abs(row.globalX-x)<0.001&&Math.abs(row.globalY-y)<0.001),'Native exact root-derived target/payload');}
   else requireThat(entity.length===0&&currentEpoch(after).presentations.length===oldFrame,'Removed entity still targeted or presented');
   result.observations.push({group:group+'-native',events});
 }
 async function domPresentation(selector,action,group,state){const old=(await inspect()).epochs.at(-1).presentations.length;await bounded(action(),'native DOM '+selector);await wait(old=>{const e=globalThis.egretResourceScene.inspect().epochs.at(-1);return e.presentations.length>old&&e.presentations.at(-1).outcome==='fulfilled'&&e.pendingPresentations===0;},old,'DOM presentation '+selector);return retain(group,state);}
 async function setAhem(text){await evaluate(async text=>{const api=globalThis.egretResourceScene,family=api.inspect().epochs.at(-1).fonts.find(row=>row.key==='ahem').family;api.scene.ahemField.setRequest({text,fontFamily:family,fontSize:8,lineHeight:8,fontWeight:400,fontStyle:'normal',locale:'en',direction:'ltr',density:1,fillColor:0xffffff});await api.scene.ahemField.prepare();},text,'genuine public Ahem prepare');}
 function expectRequest(row,code){equal(row.outcome,code?'rejected':'fulfilled','Original request outcome');if(code)equal(row.error?.code,code,'Original request code');}
 function expectReadFailure(row,undefinedCause){const chain=row.error;equal([chain?.code,chain?.cause?.code,chain?.cause?.cause?.code],['BITMAP_RESOURCE_REPLACE_FAILED','ASSET_LOAD_FAILED','WEB_PNG_READ_FAILED'],'Exact original read-failure wrapper chain');requireThat(chain.cause.cause.cause?.wasUndefined===undefinedCause,'Exact original failure occurrence/cause');}
 async function sourceIdle(){await call('sourceIdle');await wait(()=>{const v=globalThis.egretResourceScene.inspect(),e=v.epochs.at(-1);return e.loads.every(r=>r.outcome!=='pending')&&e.reads.every(r=>r.outcome!=='pending');},null,'all original source tickets');}
 async function identityFacts(label){const facts=await evaluate(()=>{const api=globalThis.egretResourceScene,p=globalThis.__resourceSceneNativeProbe,l=api.scene.actors['pilot-left'],r=api.scene.actors['pilot-right'];return {sameLeft:l?.root===p.left,sameRight:r?.root===p.right,sameRightLease:r?.lease===p.rightLease,sameRightTexture:r?.lease.value===p.rightTexture,sameRightPlayback:r?.playback===p.rightPlayback,sameBody:l?.body===p.leftBody};});result.observations.push({group:label,identity:facts});requireThat(facts.sameRight&&facts.sameRightLease&&facts.sameRightTexture&&facts.sameRightPlayback,'Independent right survivor identity changed '+label);return facts;}
 try{
  await bounded(page.goto(origin+'/examples/resource-scene/index.html?profile='+profile,{waitUntil:'load'}),'page startup');
  await wait(()=>!!globalThis.egretResourceScene,null,'published genuine example facade');
  await evaluate(async()=>{await globalThis.egretResourceScene.ready;await globalThis.egretResourceScene.interactiveReady;},null,'resource + first original presentation readiness');
  const environment=await evaluate(()=>({platform:navigator.platform,language:navigator.language,devicePixelRatio,fontsStatus:document.fonts.status}));result.browserEnvironment=environment;
  requireThat(environment.platform==='Win32'&&environment.language==='zh-CN'&&environment.devicePixelRatio===1,'Fixed-font browser environment differs');
  const initial=await retain('c00-startup',BASE),first=currentEpoch(initial);
  requireThat(initial.state==='ready'&&first.resourceReady&&first.frameReady&&first.interactive&&initial.hasSavedBaseline,'Healthy original startup barriers');
  requireThat(first.fonts.length===2&&first.fonts.every(r=>r.loaded&&r.member&&r.exactSelectedFace&&!r.removed),'Original owned FontFace readiness');
  equal(first.loads.map(r=>r.name).sort(),['atlas-v1.png','badge','outfit-A.png'],'Independent startup original load set');
  const authentic=await evaluate(()=>{const api=globalThis.egretResourceScene,l=api.scene.actors['pilot-left'],r=api.scene.actors['pilot-right'];globalThis.__resourceSceneNativeProbe={left:l.root,right:r.root,leftBody:l.body,rightLease:r.lease,rightTexture:r.lease.value,rightPlayback:r.playback,tasks:[],warm:null};return {differentLeases:l.lease!==r.lease,sharedTexture:l.lease.value===r.lease.value,differentLeaseIds:l.lease.leaseId!==r.lease.leaseId,differentRoots:l.root!==r.root,scopeLive:api.scene.inputScope.state==='open'};});
  requireThat(Object.values(authentic).every(Boolean),'Genuine independent lease/root baseline');result.observations.push({group:'genuine-baseline',facts:authentic});

  if(kind!=='ordinary'){
   let wrong;
   if(kind==='wrong-outfit'){
    wrong=await evaluate(async left=>{const api=globalThis.egretResourceScene,p=globalThis.__resourceSceneNativeProbe;const lease=await api.warmOutfit('B');p.warm=lease;api.scene.actors[left].outfit.textureLease=lease;return {live:!lease.value.isDisposed,owned:api.inspect().epochs.at(-1).warmLeases};},LEFT,'genuine wrong outfit');
    requireThat(wrong.live&&wrong.owned===1,'Wrong-outfit control did not use genuine live external lease');
   }else if(kind==='wrong-time')await call('advanceTo',0.125);
   else requireThat(kind==='wrong-depth'&&profile==='webgpu-scene-textured','Unassigned negative context');
   await call('checkpoint','assigned-'+kind,kind==='wrong-depth'?'wrong-depth':'normal');
   await retain('assigned-'+kind,BASE,kind);
   await evaluate(()=>{const api=globalThis.egretResourceScene,p=globalThis.__resourceSceneNativeProbe;if(p.warm){api.releaseWarm(p.warm);p.warm=null;}},null,'control external lease release');
   await call('close');const end=await inspect();assertRetired(end.epochs[0],profile,kind==='wrong-outfit'?4:3,kind==='wrong-outfit'?4:3);
   equal(end.state,'closed','Negative application closed');result.final=end;result.completed=true;
  }else{
   let facts=await identityFacts('before-outfit');requireThat(facts.sameLeft&&facts.sameBody,'Initial genuine left identity');
   await nativeClick(136,72,RIGHT,{...BASE,selected:'right'},'c01-native-right');
   await setAhem('XX');await frame('c01-right-text',{...BASE,selected:'right',ahem:'XX'});
   await nativeClick(56,72,LEFT,{...BASE,ahem:'XX'},'c02-native-left');
   await setAhem('X X');await call('advanceTo',0.125-2**-20);await frame('c02-before-boundary',BASE);
   await call('advanceTo',0.125);await frame('c03-boundary',{...BASE,leftPose:1,rightPose:1},profile==='webgpu-scene-textured'?'reverse-order':'normal');
   await domPresentation('#advance',()=>page.locator('#advance').click(),'c04-wrap',BASE);
   equal(currentEpoch(await inspect()).sourceSeconds,0.25,'Real DOM advance source time');
   let after=await readsMax();await call('holdNext');const b1Request=await begin('replaceOutfit','B'),b1=await held('outfit-B.png',after);
   after=await readsMax();await call('holdNext');const c1Request=await begin('replaceOutfit','C'),c1=await held('outfit-C.png',after);
   expectRequest(await waitRequest(b1Request),'BITMAP_RESOURCE_SUPERSEDED');
   const busy=await evaluate(()=>{try{globalThis.egretResourceScene.restart();return {occurred:false};}catch(cause){return {occurred:true,code:cause?.code};}},null,'busy rebuild refuses');equal(busy,{occurred:true,code:'RESOURCE_SCENE_BUSY'},'Busy restart admission');
   facts=await identityFacts('pending-c1');requireThat(facts.sameLeft&&facts.sameBody,'Pending outfit replaced original root/body');
   const pendingState=currentEpoch(await inspect()).actors[LEFT];equal(pendingState.slotState,'pending','Held C genuine slot pending');
   await frame('c05-pending-c1',BASE);
   await call('cancelOutfit',LEFT);const cancel=await waitRequest(c1Request);expectRequest(cancel,'BITMAP_RESOURCE_CANCELLED');
   equal(cancel.error?.cause?.message,'explicit application cancellation','Exact cancellation reason');
   const cancelledSource=currentEpoch(await inspect()).reads.find(row=>row.id===c1.id);requireThat(cancelledSource.abortedNow&&cancelledSource.phase==='held'&&cancelledSource.outcome==='pending','Logical cancellation did not preserve distinct held original source');
   await call('pause',LEFT);await call('advanceTo',0.375);await call('releaseSource',c1.id);await waitOriginal(c1.id);
   const paused={...BASE,leftPose:0,rightPose:1};await frame('c05-pending-cancel',paused);
   // First Error failure is a real DOM request. Its rejected original remains in Main's request ledger.
   after=await readsMax();await call('holdNext');let beforeView=await inspect(),requestCount=currentEpoch(beforeView).requests.length,frameCount=currentEpoch(beforeView).presentations.length;
   await bounded(page.locator('#outfit').selectOption('B'),'native outfit option');await bounded(page.locator('#replace-outfit').click(),'native outfit change');
   await wait(requestCount=>globalThis.egretResourceScene.inspect().epochs.at(-1).requests.length===requestCount+1,requestCount,'DOM original outfit request');
   let b2View=await inspect(),b2Request=currentEpoch(b2View).requests.at(-1).id,b2=await held('outfit-B.png',after);
   await call('failSource',b2.id,'error');const failedError=await waitRequest(b2Request);expectRequest(failedError,'BITMAP_RESOURCE_REPLACE_FAILED');expectReadFailure(failedError,false);
   equal(failedError.error.cause.cause.cause.message,'Authored image delivery failure '+b2.id,'Original authored Error identity/message');
   await wait(frameCount=>{const e=globalThis.egretResourceScene.inspect().epochs.at(-1);return e.presentations.length===frameCount+1&&e.presentations.at(-1).outcome==='fulfilled'&&e.pendingPresentations===0;},frameCount,'DOM retained failure presentation');
   await retain('c06-error',paused);
   after=await readsMax();await call('holdNext');const b3Request=await begin('replaceOutfit','B'),b3=await held('outfit-B.png',after);
   await call('failSource',b3.id,'undefined');const failedUndefined=await waitRequest(b3Request);expectRequest(failedUndefined,'BITMAP_RESOURCE_REPLACE_FAILED');expectReadFailure(failedUndefined,true);await frame('c07-undefined',paused);
   await bounded(page.locator('#outfit').selectOption('D'),'native retry option');
   requestCount=currentEpoch(await inspect()).requests.length;
   await domPresentation('#replace-outfit',()=>page.locator('#replace-outfit').click(),'c08-retry-d',{...paused,leftOutfit:'D'});
   const dRequest=currentEpoch(await inspect()).requests.at(-1);requireThat(currentEpoch(await inspect()).requests.length===requestCount+1,'DOM retry original request count');expectRequest(dRequest,null);result.requests.push(dRequest);
   requireThat(currentEpoch(await inspect()).reads.find(row=>row.id===b1.id).phase==='held','D success did not precede original held B1 delivery');
   const dState={...paused,leftOutfit:'D'};await nativeClick(56,72,LEFT,dState,'c08-native-after-d');facts=await identityFacts('after-outfit');requireThat(facts.sameLeft&&facts.sameBody,'Outfit success changed root/body');
   await call('releaseSource',b1.id);await waitOriginal(b1.id);await frame('c09-late-b',dState);
   // Original manager Promise and actual external lease are retained only in this collector's page-local test variable.
   const aWarm=await evaluate(async()=>{const api=globalThis.egretResourceScene,p=globalThis.__resourceSceneNativeProbe,first=api.warmOutfit('A');let pendingCode;try{api.warmOutfit('A');}catch(cause){pendingCode=cause?.code;}const lease=await first;let ownedCode;try{api.warmOutfit('A');}catch(cause){ownedCode=cause?.code;}const live=!lease.value.isDisposed;api.releaseWarm(lease);return {pendingCode,ownedCode,live};},null,'bounded cached A warm owner');
   equal(aWarm,{pendingCode:'RESOURCE_SCENE_WARM_LIMIT',ownedCode:'RESOURCE_SCENE_WARM_LIMIT',live:true},'Pending and owned warm limit');
   const warm=await evaluate(async()=>{const api=globalThis.egretResourceScene,p=globalThis.__resourceSceneNativeProbe;p.warm=await api.warmOutfit('B');p.warmTexture=p.warm.value;return {leaseId:p.warm.leaseId,live:!p.warmTexture.isDisposed};},null,'genuine warm B delivery');requireThat(warm.live,'Warm B was not delivered live');
   after=await readsMax();const race=await evaluate(left=>{const api=globalThis.egretResourceScene,p=globalThis.__resourceSceneNativeProbe,first=api.replaceOutfit(left,'B');p.tasks.push(first);void first.catch(()=>undefined);const b=api.inspect().epochs.at(-1).requests.at(-1).id;api.holdNext();const second=api.replaceOutfit(left,'C');p.tasks.push(second);void second.catch(()=>undefined);const c=api.inspect().epochs.at(-1).requests.at(-1).id;api.cancelOutfit(left);return {b,c};},LEFT,'single synchronous warm/stale/cancel turn');
   const c2=await held('outfit-C.png',after);expectRequest(await waitRequest(race.b),'BITMAP_RESOURCE_SUPERSEDED');expectRequest(await waitRequest(race.c),'BITMAP_RESOURCE_CANCELLED');
   const warmSurvivor=await evaluate(()=>{const p=globalThis.__resourceSceneNativeProbe;return {sameValue:p.warm.value===p.warmTexture,live:!p.warmTexture.isDisposed};});requireThat(warmSurvivor.sameValue&&warmSurvivor.live,'External warm lease died with stale delivered slot lease');
   await call('releaseSource',c2.id);await waitOriginal(c2.id);
   const warmEnd=await evaluate(()=>{const api=globalThis.egretResourceScene,p=globalThis.__resourceSceneNativeProbe;api.releaseWarm(p.warm);p.warm=null;return {disposed:p.warmTexture.isDisposed};});requireThat(warmEnd.disposed,'Final external warm B release did not retire Texture');
   const cDecoded=await evaluate(async()=>{const api=globalThis.egretResourceScene,lease=await api.warmOutfit('C'),texture=lease.value,live=!texture.isDisposed;api.releaseWarm(lease);return {live,disposed:texture.isDisposed};},null,'successful real C PNG decode');requireThat(cDecoded.live&&cDecoded.disposed,'C real decode/dispose absent');
   await frame('c10-warm-race',dState);
   await call('resume',LEFT);after=await readsMax();await call('holdNext');
   const atlasFailRequest=await begin('replaceAtlas','v2'),atlasFail=await held('atlas-v2.png',after);
   await call('failSource',atlasFail.id,'error');const atlasError=await waitRequest(atlasFailRequest);expectRequest(atlasError,'ASSET_LOAD_FAILED');equal([atlasError.error?.cause?.code,atlasError.error?.cause?.cause?.message],['WEB_PNG_READ_FAILED','Authored image delivery failure '+atlasFail.id],'Atlas original manager/PNG/Error chain');
   facts=await identityFacts('atlas-pre-stop-failure');requireThat(facts.sameLeft&&facts.sameBody,'Failed atlas replaced live body');
   await call('advanceTo',0.5);const atlasOld={...BASE,leftOutfit:'D',leftPose:1,rightPose:0};await frame('c11-atlas-failure',atlasOld);
   const atlasBefore=await evaluate(left=>{const a=globalThis.egretResourceScene.scene.actors[left],p=globalThis.__resourceSceneNativeProbe;p.oldPlayback=a.playback;p.oldAtlasLease=a.lease;return {elapsed:a.playback.elapsedSeconds,crop:a.body.sourceRect};},LEFT);requireThat(atlasBefore.elapsed>0,'Old animation stopped after pre-stop atlas failure');
   await bounded(page.locator('#atlas').selectOption('v2'),'native atlas option');
   await domPresentation('#replace-atlas',()=>page.locator('#replace-atlas').click(),'c12-atlas-success',{...BASE,leftOutfit:'D',leftAtlas:'v2'});
   const atlasNew=await evaluate(left=>{const p=globalThis.__resourceSceneNativeProbe,a=globalThis.egretResourceScene.scene.actors[left];return {sameRoot:a.root===p.left,sameBody:a.body===p.leftBody,newPlayback:a.playback!==p.oldPlayback,oldStopped:p.oldPlayback.state==='stopped',newLease:a.lease!==p.oldAtlasLease,elapsed:a.playback.elapsedSeconds};},LEFT);requireThat(atlasNew.sameRoot&&atlasNew.sameBody&&atlasNew.newPlayback&&atlasNew.oldStopped&&atlasNew.newLease&&atlasNew.elapsed===0,'Atlas replacement ownership/phase');
   await identityFacts('atlas-committed-right-survivor');const v2={...BASE,leftOutfit:'D',leftAtlas:'v2'};
   await domPresentation('#clip',()=>page.locator('#clip').check(),'c13-clip',{...v2,view:'clip'});
   await domPresentation('#clip',()=>page.locator('#clip').uncheck(),'c14-unclip',v2);
   await domPresentation('#rotation',()=>page.locator('#rotation').check(),'c14-rotation',{...v2,view:'rotation'});
   await nativeClick(80,96,LEFT,{...v2,view:'rotation'},'c14-native-rotated');
   await call('setView',LEFT,{clip:false,rotation:0});after=await readsMax();await call('holdNext');const removedRequest=await begin('replaceOutfit','B'),b5=await held('outfit-B.png',after);
   await domPresentation('#remove',()=>page.locator('#remove').click(),'c15-remove',{...v2,view:'absent'});expectRequest(await waitRequest(removedRequest),'BITMAP_RESOURCE_DISPOSED');
   await nativeClick(56,72,null,{...v2,view:'absent'},'c15-absent-click');
   const removed=await evaluate(()=>({oldRootDisposed:globalThis.__resourceSceneNativeProbe.left.isDisposed,currentAbsent:globalThis.egretResourceScene.scene.actors['pilot-left']===undefined}));requireThat(removed.oldRootDisposed&&removed.currentAbsent,'Remove retained live actor');
   await call('releaseSource',b5.id);await waitOriginal(b5.id);await identityFacts('removed-right-survivor');
   await domPresentation('#reenter',()=>page.locator('#reenter').click(),'c16-reenter',v2);
   const reentered=await evaluate(left=>{const api=globalThis.egretResourceScene,p=globalThis.__resourceSceneNativeProbe,a=api.scene.actors[left],old=p.left;p.left=a.root;p.leftBody=a.body;return {newRoot:a.root!==old,oldDisposed:old.isDisposed,elapsed:a.playback.elapsedSeconds,slotState:a.slot.state};},LEFT);requireThat(reentered.newRoot&&reentered.oldDisposed&&reentered.elapsed===0,'Reentry generation/phase');
   await nativeClick(56,72,LEFT,v2,'c16-native-reentered');await identityFacts('reentered-right-survivor');await call('pause',LEFT);await sourceIdle();
   const model=await call('snapshot'),expectedModel={version:1,selectedId:LEFT,actors:{[LEFT]:{present:true,committedOutfit:'D',atlasKey:'v2',paused:true},[RIGHT]:{present:true,committedOutfit:'A',atlasKey:'v1',paused:false}}};equal(model,expectedModel,'Closed business snapshot');result.businessSnapshot=model;
   const ticks=currentEpoch(await inspect()).ticks;equal(ticks.map(row=>row.elapsedSeconds),[0.125-2**-20,0.125,0.25,0.375,0.5],'Original real clock ticks');
   // Replay is quiescent retirement, not terminal close. Terminal close belongs to the rebuilt epoch below.
   await call('replay');const replayView=await retain('c17-raw-replay',BASE);requireThat(replayView.state==='suspended'&&replayView.currentEpoch===null,'Raw replay suspended state');assertRetired(replayView.epochs[0],profile,16,9);
   requireThat(replayView.replays.length===1&&replayView.replays[0].safeSurface&&replayView.replays[0].cleanup.length===0,'Raw replay Host cleanup');if(profile==='webgpu-scene-textured')assertHost(replayView.replays[0].hostStatus,true);
   const closedAt=replayView.trace.findIndex(row=>row.kind==='epoch-closed'&&row.epoch===1),replayAt=replayView.trace.findIndex(row=>row.kind==='frame-submitted'&&row.epoch===null);requireThat(closedAt>=0&&replayAt>closedAt,'Raw replay started before all original owner retirement');
   await call('restart');await evaluate(()=>globalThis.egretResourceScene.interactiveReady,null,'reconstructed original readiness');const rebuiltView=await retain('c18-reconstruct',v2);requireThat(rebuiltView.currentEpoch===2&&rebuiltView.epochs.length===2,'Distinct reconstructed Engine epoch');
   equal(await call('snapshot'),expectedModel,'Reconstruction committed business state');
   const rebuilt=await evaluate(()=>{const api=globalThis.egretResourceScene,p=globalThis.__resourceSceneNativeProbe,l=api.scene.actors['pilot-left'],r=api.scene.actors['pilot-right'];return {leftNew:l.root!==p.left,rightNew:r.root!==p.right,leftPhase:l.playback.elapsedSeconds,rightPhase:r.playback.elapsedSeconds,leftState:l.playback.state,rightState:r.playback.state,scopeOpen:api.scene.inputScope.state==='open'};});
   equal(rebuilt,{leftNew:true,rightNew:true,leftPhase:0,rightPhase:0,leftState:'paused',rightState:'running',scopeOpen:true},'New epoch public owners/phase/paused policy');
   await nativeClick(56,72,LEFT,v2,'c18-native-rebuilt');
   after=await readsMax();await call('holdNext');const closingRequest=await begin('replaceOutfit','B'),b6=await held('outfit-B.png',after);
   const closeStart=await evaluate(left=>{const api=globalThis.egretResourceScene,p=globalThis.__resourceSceneNativeProbe,actor=api.scene.actors[left],original=api.close();p.close=original;void original.catch(()=>undefined);return {samePromise:api.close()===original,state:api.inspect().state,slotState:actor.slot.state};},LEFT,'terminal close publication');
   equal(closeStart,{samePromise:true,state:'closing',slotState:'disposed'},'Stable close and synchronous authority revocation');
   expectRequest(await waitRequest(closingRequest),'BITMAP_RESOURCE_DISPOSED');await evaluate(()=>globalThis.__resourceSceneNativeProbe.close,null,'all original terminal-close barriers');
   const end=await inspect();equal(end.state,'closed','Terminal application state');assertRetired(end.epochs[0],profile,16,9);assertRetired(end.epochs[1],profile,6,5);
   const original=end.epochs[0],second=end.epochs[1];equal([original.loads.filter(r=>r.outcome==='fulfilled').length,original.loads.filter(r=>r.outcome==='rejected'&&!r.textureIssued&&r.error?.code==='WEB_PNG_CANCELLED').length,original.reads.filter(r=>r.outcome==='rejected').length],[9,4,3],'Original schedule source categories');
   requireThat(second.reads.find(r=>r.id===b6.id)?.gateSettled&&second.loads.at(-1).textureIssued===false,'Held final close source/Texture boundary');
   equal(end.epochs.flatMap(e=>e.requests).map(r=>[r.kind,r.key,r.outcome,r.error?.code??null]),[['outfit','B','rejected','BITMAP_RESOURCE_SUPERSEDED'],['outfit','C','rejected','BITMAP_RESOURCE_CANCELLED'],['outfit','B','rejected','BITMAP_RESOURCE_REPLACE_FAILED'],['outfit','B','rejected','BITMAP_RESOURCE_REPLACE_FAILED'],['outfit','D','fulfilled',null],['outfit','B','rejected','BITMAP_RESOURCE_SUPERSEDED'],['outfit','C','rejected','BITMAP_RESOURCE_CANCELLED'],['atlas','v2','rejected','ASSET_LOAD_FAILED'],['atlas','v2','fulfilled',null],['outfit','B','rejected','BITMAP_RESOURCE_DISPOSED'],['reenter',null,'fulfilled',null],['outfit','B','rejected','BITMAP_RESOURCE_DISPOSED']],'Full selected original logical request sequence');
   equal([original.events.filter(r=>r.actor!==null).length,second.events.filter(r=>r.actor!==null).length],[15,3],'Native entity event counts derive from selected clicks');
   result.final=end;result.completed=true;
  }
  const final=result.final,all=final.epochs.flatMap(e=>e.presentations).concat(final.replays.flatMap(e=>e.presentations));
  equal(all.map(r=>r.id).sort((a,b)=>a-b),[...seen].sort((a,b)=>a-b),'Every original native presentation saved exactly once');
  requireThat(!final.traceExhausted&&final.faults.length===0&&result.pageErrors.length===0&&unexpectedConsole(result).length===0,'Unexpected native/app/console error or unclassified warning, or trace admission exhausted');
  if(profile==='canvas-2d')requireThat(!result.requestedRoutes.some(route=>/gpu-scene\.mjs|WebGPU|webgpu|\/scene3d\.js|\/b1\.js|robust-predicates/.test(route)),'Ordinary Canvas evaluated GPU/foundational route');
 }finally{
  try{const cleanup=await evaluate(()=>globalThis.egretResourceScene?.close(),null,'final application original close');result.finalCleanup=cleanup;}catch(cause){result.cleanupFailure=String(cause);report.retirementFailures.push({owner:profile+'/'+kind+'/application',message:String(cause)});}
  await retire(owner);
 }
}

try{
 requireThat(os.platform()==='win32'&&os.arch()==='x64'&&os.release()==='10.0.26300','Approved fixed-font OS profile differs; acceptance stays open');
 const server=await acquire('loopback original-byte server',()=>new Promise((resolve,reject)=>{
   const instance=createServer((request,response)=>{
     let selected=request.url;
     // Only these two original HTML query strings may select a profile. No request path is decoded/joined/read as a filesystem authority.
     if(['/examples/resource-scene/index.html?profile=canvas-2d','/examples/resource-scene/index.html?profile=webgpu-scene-textured'].includes(selected))selected='/examples/resource-scene/index.html';
     const route=request.method==='GET'&&typeof selected==='string'&&selected.length<=2048?collected.routes.get(selected):undefined;
     if(!route){response.writeHead(404,{'content-type':'text/plain'});response.end('Unselected route');return;}
     response.writeHead(200,{'content-type':route.contentType,'cache-control':'no-store'});response.end(route.bytes);
   });instance.once('error',reject);instance.listen(0,'127.0.0.1',()=>resolve(instance));
 }),instance=>new Promise((resolve,reject)=>{instance.close(cause=>cause?reject(cause):resolve());instance.closeAllConnections();}));
 origin='http://127.0.0.1:'+server.address().port;
 const browser=await acquire('default Edge',()=>playwright.chromium.launch({channel:'msedge',headless:true}),value=>value.close());
 report.environment.browserVersion=browser.version();requireThat(browser.version()==='155.0.4283.45','Approved fixed-font Edge version differs; acceptance stays open');
 const schedule=[['canvas-2d','ordinary'],['webgpu-scene-textured','ordinary'],['canvas-2d','wrong-outfit'],['webgpu-scene-textured','wrong-outfit'],['canvas-2d','wrong-time'],['webgpu-scene-textured','wrong-time'],['webgpu-scene-textured','wrong-depth']];
 for(const [profile,kind]of schedule){try{await run(browser,profile,kind);}catch(cause){report.failures.push({profile,kind,message:String(cause),stack:cause?.stack??null});}}
}catch(cause){report.failures.push({message:String(cause),stack:cause?.stack??null});}
finally{
 for(const owner of [...owners].reverse())await retire(owner);
 // Reauthenticate each admitted raw input after all native work. A changed file is a failed run, never silently rehashed into acceptance.
 for(const before of currentSnapshot.source.inventory){try{const owner=currentSnapshot.source.owners[before.owner],after=identity.fingerprintFile(owner,before.path);equal({bytes:after.bytes,sha256:after.sha256},{bytes:before.bytes,sha256:before.sha256},'Input drift '+before.owner+':'+before.path);}catch(cause){report.failures.push({message:String(cause)});}}
 for(const [owner,relative,before]of [[executingOwner,'tools/verify-resource-scene.mjs',executingSelf.pin],[applicationRoot,'tools/verify-resource-scene.mjs',projectedSelf.pin],[applicationRoot,'tools/resource-scene-boundary.mjs',boundary.pin],[applicationRoot,'tools/resource-scene/oracle.mjs',oracleInput.pin],[applicationRoot,'examples/resource-scene/main.mjs',mainInput.pin],[applicationRoot,'tools/resource-scene/reference/manifest.json',manifestInput.pin]]){
  try{const after=identity.fingerprintFile(owner,relative);equal({bytes:after.bytes,sha256:after.sha256},{bytes:before.bytes,sha256:before.sha256},'Native closure drift '+relative);}catch(cause){report.failures.push({message:String(cause)});}
 }
 report.pendingOperations=pending.size;report.resourcesRetired=owners.every(owner=>owner.retired);
 report.ordinaryContexts=report.runs.filter(row=>row.ordinaryCredit).length;report.negativeContexts=report.runs.filter(row=>!row.ordinaryCredit).length;
 report.rawFrameCount=report.runs.reduce((sum,row)=>sum+row.rawFrames.length,0);
 report.ordinaryRawFrameCount=report.runs.filter(row=>row.ordinaryCredit).reduce((sum,row)=>sum+row.rawFrames.length,0);
 report.negativeRawFrameCount=report.runs.filter(row=>!row.ordinaryCredit).reduce((sum,row)=>sum+row.rawFrames.length,0);
 report.physicalDisplayOrDeviceClaim=false;report.performanceClaim=false;report.remoteCIPassClaim=false;
 for(const run of report.runs){run.unexpectedConsole=unexpectedConsole(run);run.retainedReadbackAdvisories=run.console.filter(row=>isReadbackAdvisory(run,row));}
 report.accepted=report.failures.length===0&&report.retirementFailures.length===0&&report.pendingOperations===0&&report.resourcesRetired&&report.runs.length===7&&report.ordinaryContexts===2&&report.negativeContexts===5&&report.runs.every(row=>row.completed&&row.unexpectedConsole.length===0);
 report.status=report.accepted?'PASS_FINITE_RECORDED_DESKTOP_RESOURCE_SCENE':'FAIL_OR_INCOMPLETE_FINITE_RESOURCE_SCENE';
 fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
 const raw=fs.readFileSync(path.join(output,'report.json'));console.log(JSON.stringify({status:report.status,accepted:report.accepted,output,report:{bytes:raw.length,sha256:hash(raw)},ordinaryContexts:report.ordinaryContexts,negativeContexts:report.negativeContexts,rawFrames:report.rawFrameCount,pending:report.pendingOperations}));
 if(!report.accepted)process.exitCode=1;
}
