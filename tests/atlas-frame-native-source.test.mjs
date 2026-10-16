// SPDX-License-Identifier: Apache-2.0
// Pure scenario and source policy; does not claim live SDK/native acceptance.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { moduleImports, IMPORTS, APP } from '../tools/atlas-frame/boundary.mjs';
import { assertAtlasObservation, assertAtlasRetirement, ORDINARY, expectedIds } from '../tools/atlas-frame/scenario.mjs';
const root=new URL('..',import.meta.url);
function observation(){return {profile:'canvas-2d',session:{state:'ready',sourceSeconds:.125,gameSeconds:.125,tickId:1,
  ticks:[{tickId:1,elapsedSeconds:.125,deltaSeconds:.125}],diagnostics:[],cleanupErrors:[],actors:{
    left:{mode:'once',state:'running',elapsed:.125,isDisposed:false,bitmapDisposed:false,naturalWidth:4,naturalHeight:5,
      bounds:{x:0,y:0,width:4,height:5},sourceRect:{x:3,y:0,width:2,height:3},
      sample:{frameIndex:1,region:{x:3,y:0,width:2,height:3,layout:{sourceWidth:4,sourceHeight:5,trimX:1,trimY:2,packedRotation:90}},atEnd:false,positionSeconds:.125,stopped:false},
      parent:{x:2,y:2,rotation:0,anchorOffsetX:0,anchorOffsetY:0,clipRect:null}},
    right:{mode:'loop',state:'idle',elapsed:0,isDisposed:false,bitmapDisposed:false,naturalWidth:4,naturalHeight:5,
      bounds:{x:0,y:0,width:4,height:5},sourceRect:{x:0,y:0,width:2,height:3},sample:null,
      parent:{x:12,y:2,rotation:0,anchorOffsetX:0,anchorOffsetY:0,clipRect:null}},
  }},images:[{width:6,height:6,byteLength:144}],commands:[
    {kind:'image',alpha:1,imageIndex:0,rect:{x:0,y:0,width:2,height:3},sourceRect:{x:3,y:0,width:2,height:3},matrix:{a:0,b:-1,c:1,d:0,tx:3,ty:6},clips:[]},
    {kind:'image',alpha:1,imageIndex:0,rect:{x:0,y:0,width:2,height:3},sourceRect:{x:0,y:0,width:2,height:3},matrix:{a:1,b:0,c:0,d:1,tx:13,ty:3},clips:[]},
  ]};}
test('genuine B-state checker refuses A-path, wrong mode, wrong trim and setup drift',()=>{
  assert.equal(assertAtlasObservation(observation(),'N02','rotation-sign','healthy'),true);
  for(const mutate of [value=>value.session.actors.left.sample.frameIndex=0,value=>value.session.actors.left.mode='loop',
    value=>value.session.actors.right.state='running',value=>value.commands[0].matrix.b=1,
    value=>value.commands[0].matrix.ty=5,value=>value.session.actors.left.sample.region.layout.trimY=1,
    value=>value.session.tickId=2,value=>value.session.ticks.push({}),value=>value.commands[0].rect.width=4]){
    assert.equal(assertAtlasObservation(observation(),'N02','rotation-sign','healthy'),true);
    const changed=observation();mutate(changed);assert.throws(()=>assertAtlasObservation(changed,'N02','rotation-sign','healthy'));
    assert.equal(assertAtlasObservation(observation(),'N02','rotation-sign','healthy'),true);
  }
  const sign=observation();sign.commands[0].matrix.b=1;assert.equal(assertAtlasObservation(sign,'N02','rotation-sign','assigned'),true);
  assert.throws(()=>assertAtlasObservation(sign,'N02','trim-y-constant','assigned'));
  const trim=observation();trim.commands[0].matrix.ty=5;assert.equal(assertAtlasObservation(trim,'N02','trim-y-constant','assigned'),true);
});
test('fixed table keeps once terminal, independent loop boundary, held elapsed and exact readback count',()=>{
  assert.equal(ORDINARY.length,10);assert.deepEqual(expectedIds('ordinary'),['N01','N02','N03','N04','N05','N06','N07','N08','N09','N10','N11']);
  assert.deepEqual(expectedIds('rotation-sign'),['rotation-sign:healthy','rotation-sign:assigned']);
  assert.equal(ORDINARY[4].leftElapsed,.125);assert.equal(ORDINARY[4].rightElapsed,.0625);
  assert.equal(ORDINARY[5].leftState,'completed');assert.equal(ORDINARY[6].leftFrame,1);assert.equal(ORDINARY[6].rightFrame,0);
});
test('pure collector retirement policy rejects diagnostic-only cleanup after every terminal flag is true',()=>{
  const baseline=()=>({state:'closed',controllers:[true,true],bitmaps:[true,true],sheets:[true,true],leases:[true,true],textures:[true],
    stage:true,clock:'closed',cleanupErrors:0,cleanupFailures:[],diagnostics:[]});
  for(const mutate of [
    value=>value.diagnostics.push({code:'SCOPE_CLEANUP_FAILED',severity:'error',phase:'scope',cause:{wasUndefined:true}}),
    value=>value.cleanupFailures.push({name:'literal refusal control',error:{wasUndefined:false,message:'assigned pure error'}}),
    value=>value.cleanupErrors=1,
    value=>delete value.diagnostics,
  ]){
    assert.equal(assertAtlasRetirement(baseline()),true);
    const changed=baseline();mutate(changed);assert.throws(()=>assertAtlasRetirement(changed));
    assert.equal(assertAtlasRetirement(baseline()),true);
  }
});
test('public example and fixture imports stay in the finite public SDK surface',()=>{
  for(const relative of [APP+'session.mjs',APP+'image.mjs',APP+'main.mjs','tools/atlas-frame/native-fixture.mjs']){
    const text=fs.readFileSync(new URL(relative,root),'utf8');
    for(const edge of moduleImports(text))assert.ok(edge.specifier.startsWith('.')||['@egret/engine','@egret/engine/web','@egret/engine/webgpu'].includes(edge.specifier),relative+' '+edge.specifier);
    assert.doesNotMatch(text,/packages\/(?:runtime|engine)\/dist|__textRetainedAudit|badRotation|badTrim|mockScene/);
  }
  const html=fs.readFileSync(new URL(APP+'index.html',root),'utf8');
  const match=/<script type="importmap">([^<]+)<\/script>/.exec(html);assert.deepEqual(JSON.parse(match[1]),{imports:IMPORTS});
  const fixture=fs.readFileSync(new URL('tools/atlas-frame/native-fixture.mjs',root),'utf8');
  assert.ok(fixture.indexOf('session.retire()')<fixture.indexOf('replayHost=createHost'));
  assert.match(fixture,/present\(replayHost,replaySurface,savedN01,profile\)/);
});
