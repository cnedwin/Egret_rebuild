// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { fingerprintFile, ownerRelativePath } from './lib/file-identity.mjs';
import { createExampleServer } from './serve-example.mjs';

const [playwright, output, ...extra] = process.argv.slice(2);
assert(playwright && output && !extra.length, 'Usage: node tools/verify-authored-scene3d.mjs <playwright-root> <new-output-directory>');
const repo = path.resolve(import.meta.dirname, '..');
const { chromium } = await import(pathToFileURL(path.join(playwright, 'index.mjs')));
const playwrightVersion = JSON.parse(readFileSync(path.join(playwright, 'package.json'), 'utf8')).version;
assert.equal(playwrightVersion, '1.62.1');
mkdirSync(output);
const server = createExampleServer(repo);
await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
const base = 'http://127.0.0.1:' + server.address().port;
const entry = base + '/examples/authored-scene3d/index.html';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const served = new Map(), faults = [];
server.on('request', (request, response) => response.on('finish', () => {
  if (response.statusCode !== 200) return;
  const name = new URL(request.url, base).pathname.slice(1);
  const actual = name.startsWith('vendor/robust-predicates/')
    ? 'packages/engine/node_modules/robust-predicates/' + name.slice('vendor/robust-predicates/'.length) : name;
  try {
    const logical = ownerRelativePath(repo, realpathSync(path.join(repo, actual)));
    const pin = fingerprintFile(repo, logical);
    if (served.has(logical)) assert.deepEqual(pin, served.get(logical));
    else served.set(logical, pin);
  } catch (error) { faults.push(String(error)); }
}));

const report = {
  status: 'INCOMPLETE', node: process.version, playwrightVersion, channel: 'msedge', headless: true,
  inputs: ['tools/verify-authored-scene3d.mjs', 'tools/serve-example.mjs', 'tools/lib/file-identity.mjs'].map(file => fingerprintFile(repo, file)),
  backends: [],
};
const red = [255, 0, 0, 255], blue = [0, 0, 255, 255], green = [0, 255, 0, 255], black = [0, 0, 0, 255];
function sample(frame, x, y, expected) {
  const offset = 4 * (frame.width * y + x);
  const pixel = frame.bytes.slice(offset, offset + 4);
  assert.deepEqual(pixel, expected, frame.view + ' sample at ' + x + ',' + y);
  return { x, y, pixel };
}

let browser;
try {
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  report.browser = browser.version();
  for (const backend of ['webgl2', 'webgpu']) {
    const row = { backend, status: 'INCOMPLETE', frames: {} };
    report.backends.push(row);
    const page = await browser.newPage();
    page.setDefaultTimeout(15000);
    try {
      page.on('pageerror', error => faults.push(backend + ' ' + error.message));
      page.on('response', response => {
        if (response.status() >= 400) faults.push(backend + ' ' + response.status() + ' ' + new URL(response.url()).pathname);
      });
      await page.goto(entry + '?backend=' + backend);
      await page.waitForFunction(() => Boolean(globalThis.egretAuthoredScene));
      const availability = await page.evaluate(async () => {
        try { await globalThis.egretAuthoredScene.ready; return { ready: true }; }
        catch (error) {
          return { ready: false, code: error?.code, message: error?.message,
            webgpuAdapter: navigator.gpu ? Boolean(await navigator.gpu.requestAdapter()) : false };
        }
      });
      if (!availability.ready && backend === 'webgpu' && !availability.webgpuAdapter) {
        Object.assign(row, { status: 'UNAVAILABLE', availability });
        continue;
      }
      assert(availability.ready, JSON.stringify(availability));

      async function record(view) {
        const frame = await page.evaluate(() => globalThis.egretAuthoredScene.inspect());
        assert.deepEqual([frame.backend, frame.view, frame.nodeCount, frame.width, frame.height], [backend, view, 3, 120, 96]);
        assert.equal(frame.bytes.length, frame.width * frame.height * 4);
        const bytes = Buffer.from(frame.bytes);
        row.frames[view] = { sha256: hash(bytes), firstDrawColor: frame.firstDrawColor,
          overlay: sample(frame, 60, 48, green), background: sample(frame, 3, 3, black) };
        row.renderer = frame.renderer;
        return frame;
      }
      const initial = await record('initial');
      row.frames.initial.depth = [sample(initial, 48, 45, red), sample(initial, 85, 45, blue)];
      await page.evaluate(() => globalThis.egretAuthoredScene.show('reversed'));
      const reversed = await record('reversed');
      assert.deepEqual(initial.firstDrawColor, [1, 0, 0]);
      assert.deepEqual(reversed.firstDrawColor, [0, 0, 1]);
      assert.deepEqual(reversed.bytes, initial.bytes, 'Near-depth pixels survive reversed GLB child order.');

      await page.locator('[data-view="moved"]').click();
      await page.waitForFunction(() => globalThis.egretAuthoredScene.inspect()?.view === 'moved');
      const moved = await record('moved');
      row.frames.moved.depth = [sample(moved, 48, 45, blue), sample(moved, 85, 45, red)];
      assert.notEqual(row.frames.initial.sha256, row.frames.moved.sha256);

      await page.locator('[data-view="orbit"]').click();
      await page.waitForFunction(() => globalThis.egretAuthoredScene.inspect()?.view === 'orbit');
      await record('orbit');
      assert.notEqual(row.frames.initial.sha256, row.frames.orbit.sha256);

      await page.evaluate(() => globalThis.egretAuthoredScene.show('orthographic'));
      const ortho = await record('orthographic');
      row.frames.orthographic.projection = [sample(initial, 44, 45, red), sample(ortho, 44, 45, blue)];

      await page.locator('[data-view="initial"]').click();
      await page.waitForFunction(() => globalThis.egretAuthoredScene.inspect()?.view === 'initial');
      const reset = await page.evaluate(() => globalThis.egretAuthoredScene.inspect());
      assert.deepEqual(reset.bytes, initial.bytes, 'Node edits and view changes leave the imported scene intact.');
      row.resetSha256 = hash(Buffer.from(reset.bytes));
      await page.evaluate(() => globalThis.egretAuthoredScene.close());
      row.status = 'PASS';
    } finally { await page.close(); }
  }
  assert.deepEqual(faults, []);
  for (const pin of [...report.inputs, ...served.values()]) assert.deepEqual(fingerprintFile(repo, pin.path), pin);
  report.status = report.backends.every(row => row.status === 'PASS') ? 'PASS' : 'PARTIAL_BACKEND_UNAVAILABLE';
  if (report.status !== 'PASS') process.exitCode = 1;
} catch (error) {
  report.status = 'FAIL';
  report.error = String(error.stack ?? error);
  console.error(report.error);
  process.exitCode = 1;
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
  report.served = [...served.values()];
  report.faults = faults;
  writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(report.status, report.backends.map(row => row.backend + ':' + row.status).join(' '));
}
