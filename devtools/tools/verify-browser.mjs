// SPDX-License-Identifier: Apache-2.0
// Opt-in check of the monitor in a real browser, on both shared 2D backends.
// It checks that the monitor appears only in debug mode and reacts to input on
// this machine; it is not a device or performance acceptance.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { createDevtoolsExampleServer } from './example.mjs';

const args = process.argv.slice(2), options = {};
for (let i = 0; i < args.length; i += 2) {
  if (!['--playwright', '--channel', '--output'].includes(args[i]) || args[i + 1] === undefined) {
    throw new TypeError('Usage: node tools/verify-browser.mjs --playwright <installed-playwright-module> --output <new-directory> [--channel msedge]');
  }
  options[args[i].slice(2)] = args[i + 1];
}
if (!options.playwright || !options.output) throw new TypeError('--playwright and --output are required');
const output = path.resolve(options.output);
if (fs.existsSync(output)) throw new Error('The output directory must not exist yet: ' + output);
const { chromium } = createRequire(import.meta.url)(path.resolve(options.playwright));

const server = createDevtoolsExampleServer();
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = 'http://127.0.0.1:' + server.address().port + '/devtools/example/index.html';
const selector = '[data-egret-devtools="performance-monitor"]';
const summary = { browser: null, channel: options.channel ?? 'bundled chromium', cases: [], pass: false };
fs.mkdirSync(output, { recursive: true });
let browser;
try {
  browser = await chromium.launch(options.channel ? { channel: options.channel } : {});
  summary.browser = browser.version();
  for (const backend of ['webgl2', 'webgpu']) {
    const row = { backend, checks: {}, errors: [] };
    summary.cases.push(row);
    const context = await browser.newContext({ viewport: { width: 900, height: 700 }, acceptDownloads: true });
    const page = await context.newPage();
    page.on('pageerror', (error) => row.errors.push(String(error)));
    page.on('console', (message) => { if (message.type() === 'error') row.errors.push(message.text()); });
    const ready = () => page.waitForFunction(() => document.querySelector('#stage').dataset.phase === 'ready' || document.querySelector('#stage').dataset.phase === 'failed', null, { timeout: 60000 });
    const query = backend === 'webgpu' ? 'backend=webgpu' : '';
    try {
      // Without debug mode nothing is added to the page.
      await page.goto(base + (query ? '?' + query : ''));
      await ready();
      row.phase = await page.evaluate(() => document.querySelector('#stage').dataset.phase);
      row.checks.hiddenOutsideDebug = await page.evaluate((s) => document.querySelector(s) === null && globalThis.__devtoolsExample.handle.enabled === false, selector);

      await page.goto(base + '?egretDebug=1' + (query ? '&' + query : ''));
      await ready();
      await page.waitForFunction(() => globalThis.__devtoolsExample.handle.monitor.snapshot().frames > 90, null, { timeout: 30000 });
      const read = () => page.evaluate((s) => {
        const example = globalThis.__devtoolsExample, host = document.querySelector(s), snapshot = example.handle.monitor.snapshot();
        return { present: host !== null, text: host?.shadowRoot.querySelector('.box').textContent ?? '', visible: example.handle.visible, expanded: example.handle.expanded, snapshot };
      }, selector);
      let state = await read();
      row.checks.shownInDebug = state.present && state.visible && /\d+fps/.test(state.text);
      row.fps = Math.round(state.snapshot.fps * 10) / 10;
      row.interval = state.snapshot.interval;
      row.checks.frameCounts = state.snapshot.frame !== null && state.snapshot.frame.images === 200 && state.snapshot.frame.triangles === 400;
      row.checks.sections = ['logic', 'clock', 'capture', 'submit'].every((name) => state.snapshot.sections.some((entry) => entry.name === name));
      row.checks.hostSource = state.snapshot.sources.host?.state === 'active' || typeof state.snapshot.sources.host?.pendingFrames === 'number';
      row.checks.handles = state.snapshot.sources.handles?.scopes === 1 && state.snapshot.sources.handles?.assetGroups === 1;
      row.checks.hostTiming = backend === 'webgpu' || typeof state.snapshot.sources['webgl2 ms (mean / max)']?.submit === 'string';
      row.sections = Object.fromEntries(state.snapshot.sections.map((entry) => [entry.name, Math.round(entry.meanMs * 1000) / 1000]));
      row.frame = state.snapshot.frame;
      row.host = state.snapshot.sources.host;
      row.overheadMs = state.snapshot.overheadMs;

      // A click on the badge opens the panel.
      const badge = page.locator(selector).locator('.badge');
      await badge.click();
      await page.evaluate(() => globalThis.__devtoolsExample.handle.refresh());
      state = await read();
      row.checks.expands = state.expanded && state.text.includes('p95');
      // 200 sprites on six separate textures: the run-break hint names the count.
      row.checks.hintShown = await page.locator(selector).locator('.hint').filter({ hasText: '199' }).count() === 1;
      await page.screenshot({ path: path.join(output, backend + '-overview.png') });

      // Every tab shows its own content and the choice is reported by the handle.
      const shown = [];
      for (const tab of ['render', 'resources', 'hitches', 'custom', 'overview']) {
        await page.locator(selector).locator('.tabs button[data-tab="' + tab + '"]').click();
        shown.push(await page.evaluate((s) => { const body = document.querySelector(s).shadowRoot.querySelector('.body'); return globalThis.__devtoolsExample.handle.tab + ':' + body.dataset.tab + ':' + (body.textContent.length > 0); }, selector));
        if (tab !== 'overview' && tab !== 'hitches') await page.screenshot({ path: path.join(output, backend + '-' + tab + '.png') });
      }
      row.checks.tabs = shown.join(' ') === 'render:render:true resources:resources:true hitches:hitches:true custom:custom:true overview:overview:true';

      // A stalled frame reaches the hitch log with the section that caused it.
      await page.click('#hitch');
      await page.waitForFunction(() => globalThis.__devtoolsExample.handle.monitor.hitches().some((hitch) => hitch.sections.logic >= 70), null, { timeout: 10000 });
      row.checks.hitchLogged = true;
      // The long frame can be opened in the hitch list after it has passed.
      await page.locator(selector).locator('.tabs button[data-tab="hitches"]').click();
      const hitchRow = page.locator(selector).locator('.hitch').first();
      await hitchRow.click();
      await page.waitForTimeout(600);
      row.checks.hitchBrowsable = await hitchRow.getAttribute('aria-expanded') === 'true' && /logic/.test(await page.locator(selector).locator('.body').textContent());
      await page.screenshot({ path: path.join(output, backend + '-hitches.png') });

      // Pause holds what the panel shows while the monitor keeps counting.
      await page.locator(selector).locator('.tabs button[data-tab="overview"]').click();
      await page.locator(selector).locator('.actions button').first().click();
      const title = () => page.locator(selector).locator('.body .title').first().textContent();
      const heldTitle = await title(), framesAtPause = (await read()).snapshot.frames;
      await page.waitForTimeout(700);
      row.checks.pauseHolds = await title() === heldTitle && (await read()).snapshot.frames > framesAtPause && await page.evaluate(() => globalThis.__devtoolsExample.handle.paused);
      await page.locator(selector).locator('.actions button').first().click();
      row.checks.resumes = !(await page.evaluate(() => globalThis.__devtoolsExample.handle.paused));

      await page.click('#more');
      await page.waitForFunction(() => globalThis.__devtoolsExample.handle.monitor.snapshot().frame.images === 400, null, { timeout: 10000 });
      row.checks.followsScene = (await read()).snapshot.gauges.sprites === 400;

      // Export hands over a JSON session.
      const [download] = await Promise.all([page.waitForEvent('download', { timeout: 10000 }), page.locator(selector).locator('.actions button').nth(1).click()]);
      const file = path.join(output, backend + '-session.json');
      await download.saveAs(file);
      const session = JSON.parse(fs.readFileSync(file, 'utf8'));
      row.checks.exports = session.schema === 'egret.devtools.performance-session/1' && session.environment.backend === backend && session.history.intervalMs.length > 0;
      row.adapter = session.environment.adapter;

      // Dragging moves the badge and does not toggle the panel.
      const before = await page.locator(selector).boundingBox();
      await page.mouse.move(before.x + 12, before.y + 10); await page.mouse.down(); await page.mouse.move(before.x + 212, before.y + 130, { steps: 5 }); await page.mouse.up();
      const after = await page.locator(selector).boundingBox();
      row.checks.drags = Math.abs(after.x - before.x - 200) < 3 && Math.abs(after.y - before.y - 120) < 3 && (await read()).expanded;

      // The key hides it, and the choice survives a reload.
      await page.keyboard.press('Backquote');
      row.checks.keyHides = !(await read()).visible && await page.locator(selector).isHidden();
      await page.reload(); await ready();
      row.checks.remembersHidden = !(await read()).visible;
      await page.keyboard.press('Backquote');
      row.checks.keyShows = (await read()).visible && await page.locator(selector).isVisible();

      await page.evaluate(() => globalThis.__devtoolsExample.close());
      row.checks.disposes = await page.evaluate((s) => document.querySelector(s) === null, selector);

      // ?egretDebug=0 leaves debug mode again.
      await page.goto(base + '?egretDebug=0' + (query ? '&' + query : ''));
      await ready();
      row.checks.leavesDebug = await page.evaluate((s) => document.querySelector(s) === null, selector);
    } catch (error) { row.errors.push(String(error?.stack ?? error)); }
    row.pass = row.errors.length === 0 && Object.keys(row.checks).length === 22 && Object.values(row.checks).every(Boolean);
    await context.close();
  }
} finally {
  try { await browser?.close(); } finally { server.close(); }
}
summary.pass = summary.cases.length === 2 && summary.cases.every((row) => row.pass);
fs.writeFileSync(path.join(output, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');
console.log(JSON.stringify(summary, null, 2));
process.exitCode = summary.pass ? 0 : 1;
