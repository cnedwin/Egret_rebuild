// SPDX-License-Identifier: Apache-2.0
// Runs the example through `egret verify --screens` and tools/verify-screens.mjs, in headless Chromium, and checks what
// the report says: plain, the pause button reaches under the notch of the phones that have one, the help button is
// smaller than a finger on a phone but not on a desktop, and Jump and Fire cover each other; with ?fixed=1, nothing on
// any screen. It also checks that the engine took the stand-in insets for the safe part and that the pictures show
// what they cover in red.
//
//   node examples/screen-check/verify.mjs <absolute Playwright index.mjs> <new output folder>
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadPng } from '../../tools/verify-game.mjs';
import { SCREENS, verifyScreens } from '../../tools/verify-screens.mjs';

const [playwright, output] = process.argv.slice(2);
if (!playwright || !output || !path.isAbsolute(playwright))
  throw new Error('Usage: node examples/screen-check/verify.mjs <absolute Playwright index.mjs> <new output folder>');
const here = path.dirname(fileURLToPath(import.meta.url));
const tools = path.join(here, '..', '..', 'tools');
fs.mkdirSync(output, { recursive: true });
const { PNG } = loadPng();

/**
 * The status and report of one run: plain through the command, or with a query (?fixed=1) through the tool, on every
 * screen or on those listed.
 */
function run(name, query, screens, play, prepare) {
  let page = path.join(here, 'index.html');
  if (query) {
    page = path.join(here, name + '.tmp.html');
    fs.writeFileSync(
      page,
      fs.readFileSync(path.join(here, 'index.html'), 'utf8').replace('./main.mjs', './main.mjs?' + query)
    );
  }
  try {
    const out = path.join(output, name);
    const args =
      query && !play && !prepare
        ? [path.join(tools, 'verify-screens.mjs'), playwright, page, out, ...(screens ? [screens] : [])]
        : [
            path.join(tools, 'egret.mjs'),
            'verify',
            page,
            screens ? '--screens=' + screens : '--screens',
            '--playwright',
            playwright,
            '--out',
            out,
            ...(prepare ? ['--prepare', prepare] : []),
            ...(play ? ['--play', play] : [])
          ];
    const result = spawnSync(process.execPath, args, { encoding: 'utf8' });
    if (!fs.existsSync(path.join(out, 'report.json'))) throw new Error(result.stdout + result.stderr);
    return {
      status: result.status,
      stdout: result.stdout,
      report: JSON.parse(fs.readFileSync(path.join(out, 'report.json'), 'utf8'))
    };
  } finally {
    if (query) fs.rmSync(page, { force: true });
  }
}

const checks = (screen, check) => screen.findings.filter(finding => finding.check === check);
const byName = report => Object.fromEntries(report.screens.map(screen => [screen.name, screen]));

const plain = run('plain');
assert.equal(plain.status, 1, plain.stdout);
assert.deepEqual(
  plain.report.screens.map(screen => screen.name),
  Object.keys(SCREENS),
  'every screen, in order'
);
const screens = byName(plain.report);
for (const screen of plain.report.screens) {
  assert.equal(screen.controls, 4, `${screen.name}: the four buttons are told`);
  assert.equal(screen.shown, 1, `${screen.name}: expand fills the window`);
  assert.deepEqual(checks(screen, 'noErrors'), [], `${screen.name}: no errors`);
  assert.deepEqual(checks(screen, 'noScroll'), [], `${screen.name}: the page does not scroll`);
  assert.deepEqual(checks(screen, 'drawn'), [], `${screen.name}: the game drew`);
  assert.deepEqual(
    checks(screen, 'apart').map(finding => finding.controls),
    [['Jump', 'Fire']],
    `${screen.name}: Jump and Fire cover each other`
  );
  // The pause button is pinned to the screen's corner: under the notch exactly where a screen has one at that corner.
  const under = screen.insets.top > 0 || screen.insets.right > 0;
  assert.deepEqual(
    checks(screen, 'inSafeArea').map(finding => finding.control),
    under ? ['Pause'] : [],
    `${screen.name}: the pause button and the notch`
  );
  assert.equal(screen.pass, !under, `${screen.name}: a control under the notch fails the screen`);
  // The help button is 24 units square; expand shows a unit at the smaller of the two ratios of window to design.
  const unit = Math.min(screen.size[0] / 480, screen.size[1] / 270),
    small = checks(screen, 'touchTarget').map(finding => finding.control);
  if (screen.name === 'desktop') assert.deepEqual(small, [], 'a mouse needs no finger-sized target');
  else
    assert.equal(small.includes('?'), 24 * unit < 43.5, `${screen.name}: the help button at ${24 * unit} CSS pixels`);
  // The safe part is the window less the stand-in insets: the engine took them. The stage is a whole number of units,
  // so the canvas may fall short of the window by a pixel or so.
  const { insets, size, safe } = screen;
  const wanted = [insets.left, insets.top, size[0] - insets.left - insets.right, size[1] - insets.top - insets.bottom];
  assert.ok(
    [safe.x, safe.y, safe.width, safe.height].every((value, i) => Math.abs(value - wanted[i]) <= 2),
    `${screen.name}: the safe part ${JSON.stringify(safe)} is the window less the insets ${wanted}`
  );
  assert.ok(fs.existsSync(screen.picture), `${screen.name}: a picture`);
}
assert.match(plain.stdout, /FAIL phone-notch .*inSafeArea Pause/);
assert.match(plain.stdout, /red bands of the pictures are what a notch or a home bar covers/);

// The picture of the phone with a notch is red where the notch is and not below it.
const notch = PNG.sync.read(fs.readFileSync(screens['phone-notch'].picture));
const at = (x, y) => {
  const i = (y * notch.width + x) * 4;
  return [notch.data[i], notch.data[i + 1], notch.data[i + 2]];
};
const scale = SCREENS['phone-notch'].scale;
const [red, green] = at(notch.width >> 1, 20 * scale);
assert.ok(red > green + 80, `the notch is tinted red: ${at(notch.width >> 1, 20 * scale)}`);
const [red2, green2] = at(notch.width >> 1, 400 * scale);
assert.ok(red2 < green2 + 40, `the middle is not tinted: ${at(notch.width >> 1, 400 * scale)}`);

const fixed = run('fixed', 'fixed=1');
assert.equal(fixed.status, 0, fixed.stdout);
for (const screen of fixed.report.screens) {
  assert.equal(screen.controls, 4, `${screen.name}: the four buttons are told`);
  assert.deepEqual(screen.findings, [], `${screen.name}: nothing to find once fixed`);
  assert.deepEqual(screen.engineWarnings, [], `${screen.name}: no engine warnings`);
}

// With a question open, its backdrop covers the whole canvas, the notch included: it is no control, and the buttons
// under it cannot be tapped while it shows. Only the question's own two buttons are told, by their part names.
const asked = run('asked', 'fixed=1&ask=1', 'phone-notch,phone-small,desktop');
assert.equal(asked.status, 0, asked.stdout);
for (const screen of asked.report.screens) {
  assert.equal(screen.controls, 2, `${screen.name}: the question's two buttons`);
  assert.deepEqual(checks(screen, 'inSafeArea'), [], `${screen.name}: the backdrop is no control`);
  assert.deepEqual(checks(screen, 'apart'), [], `${screen.name}: the buttons under the backdrop are left out`);
  for (const finding of checks(screen, 'touchTarget'))
    assert.ok(['no', 'yes'].includes(finding.control), `${screen.name}: named by its part: ${finding.control}`);
}

// A route really taps the Pause control and the modal's Stay action, exporting no fixed stage for these screens.
// Three checkpoints cover title, open question and return. Each has its own observation, even when the final
// question is gone, and pictures cannot overwrite the same checkpoint or picture name on another device.
const route = path.join(here, 'play.mjs');
const scripted = run('scripted', 'fixed=1', undefined, route);
assert.equal(scripted.status, 0, scripted.stdout);
const pictures = new Set();
assert.deepEqual(
  scripted.report.screens.map(screen => screen.name),
  Object.keys(SCREENS),
  'the route covers every profile'
);
for (const screen of scripted.report.screens) {
  assert.equal(screen.played.pass, true, screen.name);
  assert.deepEqual(screen.played.checkpoints, ['table', 'question', 'back']);
  assert.deepEqual(
    screen.checkpoints.map(one => [one.name, one.controls]),
    [
      ['table', 4],
      ['question', 2],
      ['back', 4]
    ]
  );
  assert.equal(screen.controls, 4);
  assert.equal(screen.pass, true);
  assert.equal(screen.played.pictures.length, 1);
  for (const one of [...screen.checkpoints, screen]) {
    assert.equal(one.pass, true, screen.name + ': ' + one.name);
    assert.equal(one.controlReceipt.fresh, true, 'the game sent a new control report for this state');
    assert.ok(one.controlReceipt.after > one.controlReceipt.before, 'a control receipt, not a wall-time guess');
    assert.ok(fs.existsSync(one.picture), one.picture);
    assert.ok(!pictures.has(one.picture), 'each picture belongs to just one checkpoint or screen');
    pictures.add(one.picture);
  }
  const raw = screen.played.pictures[0];
  assert.ok(fs.existsSync(raw));
  assert.ok(!pictures.has(raw), 'script pictures on separate screens cannot overwrite one another');
  pictures.add(raw);
}
const modalPicture = PNG.sync.read(fs.readFileSync(byName(scripted.report)['phone-notch'].checkpoints[1].picture));
const modalTop = 4 * (20 * scale * modalPicture.width + (modalPicture.width >> 1));
assert.ok(modalPicture.data[modalTop] > modalPicture.data[modalTop + 1] + 80, 'checkpoint pictures tint the notch');

// Even with the question open and the controls now safely inset, a failing earlier checkpoint cannot be hidden.
// An assigned script failure on the second screen must not stop the third screen from running.
const failingPlay = path.resolve(output, 'failure-route.mjs');
fs.writeFileSync(
  failingPlay,
  `import { openQuestion } from ${JSON.stringify(pathToFileURL(route).href)};
export default async function (player) {
  await openQuestion(player);
  if (player.page.viewportSize().width === 360) throw Object.assign(new Error('assigned stop'), {
    code: 'FIXTURE_STOP', details: { stage: 'question' }
  });
}\n`
);
const failure = run('failure', 'plain=1', 'phone-notch,phone-tall,desktop', failingPlay);
assert.equal(failure.status, 1);
const failed = byName(failure.report);
assert.equal(failed['phone-notch'].played.pass, true);
assert.equal(failed['phone-notch'].checkpoints[0].pass, false);
assert.equal(failed['phone-notch'].checkpoints[1].pass, true);
assert.deepEqual(checks(failed['phone-notch'], 'inSafeArea'), []);
assert.equal(failed['phone-notch'].pass, false, 'the earlier checkpoint still fails the screen');
assert.equal(failed['phone-tall'].played.pass, false);
assert.equal(failed['phone-tall'].played.diagnostic.code, 'FIXTURE_STOP');
assert.deepEqual(failed['phone-tall'].played.diagnostic.details, { stage: 'question' });
assert.equal(failed.desktop.played.pass, true, 'later screen was still played');
assert.equal(failed.desktop.pass, true);

// Labels are report data, not paths; even a traversal-looking label cannot leave the profile directory.
// Never overwrite a checkpoint or a raw picture, including case-colliding picture filenames on Windows.
const badNames = path.resolve(output, 'name-route.mjs');
fs.writeFileSync(
  badNames,
  `export default async function (player) {
  await player.checkpoint('../報告/界面');
  const width = player.page.viewportSize().width;
  if (width === 393) await player.checkpoint(' ../報告/界面 ');
  if (width === 360) await player.checkpoint(' ');
  if (width === 375) {
    await player.picture('Table');
    await player.picture('table');
  }
  if (width === 1024) await player.page.setViewportSize({ width: 1000, height: 700 });
  if (width === 884) await player.page.goto('about:blank');
}\n`
);
const names = run(
    'name-checks',
    'fixed=1',
    'phone-notch,phone-tall,phone-small,tablet-wide,foldable,desktop',
    badNames
  ),
  nameChecks = byName(names.report);
assert.equal(names.status, 1);
assert.match(nameChecks['phone-notch'].played.diagnostic.message, /Repeated checkpoint name/);
assert.match(nameChecks['phone-tall'].played.diagnostic.message, /non-empty name/);
assert.match(nameChecks['phone-small'].played.diagnostic.message, /Repeated play picture name/);
assert.deepEqual(checks(nameChecks['tablet-wide'], 'viewport'), [
  {
    check: 'viewport',
    severity: 'error',
    expected: [1024, 768],
    actual: [1000, 700]
  }
]);
assert.equal(nameChecks['tablet-wide'].pass, false);
assert.deepEqual(checks(nameChecks.foldable, 'controlsFresh'), [
  {
    check: 'controlsFresh',
    severity: 'error',
    previous: 0,
    received: 0
  }
]);
assert.equal(nameChecks.foldable.controlReceipt.fresh, false);
assert.equal(nameChecks.foldable.controls, null);
assert.equal(nameChecks.foldable.pass, false);
assert.equal(nameChecks.desktop.pass, true);
for (const screen of names.report.screens) {
  assert.deepEqual(screen.played.checkpoints, ['../報告/界面']);
  assert.equal(screen.checkpoints.length, 1);
  assert.equal(screen.checkpoints[0].name, '../報告/界面');
  assert.equal(
    path.dirname(screen.checkpoints[0].picture),
    path.join(path.resolve(output), 'name-checks', screen.name)
  );
  assert.equal(path.basename(screen.checkpoints[0].picture), 'checkpoint-1.png');
}

// Open a different scene from the same ordinary, even intentionally faulty page, using a trusted local script.
const preparedOut = path.join(output, 'prepared');
const preparedRun = spawnSync(
  process.execPath,
  [
    path.join(tools, 'egret.mjs'),
    'verify',
    path.join(here, 'index.html'),
    '--screens=phone-notch,desktop',
    '--prepare',
    path.join(here, 'prepare.mjs'),
    '--playwright',
    playwright,
    '--out',
    preparedOut
  ],
  { encoding: 'utf8' }
);
assert.equal(preparedRun.status, 0, preparedRun.stdout + preparedRun.stderr);
const preparedReport = JSON.parse(fs.readFileSync(path.join(preparedOut, 'report.json'), 'utf8'));
assert.equal(preparedReport.screens.length, 2);
for (const screen of preparedReport.screens) {
  assert.deepEqual(screen.prepared, { pass: true, scene: 'confirmation' });
  assert.equal(screen.controls, 2);
  assert.deepEqual(checks(screen, 'inSafeArea'), []);
  assert.deepEqual(checks(screen, 'apart'), []);
}

// Real browser negative cases: a rejected script, a script exceeding its
// asynchronous deadline, and a drawn canvas that reports no native controls.
const { chromium } = await import(pathToFileURL(playwright).href);
async function preparedCase(name, file, prepare, prepareTimeout = 1000) {
  const out = path.join(output, name);
  fs.mkdirSync(out);
  const report = await verifyScreens({
    chromium,
    PNG,
    file,
    out,
    names: ['phone-small'],
    prepare,
    prepareTimeout,
    settle: 300
  });
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  assert.equal(report.pass, false);
  return report.screens[0];
}
const rejected = await preparedCase('prepare-rejected', path.join(here, 'index.html'), async () => {
  throw new Error('scene unreachable');
});
assert.equal(rejected.prepared.pass, false);
assert.match(rejected.prepared.error, /scene unreachable/);
assert.deepEqual(
  checks(rejected, 'prepare').map(finding => finding.severity),
  ['error']
);
const expired = await preparedCase('prepare-expired', path.join(here, 'index.html'), () => new Promise(() => {}), 50);
assert.equal(expired.prepared.pass, false);
assert.match(expired.prepared.error, /exceeded 50 ms/);
assert.deepEqual(
  checks(expired, 'prepare').map(finding => finding.severity),
  ['error']
);
const noControlsPage = path.resolve(output, 'no-controls.html');
fs.writeFileSync(
  noControlsPage,
  '<!doctype html><meta name="viewport" content="width=device-width"><body style="margin:0"><canvas width="375" height="667"></canvas><script>const c=document.querySelector("canvas").getContext("2d");c.fillStyle="#123456";c.fillRect(0,0,375,667);c.fillStyle="#ee9821";c.fillRect(0,0,180,320);c.fillStyle="#893492";c.fillRect(180,320,195,347);</script>'
);
const empty = await preparedCase('prepare-no-controls', noControlsPage, async () => 'drawn but no controls');
assert.deepEqual(empty.prepared, { pass: true, scene: 'drawn but no controls' });
assert.equal(empty.controls, null);
assert.deepEqual(
  checks(empty, 'noControls').map(finding => finding.severity),
  ['error']
);

// If preparation closes one page, that screen is not accepted, but the next remains independently checked.
const closedOut = path.join(output, 'prepare-closed-page');
fs.mkdirSync(closedOut);
const closed = await verifyScreens({
  chromium,
  PNG,
  file: path.join(here, 'index.html'),
  out: closedOut,
  names: ['phone-small', 'desktop'],
  prepare: async (player, screen) => {
    if (screen.name === 'phone-small') {
      await player.page.close();
      return 'closed-page';
    }
    await player.page.waitForFunction(() => globalThis.__egretScreens?.controls?.length === 4);
    return 'field';
  },
  settle: 1500
});
fs.writeFileSync(path.join(closedOut, 'report.json'), JSON.stringify(closed, null, 2) + '\n');
assert.equal(closed.pass, false);
assert.equal(closed.screens.length, 2);
assert.equal(closed.screens[0].pass, false);
assert.equal(closed.screens[0].picture, null);
assert.deepEqual(
  checks(closed.screens[0], 'capture').map(finding => finding.severity),
  ['error']
);
assert.equal(closed.screens[1].pass, true);
assert.deepEqual(closed.screens[1].prepared, { pass: true, scene: 'field' });
assert.ok(fs.existsSync(closed.screens[1].picture));

// Preparation and a player route can be combined: the ordinary scene is not replayed
// from scratch when the player takes over. Both initial and subsequent controls are checked.
const preparedPlay = path.resolve(output, 'prepared-play.mjs');
fs.writeFileSync(
  preparedPlay,
  `export default async function (player) {
  const stay = await player.read(() => {
    const { controls, screen } = globalThis.__egretScreens;
    const control = controls.find(control => control.name === 'no');
    if (!control) return null;
    return [control.x - screen.canvas.x + control.width / 2, control.y - screen.canvas.y + control.height / 2];
  });
  player.expect(stay !== null, 'the preparation already opened the question');
  await player.checkpoint('prepared');
  await player.tap(...stay);
  await player.page.waitForFunction(() =>
    globalThis.__egretScreens?.controls?.some(control => control.name === 'Pause')
  );
}
`
);
const combined = run(
  'prepare-and-play',
  'fixed=1',
  'phone-notch,desktop',
  preparedPlay,
  path.join(here, 'prepare.mjs')
);
assert.equal(combined.status, 0, combined.stdout);
assert.equal(combined.report.screens.length, 2);
for (const screen of combined.report.screens) {
  assert.deepEqual(screen.prepared, { pass: true, scene: 'confirmation' });
  assert.equal(screen.preparedState.pass, true);
  assert.equal(screen.preparedState.controls, 2);
  assert.ok(fs.existsSync(screen.preparedState.picture));
  assert.equal(screen.played.pass, true);
  assert.deepEqual(screen.played.checkpoints, ['prepared']);
  assert.equal(screen.checkpoints[0].controls, 2);
  assert.equal(screen.checkpoints[0].pass, true);
  assert.equal(screen.controls, 4);
  assert.equal(screen.pass, true);
  assert.equal(new Set([screen.preparedState.picture, screen.checkpoints[0].picture, screen.picture]).size, 3);
}

console.log(
  `screen-check: ${plain.report.screens.length} screens; plain finds the notch, the small target and the overlap; fixed finds nothing; a question's backdrop is no control; a real pointer route reports each checkpoint and keeps failures local; preparation captures a different scene, handles failures, and can be combined with play.`
);
