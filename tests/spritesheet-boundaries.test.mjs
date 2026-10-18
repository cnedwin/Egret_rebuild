// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, cpSync, symlinkSync,
  rmSync, realpathSync, existsSync, readdirSync, lstatSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { createHash, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import path from 'node:path';

// First-party actual-copy ownership pattern follows sequence-playback controls.
// Product algorithms and SDK objects are never executed in this policy lane.
const repository = realpathSync(fileURLToPath(new URL('../', import.meta.url)));
const gate = path.join(repository, 'tools/spritesheet-boundary.mjs');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const same = (left, right) => path.relative(left, right) === '';
const inside = (parent, child) => {
  const relative = path.relative(parent, child);
  return relative !== '' && !path.isAbsolute(relative) && relative !== '..' && !relative.startsWith('..' + path.sep);
};
const environment = { ...process.env };
for (const key of Object.keys(environment)) if (/^(?:NODE_OPTIONS|NODE_PATH|NODE_V8_COVERAGE|NODE_COMPILE_CACHE|NODE_REPL_EXTERNAL_MODULE|NODE_TEST_CONTEXT|NODE_TEST_WORKER_ID)$/i.test(key)) delete environment[key];
function check(args) {
  return spawnSync(process.execPath, [gate, ...args], {
    cwd: repository, encoding: 'utf8', windowsHide: true,
    timeout: 30000, maxBuffer: 8 * 1024 * 1024, env: environment,
  });
}
function accepted(result) {
  assert.ifError(result.error); assert.equal(result.signal, null);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.equal(result.stderr, ''); assert.equal(result.stdout, 'SpriteSheet boundaries PASS.\n');
}
function rejected(result, code) {
  assert.ifError(result.error); assert.equal(result.signal, null);
  assert.equal(result.status, 1, result.stdout + result.stderr); assert.equal(result.stdout, '');
  assert.match(result.stderr, new RegExp('^' + code + ': [^\\r\\n]+\\n$'));
}
function inventory(root) {
  const result = [], aliases = new Set(['contracts', 'runtime', 'engine', 'project'].map(name => 'node_modules/@egret/' + name));
  const visit = relative => {
    for (const entry of readdirSync(path.join(root, relative), { withFileTypes: true })) {
      const file = relative ? relative + '/' + entry.name : entry.name;
      if (entry.isSymbolicLink()) { assert.ok(aliases.has(file)); continue; }
      if (entry.isDirectory()) visit(file);
      else {
        assert.ok(entry.isFile());
        if (file === '.spritesheet-policy-copy.json') continue;
        const bytes = readFileSync(path.join(root, file));
        result.push({ path: file, bytes: bytes.length, sha256: hash(bytes) });
      }
    }
  };
  visit(''); return result.sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0);
}
function isolated(action) {
  const parentPath = path.join(tmpdir(), 'egret-spritesheet-policy-controls');
  mkdirSync(parentPath, { recursive: true });
  const parent = realpathSync(parentPath), fixture = realpathSync(mkdtempSync(path.join(parent, 'spritesheet-policy-')));
  assert.ok(inside(parent, fixture)); assert.ok(same(path.dirname(fixture), parent));
  const sourceFiles = [], token = randomUUID();
  const copy = (original, relative) => {
    const target = path.join(fixture, relative);
    mkdirSync(path.dirname(target), { recursive: true });
    cpSync(original, target, { recursive: true, filter: file => path.basename(file) !== 'node_modules' });
    const record = (source, copied) => {
      const stat = lstatSync(source);
      if (stat.isDirectory()) {
        for (const entry of readdirSync(source)) if (entry !== 'node_modules') record(path.join(source, entry), copied + '/' + entry);
      } else {
        assert.ok(stat.isFile(), 'Original evidence must be a physical file');
        const bytes = readFileSync(source);
        assert.deepEqual(readFileSync(path.join(fixture, copied)), bytes, 'Whole original bytes copied: ' + copied);
        sourceFiles.push({ path: copied, source: realpathSync(source), bytes: bytes.length, sha256: hash(bytes) });
      }
    };
    record(original, relative);
  };
  let primary, cleanup;
  try {
    for (const name of ['contracts', 'runtime', 'engine', 'project']) {
      copy(path.join(repository, 'packages', name), 'packages/' + name);
      mkdirSync(path.join(fixture, 'node_modules/@egret'), { recursive: true });
      const copied = path.join(fixture, 'packages', name), link = path.join(fixture, 'node_modules/@egret', name);
      symlinkSync(copied, link, process.platform === 'win32' ? 'junction' : 'dir');
      assert.ok(same(realpathSync(link), realpathSync(copied)));
    }
    for (const file of ['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml',
      ...readdirSync(repository).filter(name => /^tsconfig.*\.json$/.test(name)),
      'tools/build.mjs', 'tools/generate-project-format.mjs']) copy(path.join(repository, file), file);
    for (const name of ['jsonc-parser', 'robust-predicates']) {
      const resolver = createRequire(path.join(repository, 'packages', name === 'jsonc-parser' ? 'project' : 'engine', 'package.json'));
      const entry = realpathSync(resolver.resolve(name));
      const installed = name === 'jsonc-parser' ? path.resolve(path.dirname(entry), '../..') : path.dirname(entry);
      copy(installed, 'node_modules/' + name);
      const metadata = JSON.parse(readFileSync(path.join(fixture, 'node_modules', name, 'package.json'), 'utf8'));
      assert.equal(metadata.name, name); assert.equal(metadata.version, name === 'jsonc-parser' ? '3.3.1' : '3.0.3');
    }
    for (const file of ['package.json', 'bin/tsc', 'lib/tsc.js', 'lib/getExePath.js'])
      copy(realpathSync(path.join(repository, 'node_modules/typescript', file)), 'dependency-evidence/typescript/' + file);
    const resolver = createRequire(realpathSync(path.join(repository, 'node_modules/typescript/lib/getExePath.js')));
    const nativeName = '@typescript/typescript-' + process.platform + '-' + process.arch;
    const nativeMetadata = realpathSync(resolver.resolve(nativeName + '/package.json'));
    const nativePackage = JSON.parse(readFileSync(nativeMetadata, 'utf8'));
    assert.equal(nativePackage.name, nativeName); assert.equal(nativePackage.version, '7.0.2');
    copy(nativeMetadata, 'dependency-evidence/typescript-native/package.json');
    const executable = 'lib/tsc' + (process.platform === 'win32' ? '.exe' : '');
    copy(realpathSync(path.join(path.dirname(nativeMetadata), executable)), 'dependency-evidence/typescript-native/' + executable);
    copy(gate, 'tools/spritesheet-boundary.mjs');
    const baseline = inventory(fixture);
    writeFileSync(path.join(fixture, '.spritesheet-policy-copy.json'), JSON.stringify({
      kind: 'GENUINE_SPRITESHEET_POLICY_COPY', token, root: fixture, parent,
      sourceRoot: repository, pins: baseline, sourceFiles,
    }) + '\n', { flag: 'wx' });
    const verify = () => check(['--root', fixture, '--owned-parent', parent, '--owner-token', token]);
    // Each assigned mutant gets its own complete successful original baseline.
    accepted(verify()); action({ fixture, verify, baseline });
  } catch (cause) { primary = { cause }; }
  finally {
    try {
      const resolved = realpathSync(fixture);
      assert.ok(same(resolved, fixture)); assert.ok(inside(parent, resolved));
      assert.ok(same(path.dirname(resolved), parent)); assert.ok(path.basename(resolved).startsWith('spritesheet-policy-'));
      for (const name of ['contracts', 'runtime', 'engine', 'project']) {
        const link = path.join(resolved, 'node_modules/@egret', name);
        if (existsSync(link)) {
          const target = realpathSync(link);
          assert.ok(inside(resolved, target)); assert.ok(same(target, realpathSync(path.join(resolved, 'packages', name))));
        }
      }
      rmSync(resolved, { recursive: true, force: false, maxRetries: 0 });
      assert.equal(existsSync(resolved), false);
    } catch (cause) { cleanup = { cause }; }
  }
  if (primary && cleanup) throw new AggregateError([primary.cause, cleanup.cause], 'Policy control and owned cleanup failure');
  if (cleanup) throw cleanup.cause;
  if (primary) throw primary.cause;
}

test('SS1-P00 current complete built graph satisfies SpriteSheet source/emission policy', () => {
  accepted(check(['--root', repository]));
});
const controls = [
  { name: 'SS1-M12 runtime source cannot mix with unchanged emission', file: 'packages/runtime/src/frameCapture.ts', code: 'SS1_BOUNDARY_SOURCE_OWNER',
    mutate: bytes => Buffer.concat([bytes, Buffer.from('// unaccepted incremental capture source\n')]) },
  { name: 'SS1-M12 new helper emission rejects equal-size wrong hash', file: 'packages/engine/dist/rendering/preparedFrameCache2D.js', code: 'SS1_BOUNDARY_SOURCE_OWNER',
    mutate: bytes => { const changed = Buffer.from(bytes); changed[0] ^= 1; assert.equal(changed.length, bytes.length); return changed; } },
  { name: 'SS1-M11 source mutation cannot mix with unchanged helper emissions', file: 'packages/engine/web/webgpuBufferPool.ts', code: 'SS1_BOUNDARY_SOURCE_OWNER',
    mutate: bytes => Buffer.concat([bytes, Buffer.from('// unaccepted warm submission source\n')]) },
  { name: 'SS1-M11 helper emission rejects equal-size wrong hash', file: 'packages/engine/dist/web/webgpuBindingCache.js', code: 'SS1_BOUNDARY_SOURCE_OWNER',
    mutate: bytes => { const changed = Buffer.from(bytes); changed[0] ^= 1; assert.equal(changed.length, bytes.length); return changed; } },
  { name: 'SS1-P01 private original Bitmap port cannot escape a public root', file: 'packages/runtime/src/index.ts', code: 'SS1_BOUNDARY_PRIVATE_PORT',
    mutate: bytes => Buffer.concat([bytes, Buffer.from('\nexport { spriteSheetBitmapOperations as spriteSheetAssembly } from "./Bitmap.js";\n')]) },
  { name: 'SS1-P02 erased SpriteSheet cannot become an emitted value', file: 'packages/runtime/dist/spriteSheet.js', code: 'SS1_BOUNDARY_TYPE_VALUE',
    mutate: bytes => Buffer.concat([bytes, Buffer.from('\nexport const SpriteSheet = 1;\n')]) },
  { name: 'SS1-P03 runtime leaf cannot gain an Engine backedge', file: 'packages/runtime/src/spriteSheet.ts', code: 'SS1_BOUNDARY_HOST_BACKEDGE',
    mutate: bytes => Buffer.concat([bytes, Buffer.from('\nimport { Engine as spriteSheetForbiddenEngine } from "@egret/engine";\n')]) },
  { name: 'SS1-P04 shared core cannot gain DOM ambient dependencies', file: 'tsconfig.base.json', code: 'SS1_BOUNDARY_AMBIENT_DEPENDENCY',
    mutate: bytes => {
      const config = JSON.parse(bytes.toString('utf8'));
      assert.deepEqual(config.compilerOptions.lib, ['ES2022']);
      config.compilerOptions.lib = ['ES2022', 'DOM'];
      return Buffer.from(JSON.stringify(config) + '\n');
    } },
  { name: 'SS1-P05 exact Host source rejects same-path wrong bytes', file: 'packages/engine/web/WebGPUHost.ts', code: 'SS1_BOUNDARY_SOURCE_OWNER',
    mutate: bytes => Buffer.concat([bytes, Buffer.from('// unaccepted Host bytes\n')]) },
  { name: 'SS1-P06 exact Host emission rejects equal-size wrong hash', file: 'packages/engine/dist/web/WebGPUHost.js', code: 'SS1_BOUNDARY_SOURCE_OWNER',
    mutate: bytes => { const changed = Buffer.from(bytes); changed[0] ^= 1; assert.equal(changed.length, bytes.length); return changed; } },
  { name: 'SS1-P07 cache export cannot extend the public root', file: 'packages/engine/src/index.ts', code: 'SS1_BOUNDARY_ROOT_VALUES',
    mutate: bytes => Buffer.concat([bytes, Buffer.from('export { imageResidencyCache } from "../web/WebGPUHost.js";\n')]) },
];
for (const control of controls) test(control.name, t => isolated(({ fixture, verify, baseline }) => {
  const file = path.join(fixture, control.file), before = readFileSync(file);
  try {
    // Fixture construction remains outside the assigned policy refusal.
    const mutated = control.mutate(before); assert.notDeepEqual(mutated, before);
    writeFileSync(file, mutated);
    const changed = inventory(fixture).filter((item, index) => JSON.stringify(item) !== JSON.stringify(baseline[index])).map(item => item.path);
    assert.deepEqual(changed, [control.file], 'One assigned source/emission/configuration unit changed');
    rejected(verify(), control.code);
    t.diagnostic(control.code + ' is a source/emission refusal, not SDK behavior or rendering acceptance.');
  } finally {
    writeFileSync(file, before);
    assert.deepEqual(readFileSync(file), before, 'Whole original file inverse');
    assert.deepEqual(inventory(fixture), baseline, 'Complete original snapshot hash identity restored');
    accepted(verify());
  }
}));

// Complete original copies surround inventory and ownership refusals as well.
for (const missing of [false, true]) test('SS1-P inventory ' + (missing ? 'missing Host module' : 'extra module'), () => isolated(({ fixture, verify, baseline }) => {
  const relative = missing ? 'packages/engine/dist/web/WebGPUHost.js' : 'packages/engine/dist/web/image-residency-unlisted.js';
  const file = path.join(fixture, relative), before = missing ? readFileSync(file) : undefined;
  try {
    if (missing) rmSync(file); else writeFileSync(file, 'export {};\n');
    const current = inventory(fixture);
    assert.deepEqual(current.filter(row => !baseline.some(old => old.path === row.path)).map(row => row.path), missing ? [] : [relative]);
    assert.deepEqual(baseline.filter(row => !current.some(now => now.path === row.path)).map(row => row.path), missing ? [relative] : []);
    rejected(verify(), 'SS1_BOUNDARY_SOURCE_OWNER');
  } finally {
    if (missing) writeFileSync(file, before); else rmSync(file);
    assert.deepEqual(inventory(fixture), baseline); accepted(verify());
  }
}));
test('SS1-P copy cannot be relabelled with another owner token', () => isolated(({ fixture, verify, baseline }) => {
  const file = path.join(fixture, '.spritesheet-policy-copy.json'), before = readFileSync(file);
  try {
    const receipt = JSON.parse(before); receipt.token = randomUUID(); writeFileSync(file, JSON.stringify(receipt) + '\n');
    rejected(verify(), 'SS1_BOUNDARY_COPY');
  } finally { writeFileSync(file, before); assert.deepEqual(inventory(fixture), baseline); accepted(verify()); }
}));

for (const relative of ['packages/engine/dist/web/webgpuBufferPool.d.ts', 'packages/engine/web/webgpuBindingCache.ts'])
  test('SS1-M11 incomplete whole successor refuses missing ' + relative, () => isolated(({ fixture, verify, baseline }) => {
    const file = path.join(fixture, relative), before = readFileSync(file);
    try {
      rmSync(file);
      const current = inventory(fixture);
      assert.deepEqual(baseline.filter(row => !current.some(now => now.path === row.path)).map(row => row.path), [relative]);
      rejected(verify(), 'SS1_BOUNDARY_SOURCE_OWNER');
    } finally { writeFileSync(file, before); assert.deepEqual(inventory(fixture), baseline); accepted(verify()); }
  }));

// Every new path participates in the complete M1.2 group, including declarations.
for (const relative of ["packages/engine/dist/rendering/preparedBatches2D.d.ts","packages/engine/dist/rendering/preparedBatches2D.js","packages/engine/dist/rendering/preparedFrameCache2D.d.ts","packages/engine/dist/rendering/preparedFrameCache2D.js","packages/engine/rendering/preparedBatches2D.ts","packages/engine/rendering/preparedFrameCache2D.ts","packages/runtime/dist/frameCaptureCache.d.ts","packages/runtime/dist/frameCaptureCache.js","packages/runtime/src/frameCaptureCache.ts"])
  test('SS1-M12 missing exact new path ' + relative, () => isolated(({ fixture, verify, baseline }) => {
    const file = path.join(fixture, relative), before = readFileSync(file);
    try {
      rmSync(file); const current = inventory(fixture);
      assert.deepEqual(baseline.filter(row => !current.some(now => now.path === row.path)).map(row => row.path), [relative]);
      assert.deepEqual(current, baseline.filter(row => row.path !== relative));
      rejected(verify(), 'SS1_BOUNDARY_SOURCE_OWNER');
    } finally { writeFileSync(file, before); assert.deepEqual(inventory(fixture), baseline); accepted(verify()); }
  }));

// M1.3 controls operate on a complete genuine owned copy and restore every byte.
for (const [relative, mode] of [["packages/contracts/src/SharedGeometry2D.ts","missing"],["packages/runtime/dist/sharedFrameCapture.js","missing"],["packages/engine/dist/web/webgpuRetentionPool.d.ts","missing"],["packages/engine/rendering/prepareSharedDraws2D.ts","mixed-source"],["packages/engine/dist/rendering/sharedColor2D.js","same-size-hash"]])
  test('SS1-M13 complete group refuses ' + mode + ' ' + relative, () => isolated(({ fixture, verify, baseline }) => {
    const file = path.join(fixture, relative), before = readFileSync(file);
    try {
      if (mode === 'missing') rmSync(file);
      else if (mode === 'mixed-source') writeFileSync(file, Buffer.concat([before, Buffer.from('\n// unaccepted shared source\n')]));
      else { const altered=Buffer.from(before); altered[0]^=1; assert.equal(altered.length,before.length); writeFileSync(file,altered); }
      const now=inventory(fixture), prior=new Map(baseline.map(row=>[row.path,row]));
      assert.deepEqual([...now.filter(row=>JSON.stringify(row)!==JSON.stringify(prior.get(row.path))).map(row=>row.path),...baseline.filter(row=>!now.some(current=>current.path===row.path)).map(row=>row.path)],[relative]);
      rejected(verify(), 'SS1_BOUNDARY_SOURCE_OWNER');
    } finally { writeFileSync(file, before); assert.deepEqual(inventory(fixture), baseline); accepted(verify()); }
  }));
