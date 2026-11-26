// SPDX-License-Identifier: Apache-2.0
// Public Play UI activation in a browser: the prior default still bubbles, deliberate dismissal does not.
import assert from 'node:assert/strict';

export async function verifyViewActivation(page) {
  const fixture = await page.evaluateHandle(async () => {
    const { play } = await import('@egret/engine/play');
    const { createUiSemantics } = await import('@egret/engine/ui/semantics');
    const { createUiTester } = await import('@egret/engine/ui/testing');
    const semantics = createUiSemantics(),
      tester = createUiTester({ semantics });
    const state = { count: 0 },
      observations = [];
    // Browser fixture of a standard controller sample, not a physical gamepad.
    const buttons = Array.from({ length: 17 }, () => ({ pressed: false, value: 0 }));
    const pad = {
      index: 0,
      id: 'Activation test pad',
      connected: true,
      mapping: 'standard',
      buttons,
      axes: [0, 0, 0, 0]
    };
    const getGamepads = Object.getOwnPropertyDescriptor(navigator, 'getGamepads');
    Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => [pad] });
    let mode = 'legacy',
      view,
      game;
    function describe(stateArg, activation) {
      return {
        isState: stateArg === state,
        source: activation.source,
        target: activation.target,
        currentTarget: activation.currentTarget,
        isTarget: activation.isTarget,
        pointerId: activation.pointerId,
        stageX: activation.stageX,
        stageY: activation.stageY,
        localX: activation.localX,
        localY: activation.localY
      };
    }
    function makeView() {
      const mark = (stateArg, activation) => observations.push(describe(stateArg, activation));
      view = game.show(
        {
          modal: true,
          label: 'Activation controls',
          area: 'screen',
          root: {
            type: 'panel',
            name: 'screen',
            layout: 'free',
            color: 0x272d3b,
            children: [
              {
                type: 'panel',
                name: 'surface',
                x: 100,
                y: 65,
                width: 440,
                height: 230,
                color: 0x54749b,
                children: [
                  { type: 'button', name: 'child', x: 120, y: 55, width: 200, height: 45, text: 'Save' },
                  { type: 'panel', name: 'strip', x: 50, y: 140, width: 340, height: 60, color: 0xff8866 },
                  { type: 'button', name: 'old', x: 10, y: 10, width: 70, height: 35, text: 'Old' }
                ]
              }
            ]
          }
        },
        {
          state,
          initialFocus: 'child',
          bind: {
            screen: { pointerOnly: true, tapTargetOnly: mode === 'dismiss', tap: mark },
            surface: { pointerOnly: true, tap: mark },
            child: {
              tap: (stateArg, activation) => {
                mark(stateArg, activation);
                if (mode === 'dismiss') activation.stopPropagation();
              }
            },
            strip: { pointerOnly: true, tap: mark },
            old: {
              tap: stateArg => {
                stateArg.count++;
              }
            }
          }
        }
      );
    }
    game = await play({ width: 640, height: 360, backend: 'webgl2', pixelRatio: 1, audio: false, semantics });
    makeView();
    return {
      read: () => observations.splice(0),
      count: () => state.count,
      press: () => tester.press('button:Save'),
      focus: () => view.focus('child'),
      padA(pressed) {
        buttons[0].pressed = pressed;
        buttons[0].value = pressed ? 1 : 0;
      },
      dismissMode() {
        view.close();
        mode = 'dismiss';
        makeView();
      },
      point(name, x, y) {
        const stage = view.get(name).localToGlobal(x, y);
        const box = game.canvas.getBoundingClientRect();
        return { x: box.left + (stage.x * box.width) / 640, y: box.top + (stage.y * box.height) / 360, stage };
      },
      async close() {
        try {
          await game.dispose();
        } finally {
          if (getGamepads === undefined) delete navigator.getGamepads;
          else Object.defineProperty(navigator, 'getGamepads', getGamepads);
        }
      }
    };
  });
  const cdp = await page.context().newCDPSession(page);
  const frames = () =>
    page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const inspect = () => fixture.evaluate(f => f.read());
  const hit = (name, x, y) => fixture.evaluate((f, at) => f.point(...at), [name, x, y]);
  const report = [];
  const click = async (source, name, x, y) => {
    const point = await hit(name, x, y);
    if (source === 'touch') await page.touchscreen.tap(point.x, point.y);
    else if (source === 'pen') {
      for (const type of ['mousePressed', 'mouseReleased'])
        await cdp.send('Input.dispatchMouseEvent', {
          type,
          pointerType: 'pen',
          x: point.x,
          y: point.y,
          button: 'left',
          buttons: type === 'mousePressed' ? 1 : 0,
          clickCount: 1
        });
    } else await page.mouse.click(point.x, point.y);
    await frames();
    return { point, events: await inspect() };
  };
  const near = (actual, expected) =>
    assert.ok(Math.abs(actual - expected) <= 1.5, `${actual} should be near ${expected}`);
  const checkPointer = (event, source, target, currentTarget, point, local) => {
    assert.equal(event.isState, true);
    assert.equal(event.source, source);
    assert.equal(event.target, target);
    assert.equal(event.currentTarget, currentTarget);
    assert.equal(event.isTarget, target === currentTarget);
    assert.equal(typeof event.pointerId, 'number');
    near(event.stageX, point.stage.x);
    near(event.stageY, point.stage.y);
    near(event.localX, local[0]);
    near(event.localY, local[1]);
  };
  const checkDirect = (events, source) => {
    assert.equal(events.length, 1);
    const event = events[0];
    assert.equal(event.source, source);
    assert.equal(event.target, 'child');
    assert.equal(event.currentTarget, 'child');
    assert.equal(event.isTarget, true);
    assert.equal(event.isState, true);
    for (const key of ['stageX', 'stageY', 'localX', 'localY', 'pointerId']) assert.equal(event[key], undefined);
  };
  try {
    for (const source of ['mouse', 'touch', 'pen']) {
      const result = await click(source, 'child', 90, 20);
      assert.deepEqual(
        result.events.map(e => e.currentTarget),
        ['child', 'surface', 'screen']
      );
      checkPointer(result.events[0], source, 'child', 'child', result.point, [90, 20]);
      checkPointer(result.events[1], source, 'child', 'surface', result.point, [210, 75]);
      checkPointer(result.events[2], source, 'child', 'screen', result.point, [310, 140]);
      report.push({ case: 'legacy bubbling and coordinates', source, ...result });
    }
    await fixture.evaluate(f => f.focus());
    await page.keyboard.press('Enter');
    await frames();
    const keyboard = await inspect();
    checkDirect(keyboard, 'keyboard');
    report.push({ case: 'keyboard', events: keyboard });
    await fixture.evaluate(f => f.press());
    const semantic = await inspect();
    checkDirect(semantic, 'semantic');
    report.push({ case: 'semantic tester', events: semantic });
    await fixture.evaluate(f => f.padA(true));
    await frames();
    await fixture.evaluate(f => f.padA(false));
    await frames();
    const gamepad = await inspect();
    checkDirect(gamepad, 'gamepad');
    report.push({ case: 'injected standard gamepad', events: gamepad });
    const left = await click('mouse', 'strip', 15, 20),
      right = await click('touch', 'strip', 315, 30);
    checkPointer(left.events[0], 'mouse', 'strip', 'strip', left.point, [15, 20]);
    checkPointer(right.events[0], 'touch', 'strip', 'strip', right.point, [315, 30]);
    report.push({ case: 'distinct card regions', left, right });
    await click('mouse', 'old', 35, 15);
    assert.equal(await fixture.evaluate(f => f.count()), 1);
    await fixture.evaluate(f => f.dismissMode());
    const child = await click('mouse', 'child', 90, 20);
    assert.deepEqual(
      child.events.map(e => e.currentTarget),
      ['child'],
      'stopPropagation stops ancestors'
    );
    const inside = await click('touch', 'surface', 30, 115);
    assert.deepEqual(
      inside.events.map(e => e.currentTarget),
      ['surface'],
      'target-only screen does not receive descendant hits'
    );
    const outside = await click('mouse', 'screen', 30, 30);
    assert.deepEqual(
      outside.events.map(e => e.currentTarget),
      ['screen'],
      'target-only backdrop still receives a direct hit'
    );
    report.push({ case: 'no accidental dismissal', child, inside, outside });
    return {
      report,
      note: 'Automated mouse, emulated touch and pen by Chromium; semantic tester and keyboard; standard gamepad sample. No physical touch device or gamepad.'
    };
  } finally {
    await fixture.evaluate(f => f.close());
    await fixture.dispose();
    await cdp.detach();
  }
}
