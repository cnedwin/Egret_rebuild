import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import * as contracts from '../packages/contracts/dist/index.js';

const bytes = [255,0,1,0,7,128,254,255];
function api() {
  for (const key of ['createImageData2D','isImageData2D','copyImageData2DPixels']) assert.equal(typeof contracts[key], 'function', `Missing image export: ${key}`);
  return contracts;
}
const input = (overrides={}) => ({width:2,height:1,pixels:new Uint8Array(bytes),...overrides});

// A retained alias, non-tight copy, or mutable metadata breaks this literal oracle.
test('owned-tight-bytes', () => {
  const {createImageData2D:create,copyImageData2DPixels:copy,isImageData2D:guard}=api();
  const backing=new Uint8Array(20);backing.set(bytes,5);const source=backing.subarray(5,13);
  const image=create(input({pixels:source}));const second=create(input());
  assert.notEqual(image,second);assert.equal(guard(image),true);
  source.fill(42);const a=copy(image),b=copy(image);
  assert.deepEqual([...a],bytes);assert.deepEqual([...b],bytes);assert.notEqual(a,b);assert.notEqual(a.buffer,b.buffer);
  for(const value of [a,b]){assert.equal(value.byteOffset,0);assert.equal(value.length,8);assert.equal(value.buffer.byteLength,8);assert.equal(value.buffer.resizable,false);}
  a.fill(9);assert.deepEqual([...copy(image)],bytes);
  structuredClone(b.buffer,{transfer:[b.buffer]});assert.equal(b.byteLength,0);assert.deepEqual([...copy(image)],bytes);
  structuredClone(source.buffer,{transfer:[source.buffer]});assert.deepEqual([...copy(image)],bytes);
  assert.deepEqual({...image},{width:2,height:1,bytesPerRow:8,byteLength:8,format:'rgba8unorm',colorSpace:'srgb',alphaMode:'straight',origin:'top-left'});
  assert.equal(Object.isFrozen(image),true);for(const key of Object.keys(image)){const d=Object.getOwnPropertyDescriptor(image,key);assert.equal(d.writable,false);assert.equal(d.configurable,false);assert.equal('get' in d,false);}
});

test('source caps, numeric types and exact byte length',()=>{
  const {createImageData2D:create,IMAGE_LIMITS_2D:limits}=api();
  const image=create({width:4096,height:256,pixels:new Uint8Array(4194304)});assert.equal(image.byteLength,4194304);
  assert.deepEqual(limits,{maxSourceEdge:4096,maxSourcePixels:1048576,maxImagesPerFrame:64,maxViewsPerFrame:128,maxImageTableBytes:16777216,maxProjectionBytes:16777216,maxImageScratchBytes:33554432,maxPendingTextureBytes:33554432});assert.equal(Object.isFrozen(limits),true);
  for(const overrides of [{width:4097,height:1},{width:1025,height:1024},{width:-0},{height:-0},{width:0},{height:1.5},{width:NaN},{height:Infinity},{width:Number.MAX_SAFE_INTEGER+1},{pixels:new Uint8Array(7)}])assert.throws(()=>create(input(overrides)),RangeError);
  for(const overrides of [{width:'2'},{height:'1'}])assert.throws(()=>create(input(overrides)),TypeError);
  for(const value of [null,undefined,1,'record',true,()=>{}])assert.throws(()=>create(value),TypeError);
});

test('fixed metadata literals accept undefined defaults and reject null or wrong literal',()=>{
  const {createImageData2D:create}=api();
  for(const [key,value] of Object.entries({format:'rgba8unorm',colorSpace:'srgb',alphaMode:'straight',origin:'top-left'})){
    assert.equal(create(input({[key]:undefined}))[key],value);assert.equal(create(input({[key]:value}))[key],value);
    for(const bad of [null,'wrong',42])assert.throws(()=>create(input({[key]:bad})),TypeError);
  }
});

test('intrinsic Uint8Array admission supports cross realm and genuine subclasses',()=>{
  const {createImageData2D:create,copyImageData2DPixels:copy}=api();
  class Bytes extends Uint8Array {}
  for(const pixels of [vm.runInNewContext('new Uint8Array([255,0,1,0,7,128,254,255])'),new Bytes(bytes)])assert.deepEqual([...copy(create(input({pixels})))],bytes);
});

test('wrong views, proxies, shared, resizable and detached storage fail TypeError',()=>{
  const {createImageData2D:create}=api();const detached=new Uint8Array(8);structuredClone(detached.buffer,{transfer:[detached.buffer]});
  const revoked=Proxy.revocable(new Uint8Array(8),{});revoked.revoke();
  for(const pixels of [new Uint8ClampedArray(8),new DataView(new ArrayBuffer(8)),new Proxy(new Uint8Array(8),{}),revoked.proxy,bytes,{buffer:new ArrayBuffer(8),byteLength:8,[Symbol.toStringTag]:'Uint8Array'},new Uint8Array(new SharedArrayBuffer(8)),new Uint8Array(new ArrayBuffer(8,{maxByteLength:16})),detached])assert.throws(()=>create(input({pixels})),TypeError);
});

test('copy ignores poisoned instance helpers and subclass species',()=>{
  const {createImageData2D:create,copyImageData2DPixels:copy}=api();let calls=0;
  class PoisonBytes extends Uint8Array {static get [Symbol.species](){calls++;throw Error('species');}}
  const pixels=new PoisonBytes(bytes);
  for(const key of ['buffer','length','byteLength','byteOffset','slice','constructor',Symbol.iterator,Symbol.toStringTag])Object.defineProperty(pixels,key,{get(){calls++;throw Error('instance helper');}});
  assert.deepEqual([...copy(create(input({pixels})))],bytes);assert.equal(calls,0);
});

test('descriptor snapshots read known inherited getters once without enumeration',()=>{
  const {createImageData2D:create}=api();const reads=[];let unknown=0,ownKeys=0;const values=input();const parent={};
  for(const key of ['width','height','pixels','format','colorSpace','alphaMode','origin'])Object.defineProperty(parent,key,{get(){reads.push(key);return values[key];}});
  Object.defineProperty(parent,'unknown',{get(){unknown++;throw Error('unknown');}});
  const descriptor=new Proxy(Object.create(parent),{ownKeys(){ownKeys++;throw Error('enumeration');}});
  assert.equal(create(descriptor).byteLength,8);assert.deepEqual(reads,['width','height','pixels','format','colorSpace','alphaMode','origin']);assert.equal(unknown,0);assert.equal(ownKeys,0);
  const array=[];Object.assign(array,input());assert.equal(create(array).byteLength,8);
});

test('later thrown getter wins over malformed width and preserves exact cause',()=>{
  const {createImageData2D:create}=api();const sentinel={origin:true};const reads=[];
  const descriptor=new Proxy(input({width:'bad'}),{get(target,key){reads.push(key);if(key==='origin')throw sentinel;return target[key];}});
  assert.throws(()=>create(descriptor),e=>e instanceof TypeError&&e.cause===sentinel);assert.deepEqual(reads,['width','height','pixels','format','colorSpace','alphaMode','origin']);
});

test('semantic validation priority follows dimensions then metadata then intrinsic bytes',()=>{
  const {createImageData2D:create}=api();
  assert.throws(()=>create(input({width:'bad',height:0,format:null,pixels:null})),TypeError);
  assert.throws(()=>create(input({width:0,height:'bad',format:null,pixels:null})),RangeError);
  assert.throws(()=>create(input({height:0,format:null,pixels:null})),RangeError);
  assert.throws(()=>create(input({width:4097,format:null,pixels:null})),RangeError);
  assert.throws(()=>create(input({format:null,pixels:new Uint8Array(7)})),TypeError);
});

test('descriptor reentry creates independent transaction and detachment precedes admission',()=>{
  const {createImageData2D:create,copyImageData2DPixels:copy}=api();let inner;
  const outer=create({...input(),get width(){inner=create(input());return 2;}});assert.notEqual(inner,outer);assert.deepEqual([...copy(inner)],bytes);assert.deepEqual([...copy(outer)],bytes);
  const pixels=new Uint8Array(bytes);assert.throws(()=>create({...input({pixels}),get origin(){structuredClone(pixels.buffer,{transfer:[pixels.buffer]});return undefined;}}),TypeError);
});

test('guard and copy authenticate without forged or revoked proxy property reads',()=>{
  const {createImageData2D:create,isImageData2D:guard,copyImageData2DPixels:copy}=api();let reads=0;const forged=new Proxy({...create(input())},{get(){reads++;throw Error('forged getter');},ownKeys(){reads++;throw Error('forged keys');}});
  const revoked=Proxy.revocable({}, {get(){reads++;throw Error('revoked getter');}});revoked.revoke();
  for(const value of [forged,revoked.proxy,new Proxy(create(input()),{}),{},null,undefined,1,()=>{}]){assert.equal(guard(value),false);assert.throws(()=>copy(value),TypeError);}assert.equal(reads,0);
});

test('duplicate isolated module has independent image identity',async()=>{
  const {createImageData2D:create,isImageData2D:guard,copyImageData2DPixels:copy}=api();
  const duplicate=await import(new URL('../packages/contracts/dist/ImageData2D.js?isolated-task1',import.meta.url));
  const foreign=duplicate.createImageData2D(input()),local=create(input());assert.equal(guard(foreign),false);assert.throws(()=>copy(foreign),TypeError);assert.equal(duplicate.isImageData2D(local),false);assert.throws(()=>duplicate.copyImageData2DPixels(local),TypeError);
});
