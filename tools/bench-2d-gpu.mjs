// SPDX-License-Identifier: Apache-2.0
// Fixed 2D workloads drawn through the shared WebGPU and WebGL2 Hosts in a browser, on this machine's
// graphics device. tools/bench-2d.mjs times the CPU work before the graphics API; this times the rest:
// the Host's own CPU work, the time the device spends drawing, and the pace of display frames.
//
// Usage:
//   node tools/bench-2d-gpu.mjs [--quick] [--json] [--backends webgpu,webgl2] [--only <part of a workload id>]
//       Prints an address. Open it in the browser to measure; the table is printed here when the page finishes.
//   node tools/bench-2d-gpu.mjs --playwright <installed-playwright-module> [--channel msedge] [--headless]
//       [--browser-arg <flag>]... [--surface texture]
//       Opens the browser itself. A visible window is the default: a hidden one may not use the graphics card.
//
// The figures describe this machine and this run; they are not acceptance thresholds.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const USAGE = 'Usage: node tools/bench-2d-gpu.mjs [--quick] [--json] [--backends webgpu,webgl2] [--only <id part>] [--playwright <installed-playwright-module> [--channel msedge] [--headless] [--browser-arg <flag>]... [--surface texture]]';
const args = process.argv.slice(2), options = { browserArgs: [] };
for (let i = 0; i < args.length; i++) {
  const name = args[i];
  if (name === '--quick' || name === '--json' || name === '--headless') { options[name.slice(2)] = true; continue; }
  if (!['--backends', '--only', '--playwright', '--channel', '--browser-arg', '--surface'].includes(name) || args[i + 1] === undefined) throw new TypeError(USAGE);
  if (name === '--browser-arg') options.browserArgs.push(args[++i]); else options[name.slice(2)] = args[++i];
}
if (options.backends !== undefined && !/^(?:webgpu|webgl2)(?:,(?:webgpu|webgl2))?$/.test(options.backends)) throw new TypeError(USAGE);
if (options.only !== undefined && !/^[a-z0-9-]+$/.test(options.only)) throw new TypeError(USAGE);
if (options.surface !== undefined && options.surface !== 'texture') throw new TypeError(USAGE);

// The page imports the packages by name; the map is read from their manifests.
const imports = {}, scopes = {};
for (const name of ['contracts', 'runtime', 'engine']) {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'packages', name, 'package.json'), 'utf8'));
  const target = value => typeof value === 'string' ? value : value?.import;
  for (const [key, value] of Object.entries(manifest.exports ?? {})) if (target(value)) imports[manifest.name + key.slice(1)] = '/packages/' + name + '/' + target(value).replace(/^\.\//, '');
  for (const [key, value] of Object.entries(manifest.imports ?? {})) if (target(value)) (scopes['/packages/' + name + '/'] ??= {})[key] = '/packages/' + name + '/' + target(value).replace(/^\.\//, '');
}
imports['robust-predicates'] = '/packages/engine/node_modules/robust-predicates/index.js';
const html = '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<title>2D frame cost on this graphics device</title>\n'
  + '<style>body{font:14px system-ui,sans-serif;margin:16px;background:#fff;color:#111}table{border-collapse:collapse;margin:12px 0}th,td{border:1px solid #bbb;padding:3px 8px;text-align:right}th:nth-child(-n+3),td:nth-child(-n+3){text-align:left}canvas{max-width:100%;height:auto;border:1px solid #bbb}textarea{width:100%;height:160px}</style>\n'
  + '<script type="importmap">' + JSON.stringify({ imports, scopes }) + '</script>\n</head>\n<body>\n<p id="status">Starting …</p>\n<div id="stage"></div>\n<table id="rows"></table>\n<textarea id="json" readonly></textarea>\n'
  + '<script type="module" src="/tools/bench-2d-gpu/page.mjs"></script>\n</body>\n</html>\n';

let deliver;
const delivered = new Promise(resolve => { deliver = resolve; });
const server = http.createServer((request, response) => {
  const url = new URL(request.url, 'http://127.0.0.1'), relative = decodeURIComponent(url.pathname).slice(1);
  if (request.method === 'POST' && relative === 'result') {
    const parts = []; let size = 0;
    request.on('data', part => { size += part.length; if (size > 1048576) request.destroy(); else parts.push(part); });
    request.on('end', () => { response.writeHead(204); response.end(); try { deliver(JSON.parse(Buffer.concat(parts).toString('utf8'))); } catch { /* not a report */ } });
    return;
  }
  if (request.method !== 'GET') { response.writeHead(405); response.end('GET required'); return; }
  if (relative === '') { response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }); response.end(html); return; }
  const dependency = 'packages/engine/node_modules/robust-predicates/';
  const allowed = /^packages\/(?:engine|runtime|contracts)\/dist\/[\w/.-]+\.js$/.test(relative) || relative === 'tools/bench-2d-gpu/page.mjs'
    || relative.startsWith(dependency) && /^[\w/-]+\.js$/.test(relative.slice(dependency.length));
  if (!allowed || relative.includes('..')) { response.writeHead(404); response.end('Not served'); return; }
  fs.readFile(path.join(root, relative), (error, data) => {
    if (error) { response.writeHead(404); response.end('Not found'); return; }
    response.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-store' }); response.end(data);
  });
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const query = new URLSearchParams();
if (options.quick) query.set('quick', '1');
if (options.backends) query.set('backends', options.backends);
if (options.only) query.set('only', options.only);
if (options.surface) query.set('surface', options.surface);
const address = 'http://127.0.0.1:' + server.address().port + '/' + (query.size ? '?' + query : '');

let report, browser;
try {
  if (options.playwright) {
    const { chromium } = createRequire(import.meta.url)(path.resolve(options.playwright));
    browser = await chromium.launch({ ...(options.channel ? { channel: options.channel } : {}), headless: options.headless === true, args: options.browserArgs });
    const page = await browser.newPage({ viewport: { width: 1360, height: 900 }, deviceScaleFactor: 1 });
    await page.goto(address);
    await page.waitForFunction(() => globalThis.__bench2dGpu !== undefined, null, { timeout: 1800000 });
    report = await page.evaluate(() => globalThis.__bench2dGpu);
  } else {
    console.error('Open ' + address + ' in the browser to measure. Keep its window in front until it finishes.');
    report = await delivered;
  }
} finally {
  await browser?.close();
  server.close(); server.closeAllConnections?.();
}

if (options.json) console.log(JSON.stringify(report, null, 2));
else {
  console.log(report.userAgent ?? '');
  const seen = new Set();
  for (const row of report.rows) if (row.device && !seen.has(row.backend)) { seen.add(row.backend); console.log(row.backend.padEnd(7) + [row.device.vendor, row.device.architecture, row.device.description].filter(Boolean).join(' ') + (row.device.fallback ? ' (software adapter)' : '') + (row.gpuTimer ? '' : '  [no GPU timer in this browser]')); }
  if (report.failure) console.log('failed: ' + report.failure);
  const cell = value => value === null || value === undefined ? '-' : String(value);
  console.log('\n' + 'backend'.padEnd(8) + 'workload'.padEnd(50) + ['draws', 'capture', 'submit', 'settle', 'gpu', 'interval', 'p95', 'refused'].map(title => title.padStart(9)).join(''));
  console.log(' '.repeat(58) + ['', 'ms', 'ms', 'ms', 'ms', 'ms', 'ms', ''].map(title => title.padStart(9)).join(''));
  for (const row of report.rows) {
    if (row.status !== 'complete') { console.log(row.backend.padEnd(8) + row.label.padEnd(50) + '  ' + row.status + (row.reason ? ': ' + row.reason : '')); continue; }
    console.log(row.backend.padEnd(8) + row.label.padEnd(50) + [row.draws, row.captureMs, row.submitMs, row.settleMs, row.gpuMs, row.intervalMs, row.intervalP95Ms, row.refused].map(value => cell(value).padStart(9)).join(''));
  }
}
process.exitCode = report.failure || report.rows.length === 0 || report.rows.some(row => row.status === 'failed') ? 1 : 0;
