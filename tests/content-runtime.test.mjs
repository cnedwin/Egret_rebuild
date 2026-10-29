// SPDX-License-Identifier: Apache-2.0
// Original artifacts and public behavior controls, independent of the parser.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as egret from '@egret/engine';
import * as resources from '@egret/engine/resources';
import {buildResourceManifest} from '@egret/contracts/resources';
import {description,entry} from './fixtures/resource-manifest.mjs';
import {host,deferred,flush} from './helpers.mjs';

const canonical=v=>v===null||typeof v!=='object'?JSON.stringify(v):Array.isArray(v)?'['+v.map(canonical).join(',')+']':'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';
const layout=()=>({sourceWidth:1,sourceHeight:1,trimX:0,trimY:0,packedRotation:0});
const frame=(x,durationSeconds)=>({x,y:0,width:1,height:1,durationSeconds,layout:layout()});
function fixture(change=()=>{}){
 const sequenceInput={atlasWidth:2,atlasHeight:1,frames:[frame(0,0.125),frame(1,0.25)]};
 const atlas={format:'egret.atlas/1',pageDependency:0,width:2,height:1,frames:[{name:'red',x:0,y:0,width:1,height:1,layout:layout()},{name:'green',x:1,y:0,width:1,height:1,layout:layout()}],sequenceInput};
 const sequence={format:'egret.sequence/1',atlasDependency:0,sequenceInput:structuredClone(sequenceInput)};
 const rows=[['e_page','image','egret.png','png/1',[]],['e_atlas','atlas','egret.aseprite-atlas','egret.atlas/1',['e_page']],['e_sequence','sequence','egret.sequence','egret.sequence/1',['e_atlas']]].map(([id,kind,importer,format,deps])=>{
  const r=entry(id,deps);r.resourceKind=kind;r.importer={id:importer,version:'1.0.0'};r.artifactFormatVersion=format;
  r.source={...r.source,id:kind==='image'?'f_png':'f_json',path:kind==='image'?'source/page.png':'source/atlas.json'};
  r.artifact={...r.artifact,id:'f_'+id,path:'assets/'+id,mediaType:kind==='image'?'image/png':'application/json'};return r;
 });
 const f={atlas,sequence,rows};change(f);
 const texts=new Map([['e_atlas',canonical(atlas)],['e_sequence',canonical(sequence)]]);
 for(const r of rows){const bytes=Buffer.from(texts.get(r.id)??'PNG fixture bytes');r.artifact.sha256=createHash('sha256').update(bytes).digest('hex');r.artifact.byteLength=bytes.length;}
 const result=buildResourceManifest(description(rows));assert.equal(result.ok,true,JSON.stringify(result.diagnostics));return {...f,texts,manifest:result.value};
}
async function setup(f=fixture(),control={},existingEngine){
 const engine=existingEngine??await egret.createEngine({host:host().adapter});const loads=[],disposed=[],pending=[],textures=[];
 assert.equal(typeof resources.createContentLoader,'function','CONTENT_RUNTIME_FACTORY_MISSING');
 const loader=resources.createContentLoader(engine,f.manifest,bindings=>{
  const ids=new Map(bindings.map(r=>[r.binding.ref.id,r.id]));
  const provider={load(ref,context){const id=ids.get(ref.id);loads.push(id);if(id==='e_page'){
   const texture=egret.createTexture(egret.createImageData2D({width:2,height:1,pixels:new Uint8Array([255,0,0,255,0,255,0,255])}));textures.push(texture);
   if(control.hold){const d=deferred();pending.push({d,texture,context});return d.promise;}return Promise.resolve(texture);
  }if(control.fail===id)return Promise.reject(new Error('original provider failure'));return Promise.resolve(control.text??f.texts.get(id));},dispose(value){disposed.push(value);if(egret.isTexture(value))value.dispose();}};
  return {textures:provider,metadata:provider};
 });
 return {engine,loader,loads,disposed,pending,textures,f,async close(){loader.dispose();for(const p of pending)p.d.resolve(p.texture);await engine.dispose();}};
}
// Break caught: normal consumers must no longer decode metadata or assemble clips.
test('content runtime materializes the whole typed dependency closure',async()=>{
 const s=await setup();try{const scope=s.engine.createScope(),g=s.loader.load(scope,['e_sequence']);assert.throws(()=>g.getAtlas('e_atlas'));await g.ready;
  assert.deepEqual(s.loads,['e_page','e_atlas','e_sequence']);assert.equal(g.getImage('e_page').value.width,2);assert.deepEqual(g.getAtlas('e_atlas').names,['red','green']);assert.equal(g.getSequence('e_sequence').durationSeconds,0.375);
  const sheet=g.getAtlas('e_atlas'),bitmap=scope.use(sheet.createBitmap('red'));s.engine.stage.addChild(bitmap);const playback=s.engine.createSequencePlayback(scope,bitmap,g.getSequence('e_sequence'),{mode:'once'});s.engine.advanceTime(0);playback.start();s.engine.advanceTime(0.125);assert.equal(playback.lastSample.frameIndex,1);
  scope.dispose();assert.equal(bitmap.isDisposed,true);assert.equal(sheet.isDisposed,true);assert.ok(s.textures.every(t=>t.isDisposed));assert.throws(()=>g.getSequence('e_sequence'));
 }finally{await s.close();}
});
// Break caught: a wrapper can accidentally reacquire per group or release a borrowed shared page.
test('content groups share manager values and release independently',async()=>{const s=await setup();try{const a=s.loader.load(s.engine.createScope(),['e_sequence']),b=s.loader.load(s.engine.createScope(),['e_sequence']);await Promise.all([a.ready,b.ready]);assert.equal(s.loads.filter(id=>id==='e_page').length,1);assert.equal(a.getImage('e_page').value,b.getImage('e_page').value);a.dispose();assert.equal(b.getImage('e_page').value.isDisposed,false);b.dispose();assert.ok(s.textures.every(t=>t.isDisposed));}finally{await s.close();}});
// Break caught: partial assembly remains available, or failed metadata retains the page lease.
for(const failure of ['provider','schema','dimensions','sequence'])test('content failure retires all acquired values: '+failure,async()=>{
 const f=fixture(x=>{if(failure==='schema')x.atlas.extra=true;if(failure==='dimensions'){x.atlas.width=3;x.atlas.sequenceInput.atlasWidth=3;x.sequence.sequenceInput.atlasWidth=3;}if(failure==='sequence')x.sequence.sequenceInput.frames[0].durationSeconds=0.25;});
 const s=await setup(f,failure==='provider'?{fail:'e_sequence'}:{});try{const g=s.loader.load(s.engine.createScope(),['e_sequence']);await assert.rejects(g.ready,failure==='dimensions'?{code:'CONTENT_DIMENSIONS_FAILED'}:undefined);await flush();assert.throws(()=>g.getImage('e_page'));assert.ok(s.textures.every(t=>t.isDisposed));}finally{await s.close();}
});
// Break caught: disposing a pending group can publish a late native result or leak its texture.
for(const close of ['group','scope','engine','loader'])test('content pending '+close+' cancellation rejects and retires late values',async()=>{const s=await setup(fixture(),{hold:true});try{const scope=s.engine.createScope(),g=s.loader.load(scope,['e_sequence']);assert.equal(s.pending.length,1);const rejected=assert.rejects(g.ready);let closing;if(close==='group')g.dispose();if(close==='scope')scope.dispose();if(close==='loader')s.loader.dispose();if(close==='engine')closing=s.engine.dispose();await rejected;s.pending[0].d.resolve(s.pending[0].texture);await flush();await closing;assert.ok(s.textures.every(t=>t.isDisposed));assert.deepEqual(s.loads,['e_page']);assert.throws(()=>g.getImage('e_page'));}finally{await s.close();}});
// Break caught: a new logical ID aliases the old generation, or a failed replacement damages it.
test('same-ID new manifest generations remain isolated and failed replacement keeps old assets',async()=>{const old=await setup(),next=await setup(fixture(x=>{x.rows[0].source.sha256='f'.repeat(64);x.atlas.frames[0].name='new-red';}),{},old.engine),bad=await setup(fixture(x=>{x.sequence.sequenceInput.frames[0].durationSeconds=0.25;}),{},old.engine);try{const a=old.loader.load(old.engine.createScope(),['e_sequence']);await a.ready;const failed=bad.loader.load(old.engine.createScope(),['e_sequence']);await assert.rejects(failed.ready);assert.deepEqual(a.getAtlas('e_atlas').names,['red','green']);assert.equal(a.getImage('e_page').value.isDisposed,false);const b=next.loader.load(next.engine.createScope(),['e_sequence']);await b.ready;assert.notEqual(a.getImage('e_page').value,b.getImage('e_page').value);assert.deepEqual(a.getAtlas('e_atlas').names,['red','green']);assert.deepEqual(b.getAtlas('e_atlas').names,['new-red','green']);b.dispose();assert.equal(a.getImage('e_page').value.isDisposed,false);}finally{await old.close();await next.close();await bad.close();}});
// Break caught: metadata sources, unsupported profiles or hostile ports acquire any resource.
test('catalog refuses source/profile drift and accessor provider records before work',async()=>{const engine=await egret.createEngine({host:host().adapter});try{
 for(const change of [x=>{x.rows[2].source={...x.rows[2].source,id:'f_other',path:'source/other.json'};},x=>{x.rows[1].importer.version='2';},x=>{x.rows[0].resourceKind='unknown';}]){let factories=0;assert.throws(()=>resources.createContentLoader(engine,fixture(change).manifest,()=>{factories++;return {};}),egret.EgretError);assert.equal(factories,0);}
 let reads=0;const ports={metadata:{load:async()=>'',dispose(){}}};Object.defineProperty(ports,'textures',{get(){reads++;throw Error('must not read');}});assert.throws(()=>resources.createContentLoader(engine,fixture().manifest,()=>ports),egret.EgretError);assert.equal(reads,0);
 }finally{await engine.dispose();}});
// Break caught: structured lookalikes or foreign Scopes reach caller-controlled roots.
test('content authenticates Engine and Scope before provider or root getters',async()=>{let reads=0;const evil=[];Object.defineProperty(evil,'0',{get(){reads++;throw Error('must not read');}});evil.length=1;assert.throws(()=>resources.createContentLoader({},fixture().manifest,()=>{reads++;}),egret.EgretError);const s=await setup(),foreign=await egret.createEngine({host:host().adapter});try{assert.throws(()=>s.loader.load(foreign.createScope(),evil),egret.EgretError);assert.throws(()=>s.loader.load({},evil),egret.EgretError);assert.equal(reads,0);assert.deepEqual(s.loads,[]);}finally{await s.close();await foreign.dispose();}});
// Break caught: malformed/oversized metadata reaches any public typed getter.
for(const text of ['{','\ufeff{}',' '.repeat(4194305),'{}','{"format":"egret.atlas/1","format":"egret.atlas/1"}'])test('metadata text admission refuses malformed or noncanonical payload '+text.length,async()=>{const s=await setup(fixture(),{text});try{const g=s.loader.load(s.engine.createScope(),['e_sequence']);await assert.rejects(g.ready);assert.ok(s.textures.every(t=>t.isDisposed));assert.throws(()=>g.getAtlas('e_atlas'));}finally{await s.close();}});
