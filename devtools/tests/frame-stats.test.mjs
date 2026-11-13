// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import test from 'node:test';
import { analyzeSharedFrame, createPerformanceMonitor } from '@egret/devtools';

const clipsA = [{ x: 0, y: 0, width: 10, height: 10 }], clipsB = [{ x: 0, y: 0, width: 5, height: 5 }], none = [];
const image = (regionIndex, extra = {}) => ({ kind: 'image', materialIndex: 0, regionIndex, clips: none, ...extra });
const rect = (extra = {}) => ({ kind: 'rect', materialIndex: 0, clips: none, ...extra });
const barrier = (reason) => ({ kind: 'barrier', reason });

function frame(commands, extra = {}) {
    return {
        frameId: 9, width: 640, height: 360, commands,
        pages: [{ source: { width: 256, height: 128 } }, { source: { width: 64, height: 64 } }],
        regions: [{ pageIndex: 0 }, { pageIndex: 0 }, { pageIndex: 1 }],
        materials: [{}, {}], geometries: [{ triangleCount: 10 }, { triangleCount: 4 }], ...extra,
    };
}

test('an empty frame has no runs', () => {
    const stats = analyzeSharedFrame(frame([]));
    assert.equal(stats.commands, 0);
    assert.equal(stats.runs, 0);
    assert.equal(stats.triangles, 0);
    assert.deepEqual(stats.switches, { material: 0, page: 0, region: 0, clip: 0, barrier: 0 });
    assert.equal(stats.pageBytes, 256 * 128 * 4 + 64 * 64 * 4);
    assert.equal(stats.pages, 2); assert.equal(stats.regions, 3); assert.equal(stats.materials, 2); assert.equal(stats.geometries, 2);
    assert.equal(stats.frameId, 9); assert.equal(stats.width, 640); assert.equal(stats.height, 360);
});

test('neighbouring draws with the same state share one run', () => {
    const stats = analyzeSharedFrame(frame([image(0), image(0), image(0)]));
    assert.equal(stats.images, 3);
    assert.equal(stats.runs, 1);
    assert.equal(stats.triangles, 6);
});

test('each break is attributed to one reason', () => {
    const stats = analyzeSharedFrame(frame([
        image(0),
        image(1),                         // same page, other region
        image(2),                         // other page
        image(2, { materialIndex: 1 }),   // other material
        image(2, { materialIndex: 1, clips: clipsA }), // clip list starts
        image(2, { materialIndex: 1, clips: clipsA }), // same clip list object: no break
        image(2, { materialIndex: 1, clips: clipsB }), // other clip list
        rect({ materialIndex: 1, clips: clipsB }),     // textured to solid: a page change
    ]));
    assert.deepEqual(stats.switches, { material: 1, page: 2, region: 1, clip: 2, barrier: 0 });
    assert.equal(stats.runs, 7);
});

test('two distinct empty clip lists do not break a run', () => {
    assert.equal(analyzeSharedFrame(frame([image(0, { clips: [] }), image(0, { clips: [] })])).runs, 1);
});

test('a barrier between draws breaks the run; leading and trailing barriers do not', () => {
    const stats = analyzeSharedFrame(frame([
        barrier('explicit-enter'), image(0), barrier('effect-enter'), barrier('effect-exit'), image(0), barrier('explicit-exit'),
    ]));
    assert.equal(stats.barriers, 4);
    assert.equal(stats.effects, 1);
    assert.equal(stats.runs, 2);
    assert.deepEqual(stats.switches, { material: 0, page: 0, region: 0, clip: 0, barrier: 1 });
});

test('mesh triangles come from the referenced geometry', () => {
    const stats = analyzeSharedFrame(frame([
        { kind: 'mesh', materialIndex: 0, regionIndex: 0, geometryIndex: 0, clips: none },
        { kind: 'mesh', materialIndex: 0, regionIndex: 0, geometryIndex: 1, clips: none },
        { kind: 'mesh', materialIndex: 0, regionIndex: 0, geometryIndex: 7, clips: none },
        rect(),
    ]));
    assert.equal(stats.meshes, 3);
    assert.equal(stats.rects, 1);
    assert.equal(stats.triangles, 16);
});

test('unknown shapes count as zero instead of throwing', () => {
    const stats = analyzeSharedFrame({ commands: [{ kind: 'future' }, image(5)], pages: 'no', regions: undefined });
    assert.equal(stats.commands, 2);
    assert.equal(stats.images, 1);
    assert.equal(stats.runs, 1);
    assert.equal(stats.pages, 0);
    assert.equal(stats.pageBytes, 0);
    assert.equal(stats.frameId, 0);
});

test('the result is frozen and a frozen frame can be read', () => {
    const input = Object.freeze(frame(Object.freeze([Object.freeze(image(0))])));
    const stats = analyzeSharedFrame(input);
    assert.ok(Object.isFrozen(stats) && Object.isFrozen(stats.switches));
});

test('the monitor keeps the latest frame counts, returns the frame and attaches them to hitches', () => {
    let time = 0;
    const monitor = createPerformanceMonitor({ now: () => time });
    const input = frame([image(0), image(2)]);
    monitor.tick();
    assert.equal(monitor.observeSharedFrame(input), input);
    time += 50; monitor.tick();
    assert.equal(monitor.snapshot().frame.runs, 2);
    assert.equal(monitor.hitches()[0].frameStats.commands, 2);
    assert.equal(monitor.snapshot().overheadMs, 0);
});

test('a frame whose getters throw leaves the previous counts in place', () => {
    const monitor = createPerformanceMonitor({ now: () => 0 });
    monitor.observeSharedFrame(frame([image(0)]));
    const hostile = { get commands() { throw new Error('revoked'); } };
    assert.equal(monitor.observeSharedFrame(hostile), hostile);
    assert.equal(monitor.snapshot().frame.commands, 1);
});
