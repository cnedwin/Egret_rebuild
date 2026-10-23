// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import * as egret from '@egret/engine';
import {host} from './helpers.mjs';
export {egret};
export const MARKERS = Object.freeze([{id:'zero',timeSeconds:0},{id:'half',timeSeconds:0.5},
  {id:'halfAgain',timeSeconds:0.5},{id:'end',timeSeconds:1}].map(Object.freeze));
export function expectCode(action, code) {
  let caught; assert.throws(action, error => {caught=error;assert.equal(error.code,code);return true;});return caught;
}
export function summary(c) {
  const s=c.getStatus();return [s.elapsedSeconds,s.playIndex,s.positionSeconds,s.lastSample?.frameIndex,s.state];
}
export function events(list) {return list.map(e=>e.kind==='marker'?[e.id,e.playIndex,e.timelineSeconds]:['complete',e.totalPlays,e.timelineSeconds]);}
export async function scene({durations=[0.25,0.25,0.25,0.25],onDiagnostic}={}) {
  const loaded=await import('@egret/engine/animation').then(value=>({value}),error=>({error}));
  assert.equal(loaded.error,undefined,'SEQUENCE_CONTROL_PUBLIC_ENTRY_REQUIRED');
  const diagnostics=[],port=host();
  const engine=await egret.createEngine({host:port.adapter,clock:{maxDeltaSeconds:1},
    onDiagnostic(d){diagnostics.push(d);onDiagnostic?.(d);}});
  const resources=engine.createScope(),scope=engine.createScope();
  const image=egret.createImageData2D({width:4,height:1,pixels:new Uint8Array([
    255,0,0,255,0,255,0,255,0,0,255,255,255,255,0,255])});
  const texture=egret.createTexture(image); let disposed=0;
  const type=egret.createAssetType('sequence-controller-atlas',egret.isTexture);
  engine.assets.register(type,{async load(){return texture;},dispose(value){disposed++;value.dispose();}});
  const lease=resources.use(await engine.assets.acquire(egret.createAssetRef(type,'atlas')));
  const clip=egret.createSequenceClip({atlasWidth:4,atlasHeight:1,frames:durations.map((durationSeconds,x)=>({x,y:0,width:1,height:1,durationSeconds}))});
  function target(){const b=resources.use(new egret.Bitmap(lease));engine.stage.addChild(b);return b;}
  const bitmap=target();
  const factory=loaded.value.createSequenceController;
  function controller(options={},b=bitmap,s=scope){
    const captured=Object.defineProperties({profile:'egret.sequence-control/1'},Object.getOwnPropertyDescriptors(options));
    return factory(engine,s,b,clip,captured);
  }
  async function close(){await engine.dispose();assert.equal(disposed,1);assert.equal(port.timers.size,0);assert.deepEqual(port.trace,['start','stop','close']);}
  return {engine,resources,scope,clip,image,texture,lease,bitmap,target,controller,factory,diagnostics,port,close};
}
