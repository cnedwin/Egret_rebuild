// SPDX-License-Identifier: Apache-2.0
// A game's ENGINE-NOTES.md read against the engine notes this engine has resolved (guide/resolved.json), so that an
// agent working in the game learns which of its workarounds the engine copy no longer needs.
//
// A note is a heading `### <n>. <title>`, with a header comment on one of the lines under it:
//
//   ### 3. No CanvasKit in a mini game, so no paragraphs — open
//   <!-- engine-note: {"id": "InquestScrolls#3", "status": "open", "topic": "paragraph-without-webassembly",
//        "workaround": ["src/view/plainText.mjs"]} -->
//
// (the comment is one line). `id` is the game's folder, `#` and the note's number; `status` is one of STATUSES;
// `topic` names the fault in words joined by dashes, the same in every game that meets it, which is how the engine says
// it fixed a fault for games it never named; `workaround` lists the game's files that hold the workaround. A note
// without a header is still matched by its id, and its status read from the end of its heading.
import fs from 'node:fs';
import path from 'node:path';

export const STATUSES = Object.freeze(['open', 'partly', 'worked-around', 'documented', 'resolved']);
/** The engine statuses of guide/resolved.json: what the engine did about a fault. */
export const ENGINE_STATUSES = Object.freeze(['resolved', 'partly', 'documented']);
export const NOTE_ID = /^[A-Za-z0-9][A-Za-z0-9_-]*#[1-9][0-9]*$/;
export const TOPIC = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const HEADER = /<!--\s*engine-note:\s*(\{.*\})\s*-->/;
const HEADING = /^###\s+(\d+)\.\s+(.*)$/;

/** The status a heading ends with, in the words the games write: `— open`, `— 未解决 / open`, `— resolved in 95897d7`. */
export function headingStatus(title) {
  const tail = title
    .split(/\s+[—–-]\s+/)
    .pop()
    .split('/')
    .pop()
    .trim()
    .toLowerCase();
  if (/^partly|^partial/.test(tail)) return 'partly';
  if (/^resolved|^fixed/.test(tail)) return 'resolved';
  if (/^documented/.test(tail)) return 'documented';
  if (/^worked around|^worked-around/.test(tail)) return 'worked-around';
  if (/^open/.test(tail)) return 'open';
  return undefined;
}

/** The notes of an ENGINE-NOTES.md: number, title, line, header (or undefined) and the problems of a bad header. */
export function parseNotes(text, folder) {
  const lines = text.split('\n');
  const notes = [];
  for (let i = 0; i < lines.length; i++) {
    const heading = lines[i].match(HEADING);
    if (!heading) continue;
    const number = Number(heading[1]),
      title = heading[2].trim();
    const note = { number, title, line: i + 1, id: `${folder}#${number}`, header: undefined, problems: [] };
    for (let j = i + 1; j < lines.length && !HEADING.test(lines[j]) && !/^##?\s/.test(lines[j]); j++) {
      const found = lines[j].match(HEADER);
      if (!found) continue;
      try {
        note.header = JSON.parse(found[1]);
      } catch (cause) {
        note.problems.push(`line ${j + 1}: the header is not JSON (${cause.message})`);
        break;
      }
      const header = note.header;
      if (header.id !== note.id)
        note.problems.push(`line ${j + 1}: id is ${JSON.stringify(header.id)}, not "${note.id}"`);
      if (!STATUSES.includes(header.status))
        note.problems.push(`line ${j + 1}: status is one of ${STATUSES.join(', ')}`);
      if (typeof header.topic !== 'string' || !TOPIC.test(header.topic))
        note.problems.push(`line ${j + 1}: topic is words in lower case joined by dashes`);
      if (header.workaround !== undefined && !(Array.isArray(header.workaround) && header.workaround.every(isFile)))
        note.problems.push(`line ${j + 1}: workaround lists files of the game`);
      break;
    }
    note.status = note.header?.status ?? headingStatus(title);
    notes.push(note);
  }
  return notes;
}
const isFile = value => typeof value === 'string' && value !== '' && !value.startsWith('/') && !value.includes('..');

/** guide/resolved.json, checked: an entry has a topic, a status, what changed and the notes it was written for. */
export function readResolved(guide) {
  const data = JSON.parse(fs.readFileSync(path.join(guide, 'resolved.json'), 'utf8'));
  if (data.schemaVersion !== 1 || !Array.isArray(data.resolved))
    throw new Error('resolved.json: schemaVersion 1 and a list');
  return data.resolved;
}

/** What the engine did about each note of a game: the notes it resolved that the game still has open, and the rest. */
export function readNotesAgainst(notes, resolved) {
  const found = [];
  for (const note of notes) {
    const entry = resolved.find(
      item => (note.header?.topic !== undefined && item.topic === note.header.topic) || item.notes?.includes(note.id)
    );
    if (!entry) continue;
    const stale =
      note.status === 'open' ||
      note.status === 'worked-around' ||
      (note.status === 'partly' && entry.status === 'resolved');
    found.push({ note, entry, stale });
  }
  return found;
}

/** The text and exit code of `egret notes`: exit 1 with --check while a note the engine resolved is still open. */
export function notesReport(folder, guide, { command, check = false, copy = true } = {}) {
  // From a game's engine copy the list is the one at the game's pin; from the engine's repository it is the newest, and
  // the game needs a fresh copy before its workaround can go.
  const engine = copy ? 'The engine copy has it' : 'This engine has it';
  const refresh = copy ? '' : "Refresh the game's engine copy (tools/vendor-game.mjs), then t";
  const file = path.join(folder, 'ENGINE-NOTES.md');
  if (!fs.existsSync(file))
    return { code: 1, text: `No ENGINE-NOTES.md in ${folder}. Run this in a game's folder, or name the folder.\n` };
  const name = path.basename(path.resolve(folder));
  const notes = parseNotes(fs.readFileSync(file, 'utf8'), name);
  const found = readNotesAgainst(notes, readResolved(guide));
  const lines = [];
  for (const { note, entry, stale } of found.filter(item => item.stale)) {
    const where = entry.pr ? ` (#${entry.pr})` : entry.commit ? ` (${entry.commit.slice(0, 9)})` : '';
    lines.push(`${note.id} ${note.title}`);
    lines.push(`  ${engine} ${entry.status}${where}: ${entry.what}`);
    if (entry.status !== 'documented') {
      const files = note.header?.workaround;
      lines.push(
        files?.length
          ? `  ${refresh || 'T'}ake out the workaround in ${files.join(', ')}, check the game again, then mark the note ${entry.status}.`
          : `  ${refresh || 'T'}ake out the game's workaround for it, check the game again, then mark the note ${entry.status}.`
      );
    } else lines.push('  Mark the note documented once the game follows what the engine says.');
    if (entry.card) lines.push(`  ${command} card ${entry.card}`);
    lines.push('');
  }
  const bad = notes.filter(note => note.problems.length);
  for (const note of bad) lines.push(`${note.id}: ${note.problems.join('; ')}`, '');
  const headerless = notes.filter(note => note.header === undefined).length;
  const staleCount = found.filter(item => item.stale).length;
  lines.push(
    `${notes.length} notes in ${name}/ENGINE-NOTES.md, ${notes.length - headerless} with a header; ` +
      `${staleCount} ${copy ? 'the engine copy' : 'this engine'} has resolved or documented since.`
  );
  if (headerless)
    lines.push(
      'Under each note heading put one line the engine can read, so it can say when the fault is fixed:',
      `  <!-- engine-note: {"id": "${name}#<n>", "status": "open", "topic": "<the-fault-in-words>", "workaround": ["src/<file>"]} -->`
    );
  return { code: check && (staleCount > 0 || bad.length > 0) ? 1 : 0, text: lines.join('\n') + '\n' };
}
