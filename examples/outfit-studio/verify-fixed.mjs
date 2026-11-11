// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {once} from 'node:events';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {setTimeout as sleep} from 'node:timers/promises';
import {createStudioServer} from './serve.mjs';
import {workload} from './workload.mjs';

const [playwright,output,mode = '--check'] = process.argv.slice(2);
assert.ok(playwright && output && path.isAbsolute(playwright) && path.isAbsolute(output) &&
  ['--check','--timing'].includes(mode),'Usage: node verify-fixed.mjs <absolute Playwright package> <new absolute output> [--timing]');
const measure = mode === '--timing';
await fs.mkdir(output);
const require = createRequire(import.meta.url);
const {chromium} = require(playwright);
const {version} = require(path.join(playwright,'package.json'));
assert.equal(version,'1.62.1');

const server = await createStudioServer();
server.listen(0,'127.0.0.1');
await once(server,'listening');
const origin = 'http://127.0.0.1:'+server.address().port;
const report = {schema:1,profile:'X-D60/1',kind:measure ? 'timing' : 'browser correctness',
  startedAt:new Date().toISOString(),playwright:version,headless:!measure,os:os.version(),cpu:os.cpus()[0]?.model,rows:[]};
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const save = (name,value) => fs.writeFile(path.join(output,name),JSON.stringify(value,null,2)+'\n',{flag:'wx'});
const inspect = page => page.evaluate(() => globalThis.__egretOutfitStudio.inspect());

async function begin(browser,backend,load,row) {
  const context = await browser.newContext({viewport:{width:1180,height:1000},deviceScaleFactor:1,serviceWorkers:'block'});
  try {
    const page = await context.newPage();
    await page.bringToFront();
    const cdp = await context.newCDPSession(page);
    await cdp.send('Network.enable',{maxTotalBufferSize:100_000_000,maxResourceBufferSize:32_000_000});
    await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
    const responses = new Map();
    cdp.on('Network.responseReceived',event => {
      if (event.response.url.startsWith(origin+'/') && event.response.status === 200) {
        responses.set(event.requestId,new URL(event.response.url).pathname);
      }
    });
    await page.addInitScript(() => performance.setResourceTimingBufferSize(2048));
    page.on('pageerror',error => row.errors.push(error.message));
    await page.goto(origin+'/examples/outfit-studio/index.html?profile=x-d60&backend='+backend+'&load='+load+(measure ? '&trace=1' : ''),
      {waitUntil:'load',timeout:45000});
    await page.waitForFunction(() => ['ready','failed'].includes(globalThis.__egretOutfitStudio?.inspect().state),undefined,{timeout:45000});
    const state = await inspect(page);
    if (state.state !== 'ready') {
      row.startupError = await page.evaluate(async () => {
        try { await globalThis.__egretOutfitStudio.ready; } catch (error) {
          const causes = [];
          for (let value = error; value && causes.length < 8; value = value.cause) causes.push(value.message);
          return causes;
        }
      });
    }
    assert.equal(state.state,'ready',JSON.stringify(row.startupError ?? state.errors));
    assert.equal(state.backend,backend);
    assert.equal(state.scene.authored,workload.authored);
    assert.equal(state.scene.visible,workload.visible);
    assert.equal(state.scene.clipLevels,workload.clipLevels);
    assert.deepEqual(state.surface.backing,[1024,768]);
    assert.deepEqual([state.surface.css.width,state.surface.css.height,state.surface.ratio],[1024,768,1]);
    assert.ok(Number.isFinite(state.surface.dpr) && state.surface.dpr > 0);
    assert.equal(state.cast.actors.length,8);
    for (const actor of state.cast.actors) {
      assert.deepEqual([actor.playback.bones.length,actor.playback.slots.length,actor.playback.tracks.length],[120,96,2]);
      assert.equal(actor.render.vertices,2304);
      assert.equal(actor.render.indices,2496);
    }
    assert.equal(state.cast.sequences.length,80);
    assert.equal(new Set(state.cast.sequences).size,80);
    assert.equal(state.reference.counters.recordCount,50000);
    assert.equal(state.reference.counters.visibleRows,32);
    assert.ok(state.reference.counters.liveShells <= 48);
    row.startup = await page.evaluate(() => {
      const ms = performance.getEntriesByName('egret-studio-interactive')[0].startTime;
      const records = [...performance.getEntriesByType('navigation'),...performance.getEntriesByType('resource')]
        .filter(entry => entry.name.startsWith(location.origin+'/') && entry.responseEnd <= ms)
        .map(entry => ({path:new URL(entry.name).pathname,transfer:entry.transferSize,bytes:entry.encodedBodySize,status:entry.responseStatus}));
      return {ms,records,transfer:records.reduce((sum,entry) => sum+entry.transfer,0),visible:document.visibilityState,
        focused:document.hasFocus(),dpr:devicePixelRatio,ua:navigator.userAgent};
    });
    if (measure) assert.ok(row.startup.visible === 'visible' && row.startup.focused,'Timing requires the actual foreground page');
    row.inputs = [];
    for (const [id,url] of responses) {
      const body = await cdp.send('Network.getResponseBody',{requestId:id});
      const bytes = Buffer.from(body.body,body.base64Encoded ? 'base64' : 'utf8');
      row.inputs.push({path:url,bytes:bytes.length,sha256:sha(bytes)});
    }
    assert.deepEqual(row.startup.records.map(entry => entry.path).sort(),row.inputs.map(entry => entry.path).sort());
    assert.ok(row.startup.records.every(entry => entry.status === 200 && entry.bytes > 0 && entry.transfer >= entry.bytes));
    row.initial = state;
    return {context,page};
  } catch (error) {
    await context.close();
    throw error;
  }
}

async function correctness(page,row) {
  const wait = async (predicate,arg) => {
    await page.waitForFunction(predicate,arg,{timeout:15000});
  };
  const click = async (x,y) => {
    const box = await page.locator('canvas').boundingBox();
    await page.mouse.click(box.x+x,box.y+y);
  };
  const rowClick = async (panel,key) => {
    const root = (await inspect(page)).ui[panel];
    const {box} = root.rows.find(value => value.key === key && value.visible);
    const top = Math.max(0,box.y), bottom = Math.min(root.viewport.height,box.y+box.height);
    await click(root.origin.x+box.x+box.width/2,root.origin.y+(top+bottom)/2);
  };
  await page.locator('canvas').scrollIntoViewIfNeeded();
  await wait(() => globalThis.__egretOutfitStudio.inspect().scene.mutations === 60);
  const points = [[0,0],[480,120],[501,130],[850,76],[922,76],[878,195]];
  row.pixels = await page.evaluate(value => globalThis.__egretOutfitStudio.pixels(value),points);
  assert.deepEqual(row.pixels[0],[16,25,44,255]);
  assert.ok(row.pixels.slice(1).every(pixel => pixel[3] === 255));
  assert.notDeepEqual(row.pixels[3],row.pixels[4]);
  row.points = points;
  const catalog = row.initial.reference.vault;
  const box = await page.locator('canvas').boundingBox();
  await page.mouse.move(box.x+catalog.x+70,box.y+catalog.y+15);
  await page.mouse.wheel(0,230);
  await wait(() => globalThis.__egretOutfitStudio.inspect().reference.scrollOffset >= 200);
  assert.ok((await inspect(page)).reference.counters.liveShells <= 48);
  await page.mouse.wheel(0,-230);
  await wait(() => globalThis.__egretOutfitStudio.inspect().reference.scrollOffset === 0);
  await page.mouse.move(box.x+catalog.x+60,box.y+catalog.y+7*16+9);
  await page.mouse.down();
  await page.mouse.wheel(0,128);
  await wait(() => globalThis.__egretOutfitStudio.inspect().reference.scrollOffset === 128);
  await page.mouse.up();
  await page.evaluate(() => globalThis.__egretOutfitStudio.pixels([[0,0]]));
  assert.equal((await inspect(page)).selected,'e_nova','A different record must not inherit the pressed row');
  await page.mouse.wheel(0,-128);
  await wait(() => globalThis.__egretOutfitStudio.inspect().reference.scrollOffset === 0);
  await click(catalog.x+60,catalog.y+7*16+9);
  await wait(() => globalThis.__egretOutfitStudio.inspect().selected === 'e_studio_7');
  await rowClick('roster','skin');
  await wait(() => globalThis.__egretOutfitStudio.inspect().revision === 1);
  const edited = await inspect(page);
  assert.equal(edited.characters[7].outfit,'default');
  assert.deepEqual(edited.characters.slice(0,7),row.initial.characters.slice(0,7));
  await rowClick('roster','palette');
  await wait(() => {
    const view = globalThis.__egretOutfitStudio.inspect();
    return view.replacement?.phase === 'ready' && view.cast.actors[7].playback.tracks.length === 2;
  });
  await rowClick('roster','details');
  await wait(() => globalThis.__egretOutfitStudio.inspect().ui.layers.openStack.includes('details'));
  await rowClick('details','rename');
  await wait(() => globalThis.__egretOutfitStudio.inspect().ui.layers.openStack.includes('rename'));
  await rowClick('rename','draft');
  const editor = page.getByRole('textbox',{name:'Character name / 角色名称',exact:true});
  await editor.waitFor({state:'visible'});
  await editor.fill('Nova 雨');
  await rowClick('rename','save');
  await wait(() => globalThis.__egretOutfitStudio.inspect().revision === 3);
  row.final = await inspect(page);
  assert.equal(row.final.characters[7].name,'Nova 雨');
  assert.ok(row.final.errors.length === 0);
  assert.equal(row.final.reference.touch.coreContacts,0);
  await page.screenshot({path:path.join(output,row.backend+'.png')});
}

const percentile = (values,p) => {
  assert.ok(values.length);
  return values.slice().sort((a,b) => a-b)[Math.ceil(values.length*p)-1];
};
function summarize(data,dpr) {
  assert.equal(data.saturated,false);
  const samples = data.samples;
  assert.ok(samples.every((entry,index) => entry.visible && entry.focused && entry.dpr === dpr && entry.layoutRevision === 1 &&
    (!index || (entry.completedAt > samples[index-1].completedAt && entry.frame === samples[index-1].frame+1))));
  const windows = Array.from({length:5},(_,index) => {
    const from = data.origin+30_000+index*60_000, to = from+60_000;
    const first = samples.findIndex(value => value.completedAt >= from);
    const after = samples.findIndex(value => value.completedAt > to);
    assert.ok(first > 0 && after > first,'Complete timing window is required');
    const entries = samples.slice(first,after);
    // Keep boundary-crossing intervals so a stalled window cannot improve its reported tail.
    const gaps = samples.slice(first,after+1).map((value,i) => value.completedAt-samples[first+i-1].completedAt);
    const p95 = key => percentile(entries.map(row => row[key]),.95);
    return {from,to,frames:entries.length,frameP95:percentile(gaps,.95),frameP99:percentile(gaps,.99),
      maxGap:Math.max(...gaps),mutationP95:p95('mutationMs'),animationP95:p95('animationMs'),uiElapsedP95:p95('uiMs'),
      captureP95:p95('captureMs'),hostP95:p95('hostMs'),
      sampledPhaseElapsedP95:percentile(entries.map(row => row.animationMs+row.uiMs+row.captureMs+row.hostMs),.95),
      synchronousElapsedP95:percentile(entries.map(row => row.animationMs+row.captureMs+row.hostMs),.95)};
  });
  const median = key => percentile(windows.map(row => row[key]),.5);
  const middle = {sampledPhaseElapsed:median('sampledPhaseElapsedP95'),synchronousElapsed:median('synchronousElapsedP95'),
    host:median('hostP95'),frameP95:median('frameP95'),frameP99:median('frameP99'),
    mutation:median('mutationP95'),animation:median('animationP95'),uiElapsed:median('uiElapsedP95'),capture:median('captureP95')};
  return {windows,median:middle,targets:{engine:'OPEN',synchronousElapsedAbove8:middle.synchronousElapsed>8,
    preparation:middle.host<=4 ? 'BOUNDED' : 'OPEN',frameIntervals:middle.frameP95<=16.7 && middle.frameP99<=33.4 ? 'PASS' : 'FAIL'},gpu:'UNMEASURED'};
}

let browser, timingDpr;
try {
  browser = await chromium.launch({channel:'msedge',headless:!measure});
  report.browser = browser.version();
  const device = await browser.newBrowserCDPSession();
  const {gpu} = await device.send('SystemInfo.getInfo');
  report.gpu = {devices:gpu.devices,auxAttributes:gpu.auxAttributes};
  await device.detach();
  for (const backend of ['webgpu','webgl2']) {
    for (const load of measure ? ['static','sparse','full'] : ['sparse']) {
      const row = {backend,load,errors:[]};
      report.rows.push(row);
      let casePage;
      try {
        casePage = await begin(browser,backend,load,row);
        const {page} = casePage;
        if (measure) {
          timingDpr ??= row.startup.dpr;
          assert.equal(row.startup.dpr,timingDpr,'All timing lanes require identical actual window DPR');
          await page.waitForFunction(() => globalThis.__egretOutfitStudio.timings().origin !== undefined,undefined,{timeout:15000});
          await sleep(332_000);
          const data = await page.evaluate(() => globalThis.__egretOutfitStudio.timings());
          row.trace = backend+'-'+load+'-trace.json';
          await save(row.trace,data);
          row.final = await inspect(page);
          assert.equal(row.final.scene.mutations,workload.mutations[load]);
          assert.equal(row.final.errors.length,0);
          row.timing = summarize(data,timingDpr);
        } else await correctness(page,row);
        row.cleanup = (await page.evaluate(() => globalThis.__egretOutfitStudio.close())).cleanup;
        assert.equal(row.cleanup.scope,'closed');
        assert.equal(row.cleanup.host.state,'closed');
        assert.deepEqual(row.cleanup.failures,[]);
        assert.deepEqual(row.errors,[]);
        row.status = 'OBSERVED';
      } catch (error) {
        row.status = 'INCOMPLETE';
        row.failure = String(error.stack ?? error);
        if (casePage) row.failureState = await inspect(casePage.page).catch(() => undefined);
      } finally {
        await casePage?.context.close();
        await save(backend+'-'+load+'.json',row);
        console.log(JSON.stringify({backend,load,status:row.status,timing:row.timing?.median,failure:row.failure?.split('\n')[0]}));
      }
    }
  }
} finally {
  await browser?.close();
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
  report.finishedAt = new Date().toISOString();
  await save('result.json',report);
}
if (report.rows.some(row => row.status !== 'OBSERVED')) process.exitCode = 1;
