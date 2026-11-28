// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';import assert from 'node:assert/strict';import {PNG} from 'pngjs';
import {createEngine,createAssetType,createAssetRef,createTexture,createImageData2D,createSpriteSheet,createSequenceClip} from '@egret/engine';
import {createSpineContentLoader} from '@egret/spine';
import {host} from '../../tests/helpers.mjs';import {buildOriginalContent} from './author.mjs';import {createOutfitScene,presentOutfitPair} from './scene.mjs';import {sequenceInput} from './content.mjs';
async function setup(t){const content=buildOriginalContent(),engine=await createEngine({host:host().adapter}),owner=engine.createScope(),data=engine.createScope(),textures=[];
 t.after(()=>engine.dispose());const texture=bytes=>{const p=PNG.sync.read(bytes),value=createTexture(createImageData2D({width:p.width,height:p.height,pixels:new Uint8Array(p.data)}));textures.push(value);return value;};
 const loader=createSpineContentLoader(engine,owner,content.manifest,bindings=>{const ids=new Map(bindings.map(b=>[b.binding.ref.id,b.id]));return {textures:{async load(ref){return texture(content.values.get(ids.get(ref.id)));},dispose(v){v.dispose();}},metadata:{async load(ref){return content.values.get(ids.get(ref.id)).toString('utf8');},dispose(){}}};});t.after(()=>loader.close());
 const group=loader.load(data,['e_character']);await group.ready;const type=createAssetType('scene-sparks',v=>!!v);engine.assets.register(type,{async load(){return texture(content.values.get('e_sparks'));},dispose(v){v.dispose();}});const lease=await engine.assets.acquire(createAssetRef(type,'scene-sparks'));data.use({dispose:()=>lease.release()});const sheet=data.use(createSpriteSheet(lease,[{name:'spark',x:0,y:0,width:1,height:1}])),clip=createSequenceClip(sequenceInput),scene=createOutfitScene(engine,group.getSpine('e_character'),sheet,clip);t.after(()=>scene.dispose());engine.advanceTime(0);return {engine,loader,group,scene,data,owner,textures,sheet,clip};}
test('original content is deterministic, multipage and explicitly first-party',()=>{const a=buildOriginalContent(),b=buildOriginalContent();assert.deepEqual(a.manifest,b.manifest);assert.deepEqual(a.manifest.entries.find(e=>e.id==='e_atlas').dependencies,['e_warm','e_cool']);for(const e of a.manifest.entries){assert.deepEqual(a.values.get(e.id),b.values.get(e.id));assert.equal(e.provenance.license,'Apache-2.0');}});
test('20 genuine Spine players and 200 independent controllers share setup and ordered Engine graphics',async t=>{const s=await setup(t);assert.deepEqual(s.scene.inspect().counts,{spine:20,sequences:200});assert.equal(s.loader.getStatus().liveInstances,20);assert.equal(s.loader.getStatus().liveSetups,1);assert.equal(s.textures.length,3);s.engine.advanceTime(.1);const state=s.scene.inspect();assert.ok(Math.abs(state.players[0].tracks[0].trackTime-.1)<1e-12);assert.ok(Math.abs(state.players[1].tracks[0].trackTime-.05)<1e-12);assert.equal(state.sequences[0].elapsedSeconds,.1);assert.equal(state.sequences[1].elapsedSeconds,.2);const frame=s.engine.captureSharedFrame({width:640,height:400});assert.equal(frame.pages.length,3);assert.ok(frame.commands.length>=240);assert.ok(frame.geometries.length>=40);});
test('selected outfit, finite animation, pause and rate preserve other players',async t=>{const s=await setup(t);s.scene.edit(0,{outfit:'both',animation:'sway',plays:2,rate:2});s.engine.advanceTime(.1);let state=s.scene.inspect();assert.deepEqual(state.players[0].skins,['default','cool-coat','warm-hat']);assert.deepEqual(state.players[1].skins,[]);assert.equal(state.players[0].tracks[0].plays,2);s.scene.edit(0,{paused:true});s.engine.advanceTime(.2);state=s.scene.inspect();assert.ok(Math.abs(state.players[0].tracks[0].trackTime-.2)<1e-12);assert.ok(Math.abs(state.players[1].tracks[0].trackTime-.1)<1e-12);s.scene.edit(0,{paused:false});for(let i=3;i<=12;i++)s.engine.advanceTime(i/10);state=s.scene.inspect();assert.equal(state.players[0].tracks[0].completedPlays,2);assert.equal(state.players[0].tracks[0].animationTime,1);assert.throws(()=>s.scene.edit(20,{outfit:'default'}));});
test('a detached actor and spark replace one pair together, and a discarded pair leaves every owner intact', async t => {
  const { engine, group, scene, sheet, clip } = await setup(t);
  const options = {width: 640, height: 400}, asset = group.getSpine('e_character');
  engine.advanceTime(.1);
  const before = scene.inspect();
  const prepare = () => scene.preparePair(engine.createScope(), asset, sheet, clip, 'alternate');
  const discarded = prepare();
  discarded.capture(options);
  assert.deepEqual(scene.inspect().players[4], before.players[4]);
  assert.deepEqual(scene.inspect().sequences[0], before.sequences[0]);
  discarded.dispose();
  assert.equal(scene.inspect().pairVersion, 'original');
  const ticket = prepare();
  ticket.capture(options);
  ticket.commit();
  assert.equal(scene.inspect().pairVersion, 'alternate');
  assert.deepEqual(scene.inspect().counts, {spine: 20, sequences: 200});
  assert.equal(scene.inspect().sequences[0].elapsedSeconds, 0);
  assert.equal(scene.inspect().players[4].elapsedSeconds, 0);
  assert.deepEqual(scene.inspect().players[3], before.players[3]);
  assert.deepEqual(scene.inspect().sequences[1], before.sequences[1]);
  assert.deepEqual(scene.inspect().events, before.events);
});
test('failure before publication and failure after publication retain the correct owner',async () => {
  for (const failure of ['precommit','retire','generation','submit','complete']) {
    let committed = false, submitted = 0;
    const fault = () => {throw Error(failure);};
    const pending = { committed:false, ticket:{
      capture(){return {};},
      get committed(){return committed;},
      commit(){if(failure==='precommit') fault(); committed=true; if(failure==='retire') fault();}
    }};
    const host = {
      getSessionStatus(){return {state:'ready',generation:failure==='generation'&&committed?2:1};},
      stageSharedFrame(){return {ready:Promise.resolve({generation:1}),submit(){
        submitted++;
        if(failure==='submit')fault();
        return {completed:Promise.reject(Error('completion'))};
      }};}
    };
    await assert.rejects(presentOutfitPair(pending,host,{},()=>{}), err =>
      failure==='precommit' ? err.message==='precommit' : err.code==='PAIR_POSTCOMMIT_FAILED' && !!err.cause
    );
    assert.equal(pending.committed, failure!=='precommit');
    assert.equal(submitted, ['submit','complete'].includes(failure)?1:0);
  }
});
test('scene cleanup releases all 220 owners and 20 clock subscriptions before shared data',async t=>{const s=await setup(t);s.scene.dispose();s.scene.dispose();let state=s.scene.inspect();assert.deepEqual(state.counts,{spine:0,sequences:0});for(const key of ['playerScopes','sequenceScopes'])assert.ok(state.ownership[key].every(v=>v==='closed'));for(const key of ['displaysDisposed','bitmapsDisposed','subscriptionsDisposed'])assert.ok(state.ownership[key].every(Boolean));assert.equal(s.loader.getStatus().liveInstances,0);assert.equal(s.loader.getStatus().liveSetups,1);s.data.dispose();await s.loader.close();assert.equal(s.loader.getStatus().liveSetups,0);assert.equal(s.loader.getStatus().groups,0);assert.ok(s.textures.every(v=>v.isDisposed));assert.throws(()=>s.scene.edit(0,{outfit:'default'}));});
