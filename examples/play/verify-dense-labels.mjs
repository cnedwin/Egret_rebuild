// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import { PNG } from 'pngjs';

const layout = {
  width: 390,
  height: 844,
  columns: 3,
  x: 6,
  y: 8,
  stepX: 128,
  stepY: 52,
  cellWidth: 120,
  cellHeight: 46
};

export async function verifyDenseLabels(page, backend = 'webgl2') {
  await page.setViewportSize({ width: layout.width, height: layout.height });
  const fixture = await page.evaluateHandle(
    async ({ backend, layout }) => {
      const { play } = await import('@egret/engine/play');
      const { createUiSemantics } = await import('@egret/engine/ui/semantics');
      const semantics = createUiSemantics(),
        errors = [];
      const canvas = document.createElement('canvas');
      canvas.style.cssText = 'display:block;width:' + layout.width + 'px;height:' + layout.height + 'px';
      document.body.style.margin = '0';
      document.body.append(canvas);
      const game = await play({
        canvas,
        width: layout.width,
        height: layout.height,
        backend,
        audio: false,
        semantics,
        background: 0x080e14,
        onError: error => errors.push(error.code ?? error.message)
      });
      const ids = Array.from({ length: 48 }, (_, index) => 'label' + index);
      const nameOf = (title, index, price) =>
        (index === 47 ? (title === 'Craft' ? 'Next wave' : 'Buy badge') : title + ' ' + index) + ' $' + price;
      let waveCalls = 0;
      const sheet = (title, state) =>
        game.show(
          {
            label: title,
            root: {
              type: 'panel',
              width: layout.width,
              height: layout.height,
              children: ids.map((id, index) => ({
                ...(index === 47 ? { type: 'button', textColor: 0xffffff } : { type: 'text', color: 0xffffff }),
                name: id,
                text: nameOf(title, index, state.price),
                size: 16,
                x: layout.x + (index % layout.columns) * layout.stepX,
                y: layout.y + Math.floor(index / layout.columns) * layout.stepY,
                width: layout.cellWidth,
                height: layout.cellHeight
              }))
            }
          },
          {
            state,
            bind: Object.fromEntries(
              ids.map((id, index) => [
                id,
                {
                  text: model => nameOf(title, index, model.price),
                  ...(index === 47 ? { tap: () => waveCalls++ } : {})
                }
              ])
            )
          }
        );
      const storeModel = { price: 17 },
        craftModel = { price: 28 };
      const store = sheet('Store', storeModel);
      let craft;
      const switchSheet = toStore => {
        if (toStore) {
          craft.hide();
          store.show();
        } else {
          store.hide();
          if (craft) craft.show();
          else craft = sheet('Craft', craftModel);
        }
      };
      const fieldOf = (view, id) => {
        const part = view.get(id);
        const label = part.numChildren === 0 ? undefined : part.getChildAt(0);
        return { label, display: label?.numChildren ? label.getChildAt(0) : undefined };
      };
      return {
        inspect(isStore) {
          const view = isStore ? store : craft,
            model = isStore ? storeModel : craftModel;
          const title = isStore ? 'Store' : 'Craft';
          const names = semantics.snapshot.nodes.filter(node => node.role === 'text' || node.role === 'button');
          const matched = ids.filter((_, index) =>
            names.some(node => node.name === nameOf(title, index, model.price))
          ).length;
          return {
            ready: view
              ? ids.filter((id, index) => {
                  const { label, display } = fieldOf(view, id);
                  const status = display?.getStatus();
                  return (
                    display?.visible &&
                    status.state === 'ready' &&
                    !status.pending &&
                    status.committedRevision === status.desiredRevision &&
                    label.text === nameOf(title, index, model.price)
                  );
                }).length
              : 0,
            semantic: matched,
            otherSemantic: names.length - matched,
            buttonName: names.find(node => node.role === 'button')?.name,
            waveCalls,
            budget: game.browser.getLabelStatus?.(),
            errors: [...errors]
          };
        },
        switchSheet,
        updatePrices() {
          for (const price of [37, 42, 49]) {
            craftModel.price = price;
            craft.refresh();
          }
        },
        closeSheets() {
          store.close();
          craft.close();
        },
        async overtakePending() {
          const label = await game.browser.createLabel({ text: 'Start' });
          try {
            await label.ready;
            label.text = 'A';
            for (let index = 0; !label.display.getStatus().pending && index < 20; index++) await Promise.resolve();
            if (!label.display.getStatus().pending) throw Error('EXAMPLE_TEXT_EXPECTED_PENDING');
            label.text = 'Fresh price after pending release';
            label.setRasterActive(false);
            label.setRasterActive(true);
            await label.ready;
            const status = label.display.getStatus();
            return {
              state: status.state,
              width: status.metrics?.logicalBounds.width,
              desired: status.desiredRevision,
              committed: status.committedRevision
            };
          } finally {
            label.dispose();
          }
        },
        async saturation() {
          const labels = await Promise.all(
            Array.from({ length: 65 }, (_, index) =>
              game.browser.createLabel({ text: 'Overflow ' + index, fontSize: 14 })
            )
          );
          try {
            const before = game.browser.getLabelStatus();
            const results = await Promise.allSettled(labels.map(label => label.ready));
            const refused = results.findIndex(result => result.status === 'rejected');
            const released = results.findIndex(result => result.status === 'fulfilled');
            if (refused < 0 || released < 0) throw Error('EXAMPLE_TEXT_EXPECTED_CAP');
            const admitted = results.filter(result => result.status === 'fulfilled').length;
            labels[released].setRasterActive(false);
            labels[refused].set({});
            await labels[refused].ready;
            return {
              admitted,
              code: results[refused].reason.code,
              peakQueued: before.queued,
              retryState: labels[refused].display.getStatus().state,
              afterRetry: game.browser.getLabelStatus()
            };
          } finally {
            for (const label of labels) label.dispose();
          }
        },
        async close() {
          await game.dispose();
          semantics.dispose();
          canvas.remove();
        }
      };
    },
    { backend, layout }
  );

  const census = async isStore => {
    try {
      await page.waitForFunction(
        ({ fixture, isStore }) => {
          const value = fixture.inspect(isStore);
          return (
            value.errors.length !== 0 || (value.ready === 48 && value.semantic === 48 && value.otherSemantic === 0)
          );
        },
        { fixture, isStore },
        { timeout: 4000 }
      );
    } catch (cause) {
      const state = await fixture.evaluate((fixture, isStore) => fixture.inspect(isStore), isStore);
      throw new Error((isStore ? 'Store' : 'Craft') + ' did not settle ' + JSON.stringify(state), { cause });
    }
    const state = await fixture.evaluate((fixture, isStore) => fixture.inspect(isStore), isStore);
    assert.deepEqual(state.errors, []);
    assert.equal(state.ready, 48);
    assert.equal(state.semantic, 48);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const picture = PNG.sync.read(await page.screenshot());
    let painted = 0;
    for (let index = 0; index < 48; index++) {
      const x = layout.x + (index % layout.columns) * layout.stepX,
        y = layout.y + Math.floor(index / layout.columns) * layout.stepY;
      let found = false;
      for (let dy = 0; dy < layout.cellHeight && !found; dy++) {
        for (let dx = 0; dx < layout.cellWidth; dx++) {
          const pixel = ((y + dy) * picture.width + x + dx) * 4;
          if (picture.data[pixel] > 200 && picture.data[pixel + 1] > 200 && picture.data[pixel + 2] > 200) {
            found = true;
            break;
          }
        }
      }
      if (found) painted++;
    }
    assert.equal(painted, 48);
    return { ...state, painted };
  };
  try {
    const store = await census(true);
    await fixture.evaluate(fixture => fixture.switchSheet(false));
    const craft = await census(false);
    await fixture.evaluate(fixture => {
      fixture.updatePrices();
      fixture.switchSheet(true);
    });
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));
    await fixture.evaluate(fixture => fixture.switchSheet(false));
    const latestPrices = await census(false);
    assert.equal(craft.budget.cache.activeCallerLeases, 48);
    assert.ok(craft.budget.releasedRasters >= 48);
    assert.equal(latestPrices.budget.refusals, 0);
    assert.equal(latestPrices.buttonName, 'Next wave $49');
    await page.mouse.click(
      layout.x + (47 % layout.columns) * layout.stepX + layout.cellWidth / 2,
      layout.y + Math.floor(47 / layout.columns) * layout.stepY + layout.cellHeight / 2
    );
    await page.waitForFunction(fixture => fixture.inspect(false).waveCalls === 1, fixture);
    latestPrices.waveCalls = await fixture.evaluate(fixture => fixture.inspect(false).waveCalls);
    assert.equal(latestPrices.waveCalls, 1);
    await fixture.evaluate(fixture => fixture.closeSheets());
    await page.waitForFunction(fixture => fixture.inspect(false).budget.cache.activeCallerLeases === 0, fixture);
    const pendingReplacement = await fixture.evaluate(fixture => fixture.overtakePending());
    assert.equal(pendingReplacement.state, 'ready');
    assert.equal(pendingReplacement.desired, pendingReplacement.committed);
    assert.ok(pendingReplacement.width > 100, 're-show prepares the latest words instead of pending text A');
    const saturation = await fixture.evaluate(fixture => fixture.saturation());
    assert.equal(saturation.admitted, 64);
    assert.equal(saturation.code, 'TEXT_CACHE_BUDGET');
    assert.equal(saturation.retryState, 'ready');
    const final = await fixture.evaluate(fixture => fixture.inspect(false).budget);
    assert.equal(final.drawing, 0);
    assert.equal(final.queued, 0);
    assert.equal(final.cache.activeCallerLeases, 0);
    return {
      backend,
      viewport: [layout.width, layout.height],
      store,
      craft,
      latestPrices,
      pendingReplacement,
      saturation,
      final
    };
  } finally {
    await fixture.evaluate(fixture => fixture.close());
    await fixture.dispose();
  }
}
