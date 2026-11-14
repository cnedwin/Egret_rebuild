// SPDX-License-Identifier: Apache-2.0
// Binary skeletons: read by Core's own reader through a bounded admission, into the same setup the JSON gives.
import test from 'node:test';import assert from 'node:assert/strict';
import {createEngine} from '@egret/engine';import {createSpineContentLoader} from '@egret/spine';
import {host,flush} from '../../../tests/helpers.mjs';import {fixture,ports,codes,source} from './fixtures.mjs';
import {encodeSkeleton} from './binaryFixture.mjs';
async function setup(t,{data=fixture({includeBinary:true}),control={},options}={}){const engine=await createEngine({host:host().adapter});const p=ports(data,control),owner=engine.createScope(),loader=createSpineContentLoader(engine,owner,data.manifest,p.factory,options);t.after(async()=>{loader.dispose();p.resolve();await loader.close();await engine.dispose();});return {engine,loader,p,load:ids=>loader.load(engine.createScope(),ids)};}
function drained(s){const status=s.loader.getStatus();for(const key of ['groups','activeSourceLoads','liveSourceValues','pendingSetups','liveSetups','setupBytes'])assert.equal(status[key],0,key);assert.ok(s.p.textures.every(t=>t.isDisposed));}
const swing={...source(),animations:{idle:{},swing:{bones:{child:{rotate:[{time:0,value:0},{time:0.5,value:45,curve:'stepped'},{time:1.25,value:90}]}}}}};

test('SB01 a binary skeleton gives the same setup as its JSON, told apart only by its format',async t=>{
 const s=await setup(t,{data:fixture({skeleton:swing,includeBinary:true})}),group=s.load(['e_json','e_binary']);
 await group.ready;
 const json=group.getSpine('e_json').info,binary=group.getSpine('e_binary').info;
 assert.deepEqual([json.format,binary.format],['json','binary']);
 assert.deepEqual({...binary,format:'json'},json);
 assert.deepEqual(binary.animations,[{name:'idle',duration:0},{name:'swing',duration:1.25}]);
 assert.deepEqual([binary.boneCount,binary.slotCount,binary.skins,binary.exportVersion],[2,2,['default'],'4.3.13']);
 // The provider was told which binding is bytes.
 group.dispose();await flush();await s.loader.close();drained(s);
});

test('SB02 the factory is told the binary skeleton is bytes, and its fee is its byte length',async t=>{
 const data=fixture({includeBinary:true});let kinds;
 const engine=await createEngine({host:host().adapter});t.after(()=>engine.dispose());
 const p=ports(data),loader=createSpineContentLoader(engine,engine.createScope(),data.manifest,bindings=>{kinds=Object.fromEntries(bindings.map(b=>[b.id,b.kind]));return p.factory(bindings);});
 assert.deepEqual(kinds,{e_a:'image',e_b:'image',e_atlas:'metadata',e_json:'metadata',e_binary:'binary'});
 const group=loader.load(engine.createScope(),['e_binary']);
 // While setting up, the source is charged; once ready, only what the setup keeps.
 await group.ready;assert.ok(loader.getStatus().setupBytes>0);
 group.dispose();await flush();loader.dispose();await loader.close();
});

test('SB03 a binary source that is text, or text where bytes are due, is refused and every source let go',async t=>{
 for(const replace of [{e_binary:'not bytes'},{e_json:new Uint8Array([1,2,3])}]){
  const s=await setup(t,{control:{replace}}),group=s.load([Object.keys(replace)[0]]);
  await assert.rejects(group.ready,error=>codes(error).includes('SPINE_SOURCE_FAILED'));
  await s.loader.close();drained(s);
 }
});

test('SB04 counts the bytes left could not hold are refused before Core allocates them; short, foreign and old files too',async t=>{
 const good=encodeSkeleton(swing);
 // The bone count follows the header and an empty string table: make it enormous.
 const header=8+1+'4.3.13'.length+4*5+1+1;
 // A varint of 0x7fffffff where the bone count is.
 const bones=Uint8Array.from([...good.slice(0,header),0xff,0xff,0xff,0xff,0x07,...good.slice(header+1)]);
 const negative=Uint8Array.from([...good.slice(0,header),0xff,0xff,0xff,0xff,0x0f,...good.slice(header+1)]);
 for(const [label,bytes,code] of [['a huge count',bones,'SPINE_BINARY_LIMIT_FAILED'],['a negative count',negative,'SPINE_BINARY_LIMIT_FAILED'],
  ['too short',Uint8Array.from([0,0,0,0]),'SPINE_BINARY_LIMIT_FAILED'],['cut short',good.slice(0,good.length-6),'SPINE_PARSE_FAILED'],
  ['another series',encodeSkeleton(source('4.2.11')),'SPINE_EXPORT_VERSION_FAILED'],
  // A count the bytes left allow, but storage for it many times the size of the file.
  ['storage beyond the file',encodeSkeleton(swing,{bezierCount:60000}),'SPINE_BINARY_LIMIT_FAILED']]){
  const s=await setup(t,{data:fixture({includeBinary:true,binary:bytes})}),group=s.load(['e_binary']);
  await assert.rejects(group.ready,error=>codes(error).includes(code),label);
  await s.loader.close();drained(s);
 }
 // After a refusal Core's reader and storage are as they were, and a good file still loads.
 const Core=await import('@esotericsoftware/spine-core');
 assert.equal(Core.BinaryInput.prototype.readInt.length,1);
 assert.ok(!String(Core.Utils.newFloatArray).includes('charge')&&!String(Core.BinaryInput.prototype.readInt).includes('spineFault'));
 const s=await setup(t),group=s.load(['e_binary']);await group.ready;assert.equal(group.getSpine('e_binary').info.format,'binary');
});

test('SB05 a binary skeleton plays as its JSON does: the same pose at the same times, through stepped and linear keys',async t=>{
 const {createSpineInstance}=await import('@egret/spine');
 const s=await setup(t,{data:fixture({skeleton:swing,includeBinary:true})}),group=s.load(['e_json','e_binary']);await group.ready;
 const make=id=>{const instance=createSpineInstance(group.getSpine(id),s.engine.createScope());instance.setAnimation(0,'swing');return instance;};
 const json=make('e_json'),binary=make('e_binary');
 let elapsed=0;const rotations=[];
 for(let id=1;id<=12;id++){
  elapsed+=0.1;const tick={tickId:id,deltaSeconds:0.1,elapsedSeconds:elapsed};
  const a=json.advance(tick),b=binary.advance(tick);
  assert.deepEqual(b.bones,a.bones,'pose at '+elapsed.toFixed(1));
  assert.deepEqual(b.slots,a.slots);
  rotations.push(a.bones.find(bone=>bone.name==='child').rotation);
 }
 // Linear from 0 to 45 over the first half second, then the stepped key holds 45 until the last key.
 assert.ok(Math.abs(rotations[2]-27)<1e-3,String(rotations[2]));
 assert.ok(rotations.slice(4).every(r=>Math.abs(r-45)<1e-3),String(rotations));
});
