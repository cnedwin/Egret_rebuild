// SPDX-License-Identifier: Apache-2.0
// Draws this example on WebGL2 and on WebGPU and reads points of the engine's canvas and of the 2D canvas under it,
// which draws the same with its clip and gradient strokes. Each point is away from an edge: within a mask the stripe
// shows, outside it the ground, and along a line its gradient. Build first; exits with 1 when a check fails.
//
//   node examples/vector-mask/verify.mjs <absolute Playwright index.mjs> [<new output directory>] [software]
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
const BELOW = 160;

/** The mean red, green and blue bytes of the pixels within a point's 3 by 3. */
export function pointColour(read, [x, y], below = 0) {
  const sum = [0, 0, 0];
  for (let j = -1; j <= 1; j++)
    for (let i = -1; i <= 1; i++) {
      const pixel = read(x + i, y + j + below);
      for (let c = 0; c < 3; c++) sum[c] += pixel[c];
    }
  return sum.map(value => Math.round(value / 9));
}
/** Every point is within a few steps of the 2D canvas, and the masks and lines show what they should. */
export function vectorChecks(engine, canvas) {
  const off = name => Math.max(...engine[name].map((value, c) => Math.abs(value - canvas[name][c])));
  const checks = {};
  for (const name of Object.keys(canvas)) checks[name + 'MatchesCanvas'] = off(name) <= 8;
  const ground = [28, 36, 51],
    near = (colour, to) => Math.max(...colour.map((value, c) => Math.abs(value - to[c]))) <= 6;
  for (const name of ['circleCorner', 'circleEdgeOutside', 'starNotch', 'starOutside', 'ringMiddle'])
    checks[name + 'Hidden'] = near(engine[name], ground);
  for (const name of ['circleMiddle', 'starMiddle', 'starPoint']) checks[name + 'Shown'] = !near(engine[name], ground);
  // Red at the start, blue at the end, between them in the middle.
  checks.lineRunsRedToBlue =
    engine.lineStart[0] > 200 && engine.lineEnd[2] > 200 && engine.lineMiddle[0] > 60 && engine.lineMiddle[2] > 60;
  // Gold on the inside of the ring, green on its outside.
  checks.ringRunsGoldToGreen = engine.ringInner[0] > engine.ringOuter[0] + 40 && engine.ringOuter[1] > 150;
  return checks;
}

async function main(args) {
  const software = args.at(-1) === 'software',
    [playwright, out] = software ? args.slice(0, -1) : args;
  if (!playwright)
    throw new TypeError(
      'Usage: node examples/vector-mask/verify.mjs <absolute Playwright index.mjs> [<new output directory>] [software]'
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
    for (const backend of ['webgl2', 'webgpu']) {
      const run = backend;
      const tab = await browser.newPage({ viewport: { width: 480, height: 320 } });
      const errors = [];
      tab.on('pageerror', error => errors.push(String(error.message)));
      await tab.goto(origin + '/examples/vector-mask/index.html?backend=' + backend);
      try {
        await tab.waitForFunction(() => window.__vector?.ready && window.__vector.frames > 20, null, {
          timeout: 30000
        });
      } catch {
        // Recorded below from what the page says.
      }
      const page = await tab.evaluate(() => ({ ...window.__vector, hostFailure: window.__vector?.hostFailure?.() }));
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
        Object.entries(page.points).map(([name, point]) => [name, pointColour(read, point)])
      );
      const canvas = Object.fromEntries(
        Object.entries(page.points).map(([name, point]) => [name, pointColour(read, point, BELOW)])
      );
      const checks = vectorChecks(engine, canvas);
      report.runs[run] = { started: true, backend: page.backend, engine, canvas, checks };
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
