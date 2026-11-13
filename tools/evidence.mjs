// SPDX-License-Identifier: Apache-2.0
// Run the checks that were written against one exact set of product bytes, and report which of
// them still hold for the files as they stand. Nothing here decides whether a change may merge.
// Usage: node tools/evidence.mjs [--list] [--tools] [--json]
//   (no option)  run every evidence tool and test file, then report saved evidence
//   --list       print the lane without running it
//   --tools      run the tools only; the test files take much longer
//   --json       print the report as JSON
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { EVIDENCE_TOOLS, EVIDENCE_TESTS } from './lib/evidence-lane.mjs';
import { evidenceFreshness } from './current-identities.mjs';

/** The first line that says why a check stopped, for a one-line report. */
export function firstReason(text) {
  const lines = text.replaceAll('\r\n', '\n').split('\n').map(line => line.trim()).filter(Boolean);
  return (lines.find(line => /^(?:[A-Za-z]*Error(?: \[[A-Z_]+\])?: |\{"issues":)/.test(line)) ?? lines.at(-1) ?? '').slice(0, 240);
}

// A check started from inside a test session must report as its own session, not as a subtest.
function ownSession() { const env = { ...process.env }; delete env.NODE_TEST_CONTEXT; return env; }

export function runEvidenceTool(root, tool) {
  const result = spawnSync(process.execPath, ['tools/' + tool + '.mjs'], { cwd: root, encoding: 'utf8', env: ownSession(), maxBuffer: 256 * 1024 * 1024, windowsHide: true });
  const holds = result.error === undefined && result.status === 0;
  return { check: 'tools/' + tool + '.mjs', holds, ...(holds ? {} : { reason: firstReason((result.stderr ?? '') + '\n' + (result.stdout ?? '')) || String(result.error?.message ?? 'no output') }) };
}

export function runEvidenceTest(root, file) {
  const result = spawnSync(process.execPath, ['--test', '--test-reporter=tap', file], { cwd: root, encoding: 'utf8', env: ownSession(), maxBuffer: 256 * 1024 * 1024, windowsHide: true });
  const count = name => { const match = new RegExp('^# ' + name + ' (\\d+)$', 'm').exec(result.stdout ?? ''); return match ? Number(match[1]) : undefined; };
  const pass = count('pass'), fail = count('fail');
  if (pass === undefined || fail === undefined) return { check: file, holds: false, reason: 'the test file did not report a count' };
  return { check: file, holds: result.status === 0 && fail === 0, cases: pass + fail, ...(fail > 0 ? { reason: fail + ' of ' + (pass + fail) + ' cases do not hold' } : {}) };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const options = process.argv.slice(2), root = fileURLToPath(new URL('..', import.meta.url));
  if (new Set(options).size !== options.length || options.some(option => !['--list', '--tools', '--json'].includes(option)) || (options.includes('--list') && options.length > 1)) {
    throw new TypeError('Usage: node tools/evidence.mjs [--list] [--tools] [--json]');
  }
  if (options.includes('--list')) {
    for (const tool of EVIDENCE_TOOLS) console.log('tools/' + tool + '.mjs');
    for (const file of EVIDENCE_TESTS) console.log(file);
  } else {
    const json = options.includes('--json'), rows = [];
    const note = row => { rows.push(row); if (!json) console.log((row.holds ? 'HOLDS    ' : 'STALE    ') + row.check + (row.reason ? ': ' + row.reason : '')); };
    for (const tool of EVIDENCE_TOOLS) note(runEvidenceTool(root, tool));
    if (!options.includes('--tools')) for (const file of EVIDENCE_TESTS) note(runEvidenceTest(root, file));
    const saved = evidenceFreshness(root), old = saved.filter(row => row.changed.length + row.missing.length > 0).length;
    if (json) console.log(JSON.stringify({ checks: rows, saved }, null, 1));
    else {
      console.log(rows.filter(row => !row.holds).length + ' of ' + rows.length + ' byte-bound checks do not hold for the files as they stand.');
      console.log(old + ' of ' + saved.length + ' saved evidence files record identities that are no longer current.');
      console.log('This is a report, not a refusal: a stale check was true of the bytes it was written against and says nothing about these.');
    }
  }
}
