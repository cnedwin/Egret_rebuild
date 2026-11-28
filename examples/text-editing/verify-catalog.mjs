// SPDX-License-Identifier: Apache-2.0
// Verifies the game's committed geometry against real DOM controls. No human IME input is inferred.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { authorFontExample } from '../../tools/content/author-font-example.mjs';
import { createExampleServer } from '../../tools/serve-example.mjs';

const [playwrightRoot, output] = process.argv.slice(2);
if (!playwrightRoot || !output)
  throw Error('Usage: node examples/text-editing/verify-catalog.mjs <playwright-root> <new-output-directory>');
const out = path.resolve(output);
const root = path.resolve(import.meta.dirname, '../..');
assert(out !== root && !out.startsWith(root + path.sep));
fs.mkdirSync(out);
const { chromium } = await import(pathToFileURL(path.resolve(playwrightRoot, 'index.mjs')));
const server = createExampleServer(root);
const authored = await authorFontExample();
const config = JSON.parse(fs.readFileSync(path.join(root, authored.configPath), 'utf8'));
const report = { schema: 'egret.virtual-editor-catalog/1', generation: authored.generationId, reports: [] };
const call = (page, method, ...args) =>
  page.evaluate(({ method, args }) => window.__egretTextEditing[method](...args), { method, args });

async function composeDraft(page) {
  const input = page.locator('[data-egret-text-editor]');
  await input.evaluate(node => {
    node.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
    node.value += '草稿';
    node.dispatchEvent(
      new InputEvent('input', {
        bubbles: true,
        inputType: 'insertCompositionText',
        data: '草稿',
        isComposing: true
      })
    );
  });
}

async function observe(page, key = 'name') {
  return page.evaluate(async key => {
    const state = await window.__egretTextEditing.settled();
    const canvas = document.querySelector('#scene'),
      native = document.querySelector('[data-egret-text-editor]');
    const row = state.ui.rows.find(r => r.key === key),
      id = 'catalog/' + key;
    const semantic = state.catalogSemantics.nodes.find(n => n.id === id);
    const projected = document.querySelector('[role=listitem][aria-label="' + key + '"]');
    const box = node => {
      if (!node) return null;
      const { x, y, width, height } = node.getBoundingClientRect();
      return { x, y, width, height };
    };
    return {
      errors: state.errors,
      anchor: state.ui.anchor,
      row,
      origin: state.ui.origin,
      viewport: state.ui.viewport,
      rootRevision: state.ui.committedRevision,
      semanticRevision: state.catalogSemantics.layoutRevision,
      semanticFocus: state.catalogSemantics.focused,
      semantic: semantic?.bounds,
      position: semantic?.position,
      domRows: document.querySelectorAll('[role=listitem]').length,
      activeDescendant: projected?.id === canvas.getAttribute('aria-activedescendant'),
      semanticBox: box(projected),
      nativeBox: box(native),
      canvasBox: box(canvas),
      innerFocus: !!native && document.activeElement === native,
      selection: state.fields[key].selection,
      nativeSelection: native && [native.selectionStart, native.selectionEnd],
      field: state.fields[key].value,
      binding: state.bindings[key],
      fieldState: state.fields[key].state,
      lines: window.__egretTextEditing.geometry(key)?.lines.map(line => [line.start, line.end]),
      nativeFamily: native && getComputedStyle(native).fontFamily,
      theme: state.ui.theme?.id,
      fontKey: state.fields[key].style.fontSet,
      editorLeases: state.fontStatus.editorLeases,
      sets: state.fontStatus.sets,
      counters: state.ui.counters,
      paragraph: state.paragraphStatus
    };
  }, key);
}

function near(a, b) {
  assert(Math.abs(a - b) <= 0.6, a + ' versus ' + b);
}
function geometry(s, key) {
  assert.deepEqual(s.errors, []);
  assert.equal(s.rootRevision, s.semanticRevision);
  assert.equal(s.binding.layoutRevision, s.rootRevision);
  assert.equal(s.semanticFocus, 'catalog/' + key);
  assert(s.innerFocus && s.activeDescendant && s.row.visible);
  assert.equal(s.editorLeases, 1);
  assert.deepEqual(s.nativeSelection, [
    Math.min(s.selection.focus, s.selection.anchor),
    Math.max(s.selection.focus, s.selection.anchor)
  ]);
  assert.equal(s.position.index, s.row.index + 1);
  assert.equal(s.position.size, 50000);
  assert.equal(s.counters.recordCount, 50000);
  assert.equal(s.domRows, s.counters.visibleRows);
  assert(s.counters.liveShells <= 12 && s.counters.retainedOnlyRows <= 2 && s.counters.overscanOnlyRows <= 2);
  const row = s.row.box,
    scene = s.canvasBox;
  const left = Math.max(0, row.x),
    top = Math.max(0, row.y);
  near(s.semantic.x, s.origin.x + left);
  near(s.semantic.y, s.origin.y + top);
  near(s.semantic.width, Math.min(s.viewport.width, row.x + row.width) - left);
  near(s.semantic.height, Math.min(s.viewport.height, row.y + row.height) - top);
  near(s.semanticBox.x - scene.x, s.semantic.x);
  near(s.semanticBox.y - scene.y, s.semantic.y);
  near(s.semanticBox.width, s.semantic.width);
  near(s.semanticBox.height, s.semantic.height);
  // This fixed profile maps one logical unit to one CSS pixel. The native field is inset eight units.
  near(s.nativeBox.x - scene.x, s.origin.x + row.x + 8);
  near(s.nativeBox.y - scene.y, s.origin.y + row.y + 8);
  near(s.nativeBox.width, row.width - 16);
  near(s.nativeBox.height, row.height - 16);
}

// Hold an actual content-loader response. A new request must reach the route before any cancellation or comparison.
async function holdFont(page) {
  const entered = Promise.withResolvers(),
    release = Promise.withResolvers();
  const filter = '**/build/blobs/sha256/*';
  const handler = async route => {
    entered.resolve();
    const status = await release.promise;
    const reply = status ? route.fulfill({ status, body: 'Font unavailable' }) : route.continue();
    await reply.catch(() => {});
  };
  await page.route(filter, handler);
  const result = page.evaluate(async roots => {
    try {
      await window.__egretTextEditing.replaceFonts(roots);
      return { ok: true };
    } catch (error) {
      return { ok: false, code: error.code, message: error.message };
    }
  }, config.alternate);
  const timer = setTimeout(() => entered.reject(Error('No font response reached the gate')), 15000);
  try {
    await entered.promise;
  } finally {
    clearTimeout(timer);
  }
  return {
    result,
    async release(status) {
      release.resolve(status);
      await result;
      await page.unroute(filter, handler);
    }
  };
}

let browser;
try {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  report.browser = browser.version();
  const systemSession = await browser.newBrowserCDPSession();
  const { gpu } = await systemSession.send('SystemInfo.getInfo');
  report.gpu = {
    devices: gpu.devices.map(({ vendorString, deviceString }) => ({ vendorString, deviceString })),
    renderer: gpu.auxAttributes.glRenderer
  };
  await systemSession.detach();
  for (const backend of ['webgl2', 'webgpu']) {
    const context = await browser.newContext({ viewport: { width: 1100, height: 1000 }, deviceScaleFactor: 1 });
    const watchdog = setTimeout(() => {
      void context.close({ reason: 'Catalog verification exceeded 90 seconds' }).catch(() => {});
    }, 90000);
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    try {
      const url = new URL('/examples/text-editing/index.html', 'http://127.0.0.1:' + server.address().port);
      url.search = new URLSearchParams({
        backend,
        preset: 'verification',
        catalog: '1',
        fontConfig: authored.configPath
      });
      await page.goto(url.href);
      await page.waitForFunction(() => !!window.__egretTextEditing);
      await call(page, 'settled');
      await page.evaluate(() => window.__egretTextEditing.ready);
      // Hit the middle editable row in the canvas, through the ordinary pointer route.
      const start = await observe(page);
      assert.equal(start.row.index, 25002);
      await page
        .locator('#scene')
        .click({ position: { x: start.origin.x + 16, y: start.origin.y + start.row.box.y + 16 } });
      await call(page, 'setSelection', 'name', { anchor: 0, focus: 3, affinity: 'downstream' });
      const before = await observe(page);
      geometry(before, 'name');
      assert.deepEqual(before.nativeSelection, [0, 3]);
      const cancel = await holdFont(page);
      const pending = await observe(page);
      geometry(pending, 'name');
      assert.equal(pending.fontKey, before.fontKey);
      assert.deepEqual(pending.nativeBox, before.nativeBox);
      await call(page, 'cancelFontReplacement');
      await cancel.release();
      const canceledLoad = await cancel.result;
      assert.equal(canceledLoad.ok, false);
      assert.equal(canceledLoad.code, 'UI_EDITOR_FONTS_CANCELLED');
      const canceled = await observe(page);
      geometry(canceled, 'name');
      assert.equal(canceled.sets, 1);
      assert.equal(canceled.fontKey, before.fontKey);
      assert.deepEqual(canceled.nativeBox, before.nativeBox);
      const failedRequest = await holdFont(page);
      await failedRequest.release(503);
      const failedLoad = await failedRequest.result;
      assert.equal(failedLoad.ok, false);
      assert.equal(failedLoad.code, 'MANIFEST_GROUP_ACQUIRE_FAILED');
      assert.match(failedLoad.message, /WEB_RESOURCE_HTTP_STATUS/);
      const failed = await observe(page);
      geometry(failed, 'name');
      assert.equal(failed.fontKey, before.fontKey);
      assert.equal(failed.sets, 1);
      assert.deepEqual(failed.nativeBox, before.nativeBox);
      // The second binding starts a draft while the font request is in flight.
      // The first binding must still use its old generation when admission fails.
      await call(page, 'action', 'description');
      const racing = await holdFont(page);
      await composeDraft(page);
      await racing.release();
      const conflict = await racing.result;
      assert.equal(conflict.message, 'EXAMPLE_COMPOSING');
      assert.equal(conflict.ok, false);
      const guarded = await observe(page, 'description');
      const firstKey = (await call(page, 'inspect')).fields.name.style.fontSet;
      assert.equal(firstKey, before.fontKey);
      assert.equal(guarded.fontKey, before.fontKey);
      assert.equal(guarded.fieldState, 'composing');
      assert.equal(guarded.sets, 1);
      assert(guarded.innerFocus);
      await call(page, 'action', 'cancel');
      await call(page, 'action', 'name');
      await call(page, 'setSelection', 'name', { anchor: 0, focus: 3, affinity: 'downstream' });
      const retry = await holdFont(page);
      await call(page, 'action', 'reading-theme');
      const themed = await observe(page);
      geometry(themed, 'name');
      assert.equal(themed.fontKey, before.fontKey);
      assert.equal(themed.theme, 'reading');
      assert(themed.row.box.height > before.row.box.height);
      assert.deepEqual(themed.anchor, before.anchor);
      assert.deepEqual(themed.nativeSelection, before.nativeSelection);
      await retry.release();
      assert.deepEqual(await retry.result, { ok: true });
      const swapped = await observe(page);
      geometry(swapped, 'name');
      assert.notEqual(swapped.fontKey, before.fontKey);
      assert.equal(swapped.sets, 1);
      assert.equal(swapped.theme, themed.theme);
      assert.deepEqual(swapped.anchor, before.anchor);
      assert.deepEqual(swapped.nativeSelection, before.nativeSelection);
      assert.equal(swapped.field, before.field);
      // Only the font family changes between these two layouts. Use committed glyph
      // runs from the real bundled Latin and CJK fonts to check the wrap and height.
      const prose = 'M '.repeat(76).trimEnd();
      await call(page, 'setValue', 'description', prose);
      const desc = await observe(page, 'description');
      await page
        .locator('#scene')
        .click({ position: { x: desc.origin.x + 24, y: desc.origin.y + desc.row.box.y + 16 } });
      await call(page, 'setSelection', 'description', { anchor: 2, focus: 8, affinity: 'downstream' });
      const alternate = await observe(page, 'description');
      geometry(alternate, 'description');
      await call(page, 'replaceFonts', config.initial);
      const initial = await observe(page, 'description');
      geometry(initial, 'description');
      assert.notEqual(initial.nativeFamily, alternate.nativeFamily);
      assert.notEqual(initial.lines.length, alternate.lines.length);
      assert.notEqual(initial.row.box.height, alternate.row.box.height);
      assert.deepEqual(initial.anchor, alternate.anchor);
      assert.deepEqual(initial.nativeSelection, alternate.nativeSelection);
      assert.equal(initial.field, alternate.field);
      await page.screenshot({ path: path.join(out, backend + '-editor.png') });
      await composeDraft(page);
      assert.equal((await observe(page, 'description')).fieldState, 'composing');
      await assert.rejects(call(page, 'replaceFonts', config.alternate), /EXAMPLE_COMPOSING/);
      await call(page, 'action', 'cancel');
      assert.equal((await observe(page, 'description')).field, prose);
      await call(page, 'action', 'description');
      await call(page, 'action', 'scroll');
      const offscreen = await observe(page, 'description');
      assert.equal(offscreen.nativeBox, null);
      assert.equal(offscreen.semanticBox, null);
      assert.equal(offscreen.editorLeases, 0);
      assert(offscreen.counters.liveShells <= 12);
      const retiring = await holdFont(page);
      const closing = call(page, 'close');
      const late = await retiring.result;
      await retiring.release();
      assert.equal(late.code, 'UI_EDITOR_FONTS_CANCELLED');
      const end = await closing;
      assert.equal(end.state, 'closed');
      assert.deepEqual(end.errors, []);
      assert.equal(end.fontStatus.sets, 0);
      assert.equal(end.fontStatus.editorLeases, 0);
      assert.equal(await page.locator('[role=listitem], [data-egret-text-editor]').count(), 0);
      assert.deepEqual(errors, []);
      report.reports.push({
        backend,
        canceledLoad,
        failedLoad,
        conflict,
        late,
        before,
        pending,
        canceled,
        failed,
        themed,
        swapped,
        alternate,
        initial,
        controlledDraftCanceled: true,
        offscreen,
        closed: true
      });
      console.log(backend, '50,000 rows, canceled font, newer theme, retry, projection and close passed');
    } catch (error) {
      report.failure = { backend, message: error.message, errors, state: await observe(page).catch(() => null) };
      throw error;
    } finally {
      clearTimeout(watchdog);
      await context.close();
    }
  }
} finally {
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
