// SPDX-License-Identifier: Apache-2.0
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { PNG } from 'pngjs';
import { runPlaytest, startPreview } from '../agent-playtest.mjs';
import { verifyGame } from '../verify-game.mjs';
import { rebuildProject } from './rebuild.mjs';
import { compileTheme } from './compile-theme.mjs';
import { compileClassic } from './compile-classic.mjs';
import { convertProject } from './convert.mjs';
import { hash, json, refuse } from './inspect.mjs';
import { inspectRoutes } from './inspect-routes.mjs';

const requiredChecks = ['first-action', 'round-finished', 'restart', 'first-action-after-restart', 'save-restored'];
const usage = `egret-migrate inspect --source <Egret 5 project> [--source-order <json>] [--published <old compiled project>] [--prepared <prepared Android project> --android-run <launch.json>] [--compiler <trusted TypeScript-Plus>]
egret-migrate convert --source <Egret 5 project> --out <new directory> --engine <egret2d.mjs> --engine-version <7.0.x> --esbuild <module>
egret-migrate compile-theme --source <trusted legacy project> --classic <compiled scripts> --theme <relative theme> --playwright <module> --out <new directory> [--entry index.html] [--ready <project.ready>] [--namespaces <namespace,...>] [--executable <browser>]
egret-migrate compile-classic --source <Egret 5.3 project> --compiler <trusted typescript.js> --out <new directory> [--compiler-sha256 <hash>] [--baseline <receipt>] [--groups <json>] [--theme <relative-path>] [--theme-factories <project profile> | --compiled-theme <compile-theme output>] [--mode debug|release] [--target config|es2015]
egret-migrate rebuild --source <editable conversion> --out <new directory> --esbuild <module> [--transaction <json>]
egret-migrate verify --old <working old HTML> --converted <conversion directory> --scenario <trusted mjs> --playwright <module> --out <new directory>
egret-migrate preview --run <verified comparison directory> --address <private IPv4> --qr-module <qrcode.mjs>

For the original EraserSanGuoSha repository, pass --profile eraser-lobby --source <repository-root> to inspect or convert. Convert accepts --socket-url <loopback-origin> for a separate local game server and otherwise uses the page origin.

For matched Egret 5.3.x declarations, inspect reports ordered sources, module adapters, RES manifests and theme delivery. Review conversion.status and reasons before converting.\n\nClassic project inspection and conversion accept --source-order, --resources, --theme and --bones (a JSON array of explicit RES-name mappings). Convert also accepts --transaction and --project-id. Verify accepts --executable.
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
  if (command === 'compile-theme') return compileTheme(values);
  if (command === 'compile-classic') {
    return compileClassic({
      source: values.source,
      out: values.out,
      compiler: values.compiler,
      compilerSha256: values['compiler-sha256'],
      mode: values.mode,
      target: values.target,
      theme: values.theme,
      themeFactories: values['theme-factories'],
      compiledTheme: values['compiled-theme'],
      groups: values.groups ? readJSON(values.groups) : [],
      baseline: values.baseline ? readJSON(values.baseline) : undefined
    });
  }
  if (command === 'rebuild') {
    return rebuildProject({
      source: values.source,
      out: values.out,
      esbuild: await moduleAt(values.esbuild),
      transaction: values.transaction ? fs.readFileSync(values.transaction, 'utf8') : undefined
    });
  }
  const profile = values.profile;
  if (profile !== undefined && profile !== 'eraser-lobby')
    refuse('MIGRATE_ARGUMENTS', 'Unknown migration profile.', { profile });
  if (values['socket-url'] !== undefined && profile !== 'eraser-lobby')
    refuse('MIGRATE_ARGUMENTS', '--socket-url requires --profile eraser-lobby.');
  if (
    profile &&
    ['source-order', 'resources', 'theme', 'bones', 'movie-atlases'].some(key => values[key] !== undefined)
  )
    refuse(
      'MIGRATE_ARGUMENTS',
      'The lobby profile selects its source order, resource subset and skins from the repository.'
    );
  const config = {
    source: path.resolve(values.source),
    profile,
    sources: values['source-order'] && readJSON(values['source-order']),
    resources: values.resources,
    theme: values.theme,
    bones: values.bones && readJSON(values.bones)
  };
  if (command === 'inspect')
    return inspectRoutes(config.source, config, {
      published: values.published,
      prepared: values.prepared,
      launch: values['android-run'],
      compiler: values.compiler,
      compilerSha256: values['compiler-sha256']
    });
  return convertProject({
    ...config,
    out: values.out,
    engine: values.engine,
    engineVersion: values['engine-version'],
    projectId: values['project-id'],
    socketUrl: values['socket-url'],
    movieAtlases: values['movie-atlases'] && readJSON(values['movie-atlases']),
    esbuild: await moduleAt(values.esbuild),
    transaction: values.transaction ? fs.readFileSync(values.transaction, 'utf8') : undefined
  });
}

const commands = {
  'compile-theme': {
    need: ['source', 'classic', 'theme', 'playwright', 'out'],
    extra: ['entry', 'ready', 'namespaces', 'executable']
  },
  'compile-classic': {
    need: ['source', 'compiler', 'out'],
    extra: ['compiler-sha256', 'mode', 'target', 'theme', 'theme-factories', 'compiled-theme', 'groups', 'baseline']
  },
  inspect: {
    need: ['source'],
    extra: [
      'profile',
      'source-order',
      'resources',
      'theme',
      'bones',
      'published',
      'prepared',
      'android-run',
      'compiler',
      'compiler-sha256'
    ]
  },
  convert: {
    need: ['source', 'out', 'engine', 'engine-version', 'esbuild'],
    extra: [
      'profile',
      'socket-url',
      'source-order',
      'resources',
      'theme',
      'bones',
      'movie-atlases',
      'transaction',
      'project-id'
    ]
  },
  rebuild: { need: ['source', 'out', 'esbuild'], extra: ['transaction'] },
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
