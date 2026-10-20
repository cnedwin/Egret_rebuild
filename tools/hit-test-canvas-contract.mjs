// Independently authored first-party finite collection admission. Apache-2.0.
import { createHash } from 'node:crypto';

const same = (a,b) => JSON.stringify(a) === JSON.stringify(b);
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const rgba = color => [color >>> 16 & 255,color >>> 8 & 255,color & 255,255];
const routeFor = label => label === null ? [] : [
  {currentTarget:'stage',target:label,phase:'capturing'},
  {currentTarget:label,target:label,phase:'atTarget'},
  {currentTarget:'root',target:label,phase:'bubbling'},
  {currentTarget:'stage',target:label,phase:'bubbling'},
];

/** Preserve console diagnostics as bounded evidence; warnings/errors are fatal by default. */
const canvasReadbackAdvisory='Canvas2D: Multiple readback operations using getImageData are faster with the willReadFrequently attribute set to true. See: https://html.spec.whatwg.org/multipage/canvas.html#concept-canvas-will-read-frequently';
export function classifyConsole(type,message){
  if(type!=='warning'&&type!=='error')return undefined;
  if(type==='warning'&&message===canvasReadbackAdvisory)return{bucket:'advisories',record:{kind:'CANVAS2D_READBACK_ADVISORY',message}};
  return{bucket:'errors',record:{kind:'CONSOLE_'+type,message}};
}

/** Adapt only the existing application's import map to the sealed loopback routes. */
export function projectImportMap(html,imports){
  const maps=[...html.matchAll(/<script type="importmap">([^<]*)<\/script>/g)];
  if(maps.length!==1)throw new Error('HTML import-map anchor is not unique');
  const original=JSON.parse(maps[0][1]);
  const expected={'@egret/engine':'/packages/engine/dist/index.js','@egret/engine/web':'/packages/engine/dist/web/index.js','@egret/runtime':'/packages/runtime/dist/index.js','@egret/contracts':'/packages/contracts/dist/index.js','@egret/contracts/resources':'/packages/contracts/dist/resources/index.js','#egret-textured-frame-state':'/packages/engine/dist/internal/texturedFrameState.js'};
  if(original===null||typeof original!=='object'||!same(Object.keys(original),['imports'])||original.imports===null||typeof original.imports!=='object'||!same(Object.keys(original.imports).sort(),Object.keys(expected).sort())||Object.entries(expected).some(([key,value])=>original.imports[key]!==value))throw new Error('Original public import-map aliases do not match the selected six entry paths');
  return{html:html.replace(maps[0][0],'<script type="importmap">'+JSON.stringify({imports})+'</script>'),adaptation:{original,served:{imports}}};
}

/** Transform one uniquely anchored application fragment; SDK bytes are untouched. */
export function projectApplication(sources,id){
  if(id==='baseline')return{...sources};
  const projections={
    'omit-query':['scene','const selected = stage.hitTest(payload.globalX, payload.globalY, { maxNodes: 9 });','const selected = undefined;'],
    'omit-css':['application','const globalX = (event.clientX - bounds.left) * 320 / bounds.width;\n    const globalY = (event.clientY - bounds.top) * 200 / bounds.height;','const globalX = (event.clientX - bounds.left);\n    const globalY = (event.clientY - bounds.top);'],
    'omit-dispatch':['scene','selected.dispatchEvent(new Event(pickedType, lastPayload));','void pickedType;'],
    'capture-only':['scene','// Application-only post-dispatch projection anchor; initial rendering is separate.\n    rememberFrame(engine.renderFrame(FRAME));','// Application-only post-dispatch projection anchor; initial rendering is separate.\n    rememberFrame(engine.captureFrame(FRAME));'],
    'omit-retirement':['application','attempt(() => pair.target.removeEventListener(pair.type, pair.callback, pair.capture));','attempt(() => {});'],
  };
  const projection=projections[id];if(projection===undefined)throw new Error('Unknown application projection: '+id);
  const [module,anchor,replacement]=projection,text=sources[module];
  if(typeof text!=='string')throw new Error('Application projection module missing: '+module);
  const occurrences=text.split(anchor).length-1;
  if(occurrences!==1)throw new Error(`Application projection anchor ${module}/${id}: ${occurrences} occurrences`);
  return{...sources,[module]:text.replace(anchor,replacement)};
}
function check(issues,row,code,actual,expected){if(!same(actual,expected))issues.push({row,code,actual,expected});}
function ready(row,recipe,issues){
  const s=row?.snapshot;
  if(!s){issues.push({row:'B01',code:'READY_RECORD_MISSING'});return;}
  for(const [field,value] of Object.entries({phase:'ready',status:'ready',pointerCount:0,dispatchCount:0,renderCount:1,feedbackColor:0x404040,liveNodes:9,disposedNodes:0,enabledActors:5,typedListenerCount:8,unsubscribeAttempts:0,scopeState:'open',upperVisible:true,gateVisible:true,touchChildren:true,failureCount:0,diagnosticCount:0,domRegistrationCount:6,domRemovalAttempts:0}))check(issues,'B01','READY_'+field,s[field],value);
  check(issues,'B01','READY_GEOMETRY',row.geometry,recipe.dimensions);
  check(issues,'B01','READY_PIXELS',row.samples,recipe.initialSamples);
  check(issues,'B01','REFERENCE_PIXELS',row.reference,recipe.initialSamples);
  check(issues,'B01','NATIVE_PAIRS_REGISTERED',row.ledger,{registrations:6,removals:0,outstanding:6,overflow:false});
  check(issues,'B01','FRAME_PROGRESS',s.lastFrameId,1);
}
function step(observed,expected,row,issues){
  const s=observed?.after,b=observed?.before;
  if(!s||!b){issues.push({row,code:'STEP_MISSING'});return;}
  check(issues,row,'SELECTED_TARGET',s.selectedLabel??null,expected.label);
  check(issues,row,'LOGICAL_PAYLOAD',s.lastPayload,{globalX:expected.point[0],globalY:expected.point[1],button:0,pointerType:'mouse'});
  check(issues,row,'TYPED_ROUTE',s.route,routeFor(expected.label));
  check(issues,row,'STATUS',s.status,expected.label===null?'miss':'hit');
  for(const [field,value] of Object.entries({pointerCount:expected.p,dispatchCount:expected.d,renderCount:expected.r,feedbackColor:expected.feedback,failureCount:0,diagnosticCount:0,phase:'ready'}))check(issues,row,'AFTER_'+field,s[field],value);
  check(issues,row,'POINTER_DELTA',s.pointerCount-b.pointerCount,1);
  check(issues,row,'DISPATCH_DELTA',s.dispatchCount-b.dispatchCount,expected.label===null?0:1);
  check(issues,row,'RENDER_DELTA',s.renderCount-b.renderCount,expected.label===null?0:1);
  check(issues,row,'NATIVE_INPUT_METHOD',observed.input?.method,'page.mouse.click');
  check(issues,row,'NATIVE_INPUT_LOGICAL_POINT',observed.input?.logical,expected.point);
  const box=observed.input?.box,p=observed.input?.page;
  if(!box||![box.x,box.y,box.width,box.height,...(p??[])].every(Number.isFinite)||box.width!==640||box.height!==400||p?.length!==2)issues.push({row,code:'NATIVE_INPUT_BOX'});
  else check(issues,row,'NATIVE_INPUT_PAGE_POINT',p,[box.x+expected.point[0]*2,box.y+expected.point[1]*2]);
  check(issues,row,'FEEDBACK_PIXEL',observed.feedback,rgba(expected.feedback));
  check(issues,row,'REFERENCE_FEEDBACK_PIXEL',observed.referenceFeedback,rgba(expected.feedback));
  check(issues,row,'SCENE_PIXEL',observed.scenePixel,expected.sceneRGBA);
  check(issues,row,'REFERENCE_SCENE_PIXEL',observed.referenceScenePixel,expected.sceneRGBA);
  for(const field of ['liveNodes','disposedNodes','enabledActors','typedListenerCount','unsubscribeAttempts','scopeState','upperVisible','gateVisible','touchChildren','domRegistrationCount','domRemovalAttempts'])check(issues,row,'AFTER_STABLE_'+field,s[field],b[field]);
  // This fresh Engine emits one monotonically numbered frame per remembered capture/render.
  if(!Number.isSafeInteger(s.lastFrameId)||!Number.isSafeInteger(b.lastFrameId)||s.lastFrameId!==s.renderCount||b.lastFrameId!==b.renderCount||s.lastFrameId-b.lastFrameId!==s.renderCount-b.renderCount)issues.push({row,code:'FRAME_PROGRESS'});
  if(expected.label===null)check(issues,row,'MISS_FRAME_ID',s.lastFrameId,b.lastFrameId);
}
function close(row,issues){
  const s=row?.after,b=row?.before;
  if(!s||!b){issues.push({row:'B10',code:'CLOSE_RECORD_MISSING'});return;}
  for(const [field,value] of Object.entries({phase:'closed',scopeState:'closed',liveNodes:0,disposedNodes:9,enabledActors:0,typedListenerCount:0,unsubscribeAttempts:8,domRegistrationCount:6,domRemovalAttempts:6,failureCount:0,diagnosticCount:0}))check(issues,'B10','CLOSE_'+field,s[field],value);
  check(issues,'B10','CLOSE_SETTLED',row.settled,true);
  check(issues,'B10','CLOSE_NATIVE_INPUT',row.input?.method,'page.mouse.click');
  check(issues,'B10','SURFACE_RETIRED',row.surface,{width:0,height:0,connected:false});
  check(issues,'B10','NATIVE_PAIRS_RETIRED',row.ledger,{registrations:6,removals:6,outstanding:0,overflow:false});
  for(const field of ['pointerCount','dispatchCount','renderCount','lastFrameId','status','selectedLabel','lastPayload','route','feedbackColor'])check(issues,'B10','CLOSE_STABLE_'+field,s[field],b[field]);
  check(issues,'B10','CLOSED_PROBE_STABLE',row.afterProbe,s);
}

/** A row result is a comparison, never a substitute for collection/retirement. */
export function inspectRows(rows,recipe,{partial=false}={}){
  const issues=[];
  if(!Array.isArray(rows)){return{issues:[{code:'ROWS_MISSING'}]};}
  const ids=rows.map(row=>row.id),want=partial?recipe.rows.slice(0,2).map(row=>row.id):recipe.rows.map(row=>row.id);
  if(!same(ids,want)){issues.push({code:'ROW_INVENTORY',actual:ids,expected:want});return{issues};}
  ready(rows[0],recipe,issues);
  let previous=rows[0]?.snapshot;
  for(const expected of recipe.rows.slice(1,-1)){
    const observed=rows.find(row=>row.id===expected.id);
    if(!observed)continue;
    if(!Array.isArray(observed.steps)||observed.steps.length!==expected.steps.length){issues.push({row:expected.id,code:'STEP_INVENTORY'});continue;}
    for(let index=0;index<expected.steps.length;index++){
      const prediction=expected.steps[index],actual=observed.steps[index];
      const before=previous&&{...previous};
      if(before&&prediction.toggle){const flag={upper:'upperVisible',gate:'gateVisible',children:'touchChildren'}[prediction.toggle];before[flag]=!before[flag];before.renderCount++;before.lastFrameId++;}
      check(issues,expected.id,'BEFORE_SNAPSHOT',actual?.before,before);
      step(actual,{...prediction,sceneRGBA:recipe.sceneSamples[expected.id][index]},expected.id,issues);
      previous=actual?.after;
    }
  }
  if(!partial){check(issues,'B10','BEFORE_SNAPSHOT',rows.at(-1)?.before,previous);close(rows.at(-1),issues);}
  return{issues};
}
/** Counterexamples need a passing initial frame and their exact assigned witness. */
export function inspectControl(context,recipe){
  const control=recipe.controls.find(row=>row.id===context?.id);
  if(!control)return{status:'INVALID_CONTROL',issues:[{code:'CONTROL_UNKNOWN'}]};
  const initial=[];ready(context.rows?.[0],recipe,initial);
  if(initial.length)return{status:'INVALID_CONTROL',issues:initial};
  const result=inspectRows(context.rows,recipe,{partial:control.row==='B02'});
  if(result.issues.some(issue=>['ROW_INVENTORY','STEP_INVENTORY','STEP_MISSING','CLOSE_RECORD_MISSING'].includes(issue.code)))return{status:'INVALID_CONTROL',issues:result.issues};
  const assigned=result.issues.find(issue=>issue.row===control.row&&issue.code===control.code);
  const missEffects=['SELECTED_TARGET','TYPED_ROUTE','STATUS','AFTER_dispatchCount','AFTER_renderCount','AFTER_feedbackColor','DISPATCH_DELTA','RENDER_DELTA','FEEDBACK_PIXEL'];
  const permitted={
    'omit-query':missEffects,
    'omit-css':[...missEffects,'LOGICAL_PAYLOAD'],
    'omit-dispatch':['TYPED_ROUTE'],
    'capture-only':['FEEDBACK_PIXEL'],
    'omit-retirement':['NATIVE_PAIRS_RETIRED'],
  }[control.id];
  if(result.issues.some(issue=>issue.row!==control.row||!permitted.includes(issue.code)))return{status:'INVALID_CONTROL',issues:result.issues};
  let exact=false;
  if(control.id==='omit-query')exact=context.rows[1]?.steps?.[0]?.after?.selectedLabel==null;
  if(control.id==='omit-css')exact=same(context.rows[1]?.steps?.[0]?.after?.lastPayload,{globalX:112,globalY:96,button:0,pointerType:'mouse'});
  if(control.id==='omit-dispatch')exact=same(context.rows[1]?.steps?.[0]?.after?.route,[]);
  if(control.id==='capture-only')exact=same(context.rows[1]?.steps?.[0]?.feedback,[64,64,64,255]);
  if(control.id==='omit-retirement')exact=same(context.rows.at(-1)?.ledger,{registrations:6,removals:0,outstanding:6,overflow:false});
  if(control.id==='omit-query'||control.id==='omit-css'){
    const s=context.rows[1]?.steps?.[0]?.after;
    exact=exact&&s?.status==='miss'&&same(s?.route,[])&&s?.dispatchCount===0&&s?.renderCount===1&&s?.lastFrameId===1&&s?.feedbackColor===0x404040&&same(context.rows[1].steps[0].feedback,[64,64,64,255]);
  }
  return{status:assigned&&exact?'PASS_ASSIGNED_CONTROL_SENSITIVITY':'INVALID_CONTROL',assigned:assigned??null,issues:result.issues};
}

/** Admit only exact contiguous tiny RGBA ranges bound to observed points and backing geometry. */
function inspectRaw(context,recipe,saved,issues){
  const groups=[{row:context.rows?.[0],points:recipe.initialSamples.map(s=>s.point),target:context.rows?.[0]?.samples?.flatMap(s=>s.rgba),reference:context.rows?.[0]?.reference?.flatMap(s=>s.rgba)}];
  for(const row of context.rows?.slice(1)??[]){
    const prediction=recipe.rows.find(candidate=>candidate.id===row.id);
    for(const [index,step] of (row.steps??[]).entries())groups.push({row:step,points:[prediction?.steps?.[index]?.point,[284,28]],target:[...(step.scenePixel??[]),...(step.feedback??[])],reference:[...(step.referenceScenePixel??[]),...(step.referenceFeedback??[])]});
  }
  for(const role of ['target','reference']){
    const artifact=context.artifacts.find(a=>a.kind===role+'-rgba'),bytes=saved.get(role+'-rgba');let offset=0;
    if(!artifact||!bytes){issues.push({code:'RAW_PIXELS_MISSING',context:context.id,role});continue;}
    for(const group of groups){
      const length=group.points.length*4,binding=group.row?.raw?.[role];
      const expected={artifact:artifact.path,sha256:artifact.sha256,offset,length,points:group.points,geometry:recipe.dimensions};
      if(!same(binding,expected)||!Array.isArray(group[role])||group[role].length!==length||group[role].some(v=>!Number.isInteger(v)||v<0||v>255)||!same(Array.from(bytes.subarray(offset,offset+length)),group[role]))issues.push({code:'RAW_PIXEL_BINDING',context:context.id,role,offset});
      offset+=length;
    }
    if(bytes.byteLength!==offset)issues.push({code:'RAW_PIXEL_LENGTH',context:context.id,role,actual:bytes.byteLength,expected:offset});
  }
}

/** Artifact admission verifies saved bytes and prevents cross-context reuse. */
export async function admitCollection(report,{recipe,readArtifact}){
  const issues=[],artifacts=new Set(),contextIds=new Set();
  const incomplete=()=>({status:'INCOMPLETE',nativeInputAccepted:false,issues});
  if(report?.schemaVersion!==1||typeof report.runId!=='string'||!report.runId||!Array.isArray(report.inputs?.before)||report.inputs.before.length===0||report.inputs.before.length>256||!same(report.inputs.before,report.inputs.after))issues.push({code:'INPUT_IDENTITY'});
  const inputPaths=new Set();for(const pin of report?.inputs?.before??[]){if(typeof pin.path!=='string'||inputPaths.has(pin.path)||!Number.isSafeInteger(pin.bytes)||pin.bytes<0||!/^([a-f0-9]{64})$/.test(pin.sha256))issues.push({code:'INPUT_IDENTITY'});inputPaths.add(pin.path);}
  if(!Array.isArray(report?.contexts)||!same(report.contexts.map(c=>c.id),['baseline',...recipe.controls.map(c=>c.id)]))issues.push({code:'CONTEXT_INVENTORY'});
  for(const context of report?.contexts??[]){
    if(typeof context.contextId!=='string'||!context.contextId||contextIds.has(context.contextId))issues.push({code:'CONTEXT_REUSED',context:context.id});contextIds.add(context.contextId);
    if(!same(context.cleanup,{contextClosed:true,observerRestored:true,pendingActors:0})||!same(context.errors,[]))issues.push({code:'CONTEXT_INCOMPLETE',context:context.id});
    const advisories=context.advisories===undefined?[]:context.advisories;
    if(!Array.isArray(advisories)||advisories.some(a=>a===null||typeof a!=='object'||!same(Object.keys(a).sort(),['kind','message'])||a.kind!=='CANVAS2D_READBACK_ADVISORY'||a.message!==canvasReadbackAdvisory))issues.push({code:'CONSOLE_CLASSIFICATION',context:context.id});
    if(context.recordOverflow!==undefined&&context.recordOverflow!==false||(Array.isArray(advisories)&&advisories.length+(Array.isArray(context.errors)?context.errors.length:0)>recipe.bounds.records))issues.push({code:'RECORD_BUDGET',context:context.id});
    if(!Array.isArray(context.artifacts)||!same(context.artifacts.map(a=>a.kind),['before','after','rows','target-rgba','reference-rgba'])){issues.push({code:'ARTIFACT_INVENTORY',context:context.id});continue;}
    const saved=new Map();
    for(const artifact of context.artifacts){
      if(typeof artifact.path!=='string'||!artifact.path.startsWith(context.id+'.')||/[\\/]|\.\./.test(artifact.path)||artifacts.has(artifact.path)||!Number.isSafeInteger(artifact.bytes)||artifact.bytes<1||artifact.bytes>16777216||!/^[a-f0-9]{64}$/.test(artifact.sha256)){issues.push({code:'ARTIFACT_IDENTITY',context:context.id});continue;}
      artifacts.add(artifact.path);
      try{const bytes=await readArtifact(artifact.path);if(!(bytes instanceof Uint8Array)||bytes.byteLength!==artifact.bytes||digest(bytes)!==artifact.sha256)throw new Error('Artifact bytes do not match');
        if(artifact.kind==='rows'){const saved=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));if(!same(saved,context.rows))throw new Error('Saved rows do not bind observations');}
        else if(artifact.kind==='before'||artifact.kind==='after'){if(!same(Array.from(bytes.subarray(0,8)),[137,80,78,71,13,10,26,10]))throw new Error('Supplemental PNG signature absent');}
        else if(artifact.path!==context.id+'.'+(artifact.kind==='target-rgba'?'target':'reference')+'.rgba')throw new Error('Raw sample role identity mismatch');
        saved.set(artifact.kind,bytes);
      }catch(cause){issues.push({code:'ARTIFACT_UNAVAILABLE',context:context.id,path:artifact.path,cause:String(cause)});}
    }
    inspectRaw(context,recipe,saved,issues);
  }
  if(!same(report?.retirement,{browserClosed:true,serverClosed:true,pendingActors:0}))issues.push({code:'RUNNER_RETIREMENT'});
  if(issues.length)return incomplete();
  const normal=inspectRows(report.contexts[0].rows,recipe);
  if(normal.issues.some(issue=>['ROW_INVENTORY','STEP_INVENTORY','STEP_MISSING','CLOSE_RECORD_MISSING'].includes(issue.code))){issues.push(...normal.issues);return incomplete();}
  const controls=report.contexts.slice(1).map(context=>({id:context.id,...inspectControl(context,recipe)}));
  if(controls.some(control=>control.status!=='PASS_ASSIGNED_CONTROL_SENSITIVITY'))return{status:'FAIL_CONTROL_SENSITIVITY',nativeInputAccepted:false,issues:controls.filter(c=>c.status!=='PASS_ASSIGNED_CONTROL_SENSITIVITY'),controls};
  if(normal.issues.length)return{status:'FAIL_NATIVE_BASELINE',nativeInputAccepted:false,issues:normal.issues,controls};
  return{status:'PASS_DESKTOP_HT1_CANVAS_SUBSET',nativeInputAccepted:true,issues:[],controls,scope:'Literal desktop pointer/typed-route/Canvas subset and cooperative owned cleanup; no phones, OS reclamation or performance conclusion.'};
}
