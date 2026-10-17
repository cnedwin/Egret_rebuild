// SPDX-License-Identifier: Apache-2.0
// Read-only review preparation. Historical owners are labels, never read targets.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {fingerprintFile,logicalPath,samePhysicalPath,physicalPathKey} from './lib/file-identity.mjs';
import {uniqueJSON} from './prepare-check-maintenance.mjs';

const ROOT=fs.realpathSync(fileURLToPath(new URL('..',import.meta.url)));
const specs={
 'resource-scene':{collector:'tools/resource-scene-boundary.mjs',owners:['application','foundation','sdk'],keys:['schemaVersion','kind','sourceOnly','owners','helperBootstrap','collectorImplementation','foundationAdmission','authoredImportMap','servedOriginalHTML','inventory','modules','closures','routes','limits','moduleBytes','routeBytes','acceptance']},
 'atlas-frame':{collector:'tools/atlas-frame/boundary.mjs',owners:['compiler','compiler-native','foundation','project-json','repository'],keys:['schemaVersion','sourceOnly','owners','aliases','buildResolutions','importMap','inventory','modules','routes']}
};
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const order=(a,b)=>a<b?-1:a>b?1:0;
const requireThat=(ok,message)=>{if(!ok)throw Error(message);};
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const keys=(value,expected)=>plain(value)&&equal(Object.keys(value).sort(),[...expected].sort());
function specFor(family){requireThat(typeof family==='string'&&Object.hasOwn(specs,family),'Unsupported snapshot family');return specs[family];}
function validateSnapshot(family,snapshot){
 const spec=specFor(family);
 requireThat(keys(snapshot,spec.keys)&&snapshot.schemaVersion===1&&snapshot.sourceOnly===true,'Unsupported source snapshot shape');
 if(family==='resource-scene')requireThat(snapshot.kind==='RESOURCE_SCENE_SOURCE_SNAPSHOT_NO_BROWSER','Resource snapshot kind differs');
 requireThat(keys(snapshot.owners,spec.owners),'Exact snapshot owner set required');
 for(const root of Object.values(snapshot.owners))physicalPathKey(root); // Lexical validation only; never access historical roots.
 requireThat(Array.isArray(snapshot.inventory)&&snapshot.inventory.length>0&&Array.isArray(snapshot.modules)&&Array.isArray(snapshot.routes),'Snapshot arrays required');
 const seen=new Set();
 for(const row of snapshot.inventory){
  requireThat(keys(row,['owner','path','bytes','sha256',...(family==='resource-scene'?['roles']:[])]),'Unsupported inventory row');
  requireThat(spec.owners.includes(row.owner),'Unknown inventory owner');logicalPath(row.path);
  requireThat(Number.isSafeInteger(row.bytes)&&row.bytes>=0&&typeof row.sha256==='string'&&/^[a-f0-9]{64}$/.test(row.sha256),'Invalid raw inventory identity');
  if(family==='resource-scene')requireThat(Array.isArray(row.roles)&&row.roles.length>0&&row.roles.every(x=>typeof x==='string'&&x.length>0)&&new Set(row.roles).size===row.roles.length,'Invalid inventory roles');
  const key=row.owner+':'+row.path;requireThat(!seen.has(key),'Duplicate owner/path inventory key');seen.add(key);
 }
 const modules=new Set();
 for(const row of snapshot.modules){
  requireThat(plain(row)&&spec.owners.includes(row.owner),'Unknown module owner');logicalPath(row.path);
  const key=row.owner+':'+row.path;requireThat(seen.has(key)&&!modules.has(key),'Missing or duplicate module input');modules.add(key);
 }
 return snapshot;
}
export function compareSnapshots(family,before,after){
 validateSnapshot(family,after);if(before!==null)validateSnapshot(family,before);
 if(before===null)return {comparison:'not-provided',counts:{observed:after.inventory.length},changes:[],ownerChanges:[],structureChanges:[]};
 const map=s=>new Map(s.inventory.map(x=>[x.owner+':'+x.path,x])),old=map(before),current=map(after),changes=[];
 const counts={added:0,removed:0,changed:0,unchanged:0};
 for(const key of [...new Set([...old.keys(),...current.keys()])].sort(order)){
  const previous=old.get(key)??null,next=current.get(key)??null;
  const change=previous===null?'added':next===null?'removed':equal(previous,next)?'unchanged':'changed';counts[change]++;
  if(change!=='unchanged')changes.push({owner:(next??previous).owner,path:(next??previous).path,change,before:previous,after:next});
 }
 // Root spelling/relocation stays visible, separately from owner-relative bytes.
 const ownerChanges=Object.keys(after.owners).sort().filter(owner=>before.owners[owner]!==after.owners[owner]).map(owner=>({owner,before:before.owners[owner],after:after.owners[owner]}));
 const structureChanges=Object.keys(after).filter(key=>!['inventory','owners'].includes(key)&&!equal(before[key],after[key])).sort();
 return {comparison:'untrusted-baseline-data',counts,changes,ownerChanges,structureChanges};
}
function readArtifact(file){
 physicalPathKey(file);requireThat(path.extname(file)==='.json','Explicit JSON artifact required');
 requireThat(fs.lstatSync(file).size<=16_777_216,'Snapshot artifact exceeds 16 MiB');
 const owner=path.dirname(file),name=path.basename(file),pin=fingerprintFile(owner,name);
 requireThat(pin.bytes<=16_777_216,'Snapshot artifact exceeds 16 MiB');
 const raw=fs.readFileSync(file);
 requireThat(raw.length===pin.bytes&&createHash('sha256').update(raw).digest('hex')===pin.sha256,'Artifact changed during read');
 return {pin:{path:file,bytes:pin.bytes,sha256:pin.sha256},value:uniqueJSON(new TextDecoder('utf-8',{fatal:true}).decode(raw))};
}
export function readSnapshotBaseline(family,file){
 const {pin,value}=readArtifact(file);let snapshot=value;
 if(value?.kind==='snapshot-maintenance'){
  requireThat(value.schemaVersion===1&&value.family===family,'Prior proposal family differs');snapshot=value.snapshot;
 }
 // Extract one saved snapshot only. Never follow nested baseline references.
 return {pin,snapshot:validateSnapshot(family,snapshot)};
}
function inputs(family){
 return ['tools/prepare-snapshot-maintenance.mjs','tools/prepare-check-maintenance.mjs','tools/lib/file-identity.mjs',specFor(family).collector].sort().map(file=>fingerprintFile(ROOT,file));
}
async function prepareSnapshotReview(family,baseline){
 specFor(family);const beforeInputs=inputs(family);
 const previous=baseline?readSnapshotBaseline(family,baseline):null;
 // Fixed trusted collectors read source bytes; product and compiler modules are never evaluated.
 const result=family==='resource-scene'
  ?await (await import('./resource-scene-boundary.mjs')).collectResourceSceneSource({repository:ROOT,applicationRoot:ROOT})
  :await (await import('./atlas-frame/boundary.mjs')).collectAtlasFrameSource(ROOT,'ordinary');
 const snapshot=result.snapshot,difference=compareSnapshots(family,previous?.snapshot??null,snapshot);
 requireThat(equal(beforeInputs,inputs(family)),'Maintenance implementation changed during collection');
 if(previous)requireThat(equal(previous.pin,readArtifact(baseline).pin),'Baseline artifact changed during collection');
 return {schemaVersion:1,kind:'snapshot-maintenance',family,status:'review-required',acceptance:'none',repository:ROOT,baseline:previous?.pin??null,inputs:beforeInputs,snapshot,difference,
  limits:['Current checkout only; no build or browser run','Historical snapshots are comparison data, not authenticated acceptance','Atlas frame collection retains its Windows x64 installed compiler requirement','Source closure and raw identity do not prove semantic, native or performance correctness']};
}
export function parseSnapshotOptions(args){
 const result={};
 for(let i=0;i<args.length;i+=2){
  const key=args[i]?.slice(2);requireThat(['--family','--baseline','--check'].includes(args[i])&&args[i+1]&&!Object.hasOwn(result,key),'Unique named options required');result[key]=args[i+1];
 }
 if(result.check){requireThat(keys(result,['check']),'Check mode takes only its proposal');physicalPathKey(result.check);}
 else {requireThat(Object.hasOwn(result,'family'),'Snapshot family required');specFor(result.family);if(result.baseline)physicalPathKey(result.baseline);}
 return result;
}
async function runSnapshotMaintenance(args){
 const options=parseSnapshotOptions(args);
 if(!options.check)return prepareSnapshotReview(options.family,options.baseline);
 const saved=readArtifact(options.check),proposal=saved.value;
 requireThat(proposal?.kind==='snapshot-maintenance'&&proposal.schemaVersion===1&&proposal.status==='review-required','Review proposal required');
 const current=await prepareSnapshotReview(proposal.family,proposal.baseline?.path);
 requireThat(equal(saved.pin,readArtifact(options.check).pin),'Proposal artifact changed during collection');
 requireThat(equal(proposal,current),'Snapshot proposal inputs or content changed');
 return {status:'current-inputs',acceptance:'none; independent review and complete gates remain required'};
}
// Actual collection has no reusable API: use a fresh direct CLI with no preload hooks.
if(process.argv[1]&&samePhysicalPath(path.resolve(process.argv[1]),fileURLToPath(import.meta.url))){
 requireThat(process.execArgv.length===0&&!process.env.NODE_OPTIONS&&!process.env.NODE_PATH,'Fresh Node CLI without preload or custom loader options required');
 console.log(JSON.stringify(await runSnapshotMaintenance(process.argv.slice(2)),null,2));
}
