// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import test from 'node:test';
import {PAGE, createScene} from '../scene/scene.mjs';
import {encodeProjectFrame} from '../scene/project-frame.mjs';
import {openGame} from './fixture-game.mjs';
import {createIosScene} from './scene.mjs';

test('JSC entry emits the same captured EGR2 frames and republishes the same page after renderer loss', async () => {
  const uploads = [];
  const published = createIosScene({now:() => 0, upload(id, width, height, buffer) {
    uploads.push({id, width, height, bytes:Buffer.from(buffer)});
    return true;
  }},openGame);
  const reference = await createScene();
  try {
    await Promise.all([published.start(), published.start()]);
    const pages = new Map([[reference.page,PAGE.id]]);
    for (const index of [0,7,59,60]) {
      const packet = new Uint8Array(published.frame(index));
      assert.equal(Buffer.from(packet.subarray(0,4)).toString(),'EGR2');
      assert.deepEqual(packet,encodeProjectFrame(reference.capture(index),index,pages));
    }
    assert.equal(published.publish(),true);
    assert.equal(published.publish(),true);
    assert.deepEqual(uploads[0],{id:1,width:32,height:8,bytes:Buffer.from(reference.pageBytes())});
    assert.deepEqual(uploads[1],uploads[0]);
  } finally {
    assert.deepEqual(await Promise.all([published.close(),published.close()]),[{releases:1},{releases:1}]);
    await reference.close();
  }
  assert.throws(() => published.frame(0),/unavailable/);
  await assert.rejects(published.start(),/closed/);
});

test('close during opening waits for the real atlas owner and retires it once', async () => {
  const game = createIosScene({now:() => 0, upload() { throw Error('Late upload'); }},openGame);
  const opening = game.start();
  const closing = game.close();
  assert.throws(() => game.publish(),/unavailable/);
  await opening;
  assert.deepEqual(await closing,{releases:1});
  assert.deepEqual(await game.close(),{releases:1});
  assert.throws(() => game.frame(0),/unavailable/);
});

test('invalid customer entries close their owner before exposing pages or frames',async () => {
  let closed = 0;
  const page = {slot:1,width:1,height:1,source:{},pixels:()=>new Uint8Array(4)};
  const game = createIosScene({upload() { throw Error('Unexpected GPU write'); }},async () => ({
    width:80,height:60,pages:[page,{...page,source:{}}],capture() {},close() { closed++; }
  }));
  await assert.rejects(game.start(),/Invalid iOS atlas page/);
  assert.equal(closed,1);
  assert.throws(()=>game.publish(),/unavailable/);
  await assert.rejects(game.close(),/Invalid iOS atlas page/);
  assert.equal(closed,1);
});
