// SPDX-License-Identifier: Apache-2.0
// Opens exported projects in the running Studio, in a real browser and on both backends: a round trip through
// the Export and Open buttons, a failed load, a cancelled load, a retry, and files the Studio refuses.
//
//   node examples/outfit-studio/verify-open.mjs <absolute Playwright package> <new absolute output directory> [software]
//
// Without the third argument the installed Edge is used, as in verify.mjs. With `software` the browser that
// Playwright bundles is launched with software rendering, for a machine without Edge or without a GPU; the
// report names which one ran.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {once} from 'node:events';
import {createRequire} from 'node:module';
import {createStudioServer} from './serve.mjs';
import {expandStudioProject, maxProjectBytes, openStudioProject} from './project.mjs';

const [playwright,output,renderer] = process.argv.slice(2);
if (!playwright || !output || !path.isAbsolute(playwright) || !path.isAbsolute(output) || ![undefined,'software'].includes(renderer)) {
  throw new Error('Usage: node examples/outfit-studio/verify-open.mjs <absolute Playwright package> <new absolute output directory> [software]');
}
await fs.mkdir(output);
const require = createRequire(import.meta.url);
const {chromium} = require(playwright);
const {version:playwrightVersion} = require(path.join(playwright,'package.json'));
const folder = '/examples/outfit-studio/';
const inspect = page => page.evaluate(() => globalThis.__egretOutfitStudio.inspect());
const pixels = (page,points) => page.evaluate(points => globalThis.__egretOutfitStudio.pixels(points), points);
const wait = (page,source,data) => page.waitForFunction(source, data, {timeout:20000});
const warm = [255,128,32,255], cool = [32,160,255,255], nova = [530,272];
function color(actual, expected) {
  assert.ok(actual.every((value,index) => Math.abs(value - expected[index]) <= 1), `${actual} vs ${expected}`);
}

/** What must not move when an opening fails or is cancelled: the project and every actor's version and pose. */
function live(state) {
  return {revision:state.revision,characters:state.characters,selected:state.selected,
    actors:state.cast.actors.map(({id,palette,ownership,playback}) => ({id,palette,ownership,playback}))};
}

async function clickRow(page, key) {
  const point = await page.evaluate(key => {
    const root = globalThis.__egretOutfitStudio.inspect().ui.roster;
    const row = root.rows.find(row => row.key === key);
    const rect = document.querySelector('canvas').getBoundingClientRect();
    return {x:rect.x + root.origin.x + row.box.x + 14,y:rect.y + root.origin.y + row.box.y + row.box.height / 2};
  }, key);
  await page.mouse.click(point.x,point.y);
}

async function exported(page, file) {
  const download = page.waitForEvent('download');
  await page.locator('#download').click();
  await (await download).saveAs(file);
  return fs.readFile(file,'utf8');
}

/** Chooses a file through the page's own file field and waits for the Studio to settle it. */
async function open(page, text, phase) {
  const number = await page.evaluate(() => (globalThis.__opened = (globalThis.__opened ?? 0) + 1));
  await page.evaluate(() => { globalThis.__before = globalThis.__egretOutfitStudio.inspect().opened; });
  await page.locator('#project-file').setInputFiles({name:`project-${number}.json`,mimeType:'application/json',buffer:Buffer.from(text)});
  await wait(page, name => {
    const opened = globalThis.__egretOutfitStudio.inspect().opened;
    return opened?.file === name && !['loading','published'].includes(opened.phase) && document.querySelector('#open').textContent.startsWith('Open project');
  }, `project-${number}.json`);
  const state = await inspect(page);
  assert.equal(state.opened.phase,phase,JSON.stringify(state.opened));
  return state;
}

async function start(browser, origin, query, row, setup) {
  const context = await browser.newContext({viewport:{width:1180,height:860},deviceScaleFactor:1,serviceWorkers:'block',acceptDownloads:true});
  const page = await context.newPage();
  if (setup) await setup(page);
  page.on('pageerror',error => row.pageErrors.push(error.message));
  await page.goto(`${origin}${folder}index.html?${query}`, {waitUntil:'load',timeout:45000});
  await page.waitForFunction(() => globalThis.__egretOutfitStudio, undefined, {timeout:15000});
  await page.waitForFunction(() => ['ready','failed'].includes(globalThis.__egretOutfitStudio.inspect().state), undefined, {timeout:45000});
  const state = await inspect(page);
  assert.equal(state.state,'ready',JSON.stringify(state.errors));
  assert.equal(await page.locator('#open').isEnabled(),true);
  // A paused preview holds every pose, so that a refused opening can be compared exactly.
  await page.locator('#pause').click();
  return {context,page};
}

async function finish(page) {
  await page.locator('#close').click();
  await wait(page, () => globalThis.__egretOutfitStudio.inspect().state === 'closed');
  const final = await inspect(page);
  assert.deepEqual(final.cleanup.failures,[]);
  assert.equal(final.cleanup.scope,'closed');
  assert.equal(final.cleanup.fonts.editorLeases,0);
  assert.equal(final.cleanup.cache.imageBytes,0);
  assert.equal(final.cleanup.host.state,'closed');
  assert.ok(final.cast.actors.every(actor => actor.closed));
  assert.equal(await page.locator('#open').isEnabled(),false);
}

async function compact(page, backend, row) {
  const check = name => row.checks.push(name);
  const ids = ['e_nova','e_lumen'];
  color((await pixels(page,[nova]))[0],warm);
  const first = await exported(page,path.join(output,`${backend}-first.json`));
  await clickRow(page,'hero-0');
  await clickRow(page,'skin');
  await wait(page, () => globalThis.__egretOutfitStudio.inspect().revision === 1);
  color((await pixels(page,[nova]))[0],cool);
  const second = await exported(page,path.join(output,`${backend}-second.json`));

  let state = await open(page,first,'ready');
  assert.equal(state.revision,2);
  assert.deepEqual(state.opened.changed,['e_nova']);
  assert.deepEqual(state.characters,openStudioProject(first).characters());
  assert.deepEqual(state.cast.actors.map(actor => actor.id),ids);
  assert.deepEqual(state.cast.actors.map(actor => actor.playback.skins),[['default'],['default','warm-hat']]);
  color((await pixels(page,[nova]))[0],warm);
  check('An earlier export opens over the live project: one transaction, the same character IDs, its authored outfit on screen');

  state = await open(page,first,'unchanged');
  assert.equal(state.revision,2);
  check('Opening the project that is already open writes nothing');

  // The first export, edited outside the Studio: both palettes, one name, one outfit.
  const authored = openStudioProject(first);
  authored.edit('e_nova',{palette:'alternate',name:'Nova 雨'});
  authored.edit('e_lumen',{palette:'alternate',outfit:'both'});
  const target = authored.serialize();
  const before = live(await inspect(page));

  let refused = 0;
  await page.route('**/content/alternate/assets/warm', route => { refused++; return route.fulfill({status:503,body:'Intentional single artifact refusal'}); }, {times:1});
  state = await open(page,target,'failed');
  assert.equal(refused,1);
  assert.deepEqual(state.opened.candidates,['failed']);
  assert.deepEqual(live(state),before);
  color((await pixels(page,[nova]))[0],warm);
  assert.match(await page.locator('#status').textContent(),/unchanged/);
  check('A refused texture fails the whole opening: project, actors, poses and pixels stay as they were');

  let release;
  const held = new Promise(resolve => { release = resolve; });
  let waiting = 0;
  await page.route('**/content/alternate/assets/**', async route => { waiting++; await held; await route.continue().catch(() => {}); });
  const number = await page.evaluate(() => (globalThis.__opened = (globalThis.__opened ?? 0) + 1));
  await page.locator('#project-file').setInputFiles({name:`project-${number}.json`,mimeType:'application/json',buffer:Buffer.from(target)});
  await wait(page, () => document.querySelector('#open').textContent.startsWith('Cancel opening'));
  await page.waitForTimeout(300);
  assert.ok(waiting > 0,'the opening is waiting for content');
  await page.locator('#open').click();
  await wait(page, () => globalThis.__egretOutfitStudio.inspect().opened.phase === 'cancelled' && document.querySelector('#open').textContent.startsWith('Open project'));
  await page.unroute('**/content/alternate/assets/**',{behavior:'ignoreErrors'});
  release();
  state = await inspect(page);
  assert.deepEqual(state.opened.candidates,['cancelled']);
  assert.deepEqual(live(state),before);
  color((await pixels(page,[nova]))[0],warm);
  check('Cancel during loading leaves the project, actors, poses and pixels as they were');

  state = await open(page,target,'ready');
  assert.equal(state.revision,3);
  assert.deepEqual(state.opened.changed,ids);
  assert.deepEqual(state.opened.candidates,['committed','committed']);
  assert.deepEqual(state.characters,authored.characters());
  assert.deepEqual(state.cast.actors.map(({id,palette,ownership}) => ({id,palette,ownership})),ids.map(id => ({id,palette:'alternate',ownership:'owned'})));
  assert.deepEqual(state.cast.actors.map(actor => actor.playback.skins),[['default'],['default','cool-coat','warm-hat']]);
  // The alternate palette exchanges the two outfit colours.
  color((await pixels(page,[nova]))[0],cool);
  check('Retry after failure and cancellation opens the file: both characters change together, under the same IDs');

  const settled = live(state);
  const refusals = [
    ['text that is not a project','{',/not an Outfit Studio project/,'STUDIO_OPEN_FILE'],
    ['a project of another kind',target.replace('p_outfit_studio','p_other'),/not an Outfit Studio project/,'STUDIO_OPEN_FILE'],
    ['a file longer than the bound',' '.repeat(maxProjectBytes) + target,/not an Outfit Studio project/,'STUDIO_OPEN_FILE'],
    ['a project with other characters',expandStudioProject(target),/other characters/,'STUDIO_OPEN_CHARACTERS'],
    ['a renamed character ID',target.replaceAll('e_lumen','e_lumina'),/other characters/,'STUDIO_OPEN_CHARACTERS'],
    ['other version pins',target.replace('"engineVersion":"0.0.0"','"engineVersion":"9.9.9"'),/other versions/,'STUDIO_OPEN_VERSIONS'],
    ['a name outside the font coverage',target.replace('Nova 雨','Nova 🫠'),/could not be displayed/,'STUDIO_OPEN_NAME']
  ];
  for (const [label,text,expected,reason] of refusals) {
    assert.notEqual(text,target,label);
    state = await open(page,text,'failed');
    assert.equal(state.opened.reason,reason,label);
    assert.deepEqual(live(state),settled,label);
    assert.match(await page.locator('#status').textContent(),expected,label);
  }
  color((await pixels(page,[nova]))[0],cool);
  check(`Seven files are refused for their own reason and change nothing: ${refusals.map(row => row[0]).join('; ')}`);

  // A draft in the rename dialog belongs to the project it was started in.
  await clickRow(page,'details');
  await wait(page, () => globalThis.__egretOutfitStudio.inspect().ui.layers.openStack.at(-1) === 'details');
  state = await open(page,second,'ready');
  assert.equal(state.revision,4);
  assert.deepEqual(state.characters,openStudioProject(second).characters());
  assert.deepEqual(state.cast.actors.map(actor => actor.palette),['studio','studio']);
  assert.deepEqual(state.cast.actors.map(actor => actor.playback.skins),[['default','cool-coat'],['default','warm-hat']]);
  color((await pixels(page,[nova]))[0],cool);
  assert.equal(state.ui.layers.openStack.at(-1),'details');
  const last = await exported(page,path.join(output,`${backend}-last.json`));
  assert.deepEqual(openStudioProject(last).characters(),openStudioProject(second).characters());
  assert.deepEqual(state.errors,[]);
  check('The second export opens over all of that, with the details panel open, and a new export carries its values');
  await finish(page);
  check('Close retires the Engine owners after four openings');
}

async function fixed(page, backend, row) {
  const eight = (await inspect(page)).characters;
  assert.equal(eight.length,8);
  // A two-character export from the compact route: the fixed route adds the same six as at start-up.
  const authored = openStudioProject(await fs.readFile(path.join(output,`${backend}-first.json`),'utf8'));
  authored.edit('e_nova',{palette:'alternate',outfit:'both'});
  const state = await open(page,authored.serialize(),'ready');
  assert.deepEqual(state.opened.changed,['e_nova']);
  assert.deepEqual(state.characters.map(character => character.id),eight.map(character => character.id));
  assert.deepEqual(state.characters.slice(1),eight.slice(1));
  assert.deepEqual(state.characters[0],{...eight[0],palette:'alternate',outfit:'both'});
  assert.deepEqual(state.cast.actors.map(actor => actor.palette),['alternate',...Array(7).fill('studio')]);
  assert.deepEqual(state.errors,[]);
  row.checks.push('The fixed route opens a compact export: eight stable IDs, one changed actor');
  await finish(page);
}


async function delayPresentation(page) {
  await page.addInitScript(() => {
    const presenting = () => globalThis.__egretOutfitStudio?.inspect().opened?.phase === 'published';
    let release;
    const held = new Promise(resolve => { release = resolve; });
    let holding = true;
    globalThis.__studioPresentationHeld = false;
    globalThis.__releaseStudioPresentation = () => { holding = false; release(); };
    const queue = globalThis.GPUQueue?.prototype;
    if (queue) {
      const waitForGPU = queue.onSubmittedWorkDone;
      queue.onSubmittedWorkDone = function () {
        const completion = waitForGPU.call(this);
        if (!holding || !presenting()) return completion;
        globalThis.__studioPresentationHeld = true;
        return completion.then(() => held);
      };
    }
    const gl = WebGL2RenderingContext.prototype;
    const waitForGL = gl.clientWaitSync;
    gl.clientWaitSync = function (...args) {
      const result = waitForGL.apply(this,args);
      if (holding && presenting() && (result === this.ALREADY_SIGNALED || result === this.CONDITION_SATISFIED)) {
        globalThis.__studioPresentationHeld = true;
        return this.TIMEOUT_EXPIRED;
      }
      return result;
    };
  });
}

async function fixedRoundTrip(page, backend, row) {
  const initialRevision = (await inspect(page)).revision;
  const original = await exported(page,path.join(output,backend + '-eight-original.json'));
  const authored = openStudioProject(original);
  const ids = authored.characters().map(character => character.id);
  assert.equal(ids.length,8);
  for (const id of ids) authored.edit(id,{palette:'alternate'});
  const target = authored.serialize();

  await page.locator('#project-file').setInputFiles({name:'eight-alternate.json',mimeType:'application/json',buffer:Buffer.from(target)});
  let toolbar;
  try {
    await wait(page, () => globalThis.__studioPresentationHeld && globalThis.__egretOutfitStudio.inspect().opened?.phase === 'published');
    toolbar = await page.locator('#open').evaluate(button => ({disabled:button.disabled,label:button.textContent}));
  } finally {
    await page.evaluate(() => globalThis.__releaseStudioPresentation());
  }
  await wait(page, () => globalThis.__egretOutfitStudio.inspect().opened?.phase === 'ready');
  const alternate = await inspect(page);
  assert.equal(alternate.revision,initialRevision+1);
  assert.deepEqual(alternate.opened.changed,ids);
  assert.deepEqual(alternate.cast.actors.map(actor => actor.palette),Array(8).fill('alternate'));

  // Exercise the original palette even if the toolbar assertion above would fail.
  await page.locator('#project-file').setInputFiles({name:'eight-original.json',mimeType:'application/json',buffer:Buffer.from(original)});
  await wait(page, () => {
    const opened = globalThis.__egretOutfitStudio.inspect().opened;
    return opened?.file === 'eight-original.json' && ['ready','failed'].includes(opened.phase)
      && document.querySelector('#open').textContent.startsWith('Open project');
  });
  const restored = await inspect(page);
  row.roundTrip = {toolbar,phase:restored.opened.phase,detail:restored.opened.detail,
    candidates:restored.opened.candidates,actorIds:restored.cast.actors.map(actor => actor.id)};
  assert.equal(restored.opened.phase,'ready',JSON.stringify(row.roundTrip));
  assert.equal(restored.revision,initialRevision+2);
  assert.deepEqual(restored.opened.changed,ids);
  assert.deepEqual(restored.characters,openStudioProject(original).characters());
  assert.deepEqual(restored.cast.actors.map(actor => actor.id),ids);
  assert.deepEqual(restored.cast.actors.map(actor => actor.palette),Array(8).fill('studio'));
  assert.equal(toolbar.disabled,true,JSON.stringify(toolbar));
  assert.match(toolbar.label,/^Presenting project/);
  assert.deepEqual(restored.errors,[]);
  await finish(page);
  row.checks.push('All eight actors return to the original palette; the toolbar cannot cancel a published project');
}

const software = ['--enable-unsafe-webgpu','--enable-features=Vulkan','--use-webgpu-adapter=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'];
const report = {scope:'Outfit Studio: opening an exported project in the browser',status:'INCOMPLETE',environment:{platform:os.platform(),release:os.release(),
  cpu:os.cpus()[0].model,node:process.version,playwright:playwrightVersion,browser:undefined,
  renderer:renderer === 'software' ? 'bundled Chromium, software rendering' : 'installed Edge, default launch',headless:true},backends:[]};
let server, browser;
try {
  server = await createStudioServer();
  server.listen(0,'127.0.0.1');
  await once(server,'listening');
  const origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch(renderer === 'software' ? {args:software} : {channel:'msedge',headless:true});
  report.environment.browser = browser.version();
  const system = await browser.newBrowserCDPSession();
  try {
    const {gpu} = await system.send('SystemInfo.getInfo');
    report.environment.graphics = {devices:gpu.devices,renderer:gpu.auxAttributes?.glRenderer};
  } finally { await system.detach(); }
  for (const backend of ['webgpu','webgl2']) {
    const row = {backend,status:'INCOMPLETE',checks:[],pageErrors:[]};
    report.backends.push(row);
    let context;
    try {
      for (const [query,scenario,setup] of [[`backend=${backend}`,compact],[`profile=x-d60&backend=${backend}&load=static`,fixed],[`profile=x-d60&backend=${backend}&load=static`,fixedRoundTrip,delayPresentation]]) {
        const session = await start(browser,origin,query,row,setup);
        context = session.context;
        await scenario(session.page,backend,row);
        await context.close();
        context = undefined;
      }
      assert.deepEqual(row.pageErrors,[]);
      row.status = 'PASS';
    } catch (error) {
      row.status = 'FAIL';
      row.error = error.stack;
      const page = context?.pages()[0];
      if (page) {
        row.stoppedState = await inspect(page).catch(() => undefined);
        await page.screenshot({path:path.join(output,`${backend}-stopped.png`),timeout:4000}).catch(() => {});
      }
    } finally { await context?.close(); }
  }
  report.status = report.backends.every(row => row.status === 'PASS') ? 'PASS' : 'FAIL';
} catch (error) {
  report.error = error.stack;
  report.status = 'FAIL';
} finally {
  await browser?.close();
  if (server?.listening) await new Promise(resolve => server.close(resolve));
  await fs.writeFile(path.join(output,'result.json'), JSON.stringify(report,null,2) + '\n', {flag:'wx'});
}
console.log(JSON.stringify({status:report.status,browser:report.environment.browser,renderer:report.environment.renderer,
  backends:report.backends.map(row => ({backend:row.backend,status:row.status,checks:row.checks.length,error:row.error?.split('\n').slice(0,3).join(' | ')})),error:report.error?.split('\n')[0]}));
if (report.status !== 'PASS') process.exitCode = 1;
