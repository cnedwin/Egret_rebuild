// SPDX-License-Identifier: Apache-2.0
// Public built SDK behavior over controlled GPU ports; no Native/pixel claim.
import test from 'node:test';
import assert from 'node:assert/strict';
import { egret, BIG, MATRIX, tick, code, image, view, frame, triangleScene, withGpu,
  withAuthored, imagesOf, writesOf, bindingsOf, admitted, submitSafe, refused,
  snapshot, pressureInputs, prepareReady, refusalLruWitness } from './fixtures/gpu-image-residency.mjs';

test('SUPPORT genuine Engine Scope lease Bitmap Mesh scene and original GPU proof ports', async () => {
  await withAuthored(a => withGpu(async f => {
    const h = f.host({ enableReadback: true }, 'combined'); await f.ready(h);
    assert.equal(a.engine instanceof egret.Engine, true); assert.equal(a.lease instanceof egret.AssetLease, true);
    assert.equal(a.lease.value, a.texture); assert.equal(a.scope.state, 'open');
    a.engine.stage.addChild(a.mesh);
    const input = a.textured(), scene = triangleScene();
    assert.deepEqual(input.commands.map(c => c.kind), ['image', 'mesh']);
    const ticket = h.requestReadback(); ticket.catch(() => {});
    const r = f.capture(() => h.renderSceneTexturedFrame(scene, input)); admitted(r);
    assert.equal(r.scopes.length, 3); assert.equal(r.fences.length, 1); assert.equal(r.maps.length, 1);
    assert.equal(imagesOf(f).length, 1); assert.equal(writesOf(f).length, 1);
    const texture = imagesOf(f)[0];
    assert.deepEqual(texture.descriptor, { size: { width: 1, height: 1, depthOrArrayLayers: 1 },
      dimension: '2d', format: 'rgba8unorm', mipLevelCount: 1, sampleCount: 1, usage: 6 });
    assert.deepEqual([...writesOf(f)[0][2]], [255, 64, 0, 255]);
    assert.equal(writesOf(f)[0][1].texture, texture);
    const imageBindings = bindingsOf(f).filter(Boolean); assert.deepEqual(imageBindings, [texture, texture]);
    assert.equal(h.getStatus().pendingUploadBytes, 372); // scene148 + image112 + mesh112
    assert.equal(h.getTexturedStatus().pendingGeometryBytes, 204);
    assert.equal(h.getSceneStatus().pendingSceneBytes, 84);
    assert.equal(h.getSceneStatus().pendingUniformBytes, 64);
    assert.equal(h.getSceneStatus().pendingDepthBytes, 256);
    await r.finish(); assert.equal((await ticket).serial, 1); await h.whenIdle();
    assert.ok(r.buffers.every(b => b.destroyed === 1));
    assert.equal(f.open, 0); assert.ok(f.scopes.length >= 9);
    await f.close(h); assert.equal(texture.destroyed, 1);
    assert.equal(f.calls.filter(c => c[0] === 'deviceDestroy').length, 0);
  }));
});

test('C01 serial ten safe submissions reuse one exact texture and upload', async () => {
  await withGpu(async f => {
    const h = f.host(); await f.ready(h); const input = frame([view(image(1, 1, new Uint8Array([255, 127, 1, 128])))]);
    for (let i = 0; i < 10; i++) {
      const r = f.capture(() => h.renderFrame(input)); admitted(r);
      assert.equal(h.getStatus().pendingUploadBytes, 112, 'warm retains original vertices and alpha uniform charges');
      assert.equal(h.getStatus().lastSerial, i + 1); await r.finish(); await h.whenIdle();
    }
    console.log(JSON.stringify({ case: 'C01', completedSerials: h.getStatus().lastSerial,
      imageCreates: imagesOf(f).length, imageWrites: writesOf(f).length,
      imageDestroyAttempts: imagesOf(f).map(t => t.destroyed), firstUpload: [...writesOf(f)[0][2]] }));
    assert.equal(imagesOf(f).length, 1, 'missing cross-submission image residency');
    assert.equal(writesOf(f).length, 1); assert.deepEqual([...writesOf(f)[0][2]], [128, 64, 1, 128]);
    const resource = imagesOf(f)[0]; assert.ok(bindingsOf(f).every(t => t === resource));
    assert.equal(resource.destroyed, 0); await f.close(h); assert.equal(resource.destroyed, 1);
  });
});

test('C02 same submission repeated image and mesh have one realized view', async () => {
  await withAuthored(a => withGpu(async f => {
    const h = f.host({}, 'textured'); await f.ready(h); a.engine.stage.addChild(a.mesh);
    const duplicate = a.scope.use(new egret.Bitmap(a.lease)); a.engine.stage.addChild(duplicate);
    const r = f.capture(() => h.renderTexturedFrame(a.textured())); admitted(r);
    assert.equal(imagesOf(f).length, 1); assert.equal(writesOf(f).length, 1);
    assert.equal(bindingsOf(f).length, 3); assert.ok(bindingsOf(f).every(t => t === imagesOf(f)[0]));
    assert.equal(h.getStatus().pendingUploadBytes, 336); await r.finish();
    assert.equal(imagesOf(f)[0].destroyed, 0); await f.close(h); assert.equal(imagesOf(f)[0].destroyed, 1);
  }));
});

test('C03 equal bytes distinct genuine identities remain separate', async () => {
  await withGpu(async f => {
    const h = f.host(); await f.ready(h);
    const a = image(1, 1, new Uint8Array([1, 2, 3, 255])), b = image(1, 1, new Uint8Array([1, 2, 3, 255]));
    assert.notEqual(a, b); await submitSafe(f, h, frame([view(a)])); await submitSafe(f, h, frame([view(b)]));
    await submitSafe(f, h, frame([view(a)])); assert.equal(imagesOf(f).length, 2);
    assert.deepEqual(bindingsOf(f), [imagesOf(f)[0], imagesOf(f)[1], imagesOf(f)[0]]);
  });
});

test('C04 exact crop distinguishes offsets and extents while negative zero aliases zero', async () => {
  await withGpu(async f => {
    const h = f.host(); await f.ready(h); const source = image(3, 1, new Uint8Array([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255]));
    const a = view(source, { x: 0, y: 0, width: 1, height: 1 }), b = view(source, { x: 1, y: 0, width: 1, height: 1 }),
      c = view(source, { x: 0, y: 0, width: 2, height: 1 });
    for (const v of [a, b, c, view(source, { x: -0, y: -0, width: 1, height: 1 })]) await submitSafe(f, h, frame([v]));
    assert.equal(imagesOf(f).length, 3); assert.deepEqual(writesOf(f).map(c => [...c[2]]),
      [[255, 0, 0, 255], [0, 255, 0, 255], [255, 0, 0, 255, 0, 255, 0, 255]]);
    assert.equal(bindingsOf(f).at(-1), imagesOf(f)[0]);
  });
});

test('C05 transforms clips alpha and mesh light preserve same crop identity', async () => {
  await withAuthored(a => withGpu(async f => {
    const h = f.host({}, 'textured'); await f.ready(h); a.engine.stage.addChild(a.mesh);
    await submitSafe(f, h, a.textured(), v => h.renderTexturedFrame(v));
    a.bitmap.x = 1; a.bitmap.alpha = .25; a.bitmap.clipRect = { x: 0, y: 0, width: 1, height: 1 };
    a.mesh.x = 1; a.mesh.alpha = .5; a.mesh.setContent(a.lease, a.geometry(.25));
    await submitSafe(f, h, a.textured(), v => h.renderTexturedFrame(v));
    assert.equal(imagesOf(f).length, 1); assert.equal(writesOf(f).length, 1);
    assert.ok(bindingsOf(f).every(t => t === imagesOf(f)[0]));
    const uniforms = f.calls.filter(c => c[0] === 'writeBuffer' && c[1].descriptor.usage === 72);
    assert.deepEqual(uniforms.slice(-2).map(c => new Float32Array(c[3].buffer)[0]), [.25, .5]);
  }));
});

test('C06 two Hosts borrowing one device own independent residencies', async () => {
  await withGpu(async f => {
    const a = f.host(), b = f.host({ canvas: { width: 8, height: 8, getContext: () => f.context } });
    await f.ready(a); await f.ready(b); const input = frame();
    await submitSafe(f, a, input); await submitSafe(f, b, input); await submitSafe(f, a, input); await submitSafe(f, b, input);
    assert.equal(imagesOf(f).length, 2); assert.notEqual(imagesOf(f)[0], imagesOf(f)[1]);
    assert.deepEqual(bindingsOf(f), [imagesOf(f)[0], imagesOf(f)[1], imagesOf(f)[0], imagesOf(f)[1]]);
    await f.close(a); assert.equal(imagesOf(f)[0].destroyed, 1); assert.equal(imagesOf(f)[1].destroyed, 0);
    await f.close(b); assert.equal(imagesOf(f)[1].destroyed, 1);
  });
});

test('C07 saved immutable capture outlives source lease while fresh capture refuses', async () => {
  await withAuthored(a => withGpu(async f => {
    const h = f.host(); await f.ready(h); const saved = a.capture(); await submitSafe(f, h, saved);
    a.lease.release(); a.engine.assets.invalidate(a.ref);
    assert.throws(() => a.capture(), e => e instanceof egret.EgretError);
    a.texture.dispose(); await submitSafe(f, h, saved); assert.equal(imagesOf(f).length, 1);
    assert.deepEqual([...writesOf(f)[0][2]], [255, 64, 0, 255]);
  }));
});

test('B01 exact 32 MiB allocation boundary uses oldest byte prefix', async () => {
  await withGpu(async f => {
    const h = f.host(); await f.ready(h); const items = Array.from({ length: 9 }, () => view(image(1024, 1024)));
    for (let i = 0; i < 8; i++) await submitSafe(f, h, frame([items[i]]));
    const resources = imagesOf(f).slice(); assert.equal(f.logicalBytes, 33554432); assert.equal(resources.length, 8);
    const ninth = f.capture(() => h.renderFrame(frame([items[8]]))); admitted(ninth);
    assert.equal(resources[0].destroyed, 1); assert.ok(resources.slice(1).every(t => t.destroyed === 0));
    assert.equal(f.logicalBytes, 33554432); assert.equal(f.peakBytes, 33554432); await ninth.finish();
    await submitSafe(f, h, frame([items[1]])); assert.equal(imagesOf(f).length, 9);
  });
});

test('B01 directory and byte pressure share first-use LRU prefix and protect current hits', async () => {
  await withGpu(async f => {
    const h = f.host(); await f.ready(h); const p = pressureInputs(249), r = await prepareReady(f, h, p);
    // Protect the oldest large hit in this submission; the next eligible large is victim.
    const record = f.capture(() => h.renderFrame(frame([p.large[0], p.filler]))); admitted(record);
    assert.equal(r[0].destroyed, 0); assert.equal(r[1].destroyed, 1);
    assert.ok(r.slice(2).every(t => t.destroyed === 0)); await record.finish();
    // Hit touch makes the first large newer; newly cold large requires byte and slot prefix.
    await submitSafe(f, h, frame([p.next])); assert.equal(r[2].destroyed, 1);
    assert.equal(r[0].destroyed, 0); assert.equal(r.at(-1).destroyed, 0);
  });
});

test('B01 combined byte and directory pressure consumes one eligible prefix with current-hit protection', async () => {
  await withGpu(async f => {
    const h = f.host(); await f.ready(h); const p = pressureInputs(249);
    for (const v of [...p.small.slice(0, 249), ...p.large]) await submitSafe(f, h, frame([v]));
    const r = imagesOf(f).slice(); assert.equal(r.length, 256); assert.ok(r.every(t => !t.destroyed)); assert.equal(f.logicalBytes, 29361124);
    const start = f.calls.length, next = f.capture(() => h.renderFrame(frame([p.small[0], p.next]))); admitted(next);
    // Q+4MiB exceeds the budget by996B. The first4B hit is protected:
    // 248 other tiny victims leave4B excess, requiring the next oldest4MiB.
    assert.deepEqual(f.calls.slice(start).filter(c => c[0] === 'destroyTexture').map(c => c[1]), r.slice(1, 250));
    assert.equal(r[0].destroyed, 0); assert.ok(r.slice(1, 250).every(t => t.destroyed === 1));
    assert.ok(r.slice(250).every(t => !t.destroyed)); assert.equal(f.logicalBytes, 29360132);
    assert.equal(next.textures.length, 1); await next.finish();
  });
});

test('B02 ordinary maxPendingFrames3 permits third cold when 256 READY are pinned', async () => {
  await withGpu(async f => {
    const h = f.host({ maxPendingFrames: 3 }); await f.ready(h);
    const atlas = image(17, 16), views = Array.from({ length: 257 }, (_, i) => view(atlas, { x: i % 17, y: Math.floor(i / 17), width: 1, height: 1 }));
    for (const item of views.slice(0, 256)) await submitSafe(f, h, frame([item]));
    const original = imagesOf(f).slice(); assert.equal(original.length, 256); assert.ok(original.every(t => !t.destroyed));
    const a = f.capture(() => h.renderFrame(frame(views.slice(0, 128)))), b = f.capture(() => h.renderFrame(frame(views.slice(128, 256)))); admitted(a); admitted(b);
    const c = f.capture(() => h.renderFrame(frame([views[256]]))); admitted(c);
    assert.equal(h.getStatus().pendingFrames, 3); assert.equal(h.getStatus().pendingUploadBytes, 28784);
    await c.finish(); const transient = imagesOf(f).at(-1); assert.equal(transient.destroyed, 1);
    assert.ok(original.every(t => t.destroyed === 0)); await a.finish(); await b.finish();
    await submitSafe(f, h, frame([views[256]])); assert.equal(imagesOf(f).length, 258, 'transient is never resurrected');
  });
});

test('SUPPORT B03 textured and combined options still reject maxPendingFrames3', async () => {
  await withGpu(async f => {
    for (const kind of ['textured', 'combined']) assert.throws(() => f.host({ maxPendingFrames: 3 }, kind), code('OPTIONS_INVALID'));
    for (const kind of ['ordinary', 'scene']) { const h = f.host({ maxPendingFrames: 4 }, kind); await f.ready(h); await f.close(h); }
  });
});

test('B04 slots are not reserved and out-of-order records promote only current free slots', async () => {
  await withGpu(async f => {
    const h = f.host({ maxPendingFrames: 4 }); await f.ready(h); const p = pressureInputs(248); await prepareReady(f, h, p);
    const a = f.capture(() => h.renderFrame(frame([p.filler]))), b = f.capture(() => h.renderFrame(frame([p.cold]))); admitted(a); admitted(b);
    await b.finish(); assert.equal(b.textures[0].destroyed, 0); await a.finish(); assert.equal(a.textures[0].destroyed, 1);
    await submitSafe(f, h, frame([p.cold])); assert.equal(imagesOf(f).at(-1), b.textures[0], 'earlier completion wins the final slot');
    await submitSafe(f, h, frame([p.filler])); assert.notEqual(imagesOf(f).at(-1), a.textures[0]);
    assert.equal(a.textures[0].destroyed, 1);
  });
});

test('B04 same-record promotion precedes transient callback and transferred owner is never double-cleaned', async () => {
  await withGpu(async f => {
    const h = f.host({ maxPendingFrames: 5 }); await f.ready(h); const p = pressureInputs(248), ready = await prepareReady(f, h, p);
    const a = f.capture(() => h.renderFrame(frame(p.readers[0]))), b = f.capture(() => h.renderFrame(frame(p.readers[1]))); admitted(a); admitted(b);
    // Pin the only remaining old entry too, so nested admission can evict only
    // the newly promoted candidate A, never another preexisting READY owner.
    const pinOldest = f.capture(() => h.renderFrame(frame([p.large[0]]))); admitted(pinOldest);
    const outer = f.capture(() => h.renderFrame(frame([p.filler, p.cold]))); admitted(outer);
    const promoted = outer.textures[0], transient = outer.textures[1]; let nested, triggered = 0;
    f.hooks.destroyTexture = t => {
      if (t !== transient) return; triggered++; assert.equal(promoted.destroyed, 0);
      nested = f.capture(() => h.renderFrame(frame([p.small[250]]))); admitted(nested);
      assert.equal(promoted.destroyed, 1); assert.ok(ready.every(t => !t.destroyed));
    };
    await outer.finish(); assert.equal(triggered, 1); assert.equal(promoted.destroyed, 1);
    assert.equal(transient.destroyed, 1); await nested.finish(); await pinOldest.finish(); await a.finish(); await b.finish();
  });
});

test('B05 cold collision keeps first completed winner and does not touch its LRU age', async () => {
  await withGpu(async f => {
    const h = f.host({ maxPendingFrames: 3 }); await f.ready(h); const input = frame();
    const a = f.capture(() => h.renderFrame(input)), b = f.capture(() => h.renderFrame(input)); admitted(a); admitted(b);
    assert.notEqual(a.textures[0], b.textures[0]); await b.finish(); await a.finish();
    assert.equal(a.textures[0].destroyed, 1); assert.equal(b.textures[0].destroyed, 0);
    await submitSafe(f, h, input); assert.equal(bindingsOf(f).at(-1), b.textures[0]); assert.equal(imagesOf(f).length, 2);
  });
});

test('B05 collision retirement does not touch winner ahead of a newer READY item', async () => {
  await withGpu(async f => {
    const h = f.host({ maxPendingFrames: 4 }); await f.ready(h); const atlas = image(16, 16), small = Array.from({ length: 256 }, (_, i) =>
      view(atlas, { x: i % 16, y: Math.floor(i / 16), width: 1, height: 1 }));
    for (const item of small.slice(0, 254)) await submitSafe(f, h, frame([item]));
    assert.ok(imagesOf(f).every(t => !t.destroyed));
    const first = f.capture(() => h.renderFrame(frame([small[254]]))), duplicate = f.capture(() => h.renderFrame(frame([small[254]]))); admitted(first); admitted(duplicate);
    await first.finish(); const winner = first.textures[0];
    const a = f.capture(() => h.renderFrame(frame(small.slice(0, 127)))), b = f.capture(() => h.renderFrame(frame(small.slice(127, 254)))); admitted(a); admitted(b);
    const newer = f.capture(() => h.renderFrame(frame([small[255]]))); admitted(newer); await newer.finish();
    await duplicate.finish(); assert.equal(duplicate.textures[0].destroyed, 1);
    const cold = f.capture(() => h.renderFrame(frame())); admitted(cold);
    assert.equal(winner.destroyed, 1, 'collision completion leaves winner older than the newer READY');
    assert.equal(newer.textures[0].destroyed, 0); await cold.finish(); await a.finish(); await b.finish();
  });
});

test('B06 256 READY directory eviction is synchronous busy with caught REENTRANT', async () => {
  await withGpu(async f => {
    const h = f.host({ maxPendingFrames: 4 }); await f.ready(h); const p = pressureInputs(249), ready = await prepareReady(f, h, p);
    assert.equal(f.logicalBytes, 29361124);
    const a = f.capture(() => h.renderFrame(frame(p.readers[0]))), b = f.capture(() => h.renderFrame(frame(p.readers[1]))); admitted(a); admitted(b);
    assert.equal(p.readers[0].length, 128); assert.equal(p.readers[1].length, 127);
    let entered = 0; f.hooks.destroyTexture = t => {
      if (t !== ready[0]) return; entered++; assert.equal(f.logicalBytes, 29361124);
      const before = snapshot(f, h); assert.throws(() => h.renderFrame(frame([p.next])), code('REENTRANT'));
      assert.deepEqual(snapshot(f, h), before);
    };
    const c = f.capture(() => h.renderFrame(frame([p.filler]))); admitted(c);
    assert.equal(entered, 1, 'directory victim must be destroyed before third cold render returns');
    assert.equal(ready[0].destroyed, 1); assert.equal(f.logicalBytes, 25166824);
    await c.finish(); assert.equal(entered, 1, 'retirement must not evict READY'); assert.equal(c.textures[0].destroyed, 0);
    assert.equal(h.getStatus().lastSerial, 259); await a.finish(); await b.finish();
  });
});

test('B07 255 READY transient retirement reenters at serial259 to260 preserving Q charge', async () => {
  await withGpu(async f => {
    const h = f.host({ maxPendingFrames: 4 }); await f.ready(h); const p = pressureInputs(248), ready = await prepareReady(f, h, p);
    assert.equal(f.logicalBytes, 29361120);
    const a = f.capture(() => h.renderFrame(frame(p.readers[0]))), b = f.capture(() => h.renderFrame(frame(p.readers[1]))); admitted(a); admitted(b);
    assert.equal(p.readers[0].length, 127); assert.equal(p.readers[1].length, 127);
    const filler = f.capture(() => h.renderFrame(frame([p.filler]))), cold = f.capture(() => h.renderFrame(frame([p.cold]))); admitted(filler); admitted(cold);
    assert.equal(f.logicalBytes, 29361128); assert.equal(h.getStatus().pendingFrames, 4); assert.equal(h.getStatus().lastSerial, 259);
    await filler.finish(); const winner = filler.textures[0], transient = cold.textures[0]; assert.equal(winner.destroyed, 0);
    let entered = 0, inner; f.hooks.destroyTexture = t => {
      if (t === ready[0]) { assert.equal(f.logicalBytes, 29361128); assert.equal(transient.returned, 0); return; }
      if (t !== transient) return; entered++; assert.equal(f.logicalBytes, 29361128); assert.equal(h.getStatus().pendingFrames, 3);
      assert.equal(h.getStatus().pendingUploadBytes, 28560); // 254 image draws + C
      inner = f.capture(() => h.renderFrame(frame([p.next]))); admitted(inner);
      assert.equal(h.getStatus().lastSerial, 260); assert.equal(h.getStatus().pendingFrames, 4);
      assert.equal(f.logicalBytes, 29361128, 'C stays charged until its destroy returns');
      assert.equal(transient.returned, 0); assert.equal(ready[0].destroyed, 1); assert.equal(winner.destroyed, 0);
      assert.equal(inner.textures[0].logicalBytes, BIG); assert.notEqual(inner.textures[0], ready[0]);
    };
    await cold.finish(); assert.equal(entered, 1, 'transient image hook must actually execute');
    assert.equal(f.logicalBytes, 29361124); assert.equal(f.peakBytes, 29361128);
    assert.equal(transient.destroyed, 1); assert.equal(winner.destroyed, 0); assert.ok(ready.slice(1).every(t => !t.destroyed));
    await inner.finish(); await a.finish(); await b.finish(); await h.whenIdle();
    assert.equal(h.getStatus().lastSerial, 260); assert.equal(imagesOf(f).length, 258);
    await f.close(h); assert.ok(imagesOf(f).every(t => t.destroyed === 1)); assert.equal(f.logicalBytes, 0);
  });
});

for (const mode of ['last-command', '129-views', 'source-table', 'device', 'geometry', 'readback']) {
  test('A01-A04 all-warm admission preserves original refusal: ' + mode, async () => {
    await withGpu(async f => {
      if (mode === 'device') f.limits.maxTextureDimension2D = 8;
      const h = f.host({ maxPreparedVertices: mode === 'geometry' ? 6 : 100000, maxReadbackBytes: 2304, enableReadback: true }); await f.ready(h);
      const warm = view(image()), legal = frame([warm]); await submitSafe(f, h, legal);
      const old = imagesOf(f)[0]; let bad, expected, precedenceBad;
      if (mode === 'last-command') { bad = { ...legal, commands: [...legal.commands, { ...legal.commands[0], alpha: NaN }] }; expected = 'FRAME_INVALID'; }
      if (mode === '129-views') { const atlas = image(129, 1); bad = frame([warm, ...Array.from({ length: 128 }, (_, x) => view(atlas, { x, y: 0, width: 1, height: 1 }))]); expected = 'FRAME_BUDGET'; }
      if (mode === 'source-table') { bad = frame([warm], { images: [warm.source, ...Array.from({ length: 5 }, () => image(1024, 1024))] }); expected = 'FRAME_BUDGET'; }
      if (mode === 'device') { bad = frame([warm, view(image(9, 1))]); expected = 'DEVICE_LIMIT'; }
      if (mode === 'geometry') { bad = frame([warm, warm]); expected = 'FRAME_BUDGET'; }
      if (mode === 'readback') { bad = frame([warm], { width: 8, height: 9 }); expected = 'FRAME_BUDGET'; }
      const ticket = h.requestReadback(); ticket.catch(() => {});
      refused(f, h, () => h.renderFrame(bad), expected);
      // Earlier malformed command keeps precedence over the later view budget.
      if (mode === '129-views') {
        precedenceBad = { ...bad, commands: [...bad.commands.slice(0, -1), { ...bad.commands.at(-1), alpha: NaN }] };
        refused(f, h, () => h.renderFrame(precedenceBad), 'FRAME_INVALID');
      }
      const r = f.capture(() => h.renderFrame(legal)); admitted(r); await r.finish(); assert.equal((await ticket).serial, 2);
      assert.equal(bindingsOf(f).at(-1), old); assert.equal(imagesOf(f).length, 1); assert.equal(old.destroyed, 0);
      // Keep the original armed-ticket/reuse checks above. A fresh healthy Host
      // supplies known LRU ages without the legitimate replay masking refusal.
      const witness = f.host({ maxPreparedVertices: mode === 'geometry' ? 6 : 100000, maxReadbackBytes: 2304, enableReadback: true });
      await f.ready(witness);
      const rejections = [{ run: () => witness.renderFrame(bad), expected }];
      if (precedenceBad) rejections.push({ run: () => witness.renderFrame(precedenceBad), expected: 'FRAME_INVALID' });
      // The readback refusal must carry the same original armed-ticket premise.
      let witnessTicket;
      await refusalLruWitness(f, witness, legal, rejections, undefined, () => {
        if (mode === 'readback') { witnessTicket = witness.requestReadback(); witnessTicket.catch(() => {}); }
      });
      if (witnessTicket) assert.equal((await witnessTicket).serial, 257);
    });
  });
}

test('A05 all-warm joint scene budget retains original gate and then valid joint frame succeeds', async () => {
  await withAuthored(a => withGpu(async f => {
    const h = f.host({ maxUploadBytes: 300, enableReadback: true }, 'combined'); await f.ready(h);
    a.engine.stage.addChild(a.mesh); const overlay = a.textured(), empty = triangleScene(0), scene = triangleScene(1);
    await submitSafe(f, h, overlay, value => h.renderSceneTexturedFrame(empty, value));
    const resource = imagesOf(f)[0], ticket = h.requestReadback(); ticket.catch(() => {});
    refused(f, h, () => h.renderSceneTexturedFrame(scene, overlay), 'FRAME_BUDGET'); // 372 > 300
    const r = f.capture(() => h.renderSceneTexturedFrame(empty, overlay)); admitted(r); await r.finish();
    assert.equal((await ticket).serial, 2); assert.equal(imagesOf(f).length, 1); assert.equal(bindingsOf(f).filter(Boolean).at(-1), resource);
    const witness = f.host({ maxUploadBytes: 300, enableReadback: true }, 'combined'); await f.ready(witness);
    await refusalLruWitness(f, witness, overlay,
      [{ run: () => witness.renderSceneTexturedFrame(scene, overlay), expected: 'FRAME_BUDGET' }],
      value => witness.renderSceneTexturedFrame(empty, value));
  }));
});

test('SUPPORT A06 no coverage still charges complete projection and preserves readback ticket', async () => {
  await withGpu(async f => {
    const h = f.host({ maxPendingFrames: 3, enableReadback: true }); await f.ready(h);
    const views = Array.from({ length: 4 }, () => view(image(1024, 1024))), input = frame(views);
    input.commands = input.commands.map(c => ({ ...c, alpha: 0 }));
    const a = f.capture(() => h.renderFrame(input)), b = f.capture(() => h.renderFrame(input)); admitted(a); admitted(b);
    assert.equal(imagesOf(f).length, 0); assert.equal(h.getStatus().pendingFrames, 2); assert.equal(h.getStatus().pendingUploadBytes, 0);
    const ticket = h.requestReadback(); ticket.catch(() => {}); refused(f, h, () => h.renderFrame(frame()), 'BACKPRESSURE');
    await a.finish(); const c = f.capture(() => h.renderFrame(frame())); admitted(c); await c.finish();
    assert.equal((await ticket).serial, 3); await b.finish();
  });
});

test('A06 warm shared allocations do not refund full per-frame projection admission', async () => {
  await withGpu(async f => {
    const h = f.host({ maxPendingFrames: 3 }); await f.ready(h); const views = Array.from({ length: 4 }, () => view(image(1024, 1024)));
    for (const item of views) await submitSafe(f, h, frame([item]));
    const input = frame(views), a = f.capture(() => h.renderFrame(input)), b = f.capture(() => h.renderFrame(input)); admitted(a); admitted(b);
    assert.equal(a.textures.length, 0); assert.equal(b.textures.length, 0); assert.equal(f.logicalBytes, 16777216);
    assert.equal(h.getStatus().pendingUploadBytes, 896); refused(f, h, () => h.renderFrame(frame()), 'BACKPRESSURE');
    await a.finish(); const c = f.capture(() => h.renderFrame(frame())); admitted(c); await c.finish(); await b.finish();
  });
});
