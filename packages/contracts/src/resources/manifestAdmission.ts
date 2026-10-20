// SPDX-License-Identifier: Apache-2.0
import type { JsonObject, JsonValue, ProjectFile, ProjectVersionPins } from '../ProjectFormat.generated.js';
import type { AdmittedResourceManifest, ResourceBuildDescription, ResourceBuildEntry, ResourceManifestEntry, ResourceManifestDiagnosticCode, ResourceManifestIdentityInputs, ResourceManifestResult } from '../ResourceManifest.js';
import { sha256Utf8, utf8ByteLength } from './sha256.js';

const MAX_BYTES=4194304;
type RecordValue={readonly [key:string]:JsonValue};
type Receipt={readonly text:string;readonly inputs:ReadonlyMap<string,ResourceManifestIdentityInputs>};
const admitted=new WeakMap<object,Receipt>();
class Refusal extends Error {
  constructor(readonly code:ResourceManifestDiagnosticCode,readonly pointer:string){super(code);}
}
function fail(code:ResourceManifestDiagnosticCode,pointer:string):never{throw new Refusal(code,pointer);}
const escape=(text:string):string=>text.replaceAll('~','~0').replaceAll('/','~1');
function success<T>(value:T):ResourceManifestResult<T>{return Object.freeze({ok:true,value,diagnostics:Object.freeze([]) as readonly []});}
function rejection(error:unknown):ResourceManifestResult<never>{
  const known=error instanceof Refusal?error:new Refusal(error instanceof RangeError?'RESOURCE_LIMIT_EXCEEDED':'RESOURCE_INPUT_INVALID','');
  const diagnostic=Object.freeze({code:known.code,pointer:known.pointer,message:known.code.replaceAll('_',' ')+'.'});
  return Object.freeze({ok:false,diagnostics:Object.freeze([diagnostic]) as readonly [typeof diagnostic]});
}

// A complete descriptor-only copy precedes semantic work. Accessors never run,
// aliases are copied, and only the active ancestor chain is a JSON cycle.
function capture(input:unknown):JsonValue{
  let bytes=0;const ancestors=new Set<object>();
  const charge=(amount:number,pointer:string):void=>{bytes+=amount;if(bytes>MAX_BYTES)fail('RESOURCE_LIMIT_EXCEEDED',pointer);};
  function copy(value:unknown,pointer:string,depth:number):JsonValue{
    if(depth>32)fail('RESOURCE_LIMIT_EXCEEDED',pointer);
    if(value===null||typeof value==='boolean'||typeof value==='string'||typeof value==='number'){
      if(typeof value==='number'&&!Number.isFinite(value))fail('RESOURCE_INPUT_INVALID',pointer);
      if(typeof value==='string'){if(value.length>MAX_BYTES)fail('RESOURCE_LIMIT_EXCEEDED',pointer);utf8ByteLength(value);}
      charge(utf8ByteLength(JSON.stringify(value)),pointer);return value;
    }
    if(typeof value!=='object'||ancestors.has(value))fail('RESOURCE_INPUT_INVALID',pointer);
    const array=Array.isArray(value),prototype=Object.getPrototypeOf(value);
    if(array?prototype!==Array.prototype:prototype!==Object.prototype&&prototype!==null)fail('RESOURCE_INPUT_INVALID',pointer);
    const keys=Reflect.ownKeys(value);let length=0;
    if(array){const descriptor=Object.getOwnPropertyDescriptor(value,'length');if(!descriptor||!('value' in descriptor)||!Number.isSafeInteger(descriptor.value)||descriptor.value<0)fail('RESOURCE_INPUT_INVALID',pointer);length=descriptor.value as number;if(keys.length!==length+1)fail('RESOURCE_INPUT_INVALID',pointer);}
    const out:JsonValue[]|Record<string,JsonValue>=array?[]:Object.create(null) as Record<string,JsonValue>;
    charge(2,pointer);ancestors.add(value);let index=0;
    for(const key of keys){
      if(array&&key==='length')continue;
      if(typeof key!=='string'||array&&key!==String(index))fail('RESOURCE_INPUT_INVALID',pointer);
      // Refuse raw oversized keys before diagnostic escaping can expand them.
      if(key.length>MAX_BYTES)fail('RESOURCE_LIMIT_EXCEEDED',pointer);
      const child=pointer+'/'+escape(key),descriptor=Object.getOwnPropertyDescriptor(value,key);
      if(!descriptor||!descriptor.enumerable||!('value' in descriptor))fail('RESOURCE_INPUT_INVALID',child);
      if(index++)charge(1,pointer);
      if(!array){utf8ByteLength(key);charge(utf8ByteLength(JSON.stringify(key))+1,child);}
      const copied=copy(descriptor.value,child,depth+1);
      if(Array.isArray(out))out.push(copied);else out[key]=copied;
    }
    ancestors.delete(value);return Object.freeze(out);
  }
  return copy(input,'',1);
}

// JSON.stringify cannot serialize sorted integer-looking object keys. Emit each
// key explicitly after UTF-16 code-unit sorting; never normalize authored Unicode.
function canonical(value:unknown):string{
  if(value===null||typeof value==='string'||typeof value==='boolean'||typeof value==='number')return JSON.stringify(value);
  if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
  const record=value as Record<string,unknown>;
  return '{'+Object.keys(record).sort().map(key=>JSON.stringify(key)+':'+canonical(record[key])).join(',')+'}';
}
function record(value:JsonValue|undefined,pointer:string):RecordValue{
  if(value===null||typeof value!=='object'||Array.isArray(value))fail('RESOURCE_INPUT_INVALID',pointer);return value as RecordValue;
}
function exact(value:JsonValue|undefined,keys:readonly string[],pointer:string):RecordValue{
  const result=record(value,pointer),actual=Object.keys(result);
  if(actual.length!==keys.length||actual.some(key=>!keys.includes(key)))fail('RESOURCE_INPUT_INVALID',pointer);
  return result;
}
function text(value:JsonValue|undefined,pointer:string,maximum=128):string{
  if(typeof value!=='string'||value.length===0||utf8ByteLength(value)>maximum||/[\u0000-\u001f\u007f]/u.test(value))fail('RESOURCE_INPUT_INVALID',pointer);return value;
}
function identity(value:JsonValue|undefined,prefix:string,pointer:string):string{
  const result=text(value,pointer);if(!new RegExp('^'+prefix+'_[A-Za-z0-9][A-Za-z0-9_-]*$','u').test(result))fail('RESOURCE_INPUT_INVALID',pointer);return result;
}
function array(value:JsonValue|undefined,pointer:string):readonly JsonValue[]{if(!Array.isArray(value))fail('RESOURCE_INPUT_INVALID',pointer);return value;}
function digest(value:JsonValue|undefined,pointer:string):string{
  if(typeof value!=='string'||!/^[0-9a-f]{64}$/u.test(value))fail('RESOURCE_INPUT_INVALID',pointer);return value;
}
function portablePath(value:JsonValue|undefined,pointer:string):string{
  const result=text(value,pointer,1024);
  if(/[\\\u0000-\u001f\u007f:*?"<>|%#]/u.test(result)||result.split('/').some(part=>!part||part==='.'||part==='..'||/[ .]$/u.test(part)||/^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/iu.test(part)))fail('RESOURCE_PATH_INVALID',pointer);
  return result;
}
function file(value:JsonValue|undefined,role:'source'|'asset',pointer:string):ProjectFile{
  const item=exact(value,['id','path','role','mediaType','sha256','byteLength'],pointer);
  identity(item.id,'f',pointer+'/id');portablePath(item.path,pointer+'/path');
  if(item.role!==role)fail('RESOURCE_FILE_MISMATCH',pointer+'/role');
  const mediaType=text(item.mediaType,pointer+'/mediaType');if(/[^\u0021-\u007e]/u.test(mediaType))fail('RESOURCE_INPUT_INVALID',pointer+'/mediaType');
  digest(item.sha256,pointer+'/sha256');
  if(typeof item.byteLength!=='number'||!Number.isSafeInteger(item.byteLength)||item.byteLength<0||Object.is(item.byteLength,-0))fail('RESOURCE_INPUT_INVALID',pointer+'/byteLength');
  return item as unknown as ProjectFile;
}

function prepare(input:unknown,claimed:boolean){
  const raw=exact(capture(input),['format','projectId','targetProfile','versions','entries'],'');
  if(raw.format!==(claimed?'egret.resource-manifest/1':'egret.resource-build/1'))fail('RESOURCE_FORMAT_UNSUPPORTED','/format');
  const projectId=identity(raw.projectId,'p','/projectId'),targetProfile=text(raw.targetProfile,'/targetProfile');
  const versionData=exact(raw.versions,['engineVersion','resourceFormatVersion','toolProtocolVersion'],'/versions');
  text(versionData.engineVersion,'/versions/engineVersion');text(versionData.resourceFormatVersion,'/versions/resourceFormatVersion');
  if(versionData.toolProtocolVersion!=='1.0')fail('RESOURCE_FORMAT_UNSUPPORTED','/versions/toolProtocolVersion');
  const versions=versionData as unknown as ProjectVersionPins,entries=array(raw.entries,'/entries');
  if(entries.length>4096)fail('RESOURCE_LIMIT_EXCEEDED','/entries');
  const selected=new Map<string,{entry:ResourceBuildEntry;pointer:string;claimed?:RecordValue}>();
  const fileRecords=new Map<string,string>(),pathOwners=new Map<string,string>();let edges=0;
  const baseKeys=['id','resourceKind','source','artifact','importer','settings','artifactFormatVersion','targetProfile','dependencies','provenance'];
  for(let index=0;index<entries.length;index++){
    const pointer='/entries/'+index,item=exact(entries[index],claimed?[...baseKeys,'buildKey','runtimeIdentity']:baseKeys,pointer);
    const id=identity(item.id,'e',pointer+'/id');if(selected.has(id))fail('RESOURCE_ID_DUPLICATE',pointer+'/id');
    text(item.resourceKind,pointer+'/resourceKind');text(item.artifactFormatVersion,pointer+'/artifactFormatVersion');
    if(text(item.targetProfile,pointer+'/targetProfile')!==targetProfile)fail('RESOURCE_DEPENDENCY_INVALID',pointer+'/targetProfile');
    const importer=exact(item.importer,['id','version'],pointer+'/importer');text(importer.id,pointer+'/importer/id');text(importer.version,pointer+'/importer/version');
    const settings=record(item.settings,pointer+'/settings');record(item.provenance,pointer+'/provenance');
    if(utf8ByteLength(canonical(settings))>65536)fail('RESOURCE_LIMIT_EXCEEDED',pointer+'/settings');
    const dependencies=array(item.dependencies,pointer+'/dependencies'),seen=new Set<string>();
    edges+=dependencies.length;if(edges>8192)fail('RESOURCE_LIMIT_EXCEEDED',pointer+'/dependencies');
    for(let dependency=0;dependency<dependencies.length;dependency++){
      const name=identity(dependencies[dependency],'e',pointer+'/dependencies/'+dependency);
      if(seen.has(name))fail('RESOURCE_DEPENDENCY_INVALID',pointer+'/dependencies/'+dependency);seen.add(name);
    }
    for(const [name,role] of [['source','source'],['artifact','asset']] as const){
      const current=file(item[name],role,pointer+'/'+name),encoded=canonical(current),old=fileRecords.get(current.id);
      if(old!==undefined&&old!==encoded)fail('RESOURCE_FILE_MISMATCH',pointer+'/'+name);
      fileRecords.set(current.id,encoded);
      const pathKey=current.path.normalize('NFC').toLowerCase(),owner=pathOwners.get(pathKey);
      if(owner!==undefined&&owner!==current.id)fail('RESOURCE_FILE_MISMATCH',pointer+'/'+name+'/path');pathOwners.set(pathKey,current.id);
    }
    if(claimed){digest(item.buildKey,pointer+'/buildKey');digest(item.runtimeIdentity,pointer+'/runtimeIdentity');}
    const entry:Object & ResourceBuildEntry=Object.freeze({id:item.id,resourceKind:item.resourceKind,source:item.source,artifact:item.artifact,importer:item.importer,settings:item.settings,artifactFormatVersion:item.artifactFormatVersion,targetProfile:item.targetProfile,dependencies:item.dependencies,provenance:item.provenance}) as unknown as ResourceBuildEntry;
    selected.set(id,claimed?{entry,pointer,claimed:item}:{entry,pointer});
  }
  for(const {entry,pointer} of selected.values())for(const dependency of entry.dependencies)if(!selected.has(dependency))fail('RESOURCE_DEPENDENCY_INVALID',pointer+'/dependencies');
  const heights=new Map<string,number>(),active=new Set<string>(),order:string[]=[];
  function visit(id:string,depth:number):number{
    const node=selected.get(id)!;
    if(depth>32)fail('RESOURCE_LIMIT_EXCEEDED',node.pointer+'/dependencies');
    const prior=heights.get(id);if(prior!==undefined)return prior;
    if(active.has(id))fail('RESOURCE_DEPENDENCY_INVALID',node.pointer+'/dependencies');active.add(id);
    let height=1;for(const dependency of node.entry.dependencies)height=Math.max(height,1+visit(dependency,depth+1));
    // A memoized shallow visit must not hide a deeper incoming path in a DAG.
    if(height>32)fail('RESOURCE_LIMIT_EXCEEDED',node.pointer+'/dependencies');
    heights.set(id,height);active.delete(id);order.push(id);return height;
  }
  const ids=[...selected.keys()].sort();for(const id of ids)visit(id,1);
  return {projectId,targetProfile,versions,selected,ids,order};
}

function evaluate(input:unknown,claimed:boolean):AdmittedResourceManifest{
  const {projectId,targetProfile,versions,selected,ids,order}=prepare(input,claimed);
  const completed=new Map<string,ResourceManifestEntry>(),inputs=new Map<string,ResourceManifestIdentityInputs>();
  for(const id of order){
    const node=selected.get(id)!,entry=node.entry;
    const dependencies=entry.dependencies.map(dependency=>({id:dependency,buildKey:completed.get(dependency)!.buildKey}));
    const build=canonical({format:'egret.resource-build-key/1',resourceKind:entry.resourceKind,importer:entry.importer,settings:entry.settings,artifactFormatVersion:entry.artifactFormatVersion,targetProfile,versions,source:{sha256:entry.source.sha256,byteLength:entry.source.byteLength},dependencies,provenance:entry.provenance});
    const buildKey=sha256Utf8(build);
    const runtime=canonical({format:'egret.resource-identity/1',projectId,id,buildKey,artifact:{sha256:entry.artifact.sha256,byteLength:entry.artifact.byteLength,mediaType:entry.artifact.mediaType},artifactFormatVersion:entry.artifactFormatVersion,targetProfile});
    const runtimeIdentity=sha256Utf8(runtime);
    if(node.claimed&&(node.claimed.buildKey!==buildKey||node.claimed.runtimeIdentity!==runtimeIdentity))fail('RESOURCE_KEY_MISMATCH',node.pointer);
    completed.set(id,Object.freeze({...entry,buildKey,runtimeIdentity}));inputs.set(id,Object.freeze({build,runtime}));
  }
  const manifest=Object.freeze({format:'egret.resource-manifest/1',projectId,targetProfile,versions,entries:Object.freeze(ids.map(id=>completed.get(id)!))}) as AdmittedResourceManifest;
  const encoded=canonical(manifest);if(utf8ByteLength(encoded)>MAX_BYTES)fail('RESOURCE_LIMIT_EXCEEDED','');
  admitted.set(manifest,Object.freeze({text:encoded,inputs}));return manifest;
}

// Description admission shares every schema/graph rule while deliberately doing
// no hashing. Project tools can describe declared metadata without a build claim.
export function validateResourceBuildDescription(input:unknown):ResourceManifestResult<ResourceBuildDescription>{
  try{
    const {projectId,targetProfile,versions,selected,ids}=prepare(input,false);
    const result=Object.freeze({format:'egret.resource-build/1',projectId,targetProfile,versions,entries:Object.freeze(ids.map(id=>selected.get(id)!.entry))}) as ResourceBuildDescription;
    return success(result);
  }catch(error){return rejection(error);}
}
export function buildResourceManifest(description:ResourceBuildDescription):ResourceManifestResult<AdmittedResourceManifest>{try{return success(evaluate(description,false));}catch(error){return rejection(error);}}
export function admitResourceManifest(value:unknown):ResourceManifestResult<AdmittedResourceManifest>{try{return success(evaluate(value,true));}catch(error){return rejection(error);}}
export function isAdmittedResourceManifest(value:unknown):value is AdmittedResourceManifest{return value!==null&&typeof value==='object'&&admitted.has(value);}
export function serializeResourceManifest(manifest:AdmittedResourceManifest):ResourceManifestResult<string>{
  if(!isAdmittedResourceManifest(manifest))return rejection(new Refusal('RESOURCE_INPUT_INVALID',''));return success(admitted.get(manifest)!.text);
}
export function getResourceManifestIdentityInputs(manifest:AdmittedResourceManifest,id:string):ResourceManifestIdentityInputs{
  if(!isAdmittedResourceManifest(manifest))throw new TypeError('A genuine admitted manifest is required.');
  const result=admitted.get(manifest)!.inputs.get(id);if(result===undefined)throw new RangeError('Resource ID is absent from this manifest.');return result;
}
