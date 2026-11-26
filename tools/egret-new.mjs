// SPDX-License-Identifier: Apache-2.0
// `egret new <folder>`: a game to start from, made for where it will ship, with what a coding agent needs in it.
//
// The game is small but whole: a title, a first action within a second of pressing Start, a score, an end and a way
// back, a best score kept, keys and touch. Its rules are in src/rules.mjs, apart from the picture, and are tested in
// Node; src/main.mjs draws them with `play`. Beside it: AGENTS.md (read by Codex and by most agents), CLAUDE.md, which
// brings AGENTS.md into Claude Code, a skill for Claude Code that walks a game from a brief to done, ENGINE-NOTES.md,
// package.json and the engine copy with the guide and the `egret` command in vendor/.
//
// From this repository the engine copy is made by tools/vendor-game.mjs; from a game's engine copy
// (`node vendor/egret.mjs new ../Another`) that copy is copied, at its own pin.
import fs from 'node:fs';
import path from 'node:path';

/** Where a game ships decides its stage, how it fits a screen, its input and what its guide says first. */
export const TARGETS = Object.freeze({
  web: {
    name: 'a web page',
    width: 960,
    height: 540,
    fit: undefined,
    card: 'ship-web-page',
    input: 'arrows or A and D, or press and drag on the stage',
    notes: [
      'Keep the first load small: everything the first screen needs, and nothing else, before Start.',
      'Test at 1280 × 720 and at a phone held sideways; the page must work with a mouse, keys and a finger.'
    ]
  },
  mobile: {
    name: 'a phone app',
    width: 720,
    height: 1280,
    fit: 'expand',
    card: 'ship-mobile-app',
    input: 'press and drag; keys work too',
    notes: [
      'Place the score and buttons from `game.safe` in `arrange(game)`, so no notch covers them; draw the backdrop over `game.screen`.',
      'Tap targets of at least 44 units; test held upright and sideways.'
    ]
  },
  wechat: {
    name: 'a WeChat mini game',
    width: 720,
    height: 1280,
    fit: 'expand',
    card: 'ship-wechat-minigame',
    input: 'press and drag',
    notes: [
      'Package it from an engine checkout with `node tools/wechat/export-wechat.mjs`, and check it there with `node tools/wechat/check-minigame.mjs`: the main package holds at most 4 MB, the rest goes into subpackages.',
      "A mini game has no WebAssembly, no DOM and no page fonts: use `game.text` (or the canvas paragraph provider) and WeChat's keyboard for typing. Nothing here replaces a run in WeChat DevTools and on a phone."
    ]
  },
  steam: {
    name: 'Steam and the Steam Deck',
    width: 1280,
    height: 720,
    fit: undefined,
    card: 'ship-steam-desktop',
    input: "arrows or A and D, a gamepad's stick or d-pad, or the mouse",
    notes: [
      'Every screen works with a gamepad alone: `game.keys` names its buttons `pad:a`, `pad:b` and so on.',
      'Pause when the window loses focus, and offer a full-screen switch; test at 1280 × 800 for the Deck.'
    ]
  }
});

/** The files of a new game, by path, for a title and a target. */
export function starterFiles({ title, target, folder, recipe }) {
  const t = TARGETS[target];
  const fit = t.fit ? `\n  fit: '${t.fit}',` : '';
  return {
    'index.html': `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>${title}</title>
  <link rel="icon" href="data:,">
  <script src="vendor/importmap.js"></script>
</head>
<body style="margin:0;background:#0d1b2a">
  <script type="module" src="src/main.mjs"></script>
</body>
</html>
`,
    'src/rules.mjs': `// The rules of the game, apart from the picture: a state, and one step of it. Nothing here draws or reads a key,
// so the whole game can be played in Node (test/rules.test.mjs) and the numbers tuned from whole runs.
import { createRandom } from '@egret/engine/kit';

export const WIDTH = ${t.width};
export const HEIGHT = ${t.height};
export const LIVES = 3;

/** A new game: the catcher at the bottom middle, no stars yet, a score of 0. */
export function createState(seed = 'start') {
  return {
    random: createRandom(seed),
    catcher: { x: WIDTH / 2, y: HEIGHT - 80, width: 120 },
    stars: [],
    score: 0,
    lives: LIVES,
    time: 0,
    nextStar: 0.4,
    over: false
  };
}

/**
 * One step of \`seconds\`: \`move\` is -1 to 1 (left to right), or \`toX\` a place to move towards. Gives what happened, for
 * the picture and the sound to show: stars made, caught and missed, and whether the game ended.
 */
export function step(state, { move = 0, toX } = {}, seconds = 1 / 60) {
  const events = { made: [], caught: [], missed: [], ended: false };
  if (state.over) return events;
  state.time += seconds;
  const speed = 620;
  const c = state.catcher;
  if (toX !== undefined) c.x += Math.max(-speed * seconds, Math.min(speed * seconds, toX - c.x));
  else c.x += move * speed * seconds;
  c.x = Math.max(c.width / 2, Math.min(WIDTH - c.width / 2, c.x));
  state.nextStar -= seconds;
  if (state.nextStar <= 0) {
    // Stars come faster as the game goes on.
    state.nextStar = Math.max(0.35, 1.1 - state.time * 0.02);
    const star = { x: state.random.range(40, WIDTH - 40), y: -20, speed: 220 + Math.min(260, state.time * 6) };
    state.stars.push(star);
    events.made.push(star);
  }
  for (const star of [...state.stars]) {
    star.y += star.speed * seconds;
    const inside = Math.abs(star.x - c.x) <= c.width / 2 + 16 && Math.abs(star.y - c.y) <= 24;
    if (inside || star.y > HEIGHT + 20) {
      state.stars.splice(state.stars.indexOf(star), 1);
      if (inside) {
        state.score++;
        events.caught.push(star);
      } else {
        state.lives--;
        events.missed.push(star);
      }
    }
  }
  if (state.lives <= 0) {
    state.over = true;
    events.ended = true;
  }
  return events;
}
`,
    'src/main.mjs': `// ${title}: the picture and the input of src/rules.mjs, drawn with play. Every node is made once (in setup, or when a
// star appears) and moved after; nothing is made again every frame.
import { play } from '@egret/engine/play';
import { HEIGHT, WIDTH, createState, step } from './rules.mjs';

let state, mode, catcher, stars, score, lives, title, again;

await play({
  width: WIDTH,
  height: HEIGHT,${fit}
  background: 0x0d1b2a,
  setup(game) {
    state = createState(String(Date.now()));
    stars = new Map();
    mode = 'title';
    catcher = game.rect(state.catcher.x, state.catcher.y, state.catcher.width, 18, 0xf4d35e);
    score = game.text('', { x: 24, y: 24, size: 28, layer: game.ui });
    lives = game.text('', { x: WIDTH - 24, y: 24, size: 28, align: 'right', layer: game.ui });
    title = game.text('${title}\\nCatch the falling stars', { x: WIDTH / 2, y: HEIGHT * 0.35, size: 40, align: 'center' });
    again = game.button('Start', { x: WIDTH / 2, y: HEIGHT * 0.55, width: 220, height: 64 }, () => start(game));
    show(game);
  },
  update(seconds, game) {
    if (mode === 'title' && (game.keys.pressed('space', 'enter', 'pad:a'))) start(game);
    if (mode !== 'playing') return;
    const axis = game.keys.axis().x;
    const input = game.pointer.down ? { toX: game.pointer.x } : { move: axis };
    const events = step(state, input, seconds);
    for (const star of events.made) stars.set(star, game.circle(star.x, star.y, 16, 0xffffff));
    for (const star of events.caught) {
      game.remove(stars.get(star));
      stars.delete(star);
      game.sfx.play('coin');
    }
    for (const star of events.missed) {
      game.remove(stars.get(star));
      stars.delete(star);
      game.sfx.play('hurt');
      game.shake(6, 0.2);
    }
    for (const [star, node] of stars) node.y = star.y;
    catcher.x = state.catcher.x;
    if (events.ended) end(game);
    show(game);
  }
});

function start(game) {
  for (const node of stars.values()) game.remove(node);
  stars.clear();
  state = createState(String(Date.now()));
  mode = 'playing';
  title.visible = false;
  again.visible = false;
  show(game);
}

function end(game) {
  mode = 'over';
  const best = Math.max(state.score, game.load('best', 0));
  game.save('best', best);
  title.text = 'Caught ' + state.score + '\\nBest ' + best;
  title.visible = true;
  again.label.text = 'Again';
  again.visible = true;
  game.sfx.play('lose');
}

function show() {
  score.text = 'Score ' + state.score;
  lives.text = 'Lives ' + state.lives;
}
`,
    'test/rules.test.mjs': `// The rules, played in Node: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { HEIGHT, LIVES, WIDTH, createState, step } from '../src/rules.mjs';

test('a star that falls onto the catcher is caught, and one that falls past costs a life', () => {
  const state = createState('rules');
  state.stars.push({ x: state.catcher.x, y: state.catcher.y - 10, speed: 300 });
  assert.equal(step(state, {}, 1 / 30).caught.length, 1);
  assert.equal(state.score, 1);
  state.stars.push({ x: 20, y: HEIGHT + 30, speed: 300 });
  state.catcher.x = WIDTH - 100;
  assert.equal(step(state, {}, 1 / 30).missed.length, 1);
  assert.equal(state.lives, LIVES - 1);
});

test('the game ends after the last life, and a seed plays the same game again', () => {
  const run = seed => {
    const state = createState(seed);
    let steps = 0;
    while (!state.over && steps < 60 * 600) {
      step(state, { move: 0 }, 1 / 60);
      steps++;
    }
    return [state.over, state.score, steps];
  };
  const first = run('same');
  assert.equal(first[0], true, 'standing still loses in the end');
  assert.deepEqual(run('same'), first);
});

test('the catcher stays on the stage and moves towards a finger', () => {
  const state = createState('edge');
  for (let i = 0; i < 200; i++) step(state, { move: -1 }, 1 / 60);
  assert.equal(state.catcher.x, state.catcher.width / 2);
  step(state, { toX: WIDTH / 2 }, 1);
  assert.ok(state.catcher.x > state.catcher.width / 2);
});
`,
    'AGENTS.md': agentsMd({ title, target, folder, recipe }),
    'CLAUDE.md': '@AGENTS.md\n',
    '.claude/skills/egret-game/SKILL.md': skillMd({ title, target, recipe }),
    'ENGINE-NOTES.md': `# Engine notes

The faults of the engine this game met, one numbered note each, with a header line under its heading
(\`node vendor/egret.mjs card engine-notes\` gives the form).

**No engine issues recorded**
`,
    'package.json':
      JSON.stringify(
        {
          name: folder.toLowerCase().replace(/[^a-z0-9-]+/g, '-'),
          private: true,
          type: 'module',
          scripts: {
            test: 'node --import ./vendor/node-register.mjs --test "test/**/*.test.mjs"',
            check: 'node vendor/egret.mjs check',
            verify: 'node vendor/egret.mjs verify',
            notes: 'node vendor/egret.mjs notes'
          }
        },
        null,
        2
      ) + '\n',
    'README.md': `# ${title}

A game built on the Egret engine, for ${t.name}. Catch the falling stars: ${t.input}.

- Play: serve this folder (\`npx http-server .\` or any static server) and open \`index.html\`.
- Rules: \`npm test\`. Files: \`npm run check\`. In a headless browser: \`npm run verify\` (needs Playwright).
- \`AGENTS.md\` says how this game is worked on.
`
  };
}

/** AGENTS.md: short, since an agent reads it every time; the guide holds the rest, and the command finds it. */
export function agentsMd({ title, target, recipe }) {
  const t = TARGETS[target];
  const kind = recipe
    ? `\n## The kind of game: ${recipe.title}\n\nRead \`node vendor/egret.mjs card ${recipe.id}\` before anything else: the loop of this kind of game, the files it is split into, the entries it uses, the cards to read first and what done means for it. The star catcher here is only a start: replace its rules and picture with the recipe's, keeping the rules apart from the picture.\n`
    : '';
  return `# ${title}: how to work on this game

A game on the Egret engine, for ${t.name}. The engine is copied in \`vendor/\` with its guide; do not edit \`vendor/\`.
${kind}
## Ask before you write

- \`node vendor/egret.mjs guide <question>\` gives the cards that answer, in English or Chinese, by words, an engine name or an error code. Start with \`card first-playable-world\`, \`card choose-entry\` and \`card ${t.card}\`.
- \`node vendor/egret.mjs explain <ERROR_CODE>\` explains an engine error in English and Chinese, with its cards.
- Every engine name you use must be one the entry exports: \`node vendor/egret.mjs check\` says when it is not, and which entry has it.

## The way through

1. The brief: what the player acts on, what changes when they do, and what that lets them do next. Write it at the top of \`src/rules.mjs\`.
2. The first action within a second of Start, and its result in the scene. Then the loop that brings it back, then an end and a way back to the start.
3. Rules in \`src/rules.mjs\`, apart from the picture; \`npm test\` plays them in Node. The picture and the input in \`src/main.mjs\` with \`play\` (\`@egret/engine/play\`). Reach for another entry only when a card sends you there.
4. Make each text, shape and sprite once and change it after; never make them in every frame of \`update\`.
5. Keys and touch both, from the first version: ${t.input}.

## Where it ships: ${t.name}

- Stage ${t.width} × ${t.height}${t.fit ? `, \`fit: '${t.fit}'\`` : ''}.
${t.notes.map(note => '- ' + note).join('\n')}

## Before you say it is done

- \`npm test\` passes, \`node vendor/egret.mjs check\` gives no error, and \`node vendor/egret.mjs verify\` passes with no \`engineWarnings\` you have not answered. Look at its pictures.
- A fault of the engine you worked around is a note in \`ENGINE-NOTES.md\`, with its header line. After an engine refresh, \`node vendor/egret.mjs notes\` says which notes the engine fixed.
- Say what you ran and what you did not: tests, a browser run and a device run are three different claims.
`;
}

/** The skill for Claude Code: the same way through, as steps to follow with the commands at each. */
export function skillMd({ title, target, recipe }) {
  const t = TARGETS[target];
  return `---
name: egret-game
description: Build or change ${title} on the Egret engine, from a brief to a game that is checked in a browser. Use for any change to this game's rules, screens, input or look, and for engine errors met in it.
---

# Make ${title} on the Egret engine

1. Read AGENTS.md. Ask the guide before writing engine code: \`node vendor/egret.mjs guide "<what you need>"\`, and \`card ${t.card}\` for ${t.name}.${recipe ? ` Read \`card ${recipe.id}\` first: the recipe for this kind of game.` : ''}
2. Write the brief at the top of \`src/rules.mjs\`: what the player acts on, what changes, what that opens.
3. Change the rules in \`src/rules.mjs\` and their tests in \`test/\`; run \`npm test\`.
4. Change the picture and the input in \`src/main.mjs\`. Make nodes once and move or change them; keys and touch both.
5. Run \`node vendor/egret.mjs check\` and fix every error. For an engine error, \`node vendor/egret.mjs explain <CODE>\`.
6. Run \`node vendor/egret.mjs verify\` and look at the pictures it saves. Answer each of its \`engineWarnings\`.
7. Write a fault of the engine you had to work around into \`ENGINE-NOTES.md\`, with its header line.
8. Report what you ran, what passed and what you could not run.
`;
}

/** Writes a new game into `folder`: refuses a folder that has files, and a target or title that is not one. */
export function writeStarter(folder, { title, target = 'web', recipe } = {}) {
  if (!TARGETS[target]) throw new Error(`The target is one of ${Object.keys(TARGETS).join(', ')}.`);
  if (typeof title !== 'string' || !title.trim() || /[\r\n<>"`$\\]/.test(title))
    throw new Error('A title is one line of words, without < > " ` $ or \\.');
  if (fs.existsSync(folder) && fs.readdirSync(folder).length > 0) throw new Error(`${folder} is not empty.`);
  const files = starterFiles({ title: title.trim(), target, folder: path.basename(path.resolve(folder)), recipe });
  for (const [name, text] of Object.entries(files)) {
    const file = path.join(folder, ...name.split('/'));
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, text);
  }
  return Object.keys(files);
}

/** The entries every new game is copied with. */
export const STARTER_ENTRIES = Object.freeze(['@egret/engine', '@egret/engine/play', '@egret/engine/kit']);
