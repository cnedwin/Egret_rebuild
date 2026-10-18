import test from 'node:test';
import assert from 'node:assert/strict';
import * as sdk from '@egret/engine';

// Public SDK controls: copied metadata, owned arrays and distinct geometry brands.
test('legacy image and Texture remain genuine before new input admission', () => {
  const image = sdk.createImageData2D({ width: 2, height: 2, pixels: new Uint8Array(16) });
  const texture = sdk.createTexture(image);
  assert.equal(sdk.isTexture(texture), true);
  assert.equal(texture.imageData, image);
  texture.dispose();
  assert.equal(texture.isDisposed, true);
});

test('texture view owns region metadata while keeping packed size and source identity', () => {
  assert.equal(typeof sdk.createTextureView, 'function', 'M1.3 Texture view entry is missing');
  const image = sdk.createImageData2D({ width: 4, height: 4, pixels: new Uint8Array(64) });
  const region = { packed: { x: 1, y: 1, width: 2, height: 1 }, logicalWidth: 3, logicalHeight: 4, trimX: 1, trimY: 1, quarterTurn: 1 };
  const texture = sdk.createTextureView(image, region);
  assert.equal(sdk.isTexture(texture), true);
  assert.equal(texture.imageData, image);
  assert.equal(texture.width, 2);
  assert.equal(texture.height, 1);
  region.packed.x = 0;
  assert.deepEqual(texture.viewRegion, { packed: { x: 1, y: 1, width: 2, height: 1 }, logicalWidth: 3, logicalHeight: 4, trimX: 1, trimY: 1, quarterTurn: 1 });
  assert.ok(Object.isFrozen(texture.viewRegion));
  assert.ok(Object.isFrozen(texture.viewRegion.packed));
  texture.dispose();
  assert.equal(texture.viewRegion.packed.x, 1);
});

test('identity material supplies owned defaults and refuses incompatible region addressing', () => {
  assert.equal(typeof sdk.createSharedMaterial2D, 'function', 'M1.3 material entry is missing');
  const material = sdk.createSharedMaterial2D({});
  assert.deepEqual(material.light, [1, 1, 1, 1]);
  assert.deepEqual(material.dark, [0, 0, 0]);
  assert.equal(material.samplingDomain, 'region');
  assert.equal(material.filter, 'nearest');
  assert.ok(Object.isFrozen(material));
  assert.ok(Object.isFrozen(material.light));
  assert.throws(() => sdk.createSharedMaterial2D({ addressU: 'repeat' }), { name: 'TypeError', message: 'Shared material option is unsupported' });
});

test('shared geometry owns dark coefficients and out-of-region UV without acquiring the old brand', () => {
  assert.equal(typeof sdk.createSharedGeometry2D, 'function', 'M1.3 geometry entry is missing');
  const positions = new Float64Array([-0, 0, 1, 0, 0, 1]);
  const dark = new Float32Array([0, 0.5, 1, 0, 0.5, 1, 0, 0.5, 1]);
  const geometry = sdk.createSharedGeometry2D({ positions, uvs: new Float32Array([-1, 0, 2, 0, 0, 1]),
    lightColors: new Float32Array(12).fill(1), darkColors: dark, indices: new Uint16Array([0, 1, 2]) });
  assert.equal(sdk.isTexturedGeometry2D(geometry), false);
  assert.equal(geometry.logicalByteLength, 276);
  assert.deepEqual(geometry.uvs, [-1, 0, 2, 0, 0, 1]);
  assert.equal(Object.is(geometry.positions[0], -0), false);
  positions[0] = 7;
  dark[1] = 0;
  assert.equal(geometry.positions[0], 0);
  assert.equal(geometry.darkColors[1], 0.5);
  assert.ok(Object.isFrozen(geometry.darkColors));
});
