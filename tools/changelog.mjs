// SPDX-License-Identifier: Apache-2.0
// Changelog entries as one file per change. A pull request adds `changes/<name>.json` instead of editing the two
// changelogs, so two of them never touch the same lines. Folding puts every waiting entry at the top of both
// changelogs, newest first, and removes its file; it is a change of its own, made from time to time.
//
//   node tools/changelog.mjs            checks every waiting entry
//   node tools/changelog.mjs --fold     folds them into the changelogs
//
// An entry: { "date": "2026-11-20", "en": { "title": "…", "body": "…" }, "zh": { "title": "…", "body": "…" } }.
// The body is Markdown of one or more paragraphs; the title is one line.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const CHANGES = 'changes';
export const CHANGELOGS = Object.freeze({
  en: 'knowledge-base/en/CHANGELOG.md',
  zh: 'knowledge-base/Cns/CHANGELOG.md'
});
const NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*\.json$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** The waiting entries, in the order they are folded: newest date first, then by name. Throws on a malformed one. */
export function readChanges(root) {
  const directory = path.join(root, CHANGES);
  if (!fs.existsSync(directory)) return [];
  const entries = [];
  for (const name of fs.readdirSync(directory).sort()) {
    if (!NAME.test(name))
      throw new Error(`${CHANGES}/${name}: an entry is named in lower case words joined by dashes, ending .json`);
    const file = `${CHANGES}/${name}`;
    let entry;
    try {
      entry = JSON.parse(fs.readFileSync(path.join(directory, name), 'utf8'));
    } catch (cause) {
      throw new Error(`${file}: not JSON (${cause.message})`);
    }
    checkEntry(file, entry);
    entries.push({ file, ...entry });
  }
  return entries.sort((a, b) => (a.date === b.date ? a.file.localeCompare(b.file) : a.date < b.date ? 1 : -1));
}
function checkEntry(file, entry) {
  const fail = reason => {
    throw new Error(`${file}: ${reason}`);
  };
  if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) fail('an entry is an object');
  const keys = Object.keys(entry).sort().join(',');
  if (keys !== 'date,en,zh') fail('an entry has exactly date, en and zh');
  if (typeof entry.date !== 'string' || !DATE.test(entry.date) || Number.isNaN(Date.parse(entry.date)))
    fail('date is a day written YYYY-MM-DD');
  for (const language of ['en', 'zh']) {
    const part = entry[language];
    if (part === null || typeof part !== 'object' || Object.keys(part).sort().join(',') !== 'body,title')
      fail(`${language} has exactly title and body`);
    if (typeof part.title !== 'string' || part.title.trim() === '' || /[\r\n]/.test(part.title))
      fail(`${language}.title is one line of words`);
    if (/^\s*#/.test(part.title)) fail(`${language}.title is written without a heading mark`);
    if (typeof part.body !== 'string' || part.body.trim() === '') fail(`${language}.body is words`);
    if (/^#{1,2} /m.test(part.body)) fail(`${language}.body has no heading of its own level or above`);
    if (/\r/.test(part.body)) fail(`${language}.body has Unix line ends`);
  }
}
/** The section an entry becomes in one language's changelog. */
export function section(entry, language) {
  const { title, body } = entry[language];
  return `## ${title.trim()} — ${entry.date}\n\n${body.trim()}\n`;
}
/**
 * The changelog with the entries put first, after its opening lines and before its first entry. Each section is
 * separated from the next by one blank line.
 */
export function foldInto(text, sections) {
  if (sections.length === 0) return text;
  const at = text.indexOf('\n## ');
  if (at < 0) return text.replace(/\n*$/, '\n\n') + sections.join('\n');
  const head = text.slice(0, at).replace(/\n*$/, '\n\n');
  return head + sections.join('\n') + '\n' + text.slice(at + 1);
}
/** Folds every waiting entry into both changelogs and removes its file. Returns the files folded. */
export function foldChanges(root) {
  const entries = readChanges(root);
  for (const [language, file] of Object.entries(CHANGELOGS)) {
    const target = path.join(root, file);
    fs.writeFileSync(
      target,
      foldInto(
        fs.readFileSync(target, 'utf8'),
        entries.map(e => section(e, language))
      )
    );
  }
  for (const entry of entries) fs.rmSync(path.join(root, entry.file));
  return entries.map(entry => entry.file);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const root = fileURLToPath(new URL('..', import.meta.url));
  try {
    if (process.argv.includes('--fold')) {
      const folded = foldChanges(root);
      console.log(folded.length === 0 ? 'Nothing to fold.' : 'Folded: ' + folded.join(', '));
    } else {
      const entries = readChanges(root);
      console.log(`Changelog entries: ${entries.length} waiting, each well formed.`);
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
