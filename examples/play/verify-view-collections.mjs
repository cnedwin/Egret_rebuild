// SPDX-License-Identifier: Apache-2.0
// Public Play view collection and bound-image behavior in an isolated browser.
import assert from 'node:assert/strict';
import { PNG } from 'pngjs';

export async function verifyViewCollections(page) {
  const fixture = await page.evaluateHandle(async () => {
    const { play } = await import('@egret/engine/play');
    const { createUiSemantics } = await import('@egret/engine/ui/semantics');
    const { createUiTester } = await import('@egret/engine/ui/testing');
    const semantics = createUiSemantics({ maxNodes: 40 });
    const errors = [],
      state = { presses: [], words: {}, icon: '' };
    const pixel = (width, height, colour) => {
      const c = document.createElement('canvas');
      c.width = width;
      c.height = height;
      const ctx = c.getContext('2d');
      ctx.fillStyle = colour;
      ctx.fillRect(0, 0, width, height);
      return c.toDataURL('image/png');
    };
    const red = pixel(7, 4, '#fe0033'),
      green = pixel(4, 7, '#35ee5b'),
      blue = pixel(5, 9, '#1a63ff');
    state.icon = red;
    const row = id => ({
      type: 'panel',
      name: 'row' + id,
      role: 'button',
      label: 'Item ' + id,
      card: true,
      height: 44,
      layout: 'row',
      gap: 4,
      padding: 3,
      children: [{ type: 'text', name: 'words' + id, text: 'Item ' + id, size: 18, width: 'fill' }]
    });
    const rowBindings = ids =>
      Object.fromEntries(
        ids.flatMap(id => [
          ['row' + id, { tap: value => value.presses.push(id), label: value => value.words[id] ?? 'Item ' + id }],
          ['words' + id, { text: value => value.words[id] ?? 'Item ' + id }]
        ])
      );
    const ids = Array.from({ length: 30 }, (_, id) => id);
    const rows = ids.map(row);
    let view, imageView, queueView, builtView;
    const builtVisits = [];
    const queueState = { src: '/collection-queue-old.png' };
    const game = await play({
      width: 640,
      height: 360,
      portrait: { width: 360, height: 640 },
      backend: 'webgl2',
      audio: false,
      semantics,
      onError(cause) {
        errors.push(cause.code ?? cause.message);
      },
      setup(g) {
        view = g.show(
          {
            label: 'Bag',
            root: {
              type: 'panel',
              name: 'bag',
              width: 360,
              height: 320,
              layout: 'column',
              gap: 8,
              children: [
                { type: 'button', name: 'tab', text: 'Equipment', height: 40 },
                {
                  type: 'panel',
                  name: 'items',
                  scroll: 'vertical',
                  height: 240,
                  layout: 'column',
                  gap: 4,
                  children: rows
                }
              ]
            },
            portrait: {
              type: 'panel',
              name: 'bag',
              width: 340,
              height: 300,
              layout: 'column',
              gap: 8,
              children: [
                { type: 'button', name: 'tab', text: 'Equipment', height: 40 },
                {
                  type: 'panel',
                  name: 'items',
                  scroll: 'vertical',
                  height: 220,
                  layout: 'column',
                  gap: 4,
                  children: rows
                }
              ]
            }
          },
          { state, bind: { ...rowBindings(ids), tab: { tap: value => value.presses.push('tab') } } }
        );
      }
    });
    const tester = createUiTester({ semantics });
    const frames = async () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    return {
      async collection() {
        // Select a row midway through a 30-item scroll list, then sell it.
        const kept = view.get('row16'),
          keptText = view.get('words16'),
          gone = view.get('row15');
        const panel = view.get('items'),
          tab = view.get('tab'),
          scroll = view.scroll('items');
        const idOf = name => semantics.publish().nodes.find(node => node.name === name)?.id;
        // Focus reveals a clipped row before its semantic id is sampled.
        view.focus('row16');
        const semanticId = idOf('Item 16');
        const initialMax = scroll.maximum;
        view.focus('row15');
        const before = scroll.offset;
        const remaining = ids.filter(id => id !== 15);
        view.replaceChildren('items', remaining.map(row), rowBindings(remaining));
        const after = scroll.offset,
          firstFocus = view.focused;
        await frames();
        const removed = gone.isDisposed,
          oldId = (() => {
            try {
              view.get('row15');
              return false;
            } catch (cause) {
              return cause.code === 'UI_VIEW_NAME_UNKNOWN';
            }
          })();
        const stable =
          view.get('row16') === kept &&
          view.get('words16') === keptText &&
          view.get('items') === panel &&
          view.get('tab') === tab;
        const maxAfter = scroll.maximum,
          retainedSemanticId = idOf('Item 16') === semanticId;
        // A changed label follows state and the retained action keeps its actual item identity.
        state.words[16] = 'Forged sword';
        view.refresh();
        tester.press('Forged sword');
        const next = remaining.filter(id => id !== 17);
        next.splice(next.indexOf(16), 0, 31);
        const oldTab = view.get('tab');
        view.replaceChildren('items', next.map(row), rowBindings(next));
        const secondFocus = view.focused;
        const sameAfterSecond = kept === view.get('row16') && oldTab === view.get('tab');
        view.focus('row31');
        tester.press('Item 31');
        const refusal = (() => {
          try {
            view.replaceChildren('items', [row(16), row(16)], rowBindings([16]));
            return '';
          } catch (cause) {
            return cause.code;
          }
        })();
        const stillLive = kept === view.get('row16') && view.get('row31') !== undefined;
        const beforeCapacity = { offset: scroll.offset, focus: view.focused };
        const overflow = Array.from({ length: 45 }, (_, index) => 100 + index);
        const capacity = (() => {
          try {
            view.replaceChildren('items', overflow.map(row), rowBindings(overflow));
            return '';
          } catch (cause) {
            return cause.code;
          }
        })();
        const afterCapacity = { offset: scroll.offset, focus: view.focused };
        const capacityKept = kept === view.get('row16') && view.get('row31') !== undefined;
        // Removing every row invalidates their bindings and focus; the tab remains usable.
        view.replaceChildren('items', [], {});
        await frames();
        const empty = { maximum: scroll.maximum, offset: scroll.offset, focus: view.focused };
        tester.press('Equipment');
        return {
          initialMax,
          before,
          after,
          maxAfter,
          firstFocus,
          secondFocus,
          removed,
          oldId,
          stable,
          retainedSemanticId,
          sameAfterSecond,
          refusal,
          stillLive,
          capacity,
          beforeCapacity,
          afterCapacity,
          capacityKept,
          empty,
          presses: [...state.presses],
          errors: [...errors]
        };
      },
      populatePortrait() {
        view.replaceChildren('items', [row(5), row(8)], rowBindings([5, 8]));
        view.focus('row8');
      },
      portrait() {
        return {
          variant: view.variant,
          focus: view.focused,
          names: [view.get('row5').isDisposed, view.get('row8').isDisposed]
        };
      },
      modalOrdering() {
        const lower = game.show(
          {
            label: 'Lower dialog',
            modal: true,
            root: {
              type: 'panel',
              name: 'list',
              width: 200,
              height: 200,
              layout: 'column',
              children: [{ type: 'button', name: 'old', text: 'Lower old' }]
            }
          },
          {
            bind: {
              old: {
                tap: () => {
                  throw Error('inert dialog activation');
                }
              }
            }
          }
        );
        let upperPresses = 0;
        const upper = game.show(
          {
            label: 'Upper dialog',
            modal: true,
            root: { type: 'button', name: 'upper', text: 'Upper action', width: 200, height: 60 }
          },
          { bind: { upper: { tap: () => upperPresses++ } } }
        );
        try {
          lower.replaceChildren('list', [{ type: 'button', name: 'new', text: 'Lower new' }], {
            new: {
              tap: () => {
                throw Error('inert dialog activation');
              }
            }
          });
          const nodes = semantics.publish().nodes;
          const inert = nodes.find(n => n.name === 'Lower new')?.inert;
          const upperInert = nodes.find(n => n.name === 'Upper action')?.inert;
          tester.press('Upper action');
          return { inert, upperInert, upperPresses };
        } finally {
          upper.close();
          lower.close();
        }
      },
      staleRoll() {
        const rolling = game.show(
          {
            root: {
              type: 'panel',
              name: 'rollList',
              layout: 'column',
              children: [{ type: 'text', name: 'amount', text: 'Initial' }]
            }
          },
          { bind: { amount: { pick: () => 42 } } }
        );
        try {
          const before = rolling.get('amount').getChildAt(0).text;
          rolling.replaceChildren('rollList', [{ type: 'text', name: 'amount', text: 'New' }], {});
          const after = rolling.get('amount').getChildAt(0).text;
          const spoken = semantics.publish().nodes.find(node => node.id.endsWith(':amount'))?.name;
          return { before, after, spoken };
        } finally {
          rolling.close();
        }
      },
      callbacks() {
        const first = { type: 'button', name: 'first', text: 'First', height: 44 };
        const stable = { type: 'button', name: 'stable', text: 'Stable', height: 44 };
        const text = { type: 'text', name: 'callback', text: 'Callback', height: 44 };
        const callView = game.show(
          {
            root: { type: 'panel', name: 'callbackList', layout: 'column', gap: 5, height: 210, children: [stable] }
          },
          { bind: { stable: { tap: () => {} } } }
        );
        try {
          callView.focus('stable');
          let nested;
          callView.replaceChildren('callbackList', [first, stable, text], {
            stable: { tap: () => {} },
            callback: {
              text: () => {
                try {
                  callView.replaceChildren('callbackList', [first], {});
                } catch (cause) {
                  nested = cause.code;
                }
                return 'Callback';
              }
            }
          });
          const afterNested = callView.focused;
          let thrown = '';
          try {
            callView.replaceChildren('callbackList', [stable, first, text], {
              stable: { tap: () => {} },
              callback: {
                text: () => {
                  throw Error('assigned callback failure');
                }
              }
            });
          } catch (cause) {
            thrown = cause.message;
          }
          const arranged = callView.get('stable').y === callView.rect('stable').y - callView.rect('callbackList').y;
          const afterFailure = callView.focused;
          // An application binding is a runtime callback, not description validation.
          // Replace the intentionally throwing fixture callback before another frame runs.
          callView.replaceChildren('callbackList', [stable], { stable: { tap: () => {} } });
          return { nested, afterNested, thrown, arranged, afterFailure, recovered: callView.focused };
        } finally {
          callView.close();
        }
      },
      createBuiltView() {
        const panel = { type: 'panel', name: 'builtList', layout: 'column', width: 220, height: 100, children: [] };
        builtView = game.show(
          { root: panel, portrait: panel },
          {
            built(v) {
              builtVisits.push(v.variant);
              const name = v.variant === 'portrait' ? 'portraitRow' : 'landscapeRow';
              v.replaceChildren('builtList', [{ type: 'button', name, text: name, height: 44 }], {
                [name]: { tap: () => {} }
              });
            }
          }
        );
        return this.builtRead();
      },
      builtRead() {
        const name = builtView.variant === 'portrait' ? 'portraitRow' : 'landscapeRow';
        const mounted = !builtView.get(name).isDisposed;
        const published = semantics.publish().nodes.some(n => n.name === name);
        return { variant: builtView.variant, mounted, published, visits: [...builtVisits], errors: [...errors] };
      },
      closeBuilt() {
        builtView?.close();
        builtView = undefined;
      },
      async image() {
        imageView = game.show(
          {
            root: { type: 'image', name: 'icon', label: 'Equipment icon', src: red, width: 60, height: 60 }
          },
          { state, bind: { icon: { src: value => value.icon } } }
        );
        const icon = imageView.get('icon');
        const size = () =>
          icon.numChildren === 1 ? [icon.getChildAt(0).getBounds().width, icon.getChildAt(0).getBounds().height] : null;
        const settled = async expected => {
          for (let i = 0; i < 120; i++) {
            if (JSON.stringify(size()) === JSON.stringify(expected)) return;
            await frames();
          }
          throw Error('Bound picture did not settle ' + JSON.stringify(size()));
        };
        await settled([7, 4]);
        const first = icon.getChildAt(0);
        state.icon = green;
        imageView.refresh();
        await settled([4, 7]);
        await frames();
        const identity = imageView.get('icon') === icon;
        const firstRemoved = first.isDisposed;
        return { identity, firstRemoved, count: icon.numChildren, final: size(), errors: [...errors] };
      },
      setIcon(src) {
        state.icon = src === 'blue' ? blue : src;
        imageView.refresh();
      },
      iconRead() {
        const icon = imageView.get('icon');
        const size =
          icon.numChildren === 1 ? [icon.getChildAt(0).getBounds().width, icon.getChildAt(0).getBounds().height] : null;
        return { size, count: icon.numChildren, errors: [...errors] };
      },
      async watchIcon(expected, n) {
        for (let i = 0; i < n; i++) {
          await frames();
          if (JSON.stringify(this.iconRead().size) !== JSON.stringify(expected)) throw Error('Obsolete picture won');
        }
        return this.iconRead();
      },
      openQueue() {
        const children = Array.from({ length: 4 }, (_, index) => ({
          type: 'image',
          name: 'block' + index,
          src: '/collection-queue-block' + index + '.png',
          width: 30,
          height: 30
        }));
        children.push({ type: 'image', name: 'changing', src: red, width: 30, height: 30 });
        queueView = game.show(
          { root: { type: 'panel', layout: 'row', children } },
          {
            state: queueState,
            bind: { changing: { src: value => value.src } }
          }
        );
      },
      changeQueued() {
        queueState.src = '/collection-queue-new.png';
        queueView.refresh();
      },
      queueRead() {
        const children = ['block0', 'block1', 'block2', 'block3', 'changing'];
        return { loaded: children.filter(name => queueView.get(name).numChildren === 1).length, errors: [...errors] };
      },
      async close() {
        builtView?.close();
        queueView?.close();
        imageView?.close();
        view.close();
        await game.dispose();
        semantics.dispose();
      }
    };
  });
  try {
    const roll = await fixture.evaluate(f => f.staleRoll());
    assert.deepEqual(roll, { before: '42', after: 'New', spoken: 'New' });
    const runtimeCallbacks = await fixture.evaluate(f => f.callbacks());
    assert.deepEqual(runtimeCallbacks, {
      nested: 'UI_VIEW_BINDING_INVALID',
      afterNested: 'stable',
      thrown: 'assigned callback failure',
      arranged: true,
      afterFailure: 'stable',
      recovered: 'stable'
    });
    const result = await fixture.evaluate(f => f.collection());
    assert.ok(result.initialMax > 1000 && result.before > 400);
    assert.equal(result.after, result.before, 'scroll position is retained near a sold item');
    assert.equal(result.maxAfter, result.initialMax - 48);
    assert.equal(result.firstFocus, 'row16', 'focus moves to the next item if the focused row was sold');
    assert.equal(result.secondFocus, 'row16', 'surviving key retains focus');
    assert.equal(result.stable, true, 'surviving row, child, viewport and static tab keep their sprites');
    assert.equal(result.sameAfterSecond, true, 'second replacement retained row');
    assert.equal(result.retainedSemanticId, true, 'semantic id retained');
    assert.equal(result.removed, true, 'removed node disposed');
    assert.equal(result.oldId, true, 'removed name refused');
    assert.equal(result.refusal, 'UI_VIEW_INVALID');
    assert.equal(result.stillLive, true, 'a rejected duplicate update leaves the mounted list intact');
    assert.equal(result.capacity, 'UI_SEMANTICS_CAPACITY');
    assert.deepEqual(result.beforeCapacity, result.afterCapacity);
    assert.equal(result.capacityKept, true, 'semantic capacity refusal preserves nodes');
    assert.deepEqual(result.empty, { maximum: 0, offset: 0, focus: 'tab' });
    assert.deepEqual(result.presses, [16, 31, 'tab']);
    assert.deepEqual(result.errors, []);
    const before = page.viewportSize();
    await fixture.evaluate(f => f.populatePortrait());
    await page.setViewportSize({ width: 420, height: 700 });
    await page.waitForFunction(f => f.portrait().variant === 'portrait', fixture);
    const portrait = await fixture.evaluate(f => f.portrait());
    assert.deepEqual(portrait, { variant: 'portrait', focus: 'row8', names: [false, false] });
    if (before) await page.setViewportSize(before);
    await page.waitForFunction(f => f.portrait().variant === 'landscape', fixture);
    const builtInitial = await fixture.evaluate(f => f.createBuiltView());
    assert.deepEqual(builtInitial, {
      variant: 'landscape',
      mounted: true,
      published: true,
      visits: ['landscape'],
      errors: []
    });
    await page.setViewportSize({ width: 420, height: 700 });
    await page.waitForFunction(f => f.builtRead().variant === 'portrait', fixture);
    const builtPortrait = await fixture.evaluate(f => f.builtRead());
    assert.deepEqual(builtPortrait, {
      variant: 'portrait',
      mounted: true,
      published: true,
      visits: ['landscape', 'portrait'],
      errors: []
    });
    await fixture.evaluate(f => f.closeBuilt());
    if (before) await page.setViewportSize(before);
    const modal = await fixture.evaluate(f => f.modalOrdering());
    assert.deepEqual(modal, {
      inert: true,
      upperInert: false,
      upperPresses: 1
    });
    const image = await fixture.evaluate(f => f.image());
    assert.deepEqual(image, { identity: true, firstRemoved: true, count: 1, final: [4, 7], errors: [] });
    // Keep one actual image response pending while the next intent becomes visible.
    const png = new PNG({ width: 8, height: 3 });
    png.data.fill(255);
    let seen, release, fulfilled;
    const request = new Promise(resolve => (seen = resolve));
    const gate = new Promise(resolve => (release = resolve));
    const done = new Promise(resolve => (fulfilled = resolve));
    const pattern = '**/collection-slow.png';
    await page.route(pattern, async route => {
      seen();
      await gate;
      try {
        await route.fulfill({ contentType: 'image/png', body: PNG.sync.write(png) });
      } finally {
        fulfilled();
      }
    });
    try {
      await fixture.evaluate(f => f.setIcon('/collection-slow.png'));
      await Promise.race([
        request,
        new Promise((_, reject) => setTimeout(() => reject(Error('Slow image never requested')), 10_000).unref())
      ]);
      await fixture.evaluate(f => f.setIcon('blue'));
      await page.waitForFunction(f => JSON.stringify(f.iconRead().size) === '[5,9]', fixture);
      release();
      await done;
      const late = await fixture.evaluate(f => f.watchIcon([5, 9], 20));
      assert.deepEqual(late, { size: [5, 9], count: 1, errors: [] });
      await fixture.evaluate(f => f.setIcon(undefined));
      await page.waitForFunction(f => f.iconRead().count === 0, fixture);
      // Occupy the shared four-job queue. Replacing the fifth pending address
      // must remove it before it can request even one network byte.
      const queuePattern = '**/collection-queue-*.png',
        started = [];
      let full, releaseQueue;
      const seenFull = new Promise(resolve => (full = resolve));
      const held = new Promise(resolve => (releaseQueue = resolve));
      await page.route(queuePattern, async route => {
        const url = new URL(route.request().url()).pathname;
        started.push(url);
        if (url.startsWith('/collection-queue-block')) {
          if (started.filter(name => name.startsWith('/collection-queue-block')).length === 4) full();
          await held;
        }
        await route.fulfill({ contentType: 'image/png', body: PNG.sync.write(png) });
      });
      try {
        await fixture.evaluate(f => f.openQueue());
        await Promise.race([
          seenFull,
          new Promise((_, reject) => setTimeout(() => reject(Error('Queue blockers not started')), 10_000).unref())
        ]);
        await fixture.evaluate(f => f.changeQueued());
        releaseQueue();
        await page.waitForFunction(f => f.queueRead().loaded === 5, fixture);
        assert.equal(started.filter(name => name === '/collection-queue-old.png').length, 0);
        assert.equal(started.filter(name => name === '/collection-queue-new.png').length, 1);
        const queue = { started, ...(await fixture.evaluate(f => f.queueRead())) };
        assert.deepEqual(queue.errors, []);
        return {
          roll,
          runtimeCallbacks,
          builtInitial,
          builtPortrait,
          collection: result,
          portrait,
          modal,
          image,
          late,
          queue
        };
      } finally {
        releaseQueue();
        await page.unroute(queuePattern);
      }
    } finally {
      release();
      await page.unroute(pattern);
    }
  } finally {
    await fixture.evaluate(f => f.close());
    await fixture.dispose();
  }
}
