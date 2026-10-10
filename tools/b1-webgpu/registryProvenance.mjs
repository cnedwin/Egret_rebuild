// First-party B1 tooling policy. Admission is filesystem/resolver evidence only.
import assert from 'node:assert/strict';
import { readFile, realpath, lstat } from 'node:fs/promises';
import { resolve, relative, isAbsolute, sep, dirname } from 'node:path';
import { createHash } from 'node:crypto';

const ALIAS = '#egret-textured-frame-state';
const REGISTRY = 'packages/engine/dist/internal/texturedFrameState.js';
const ENGINE = 'packages/engine/dist/Engine.js';
const HOSTS = ['packages/engine/dist/web/CanvasHost.js', 'packages/engine/dist/web/WebGPUHost.js'];
const SOURCE_READ_CAP = 128 * 1024 * 1024;
const POLICY_ORIGIN = 'http://egret-b1-resolver.invalid';
const S04_SOURCE = 'packages/engine/src/internal/texturedFrameState.ts';
const S04_REGISTRY = 'packages/engine/dist/internal/texturedFrameState.js';
const S04_MODES = ['baseline', 'N1', 'N2', 'N3', 'N4', 'N5'];
const S04_PATCH_TARGETS = {
  N1: 'packages/engine/dist/web/webgpuMeshPass.js',
  N2: 'packages/engine/dist/web/WebGPUHost.js',
  N3: 'packages/engine/dist/web/WebGPUHost.js',
  N4: 'packages/engine/dist/web/webgpuMeshPass.js',
  N5: 'packages/engine/dist/web/webgpuMeshPass.js',
};
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const descriptor = (path, bytes) => ({ path, bytes: bytes.length, sha256: sha256(bytes) });
function inside(root, candidate) {
  const tail = relative(root, candidate);
  return tail === '' || (!isAbsolute(tail) && tail !== '..' && !tail.startsWith('..' + sep));
}
function s04SamePhysical(first, second) {
  const normalize = path => process.platform === 'win32' ? resolve(path).toLowerCase() : resolve(path);
  return normalize(first) === normalize(second);
}
async function s04Roots(repository, output) {
  assert.ok(typeof repository === 'string' && isAbsolute(repository), 'Registry repository root must be absolute');
  assert.ok(typeof output === 'string' && isAbsolute(output), 'Registry output root must be absolute');
  const original = await realpath(repository), copied = await realpath(output);
  assert.ok(s04SamePhysical(repository, original) && s04SamePhysical(output, copied), 'Registry roots must remain canonical');
  assert.ok((await lstat(original)).isDirectory() && (await lstat(copied)).isDirectory(), 'Registry roots must remain directories');
  assert.ok(!inside(original, copied) && !inside(copied, original), 'Registry output must remain repository-external');
  return { repository: original, output: copied };
}
async function readDescriptor(root, name) {
  const target = resolve(root, name), physical = await realpath(target);
  assert.ok(inside(root, target) && inside(root, physical), 'Registry recording input escaped its admitted root');
  assert.ok(s04SamePhysical(target, physical), 'Registry recording input must remain canonical');
  const info = await lstat(physical);
  assert.ok(info.isFile() && !info.isSymbolicLink() && info.size <= SOURCE_READ_CAP, 'Registry recording input is not a bounded regular file');
  const bytes = await readFile(physical);
  assert.ok(bytes.length <= SOURCE_READ_CAP, 'Registry recording input exceeded its bounded read');
  return descriptor(name, bytes);
}
function retained(input) {
  return {
    selectedMode: input.selectedMode,
    originalSource: structuredClone(input.originalSource),
    originalEmitted: structuredClone(input.originalEmitted),
    selectedEmitted: structuredClone(input.selectedEmitted),
    originalsStableAfter: null, selectedStableAfter: null,
  };
}
function selectedLocation(repository, output, provenance) {
  return provenance.selectedMode === 'baseline'
    ? { root: repository, path: S04_REGISTRY, url: '/' + S04_REGISTRY }
    : { root: output, path: `copies/${provenance.selectedMode}/${S04_REGISTRY}`, url: `/copy/${provenance.selectedMode}/${S04_REGISTRY}` };
}
function equal(first, second) {
  return second !== null && first.path === second.path && first.bytes === second.bytes
    && first.sha256 === second.sha256 && first.url === second.url;
}
function fault(error) {
  return { name: typeof error?.name === 'string' ? error.name : 'Unknown',
    code: typeof error?.code === 'string' ? error.code : null,
    message: typeof error?.message === 'string' ? error.message.slice(0, 16000) : 'Non-error rejection' };
}
function s04OriginalDescriptor(value, actual, role) {
  assert.ok(value && typeof value === 'object', `Registry ${role} descriptor is required`);
  assert.equal(value.path, actual.path, `Registry ${role} logical path differs`);
  assert.equal(value.bytes, actual.bytes, `Registry ${role} retained byte count differs from its file`);
  assert.equal(value.sha256, actual.sha256, `Registry ${role} retained hash differs from its file`);
}
function s04CaptureResult(input, registryProvenance, captureObservations, reason) {
  return {
    accepted: reason === null, status: reason === null ? 'ACCEPTED' : 'INCOMPLETE', reason,
    registryProvenance, captureObservations,
    recordingScope: 'Enforced filesystem and selected resolver policy; not browser loads or requests',
    copiedFile: structuredClone(input.copiedFile), changedFiles: input.changedFiles, patchTarget: input.patchTarget,
    resolverPolicy: { scope: 'Selected route policy only; not observed browser loads or requests',
      selectedMode: input.selectedMode, consumers: structuredClone(input.consumers) },
  };
}
function s04DescriptorReason(path, field, expected, actual) {
  return { code: 'B1_REGISTRY_COPY_DESCRIPTOR_MISMATCH', phase: 'capture', path, field, expected, actual };
}

/** Observe the current exact map and selected relative route; never load a module. */
export function resolveRegistryConsumers(selectedMode, importMap) {
  const prefix = selectedMode === 'baseline' ? '/' : `/copy/${selectedMode}/`;
  const engineUrl = prefix + ENGINE;
  const relativeUrl = new URL('./internal/texturedFrameState.js', new URL(engineUrl, POLICY_ORIGIN)).pathname;
  // Read the selected exact generated scope; an absent override stays absent.
  // Validation observes the actual mapping and never repairs its target.
  const scopeImports = selectedMode === 'baseline' ? undefined : importMap.scopes?.[prefix];
  // Overlay only the actual selected generated scope. Missing/wrong scopes remain
  // visible to validation; the observer never manufactures a corrected alias.
  const effectiveImports = scopeImports === undefined ? importMap.imports : { ...importMap.imports, ...scopeImports };
  const alias = validatePrivateRegistryMap(effectiveImports, selectedMode)[ALIAS];
  return [
    { importer: ENGINE, importerUrl: engineUrl, specifier: './internal/texturedFrameState.js', url: relativeUrl },
    ...HOSTS.map(importer => ({ importer, importerUrl: prefix + importer, specifier: ALIAS, url: alias })),
  ];
}

/** Enforce exact source authority and retained selected-graph identity before browser work. */
export async function captureRegistryProvenance(input) {
  const roots = await s04Roots(input.repository, input.output);
  assert.ok(S04_MODES.includes(input.selectedMode), 'Registry selected mode is outside the six fixed windows');
  const registryProvenance = retained(input), captureObservations = [];
  const finish = reason => s04CaptureResult(input, registryProvenance, captureObservations, reason);
  if (input.originalSource?.path !== S04_SOURCE) return finish({
    code: 'B1_REGISTRY_SOURCE_PATH_MISMATCH', phase: 'capture', path: input.originalSource?.path,
    field: 'originalSource.path', expected: S04_SOURCE, actual: input.originalSource?.path,
  });
  let originalSource;
  try { originalSource = await readDescriptor(roots.repository, S04_SOURCE); }
  catch (error) {
    // Only absence at the exact authoritative source read earns this reason.
    if (error?.code !== 'ENOENT') throw error;
    return finish({ code: 'B1_REGISTRY_EXACT_SOURCE_MISSING', phase: 'capture', path: S04_SOURCE, field: 'originalSource.path' });
  }
  captureObservations.push({ role: 'originalSource', descriptor: originalSource });
  s04OriginalDescriptor(input.originalSource, originalSource, 'originalSource');
  assert.equal(input.originalEmitted?.path, S04_REGISTRY, 'Registry original emission must bind the exact emitted path');
  const originalEmitted = await readDescriptor(roots.repository, S04_REGISTRY);
  captureObservations.push({ role: 'originalEmitted', descriptor: originalEmitted });
  s04OriginalDescriptor(input.originalEmitted, originalEmitted, 'originalEmitted');
  const selected = selectedLocation(roots.repository, roots.output, registryProvenance);
  // Path and URL authority precede a wrong-path read and retained payload comparisons.
  for (const [field, expected] of [['path', selected.path], ['url', selected.url]]) {
    if (input.selectedEmitted?.[field] !== expected) return finish(s04DescriptorReason(
      input.selectedEmitted?.path, 'selectedEmitted.' + field, expected, input.selectedEmitted?.[field]));
  }
  for (const field of ['bytes', 'sha256']) {
    if (input.selectedEmitted[field] !== originalEmitted[field]) return finish(s04DescriptorReason(
      selected.path, 'selectedEmitted.' + field, originalEmitted[field], input.selectedEmitted[field]));
  }
  const selectedEmitted = { ...await readDescriptor(selected.root, selected.path), url: selected.url };
  captureObservations.push({ role: 'selectedEmitted', descriptor: selectedEmitted });
  for (const field of ['bytes', 'sha256']) {
    if (selectedEmitted[field] !== originalEmitted[field]) return finish(s04DescriptorReason(
      selected.path, 'selectedEmitted.' + field, originalEmitted[field], selectedEmitted[field]));
  }
  if (input.selectedMode === 'baseline') {
    assert.equal(input.copiedFile, null, 'Baseline must not acquire a copy manifest entry');
    assert.equal(input.changedFiles, 0, 'Baseline must not acquire a sensitivity mutation');
    assert.equal(input.patchTarget, null, 'Baseline must not acquire a sensitivity target');
  } else {
    for (const [field, expected] of [['path', S04_REGISTRY], ['bytes', originalEmitted.bytes],
      ['sha256', originalEmitted.sha256], ['originalSHA256', originalEmitted.sha256]]) {
      if (input.copiedFile?.[field] !== expected) return finish(s04DescriptorReason(
        input.copiedFile?.path ?? S04_REGISTRY, 'copiedFile.' + field, expected, input.copiedFile?.[field]));
    }
    assert.equal(input.changedFiles, 1, 'Each copy must retain exactly one existing sensitivity mutation');
    assert.equal(input.patchTarget, S04_PATCH_TARGETS[input.selectedMode], 'Copy sensitivity target differs from its designated original module');
    assert.notEqual(input.patchTarget, S04_REGISTRY, 'Registry must never become a sensitivity target');
  }
  assert.ok(Array.isArray(input.consumers) && input.consumers.length === 3, 'Registry policy requires the three exact consumer routes');
  const prefix = input.selectedMode === 'baseline' ? '/' : `/copy/${input.selectedMode}/`;
  for (const [index, importer] of [ENGINE, ...HOSTS].entries()) {
    const value = input.consumers[index], specifier = index === 0 ? './internal/texturedFrameState.js' : ALIAS;
    assert.equal(value?.importer, importer, 'Registry consumer order or importer differs');
    assert.equal(value.importerUrl, prefix + importer, 'Registry consumer importer URL is outside its selected graph');
    assert.equal(value.specifier, specifier, 'Registry consumer specifier differs from its exact route');
    if (index === 0) assert.equal(value.url, selected.url, 'Engine relative registry route must select its exact graph');
    else if (value.url !== selected.url) return finish({
      code: 'B1_REGISTRY_SELECTED_ALIAS_MISMATCH', phase: 'capture', path: S04_REGISTRY, field: 'consumers.url',
      importer, specifier: ALIAS, expected: selected.url, actual: value.url,
    });
    // moduleCollected:false rows remain policy observations, never claimed loads.
  }
  return finish(null);
}

/** Reread every role, retain all peers, then choose source/emission/copy priority. */
export async function verifyRegistryProvenanceAfter({ repository, output, captured }) {
  const roots = await s04Roots(repository, output);
  assert.equal(captured?.accepted, true, 'Registry reread requires an accepted retained capture');
  const provenance = structuredClone(captured.registryProvenance);
  assert.ok(S04_MODES.includes(provenance.selectedMode), 'Registry reread selected mode differs');
  assert.equal(provenance.originalSource?.path, S04_SOURCE, 'Registry reread source binding differs');
  assert.equal(provenance.originalEmitted?.path, S04_REGISTRY, 'Registry reread emission binding differs');
  const selected = selectedLocation(roots.repository, roots.output, provenance);
  assert.equal(provenance.selectedEmitted?.path, selected.path, 'Registry reread selected path differs');
  assert.equal(provenance.selectedEmitted?.url, selected.url, 'Registry reread selected URL differs');
  const observations = [];
  for (const [role, root, path] of [
    ['originalSource', roots.repository, S04_SOURCE],
    ['originalEmitted', roots.repository, S04_REGISTRY],
    ['selectedEmitted', selected.root, selected.path],
  ]) {
    const before = structuredClone(provenance[role]);
    let after, error;
    try {
      after = await readDescriptor(root, path);
      if (role === 'selectedEmitted') after = { ...after, url: selected.url };
    } catch (failure) { after = null; error = fault(failure); }
    observations.push({ role, before, after, stable: equal(before, after), ...(error ? { error } : {}) });
  }
  provenance.originalsStableAfter = observations[0].stable && observations[1].stable;
  provenance.selectedStableAfter = observations[2].stable;
  let reason = null, incomplete = false;
  for (const observation of observations) {
    if (observation.stable) continue;
    incomplete = true;
    // A failed read is evidence loss, not an invented file-change diagnosis.
    if (observation.error) break;
    const codes = { originalSource: 'B1_REGISTRY_ORIGINAL_SOURCE_CHANGED',
      originalEmitted: 'B1_REGISTRY_ORIGINAL_EMITTED_CHANGED', selectedEmitted: 'B1_REGISTRY_SELECTED_COPY_CHANGED' };
    reason = { code: codes[observation.role], phase: 'after', path: observation.before.path,
      field: observation.role, before: structuredClone(observation.before), after: structuredClone(observation.after),
      ...(observation.role === 'selectedEmitted' ? { url: observation.before.url } : {}) };
    break;
  }
  return { accepted: !incomplete, status: incomplete ? 'INCOMPLETE' : 'ACCEPTED', reason,
    registryProvenance: provenance, observations,
    recordingScope: 'Enforced retained filesystem rereads; not browser loads or requests' };
}

const privatePolicyRefusals = new WeakSet();
function refusePrivatePolicy(code, phase, field, expected, actual) {
  const refusal = Object.assign(new Error(code), { status: 'INCOMPLETE', code, phase, field, expected, actual });
  privatePolicyRefusals.add(refusal);
  throw refusal;
}
/** Classify only deliberate failures created by this exact private policy module. */
export function isPrivateRegistryPolicyRefusal(error) { return privatePolicyRefusals.has(error); }

/** Resolve the fixed B1 graph while keeping private authority on two exact hosts. */
export function resolveB1Dependency(specifier, parent, { repository, aliases }) {
  if (specifier.startsWith('#') && specifier !== ALIAS) {
    refusePrivatePolicy('B1_PRIVATE_REGISTRY_ALIAS_UNKNOWN', 'dependency', 'specifier', ALIAS, specifier);
  }
  if (specifier === ALIAS) {
    if (!HOSTS.includes(parent)) refusePrivatePolicy('B1_PRIVATE_REGISTRY_IMPORTER_UNAPPROVED', 'dependency', 'parent', [...HOSTS], parent);
    if (!Object.hasOwn(aliases, ALIAS)) refusePrivatePolicy('B1_PRIVATE_REGISTRY_ALIAS_MISSING', 'dependency', ALIAS, REGISTRY, undefined);
    if (aliases[ALIAS] !== REGISTRY) refusePrivatePolicy('B1_PRIVATE_REGISTRY_ALIAS_TARGET_MISMATCH', 'dependency', ALIAS, REGISTRY, aliases[ALIAS]);
    return REGISTRY;
  }
  if (Object.hasOwn(aliases, specifier)) return aliases[specifier];
  assert.ok(specifier.startsWith('.'), `Unsupported emitted dependency ${specifier}`);
  const value = relative(repository, resolve(repository, dirname(parent), specifier)).replaceAll('\\', '/');
  assert.ok(!value.startsWith('../') && !isAbsolute(value) && value.endsWith('.js'));
  return value;
}

/** Admit the exact generated selected map without changing its contents. */
export function validatePrivateRegistryMap(effectiveImports, selectedMode) {
  assert.ok(['baseline', 'N1', 'N2', 'N3', 'N4', 'N5'].includes(selectedMode), 'Invalid selected registry mode');
  for (const name of Object.keys(effectiveImports)) {
    if (name.startsWith('#') && name !== ALIAS) refusePrivatePolicy('B1_PRIVATE_REGISTRY_ALIAS_UNKNOWN', 'map', 'specifier', ALIAS, name);
  }
  const expected = (selectedMode === 'baseline' ? '/' : `/copy/${selectedMode}/`) + REGISTRY;
  if (!Object.hasOwn(effectiveImports, ALIAS)) refusePrivatePolicy('B1_PRIVATE_REGISTRY_ALIAS_MISSING', 'map', ALIAS, expected, undefined);
  if (effectiveImports[ALIAS] !== expected) refusePrivatePolicy('B1_PRIVATE_REGISTRY_ALIAS_TARGET_MISMATCH', 'map', ALIAS, expected, effectiveImports[ALIAS]);
  return effectiveImports;
}
