#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
// The guide an agent reads on demand: small topic cards under guide/cards, found by an engine name, an error code, a
// devtools hint id or plain words. One file is never handed over whole, because a developer pays for every token an
// agent reads; a question gets the two or three cards that answer it, within a budget.
//
//   node tools/egret-guide.mjs <words | API name | ERROR_CODE | hint-id> [--budget <tokens>]
//   node tools/egret-guide.mjs --card <id>
//   node tools/egret-guide.mjs --list [<area> | all]
//   node tools/egret-guide.mjs --full [--out <file>]
//
// The index is in two levels: guide/index.txt names the areas, and guide/areas/<area>.txt lists the cards of the folder
// guide/cards/<area>, so the index an agent reads first stays small however many cards there are. tools/egret.mjs is
// the same guide as one command, and tools/vendor-game.mjs puts both, with the guide, in a game's engine copy.
//
// Ranking is deterministic and needs nothing outside this repository: a query that equals a card's trigger or id
// comes first, then cards are ordered by the terms they share with the query, weighted by how rare each term is.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = fileURLToPath(new URL('..', import.meta.url));
export const GUIDE = path.join(ROOT, 'guide');
export const APPLIES = ['play', 'play3d', 'engine', 'world3d', 'web'];
export const DEFAULT_BUDGET = 2500;
/** Tokens of a card as it is printed, which is what an agent reads, and of its file with the front matter. */
export const CARD_BUDGET = 800;
export const CARD_FILE_BUDGET = 1000;
export const INDEX_BUDGET = 1500;
export const INDEX_LINES = 150;
/** Tokens and lines of one area's list of cards. */
export const AREA_BUDGET = 1500;
export const AREA_LINES = 150;
/** How the guide's own messages name the command that prints them. */
export const COMMAND = 'node tools/egret-guide.mjs';
const MAX_CARDS = 3;

/** Tokens a text costs a model, estimated as one per four characters: deterministic, and close for English and code. */
export function estimateTokens(text) {
  return Math.ceil(text.length / 4);
}

/** Splits `a, "b, c", d` at the commas outside quotes. */
function splitTop(text) {
  const parts = [];
  let quote = '',
    depth = 0,
    start = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quote) {
      if (c === quote) quote = '';
    } else if (c === '"' || c === "'") quote = c;
    else if (c === '{' || c === '[') depth++;
    else if (c === '}' || c === ']') depth--;
    else if (c === ',' && depth === 0) {
      parts.push(text.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(text.slice(start));
  return parts.map(part => part.trim()).filter(part => part !== '');
}

function scalar(text) {
  const value = text.trim();
  if (/^".*"$|^'.*'$/s.test(value)) return value.slice(1, -1);
  if (/^-?\d+$/.test(value)) return Number(value);
  return value;
}

function flowValue(text, where) {
  const value = text.trim();
  if (value.startsWith('[')) {
    if (!value.endsWith(']')) throw new Error(where + ': a list is not closed');
    return splitTop(value.slice(1, -1)).map(scalar);
  }
  if (value.startsWith('{')) {
    if (!value.endsWith('}')) throw new Error(where + ': a map is not closed');
    const map = {};
    for (const pair of splitTop(value.slice(1, -1))) {
      const colon = pair.indexOf(':');
      if (colon < 1) throw new Error(where + ': not a key and value: ' + pair);
      map[pair.slice(0, colon).trim()] = scalar(pair.slice(colon + 1));
    }
    return map;
  }
  return scalar(value);
}

/**
 * Reads a card: front matter of `key: value`, `key: [list]` and `key:` followed by `  - { map }` lines, then the body.
 * This small form is all a card uses, so no YAML library is needed.
 */
export function parseCard(text, file = 'card') {
  const lines = text.split('\n');
  if (lines[0] !== '---') throw new Error(file + ': a card starts with a front matter line ---');
  const end = lines.indexOf('---', 1);
  if (end < 0) throw new Error(file + ': the front matter is not closed');
  const meta = {};
  let open;
  for (let i = 1; i < end; i++) {
    const line = lines[i],
      where = file + ':' + (i + 1);
    if (line.trim() === '') continue;
    const item = line.match(/^\s+-\s+(.*)$/);
    if (item) {
      if (!open) throw new Error(where + ': a list item outside a list');
      meta[open].push(flowValue(item[1], where));
      continue;
    }
    const pair = line.match(/^([a-z]+):(.*)$/);
    if (!pair) throw new Error(where + ': not a key and value');
    const [, key, rest] = pair;
    if (key in meta) throw new Error(where + ': ' + key + ' is given twice');
    if (rest.trim() === '') {
      meta[key] = [];
      open = key;
    } else {
      meta[key] = flowValue(rest, where);
      open = undefined;
    }
  }
  const body = lines
    .slice(end + 1)
    .join('\n')
    .trim();
  return {
    id: meta.id,
    title: meta.title,
    applies: meta.applies ?? [],
    triggers: meta.triggers ?? [],
    local: meta.local ?? [],
    stale: meta.stale,
    evidence: meta.evidence ?? [],
    engine: meta.engine,
    meta,
    body,
    text,
    file
  };
}

/** Every card under guide/cards, ordered by id. */
export function loadCards(guide = GUIDE) {
  const cards = [];
  const walk = dir => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(file);
      else if (entry.name.endsWith('.txt')) {
        const relative = path.relative(guide, file).split(path.sep).join('/');
        cards.push(parseCard(fs.readFileSync(file, 'utf8'), relative));
      }
    }
  };
  walk(path.join(guide, 'cards'));
  return cards.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** The first level of the index: the areas, each with what its cards answer. */
export function readIndex(guide = GUIDE) {
  return fs.readFileSync(path.join(guide, 'index.txt'), 'utf8');
}

/** The areas in the order the index names them. */
export function listAreas(guide = GUIDE, index = readIndex(guide)) {
  return [...index.matchAll(/\]\(areas\/([a-z0-9-]+)\.txt\)/g)].map(match => match[1]);
}

/** The second level: the cards of one area, or undefined when there is no such area. */
export function readArea(area, guide = GUIDE) {
  if (!/^[a-z0-9-]+$/.test(String(area))) return undefined;
  const file = path.join(guide, 'areas', area + '.txt');
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : undefined;
}

const STOP = new Set(
  'a an and are as at be by can do does for from get how i in into is it its my no not of on or so that the then this to use what when where which why with without you your'.split(
    ' '
  )
);

/** Terms of a text: lower-case words, identifiers also split at their capitals, plurals folded. */
export function terms(text) {
  const out = [];
  for (const raw of text.match(/[A-Za-z0-9_]+/g) ?? []) {
    const parts = [raw, ...raw.split('_'), ...raw.replace(/([a-z0-9])([A-Z])/g, '$1 $2').split(' ')];
    for (const part of new Set(parts.map(word => word.toLowerCase()))) {
      if (part.length < 2 || STOP.has(part)) continue;
      out.push(part.length > 4 && part.endsWith('s') && !part.endsWith('ss') ? part.slice(0, -1) : part);
    }
  }
  return out;
}

const normal = text => text.toLowerCase().replace(/\s+/g, ' ').trim();

/** Han characters: a trigger holding one is matched as a substring of the question (see `search`). */
const HAN = /[㐀-䶿一-鿿豈-﫿]/u;

/**
 * Cards for a query, best first. `exact` is true when the whole query is a trigger or the id; `overlap` is the score
 * without that, which decides whether further cards are close enough to print.
 */
export function search(cards, query) {
  const wanted = normal(query);
  const joined = wanted.replace(/ /g, '');
  const queryTerms = [...new Set(terms(query))];
  const asked = new Set(queryTerms);
  const fields = cards.map(card => ({
    head: new Set(terms(card.id + ' ' + card.title + ' ' + card.triggers.join(' '))),
    body: new Set(terms(card.body))
  }));
  const df = term => fields.filter(field => field.head.has(term) || field.body.has(term)).length;
  const idf = new Map(queryTerms.map(term => [term, Math.log(1 + cards.length / Math.max(1, df(term)))]));
  const rarest = Math.log(1 + cards.length);
  const hanCards = new Map();
  for (const card of cards)
    for (const trigger of new Set(card.triggers.map(trigger => normal(String(trigger)))))
      if (HAN.test(trigger)) hanCards.set(trigger, (hanCards.get(trigger) ?? 0) + 1);
  const results = cards.map((card, i) => {
    let overlap = 0;
    const triggers = card.triggers.map(trigger => normal(String(trigger)));
    const exact = wanted === card.id || triggers.includes(wanted);
    // A trigger counts in full when every one of its terms was asked for, in any order, and in part when most were.
    // Its weight follows how rare its terms are, so a trigger such as `play` that is also an everyday word counts less.
    for (const trigger of triggers) {
      if (trigger === wanted) continue;
      const own = [...new Set(terms(trigger))];
      const shared = own.filter(term => asked.has(term));
      if (shared.length === 0) continue;
      const rarity = shared.reduce((sum, term) => sum + idf.get(term), 0) / shared.length / rarest;
      if (shared.length === own.length) overlap += 20 * rarity;
      else if (own.length > 1 && shared.length * 2 >= own.length) overlap += (8 * rarity * shared.length) / own.length;
    }
    // Chinese is written without spaces, so a trigger in Chinese counts when the question contains it anywhere.
    // It weighs up to a whole trigger: less when other cards share it, and less when it is short, since a two-character
    // word such as 卡顿 is found inside more questions than 第一次卡顿 is.
    for (const trigger of triggers) {
      const word = trigger.replace(/ /g, '');
      if (trigger === wanted || !HAN.test(trigger) || !joined.includes(word)) continue;
      const length = Math.min(1, [...word].length / 4);
      overlap += (20 * length * Math.log(1 + cards.length / hanCards.get(trigger))) / rarest;
    }
    for (const term of queryTerms) {
      const weight = idf.get(term);
      if (fields[i].head.has(term)) overlap += 3 * weight;
      if (fields[i].body.has(term)) overlap += weight;
    }
    overlap = Math.round(overlap * 1000) / 1000;
    return { card, score: overlap + (exact ? 1000 : 0), overlap, exact };
  });
  return results
    .filter(result => result.score > 0)
    .sort((a, b) => b.score - a.score || (a.card.id < b.card.id ? -1 : 1));
}

const short = sha => (typeof sha === 'string' ? sha.slice(0, 9) : 'unknown');

/** A card as it is printed: its title line, a stale warning if it has one, the body and where it was learnt. */
export function render(card) {
  const lines = [
    `=== ${card.id} · applies to ${card.applies.join(', ')} · checked against engine ${short(card.engine)}`
  ];
  if (card.stale) lines.push('STALE: ' + card.stale);
  lines.push('', card.body, '');
  const sources = card.evidence.map(item => {
    const place = `${item.path}:${item.line}`;
    return item.repo === 'cnedwin/Egret_rebuild' ? place : `${item.repo}/${place}@${short(String(item.commit))}`;
  });
  lines.push('Learnt from: ' + sources.join('; '), '');
  return lines.join('\n');
}

/** The answer to a query: the best two or three cards that fit the budget, or a short refusal with the ids. */
export function answer(cards, query, budget = DEFAULT_BUDGET, command = COMMAND) {
  const found = search(cards, query);
  if (found.length === 0)
    return {
      ok: false,
      ids: [],
      text: `No card matches "${query}". Cards: ${cards.map(card => card.id).join(', ')}\n`
    };
  // Further cards are printed while they are close to the best one; an exact match is always close.
  const top = Math.max(...found.map(result => result.overlap));
  const chosen = [];
  let spent = 0;
  for (const result of found) {
    if (chosen.length === MAX_CARDS) break;
    if (chosen.length > 0 && result.overlap < top * 0.4 && !result.exact) break;
    const printed = render(result.card);
    const cost = estimateTokens(printed);
    if (chosen.length > 0 && spent + cost > budget) continue;
    chosen.push({ id: result.card.id, printed });
    spent += cost;
  }
  const rest = found.length - chosen.length;
  const footer = rest > 0 ? `(${rest} more cards matched less well; ${command} --list shows the areas.)\n` : '';
  return { ok: true, ids: chosen.map(item => item.id), text: chosen.map(item => item.printed).join('\n') + footer };
}

/** Every area's list after the index. */
export function allAreas(guide = GUIDE, index = readIndex(guide)) {
  return [index.trim(), ...listAreas(guide, index).map(area => readArea(area, guide).trim())].join('\n\n') + '\n';
}

/** Every card in one text after the index and the areas, for tools that want a single file. */
export function fullText(cards = loadCards(), index = readIndex(), guide = GUIDE) {
  return [allAreas(guide, index).trim(), ...cards.map(card => render(card).trim())].join('\n\n') + '\n';
}

function usage(command) {
  return [
    'Usage:',
    `  ${command} <words | API name | ERROR_CODE | hint-id> [--budget <tokens>]`,
    `  ${command} --card <id>`,
    `  ${command} --list [<area> | all]`,
    `  ${command} --full [--out <file>]`,
    ''
  ].join('\n');
}

/**
 * Runs the command line and returns what to print and the exit code, so tests need no child process. `options` give the
 * guide folder, the root that a full file may not be written into except under work/, and how messages name the command.
 */
export function run(args, cards, options = {}) {
  const guide = options.guide ?? GUIDE,
    root = options.root ?? ROOT,
    command = options.command ?? COMMAND;
  cards ??= loadCards(guide);
  const words = [];
  let budget = DEFAULT_BUDGET,
    mode = 'search',
    card,
    area,
    out;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--budget') {
      budget = Number(args[++i]);
      if (!Number.isInteger(budget) || budget < CARD_BUDGET)
        return { code: 2, text: `--budget takes a whole number of at least ${CARD_BUDGET}.\n` };
    } else if (arg === '--card') {
      mode = 'card';
      card = args[++i];
    } else if (arg === '--list') {
      mode = 'list';
      if (args[i + 1] !== undefined && !args[i + 1].startsWith('--')) area = args[++i];
    } else if (arg === '--full') mode = 'full';
    else if (arg === '--out') out = args[++i];
    else if (arg === '--help' || arg === '-h') return { code: 0, text: usage(command) };
    else if (arg.startsWith('--')) return { code: 2, text: 'Unknown option ' + arg + '\n' + usage(command) };
    else words.push(arg);
  }
  if (mode === 'list') {
    if (area === undefined) return { code: 0, text: readIndex(guide) };
    if (area === 'all') return { code: 0, text: allAreas(guide) };
    const text = readArea(area, guide);
    return text !== undefined
      ? { code: 0, text }
      : { code: 1, text: `No area is called "${area}". Areas: ${listAreas(guide).join(', ')}\n` };
  }
  if (mode === 'card') {
    const found = cards.find(item => item.id === card);
    return found ? { code: 0, text: render(found) } : { code: 1, text: `No card has the id "${card}".\n` };
  }
  if (mode === 'full') {
    const text = fullText(cards, readIndex(guide), guide);
    if (out === undefined) return { code: 0, text };
    const target = path.resolve(out),
      inside = path.relative(root, target);
    // The full file is a build output. Inside the repository it goes only under the ignored work/ folder.
    if (!inside.startsWith('..') && !path.isAbsolute(inside) && !/^work[\\/]/.test(inside))
      return { code: 2, text: 'Write the full file outside the repository or under work/: ' + target + '\n' };
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, text);
    return {
      code: 0,
      text: `Wrote ${cards.length} cards and the index to ${target} (about ${estimateTokens(text)} tokens).\n`
    };
  }
  if (words.length === 0) return { code: 2, text: usage(command) };
  const result = answer(cards, words.join(' '), budget, command);
  return { code: result.ok ? 0 : 1, text: result.text };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { code, text } = run(process.argv.slice(2));
  process.stdout.write(text);
  process.exitCode = code;
}
