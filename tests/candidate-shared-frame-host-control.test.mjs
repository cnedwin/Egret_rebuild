// SPDX-License-Identifier: Apache-2.0
// Public controlled-port authority check only: no rasterization or native acceptance.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createSharedWebGL2Host } from '@egret/engine/webgl2';
import { glPorts } from './fixtures/gl-shared-rendering.mjs';
import { fixture, candidate, requireCandidate, hasCode } from './candidate-shared-frame-fixture.mjs';

test('CANDIDATE H01 existing shared Host accepts genuine candidate and rejects copied metadata', async () => fixture(async f => {
  const prepared = await f.prepare(); requireCandidate(f.engine);
  const ports = glPorts(), host = createSharedWebGL2Host({ canvas: ports.canvas });
  try {
    await host.start();
    // A genuine ordinary frame qualifies the existing controlled Host first.
    host.renderSharedFrame(f.capture()); await host.whenIdle();
    assert.equal(host.getStatus().lastSerial, 1);
    const saved = candidate(f, prepared.ticket), eventCount = ports.events.length;
    assert.throws(() => host.renderSharedFrame({ ...saved }), hasCode('WEBGL2_FRAME_PROFILE_UNSUPPORTED'));
    assert.equal(ports.events.length, eventCount); assert.equal(host.getStatus().lastSerial, 1);
    assert.equal(host.renderSharedFrame(saved), undefined); await host.whenIdle();
    assert.equal(host.getStatus().lastSerial, 2); assert.equal(host.getStatus().pendingFrames, 0);
    assert.equal(f.target.textureLease, f.old.lease);
  } finally { await host.close(); }
  assert.equal(ports.live().length, 0); assert.equal(ports.listenerCount(), 0);
}));
