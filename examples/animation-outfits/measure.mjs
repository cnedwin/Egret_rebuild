// SPDX-License-Identifier: Apache-2.0
// Usage: node examples/animation-outfits/measure.mjs <Playwright index.mjs> <new output directory> [software]
// Measures the 20-Spine / 200-sequence scene on each shared backend: how long it takes to open in a new browser
// context, how long to open again in the same page, and what one step costs part by part. It writes
// measurement.json and prints a table. The numbers describe the machine and browser it ran on and nothing else;
// with `software` the browser draws on the processor, which says nothing about a graphics card.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createExampleServer } from '../../tools/serve-example.mjs';
import { author } from './author.mjs';
const root = fileURLToPath(new URL('../..', import.meta.url));

export async function measureOutfits({
  playwrightPath,
  out,
  software = false,
  frames = 240,
  backends = ['webgpu', 'webgl2']
}) {
  fs.mkdirSync(out, { recursive: false });
  author(path.join(root, 'work/animation-outfits'));
  const { chromium } = await import(pathToFileURL(playwrightPath).href),
    server = createExampleServer(root);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  const report = { profile: 'animation-outfits-costs/1', software, frames, rows: [], notRun: [] };
  let browser;
  try {
    browser = await chromium.launch(
      software
        ? {
            args: [
              '--use-gl=angle',
              '--use-angle=swiftshader',
              '--enable-unsafe-swiftshader',
              '--enable-precise-memory-info'
            ]
          }
        : { channel: 'msedge', headless: false, args: ['--enable-precise-memory-info'] }
    );
    report.browser = browser.version();
    for (const backend of backends) {
      // A new context has no cache of the modules or the content: this is the cold open.
      const context = await browser.newContext({ viewport: { width: 1000, height: 1000 } }),
        page = await context.newPage();
      try {
        const url = origin + '/examples/animation-outfits/index.html?backend=' + backend;
        const timed = () =>
          page.evaluate(async () => {
            window.sceneAPI ??= await import('./main.mjs');
            const start = performance.now();
            try {
              const state = await window.sceneAPI.open();
              return { ms: performance.now() - start, state: state.state, errors: state.errors };
            } catch (error) {
              // A backend this browser cannot start is a row that was not run, not a failure of the measurement.
              return { ms: performance.now() - start, state: 'failed', errors: [String(error?.code ?? error)] };
            }
          });
        const navigate = Date.now();
        await page.goto(url);
        const cold = await timed(),
          coldFromNavigation = Date.now() - navigate;
        if (cold.state !== 'ready') {
          report.notRun.push({
            backend,
            reason: 'the scene did not open: ' + JSON.stringify(cold.errors).slice(0, 200)
          });
          continue;
        }
        const renderer = await page.evaluate(() => {
          const gl = document.createElement('canvas').getContext('webgl2'),
            info = gl?.getExtension('WEBGL_debug_renderer_info');
          return info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : null;
        });
        const first = await page.evaluate(n => window.sceneAPI.measure(n), frames);
        // Open again in the same page: the modules are loaded and compiled; the content is fetched again.
        await page.evaluate(() => window.sceneAPI.close());
        const warm = await timed();
        const second = await page.evaluate(n => window.sceneAPI.measure(n), frames);
        const closed = await page.evaluate(() => window.sceneAPI.close());
        report.rows.push({
          backend,
          renderer,
          openMs: { cold: cold.ms, coldFromNavigation, warm: warm.ms },
          counts: first.counts,
          afterColdOpen: first,
          afterWarmOpen: second,
          leftAfterClose: closed.cleanup?.counts ?? null
        });
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
  }
  fs.writeFileSync(path.join(out, 'measurement.json'), JSON.stringify(report, null, 2) + '\n');
  return report;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (
    process.argv.length < 4 ||
    process.argv.length > 5 ||
    (process.argv[4] !== undefined && process.argv[4] !== 'software')
  )
    throw Error('Usage: node measure.mjs <Playwright index.mjs> <new output directory> [software]');
  const report = await measureOutfits({
    playwrightPath: path.resolve(process.argv[2]),
    out: path.resolve(process.argv[3]),
    software: process.argv[4] === 'software'
  });
  const ms = value => value.toFixed(2).padStart(7);
  console.log(report.browser + (report.software ? ' (software rendering)' : ''));
  for (const row of report.rows) {
    console.log(
      row.backend +
        '  ' +
        (row.renderer ?? '') +
        '  open cold ' +
        row.openMs.cold.toFixed(0) +
        ' ms, warm ' +
        row.openMs.warm.toFixed(0) +
        ' ms'
    );
    for (const part of ['animation', 'capture', 'render', 'settle'])
      console.log(
        '  ' +
          part.padEnd(10) +
          ' p50 ' +
          ms(row.afterWarmOpen[part].p50) +
          '  p95 ' +
          ms(row.afterWarmOpen[part].p95) +
          '  max ' +
          ms(row.afterWarmOpen[part].max) +
          ' ms'
      );
  }
  for (const row of report.notRun) console.log(row.backend + '  not run: ' + row.reason);
}
