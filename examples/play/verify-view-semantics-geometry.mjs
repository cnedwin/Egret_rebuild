// SPDX-License-Identifier: Apache-2.0
// The declared control role, accessible label, decorative content and transformed geometry all share the live view.
import assert from 'node:assert/strict';

export async function verifyViewSemanticsGeometry(page) {
  const prior = page.viewportSize();
  await page.setViewportSize({ width: 873, height: 325 });
  const fixture = await page.evaluateHandle(async () => {
    const { play } = await import('@egret/engine/play');
    const { createUiSemantics } = await import('@egret/engine/ui/semantics');
    const { createUiTester } = await import('@egret/engine/ui/testing');
    const { createBrowserSemantics } = await import('@egret/engine/web/semantics');
    const semantics = createUiSemantics();
    const tester = createUiTester({ semantics });
    const host = document.createElement('div');
    host.style.cssText = 'position:fixed;inset:0;z-index:20';
    document.body.append(host);
    const state = { label: 'Workshop — ready', disabled: true, taps: 0, pointerTaps: 0 };
    const children = [
      {
        type: 'panel',
        name: 'tile',
        role: 'button',
        label: 'Workshop',
        color: 0x735230,
        x: 25,
        y: 8,
        width: 164,
        height: 66,
        children: [{ type: 'text', name: 'tileText', text: 'Icon text', width: 120 }]
      },
      {
        type: 'panel',
        name: 'pointerTile',
        label: 'Pointer only',
        color: 0x452133,
        x: 25,
        y: 85,
        width: 164,
        height: 60
      },
      {
        type: 'panel',
        name: 'art',
        semantic: false,
        x: 25,
        y: 160,
        width: 164,
        height: 40,
        children: [{ type: 'text', name: 'artText', text: 'Decorative flourish', width: 160 }]
      },
      {
        type: 'panel',
        name: 'list',
        scroll: 'vertical',
        layout: 'column',
        gap: 8,
        x: 205,
        y: 8,
        width: 160,
        height: 120,
        children: Array.from({ length: 4 }, (_, i) => ({
          type: 'button',
          name: 'row' + i,
          text: 'Row ' + i,
          width: 'fill',
          height: 44
        }))
      }
    ];
    let view;
    const game = await play({
      parent: host,
      width: 640,
      height: 360,
      portrait: { width: 400, height: 640 },
      fit: 'expand',
      semantics,
      audio: false,
      backend: 'webgl2',
      setup(g) {
        view = g.show(
          {
            area: 'screen',
            root: { type: 'panel', name: 'root', children },
            portrait: { type: 'panel', name: 'root', children: [...children].reverse() }
          },
          {
            state,
            bind: {
              tile: { label: s => s.label, tap: s => s.taps++ },
              pointerTile: { disabled: s => s.disabled, pointerOnly: true, tap: s => s.pointerTaps++ }
            }
          }
        );
      }
    });
    const projection = createBrowserSemantics({
      semantics,
      canvas: game.canvas,
      width: game.browser.frame.width,
      height: game.browser.frame.height
    });
    const unwatchProjection = game.browser.onScreenChange(() => projection.sync(game.browser.frame));
    let rememberedElement, rememberedId, rememberedContainer;
    function projectionState(remember = false) {
      const node = semantics.publish().nodes.find(n => n.role === 'button' && n.name === state.label);
      const element = projection.elementOf(node.id);
      if (remember) {
        rememberedElement = element;
        rememberedId = element.id;
        rememberedContainer = projection.container;
      }
      const rect = element.getBoundingClientRect(),
        box = game.canvas.getBoundingClientRect();
      const { width, height } = game.browser.frame;
      const bounds = node.bounds;
      const wanted = {
        x: box.left + (bounds.x * box.width) / width,
        y: box.top + (bounds.y * box.height) / height,
        width: (bounds.width * box.width) / width,
        height: (bounds.height * box.height) / height
      };
      return {
        extent: { width, height },
        rect: { x: rect.left, y: rect.top, width: rect.width, height: rect.height },
        wanted,
        sameElement: element === rememberedElement && element.id === rememberedId,
        sameContainer: projection.container === rememberedContainer,
        activeDescendant: game.canvas.getAttribute('aria-activedescendant') === element.id,
        canvasOwns: game.canvas.getAttribute('aria-owns') === projection.container.id,
        keyboardOnCanvas: document.activeElement === game.canvas,
        focused: view.focused
      };
    }
    function snapshot() {
      return semantics
        .publish()
        .nodes.map(({ role, name, bounds, disabled, focused }) => ({ role, name, bounds, disabled, focused }));
    }
    return {
      startProjectionCheck() {
        if (!view.focus('tile')) throw new Error('The tile could not receive its named focus');
        if (!game.canvas.hasAttribute('tabindex')) game.canvas.tabIndex = 0;
        game.canvas.focus({ preventScroll: true });
        return projectionState(true);
      },
      projectionState,
      inspect() {
        return { snapshot: snapshot(), variant: view.variant, taps: state.taps, pointerTaps: state.pointerTaps };
      },
      geometry() {
        const authored = view.rect('row3');
        const clipped = view.visibleRect('row3');
        const partial = view.visibleRect('row2');
        const offset = view.scroll('list').offset;
        return { authored, clipped, partial, offset, tile: view.visibleRect('tile') };
      },
      scroll() {
        view.scroll('list').scrollTo(view.scroll('list').maximum);
      },
      rename() {
        state.label = '工坊 — 已升级';
        view.refresh();
      },
      enablePointer() {
        state.disabled = false;
        view.refresh();
      },
      point(name) {
        const { x, y, width, height } = view.visibleRect(name),
          box = game.canvas.getBoundingClientRect();
        return {
          x: box.left + ((x + width / 2) * box.width) / game.screen.width,
          y: box.top + ((y + height / 2) * box.height) / game.screen.height
        };
      },
      focusPointer() {
        return view.focus('pointerTile');
      },
      activateTile() {
        tester.press('button: 工坊 — 已升级');
      },
      hide() {
        view.hide();
        return view.visibleRect('tile');
      },
      show() {
        view.show();
        return view.visibleRect('tile');
      },
      close() {
        view.close();
        return view.visibleRect('tile');
      },
      async dispose() {
        unwatchProjection();
        projection.dispose();
        await game.dispose();
        semantics.dispose();
        host.remove();
      }
    };
  });
  try {
    const initial = await fixture.evaluate(f => f.inspect());
    const initialGeometry = await fixture.evaluate(f => f.geometry());
    const tile = initial.snapshot.find(n => n.name === 'Workshop — ready');
    assert.equal(tile?.role, 'button');
    assert.deepEqual(tile.bounds, initialGeometry.tile);
    assert.ok(
      !initial.snapshot.some(n => n.name === 'Icon text' || n.name === 'Decorative flourish' || n.name === 'art')
    );
    assert.equal(initialGeometry.clipped, undefined);
    assert.ok(initialGeometry.partial?.height > 0 && initialGeometry.partial.height < 44);
    await fixture.evaluate(f => f.scroll());
    const scrolled = await fixture.evaluate(f => f.geometry());
    assert.deepEqual(scrolled.authored, initialGeometry.authored);
    assert.ok(scrolled.offset > 0 && scrolled.clipped?.height === 44);
    assert.equal(await fixture.evaluate(f => f.focusPointer()), false);
    const pointer = await fixture.evaluate(f => f.point('pointerTile'));
    await page.mouse.click(pointer.x, pointer.y);
    assert.equal((await fixture.evaluate(f => f.inspect())).pointerTaps, 0);
    await fixture.evaluate(f => f.enablePointer());
    await page.mouse.click(pointer.x, pointer.y);
    assert.equal((await fixture.evaluate(f => f.inspect())).pointerTaps, 1);
    await fixture.evaluate(f => {
      f.rename();
      f.activateTile();
    });
    const renamed = await fixture.evaluate(f => f.inspect());
    assert.equal(renamed.taps, 1);
    assert.ok(renamed.snapshot.some(n => n.role === 'button' && n.name === '工坊 — 已升级'));
    assert.equal(await fixture.evaluate(f => f.hide()), undefined);
    assert.ok(await fixture.evaluate(f => f.show()));
    // The semantic projection must follow the real expanded/turned stage, keeping the same element and focus.
    const checkProjection = receipt => {
      for (const key of ['x', 'y', 'width', 'height'])
        assert.ok(Math.abs(receipt.rect[key] - receipt.wanted[key]) < 1, JSON.stringify(receipt));
      for (const key of ['sameElement', 'sameContainer', 'activeDescendant', 'canvasOwns', 'keyboardOnCanvas'])
        assert.ok(receipt[key], key + ': ' + JSON.stringify(receipt));
      assert.equal(receipt.focused, 'tile');
    };
    const projectionInitial = await fixture.evaluate(f => f.startProjectionCheck());
    checkProjection(projectionInitial);
    await page.setViewportSize({ width: 1000, height: 480 });
    await page.waitForFunction(f => f.projectionState().extent.width === 750, fixture);
    const projectionExpanded = await fixture.evaluate(f => f.projectionState());
    checkProjection(projectionExpanded);
    assert.notDeepEqual(projectionExpanded.extent, projectionInitial.extent);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForFunction(f => f.inspect().variant === 'portrait', fixture);
    const projectionPortrait = await fixture.evaluate(f => f.projectionState());
    checkProjection(projectionPortrait);
    assert.notDeepEqual(projectionPortrait.extent, projectionExpanded.extent);
    const portrait = await fixture.evaluate(f => f.inspect());
    assert.ok(portrait.snapshot.some(n => n.role === 'button' && n.name === '工坊 — 已升级'));
    assert.ok(!portrait.snapshot.some(n => n.name === 'Icon text' || n.name === 'Decorative flourish'));
    assert.equal(await fixture.evaluate(f => f.close()), undefined);
    return { initialGeometry, scrolled, renamed, portrait, projectionInitial, projectionExpanded, projectionPortrait };
  } finally {
    await fixture.evaluate(f => f.dispose());
    await fixture.dispose();
    if (prior !== null) await page.setViewportSize(prior);
  }
}
