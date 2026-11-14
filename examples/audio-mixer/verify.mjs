// SPDX-License-Identifier: Apache-2.0
// Checks the example in a real browser with the browser's own mouse, touch and keyboard input.
//
//   node examples/audio-mixer/verify.mjs <absolute Playwright index.mjs> <new absolute output directory> [software]
//
// Without the third argument the installed Edge is launched headed. With `software` the browser that
// Playwright bundles runs headless. The report names which one ran.
// Input is injected through the browser's automation protocol; no person pressed a key. What is
// heard is read from the samples the browser renders: nothing listened to a loudspeaker. A case the
// browser cannot be brought into is reported as NOT RUN with the reason, not as passed.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url)), [playwrightPath, out, renderer] = process.argv.slice(2);
if (!playwrightPath || !out || !path.isAbsolute(playwrightPath) || !path.isAbsolute(out) || fs.existsSync(out) || ![undefined, 'software'].includes(renderer))
  throw new Error('Usage: node examples/audio-mixer/verify.mjs <absolute Playwright index.mjs> <new absolute output directory> [software]');
fs.mkdirSync(out, { recursive: true });
const { chromium, devices } = await import(pathToFileURL(playwrightPath).href);
const types = { '.html': 'text/html', '.mjs': 'text/javascript', '.js': 'text/javascript', '.json': 'application/json', '.md': 'text/markdown' };
const server = http.createServer((request, response) => {
  const file = path.join(root, decodeURIComponent(new URL(request.url, 'http://localhost').pathname));
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { response.writeHead(404, { connection: 'close' }); response.end(); return; }
  response.writeHead(200, { 'content-type': types[path.extname(file)] ?? 'application/octet-stream', connection: 'close' }); response.end(fs.readFileSync(file));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const report = { profile: 'audio-mixer-example/1', node: process.version, input: 'injected through the automation protocol',
  renderer: renderer === 'software' ? 'bundled Chromium, headless' : 'installed Edge, headed, default launch', cases: [] };
// A page may not sound before it is touched: the policy of an ordinary browser, asked for by name.
const policy = '--autoplay-policy=document-user-activation-required';
const browser = await chromium.launch(renderer === 'software' ? { args: [policy] } : { channel: 'msedge', headless: false, args: [policy] });
report.browser = browser.version();

const address = () => 'http://127.0.0.1:' + server.address().port + '/examples/audio-mixer/index.html';
const read = page => page.evaluate(() => globalThis.__egretAudioExample.readSnapshot());
const wait = (page, milliseconds) => page.waitForTimeout(milliseconds);
/** Waits for something the page says about itself, and returns what it says then. */
async function until(page, test, label) {
  for (let turn = 0; turn < 100; turn++) { const now = await read(page); if (test(now)) return now; await wait(page, 50); }
  throw new Error('never happened: ' + label + ' — ' + JSON.stringify(await read(page)));
}
const NOT_RUN = Symbol('not run');
async function scenario(name, context, body, start = true, query = '') {
  const owned = await browser.newContext(context), page = await owned.newPage(), row = { name, status: 'INCOMPLETE', errors: [] };
  report.cases.push(row);
  page.on('pageerror', error => row.errors.push(String(error))); page.on('console', message => { if (message.type() === 'error') row.errors.push(message.text()); });
  try {
    await page.goto(address() + query);
    // The page is given time to start by a clock outside it: asking it anything counts as a touch to this browser.
    await new Promise(resolve => setTimeout(resolve, 1500));
    if (start) { await page.mouse.click(5, 5); await until(page, now => now.state === 'running', 'the page sounds'); }
    const outcome = await body(page, owned);
    const last = await read(page);
    assert.equal(last.failure, undefined); assert.deepEqual(row.errors, []);
    await page.screenshot({ path: path.join(out, name.replace(/\W+/g, '-') + '.png') });
    if (outcome?.[NOT_RUN] !== undefined) { row.status = 'NOT RUN'; row.reason = outcome[NOT_RUN]; } else row.status = 'PASS';
  } catch (error) { row.status = 'FAIL'; row.failure = String(error.stack ?? error); process.exitCode = 1; }
  await owned.close();
}
const desktop = { viewport: { width: 1000, height: 1000 } };
const near = (actual, expected, tolerance, label) => assert.ok(Math.abs(actual - expected) <= tolerance, label + ': ' + actual + ' is not within ' + tolerance + ' of ' + expected);
const LOCKED = '还没有声音：点一下或按任意键 / No sound yet: press anywhere, or any key', SOUNDING = '正在发声 / Sounding';

await scenario('a page that has not been touched is locked, and the first press starts the music that waited', desktop, async page => {
  // Nothing has asked the page anything yet. The first thing it is given is a press.
  await page.mouse.click(5, 5);
  const now = await until(page, state => state.state === 'running' && state.level > 0.01, 'the music is heard');
  // What the page saw, in its own order: it started locked, was pressed, and only then ran.
  assert.deepEqual(now.history, ['locked', 'input', 'running']);
  assert.deepEqual([now.output, now.music, now.voices, now.started, now.status], ['running', 'gate', 1, 1, SOUNDING]);
  // The music was asked for while the page was locked and is heard from its start: its place is the time the output has run.
  near(now.position, now.time % 3, 0.25, 'the place of the music');
  const later = await until(page, state => state.time > now.time + 0.5, 'the clock of the output moves');
  assert.ok(later.level > 0.01);
}, false);

await scenario('a key unlocks the page as a press does', desktop, async page => {
  await page.keyboard.press('Tab');
  const now = await until(page, state => state.state === 'running', 'the page sounds');
  assert.deepEqual(now.history, ['locked', 'input', 'running']);
}, false);

await scenario('effects sound over the music, and a sound asked for again and again keeps to two voices', desktop, async page => {
  const before = await read(page);
  await page.click('#bell-left'); await page.click('#bell-right');
  let now = await read(page);
  assert.deepEqual([now.voices, now.buses.map(bus => bus.voices), now.started - before.started], [3, [1, 2], 2]);
  // Each bell ends by itself, and the page hears of it.
  now = await until(page, state => state.voices === 1, 'the bells have rung out');
  assert.deepEqual(now.dropped, { silent: 0, limit: 0, stolen: 0 });
  for (let press = 0; press < 5; press++) await page.click('#tick');
  now = await read(page);
  assert.deepEqual([now.voices, now.dropped.stolen, now.started - before.started], [3, 3, 7]);
  await until(page, state => state.voices === 1, 'the ticks have ended');
});

await scenario('a volume and a mute are heard', desktop, async page => {
  await until(page, state => state.level > 0.01, 'the music is heard');
  const quiet = async label => until(page, state => state.level < 0.0005, label), loud = async label => until(page, state => state.level > 0.01, label);
  await page.locator('#volume-music').fill('0'); let now = await quiet('the music at nothing');
  assert.deepEqual([now.buses[0].volume, now.voices], [0, 1]);
  // The effects have their own volume: a bell is heard while the music is not.
  await page.click('#bell'); await loud('a bell over silent music'); await until(page, state => state.voices === 1, 'the bell has rung out'); await quiet('the bell is over');
  await page.locator('#volume-music').fill('100'); now = await loud('the music at full');
  assert.equal(now.buses[0].volume, 1);
  await page.locator('#mute-master').check(); now = await quiet('everything muted');
  assert.deepEqual([now.master.muted, now.master.volume, now.state], [true, 1, 'running']);
  await page.locator('#mute-master').uncheck(); await loud('heard again');
  // The keyboard moves a volume as it moves any slider of the page.
  await page.locator('#volume-master').focus(); await page.keyboard.press('Home'); now = await quiet('the master at nothing');
  assert.equal(now.master.volume, 0);
  await page.keyboard.press('End'); await loud('the master at full');
});

await scenario('the next music takes over across a fade, and the same music asked for again goes on', desktop, async page => {
  await until(page, state => state.level > 0.01, 'the music is heard');
  const first = await read(page);
  await page.click('#music-a');
  let now = await read(page);
  assert.deepEqual([now.music, now.voices, now.started], ['gate', 1, first.started]);
  await page.click('#music-b');
  now = await read(page);
  // Both are there while one rises and the other falls.
  assert.deepEqual([now.music, now.voices, now.started], ['drill', 2, first.started + 1]);
  now = await until(page, state => state.voices === 1, 'the old music has faded out');
  assert.ok(now.level > 0.01 && now.music === 'drill');
  await page.click('#music-stop');
  now = await read(page);
  assert.deepEqual([now.music, now.voices], [null, 1]);
  now = await until(page, state => state.voices === 0 && state.level < 0.0005, 'the music has faded out');
  await page.click('#music-a'); now = await until(page, state => state.level > 0.01, 'music again');
  assert.equal(now.music, 'gate');
});

await scenario('long music is played as it is read: it takes over across a fade, says where it is, and stops by the clock of the output', desktop, async page => {
  await until(page, state => state.level > 0.01, 'the music is heard');
  const before = await read(page);
  // Twelve seconds that hold no place among the decoded samples.
  assert.deepEqual(before.streamed.slice(0, 2), [true, 0]); near(before.streamed[2], 12, 0.01, 'the length of the stream');
  await page.click('#music-c');
  let now = await read(page);
  assert.deepEqual([now.music, now.voices, now.decodedBytes], ['scroll', 2, before.decodedBytes]);
  now = await until(page, state => state.voices === 1 && state.level > 0.01, 'the stream is heard alone');
  const later = await until(page, state => state.position > now.position + 0.3, 'the place in the stream moves');
  // Asked for again, it goes on.
  await page.click('#music-c'); assert.ok((await read(page)).position >= later.position);
  // Held, it is silent and stays where it is; let go, it goes on from there.
  await page.click('#music-hold');
  const held = await until(page, state => state.level < 0.0005, 'the held music is silent');
  assert.deepEqual([held.musicState, held.voices, await page.getAttribute('#music-hold', 'aria-pressed')], ['paused', 1, 'true']);
  await wait(page, 400); assert.equal((await read(page)).position, held.position);
  await page.click('#music-hold');
  now = await until(page, state => state.level > 0.01 && state.position > held.position + 0.2, 'the music goes on');
  assert.ok(now.position < held.position + 3 && now.musicState === 'playing');
  // A paused game: an output that sleeps does not stop a media element by itself, so its place is what shows that it was stopped.
  await page.click('#pause');
  await until(page, state => state.output === 'suspended', 'the output sleeps');
  const asleep = await read(page);
  await wait(page, 500);
  assert.equal((await read(page)).position, asleep.position);
  await page.click('#pause');
  await until(page, state => state.output === 'running' && state.level > 0.01 && state.position > asleep.position + 0.2, 'the stream goes on with the game');
  // Decoded music takes over from it across a fade, and the stream ends when the fade does.
  await page.click('#music-a');
  now = await read(page);
  assert.deepEqual([now.music, now.voices], ['gate', 2]);
  await until(page, state => state.voices === 1 && state.level > 0.01, 'the stream has faded out');
  // Stopped over a fade by itself.
  await page.click('#music-c'); await until(page, state => state.voices === 1 && state.music === 'scroll', 'the stream is the music again');
  await page.click('#music-stop');
  now = await read(page);
  assert.deepEqual([now.music, now.voices], [null, 1]);
  await until(page, state => state.voices === 0 && state.level < 0.0005, 'the stream has faded out and ended');
});

await scenario('music played as it is read waits for the first press too', desktop, async page => {
  await page.mouse.click(5, 5);
  const now = await until(page, state => state.state === 'running' && state.level > 0.01, 'the stream is heard');
  assert.deepEqual([now.history, now.music, now.voices], [['locked', 'input', 'running'], 'scroll', 1]);
  // It did not run while the page was locked: it is near its start.
  assert.ok(now.position > 0 && now.position < 2.5, 'the place of the stream: ' + now.position);
  await until(page, state => state.position > now.position + 0.3, 'the place in the stream moves');
}, false, '?music=scroll');

await scenario('a paused game is silent and the clock of its sound stands still', desktop, async page => {
  await until(page, state => state.level > 0.01, 'the music is heard');
  await page.click('#pause');
  let now = await until(page, state => state.output === 'suspended', 'the output sleeps');
  assert.deepEqual([now.state, now.suspendedBy, await page.getAttribute('#pause', 'aria-pressed'), now.status], ['suspended', ['game'], 'true', '已静音 / Silent (game)']);
  // An effect asked for now is dropped: it would otherwise be heard late, when the game goes on.
  await page.click('#bell');
  const held = await read(page);
  assert.deepEqual([held.dropped.silent, held.voices], [1, 1]);
  await wait(page, 400);
  const still = await read(page);
  assert.deepEqual([still.time, still.position], [held.time, held.position]);
  await page.click('#pause');
  now = await until(page, state => state.output === 'running' && state.time > still.time + 0.2 && state.level > 0.01, 'the output runs again');
  assert.deepEqual([now.state, now.suspendedBy, now.history.filter(entry => entry !== 'input')], ['running', [], ['locked', 'running', 'suspended', 'running']]);
});

await scenario('a hidden page is silent and a shown one sounds again', desktop, async (page, owned) => {
  await until(page, state => state.level > 0.01, 'the music is heard');
  // The window is taken off the screen the way a person does it. A browser without a window keeps its page visible.
  const session = await owned.newCDPSession(page), { windowId } = await session.send('Browser.getWindowForTarget');
  await session.send('Browser.setWindowBounds', { windowId, bounds: { windowState: 'minimized' } });
  await wait(page, 800);
  let now = await read(page);
  if (now.visibility !== 'hidden') return { [NOT_RUN]: 'this browser keeps the page visible when its window is minimized' };
  now = await until(page, state => state.output === 'suspended', 'the output sleeps');
  assert.deepEqual([now.state, now.suspendedBy], ['suspended', ['hidden']]);
  await session.send('Browser.setWindowBounds', { windowId, bounds: { windowState: 'normal' } });
  now = await until(page, state => state.output === 'running' && state.level > 0.01, 'the output runs again');
  assert.deepEqual([now.state, now.suspendedBy, now.visibility], ['running', [], 'visible']);
});

await scenario('the volumes chosen are there on the next visit', desktop, async page => {
  await page.locator('#volume-music').fill('35'); await page.locator('#volume-effects').fill('80'); await page.locator('#mute-effects').check();
  await page.reload(); await new Promise(resolve => setTimeout(resolve, 1500));
  await page.mouse.click(5, 5);
  const now = await until(page, state => state.state === 'running', 'the page sounds');
  assert.deepEqual([now.master, now.buses], [{ name: 'master', volume: 1, muted: false, voices: 1 }, [{ name: 'music', volume: 0.35, muted: false, voices: 1 }, { name: 'effects', volume: 0.8, muted: true, voices: 0 }]]);
  assert.deepEqual([await page.inputValue('#volume-music'), await page.inputValue('#volume-effects'), await page.isChecked('#mute-effects'), await page.isChecked('#mute-music')], ['35', '80', true, false]);
});

await scenario('on a phone a finger unlocks the page and plays', { ...devices['Pixel 7'] }, async page => {
  await page.touchscreen.tap(20, 20);
  let now = await until(page, state => state.state === 'running' && state.level > 0.01, 'the music is heard');
  assert.deepEqual(now.history, ['locked', 'input', 'running']);
  await page.tap('#bell'); now = await read(page);
  assert.equal(now.voices, 2);
  await page.tap('#music-b'); now = await until(page, state => state.voices === 1 && state.music === 'drill', 'the next music has taken over');
}, false);

await scenario('what the browser renders is what was asked for, sample by sample', desktop, async page => {
  const m = await page.evaluate(async () => (await import('./render-check.mjs')).measure());
  fs.writeFileSync(path.join(out, 'rendered.json'), JSON.stringify(m, null, 2) + '\n');
  // 0.8 through three halves, the same on both sides.
  for (const value of m.chain) near(value, 0.1, 0.002, 'a tone through a voice, a bus and the master');
  // A balance: one side falls in a straight line, the other stays, and the middle is the sound as it is.
  for (const [pan, sides] of [['-1', [0.5, 0]], ['-0.5', [0.5, 0.25]], ['0', [0.5, 0.5]], ['0.5', [0.25, 0.5]], ['1', [0, 0.5]]]) sides.forEach((side, index) => near(m.pan[pan][index], side, 0.003, 'pan ' + pan + ' side ' + index));
  [[0.5, 0.5], [0, 0.5], [0.5, 0.5]].forEach((sides, step) => sides.forEach((side, index) => near(m.moved[step][index], side, 0.003, 'a voice moved, step ' + step + ' side ' + index)));
  // A fade in is a straight line from nothing over 0.4 seconds.
  [0.125, 0.25, 0.375, 0.5].forEach((value, index) => near(m.fadeIn[index], value, 0.01, 'fade in, measure ' + index));
  // A fade out over 0.2 seconds from 0.2: full before, half way at 0.3, nothing after 0.4, and the voice is over.
  near(m.fadeOut.heard[0], 0.5, 0.003, 'before the fade out'); near(m.fadeOut.heard[1], 0.25, 0.01, 'half way out'); assert.equal(m.fadeOut.heard[2], 0);
  assert.deepEqual(m.fadeOut.after, ['ended', 'stopped']);
  // A loop goes on; the same sound once is over after its tenth of a second, and says so.
  near(m.loop.looped, 0.5, 0.01, 'a loop after three rounds'); near(m.loop.once[0], 0.5, 0.01, 'the sound once'); assert.equal(m.loop.once[1], 0);
  assert.deepEqual(m.loop.after.slice(0, 3), ['ended', 'finished', 'playing']); near(m.loop.after[3], 0, 0.005, 'the place of a loop after five rounds');
  // The rate is the pitch.
  near(m.rate[0], 1000, 10, 'twice as fast'); near(m.rate[1], 250, 10, 'half as fast');
  assert.equal(m.offset[0], 0); near(m.offset[1], 0.5, 0.01, 'started a fifth of a second in');
  // Music: 0.8 at a bus of a half. The first falls as the second rises, and at the middle of the fade both are half way.
  [[0.4, 0], [0.2, 0.2], [0, 0.4]].forEach(([first, second], index) => { near(m.music.first[index], first, 0.012, 'the first music, measure ' + index); near(m.music.second[index], second, 0.012, 'the second music, measure ' + index); });
  assert.deepEqual([m.music.after.seen.slice(0, 2), m.music.after.before, m.music.after.next, m.music.after.music, m.music.after.voices], [['stopping', 2], ['ended', 'stopped'], 'playing', true, 1]);
  near(m.music.after.seen[2], 0, 0.005, 'the place of the first music when the second started');
  // A bus: heard, muted, heard again, half way down a fade, at a half.
  [0.5, 0, 0.5, 0.375, 0.25].forEach((value, index) => near(m.bus[index], value, 0.01, 'a bus, measure ' + index));
  // A pause: heard, silent, heard again from the same place, and over a fifth of a second later than it would have been.
  near(m.pause.heard[0], 0.5, 0.003, 'before the pause'); assert.equal(m.pause.heard[1], 0); near(m.pause.heard[2], 0.5, 0.003, 'after the pause'); assert.equal(m.pause.heard[3], 0);
  assert.equal(m.pause.after[0], 'paused'); near(m.pause.after[1], 0.2, 0.005, 'the place it paused at'); near(m.pause.after[2], 0.2, 0.005, 'the place it kept');
  assert.deepEqual(m.pause.after.slice(3), ['ended', 'finished']);
});

fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(report.cases.map(row => (row.status === 'PASS' ? 'ok    ' : row.status === 'NOT RUN' ? 'skip  ' : 'FAIL  ') + row.name + (row.reason ? '\n      ' + row.reason : '') + (row.failure ? '\n' + row.failure : '')).join('\n'));
await browser.close(); server.close();
process.exit(process.exitCode ?? 0);
