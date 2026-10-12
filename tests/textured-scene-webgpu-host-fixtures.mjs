import assert from 'node:assert/strict';
import * as egret from '@egret/engine';
import * as sceneCPU from '@egret/engine/scene3d';
import * as sceneGPU from '@egret/engine/webgpu/scene3d';
import { controlledGPU, code } from './textured-webgpu-host-fixtures.mjs';

// First-party test boundary only. The real SDK creates every scene, asset,
// display node and completed frame. No private product authority is imported.
export const IDENTITY = Object.freeze([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
export const PROJECTION = Object.freeze({kind:'orthographic',left:-1,right:1,bottom:-1,top:1,near:1,far:3});
export function triangleScene() {
  const geometry = sceneCPU.createMeshGeometry3D({
    positions:[0,0,-1,1,0,-1,0,1,-1],
    colors:[1,0,0,0,1,0,0,0,1], indices:[0,1,2],
  });
  return sceneCPU.createSceneFrame3D({projection:PROJECTION,draws:[{geometry,modelView:IDENTITY}]});
}
export const emptyScene = () => sceneCPU.createSceneFrame3D({projection:PROJECTION,draws:[]});
export function emptyDrawScene() {
  const geometry = sceneCPU.createMeshGeometry3D({positions:[],colors:[],indices:[]});
  return sceneCPU.createSceneFrame3D({projection:PROJECTION,draws:[{geometry,modelView:IDENTITY}]});
}
export function combinedFactory(options) {
  assert.equal(typeof sceneGPU.createTexturedSceneWebGPUHost,'function','COMBINED_SCENE_TEXTURED_HOST_REQUIRED');
  return sceneGPU.createTexturedSceneWebGPUHost(options);
}

// Adapt existing test-owned GPU objects; leave the original helper unchanged.
// Independent pipeline/scope/fence/map promises are still the old controls.
export function controlledCombinedGPU() {
  const f = controlledGPU(), combinedHooks = {};
  f.limits.maxUniformBufferBindingSize = 64;
  f.hooks.pipeline = record => {
    if (record.descriptor.depthStencil !== undefined) {
      record.kind = record.value.kind = record.layout.kind = 'scene';
      record.value.getBindGroupLayout = function(index) {
        assert.equal(this,record.value);
        f.calls.push(['layout','scene',index]);
        f.hooks.layout?.('scene',index);
        return record.layout;
      };
    }
    combinedHooks.pipeline?.(record);
  };
  f.hooks.passObject = pass => {
    for (const name of ['setIndexBuffer','drawIndexed']) {
      pass[name] = function(...args) {
        assert.equal(this,pass);
        f.calls.push([name,...args]);
        f.hooks[name]?.(...args);
      };
    }
    combinedHooks.passObject?.(pass);
  };
  return Object.assign(f,{combinedHooks});
}
export async function withCombinedGPU(run) {
  const f = controlledCombinedGPU();
  try { return await run(f); }
  finally { try { await f.cleanup(); } finally { f.restore(); } }
}
export async function activeCombined(f,options={}) {
  const host = f.keep(combinedFactory(f.options(options)));
  await f.ready(host);
  return host;
}
export function admitted(proof) {
  if (proof.thrown) throw proof.cause;
  assert.equal(proof.value,undefined);
}
export function snapshot(f,host) {
  return {calls:f.calls.length,buffers:f.buffers.length,textures:f.textures.length,
    width:f.canvas.width,height:f.canvas.height,status:host.getStatus(),
    textured:host.getTexturedStatus(),scene:host.getSceneStatus()};
}
export function unchanged(f,host,before) {
  assert.deepEqual(snapshot(f,host),before,'refusal leaves the GPU, target, serial and all public facets unchanged');
}
export function jointStatus(host,{serial,frames,upload,geometry,scene,uniform,depth,readback=0}) {
  const base = host.getStatus(), textured = host.getTexturedStatus(), spatial = host.getSceneStatus();
  for (const value of [base,textured,spatial,textured.host,spatial.host]) assert.equal(Object.isFrozen(value),true);
  assert.deepEqual(textured.host,base); assert.deepEqual(spatial.host,base);
  assert.deepEqual([base.lastSerial,base.pendingFrames,base.pendingUploadBytes,base.pendingReadbackBytes],
    [serial,frames,upload,readback]);
  assert.equal(textured.pendingGeometryBytes,geometry);
  assert.deepEqual([spatial.pendingSceneBytes,spatial.pendingUniformBytes,spatial.pendingDepthBytes],
    [scene,uniform,depth]);
}
export function jointOverlay(a) {
  a.clear(); a.addRect(); a.addMesh(a.canonical);
  const frame = a.capture({width:8,height:8,clearAlpha:1});
  assert.deepEqual(frame.commands.map(command=>command.kind),['rect','mesh']);
  assert.equal(frame.geometries[0].logicalByteLength,204);
  return frame;
}
export function emptyOverlay(a) {
  a.clear(); return a.capture({width:8,height:8,clearAlpha:1});
}
export function orderedOverlay(a) {
  a.clear();
  const scope = a.engine.createScope();
  const outer = scope.use(new egret.Sprite()), inner = scope.use(new egret.Sprite());
  outer.clipRect = {x:0,y:0,width:7,height:7};
  inner.clipRect = {x:0,y:0,width:6,height:6}; inner.x = 1; inner.y = 1;
  outer.addChild(inner); a.engine.stage.addChild(outer);
  const rect = () => {
    const node = scope.use(new egret.Sprite());
    node.graphics.beginFill(0x112233).drawRect(1,1,2,2).endFill(); inner.addChild(node);
  };
  const mesh = () => inner.addChild(scope.use(new egret.Mesh2D(a.lease,a.canonical)));
  rect(); mesh();
  const bitmap = scope.use(new egret.Bitmap(a.lease)); bitmap.x = 3; bitmap.y = 3; inner.addChild(bitmap);
  rect(); mesh();
  const frame = a.capture({width:8,height:8,clearColor:0x102030,clearAlpha:1});
  assert.deepEqual(frame.commands.map(command=>command.kind),['rect','mesh','image','rect','mesh']);
  assert.ok(frame.commands.every(command=>command.clips.length===2));
  return {frame,scope};
}
export function noCombinedMethod(host) {
  for (let object=host;object!==null;object=Object.getPrototypeOf(object)) {
    assert.equal(Object.hasOwn(object,'renderSceneTexturedFrame'),false);
  }
}
export function assertBorrowed(f) {
  assert.equal(f.calls.filter(call=>call[0]==='deviceDestroy').length,0,'borrowed device remains caller owned');
}
export const closedCapture = error => error instanceof egret.EgretError && error.code==='ENGINE_CLOSED';
export { code };
