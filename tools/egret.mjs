#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
// The engine's command for a coding agent: ask the guide, read a card or an area, and explain an error code.
//
//   node tools/egret.mjs guide <words | API name | ERROR_CODE | hint-id> [--budget <tokens>]
//   node tools/egret.mjs card <id>
//   node tools/egret.mjs list [<area> | all]
//   node tools/egret.mjs explain <ERROR_CODE>
//
// The same file runs in this repository and in a game's engine copy, where tools/vendor-game.mjs puts it under
// vendor/egret/tools/ with the guide beside it and vendor/egret.mjs to start it, so an agent working in the game's
// folder runs `node vendor/egret.mjs guide <question>`. It reads only the folder it is in: no network, no model, and
// the same answers in both places.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { GUIDE, ROOT, loadCards, render, run as runGuide, search } from './egret-guide.mjs';

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
