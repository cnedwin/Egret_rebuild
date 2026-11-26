// SPDX-License-Identifier: Apache-2.0
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { PNG } from 'pngjs';
import { runPlaytest, startPreview } from '../agent-playtest.mjs';
import { verifyGame } from '../verify-game.mjs';
import { convertProject } from './convert.mjs';
import { hash, inspectLegacyProject, json, refuse } from './inspect.mjs';

const requiredChecks = ['first-action', 'round-finished', 'restart', 'first-action-after-restart', 'save-restored'];
const usage = `egret-migrate inspect --source <Egret 5 project> [--source-order <json>]
egret-migrate convert --source <Egret 5 project> --out <new directory> --engine <egret2d.mjs> --engine-version <7.0.x> --esbuild <module>
egret-migrate verify --old <working old HTML> --converted <conversion directory> --scenario <trusted mjs> --playwright <module> --out <new directory>
egret-migrate preview --run <verified comparison directory> --address <private IPv4> --qr-module <qrcode.mjs>

Convert also accepts --source-order, --resources, --transaction and --project-id. Verify accepts --executable.
`;

const moduleAt = filename => import(pathToFileURL(path.resolve(filename)).href);
const readJSON = file => JSON.parse(fs.readFileSync(file, 'utf8'));

function hasRequired(report) {
  return report.pass && requiredChecks.every((name, i) => report.checks.played?.checkpoints?.[i] === name);
}

export async function verifyMigration(options) {
  const oldFile = path.resolve(options.old);
  const root = path.resolve(options.converted);
  const scenarioPath = path.resolve(options.scenario);
  const scenarioBytes = fs.readFileSync(scenarioPath);
  const proof = readJSON(path.join(root, 'conversion.json'));
  const { chromium } = await moduleAt(options.playwright);
  const driver = options.executable
    ? { launch: settings => chromium.launch({ ...settings, executablePath: options.executable }) }
    : chromium;
  const out = path.resolve(options.out);
  fs.mkdirSync(out);
  const oldOut = path.join(out, 'old');
  fs.mkdirSync(oldOut);
  const scenario = path.join(out, 'scenario.mjs');
  fs.writeFileSync(scenario, scenarioBytes);
  const oldEntrySha256 = hash(fs.readFileSync(oldFile));
  const old = await verifyGame({
    chromium: driver,
    PNG,
    file: oldFile,
    out: oldOut,
    script: await moduleAt(scenario),
    scriptOnly: true
  });
  if (oldEntrySha256 !== hash(fs.readFileSync(oldFile)))
    refuse('MIGRATE_OLD_CHANGED', 'The old entry changed during the baseline run.');
  const next = await runPlaytest({
    web: path.join(root, 'web'),
    project: path.join(root, 'web', 'project.json'),
    file: proof.browserFiles,
    playwright: path.resolve(options.playwright),
    executable: options.executable && path.resolve(options.executable),
    out: path.join(out, 'new'),
    scenario,
    checkpoints: requiredChecks
  });
  const verdict = {
    schemaVersion: 1,
    status: hasRequired(old) && next.status === 'passed' ? 'passed' : 'failed',
    scenarioSha256: hash(scenarioBytes),
    requiredChecks,
    old: { entrySha256: oldEntrySha256, ...old },
    new: { artifactSha256: next.artifact.sha256, revision: next.revision, status: next.status }
  };
  fs.writeFileSync(path.join(out, 'comparison.json'), json(verdict));
  return verdict;
}

async function inspectOrConvert(command, values) {
  const config = {
    source: path.resolve(values.source),
    sources: values['source-order'] && readJSON(values['source-order']),
    resources: values.resources
  };
  if (command === 'inspect') return inspectLegacyProject(config.source, config);
  return convertProject({
    ...config,
    out: values.out,
    engine: values.engine,
    engineVersion: values['engine-version'],
    projectId: values['project-id'],
    esbuild: await moduleAt(values.esbuild),
    transaction: values.transaction ? fs.readFileSync(values.transaction, 'utf8') : undefined
  });
}

const commands = {
  inspect: { need: ['source'], extra: ['source-order', 'resources'] },
  convert: {
    need: ['source', 'out', 'engine', 'engine-version', 'esbuild'],
    extra: ['source-order', 'resources', 'transaction', 'project-id']
  },
  verify: { need: ['old', 'converted', 'scenario', 'playwright', 'out'], extra: ['executable'] },
  preview: { need: ['run', 'address', 'qr-module'], extra: [] }
};

export async function runCli([command, ...args]) {
  if (!command || command === '--help' || command === '-h') {
    console.log(usage);
    return;
  }
  const syntax = Object.hasOwn(commands, command) && commands[command];
  if (!syntax) refuse('MIGRATE_ARGUMENTS', usage);
  const { values } = parseArgs({
    args,
    options: Object.fromEntries([...syntax.need, ...syntax.extra].map(name => [name, { type: 'string' }]))
  });
  if (syntax.need.some(key => !values[key])) refuse('MIGRATE_ARGUMENTS', usage);
  if (command === 'preview') {
    const verdict = readJSON(path.join(values.run, 'comparison.json'));
    const passing = path.join(values.run, 'new');
    const run = readJSON(path.join(passing, 'report.json'));
    if (verdict.status !== 'passed' || verdict.new.artifactSha256 !== run.artifact.sha256) {
      refuse('MIGRATE_PREVIEW_UNVERIFIED', 'Preview requires a passing comparison for this exact build.');
    }
    const { default: qrcode } = await moduleAt(values['qr-module']);
    if (typeof qrcode !== 'function') refuse('MIGRATE_QR_MODULE', 'Provide an installed qrcode-generator module.');
    const { server, ...report } = await startPreview(path.resolve(passing), values.address, qrcode);
    const close = () => {
      server.close();
      server.closeAllConnections();
    };
    const timeout = setTimeout(close, 15 * 60 * 1000);
    process.once('SIGINT', close);
    process.once('SIGTERM', close);
    server.once('close', () => {
      clearTimeout(timeout);
      process.removeListener('SIGINT', close);
      process.removeListener('SIGTERM', close);
    });
    console.log(json(report));
    return;
  }
  const report = command === 'verify' ? await verifyMigration(values) : await inspectOrConvert(command, values);
  console.log(json(report));
  if (report.status === 'failed') process.exitCode = 1;
}
