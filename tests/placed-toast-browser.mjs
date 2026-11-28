// SPDX-License-Identifier: Apache-2.0
// Real native toast feedback: safe placement, responsive scale, layering, lifetime and passive input.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createFloatingStickServer, route } from '../examples/play/verify-floating-stick.mjs';

const [library, output, executablePath] = process.argv.slice(2);
if (![library, output, executablePath].every(file => file && path.isAbsolute(file)))
  throw Error('Usage: node tests/placed-toast-browser.mjs <Playwright index.mjs> <new output directory> <Chrome executable>');
await mkdir(output, { recursive: false });
const { chromium } = await import(pathToFileURL(library).href);
const { server, origin } = await createFloatingStickServer();
const browser = await chromium.launch({
  executablePath,
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
});
const report = { pass: false, browser: browser.version(), checks: [], errors: [] };
try {
  const page = await browser.newPage({ viewport: { width: 852, height: 393 }, hasTouch: true });
  page.on('pageerror', error => report.errors.push(String(error)));
  await page.goto(origin + route);
  const fixture = await page.evaluateHandle(async () => {
    const { play } = await import('@egret/engine/play');
    const { createUiSemantics } = await import('@egret/engine/ui/semantics');
    const semantics = createUiSemantics();
    const holder = document.createElement('div');
    holder.style.cssText = 'position:fixed;inset:0';
    document.body.append(holder);
    const game = await play({
      parent: holder, width: 852, height: 393, fit: 'expand',
      portrait: { width: 393, height: 852 }, uiScale: { min: 1, max: 1 },
      semantics, insets: { left: 24, top: 22, right: 16, bottom: 20 }
    });
    const options = {
      persistent: true, color: 0xf3edde, background: 0x284e3d, backgroundAlpha: 1,
      borderColor: 0x88612f,
      placement: { anchor: 'top-right', offsetX: 8, offsetY: 68, maxWidth: 210, fontSize: 16, foreground: true }
    };
    const toast = game.toast('A readable notification. 江湖事务已全部开放。', options);
    let hits = 0;
    const button = game.show({
      root: { type: 'button', name: 'behind', text: 'Underlying action', anchor: 'top-right', x: 8, y: 68,
        width: 150, height: 60 }
    }, { bind: { behind: { tap: () => { hits++; } } } });
    let timed, legacy, firstStack, secondStack;
    return {
      ready() { return !!toast && !!toast.bounds && toast.active; },
      state() {
        const node = game.ui.getChildAt(game.ui.numChildren - 1);
        return { safe: game.safe, scale: game.uiScale, bounds: toast?.bounds, active: toast?.active,
          passiveForeground: node.touchEnabled === false && node.touchChildren === false,
          focus: button.focused, rect: button.rect('behind'), hits };
      },
      startTimed() {
        timed = game.toast('A short notice', { seconds: 0.10, placement: { anchor: 'bottom-left', foreground: true } });
        game.pause();
      },
      timedActive() { return timed?.active; },
      close() { toast.close(); },
      createStack() {
        const options = { persistent: true, placement: { anchor: 'top-left', offsetX: 8, offsetY: 8, maxWidth: 180, foreground: true } };
        firstStack = game.toast('First', options);
        secondStack = game.toast('Second', options);
        legacy = game.toast('A legacy notice');
        return { first: firstStack.bounds, second: secondStack.bounds, legacy: legacy.active };
      },
      clearStack() {
        firstStack.close(); secondStack.close(); legacy.close();
        return [firstStack.active, secondStack.active, legacy.active];
      },
      async dispose() { await game.dispose(); semantics.dispose(); }
    };
  });
  await page.waitForFunction(f => f.ready(), fixture, { timeout: 3000 });
  const inspect = () => fixture.evaluate(f => f.state());
  const closeTo = (a,b) => Math.abs(a-b) < 0.5;
  function assertSafe(state) {
    const { safe, bounds, scale } = state;
    assert(bounds.width > 0 && bounds.height > 0);
    assert(bounds.x >= safe.x && bounds.y >= safe.y);
    assert(bounds.x + bounds.width <= safe.x + safe.width + 0.01);
    assert(bounds.y + bounds.height <= safe.y + safe.height + 0.01);
    assert(closeTo(bounds.y, safe.y + 68 * scale));
    assert(closeTo(bounds.x + bounds.width, safe.x + safe.width - 8 * scale));
    assert(state.passiveForeground);
  }
  const first = await inspect();
  assertSafe(first);
  report.checks.push('foreground position and safe insets');
  await page.screenshot({ path: path.join(output, 'landscape.png') });
  const point = first.rect;
  await page.mouse.click(point.x + point.width/2, point.y + point.height/2);
  await page.waitForFunction(f => f.state().hits === 1, fixture);
  report.checks.push('passive overlay leaves real input to underlying button');
  await page.setViewportSize({ width: 393, height: 852 });
  await page.waitForFunction(f => f.state().safe.height > f.state().safe.width, fixture);
  await page.waitForTimeout(100);
  assertSafe(await inspect());
  await page.screenshot({ path: path.join(output, 'portrait.png') });
  report.checks.push('same live notice repositions on resize');
  await fixture.evaluate(f => f.startTimed());
  await page.waitForFunction(f => f.timedActive() === false, fixture);
  assert.equal((await inspect()).active, true);
  report.checks.push('timed notice expires while paused; persistent notice remains');
  await fixture.evaluate(f => f.close());
  assert.equal((await inspect()).active, false);
  report.checks.push('close removes persistent notice');
  const stack = await fixture.evaluate(f => f.createStack());
  assert.equal(stack.legacy, true);
  assert(stack.first.y >= stack.second.y + stack.second.height);
  assert.deepEqual(await fixture.evaluate(f => f.clearStack()), [false, false, false]);
  report.checks.push('stack is non-overlapping; legacy toast and all handles close');
  assert.deepEqual(report.errors, []);
  report.pass = true;
  await fixture.evaluate(f => f.dispose());
} catch (error) {
  report.failure = String(error.stack ?? error);
  process.exitCode = 1;
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
  await writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
}
