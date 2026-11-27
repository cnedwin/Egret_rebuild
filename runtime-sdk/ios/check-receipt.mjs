// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {PNG} from 'pngjs';
import {createScene, PAGE} from '../scene/scene.mjs';
import {encodeProjectFrame} from '../scene/project-frame.mjs';
const receipt = JSON.parse(await readFile(process.argv[2],'utf8'));
const scene = await createScene();
try {
  const pages = new Map([[scene.page, PAGE.id]]);
  for (const index of [0,7]) {
    const expected = encodeProjectFrame(scene.capture(index),index,pages);
    assert.equal(receipt['frame'+index],createHash('sha256').update(expected).digest('hex'));
  }
} finally { await scene.close(); }
assert.equal(receipt.releasedAtlases,1);
if (receipt.status === 'metal-unavailable') {
  assert.equal(receipt.metalDevice,null);
  console.log('Simulator JSC/closure verified; MTLCreateSystemDefaultDevice returned nil. Metal pixels and presentation remain open.');
} else {
  assert.equal(receipt.status,'passed',JSON.stringify(receipt));
  assert.ok(receipt.metalDevice);
  assert.equal(receipt.restoredPixelsMatch,true);
  assert.equal(receipt.missingPageCode,2);
  assert.equal(receipt.sampleCount,4);
  assert.equal(receipt.drawableSubmitted,true);
  const viewport = receipt.screenViewport;
  assert.ok(Array.isArray(viewport) && viewport.length === 4 && viewport.every(Number.isFinite));
  const [left, top, width, height] = viewport;
  assert.ok(left >= 0 && top >= 0 && width > 0 && height > 0 && left+width <= 1.001 && top+height <= 1.001);
  const screen = PNG.sync.read(await readFile(path.join(path.dirname(process.argv[2]),'screen.png')));
  // These interior scene points cover the clear, board, border and textured card on a composited screen.
  const probes = [[2,2,71,71,99],[10,10,99,99,137],[20,17,137,137,188],[20,44,99,188,188]];
  for (const [sx,sy,r,g,b] of probes) {
    const x = Math.floor(screen.width*(left + width*(sx+0.5)/320));
    const y = Math.floor(screen.height*(top + height*(sy+0.5)/192));
    const index = 4*(y*screen.width + x);
    const actual = [...screen.data.subarray(index,index+4)];
    assert.ok(actual.length === 4 && actual[3] === 255 && [r,g,b].every((value,i)=>Math.abs(actual[i]-value)<=4),
      `Simulator display at ${sx},${sy}: expected ${[r,g,b]}, observed ${actual}`);
  }
  assert.match(receipt.pixels0,/^[a-f0-9]{64}$/);
  assert.match(receipt.pixels7,/^[a-f0-9]{64}$/);
  assert.notEqual(receipt.pixels0,receipt.pixels7);
  console.log('Simulator JSC, Rust decoder, Metal pixels, composited Simulator screenshot, release and reconstruction verified.');
}
