// SPDX-License-Identifier: Apache-2.0
// Repositories in temporary directories for the incremental-check tests: a Git tree, its package
// dependency catalog, and the maintenance and compiler tools copied in.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { isolatedGitEnvironment } from '../../tools/contribution-metadata.mjs';
export function fixture() {
  const root = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'egret incremental ')));
  const git = (...args) => {
    const r = spawnSync('git', args, {
      cwd: root,
      encoding: 'utf8',
      env: {
        ...isolatedGitEnvironment(),
        GIT_CONFIG_GLOBAL: path.join(root, '.git', 'isolated-global.conf'),
        GIT_CONFIG_NOSYSTEM: '1'
      }
    });
    assert.equal(r.status, 0, r.stderr);
    return r.stdout.trim();
  };
  const put = (f, s) => {
    fs.mkdirSync(path.dirname(path.join(root, f)), { recursive: true });
    fs.writeFileSync(path.join(root, f), s);
  };
  put('knowledge-base/en/docs/guide.md', '# Guide\n');
  put('README.md', '# Intro\n');
  put('tools/example.mjs', 'export {};\n');
  git('init', '-q');
  git('add', '.');
  git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'baseline');
  return {
    root,
    git,
    put,
    base: git('rev-parse', 'HEAD'),
    close: () => fs.rmSync(root, { recursive: true, force: true })
  };
}

export function dependencyFixture() {
  const f = fixture();
  const pin = file => {
    const raw = fs.readFileSync(path.join(f.root, file));
    return { path: file, bytes: raw.length, sha256: createHash('sha256').update(raw).digest('hex') };
  };
  const graph = { contracts: [], runtime: ['contracts'], engine: ['contracts', 'runtime'], project: ['contracts'] };
  const packages = {};
  for (const [name, deps] of Object.entries(graph)) {
    const manifest = 'packages/' + name + '/package.json';
    f.put(
      manifest,
      JSON.stringify({
        name: '@egret/' + name,
        dependencies: Object.fromEntries(deps.map(d => ['@egret/' + d, 'workspace:*']))
      })
    );
    f.put('packages/' + name + '/src/value.ts', 'export const value = 1;\n'.replace('\\n', '\n'));
    packages[name] = { manifest: pin(manifest), dependencies: deps };
  }
  const tests = [];
  for (const [name, deps] of [
    ['engine', ['engine']],
    ['runtime', ['runtime']],
    ['project', ['project']],
    ['shared', null]
  ]) {
    const file = 'tests/' + name + '.test.mjs';
    f.put(file, 'export {};\n');
    tests.push({ file: pin(file), packages: deps, support: [] });
  }
  tests.sort((a, b) => a.file.path.localeCompare(b.file.path));
  const policy = ['tools/prepush.mjs', 'tools/test.mjs', 'tools/verify.mjs'].map(file => {
    f.put(file, 'export {};\n');
    return pin(file);
  });
  const catalog = { schemaVersion: 1, packages, tests, policy };
  f.put('tools/incremental-test-catalog.json', JSON.stringify(catalog));
  f.git('add', '.');
  f.git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'catalog');
  return { ...f, base: f.git('rev-parse', 'HEAD'), catalog, pin };
}

// Maintenance proposals are review inputs, never gate acceptance or writable baselines.
export const maintenance = () => import('../../tools/prepare-check-maintenance.mjs');
export function maintenanceFixture() {
  const f = dependencyFixture();
  for (const file of ['tools/prepare-check-maintenance.mjs', 'tools/lib/file-identity.mjs'])
    f.put(file, fs.readFileSync(new URL('../../' + file, import.meta.url)));
  return f;
}
export function baselineFixture() {
  const f = maintenanceFixture();
  for (const name of ['contracts', 'runtime', 'engine', 'project'])
    for (const area of ['src', 'dist', ...(name === 'engine' ? ['web', 'rendering'] : [])])
      fs.mkdirSync(path.join(f.root, 'packages', name, area), { recursive: true });
  const pin = f.pin('packages/project/src/value.ts');
  f.put(
    'tools/spritesheet-boundary.mjs',
    'const graphPins = ' +
      JSON.stringify([pin]) +
      ';\nconst configurationPins = [];\nconst ss1AtlasGraphSuccessor = [];\nconst m11WarmSubmissionGraphSuccessor = [];\nconst m12IncrementalRenderingGraphSuccessor = [];\nconst m13SharedRenderingGraphSuccessor = [];\n'
  );
  f.put(
    'tools/browser-png-boundary.mjs',
    'const acceptedSnapshot = ' +
      JSON.stringify({ graph: [pin], stablePins: [] }) +
      ';\nconst atlasGraphSuccessor = [];\nconst m11WarmSubmissionGraphSuccessor = [];\nconst m12IncrementalRenderingGraphSuccessor = [];\nconst m13SharedRenderingGraphSuccessor = [];\n'
  );
  f.put(
    'tools/sequence-playback-boundary.mjs',
    'const seqpbPackages = [];\nconst seqpbStableEntries = ' +
      JSON.stringify([pin]) +
      ';\nconst seqpbConfigurations = [];\nconst m13SequenceInterfaceSuccessor = [];\n'
  );
  const extra = f.pin('packages/engine/src/value.ts');
  for (const [stem, kind] of [
    ['bitmap-resource-slot', 'BITMAP_RESOURCE_SLOT_FINITE_INTERFACE_POLICY'],
    ['bitmap-binding-ticket', 'BITMAP_BINDING_TICKET_FINITE_INTERFACE_POLICY']
  ]) {
    const policy = {
      schemaVersion: 1,
      kind,
      packages: [],
      configurations: [],
      stableEntries: [extra],
      oldRootPins: [extra],
      oldEngineDeclarationPin: extra,
      workspacePins: [],
      ...(stem === 'bitmap-binding-ticket' ? { selectedProductPins: [extra] } : {})
    };
    f.put('tools/' + stem + '-policy.json', JSON.stringify(policy));
    f.put(
      'tools/' + stem + '-boundary.mjs',
      'const policyPin = ' +
        JSON.stringify(f.pin('tools/' + stem + '-policy.json')) +
        ';\n' +
        (stem === 'bitmap-binding-ticket' ? 'const m12IncrementalOwnershipSuccessor = [];\n' : '') +
        'const m13InterfaceRawSuccessor = [];\nconst m13InterfaceProjectedSuccessor = [];\nconst m13InterfaceStableSuccessor = [];\n'
    );
  }
  f.put(
    'tests/types/atlas-import-diagnostic-expectations.json',
    JSON.stringify({
      kind: 'ATLAS_IMPORT_ACTUAL_STRICT_DIAGNOSTICS',
      status: 'OBSERVED_FROZEN_TS7_DIAGNOSTICS',
      sourcePolicy: { modules: [extra], configurationPins: [] }
    })
  );
  f.put(
    'tools/atlas-import-boundary.mjs',
    'const inventoryPin = ' +
      JSON.stringify(f.pin('tests/types/atlas-import-diagnostic-expectations.json')) +
      ';\nconst m11WarmSubmissionGraphSuccessor = [];\nconst m12IncrementalRenderingGraphSuccessor = [];\nconst m13SharedRenderingGraphSuccessor = [];\n'
  );
  for (const owner of ['tools/spritesheet-boundary.mjs', 'tools/browser-png-boundary.mjs'])
    f.put(
      owner,
      fs.readFileSync(path.join(f.root, owner), 'utf8') +
        'const imageResidencySuccessors = ' +
        JSON.stringify([
          {
            path: extra.path,
            base: { bytes: 0, sha256: '0'.repeat(64) },
            current: { bytes: extra.bytes, sha256: extra.sha256 }
          }
        ]) +
        ';\n'
    );
  return f;
}

export const compilerTool = () => import('../../tools/prepare-compiler-maintenance.mjs');
export function compilerFixture() {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'egret compiler maintenance ')));
  const put = (file, body) => {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), body);
  };
  const pin = file => {
    const raw = fs.readFileSync(path.join(root, file));
    return { path: file, bytes: raw.length, sha256: createHash('sha256').update(raw).digest('hex') };
  };
  const names = [
    'atlas-import',
    'atlas-frame',
    'bitmap-resource-slot',
    'bitmap-binding-ticket',
    'linear-layout',
    'bitmap-button',
    'display-anchor-offsets',
    'display-container-add-child-at',
    'display-container-child-index',
    'display-container-remove-children',
    'nine-slice-bitmap'
  ];
  const nativeNames = names.slice(2, -1),
    specs = names.map(name => [name, name.replaceAll('-', '_').toUpperCase()]);
  const native = 'node_modules/@typescript/typescript-win32-x64/';
  for (const file of ['lib/lib.es5.d.ts', 'lib/tsc.exe']) put(native + file, 'native fixture');
  put('node_modules/typescript/lib/lib.es5.d.ts', 'native fixture');
  const nativePin = file => ({ ...pin(native + file), path: file });
  for (const file of [
    'tools/prepare-compiler-maintenance.mjs',
    'tools/prepare-check-maintenance.mjs',
    'tools/lib/file-identity.mjs',
    'packages/engine/dist/index.d.ts'
  ])
    put(file, '// Synthetic nonexecuting fixture\n');
  for (const [name, version] of [
    ['typescript', '7.0.2'],
    ['@typescript/typescript-win32-x64', '7.0.2'],
    ['jsonc-parser', '3.3.1']
  ]) {
    put(
      'node_modules/' + name + '/package.json',
      JSON.stringify({
        name,
        version,
        ...(name.startsWith('@typescript/') ? { exports: { './package.json': './package.json' } } : {})
      })
    );
    put('node_modules/' + name + '/index.js', 'throw Error("must never execute compiler or dependency");\n');
  }
  for (const [name, kind] of specs) {
    put('tools/' + name + '-types.mjs', 'throw Error("must never execute strict gate");\n');
    const v = {
      ...(['atlas-import', 'atlas-frame'].includes(name) ? {} : { schemaVersion: 1 }),
      kind: kind + '_ACTUAL_STRICT_DIAGNOSTICS',
      status: 'OBSERVED_FROZEN_TS7_DIAGNOSTICS',
      inputPins: [
        'tools/' + name + '-types.mjs',
        'packages/engine/dist/index.d.ts',
        'node_modules/typescript/index.js',
        'node_modules/@typescript/typescript-win32-x64/index.js'
      ].map(pin)
    };
    if (nativeNames.includes(name)) {
      v.nativeLibraryPins = [nativePin('lib/lib.es5.d.ts')];
      v.originalCompilerObservation = {
        platform: 'win32',
        arch: 'x64',
        version: '7.0.2',
        nativePackage: '@typescript/typescript-win32-x64',
        nativeMetadataPin: nativePin('package.json'),
        nativeBinaryPin: nativePin('lib/tsc.exe')
      };
    }
    if (name.startsWith('display-container-'))
      v.currentInputIdentitySuccessor = { rows: [pin('packages/engine/dist/index.d.ts')] };
    if (name === 'atlas-import') v.sourcePolicy = { jsoncPins: [pin('node_modules/jsonc-parser/index.js')] };
    put('tests/types/' + name + '-diagnostic-expectations.json', JSON.stringify(v));
  }
  put('tools/check-types.mjs', 'throw Error("never run legacy gate");');
  put('node_modules/typescript/bin/tsc', 'throw Error("never execute compiler");');
  put('tests/types/sample.ts', 'export {};');
  put('tests/types/tsconfig.sample.json', '{}');
  const fixture = pin('tests/types/sample.ts'),
    config = pin('tests/types/tsconfig.sample.json');
  for (const name of ['browser-png', 'spritesheet', 'sequence-playback', 'byte-writer', 'nine-slice', 'scene3d']) {
    put('tools/' + name + '-types.mjs', 'throw Error("never run gate");');
    let v = { schemaVersion: 1 };
    if (['browser-png', 'spritesheet', 'sequence-playback'].includes(name)) {
      Object.assign(v, {
        kind: name.replaceAll('-', '_').toUpperCase() + '_ACTUAL_STRICT_CONSUMER_DIAGNOSTICS',
        compiler: { pins: [pin('node_modules/typescript/index.js'), config] },
        configurationPins: [config]
      });
      if (name === 'browser-png') {
        v.productPins = [pin('packages/engine/dist/index.d.ts')];
        v.lanes = [{ sourcePin: fixture, configPin: config }];
      } else v.groups = [{ fixture, config }];
      if (name === 'sequence-playback') {
        v.status = 'SAVED_ACTUAL_DATA_FROZEN_REUSABLE_GATE_NOT_RUN';
        v.compiler.observedNative = {
          platform: 'win32',
          arch: 'x64',
          package: '@typescript/typescript-win32-x64',
          pins: [nativePin('package.json'), nativePin('lib/tsc.exe')]
        };
        v.currentDeclarationSuccessor = { sourcePins: [pin('packages/engine/dist/index.d.ts')], fixture, config };
      }
    } else if (name === 'scene3d') {
      v.status = 'OBSERVED_FROZEN_TS7_DIAGNOSTICS';
      v.compiler = {
        packageSHA256: pin('node_modules/typescript/package.json').sha256,
        tscSHA256: pin('node_modules/typescript/bin/tsc').sha256
      };
      v.fixtureSHA256 = {};
      for (const lane of [
        'positive',
        'web-positive',
        'negative',
        'web-negative',
        'import-negative',
        'web-dom-free-negative'
      ]) {
        const f = 'tests/types/scene3d-' + lane + '.ts';
        put(f, 'export {};');
        v.fixtureSHA256[f] = pin(f).sha256;
      }
    } else {
      v.scope = (name === 'byte-writer' ? 'BW1' : 'NS1') + ' actual strict consumer diagnostic inventory';
      v.positive = { fixture };
      v.groups = { negative: { fixture }, 'import-negative': { fixture } };
      if (name === 'nine-slice') {
        v.configurationPins = [config];
        v.compiler = {
          platform: 'win32',
          arch: 'x64',
          wrapperPins: [pin('node_modules/typescript/index.js')],
          nativePlatform: {
            package: { ...nativePin('package.json'), path: '@typescript/typescript-win32-x64/package.json' },
            executable: { ...nativePin('lib/tsc.exe'), path: '@typescript/typescript-win32-x64/lib/tsc.exe' }
          }
        };
      }
    }
    put('tests/types/' + name + '-diagnostic-expectations.json', JSON.stringify(v));
  }
  put('tools/shared-render-types.mjs', 'throw Error("never execute shared gate");');
  const sharedInputs = [
    'tests/types/shared-render-positive.ts',
    'tests/types/shared-render-negative.ts',
    'tests/types/tsconfig.shared-render-positive.json',
    'tests/types/tsconfig.shared-render-negative.json',
    'tests/types/tsconfig.dom-free.json',
    'tests/types/tsconfig.json',
    'tsconfig.base.json'
  ];
  for (const file of sharedInputs) put(file, file.endsWith('.ts') ? 'export {};' : '{}');
  put(
    'tests/types/shared-render-diagnostic-expectations.json',
    JSON.stringify({
      schemaVersion: 1,
      kind: 'SHARED_RENDER_ACTUAL_STRICT_DIAGNOSTICS',
      status: 'OBSERVED_TS7_DIAGNOSTICS',
      compilerVersion: '7.0.2',
      tupleFormat: ['file', 'line', 'column', 'code'],
      inputPins: sharedInputs.map(pin),
      cases: [],
      tuples: []
    })
  );
  return { root, put, pin, close: () => fs.rmSync(root, { recursive: true, force: true }) };
}
