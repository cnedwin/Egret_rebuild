// SPDX-License-Identifier: Apache-2.0
// `egret check`: reads a game's own files, not its engine copy, for the mistakes agents make most with this engine.
// Each finding names the file and line, says what to do, and names the card that explains it. An agent runs it after a
// change, before it runs the game, because a page that imports a name the engine does not have fails before it draws.
//
// The rules, from the guide's cards and the games' engine notes:
//
//   unknown-entry       error    an @egret/engine specifier that is not an entry of the engine
//   unknown-name        error    a name the entry does not export (with the entry that does, or the nearest name)
//   entry-not-in-copy   error    an entry the engine copy was not made with (vendor/importmap.json)
//   entry-not-in-page   error    an entry the page's own import map leaves out
//   engine-internals    warning  a file of the engine copy imported by its path, or a private #egret- name
//   text-in-update      warning  text or a texture made in update, every frame, instead of once
//   stale-workaround    warning  a workaround for a fault the engine copy has resolved
//   bare-storage        warning  localStorage written without the save store's care for full or private storage
//   notes-resolved      warning  ENGINE-NOTES still marks open a fault the engine copy has resolved
import fs from 'node:fs';
import path from 'node:path';
import { parseNotes, readNotesAgainst, readResolved } from './egret-notes.mjs';

const SKIP = new Set(['vendor', 'node_modules', '.git', 'dist', 'out', 'build', 'coverage']);
const SOURCE = /\.(?:m?js|html)$/;
const MAX_BYTES = 2 * 1024 * 1024;
export const RULES = Object.freeze({
  'unknown-entry': { severity: 'error', card: 'choose-entry' },
  'unknown-name': { severity: 'error', card: 'choose-entry' },
  'entry-not-in-copy': { severity: 'error', card: 'vendor-engine' },
  'entry-not-in-page': { severity: 'error', card: 'vendor-engine' },
  'engine-internals': { severity: 'warning', card: 'vendor-engine' },
  'text-in-update': { severity: 'warning', card: 'label-pages' },
  'stale-workaround': { severity: 'warning', card: 'play-page-controls' },
  'bare-storage': { severity: 'warning', card: 'save-data' },
  'notes-resolved': { severity: 'warning', card: 'engine-notes' }
});

/** Every name each public entry exports, from the engine copy's exports.json or this repository's API reference. */
export function readExports(root) {
  const kit = path.join(root, 'exports.json');
  if (fs.existsSync(kit))
    return new Map(Object.entries(JSON.parse(fs.readFileSync(kit, 'utf8')).entries).map(([k, v]) => [k, new Set(v)]));
  return exportsFromReference(
    fs.readFileSync(path.join(root, 'knowledge-base', 'en', 'docs', 'api-reference.md'), 'utf8')
  );
}

/** The entries and names of the generated API reference: a `## \`entry\`` heading, then a row per name. */
export function exportsFromReference(text) {
  const entries = new Map();
  let entry;
  for (const line of text.split('\n')) {
    const head = line.match(/^## `(@egret\/[^`]+)`/);
    if (head) entries.set((entry = head[1]), new Set());
    const row = line.match(/^\| `([^`]+)` \|/);
    if (row && entry) entries.get(entry).add(row[1]);
  }
  return entries;
}

/** The game's own source files: scripts and pages outside vendor/, node_modules/ and build output. */
export function sourceFiles(folder) {
  const files = [];
  const walk = dir => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
      if (entry.name.startsWith('.') && entry.name !== '.') continue;
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!SKIP.has(entry.name)) walk(file);
      } else if (SOURCE.test(entry.name) && fs.statSync(file).size <= MAX_BYTES) files.push(file);
    }
  };
  walk(folder);
  return files;
}

const lineOf = (text, index) => text.slice(0, index).split('\n').length;
const IMPORT =
  /\b(?:import|export)\s*(?:(\*\s+as\s+[\w$]+|[\w$]+(?:\s*,\s*\{[^}]*\})?|\{[^}]*\})\s*from\s*)?['"]([^'"\n]+)['"]|\bimport\(\s*['"]([^'"\n]+)['"]\s*\)/g;

/** The imports of one file: specifier, the names asked for (undefined for `* as`, a default or a dynamic import), line. */
export function importsOf(text) {
  const found = [];
  for (const match of text.matchAll(IMPORT)) {
    const specifier = match[2] ?? match[3];
    const clause = match[1]?.trim();
    let names;
    const braces = clause?.match(/\{([^}]*)\}/);
    if (braces)
      names = braces[1]
        .split(',')
        .map(item => item.trim().replace(/^type\s+/, ''))
        .filter(Boolean)
        .map(item => item.split(/\s+as\s+/)[0].trim());
    const isDefault = clause !== undefined && /^[\w$]+/.test(clause) && !clause.startsWith('*');
    found.push({ specifier, names, isDefault, line: lineOf(text, match.index) });
  }
  return found;
}

/** The edit distance of two names, for the nearest name an entry does export. */
function distance(a, b) {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let previous = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const kept = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
      previous = kept;
    }
  }
  return row[b.length];
}

function nearest(name, names) {
  let best,
    score = Infinity;
  for (const candidate of names) {
    const d = distance(name.toLowerCase(), candidate.toLowerCase());
    if (d < score) [best, score] = [candidate, d];
  }
  return score <= Math.max(2, Math.floor(name.length / 4)) ? best : undefined;
}

/** The body of each `update` the file defines: a play option, a method or a function of that name. */
export function updateBodies(text) {
  const bodies = [];
  for (const match of text.matchAll(/\bupdate\s*(?::\s*(?:async\s*)?(?:function\s*)?)?\(([^)]*)\)\s*(?:=>\s*)?\{/g)) {
    let depth = 0,
      at = match.index + match[0].length - 1;
    const start = at;
    for (; at < text.length; at++) {
      const c = text[at];
      if (c === '{') depth++;
      else if (c === '}' && --depth === 0) break;
    }
    bodies.push({ start, end: at, text: text.slice(start, at) });
  }
  return bodies;
}

/** Findings for one game folder. `root` is the folder this command runs from: the repository, or vendor/egret. */
export function checkGame(folder, root, { resolvedGuide } = {}) {
  const findings = [];
  const add = (rule, file, line, message) =>
    findings.push({ rule, severity: RULES[rule].severity, card: RULES[rule].card, file, line, message });
  const exportsByEntry = readExports(root);
  const allNames = new Map();
  for (const [entry, names] of exportsByEntry)
    for (const name of names) allNames.set(name, [...(allNames.get(name) ?? []), entry]);
  const copyMapFile = path.join(folder, 'vendor', 'importmap.json');
  const copyMap = fs.existsSync(copyMapFile) ? JSON.parse(fs.readFileSync(copyMapFile, 'utf8')).imports : undefined;
  const resolved =
    resolvedGuide && fs.existsSync(path.join(resolvedGuide, 'resolved.json')) ? readResolved(resolvedGuide) : [];
  const fixed = topic => resolved.some(entry => entry.topic === topic && entry.status === 'resolved');
  const files = sourceFiles(folder);
  // The page's own import map, unless it loads the engine copy's importmap.js, which holds every entry of the copy.
  const page = path.join(folder, 'index.html');
  const pageText = fs.existsSync(page) ? fs.readFileSync(page, 'utf8') : '';
  let pageMap;
  if (!/vendor\/importmap\.js/.test(pageText)) {
    const inline = pageText.match(/<script type="importmap">([\s\S]*?)<\/script>/);
    if (inline)
      try {
        pageMap = JSON.parse(inline[1]).imports ?? {};
      } catch {
        add(
          'entry-not-in-page',
          'index.html',
          lineOf(pageText, inline.index),
          'The import map of the page is not JSON.'
        );
      }
  }
  let used = 0;
  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    const relative = path.relative(folder, file).split(path.sep).join('/');
    for (const item of importsOf(text)) {
      const spec = item.specifier;
      if (/(^|\/)vendor\/[^'"]*\/dist\//.test(spec) || spec.startsWith('#egret-')) {
        add(
          'engine-internals',
          relative,
          item.line,
          `${spec} is a file inside the engine copy, whose layout changes with every copy. Import the public entry it belongs to (an @egret/ name) instead.`
        );
        continue;
      }
      if (!spec.startsWith('@egret/')) continue;
      used++;
      const names = exportsByEntry.get(spec);
      // The engine's other packages (@egret/contracts, @egret/runtime) are copied when an entry needs them; their names
      // are not checked here.
      if (!names && !spec.startsWith('@egret/engine')) {
        if (copyMap && !(spec in copyMap))
          add(
            'entry-not-in-copy',
            relative,
            item.line,
            `The engine copy has no ${spec}. Import an @egret/engine entry, or copy the engine again with ${spec} named.`
          );
        continue;
      }
      if (!names) {
        const near = nearest(spec, exportsByEntry.keys());
        add(
          'unknown-entry',
          relative,
          item.line,
          `${spec} is not an entry of the engine.${near ? ` The nearest is ${near}.` : ''}`
        );
        continue;
      }
      if (copyMap && !(spec in copyMap))
        add(
          'entry-not-in-copy',
          relative,
          item.line,
          `The engine copy was made without ${spec}: copy the engine again with that entry added (tools/vendor-game.mjs <game> ... ${spec}).`
        );
      if (pageMap && !(spec in pageMap))
        add(
          'entry-not-in-page',
          relative,
          item.line,
          `index.html's import map has no ${spec}: paste vendor/importmap.json into it again, or load vendor/importmap.js.`
        );
      if (item.isDefault)
        add(
          'unknown-name',
          relative,
          item.line,
          `${spec} has no default export: import the names it exports, in braces.`
        );
      for (const name of item.names ?? []) {
        if (names.has(name)) continue;
        const elsewhere = allNames.get(name);
        const near = nearest(name, names);
        add(
          'unknown-name',
          relative,
          item.line,
          `${name} is not exported by ${spec}.` +
            (elsewhere
              ? ` It is exported by ${elsewhere.join(', ')}.`
              : near
                ? ` Did you mean ${near}?`
                : ' Look it up with the guide, by what it should do.')
        );
      }
    }
    // Tests and tools drive the page from outside: the rules about the game's own frames and storage are for its code.
    const own = !/^(?:test|tests|tools)\//.test(relative);
    if (own)
      for (const body of updateBodies(text))
        for (const match of body.text.matchAll(
          /\b(game\.text|createLabel|createAtlasLabel|textureFromCanvas|textureFromPixels)\s*\(/g
        ))
          add(
            'text-in-update',
            relative,
            lineOf(text, body.start + match.index),
            `${match[1]}() in update makes new text or a new texture every frame. Make it once in setup and change it (label.text = …) when it changes.`
          );
    if (
      fixed('play-page-keys') &&
      /addEventListener\(\s*['"]keydown['"][\s\S]{0,400}?stopPropagation\(\)[\s\S]{0,200}?,\s*(?:true|\{\s*capture:\s*true)/.test(
        text
      ) &&
      /@egret\/engine\/play/.test(text)
    ) {
      const at = text.search(/addEventListener\(\s*['"]keydown['"]/);
      add(
        'stale-workaround',
        relative,
        lineOf(text, at),
        'A capture-phase keydown listener that stops keys for play is no longer needed: an embedded play takes keys only while its canvas has the focus, and this listener now stops the game hearing them.'
      );
    }
    if (fixed('play-clear-holder')) {
      const at = text.search(/canvas\.parentElement\.style\.background\s*=\s*['"]transparent['"]/);
      if (at >= 0)
        add(
          'stale-workaround',
          relative,
          lineOf(text, at),
          'play({ transparent: true }) already clears its holder; this line can go.'
        );
    }
    for (const match of own ? text.matchAll(/\blocalStorage\.setItem\s*\(/g) : []) {
      const before = text.slice(Math.max(0, match.index - 300), match.index);
      // A storage adapter (`setItem: (key, value) => localStorage.setItem(key, value)`) handed to the save store is fine.
      const line = text.slice(text.lastIndexOf('\n', match.index) + 1, match.index);
      if (!/\btry\s*\{[^}]*$/.test(before) && !/\bsetItem\s*:/.test(line))
        add(
          'bare-storage',
          relative,
          lineOf(text, match.index),
          'localStorage.setItem throws in a private window or when storage is full, and stops the game. Use createSaveStore of @egret/engine/kit, or catch it.'
        );
    }
  }
  if (resolved.length && fs.existsSync(path.join(folder, 'ENGINE-NOTES.md'))) {
    const notes = parseNotes(
      fs.readFileSync(path.join(folder, 'ENGINE-NOTES.md'), 'utf8'),
      path.basename(path.resolve(folder))
    );
    for (const { note, entry } of readNotesAgainst(notes, resolved).filter(item => item.stale))
      add(
        'notes-resolved',
        'ENGINE-NOTES.md',
        note.line,
        `${note.id} is marked ${note.status}, and the engine has it ${entry.status} (${entry.topic}): the notes command says what to take out.`
      );
  }
  findings.sort(
    (a, b) =>
      (a.severity === b.severity ? 0 : a.severity === 'error' ? -1 : 1) ||
      a.file.localeCompare(b.file) ||
      a.line - b.line
  );
  return { files: files.length, engineImports: used, findings };
}

/** The report of `egret check`: a line per finding, then the counts; exit 1 on an error, or on a warning with --strict. */
export function checkReport(folder, root, { command, resolvedGuide, json = false, strict = false } = {}) {
  if (!fs.existsSync(folder) || !fs.statSync(folder).isDirectory()) return { code: 2, text: `No folder ${folder}.\n` };
  const result = checkGame(folder, root, { resolvedGuide });
  const errors = result.findings.filter(item => item.severity === 'error').length;
  const warnings = result.findings.length - errors;
  const code = errors > 0 || (strict && warnings > 0) ? 1 : 0;
  if (json) return { code, text: JSON.stringify(result, null, 2) + '\n' };
  const lines = result.findings.map(
    item =>
      `${item.severity.padEnd(7)} ${item.file}:${item.line}  ${item.rule}  ${item.message}  (${command} card ${item.card})`
  );
  lines.push(
    `${errors} errors and ${warnings} warnings in ${result.files} files, ${result.engineImports} imports of the engine.` +
      (result.findings.length ? '' : ' Run the game next.')
  );
  return { code, text: lines.join('\n') + '\n' };
}
