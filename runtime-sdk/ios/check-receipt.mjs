// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
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
  assert.equal(receipt.drawablePresented,true);
  assert.match(receipt.pixels0,/^[a-f0-9]{64}$/);
  assert.match(receipt.pixels7,/^[a-f0-9]{64}$/);
  assert.notEqual(receipt.pixels0,receipt.pixels7);
  console.log('Simulator JSC, Rust decoder, Metal pixels, actual drawable presentation, release and reconstruction verified.');
}
