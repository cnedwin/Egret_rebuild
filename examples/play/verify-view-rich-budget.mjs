// SPDX-License-Identifier: Apache-2.0
// Real Canvas paragraph provider with a management-style page and modal.
import assert from 'node:assert/strict';

export async function verifyViewRichBudget(page) {
  async function fixture(options) {
    return page.evaluateHandle(async options => {
      const { play } = await import('@egret/engine/play');
      const { createParagraphCache } = await import('@egret/engine/paragraph');
      const { createCanvasParagraphProvider } = await import('@egret/engine/web/paragraph');
      const provider = createCanvasParagraphProvider();
      const errors = [];
      let game, cache, body, dialog;
      const paragraph = { fontFamilies: ['sans-serif'], locale: 'en', lineHeight: 22, maxLines: 3 };
      function panel(prefix, modal) {
        const rows = Array.from({ length: 20 }, (_, index) => ({
          type: 'text',
          name: prefix + '-row-' + index,
          width: 'fill',
          height: 66,
          text: prefix + ' detail ' + index + ': This row has distinct wrapped Chinese and English content. 门派事务。',
          paragraph,
          size: 15
        }));
        return game.show(
          {
            label: prefix,
            modal,
            root: {
              type: 'panel',
              name: prefix + '-scroll',
              anchor: 'center',
              width: 320,
              height: 260,
              card: true,
              padding: 6,
              gap: 5,
              scroll: 'vertical',
              layout: 'column',
              children: rows
            }
          },
          { paragraphCache: cache }
        );
      }
      game = await play({
        width: 640,
        height: 360,
        backend: 'webgl2',
        audio: false,
        onError(error) {
          errors.push(error.code ?? String(error));
        },
        setup(context) {
          game = context;
          cache = createParagraphCache(context.engine.assets, { provider, ...options });
          body = panel('page', false);
        }
      });
      return {
        status: () => ({ ...cache.getStatus(), errors: [...errors] }),
        open: () => {
          dialog = panel('modal', true);
        },
        scrollBottom() {
          const scroll = dialog.scroll('modal-scroll');
          scroll.scrollTo(scroll.maximum);
          return { offset: scroll.offset, maximum: scroll.maximum, last: dialog.visibleRect('modal-row-19') };
        },
        closeModal: () => dialog.close(),
        close: async () => {
          try {
            await game.dispose();
          } finally {
            provider.dispose?.();
          }
          return cache.getStatus();
        }
      };
    }, options);
  }
  const waitForLeases = async (handle, callerLeases) => {
    await page.waitForFunction(
      ({ handle, callerLeases }) => {
        const status = handle.status();
        return status.pendingJobs === 0 && status.callerLeases === callerLeases;
      },
      { handle, callerLeases }
    );
    return handle.evaluate(f => f.status());
  };
  // Keep the original small default explicit and independently reproduce the
  // failure. This is intentional budget refusal, not an ignored page error.
  const ordinary = await fixture({});
  let refused;
  try {
    await waitForLeases(ordinary, 20);
    await ordinary.evaluate(f => f.open());
    await page.waitForFunction(f => f.status().errors.length > 0, ordinary);
    refused = await ordinary.evaluate(f => f.status());
    assert.ok(refused.errors.includes('PARAGRAPH_CACHE_BUDGET'), refused.errors.join(','));
  } finally {
    await ordinary.evaluate(f => f.close());
    await ordinary.dispose();
  }
  const larger = await fixture({ maxEntries: 96, maxPendingJobs: 96 });
  try {
    await waitForLeases(larger, 20);
    await larger.evaluate(f => f.open());
    const concurrent = await waitForLeases(larger, 40);
    assert.deepEqual(concurrent.errors, []);
    assert.equal(concurrent.entries, 40);
    assert.ok(concurrent.imageBytes > 0);
    const scrolled = await larger.evaluate(f => f.scrollBottom());
    assert.ok(scrolled.maximum > 0 && scrolled.offset === scrolled.maximum && scrolled.last?.height > 0);
    await larger.evaluate(f => f.closeModal());
    const remaining = await waitForLeases(larger, 20);
    assert.deepEqual(remaining.errors, []);
    return { refused, concurrent, scrolled, remaining };
  } finally {
    const closed = await larger.evaluate(f => f.close());
    assert.equal(closed.callerLeases, 0);
    assert.equal(closed.imageBytes, 0);
    await larger.dispose();
  }
}
