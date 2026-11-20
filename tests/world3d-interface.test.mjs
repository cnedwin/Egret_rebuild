// Scenes saved with the game's geometry by name, and 3D text traced from the page's fonts: from the notes of Tea
// Horse Road, whose camps saved every vertex and whose signs needed a font of their own. The tracing itself is
// checked in a browser; here, what Node can check.
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  Mesh3D,
  Scene3D,
  createBoxGeometry3D,
  createSphereGeometry3D,
  createUnlitMaterial3D,
  deserializeScene3D,
  serializeScene3D
} from '@egret/engine/world3d';
import * as webgl2 from '@egret/engine/webgl2/world3d';
import * as webgpu from '@egret/engine/webgpu/world3d';

test('IF01 a geometry the game can make again is saved by its key and found again by it; a missing key loads empty', () => {
  const tent = createBoxGeometry3D(2, 1, 3),
    drum = createSphereGeometry3D();
  tent.name = 'tent';
  const scene = new Scene3D(),
    material = createUnlitMaterial3D();
  scene.addChild(new Mesh3D(tent, material));
  scene.addChild(new Mesh3D(tent, material));
  scene.addChild(new Mesh3D(drum, material));
  const whole = JSON.stringify(serializeScene3D(scene)).length;
  const saved = serializeScene3D(scene, { geometryKey: geometry => (geometry === tent ? 'camp/tent' : undefined) });
  assert.deepEqual(saved.geometries[0], { key: 'camp/tent' }, 'shared once, by key');
  assert.ok(saved.geometries[1].attributes, 'the other is saved whole');
  assert.ok(JSON.stringify(saved).length < whole, 'smaller');
  const asked = [];
  const restored = deserializeScene3D(JSON.parse(JSON.stringify(saved)), {
    resolveGeometry: key => {
      asked.push(key);
      return tent;
    }
  });
  assert.deepEqual(asked, ['camp/tent']);
  const meshes = restored.root.children.filter(child => child instanceof Mesh3D);
  assert.equal(meshes[0].geometry, tent);
  assert.equal(meshes[1].geometry, tent);
  restored.dispose();
  assert.equal(tent.isDisposed, false, "the game's geometry stays the game's");
  // Without a resolver the scene still loads, with an empty geometry named by the key.
  const bare = deserializeScene3D(JSON.parse(JSON.stringify(saved)));
  const empty = bare.root.children[0].geometry;
  assert.equal(empty.name, 'camp/tent');
  assert.equal(empty.drawCount, 0);
  bare.dispose();
  assert.equal(empty.isDisposed, true);
});

test('IF02 both backends export the canvas font; it refuses bad options, and needs a canvas', () => {
  assert.equal(webgl2.createCanvasFont3D, webgpu.createCanvasFont3D);
  for (const bad of [
    { resolution: 8 },
    { resolution: 64.5 },
    { family: '' },
    { family: 'x; color: red' },
    { style: 'oblique' },
    { tolerance: -1 }
  ])
    assert.throws(
      () => webgl2.createCanvasFont3D(bad),
      error => error.code === 'WORLD3D_INPUT_INVALID',
      JSON.stringify(bad)
    );
  if (typeof globalThis.OffscreenCanvas !== 'function')
    assert.throws(
      () => webgl2.createCanvasFont3D(),
      error => error.code === 'WORLD3D_CONTEXT_UNAVAILABLE'
    );
});
