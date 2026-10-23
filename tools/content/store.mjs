// SPDX-License-Identifier: Apache-2.0
// Cooperative exclusive writers; immutable publication is not power-loss durability.
import {openSync,closeSync,readSync,writeFileSync,fstatSync,lstatSync,readdirSync,realpathSync,mkdirSync,linkSync,unlinkSync,renameSync,rmdirSync} from 'node:fs';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {types} from 'node:util';
import {logicalPath,ownerRelativePath,samePhysicalPath} from '../lib/file-identity.mjs';

const BLOB_LIMIT=8388608, METADATA_LIMIT=4194304, RECORD_LIMIT=8192;
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const sameFile=(a,b)=>a.dev===b.dev&&a.ino===b.ino;
function fail(code,message){const error=new Error(message);error.code=code;throw error;}
const invalid=message=>fail('CONTENT_STORE_INPUT',message);
const integrity=message=>fail('CONTENT_STORE_INTEGRITY',message);
function canonical(value){
  if(value===null||typeof value!=='object')return JSON.stringify(value);
  if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
  return '{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+canonical(value[key])).join(',')+'}';
}
// Descriptor-only capture rejects getters, sparse arrays, cycles and exotic values.
function capture(input,limit=METADATA_LIMIT){
  let budget=0;const active=new Set();
  const charge=count=>{budget+=count;if(budget>limit)invalid('Metadata exceeds its byte bound.');};
  function copy(value,depth){
    if(depth>12)invalid('Metadata nesting exceeds its bound.');
    if(value===null||typeof value==='boolean'||typeof value==='number'||typeof value==='string'){
      if(typeof value==='number'&&(!Number.isFinite(value)||Object.is(value,-0)))invalid('Finite metadata numbers required.');
      if(typeof value==='string'&&(value.length>limit||/\p{Surrogate}/u.test(value)))invalid('Well-formed bounded metadata text required.');
      charge(Buffer.byteLength(JSON.stringify(value)));return value;
    }
    if(typeof value!=='object'||active.has(value))invalid('Plain acyclic metadata required.');
    const array=Array.isArray(value),prototype=Object.getPrototypeOf(value);
    if(array?prototype!==Array.prototype:prototype!==Object.prototype&&prototype!==null)invalid('Plain metadata required.');
    const keys=Reflect.ownKeys(value);let length=0;
    if(array){length=Object.getOwnPropertyDescriptor(value,'length').value;if(length>4096||keys.length!==length+1)invalid('Dense bounded metadata array required.');}
    const out=array?[]:Object.create(null);active.add(value);charge(2);let index=0;
    for(const key of keys){
      if(array&&key==='length')continue;
      if(typeof key!=='string'||array&&key!==String(index)||key.length>limit||/\p{Surrogate}/u.test(key))invalid('Canonical metadata keys required.');
      const property=Object.getOwnPropertyDescriptor(value,key);if(!property.enumerable||!('value' in property))invalid('Metadata accessors are refused.');
      if(index++)charge(1);if(!array)charge(Buffer.byteLength(JSON.stringify(key))+1);
      const child=copy(property.value,depth+1);if(array)out.push(child);else out[key]=child;
    }
    active.delete(value);return out;
  }
  return copy(input,1);
}
function exact(value,keys){if(value===null||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==keys.length||Object.keys(value).some(key=>!keys.includes(key)))invalid('Exact metadata fields required.');return value;}
function sha(value){if(typeof value!=='string'||!/^[a-f0-9]{64}$/.test(value))invalid('Lowercase SHA-256 required.');return value;}
function text(value,maximum=128){if(typeof value!=='string'||!value||Buffer.byteLength(value)>maximum||/[\x00-\x1f\x7f]/.test(value))invalid('Bounded metadata text required.');return value;}
function blobDescription(input,limit=BLOB_LIMIT){
  const value=exact(input,['sha256','byteLength']);sha(value.sha256);
  if(!Number.isSafeInteger(value.byteLength)||value.byteLength<0||value.byteLength>limit)invalid('Blob length exceeds its bound.');return value;
}
function outputsDescription(input){
  if(!Array.isArray(input)||input.length<1||input.length>2)invalid('One primary and at most one RGBA output required.');
  let previous='';
  for(const item of input){
    exact(item,['name','mediaType','sha256','byteLength']);
    if(!['primary','rgba'].includes(item.name)||item.name<=previous)invalid('Unique sorted output roles required.');previous=item.name;
    text(item.mediaType,127);if(!/^[a-zA-Z0-9!#$&^_.+-]+\/[a-zA-Z0-9!#$&^_.+-]+$/.test(item.mediaType))invalid('A finite MIME type required.');
    blobDescription({sha256:item.sha256,byteLength:item.byteLength});
  }
  if(input[0].name!=='primary')invalid('Primary output required.');return input;
}
function generationDescription(value){
  exact(value,['format','manifest','outputs']);if(value.format!=='egret.content-generation/1')invalid('Generation format refused.');
  blobDescription(value.manifest,METADATA_LIMIT);
  if(!Array.isArray(value.outputs)||value.outputs.length>4096)invalid('Bounded generation outputs required.');
  let previous='';for(const resource of value.outputs){exact(resource,['resourceId','buildKey','files']);text(resource.resourceId);if(!/^e_[A-Za-z0-9][A-Za-z0-9_-]*$/.test(resource.resourceId))invalid('Admitted resource ID required.');sha(resource.buildKey);if(resource.resourceId<=previous)invalid('Unique sorted resource IDs required.');previous=resource.resourceId;outputsDescription(resource.files);}return value;
}
const typedPrototype=Object.getPrototypeOf(Uint8Array.prototype);
const viewBuffer=Object.getOwnPropertyDescriptor(typedPrototype,'buffer').get;
const viewOffset=Object.getOwnPropertyDescriptor(typedPrototype,'byteOffset').get;
const viewLength=Object.getOwnPropertyDescriptor(typedPrototype,'byteLength').get;
const bufferResizable=Object.getOwnPropertyDescriptor(ArrayBuffer.prototype,'resizable').get;
const bufferDetached=Object.getOwnPropertyDescriptor(ArrayBuffer.prototype,'detached').get;
function ownedBytes(input,maximum){
  // Intrinsic accessors bypass shadow properties; unstable/shared stores cannot
  // define an immutable content identity. Copy only the checked actual view.
  try{
    if(!types.isUint8Array(input))invalid('Bounded Uint8Array bytes required.');
    const backing=Reflect.apply(viewBuffer,input,[]);
    if(Reflect.apply(bufferResizable,backing,[])||Reflect.apply(bufferDetached,backing,[]))invalid('Fixed attached bytes required.');
    const length=Reflect.apply(viewLength,input,[]),offset=Reflect.apply(viewOffset,input,[]);
    if(length>maximum)invalid('Bounded Uint8Array bytes required.');
    return Buffer.from(new Uint8Array(backing,offset,length));
  }catch{invalid('Bounded fixed attached Uint8Array bytes required.');}
}
function ownerDirectory(root){
  if(typeof root!=='string'||!path.isAbsolute(root)||root!==path.normalize(root)||root!==path.resolve(root))invalid('An existing canonical absolute owner is required.');
  let current=path.parse(root).root;
  for(const component of root.slice(current.length).split(path.sep).filter(Boolean)){
    if(!readdirSync(current).includes(component))invalid('Owner spelling differs from its physical identity.');
    current=path.join(current,component);const state=lstatSync(current);
    if(state.isSymbolicLink()||!state.isDirectory()||!samePhysicalPath(current,realpathSync(current)))invalid('Owner components must be canonical physical directories.');
  }
  const state=lstatSync(root);if(!state.isDirectory()||state.isSymbolicLink()||!samePhysicalPath(root,realpathSync(root)))invalid('Canonical physical owner required.');return state;
}

export function openContentStore(root){
  const owner=ownerDirectory(root),lockRelative='.content-writer.lock',token=randomUUID();
  let closed=false,lockHandle,lockIdentity,stageCounter=0;
  function checkOwner(){const current=ownerDirectory(root);if(!sameFile(current,owner))integrity('Store owner identity changed.');}
  function locate(relative,{directory=false,missing=false,create=false}={}){
    logicalPath(relative);const parts=relative.split('/');let current=root;
    for(let index=0;index<parts.length;index++){
      const component=parts[index],last=index===parts.length-1,entries=readdirSync(current);
      const found=entries.includes(component),alias=entries.some(name=>process.platform==='win32'?name.toLowerCase()===component.toLowerCase():name===component);
      if(!found){
        if(alias)integrity('Store path has another spelling.');
        if(create&&(!last||directory)){mkdirSync(path.join(current,component));}
        else if(missing)return null;else integrity('Required store path is missing: '+relative);
      }
      current=path.join(current,component);const stat=lstatSync(current);
      if(stat.isSymbolicLink()||(last&&!directory?!stat.isFile():!stat.isDirectory())||!samePhysicalPath(current,realpathSync(current)))integrity('Noncanonical store path: '+relative);
      ownerRelativePath(root,current);
      if(last)return {absolute:current,stat};
    }
  }
  function active(){if(closed)fail('CONTENT_STORE_CLOSED','Content store session is closed.');checkOwner();const named=locate(lockRelative,{missing:true});if(!named||!sameFile(named.stat,lockIdentity))integrity('Exclusive store lock identity changed.');}
  function readFile(relative,maximum,expected){
    const named=locate(relative,{missing:true});if(!named)return null;
    const handle=openSync(named.absolute,'r');try{
      const initial=fstatSync(handle);if(!initial.isFile()||!sameFile(initial,named.stat)||!Number.isSafeInteger(initial.size)||initial.size<0||initial.size>maximum||expected!==undefined&&initial.size!==expected)integrity('Stored file length or identity refused: '+relative);
      const bytes=Buffer.allocUnsafe(initial.size),chunk=Buffer.allocUnsafe(65536);let offset=0;
      while(offset<bytes.length){const count=readSync(handle,chunk,0,Math.min(chunk.length,bytes.length-offset),offset);if(count<=0)integrity('Stored file became short.');bytes.set(chunk.subarray(0,count),offset);offset+=count;}
      if(readSync(handle,chunk,0,1,offset)!==0)integrity('Stored file grew while reading.');
      const final=fstatSync(handle),current=locate(relative);
      if(!sameFile(initial,final)||!sameFile(final,current.stat)||final.size!==initial.size||final.mtimeMs!==initial.mtimeMs||final.ctimeMs!==initial.ctimeMs)integrity('Stored file changed while reading.');return bytes;
    }finally{closeSync(handle);}
  }
  function readMetadata(relative,maximum){
    const bytes=readFile(relative,maximum);if(bytes===null)return null;
    try{const textValue=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes),value=capture(JSON.parse(textValue),maximum);if(canonical(value)!==textValue)integrity('Stored metadata is not exact canonical JSON.');return {bytes,value};}catch(error){if(error.code==='CONTENT_STORE_INTEGRITY')throw error;integrity('Stored metadata is malformed: '+relative);}
  }
  function blobDescriptor(input){
    const value=capture(input,RECORD_LIMIT),keys=Object.keys(value);
    if(keys.includes('name')){outputsDescription(value.name==='primary'?[value]:[{name:'primary',mediaType:value.mediaType,sha256:value.sha256,byteLength:value.byteLength},value]);}
    else if(keys.includes('path')){exact(value,['sha256','byteLength','path']);if(value.path!=='blobs/sha256/'+value.sha256)invalid('Blob path differs from its digest.');}
    else exact(value,['sha256','byteLength']);
    return blobDescription({sha256:value.sha256,byteLength:value.byteLength});
  }
  function blobRead(description){const relative='blobs/sha256/'+description.sha256,bytes=readFile(relative,BLOB_LIMIT,description.byteLength);if(bytes!==null&&digest(bytes)!==description.sha256)integrity('Stored blob SHA-256 mismatch: '+relative);return bytes;}
  function complete(outputs,required){let complete=true;for(const output of outputs){const bytes=blobRead(output);if(bytes===null){complete=false;if(required)integrity('Required generation/cache blob is missing.');}}return complete;}
  const staging='.staging/session-'+token;
  function stageFile(relative,bytes){
    const filename=path.join(root,relative);logicalPath(relative);locate(path.posix.dirname(relative),{directory:true});
    const handle=openSync(filename,'wx');try{writeFileSync(handle,bytes);}finally{closeSync(handle);}
    const verified=readFile(relative,bytes.length,bytes.length);if(!verified||!verified.equals(bytes))integrity('Staged bytes failed verification.');return filename;
  }
  function publishFile(relative,bytes){
    const temporary=staging+'/file-'+(++stageCounter),filename=stageFile(temporary,bytes);let published=false;
    try{locate(path.posix.dirname(relative),{directory:true});if(locate(relative,{missing:true}))return false;linkSync(filename,path.join(root,relative));published=true;return true;}
    catch(error){if(error.code==='EEXIST')return false;throw error;}
    finally{if(published){const own=locate(temporary);unlinkSync(own.absolute);}}
  }
  try{
    // The lock file is exclusively created, never stolen, aged or repaired.
    if(readdirSync(root).some(name=>process.platform==='win32'?name.toLowerCase()===lockRelative:name===lockRelative))fail('CONTENT_STORE_LOCKED','Content store already has an exclusive writer lock.');
    try{lockHandle=openSync(path.join(root,lockRelative),'wx');}catch(error){if(error.code==='EEXIST')fail('CONTENT_STORE_LOCKED','Content store already has an exclusive writer lock.');throw error;}
    writeFileSync(lockHandle,token);lockIdentity=fstatSync(lockHandle);
    for(const relative of ['blobs/sha256','records','generations',staging])locate(relative,{directory:true,create:true});
  }catch(error){if(lockHandle!==undefined){closeSync(lockHandle);try{const stat=lstatSync(path.join(root,lockRelative));if(lockIdentity&&sameFile(stat,lockIdentity))unlinkSync(path.join(root,lockRelative));}catch{}}throw error;}
  function readGenerationInternal(id){
    const relative='generations/'+sha(id),directory=locate(relative,{directory:true,missing:true});if(directory===null)return null;
    const entries=readdirSync(directory.absolute).sort();if(entries.length!==2||entries[0]!=='descriptor.json'||entries[1]!=='manifest.json')integrity('Generation is partial or has unexpected files.');
    const metadata=readMetadata(relative+'/descriptor.json',METADATA_LIMIT);let descriptor;
    try{descriptor=generationDescription(metadata.value);}catch{integrity('Stored generation descriptor is invalid.');}
    if(digest(metadata.bytes)!==id)integrity('Generation ID differs from its descriptor.');
    const manifestBytes=readFile(relative+'/manifest.json',METADATA_LIMIT,descriptor.manifest.byteLength);
    if(!manifestBytes||digest(manifestBytes)!==descriptor.manifest.sha256)integrity('Generation manifest bytes differ from its description.');
    for(const resource of descriptor.outputs)complete(resource.files,true);
    return {id,path:relative+'/manifest.json',descriptor:JSON.parse(canonical(descriptor)),descriptorBytes:new Uint8Array(metadata.bytes),manifestBytes:new Uint8Array(manifestBytes)};
  }
  function validateRecord(record,buildKey){
    try{exact(record.value,['format','buildKey','outputs']);if(record.value.format!=='egret.content-cache/1'||record.value.buildKey!==buildKey)invalid('Cache record identity mismatch.');outputsDescription(record.value.outputs);}catch{integrity('Stored cache record is invalid.');}
  }
  return Object.freeze({
    readBlob(input){active();const bytes=blobRead(blobDescriptor(input));return bytes===null?null:new Uint8Array(bytes);},
    putBlob(input){active();const bytes=ownedBytes(input,BLOB_LIMIT),description={sha256:digest(bytes),byteLength:bytes.length},relative='blobs/sha256/'+description.sha256;
      if(blobRead(description)===null){publishFile(relative,bytes);if(blobRead(description)===null)integrity('Published blob is absent.');}return {...description,path:relative};},
    readRecord(buildKey){active();sha(buildKey);const record=readMetadata('records/'+buildKey+'.json',RECORD_LIMIT);if(record===null)return null;
      validateRecord(record,buildKey);
      return {outputs:JSON.parse(canonical(record.value.outputs)),complete:complete(record.value.outputs,false)};},
    // Caller publishes records only after its complete ready generation exists.
    publishRecord(buildKey,input){active();sha(buildKey);const outputs=outputsDescription(capture(input,RECORD_LIMIT)),bytes=Buffer.from(canonical({format:'egret.content-cache/1',buildKey,outputs}));
      const relative='records/'+buildKey+'.json',existing=readMetadata(relative,RECORD_LIMIT);
      if(existing){validateRecord(existing,buildKey);complete(existing.value.outputs,false);}
      if(existing&&!existing.bytes.equals(bytes))fail('CONTENT_CACHE_DETERMINISM','An existing build key has different complete output descriptions.');
      complete(outputs,true);if(!existing){publishFile(relative,bytes);const written=readMetadata(relative,RECORD_LIMIT);if(!written||!written.bytes.equals(bytes))integrity('Published cache record differs.');}},
    publishGeneration(input,manifestInput){active();const descriptor=generationDescription(capture(input)),descriptorBytes=Buffer.from(canonical(descriptor)),manifestBytes=ownedBytes(manifestInput,METADATA_LIMIT);
      if(descriptorBytes.length>METADATA_LIMIT)invalid('Generation descriptor exceeds its byte bound.');
      if(manifestBytes.length!==descriptor.manifest.byteLength||digest(manifestBytes)!==descriptor.manifest.sha256)integrity('Manifest does not match its descriptor.');
      for(const resource of descriptor.outputs)complete(resource.files,true);
      const id=digest(descriptorBytes),existing=readGenerationInternal(id);
      if(existing){if(!Buffer.from(existing.descriptorBytes).equals(descriptorBytes)||!Buffer.from(existing.manifestBytes).equals(manifestBytes))integrity('Existing generation differs.');return {id,path:existing.path,descriptorBytes:existing.descriptorBytes,manifestBytes:existing.manifestBytes};}
      const temporary=staging+'/generation-'+(++stageCounter);locate(temporary,{directory:true,create:true});
      stageFile(temporary+'/descriptor.json',descriptorBytes);stageFile(temporary+'/manifest.json',manifestBytes);
      // This same-volume rename exposes a complete directory to cooperative readers.
      // Malicious external filesystem races are outside this writer-lock protocol.
      if(locate('generations/'+id,{directory:true,missing:true}))integrity('Generation appeared during publication.');
      renameSync(path.join(root,temporary),path.join(root,'generations',id));const ready=readGenerationInternal(id);
      return {id,path:ready.path,descriptorBytes:ready.descriptorBytes,manifestBytes:ready.manifestBytes};},
    readGeneration(id){active();return readGenerationInternal(id);},
    close(){if(closed)return;closed=true;closeSync(lockHandle);try{checkOwner();const named=locate(lockRelative,{missing:true});if(named&&sameFile(named.stat,lockIdentity)){const bytes=readFile(lockRelative,128);if(bytes?.toString('utf8')===token)unlinkSync(named.absolute);}}catch{}
      // Only remove this session's verified empty staging directory. Failed work remains.
      try{checkOwner();const named=locate(staging,{directory:true,missing:true});if(named&&readdirSync(named.absolute).length===0)rmdirSync(named.absolute);}catch{}}
  });
}
