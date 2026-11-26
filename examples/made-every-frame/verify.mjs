// SPDX-License-Identifier: Apache-2.0
// Runs the example through tools/verify-game.mjs twice, in headless Chromium, and checks what the report says the
// engine warned of: PLAY_MADE_EVERY_FRAME for game.text when update makes the score's text every frame, and nothing when
// the text is made once.
//
//   node examples/made-every-frame/verify.mjs <absolute Playwright index.mjs> <new output folder>
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const [playwright, output] = process.argv.slice(2);
if (!playwright || !output || !path.isAbsolute(playwright))
  throw new Error(
    'Usage: node examples/made-every-frame/verify.mjs <absolute Playwright index.mjs> <new output folder>'
  );
const here = path.dirname(fileURLToPath(import.meta.url));
const tool = path.join(here, '..', '..', 'tools', 'verify-game.mjs');
fs.mkdirSync(output, { recursive: true });

/** The report of one run of the page: plain, or with ?fixed=1 given through a copy of the page. */
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
    const result = spawnSync(process.execPath, [tool, playwright, page, out], { encoding: 'utf8' });
    return { status: result.status, report: JSON.parse(fs.readFileSync(path.join(out, 'report.json'), 'utf8')) };
  } finally {
    if (fixed) fs.rmSync(page, { force: true });
  }
}

const mistake = run('every-frame', false);
const made = mistake.report.engineWarnings.filter(warning => warning.code === 'PLAY_MADE_EVERY_FRAME');
assert.equal(made.length, 1, JSON.stringify(mistake.report.engineWarnings));
assert.match(made[0].message, /^game\.text was called in update in each of the last 60 frames/);
const once = run('made-once', true);
assert.deepEqual(once.report.engineWarnings, [], JSON.stringify(once.report.engineWarnings));
assert.equal(once.report.checks.noErrors.pass, true);
console.log(
  JSON.stringify({ everyFrame: mistake.report.engineWarnings, madeOnce: once.report.engineWarnings }, null, 2)
);
