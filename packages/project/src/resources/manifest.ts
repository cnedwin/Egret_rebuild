// SPDX-License-Identifier: Apache-2.0
import type { JsonObject, ProjectSnapshot } from '@egret/contracts';
import type { AdmittedResourceManifest, ResourceBuildDescription, ResourceBuildEntry, ResourceManifestResult } from '@egret/contracts/resources';
import { admitResourceManifest, serializeResourceManifest as encodeManifest, validateResourceBuildDescription } from '@egret/contracts/resources';
import type { ProjectDiagnosticCode, ProjectValueResult } from '../public.js';
import { parseProjectSnapshot, serializeProjectSnapshot } from '../api.js';
import { readText } from '../text-input.js';
import { DEFAULT_PROJECT_LIMITS } from '../limits.js';
import { makeDiagnostic } from '../diagnostics.js';

function failure(code:ProjectDiagnosticCode,pointer:string,message:string,details:JsonObject={},phase:'parse'|'schema'='schema'):ProjectValueResult<never>{
  return Object.freeze({ok:false,diagnostics:Object.freeze([makeDiagnostic({code,phase,severity:'error',jsonPointer:pointer,message,details})])});
}
function adapt<T>(result:ResourceManifestResult<T>):ProjectValueResult<T>{
  if(result.ok)return Object.freeze({ok:true,value:result.value,diagnostics:Object.freeze([])});
  const item=result.diagnostics[0];
  const code:ProjectDiagnosticCode=item.code==='RESOURCE_LIMIT_EXCEEDED'?'PROJECT_LIMIT_EXCEEDED':item.code==='RESOURCE_FORMAT_UNSUPPORTED'?'PROJECT_FORMAT_UNSUPPORTED':item.code==='RESOURCE_PATH_INVALID'?'PROJECT_PATH_INVALID':'PROJECT_INPUT_INVALID';
  return failure(code,item.pointer,item.message,{resourceCode:item.code});
}

export function parseResourceManifest(text:string):ProjectValueResult<AdmittedResourceManifest>{
  // UTF-16 length is a constant-time lower bound for the admitted UTF-8 bytes.
  if(typeof text!=='string')return failure('PROJECT_INPUT_INVALID','','Input text must be a string.',{},'parse');
  if(text.length>4194304)return failure('PROJECT_LIMIT_EXCEEDED','','Raw manifest text exceeds its byte limit.',{},'parse');
  const parsed=readText(text,'snapshot',{...DEFAULT_PROJECT_LIMITS,maxSnapshotUtf8Bytes:4194304,maxStringUtf8Bytes:4194304});
  if(!parsed.ok)return parsed;
  // Preserve original numeric-token provenance for exact byte-length integers.
  // A rounded Number cannot establish that the source token was an integer.
  for(const [pointer,token] of parsed.value.numericTokens){
    if(/^\/entries\/\d+\/(?:source|artifact)\/byteLength$/u.test(pointer)&&(!token.integerSafe||token.negativeZero))return failure('PROJECT_LIMIT_EXCEEDED',pointer,'Byte length requires an exact nonnegative safe integer token.');
  }
  return adapt(admitResourceManifest(parsed.value.value));
}
export function serializeResourceManifest(manifest:AdmittedResourceManifest):ProjectValueResult<string>{return adapt(encodeManifest(manifest));}

export function describeResourceBuild(snapshot:ProjectSnapshot,target:string):ProjectValueResult<ResourceBuildDescription>{
  // The existing project boundary performs descriptor-only cloning. Reparse its
  // canonical output instead of treating a frozen structural value as a brand.
  const serialized=serializeProjectSnapshot(snapshot);if(!serialized.ok)return serialized;
  const parsed=parseProjectSnapshot(serialized.value);if(!parsed.ok)return parsed;
  if(typeof target!=='string'||target.length===0)return failure('PROJECT_INPUT_INVALID','/target','An explicit target profile is required.');
  const source=parsed.value;
  const selected:Array<{entity:ProjectSnapshot['entities'][number];index:number}>=[];
  let resourceCount=0;
  // Preserve original indices once and stop at the selected-target bound before
  // constructing file joins or mapping any domain resource records.
  for(let index=0;index<source.entities.length;index++){
    const entity=source.entities[index]!;
    if(entity.kind!=='egret.resource')continue;
    resourceCount++;
    if(entity.data.targetProfile!==target)continue;
    if(selected.length===4096)return failure('PROJECT_LIMIT_EXCEEDED','/entities','Selected resource count exceeds 4096.');
    selected.push({entity,index});
  }
  if(resourceCount>0&&selected.length===0)return failure('PROJECT_REFERENCE_MISSING','/target','The project has no resources for this target.');
  const files=new Map(source.files.map(file=>[file.id,file])),selectedIds=new Set(selected.map(({entity})=>entity.id));
  const entries:ResourceBuildEntry[]=[];
  for(const {entity,index} of selected){
    const pointer='/entities/'+index,data=entity.data;
    if(entity.dataSchemaVersion!=='1')return failure('PROJECT_FORMAT_UNSUPPORTED',pointer+'/dataSchemaVersion','Unsupported resource entity schema.');
    const fields=['resourceKind','sourceFileId','artifactFileId','importer','settings','artifactFormatVersion','targetProfile','dependencies','provenance'];
    if(Object.keys(data).length!==fields.length||Object.keys(data).some(key=>!fields.includes(key)))return failure('PROJECT_INPUT_INVALID',pointer+'/data','Resource entity fields must match the selected schema.');
    if(typeof data.sourceFileId!=='string'||typeof data.artifactFileId!=='string'||!Array.isArray(data.dependencies))return failure('PROJECT_INPUT_INVALID',pointer+'/data','Resource file and dependency identifiers are required.');
    const sourceFile=files.get(data.sourceFileId as typeof source.files[number]['id']),artifact=files.get(data.artifactFileId as typeof source.files[number]['id']);
    if(!sourceFile||!artifact)return failure('PROJECT_REFERENCE_MISSING',pointer+'/data','A declared resource file is missing.');
    if(sourceFile.role!=='source'||artifact.role!=='asset')return failure('PROJECT_REFERENCE_TYPE_MISMATCH',pointer+'/data','Resource file roles disagree.');
    const expected=[{slot:'source',target:'file',id:data.sourceFileId,expectedRole:'source'},{slot:'artifact',target:'file',id:data.artifactFileId,expectedRole:'asset'},...data.dependencies.map((id,index)=>({slot:'dependency:'+index,target:'entity',id,expectedKind:'egret.resource'}))];
    if(entity.references.length!==expected.length)return failure('PROJECT_REFERENCE_TYPE_MISMATCH',pointer+'/references','Resource references must agree exactly with data identifiers.');
    const references=new Map(entity.references.map(reference=>[reference.slot,reference]));
    for(const wanted of expected){
      const actual=references.get(wanted.slot);
      if(!actual||actual.target!==wanted.target||actual.id!==wanted.id||actual.target==='file'&&(!('expectedRole' in wanted)||actual.expectedRole!==wanted.expectedRole)||actual.target==='entity'&&(!('expectedKind' in wanted)||actual.expectedKind!==wanted.expectedKind))return failure('PROJECT_REFERENCE_TYPE_MISMATCH',pointer+'/references','Resource reference role, slot or target disagrees.');
    }
    for(const dependency of data.dependencies)if(typeof dependency!=='string'||!selectedIds.has(dependency as typeof entity.id))return failure('PROJECT_REFERENCE_TYPE_MISMATCH',pointer+'/data/dependencies','A dependency must belong to this resource target.');
    // The shared authority alone validates resource metadata, cycles, bounds and
    // canonical description shape. This adapter adds only project reference joins.
    entries.push({id:entity.id,resourceKind:data.resourceKind,source:sourceFile,artifact,importer:data.importer,settings:data.settings,artifactFormatVersion:data.artifactFormatVersion,targetProfile:data.targetProfile,dependencies:data.dependencies,provenance:data.provenance} as unknown as ResourceBuildEntry);
  }
  return adapt(validateResourceBuildDescription({format:'egret.resource-build/1',projectId:source.projectId,targetProfile:target,versions:source.versions,entries}));
}
