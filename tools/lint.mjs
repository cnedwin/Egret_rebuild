// SPDX-License-Identifier: Apache-2.0
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { isolatedGitEnvironment } from './contribution-metadata.mjs';
import { formatterPath } from './format.mjs';
import { logicalPath } from './lib/file-identity.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const maximumDetails = 12;
const maximumRuleCounts = 8;
const advisoryLines = 600;
const fullCommit = /^[a-f0-9]{40}$/;

function readReport(biome) {
  const config = path.join(root, 'biome.lint.json');
  if (!fs.existsSync(config)) throw new Error('Advisory lint configuration is missing.');
  const run = spawnSync(
    process.execPath,
    [biome, 'lint', '--config-path=' + config, '--reporter=json', '--max-diagnostics=none', '--colors=off', 'packages'],
    { cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }
  );
  if (run.error) throw run.error;

  let report;
  try {
    report = JSON.parse(run.stdout);
  } catch {
    if (run.stderr) process.stderr.write(run.stderr.slice(0, 4000));
    throw new Error('Biome did not return a lint report.');
  }
  const { summary, diagnostics } = report;
  if (
    !summary ||
    !Array.isArray(diagnostics) ||
    !Number.isSafeInteger(summary.unchanged) ||
    summary.unchanged < 1 ||
    summary.changed !== 0 ||
    summary.skipped !== 0 ||
    summary.diagnosticsNotPrinted !== 0 ||
    diagnostics.length !== summary.errors + summary.warnings + summary.infos
  ) {
    throw new Error('Biome returned an incomplete lint report.');
  }

  // A completed lint pass may return 1 for findings. Parse and tool failures still fail this command.
  const failed = diagnostics.find(item => !item.category?.startsWith('lint/'));
  if (failed) throw new Error(failed.category + ': ' + failed.message);
  if (run.status !== Number(summary.errors > 0)) throw new Error('Biome did not complete the lint pass.');
  return report;
}

function printReport({ summary, diagnostics }) {
  const ruleCounts = new Map();
  for (const { category } of diagnostics) ruleCounts.set(category, (ruleCounts.get(category) ?? 0) + 1);
  const severityOrder = { error: 0, warning: 1, info: 2 };
  const ordered = diagnostics.toSorted(
    (first, second) =>
      severityOrder[first.severity] - severityOrder[second.severity] ||
      (first.location?.path ?? '').localeCompare(second.location?.path ?? '') ||
      (first.location?.start?.line ?? 0) - (second.location?.start?.line ?? 0) ||
      (first.location?.start?.column ?? 0) - (second.location?.start?.column ?? 0)
  );
  console.log(
    `Advisory lint checked ${summary.unchanged} package source files and found ${summary.errors} errors, ${summary.warnings} warnings and ${summary.infos} infos.`
  );
  for (const [rule, count] of [...ruleCounts]
    .sort((first, second) => second[1] - first[1] || first[0].localeCompare(second[0]))
    .slice(0, maximumRuleCounts)) {
    console.log(`  ${count} ${rule}`);
  }
  for (const { severity, category, location, message } of ordered.slice(0, maximumDetails)) {
    const file = location?.path?.replaceAll('\\', '/') ?? 'package source';
    const position = location?.start ? `:${location.start.line}:${location.start.column}` : '';
    console.log(`  ${file}${position} ${severity} ${category} ${message}`);
  }
  if (diagnostics.length > maximumDetails) {
    console.log(`${diagnostics.length - maximumDetails} additional diagnostics omitted from this display.`);
  }
}

function git(args) {
  const result = spawnSync('git', ['--no-replace-objects', ...args], {
    cwd: root,
    env: isolatedGitEnvironment(),
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error('Cannot read the reviewed Git diff: ' + (result.stderr ?? '').trim());
  return result.stdout;
}

function reportAddedFiles(base) {
  if (git(['rev-parse', '--verify', base + '^{commit}']).trim() !== base)
    throw new Error('The lint base must be an exact commit.');
  const head = git(['rev-parse', '--verify', 'HEAD^{commit}']).trim();
  git(['merge-base', '--is-ancestor', base, head]);
  // Git counts committed lines, including an unterminated last line. Raw modes exclude links.
  const fields = git([
    'diff',
    '--raw',
    '--numstat',
    '--no-abbrev',
    '-z',
    '--diff-filter=A',
    '--find-renames',
    '--text',
    '--no-ext-diff',
    '--no-textconv',
    base,
    head,
    '--'
  ]).split('\0');
  if (fields.pop() !== '' || fields.length % 3) throw new Error('Incomplete added-file diff.');
  const count = fields.length / 3;
  const warnings = [];
  let checked = 0;
  for (let index = 0; index < count; index++) {
    const file = logicalPath(fields[index * 2 + 1]);
    const raw = /^:000000 ([0-7]{6}) 0{40} [a-f0-9]{40} A$/.exec(fields[index * 2]);
    // Git reports two dashes for binary assets. Their paths still have to match the raw records.
    const stat = /^(?:(\d+)\t0|-\t-)\t([\s\S]+)$/.exec(fields[count * 2 + index]);
    if (!raw || stat?.[2] !== file) throw new Error('Invalid added-file diff.');
    if (raw[1] !== '100644' && raw[1] !== '100755') continue;
    if (!/^(?:packages|examples|tools|tests|devtools)\/.+\.(?:[cm]?js|tsx?)$/.test(file)) continue;
    if (
      /(?:^|\/)(?:build|dist|generated|node_modules|third-party|vendor)\//.test(file) ||
      /\.(?:generated\.[cm]?[jt]sx?|d\.[cm]?ts)$/.test(file)
    )
      continue;
    const lines = Number(stat[1]);
    if (!Number.isSafeInteger(lines)) throw new Error('Invalid added source line count: ' + file);
    checked++;
    if (lines > advisoryLines) warnings.push({ file, lines });
  }
  console.log(
    `Source length advisory checked ${checked} added files and found ${warnings.length} over ${advisoryLines} lines.`
  );
  for (const { file, lines } of warnings.slice(0, maximumDetails))
    console.log(`  Advisory: ${file} has ${lines} lines.`);
  if (warnings.length > maximumDetails)
    console.log(`${warnings.length - maximumDetails} additional file warnings omitted.`);
}

const options = process.argv.slice(2);
if (options.length !== 0 && (options.length !== 2 || options[0] !== '--base' || !fullCommit.test(options[1]))) {
  throw new TypeError('Usage: node tools/lint.mjs [--base <full-commit-sha>]');
}
const biome = formatterPath();
if (!biome) throw new Error('Install the pinned formatter with npm ci --ignore-scripts --prefix tools/format.');
printReport(readReport(biome));
if (options[1]) reportAddedFiles(options[1]);
