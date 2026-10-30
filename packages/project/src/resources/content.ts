// SPDX-License-Identifier: Apache-2.0
import type {EntityId, FileId, JsonObject, JsonValue, ProjectEditTransaction, ProjectEntity, ProjectFile, ProjectSnapshot} from '@egret/contracts';
import type {AdmittedResourceManifest, ResourceBuildPlanDescription, ResourceBuildSourceEntry, ResourceManifestResult} from '@egret/contracts/resources';
import {buildResourceManifest, evaluateResourceBuildKeys, validateResourceBuildPlanDescription} from '@egret/contracts/resources';
import type {ProjectValueResult} from '../public.js';
import {createProjectStore, parseProjectSnapshot, parseProjectTransaction, serializeProjectSnapshot} from '../api.js';
import {cloneLive} from '../live-input.js';
import {DEFAULT_PROJECT_LIMITS} from '../limits.js';
import {makeDiagnostic} from '../diagnostics.js';
import {isPortablePath, pathCollisionKey} from '../paths.js';

export interface ContentProducer {readonly nodeVersion:string;readonly pngjsVersion:string;readonly zlibVersion:string;}
export interface ContentOutputFile {readonly name:'primary'|'rgba';readonly mediaType:string;readonly sha256:string;readonly byteLength:number;}
export interface ContentOutput {readonly resourceId:EntityId;readonly buildKey:string;readonly files:readonly ContentOutputFile[];}
export interface ContentBoundOutput {readonly resourceId:EntityId;readonly buildKey:string;readonly files:readonly {readonly name:'primary'|'rgba';readonly file:ProjectFile}[];}
export interface ContentArtifactBinding {
  readonly plan:ResourceBuildPlanDescription;
  readonly manifest:AdmittedResourceManifest;
  readonly files:readonly ProjectFile[];
  readonly entities:readonly ProjectEntity[];
  readonly outputs:readonly ContentBoundOutput[];
  readonly outputPrefix:string;
}
export interface ContentAdoptionOptions {
  readonly generationId:string;
  readonly manifest:{readonly sha256:string;readonly byteLength:number};
  readonly outputPrefix:string;
  readonly selectorId:EntityId;
  readonly transactionId:string;
}
const bindings=new WeakSet<object>();
class Refusal {constructor(readonly result:ProjectValueResult<never>) {}}
function fail(message:string,pointer=''):never {throw new Refusal({ok:false,diagnostics:[makeDiagnostic({code:'PROJECT_INPUT_INVALID',phase:'schema',severity:'error',jsonPointer:pointer,message,details:{}})]});}
function take<T>(result:ProjectValueResult<T>):T {if(!result.ok)throw new Refusal(result);return result.value;}
function shared<T>(result:ResourceManifestResult<T>):T {if(!result.ok)fail(result.diagnostics[0].message,result.diagnostics[0].pointer);return result.value;}
function freeze<T>(value:T):T {if(value!==null&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;}
function result<T>(body:()=>T):ProjectValueResult<T> {try{return freeze({ok:true,value:body(),diagnostics:[]});}catch(error){if(error instanceof Refusal)return freeze(error.result);throw error;}}
function capture(value:unknown):JsonValue {
  const captured=take(cloneLive(value,'snapshot',{...DEFAULT_PROJECT_LIMITS,maxSnapshotUtf8Bytes:4194304}));
  const numbers=(v:JsonValue):void=>{if(typeof v==='number'&&(!Number.isFinite(v)||Object.is(v,-0)))fail('Numbers must be finite and cannot be negative zero.');if(v!==null&&typeof v==='object')for(const c of Object.values(v))numbers(c);};numbers(captured);return captured;
}
function object(value:JsonValue|undefined,keys:readonly string[]):JsonObject {if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==keys.length||Object.keys(value).some(k=>!keys.includes(k)))fail('Object fields do not match the content schema.');return value as JsonObject;}
function text(value:JsonValue|undefined):string {if(typeof value!=='string'||value.length===0)fail('A nonempty string is required.');return value;}
function list(value:JsonValue|undefined):readonly JsonValue[] {if(!Array.isArray(value))fail('An array is required.');return value;}
function same(a:unknown,b:unknown):boolean {
  const canonical=(v:unknown):string=>v!==null&&typeof v==='object'?(Array.isArray(v)?'['+v.map(canonical).join(',')+']':'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical((v as Record<string,unknown>)[k])).join(',')+'}'):JSON.stringify(v);
  return canonical(a)===canonical(b);
}
function checkedSnapshot(snapshot:ProjectSnapshot):ProjectSnapshot {return take(parseProjectSnapshot(take(serializeProjectSnapshot(snapshot))));}
function producerValue(value:JsonValue|undefined):JsonObject {const p=object(value,['nodeVersion','pngjsVersion','zlibVersion']);if(p.nodeVersion!=='26.7.0'||p.pngjsVersion!=='7.0.0'||typeof p.zlibVersion!=='string'||!p.zlibVersion.trim())fail('Content producer identity must use Node 26.7.0, pngjs 7.0.0 and a nonempty zlib version.');return p;}
function reserved(options:JsonObject,producer:JsonObject,format:string,kind:string):JsonObject {return {recipeSchemaVersion:1,options,producer,outputFormatVersion:format,referenceFormatVersion:kind==='image'?'rgba8/1':'none'};}
function profile(importer:JsonValue|undefined,format:JsonValue|undefined,settings:JsonValue|undefined):{kind:string;options:JsonObject} {
  const i=object(importer,['id','version']);if(i.version!=='1.0.0')fail('Unsupported content importer version.');
  if(i.id==='egret.png'&&format==='png/1')return {kind:'image',options:object(settings,[])};
  if(i.id==='egret.sequence'&&format==='egret.sequence/1')return {kind:'sequence',options:object(settings,[])};
  if(i.id==='egret.atlas-pages'&&format==='egret.atlas-pages/1')return {kind:'atlas',options:object(settings,[])};
  if(i.id==='egret.aseprite-atlas'&&format==='egret.atlas/1') {const options=object(settings,['pageName']),name=text(options.pageName);if(!isPortablePath(name)||name.includes('/')||!name.endsWith('.png')||name.length>255)fail('Atlas pageName must be a portable PNG basename.');return {kind:'atlas',options};}
  return fail('Unsupported content importer or artifact format.');
}
function existingResource(snapshot:ProjectSnapshot,id:EntityId,kind:string,target:string):void {
  if(snapshot.retiredEntityIds.includes(id))fail('A content resource ID is retired.');
  const old=snapshot.entities.find(e=>e.id===id);
  if(old&&(old.kind!=='egret.resource'||old.dataSchemaVersion!=='1'||old.data.resourceKind!==kind||old.data.targetProfile!==target))fail('An existing entity has a different resource binding.');
}
function describe(snapshot:ProjectSnapshot,recipeData:JsonValue,producer:JsonObject):ResourceBuildPlanDescription {
  const doc=object(recipeData,['format','targetProfile','recipes']);if(doc.format!=='egret.content-build-recipe/1')fail('Unsupported content recipe format.');
  const target=text(doc.targetProfile),recipes=list(doc.recipes);if(recipes.length>4096)fail('Content recipes exceed 4096 entries.');
  const files=new Map(snapshot.files.map(f=>[f.id,f]));
  const entries=recipes.map(raw=>{
    const r=object(raw,['resourceId','sourceFileId','importer','settings','artifactFormatVersion','dependencies','provenance']);
    const p=profile(r.importer,r.artifactFormatVersion,r.settings),id=text(r.resourceId) as EntityId;
    existingResource(snapshot,id,p.kind,target);
    const source=files.get(text(r.sourceFileId) as FileId);if(!source||source.role!=='source')fail('A content recipe requires a current source-role file.');
    const dependencies=list(r.dependencies).map(v=>text(v) as EntityId);
    return {id,resourceKind:p.kind,source,importer:r.importer,settings:reserved(p.options,producer,text(r.artifactFormatVersion),p.kind),artifactFormatVersion:r.artifactFormatVersion,targetProfile:target,dependencies,provenance:r.provenance} as unknown as ResourceBuildSourceEntry;
  });
  const plan=shared(validateResourceBuildPlanDescription({format:'egret.resource-build-plan/1',projectId:snapshot.projectId,targetProfile:target,versions:snapshot.versions,entries}));
  const byId=new Map(plan.entries.map(e=>[e.id,e]));
  for(const e of plan.entries){
    if(e.resourceKind==='image'){if(e.dependencies.length!==0)fail('PNG recipes cannot have dependencies.');}
    else if(e.importer.id==='egret.atlas-pages') {
      if(e.dependencies.length<1||e.dependencies.length>16||e.dependencies.some(id=>byId.get(id)?.resourceKind!=='image'))fail('Multipage atlas recipes need one to sixteen image dependencies.');
    } else {
      const dependency=byId.get(e.dependencies[0]!);
      if(e.dependencies.length!==1||dependency?.resourceKind!==(e.resourceKind==='atlas'?'image':'atlas'))fail('Atlas and sequence recipes need one dependency of their registered kind.');
      if(e.resourceKind==='sequence'&&(dependency.importer.id!=='egret.aseprite-atlas'||e.source.id!==dependency.source.id))fail('A sequence requires its single-page atlas and the same metadata source.');
    }
  }
  return plan;
}
/** Describe finite content recipes without creating artifacts or verifying bytes. */
export function describeContentRecipes(snapshot:ProjectSnapshot,recipeDocument:unknown,producer:ContentProducer):ProjectValueResult<ResourceBuildPlanDescription> {
  return result(()=>describe(checkedSnapshot(snapshot),capture(recipeDocument),producerValue(capture(producer))));
}
function checkedPlan(snapshot:ProjectSnapshot,input:unknown):ResourceBuildPlanDescription {
  const plan=shared(validateResourceBuildPlanDescription(capture(input)));
  if(plan.projectId!==snapshot.projectId||!same(plan.versions,snapshot.versions))fail('The build plan belongs to another project or version set.');
  let producer:JsonObject|undefined;
  const recipes=plan.entries.map(e=>{
    const settings=object(e.settings,['recipeSchemaVersion','options','producer','outputFormatVersion','referenceFormatVersion']);
    const p=producerValue(settings.producer);if(producer&&!same(producer,p))fail('All content recipes must share one producer identity.');producer=p;
    const f=profile(e.importer,e.artifactFormatVersion,settings.options);
    if(e.resourceKind!==f.kind||!same(settings,reserved(f.options,p,e.artifactFormatVersion,f.kind)))fail('Content settings or resource kind disagree with the registered profile.');
    const source=snapshot.files.find(s=>s.id===e.source.id);if(!source||!same(source,e.source))fail('The plan source descriptor no longer matches the captured project.');
    return {resourceId:e.id,sourceFileId:e.source.id,importer:e.importer,settings:f.options,artifactFormatVersion:e.artifactFormatVersion,dependencies:e.dependencies,provenance:e.provenance};
  });
  // Empty plans contain no producer-dependent outputs.
  return describe(snapshot,{format:'egret.content-build-recipe/1',targetProfile:plan.targetProfile,recipes},producer??{nodeVersion:'26.7.0',pngjsVersion:'7.0.0',zlibVersion:'empty'});
}
function prefix(value:string):string {if(typeof value!=='string'||!isPortablePath(value)||!isPortablePath(value+'/generations/'+'a'.repeat(64)+'/manifest.json'))fail('Output prefix must be a bounded portable project-relative path.');return value;}
function byteDescriptor(value:JsonObject):void {if(typeof value.sha256!=='string'||! /^[a-f0-9]{64}$/u.test(value.sha256)||typeof value.byteLength!=='number'||!Number.isSafeInteger(value.byteLength)||value.byteLength<0||Object.is(value.byteLength,-0))fail('Output digest and byte length must be exact bounded descriptors.');}
function placeFile(snapshot:ProjectSnapshot,file:ProjectFile,permitDifferentId:boolean):ProjectFile {
  const old=snapshot.files.find(f=>pathCollisionKey(f.path)===pathCollisionKey(file.path));
  if(old){if(old.path!==file.path||!same({...file,id:old.id},old)||!permitDifferentId&&old.id!==file.id)fail('An output path collides with an incompatible existing file.');return old;}
  if(snapshot.files.some(f=>f.id===file.id)||snapshot.retiredFileIds.includes(file.id))fail('A generated file ID is occupied or retired.');return file;
}
function bind(snapshot:ProjectSnapshot,plan:ResourceBuildPlanDescription,raw:JsonValue,outputPrefix:string):ContentArtifactBinding {
  prefix(outputPrefix);const keys=shared(evaluateResourceBuildKeys(plan));const outputs=list(raw);if(outputs.length!==keys.entries.length)fail('Outputs must cover every selected resource exactly once.');
  const byId=new Map<string,JsonObject>();for(const value of outputs){const out=object(value,['resourceId','buildKey','files']),id=text(out.resourceId);if(byId.has(id))fail('Duplicate content output resource.');byId.set(id,out);}
  let outputBytes=0;
  const files=new Map<string,ProjectFile>(),bound:ContentBoundOutput[]=[],entities:ProjectEntity[]=[];
  const entries=keys.entries.map(e=>{
    const output=byId.get(e.id);if(!output||output.buildKey!==e.buildKey)fail('Output resource or build key does not match the shared evaluated plan.');
    const wanted=e.resourceKind==='image'?{primary:'image/png',rgba:'application/octet-stream'}:{primary:'application/json'};
    const actual=list(output.files);if(actual.length!==Object.keys(wanted).length)fail('The complete registered output set is required.');
    const named=new Map<string,ProjectFile>();
    for(const rawFile of actual){const f=object(rawFile,['name','mediaType','sha256','byteLength']),name=text(f.name);if(named.has(name)||!Object.hasOwn(wanted,name)||f.mediaType!==wanted[name as keyof typeof wanted])fail('Content output role or media type is unsupported.');byteDescriptor(f);outputBytes+=f.byteLength as number;if(outputBytes>134217728)fail('Complete content outputs exceed 128 MiB.');
      const digest=text(f.sha256),candidate={id:('f_content_'+digest) as FileId,path:outputPrefix+'/blobs/sha256/'+digest,role:'asset' as const,mediaType:text(f.mediaType),sha256:digest,byteLength:f.byteLength as number};
      const previous=files.get(digest);if(previous&&!same({...candidate,id:previous.id},previous))fail('One digest has conflicting output descriptors.');
      const file=previous??placeFile(snapshot,candidate,true);files.set(digest,file);named.set(name,file);
    }
    const artifact=named.get('primary')!;
    bound.push({resourceId:e.id,buildKey:e.buildKey,files:[...named].sort(([a],[b])=>a<b?-1:a>b?1:0).map(([name,file])=>({name:name as 'primary'|'rgba',file}))});
    const entity:ProjectEntity={id:e.id,kind:'egret.resource',dataSchemaVersion:'1',name:e.id,data:{resourceKind:e.resourceKind,sourceFileId:e.source.id,artifactFileId:artifact.id,importer:e.importer,settings:e.settings,artifactFormatVersion:e.artifactFormatVersion,targetProfile:e.targetProfile,dependencies:e.dependencies,provenance:e.provenance},references:[{slot:'source',target:'file',id:e.source.id,expectedRole:'source'},{slot:'artifact',target:'file',id:artifact.id,expectedRole:'asset'},...e.dependencies.map((id,i)=>({slot:'dependency:'+i,target:'entity' as const,id,expectedKind:'egret.resource'}))]};entities.push(entity);
    const {buildKey:_,...description}=e;return {...description,artifact};
  });
  const manifest=shared(buildResourceManifest({format:'egret.resource-build/1',projectId:plan.projectId,targetProfile:plan.targetProfile,versions:plan.versions,entries}));
  const sortedFiles=[...files.values()].sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
  const candidate={...snapshot,files:[...snapshot.files.filter(f=>!sortedFiles.some(n=>n.id===f.id)),...sortedFiles],entities:[...snapshot.entities.filter(e=>!entities.some(n=>n.id===e.id)),...entities]};
  take(serializeProjectSnapshot(candidate));
  const binding=freeze({plan,manifest,files:sortedFiles,entities,outputs:bound,outputPrefix});bindings.add(binding);return binding;
}
/** Bind complete declared output descriptors; no filesystem or readiness claim. */
export function bindContentArtifacts(snapshot:ProjectSnapshot,plan:ResourceBuildPlanDescription,outputs:readonly ContentOutput[],outputPrefix:string):ProjectValueResult<ContentArtifactBinding> {
  return result(()=>{const current=checkedSnapshot(snapshot);return bind(current,checkedPlan(current,plan),capture(outputs),outputPrefix);});
}
/** Build and validate one edit transaction; the caller owns the real store commit. */
export function createContentAdoption(snapshot:ProjectSnapshot,binding:ContentArtifactBinding,options:ContentAdoptionOptions):ProjectValueResult<ProjectEditTransaction> {
  return result(()=>{
    if(binding===null||typeof binding!=='object'||!bindings.has(binding))fail('Adoption requires an original immutable content binding.');
    const current=checkedSnapshot(snapshot),opts=object(capture(options),['generationId','manifest','outputPrefix','selectorId','transactionId']);
    const generationId=text(opts.generationId);if(!/^[a-f0-9]{64}$/u.test(generationId))fail('Generation ID must be a SHA-256 descriptor.');
    const outputPrefix=prefix(text(opts.outputPrefix));if(outputPrefix!==binding.outputPrefix)fail('Adoption output prefix differs from its binding.');
    const plan=checkedPlan(current,binding.plan);
    const outputs=binding.outputs.map(o=>({resourceId:o.resourceId,buildKey:o.buildKey,files:o.files.map(f=>({name:f.name,mediaType:f.file.mediaType,sha256:f.file.sha256,byteLength:f.file.byteLength}))}));
    const fresh=bind(current,plan,capture(outputs),outputPrefix);if(!same(binding,fresh))fail('The content binding no longer matches the captured project.');
    const descriptor=object(opts.manifest,['sha256','byteLength']);byteDescriptor(descriptor);if((descriptor.byteLength as number)>4194304)fail('Manifest descriptor exceeds 4 MiB.');
    const manifestFile=placeFile(current,{id:('f_content_manifest_'+generationId) as FileId,path:outputPrefix+'/generations/'+generationId+'/manifest.json',role:'configuration',mediaType:'application/json',sha256:text(descriptor.sha256),byteLength:descriptor.byteLength as number},false);
    const selectorId=text(opts.selectorId) as EntityId,old=current.entities.find(e=>e.id===selectorId);
    // A target has one current selector; immutable older generations live in files and history.
    if(current.entities.some(e=>e.kind==='egret.content-build-generation'&&e.data.targetProfile===plan.targetProfile&&e.id!==selectorId))fail('This target already has a different content generation selector.');
    if(current.retiredEntityIds.includes(selectorId)||fresh.entities.some(e=>e.id===selectorId))fail('Generation selector ID is occupied or retired.');
    if(old){
      if(old.kind!=='egret.content-build-generation'||old.dataSchemaVersion!=='1'||old.data.targetProfile!==plan.targetProfile)fail('Existing selector has a different kind or target.');
      const data=object(old.data,['targetProfile','generationId','manifestFileId','resourceIds']);if(typeof data.generationId!=='string'||!/^[a-f0-9]{64}$/u.test(data.generationId)||data.manifestFileId!=='f_content_manifest_'+data.generationId)fail('Existing selector generation identity disagrees.');const ids=list(data.resourceIds).map(text);if(new Set(ids).size!==ids.length)fail('Existing selector has duplicate resources.');
      const refs=new Map(old.references.map(r=>[r.slot,r]));const m=refs.get('manifest');if(m?.target!=='file'||m.id!==data.manifestFileId||m.expectedRole!=='configuration')fail('Existing selector manifest reference disagrees.');
      for(const [i,id] of ids.entries()){const ref=refs.get('resource:'+i),resource=current.entities.find(e=>e.id===id);if(ref?.target!=='entity'||ref.id!==id||ref.expectedKind!=='egret.resource'||resource?.data.targetProfile!==plan.targetProfile)fail('Existing selector resource reference disagrees.');}
      for(const ref of old.references)if(ref.slot!=='manifest'&&!/^resource:\d+$/u.test(ref.slot)&&!(ref.target==='file'&&ref.expectedRole==='asset'&&/^artifact:\d+$/u.test(ref.slot)))fail('Existing selector has an unsupported reference.');
      if(old.references.filter(r=>r.slot.startsWith('resource:')).length!==ids.length)fail('Existing selector resource coverage disagrees.');
      const assets=old.references.filter(r=>r.slot.startsWith('artifact:'));
      if(new Set(assets.map(r=>r.id)).size!==assets.length)fail('Existing selector repeats an artifact reference.');
      for(let i=0;i<assets.length;i++)if(!refs.has('artifact:'+i))fail('Existing selector artifact slots must be contiguous.');
      for(const id of ids){const resource=current.entities.find(e=>e.id===id)!;if(!assets.some(r=>r.id===resource.data.artifactFileId))fail('Existing selector omits a resource artifact.');}
    }
    const selector:ProjectEntity={id:selectorId,kind:'egret.content-build-generation',dataSchemaVersion:'1',name:'Content generation '+plan.targetProfile,data:{targetProfile:plan.targetProfile,generationId,manifestFileId:manifestFile.id,resourceIds:fresh.entities.map(e=>e.id)},references:[{slot:'manifest',target:'file',id:manifestFile.id,expectedRole:'configuration'},...fresh.entities.map((e,i)=>({slot:'resource:'+i,target:'entity' as const,id:e.id,expectedKind:'egret.resource'})),...fresh.files.map((f,i)=>({slot:'artifact:'+i,target:'file' as const,id:f.id,expectedRole:'asset' as const}))]};
    const files=[...fresh.files,manifestFile],entities=[...fresh.entities,selector];
    const transaction=take(parseProjectTransaction(JSON.stringify({command:'edit',toolProtocolVersion:'1.0',projectId:current.projectId,transactionId:text(opts.transactionId),baseRevision:current.revision,source:{actorId:'egret.content-build',actorKind:'tool',toolId:'egret.content-build',toolVersion:'1.0.0',intent:'Adopt content generation '+generationId+' for '+plan.targetProfile},scope:{entityIds:entities.map(e=>e.id),fileIds:files.map(f=>f.id),metadata:false,roots:false},operations:[...files.map(file=>({op:'putFile',file})),...entities.map(entity=>({op:'putEntity',entity}))]})));
    const probe=take(createProjectStore(current)).commit(transaction);if(probe.status==='rejected')throw new Refusal({ok:false,diagnostics:probe.diagnostics});
    return transaction as ProjectEditTransaction;
  });
}
