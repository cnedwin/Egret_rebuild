// SPDX-License-Identifier: Apache-2.0
// Real browser pixels and lifecycle for a continuously changing native score, with no game assets.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { once } from 'node:events';
import { pathToFileURL } from 'node:url';
import { PNG } from 'pngjs';
import { createExampleServer } from '../../tools/serve-example.mjs';

const [playwrightFile, output, host = 'webkit', executablePath] = process.argv.slice(2);
assert.ok([playwrightFile, output].every(value => value && path.isAbsolute(value)));
assert.ok(['webkit', 'chromium'].includes(host));
const { [host]: launcher } = await import(pathToFileURL(playwrightFile).href);
const importmap = fs
  .readFileSync(new URL('index.html', import.meta.url), 'utf8')
  .match(/<script type="importmap">([\s\S]*?)<\/script>/u)[1];
const html =
  '<!doctype html><meta charset="utf-8"><link rel="icon" href="data:,">' +
  '<script type="importmap">' +
  importmap +
  '</script><body style="margin:0"><canvas style="display:block"></canvas></body>';
const server = createExampleServer();
const report = { host, errors: [], passed: false };
fs.mkdirSync(output);
let browser, page;
const snapshot = async name => {
  const png = PNG.sync.read(await page.screenshot({ path: path.join(output, name + '.png') }));
  // The score occupies the transparent rectangle above the separate action button. Count real bright glyph pixels.
  let ink = 0;
  for (let y = 75; y < 147; y++)
    for (let x = 24; x < 620; x++) {
      const n = (y * png.width + x) * 4;
      if (png.data[n] > 190 && png.data[n + 1] > 145 && png.data[n + 2] > 75) ink++;
    }
  return ink;
};
try {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const origin = 'http://127.0.0.1:' + server.address().port;
  browser = await launcher.launch(
    host === 'chromium'
      ? {
          ...(executablePath ? { executablePath } : {}),
          args: [
            '--use-angle=swiftshader',
            '--enable-unsafe-swiftshader',
            '--ignore-gpu-blocklist',
            '--no-proxy-server'
          ]
        }
      : {}
  );
  report.browser = browser.version();
  page = await browser.newPage({ viewport: { width: 640, height: 360 }, deviceScaleFactor: 1 });
  page.on('pageerror', error => report.errors.push(String(error)));
  await page.route(origin + '/numeric-captions', route =>
    route.fulfill({ contentType: 'text/html; charset=utf-8', body: html })
  );
  await page.goto(origin + '/numeric-captions');
  await page.evaluate(async () => {
    const { play } = await import('@egret/engine/play');
    const { createUiSemantics } = await import('@egret/engine/ui/semantics');
    const semantics = createUiSemantics();
    const game = await play({
      canvas: document.querySelector('canvas'),
      width: 640,
      height: 360,
      audio: false,
      backend: 'webgl2',
      pixelRatio: 1,
      background: 0x101923,
      semantics
    });
    const state = { value: 0, action: 'Old action' };
    const view = game.show(
      {
        root: {
          type: 'panel',
          children: [
            {
              type: 'text',
              name: 'heading',
              text: 'Native counter',
              x: 24,
              y: 12,
              width: 596,
              height: 48,
              size: 26,
              color: 0xfddd8a
            },
            {
              type: 'text',
              name: 'counter',
              text: '0 points',
              x: 24,
              y: 75,
              width: 596,
              height: 72,
              size: 40,
              color: 0xfddd8a
            },
            { type: 'button', name: 'action', text: 'Old action', x: 24, y: 180, width: 200, height: 60, size: 24 }
          ]
        }
      },
      {
        state,
        bind: {
          counter: { pick: s => s.value, format: n => n + ' points' },
          action: { text: s => s.action, tap: () => {} }
        }
      }
    );
    const frame = () => new Promise(done => requestAnimationFrame(done));
    const deadline = task =>
      Promise.race([task, new Promise((_, fail) => setTimeout(() => fail(new Error('Text did not settle')), 10000))]);
    const words = name => view.get(name).getChildAt(0);
    const label = name => {
      const text = words(name);
      return text.numChildren ? text.getChildAt(0) : undefined;
    };
    const raster = name => {
      const node = label(name);
      return node?.visible && node.numChildren ? node.getChildAt(0) : undefined;
    };
    const rejected = promise =>
      promise.then(
        () => 'resolved',
        error => error.name
      );
    await deadline(Promise.all(['heading', 'counter', 'action'].map(name => view.textReady(name))));
    await frame();
    await frame();
    view.focus('action');
    window.fixture = { game, view, state, frame, deadline, label, raster, rejected, semantics };
  });
  report.initialInk = await snapshot('initial');
  report.immediate = await page.evaluate(() => {
    const { view, state, raster, semantics } = window.fixture;
    const before = raster('counter');
    state.value = 1;
    state.action = 'New action';
    view.refresh();
    const semantic = semantics.publish().nodes.find(node => node.id.endsWith(':action'));
    return {
      counterKept: !!before && raster('counter') === before,
      actionHidden: raster('action') === undefined,
      actionName: semantic?.name,
      focus: view.focused
    };
  });
  await page.evaluate(async () => {
    const { view, deadline, frame } = window.fixture;
    await deadline(view.textReady('action'));
    await deadline(view.textReady('counter'));
    await frame();
  });
  await page.evaluate(() => {
    const { view, state, frame, raster, rejected } = window.fixture;
    window.rapid = (async () => {
      const pictures = new Set();
      let blank = 0;
      const prior = view.textReady('counter');
      for (let n = 2; n <= 121; n++) {
        state.value = n;
        view.refresh();
        const bitmap = raster('counter');
        if (bitmap === undefined) blank++;
        else pictures.add(bitmap);
        await frame();
      }
      state.value = 122;
      view.refresh();
      const superseded = view.textReady('counter');
      state.value = 123;
      view.refresh();
      return {
        blank,
        revisions: pictures.size,
        initialSettled: await rejected(prior),
        superseded: await rejected(superseded)
      };
    })();
  });
  await page.waitForTimeout(300);
  report.rapidInk = [await snapshot('rapid-a')];
  await page.waitForTimeout(300);
  report.rapidInk.push(await snapshot('rapid-b'));
  report.rapid = await page.evaluate(async () => {
    const { view, game, deadline, frame, raster } = window.fixture;
    const stats = await window.rapid;
    await deadline(view.textReady('counter'));
    await frame();
    return {
      ...stats,
      finalVisible: !!raster('counter'),
      finalValue: window.fixture.state.value,
      labelStatus: game.browser.getLabelStatus()
    };
  });
  report.finalInk = await snapshot('final');
  report.lifecycle = await page.evaluate(async () => {
    const { game, view, frame, deadline, rejected, state, raster } = window.fixture;
    state.value = 124;
    view.refresh();
    const old = view.textReady('counter');
    state.value = 125;
    view.refresh();
    const superseded = await rejected(old);
    view.hide();
    await frame();
    await frame();
    const hidden = await rejected(view.textReady('counter'));
    const invisible = raster('counter') === undefined;
    view.show();
    await frame();
    await deadline(view.textReady('counter'));
    await frame();
    const revealed = !!raster('counter');
    state.value = 126;
    view.refresh();
    const closing = view.textReady('counter');
    view.close();
    await frame();
    await frame();
    const disposed = await rejected(closing);
    const direct = game.text('−1.5 秒', { retainLastText: true });
    await deadline(direct.ready);
    const committed = direct.getChildAt(0).getChildAt(0);
    direct.text = '2.6 s';
    const directKept = direct.getChildAt(0).visible && direct.getChildAt(0).getChildAt(0) === committed;
    const oldDirect = direct.ready;
    direct.text = '-10.25 秒';
    const directSuperseded = await rejected(oldDirect);
    await deadline(direct.ready);
    direct.text = 'queued 20';
    direct.text = 'queued 21';
    direct.color = 0x336699;
    const styleHidden = !direct.getChildAt(0).visible;
    await deadline(direct.ready);
    direct.size = 30;
    const sizeHidden = !direct.getChildAt(0).visible;
    await deadline(direct.ready);
    direct.text = 'x'.repeat(8200);
    const failed = await deadline(
      direct.ready.then(
        () => false,
        () => true
      )
    );
    const failedReleased = !direct.getChildAt(0).visible && direct.getChildAt(0).numChildren === 0;
    direct.text = 'Recovered 22';
    await deadline(direct.ready);
    const recovered = direct.getChildAt(0).visible && direct.getChildAt(0).numChildren > 0;
    direct.text = '';
    const emptyHidden = !direct.getChildAt(0).visible;
    await deadline(direct.ready);
    direct.dispose();
    const words = { value: '10' };
    const explicit = game.show(
      {
        root: {
          type: 'panel',
          children: [
            { type: 'text', name: 'numeric', text: '10' },
            { type: 'text', name: 'strict', text: '10' },
            { type: 'panel', name: 'press', role: 'button', children: [{ type: 'text', name: 'price', text: '10' }] }
          ]
        }
      },
      {
        state: words,
        bind: {
          numeric: { text: s => s.value, retainLastText: true },
          strict: { pick: s => Number(s.value), retainLastText: false },
          press: { tap: () => {} },
          price: { pick: s => Number(s.value) }
        }
      }
    );
    await deadline(Promise.all(['numeric', 'strict', 'price'].map(name => explicit.textReady(name))));
    words.value = '11';
    explicit.refresh();
    const visible = name => explicit.get(name).getChildAt(0).getChildAt(0).visible;
    const explicitPolicy = {
      retained: visible('numeric'),
      optOutHidden: !visible('strict'),
      actionChildHidden: !visible('price')
    };
    let buttonPolicyRejected = false;
    try {
      game.show({ root: { type: 'button', name: 'bad', text: 'x' } }, { bind: { bad: { retainLastText: true } } });
    } catch (cause) {
      buttonPolicyRejected = cause.code === 'UI_VIEW_BINDING_INVALID';
    }
    explicit.close();
    await game.dispose();
    return {
      superseded,
      hidden,
      invisible,
      revealed,
      disposed,
      directKept,
      directSuperseded,
      styleHidden,
      sizeHidden,
      failed,
      failedReleased,
      recovered,
      emptyHidden,
      explicitPolicy,
      buttonPolicyRejected
    };
  });
  assert.ok(report.initialInk > 100 && report.finalInk > 100);
  assert.deepEqual(report.immediate, {
    counterKept: true,
    actionHidden: true,
    actionName: 'New action',
    focus: 'action'
  });
  assert.ok(
    report.rapidInk.every(ink => ink > 100),
    JSON.stringify(report.rapidInk)
  );
  assert.equal(report.rapid.blank, 0);
  assert.ok(report.rapid.revisions > 1, 'sustained updates make actual intermediate raster progress');
  assert.equal(report.rapid.finalVisible, true);
  assert.equal(report.rapid.finalValue, 123);
  assert.equal(report.rapid.superseded, 'AbortError');
  assert.deepEqual(report.lifecycle, {
    superseded: 'AbortError',
    hidden: 'AbortError',
    invisible: true,
    revealed: true,
    disposed: 'AbortError',
    directKept: true,
    directSuperseded: 'AbortError',
    styleHidden: true,
    sizeHidden: true,
    failed: true,
    failedReleased: true,
    recovered: true,
    emptyHidden: true,
    explicitPolicy: { retained: true, optOutHidden: true, actionChildHidden: true },
    buttonPolicyRejected: true
  });
  assert.deepEqual(report.errors, []);
  report.passed = true;
} catch (error) {
  report.failure = String(error);
  await page?.screenshot({ path: path.join(output, 'failure.png') }).catch(() => {});
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
}
if (!report.passed) process.exitCode = 1;
