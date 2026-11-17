// SPDX-License-Identifier: Apache-2.0
// llms.txt is the one page an agent reads to write a game. A page that names a call the engine does not have costs
// its reader a failed game, so every name in it is held to the sources, and each of its games to the example that
// is played to its end in a browser.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Sprite } from '@egret/engine';
import { createRandom } from '@egret/engine/kit';
import { SFX_PRESETS } from '@egret/engine/play';

const read = file => fs.readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const page = read('llms.txt'),
  source = read('packages/engine/web/BrowserPlay.ts');
/** The names of the members of an interface of the play entry, from its source. */
const members = name => {
  const start = source.indexOf('export interface ' + name + ' {');
  assert.ok(start >= 0, name);
  const body = source.slice(start, source.indexOf('\n}', start));
  return [...body.matchAll(/^ {2}(?:readonly )?([A-Za-z]+)[?(<:]/gm)].map(match => match[1]);
};
const GAME = members('PlayGame'),
  PARTS = { keys: members('PlayKeys'), pointer: members('PlayPointer'), sfx: members('PlaySfx') };

// Break caught: change a game of the example without changing the page, or the page without the example.
test('LL01 each game of the page is a game of the play example, which is played to its end in a browser', () => {
  for (const game of ['breakout', 'platformer', 'memory']) {
    const lines = read('examples/play/' + game + '.mjs').split('\n');
    const first = lines.indexOf("import { play } from '@egret/engine/play';");
    assert.ok(first > 0 && lines.slice(0, first).every(line => line.startsWith('//')), game);
    const body = lines
      .slice(first + 1)
      .join('\n')
      .trimEnd();
    assert.ok(
      page.includes('```js\nconst { play } = Egret;\n' + body + '\n```'),
      game + ' is not in llms.txt as it is in the example'
    );
  }
});

// Break caught: name a call of the game that is not there, or add one to the game and leave it out of the page.
test('LL02 the page names every call of a game, and no call a game does not have', () => {
  // What a game also has, and the page leaves to the guide: the engine under it, and the end of the page.
  const beyond = ['canvas', 'dispose'];
  for (const name of GAME)
    assert.equal(page.includes('game.' + name), !beyond.includes(name), 'game.' + name + ' in llms.txt');
  for (const [part, names] of Object.entries(PARTS))
    for (const name of names)
      assert.ok(new RegExp('game\\.' + part + '\\.' + name + '\\b|`\\.' + name + '`').test(page), part + '.' + name);
  const random = Object.keys(createRandom(1));
  for (const [, name, member] of page.matchAll(/(?<![-\w<./])game\.([A-Za-z]+)(?:\.([A-Za-z]+))?/g)) {
    assert.ok(GAME.includes(name), 'game.' + name + ' is not a member of a game');
    if (member === undefined) continue;
    if (name in PARTS) assert.ok(PARTS[name].includes(member), 'game.' + name + '.' + member);
    else if (name === 'random') assert.ok(random.includes(member), 'game.random.' + member);
    else if (name === 'view') assert.ok(['x', 'y'].includes(member), 'game.view.' + member);
  }
});

// Break caught: list a sound, an easing or a drawing call that is refused or missing.
test('LL03 the sounds, the drawing calls and the options the page lists are the ones there are', () => {
  const sounds = page
    .match(/plays an effect made in code: ([^.]+)\./)[1]
    .match(/`([a-z]+)`/g)
    .map(name => name.slice(1, -1));
  assert.deepEqual(sounds, Object.keys(SFX_PRESETS));
  const graphics = Object.getOwnPropertyNames(Object.getPrototypeOf(new Sprite().graphics));
  const drawing = page.match(/`g` draws with ([^\n]+)/)[1];
  const calls = [...drawing.matchAll(/`([A-Za-z]+)\(/g)].map(match => match[1]);
  assert.ok(calls.length >= 10);
  for (const call of calls) assert.ok(graphics.includes(call), 'graphics.' + call);
  const motion = read('packages/engine/src/motion.ts');
  for (const [, easing] of page.match(/Easings: ([^\n]+)/)[1].matchAll(/`([A-Za-z]+)`/g))
    assert.ok(motion.includes("| '" + easing + "'"), 'easing ' + easing);
  const options = members('PlayOptions');
  for (const [, option] of page
    .match(/## Options of `play`\n\n([^\n]+)/)[1]
    .matchAll(/`([a-z][A-Za-z]*)(?:\([^)]*\))?`/g))
    if (!['async', 'game'].includes(option)) assert.ok(options.includes(option), 'option ' + option);
});

// Break caught: let the page grow past what an agent reads at once, or point it at a guide that is not there.
test('LL04 the page stays short and every guide it links is in the repository', () => {
  assert.ok(page.split('\n').length <= 400, page.split('\n').length + ' lines');
  const links = [...page.matchAll(/\]\(([^)]+)\)/g)].map(match => match[1]);
  assert.ok(links.length >= 10);
  for (const link of links) assert.ok(fs.existsSync(new URL('../' + link, import.meta.url)), link);
});
