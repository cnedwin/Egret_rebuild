// SPDX-License-Identifier: Apache-2.0
// Opt-in World3D frame-cost baseline. It reports the CPU time render() spends
// preparing and submitting fixed scenes on each backend. GPU execution time is
// not measured, so results compare scene-preparation cost, not frame rate.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const args = process.argv.slice(2), options = {};
for (let i = 0; i < args.length; i += 2) {
  if (!['--playwright', '--channel', '--frames', '--browser-arg', '--headed'].includes(args[i]) || args[i + 1] === undefined) {
    throw new TypeError('Usage: node tools/bench-world3d.mjs --playwright <installed-playwright-module> [--channel msedge] [--frames 40] [--headed true] [--browser-arg <flag>]...');
  }
  if (args[i] === '--browser-arg') (options.browserArgs ??= []).push(args[i + 1]); else options[args[i].slice(2)] = args[i + 1];
}
if (!options.playwright) throw new TypeError('--playwright is required');
const { chromium } = createRequire(import.meta.url)(path.resolve(options.playwright));
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8' };
const server = http.createServer((request, response) => {
  const relative = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname).slice(1);
  const allowed = /^packages\/(?:engine|runtime|contracts)\/dist\/[\w/.-]+\.js$/.test(relative) || relative === 'tools/world3d/bench.html';
  if (request.method !== 'GET' || !allowed || relative.includes('..')) { response.writeHead(404); response.end('Not served'); return; }
  fs.readFile(path.join(root, relative), (error, data) => {
    if (error) { response.writeHead(404); response.end('Not found'); return; }
    response.writeHead(200, { 'Content-Type': types[path.extname(relative)], 'Cache-Control': 'no-store' });
    response.end(data);
  });
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch({ ...(options.channel ? { channel: options.channel } : {}), headless: options.headed !== 'true', args: options.browserArgs ?? [] });
const results = [];
try {
  for (const backend of ['webgl2', 'webgpu']) {
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${server.address().port}/tools/world3d/bench.html?backend=${backend}&frames=${Number(options.frames ?? 40)}`);
    await page.waitForFunction(() => globalThis.__world3dBench !== undefined, null, { timeout: 600000 });
    results.push(await page.evaluate(() => globalThis.__world3dBench));
    await page.close();
  }
} finally {
  await browser.close();
  server.close();
}
console.log(JSON.stringify({ browser: options.channel ?? 'bundled chromium', results }, null, 2));
process.exitCode = results.some((result) => result.failure || result.errors.length) ? 1 : 0;
