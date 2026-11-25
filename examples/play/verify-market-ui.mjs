// SPDX-License-Identifier: Apache-2.0
// Run the two independent market regressions with the same engine build in real Chromium.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { once } from 'node:events';
import { pathToFileURL } from 'node:url';
import { createExampleServer } from '../../tools/serve-example.mjs';
import { verifyDenseLabels } from './verify-dense-labels.mjs';
import { verifyPadNavigation } from './verify-pad-navigation.mjs';

const [playwrightFile, output, executablePath, selection = 'all'] = process.argv.slice(2);
if (
  ![playwrightFile, output, executablePath].every(file => file && path.isAbsolute(file)) ||
  !['all', 'labels', 'navigation'].includes(selection) ||
  process.argv.length > 6
) {
  throw new Error(
    'Usage: node examples/play/verify-market-ui.mjs <absolute Playwright index.mjs> <new absolute output directory> <absolute Chromium executable> [labels|navigation]'
  );
}

const { chromium } = await import(pathToFileURL(playwrightFile).href);
const document = fs.readFileSync(new URL('index.html', import.meta.url), 'utf8');
const importMap = document.match(/<script type="importmap">([\s\S]*?)<\/script>/u);
assert.ok(importMap, 'Play example import map');
const imports = JSON.parse(importMap[1]).imports;
imports['@egret/engine/web/game'] = '/packages/engine/dist/web/game.js';
const fixture =
  '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,">' +
  '<script type="importmap">' +
  JSON.stringify({ imports }) +
  '</script><body></body>';
const cases = [
  { id: 'labels', run: verifyDenseLabels, viewport: { width: 390, height: 844 } },
  { id: 'navigation', run: verifyPadNavigation, viewport: { width: 960, height: 540 } }
];

fs.mkdirSync(output);
const server = createExampleServer();
const report = { renderer: 'SwiftShader WebGL2', input: 'Playwright keyboard and injected standard gamepad', cases: [] };
let browser;
try {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const url = 'http://127.0.0.1:' + server.address().port + '/play-market-fixture';
  browser = await chromium.launch({
    executablePath,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-proxy-server']
  });
  report.browser = browser.version();
  for (const entry of cases.filter(candidate => selection === 'all' || selection === candidate.id)) {
    const context = await browser.newContext({ viewport: entry.viewport, deviceScaleFactor: 1 });
    const page = await context.newPage();
    const result = { id: entry.id, viewport: entry.viewport, errors: [], passed: false };
    report.cases.push(result);
    page.on('pageerror', error => result.errors.push(error.message));
    try {
      await page.route(url, route => route.fulfill({ contentType: 'text/html; charset=utf-8', body: fixture }));
      await page.goto(url);
      result.observations = await entry.run(page);
      assert.deepEqual(result.errors, []);
      result.passed = true;
    } catch (error) {
      result.failure = error instanceof Error ? error.message : String(error);
      await page.screenshot({ path: path.join(output, entry.id + '-failure.png') }).catch(() => {});
    } finally {
      await context.close();
    }
  }
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify(report));
}
if (!report.cases.length || report.cases.some(entry => !entry.passed)) process.exitCode = 1;
