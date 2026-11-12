// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import test from 'node:test';
import { IntegrationError } from '@egret/integrations/errors';
import { createSaveStore } from '@egret/integrations/web/storage';

function fault(code) {
    return (error) => error instanceof IntegrationError && error.integration === 'storage' && error.code === code;
}

test('save store rejects invalid namespaces before opening IndexedDB', () => {
    for (const namespace of ['', 'a/b', '.game', 'a'.repeat(129), 2]) {
        assert.throws(() => createSaveStore(namespace), fault('invalid-input'));
    }
});

test('save store reports the unavailable host without a memory fallback', {
    skip: typeof globalThis.indexedDB?.open === 'function',
}, () => {
    assert.throws(() => createSaveStore('game.test'), fault('platform-unavailable'));
});
