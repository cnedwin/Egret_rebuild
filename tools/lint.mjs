// SPDX-License-Identifier: Apache-2.0
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { formatterPath } from './format.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const maximumDetails = 12;
const maximumRuleCounts = 8;

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

if (process.argv.length !== 2) throw new TypeError('Usage: node tools/lint.mjs');
const biome = formatterPath();
if (!biome) throw new Error('Install the pinned formatter with npm ci --ignore-scripts --prefix tools/format.');
printReport(readReport(biome));
