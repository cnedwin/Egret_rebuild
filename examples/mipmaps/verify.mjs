// SPDX-License-Identifier: Apache-2.0
// Draws this example on WebGL2 and on WebGPU and reads the pixels of each square. A picture of one-texel black and
// white squares drawn small with its smaller copies is an even grey, linear light 0.5, sRGB 188; without them it is
// uneven. A region beside a red one shows no red. Build first; exits with 1 when a check fails.
//
//   node examples/mipmaps/verify.mjs <absolute Playwright index.mjs> [<new output directory>] [software]
//
// Without `software` the installed Edge is launched headed, on the computer's own GPU. With it the browser that
// Playwright bundles runs headless with software rendering; there a WebGPU adapter that cannot draw is recorded and
// not counted as a failure of the engine, and WebGPU is to be checked on hardware.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url));
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript' };

/** The mean and spread of the red, green and blue bytes of the pixels inside a box, one pixel in from its edge. */
export function boxStats(read, box) {
  const values = [];
  let redness = 0;
  for (let y = Math.ceil(box.y) + 1; y < Math.floor(box.y + box.height) - 1; y++)
    for (let x = Math.ceil(box.x) + 1; x < Math.floor(box.x + box.width) - 1; x++) {
      const [r, g, b] = read(x, y);
      values.push((r + g + b) / 3);
      redness = Math.max(redness, r - (g + b) / 2);
    }
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const spread = Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length);
  return { pixels: values.length, mean, spread, redness };
}
/** What each square must show. `plain` and `plainRegion` are the same pictures without their copies, for comparison. */
export function mipmapChecks(stats) {
  const grey = s => Math.abs(s.mean - 188) <= 6 && s.spread <= 6;
  return {
    copiesAreGrey: grey(stats.copies) && grey(stats.fifth),
    withoutCopiesIsUneven: stats.plain.spread > 3 * Math.max(1, stats.copies.spread),
    regionIsGreyWithoutRed: grey(stats.region) && stats.region.redness <= 8,
    regionWithoutCopiesIsUneven: stats.plainRegion.spread > 3 * Math.max(1, stats.region.spread)
  };
}

async function main(args) {
  const software = args.at(-1) === 'software',
    [playwright, out] = software ? args.slice(0, -1) : args;
  if (!playwright)
    throw new TypeError(
      'Usage: node examples/mipmaps/verify.mjs <absolute Playwright index.mjs> [<new output directory>] [software]'
    );
  const { chromium } = await import(pathToFileURL(playwright).href),
    { PNG } = createRequire(import.meta.url)('pngjs');
  const server = http.createServer((request, response) => {
    const wanted = path.join(root, decodeURIComponent(new URL(request.url, 'http://localhost').pathname));
    if (path.relative(root, wanted).startsWith('..') || !fs.existsSync(wanted) || fs.statSync(wanted).isDirectory()) {
      response.writeHead(404, { connection: 'close' });
      response.end();
      return;
    }
    response.writeHead(200, {
      'content-type': TYPES[path.extname(wanted)] ?? 'application/octet-stream',
      connection: 'close'
    });
    response.end(fs.readFileSync(wanted));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch(
    software
      ? {
          args: [
            '--use-angle=swiftshader',
            '--enable-unsafe-swiftshader',
            '--enable-unsafe-webgpu',
            '--ignore-gpu-blocklist'
          ]
        }
      : { channel: 'msedge', headless: false }
  );
  const report = { renderer: software ? 'software' : 'hardware', backends: {} };
  let failed = false;
  try {
    for (const backend of ['webgl2', 'webgpu']) {
      const tab = await browser.newPage({ viewport: { width: 400, height: 200 } });
      const errors = [];
      tab.on('pageerror', error => errors.push(String(error.message)));
      await tab.goto(origin + '/examples/mipmaps/index.html?backend=' + backend);
      try {
        await tab.waitForFunction(() => window.__mipmaps?.ready && window.__mipmaps.frames > 40, null, {
          timeout: 30000
        });
      } catch {
        // Recorded below from what the page says.
      }
      const page = await tab.evaluate(() => ({ ...window.__mipmaps, hostFailure: window.__mipmaps?.hostFailure?.() }));
      if (!page?.ready || page.errors.length || errors.length || page.hostFailure) {
        const failures = [...(page?.errors ?? []), ...errors, ...(page?.hostFailure ? [page.hostFailure] : [])];
        report.backends[backend] = { started: false, errors: failures };
        // A software WebGPU adapter that cannot draw is not a failure of the engine: WebGPU is checked on hardware.
        if (backend === 'webgl2' || !software) failed = true;
        await tab.close();
        continue;
      }
      // The pixels as the page shows them: the canvas is at the top left, one canvas pixel to one CSS pixel.
      const png = PNG.sync.read(await tab.screenshot()),
        read = (x, y) => Array.from(png.data.subarray(4 * (y * png.width + x), 4 * (y * png.width + x) + 3));
      const stats = Object.fromEntries(Object.entries(page.boxes).map(([name, box]) => [name, boxStats(read, box)]));
      const checks = mipmapChecks(stats);
      report.backends[backend] = { started: true, backend: page.backend, stats, checks };
      if (Object.values(checks).some(ok => !ok)) failed = true;
      if (out) {
        fs.mkdirSync(out, { recursive: true });
        await tab.screenshot({ path: path.join(out, backend + '.png') });
      }
      await tab.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
  if (out) fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
  if (failed) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main(process.argv.slice(2)).catch(error => {
    console.error(error.message ?? error);
    process.exit(1);
  });
