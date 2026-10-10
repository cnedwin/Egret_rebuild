import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mkdtemp, mkdir, writeFile, readFile, realpath, lstat, rm } from 'node:fs/promises';
import { dirname, join, relative, resolve, isAbsolute, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

// This candidate replaces tests/textured-frame-boundaries.test.mjs on adoption.
// It retains S01 unchanged and exercises tooling policy, never product modules.
const root = new URL('../', import.meta.url);
const text = name => readFileSync(new URL(name, root), 'utf8');
const REGISTRY = 'packages/engine/dist/internal/texturedFrameState.js';
const SOURCE = 'packages/engine/src/internal/texturedFrameState.ts';

// Source-policy evidence only. Real original/copied browser runs are separate gates.
test('S01 browser alias and B1 source exception are exact', () => {
  assert.ok(text(SOURCE).includes('readOwnedTexturedFrame'));
  assert.ok(text(REGISTRY).includes('readOwnedTexturedFrame'));
  for (const file of ['examples/canvas-scene/index.html', 'examples/webgpu/index.html']) {
    const source = text(file), match = source.match(/<script type="importmap">([^<]+)<\/script>/);
    assert.ok(match, 'existing import map: ' + file);
    const imports = JSON.parse(match[1]).imports;
    assert.equal(imports['#egret-textured-frame-state'], '/' + REGISTRY, 'exact private registry alias: ' + file);
  }
  for (const file of ['tools/verify-webgpu.mjs', 'tools/verify-webgpu-b1.mjs']) {
    assert.match(text(file), /['"]#egret-textured-frame-state['"]\s*:\s*['"]packages\/engine\/dist\/internal\/texturedFrameState\.js['"]/);
  }
  const verifier = text('tools/verify-webgpu-b1.mjs');
  const special = verifier.indexOf("if (name === '" + REGISTRY + "')");
  const generic = verifier.indexOf("name.startsWith('packages/engine/dist/')");
  assert.ok(special >= 0 && special < generic, 'one literal exception before generic engine source mapping');
  assert.ok(verifier.slice(special, generic).includes("source = '" + SOURCE + "'"));
  assert.equal(verifier.match(/source = 'packages\/engine\/src\/internal\/texturedFrameState\.ts'/g)?.length, 1);
  assert.doesNotMatch(verifier, /source\s*=\s*[^;]*(?:tail\.startsWith\(['"]internal\/|name\.includes\(['"]internal\/)/);
  assert.ok(fileURLToPath(root).length > 0);
});

const MODES = ['baseline', 'N1', 'N2', 'N3', 'N4', 'N5'];
const HOSTS = ['packages/engine/dist/web/CanvasHost.js', 'packages/engine/dist/web/WebGPUHost.js'];
const ENGINE = 'packages/engine/dist/Engine.js';
const ALIAS = '#egret-textured-frame-state';
const PATCH_TARGETS = {
  N1: 'packages/engine/dist/web/webgpuMeshPass.js', N2: HOSTS[1], N3: HOSTS[1],
  N4: 'packages/engine/dist/web/webgpuMeshPass.js', N5: 'packages/engine/dist/web/webgpuMeshPass.js',
};
const SOURCE_BYTES = Buffer.from('// Independently authored policy source fixture.\nexport const registrySource: number = 1;\n');
const EMITTED_BYTES = Buffer.from('// Independently authored policy emission fixture.\nexport const registrySource = 1;\n');
const AFTER_COMMENT = Buffer.from('// independently authored after-capture drift\n');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const describe = (path, bytes) => ({ path, bytes: bytes.length, sha256: sha(bytes) });
const copied = mode => mode !== 'baseline';
const selectedPath = mode => copied(mode) ? `copies/${mode}/${REGISTRY}` : REGISTRY;
const selectedUrl = mode => copied(mode) ? `/copy/${mode}/${REGISTRY}` : '/' + REGISTRY;
const importerUrl = (mode, name) => (copied(mode) ? `/copy/${mode}/` : '/') + name;
let policyPromise;
function policy() {
  // Root must establish the real guard-neutral policy seam before RED. A missing
  // module is a setup failure and cannot establish a missing-provenance RED.
  return policyPromise ??= import(new URL('../tools/b1-webgpu/registryProvenance.mjs', import.meta.url).href);
}
function within(base, target) {
  const tail = relative(base, target);
  return tail === '' || (!isAbsolute(tail) && tail !== '..' && !tail.startsWith('..' + sep));
}
async function writeOwned(base, name, bytes) {
  const file = resolve(base, name);
  assert.ok(within(base, file), 'Fixture file must stay in its owned root');
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, bytes, { flag: 'wx' });
}
async function filesystem(t, mode) {
  const base = await realpath(tmpdir());
  const repository = await realpath(fileURLToPath(root));
  assert.equal(within(repository, base), false, 'Temporary base must be outside the product repository before any write');
  const directory = await realpath(await mkdtemp(join(base, 'egret-b1-registry-policy-')));
  assert.equal(within(repository, directory), false, 'Synthetic files must be outside the product repository');
  assert.ok(within(base, directory) && dirname(directory) === base);
  const ownedName = directory;
  t.after(async () => {
    assert.equal(directory, ownedName);
    assert.equal(await realpath(directory), directory, 'Never recursively delete a replaced fixture root');
    const info = await lstat(directory);
    assert.equal(info.isSymbolicLink(), false);
    assert.equal(info.isDirectory(), true);
    assert.ok(dirname(directory) === base && within(base, directory));
    assert.ok(directory.split(sep).at(-1).startsWith('egret-b1-registry-policy-'));
    await rm(directory, { recursive: true, force: true });
  });
  const original = resolve(directory, 'repository'), output = resolve(directory, 'output');
  await mkdir(original); await mkdir(output);
  await writeOwned(original, SOURCE, SOURCE_BYTES);
  // The wrong source intentionally has identical bytes, a valid descriptor and a
  // regular physical path, so a hash/root/existence guard cannot reject it first.
  await writeOwned(original, 'packages/engine/src/Engine.ts', SOURCE_BYTES);
  await writeOwned(original, REGISTRY, EMITTED_BYTES);
  if (copied(mode)) await writeOwned(output, selectedPath(mode), EMITTED_BYTES);
  const consumers = [
    { importer: ENGINE, importerUrl: importerUrl(mode, ENGINE), specifier: './internal/texturedFrameState.js', url: selectedUrl(mode) },
    ...HOSTS.map(importer => ({ importer, importerUrl: importerUrl(mode, importer), specifier: ALIAS, url: selectedUrl(mode) })),
  ];
  const input = {
    repository: original, output, selectedMode: mode,
    originalSource: describe(SOURCE, SOURCE_BYTES), originalEmitted: describe(REGISTRY, EMITTED_BYTES),
    selectedEmitted: { ...describe(selectedPath(mode), EMITTED_BYTES), url: selectedUrl(mode) },
    copiedFile: copied(mode) ? { ...describe(REGISTRY, EMITTED_BYTES), originalSHA256: sha(EMITTED_BYTES) } : null,
    consumers, changedFiles: copied(mode) ? 1 : 0, patchTarget: copied(mode) ? PATCH_TARGETS[mode] : null,
  };
  assert.notEqual(input.originalSource.sha256, input.originalEmitted.sha256,
    'Source/emission equality is not a compiler or provenance requirement');
  assert.equal(consumers.length, 3);
  assert.equal(consumers.filter(value => value.specifier === ALIAS).length, 2);
  const saved = structuredClone(input);
  return { original, output, input, saved, mode };
}
function projection(input) {
  return {
    selectedMode: input.selectedMode, originalSource: structuredClone(input.originalSource),
    originalEmitted: structuredClone(input.originalEmitted), selectedEmitted: structuredClone(input.selectedEmitted),
  };
}
function captured(receipt, input) {
  assert.equal(receipt.accepted, true, 'Valid descriptor capture must initialize before any assigned perturbation');
  assert.equal(receipt.status, 'ACCEPTED');
  assert.equal(receipt.reason, null);
  for (const [key, expected] of Object.entries(projection(input))) {
    assert.deepEqual(receipt.registryProvenance[key], expected, 'Retained ' + key);
  }
  assert.equal(receipt.registryProvenance.originalsStableAfter, null, 'Capture must not claim an unperformed reread');
  assert.equal(receipt.registryProvenance.selectedStableAfter, null);
}
function finished(receipt, input) {
  assert.equal(receipt.accepted, true);
  assert.equal(receipt.status, 'ACCEPTED');
  assert.equal(receipt.reason, null);
  for (const [key, expected] of Object.entries(projection(input))) assert.deepEqual(receipt.registryProvenance[key], expected);
  assert.equal(receipt.registryProvenance.originalsStableAfter, true);
  assert.equal(receipt.registryProvenance.selectedStableAfter, true);
  assert.deepEqual(receipt.observations.map(value => value.role), ['originalSource', 'originalEmitted', 'selectedEmitted']);
  for (const value of receipt.observations) {
    assert.equal(value.stable, true);
    assert.deepEqual(value.after, value.before);
  }
}
function refused(receipt, code, phase, details) {
  assert.equal(receipt.accepted, false, 'Assigned malformed provenance must not be admitted');
  assert.equal(receipt.status, 'INCOMPLETE', 'Provenance refusal is incomplete evidence, never a render FAIL or UNSUPPORTED');
  assert.equal(receipt.reason.code, code);
  assert.equal(receipt.reason.phase, phase);
  for (const [field, expected] of Object.entries(details)) assert.deepEqual(receipt.reason[field], expected, 'Reason field ' + field);
}
async function admit(t, mode) {
  const w = await filesystem(t, mode), api = await policy();
  assert.equal(typeof api.captureRegistryProvenance, 'function', 'Real tooling policy capture seam');
  assert.equal(typeof api.verifyRegistryProvenanceAfter, 'function', 'Real tooling final-read seam');
  const before = structuredClone(w.input), receipt = await api.captureRegistryProvenance(w.input);
  assert.deepEqual(w.input, before, 'Policy must not rewrite the caller descriptors or graph');
  captured(receipt, w.input);
  const captureIdentity = structuredClone(receipt);
  const final = await api.verifyRegistryProvenanceAfter({ repository: w.original, output: w.output, captured: receipt });
  assert.deepEqual(receipt, captureIdentity, 'Final reads must not replace retained expected descriptors');
  finished(final, w.input);
  return { ...w, api, receipt };
}
async function recapture(w) {
  const input = structuredClone(w.input), result = await w.api.captureRegistryProvenance(w.input);
  assert.deepEqual(w.input, input, 'Assigned rejection must not repair the malformed input');
  return result;
}

test('S04-BASE B1 registry valid baseline provenance passes', async t => {
  const w = await admit(t, 'baseline');
  assert.equal(w.receipt.registryProvenance.selectedEmitted.path, REGISTRY);
  assert.equal(w.receipt.registryProvenance.selectedEmitted.url, '/' + REGISTRY);
  assert.equal(w.input.copiedFile, null);
});

test('S04-COPY B1 registry valid selected copied provenance passes', async t => {
  for (const mode of MODES.slice(1)) await t.test(mode, async subtest => {
    const w = await admit(subtest, mode);
    assert.equal(w.receipt.registryProvenance.selectedEmitted.path, `copies/${mode}/${REGISTRY}`);
    assert.equal(w.receipt.registryProvenance.selectedEmitted.url, `/copy/${mode}/${REGISTRY}`);
    assert.equal(w.input.copiedFile.originalSHA256, w.input.originalEmitted.sha256);
    assert.equal(w.input.copiedFile.sha256, w.input.originalEmitted.sha256);
    assert.equal(w.input.selectedEmitted.sha256, w.input.originalEmitted.sha256);
    assert.equal(w.input.changedFiles, 1);
    assert.equal(w.input.patchTarget, PATCH_TARGETS[mode]);
    assert.notEqual(w.input.patchTarget, REGISTRY, 'Registry is not a sensitivity target');
  });
});

test('S04-SOURCE-ABSENT B1 registry rejects absent exact original source', async t => {
  for (const mode of MODES) await t.test(mode, async subtest => {
    const w = await admit(subtest, mode);
    await rm(resolve(w.original, SOURCE));
    const result = await recapture(w);
    refused(result, 'B1_REGISTRY_EXACT_SOURCE_MISSING', 'capture', { path: SOURCE, field: 'originalSource.path' });
    assert.deepEqual(w.input, w.saved, 'Only the required physical source was removed');
    assert.deepEqual(await readFile(resolve(w.original, 'packages/engine/src/Engine.ts')), SOURCE_BYTES);
    assert.deepEqual(await readFile(resolve(w.original, REGISTRY)), EMITTED_BYTES);
    if (copied(mode)) assert.deepEqual(await readFile(resolve(w.output, selectedPath(mode))), EMITTED_BYTES);
  });
});

test('S04-WRONG-SOURCE B1 registry rejects wrong existing original source path', async t => {
  for (const mode of MODES) await t.test(mode, async subtest => {
    const w = await admit(subtest, mode), wrong = 'packages/engine/src/Engine.ts';
    w.input.originalSource = describe(wrong, SOURCE_BYTES);
    assert.equal((await lstat(resolve(w.original, wrong))).isFile(), true);
    assert.deepEqual(await readFile(resolve(w.original, wrong)), await readFile(resolve(w.original, SOURCE)));
    const result = await recapture(w);
    refused(result, 'B1_REGISTRY_SOURCE_PATH_MISMATCH', 'capture', {
      path: wrong, field: 'originalSource.path', expected: SOURCE, actual: wrong,
    });
    const restored = structuredClone(w.input); restored.originalSource = w.saved.originalSource;
    assert.deepEqual(restored, w.saved, 'No selected path, hash or route was changed');
  });
});

const DESCRIPTOR_CASES = [
  ['selectedEmitted.bytes', input => { input.selectedEmitted.bytes++; }, input => input.selectedEmitted.path,
    input => input.originalEmitted.bytes, input => input.selectedEmitted.bytes],
  ['selectedEmitted.sha256', input => { input.selectedEmitted.sha256 = '0'.repeat(64); }, input => input.selectedEmitted.path,
    input => input.originalEmitted.sha256, input => input.selectedEmitted.sha256],
  ['selectedEmitted.path', input => { input.selectedEmitted.path = REGISTRY; }, () => REGISTRY,
    input => selectedPath(input.selectedMode), input => input.selectedEmitted.path],
  ['selectedEmitted.url', input => { input.selectedEmitted.url = '/' + REGISTRY; }, input => input.selectedEmitted.path,
    input => selectedUrl(input.selectedMode), input => input.selectedEmitted.url],
  ['copiedFile.bytes', input => { input.copiedFile.bytes++; }, () => REGISTRY,
    input => input.originalEmitted.bytes, input => input.copiedFile.bytes],
  ['copiedFile.sha256', input => { input.copiedFile.sha256 = '0'.repeat(64); }, () => REGISTRY,
    input => input.originalEmitted.sha256, input => input.copiedFile.sha256],
  ['copiedFile.originalSHA256', input => { input.copiedFile.originalSHA256 = '0'.repeat(64); }, () => REGISTRY,
    input => input.originalEmitted.sha256, input => input.copiedFile.originalSHA256],
];
test('S04-DESCRIPTOR B1 registry rejects original and selected copy descriptor mismatch', async t => {
  for (const mode of MODES.slice(1)) for (const [field, alter, path, expected, actual] of DESCRIPTOR_CASES) {
    await t.test(`${mode} ${field}`, async subtest => {
      const w = await admit(subtest, mode);
      alter(w.input);
      const result = await recapture(w);
      refused(result, 'B1_REGISTRY_COPY_DESCRIPTOR_MISMATCH', 'capture', {
        path: path(w.input), field, expected: expected(w.input), actual: actual(w.input),
      });
      assert.deepEqual(await readFile(resolve(w.original, SOURCE)), SOURCE_BYTES);
      assert.deepEqual(await readFile(resolve(w.original, REGISTRY)), EMITTED_BYTES);
      assert.deepEqual(await readFile(resolve(w.output, selectedPath(mode))), EMITTED_BYTES);
      assert.deepEqual(w.input.consumers, w.saved.consumers, 'All selected graph routes remain valid');
      assert.equal(w.input.changedFiles, 1); assert.equal(w.input.patchTarget, PATCH_TARGETS[mode]);
    });
  }
});

test('S04-ORIGINAL-ALIAS B1 registry rejects original alias during copied selection', async t => {
  for (const mode of MODES.slice(1)) for (const affected of [[HOSTS[0]], [HOSTS[1]], HOSTS]) {
    await t.test(`${mode} ${affected.join('+')}`, async subtest => {
      const w = await admit(subtest, mode);
      for (const importer of affected) w.input.consumers.find(value => value.importer === importer).url = '/' + REGISTRY;
      const result = await recapture(w);
      refused(result, 'B1_REGISTRY_SELECTED_ALIAS_MISMATCH', 'capture', {
        path: REGISTRY, field: 'consumers.url', importer: affected[0], specifier: ALIAS,
        expected: selectedUrl(mode), actual: '/' + REGISTRY,
      });
      assert.equal(w.input.consumers.find(value => value.importer === ENGINE).url, selectedUrl(mode),
        'Engine still resolves the selected copy, so equal bytes cannot hide mixed ESM identity');
      const restored = structuredClone(w.input); restored.consumers = w.saved.consumers;
      assert.deepEqual(restored, w.saved, 'Only selected host alias resolutions changed');
      assert.equal(w.input.selectedEmitted.sha256, w.input.originalEmitted.sha256);
    });
  }
});

function observation(receipt, role, before, after, stable) {
  const matches = receipt.observations.filter(value => value.role === role);
  assert.equal(matches.length, 1, 'One exact retained and reread descriptor for ' + role);
  assert.deepEqual(matches[0], { role, before, after, stable });
}
async function afterDrift(w, role, code) {
  const before = structuredClone(w.receipt);
  const isSelected = role === 'selectedEmitted';
  const path = isSelected ? selectedPath(w.mode) : role === 'originalSource' ? SOURCE : REGISTRY;
  const physical = resolve(isSelected ? w.output : w.original, path);
  const body = Buffer.concat([role === 'originalSource' ? SOURCE_BYTES : EMITTED_BYTES, AFTER_COMMENT]);
  await writeFile(physical, body);
  const result = await w.api.verifyRegistryProvenanceAfter({ repository: w.original, output: w.output, captured: w.receipt });
  assert.deepEqual(w.receipt, before, 'The retained expected descriptors must survive a changed reread');
  refused(result, code, 'after', { path, field: role, before: before.registryProvenance[role],
    after: role === 'selectedEmitted' ? { ...describe(path, body), url: selectedUrl(w.mode) } : describe(path, body),
    ...(isSelected ? { url: selectedUrl(w.mode) } : {}),
  });
  for (const [field, expected] of Object.entries(projection(w.input))) {
    assert.deepEqual(result.registryProvenance[field], expected, 'Final report retains before identity ' + field);
  }
  assert.equal(result.registryProvenance.originalsStableAfter, isSelected);
  // Baseline selected is the same physical file as original emission; its changed
  // observation is recorded while the original-emission reason retains priority.
  const selectedStable = isSelected || (w.mode === 'baseline' && role === 'originalEmitted') ? false : true;
  assert.equal(result.registryProvenance.selectedStableAfter, selectedStable);
  for (const field of ['originalSource', 'originalEmitted', 'selectedEmitted']) {
    const retained = before.registryProvenance[field];
    const changed = field === role || (field === 'selectedEmitted' && w.mode === 'baseline' && role === 'originalEmitted');
    const current = changed ? (field === 'selectedEmitted'
      ? { ...describe(retained.path, body), url: retained.url } : describe(retained.path, body)) : retained;
    observation(result, field, retained, current, !changed);
  }
  assert.deepEqual(w.input, w.saved, 'Post-capture drift does not replace input descriptors or graph');
  return result;
}

test('S04-SOURCE-AFTER B1 registry rejects changed original source after capture', async t => {
  for (const mode of MODES) await t.test(mode, async subtest => {
    const w = await admit(subtest, mode);
    await afterDrift(w, 'originalSource', 'B1_REGISTRY_ORIGINAL_SOURCE_CHANGED');
    assert.deepEqual(await readFile(resolve(w.original, REGISTRY)), EMITTED_BYTES);
    if (copied(mode)) assert.deepEqual(await readFile(resolve(w.output, selectedPath(mode))), EMITTED_BYTES);
  });
});

test('S04-EMITTED-AFTER B1 registry rejects changed original emitted registry after capture', async t => {
  for (const mode of MODES) await t.test(mode, async subtest => {
    const w = await admit(subtest, mode);
    await afterDrift(w, 'originalEmitted', 'B1_REGISTRY_ORIGINAL_EMITTED_CHANGED');
    assert.deepEqual(await readFile(resolve(w.original, SOURCE)), SOURCE_BYTES);
    if (copied(mode)) assert.deepEqual(await readFile(resolve(w.output, selectedPath(mode))), EMITTED_BYTES);
  });
});

test('S04-COPY-AFTER B1 registry rejects changed selected copied registry after capture', async t => {
  for (const mode of MODES.slice(1)) await t.test(mode, async subtest => {
    const w = await admit(subtest, mode);
    await afterDrift(w, 'selectedEmitted', 'B1_REGISTRY_SELECTED_COPY_CHANGED');
    assert.deepEqual(await readFile(resolve(w.original, SOURCE)), SOURCE_BYTES);
    assert.deepEqual(await readFile(resolve(w.original, REGISTRY)), EMITTED_BYTES);
    assert.equal(w.input.changedFiles, 1); assert.equal(w.input.patchTarget, PATCH_TARGETS[mode]);
  });
});
