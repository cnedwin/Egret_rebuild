// SPDX-License-Identifier: Apache-2.0
// Opens the comparison page in headless Chromium (SwiftShader) and checks that the canvas provider, which needs no
// WebAssembly, lays the styled paragraph out as the CanvasKit provider does with the same fonts: the same lines, and
// character boxes, selections and hits within two pixels.
//
//   node examples/paragraph-canvas/verify.mjs <absolute Playwright index.mjs> [<report.json>]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const [playwrightPath, reportPath] = process.argv.slice(2);
if (!playwrightPath)
  throw new Error('Usage: node examples/paragraph-canvas/verify.mjs <Playwright index.mjs> [<report.json>]');
const { chromium } = await import(pathToFileURL(playwrightPath).href);
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.json': 'application/json',
  '.wasm': 'application/wasm',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf'
};
const server = http.createServer((request, response) => {
  let relative = decodeURIComponent(new URL(request.url, 'http://x').pathname).slice(1);
  if (relative.startsWith('vendor/robust-predicates/'))
    relative = 'packages/engine/node_modules/robust-predicates/' + relative.slice('vendor/robust-predicates/'.length);
  const file = path.resolve(root, relative);
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    response.writeHead(404);
    return response.end();
  }
  response.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
  response.end(fs.readFileSync(file));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch({
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
});
try {
  const page = await browser.newPage({ viewport: { width: 1040, height: 560 } });
  const problems = [];
  page.on('pageerror', error => problems.push(error.message));
  page.on('console', message => message.type() === 'error' && problems.push(message.text()));
  await page.goto(`http://127.0.0.1:${server.address().port}/examples/paragraph-canvas/index.html`);
  const results = await page.evaluate(() => globalThis.__paragraphCanvas, null, { timeout: 120_000 });
  if (reportPath) fs.writeFileSync(path.resolve(reportPath), JSON.stringify(results, null, 2));
  assert.deepEqual(problems, []);
  for (const result of results) {
    console.log(
      result.name +
        ': lines ' +
        result.lineCounts.join(' / ') +
        ', boxes within ' +
        result.clusterGap.most.toFixed(3) +
        ' px, selections within ' +
        Math.max(...result.selections.map(s => s.most)).toFixed(3) +
        ' px, hits ' +
        result.hits.same +
        ' same and ' +
        result.hits.near +
        ' near of ' +
        result.hits.total
    );
    assert.equal(result.lineCounts[0], result.lineCounts[1], result.name + ': as many lines');
    assert.ok(
      result.sameLines,
      result.name + ': the same words on each line:\n' + JSON.stringify(result.lines, null, 1)
    );
    assert.equal(result.truncated[0], result.truncated[1], result.name + ': the same truncation');
    assert.equal(result.clusterGap.matched, result.clusterGap.of, result.name + ': every character on the same line');
    assert.ok(
      result.clusterGap.most <= 2,
      result.name + ': character boxes within two pixels: ' + result.clusterGap.most
    );
    for (const s of result.selections) {
      assert.equal(s.rects[0], s.rects[1], result.name + ': as many selection boxes for ' + s.start + '–' + s.end);
      assert.ok(
        s.most <= 2,
        result.name + ': selection boxes within two pixels for ' + s.start + '–' + s.end + ': ' + s.most
      );
    }
    assert.equal(
      result.hits.same + result.hits.near,
      result.hits.total,
      result.name + ': hits agree: ' + JSON.stringify(result.hits.misses)
    );
  }
  console.log('ok');
} finally {
  await browser.close();
  server.close();
}
