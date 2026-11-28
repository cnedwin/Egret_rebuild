// SPDX-License-Identifier: Apache-2.0
// Real browser acceptance of Play when optional sound and gamepad hosts are absent.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { once } from 'node:events';
import { pathToFileURL } from 'node:url';
import { PNG } from 'pngjs';
import { createExampleServer } from '../../tools/serve-example.mjs';

const [playwrightFile, output, host = 'webkit', executablePath] = process.argv.slice(2);
assert.ok(path.isAbsolute(playwrightFile) && path.isAbsolute(output));
assert.ok(['webkit', 'chromium'].includes(host));
const { [host]: launcher } = await import(pathToFileURL(playwrightFile).href);
const map = fs
  .readFileSync(new URL('index.html', import.meta.url), 'utf8')
  .match(/<script type="importmap">([\s\S]*?)<\/script>/u)[1];
const html =
  '<!doctype html><meta charset="utf-8"><link rel="icon" href="data:,"><script type="importmap">' +
  map +
  '</script><body style="margin:0;background:#123456"><canvas style="display:block;width:320px;height:200px"></canvas></body>';
fs.mkdirSync(output, { recursive: true });
const server = createExampleServer(),
  receipts = [];
let browser;
try {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const origin = 'http://127.0.0.1:' + server.address().port;
  browser = await launcher.launch(
    host === 'chromium'
      ? {
          ...(executablePath ? { executablePath } : {}),
          args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']
        }
      : {}
  );
  for (const mode of ['default', 'off', 'required']) {
    const page = await browser.newPage({ viewport: { width: 320, height: 200 }, deviceScaleFactor: 1 });
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    await page.route(origin + '/optional-hosts', route =>
      route.fulfill({ contentType: 'text/html; charset=utf-8', body: html })
    );
    await page.goto(origin + '/optional-hosts');
    const result = await page.evaluate(async mode => {
      const native = {
        audio: typeof AudioContext,
        prefixed: typeof globalThis.webkitAudioContext,
        gamepads: typeof navigator.getGamepads
      };
      // Keep the same real host and make absence deterministic even on a browser supporting both facilities.
      for (const key of ['AudioContext', 'webkitAudioContext'])
        if (typeof globalThis[key] === 'function')
          Object.defineProperty(globalThis, key, { value: undefined, configurable: true });
      if (typeof navigator.getGamepads === 'function')
        Object.defineProperty(navigator, 'getGamepads', { value: undefined, configurable: true });
      const { play } = await import('@egret/engine/play'),
        { Sprite } = await import('@egret/engine');
      let setup = false;
      try {
        const game = await play({
          canvas: document.querySelector('canvas'),
          backend: 'webgl2',
          width: 320,
          height: 200,
          pixelRatio: 1,
          ...(mode === 'off' ? { audio: false } : mode === 'required' ? { audio: true } : {}),
          setup(g) {
            setup = true;
            const s = new Sprite();
            s.graphics.beginFill(0x33bb77).drawRect(0, 0, 320, 200).endFill();
            g.world.addChild(s);
          }
        });
        window.keepGame = game;
        game.sfx.play('click');
        const loop = game.sfx.loop('hum');
        await game.music.play('calm');
        loop.stop();
        return { native, setup, stopped: loop.stopped };
      } catch (e) {
        return { native, setup, code: e.code, message: String(e) };
      }
    }, mode);
    await page.waitForTimeout(400);
    const png = PNG.sync.read(await page.screenshot({ path: path.join(output, mode + '.png') }));
    const p = (100 * png.width + 160) * 4;
    receipts.push({ mode, ...result, errors, pixel: [...png.data.subarray(p, p + 4)] });
    await page.evaluate(async () => {
      await window.keepGame?.dispose();
    });
    await page.close();
  }
  const [automatic, off, required] = receipts;
  for (const r of [automatic, off]) {
    assert.equal(r.setup, true, JSON.stringify(r));
    assert.equal(r.code, undefined);
    assert.equal(r.stopped, true);
    assert.ok(r.pixel[1] > r.pixel[0] + 60 && r.pixel[1] > r.pixel[2] + 30, JSON.stringify(r));
    assert.deepEqual(r.errors, []);
  }
  assert.equal(required.code, 'AUDIO_HOST_UNAVAILABLE', JSON.stringify(required));
  assert.equal(required.setup, false);
} finally {
  fs.writeFileSync(path.join(output, 'receipt.json'), JSON.stringify({ host, receipts }, null, 2) + '\n');
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
