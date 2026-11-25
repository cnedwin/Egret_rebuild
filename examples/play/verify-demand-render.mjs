// SPDX-License-Identifier: Apache-2.0
// Exercise the public Play entry using an isolated page and self-generated assets.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createExampleServer } from '../../tools/serve-example.mjs';

const [playwrightPath, outputPath, backend = 'webgl2', executablePath, renderer = 'software'] = process.argv.slice(2);
if (
  !playwrightPath ||
  !outputPath ||
  fs.existsSync(outputPath) ||
  !['webgl2', 'webgpu'].includes(backend) ||
  !['software', 'hardware'].includes(renderer)
)
  throw new Error(
    'Usage: node examples/play/verify-demand-render.mjs <Playwright index.mjs> <new output.json> [webgl2|webgpu] [Chromium executable] [software|hardware]'
  );

const { chromium } = await import(pathToFileURL(path.resolve(playwrightPath)).href);
const { PNG } = createRequire(import.meta.url)('pngjs');
const root = fileURLToPath(new URL('../..', import.meta.url));
const examples = createExampleServer(root);
const importMap = fs
  .readFileSync(path.join(root, 'examples/play/index.html'), 'utf8')
  .match(/<script type="importmap">[\s\S]*?<\/script>/)[0]
  .replace('/packages/engine/node_modules/robust-predicates/', '/test-predicates/');
const predicates = ['packages/engine/node_modules/robust-predicates', 'node_modules/robust-predicates']
  .map(directory => path.join(root, directory))
  .find(directory => fs.existsSync(path.join(directory, 'index.js')));
assert.ok(predicates, 'install locked dependencies before running the fixture');
const picture = new PNG({ width: 2, height: 2 });
for (let i = 0; i < picture.data.length; i += 4) picture.data.set([17, 239, 97, 255], i);
const png = PNG.sync.write(picture);
let finishImage;
const server = http.createServer((request, response) => {
  if (request.url === '/demand') {
    response.writeHead(200, { 'content-type': 'text/html' });
    response.end('<!doctype html><meta charset="utf-8"><style>body{margin:0}</style>' + importMap);
  } else if (request.url === '/demand.png') {
    finishImage = () => response.writeHead(200, { 'content-type': 'image/png' }).end(png);
  } else if (/^\/test-predicates\/(?:esm\/)?[\w-]+\.js$/.test(request.url)) {
    response.writeHead(200, { 'content-type': 'text/javascript' });
    response.end(fs.readFileSync(path.join(predicates, request.url.slice('/test-predicates/'.length))));
  } else examples.emit('request', request, response);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch({
  ...(executablePath === undefined ? {} : { executablePath }),
  args:
    renderer === 'hardware'
      ? ['--enable-gpu', '--enable-unsafe-webgpu', '--ignore-gpu-blocklist']
      : [
          '--use-angle=swiftshader',
          '--enable-unsafe-swiftshader',
          '--ignore-gpu-blocklist',
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
const report = { backend, renderer, browser: browser.version(), cases: {}, errors: [] };
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, hasTouch: true });
  const page = await context.newPage();
  page.on('pageerror', error => report.errors.push(error.message));
  await page.goto('http://127.0.0.1:' + server.address().port + '/demand');
  report.adapter = await page.evaluate(async requested => {
    if (requested === 'webgpu') {
      const adapter = await navigator.gpu?.requestAdapter();
      if (adapter === undefined || adapter === null) return null;
      const { vendor, architecture, description, isFallbackAdapter } = adapter.info;
      return { vendor, architecture, description, isFallbackAdapter };
    }
    const probe = document.createElement('canvas').getContext('webgl2');
    if (probe === null) return null;
    const debug = probe.getExtension('WEBGL_debug_renderer_info');
    const vendor = probe.getParameter(debug?.UNMASKED_VENDOR_WEBGL ?? probe.VENDOR);
    const renderer = probe.getParameter(debug?.UNMASKED_RENDERER_WEBGL ?? probe.RENDERER);
    probe.getExtension('WEBGL_lose_context')?.loseContext();
    return { vendor, renderer };
  }, backend);

  const frames = count =>
    page.evaluate(
      n =>
        new Promise(resolve => {
          const times = [];
          const countFrame = at => {
            times.push(at);
            if (times.length > n) resolve(times.slice(1).map((value, i) => value - times[i]));
            else requestAnimationFrame(countFrame);
          };
          requestAnimationFrame(countFrame);
        }),
      count
    );
  const snapshot = () => page.evaluate(() => window.fixture.game.browser.loop.snapshot());
  const recordIdle = async () => {
    const before = await snapshot(),
      intervals = await frames(30),
      after = await snapshot();
    const ordered = intervals.slice().sort((a, b) => a - b);
    return {
      submissions: after.frames - before.frames,
      steps: after.steps - before.steps,
      p95Ms: ordered[Math.ceil(0.95 * ordered.length) - 1]
    };
  };

  const start = mode =>
    page.evaluate(
      async ({ mode, backend }) => {
        const { play } = await import('@egret/engine/play');
        const fixture = { clicks: 0, updates: 0, onKey: false };
        window.fixture = fixture;
        fixture.game = await play({
          width: 640,
          height: 400,
          backend,
          audio: false,
          ...(mode === undefined ? {} : { renderMode: mode }),
          setup(game) {
            fixture.mark = game.rect(500, 280, 50, 40, 0x6355ac);
            fixture.button = game.button('Change', { x: 120, y: 100 }, () => {
              fixture.clicks++;
              fixture.mark.y += 12;
            });
            fixture.label = game.text('First', { x: 120, y: 180 });
          },
          update(_seconds, game) {
            fixture.updates++;
            if (game.keys.pressed('space')) {
              fixture.onKey = true;
              fixture.mark.x -= 30;
            }
          }
        });
      },
      { mode, backend }
    );
  await start();
  await frames(12);
  report.cases.defaultIdle = await recordIdle();
  assert.ok(report.cases.defaultIdle.submissions > 0, 'default continuous display should submit');
  await page.evaluate(() => window.fixture.game.dispose());
  await start('on-demand');
  await frames(12);
  report.cases.onDemandIdle = await recordIdle();
  assert.equal(report.cases.onDemandIdle.submissions, 0, 'a static on-demand scene submitted a frame');
  assert.ok(report.cases.onDemandIdle.steps >= 20, 'on-demand should preserve frame-loop stepping');

  async function expectDrawing(name, action) {
    const before = await snapshot();
    await action();
    await page.waitForFunction(n => window.fixture.game.browser.loop.snapshot().frames > n, before.frames);
    const after = await snapshot();
    report.cases[name] = { frames: after.frames - before.frames };
    await frames(4);
  }
  const at = () =>
    page.evaluate(() => {
      const box = window.fixture.game.canvas.getBoundingClientRect();
      return [box.left + box.width * (120 / 640), box.top + box.height * (100 / 400)];
    });
  await expectDrawing('mouse', async () => page.mouse.click(...(await at())));
  assert.equal(await page.evaluate(() => window.fixture.clicks), 1);
  await expectDrawing('touch', async () => page.touchscreen.tap(...(await at())));
  assert.equal(await page.evaluate(() => window.fixture.clicks), 2);
  await expectDrawing('key', async () => page.keyboard.press('Space'));
  assert.equal(await page.evaluate(() => window.fixture.onKey), true);
  await expectDrawing('resize', async () => page.setViewportSize({ width: 1120, height: 800 }));
  await expectDrawing('explicit', async () => page.evaluate(() => window.fixture.game.invalidate()));
  const pending = page.evaluate(() =>
    window.fixture.game.image('/demand.png', { x: 300, y: 100, width: 45 }).then(() => 'ready')
  );
  for (let waited = 0; finishImage === undefined && waited < 500; waited++)
    await new Promise(resolve => setTimeout(resolve, 8));
  assert.ok(finishImage, 'image request reached the fixture');
  report.cases.waitingForImage = await recordIdle();
  assert.equal(report.cases.waitingForImage.submissions, 0);
  await expectDrawing('image', async () => {
    finishImage();
    assert.equal(await pending, 'ready');
  });
  const [x, y] = await page.evaluate(() => {
    const box = window.fixture.game.canvas.getBoundingClientRect();
    return [Math.round(box.left + box.width * (300 / 640)), Math.round(box.top + box.height * (100 / 400))];
  });
  const displayed = PNG.sync.read(await page.screenshot({ clip: { x, y, width: 1, height: 1 } }));
  assert.deepEqual([...displayed.data.slice(0, 4)], [17, 239, 97, 255], 'the async texture reached the display');
  await expectDrawing('text', async () =>
    page.evaluate(() => {
      window.fixture.label.text = 'The measured words changed';
    })
  );
  await page.waitForFunction(() => window.fixture.label.width > 130);
  const first = await snapshot();
  await page.evaluate(() => {
    const f = window.fixture;
    f.animationDone = f.game.tween(f.mark).to({ x: 540 }, 0.5).done;
  });
  await page.waitForFunction(() => window.fixture.mark.x > 475);
  const pauseX = await page.evaluate(() => {
    const f = window.fixture;
    f.game.pause();
    return f.mark.x;
  });
  await frames(4);
  report.cases.pausedAnimation = await recordIdle();
  assert.equal(report.cases.pausedAnimation.submissions, 0);
  assert.equal(await page.evaluate(() => window.fixture.mark.x), pauseX);
  await page.evaluate(() => {
    const f = window.fixture;
    f.game.resume();
    return f.animationDone;
  });
  const last = await snapshot();
  report.cases.animation = { frames: last.frames - first.frames, steps: last.steps - first.steps };
  assert.ok(last.frames - first.frames >= 4, 'animation should draw several frames');
  assert.equal(await page.evaluate(() => window.fixture.mark.x), 540);
  await frames(10);
  report.cases.idleAfterAnimation = await recordIdle();
  assert.equal(report.cases.idleAfterAnimation.submissions, 0);
  assert.deepEqual(report.errors, []);
  await page.evaluate(() => window.fixture.game.dispose());
  report.status = 'PASS';
} catch (error) {
  report.status = 'FAIL';
  report.failure = String(error.message);
  throw error;
} finally {
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2) + '\n');
  await browser.close();
  server.close();
}
