// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, readdirSync, lstatSync,
  realpathSync, copyFileSync, symlinkSync, rmSync, existsSync } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createImageData2D, createTexture, copyImageData2DPixels } from '@egret/engine';
import { fingerprintFile, logicalPath, samePhysicalPath } from '../tools/lib/file-identity.mjs';

const repository = realpathSync(fileURLToPath(new URL('../', import.meta.url)));
const packages = ['contracts', 'runtime', 'engine', 'project'];
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const environment = { ...process.env, GIT_OPTIONAL_LOCKS: '0' };
for (const key of Object.keys(environment)) if (/^(NODE_OPTIONS|NODE_PATH|NODE_V8_COVERAGE|NODE_COMPILE_CACHE|NODE_TEST_CONTEXT|NODE_TEST_WORKER_ID)$/i.test(key)) delete environment[key];
function finish(primary, cleanup) {
  if (primary && cleanup) throw new AggregateError([primary.cause, cleanup.cause], 'BIP_POLICY_PRIMARY_AND_CLEANUP_FAILED');
  if (cleanup) throw cleanup.cause;
  if (primary) throw primary.cause;
}
/** Prove existing built public identities before the proposed checker import. */
function sdkBaseline() {
  let texture, primary, cleanup;
  try {
    const pixels = new Uint8Array([255, 0, 0, 255]);
    texture = createTexture(createImageData2D({ width: 1, height: 1, pixels }));
    assert.deepEqual([...copyImageData2DPixels(texture.imageData)], [...pixels]);
  } catch (cause) { primary = { cause }; }
  try { if (texture !== undefined) { texture.dispose(); assert.equal(texture.isDisposed, true); } }
  catch (cause) { cleanup = { cause }; }
  finish(primary, cleanup);
}
async function checker() {
  sdkBaseline();
  // An absent checker remains its actual module error; it is never caught as PASS.
  const module = await import('../tools/browser-png-boundary.mjs');
  assert.equal(typeof module.checkBrowserPngBoundaries, 'function');
  return module.checkBrowserPngBoundaries;
}
function inventory(root) {
  const rows = [];
  const walk = relative => {
    for (const entry of readdirSync(path.join(root, relative), { withFileTypes: true })) {
      const file = relative ? relative + '/' + entry.name : entry.name;
      logicalPath(file);
      if (entry.isSymbolicLink()) {
        assert.ok(packages.some(name => file === 'node_modules/@egret/' + name));
        assert.ok(samePhysicalPath(realpathSync(path.join(root, file)), path.join(root, 'packages', entry.name)));
      } else if (entry.isDirectory()) walk(file);
      else { assert.ok(entry.isFile()); if (file !== '.browser-png-policy-copy.json') rows.push(fingerprintFile(root, file)); }
    }
  };
  walk('');
  return rows.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
}
function gitNames() {
  const result = spawnSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {
    cwd: repository, env: environment, windowsHide: true, timeout: 30_000, maxBuffer: 16 * 1024 * 1024,
  });
  assert.ifError(result.error); assert.equal(result.signal, null); assert.equal(result.status, 0);
  assert.equal(result.stderr.length, 0);
  const bytes = result.stdout;
  assert.ok(bytes.length > 0); assert.equal(bytes.at(-1), 0);
  const names = new TextDecoder('utf-8', { fatal: true }).decode(bytes).slice(0, -1).split('\0');
  for (const name of names) logicalPath(name);
  assert.equal(new Set(names).size, names.length);
  return { names, bytes: bytes.length, sha256: sha(bytes), format: 'literal-NUL-delimited-tracked-plus-visible-untracked' };
}
/** A complete four-package build copy, not a synthetic facade or runtime mock. */
async function isolated(check, body) {
  const parent = path.resolve(tmpdir(), 'egret-browser-png-policy-controls');
  mkdirSync(parent, { recursive: true });
  assert.ok(samePhysicalPath(parent, realpathSync(parent)));
  const root = mkdtempSync(path.join(parent, 'browser-png-policy-'));
  let primary, cleanup;
  try {
    const sourceFiles = [];
    const copy = relative => {
      logicalPath(relative);
      const source = path.join(repository, relative), stat = lstatSync(source);
      assert.equal(stat.isSymbolicLink(), false);
      if (stat.isDirectory()) {
        mkdirSync(path.join(root, relative), { recursive: true });
        for (const entry of readdirSync(source)) if (entry !== 'node_modules') copy(relative + '/' + entry);
      } else {
        assert.ok(stat.isFile());
        const row = fingerprintFile(repository, relative);
        mkdirSync(path.dirname(path.join(root, relative)), { recursive: true });
        copyFileSync(source, path.join(root, relative));
        assert.deepEqual(fingerprintFile(root, relative), row);
        sourceFiles.push({ ...row, source });
      }
    };
    for (const name of packages) copy('packages/' + name);
    for (const file of ['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml',
      ...readdirSync(repository).filter(name => /^tsconfig(?:\.[A-Za-z0-9-]+)?\.json$/.test(name)),
      'tools/browser-png-boundary.mjs', 'tools/lib/file-identity.mjs',
      'tools/build.mjs', 'tools/generate-project-format.mjs']) copy(file);
    mkdirSync(path.join(root, 'node_modules/@egret'), { recursive: true });
    for (const name of packages) symlinkSync(path.join(root, 'packages', name), path.join(root, 'node_modules/@egret', name), process.platform === 'win32' ? 'junction' : 'dir');
    const gitInventory = gitNames(), names = new Set(gitInventory.names);
    for (const row of sourceFiles) if (!row.path.includes('/dist/') && !/\.tsbuildinfo$/.test(row.path)) assert.ok(names.has(row.path), 'Tracked/untracked inventory omitted copied source: ' + row.path);
    const baseline = inventory(root), token = randomUUID();
    writeFileSync(path.join(root, '.browser-png-policy-copy.json'), JSON.stringify({ schemaVersion: 1,
      kind: 'BIP1_GENUINE_BUILT_POLICY_COPY', root, parent, sourceRoot: repository, token,
      sourceFiles, files: baseline, gitInventory }, null, 2) + '\n', { flag: 'wx' });
    const run = () => check(root, { ownedParent: parent, ownerToken: token });
    assert.deepEqual((await run()).issues, [], 'Fresh genuine full-built policy baseline');
    await body({ root, run, baseline });
  } catch (cause) { primary = { cause }; }
  try {
    const resolved = realpathSync(root);
    assert.ok(samePhysicalPath(resolved, root)); assert.ok(samePhysicalPath(path.dirname(resolved), parent));
    assert.ok(path.basename(resolved).startsWith('browser-png-policy-'));
    for (const name of packages) {
      const link = path.join(resolved, 'node_modules/@egret', name);
      if (existsSync(link)) assert.ok(samePhysicalPath(realpathSync(link), path.join(resolved, 'packages', name)));
    }
    rmSync(resolved, { recursive: true, force: false, maxRetries: 0 });
    assert.equal(existsSync(resolved), false);
  } catch (cause) { cleanup = { cause }; }
  finish(primary, cleanup);
}
function append(text) { return bytes => Buffer.concat([bytes, Buffer.from(text, 'utf8')]); }
function jsonEdit(change) { return bytes => { const value = JSON.parse(bytes); change(value); return Buffer.from(JSON.stringify(value, null, 2) + '\n'); }; }
const adapter = 'packages/engine/web/BrowserTextureProvider.ts';
const cases = [
  ['M1.2 runtime source with unchanged emission', 'packages/runtime/src/frameCapture.ts', 'BIP_BOUNDARY_FINGERPRINT', append('// unaccepted incremental capture source\n')],
  ['M1.2 new helper emission equal-size wrong hash', 'packages/engine/dist/rendering/preparedFrameCache2D.js', 'BIP_BOUNDARY_FINGERPRINT', bytes => { const changed = Buffer.from(bytes); changed[0] ^= 1; assert.equal(changed.length, bytes.length); return changed; }],
  ['root factory leak', 'packages/engine/src/index.ts', 'BIP_BOUNDARY_NONOPTIONAL_LEAK', append("\nexport { createBrowserTextureProvider } from '../web/image.js';\n")],
  ['root erased type leak', 'packages/runtime/src/index.ts', 'BIP_BOUNDARY_NONOPTIONAL_LEAK', append('\nexport interface BrowserTextureProvider {}\n')],
  ['extra optional value', 'packages/engine/web/image.ts', 'BIP_BOUNDARY_FACADE', append('\nexport const bipExtraRuntime = 1;\n')],
  ['missing canonical erased type', 'packages/engine/web/image.ts', 'BIP_BOUNDARY_FACADE', bytes => {
    const text = bytes.toString('utf8'); assert.ok(/\bBrowserPngPorts\b/.test(text));
    return Buffer.from(text.replace(/\bBrowserPngPorts\b/, 'BipPolicyMissingType'));
  }],
  ['wrong existing facade forwarding', 'packages/engine/web/image.ts', 'BIP_BOUNDARY_FACADE', bytes => {
    const text = bytes.toString('utf8'); assert.ok(text.includes('./BrowserTextureProvider.js'));
    return Buffer.from(text.replace('./BrowserTextureProvider.js', './CanvasTextRasterProvider.js'));
  }],
  ['erased type gains runtime value', 'packages/engine/dist/web/image.js', 'BIP_BOUNDARY_TYPE_VALUE', append('\nexport const BrowserPngPorts = 1;\n')],
  ['wrong existing route', 'packages/engine/package.json', 'BIP_BOUNDARY_EXPORT_MAP', jsonEdit(value => { value.exports['./web/image'].import = './dist/web/index.js'; })],
  ['Node import', adapter, 'BIP_BOUNDARY_DAG', append("\nimport { readFileSync } from 'node:fs';\n")],
  ['private import', adapter, 'BIP_BOUNDARY_DAG', append("\nimport { readTextureSnapshot } from '../../runtime/src/Texture.js';\n")],
  ['engine self import', adapter, 'BIP_BOUNDARY_DAG', append("\nimport { createTexture as bipEngineSelfValue } from '@egret/engine';\n")],
  ['existing external import', adapter, 'BIP_BOUNDARY_DAG', append("\nimport { orient2d } from 'robust-predicates';\n")],
  ['default core DOM widening', 'tsconfig.base.json', 'BIP_BOUNDARY_AMBIENT', jsonEdit(value => { value.compilerOptions.lib.push('DOM'); })],
  ['default core Node widening', 'tsconfig.base.json', 'BIP_BOUNDARY_AMBIENT', jsonEdit(value => { value.compilerOptions.types.push('node'); })],
  ['dependency drift', 'packages/engine/package.json', 'BIP_BOUNDARY_DAG', jsonEdit(value => { value.dependencies['bip-unapproved'] = '1.0.0'; })],
  ['unlisted source', 'packages/engine/web/bip-policy-unlisted.ts', 'BIP_BOUNDARY_SOURCE_INVENTORY', () => Buffer.from('export {};\n')],
  ['unlisted emission', 'packages/engine/dist/web/bip-policy-unlisted.js', 'BIP_BOUNDARY_SOURCE_INVENTORY', () => Buffer.from('export {};\n')],
  ['M1.1 source mutation cannot mix with unchanged helper emissions', 'packages/engine/web/webgpuBufferPool.ts', 'BIP_BOUNDARY_FINGERPRINT', append('// unaccepted warm submission source\n')],
  ['M1.1 helper emission equal-size wrong hash', 'packages/engine/dist/web/webgpuBindingCache.js', 'BIP_BOUNDARY_FINGERPRINT', bytes => { const changed = Buffer.from(bytes); changed[0] ^= 1; assert.equal(changed.length, bytes.length); return changed; }],
  ['same-path Host source wrong bytes', 'packages/engine/web/WebGPUHost.ts', 'BIP_BOUNDARY_FINGERPRINT', append('// unaccepted Host bytes\n')],
  ['same-path Host emission equal-size wrong hash', 'packages/engine/dist/web/WebGPUHost.js', 'BIP_BOUNDARY_FINGERPRINT', bytes => { const changed = Buffer.from(bytes); changed[0] ^= 1; assert.equal(changed.length, bytes.length); return changed; }],
  ['illegal public cache export', 'packages/engine/src/index.ts', 'BIP_BOUNDARY_FINGERPRINT', append('export { imageResidencyCache } from "../web/WebGPUHost.js";\n')],
];
test('BIP-P00 genuine current build satisfies the standalone source policy', async () => {
  const check = await checker();
  assert.deepEqual((await check(repository)).issues, []);
});
for (const [name, relative, code, mutate] of cases) test('BIP-P ' + name, { timeout: 30_000 }, async () => {
  const check = await checker();
  await isolated(check, async ({ root, run, baseline }) => {
    const file = path.join(root, relative), existed = existsSync(file), before = existed ? readFileSync(file) : undefined;
    let primary, cleanup;
    try {
      writeFileSync(file, mutate(before));
      const current = inventory(root), prior = new Map(baseline.map(row => [row.path, row]));
      assert.deepEqual(current.filter(row => JSON.stringify(row) !== JSON.stringify(prior.get(row.path))).map(row => row.path), [relative]);
      const result = await run();
      assert.deepEqual(result.issues.map(issue => [issue.code, issue.path]), [[code, relative]], 'Assigned rule must precede mere fingerprint mismatch');
    } catch (cause) { primary = { cause }; }
    try {
      if (existed) writeFileSync(file, before); else rmSync(file);
      if (existed) assert.deepEqual(readFileSync(file), before, 'Whole original file inverse');
      assert.deepEqual(inventory(root), baseline, 'Complete original snapshot restored');
      assert.deepEqual((await run()).issues, [], 'Restored genuine policy baseline');
    } catch (cause) { cleanup = { cause }; }
    finish(primary, cleanup);
  });
});

test('BIP-P missing retained Host module refuses the exact inventory', async () => {
  const check = await checker();
  await isolated(check, async ({ root, run, baseline }) => {
    const relative = 'packages/engine/dist/web/WebGPUHost.js', file = path.join(root, relative), before = readFileSync(file);
    try {
      rmSync(file); const current = inventory(root);
      assert.deepEqual(baseline.filter(row => !current.some(now => now.path === row.path)).map(row => row.path), [relative]);
      assert.deepEqual((await run()).issues.map(issue => [issue.code, issue.path]), [['BIP_BOUNDARY_SOURCE_INVENTORY', relative]]);
    } finally { writeFileSync(file, before); assert.deepEqual(inventory(root), baseline); assert.deepEqual((await run()).issues, []); }
  });
});
test('BIP-P copy cannot be relabelled with another owner token', async () => {
  const check = await checker();
  await isolated(check, async ({ root, run, baseline }) => {
    const file = path.join(root, '.browser-png-policy-copy.json'), before = readFileSync(file);
    try {
      const receipt = JSON.parse(before); receipt.token = randomUUID(); writeFileSync(file, JSON.stringify(receipt) + '\n');
      assert.deepEqual((await run()).issues.map(issue => [issue.code, issue.path]), [['BIP_BOUNDARY_OWNER', '.browser-png-policy-copy.json']]);
    } finally { writeFileSync(file, before); assert.deepEqual(inventory(root), baseline); assert.deepEqual((await run()).issues, []); }
  });
});

for (const relative of ['packages/engine/dist/web/webgpuBufferPool.d.ts', 'packages/engine/web/webgpuBindingCache.ts'])
  test('BIP-M11 incomplete whole successor refuses missing ' + relative, async () => {
    const check = await checker();
    await isolated(check, async ({ root, run, baseline }) => {
      const file = path.join(root, relative), before = readFileSync(file);
      try {
        rmSync(file); const current = inventory(root);
        assert.deepEqual(baseline.filter(row => !current.some(now => now.path === row.path)).map(row => row.path), [relative]);
        assert.deepEqual((await run()).issues.map(issue => [issue.code, issue.path]), [['BIP_BOUNDARY_SOURCE_INVENTORY', relative]]);
      } finally { writeFileSync(file, before); assert.deepEqual(inventory(root), baseline); assert.deepEqual((await run()).issues, []); }
    });
  });

for (const relative of ["packages/engine/dist/rendering/preparedBatches2D.d.ts","packages/engine/dist/rendering/preparedBatches2D.js","packages/engine/dist/rendering/preparedFrameCache2D.d.ts","packages/engine/dist/rendering/preparedFrameCache2D.js","packages/engine/rendering/preparedBatches2D.ts","packages/engine/rendering/preparedFrameCache2D.ts","packages/runtime/dist/frameCaptureCache.d.ts","packages/runtime/dist/frameCaptureCache.js","packages/runtime/src/frameCaptureCache.ts"])
  test('BIP-M12 missing exact new path ' + relative, async () => {
    const check = await checker();
    await isolated(check, async ({ root, run, baseline }) => {
      const file = path.join(root, relative), before = readFileSync(file);
      try {
        rmSync(file); const current = inventory(root);
        assert.deepEqual(baseline.filter(row => !current.some(now => now.path === row.path)).map(row => row.path), [relative]);
        assert.deepEqual(current, baseline.filter(row => row.path !== relative));
        assert.deepEqual((await run()).issues.map(issue => [issue.code, issue.path]), [['BIP_BOUNDARY_SOURCE_INVENTORY', relative]]);
      } finally { writeFileSync(file, before); assert.deepEqual(inventory(root), baseline); assert.deepEqual((await run()).issues, []); }
    });
  });
