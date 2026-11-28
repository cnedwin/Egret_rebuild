// SPDX-License-Identifier: Apache-2.0
// The push, setup, merge, verify and shared-baseline runners: order, failure propagation and options.
import test from 'node:test';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
// Runner controls execute first-party tool code with owned gates, not SDK acceptance.

function withPushFixture(body) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'egret push feedback '));
  try {
    fs.mkdirSync(path.join(root, 'tools'));
    fs.copyFileSync(new URL('../../tools/check-push.mjs', import.meta.url), path.join(root, 'tools/check-push.mjs'));
    for (const gate of ['doctor', 'check-repository-hygiene', 'check-test-baselines', 'check-publication']) {
      fs.writeFileSync(
        path.join(root, 'tools', gate + '.mjs'),
        "import fs from 'node:fs'; fs.appendFileSync('calls.jsonl',JSON.stringify({gate:" +
          JSON.stringify(gate) +
          ',args:process.argv.slice(2)})+String.fromCharCode(10)); if(process.env.EGRET_FIXTURE_FAILURE===' +
          JSON.stringify(gate) +
          ')process.exit(23);\n'
      );
    }
    fs.mkdirSync(path.join(root, 'knowledge-base/tools'), { recursive: true });
    fs.writeFileSync(
      path.join(root, 'knowledge-base/tools/Validate-KnowledgeBase.ps1'),
      "param([switch]$CheckOnly)\n$arguments = @()\nif ($CheckOnly) { $arguments += '-CheckOnly' }\n@{ gate = 'knowledge-base'; args = $arguments } | ConvertTo-Json -Compress | Add-Content -LiteralPath 'calls.jsonl' -Encoding utf8\nif ($env:EGRET_FIXTURE_FAILURE -eq 'knowledge-base') { exit 23 }\n"
    );
    const run = (args = [], failure) =>
      spawnSync(process.execPath, ['tools/check-push.mjs', ...args], {
        cwd: root,
        encoding: 'utf8',
        env: { ...process.env, EGRET_FIXTURE_FAILURE: failure ?? '' }
      });
    const calls = () =>
      fs.existsSync(path.join(root, 'calls.jsonl'))
        ? fs.readFileSync(path.join(root, 'calls.jsonl'), 'utf8').trim().split('\n').map(JSON.parse)
        : [];
    body({ run, calls });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}
test('push checks qualify shared prerequisites before committed publication', () =>
  withPushFixture(({ run, calls }) => {
    const r = run(['--committed']);
    assert.equal(r.status, 0, r.stderr);
    assert.deepEqual(calls(), [
      { gate: 'doctor', args: [] },
      { gate: 'check-repository-hygiene', args: ['--committed'] },
      { gate: 'check-test-baselines', args: [] },
      { gate: 'check-publication', args: ['--contribution'] },
      { gate: 'knowledge-base', args: ['-CheckOnly'] }
    ]);
    assert.match(r.stdout, /not.*merge|merge.*required/i);
  }));
test('every push gate failure stops publication and propagates its exit status', () => {
  for (const [i, gate] of [
    'doctor',
    'check-repository-hygiene',
    'check-test-baselines',
    'check-publication',
    'knowledge-base'
  ].entries())
    withPushFixture(({ run, calls }) => {
      const r = run(['--committed'], gate);
      assert.equal(r.status, 23, r.stderr);
      assert.equal(calls().length, i + 1);
    });
});
test('push feedback rejects unknown and repeated flags before running checks', () => {
  for (const args of [['--integrated'], ['--committed', '--committed'], ['--skip-tests']])
    withPushFixture(({ run, calls }) => {
      const r = run(args);
      assert.notEqual(r.status, 0);
      assert.deepEqual(calls(), []);
    });
});

// Execute the actual setup orchestration with controlled prerequisite and child
// process ports. Installation, SDK compilation and Git configuration do not run.
function setupControl(args) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'egret setup feedback '));
  const calls = [];
  try {
    const cli = path.join(root, 'pnpm/bin/pnpm.cjs');
    fs.mkdirSync(path.dirname(cli), { recursive: true });
    fs.writeFileSync(path.join(root, 'pnpm/package.json'), JSON.stringify({ name: 'pnpm', version: '11.25.0' }));
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ packageManager: 'pnpm@11.25.0' }));
    const dependency = path.join(root, 'node_modules/robust-predicates');
    fs.mkdirSync(dependency, { recursive: true });
    fs.writeFileSync(
      path.join(dependency, 'package.json'),
      JSON.stringify({ name: 'robust-predicates', version: '3.0.3' })
    );
    const engineModules = path.join(root, 'packages/engine/node_modules');
    fs.mkdirSync(engineModules, { recursive: true });
    fs.symlinkSync(
      dependency,
      path.join(engineModules, 'robust-predicates'),
      process.platform === 'win32' ? 'junction' : 'dir'
    );
    let source = fs.readFileSync(new URL('../../tools/setup-dev.mjs', import.meta.url), 'utf8');
    source = source.replace(/^import .*;\r?$/gm, '');
    const context = {
      fs,
      path,
      repository: root,
      localPackage: (_root, p) => p,
      samePhysicalPath: (a, b) => a === b,
      createRequire: () => {
        throw Error('Unexpected native branch in Linux control');
      },
      inspectEnvironment: () => ({ ok: true }),
      console: { log() {}, error() {} },
      process: {
        argv: ['node', 'setup-dev.mjs', ...args],
        execPath: process.execPath,
        platform: 'linux',
        arch: 'x64',
        env: { npm_execpath: cli },
        exit(code) {
          throw Error('exit ' + code);
        }
      },
      spawnSync(command, argv) {
        calls.push({ command, args: [...argv] });
        return { status: command === 'git' && argv.includes('--get') ? 1 : 0 };
      }
    };
    vm.runInNewContext(source, context, { filename: 'setup-dev.mjs' });
    return calls.map(call => ({ ...call, args: call.args.map(arg => (arg === cli ? '<fixture-pnpm>' : arg)) }));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}
test('setup skips only its build when CI explicitly requests no-build', () => {
  const normal = setupControl([]),
    setupOnly = setupControl(['--no-build']);
  assert.equal(normal.filter(v => v.args.includes('tools/build.mjs')).length, 1);
  assert.equal(setupOnly.filter(v => v.args.includes('tools/build.mjs')).length, 0);
  assert.deepEqual(
    setupOnly,
    normal.filter(v => !v.args.includes('tools/build.mjs'))
  );
  assert.ok(
    setupOnly.some(
      v => v.args.includes('install') && v.args.includes('--frozen-lockfile') && v.args.includes('--ignore-scripts')
    )
  );
  assert.ok(setupOnly.some(v => v.args.includes('tools/doctor.mjs')));
});
test('setup refuses unknown and duplicate options', () => {
  for (const args of [['--no-build', '--no-build'], ['--skip-install'], ['--build']])
    assert.throws(() => setupControl(args), /Usage/);
});

// Actual merge/verify entry points run against owned child gates. A missing
// output marker models clean-checkout ordering, not a real SDK compilation.
function withMergeRunner(body) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'egret merge order '));
  const put = (file, text) => {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), text);
  };
  try {
    const prepush = fs.readFileSync(new URL('../../tools/prepush.mjs', import.meta.url), 'utf8');
    put('tools/prepush.mjs', prepush);
    put('tools/verify.mjs', fs.readFileSync(new URL('../../tools/verify.mjs', import.meta.url), 'utf8'));
    // The sequence reads the evidence lane to refuse it; the lane itself is never a child gate here.
    put(
      'tools/lib/evidence-lane.mjs',
      fs.readFileSync(new URL('../../tools/lib/evidence-lane.mjs', import.meta.url), 'utf8')
    );
    const gates = [
      'check-repository-hygiene',
      'contribution-metadata',
      'check-publication',
      'build',
      'check-test-baselines',
      'check-boundaries',
      'check-spine-content',
      'check-type-lanes',
      'check-types',
      'test',
      'verify-spine-f2-source'
    ];
    function child(gate) {
      const setup =
        "import fs from 'node:fs';fs.appendFileSync('calls.jsonl',JSON.stringify({gate:" +
        JSON.stringify(gate) +
        ',args:process.argv.slice(2)})+String.fromCharCode(10));if(process.env.EGRET_FIXTURE_FAILURE===' +
        JSON.stringify(gate) +
        ')process.exit(23);';
      if (gate === 'build')
        return (
          setup + "fs.mkdirSync('dist',{recursive:true});fs.writeFileSync('dist/ready','controlled runner output');\n"
        );
      if (['check-repository-hygiene', 'contribution-metadata'].includes(gate)) return setup;
      return (
        setup + "if(!fs.existsSync('dist/ready')){console.error('BUILD_REQUIRED_BEFORE_GATE');process.exit(29);}\n"
      );
    }
    for (const gate of gates) put('tools/' + gate + '.mjs', child(gate));
    for (const name of ['headless', 'nine-slice-bitmap-headless']) put('examples/' + name + '.mjs', child(name));
    const publication = [...prepush.matchAll(/'(tests\/publication\/[^']+\.test\.mjs)'/g)].map(row => row[1]);
    assert.ok(publication.length > 0, 'the actual merge runner must execute publication regressions');
    for (const name of publication) put(name, child('publication-test'));
    put(
      'knowledge-base/tools/Validate-KnowledgeBase.ps1',
      "param([switch]$CheckOnly)\nif (-not $CheckOnly) { exit 29 }\nif (-not (Test-Path -LiteralPath 'dist/ready')) { exit 29 }\n@{ gate = 'knowledge-base'; args = @('-CheckOnly') } | ConvertTo-Json -Compress | Add-Content -LiteralPath 'calls.jsonl' -Encoding utf8\n"
    );
    // Start the nested publication runner as a separate test session.
    const environment = { ...process.env, EGRET_METADATA_BASE: '' };
    delete environment.NODE_TEST_CONTEXT;
    const run = (tool, args = [], failure) =>
      spawnSync(process.execPath, ['tools/' + tool + '.mjs', ...args], {
        cwd: root,
        encoding: 'utf8',
        env: { ...environment, EGRET_FIXTURE_FAILURE: failure ?? '' }
      });
    const calls = () =>
      fs.existsSync(path.join(root, 'calls.jsonl'))
        ? fs.readFileSync(path.join(root, 'calls.jsonl'), 'utf8').trim().split('\n').map(JSON.parse)
        : [];
    assert.equal(fs.existsSync(path.join(root, 'dist')), false);
    body({ run, calls });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}
test('complete merge checks build once before publication from an empty output tree', () => {
  for (const args of [[], ['--committed', '--integrated']])
    withMergeRunner(({ run, calls }) => {
      const r = run('prepush', args);
      assert.equal(r.status, 0, r.stdout + '\n' + r.stderr);
      const rows = calls(),
        build = rows.findIndex(v => v.gate === 'build'),
        publication = rows.findIndex(v => v.gate === 'check-publication');
      assert.equal(rows.filter(v => v.gate === 'build').length, 1);
      assert.ok(build >= 0 && build < publication);
      const baseline = rows.findIndex(v => v.gate === 'check-test-baselines');
      assert.ok(build < baseline && baseline < publication);
      assert.deepEqual(rows[baseline].args, ['--no-build']);
      assert.ok(
        rows.some(v => v.gate === 'publication-test'),
        r.stdout + '\n' + JSON.stringify(rows)
      );
      for (const gate of [
        'check-type-lanes',
        'check-types',
        'test',
        'verify-spine-f2-source',
        'headless',
        'nine-slice-bitmap-headless',
        'knowledge-base'
      ])
        assert.ok(
          rows.some(v => v.gate === gate),
          gate
        );
      assert.deepEqual(
        rows.find(v => v.gate === 'check-repository-hygiene').args,
        args.includes('--committed') ? ['--committed'] : []
      );
      assert.equal(
        rows.some(v => v.gate === 'contribution-metadata'),
        args.includes('--integrated')
      );
    });
});
test('initial build failure stops the merge runner before publication', () =>
  withMergeRunner(({ run, calls }) => {
    const r = run('prepush', [], 'build');
    assert.equal(r.status, 23, r.stderr);
    assert.deepEqual(
      calls().map(v => v.gate),
      ['check-repository-hygiene', 'build']
    );
  }));
test('standalone verify builds by default and explicit no-build reuses prepared output', () => {
  withMergeRunner(({ run, calls }) => {
    const r = run('verify');
    assert.equal(r.status, 0, r.stderr);
    assert.equal(calls().filter(v => v.gate === 'build').length, 1);
  });
  withMergeRunner(({ run, calls }) => {
    assert.equal(run('build').status, 0);
    const r = run('verify', ['--no-build']);
    assert.equal(r.status, 0, r.stderr);
    assert.equal(calls().filter(v => v.gate === 'build').length, 1, 'verify must not rebuild prepared output');
  });
  withMergeRunner(({ run, calls }) => {
    const r = run('verify', ['--no-build']);
    assert.equal(r.status, 29, r.stderr);
    assert.equal(calls()[0].gate, 'check-boundaries');
  });
});
test('verify rejects unknown and duplicate options before starting children', () => {
  for (const args of [['--no-build', '--no-build'], ['--skip-tests'], ['--integrated']])
    withMergeRunner(({ run, calls }) => {
      assert.notEqual(run('verify', args).status, 0);
      assert.deepEqual(calls(), []);
    });
});

test('failed shared baseline stops the merge runner before publication and mutation matrices', () =>
  withMergeRunner(({ run, calls }) => {
    const r = run('prepush', [], 'check-test-baselines');
    assert.equal(r.status, 23, r.stderr);
    assert.deepEqual(
      calls().map(v => v.gate),
      ['check-repository-hygiene', 'build', 'check-test-baselines']
    );
  }));

// Run the actual small selector with owned Node test files; no SDK or device work.
function withBaselineRunner(action) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'egret shared baselines '));
  const put = (name, body) => {
    fs.mkdirSync(path.dirname(path.join(root, name)), { recursive: true });
    fs.writeFileSync(path.join(root, name), body);
  };
  try {
    put(
      'tools/check-test-baselines.mjs',
      fs.readFileSync(new URL('../../tools/check-test-baselines.mjs', import.meta.url))
    );
    put(
      'tools/build.mjs',
      "import fs from 'node:fs';fs.writeFileSync('built','once');if(process.env.EGRET_BASELINE_BUILD_FAIL)process.exit(23);\n"
    );
    const definitions = [
      ['tests/boundaries.test.mjs', 'canonical boundary policy baseline admits every retained surface'],
      [
        'tests/project-boundaries.test.mjs',
        'strict public project consumers and unsuppressed diagnostic locations run through the actual type gate'
      ]
    ];
    for (const [name, title] of definitions)
      put(
        name,
        "import test from 'node:test';import fs from 'node:fs';test(" +
          JSON.stringify(title) +
          ",()=>{if(!fs.existsSync('built'))throw Error('BUILD_REQUIRED');if(process.env.EGRET_BASELINE_TEST_FAIL)throw Error('ASSIGNED_BASELINE_FAILURE');});test('unselected expensive matrix',()=>{throw Error('MATRIX_MUST_NOT_RUN');});\n"
      );
    const environment = { ...process.env };
    delete environment.NODE_TEST_CONTEXT;
    const run = (args = [], extra = {}) =>
      spawnSync(process.execPath, ['tools/check-test-baselines.mjs', ...args], {
        cwd: root,
        encoding: 'utf8',
        env: { ...environment, ...extra }
      });
    action({ root, put, definitions, run });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}
test('shared baseline selector builds once and executes only its two required controls', () =>
  withBaselineRunner(({ run }) => {
    const r = run();
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /Shared test baselines PASS \(2\/2\)/);
    assert.doesNotMatch(r.stdout + r.stderr, /MATRIX_MUST_NOT_RUN/);
  }));
test('shared baseline no-build path requires actual prepared output and reuses it', () =>
  withBaselineRunner(({ run, put, root }) => {
    const missing = run(['--no-build']);
    assert.notEqual(missing.status, 0);
    assert.match(missing.stdout, /BUILD_REQUIRED/);
    assert.equal(fs.existsSync(path.join(root, 'built')), false);
    put('built', 'prepared');
    const ready = run(['--no-build'], { EGRET_BASELINE_BUILD_FAIL: '1' });
    assert.equal(ready.status, 0, ready.stdout + ready.stderr);
    assert.equal(fs.readFileSync(path.join(root, 'built'), 'utf8'), 'prepared');
  }));
test('shared baseline selector rejects a missing test and propagates build or assertion failure', () => {
  withBaselineRunner(({ run, put, definitions }) => {
    put(definitions[0][0], "import test from 'node:test';test('renamed control',()=>{});\n");
    const r = run();
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /BASELINE_SELECTION_INCOMPLETE/);
  });
  withBaselineRunner(({ run }) => {
    const r = run([], { EGRET_BASELINE_BUILD_FAIL: '1' });
    assert.equal(r.status, 23);
  });
  withBaselineRunner(({ run }) => {
    const r = run([], { EGRET_BASELINE_TEST_FAIL: '1' });
    assert.notEqual(r.status, 0);
    assert.match(r.stdout, /ASSIGNED_BASELINE_FAILURE/);
  });
});
test('shared baseline selector refuses unsupported or repeated options before building', () =>
  withBaselineRunner(({ run, root }) => {
    for (const args of [['--skip-tests'], ['--no-build', '--no-build']]) {
      const r = run(args);
      assert.notEqual(r.status, 0);
      assert.equal(fs.existsSync(path.join(root, 'built')), false);
    }
  }));
