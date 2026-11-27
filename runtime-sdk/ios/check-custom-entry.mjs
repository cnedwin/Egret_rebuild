// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';

// Exercise the separately built customer game without browser globals or Node modules in its isolate.
async function verify(dir) {
  assert.ok(dir,'Supply the prepared moving-square directory');
  const ready = Promise.withResolvers();
  const bridge = {now:() => 0,ready:(width,height) => ready.resolve([width,height]),fail:ready.reject,
    upload() { throw Error('Unexpected atlas upload'); }, schedule() {}, cancel() {}};
  const context = vm.createContext({EgretApple:bridge,EgretNativePlayer:bridge});
  for (const file of ['bootstrap.js','scene.js']) vm.runInContext(await readFile(path.join(dir,file),'utf8'),context);
  assert.deepEqual(await ready.promise,[160,120]);
  const game = context.EgretIosScene;
  assert.equal(game.publish(),true);
  const first = Buffer.from(game.frame(0));
  const next = Buffer.from(game.frame(61));
  for (const [packet,tick] of [[first,0],[next,61]]) {
    assert.equal(packet.subarray(0,4).toString(),'EGR2');
    assert.equal(packet.readUInt32LE(4),tick);
    assert.equal(packet.readUInt32LE(8),160);
    assert.equal(packet.readUInt32LE(12),120);
    assert.equal(packet.readUInt32LE(20),1);
  }
  assert.notDeepEqual(first.subarray(24),next.subarray(24));
  await game.close();
  assert.throws(()=>game.frame(62),/unavailable/);
}
await verify(process.argv[2]);
console.log('Bundled customer game verified at 160 x 120 with two distinct EGR2 frames and clean close.');
