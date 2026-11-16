// SPDX-License-Identifier: Apache-2.0
// Atlas pages declared premultiplied: the loader draws from a straight copy that it makes, owns and pays for.
import test from 'node:test';import assert from 'node:assert/strict';
import {createEngine,copyImageData2DPixels} from '@egret/engine';
import {createSpineContentLoader,createSpineInstance,createSpineDisplay} from '@egret/spine';
import {host} from '../../../tests/helpers.mjs';import {fixture,ports,atlas,codes} from './fixtures.mjs';

// Page a.png as a premultiplied image would hold it: half-alpha red, a colour at alpha 200, light at no alpha, and opaque.
const stored=[128,0,0,128, 100,50,25,200, 10,20,30,0, 9,8,7,255],straight=[255,0,0,128, 128,64,32,200, 0,0,0,0, 9,8,7,255];
const first=atlas.replace('pma: false','pma: true');
async function setup(t,{atlasText=first,options,pagePixels={e_a:stored}}={}){
 const engine=await createEngine({host:host().adapter}),data=fixture({atlasText,pagePixels}),p=ports(data),loader=createSpineContentLoader(engine,engine.createScope(),data.manifest,p.factory,options);
 t.after(async()=>{loader.dispose();await loader.close();await engine.dispose();});
 return {engine,loader,p,load:()=>loader.load(engine.createScope(),['e_json'])};
}
const view=(s,asset)=>{const player=createSpineInstance(asset,s.engine.createScope()),display=createSpineDisplay(player,s.engine.createScope(),{colorProfile:'egret-shared-linear/1'});s.engine.stage.addChild(display.node);return display;};
const drained=s=>{const status=s.loader.getStatus();for(const key of ['groups','activeSourceLoads','liveSourceValues','pendingSetups','liveSetups','setupBytes'])assert.equal(status[key],0,key);assert.ok(s.p.textures.every(texture=>texture.isDisposed));};

test('PM01 a premultiplied page is admitted and drawn from a straight copy; the other page is drawn as it is',async t=>{
 const s=await setup(t),group=s.load();await group.ready;
 const asset=group.getSpine('e_json');
 assert.deepEqual(asset.info.pages.map(page=>page.sourcePremultiplied),[true,false]);
 view(s,asset);
 const frame=s.engine.captureSharedFrame({width:64,height:64}),pages=frame.pages.map(page=>[...copyImageData2DPixels(page.source)]);
 assert.equal(pages.length,2);
 assert.deepEqual(pages[0],straight);
 assert.deepEqual(pages[1],[0,0,255,255,0,0,255,255,0,0,255,255,0,0,255,255]);
 // The page the caller's provider gave is untouched: the copy is the loader's own.
 assert.deepEqual([...copyImageData2DPixels(s.p.textures[0].imageData)],stored);
});

test('PM02 the copy is paid for by the setup, four bytes a pixel, and is given back with it',async t=>{
 const plain=await setup(t,{atlasText:atlas}),a=plain.load();await a.ready;const base=plain.loader.getStatus().setupBytes;
 // The atlas text is paid for by its length: 'true' is one character shorter than 'false', two bytes.
 const copyBase=base-2,s=await setup(t),group=s.load();await group.ready;
 assert.equal(s.loader.getStatus().setupBytes,copyBase+16);
 // Two groups share the one setup and the one copy.
 const again=s.load();await again.ready;
 assert.equal(s.loader.getStatus().setupBytes,copyBase+16);assert.equal(s.loader.getStatus().liveSetups,1);
 group.dispose();again.dispose();await s.loader.close();drained(s);
 // Both pages premultiplied: two copies.
 const both=await setup(t,{atlasText:atlas.replaceAll('pma: false','pma: true')}),g=both.load();await g.ready;
 assert.equal(both.loader.getStatus().setupBytes,base-4+32);
 await both.loader.close();drained(both);
});

test('PM03 a copy the budget cannot hold refuses the setup and leaves nothing behind',async t=>{
 const plain=await setup(t,{atlasText:atlas}),a=plain.load();await a.ready;const base=plain.loader.getStatus().setupBytes;
 const s=await setup(t,{options:{maxSetupBytes:base-2+15}}),group=s.load();
 const error=await group.ready.then(()=>undefined,cause=>cause);
 assert.ok(codes(error).includes('SPINE_SETUP_BUDGET_FAILED'),codes(error).join());
 assert.equal(group.isDisposed,true);await s.loader.close();drained(s);
 const enough=await setup(t,{options:{maxSetupBytes:base-2+16}}),ok=enough.load();await ok.ready;assert.equal(enough.loader.getStatus().setupBytes,base-2+16);
});
