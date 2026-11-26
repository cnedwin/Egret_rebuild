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
import { fileURLToPath } from 'node:url';
import { loadPng } from '../../tools/verify-game.mjs';
import { SCREENS } from '../../tools/verify-screens.mjs';

const [playwright, output] = process.argv.slice(2);
if (!playwright || !output || !path.isAbsolute(playwright))
  throw new Error('Usage: node examples/screen-check/verify.mjs <absolute Playwright index.mjs> <new output folder>');
const here = path.dirname(fileURLToPath(import.meta.url));
const tools = path.join(here, '..', '..', 'tools');
fs.mkdirSync(output, { recursive: true });
const { PNG } = loadPng();

/** The status and report of one run: plain through the command, or with ?fixed=1 through the tool. */
function run(name, fixed) {
  let page = path.join(here, 'index.html');
  if (fixed) {
    page = path.join(here, 'fixed.tmp.html');
    fs.writeFileSync(
      page,
      fs.readFileSync(path.join(here, 'index.html'), 'utf8').replace('./main.mjs', './main.mjs?fixed=1')
    );
  }
  try {
    const out = path.join(output, name);
    const args = fixed
      ? [path.join(tools, 'verify-screens.mjs'), playwright, page, out]
      : [path.join(tools, 'egret.mjs'), 'verify', page, '--screens', '--playwright', playwright, '--out', out];
    const result = spawnSync(process.execPath, args, { encoding: 'utf8' });
    if (!fs.existsSync(path.join(out, 'report.json'))) throw new Error(result.stdout + result.stderr);
    return {
      status: result.status,
      stdout: result.stdout,
      report: JSON.parse(fs.readFileSync(path.join(out, 'report.json'), 'utf8'))
    };
  } finally {
    if (fixed) fs.rmSync(page, { force: true });
  }
}

const checks = (screen, check) => screen.findings.filter(finding => finding.check === check);
const byName = report => Object.fromEntries(report.screens.map(screen => [screen.name, screen]));

const plain = run('plain', false);
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

const fixed = run('fixed', true);
assert.equal(fixed.status, 0, fixed.stdout);
for (const screen of fixed.report.screens) {
  assert.equal(screen.controls, 4, `${screen.name}: the four buttons are told`);
  assert.deepEqual(screen.findings, [], `${screen.name}: nothing to find once fixed`);
  assert.deepEqual(screen.engineWarnings, [], `${screen.name}: no engine warnings`);
}

console.log(
  `screen-check: ${plain.report.screens.length} screens; plain finds the notch, the small target and the overlap; fixed finds nothing.`
);
