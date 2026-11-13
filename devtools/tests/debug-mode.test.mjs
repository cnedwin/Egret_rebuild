// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import test from 'node:test';
import { attachPerformanceMonitor, isDebugMode, sharedHostSource, world3DSource } from '@egret/devtools/web';

function storage(initial = {}) {
    const values = new Map(Object.entries(initial));
    return { values, getItem: (key) => values.get(key) ?? null, setItem: (key, value) => { values.set(key, String(value)); }, removeItem: (key) => { values.delete(key); } };
}

test('debug mode is off by default', () => {
    assert.equal(isDebugMode({ search: '', storage: storage() }), false);
    assert.equal(isDebugMode({ search: '?other=1', storage: null }), false);
});

test('the query parameter turns debug mode on and is remembered', () => {
    const store = storage();
    assert.equal(isDebugMode({ search: '?egretDebug=1', storage: store }), true);
    assert.equal(isDebugMode({ search: '', storage: store }), true);
    assert.equal(isDebugMode({ search: '?a=b&egretDebug', storage: storage() }), true);
    assert.equal(isDebugMode({ search: 'egretDebug=true', storage: null }), true);
});

test('the query parameter turns debug mode off again', () => {
    const store = storage({ 'egret.debug': '1' });
    assert.equal(isDebugMode({ search: '?egretDebug=0', storage: store }), false);
    assert.equal(store.values.size, 0);
    assert.equal(isDebugMode({ search: '', storage: store }), false);
});

test('storage that throws does not throw into the page', () => {
    const broken = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); }, removeItem() { throw new Error('denied'); } };
    assert.equal(isDebugMode({ search: '', storage: broken }), false);
    assert.equal(isDebugMode({ search: '?egretDebug=1', storage: broken }), true);
});

test('outside debug mode attach adds nothing and returns the inert monitor', () => {
    const handle = attachPerformanceMonitor({ enabled: false });
    assert.equal(handle.enabled, false);
    assert.equal(handle.element, null);
    assert.equal(handle.monitor.active, false);
    assert.equal(handle.monitor.measure('x', () => 3), 3);
    handle.setVisible(true); handle.setExpanded(true); handle.refresh(); handle.dispose();
    assert.equal(handle.visible, false);
});

test('host and renderer readers keep only plain values', () => {
    const host = { getSharedStatus: () => ({ host: { state: 'active', generation: 2, pendingFrames: 1, pendingUploadBytes: 0, firstFailure: null }, pendingGeometryBytes: 64, pendingColorBytes: 8, retention: { idleBytes: 1024, reservedBytes: 0 } }) };
    assert.deepEqual(sharedHostSource(host)(), { state: 'active', generation: 2, pendingFrames: 1, pendingUploadBytes: 0, pendingGeometryBytes: 64, pendingColorBytes: 8, retainedIdleBytes: 1024, retainedReservedBytes: 0 });
    const failed = { getSharedStatus: () => ({ host: { state: 'lost', firstFailure: { code: 'WEBGL2_CONTEXT_LOST' } } }) };
    assert.deepEqual(sharedHostSource(failed)(), { state: 'lost', firstFailure: 'WEBGL2_CONTEXT_LOST' });
    assert.deepEqual(world3DSource({ info: { frame: 4, drawCalls: 12, triangles: 900, culled: 3, programs: 5 } })(), { drawCalls: 12, triangles: 900, culled: 3, programs: 5 });
});
