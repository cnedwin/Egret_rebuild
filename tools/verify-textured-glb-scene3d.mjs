// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { fingerprintFile, ownerRelativePath } from './lib/file-identity.mjs';
import { createExampleServer } from './serve-example.mjs';

const [playwrightRoot, output, ...extra] = process.argv.slice(2);
assert(playwrightRoot && output && !extra.length,
  'Usage: node tools/verify-textured-glb-scene3d.mjs <playwright-root> <new-output-directory>');
const repo = path.resolve(import.meta.dirname, '..');
const version = JSON.parse(readFileSync(path.join(playwrightRoot, 'package.json'), 'utf8')).version;
assert.equal(version, '1.62.1');
const { chromium } = await import(pathToFileURL(path.resolve(playwrightRoot, 'index.mjs')));
mkdirSync(output);

const example = 'examples/textured-scene3d/';
const exampleFiles = ['index.html', 'main.mjs', 'room-glb.mjs'].map(name => example + name);
const inputs = ['tools/verify-textured-glb-scene3d.mjs', 'tools/serve-example.mjs', ...exampleFiles];
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const report = { status: 'FAIL', node: process.version, playwright: version, backends: [], faults: [],
  inputs: inputs.map(name => fingerprintFile(repo, name)), observeSha256: sha(observe.toString()) };
const served = new Map();
const server = createExampleServer(repo);

// Record the canonical file actually used by the browser, including the public vendor alias.
server.on('request', (request, response) => response.on('finish', () => {
  const name = new URL(request.url, 'http://127.0.0.1').pathname.slice(1);
  if (response.statusCode !== 200) {
    report.faults.push('HTTP ' + response.statusCode + ' ' + name);
    return;
  }
  const alias = 'vendor/robust-predicates/';
  const physical = name.startsWith(alias)
    ? 'packages/engine/node_modules/robust-predicates/' + name.slice(alias.length) : name;
  try {
    const relative = ownerRelativePath(repo, realpathSync(path.join(repo, physical)));
    const pin = fingerprintFile(repo, relative);
    if (served.has(relative)) assert.deepEqual(pin, served.get(relative));
    else served.set(relative, pin);
  } catch (error) { report.faults.push(String(error)); }
}));

async function observe(backend) {
  const start = performance.now();
  while (!window.egretTexturedScene3D && performance.now() - start < 4000)
    await new Promise(resolve => setTimeout(resolve, 30));
  const app = window.egretTexturedScene3D;
  if (!app) throw Error('Expected example API missing: ' + document.body.innerText);
  try { await app.ready; } catch (error) {
    const details = [];
    for (let item = error; item && details.length < 5; item = item.cause) {
      details.push({ message: String(item), code: item.code, detail: item.detail, context: item.context, stack: item.stack });
    }
    throw Error(JSON.stringify(details));
  }
  const canvas = document.querySelector('canvas');
  const context = backend === 'webgl2' && canvas.getContext('webgl2');
  const debug = context && context.getExtension('WEBGL_debug_renderer_info');
  const renderer = debug ? context.getParameter(debug.UNMASKED_RENDERER_WEBGL) : undefined;
  const adapter = backend === 'webgpu' ? await navigator.gpu.requestAdapter() : undefined;
  const device = adapter?.info && { vendor: adapter.info.vendor, architecture: adapter.info.architecture,
    device: adapter.info.device, description: adapter.info.description, isFallbackAdapter: adapter.info.isFallbackAdapter };
  function frame(result) {
    const { width, height, bytes } = result.pixels;
    return { width, height, bytes: Array.from(bytes), draws: result.scene.draws.length, cards: result.scene.cards.length,
      sharedSource: result.scene.draws[0]?.texture?.source === result.scene.cards[0]?.source };
  }
  const cold = app.state();
  const behind = frame(await app.draw('behind', false));
  const afterCold = app.state();
  const front = frame(await app.draw('front', false));
  const afterFront = app.state();
  const staged = frame(await app.draw('front', true));
  const afterStage = app.state();
  const loss = await app.recover();
  const recovered = app.state();
  const rebuilt = frame(await app.draw('front', true));
  const afterRestore = app.state();
  const restoredDirect = frame(await app.draw('front', false));
  const afterRestoredDirect = app.state();
  await app.close();
  return { renderer, device, cold, afterCold, afterFront, afterStage, loss, recovered, afterRestore, afterRestoredDirect,
    dpr: devicePixelRatio, frames: { behind, front, staged, rebuilt, restoredDirect } };
}

const colors = { red: [255, 0, 0, 255], wallRed: [188, 0, 0, 255], green: [0, 255, 0, 255],
  blue: [0, 0, 255, 255], yellow: [188, 255, 0, 255] };
const px = (frame, x, y) => frame.bytes.slice((y * frame.width + x) * 4, (y * frame.width + x) * 4 + 4);
function check(row, result) {
  const { frames, ...metadata } = result;
  Object.assign(row, metadata, { frames: {} });
  for (const [label, frame] of Object.entries(frames)) {
    row.frames[label] = { sha256: sha(Buffer.from(frame.bytes)), shape: [frame.width, frame.height, frame.bytes.length],
      draws: frame.draws, cards: frame.cards, sharedSource: frame.sharedSource, witnesses: {
        topLeft: px(frame, 30, 25), topRight: px(frame, 110, 25), bottomLeft: px(frame, 30, 73),
        bottomRight: px(frame, 110, 73), actor: px(frame, 65, 43), hud: px(frame, 3, 3)
      } };
    writeFileSync(path.join(output, row.backend + '-' + label + '.rgba'), Buffer.from(frame.bytes));
  }
  for (const [label, frame] of Object.entries(row.frames)) {
    assert.deepEqual(frame.shape, [144, 96, 55296]);
    assert.deepEqual([frame.draws, frame.cards, frame.sharedSource], [1, 1, true]);
    assert.deepEqual(frame.witnesses, { topLeft: colors.wallRed, topRight: colors.green, bottomLeft: colors.blue,
      bottomRight: colors.yellow, actor: label === 'behind' ? colors.wallRed : colors.red, hud: colors.red },
      row.backend + ' ' + label + ' named pixel mismatch');
  }
  assert.equal(row.frames.staged.sha256, row.frames.front.sha256);
  assert.equal(row.frames.rebuilt.sha256, row.frames.front.sha256);
  assert.equal(row.frames.restoredDirect.sha256, row.frames.front.sha256);
  assert.equal(row.cold.uploads, 0);
  assert.equal(row.afterCold.uploads, 1);
  assert.equal(row.afterCold.pages, 1);
  assert.deepEqual(row.afterFront, row.afterCold);
  assert.deepEqual(row.afterStage, row.afterCold);
  assert.equal(row.recovered.generation, row.afterStage.generation + 1);
  assert.equal(row.recovered.pages, 0);
  assert.equal(row.afterRestore.pages, 1);
  assert.deepEqual(row.afterRestoredDirect, row.afterRestore);
  assert.equal(row.afterRestore.uploads - row.recovered.uploads, 1);
  if (row.backend === 'webgl2') assert.deepEqual(row.loss, { lostTrusted: true, restoredTrusted: true });
  else assert.equal(row.loss.reason, 'destroyed');
  row.status = 'PASS';
}

let browser;
try {
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const origin = 'http://127.0.0.1:' + server.address().port;
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  report.browser = browser.version();
  for (const backend of ['webgl2', 'webgpu']) {
    const row = { backend, status: 'FAIL', errors: [] };
    report.backends.push(row);
    const page = await browser.newPage();
    page.on('pageerror', error => row.errors.push(String(error)));
    page.on('console', event => { if (event.type() === 'error') row.errors.push(event.text()); });
    let timer;
    try {
      const response = await page.goto(origin + '/' + example + 'index.html?backend=' + backend + '&probe=1',
        { timeout: 15000 });
      assert.equal(response?.status(), 200);
      const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => reject(Error('Browser observation deadline exceeded')), 25000);
      });
      const observation = page.evaluate('(' + observe + ')(' + JSON.stringify(backend) + ')');
      check(row, await Promise.race([observation, timeout]));
      assert.deepEqual(row.errors, []);
    } catch (error) {
      row.status = 'FAIL';
      row.error = String(error.stack ?? error);
      console.error(row.error);
    } finally {
      clearTimeout(timer);
      await page.close();
    }
  }
  assert.deepEqual(report.faults, []);
  for (const name of exampleFiles) assert(served.has(name), 'Example file was not served: ' + name);
  for (const pin of [...report.inputs, ...served.values()]) assert.deepEqual(fingerprintFile(repo, pin.path), pin);
  if (report.backends.every(row => row.status === 'PASS')) report.status = 'PASS';
} catch (error) {
  report.error = String(error.stack ?? error);
  console.error(report.error);
} finally {
  try {
    await browser?.close();
  } catch (error) {
    report.status = 'FAIL';
    report.faults.push(String(error));
  }
  await new Promise(resolve => server.close(resolve));
  report.served = [...served.values()].sort((a, b) => a.path.localeCompare(b.path, 'en'));
  writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(report.status, report.backends.map(row => row.backend + ':' + row.status).join(' '));
  if (report.status !== 'PASS') process.exitCode = 1;
}
