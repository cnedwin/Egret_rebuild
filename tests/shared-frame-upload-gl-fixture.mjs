// SPDX-License-Identifier: Apache-2.0
// Pure public fixture assembly. Owned GL ports observe commands, not rasterization/native loss.
import assert from 'node:assert/strict';
import * as egret from '@egret/engine';
import { createSharedWebGL2Host } from '@egret/engine/webgl2';
import { createSharedSceneWebGL2Host } from '@egret/engine/webgl2/scene3d';
import { createMeshGeometry3D, createSceneFrame3D, createMatrix4 } from '@egret/engine/scene3d';
import { glPorts } from './fixtures/gl-shared-rendering.mjs';

export { egret, glPorts, createSharedWebGL2Host, createSharedSceneWebGL2Host };
export const MiB = 1024 * 1024;
export const code = suffix => error => error instanceof egret.EgretError && error.code === 'WEBGL2_' + suffix;
export const outcome = promise => promise.then(value => ({ value }), error => ({ error }));
export const turn = () => new Promise(resolve => setTimeout(resolve, 0));
export async function until(predicate, label = 'controlled GL progress') {
  const end = Date.now() + 2000;
  while (!predicate() && Date.now() < end) await turn();
  assert.ok(predicate(), label);
}
export async function pending(promise) {
  let settled = false;
  promise.then(() => { settled = true; }, () => { settled = true; });
  await turn(); assert.equal(settled, false, 'public promise must remain pending');
}
export function requireUpload(host, scene = false) {
  assert.equal(typeof host.getSessionStatus, 'function', 'M15_GL_SESSION_MISSING');
  assert.equal(typeof host.stageSharedFrame, 'function', 'M15_GL_UPLOAD_MISSING');
  if (scene) assert.equal(typeof host.stageSceneSharedFrame, 'function', 'M15_GL_SCENE_UPLOAD_MISSING');
}
export function sceneFrame(count = 1) {
  const geometry = createMeshGeometry3D({ positions:[0,0,-1,1,0,-1,0,1,-1], colors:[1,0,0,0,1,0,0,0,1], indices:[0,1,2] });
  const modelView = createMatrix4([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
  return createSceneFrame3D({ projection:{kind:'orthographic',left:-1,right:1,bottom:-1,top:1,near:1,far:3},
    draws:Array.from({ length:count }, () => ({ geometry, modelView })) });
}
export function signalPort() {
  const trace = [], listeners = new Set();
  let aborted = false, reason;
  const f = { trace, onRead:undefined, onAdd:undefined, onRemove:undefined };
  const signal = {
    get aborted() { trace.push('aborted'); f.onRead?.('aborted'); return aborted; },
    get reason() { trace.push('reason'); f.onRead?.('reason'); return reason; },
    get addEventListener() { trace.push('add'); f.onRead?.('add'); return function(type, listener) {
      assert.equal(this, signal); assert.equal(type, 'abort'); trace.push('subscribe'); listeners.add(listener); f.onAdd?.();
    }; },
    get removeEventListener() { trace.push('remove'); f.onRead?.('remove'); return function(type, listener) {
      assert.equal(this, signal); assert.equal(type, 'abort'); trace.push('unsubscribe'); listeners.delete(listener); f.onRemove?.();
    }; },
  };
  return Object.assign(f, { signal, count:() => listeners.size,
    mark(cause) { aborted = true; reason = cause; },
    abort(cause) { aborted = true; reason = cause; for (const listener of [...listeners]) listener.call(signal); },
  });
}
export function uploadRows(events) { return events.filter(row => row[0] === 'bufferSubData' || row[0] === 'texSubImage2D'); }
export function visibleRows(events) { return events.filter(row => ['drawArrays','drawElements','readPixels','getBufferSubData'].includes(row[0])); }
export function payloadBytes(name, args) {
  if (name === 'bufferSubData') return args[2].byteLength;
  if (name === 'texSubImage2D') return args[4] * args[5] * 4;
  return 0;
}
// Each first native write schedules one real marker. Only that marker resets the
// aggregate. A native callback alone is never counted as a scheduler boundary.
export function taskUploadMeter(ports) {
  const groups = []; let current, marker, closed = false;
  const prior = ports.onCall;
  ports.onCall = (name, args) => {
    prior?.(name, args); const bytes = payloadBytes(name, args); if (!bytes) return;
    if (!current) {
      current = { bytes:0, rows:[] }; groups.push(current);
      marker = setTimeout(() => { current = undefined; marker = undefined; }, 0);
    }
    current.bytes += bytes; current.rows.push({ name, args });
  };
  return { groups, async finish() {
    if (closed) return; closed = true;
    if (marker !== undefined) await turn();
    ports.onCall = prior;
  } };
}
export async function hosted(body, { scene = false, options = {}, ports = glPorts() } = {}) {
  const engine = await egret.createEngine({ host:{surface:{},start(){},stop(){},async close(){},setTimeout(){return () => {};}} });
  const scope = engine.createScope(), resources = engine.createScope();
  const sprite = scope.use(new egret.Sprite()); engine.stage.addChild(sprite);
  sprite.graphics.beginFill(0xff0000).drawRect(0,0,4,4).endFill();
  const textures = new Map(), type = egret.createAssetType('upload-gl-owned-textures', egret.isTexture);
  engine.assets.register(type, { async load(ref) { return textures.get(ref.id); }, dispose(texture) { texture.dispose(); } });
  const host = scene ? createSharedSceneWebGL2Host({canvas:ports.canvas,outputAlpha:'opaque',enableReadback:true,...options})
    : createSharedWebGL2Host({canvas:ports.canvas,enableReadback:true,...options});
  const uploads = [], result = { engine, scope, host, ports, sprite, uploads, closeMode:'safe' };
  const frame = (width = 8, height = 8) => engine.captureSharedFrame({width,height,...(scene ? {outputAlpha:'opaque',clearAlpha:1} : {})});
  Object.assign(result, { frame, scene:sceneFrame(),
    stage(captured = frame(), uploadOptions) { const ticket = host.stageSharedFrame(captured, uploadOptions); uploads.push(ticket); void outcome(ticket.ready); return ticket; },
    stageScene(sceneInput = result.scene, overlay = frame(), uploadOptions) { const ticket = host.stageSceneSharedFrame(sceneInput, overlay, uploadOptions); uploads.push(ticket); void outcome(ticket.ready); return ticket; },
    async images(count, width = 1024, height = 1024) {
      const nodes = [], images = [], leases = [];
      for (let i = 0; i < count; i++) {
        const image = egret.createImageData2D({width,height,pixels:new Uint8Array(width * height * 4).fill(127)});
        const texture = egret.createTexture(image), id = 'image-' + textures.size; textures.set(id, texture);
        const group = engine.createAssetGroup(resources, [egret.createAssetRef(type,id)]), members = await group.ready;
        const bitmap = scope.use(new egret.Bitmap(members[0])); engine.stage.addChild(bitmap); nodes.push(bitmap); images.push(image); leases.push(members[0]);
      }
      return { nodes, images, leases };
    },
    async mesh() {
      const {nodes,leases} = await result.images(1,1,1); nodes[0].visible = false;
      const geometry = egret.createSharedGeometry2D({positions:new Float32Array([0,0,2,0,0,2]),
        uvs:new Float32Array([0,0,1,0,0,1]),lightColors:new Float32Array(12).fill(1),
        darkColors:new Float32Array(9),indices:new Uint16Array([0,1,2])});
      const mesh = scope.use(new egret.Mesh2D(leases[0],geometry)); engine.stage.addChild(mesh); return geometry;
    },
  });
  let bodyFailure;
  try {
    // This existing ordinary startup/render/readback baseline always precedes a
    // new API's explicit absence assertion, including every parameterized case.
    await host.start();
    const baseline = frame(), readback = options.enableReadback === false ? undefined : host.requestReadback();
    if (scene) host.renderSceneSharedFrame(result.scene, baseline); else host.renderSharedFrame(baseline);
    if (readback) { const pixels = await readback; assert.deepEqual([pixels.width,pixels.height,pixels.frameId],[8,8,baseline.frameId]); }
    await host.whenIdle(); assert.equal(host.getStatus().lastSerial,1); assert.equal(host.getStatus().pendingFrames,0);
    requireUpload(host, scene);
    return await body(result);
  } catch (error) { bodyFailure = { error }; throw error;
  } finally {
    const cleanupFailures = [];
    try {
      ports.onCall = undefined; ports.fail = undefined; ports.autoSignal = true;
      for (const upload of uploads) { try { upload.dispose(); } catch (error) { cleanupFailures.push(error); } }
      ports.signalAll();
      const closed = await outcome(host.close());
      if (result.closeMode === 'unsafe' || (result.closeMode === 'safe-or-accounted-unsafe' && closed.error)) {
        assert.ok(code('CLOSE_UNSAFE')(closed.error)); assert.equal(host.getStatus().cleanupOutcome,'unsafe');
        const ledger = host.getSharedStatus().retention;
        assert.ok(ledger.unknownBytes > 0 || ledger.unknownNativeBytes > 0 || ledger.unknownNativeObjects > 0);
      } else { if (closed.error) throw closed.error; assert.equal(ports.live().length,0); }
      assert.equal(ports.listenerCount(),0);
    } catch (error) { cleanupFailures.push(error); }
    for (const owner of [scope,resources]) { try { owner.dispose(); } catch (error) { cleanupFailures.push(error); } }
    try { await engine.dispose(); } catch (error) { cleanupFailures.push(error); }
    if (cleanupFailures.length) {
      if (bodyFailure) throw new AggregateError([bodyFailure.error,...cleanupFailures],'GL fixture body and cleanup failed',{cause:bodyFailure.error});
      if (cleanupFailures.length === 1) throw cleanupFailures[0];
      throw new AggregateError(cleanupFailures,'GL fixture cleanup failed');
    }
  }
}
