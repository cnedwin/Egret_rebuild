// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, mkdirSync, readFileSync, writeFileSync, unlinkSync, rmSync, symlinkSync, existsSync, readdirSync, truncateSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {openContentStore} from '../tools/content/store.mjs';

const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const key=hash('key');
const canonical=value=>value===null||typeof value!=='object'?JSON.stringify(value):Array.isArray(value)?'['+value.map(canonical).join(',')+']':'{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';
const descriptor=bytes=>({sha256:hash(bytes),byteLength:bytes.length});
const output=(bytes,name='primary')=>({name,mediaType:'application/octet-stream',...descriptor(bytes)});
function fixture(t){const root=mkdtempSync(path.join(os.tmpdir(),'egret-content-store-'));t.after(()=>rmSync(root,{recursive:true,force:true}));return root;}
function withStore(t){const root=fixture(t),store=openContentStore(root);t.after(()=>store.close());return {root,store};}
const integrity=error=>error.code==='CONTENT_STORE_INTEGRITY';
function generation(outputs){const manifestBytes=Buffer.from('{"entries":[]}');return {manifestBytes,descriptor:{format:'egret.content-generation/1',manifest:descriptor(manifestBytes),outputs:[{resourceId:'e_image',buildKey:key,files:outputs}]}};}

test('cold/warm bytes are owned; closed sessions refuse; exclusive writer can reopen',t=>{
  const {root,store}=withStore(t),bytes=Buffer.from([1,2,3]);
  assert.throws(()=>openContentStore(root),error=>error.code==='CONTENT_STORE_LOCKED');
  const blob=store.putBlob(bytes);assert.equal(blob.path,'blobs/sha256/'+hash(bytes));bytes[0]=9;
  const first=store.readBlob(blob);assert.deepEqual([...first],[1,2,3]);first[0]=8;
  assert.deepEqual([...store.readBlob(blob)],[1,2,3]);assert.deepEqual(store.putBlob(Buffer.from([1,2,3])),blob);
  store.close();store.close();assert.throws(()=>store.readBlob(blob),error=>error.code==='CONTENT_STORE_CLOSED');
  const next=openContentStore(root);assert.deepEqual([...next.readBlob(blob)],[1,2,3]);next.close();
});

test('complete records include RGBA; missing blob preserves description and rebuild must match',t=>{
  const {root,store}=withStore(t),primary=Buffer.from('png'),rgba=Buffer.from([1,2,3,0]);
  store.putBlob(primary);store.putBlob(rgba);const outputs=[output(primary),output(rgba,'rgba')];
  store.publishRecord(key,outputs);assert.deepEqual(store.readRecord(key),{outputs,complete:true});
  unlinkSync(path.join(root,'blobs/sha256',hash(rgba)));
  assert.deepEqual(store.readRecord(key),{outputs,complete:false});
  store.putBlob(rgba);store.publishRecord(key,outputs);assert.equal(store.readRecord(key).complete,true);
  const other=Buffer.from('different');store.putBlob(other);
  assert.throws(()=>store.publishRecord(key,[output(other),output(rgba,'rgba')]),error=>error.code==='CONTENT_CACHE_DETERMINISM');
  assert.deepEqual(store.readRecord(key),{outputs,complete:true});
});

for(const name of ['primary','rgba'])test('corrupt '+name+' bytes refuse and remain untouched',t=>{
  const {root,store}=withStore(t),primary=Buffer.from('png'),rgba=Buffer.from([1,2,3,0]);
  for(const bytes of [primary,rgba])store.putBlob(bytes);
  store.publishRecord(key,[output(primary),output(rgba,'rgba')]);
  const good=name==='primary'?primary:rgba,file=path.join(root,'blobs/sha256',hash(good)),bad=Buffer.alloc(good.length,99);
  writeFileSync(file,bad);assert.throws(()=>store.readRecord(key),integrity);assert.throws(()=>store.putBlob(good),integrity);
  assert.deepEqual(readFileSync(file),bad);assert.equal(store.readGeneration(key),null);
});

test('different owned roots copy intrinsic bytes independently',t=>{
  const first=withStore(t),second=withStore(t),bytes=Buffer.from('owned');
  const blob=first.store.putBlob(bytes);assert.equal(second.store.readBlob(blob),null);
  second.store.putBlob(first.store.readBlob(blob));assert.deepEqual(second.store.readBlob(blob),first.store.readBlob(blob));
  unlinkSync(path.join(first.root,blob.path));assert.deepEqual([...second.store.readBlob(blob)],[...bytes]);
});

test('strict metadata rejects malformed, duplicate, unordered and bounded values',t=>{
  const {root,store}=withStore(t),bytes=Buffer.from('primary');store.putBlob(bytes);const item=output(bytes);
  for(const outputs of [[],[item,item],[{...item,extra:true}],[{...item,byteLength:-1}],[{...item,sha256:'../escape'}],[{...item,mediaType:'x'.repeat(200)}],[output(bytes,'rgba')],[output(bytes,'rgba'),item]])assert.throws(()=>store.publishRecord(key,outputs));
  assert.throws(()=>store.putBlob(new Uint8Array(8388609)));
  assert.throws(()=>store.readBlob({...descriptor(bytes),extra:true}));assert.throws(()=>store.readRecord('../escape'));
  let accessed=false;const accessor={};Object.defineProperty(accessor,'sha256',{enumerable:true,get(){accessed=true;return hash(bytes);}});assert.throws(()=>store.readBlob(accessor));assert.equal(accessed,false);
  const record=path.join(root,'records',key+'.json');writeFileSync(record,'{"format":"egret.content-cache/1","buildKey":"'+key+'","outputs":[],"outputs":[]}');
  assert.throws(()=>store.readRecord(key),integrity);
  unlinkSync(record);writeFileSync(record,Buffer.alloc(8193,32));assert.throws(()=>store.readRecord(key),integrity);
  unlinkSync(record);writeFileSync(record,canonical({format:'egret.content-cache/1',buildKey:key,outputs:[]}));assert.throws(()=>store.publishRecord(key,[item]),integrity);
});

test('generation publication is canonical, ready, immutable and verifies every output',t=>{
  const {root,store}=withStore(t),bytes=Buffer.from('asset');store.putBlob(bytes);const input=generation([output(bytes)]);
  const ready=store.publishGeneration(input.descriptor,input.manifestBytes),expected=Buffer.from(canonical(input.descriptor));
  assert.deepEqual(Buffer.from(ready.descriptorBytes),expected);assert.equal(ready.id,hash(expected));assert.equal(ready.path,'generations/'+ready.id+'/manifest.json');
  assert.deepEqual(Buffer.from(ready.manifestBytes),input.manifestBytes);assert.deepEqual(store.readGeneration(ready.id).descriptor,input.descriptor);
  assert.deepEqual(store.publishGeneration(input.descriptor,input.manifestBytes),ready);
  ready.manifestBytes[0]=0;assert.equal(store.readGeneration(ready.id).manifestBytes[0],123);
  assert.throws(()=>store.publishGeneration(input.descriptor,Buffer.from('wrong')),integrity);
  unlinkSync(path.join(root,'blobs/sha256',hash(bytes)));assert.throws(()=>store.readGeneration(ready.id),integrity);
});

test('existing partial or mismatched generation refuses without replacement',t=>{
  const {root,store}=withStore(t),bytes=Buffer.from('asset');store.putBlob(bytes);const input=generation([output(bytes)]),id=hash(canonical(input.descriptor));
  const directory=path.join(root,'generations',id);mkdirSync(directory);writeFileSync(path.join(directory,'descriptor.json'),canonical(input.descriptor));
  assert.throws(()=>store.readGeneration(id),integrity);assert.throws(()=>store.publishGeneration(input.descriptor,input.manifestBytes),integrity);
  assert.equal(existsSync(path.join(directory,'manifest.json')),false);
  writeFileSync(path.join(directory,'manifest.json'),'wrong');assert.throws(()=>store.publishGeneration(input.descriptor,input.manifestBytes),integrity);assert.equal(readFileSync(path.join(directory,'manifest.json'),'utf8'),'wrong');
});

test('generation metadata rejects duplicate IDs, unknown fields and excess resources',t=>{
  const {store}=withStore(t),bytes=Buffer.from('asset');store.putBlob(bytes);const input=generation([output(bytes)]);
  for(const descriptorValue of [{...input.descriptor,extra:true},{...input.descriptor,outputs:[input.descriptor.outputs[0],input.descriptor.outputs[0]]},{...input.descriptor,outputs:[{...input.descriptor.outputs[0],resourceId:'image'}]},{...input.descriptor,outputs:[{...input.descriptor.outputs[0],resourceId:'e_'+('a'.repeat(127))}]},{...input.descriptor,outputs:Array(4097).fill(input.descriptor.outputs[0])},{...input.descriptor,manifest:{sha256:key,byteLength:4194305}}])assert.throws(()=>store.publishGeneration(descriptorValue,input.manifestBytes));
});

test('actual oversized stored files refuse before a successful read; exact blob cap works',t=>{
  const {root,store}=withStore(t),bytes=Buffer.alloc(8388608,7),blob=store.putBlob(bytes);
  assert.equal(store.readBlob(blob).length,8388608);truncateSync(path.join(root,blob.path),8388609);
  assert.throws(()=>store.readBlob(blob),integrity);assert.equal(readFileSync(path.join(root,blob.path)).length,8388609);
});

test('canonical owner/path checks reject aliases and symlinks when supported',t=>{
  const root=fixture(t);assert.throws(()=>openContentStore(root+path.sep+'..'+path.sep+path.basename(root)));
  const outside=fixture(t),link=path.join(root,'linked');
  try{symlinkSync(outside,link,process.platform==='win32'?'junction':'dir');}catch(error){if(error.code==='EPERM'||error.code==='EACCES'){t.diagnostic('Symlink creation unavailable: '+error.code);return;}throw error;}
  assert.throws(()=>openContentStore(link));
  const store=openContentStore(root);t.after(()=>store.close());
  rmSync(path.join(root,'blobs','sha256'),{recursive:true});symlinkSync(outside,path.join(root,'blobs','sha256'),process.platform==='win32'?'junction':'dir');
  assert.throws(()=>store.putBlob(Buffer.from('escape')));assert.deepEqual(readdirSync(outside),[]);
});

test('close releases only its own lock and never steals stale locks',t=>{
  const root=fixture(t),store=openContentStore(root),lock=path.join(root,'.content-writer.lock');
  unlinkSync(lock);writeFileSync(lock,'foreign lock');store.close();assert.equal(readFileSync(lock,'utf8'),'foreign lock');
  assert.throws(()=>openContentStore(root),error=>error.code==='CONTENT_STORE_LOCKED');
});


test('blob capture ignores shadowable view properties and owns exactly intrinsic bytes',t=>{
  const {store}=withStore(t),bytes=new Uint8Array([1,2,3]);let calls=0;
  for(const key of ['length','byteLength','byteOffset','buffer'])Object.defineProperty(bytes,key,{get(){calls++;throw Error('shadow getter');}});
  const saved=store.putBlob(bytes);assert.equal(saved.byteLength,3);assert.equal(saved.sha256,hash(Buffer.from([1,2,3])));
  assert.deepEqual([...store.readBlob(saved)],[1,2,3]);assert.equal(calls,0);
});
test('oversized or unstable backing buffers refuse before any immutable blob is published',t=>{
  const {root,store}=withStore(t),bytes=new Uint8Array(8388609);let calls=0;
  Object.defineProperty(bytes,'byteLength',{get(){calls++;return 0;}});
  for(const input of [bytes,new Uint8Array(new SharedArrayBuffer(4)),new Uint8Array(new ArrayBuffer(4,{maxByteLength:8}))]){
    assert.throws(()=>store.putBlob(input),error=>error.code==='CONTENT_STORE_INPUT');
  }
  assert.equal(calls,0);assert.deepEqual(readdirSync(path.join(root,'blobs/sha256')),[]);
});
