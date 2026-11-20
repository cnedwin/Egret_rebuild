// SPDX-License-Identifier: Apache-2.0
import { Mesh2D, Sprite, createAssetRef, createAssetType, createSharedGeometry2D, createTexture, isTexture } from '@egret/engine';
import { installPlayerProject } from '@egret/android-player-project';

// Nine shared vertices form eight triangles. Each pose moves both the outline and interior seams.
const indices = new Uint16Array([0, 1, 4, 0, 4, 3, 1, 2, 5, 1, 5, 4, 3, 4, 7, 3, 7, 6, 4, 5, 8, 4, 8, 7]);
const uvs = new Float32Array([0, 0, .5, 0, 1, 0, 0, .5, .5, .5, 1, .5, 0, 1, .5, 1, 1, 1]);
const lightColors = new Float32Array(9 * 4).fill(1);
const darkColors = new Float32Array(9 * 3);
const mantle = [107, 237, 178, 212, 245, 231, 85, 350, 176, 327, 254, 336, 54, 470, 176, 445, 282, 475];
const mask = [123, 170, 174, 189, 221, 166, 116, 228, 172, 230, 235, 219, 142, 274, 179, 287, 217, 264];

function geometry(base, flutter, isMantle) {
  const positions = new Float32Array(base);
  if (isMantle) {
    positions[8] += flutter;
    positions[9] -= flutter;
    positions[12] -= flutter * 2;
    positions[15] += flutter;
    positions[16] += flutter * 2;
  } else {
    positions[4] += flutter;
    positions[5] -= flutter;
    positions[8] += flutter;
    positions[14] += flutter;
  }
  return createSharedGeometry2D({ positions, uvs, lightColors, darkColors, indices });
}

async function create({ engine, scope, raster, publishPage }) {
  const type = createAssetType('kite-courier-atlas', isTexture);
  let texturesLoaded = 0, texturesReleased = 0;
  const region = { x: 4, y: 4, width: 8, height: 8 };
  engine.assets.register(type, {
    async load(ref, { signal }) {
      const image = await raster.loadPng('assets/' + ref.id + '.png', 16, 16, signal);
      const texture = createTexture(image, region);
      texturesLoaded++;
      return texture;
    },
    dispose(texture) { texture.dispose(); texturesReleased++; }
  });
  const refs = ['mantle', 'mask'].map(name => createAssetRef(type, name));
  const leases = await engine.createAssetGroup(scope, refs).ready;
  leases.forEach((lease, index) => scope.use(publishPage(index + 1, lease.value.imageData)));
  const root = engine.stage;
  function panel(x, y, width, height, color) {
    const sprite = scope.use(new Sprite());
    sprite.graphics.beginFill(color).drawRect(x, y, width, height).endFill();
    root.addChild(sprite);
  }
  panel(30, 122, 300, 385, 0x294654);
  panel(44, 138, 272, 6, 0x81aaa8);
  const poses = Array.from({ length: 17 }, (_, i) => [geometry(mantle, i - 8, true), geometry(mask, i - 8, false)]);
  const cape = scope.use(Mesh2D.createBinding(leases[0], poses[0][0]));
  const face = scope.use(Mesh2D.createBinding(leases[1], poses[0][1]));
  const clipped = scope.use(new Sprite());
  clipped.clipRect = { x: 44, y: 152, width: 248, height: 310 };
  root.addChild(clipped);
  clipped.addChild(cape.node);
  // The readout crosses the mantle and passes behind the mask. Its upper indicator covers the mask.
  panel(46, 247, 264, 18, 0x83d5c9);
  root.addChild(face.node);
  panel(210, 222, 62, 10, 0xe2a44d);
  panel(259, 216, 13, 20, 0xffdf94);
  let last = -1;
  return {
    update(elapsedMs) {
      const step = Math.round(elapsedMs * 120 / 1000) % 32;
      const pose = Math.min(step, 32 - step);
      if (pose === last) return;
      cape.prepare(leases[0], poses[pose][0]).commit();
      face.prepare(leases[1], poses[pose][1]).commit();
      last = pose;
    },
    closedSnapshot() { return { texturesLoaded, texturesReleased }; }
  };
}

installPlayerProject({ width: 360, height: 640, clearColor: 0x172733, create });
