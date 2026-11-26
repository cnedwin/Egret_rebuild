// SPDX-License-Identifier: Apache-2.0
// The agent benchmark: the same twelve briefs, started the same way and scored the same way, so that a run of Codex, of
// Claude Code or of any coding agent on this engine can be compared with another run, and an engine change with the one
// before it. knowledge-base/en/docs/agent-bench.md gives the protocol.
//
//   node tools/agent-bench.mjs list
//   node tools/agent-bench.mjs brief <id>
//   node tools/agent-bench.mjs start <id> <new folder> [--language en|zh] [--agent <name>] [--model <name>]
//   node tools/agent-bench.mjs score <folder> [--playwright <index.mjs>] [--minutes <n>] [--interventions <n>]
//   node tools/agent-bench.mjs table <score.json>...
//
// `start` makes the game with `egret new` for the brief's kind of game and target, puts the brief in it as BRIEF.md (in
// English, or in Chinese with --language zh: runs in the two languages are two series, not one), and
// writes what it started from beside the folder (<folder>.bench.json), where the agent working in the folder does not
// see it. `score` measures the folder as it is: its own tests, `egret check`, a browser run through verify-game, its
// engine notes, and how much of the starter it replaced. It writes <folder>.score.json with the list of what the brief and
// the recipe ask, for a person who plays the game to mark. Nothing is sent anywhere and no model is asked.
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { checkGame } from './egret-check.mjs';
import { GUIDE, ROOT, loadCards } from './egret-guide.mjs';
import { parseNotes } from './egret-notes.mjs';
import { newGame } from './egret.mjs';

export const BRIEFS = path.join(ROOT, 'tools', 'agent-bench', 'briefs');
/** What the agent is told, the same for every brief and every agent, in the language of the run. */
export const PROMPT = Object.freeze({
  en: 'Make the game that BRIEF.md describes, in this folder.',
  zh: '在这个文件夹里做出 BRIEF.md 描述的游戏。'
});
/**
 * What a healthy game scores, by measure: the parts of `health`. Warnings count only when there is no error, and the
 * engine's warnings only for a browser run that passed.
 */
export const POINTS = Object.freeze({
  tests: 30,
  checkErrors: 25,
  checkWarnings: 5,
  verify: 30,
  engineWarnings: 5,
  notes: 5
});

/** A brief: its front matter (id, genre, target, title), its text in English and, after `--- zh ---`, in Chinese. */
export function parseBrief(text, file = 'brief') {
  const found = text.match(/^---\n([\s\S]*?)\n---\n\n([\s\S]*?)\n\n--- zh ---\n\n([\s\S]*)$/);
  if (!found) throw new Error(`${file}: front matter, the brief, then --- zh --- and the brief in Chinese`);
  const brief = { text: { en: found[2].trim(), zh: found[3].trim() } };
  for (const line of found[1].split('\n')) {
    const field = line.match(/^(id|genre|target|title): (.+)$/);
    if (!field) throw new Error(`${file}: unknown line ${JSON.stringify(line)}`);
    brief[field[1]] = field[2].trim();
  }
  for (const key of ['id', 'genre', 'target', 'title']) if (!brief[key]) throw new Error(`${file}: no ${key}`);
  return brief;
}

export function loadBriefs(folder = BRIEFS) {
  return fs
    .readdirSync(folder)
    .filter(name => name.endsWith('.txt'))
    .sort()
    .map(name => parseBrief(fs.readFileSync(path.join(folder, name), 'utf8'), name));
}

/** The brief's asks, a sentence each, without the last paragraph, which says how to work and is the same for all. */
export function briefAsks(brief, language = 'en') {
  const [asks] = brief.text[language].split(/\n\n/);
  return asks
    .split(language === 'zh' ? /(?<=[。！？])/ : /(?<=[.!?])\s+(?=[A-Z])/)
    .map(sentence => sentence.trim())
    .filter(Boolean);
}

/** What the recipe of a kind of game says done means, less the commands, which `health` measures: an item each. */
export function recipeAsks(card) {
  const done = card.body.match(/\*\*Done means\.\*\*\s*([^\n]+)/);
  if (!done) return [];
  return done[1]
    .split(/(?<=\.)\s+/)
    .filter(sentence => !/`(npm test|node vendor\/egret\.mjs)/.test(sentence))
    .flatMap(sentence => sentence.replace(/\.$/, '').split(/;\s+/))
    .map(item => item.trim())
    .filter(Boolean)
    .map(item => item[0].toUpperCase() + item.slice(1) + '.');
}

const hash = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
/** The game's own files under `src/` and `test/`, by path, with their hashes. */
function ownFiles(folder) {
  const files = {};
  for (const top of ['src', 'test']) {
    const walk = dir => {
      if (!fs.existsSync(dir)) return;
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.isFile()) files[path.relative(folder, full).split(path.sep).join('/')] = hash(full);
      }
    };
    walk(path.join(folder, top));
  }
  return files;
}
const countTests = (folder, files) =>
  Object.keys(files)
    .filter(name => name.startsWith('test/'))
    .reduce((sum, name) => sum + (fs.readFileSync(path.join(folder, name), 'utf8').match(/^test\(/gm) ?? []).length, 0);

const recordOf = folder => path.resolve(folder) + '.bench.json';
const scoreOf = folder => path.resolve(folder) + '.score.json';

export async function start(args, cwd = process.cwd()) {
  const named = {},
    rest = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--agent' || args[i] === '--model' || args[i] === '--language') {
      if (args[i + 1] === undefined) return { code: 2, text: `${args[i]} takes a name.\n` };
      named[args[i].slice(2)] = args[++i];
    } else if (args[i].startsWith('--')) return { code: 2, text: `Unknown option ${args[i]}.\n` };
    else rest.push(args[i]);
  }
  if (rest.length !== 2) return { code: 2, text: 'Name the brief and the new folder.\n' };
  const language = named.language ?? 'en';
  if (!(language in PROMPT)) return { code: 2, text: 'The language is en or zh.\n' };
  const brief = loadBriefs().find(one => one.id === rest[0]);
  if (!brief)
    return {
      code: 2,
      text: `No brief ${rest[0]}: ${loadBriefs()
        .map(one => one.id)
        .join(', ')}.\n`
    };
  const folder = path.resolve(cwd, rest[1]);
  if (fs.existsSync(recordOf(folder))) return { code: 2, text: `${recordOf(folder)} is there already.\n` };
  const made = await newGame([folder, '--title', brief.title, '--target', brief.target, '--genre', brief.genre], cwd);
  if (made.code !== 0) return made;
  fs.writeFileSync(path.join(folder, 'BRIEF.md'), `# ${brief.title}\n\n${brief.text[language]}\n`);
  const starter = ownFiles(folder);
  const source = fs.readFileSync(path.join(folder, 'vendor', 'SOURCE.md'), 'utf8');
  const record = {
    schemaVersion: 1,
    brief: brief.id,
    genre: brief.genre,
    target: brief.target,
    language,
    engine: source.match(/commit `([0-9a-f]{7,40})`/)?.[1] ?? null,
    startedAt: new Date().toISOString(),
    agent: named.agent ?? null,
    model: named.model ?? null,
    minutes: null,
    interventions: null,
    prompt: PROMPT[language],
    starter: { files: starter, readme: hash(path.join(folder, 'README.md')), tests: countTests(folder, starter) }
  };
  fs.writeFileSync(recordOf(folder), JSON.stringify(record, null, 2) + '\n');
  return {
    code: 0,
    text:
      `${brief.id} (${brief.genre}, ${brief.target}) is ready in ${folder}; what it started from is in ${recordOf(folder)}.\n` +
      `Start the agent in that folder with one message, and nothing more: ${PROMPT[language]}\n` +
      `When it says it is done: node tools/agent-bench.mjs score ${rest[1]} --minutes <n> --interventions <n>\n`
  };
}

/**
 * The game's own tests, as its package.json runs them, or else every test/**∕*.test.mjs under `node --test`, as the
 * games of the games repository run theirs; the counts of the Node test runner when it prints them.
 */
function runTests(folder) {
  const manifest = path.join(folder, 'package.json');
  const script = fs.existsSync(manifest) ? JSON.parse(fs.readFileSync(manifest, 'utf8')).scripts?.test : undefined;
  const files = Object.keys(ownFiles(folder)).filter(name => /^test\/.*\.test\.mjs$/.test(name));
  if (!script && !files.length) return { ran: false, why: 'no test script and no test/*.test.mjs' };
  // The game's tests report to their own output, not to a test runner this runs under.
  const { NODE_TEST_CONTEXT: _, ...env } = process.env;
  env.PATH = [path.join(folder, 'node_modules', '.bin'), path.dirname(process.execPath), env.PATH].join(path.delimiter);
  const options = { cwd: folder, env, encoding: 'utf8', timeout: 300_000 };
  const run = script
    ? spawnSync(script, { ...options, shell: true })
    : spawnSync(process.execPath, ['--test', ...files], options);
  const count = name => Number(run.stdout?.match(new RegExp(`^ℹ ${name} (\\d+)$`, 'm'))?.[1] ?? NaN);
  const total = count('tests'),
    failed = count('fail');
  return {
    ran: true,
    pass: run.status === 0 && (Number.isNaN(total) || (total > 0 && failed === 0)),
    total: Number.isNaN(total) ? null : total,
    failed: Number.isNaN(failed) ? null : failed,
    failing: run.status === 0 ? undefined : failingOf(`${run.stdout ?? ''}${run.stderr ?? ''}`)
  };
}

/** The names of the failing tests the Node test runner lists, or the last lines of what failed to run. */
function failingOf(output) {
  const lines = output.trim().split('\n');
  const failing = lines.filter(line => /^✖ /.test(line) && !/^✖ failing tests:/.test(line));
  return (
    [...new Set(failing.map(line => line.replace(/ \([\d.]+ms\)$/, '')))].slice(0, 10).join('\n') ||
    lines.slice(-8).join('\n')
  );
}

/** Playwright's index.mjs: the one named, the one the folder or this checkout can import, or undefined. */
function findPlaywright(named, folder) {
  if (named) return path.resolve(named);
  for (const from of [folder, ROOT])
    try {
      const pkg = createRequire(path.join(from, 'package.json')).resolve('playwright/package.json');
      return path.join(path.dirname(pkg), 'index.mjs');
    } catch {
      /* not there */
    }
  return undefined;
}

/** A blind browser run of index.html through verify-game, its report kept beside the folder. */
function runVerify(folder, playwright) {
  if (!playwright) return { ran: false, why: 'no Playwright: install it or name it with --playwright' };
  const out = path.resolve(folder) + '.verify';
  fs.rmSync(out, { recursive: true, force: true });
  const tool = path.join(ROOT, 'tools', 'verify-game.mjs');
  const run = spawnSync(process.execPath, [tool, playwright, path.join(folder, 'index.html'), out], {
    encoding: 'utf8',
    timeout: 600_000
  });
  const file = path.join(out, 'report.json');
  if (!fs.existsSync(file))
    return { ran: false, why: `verify-game wrote no report: ${(run.stderr || run.stdout || '').trim().slice(-300)}` };
  const report = JSON.parse(fs.readFileSync(file, 'utf8'));
  return {
    ran: true,
    pass: report.pass === true,
    failed: Object.entries(report.checks ?? {})
      .filter(([, check]) => !check.pass)
      .map(([name]) => name),
    engineWarnings: (report.engineWarnings ?? []).map(warning => warning.code),
    report: path
      .relative(path.dirname(path.resolve(folder)), file)
      .split(path.sep)
      .join('/')
  };
}

/** What the folder scores now; `options.playwright` names Playwright, `options.browser === false` skips the run. */
export function scoreGame(folder, options = {}) {
  folder = path.resolve(folder);
  const record = fs.existsSync(recordOf(folder)) ? JSON.parse(fs.readFileSync(recordOf(folder), 'utf8')) : undefined;
  const tests = runTests(folder);
  const vendored = path.join(folder, 'vendor', 'egret');
  // The names of the game's own engine copy when it carries them; those of this checkout otherwise.
  const root = fs.existsSync(path.join(vendored, 'exports.json')) ? vendored : ROOT;
  const found = checkGame(folder, root, { resolvedGuide: GUIDE }).findings;
  const check = {
    errors: found.filter(item => item.severity === 'error').length,
    warnings: found.filter(item => item.severity !== 'error').length,
    rules: [...new Set(found.map(item => item.rule))]
  };
  const verify =
    options.browser === false
      ? { ran: false, why: 'not asked' }
      : runVerify(folder, findPlaywright(options.playwright, folder));
  const notesFile = path.join(folder, 'ENGINE-NOTES.md');
  const parsed = fs.existsSync(notesFile)
    ? parseNotes(fs.readFileSync(notesFile, 'utf8'), path.basename(folder))
    : undefined;
  const notes = parsed
    ? {
        present: true,
        notes: parsed.length,
        problems: parsed.flatMap(note => note.problems.map(p => `${note.id} ${p}`))
      }
    : { present: false, notes: 0, problems: [] };

  const parts = {
    tests: tests.ran && tests.pass ? POINTS.tests : 0,
    checkErrors: check.errors === 0 ? POINTS.checkErrors : 0,
    checkWarnings: check.errors === 0 && check.warnings === 0 ? POINTS.checkWarnings : 0,
    verify: verify.ran && verify.pass ? POINTS.verify : 0,
    // A page that does not run warns of nothing: no warnings count only for a run that passed.
    engineWarnings: verify.ran && verify.pass && verify.engineWarnings.length === 0 ? POINTS.engineWarnings : 0,
    notes: notes.present && notes.problems.length === 0 ? POINTS.notes : 0
  };
  const notRun = [...(tests.ran ? [] : ['tests']), ...(verify.ran ? [] : ['verify', 'engineWarnings'])];
  const of = Object.entries(POINTS)
    .filter(([name]) => !notRun.includes(name))
    .reduce((sum, [, points]) => sum + points, 0);

  let change = null,
    review = null;
  if (record) {
    const now = ownFiles(folder);
    const starterSrc = Object.keys(record.starter.files).filter(name => name.startsWith('src/'));
    const replaced = starterSrc.filter(name => now[name] !== record.starter.files[name]).length;
    change = {
      starterSourceReplaced: starterSrc.length ? replaced / starterSrc.length : 0,
      filesAdded: Object.keys(now).filter(name => !(name in record.starter.files)).length,
      testsAdded: Math.max(0, countTests(folder, now) - record.starter.tests),
      readmeRewritten:
        fs.existsSync(path.join(folder, 'README.md')) && hash(path.join(folder, 'README.md')) !== record.starter.readme
    };
    const brief = loadBriefs().find(one => one.id === record.brief);
    const card = loadCards().find(one => one.id === 'genre-' + record.genre);
    const items = [
      ...(brief ? briefAsks(brief, record.language ?? 'en').map(item => ({ from: 'brief', item, met: null })) : []),
      ...(card ? recipeAsks(card).map(item => ({ from: 'recipe', item, met: null })) : [])
    ];
    // A person's marks survive a score taken again.
    const before = fs.existsSync(scoreOf(folder))
      ? JSON.parse(fs.readFileSync(scoreOf(folder), 'utf8')).review?.items
      : [];
    for (const one of items) one.met = before?.find(old => old.item === one.item)?.met ?? null;
    review = {
      items,
      met: items.filter(one => one.met === true).length,
      marked: items.filter(one => one.met !== null).length,
      of: items.length
    };
  }
  return {
    schemaVersion: 1,
    folder: path.basename(folder),
    brief: record?.brief ?? null,
    agent: record?.agent ?? null,
    model: record?.model ?? null,
    engine: record?.engine ?? null,
    minutes: options.minutes ?? record?.minutes ?? null,
    interventions: options.interventions ?? record?.interventions ?? null,
    scoredAt: new Date().toISOString(),
    health: { points: Object.values(parts).reduce((a, b) => a + b, 0), of, parts, notRun },
    tests,
    check,
    verify,
    notes,
    change,
    review
  };
}

const share = value => `${Math.round(value * 100)}%`;
/** The scores as a Markdown table, a row each. */
export function table(scores) {
  const rows = [
    '| Brief | Agent | Model | Health | Brief met | Starter replaced | Tests added | Minutes | Interventions | Not run |',
    '|---|---|---|---|---|---|---|---|---|---|'
  ];
  for (const one of scores)
    rows.push(
      '| ' +
        [
          one.brief ?? one.folder,
          one.agent ?? '–',
          one.model ?? '–',
          `${one.health.points}/${one.health.of}`,
          one.review
            ? one.review.marked < one.review.of
              ? `${one.review.met}/${one.review.of} (${one.review.of - one.review.marked} unmarked)`
              : `${one.review.met}/${one.review.of}`
            : '–',
          one.change ? share(one.change.starterSourceReplaced) : '–',
          one.change ? String(one.change.testsAdded) : '–',
          one.minutes ?? '–',
          one.interventions ?? '–',
          one.health.notRun.join(', ') || '–'
        ].join(' | ') +
        ' |'
    );
  return rows.join('\n') + '\n';
}

function report(score) {
  const lines = [`${score.folder}: health ${score.health.points}/${score.health.of}`];
  lines.push(
    `  tests: ${score.tests.ran ? (score.tests.pass ? `pass (${score.tests.total ?? '?'})` : `fail\n${score.tests.failing.replace(/^/gm, '    ')}`) : 'not run, ' + score.tests.why}`
  );
  lines.push(
    `  check: ${score.check.errors} errors, ${score.check.warnings} warnings${score.check.rules.length ? ' (' + score.check.rules.join(', ') + ')' : ''}`
  );
  lines.push(
    `  verify: ${score.verify.ran ? (score.verify.pass ? 'pass' : 'fail: ' + score.verify.failed.join(', ')) + (score.verify.engineWarnings.length ? '; engine warned ' + score.verify.engineWarnings.join(', ') : '') : 'not run, ' + score.verify.why}`
  );
  lines.push(
    `  notes: ${score.notes.present ? `${score.notes.notes} notes, ${score.notes.problems.length} problems` : 'no ENGINE-NOTES.md'}`
  );
  if (score.change)
    lines.push(
      `  change: ${share(score.change.starterSourceReplaced)} of the starter's source replaced, ${score.change.filesAdded} files added, ${score.change.testsAdded} tests added, README ${score.change.readmeRewritten ? 'rewritten' : 'as started'}`
    );
  if (score.review)
    lines.push(
      `  review: ${score.review.met} of ${score.review.of} met, ${score.review.of - score.review.marked} to mark in ${score.folder}.score.json`
    );
  return lines.join('\n') + '\n';
}

function usage() {
  return [
    'Usage:',
    '  node tools/agent-bench.mjs list                                             the briefs',
    '  node tools/agent-bench.mjs brief <id>                                       one brief',
    '  node tools/agent-bench.mjs start <id> <new folder> [--language en|zh] [--agent <n>] [--model <n>]   a game for an agent',
    '  node tools/agent-bench.mjs score <folder> [--playwright <index.mjs>] [--no-browser] [--minutes <n>] [--interventions <n>]',
    '  node tools/agent-bench.mjs table <score.json>...                            scores side by side',
    ''
  ].join('\n');
}

/** Runs the command line and returns what to print and the exit code, so tests need no child process. */
export async function main(args, cwd = process.cwd()) {
  const [command, ...rest] = args;
  switch (command) {
    case 'list':
      return {
        code: 0,
        text:
          loadBriefs()
            .map(one => `${one.id.padEnd(12)} ${one.genre.padEnd(15)} ${one.target.padEnd(7)} ${one.title}`)
            .join('\n') + '\n'
      };
    case 'brief': {
      const brief = loadBriefs().find(one => one.id === rest[0]);
      return brief
        ? { code: 0, text: `# ${brief.title}\n\n${brief.text.en}\n\n${brief.text.zh}\n` }
        : { code: 2, text: usage() };
    }
    case 'start':
      return start(rest, cwd);
    case 'score': {
      const options = {},
        folders = [];
      for (let i = 0; i < rest.length; i++) {
        const arg = rest[i];
        if (arg === '--no-browser') options.browser = false;
        else if (['--playwright', '--minutes', '--interventions'].includes(arg)) {
          if (rest[i + 1] === undefined) return { code: 2, text: `${arg} takes a value.\n` };
          const value = rest[++i];
          if (arg === '--playwright') options.playwright = path.resolve(cwd, value);
          else if (!/^\d+$/.test(value)) return { code: 2, text: `${arg} takes a whole number.\n` };
          else options[arg.slice(2)] = Number(value);
        } else if (arg.startsWith('--')) return { code: 2, text: `Unknown option ${arg}.\n` };
        else folders.push(arg);
      }
      if (folders.length !== 1) return { code: 2, text: usage() };
      const folder = path.resolve(cwd, folders[0]);
      if (!fs.existsSync(path.join(folder, 'index.html'))) return { code: 2, text: `No game in ${folder}.\n` };
      const score = scoreGame(folder, options);
      fs.writeFileSync(scoreOf(folder), JSON.stringify(score, null, 2) + '\n');
      return { code: 0, text: report(score) + `Written to ${scoreOf(folder)}.\n` };
    }
    case 'table': {
      if (!rest.length) return { code: 2, text: usage() };
      return { code: 0, text: table(rest.map(file => JSON.parse(fs.readFileSync(path.resolve(cwd, file), 'utf8')))) };
    }
    default:
      return { code: command === undefined || command === 'help' ? 0 : 2, text: usage() };
  }
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const { code, text } = await main(process.argv.slice(2));
  process.stdout.write(text);
  process.exitCode = code;
}
