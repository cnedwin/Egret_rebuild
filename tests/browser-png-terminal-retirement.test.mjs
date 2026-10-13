// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { isTexture } from '@egret/engine';
import { createBrowserTextureProvider as createProvider } from '@egret/engine/web/image';
import { runProvider, observe, errorIs } from './browser-png-fixture.mjs';

const code = name => 'WEB_PNG_' + name;
const cases = [
  { name: 'close then fulfilled throwing close getter', terminal: 'close', retirement: 'throwing' },
  { name: 'cancel then fulfilled throwing close getter', terminal: 'cancel', retirement: 'throwing' },
  { name: 'close then fulfilled missing close operation', terminal: 'close', retirement: 'missing' },
  { name: 'cancel then fulfilled missing close operation', terminal: 'cancel', retirement: 'missing' },
];
const count = (fixture, event) => fixture.events.filter(value => value === event).length;

for (const entry of cases) {
  test('BIP-PRODUCT-F01 prior terminal survives ' + entry.name, { timeout: 10_000 }, async () => {
    let baseline;
    await runProvider(createProvider, async (provider, fixture) => {
      // Every assigned fault begins with a fresh complete legal invocation.
      baseline = await fixture.load();
      assert.ok(isTexture(baseline));
      assert.equal(baseline.isDisposed, false);
      assert.equal(fixture.bitmaps[0].closed, 1);
      assert.deepEqual(fixture.canvases[0].resets, ['width', 'height']);

      const before = {
        decode: fixture.decodeCalls.length,
        width: count(fixture, 'bitmap.width'),
        height: count(fixture, 'bitmap.height'),
        close: count(fixture, 'bitmap.close'),
        canvases: fixture.canvases.length,
        draws: count(fixture, 'context.draw'),
        readbacks: count(fixture, 'context.readback'),
      };
      const reason = Object.freeze({ originalCancellation: entry.name });
      let returned, closePromise, closeObserved, retirementReads = 0;
      fixture.controls.decode = () => {
        returned = fixture.makeBitmap();
        if (entry.retirement === 'throwing') {
          Object.defineProperty(returned, 'close', {
            configurable: true,
            get() { retirementReads++; throw undefined; },
          });
        } else {
          // This owned returned object supplies no close operation; none is invented.
          Reflect.deleteProperty(returned, 'close');
        }
        if (entry.terminal === 'close') {
          closePromise = provider.close();
          closeObserved = observe(closePromise); // Handle its eventual rejection immediately.
        } else fixture.controller.abort(reason);
        return Promise.resolve(returned);
      };

      // fixture.load registers any unexpected fulfillment before later assertions,
      // so even a regression cannot skip caller-owned Texture disposal.
      const loaded = await observe(fixture.load());
      if (closeObserved === undefined) {
        closePromise = provider.close();
        closeObserved = observe(closePromise);
      }
      const closed = await closeObserved;

      assert.equal(loaded.fulfilled, false, 'the earlier terminal work must reject the load');
      const loadError = loaded.cause;
      if (entry.terminal === 'close') {
        errorIs(code('PROVIDER_CLOSED'), { cleanupErrors: [] })(loadError);
        assert.ok(loadError.cause instanceof TypeError, 'closed primary keeps its authored TypeError');
      } else errorIs(code('CANCELLED'), { cause: reason, cleanupErrors: [] })(loadError);

      assert.equal(closed.fulfilled, false, 'unknown returned-handle ownership remains quarantined');
      const closeError = closed.cause;
      errorIs(code('CLOSE_INCOMPLETE'))(closeError);
      assert.equal(provider.close(), closePromise, 'the same close Promise is retained');
      assert.equal(closeError.cleanupErrors.length, 1, 'one admitted job has one refusal reason');
      if (entry.retirement === 'throwing') {
        assert.equal(retirementReads, 1);
        errorIs(code('CLOSE_INCOMPLETE'), { cause: undefined, cleanupErrors: [undefined] })(closeError);
      } else {
        assert.ok(closeError.cause instanceof TypeError, 'missing close supplies an authored refusal');
        assert.equal(closeError.cleanupErrors[0], closeError.cause, 'admission-ordered reason keeps its identity');
      }
      if (entry.terminal === 'close') {
        assert.notEqual(loadError.cause, closeError.cause, 'retirement refusal cannot replace the earlier primary');
      }

      assert.equal(fixture.decodeCalls.length, before.decode + 1);
      assert.notEqual(returned, undefined);
      assert.equal(returned.closed, 0, 'no unavailable close operation was attempted');
      assert.equal(count(fixture, 'bitmap.close'), before.close);
      assert.equal(count(fixture, 'bitmap.width'), before.width, 'normal width staging is skipped');
      assert.equal(count(fixture, 'bitmap.height'), before.height, 'normal height staging is skipped');
      assert.equal(fixture.canvases.length, before.canvases, 'no normal surface is acquired');
      assert.equal(count(fixture, 'context.draw'), before.draws);
      assert.equal(count(fixture, 'context.readback'), before.readbacks);
      assert.equal(baseline.isDisposed, false, 'provider close preserves the already issued caller value');
      // Unchanged runProvider disposes the baseline after close, checks the same
      // CLOSE_INCOMPLETE result, and retains primary/cleanup occurrences including undefined.
    }, { closeCode: code('CLOSE_INCOMPLETE') });
    assert.equal(baseline.isDisposed, true, 'caller cleanup disposes the issued baseline after close');
  });
}
