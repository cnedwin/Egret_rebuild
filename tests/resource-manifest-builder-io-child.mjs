// SPDX-License-Identifier: Apache-2.0
// Dedicated tool-I/O UNIT child, never a product SDK/private-module observer.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {syncBuiltinESMExports} from 'node:module';

const configPath=path.resolve(process.argv[2]);
const config=JSON.parse(fs.readFileSync(configPath,'utf8'));
const owner=fs.realpathSync(path.dirname(configPath));
assert.equal(config.root,owner);
const names=['readFileSync','readSync','openSync','closeSync','fstatSync'];
const descriptors=new Map(names.map(name=>[name,Object.getOwnPropertyDescriptor(fs,name)]));
const original=Object.fromEntries(names.map(name=>[name,descriptors.get(name).value]));
const labels=new Map();
for(const label of ['project','source','artifact']){
 const input=path.resolve(config[label]);
 assert.equal(fs.realpathSync(input),input);assert.ok(path.relative(owner,input)&&!path.relative(owner,input).startsWith('..')&&!path.isAbsolute(path.relative(owner,input)));
 labels.set(input,label);
}
const trace={format:'egret.resource-builder-io-unit/1',files:Object.fromEntries([...labels.values()].map(label=>[label,{wholeReads:0,opens:0,closes:0,stats:0,reads:0,positiveReads:0,eofReads:0,bytesRead:0,maxRequest:0,maxBuffer:0,readBeforeStat:0}])),restored:false,openHandles:[],mutationApplied:false};
const handles=new Map();
const fromPath=value=>typeof value==='string'?labels.get(path.resolve(value)):value instanceof URL?labels.get(fileURLToPath(value)):undefined;
const fromInput=value=>typeof value==='number'?handles.get(value)?.label:fromPath(value);
function replace(name,value){Object.defineProperty(fs,name,{...descriptors.get(name),value});}
function requested(args){
 const buffer=args[1];
 if(ArrayBuffer.isView(buffer)){
  const options=args[2];
  const length=typeof options==='number'?args[3]:options?.length??buffer.byteLength;
  return {length,buffer:buffer.byteLength};
 }
 const options=buffer??{};return {length:options.length??options.buffer?.byteLength??16384,buffer:options.buffer?.byteLength??16384};
}
try{
 replace('readFileSync',function(...args){const label=fromInput(args[0]);if(label)trace.files[label].wholeReads++;return Reflect.apply(original.readFileSync,this,args);});
 replace('openSync',function(...args){const fd=Reflect.apply(original.openSync,this,args),label=fromPath(args[0]);if(label){handles.set(fd,{label,stat:false});trace.files[label].opens++;}return fd;});
 replace('closeSync',function(...args){const state=handles.get(args[0]);const result=Reflect.apply(original.closeSync,this,args);if(state){trace.files[state.label].closes++;handles.delete(args[0]);}return result;});
 replace('fstatSync',function(...args){
  const result=Reflect.apply(original.fstatSync,this,args),state=handles.get(args[0]);
  if(state){state.stat=true;trace.files[state.label].stats++;}
  // Mutate only real child-owned bytes after the real size snapshot. Never
  // replace a stat/read result or alter any file outside the fixture allowlist.
  if(state?.label==='source'&&config.mutation&&!trace.mutationApplied){
   assert.ok(config.mutation==='shrink'||config.mutation==='grow');
   trace.mutationApplied=true;trace.mutation={kind:config.mutation,before:result.size,opened:false,closed:false};
   const fd=Reflect.apply(original.openSync,fs,[config.source,'r+']);trace.mutation.opened=true;
   try{
    if(config.mutation==='shrink')fs.ftruncateSync(fd,result.size-1);
    else fs.writeSync(fd,Buffer.from('x'),0,1,result.size);
    trace.mutation.after=Reflect.apply(original.fstatSync,fs,[fd]).size;
   }finally{Reflect.apply(original.closeSync,fs,[fd]);trace.mutation.closed=true;}
  }
  return result;
 });
 replace('readSync',function(...args){const state=handles.get(args[0]);if(state){const stats=trace.files[state.label],request=requested(args);stats.reads++;if(!state.stat)stats.readBeforeStat++;stats.maxRequest=Math.max(stats.maxRequest,request.length);stats.maxBuffer=Math.max(stats.maxBuffer,request.buffer);}
  const count=Reflect.apply(original.readSync,this,args);if(state){const stats=trace.files[state.label];stats.bytesRead+=count;if(count>0)stats.positiveReads++;else stats.eofReads++;}return count;
 });
 syncBuiltinESMExports();
 const tool=fileURLToPath(new URL('../tools/build-resource-manifest.mjs',import.meta.url));
 process.argv=[process.execPath,tool,'--project',config.project,'--root',owner,'--target','web-shared/1','--out',config.output,'--receipt',config.receipt];
 await import(new URL('../tools/build-resource-manifest.mjs',import.meta.url));
}finally{
 trace.openHandles=[...handles.keys()];
 // Cleanup records do not turn a leaked product handle into a successful close.
 for(const fd of handles.keys())try{Reflect.apply(original.closeSync,fs,[fd]);}catch{}
 handles.clear();
 for(const [name,descriptor] of descriptors)Object.defineProperty(fs,name,descriptor);
 syncBuiltinESMExports();
 trace.restored=names.every(name=>{const actual=Object.getOwnPropertyDescriptor(fs,name),expected=descriptors.get(name);return actual.value===expected.value&&actual.writable===expected.writable&&actual.enumerable===expected.enumerable&&actual.configurable===expected.configurable;});
 fs.writeFileSync(config.trace,JSON.stringify(trace,null,2)+'\n');
}
