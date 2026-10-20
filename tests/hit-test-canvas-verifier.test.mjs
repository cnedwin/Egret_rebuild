// First-party verifier admission controls; synthetic records are not native results.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const recipe = JSON.parse(await readFile(new URL('./fixtures/hit-test-canvas/cases.json', import.meta.url)));
let contract;
try { contract = await import('../tools/hit-test-canvas-contract.mjs'); }
catch (cause) { if (cause.code !== 'ERR_MODULE_NOT_FOUND') throw cause; }
test('HC01 real verifier admission entry exists before synthetic evidence can pass', () => {
  assert.equal(typeof contract?.admitCollection, 'function', 'Missing hit-test Canvas verifier admission entry');
});
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const clone = value => structuredClone(value);
const gray = [64,64,64,255], blue = [0,0,255,255];
const route = label => label === null ? [] : [
  {currentTarget:'stage',target:label,phase:'capturing'},
  {currentTarget:label,target:label,phase:'atTarget'},
  {currentTarget:'root',target:label,phase:'bubbling'},
  {currentTarget:'stage',target:label,phase:'bubbling'},
];
function fixture() {
  const files = new Map();
  const initial = {phase:'ready',status:'ready',pointerCount:0,dispatchCount:0,renderCount:1,lastFrameId:1,feedbackColor:0x404040,liveNodes:9,disposedNodes:0,enabledActors:5,typedListenerCount:8,unsubscribeAttempts:0,scopeState:'open',upperVisible:true,gateVisible:true,touchChildren:true,failureCount:0,diagnosticCount:0,domRegistrationCount:6,domRemovalAttempts:0,route:[]};
  const ready = () => ({id:'B01',snapshot:clone(initial),geometry:{logical:[320,200],css:[640,400],viewport:[900,700],deviceScaleFactor:1},samples:clone(recipe.initialSamples),reference:clone(recipe.initialSamples),ledger:{registrations:6,removals:0,outstanding:6,overflow:false}});
  function normalRows() {
    const rows=[ready()]; let current=clone(initial);
    for(const row of recipe.rows.slice(1,-1)) {
      const steps=[];
      for(const expected of row.steps) {
        if(expected.toggle){const flag={upper:'upperVisible',gate:'gateVisible',children:'touchChildren'}[expected.toggle];current[flag]=!current[flag];current.renderCount++;current.lastFrameId++;}
        const before=clone(current); const payload={globalX:expected.point[0],globalY:expected.point[1],button:0,pointerType:'mouse'};
        current={...current,status:expected.label===null?'miss':'hit',selectedLabel:expected.label,lastPayload:payload,route:route(expected.label),pointerCount:expected.p,dispatchCount:expected.d,renderCount:expected.r,lastFrameId:expected.r,feedbackColor:expected.feedback};
        const rgba=expected.feedback===0xff0000?[255,0,0,255]:expected.feedback===0x00ff00?[0,255,0,255]:expected.feedback===0xff00ff?[255,0,255,255]:expected.feedback===0xffff00?[255,255,0,255]:blue;
        const scenePixel=recipe.sceneSamples[row.id][steps.length];
        steps.push({before,after:clone(current),input:{method:'page.mouse.click',logical:expected.point,page:[24+expected.point[0]*2,160+expected.point[1]*2],box:{x:24,y:160,width:640,height:400}},feedback:rgba,referenceFeedback:rgba,scenePixel,referenceScenePixel:scenePixel});
      }
      rows.push({id:row.id,steps});
    }
    const before=clone(current);const after={...current,phase:'closed',scopeState:'closed',liveNodes:0,disposedNodes:9,enabledActors:0,typedListenerCount:0,unsubscribeAttempts:8,domRemovalAttempts:6};
    rows.push({id:'B10',before,after,afterProbe:clone(after),input:{method:'page.mouse.click'},surface:{width:0,height:0,connected:false},ledger:{registrations:6,removals:6,outstanding:0,overflow:false},settled:true});
    return rows;
  }
  const contexts=[{id:'baseline',contextId:'context-0',rows:normalRows(),cleanup:{contextClosed:true,observerRestored:true,pendingActors:0},errors:[]}];
  for(const [index,control] of recipe.controls.entries()) {
    const rows=normalRows();
    if(control.row==='B02') rows.splice(2);
    const row=rows.find(item=>item.id===control.row);
    if(control.id==='omit-query'){Object.assign(row.steps[0].after,{status:'miss',selectedLabel:null,route:[],dispatchCount:0,renderCount:1,lastFrameId:1,feedbackColor:0x404040});row.steps[0].feedback=gray;}
    if(control.id==='omit-css'){Object.assign(row.steps[0].after,{status:'miss',selectedLabel:null,route:[],lastPayload:{globalX:112,globalY:96,button:0,pointerType:'mouse'},dispatchCount:0,renderCount:1,lastFrameId:1,feedbackColor:0x404040});row.steps[0].feedback=gray;}
    if(control.id==='omit-dispatch')row.steps[0].after.route=[];
    if(control.id==='capture-only')row.steps[0].feedback=gray;
    if(control.id==='omit-retirement')row.ledger={registrations:6,removals:0,outstanding:6,overflow:false};
    contexts.push({id:control.id,contextId:'context-'+(index+1),rows,cleanup:{contextClosed:true,observerRestored:true,pendingActors:0},errors:[]});
  }
  for(const context of contexts){
    const groups=[{row:context.rows[0],points:recipe.initialSamples.map(s=>s.point),target:context.rows[0].samples.flatMap(s=>s.rgba),reference:context.rows[0].reference.flatMap(s=>s.rgba)}];
    for(const row of context.rows.slice(1))for(const [index,step] of (row.steps??[]).entries())groups.push({row:step,points:[recipe.rows.find(r=>r.id===row.id).steps[index].point,[284,28]],target:[...step.scenePixel,...step.feedback],reference:[...step.referenceScenePixel,...step.referenceFeedback]});
    const rawPins=[];
    for(const role of ['target','reference']){
      const path=context.id+'.'+role+'.rgba',bytes=Buffer.from(groups.flatMap(group=>group[role])),sha256=hash(bytes);files.set(path,bytes);rawPins.push({kind:role+'-rgba',path,bytes:bytes.length,sha256});let offset=0;
      for(const group of groups){const length=group[role].length;(group.row.raw??={})[role]={artifact:path,sha256,offset,length,points:clone(group.points),geometry:clone(recipe.dimensions)};offset+=length;}
    }
    context.artifacts=[];
    for(const kind of ['before','after','rows']){const path=context.id+'.'+kind+(kind==='rows'?'.json':'.png');const bytes=kind==='rows'?Buffer.from(JSON.stringify(context.rows)):Buffer.from([137,80,78,71,13,10,26,10,1]);files.set(path,bytes);context.artifacts.push({kind,path,bytes:bytes.length,sha256:hash(bytes)});}
    context.artifacts.push(...rawPins);
  }
  const pins=[{path:'first-party-fixture-input',bytes:10,sha256:'a'.repeat(64)}];
  return {report:{schemaVersion:1,runId:'synthetic-admission-only',inputs:{before:pins,after:clone(pins)},contexts,retirement:{browserClosed:true,serverClosed:true,pendingActors:0}},readArtifact:async path=>files.get(path),files};
}
function checked(name, run){test(name,{skip:contract===undefined},run);}
checked('HC02 complete literal normal/control records admit only finite recorded scope',async()=>{const f=fixture();const result=await contract.admitCollection(f.report,{recipe,readArtifact:f.readArtifact});assert.equal(result.status,'PASS_DESKTOP_HT1_CANVAS_SUBSET');assert.equal(result.nativeInputAccepted,true);});
checked('HC03 missing baseline row cannot become a PASS',async()=>{const f=fixture();f.report.contexts[0].rows.splice(5,1);assert.equal((await contract.admitCollection(f.report,{recipe,readArtifact:f.readArtifact})).status,'INCOMPLETE');});
checked('HC04 repeated context identity cannot satisfy fresh controls',async()=>{const f=fixture();f.report.contexts[1].contextId='context-0';assert.equal((await contract.admitCollection(f.report,{recipe,readArtifact:f.readArtifact})).status,'INCOMPLETE');});
checked('HC05 missing saved artifact is incomplete, not an expected control rejection',async()=>{const f=fixture();f.files.delete('omit-css.before.png');assert.equal((await contract.admitCollection(f.report,{recipe,readArtifact:f.readArtifact})).status,'INCOMPLETE');});
checked('HC06 artifact byte tampering cannot be accepted',async()=>{const f=fixture();f.files.set('baseline.after.png',Buffer.from('changed'));assert.equal((await contract.admitCollection(f.report,{recipe,readArtifact:f.readArtifact})).status,'INCOMPLETE');});
checked('HC07 reused artifact route across contexts cannot be accepted',async()=>{const f=fixture();f.report.contexts[1].artifacts[0]=clone(f.report.contexts[0].artifacts[0]);assert.equal((await contract.admitCollection(f.report,{recipe,readArtifact:f.readArtifact})).status,'INCOMPLETE');});
checked('HC08 a wrong target in the normal B02 row fails actual recipe',async()=>{const f=fixture();f.report.contexts[0].rows[1].steps[0].after.selectedLabel='lower';f.report.contexts[0].artifacts=[];assert.equal(contract.inspectRows(f.report.contexts[0].rows,recipe).issues[0].code,'SELECTED_TARGET');});
checked('HC09 a counterexample must first pass B01',async()=>{const f=fixture();f.report.contexts[2].rows[0].snapshot.liveNodes=0;assert.equal(contract.inspectControl(f.report.contexts[2],recipe).status,'INVALID_CONTROL');});
checked('HC10 wrong rejection cannot substitute for the assigned CSS witness',async()=>{const f=fixture();const c=f.report.contexts[2];c.rows[1].steps[0].after.lastPayload={globalX:56,globalY:48,button:0,pointerType:'mouse'};assert.equal(contract.inspectControl(c,recipe).status,'INVALID_CONTROL');});
checked('HC11 skipped native removals require the independent six-pair witness',async()=>{const f=fixture();const c=f.report.contexts[5];c.rows.at(-1).ledger.outstanding=0;assert.equal(contract.inspectControl(c,recipe).status,'INVALID_CONTROL');});
checked('HC12 unsettled context retirement is incomplete even with correct negative witnesses',async()=>{const f=fixture();f.report.contexts[3].cleanup.pendingActors=1;assert.equal((await contract.admitCollection(f.report,{recipe,readArtifact:f.readArtifact})).status,'INCOMPLETE');});
checked('HC13 input drift is incomplete',async()=>{const f=fixture();f.report.inputs.after[0].sha256='b'.repeat(64);assert.equal((await contract.admitCollection(f.report,{recipe,readArtifact:f.readArtifact})).status,'INCOMPLETE');});
checked('HC14 saved row artifact must bind the exact observed context rows',async()=>{const f=fixture();f.files.set('baseline.rows.json',Buffer.from('[]'));const a=f.report.contexts[0].artifacts.find(a=>a.kind==='rows');a.bytes=2;a.sha256=hash(Buffer.from('[]'));assert.equal((await contract.admitCollection(f.report,{recipe,readArtifact:f.readArtifact})).status,'INCOMPLETE');});
checked('HC15 touchChildren suppression cannot hide incorrect rendered green pixels',()=>{const f=fixture();const row=f.report.contexts[0].rows.find(row=>row.id==='B06');row.steps[0].scenePixel=[0,0,0,255];assert.equal(contract.inspectRows(f.report.contexts[0].rows,recipe).issues.some(issue=>issue.code==='SCENE_PIXEL'),true);});
checked('HC16 application projection must exist before native collection',()=>{assert.equal(typeof contract.projectApplication,'function');});
test('HC17 duplicate query anchors refuse projection',{skip:typeof contract?.projectApplication!=='function'},()=>{const anchor='const selected = stage.hitTest(payload.globalX, payload.globalY, { maxNodes: 9 });';assert.throws(()=>contract.projectApplication({scene:anchor+'\n'+anchor,application:''},'omit-query'),/anchor.*2/);});
test('HC18 missing retirement anchor refuses projection',{skip:typeof contract?.projectApplication!=='function'},()=>{assert.throws(()=>contract.projectApplication({scene:'',application:''},'omit-retirement'),/anchor.*0/);});
checked('HC19 PNG-signature-only evidence cannot accept correct JSON pixel claims',async()=>{const f=fixture();for(const c of f.report.contexts)c.artifacts=c.artifacts.filter(a=>!['target-rgba','reference-rgba'].includes(a.kind));assert.equal((await contract.admitCollection(f.report,{recipe,readArtifact:f.readArtifact})).status,'INCOMPLETE');});
checked('HC20 an empty typed route cannot excuse synthetic pointer input',()=>{const f=fixture();const c=f.report.contexts[3];c.rows[1].steps[0].input.method='script dispatchEvent';assert.equal(contract.inspectControl(c,recipe).status,'INVALID_CONTROL');});
checked('HC21 actual hit frames must progress from their previous rendered frame',()=>{const f=fixture();for(const row of f.report.contexts[0].rows.slice(1,-1))for(const step of row.steps){step.before.lastFrameId=1;step.after.lastFrameId=1;}assert.equal(contract.inspectRows(f.report.contexts[0].rows,recipe).issues.some(issue=>issue.code==='FRAME_PROGRESS'),true);});
function refreshRows(f,context){const bytes=Buffer.from(JSON.stringify(context.rows)),pin=context.artifacts.find(a=>a.kind==='rows');f.files.set(pin.path,bytes);Object.assign(pin,{bytes:bytes.length,sha256:hash(bytes)});}
checked('HC22 contradictory raw RGBA bytes cannot hide behind refreshed hashes and correct JSON',async()=>{const f=fixture(),c=f.report.contexts[0],pin=c.artifacts.find(a=>a.kind==='target-rgba'),bytes=Buffer.from(f.files.get(pin.path));bytes[28]=255;f.files.set(pin.path,bytes);pin.sha256=hash(bytes);for(const row of c.rows){if(row.raw)row.raw.target.sha256=pin.sha256;for(const s of row.steps??[])s.raw.target.sha256=pin.sha256;}refreshRows(f,c);const result=await contract.admitCollection(f.report,{recipe,readArtifact:f.readArtifact});assert.equal(result.status,'INCOMPLETE');assert.equal(result.issues.some(i=>i.code==='RAW_PIXEL_BINDING'),true);});
checked('HC23 reusing a preceding RGBA range cannot satisfy a later sample',async()=>{const f=fixture(),c=f.report.contexts[0];c.rows[2].steps[0].raw.target.offset=28;refreshRows(f,c);assert.equal((await contract.admitCollection(f.report,{recipe,readArtifact:f.readArtifact})).status,'INCOMPLETE');});
checked('HC24 target and reference role identities cannot be interchanged',async()=>{const f=fixture(),c=f.report.contexts[0];c.rows[0].raw.target.artifact=c.rows[0].raw.reference.artifact;refreshRows(f,c);assert.equal((await contract.admitCollection(f.report,{recipe,readArtifact:f.readArtifact})).status,'INCOMPLETE');});
checked('HC25 an assigned control witness cannot excuse a disposed active scene',()=>{const f=fixture(),c=f.report.contexts[3];c.rows[1].steps[0].after.liveNodes=0;assert.equal(contract.inspectControl(c,recipe).status,'INVALID_CONTROL');});
checked('HC26 an assigned control witness cannot excuse reference pixel corruption',()=>{const f=fixture(),c=f.report.contexts[4];c.rows[1].steps[0].referenceFeedback=gray;assert.equal(contract.inspectControl(c,recipe).status,'INVALID_CONTROL');});
checked('HC27 close cannot reset the last observed frame behind a refreshed saved-row hash',async()=>{const f=fixture(),c=f.report.contexts[0],row=c.rows.at(-1);for(const field of ['before','after','afterProbe'])row[field].lastFrameId=1;refreshRows(f,c);const result=await contract.admitCollection(f.report,{recipe,readArtifact:f.readArtifact});assert.equal(result.status,'FAIL_NATIVE_BASELINE');assert.equal(result.issues.some(i=>i.row==='B10'&&i.code==='BEFORE_SNAPSHOT'),true);});
checked('HC28 original public import aliases cannot be masked by sealed-route rewriting',()=>{
  const original={'@egret/engine':'/packages/engine/dist/index.js','@egret/engine/web':'/packages/engine/dist/web/index.js','@egret/runtime':'/packages/runtime/dist/index.js','@egret/contracts':'/packages/contracts/dist/index.js','@egret/contracts/resources':'/packages/contracts/dist/resources/index.js','#egret-textured-frame-state':'/packages/engine/dist/internal/texturedFrameState.js'};
  const served=Object.fromEntries(Object.keys(original).map((key,index)=>[key,'/m/'+String(index).padStart(4,'0')+'.js']));
  const html=map=>'<script type="importmap">'+JSON.stringify({imports:map})+'</script>';
  assert.deepEqual(contract.projectImportMap(html(original),served).adaptation,{original:{imports:original},served:{imports:served}});
  for(const bad of [{...original,'@egret/engine':'/wrong.js'},{...original,extra:'/extra.js'},Object.fromEntries(Object.entries(original).filter(([key])=>key!=='@egret/runtime'))])assert.throws(()=>contract.projectImportMap(html(bad),served),/original.*alias/i);
});
const readbackAdvisory='Canvas2D: Multiple readback operations using getImageData are faster with the willReadFrequently attribute set to true. See: https://html.spec.whatwg.org/multipage/canvas.html#concept-canvas-will-read-frequently';
checked('HC29 only the exact native Canvas readback warning is retained as an advisory',async()=>{const expected={bucket:'advisories',record:{kind:'CANVAS2D_READBACK_ADVISORY',message:readbackAdvisory}};assert.deepEqual(contract.classifyConsole('warning',readbackAdvisory),expected);const f=fixture();f.report.contexts[0].advisories=[expected.record,clone(expected.record)];assert.equal((await contract.admitCollection(f.report,{recipe,readArtifact:f.readArtifact})).status,'PASS_DESKTOP_HT1_CANVAS_SUBSET');});
checked('HC30 unknown warnings and an error with the advisory text remain fatal',async()=>{for(const [type,message] of [['warning','Unknown native warning'],['warning',readbackAdvisory+' '],['error',readbackAdvisory]]){const record=contract.classifyConsole(type,message);assert.deepEqual(record,{bucket:'errors',record:{kind:'CONSOLE_'+type,message}});const f=fixture();f.report.contexts[0].errors=[record.record];assert.equal((await contract.admitCollection(f.report,{recipe,readArtifact:f.readArtifact})).status,'INCOMPLETE');}});
checked('HC31 relabeling an unknown warning as an advisory does not admit the collection',async()=>{const f=fixture();f.report.contexts[0].advisories=[{kind:'CANVAS2D_READBACK_ADVISORY',message:'Unknown native warning'}];assert.equal((await contract.admitCollection(f.report,{recipe,readArtifact:f.readArtifact})).status,'INCOMPLETE');});
checked('HC32 a diagnostic budget overflow remains incomplete even for exact advisories',async()=>{for(const capped of [false,true]){const f=fixture();f.report.contexts[0].advisories=Array.from({length:recipe.bounds.records+(capped?0:1)},()=>({kind:'CANVAS2D_READBACK_ADVISORY',message:readbackAdvisory}));if(capped)f.report.contexts[0].recordOverflow=true;assert.equal((await contract.admitCollection(f.report,{recipe,readArtifact:f.readArtifact})).status,'INCOMPLETE');}});

checked('HC33 actual public HTML resources alias cannot be omitted or redirected before projection',async()=>{
  async function baseline(){
    const source=await readFile(new URL('../examples/hit-test/index.html',import.meta.url),'utf8'),maps=[...source.matchAll(/<script type="importmap">([^<]*)<\/script>/g)];
    assert.equal(maps.length,1);const original=JSON.parse(maps[0][1]);
    assert.equal(original.imports['@egret/contracts/resources'],'/packages/contracts/dist/resources/index.js');
    const served=Object.fromEntries(Object.keys(original.imports).map((key,index)=>[key,'/m/'+String(index).padStart(4,'0')+'.js']));
    assert.deepEqual(contract.projectImportMap(source,served).adaptation,{original,served:{imports:served}});
    return {source,original,served,anchor:maps[0][0]};
  }
  for(const mutate of [map=>{delete map['@egret/contracts/resources'];},map=>{map['@egret/contracts/resources']='/packages/contracts/dist/index.js';}]){
    const fixture=await baseline(),altered=structuredClone(fixture.original);mutate(altered.imports);
    const failures=[];
    try{assert.throws(()=>contract.projectImportMap(fixture.source.replace(fixture.anchor,'<script type="importmap">'+JSON.stringify(altered)+'</script>'),fixture.served),/original.*alias/i);}catch(cause){failures.push(cause);}
    try{await baseline();}catch(cause){failures.push(cause);}
    if(failures.length)throw new AggregateError(failures,'Hit-test resources alias refusal/restoration');
  }
});
