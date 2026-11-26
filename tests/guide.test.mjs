// SPDX-License-Identifier: Apache-2.0
// The guide's cards are read by agents writing games, which act on every name, code and number in them. A card that
// names a call the engine does not have, or that a question cannot find, costs its reader a failed game, so each card
// is held to the sources, to the error codes and devtools hints that exist, to its size, to its evidence and to the
// index, and the command line is held to the cards it returns for a fixed set of questions.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  APPLIES,
  AREA_BUDGET,
  AREA_LINES,
  CARD_BUDGET,
  CARD_FILE_BUDGET,
  DEFAULT_BUDGET,
  INDEX_BUDGET,
  INDEX_LINES,
  ROOT,
  answer,
  estimateTokens,
  fullText,
  listAreas,
  loadCards,
  parseCard,
  readArea,
  readIndex,
  render,
  run
} from '../tools/egret-guide.mjs';
import { harvest } from '../tools/harvest-games.mjs';

const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
const cards = loadCards(),
  index = readIndex(),
  areas = listAreas();

/** The names each entry of the engine exports, from the generated API reference, and of @egret/devtools. */
function entryExports() {
  const entries = new Map();
  let entry;
  for (const line of read('knowledge-base/en/docs/api-reference.md').split('\n')) {
    const head = line.match(/^## `([^`]+)`/);
    if (head) entries.set((entry = head[1]), new Set());
    const row = line.match(/^\| `([^`]+)` \|/);
    if (row && entry) entries.get(entry).add(row[1]);
  }
  for (const [name, file] of [
    ['@egret/devtools', 'devtools/src/core/index.ts'],
    ['@egret/devtools/web', 'devtools/src/web/index.ts']
  ]) {
    const names = new Set();
    for (const [, list] of read(file).matchAll(/export (?:type )?\{([^}]+)\}/g))
      for (const item of list.split(','))
        if (item.trim())
          names.add(
            item
              .trim()
              .split(/\s+as\s+/)
              .pop()
          );
    entries.set(name, names);
  }
  return entries;
}
const ENTRIES = entryExports();
const EXPORTED = new Set([...ENTRIES.values()].flatMap(names => [...names]));

/** Every identifier written in the sources of the engine's packages and of devtools: what a member may be named. */
function sourceWords() {
  const words = new Set();
  const walk = dir => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (['dist', 'node_modules', 'tests', 'test'].includes(entry.name)) continue;
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(file);
      else if (entry.name.endsWith('.ts'))
        for (const word of fs.readFileSync(file, 'utf8').match(/[A-Za-z_$][\w$]*/g) ?? []) words.add(word);
    }
  };
  for (const pkg of fs.readdirSync(path.join(ROOT, 'packages'))) walk(path.join(ROOT, 'packages', pkg));
  walk(path.join(ROOT, 'devtools', 'src'));
  return words;
}
const WORDS = sourceWords();

/** The error codes: every code the generated page lists, and every code errorHelp.ts writes a sentence for. */
const CODES = new Set([
  ...[...read('knowledge-base/en/docs/error-codes.md').matchAll(/^\| `([A-Z][A-Z0-9_]+)` \|/gm)].map(match => match[1]),
  ...[...read('packages/runtime/src/errorHelp.ts').matchAll(/^ {2}([A-Z][A-Z0-9_]+):/gm)].map(match => match[1])
]);
/** The hint ids of @egret/devtools, from the union type that names them. */
const HINTS = new Set(
  [
    ...read('devtools/src/core/hints.ts')
      .match(/export type HintId =([^;]+);/)[1]
      .matchAll(/'([a-z-]+)'/g)
  ].map(match => match[1])
);

const ALL_CAPS = /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+$/;
const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)+$/;
const API_LIKE =
  /^(?:[A-Z][a-z0-9]+(?:[A-Z][A-Za-z0-9]*)+|(?:create|load|start|open|pick|bind|attach|run|encode|describe|evaluate|record|write|read|set|is|frame|world)[A-Z][A-Za-z0-9]*)$/;
/** Names of the web platform a card may call without the engine exporting them. */
const PLATFORM = new Set([
  'setTimeout',
  'setInterval',
  'setPointerCapture',
  'releasePointerCapture',
  'requestAnimationFrame',
  'preventDefault'
]);
const PAGE_GLOBALS = new Set([
  'document',
  'window',
  'location',
  'Math',
  'AbortSignal',
  'globalThis',
  'event',
  'element',
  'navigator',
  'performance',
  'console',
  'process'
]);
const FILE = /\.(?:m?js|ts|md|html|json|css|glb|gltf|wav|pack)$/;

/** Each name a card states as the engine's, with what it must be. */
function problemsOf(card) {
  const problems = [];
  const local = new Set(card.local);
  const fences = [...card.body.matchAll(/```[a-z]*\n([\s\S]*?)```/g)].map(match => match[1]);
  const prose = card.body.replace(/```[a-z]*\n[\s\S]*?```/g, '');
  for (const code of fences) {
    for (const [, list, from] of code.matchAll(/import\s*\{([^}]+)\}\s*from\s*'(@egret\/[^']+)'/g)) {
      const names = ENTRIES.get(from);
      if (!names) {
        problems.push('no entry ' + from);
        continue;
      }
      for (const item of list.split(','))
        if (item.trim() && !names.has(item.trim().split(/\s+as\s+/)[0]))
          problems.push(item.trim() + ' is not exported by ' + from);
    }
    const declared = new Set(
      [...code.matchAll(/(?:const|let|function)\s+\{?\s*([A-Za-z_$][\w$]*(?:\s*,\s*[A-Za-z_$][\w$]*)*)/g)].flatMap(
        match => match[1].split(/\s*,\s*/)
      )
    );
    for (const [, name] of code.matchAll(/(?<![.\w$])([a-z][a-z0-9]*[A-Z][A-Za-z0-9]*)\s*\(/g))
      if (!EXPORTED.has(name) && !local.has(name) && !declared.has(name))
        problems.push('call ' + name + ' is not exported');
  }
  for (const [, span] of prose.matchAll(/`([^`\n]+)`/g)) {
    const token = span.trim();
    if (FILE.test(token) || token.startsWith('_')) continue;
    if (/^[A-Za-z_$][\w$]*$/.test(token)) {
      if (ALL_CAPS.test(token)) {
        if (!CODES.has(token) && !EXPORTED.has(token) && !local.has(token))
          problems.push(token + ' is neither an error code nor exported');
      } else if (API_LIKE.test(token) && !EXPORTED.has(token) && !local.has(token) && !PLATFORM.has(token))
        problems.push(token + ' is not exported');
      continue;
    }
    const dotted = token.match(/^([A-Za-z_$][\w$]*)((?:\.[A-Za-z_$][\w$]*)+)/);
    if (dotted && !local.has(dotted[1]) && !PAGE_GLOBALS.has(dotted[1]))
      for (const member of dotted[2].slice(1).split('.'))
        if (!WORDS.has(member)) problems.push(token + ': ' + member + ' is not a name in the sources');
  }
  for (const trigger of card.triggers.map(String)) {
    if (ALL_CAPS.test(trigger)) {
      if (!CODES.has(trigger) && !EXPORTED.has(trigger))
        problems.push('trigger ' + trigger + ' is neither an error code nor exported');
    } else if (KEBAB.test(trigger)) {
      if (!HINTS.has(trigger))
        problems.push('trigger ' + trigger + ' is not a devtools hint id; write words with spaces');
    } else if (/^[A-Za-z_$][\w$]*$/.test(trigger) && /[A-Z]/.test(trigger)) {
      if (!EXPORTED.has(trigger) && !local.has(trigger) && !WORDS.has(trigger))
        problems.push('trigger ' + trigger + ' is not a name in the sources');
    }
  }
  return problems;
}

// Break caught: name a call, an entry, a member or a trigger the engine does not have, or misspell one.
test('GD01 every engine name, entry and member a card states exists in the current sources or exports', () => {
  assert.ok(ENTRIES.size > 40 && EXPORTED.has('createWorld3DView') && EXPORTED.has('attachPerformanceMonitor'));
  const found = cards.flatMap(card => problemsOf(card).map(problem => card.id + ': ' + problem));
  assert.deepEqual(found, []);
});

// Break caught: a card that would pass the check above because the check reads nothing.
test('GD02 the name check refuses a card that names what is not there', () => {
  const fake = parseCard(
    [
      '---',
      'id: fake',
      'title: Fake',
      'applies: [engine]',
      'triggers: [createNothing3D, NOT_A_CODE_EVER, frames-dropped]',
      'local: []',
      'evidence:',
      '  - { repo: cnedwin/Egret_rebuild, path: llms.txt, line: 1, commit: 0000000000000000000000000000000000000000, pin: 0000000000000000000000000000000000000000 }',
      'engine: 0000000000000000000000000000000000000000',
      '---',
      '',
      "```js\nimport { createWorld3DView, makeWorld } from '@egret/engine/webgl2/world3d';\nspawnEverything();\n```",
      '',
      'Call `loadEverything3D` and set `renderer.info.notAField`.'
    ].join('\n'),
    'fake.md'
  );
  const problems = problemsOf(fake);
  for (const expected of [
    'makeWorld',
    'spawnEverything',
    'loadEverything3D',
    'notAField',
    'createNothing3D',
    'NOT_A_CODE_EVER',
    'frames-dropped'
  ])
    assert.ok(
      problems.some(problem => problem.includes(expected)),
      expected + ' was not refused'
    );
});

// Break caught: a trigger code that was renamed or never existed, or a hint id devtools does not emit.
test('GD03 every trigger error code is an engine error code, and every hint trigger a devtools hint', () => {
  assert.ok(CODES.has('FRAME_RENDER_FAILED') && CODES.size > 300, String(CODES.size));
  assert.ok(HINTS.has('frames-skipped') && HINTS.size >= 15);
  let codes = 0,
    hints = 0;
  for (const card of cards)
    for (const trigger of card.triggers.map(String)) {
      if (ALL_CAPS.test(trigger) && !EXPORTED.has(trigger)) {
        codes++;
        assert.ok(CODES.has(trigger), card.id + ': ' + trigger);
      }
      if (KEBAB.test(trigger)) {
        hints++;
        assert.ok(HINTS.has(trigger), card.id + ': ' + trigger);
      }
    }
  assert.ok(codes >= 10 && hints >= 6, codes + ' codes, ' + hints + ' hints');
});

// Break caught: a card, the index or an area's list grows past what an agent should spend on it.
test('GD04 every card is within its token budget, and the index and each area within their own', () => {
  for (const card of cards) {
    assert.ok(estimateTokens(render(card)) <= CARD_BUDGET, card.id + ' as printed: ' + estimateTokens(render(card)));
    assert.ok(estimateTokens(card.text) <= CARD_FILE_BUDGET, card.id + ' as a file: ' + estimateTokens(card.text));
  }
  assert.ok(index.split('\n').length <= INDEX_LINES, index.split('\n').length + ' lines');
  assert.ok(estimateTokens(index) <= INDEX_BUDGET, estimateTokens(index) + ' tokens');
  for (const area of areas) {
    const text = readArea(area);
    assert.ok(text.split('\n').length <= AREA_LINES, area + ': ' + text.split('\n').length + ' lines');
    assert.ok(estimateTokens(text) <= AREA_BUDGET, area + ': ' + estimateTokens(text) + ' tokens');
  }
});

// Break caught: a card no area reaches, a card listed in another folder's area, a line to a card that is gone, applies
// that disagree, an area the index does not name, or a count of cards in the index that is no longer true.
test('GD05 every card is reachable from the index through its area, once, with the same applies', () => {
  const folders = [...new Set(cards.map(card => card.file.split('/')[1]))].sort();
  assert.deepEqual([...areas].sort(), folders, 'one area for each folder of cards, and no other');
  assert.deepEqual(
    fs.readdirSync(path.join(ROOT, 'guide', 'areas')).sort(),
    folders.map(folder => folder + '.txt'),
    'no area file the index does not name'
  );
  const seen = new Set();
  for (const area of areas) {
    const text = readArea(area);
    assert.match(text, /^# \S/, area + ' starts with its title');
    const lines = [...text.matchAll(/^- \[([a-z0-9-]+)\]\(\.\.\/(cards\/[^)]+)\) · ([a-z0-9 ]+) · (.+)$/gm)];
    const count = index.match(
      new RegExp('^- \\[' + area + '\\]\\(areas/' + area + '\\.txt\\) · (\\d+) cards? · .{20,}$', 'm')
    );
    assert.ok(count, 'the index names ' + area + ' with its number of cards and what they answer');
    assert.equal(Number(count[1]), lines.length, area + ': the number the index gives');
    for (const [, id, link, applies, hook] of lines) {
      const card = cards.find(item => item.id === id);
      assert.ok(card, area + ' names ' + id);
      assert.ok(!seen.has(id), id + ' twice');
      seen.add(id);
      assert.equal(link, card.file, id);
      assert.equal(link.split('/')[1], area, id + ' is listed in the area of its folder');
      assert.deepEqual(applies.trim().split(' ').sort(), [...card.applies].sort(), id);
      assert.ok(hook.length > 20, id);
    }
    for (const [, link] of text.matchAll(/\]\(([^)]+)\)/g))
      assert.ok(fs.existsSync(path.join(ROOT, 'guide', 'areas', link)), area + ': ' + link);
  }
  assert.equal(seen.size, cards.length, 'every card is in an area');
  assert.equal([...index.matchAll(/\]\(cards\//g)].length, 0, 'the index names areas, not cards');
  for (const [, link] of index.matchAll(/\]\(([^)]+)\)/g))
    assert.ok(fs.existsSync(path.join(ROOT, 'guide', link)), link);
});

// Break caught: a card without the evidence or the engine commit it was checked against, or with a bad id.
test('GD06 every card has its front matter: id, title, applies, triggers and evidence', () => {
  const sha = /^[0-9a-f]{40}$/;
  const ids = new Set();
  for (const card of cards) {
    assert.match(card.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.ok(!ids.has(card.id), card.id + ' twice');
    ids.add(card.id);
    assert.equal(path.basename(card.file, '.txt'), card.id);
    assert.ok(typeof card.title === 'string' && card.title.length > 10, card.id);
    assert.ok(card.body.startsWith('# ' + card.title + '\n'), card.id + ': the body starts with the title');
    assert.ok(card.applies.length > 0 && card.applies.every(item => APPLIES.includes(item)), card.id);
    assert.ok(card.triggers.length >= 5, card.id);
    assert.match(String(card.engine), sha, card.id);
    assert.ok(card.evidence.length > 0, card.id);
    for (const item of card.evidence) {
      assert.match(String(item.repo), /^[\w.-]+\/[\w.-]+$/, card.id);
      assert.ok(typeof item.path === 'string' && Number.isInteger(item.line) && item.line > 0, card.id);
      assert.match(String(item.commit), sha, card.id);
      assert.match(String(item.pin), sha, card.id + ': the engine pin of the evidence');
      if (item.repo === 'cnedwin/Egret_rebuild') {
        const file = path.join(ROOT, item.path);
        assert.ok(fs.existsSync(file), card.id + ': ' + item.path);
        assert.ok(read(item.path).split('\n').length >= item.line, card.id + ': ' + item.path + ':' + item.line);
      }
    }
    if (card.stale !== undefined) assert.ok(String(card.stale).length > 20, card.id);
  }
  assert.ok(cards.length >= 12, cards.length + ' cards');
});

/** Questions an agent asks, and the card that must come first. */
const QUERIES = [
  ['frames-skipped', 'frame-loop-backpressure'],
  ['WEBGL2_BACKPRESSURE', 'frame-loop-backpressure'],
  ['cpu-bound', 'frame-budget'],
  ['recent-hitch', 'prepare-programs'],
  ['OBJECT_DISPOSED', 'read-engine-errors'],
  ['FRAME_BUDGET_EXCEEDED', 'read-engine-errors'],
  ['ASSET_LOAD_FAILED', 'asset-loading'],
  ['createTouchStick', 'touch-controls'],
  ['encodeWav', 'synthesized-audio'],
  ['createWorld3DView', 'choose-entry'],
  ['touch joystick second finger', 'touch-controls'],
  ['no sound on phone', 'synthesized-audio'],
  ['shader stutter first time', 'prepare-programs'],
  ['how do I structure a big game', 'sim-view-split'],
  ['which entry should I import', 'choose-entry'],
  ['game is slow on phone', 'world3d-draw-cost'],
  ['too many lights', 'world3d-lights-shadows'],
  ['shadows missing', 'world3d-lights-shadows'],
  ['load glb models', 'asset-loading'],
  ['3d model looks bad, like boxes', 'model-in-code'],
  ['模型质量差', 'model-in-code'],
  ['how to test my game', 'verify-end-to-end'],
  ['vendor the engine', 'vendor-engine'],
  ['safe area notch', 'mobile-viewport'],
  ['draw calls too high', 'world3d-draw-cost'],
  ['webgpu or webgl2', 'choose-entry'],
  ['hud cut off on short landscape screen', 'short-screen-hud'],
  ['text too small on phone', 'touch-labels'],
  ['both mouse buttons', 'keyboard-shortcuts'],
  ['pause button on phone', 'pause-and-overlays'],
  ['private window storage throws', 'save-data'],
  ['html lang chinese font', 'two-languages'],
  ['how long is a run balance', 'balance-from-runs'],
  ['slow startup on phone', 'fast-startup'],
  ['asset licence credits', 'asset-provenance'],
  ['save.update returns false', 'save-update-callbacks'],
  ['cut the rope', 'rope-joints-2d'],
  ['tarp disappears', 'cloth-and-rope'],
  ['trees floating', 'terrain-stream-tiles'],
  ['UI_BUSY', 'ui-callbacks'],
  ['My opening looks like a website', 'first-playable-world'],
  ['I missed the prompt and do not know my next move in the opening', 'first-playable-world'],
  ['My canvas freezes after I add several radial gradients to a glow', 'geometry-budget-2d'],
  ['2D effects push the scene over the triangle limit', 'geometry-budget-2d'],
  ['My landing feels weightless', 'action-body-feedback'],
  // Chinese questions: no spaces between words, so the Chinese triggers are found inside the question.
  ['手机横屏 按钮 点不到', 'short-screen-hud'],
  ['同时按两个键没反应', 'keyboard-shortcuts'],
  ['切后台后游戏还在跑', 'pause-and-overlays'],
  ['手机上字太小看不清', 'touch-labels'],
  ['虚拟摇杆 第二根手指', 'touch-controls'],
  ['着色器第一次卡顿', 'prepare-programs'],
  ['手机上没有声音', 'synthesized-audio'],
  ['点光源太多 灯不亮', 'world3d-lights-shadows'],
  ['游戏卡顿 掉帧', 'frame-budget'],
  ['旧存档读不出来', 'save-data'],
  ['切换语言 中英文', 'two-languages'],
  ['数值平衡 太简单', 'balance-from-runs'],
  ['苹果手机加载不了', 'fast-startup'],
  ['素材授权 可以商用', 'asset-provenance'],
  ['存档没写进去', 'save-update-callbacks'],
  ['剪断绳子', 'rope-joints-2d'],
  ['篷布不见了', 'cloth-and-rope'],
  ['树悬空', 'terrain-stream-tiles'],
  ['按钮里打开设置', 'ui-callbacks'],
  ['开场像网页，第一次能做什么', 'first-playable-world'],
  ['开场不知道要做什么', 'first-playable-world'],
  ['玩家到灯旁提示一闪就没了，应当怎么让他继续', 'first-playable-world'],
  ['画了几个渐变光圈后就黑屏了', 'geometry-budget-2d'],
  ['Publish the game as a WeChat mini game', 'ship-wechat-minigame'],
  ['the main package is over 4 MB for the mini game', 'ship-wechat-minigame'],
  ['Ship the game on Steam with controller support for the Steam Deck', 'ship-steam-desktop'],
  ['make it an Android app for Google Play', 'ship-mobile-app'],
  ['share the browser game as a link on itch.io', 'ship-web-page'],
  ['做成微信小游戏上线', 'ship-wechat-minigame'],
  ['上架 steam 要支持手柄', 'ship-steam-desktop'],
  ['做一个完整手游上架应用商店', 'ship-mobile-app'],
  ['做一个网页游戏，分享链接给朋友玩', 'ship-web-page'],
  ['点灯一瞬间画面停住，提示三角形超限', 'geometry-budget-2d'],
  ['给界面加了径向渐变，动画刚开始画布就停住', 'geometry-budget-2d'],
  ['动作发飘，落地没重量', 'action-body-feedback'],
  ['a shop screen with a buy button and a red dot on mail', 'game-screens'],
  ['are you sure dialog before selling', 'game-screens'],
  ['做一个商店界面，邮件按钮上有红点', 'game-screens'],
  ['加载界面显示进度', 'game-screens'],
  ['drag an item from the bag into a slot', 'gestures'],
  ['long press a card to see details', 'gestures'],
  ['背包里长按物品拖到格子', 'gestures'],
  ['双指缩放地图', 'gestures']
];

// Break caught: a change to the ranking or to a card that sends a known question to the wrong card.
test('GD07 the command line returns the expected card first for a fixed set of questions', () => {
  const wrong = [];
  for (const [query, expected] of QUERIES) {
    const result = answer(cards, query);
    if (result.ids[0] !== expected) wrong.push(query + ' -> ' + result.ids.join(',') + ' (wanted ' + expected + ')');
  }
  assert.deepEqual(wrong, []);
});

// Break caught: an answer past its budget, more than three cards, or an answer that changes from run to run.
test('GD08 an answer keeps to its budget and is the same every time', () => {
  for (const [query] of QUERIES) {
    const first = answer(cards, query);
    assert.ok(first.ids.length >= 1 && first.ids.length <= 3, query);
    assert.ok(estimateTokens(first.text) <= DEFAULT_BUDGET + 60, query + ': ' + estimateTokens(first.text));
    assert.deepEqual(answer(cards, query), first, query);
    const tight = answer(cards, query, CARD_BUDGET);
    assert.equal(tight.ids.length, 1, query);
  }
  assert.ok(answer(cards, 'game is slow on phone').ids.length >= 2, 'a broad question brings the related cards too');
});

// Break caught: the options of the command line stop working, or a question that matches nothing passes silently.
test('GD09 --card, --list, --full and a question with no match', () => {
  const one = run(['--card', 'touch-controls'], cards);
  assert.equal(one.code, 0);
  assert.match(one.text, /^=== touch-controls · /);
  assert.equal(run(['--card', 'no-such-card'], cards).code, 1);
  assert.equal(run(['--list'], cards).text, index);
  assert.equal(run(['--list', 'perf'], cards).text, readArea('perf'));
  const all = run(['--list', 'all'], cards).text;
  for (const area of areas) assert.ok(all.includes(readArea(area).trim()), area);
  const unknown = run(['--list', 'nowhere'], cards);
  assert.equal(unknown.code, 1);
  assert.match(unknown.text, /No area is called "nowhere"\. Areas: game, /);
  const none = run(['xyzzy', 'qwertyuiop'], cards);
  assert.equal(none.code, 1);
  assert.match(none.text, /No card matches/);
  assert.equal(run(['--budget', '10', 'touch'], cards).code, 2);
  const stale = run(['--card', 'world3d-lights-shadows'], cards).text;
  assert.match(stale, /^STALE: /m);
  assert.equal(run(['--full', '--out', path.join(ROOT, 'llms-full.txt')], cards).code, 2);
});

// Break caught: the single file leaving out a card or the index, or being committed by hand.
test('GD10 the full file holds the index, every area and every card, and is a build output', () => {
  const text = fullText(cards, index);
  assert.ok(text.startsWith(index.trim()));
  for (const area of areas) assert.ok(text.includes(readArea(area).trim()), area);
  for (const card of cards) assert.ok(text.includes('=== ' + card.id + ' · '), card.id);
  assert.ok(
    !fs.existsSync(path.join(ROOT, 'llms-full.txt')),
    'llms-full.txt is written by node tools/egret-guide.mjs --full'
  );
});

// Break caught: llms.txt losing its way to the guide.
test('GD11 llms.txt routes new 2D and 3D work, existing games and errors before the first example', () => {
  const page = read('llms.txt');
  const firstExample = page.indexOf('```html');
  assert.ok(firstExample > 0, 'first runnable HTML example');
  const opening = page.slice(0, firstExample);
  for (const id of [
    'first-playable-world',
    'action-body-feedback',
    'choose-entry',
    'read-engine-errors',
    'geometry-budget-2d'
  ]) {
    const card = cards.find(item => item.id === id);
    assert.ok(card, id);
    assert.ok(opening.includes('](guide/' + card.file + ')'), id);
  }
  for (const link of ['knowledge-base/en/docs/play3d.md', 'knowledge-base/en/docs/entry-points.md', 'guide/index.txt'])
    assert.ok(opening.includes('](' + link + ')'), link);
  assert.ok(opening.includes('<https://github.com/cnedwin/Egret_rebuild/blob/main/llms.txt>'));
  assert.ok(opening.includes('node tools/egret-guide.mjs'));
});

// Break caught: the harvest misreading a game's pin, imports, tests or claims, missing a fix, or not marking a card
// whose evidence is gone or was learnt at another engine pin.
test('GD12 the harvest reads a games repository at a commit and proposes what the cards should become', t => {
  const clone = fs.mkdtempSync(path.join(os.tmpdir(), 'egret-harvest-'));
  t.after(() => fs.rmSync(clone, { recursive: true, force: true }));
  const pin = 'a'.repeat(40);
  const git = (...args) =>
    execFileSync(
      'git',
      ['-C', clone, '-c', 'user.name=Harvest test', '-c', 'user.email=harvest@example.invalid', ...args],
      { encoding: 'utf8' }
    );
  const write = (file, text) => {
    fs.mkdirSync(path.dirname(path.join(clone, file)), { recursive: true });
    fs.writeFileSync(path.join(clone, file), text);
  };
  git('init', '-q');
  write(
    'Game/vendor/SOURCE.md',
    '- Egret, commit [`' + pin + '`](x). Entries: `@egret/engine`, `@egret/engine/kit`.\n'
  );
  write(
    'Game/src/main.mjs',
    "import { createEngine } from '@egret/engine';\nimport { runHeadless as run } from '@egret/engine/kit';\n"
  );
  write('Game/test/sim.test.mjs', "import { test } from 'node:test';\ntest('a', () => {});\ntest('b', () => {});\n");
  write(
    'Game/STATUS.md',
    '# Game\n\n## 已知问题 · Known issues\n\n| 问题 · Issue | 影响 · Effect |\n| --- | --- |\n| 灯 · Lamps go dark | 远处 · far away |\n'
  );
  write('Game/src/input.mjs', 'export const input = 1;\n');
  git('add', '.');
  git('commit', '-q', '-m', 'Add the game');
  write('Game/src/input.mjs', 'export const input = 2;\nexport const touch = true;\n');
  git('commit', '-q', '-am', 'Fix touch drags losing their control to a second finger');
  const card = parseCard(
    [
      '---',
      'id: lamps',
      'title: Lamps in the game',
      'applies: [world3d]',
      'triggers: [lamps]',
      'evidence:',
      '  - { repo: example/games, path: Game/STATUS.md, line: 99, commit: ' +
        'b'.repeat(40) +
        ', pin: ' +
        'c'.repeat(40) +
        ' }',
      'engine: ' + 'd'.repeat(40),
      '---',
      '',
      '# Lamps in the game'
    ].join('\n'),
    'lamps.md'
  );
  const result = harvest({ clone, commit: 'HEAD', repo: 'example/games', cards: [...cards, card] });
  assert.equal(result.games.length, 1);
  const [game] = result.games;
  assert.equal(game.pin, pin);
  assert.deepEqual(game.entries, ['@egret/engine', '@egret/engine/kit']);
  assert.deepEqual(
    game.imports.map(row => row.entry + ' ' + row.name),
    ['@egret/engine createEngine', '@egret/engine/kit runHeadless']
  );
  assert.deepEqual(game.tests, [{ file: 'test/sim.test.mjs', cases: 2 }]);
  assert.equal(game.claims.knownIssues[0].text, '| Lamps go dark | far away |');
  assert.equal(game.claims.knownIssues[0].line, 7);
  assert.equal(game.fixes.length, 1);
  assert.equal(game.fixes[0].area, 'input');
  assert.equal(result.proposals.covered[0].card, 'touch-controls');
  const stale = result.proposals.stale.find(row => row.id === 'lamps');
  assert.deepEqual(stale.reasons.map(row => row.reason).sort(), ['evidence-line-gone', 'game-pin-changed']);
  assert.equal(
    fs.readFileSync(path.join(clone, 'Game/src/input.mjs'), 'utf8'),
    'export const input = 2;\nexport const touch = true;\n'
  );
});
