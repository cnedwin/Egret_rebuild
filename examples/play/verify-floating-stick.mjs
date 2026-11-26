// SPDX-License-Identifier: Apache-2.0
// Browser acceptance for one floating-stick arena. The same scenario can be driven on a real phone via CDP.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { once } from 'node:events';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createExampleServer } from '../../tools/serve-example.mjs';

export const route = '/play-floating-stick-fixture';

export async function createFloatingStickServer() {
  const document = await readFile(new URL('index.html', import.meta.url), 'utf8');
  const map = document.match(/<script type="importmap">([\s\S]*?)<\/script>/u);
  assert(map, 'Shared Play import map missing');
  const server = createExampleServer();
  const serve = server.listeners('request')[0];
  server.removeListener('request', serve);
  server.on('request', (request, response) => {
    if (new URL(request.url, 'http://127.0.0.1').pathname !== route || request.method !== 'GET') {
      serve(request, response);
      return;
    }
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    response.end(
      '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
        '<title>Floating touch stick arena</title><link rel="icon" href="data:,">' +
        map[0] +
        '<body></body>'
    );
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return { server, origin: 'http://127.0.0.1:' + server.address().port };
}

export async function verifyFloatingStick(page, backend = 'webgl2') {
  await page.evaluate(async backend => {
    const { play } = await import('@egret/engine/play');
    const width = 640,
      height = 360;
    const cssWidth = Math.min(innerWidth - 42, 320);
    if (cssWidth < 275 || innerHeight < 260) throw Error('Arena needs at least a 317 × 260 CSS viewport');
    document.body.style.cssText = 'margin:20px;overflow:hidden;touch-action:none;background:#24303a';
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'display:block;width:' + cssWidth + 'px;height:' + (cssWidth * height) / width + 'px';
    document.body.append(canvas);
    const faults = [],
      events = [];
    let pauses = 0,
      outsideTaps = 0,
      worldTaps = 0,
      beaconTaps = 0,
      menuChoice,
      modal,
      control,
      hero;
    const game = await play({
      canvas,
      width,
      height,
      backend,
      audio: false,
      background: 0x10212d,
      onError: error => faults.push(error.code ?? error.message),
      setup(g) {
        for (let x = 50; x <= 600; x += 80) g.rect(x, 220, 2, 250, 0x203848);
        for (let y = 95; y <= 330; y += 54) g.rect(320, y, 600, 2, 0x203848);
        g.onTap(g.rect(192, 207, 288, 204, 0x1f3642), () => {
          worldTaps++;
        });
        // An ordinary world target proves the supplied exclusion is honored independently of the HUD.
        g.onTap(g.rect(128, 160, 42, 32, 0xf4c96c), () => {
          beaconTaps++;
        });
        hero = g.circle(364, 200, 12, 0x51dfad);
        g.button('Pause', { x: 236, y: 124, width: 108, height: 42 }, () => {
          if (g.paused) g.resume();
          else {
            pauses++;
            g.pause();
          }
        });
        g.button('Mark', { x: 512, y: 230, width: 90, height: 38 }, () => {
          outsideTaps++;
        });
        g.touchButton('OK', { x: 548, y: 128, key: 'enter', always: true });
        control = g.touchStick({
          radius: 72,
          floating: {
            area: { x: 48, y: 105, width: 288, height: 204 },
            deadZonePx: 8,
            exclude: (x, y) =>
              (x >= 182 && x < 290 && y >= 103 && y < 145) || (x >= 107 && x < 149 && y >= 144 && y < 176)
          }
        });
      },
      update(dt, g) {
        const axis = g.keys.axis();
        hero.x += axis.x * dt * 35;
        hero.y += axis.y * dt * 35;
      }
    });
    const pos = () => {
      const bounds = canvas.getBoundingClientRect();
      const level = (x, y) => ({
        x: bounds.left + (x / width) * bounds.width,
        y: bounds.top + (y / height) * bounds.height
      });
      return {
        bounds: { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height },
        start: level(112, 207),
        second: level(262, 257),
        outside: level(528, 194),
        mark: level(512, 230),
        pause: level(236, 124),
        fresh: level(147, 264),
        beacon: level(128, 160),
        confirm: level(548, 128)
      };
    };
    const listen = event => {
      events.push({
        type: event.type,
        id: event.pointerId,
        pointerType: event.pointerType,
        x: event.clientX,
        y: event.clientY,
        canvas: event.target === canvas,
        capture: canvas.hasPointerCapture(event.pointerId),
        gameDown: game.pointer.down
      });
    };
    const types = [
      'pointerdown',
      'pointermove',
      'pointerup',
      'pointercancel',
      'gotpointercapture',
      'lostpointercapture'
    ];
    for (const type of types) window.addEventListener(type, listen);
    globalThis.__egretFloatingStickFixture = {
      pos,
      events,
      state: () => ({
        axis: game.keys.axis(),
        paused: game.paused,
        pauses,
        outsideTaps,
        worldTaps,
        beaconTaps,
        asking: game.asking,
        menuChoice,
        visible: !control.isDisposed && control.visible,
        detached: control.isDisposed || control.parent === null,
        centre: control.isDisposed ? null : { x: control.x, y: control.y },
        hero: { x: hero.x, y: hero.y },
        faults: [...faults]
      }),
      openModal: () => {
        modal = game.show({
          modal: true,
          root: { type: 'panel', width: 200, height: 96, anchor: 'center' }
        });
      },
      closeModal: () => modal.close(),
      openMenu: () => {
        void game.menu(['First', 'Second']).then(index => {
          menuChoice = index;
        });
      },
      removeControl: () => game.remove(control),
      hasCapture: id => canvas.hasPointerCapture(id),
      async close() {
        for (const type of types) window.removeEventListener(type, listen);
        await game.dispose();
        delete globalThis.__egretFloatingStickFixture;
      }
    };
  }, backend);
  const report = { backend, checkpoints: {} };
  const pageState = () => page.evaluate(() => globalThis.__egretFloatingStickFixture.state());
  const observedEvents = () => page.evaluate(() => globalThis.__egretFloatingStickFixture.events);
  const settle = () =>
    page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const touch = async (type, ...touchPoints) => {
    await page.touch(type, touchPoints);
    await settle();
  };
  const check = async (name, test) => {
    const state = await pageState();
    assert.deepEqual(state.faults, []);
    try {
      test(state);
    } catch (cause) {
      throw Error(name + ': ' + JSON.stringify(state), { cause });
    }
    report.checkpoints[name] = state;
  };
  const near = (actual, expected) =>
    assert.ok(Math.abs(actual - expected) < 0.07, actual + ' differs from ' + expected);
  const neutral = state => {
    near(state.axis.x, 0);
    near(state.axis.y, 0);
  };
  const shifted = (point, x, y) => ({ ...point, x: point.x + x, y: point.y + y });
  const finger = (id, point) => ({ ...point, id });
  const at = (event, point) => Math.abs(event.x - point.x) < 2 && Math.abs(event.y - point.y) < 2;
  try {
    const { start, second, outside, mark, pause, fresh, beacon, confirm, bounds } = await page.evaluate(() =>
      globalThis.__egretFloatingStickFixture.pos()
    );
    report.cssCanvas = bounds;
    assert(bounds.width > 0 && bounds.width < 640, 'Fixture must render at a non-unit CSS scale');
    await check('starts hidden', state => assert.equal(state.visible, false));

    const outsideFinger = finger(11, outside);
    await touch('touchStart', outsideFinger);
    await touch('touchMove', shifted(outsideFinger, -38, 0));
    await check('outside stays a gameplay pointer', state => {
      neutral(state);
      assert.equal(state.visible, false);
    });
    await touch('touchEnd');

    await touch('touchStart', finger(12, mark));
    await touch('touchEnd');
    await check('outside action still taps', state => {
      neutral(state);
      assert.equal(state.outsideTaps, 1);
    });
    await touch('touchStart', finger(14, beacon));
    await touch('touchEnd');
    await check('custom exclusion leaves a world target tappable', state => {
      neutral(state);
      assert.equal(state.visible, false);
      assert.equal(state.beaconTaps, 1);
    });

    const pauseAlone = finger(13, pause);
    await touch('touchStart', pauseAlone);
    await touch('touchEnd');
    await check('the excluded Pause area is tappable before a stick owns input', state => {
      assert.equal(state.pauses, 1);
      assert.equal(state.paused, true);
      neutral(state);
      assert.equal(state.visible, false);
    });
    await touch('touchStart', pauseAlone);
    await touch('touchEnd');
    await check('the excluded Pause area can resume', state => assert.equal(state.paused, false));

    const a = finger(21, start);
    await touch('touchStart', a);
    await check('inside press centres the stick at the finger', state => {
      assert.equal(state.visible, true);
      near(state.centre.x, 112);
      near(state.centre.y, 207);
      neutral(state);
    });
    await touch('touchMove', shifted(a, 7, 0));
    await check('seven CSS pixels stay below the eight pixel dead zone', neutral);
    await touch('touchMove', shifted(a, 18, 0));
    await check('direction becomes active beyond the CSS dead zone', state => {
      assert(state.axis.x > 0.1 && state.axis.x < 0.85);
      near(state.axis.y, 0);
    });
    await page.save?.('active-half-radius.png');

    const b = finger(22, second),
      half = shifted(a, 18, 0);
    await touch('touchStart', half, b);
    const secondMove = shifted(b, 0, -44);
    await touch('touchMove', half, secondMove);
    const active = report.checkpoints['direction becomes active beyond the CSS dead zone'].axis.x;
    await check('second touch cannot replace owner', state => {
      near(state.axis.x, active);
      near(state.axis.y, 0);
    });
    // Chromium accepts a point ID on touchEnd to release only that contact.
    // Assert delivered pointer IDs below, since a bare end releases the entire device.
    await touch('touchEnd', secondMove);
    await check('secondary up leaves stick active', state => {
      near(state.axis.x, active);
      assert.equal(state.visible, true);
    });
    const overlap = await observedEvents();
    const originalOwner = overlap.find(event => event.type === 'pointerdown' && at(event, start));
    const secondary = overlap.find(event => event.type === 'pointerdown' && at(event, second));
    assert(originalOwner && secondary && originalOwner.id !== secondary.id, 'Two touch PointerEvents are required');
    assert(
      overlap.some(event => event.type === 'pointerup' && event.id === secondary.id),
      'Second finger lifted'
    );
    assert(!overlap.some(event => event.type === 'pointerup' && event.id === originalOwner.id), 'Owner remained down');

    await touch('touchMove', { ...a, y: bounds.y + bounds.height + 18 });
    await check('owner outside the canvas remains clamped', state => {
      near(state.axis.x, 0);
      near(state.axis.y, 1);
    });
    await touch('touchEnd');
    await check('owner up hides and neutralizes', state => {
      neutral(state);
      assert.equal(state.visible, false);
      assert.equal(state.worldTaps, 0);
    });
    const recorded = await observedEvents();
    const recognized = originalOwner;
    assert.equal(recognized.pointerType, 'touch', 'Native contact must reach the page as a touch PointerEvent');
    assert.equal(recognized.gameDown, false, 'A claimed stick press cannot become the gameplay pointer');
    assert(
      recorded.some(
        event =>
          event.type === 'pointermove' &&
          event.id === recognized.id &&
          event.y > bounds.y + bounds.height &&
          event.canvas &&
          event.capture
      ),
      'Outside move must use canvas pointer capture'
    );

    await touch('touchStart', finger(25, fresh));
    await touch('touchEnd');
    await check('a stick press without motion never taps the world', state => {
      neutral(state);
      assert.equal(state.visible, false);
      assert.equal(state.worldTaps, 0);
    });

    const c = finger(31, fresh);
    await touch('touchStart', c);
    await touch('touchMove', shifted(c, 47, 0));
    await check('fresh owner after up can drive', state => near(state.axis.x, 1));
    await touch('touchCancel');
    await check('cancel hides and neutralizes', state => {
      neutral(state);
      assert.equal(state.visible, false);
    });
    assert(
      (await observedEvents()).some(event => event.type === 'pointercancel'),
      'Synthetic cancellation must produce a browser PointerEvent'
    );

    const old = finger(41, start),
      oldHalf = shifted(old, 18, 0),
      stop = finger(42, pause);
    const beforePause = (await observedEvents()).length;
    await touch('touchStart', old);
    await touch('touchMove', oldHalf);
    await touch('touchStart', oldHalf, stop);
    await touch('touchEnd', stop);
    await check('actual Pause tap while the stick is held cancels it', state => {
      assert.equal(state.pauses, 2);
      assert.equal(state.paused, true);
      neutral(state);
      assert.equal(state.visible, false);
    });
    const pauseEvents = (await observedEvents()).slice(beforePause);
    const pausedOwner = pauseEvents.find(event => event.type === 'pointerdown' && at(event, start));
    const pausePointer = pauseEvents.find(event => event.type === 'pointerdown' && at(event, pause));
    assert(pausedOwner && pausePointer && pausedOwner.id !== pausePointer.id);
    assert(pauseEvents.some(event => event.type === 'pointerup' && event.id === pausePointer.id));
    assert(!pauseEvents.some(event => event.type === 'pointerup' && event.id === pausedOwner.id));
    await page.save?.('paused.png');
    await touch('touchStart', oldHalf, stop);
    await touch('touchEnd', stop);
    await check('actual Pause tap resumes the arena', state => {
      assert.equal(state.paused, false);
      neutral(state);
    });
    await touch('touchMove', shifted(old, 34, 0));
    await check('pre-pause contact cannot regain the stick', state => {
      neutral(state);
      assert.equal(state.visible, false);
    });
    await touch('touchEnd');
    const d = finger(51, fresh);
    await touch('touchStart', d);
    await touch('touchMove', shifted(d, -18, 0));
    await check('fresh touch after Pause drives again', state => {
      assert(state.axis.x < -0.1);
      assert.equal(state.visible, true);
    });
    await touch('touchEnd');
    await check('final state neutral', state => {
      neutral(state);
      assert.equal(state.visible, false);
    });

    const modalOwner = finger(53, fresh);
    await touch('touchStart', modalOwner);
    await touch('touchMove', shifted(modalOwner, 0, 40));
    await check('a stationary modal owner starts active', state => near(state.axis.y, 0.9));
    await page.evaluate(() => globalThis.__egretFloatingStickFixture.openModal());
    await settle();
    await check('opening a modal retires unmoved floating input', state => {
      neutral(state);
      assert.equal(state.visible, false);
    });
    await page.evaluate(() => globalThis.__egretFloatingStickFixture.closeModal());
    await touch('touchMove', shifted(modalOwner, 0, 44));
    await check('closing a modal cannot restore its old touch', neutral);
    await touch('touchEnd');

    const menuOwner = finger(54, fresh),
      menuDrag = shifted(menuOwner, 0, 40);
    await touch('touchStart', menuOwner);
    await touch('touchMove', menuDrag);
    await check('a fresh touch drives before a legacy menu', state => assert(state.axis.y > 0.6));
    await page.evaluate(() => globalThis.__egretFloatingStickFixture.openMenu());
    await settle();
    await check('opening a legacy menu neutralizes floating input', state => {
      assert.equal(state.asking, true);
      neutral(state);
      assert.equal(state.visible, false);
    });
    const ok = finger(55, confirm);
    await touch('touchStart', menuDrag, ok);
    await touch('touchEnd', ok);
    await check('the retired stick cannot steer a legacy menu', state => {
      assert.equal(state.asking, false);
      assert.equal(state.menuChoice, 0);
    });
    await touch('touchEnd');

    const e = finger(61, fresh);
    await touch('touchStart', e);
    await touch('touchMove', shifted(e, 30, 0));
    await check('removal begins during a live drag', state => assert(state.axis.x > 0.1));
    const removedOwner = (await observedEvents()).findLast(event => event.type === 'pointerdown' && at(event, fresh));
    assert(removedOwner);
    const captured = id => page.evaluate(id => globalThis.__egretFloatingStickFixture.hasCapture(id), id);
    assert.equal(await captured(removedOwner.id), true);
    await page.evaluate(() => globalThis.__egretFloatingStickFixture.removeControl());
    await settle();
    await check('removing the live control retires its axis', state => {
      neutral(state);
      assert.equal(state.visible, false);
      assert.equal(state.detached, true);
    });
    assert.equal(await captured(removedOwner.id), false, 'Removal releases native capture');
    await touch('touchMove', shifted(e, 39, 0));
    await check('old contact stays neutral after control removal', neutral);
    await touch('touchEnd');
    report.pointerEvents = await observedEvents();
    return report;
  } finally {
    await page.touch('touchCancel', []).catch(() => {});
    await page.evaluate(() => globalThis.__egretFloatingStickFixture.close());
  }
}

async function main() {
  const [playwright, output, chrome, backend = 'webgl2'] = process.argv.slice(2);
  assert(
    [playwright, output, chrome].every(value => value && path.isAbsolute(value)),
    'Usage: node examples/play/verify-floating-stick.mjs <absolute Playwright index.mjs> <new absolute output dir> <absolute Chromium> [webgl2|webgpu]'
  );
  assert(['webgl2', 'webgpu'].includes(backend));
  await mkdir(output);
  const { server, origin } = await createFloatingStickServer();
  const receipt = { input: 'Chromium CDP-injected touch on Windows', backend, passing: false };
  let browser, context;
  try {
    const { chromium } = await import(pathToFileURL(playwright).href);
    browser = await chromium.launch({
      executablePath: chrome,
      args: [
        '--use-angle=swiftshader',
        '--enable-unsafe-swiftshader',
        '--ignore-gpu-blocklist',
        '--no-proxy-server',
        ...(backend === 'webgpu'
          ? [
              '--enable-unsafe-webgpu',
              '--use-webgpu-adapter=swiftshader',
              '--enable-features=Vulkan',
              '--use-vulkan=swiftshader'
            ]
          : [])
      ]
    });
    receipt.browser = browser.version();
    context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, deviceScaleFactor: 1 });
    const page = await context.newPage(),
      faults = [];
    page.on('pageerror', error => faults.push(error.message));
    await page.goto(origin + route);
    const cdp = await context.newCDPSession(page);
    receipt.observations = await verifyFloatingStick(
      {
        evaluate: (fn, arg) => page.evaluate(fn, arg),
        touch: (type, touchPoints) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints }),
        save: name => page.screenshot({ path: path.join(output, name) })
      },
      backend
    );
    assert.deepEqual(faults, []);
    receipt.passing = true;
  } catch (error) {
    receipt.failure = String(error.stack ?? error);
    if (error.cause) receipt.cause = String(error.cause.stack ?? error.cause);
    process.exitCode = 1;
  } finally {
    await context?.close();
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
    await writeFile(path.join(output, 'floating-stick.json'), JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
    console.log(
      JSON.stringify({
        backend,
        passing: receipt.passing,
        failure: receipt.failure?.split('\n')[0],
        checkpoints: Object.keys(receipt.observations?.checkpoints ?? {})
      })
    );
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
