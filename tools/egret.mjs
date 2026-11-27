#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
// The engine's command for a coding agent: ask the guide, read a card or an area, and explain an error code.
//
//   node tools/egret.mjs guide <words | API name | ERROR_CODE | hint-id> [--budget <tokens>]
//   node tools/egret.mjs card <id>
//   node tools/egret.mjs list [<area> | all]
//   node tools/egret.mjs explain <ERROR_CODE>
//   node tools/egret.mjs notes [<game folder>] [--check]
//   node tools/egret.mjs check [<game folder>] [--strict] [--json]
//   node tools/egret.mjs verify [<page>] [--playwright <index.mjs>] [--out <new folder>] [--play <script> | --screens[=<names>] [--prepare <script>]]
//   node tools/egret.mjs new <folder> [--target web|mobile|wechat|steam] [--genre <kind>] [--title <name>]
//
// The same file runs in this repository and in a game's engine copy, where tools/vendor-game.mjs puts it under
// vendor/egret/tools/ with the guide beside it and vendor/egret.mjs to start it, so an agent working in the game's
// folder runs `node vendor/egret.mjs guide <question>`. It reads only the folder it is in: no network, no model, and
// the same answers in both places.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { GUIDE, ROOT, loadCards, render, run as runGuide, search } from './egret-guide.mjs';
import { checkReport } from './egret-check.mjs';
import { STARTER_ENTRIES, TARGETS, writeStarter } from './egret-new.mjs';
import { notesReport } from './egret-notes.mjs';
import { SCREENS } from './verify-screens.mjs';

/** The engine copy of a game holds this file at vendor/egret/tools/egret.mjs, and the runtime at vendor/runtime. */
const VENDORED = fs.existsSync(path.join(ROOT, 'error-codes.json'));
/** How messages name this command where it runs. */
export const COMMAND = VENDORED ? 'node vendor/egret.mjs' : 'node tools/egret.mjs';
const CODE = /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+$/;

function usage() {
  return [
    'Usage:',
    `  ${COMMAND} guide <words | API name | ERROR_CODE | hint-id> [--budget <tokens>]   the cards that answer`,
    `  ${COMMAND} card <id>                                                           one card`,
    `  ${COMMAND} list [<area> | all]                                                 the areas, or an area's cards`,
    `  ${COMMAND} explain <ERROR_CODE>                                                an error in English and Chinese`,
    `  ${COMMAND} notes [<game folder>] [--check]                                     the game's engine notes the engine has fixed`,
    `  ${COMMAND} check [<game folder>] [--strict] [--json]                           the game's files read for common mistakes`,
    `  ${COMMAND} verify [<page>] [--playwright <index.mjs>] [--out <dir>] [--play <script>]   the game run in a headless browser`,
    `  ${COMMAND} verify [<page>] --screens[=<name>,...] [--prepare <script>] [--playwright <index.mjs>] [--out <dir>]   the game on phones, tablets and a desktop`,
    `  ${COMMAND} new <folder> [--target web|mobile|wechat|steam] [--genre <kind>] [--title <name>]   a game to start from`,
    ''
  ].join('\n');
}

/** The engine's error codes: the list the engine copy carries, or the one the sources give in this repository. */
async function errorCodes() {
  if (VENDORED) return JSON.parse(fs.readFileSync(path.join(ROOT, 'error-codes.json'), 'utf8')).codes;
  const { collectErrorCodes } = await import('./error-codes.mjs');
  return collectErrorCodes();
}

/** The runtime's own sentences: from the built runtime here, or from the runtime in the engine copy. */
async function describer() {
  const candidates = VENDORED
    ? [path.join(ROOT, '..', 'runtime', 'dist', 'errorHelp.js')]
    : [path.join(ROOT, 'packages', 'runtime', 'dist', 'errorHelp.js')];
  const file = candidates.find(candidate => fs.existsSync(candidate));
  if (!file) return undefined;
  const { describeErrorCode } = await import(pathToFileURL(file).href);
  return describeErrorCode;
}

/** An error code's sentence in both languages, then the cards whose triggers name it, or the cards nearest to it. */
export async function explain(code, cards = loadCards()) {
  if (typeof code !== 'string' || !CODE.test(code))
    return { code: 2, text: `An error code is written in capitals with underscores, such as ASSET_LEASE_RELEASED.\n` };
  const codes = await errorCodes(),
    known = codes.includes(code),
    describe = await describer();
  const lines = [`=== ${code}`];
  if (!known) lines.push(`${code} is not one of this engine's error codes; the nearest cards follow.`);
  else if (!describe) lines.push('The runtime that holds the sentences is not built here: run node tools/build.mjs.');
  else lines.push('', describe(code, 'en'), '', describe(code, 'zh'));
  const exact = cards.filter(card => card.triggers.map(String).includes(code));
  lines.push('');
  if (exact.length) {
    lines.push(`Cards for ${code}:`, '');
    for (const card of exact) lines.push(render(card));
  } else {
    const found = search(cards, code.toLowerCase().replace(/_/g, ' ')).slice(0, 3);
    lines.push(
      found.length
        ? `No card names ${code}. Nearest: ${found.map(result => result.card.id).join(', ')} (${COMMAND} card <id>).`
        : `No card names ${code}. ${COMMAND} card read-engine-errors says how to read any engine error.`,
      ''
    );
  }
  return { code: known ? 0 : 1, text: lines.join('\n') };
}

/** Playwright's index.mjs as Node finds it from the game's folder, or undefined. */
function findPlaywright(cwd) {
  try {
    return path.join(
      path.dirname(createRequire(path.join(cwd, 'package.json')).resolve('playwright/package.json')),
      'index.mjs'
    );
  } catch {
    return undefined;
  }
}

/**
 * What `verify` runs: tools/verify-game.mjs (beside this file, in the engine copy too) with Playwright's index.mjs, the
 * page (index.html of the folder it runs in unless named), a new output folder (one under the system's temporary folder
 * unless named) and the play script, if any. Playwright is the one named, or the one the game's folder can import.
 * With `--screens`, tools/verify-screens.mjs instead, on every screen it knows or on those named after `=`.
 * An optional local `--prepare` module navigates each fresh page to the scene to check.
 */
export function verifyArgs(args, cwd = process.cwd(), find = findPlaywright) {
  const named = {},
    pages = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--screens' || arg.startsWith('--screens=')) {
      const list = arg === '--screens' ? Object.keys(SCREENS) : arg.slice(10).split(',').filter(Boolean);
      const unknown = list.filter(name => !Object.hasOwn(SCREENS, name));
      if (list.length === 0 || unknown.length)
        return {
          error: `The screens are ${Object.keys(SCREENS).join(', ')}${unknown.length ? `, not ${unknown.join(', ')}` : ''}.`
        };
      named.screens = list;
    } else if (['--playwright', '--out', '--play', '--prepare'].includes(arg)) {
      if (args[i + 1] === undefined || args[i + 1].startsWith('--')) return { error: `${arg} takes a path.` };
      named[arg.slice(2)] = args[++i];
    } else if (arg.startsWith('--')) return { error: `Unknown option ${arg}.` };
    else pages.push(arg);
  }
  if (pages.length > 1) return { error: 'Name one page.' };
  const page = path.resolve(cwd, pages[0] ?? 'index.html');
  if (!fs.existsSync(page)) return { error: `There is no page at ${page}.` };
  const playwright = named.playwright ? path.resolve(cwd, named.playwright) : find(cwd);
  if (playwright === undefined)
    return {
      error:
        'Playwright is not installed where the game is: run npm install playwright there (or name one with --playwright <its index.mjs>), and npx playwright install chromium once.'
    };
  if (!fs.existsSync(playwright)) return { error: `There is no Playwright at ${playwright}.` };
  if (named.screens && named.play) return { error: '--play plays in one window; use --prepare with --screens.' };
  if (named.prepare && !named.screens) return { error: '--prepare requires --screens.' };
  const out = path.resolve(
    cwd,
    named.out ?? path.join(os.tmpdir(), `egret-${named.screens ? 'screens' : 'verify'}-${Date.now()}`)
  );
  if (fs.existsSync(out)) return { error: `The output folder must not exist yet: ${out}` };
  const play = named.play && path.resolve(cwd, named.play);
  if (play !== undefined && !fs.existsSync(play)) return { error: `There is no script at ${play}.` };
  const here = path.dirname(fileURLToPath(import.meta.url));
  if (named.screens) {
    const tool = path.join(here, 'verify-screens.mjs');
    const prepare = named.prepare && path.resolve(cwd, named.prepare);
    if (prepare !== undefined && !fs.statSync(prepare, { throwIfNoEntry: false })?.isFile())
      return { error: `There is no preparation script at ${prepare}.` };
    return {
      tool,
      args: [tool, playwright, page, out, named.screens.join(','), ...(prepare ? [prepare] : [])],
      out,
      screens: named.screens
    };
  }
  const tool = path.join(here, 'verify-game.mjs');
  return { tool, args: [tool, playwright, page, out, ...(play ? [play] : [])], out };
}

/**
 * A new game in `folder`: the starter of tools/egret-new.mjs, and an engine copy. From this repository the copy is made
 * by tools/vendor-game.mjs; from a game's engine copy, that copy (vendor/) is copied, at its own pin.
 */
export async function newGame(args, cwd = process.cwd()) {
  const named = {},
    folders = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--target' || args[i] === '--title' || args[i] === '--genre') {
      if (args[i + 1] === undefined) return { code: 2, text: `${args[i]} takes a value.\n` };
      named[args[i].slice(2)] = args[++i];
    } else if (args[i].startsWith('--')) return { code: 2, text: `Unknown option ${args[i]}.\n` + usage() };
    else folders.push(args[i]);
  }
  if (folders.length !== 1) return { code: 2, text: 'Name the folder of the new game.\n' + usage() };
  const folder = path.resolve(cwd, folders[0]);
  const target = named.target ?? 'web';
  if (!TARGETS[target]) return { code: 2, text: `The target is one of ${Object.keys(TARGETS).join(', ')}.\n` };
  // A kind of game names a recipe of the guide: genre-<kind>.
  let recipe;
  if (named.genre !== undefined) {
    const kinds = loadCards().filter(card => card.id.startsWith('genre-'));
    const found = kinds.find(card => card.id === 'genre-' + named.genre || card.id === named.genre);
    if (!found)
      return { code: 2, text: `The kind of game is one of ${kinds.map(card => card.id.slice(6)).join(', ')}.\n` };
    recipe = { id: found.id, title: found.title };
  }
  const source = path.dirname(ROOT);
  if (VENDORED) {
    const map = JSON.parse(fs.readFileSync(path.join(source, 'importmap.json'), 'utf8')).imports;
    const missing = STARTER_ENTRIES.filter(entry => !(entry in map));
    if (missing.length)
      return {
        code: 1,
        text: `This engine copy has no ${missing.join(', ')}: make the game from an engine checkout.\n`
      };
    if (path.resolve(folder).startsWith(path.resolve(source, '..') + path.sep + 'vendor'))
      return { code: 2, text: 'The new game goes outside this engine copy.\n' };
  }
  let files;
  try {
    files = writeStarter(folder, { title: named.title ?? path.basename(folder), target, recipe });
  } catch (error) {
    return { code: 2, text: error.message + '\n' };
  }
  if (VENDORED) fs.cpSync(source, path.join(folder, 'vendor'), { recursive: true });
  else {
    const { vendorGame } = await import('./vendor-game.mjs');
    vendorGame(folder, [...STARTER_ENTRIES]);
  }
  return {
    code: 0,
    text:
      `A game for ${TARGETS[target].name} in ${folder}: ${files.length} files and the engine copy.\n` +
      `Next: cd ${path.relative(cwd, folder) || '.'} && npm test && node vendor/egret.mjs check, then serve the folder and open index.html. AGENTS.md says the rest.\n`
  };
}

/** Runs the command line and returns what to print and the exit code, so tests need no child process. */
export async function main(args, cards = loadCards()) {
  const [command, ...rest] = args;
  const options = { guide: GUIDE, root: ROOT, command: COMMAND + ' guide' };
  switch (command) {
    case 'guide':
      return runGuide(rest, cards, options);
    case 'card':
      return rest.length === 1 ? runGuide(['--card', rest[0]], cards, options) : { code: 2, text: usage() };
    case 'list':
      return rest.length <= 1 ? runGuide(['--list', ...rest], cards, options) : { code: 2, text: usage() };
    case 'explain':
      return rest.length === 1 ? explain(rest[0], cards) : { code: 2, text: usage() };
    case 'notes': {
      const check = rest.includes('--check'),
        folders = rest.filter(arg => arg !== '--check');
      if (folders.length > 1 || folders.some(arg => arg.startsWith('--'))) return { code: 2, text: usage() };
      return notesReport(folders[0] ?? process.cwd(), GUIDE, { command: COMMAND, check, copy: VENDORED });
    }
    case 'new':
      return newGame(rest);
    case 'verify': {
      const plan = verifyArgs(rest);
      if (plan.error) return { code: 2, text: plan.error + '\n' + usage() };
      // The browser run prints its own report as it goes; its exit code is the pass.
      const run = spawnSync(process.execPath, plan.args, { stdio: 'inherit' });
      return {
        code: run.status ?? 1,
        text: plan.screens
          ? `The red bands of the pictures are what a notch or a home bar covers. ${COMMAND} card mobile-viewport says how a game keeps clear of them.\n`
          : `The report (report.json) and the pictures are in ${plan.out}. engineWarnings lists what the engine warned of.\n`
      };
    }
    case 'check': {
      const flags = new Set(rest.filter(arg => arg.startsWith('--'))),
        folders = rest.filter(arg => !arg.startsWith('--'));
      if (folders.length > 1 || [...flags].some(flag => flag !== '--strict' && flag !== '--json'))
        return { code: 2, text: usage() };
      // The notes are read against the list of the engine copy, which is the game's pin; from this repository, the newest.
      return checkReport(folders[0] ?? process.cwd(), ROOT, {
        command: COMMAND,
        resolvedGuide: GUIDE,
        json: flags.has('--json'),
        strict: flags.has('--strict')
      });
    }
    case undefined:
    case 'help':
    case '--help':
    case '-h':
      return { code: command === undefined ? 2 : 0, text: usage() };
    default:
      return { code: 2, text: `Unknown command ${command}.\n` + usage() };
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { code, text } = await main(process.argv.slice(2));
  process.stdout.write(text);
  process.exitCode = code;
}
