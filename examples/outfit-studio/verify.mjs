// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {once} from 'node:events';
import {createRequire} from 'node:module';
import {createStudioServer} from './serve.mjs';
import {openStudioProject} from './project.mjs';

const [playwright,output] = process.argv.slice(2);
if (!playwright || !output || !path.isAbsolute(playwright) || !path.isAbsolute(output)) {
  throw new Error('Usage: node examples/outfit-studio/verify.mjs <absolute Playwright package> <new absolute output directory>');
}
await fs.mkdir(output);
const require = createRequire(import.meta.url);
const {chromium} = require(playwright);
const {version:playwrightVersion} = require(path.join(playwright,'package.json'));
assert.equal(playwrightVersion, '1.62.1');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const save = (file,value) => fs.writeFile(path.join(output,file), JSON.stringify(value,null,2) + '\n', {flag:'wx'});
const inspect = page => page.evaluate(() => globalThis.__egretOutfitStudio.inspect());
const pixels = (page,points) => page.evaluate(points => globalThis.__egretOutfitStudio.pixels(points), points);
const folder = '/examples/outfit-studio/';

async function listen(projectFile) {
  const server = await createStudioServer(projectFile);
  server.listen(0, '127.0.0.1');
  await once(server,'listening');
  return {server,origin:`http://127.0.0.1:${server.address().port}`};
}

async function stop(server) {
  if (server?.listening) await new Promise((resolve,reject) => server.close(error => error ? reject(error) : resolve()));
}

async function openPage(browser, origin, backend, row) {
  const context = await browser.newContext({viewport:{width:1180,height:860},deviceScaleFactor:1,serviceWorkers:'block'});
  try {
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send('Network.enable', {maxTotalBufferSize:64 * 1024 * 1024,maxResourceBufferSize:24 * 1024 * 1024});
    await cdp.send('Network.setCacheDisabled', {cacheDisabled:true});
    const responses = new Map();
    cdp.on('Network.responseReceived', event => {
      if (event.response.url.startsWith(origin + '/') && event.response.status === 200) {
        responses.set(event.requestId,new URL(event.response.url).pathname);
      }
    });
    await page.addInitScript(() => {
      performance.setResourceTimingBufferSize(2048);
      globalThis.__studioTimingOverflow = false;
      performance.addEventListener('resourcetimingbufferfull', () => { globalThis.__studioTimingOverflow = true; });
    });
    page.on('pageerror',error => row.pageErrors.push(error.message));
    page.on('response',response => {
      if (response.status() >= 400) row.httpErrors.push({path:new URL(response.url()).pathname,status:response.status()});
    });
    await page.goto(`${origin}${folder}index.html?backend=${backend}`, {waitUntil:'load',timeout:45000});
    await page.waitForFunction(() => globalThis.__egretOutfitStudio, undefined, {timeout:15000});
    await page.waitForFunction(() => ['ready','failed'].includes(globalThis.__egretOutfitStudio.inspect().state), undefined, {timeout:45000});
    const state = await inspect(page);
    assert.equal(state.state,'ready',JSON.stringify(state.errors));
    assert.equal(state.backend,backend);
    assert.equal(await page.locator('#download').isEnabled(),true);
    return {context,page,cdp,responses};
  } catch (error) {
    await context.close();
    throw error;
  }
}

async function cold(page) {
  const timing = await page.evaluate(() => {
    const end = performance.getEntriesByName('egret-studio-interactive')[0].startTime;
    const entries = [...performance.getEntriesByType('navigation'), ...performance.getEntriesByType('resource')];
    return {milliseconds:end,overflow:globalThis.__studioTimingOverflow,rows:entries.filter(e => e.name.startsWith(location.origin + '/') && e.responseEnd <= end)
      .map(e => ({path:new URL(e.name).pathname,body:e.encodedBodySize,decoded:e.decodedBodySize,transfer:e.transferSize,
        end:e.responseEnd,status:e.responseStatus}))};
  });
  assert.equal(timing.overflow,false,'Cold startup timing buffer overflowed');
  const categories = Object.fromEntries(['javascript','wasm','fonts','scene','shell'].map(kind => [kind,{body:0,transfer:0,requests:0}]));
  for (const row of timing.rows) {
    assert.equal(row.status,200,JSON.stringify(row));
    assert.ok(row.body > 0 && row.transfer >= row.body && row.body === row.decoded,JSON.stringify(row));
    const kind = row.path.endsWith('.wasm') ? 'wasm'
      : row.path.includes('/font-resources/') && row.path.includes('/blobs/sha256/') ? 'fonts'
      : /\.(m?js)$/.test(row.path) || row.path.startsWith('/studio-deps/') ? 'javascript'
      : row.path.includes('/content/') ? 'scene' : 'shell';
    categories[kind].body += row.body;
    categories[kind].transfer += row.transfer;
    categories[kind].requests++;
  }
  assert.equal(categories.wasm.requests,1);
  assert.equal(categories.fonts.requests,3);
  assert.ok(categories.scene.requests >= 7 && categories.javascript.requests > 25);
  return {...timing,categories};
}

function rowPoint(page, panel, key) {
  return page.evaluate(({panel,key}) => {
    const root = globalThis.__egretOutfitStudio.inspect().ui[panel];
    const row = root.rows.find(row => row.key === key);
    if (!row || !row.visible) throw new Error(`Missing visible row ${key}`);
    const rect = document.querySelector('canvas').getBoundingClientRect();
    return {x:rect.x + root.origin.x + row.box.x + 14,y:rect.y + root.origin.y + row.box.y + row.box.height / 2};
  }, {panel,key});
}

async function clickRow(page, panel, key) {
  const point = await rowPoint(page,panel,key);
  await page.mouse.click(point.x,point.y);
}

function wait(page, source, data) {
  return page.waitForFunction(source, data, {timeout:10000});
}

function color(actual, expected) {
  assert.ok(actual.every((value,index) => Math.abs(value - expected[index]) <= 1), `${actual} vs ${expected}`);
}

async function closePage(page) {
  await page.locator('#close').click();
  await wait(page, () => globalThis.__egretOutfitStudio.inspect().state === 'closed');
  const final = await inspect(page);
  assert.deepEqual(final.cleanup.failures,[]);
  assert.equal(final.cleanup.scope,'closed');
  assert.equal(final.cleanup.fonts.editorLeases,0);
  assert.equal(final.cleanup.fonts.fontBytes,0);
  assert.equal(final.cleanup.cache.imageBytes,0);
  assert.equal(final.cleanup.host.state,'closed');
  assert.equal(final.cast.sequence.isDisposed,true);
  assert.ok(final.cast.actors.every(row => row.closed));
  assert.equal(await page.locator('[data-egret-text-editor]').count(),0);
  return final.cleanup;
}

async function scenario(page, backend, row) {
  const check = name => row.checks.push(name);
  await page.locator('#pause').click();
  assert.equal((await inspect(page)).playing,false);
  const points = [[400,220],[455,220],[530,272],[770,272],[650,400]];
  row.initialPixels = await pixels(page, points);
  color(row.initialPixels[0],[32,48,80,255]);
  color(row.initialPixels[1],[48,80,128,255]);
  color(row.initialPixels[2],[255,128,32,255]);
  color(row.initialPixels[3],[255,128,32,255]);
  assert.ok([[255,255,0,255],[0,255,128,255]].some(expected => expected.every((value,index) => value === row.initialPixels[4][index])));
  check('Actual 3D depth, foreground actors and sequence pixels share a frame');

  await clickRow(page,'roster','hero-1');
  await wait(page, () => globalThis.__egretOutfitStudio.inspect().selected === 'e_lumen');
  await clickRow(page,'roster','hero-0');
  await wait(page, () => globalThis.__egretOutfitStudio.inspect().selected === 'e_nova');
  await clickRow(page,'roster','skin');
  await wait(page, () => globalThis.__egretOutfitStudio.inspect().revision === 1);
  const changed = await inspect(page);
  assert.deepEqual(changed.cast.actors.map(actor => actor.playback.skins), [['default','cool-coat'],['default','warm-hat']]);
  const colors = await pixels(page,points.slice(2,4));
  color(colors[0],[32,160,255,255]);
  color(colors[1],[255,128,32,255]);
  check('Selecting and changing one actor leaves the other actor independent');

  async function rename() {
    await clickRow(page,'roster','details');
    await wait(page, () => globalThis.__egretOutfitStudio.inspect().ui.layers.openStack.at(-1) === 'details');
    await page.keyboard.press('Enter');
    await wait(page, () => globalThis.__egretOutfitStudio.inspect().ui.layers.openStack.at(-1) === 'rename');
    await clickRow(page,'rename','draft');
    return page.locator('input[data-egret-text-editor]');
  }
  let input = await rename();
  await input.fill('Discarded draft');
  const savePoint = await rowPoint(page,'rename','save');
  const canvas = await page.locator('canvas').boundingBox();
  await page.mouse.move(savePoint.x,savePoint.y);
  await page.mouse.down();
  await page.mouse.move(canvas.x+canvas.width-40,canvas.y+24,{steps:2});
  await page.mouse.up();
  await pixels(page,[[400,220]]);
  const afterDrag = await inspect(page);
  assert.equal(afterDrag.revision,1);
  assert.equal(afterDrag.ui.layers.openStack.at(-1),'rename');
  await clickRow(page,'rename','draft');
  input = page.locator('input[data-egret-text-editor]');
  assert.equal(await input.inputValue({timeout:4000}),'Discarded draft');
  await input.fill('Edited again',{timeout:4000});
  assert.equal(await input.inputValue(),'Edited again');
  check('Drag-out Save preserves the draft and it can be edited again');
  await clickRow(page,'rename','cancel');
  await wait(page, () => globalThis.__egretOutfitStudio.inspect().ui.layers.openStack.at(-1) === 'details');
  assert.equal((await inspect(page)).characters[0].name,'Nova 星羽');
  assert.equal((await inspect(page)).revision,1);
  await clickRow(page,'details','back');
  await wait(page, () => globalThis.__egretOutfitStudio.inspect().ui.layers.openStack.length === 0);
  check('Keyboard opens the dialog and Cancel discards native draft text');

  input = await rename();
  await input.fill('Nova 🫠');
  await clickRow(page,'rename','save');
  await wait(page, () => globalThis.__egretOutfitStudio.inspect().nameRefusal?.code === 'ASSET_LOAD_FAILED');
  const refusedName = await inspect(page);
  assert.equal(refusedName.revision,1);
  assert.equal(refusedName.characters[0].name,'Nova 星羽');
  assert.equal(refusedName.ui.layers.openStack.at(-1),'rename');
  await wait(page, () => globalThis.__egretOutfitStudio.inspect().ui.editor.nativeElement === false);
  check('A name outside the Studio font coverage leaves the authored project and dialog usable');
  await clickRow(page,'rename','draft');
  input = page.locator('input[data-egret-text-editor]');
  await input.fill('Nova 雨');
  await clickRow(page,'rename','save');
  await wait(page, () => globalThis.__egretOutfitStudio.inspect().revision === 2);
  assert.equal((await inspect(page)).characters[0].name,'Nova 雨');
  await clickRow(page,'details','back');
  await wait(page, () => globalThis.__egretOutfitStudio.inspect().ui.layers.openStack.length === 0);
  check('Save publishes one authored name and returns to details');

  let refused = 0;
  await page.route('**/content/alternate/assets/warm', route => {
    refused++;
    return route.fulfill({status:503,body:'Intentional single artifact refusal'});
  }, {times:1});
  await clickRow(page,'roster','palette');
  await wait(page, () => globalThis.__egretOutfitStudio.inspect().replacement?.phase === 'failed');
  const afterFailure = await inspect(page);
  assert.equal(refused,1);
  assert.equal(afterFailure.revision,2);
  assert.equal(afterFailure.cast.actors[0].palette,'studio');
  color((await pixels(page,[[530,272]]))[0],[32,160,255,255]);
  check('A refused texture leaves the prior authored and visible outfit in use');

  await clickRow(page,'roster','palette');
  await wait(page, () => globalThis.__egretOutfitStudio.inspect().replacement?.phase === 'ready');
  const afterRetry = await inspect(page);
  assert.equal(afterRetry.revision,3);
  assert.deepEqual(afterRetry.cast.actors.map(actor => actor.palette), ['alternate','studio']);
  color((await pixels(page,[[530,272]]))[0],[255,128,32,255]);
  check('Retry stages the replacement, publishes it and leaves the sibling unchanged');

  const download = page.waitForEvent('download');
  await page.locator('#download').click();
  const saved = path.join(output,`${backend}-edited-project.json`);
  await (await download).saveAs(saved);
  assert.deepEqual(openStudioProject(await fs.readFile(saved,'utf8')).characters(),afterRetry.characters);
  await page.screenshot({path:path.join(output,`${backend}-studio.png`)});
  row.cleanup = await closePage(page);
  assert.deepEqual(afterRetry.errors,[]);
  check('Export round-trips and closing retires the real Engine owners');
  return saved;
}

const report = {scope:'Desktop mixed development slice',status:'INCOMPLETE',environment:{platform:os.platform(),release:os.release(),cpu:os.cpus()[0].model,
  node:process.version,playwright:playwrightVersion,channel:'msedge',headless:true,transport:'loopback HTTP, cold browser cache, uncompressed, unshaped'},backends:[]};
let original,browser;
try {
  original = await listen();
  browser = await chromium.launch({channel:'msedge',headless:true});
  report.environment.browser = browser.version();
  for (const backend of ['webgpu','webgl2']) {
    const row = {backend,status:'INCOMPLETE',checks:[],cold:[],pageErrors:[],httpErrors:[]};
    report.backends.push(row);
    let context, edited;
    try {
      for (let attempt = 0; attempt < 3; attempt++) {
        const session = await openPage(browser,original.origin,backend,row);
        context = session.context;
        row.cold.push(await cold(session.page));
        if (attempt === 0) {
          // Fetch response bodies after the interactive marker to avoid copying them during cold timing.
          const timedPaths = row.cold[0].rows.map(entry => entry.path).sort();
          const recorded = [...session.responses].filter(([,name]) => timedPaths.includes(name));
          assert.deepEqual(recorded.map(([,name]) => name).sort(),timedPaths);
          row.sourceResponses = [];
          for (const [requestId,name] of recorded) {
            const response = await session.cdp.send('Network.getResponseBody', {requestId});
            const bytes = Buffer.from(response.body,response.base64Encoded ? 'base64' : 'utf8');
            assert.equal(bytes.length,row.cold[0].rows.find(entry => entry.path === name).decoded,name);
            row.sourceResponses.push({path:name,bytes:bytes.length,sha256:sha(bytes)});
          }
          const exported = await scenario(session.page,backend,row);
          await context.close();
          edited = await listen(exported);
          const reopened = await openPage(browser,edited.origin,backend,row);
          context = reopened.context;
          const state = await inspect(reopened.page);
          assert.equal(state.revision,3);
          assert.equal(state.characters[0].name,'Nova 雨');
          assert.deepEqual(state.cast.actors.map(actor => actor.palette),['alternate','studio']);
          row.reopenCleanup = await closePage(reopened.page);
          row.checks.push('Normal server reopens the exported project and uses its authored values');
        } else await closePage(session.page);
        await context.close();
        context = undefined;
      }
      assert.deepEqual(row.pageErrors,[]);
      assert.deepEqual(row.httpErrors,[{path:folder+'content/alternate/assets/warm',status:503}]);
      row.status = 'PASS';
    } catch (error) {
      row.status = 'FAIL';
      row.error = error.stack;
      const page = context?.pages()[0];
      if (page) {
        row.stoppedState = await inspect(page).catch(() => undefined);
        await page.screenshot({path:path.join(output,`${backend}-stopped.png`),timeout:4000}).catch(() => {});
      }
    } finally {
      await context?.close();
      await stop(edited?.server);
    }
  }
  report.status = report.backends.every(row => row.status === 'PASS') ? 'PASS' : 'FAIL';
} catch (error) {
  report.error = error.stack;
  report.status = 'FAIL';
} finally {
  await browser?.close();
  await stop(original?.server);
  await save('result.json',report);
}
console.log(JSON.stringify({status:report.status,backends:report.backends.map(row => ({backend:row.backend,status:row.status,checks:row.checks.length,
  cold:row.cold.map(sample => Math.round(sample.milliseconds)),error:row.error?.split('\n')[0]})),error:report.error?.split('\n')[0]}));
if (report.status !== 'PASS') process.exitCode = 1;
