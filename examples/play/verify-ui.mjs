// SPDX-License-Identifier: Apache-2.0
// A single browser run for the original declarative Play UI interaction fixtures.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { once } from 'node:events';
import { pathToFileURL } from 'node:url';
import { createExampleServer } from '../../tools/serve-example.mjs';

const [playwrightFile, output, executablePath, selection = 'all'] = process.argv.slice(2);
if (
  !playwrightFile ||
  !output ||
  !executablePath ||
  ![playwrightFile, output, executablePath].every(file => path.isAbsolute(file)) ||
  !['all', 'visibility', 'scroll'].includes(selection) ||
  process.argv.length > 6
) {
  throw new Error(
    'Usage: node examples/play/verify-ui.mjs <absolute Playwright index.mjs> <new absolute output directory> <absolute Chromium executable> [visibility|scroll]'
  );
}

const { chromium } = await import(pathToFileURL(playwrightFile).href);
const html = fs.readFileSync(new URL('index.html', import.meta.url), 'utf8');
const importMap = html.match(/<script type="importmap">([\s\S]*?)<\/script>/u);
assert.ok(importMap, 'Play example import map');
const imports = JSON.parse(importMap[1]).imports;
imports['@egret/engine/web/semantics'] = '/packages/engine/dist/web/semantics.js';
imports['@egret/engine/ui'] = '/packages/engine/dist/ui/index.js';
imports['@egret/engine/input/hover'] = '/packages/engine/dist/hover.js';
imports['@egret/runtime/ui'] = '/packages/runtime/dist/ui/index.js';
const fixture =
  '<!doctype html><meta charset="utf-8"><link rel="icon" href="data:,">' +
  '<script type="importmap">' +
  JSON.stringify({ imports }) +
  '</script><body></body>';

fs.mkdirSync(output);
const report = { runner: 'play-ui', renderer: 'SwiftShader WebGL2', input: 'Playwright or CDP', cases: [] };
const server = createExampleServer();
let browser;
try {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const origin = 'http://127.0.0.1:' + server.address().port;
  browser = await chromium.launch({
    executablePath,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-proxy-server']
  });
  report.browser = browser.version();
  const cases = [
    { id: 'visibility', file: './verify-view-visibility.mjs', method: 'verifyViewVisibility', touch: false },
    { id: 'scroll', file: './verify-view-scroll.mjs', method: 'verifyViewScroll', touch: true }
  ];
  for (const entry of cases.filter(candidate => selection === 'all' || selection === candidate.id)) {
    const context = await browser.newContext({ viewport: { width: 960, height: 540 }, hasTouch: entry.touch });
    const page = await context.newPage();
    const errors = [];
    const result = { id: entry.id, errors, passed: false };
    report.cases.push(result);
    page.on('pageerror', cause => errors.push(cause.message));
    try {
      await page.route(origin + '/play-ui-fixture', route =>
        route.fulfill({ contentType: 'text/html; charset=utf-8', body: fixture })
      );
      await page.goto(origin + '/play-ui-fixture');
      result.observations = await (await import(entry.file))[entry.method](page);
      assert.deepEqual(errors, []);
      result.passed = true;
    } catch (cause) {
      result.failure = cause instanceof Error ? cause.message : String(cause);
      await page.screenshot({ path: path.join(output, entry.id + '-failure.png') }).catch(() => {});
    } finally {
      await context.close();
    }
  }
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
}
if (!report.cases.length || report.cases.some(entry => !entry.passed)) process.exitCode = 1;
