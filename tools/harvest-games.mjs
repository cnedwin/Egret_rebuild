#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
// Reads a local clone of a games repository built on the engine, at a commit given, and records per game what the
// guide's cards are made from: the engine pin and entries, the names imported, the tests, the claims and known issues
// of README and STATUS, and the commits that fixed something. Repeated fixes are where agents go wrong, so the tool
// also proposes cards that are missing, and marks cards whose evidence moved or was learnt at an older engine pin.
//
//   node tools/harvest-games.mjs --games <clone> --commit <commit> --out <new directory> [--repo <owner/name>]
//
// It reads with git from the clone and never checks anything out, so the clone is left as it was. The output is
// private working data: it goes outside the repository, or under the ignored work/ folder.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROOT, loadCards, search } from './egret-guide.mjs';

const SHA = /\b[0-9a-f]{40}\b/;
const CJK = /[　-〿㐀-鿿＀-￯]/;

function git(clone, args, options = {}) {
  return execFileSync('git', ['-C', clone, ...args], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, ...options });
}

/** A file of the clone at the commit, or undefined when it is not there. */
function show(clone, commit, file) {
  try {
    return git(clone, ['show', commit + ':' + file], { stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return undefined;
  }
}

/** The English half of a bilingual line: the part after ' · ' in each cell, or the line itself when it has no CJK. */
export function english(line) {
  if (!CJK.test(line)) return line.trim();
  if (line.trim().startsWith('|')) {
    const cells = line
      .trim()
      .slice(1, -1)
      .split('|')
      .map(cell => {
        const parts = cell.split(' · ');
        return parts.filter(part => !CJK.test(part)).join(' · ').trim();
      });
    return cells.some(cell => cell !== '') ? '| ' + cells.join(' | ') + ' |' : '';
  }
  return '';
}

const KIND = [
  [/known issue/i, 'knownIssues'],
  [/solved|fixed/i, 'solved'],
  [/verif|acceptance|boundar/i, 'verified'],
  [/unfinished|not yet|backlog|next step/i, 'unfinished']
];

/** Lines of a README or STATUS by kind of section, each with its line number, in English where the file has both. */
export function claimsOf(text, file) {
  const out = { knownIssues: [], solved: [], verified: [], unfinished: [], other: [] };
  let kind = 'other';
  text.split('\n').forEach((raw, i) => {
    const heading = raw.match(/^#{2,3}\s+(.*)$/);
    if (heading) {
      const title = heading[1].split(' · ').pop();
      kind = KIND.find(([pattern]) => pattern.test(title))?.[1] ?? 'other';
      return;
    }
    const line = english(raw);
    if (line === '' || /^\|[\s|:-]*\|$/.test(line) || /^\|\s*(issue|problem)\b/i.test(line)) return;
    if (kind === 'other' && !/^[-*]|^\|/.test(line)) return;
    out[kind].push({ file, line: i + 1, text: line.length > 400 ? line.slice(0, 400) + '…' : line });
  });
  return out;
}

/** Named imports from @egret entries in a module's text, and the entries it loads with import(). */
export function importsOf(text) {
  const found = [];
  for (const [, list, from] of text.matchAll(/import\s*\{([^}]+)\}\s*from\s*['"](@egret\/[^'"]+)['"]/g))
    for (const item of list.split(',')) if (item.trim()) found.push({ entry: from, name: item.trim().split(/\s+as\s+/)[0] });
  for (const [, from] of text.matchAll(/import\(\s*['"](@egret\/[^'"]+)['"]\s*\)/g)) found.push({ entry: from, name: '*' });
  // A backend chosen at run time: `const backend = await (... import('@egret/...') ...)`, then its names by
  // destructuring or as members. They are recorded under the first entry the expression names.
  for (const [, variable, from] of text.matchAll(/(?:const|let)\s+(\w+)\s*=\s*await\b[^;]*?import\(\s*['"](@egret\/[^'"]+)['"]/g)) {
    const names = new Set();
    for (const [, list] of text.matchAll(new RegExp('(?:const|let)\\s*\\{([^}]+)\\}\\s*=\\s*' + variable + '\\b', 'g')))
      for (const item of list.split(',')) if (item.trim()) names.add(item.trim().split(/\s*:\s*/)[0]);
    for (const [, name] of text.matchAll(new RegExp('\\b' + variable + '\\??\\.([A-Za-z_$][\\w$]*)', 'g'))) names.add(name);
    for (const name of names) found.push({ entry: from, name });
  }
  return found;
}

const FIX =
  /\b(fix(e[sd])?|repair|restore|stabili[sz]e|prevent|avoid|correct|keep|allow|broken|regression|crash|stutter|stall|hitch|freeze|stuck|lag|latency|missing|wrong|no longer|instead of|before (play|first)|readab\w*)\b/i;
const AREAS = [
  ['input', /input|touch|pointer|gamepad|keyboard|mouse/i],
  ['audio', /audio|music|sound|voice/i],
  ['loading', /asset|model|loader|boot|preload|manifest/i],
  ['rendering', /view|scene|shader|grime|texture|light|shadow|material|render|water|reflection/i],
  ['interface', /hud|\.css$|text\.mjs|index\.html|ui/i],
  ['rules', /sim\.mjs|data\.mjs|bot\.mjs|toys|level|track\.mjs/i],
  ['engine-refresh', /^vendor\//i],
  ['tests', /test/i]
];
/** Where a commit's change mostly is, by the files it touched. */
export function areaOf(files) {
  const counts = new Map();
  for (const file of files) {
    const area = AREAS.find(([, pattern]) => pattern.test(file.path))?.[0] ?? 'other';
    counts.set(area, (counts.get(area) ?? 0) + file.added + file.deleted);
  }
  return [...counts].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0]?.[0] ?? 'other';
}

/** Commits that changed a game, with subject, files outside vendor/ and size, and whether they fixed something. */
function commitsOf(clone, commit, game) {
  const log = git(clone, ['log', commit, '--no-merges', '--format=@%H%x09%ad%x09%s', '--date=short', '--numstat', '--', game]);
  const commits = [];
  for (const line of log.split('\n')) {
    if (line.startsWith('@')) {
      const [hash, date, subject] = line.slice(1).split('\t');
      commits.push({ commit: hash, date, subject, files: [], vendorFiles: 0 });
      continue;
    }
    const stat = line.match(/^(\d+|-)\t(\d+|-)\t(.+)$/);
    if (!stat || commits.length === 0) continue;
    const file = stat[3].slice(game.length + 1);
    const entry = commits.at(-1);
    if (file.startsWith('vendor/')) entry.vendorFiles++;
    else entry.files.push({ path: file, added: Number(stat[1]) || 0, deleted: Number(stat[2]) || 0 });
  }
  for (const entry of commits) {
    entry.area = entry.files.length === 0 && entry.vendorFiles > 0 ? 'engine-refresh' : areaOf(entry.files);
    entry.size = entry.files.reduce((sum, file) => sum + file.added + file.deleted, 0);
    entry.fix = FIX.test(entry.subject);
  }
  return commits;
}

/** One game at the commit: its pin, entries, imports, tests, claims and commits. */
function harvestGame(clone, commit, game) {
  const files = git(clone, ['ls-tree', '-r', '--name-only', commit, '--', game])
    .split('\n')
    .filter(Boolean)
    .map(file => file.slice(game.length + 1));
  const source = show(clone, commit, game + '/vendor/SOURCE.md') ?? '';
  const imports = new Map();
  for (const file of files.filter(file => /\.m?js$/.test(file) && !/^(vendor|assets|node_modules)\//.test(file) && !/\/vendor\//.test(file))) {
    for (const { entry, name } of importsOf(show(clone, commit, game + '/' + file) ?? '')) {
      const key = entry + ' ' + name;
      const row = imports.get(key) ?? { entry, name, files: [] };
      row.files.push(file);
      imports.set(key, row);
    }
  }
  const tests = files
    .filter(file => /(^|\/)test\/.*\.m?js$|\.test\.m?js$/.test(file))
    .map(file => ({ file, cases: ((show(clone, commit, game + '/' + file) ?? '').match(/^\s*test\(/gm) ?? []).length }));
  const claims = {};
  for (const doc of ['README.md', 'STATUS.md'])
    if (files.includes(doc)) {
      for (const [kind, rows] of Object.entries(claimsOf(show(clone, commit, game + '/' + doc), game + '/' + doc)))
        (claims[kind] ??= []).push(...rows);
    }
  const commits = commitsOf(clone, commit, game);
  return {
    game,
    pin: source.match(SHA)?.[0] ?? null,
    entries: [...new Set(source.match(/@egret\/[a-z0-9/-]+/g) ?? [])],
    imports: [...imports.values()].sort((a, b) =>
      a.entry !== b.entry ? (a.entry < b.entry ? -1 : 1) : a.name < b.name ? -1 : a.name > b.name ? 1 : 0
    ),
    tests,
    claims,
    commits: commits.length,
    fixes: commits.filter(entry => entry.fix)
  };
}

/** Whether `older` is an ancestor of `newer` in the engine checkout, or undefined when either is unknown there. */
function isAncestor(engine, older, newer) {
  try {
    execFileSync('git', ['-C', engine, 'merge-base', '--is-ancestor', older, newer], { stdio: 'ignore' });
    return true;
  } catch (error) {
    return error.status === 1 ? false : undefined;
  }
}

/** The whole harvest: every game with a vendored engine, and what the cards should become. */
export function harvest({ clone, commit, repo = 'cnedwin/PortedGamesEgret', engine = ROOT, cards = loadCards() }) {
  const resolved = git(clone, ['rev-parse', '--verify', commit + '^{commit}']).trim();
  const games = git(clone, ['ls-tree', '-d', '--name-only', resolved])
    .split('\n')
    .filter(name => name && show(clone, resolved, name + '/vendor/SOURCE.md') !== undefined)
    .sort();
  const results = games.map(game => harvestGame(clone, resolved, game));
  const pins = new Map(results.map(result => [result.game, result.pin]));

  // A card is stale where its evidence no longer stands, or was learnt at an older engine than the game now uses.
  const stale = [];
  for (const card of cards) {
    const reasons = [];
    for (const item of card.evidence.filter(item => item.repo === repo)) {
      const text = show(clone, resolved, item.path);
      if (text === undefined) reasons.push({ reason: 'evidence-missing', path: item.path });
      else if (text.split('\n').length < item.line) reasons.push({ reason: 'evidence-line-gone', path: item.path, line: item.line });
      const game = item.path.split('/')[0],
        pin = pins.get(game);
      if (pin && pin !== item.pin) reasons.push({ reason: 'game-pin-changed', game, learntAt: item.pin, now: pin });
    }
    for (const [game, pin] of pins)
      if (pin && pin !== card.engine && isAncestor(engine, card.engine, pin))
        reasons.push({ reason: 'card-older-than-game-pin', game, card: card.engine, pin });
    if (reasons.length > 0) stale.push({ id: card.id, file: card.file, flagged: card.stale !== undefined, reasons });
  }

  // A fix is covered when its subject finds a card well; fixes nothing covers are grouped by area into proposals.
  const fixes = results.flatMap(result => result.fixes.map(fix => ({ ...fix, game: result.game })));
  const covered = [],
    uncovered = [];
  for (const fix of fixes) {
    const best = search(cards, fix.subject + ' ' + fix.area)[0];
    const row = { game: fix.game, commit: fix.commit, subject: fix.subject, area: fix.area, size: fix.size, files: fix.files.map(file => file.path) };
    if (best && best.overlap >= 20) covered.push({ ...row, card: best.card.id, score: best.overlap });
    else uncovered.push(row);
  }
  const byArea = new Map();
  for (const fix of uncovered) byArea.set(fix.area, [...(byArea.get(fix.area) ?? []), fix]);
  const missing = [...byArea]
    .map(([area, rows]) => ({
      proposal: 'missing',
      area,
      fixes: rows.length,
      games: [...new Set(rows.map(row => row.game))],
      suggestedId: area + '-' + (rows[0].subject.toLowerCase().match(/[a-z]{4,}/g) ?? ['lesson']).slice(0, 2).join('-'),
      evidence: rows.map(row => ({ repo, commit: row.commit, game: row.game, subject: row.subject, files: row.files.slice(0, 6) }))
    }))
    .sort((a, b) => b.fixes - a.fixes || (a.area < b.area ? -1 : 1));
  const repeated = [...new Set(fixes.map(fix => fix.area))]
    .map(area => {
      const rows = fixes.filter(fix => fix.area === area);
      return { area, fixes: rows.length, games: [...new Set(rows.map(row => row.game))].sort(), cards: [...new Set(covered.filter(row => row.area === area).map(row => row.card))].sort() };
    })
    .filter(row => row.fixes >= 2)
    .sort((a, b) => b.fixes - a.fixes || (a.area < b.area ? -1 : 1));

  return {
    schema: 'egret.guide-harvest/1',
    repo,
    commit: resolved,
    games: results,
    proposals: { stale, missing, repeated, covered }
  };
}

function main(args) {
  const options = {};
  for (let i = 0; i < args.length; i += 2) {
    if (!['--games', '--commit', '--out', '--repo'].includes(args[i]) || args[i + 1] === undefined)
      throw new TypeError('Usage: node tools/harvest-games.mjs --games <clone> --commit <commit> --out <new directory> [--repo <owner/name>]');
    options[args[i].slice(2)] = args[i + 1];
  }
  if (!options.games || !options.commit || !options.out) throw new TypeError('--games, --commit and --out are required');
  const out = path.resolve(options.out),
    inside = path.relative(ROOT, out);
  if (!inside.startsWith('..') && !path.isAbsolute(inside) && !/^work[\\/]/.test(inside))
    throw new TypeError('The harvest is private working data: write it outside the repository or under work/');
  if (fs.existsSync(out)) throw new TypeError('The output directory must not exist yet: ' + out);
  const result = harvest({ clone: path.resolve(options.games), commit: options.commit, ...(options.repo ? { repo: options.repo } : {}) });
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'harvest.json'), JSON.stringify(result, null, 2) + '\n');
  fs.writeFileSync(path.join(out, 'proposals.json'), JSON.stringify(result.proposals, null, 2) + '\n');
  const { stale, missing, repeated } = result.proposals;
  const lines = [
    `Harvested ${result.games.length} games of ${result.repo} at ${result.commit.slice(0, 9)} into ${out}`,
    ...result.games.map(
      game => `  ${game.game}: engine ${game.pin?.slice(0, 9) ?? 'unknown'}, ${game.imports.length} names imported, ${game.tests.length} test files, ${game.fixes.length} of ${game.commits} commits fixed something`
    ),
    `Repeated fixes by area: ${repeated.map(row => `${row.area} ${row.fixes} (${row.cards.join(', ') || 'no card'})`).join('; ') || 'none'}`,
    `Cards to review as stale: ${stale.map(row => row.id + (row.flagged ? ' (flagged)' : '')).join(', ') || 'none'}`,
    `Cards proposed as missing: ${missing.map(row => `${row.suggestedId} from ${row.fixes} fixes`).join(', ') || 'none'}`
  ];
  process.stdout.write(lines.join('\n') + '\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv.slice(2));
