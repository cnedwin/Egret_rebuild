// SPDX-License-Identifier: Apache-2.0
// Draws this example on WebGL2 and on WebGPU, in each blend space, and reads each square of the engine's canvas and
// of the 2D canvas under it that draws the same. In the `srgb` space every square is the colour the 2D canvas shows;
// in `linear` a faint white over the dark ground is stronger than there, and an opaque square is the same in both.
// Build first; exits with 1 when a check fails.
//
//   node examples/blend-space/verify.mjs <absolute Playwright index.mjs> [<new output directory>] [software]
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
/** The 2D canvas sits right under the engine's, as tall as it. */
const BELOW = 120;

/** The mean red, green and blue bytes of the pixels inside a box, two pixels in from its edge. */
export function boxColour(read, box, below = 0) {
  const sum = [0, 0, 0];
  let count = 0;
  for (let y = box.y + 2; y < box.y + box.height - 2; y++)
    for (let x = box.x + 2; x < box.x + box.width - 2; x++) {
      const pixel = read(x, y + below);
      for (let c = 0; c < 3; c++) sum[c] += pixel[c];
      count++;
    }
  return sum.map(value => Math.round(value / count));
}
/** What the squares must show in a space, given each square's colour on the engine's canvas and on the 2D canvas. */
export function blendChecks(space, engine, canvas) {
  const off = name => Math.max(...engine[name].map((value, c) => Math.abs(value - canvas[name][c])));
  const brightness = colour => colour[0] + colour[1] + colour[2];
  const checks = { opaqueMatchesCanvas: off('opaque') <= 2 };
  if (space === 'srgb') for (const name of Object.keys(canvas)) checks[name + 'MatchesCanvas'] = off(name) <= 3;
  else checks.faintWhiteStrongerThanCanvas = brightness(engine.faintWhite) - brightness(canvas.faintWhite) > 30;
  return checks;
}

async function main(args) {
  const software = args.at(-1) === 'software',
    [playwright, out] = software ? args.slice(0, -1) : args;
  if (!playwright)
    throw new TypeError(
      'Usage: node examples/blend-space/verify.mjs <absolute Playwright index.mjs> [<new output directory>] [software]'
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
  const report = { renderer: software ? 'software' : 'hardware', runs: {} };
  let failed = false;
  try {
    for (const backend of ['webgl2', 'webgpu'])
      for (const space of ['srgb', 'linear']) {
        const run = backend + '-' + space;
        const tab = await browser.newPage({ viewport: { width: 320, height: 240 } });
        const errors = [];
        tab.on('pageerror', error => errors.push(String(error.message)));
        await tab.goto(origin + '/examples/blend-space/index.html?backend=' + backend + '&space=' + space);
        try {
          await tab.waitForFunction(() => window.__blend?.ready && window.__blend.frames > 20, null, {
            timeout: 30000
          });
        } catch {
          // Recorded below from what the page says.
        }
        const page = await tab.evaluate(() => ({ ...window.__blend, hostFailure: window.__blend?.hostFailure?.() }));
        if (!page?.ready || page.errors.length || errors.length || page.hostFailure) {
          const failures = [...(page?.errors ?? []), ...errors, ...(page?.hostFailure ? [page.hostFailure] : [])];
          report.runs[run] = { started: false, errors: failures };
          // A software WebGPU adapter that cannot draw is not a failure of the engine: WebGPU is checked on hardware.
          if (backend === 'webgl2' || !software) failed = true;
          await tab.close();
          continue;
        }
        // The pixels as the page shows them: the canvas is at the top left, one canvas pixel to one CSS pixel.
        const png = PNG.sync.read(await tab.screenshot()),
          read = (x, y) => Array.from(png.data.subarray(4 * (y * png.width + x), 4 * (y * png.width + x) + 3));
        const engine = Object.fromEntries(
          Object.entries(page.boxes).map(([name, box]) => [name, boxColour(read, box)])
        );
        const canvas = Object.fromEntries(
          Object.entries(page.boxes).map(([name, box]) => [name, boxColour(read, box, BELOW)])
        );
        const checks = blendChecks(space, engine, canvas);
        report.runs[run] = { started: true, backend: page.backend, space: page.space, engine, canvas, checks };
        if (Object.values(checks).some(ok => !ok)) failed = true;
        if (out) {
          fs.mkdirSync(out, { recursive: true });
          await tab.screenshot({ path: path.join(out, run + '.png') });
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
