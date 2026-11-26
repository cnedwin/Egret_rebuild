// SPDX-License-Identifier: Apache-2.0
// `egret check` is what an agent runs on a game before running it. Each rule is held to a mistake it must catch and to
// the near miss it must let through, in a game folder written here, and the command to the same answer from a game's
// engine copy. The games of cnedwin/PortedGamesEgret, all of which run, gave no error when this was written.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { GUIDE, ROOT, loadCards } from '../tools/egret-guide.mjs';
import { RULES, checkGame, checkReport, exportsFromReference, importsOf, updateBodies } from '../tools/egret-check.mjs';
import { vendorGame } from '../tools/vendor-game.mjs';

const MAIN = `import { play } from '@egret/engine/play';
import { Sprite, createCanvasHost } from '@egret/engine';
import { play as again } from '@egret/engine';
import { createSaveStor } from '@egret/engine/kit';
import { createWorld } from '@egret/engine/physics';
import engine from '@egret/engine';
import { audio } from '../vendor/engine/dist/web/audio.js';
import { createSharedMaterial2D } from '@egret/contracts';

window.addEventListener('keydown', event => {
  event.stopPropagation();
}, true);

const game = await play({
  width: 320,
  height: 180,
  transparent: true,
  setup(game) {
    game.text('Score', { x: 10, y: 10 });
  },
  update(seconds, game) {
    if (game.pointer.pressed) game.text('Hit', { x: 20, y: 20 });
  }
});
game.canvas.parentElement.style.background = 'transparent';
localStorage.setItem('best', '3');
try {
  localStorage.setItem('best', '4');
} catch {}
const storage = { setItem: (key, value) => localStorage.setItem(key, value) };
`;

const ACCEPT = `localStorage.setItem('seed', '1');
const x = { update(s) { game.text('in a test'); } };
`;

/** A game folder with the files given, under a new temporary directory. */
function game(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'egret-check-'));
  const folder = path.join(root, 'CheckGame');
  for (const [name, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(folder, name)), { recursive: true });
    fs.writeFileSync(path.join(folder, name), text);
  }
  return { root, folder };
}
const by = (findings, rule) => findings.filter(item => item.rule === rule);

// Break caught: an import that names nothing found to be right, a misspelled name or entry not told what it should be,
// or an import clause read wrongly.
test('EC01 imports are read in all their forms, and the API reference gives every entry with its names', () => {
  const found = importsOf(
    "import { a, b as c, type D } from '@egret/engine';\nimport * as all from '@egret/engine/kit';\nimport x, { y } from 'z';\nexport { e } from './e.mjs';\nconst m = await import('@egret/engine/play');\n"
  );
  assert.deepEqual(
    found.map(item => [item.specifier, item.names, item.isDefault, item.line]),
    [
      ['@egret/engine', ['a', 'b', 'D'], false, 1],
      ['@egret/engine/kit', undefined, false, 2],
      ['z', ['y'], true, 3],
      ['./e.mjs', ['e'], false, 4],
      ['@egret/engine/play', undefined, false, 5]
    ]
  );
  const entries = exportsFromReference(
    fs.readFileSync(path.join(ROOT, 'knowledge-base/en/docs/api-reference.md'), 'utf8')
  );
  assert.ok(entries.size >= 40);
  assert.ok(entries.get('@egret/engine/play').has('play'));
  assert.ok(entries.get('@egret/engine/kit').has('createSaveStore'));
  const bodies = updateBodies('const o = { setup() {}, update(s, g) { if (a) { b(); } c(); }, other() {} };');
  assert.deepEqual(
    bodies.map(body => body.text),
    ['{ if (a) { b(); } c(); ']
  );
  // Every rule sends its reader to a card that exists.
  const ids = new Set(loadCards().map(card => card.id));
  for (const [rule, { card }] of Object.entries(RULES)) assert.ok(ids.has(card), rule + ' names ' + card);
});

// Break caught: any rule that stops finding its mistake, or starts finding the near miss beside it.
test('EC02 every rule finds its mistake and lets the right way through', () => {
  const { root, folder } = game({
    'src/main.mjs': MAIN,
    'test/accept.mjs': ACCEPT,
    'vendor/importmap.json': JSON.stringify({
      imports: {
        '@egret/engine': './vendor/engine/dist/index.js',
        '@egret/engine/play': './vendor/engine/dist/web/play.js'
      }
    }),
    'index.html':
      '<script type="importmap">{"imports": {"@egret/engine": "./a.js", "@egret/engine/play": "./b.js", "@egret/engine/kit": "./c.js"}}</script>',
    'ENGINE-NOTES.md':
      '### 1. Keys — open\n<!-- engine-note: {"id": "CheckGame#1", "status": "open", "topic": "play-page-keys"} -->\n'
  });
  try {
    const { findings } = checkGame(folder, ROOT, { resolvedGuide: GUIDE });
    const names = by(findings, 'unknown-name').map(item => [item.line, item.message]);
    assert.deepEqual(
      names.map(([line]) => line),
      [2, 3, 4, 6],
      JSON.stringify(names)
    );
    assert.match(names[0][1], /^createCanvasHost is not exported by @egret\/engine\. Look it up/);
    assert.match(names[1][1], /^play is not exported by @egret\/engine\. It is exported by @egret\/engine\/play\.$/);
    assert.match(names[2][1], /Did you mean createSaveStore\?$/);
    assert.match(names[3][1], /has no default export/);
    assert.deepEqual(
      by(findings, 'unknown-entry').map(item => [item.line, item.message]),
      [[5, '@egret/engine/physics is not an entry of the engine. The nearest is @egret/engine/physics2d.']]
    );
    assert.deepEqual(
      by(findings, 'entry-not-in-copy').map(item => item.line),
      [4, 8],
      'kit and @egret/contracts are not in the copy; physics, not an entry, is told once'
    );
    assert.deepEqual(
      by(findings, 'entry-not-in-page').map(item => item.line),
      []
    );
    assert.deepEqual(
      by(findings, 'engine-internals').map(item => item.line),
      [7]
    );
    assert.deepEqual(
      by(findings, 'text-in-update').map(item => [item.file, item.line]),
      [['src/main.mjs', 22]]
    );
    assert.deepEqual(
      by(findings, 'stale-workaround').map(item => item.line),
      [10, 25]
    );
    assert.deepEqual(
      by(findings, 'bare-storage').map(item => [item.file, item.line]),
      [['src/main.mjs', 26]]
    );
    assert.deepEqual(
      by(findings, 'notes-resolved').map(item => item.line),
      [1]
    );
    for (const item of findings) assert.equal(item.severity, RULES[item.rule].severity);
    // A page whose import map leaves an entry out is told; one that loads the copy's importmap.js is not.
    fs.writeFileSync(
      path.join(folder, 'index.html'),
      '<script type="importmap">{"imports": {"@egret/engine/play": "./b.js"}}</script>'
    );
    assert.deepEqual(
      by(checkGame(folder, ROOT).findings, 'entry-not-in-page').map(item => item.line),
      [2, 3, 4, 6]
    );
    fs.writeFileSync(path.join(folder, 'index.html'), '<script src="vendor/importmap.js"></script>');
    assert.equal(by(checkGame(folder, ROOT).findings, 'entry-not-in-page').length, 0);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

// Break caught: a game with errors passing, a clean game failing, warnings failing without --strict, or a report that
// does not say where to look.
test('EC03 the report fails on an error, on a warning only with --strict, and names the card of each finding', () => {
  const clean = game({
    'src/main.mjs': "import { play } from '@egret/engine/play';\nawait play({ width: 1, height: 1 });\n"
  });
  const warned = game({
    'src/main.mjs': "import { play } from '@egret/engine/play';\nlocalStorage.setItem('a', 'b');\n"
  });
  const broken = game({ 'src/main.mjs': "import { plays } from '@egret/engine/play';\n" });
  try {
    const ok = checkReport(clean.folder, ROOT, { command: 'egret' });
    assert.equal(ok.code, 0);
    assert.match(ok.text, /^0 errors and 0 warnings in 1 files, 1 imports of the engine\. Run the game next\.\n$/);
    assert.equal(checkReport(warned.folder, ROOT, { command: 'egret' }).code, 0);
    assert.equal(checkReport(warned.folder, ROOT, { command: 'egret', strict: true }).code, 1);
    const bad = checkReport(broken.folder, ROOT, { command: 'node vendor/egret.mjs' });
    assert.equal(bad.code, 1);
    assert.match(
      bad.text,
      /^error {3}src\/main\.mjs:1 {2}unknown-name {2}plays is not exported by @egret\/engine\/play\. Did you mean play\? {2}\(node vendor\/egret\.mjs card choose-entry\)$/m
    );
    const json = JSON.parse(checkReport(broken.folder, ROOT, { json: true }).text);
    assert.equal(json.findings[0].rule, 'unknown-name');
    assert.equal(checkReport(path.join(clean.root, 'nowhere'), ROOT, {}).code, 2);
  } finally {
    for (const item of [clean, warned, broken]) fs.rmSync(item.root, { recursive: true, force: true });
  }
});

// Break caught: the engine copy without what the check reads, or a copy that checks against other names than here.
test('EC04 the engine copy checks the game it sits in, against the names of its own pin', () => {
  const { root, folder } = game({ 'src/main.mjs': "import { play, plays } from '@egret/engine/play';\n" });
  try {
    vendorGame(folder, ['@egret/engine', '@egret/engine/play']);
    const kit = JSON.parse(fs.readFileSync(path.join(folder, 'vendor', 'egret', 'exports.json'), 'utf8')).entries;
    assert.ok(kit['@egret/engine/play'].includes('play'));
    const run = spawnSync(process.execPath, ['vendor/egret.mjs', 'check'], { cwd: folder, encoding: 'utf8' });
    assert.equal(run.status, 1, run.stderr);
    assert.match(
      run.stdout,
      /src\/main\.mjs:1 {2}unknown-name {2}plays is not exported by @egret\/engine\/play\. Did you mean play\?/
    );
    assert.match(run.stdout, /\(node vendor\/egret\.mjs card choose-entry\)/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
