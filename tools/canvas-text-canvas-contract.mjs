// Independently authored Egret Rebuild Canvas collector contract. Apache-2.0.
import path from 'node:path';
import {createHash} from 'node:crypto';
export const MODES = Object.freeze(['baseline','omitFill','omitOrigin','noOp','holdRaster','notReady']);
export const PROFILE = 'wc1-canvas-explicit-lines-v1';
const ZERO = ['pendingJobs','pendingWaiters','activeCallerLeases','liveImageBytes','reservedImageBytes','pendingRasterBytes','quarantinedImageBytes','quarantinedRasterBytes','cleanupFailureCount'];
const controls = {omitFill:{id:'C01',row:'X-d1'},omitOrigin:{id:'C02',row:'p-d1'},noOp:{id:'C03',row:'X-d1'}};
const fail = (ok, label) => { if(!ok) throw Object.assign(new Error('Canvas evidence: '+label),{code:'WC1_CANVAS_INCOMPLETE'}); };
const zero = value => value && ZERO.every(name=>value[name]===0);
const descriptor = value => typeof value?.name==='string'&&value.name.length<=111&&/^[A-Za-z0-9][A-Za-z0-9_.-]*\.rgba$/.test(value.name)&&Number.isSafeInteger(value.bytes)&&value.bytes>=0&&value.bytes<=4194304&&/^[a-f0-9]{64}$/.test(value.sha256);
const image = value => descriptor(value)&&value.bytes===25600&&value.metadata?.width===80&&value.metadata.height===80&&value.metadata.format==='rgba8unorm'&&value.metadata.colorSpace==='srgb'&&value.metadata.alphaMode==='straight';
const recorded = (value, artifact) => image(artifact) && value.artifacts.some(a=>a.name===artifact.name&&a.bytes===artifact.bytes&&a.sha256===artifact.sha256);
const canonical = value => Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
const equal = (a,b) => JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
export function parseCollectorArgs(args, repositoryRoot) {
  const invalid = label => {throw Object.assign(new Error('Canvas CLI: '+label),{code:'WC1_CANVAS_CLI'});};
  if(args.length!==4||args[0]!=='--playwright'||args[2]!=='--output')invalid('expected --playwright <absolute> --output <absolute>');
  if(!path.isAbsolute(args[1])||!path.isAbsolute(args[3]))invalid('absolute installed tooling and independent output required');
  const selected={playwright:path.resolve(args[1]),output:path.resolve(args[3])},root=path.resolve(repositoryRoot).toLowerCase(),target=selected.output.toLowerCase();
  if(target===root||target.startsWith(root+path.sep))invalid('output must be outside the repository');
  return selected;
}
export function admitWindow(value, mode, evidence) {
  fail(MODES.includes(mode)&&value?.schemaVersion===1&&value.mode===mode&&value.failurePresent===false&&value.failure===null&&Array.isArray(value.cleanupFailures)&&value.cleanupFailures.length===0,'first cause and cleanup');
  fail(value.scope?.profile===PROFILE&&value.scope.currentCanvas===true&&value.scope.currentTextField===true&&value.scope.currentTexturedWebGPU===false,'bounded Canvas profile');
  fail(Array.isArray(value.rows)&&Array.isArray(value.observations)&&Array.isArray(value.artifacts),'result inventories');
  const r=value.retirement;
  fail(r&&r.pendingActors===0&&r.providerPlansReleased===true&&r.nativeMethodsRestored===true&&r.ownedFaceDeleted===true&&r.reference?.disposed===true&&r.reference.retainedRawBuffers===0&&r.engineClosePromisesSettled===1,'actual owned retirement');
  fail(Array.isArray(r.caches)&&r.caches.length===1&&r.caches.every(c=>c.closed===true&&zero(c)),'one actual closed cache');
  const assigned=controls[mode];
  fail(value.status===(assigned?'PASS_ASSIGNED_CONTROL_SENSITIVITY':'PASS_WC1_CANVAS_SUBSET'),'window classification');
  const ref=evidence?.reference,readArtifact=evidence?.readArtifact;
  fail(typeof readArtifact==='function'&&ref?.mode===mode&&ref.calls===1&&ref.state==='durable-read-back'&&ref.ack?.stored===true&&ref.ack.mode===mode&&ref.ack.recipeId==='wc1-owned-ahem-complete-line-reference-v1'&&value.preJobReference?.beforeFirstTargetAcquire===true&&equal(value.preJobReference.ack,ref.ack),'actual independent reference before target');
  fail(Array.isArray(ref.ack.raw)&&ref.ack.raw.length===28&&new Set(ref.ack.raw.map(a=>a.id)).size===28&&new Set(ref.ack.raw.map(a=>a.name)).size===28&&Array.isArray(ref.table?.entries)&&ref.table.entries.length===14,'complete independent reference inventory');
  fail(new Set(value.artifacts.map(a=>a.name)).size===value.artifacts.length&&value.artifacts.every(a=>descriptor(a))&&ref.ack.raw.every(a=>descriptor(a)&&!value.artifacts.some(t=>t.name===a.name)),'unique valid saved image identities');
  const read=a=>{fail(descriptor(a),'named bounded byte artifact');const bytes=readArtifact(a);fail(bytes instanceof Uint8Array&&bytes.length===a.bytes&&createHash('sha256').update(bytes).digest('hex')===a.sha256,'actual saved artifact bytes and hash');return bytes;};
  const actual=a=>{fail(descriptor(a)&&value.artifacts.some(t=>t.name===a.name&&t.bytes===a.bytes&&t.sha256===a.sha256),'actual target artifact inventory binding');return read(a);};
  const source=id=>{const a=ref.ack.raw.find(a=>a.id===id);fail(a,'selected independent reference artifact');return a;};
  const exact=(a,b,label)=>{fail(a.length===b.length&&a.every((byte,i)=>byte===b[i]),'complete exact '+label+' bytes');};
  for(const a of value.artifacts)read(a);for(const a of ref.ack.raw)read(a);
  const rowProof=row=>{const entry=ref.table.entries.find(e=>e.id===row.id);fail(entry&&equal(row.metrics,entry.metrics),'independent row metrics');
    fail(Array.isArray(row.native)&&Array.isArray(entry.native)&&equal(row.native.map(({text,raw,negativeZero})=>({text,raw,negativeZero})),entry.native.map(({text,raw,negativeZero})=>({text,raw,negativeZero}))),'actual complete-line native metrics and signed zero');
    const raster=entry.metrics.raster,owned=source(row.id+'-owned'),scene=source(row.id+'-scene');
    fail(scene.width===80&&scene.height===80&&scene.bytes===25600&&image(row.hostArtifact),'full row frame shape');
    if(raster){const a=row.ownedArtifact;fail(descriptor(a)&&a.bytes===raster.byteLength&&owned.bytes===raster.byteLength&&owned.width===raster.width&&owned.height===raster.height&&a.metadata?.width===raster.width&&a.metadata.height===raster.height&&a.metadata.format==='rgba8unorm'&&a.metadata.colorSpace==='srgb'&&a.metadata.alphaMode==='straight','full row owned raster shape');actual(a);}
    else fail(row.ownedArtifact===null&&owned.bytes===0&&owned.width===0&&owned.height===0,'empty row raster authority');
    actual(row.hostArtifact);return {entry,owned,scene};};
  if(mode==='baseline') {
    const ids=new Set(['X','p','E-acute','space','empty','LF','CRLF'].flatMap(row=>[row+'-d1',row+'-d1_5']));
    fail(value.rows.length===14&&new Set(value.rows.map(row=>row.id)).size===14&&value.rows.every(row=>row.host==='canvas'&&ids.has(row.id)&&recorded(value,row.hostArtifact)),'fourteen distinct Canvas rows');
    const rowNames=value.rows.flatMap(row=>[row.hostArtifact.name,...(row.ownedArtifact?[row.ownedArtifact.name]:[])]);fail(new Set(rowNames).size===rowNames.length,'distinct per-row raster and frame identities');
    for(const row of value.rows){const {entry,owned,scene}=rowProof(row);exact(actual(row.hostArtifact),read(scene),'row frame');if(entry.metrics.raster)exact(actual(row.ownedArtifact),read(owned),'owned raster');}
    for(const kind of ['composition','blank-replacement','owned-font-change']) {
      const proof=value.observations.filter(o=>o.kind===kind);fail(proof.length===1&&proof[0].host==='canvas'&&recorded(value,proof[0].hostArtifact),'complete '+kind+' witness');
      const p=proof[0];
      if(kind==='blank-replacement')fail(p.allBytesZero===true&&actual(p.hostArtifact).every(byte=>byte===0),'blank replacement actual full bytes');
      else {fail(recorded(value,p.expectedArtifact)&&p.expectedArtifact.name!==p.hostArtifact.name,'separate '+kind+' byte operands');exact(actual(p.hostArtifact),actual(p.expectedArtifact),kind);}
      if(kind==='owned-font-change')fail(p.affectedCaches===1&&Number.isSafeInteger(p.generationBefore)&&p.generationBefore>=0&&p.generationAfter===p.generationBefore+1&&p.automaticGeneration===false,'explicit font generation');
      if(kind==='owned-font-change')exact(actual(p.hostArtifact),read(source('X-d1-scene')),'independent generation frame');
    }
  } else if(assigned) {
    const row=value.rows[0],c=row?.control;
    fail(value.rows.length===1&&row.host==='canvas'&&row.id===assigned.row&&c?.id===assigned.id&&c.status==='FAIL_ASSIGNED_WITNESS'&&c.unrelatedFailure===false&&JSON.stringify(c.actual)==='[0,0,0,0]'&&JSON.stringify(c.expected)==='[39,83,161,255]','exact assigned '+assigned.id+' witness');
    const {entry,owned,scene}=rowProof(row),noOp=mode==='noOp',target=noOp?row.hostArtifact:row.ownedArtifact,expected=noOp?scene:owned,w=c.witness;
    const raster=entry.metrics.raster,x=noOp?30:Math.floor(10*raster.density-raster.pixelLeft),y=noOp?30:Math.floor((mode==='omitOrigin'?22:10)*raster.density-raster.pixelTop);
    fail(w&&equal(w.artifact,target)&&equal(w.referenceArtifact,expected)&&w.x===x&&w.y===y&&Number.isSafeInteger(x)&&Number.isSafeInteger(y)&&x>=0&&y>=0&&x<expected.width&&y<expected.height,'assigned saved pixel image and coordinates');
    const pixel=(bytes,width)=>Array.from(bytes.subarray(4*(y*width+x),4*(y*width+x)+4));
    fail(equal(pixel(actual(target),expected.width),[0,0,0,0])&&equal(pixel(read(expected),expected.width),[39,83,161,255]),'actual saved wrong and independent expected pixel bytes');
    if(mode==='omitFill')fail(actual(row.ownedArtifact).every(byte=>byte===0),'full omitted-fill raster bytes');
    if(noOp){exact(actual(row.ownedArtifact),read(owned),'no-op unchanged owned source');fail(actual(row.hostArtifact).every(byte=>byte===0),'full no-op host frame bytes');}
  } else {
    fail(value.rows.length===0,'lifecycle/readiness row inventory');
    const held=mode==='holdRaster',proofs=value.observations.filter(o=>o.kind===(held?'held-replacement':'readiness-refusal'));
    const counts=held?{measure:2,issuedPlans:2,raster:2,release:2,held:1,lateImages:1,firstTargetAcquire:1}:{measure:1,issuedPlans:0,raster:0,release:0,held:0,lateImages:0,firstTargetAcquire:1};
    fail(value.witnessCompletion?.holdRaster===held&&value.witnessCompletion.notReady===!held&&proofs.length===1&&proofs[0].completed===true&&proofs[0].actualIdleObserved===true&&Object.entries(counts).every(([key,n])=>value.counters?.[key]===n),'completed witness and exact actor counters');
    const p=proofs[0];fail(zero(p.remaining),'witness idle counters');
    if(held)fail(p.heldRasterEntered===true&&p.heldRasterSettled===true&&p.oldVisibilityChecked===true&&p.savedImageAuthorityChecked===true&&p.savedImageBytesChecked===true&&p.pendingRejected===true&&p.pendingRejectionIsEgretError===true&&p.pendingError?.present===true&&p.closedScope==='closed'&&p.scopeReason?.present===true&&p.scopeReason.code==='SCOPE_CLOSED'&&p.closingError?.present===true&&p.closingError.code==='SCOPE_CLOSED'&&p.lateImages===1&&Number.isSafeInteger(p.oldFrameId)&&p.oldFrameId>0&&recorded(value,p.oldHostArtifact),'genuine held replacement and saved image/Scope proof');
    else fail(p.nativeMeasureCalls===0&&p.providerCanvasContexts===0&&Array.isArray(p.errors)&&p.errors.length===1&&p.errors[0].present===true&&p.errors[0].code==='TEXT_MEASURE_FAILED'&&p.errors[0].causePresent===true&&p.errors[0].cause?.present===true&&p.errors[0].cause.code==='WEB_TEXT_FONT_NOT_READY','readiness before native Canvas work');
    if(held)exact(actual(p.oldHostArtifact),read(source('X-d1-scene')),'held old independent frame');
  }
}
