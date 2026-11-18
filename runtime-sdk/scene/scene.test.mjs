// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import test from 'node:test';
import { encodeFrame, FRAME_MAGIC } from './commands.mjs';
import { CYCLE, HEIGHT, PAGE, WIDTH, createScene } from './scene.mjs';

test('EGR1 preserves the real capture order, projected bounds and cropped atlas UVs', async () => {
  const scene = await createScene();
  try {
    const frame = scene.capture(0);
    const bytes = encodeFrame(frame, 0, scene.page, PAGE.id);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const u32 = offset => view.getUint32(offset, true);
    const f32 = offset => view.getFloat32(offset, true);
    assert.deepEqual(Array.from({ length: 6 }, (_, i) => u32(i * 4)),
      [FRAME_MAGIC, 1, WIDTH, HEIGHT, 0x474763ff, 42]);
    assert.equal(bytes.length, 24 + 42 * 48);
    assert.equal(u32(24), 0);
    assert.equal(u32(28), 0x636389ff);
    const firstCard = 24 + 2 * 48;
    assert.equal(u32(firstCard), PAGE.id);
    assert.equal(u32(firstCard + 4), 0xffffffff);
    assert.deepEqual(Array.from({ length: 10 }, (_, i) => f32(firstCard + 8 + i * 4)),
      [16, 40, 40, 40, 16, 64, 0, 0, 0.25, 1]);
    assert.equal(frame.pages[0].source, scene.page);
    const atlas = scene.pageBytes();
    const next = scene.capture(5);
    const nextView = new DataView(encodeFrame(next, 5, scene.page, PAGE.id).buffer);
    assert.equal(nextView.getFloat32(firstCard + 32, true), 0.25);
    assert.equal(nextView.getFloat32(firstCard + 12, true), 45);
    atlas[0] = 1;
    assert.deepEqual([...scene.pageBytes().slice(0, 4)], [0, 0, 0, 255]);
    assert.throws(() => encodeFrame(frame, 0, {}, PAGE.id), /unleased/);
    assert.throws(() => encodeFrame({ ...frame, commands: [{ kind: 'mesh' }] }, 0, scene.page, PAGE.id), /Unsupported draw/);
  } finally {
    assert.deepEqual(await scene.close(), { releases: 1 });
    assert.deepEqual(await scene.close(), { releases: 1 });
  }
});

test('live wraps to exactly the bytes of a separate cold replay capture', async () => {
  const live = await createScene();
  try {
    const replay = await createScene();
    try {
      for (let slot = 0; slot < CYCLE; slot++) {
        const bytes = encodeFrame(replay.capture(slot), slot, replay.page, PAGE.id);
        for (const index of [slot, slot + CYCLE]) {
          assert.deepEqual(encodeFrame(live.capture(index), slot, live.page, PAGE.id), bytes);
        }
      }
    } finally { await replay.close(); }
  } finally { await live.close(); }
});
