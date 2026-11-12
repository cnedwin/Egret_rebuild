// SPDX-License-Identifier: Apache-2.0
// Opt-in browser comparison of the World3D WebGL2 and WebGPU backends. Seven
// deterministic scenes are drawn into a render target on each backend and the
// images are compared. This checks that both backends agree on one machine;
// it is not a device, performance or visible-canvas acceptance.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const args = process.argv.slice(2), options = {};
for (let i = 0; i < args.length; i += 2) {
  if (!['--playwright', '--channel', '--output', '--browser-arg'].includes(args[i]) || args[i + 1] === undefined) {
    throw new TypeError('Usage: node tools/verify-world3d.mjs --playwright <installed-playwright-module> --output <new-directory> [--channel msedge] [--browser-arg <flag>]...');
  }
  if (args[i] === '--browser-arg') (options.browserArgs ??= []).push(args[i + 1]); else options[args[i].slice(2)] = args[i + 1];
}
if (!options.playwright || !options.output) throw new TypeError('--playwright and --output are required');
const output = path.resolve(options.output);
if (fs.existsSync(output)) throw new Error('The output directory must not exist yet: ' + output);
const require = createRequire(import.meta.url);
const { chromium } = require(path.resolve(options.playwright));
const { PNG } = require('pngjs');

// Serve only built package output and this tool's own page.
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8' };
const server = http.createServer((request, response) => {
  let relative;
  try { relative = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname).slice(1); }
  catch { response.writeHead(400); response.end('Invalid path'); return; }
  const allowed = /^packages\/(?:engine|runtime|contracts)\/dist\/[\w/.-]+\.js$/.test(relative) || /^tools\/world3d\/(?:page\.html|cases\.mjs)$/.test(relative);
  if (request.method !== 'GET' || !allowed || relative.includes('..')) { response.writeHead(404); response.end('Not served'); return; }
  fs.readFile(path.join(root, relative), (error, data) => {
    if (error) { response.writeHead(404); response.end('Not found'); return; }
    response.writeHead(200, { 'Content-Type': types[path.extname(relative)], 'Cache-Control': 'no-store' });
    response.end(data);
  });
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
let browser;
const results = {};
try {
  browser = await chromium.launch({ ...(options.channel ? { channel: options.channel } : {}), args: options.browserArgs ?? [] });
  for (const backend of ['webgl2', 'webgpu']) {
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${server.address().port}/tools/world3d/page.html?backend=${backend}`);
    await page.waitForFunction(() => globalThis.__world3dResult !== undefined, null, { timeout: 120000 });
    results[backend] = await page.evaluate(() => globalThis.__world3dResult);
    await page.close();
  }
} finally {
  try { await browser?.close(); }
  finally { server.close(); }
}
fs.mkdirSync(output, { recursive: true });
const summary = { browser: options.channel ?? 'bundled chromium', cases: [], failures: [], softDepth: {} };
for (const backend of ['webgl2', 'webgpu']) {
  const result = results[backend];
  if (result.failure || result.errors.length) summary.failures.push({ backend, failure: result.failure, errors: result.errors });
  if (result.softDepth) summary.softDepth[backend] = result.softDepth;
  for (const [name, data] of Object.entries(result.images ?? {})) {
    const png = new PNG({ width: result.width, height: result.height });
    png.data.set(data);
    fs.writeFileSync(path.join(output, backend + '-' + name + '.png'), PNG.sync.write(png));
  }
}
// Thin lines rasterize differently per API, so the line case allows a small share of large differences.
// The effects case has hundreds of particles a few pixels wide, whose edge pixels fall differently too.
const limits = { default: { mean: 1, share: 0.001 }, spritesLines: { mean: 2, share: 0.02 }, effects: { mean: 1, share: 0.004 } };
for (const name of Object.keys(results.webgl2.images ?? {})) {
  const a = results.webgl2.images[name], b = results.webgpu.images?.[name];
  if (!b) { summary.failures.push({ case: name, failure: 'missing on webgpu' }); continue; }
  let sum = 0, max = 0, over = 0;
  for (let i = 0; i < a.length; i += 4) {
    const d = Math.max(Math.abs(a[i] - b[i]), Math.abs(a[i + 1] - b[i + 1]), Math.abs(a[i + 2] - b[i + 2]));
    sum += d; max = Math.max(max, d); if (d > 16) over++;
  }
  const pixels = a.length / 4, limit = limits[name] ?? limits.default;
  const entry = { case: name, meanDifference: sum / pixels, maxDifference: max, shareAbove16: over / pixels, pass: sum / pixels <= limit.mean && over / pixels <= limit.share };
  // A case that renders only its clear color would compare equal while showing nothing.
  const first = a.slice(0, 3).join(','), varied = (() => { for (let i = 4; i < a.length; i += 4) if (a.slice(i, i + 3).join(',') !== first) return true; return false; })();
  if (!varied) entry.pass = false;
  summary.cases.push(entry);
  if (!entry.pass) summary.failures.push({ case: name, failure: varied ? 'backends differ beyond the limit' : 'image is a single color' });
}
summary.pass = summary.failures.length === 0 && summary.cases.length === 25;
fs.writeFileSync(path.join(output, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');
console.log(JSON.stringify(summary, null, 2));
process.exitCode = summary.pass ? 0 : 1;
