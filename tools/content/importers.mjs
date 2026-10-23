// SPDX-License-Identifier: Apache-2.0
// Three finite Node producers; source/cache verification remains the runner's authority.
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {types} from 'node:util';
import {createAtlasImportPlan} from '@egret/project/atlas';
import {decodeContentPng} from './png.mjs';
const require=createRequire(import.meta.url);
const PNGJS_VERSION=JSON.parse(readFileSync(require.resolve('pngjs/package.json'),'utf8')).version;
const SOURCE_LIMIT=8388608,ARTIFACT_LIMIT=4194304,WORK_LIMIT=67108864,OUTPUT_LIMIT=134217728;
const signature=[137,80,78,71,13,10,26,10];
const mappings=Object.freeze({
  'egret.png':Object.freeze({kind:'image',format:'png/1',reference:'rgba8/1',dependency:undefined}),
  'egret.aseprite-atlas':Object.freeze({kind:'atlas',format:'egret.atlas/1',reference:'none',dependency:'image'}),
  'egret.sequence':Object.freeze({kind:'sequence',format:'egret.sequence/1',reference:'none',dependency:'atlas'}),
});
function fault(code,message,cause){const error=new Error(message,cause===undefined?undefined:{cause});error.code='CONTENT_IMPORT_'+code;return error;}
function exact(value,keys){
  if(value===null||typeof value!=='object'||Array.isArray(value)||![null,Object.prototype].includes(Object.getPrototypeOf(value)))return false;
  const found=Reflect.ownKeys(value);
  return found.length===keys.length&&found.every(key=>typeof key==='string'&&keys.includes(key)&&Object.hasOwn(Object.getOwnPropertyDescriptor(value,key),'value'));
}
const integer=(value,min,max)=>Number.isSafeInteger(value)&&!Object.is(value,-0)&&value>=min&&value<=max;
const text=value=>typeof value==='string'&&!/\p{Surrogate}/u.test(value);
function canonical(value){
  if(value===null||typeof value!=='object')return JSON.stringify(value);
  if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
  return '{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+canonical(value[key])).join(',')+'}';
}
/** Actual pinned public-package identity, never a caller assertion. */
export function getContentProducer(){
  if(process.versions.node!=='26.7.0'||PNGJS_VERSION!=='7.0.0'||typeof process.versions.zlib!=='string'||!process.versions.zlib)throw fault('PRODUCER','Content producers require actual Node 26.7.0 and installed public pngjs 7.0.0.');
  return Object.freeze({nodeVersion:process.versions.node,pngjsVersion:PNGJS_VERSION,zlibVersion:process.versions.zlib});
}
function admitEntry(entry){
  const actual=getContentProducer();
  if(!entry||!exact(entry.importer,['id','version'])||entry.importer.version!=='1.0.0'||!Object.hasOwn(mappings,entry.importer.id))throw fault('INPUT','Content importer must be one of the three registered 1.0.0 producers.');
  const mapping=mappings[entry.importer.id],settings=entry.settings;
  if(entry.resourceKind!==mapping.kind||entry.artifactFormatVersion!==mapping.format||!exact(settings,['recipeSchemaVersion','options','producer','outputFormatVersion','referenceFormatVersion'])||settings.recipeSchemaVersion!==1||settings.outputFormatVersion!==mapping.format||settings.referenceFormatVersion!==mapping.reference||!exact(settings.producer,['nodeVersion','pngjsVersion','zlibVersion'])||Object.keys(actual).some(key=>settings.producer[key]!==actual[key]))throw fault('INPUT','Content kind, artifact format, settings envelope and actual producer identity must match the selected finite importer.');
  if(mapping.kind==='atlas'?!exact(settings.options,['pageName'])||!text(settings.options.pageName)||!settings.options.pageName:!exact(settings.options,[]))throw fault('INPUT','Only the finite importer options are supported.');
  if(!Array.isArray(entry.dependencies)||entry.dependencies.length!==(mapping.dependency?1:0))throw fault('INPUT','Content importer requires its exact declared dependency count.');
  return mapping;
}
const typedPrototype=Object.getPrototypeOf(Uint8Array.prototype);
const backingGetter=Object.getOwnPropertyDescriptor(typedPrototype,'buffer').get;
const offsetGetter=Object.getOwnPropertyDescriptor(typedPrototype,'byteOffset').get;
const lengthGetter=Object.getOwnPropertyDescriptor(typedPrototype,'byteLength').get;
const backingLengthGetter=Object.getOwnPropertyDescriptor(ArrayBuffer.prototype,'byteLength').get;
const resizableGetter=Object.getOwnPropertyDescriptor(ArrayBuffer.prototype,'resizable').get;
const detachedGetter=Object.getOwnPropertyDescriptor(ArrayBuffer.prototype,'detached').get;
function view(value){
  try{
    if(!types.isUint8Array(value))throw new TypeError('Uint8Array required.');
    const backing=Reflect.apply(backingGetter,value,[]);Reflect.apply(backingLengthGetter,backing,[]);
    if(Reflect.apply(resizableGetter,backing,[])||Reflect.apply(detachedGetter,backing,[]))throw new TypeError('Fixed attached owned bytes required.');
    return Buffer.from(backing,Reflect.apply(offsetGetter,value,[]),Reflect.apply(lengthGetter,value,[]));
  }catch(cause){throw fault('INPUT','Content bytes must be a Uint8Array over a fixed attached ArrayBuffer.',cause);}
}
function header(bytes){
  if(bytes.length<33||signature.some((n,i)=>bytes[i]!==n)||bytes.readUInt32BE(8)!==13||![73,72,68,82].every((value,index)=>bytes[12+index]===value))return undefined;
  const width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20),color=bytes[25];
  if(!width||!height||bytes[24]!==8||![2,6].includes(color)||bytes[26]!==0||bytes[27]!==0||bytes[28]!==0)return undefined;
  if(width>4096||height>4096||width*height>1048576)throw fault('LIMIT','PNG exceeds the admitted 4096 edge or 1048576 pixel bound.');
  return {width,height,scanlineBytes:height*(1+width*(color===2?3:4)),rgbaBytes:width*height*4};
}
function dependencyFor(entry,dependencies,mapping){
  if(!Array.isArray(dependencies)||dependencies.length!==entry.dependencies.length)throw fault('INPUT','Dependency records must exactly match the admitted ordered dependencies.');
  if(!mapping.dependency)return undefined;
  const dependency=dependencies[0];
  if(!exact(dependency,['entry','outputs'])||dependency.entry?.id!==entry.dependencies[0]||admitEntry(dependency.entry).kind!==mapping.dependency||!Array.isArray(dependency.outputs))throw fault('INPUT','Dependency identity, kind and ordinal must match the admitted entry.');
  const outputs=dependency.outputs,roles=mapping.dependency==='image'?['primary','rgba']:['primary'];
  if(outputs.length!==roles.length||roles.some(name=>outputs.filter(o=>o?.name===name).length!==1))throw fault('INPUT','Dependency must supply its exact intrinsic output roles.');
  for(const output of outputs){
    const expected=output.name==='rgba'?'application/octet-stream':mapping.dependency==='image'?'image/png':'application/json';
    if(!exact(output,['name','mediaType','bytes'])||output.mediaType!==expected)throw fault('INPUT','Dependency output media type or shape is invalid.');
    view(output.bytes);
  }
  return dependency;
}
function provenance(value){
  if(!value||!['origin','license','notice'].every(key=>text(value[key])))throw fault('PROFILE','Atlas metadata and page require actual origin, license and notice provenance strings.');
  return {origin:value.origin,license:value.license,notice:value.notice,...(value.sha256===undefined?{}:{sha256:value.sha256})};
}
function decodeText(bytes){
  if(bytes.length>ARTIFACT_LIMIT)throw fault('LIMIT','Atlas metadata and intrinsic artifacts are limited to 4 MiB.');
  try{return new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes);}catch(cause){throw fault('PROFILE','Metadata requires valid UTF-8 text.',cause);}
}
function artifact(value,remainingOutputBytes){
  const bytes=Buffer.from(canonical(value),'utf8');
  if(bytes.length>ARTIFACT_LIMIT||bytes.length>remainingOutputBytes)throw fault('LIMIT','Canonical content artifact exceeds its 4 MiB or remaining output budget.');
  return {outputs:[{name:'primary',mediaType:'application/json',bytes}],scanlineBytes:0};
}
function validLayout(layout,width,height){return exact(layout,['sourceWidth','sourceHeight','trimX','trimY','packedRotation'])&&integer(layout.sourceWidth,1,65535)&&integer(layout.sourceHeight,1,65535)&&integer(layout.trimX,0,65535)&&integer(layout.trimY,0,65535)&&layout.trimX+width<=layout.sourceWidth&&layout.trimY+height<=layout.sourceHeight&&layout.packedRotation===0;}
function validFrame(frame,width,height,sequence){
  return exact(frame,sequence?['x','y','width','height','durationSeconds','layout']:['name','x','y','width','height','layout'])&&integer(frame.x,0,width)&&integer(frame.y,0,height)&&integer(frame.width,1,width)&&integer(frame.height,1,height)&&frame.x+frame.width<=width&&frame.y+frame.height<=height&&validLayout(frame.layout,frame.width,frame.height);
}
function parseAtlas(bytes){
  let value,source;
  try{source=decodeText(bytes);value=JSON.parse(source);}catch(cause){if(cause?.code==='CONTENT_IMPORT_LIMIT')throw cause;throw fault('PROFILE','Atlas dependency must contain canonical egret.atlas/1 JSON.',cause);}
  const invalid=()=>{throw fault('PROFILE','Atlas dependency must contain the exact bounded normalized atlas and sequence schema.');};
  if(!exact(value,['format','pageDependency','width','height','frames','sequenceInput'])||value.format!=='egret.atlas/1'||value.pageDependency!==0||!integer(value.width,1,4096)||!integer(value.height,1,4096)||value.width*value.height>1048576||!Array.isArray(value.frames)||!integer(value.frames.length,1,1024)||!exact(value.sequenceInput,['atlasWidth','atlasHeight','frames'])||value.sequenceInput.atlasWidth!==value.width||value.sequenceInput.atlasHeight!==value.height||!Array.isArray(value.sequenceInput.frames)||value.sequenceInput.frames.length!==value.frames.length)invalid();
  const names=new Set();let nameUnits=0,total=0;const first=value.frames[0]?.layout;
  for(let index=0;index<value.frames.length;index++){
    const frame=value.frames[index],sequence=value.sequenceInput.frames[index];
    if(!validFrame(frame,value.width,value.height,false)||!validFrame(sequence,value.width,value.height,true)||!text(frame.name)||!frame.name||frame.name.length>128||Buffer.byteLength(frame.name)>1024||names.has(frame.name))invalid();
    names.add(frame.name);nameUnits+=frame.name.length;if(nameUnits>32768)invalid();
    if(frame.layout.sourceWidth!==first.sourceWidth||frame.layout.sourceHeight!==first.sourceHeight||['x','y','width','height'].some(key=>frame[key]!==sequence[key])||canonical(frame.layout)!==canonical(sequence.layout))invalid();
    const duration=sequence.durationSeconds,milliseconds=Math.round(duration*1000),next=total+duration;
    if(typeof duration!=='number'||!Number.isFinite(duration)||!integer(milliseconds,1,65535)||duration!==milliseconds/1000||!Number.isFinite(next)||next<=total)invalid();
    total=next;
  }
  if(canonical(value)!==source)invalid();
  return value;
}
/** Synchronous owned intrinsic bytes; PNG work charges both bounded decompressions. */
export function buildContentResource(entry,sourceBytes,dependencies,{remainingScanlineBytes=WORK_LIMIT,remainingOutputBytes=OUTPUT_LIMIT}={}){
  const mapping=admitEntry(entry),source=view(sourceBytes);
  if(!integer(remainingScanlineBytes,0,WORK_LIMIT)||!integer(remainingOutputBytes,0,OUTPUT_LIMIT))throw fault('LIMIT','Remaining content work/output budgets must be bounded nonnegative safe integers.');
  const dependency=dependencyFor(entry,dependencies,mapping);
  if(mapping.kind==='image'){
    if(source.length>SOURCE_LIMIT)throw fault('LIMIT','PNG encoded source exceeds 8 MiB.');
    const reserved=header(source);
    if(reserved&&(2*reserved.scanlineBytes>remainingScanlineBytes||source.length+reserved.rgbaBytes>remainingOutputBytes))throw fault('LIMIT','PNG two-pass scanline work or complete primary/RGBA output exceeds the remaining budget.');
    const decoded=decodeContentPng(source),work=2*decoded.scanlineBytes;
    if(work>remainingScanlineBytes||source.length+decoded.rgba.length>remainingOutputBytes)throw fault('LIMIT','PNG decoded work or output exceeds the remaining budget.');
    return {outputs:[{name:'primary',mediaType:'image/png',bytes:new Uint8Array(source)},{name:'rgba',mediaType:'application/octet-stream',bytes:decoded.rgba}],scanlineBytes:work};
  }
  if(source.length>ARTIFACT_LIMIT)throw fault('LIMIT','Atlas and sequence metadata sources are limited to 4 MiB.');
  if(mapping.kind==='atlas'){
    const primary=view(dependency.outputs.find(o=>o.name==='primary').bytes),rgba=view(dependency.outputs.find(o=>o.name==='rgba').bytes),dimensions=header(primary);
    if(primary.length>SOURCE_LIMIT||!dimensions||rgba.length!==dimensions.rgbaBytes)throw fault('INPUT','Image dependency must contain a bounded PNG header and exact owned RGBA reference length.');
    const result=createAtlasImportPlan({profile:'aseprite-json-array-1.3.18.6-v1',source:{id:'metadata',text:decodeText(source),provenance:provenance(entry.provenance)},page:{pageName:entry.settings.options.pageName,assetId:'page0',width:dimensions.width,height:dimensions.height,provenance:provenance(dependency.entry.provenance)}});
    if(!result.ok)throw fault('PROFILE','Atlas metadata was refused by the supported Aseprite planner: '+result.diagnostics[0].code,result);
    return artifact({format:'egret.atlas/1',pageDependency:0,width:dimensions.width,height:dimensions.height,frames:result.value.spriteSheetFrames,sequenceInput:result.value.sequenceInput},remainingOutputBytes);
  }
  if(!entry.source||!dependency.entry.source||entry.source.id!==dependency.entry.source.id||entry.source.sha256!==dependency.entry.source.sha256||entry.source.byteLength!==dependency.entry.source.byteLength)throw fault('INPUT','Sequence and atlas must reference the same verified metadata source identity and digest.');
  const atlas=parseAtlas(view(dependency.outputs[0].bytes));
  return artifact({format:'egret.sequence/1',atlasDependency:0,sequenceInput:atlas.sequenceInput},remainingOutputBytes);
}
