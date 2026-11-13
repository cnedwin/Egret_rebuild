// SPDX-License-Identifier: Apache-2.0
// A page opened from the clean consumer. After tools/verify-clean-consumer.mjs has packed and
// installed the default engine into a new project outside this checkout, this serves that project
// alone, opens a page of the project's own in a real browser, and has it draw and answer a press
// with the installed copy: no module comes from the checkout, and nothing is bundled.
//
//   pnpm exec node tools/verify-clean-consumer-page.mjs <absolute Playwright index.mjs> <new absolute directory outside the checkout> [software] [--offline]
//
//   software   run the browser Playwright bundles, headless, with software rendering. Without it
//              the installed Edge is launched headed, and both back ends must draw.
//   --offline  as for the clean-consumer check: install without the registry.
//
// The report is printed and written to <directory>/page-report.json. Times are what one cold run
// took over loopback, unbundled and uncompressed; they are observations, not a budget.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { verifyCleanConsumer } from './verify-clean-consumer.mjs';

const BACKENDS = ['webgl2', 'webgpu'];
const TYPES = { '.html': 'text/html', '.mjs': 'text/javascript', '.js': 'text/javascript', '.json': 'application/json' };
/** The stage of the page, the button on it, and the three colours a check reads back. */
export const SCENE = { width: 320, height: 200, button: { x: 40, y: 60, width: 120, height: 48 }, clear: 0x102030, idle: 0x3d4a63, activated: 0x2f8f6b };

function refuse(code, message) { return Object.assign(new Error(code + ': ' + message), { code }); }
const within = (parent, child) => { const relative = path.relative(parent, child); return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative)); };

/**
 * The import map a page of the consumer needs to load the installed packages without a bundler:
 * every entry each manifest declares, and the private names of a package inside that package only.
 * Each address is a file inside the consumer.
 */
export function importMapOf(consumer) {
  const root = fs.realpathSync(consumer), engine = fs.realpathSync(path.join(root, 'node_modules', '@egret', 'engine'));
  // The package manager links what the engine depends on beside the engine.
  const beside = path.dirname(path.dirname(engine));
  const address = file => {
    const real = fs.realpathSync(file);
    if (!within(root, real)) throw refuse('CLEAN_CONSUMER_PAGE_OUTSIDE', real + ' is outside the consumer');
    return '/' + path.relative(root, real).split(path.sep).map(encodeURIComponent).join('/');
  };
  const imports = {}, scopes = {}, packages = [];
  for (const name of ['@egret/engine', '@egret/runtime', '@egret/contracts', 'robust-predicates']) {
    const directory = name === '@egret/engine' ? engine : fs.realpathSync(path.join(beside, name));
    const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'package.json'), 'utf8'));
    const declared = typeof manifest.exports === 'string' ? { '.': { import: manifest.exports } } : manifest.exports ?? { '.': { import: manifest.module ?? manifest.main ?? './index.js' } };
    for (const [subpath, target] of Object.entries(declared)) {
      const file = typeof target === 'string' ? target : target.import ?? target.default;
      if (typeof file !== 'string') throw refuse('CLEAN_CONSUMER_PAGE_ENTRY', name + ' ' + subpath + ' has no module to import');
      imports[subpath === '.' ? name : name + subpath.slice(1)] = address(path.join(directory, file));
    }
    const own = Object.entries(manifest.imports ?? {});
    if (own.length > 0) scopes[address(directory) + '/'] = Object.fromEntries(own.map(([key, target]) => [key, address(path.join(directory, typeof target === 'string' ? target : target.import ?? target.default))]));
    packages.push({ name, directory: address(directory) + '/', entries: Object.keys(declared).length, privateNames: own.length });
  }
  return { root, map: { imports, scopes }, packages };
}

/** The consumer's own page: one canvas, and one module that uses the installed engine through public entries only. */
export function pageFiles(map) {
  const { width, height, button, clear, idle, activated } = SCENE;
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Clean consumer page</title>
  <link rel="icon" href="data:,">
  <script type="importmap">${JSON.stringify(map)}</script>
  <style>body { margin: 16px; } canvas { display: block; width: ${width}px; height: ${height}px; border: 0; padding: 0; }</style>
</head>
<body>
  <canvas id="scene" width="${width}" height="${height}"></canvas>
  <script type="module" src="./main.mjs"></script>
</body>
</html>
`;
  const main = `// The page of a project that installed @egret/engine: a button drawn by the engine, pressed with a pointer.
import { createEngineForProfile, SHARED_FRAME_PROFILE_2D, Sprite } from '@egret/engine';
import { createActionControl } from '@egret/engine/ui';
import { createBrowserPointerInput } from '@egret/engine/web/pointer';

const state = globalThis.__egretConsumerPage = { backend: new URLSearchParams(location.search).get('backend'), marks: { module: performance.now() }, activations: 0, samples: {}, ready: false, interacted: false, failure: undefined };
try {
  const canvas = document.querySelector('#scene');
  const factory = state.backend === 'webgpu' ? (await import('@egret/engine/webgpu')).createSharedWebGPUHost : (await import('@egret/engine/webgl2')).createSharedWebGL2Host;
  // Reading a frame back is how a check knows what was drawn. A game leaves it off.
  const host = factory({ canvas, pixelRatio: 1, enableReadback: true });
  const engine = await createEngineForProfile({ host }, SHARED_FRAME_PROFILE_2D);
  state.marks.engine = performance.now();
  const scope = engine.createScope(), button = engine.stage.addChild(scope.use(new Sprite()));
  button.x = ${button.x}; button.y = ${button.y}; button.touchEnabled = true; button.hitArea = { x: 0, y: 0, width: ${button.width}, height: ${button.height} };
  const paint = colour => { button.graphics.clear(); button.graphics.beginFill(colour).drawRect(0, 0, ${button.width}, ${button.height}).endFill(); };
  const frame = Object.freeze({ width: ${width}, height: ${height}, clearColor: ${clear}, clearAlpha: 1 });
  /** Draws one frame and reads it back from the Host: the colour inside the button and the colour beside it. */
  async function draw(name) {
    const read = host.requestReadback();
    engine.renderSharedFrame(frame);
    const result = await read;
    await host.whenIdle();
    state.marks[name] = performance.now();
    const at = (x, y) => { const offset = (Math.round(y * result.height / ${height}) * result.width + Math.round(x * result.width / ${width})) * 4; return [...result.bytes.subarray(offset, offset + 4)]; };
    state.samples[name] = { size: [result.width, result.height], inside: at(${button.x + button.width / 2}, ${button.y + button.height / 2}), beside: at(${button.x + button.width + 60}, ${button.y + button.height + 60}) };
  }
  paint(${idle});
  const pointer = createBrowserPointerInput({ engine, scope, width: ${width}, height: ${height} });
  canvas.addEventListener('pointerdown', () => { state.marks.pointerDown ??= performance.now(); }, { capture: true });
  createActionControl({ input: pointer, target: button, onActivate() {
    state.activations++; state.marks.activated = performance.now(); paint(${activated});
    draw('interactionFrame').then(() => { state.interacted = true; }, cause => { state.failure = String(cause?.code ?? cause?.message ?? cause); });
  } });
  await draw('firstFrame');
  state.ready = true;
} catch (cause) { state.failure = String(cause?.code ?? cause?.message ?? cause); }
`;
  return { 'page/index.html': html, 'page/main.mjs': main };
}

/** Whether a colour read back from a Host is the opaque colour that was drawn, to within two steps a channel. */
export function matches(sample, colour) {
  return Array.isArray(sample) && sample.length === 4 && sample[3] === 255
    && [colour >> 16 & 255, colour >> 8 & 255, colour & 255].every((channel, index) => Math.abs(sample[index] - channel) <= 2);
}

/** Serves one directory and keeps what was asked of it. Nothing outside the directory is served. */
export function serveConsumer(root) {
  const requests = [];
  const server = http.createServer((request, response) => {
    let file, status = 404, body = Buffer.alloc(0);
    try { file = path.join(root, decodeURIComponent(new URL(request.url, 'http://localhost').pathname)); } catch { file = undefined; }
    if (file !== undefined && within(root, file) && fs.existsSync(file) && fs.statSync(file).isFile() && within(root, fs.realpathSync(file))) { status = 200; body = fs.readFileSync(file); }
    requests.push({ path: new URL(request.url, 'http://localhost').pathname, status, bytes: body.length });
    response.writeHead(status, { 'content-type': TYPES[path.extname(file ?? '')] ?? 'application/octet-stream', 'cache-control': 'no-store' });
    response.end(body);
  });
  return { requests, listen: () => new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve('http://127.0.0.1:' + server.address().port))), close: () => new Promise(resolve => server.close(resolve)) };
}

/** What the requests of one page load add up to, by the installed package each file belongs to. */
export function summarize(requests, packages) {
  const groups = Object.fromEntries([...packages.map(item => item.name), 'page'].map(name => [name, { requests: 0, bytes: 0 }]));
  for (const request of requests) {
    const owner = packages.find(item => decodeURIComponent(request.path).startsWith(decodeURIComponent(item.directory)))?.name ?? 'page', group = groups[owner];
    group.requests++; group.bytes += request.bytes;
  }
  return { requests: requests.length, bytes: requests.reduce((sum, request) => sum + request.bytes, 0), failed: requests.filter(request => request.status !== 200).map(request => request.path), groups };
}

export async function verifyCleanConsumerPage({ playwright, output, software = false, offline = false }) {
  if (typeof playwright !== 'string' || !path.isAbsolute(playwright) || !fs.existsSync(playwright)) throw refuse('CLEAN_CONSUMER_PAGE_PLAYWRIGHT', 'name the absolute path of the Playwright index.mjs to use');
  const consumerReport = verifyCleanConsumer({ output, offline });
  if (!consumerReport.ok) throw refuse('CLEAN_CONSUMER_PAGE_CONSUMER', 'the clean consumer did not pass: ' + consumerReport.rows.filter(row => !row.ok).map(row => row.name).join(', '));
  const consumer = path.join(fs.realpathSync(output), 'consumer'), { root, map, packages } = importMapOf(consumer);
  for (const [name, content] of Object.entries(pageFiles(map))) { fs.mkdirSync(path.dirname(path.join(root, name)), { recursive: true }); fs.writeFileSync(path.join(root, name), content); }
  const { chromium } = await import(pathToFileURL(playwright).href);
  const server = serveConsumer(root), origin = await server.listen();
  const browser = await chromium.launch(software ? { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } : { channel: 'msedge', headless: false });
  const rows = [], { button } = SCENE;
  try {
    for (const backend of BACKENDS) {
      const context = await browser.newContext({ viewport: { width: 640, height: 480 } }), page = await context.newPage(), faults = [], errors = [], foreign = [];
      page.on('pageerror', error => errors.push(String(error))); page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
      page.on('request', request => { if (!request.url().startsWith(origin + '/') && !request.url().startsWith('data:')) foreign.push(request.url()); });
      const from = server.requests.length;
      let state;
      try {
        await page.goto(origin + '/page/index.html?backend=' + backend);
        await page.waitForFunction(() => globalThis.__egretConsumerPage?.ready === true || globalThis.__egretConsumerPage?.failure !== undefined, undefined, { timeout: 30000 });
        state = await page.evaluate(() => globalThis.__egretConsumerPage);
        if (state.failure === undefined) {
          const box = await page.locator('#scene').boundingBox();
          await page.mouse.click(box.x + button.x + button.width / 2, box.y + button.y + button.height / 2);
          await page.waitForFunction(() => globalThis.__egretConsumerPage.interacted === true || globalThis.__egretConsumerPage.failure !== undefined, undefined, { timeout: 30000 });
          state = await page.evaluate(() => globalThis.__egretConsumerPage);
          await page.screenshot({ path: path.join(fs.realpathSync(output), 'page-' + backend + '.png') });
        }
      } catch (cause) { faults.push('the page did not finish: ' + String(cause?.message ?? cause).split('\n')[0]); }
      const load = summarize(server.requests.slice(from), packages), round = value => Math.round(value * 10) / 10;
      const started = state !== undefined && state.failure === undefined;
      if (state?.failure !== undefined) faults.push('the page failed: ' + state.failure);
      if (started) {
        if (!matches(state.samples.firstFrame?.inside, SCENE.idle) || !matches(state.samples.firstFrame?.beside, SCENE.clear)) faults.push('the first frame is not the button on its background: ' + JSON.stringify(state.samples.firstFrame));
        if (state.activations !== 1) faults.push('one press activated the button ' + state.activations + ' times');
        if (!matches(state.samples.interactionFrame?.inside, SCENE.activated) || !matches(state.samples.interactionFrame?.beside, SCENE.clear)) faults.push('the frame after the press does not show the pressed button: ' + JSON.stringify(state.samples.interactionFrame));
      }
      if (load.failed.length > 0) faults.push('requests the consumer could not serve: ' + load.failed.join(', '));
      if (foreign.length > 0) faults.push('requests that left the consumer: ' + foreign.join(', '));
      if (started && errors.length > 0) faults.push('errors of the page: ' + errors.join(' | '));
      // Software rendering has no WebGPU adapter that starts the Host: that back end is then not run, and said so.
      const unavailable = software && backend === 'webgpu' && !started;
      rows.push({
        name: 'page:' + backend, ok: unavailable ? null : faults.length === 0, status: unavailable ? 'not run' : faults.length === 0 ? 'pass' : 'fail', faults: unavailable ? [] : faults,
        ...(unavailable ? { reason: 'this browser offers no WebGPU that starts the Host under software rendering: ' + (state?.failure ?? faults[0] ?? 'unknown') } : {}),
        load,
        ...(started ? { milliseconds: { moduleStart: round(state.marks.module), engineReady: round(state.marks.engine), firstFrame: round(state.marks.firstFrame), pressToFrame: round(state.marks.interactionFrame - state.marks.pointerDown) }, frame: state.samples.firstFrame.size, activations: state.activations } : {}),
      });
      await context.close();
    }
  } finally { await browser.close(); await server.close(); }
  const report = {
    schemaVersion: 1, ok: rows.every(row => row.ok !== false) && rows.some(row => row.ok === true), node: process.versions.node, platform: process.platform + ' ' + process.arch,
    browser: software ? 'bundled Chromium ' + browser.version() + ', headless, software rendering' : 'installed Edge ' + browser.version() + ', headed, default launch',
    input: 'one mouse press injected through the automation protocol', consumer: { ok: consumerReport.ok, mode: consumerReport.mode, packageManager: consumerReport.packageManager },
    importMap: { entries: Object.keys(map.imports).length, privateNames: Object.values(map.scopes).reduce((sum, scope) => sum + Object.keys(scope).length, 0), packages }, scene: SCENE, rows,
    open: [
      'Times are one cold run over loopback: unbundled modules, uncompressed, no network. They are observations, not a budget.',
      ...(software ? ['Rendering was software. No hardware GPU drew, and WebGPU was not run unless its row says pass.'] : []),
      'Only Chromium was run. Firefox, Safari and a phone did not open the page.',
      'The page uses the default entry, the UI entry, the pointer entry and one back end. Other entries were loaded in Node by the clean-consumer check only.',
      'The packages are private at version 0.0.0 and are not published; the consumer installed the archives.',
      'A person new to the project has not walked through this.',
    ],
  };
  fs.writeFileSync(path.join(fs.realpathSync(output), 'page-report.json'), JSON.stringify(report, null, 2) + '\n');
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), flags = args.filter(argument => argument.startsWith('--')), rest = args.filter(argument => !argument.startsWith('--'));
  if (rest.length < 2 || rest.length > 3 || (rest.length === 3 && rest[2] !== 'software') || flags.some(flag => flag !== '--offline') || flags.length > 1) {
    console.error('Usage: pnpm exec node tools/verify-clean-consumer-page.mjs <absolute Playwright index.mjs> <new absolute directory outside the checkout> [software] [--offline]'); process.exit(2);
  }
  try {
    const report = await verifyCleanConsumerPage({ playwright: rest[0], output: rest[1], software: rest[2] === 'software', offline: flags.length === 1 });
    console.log(JSON.stringify(report, null, 2));
    process.exitCode = report.ok ? 0 : 1;
  } catch (error) { console.error(error.code ? error.message : error); process.exitCode = 1; }
}
