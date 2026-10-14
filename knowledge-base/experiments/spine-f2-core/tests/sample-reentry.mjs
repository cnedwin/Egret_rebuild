// SPDX-License-Identifier: Apache-2.0
// One public callback regression observer; main/pose acceptance/native counts stay zero.
import assert from 'node:assert/strict';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const repositoryOwner = fileURLToPath(new URL('../../../../', import.meta.url));
const entryPath = 'knowledge-base/experiments/spine-f2-core/tests/sample-reentry.mjs';
const helperPath = 'tools/lib/file-identity.mjs';
const fixturePath = 'knowledge-base/experiments/spine-f2-core/tests/fixture.mjs';
const builtEntryPath = 'knowledge-base/experiments/spine-f2-core/dist/index.js';
const observationBoundMs = 5000;
const unitID = 'F2C_SAMPLE_G1_VALIDATE_INDEX_REENTRY_INVALID_OUTER';
const helperPin = Object.freeze({ bytes: 5065, sha256: '999b355c6e0d03f17853ee05f33abc9fecbb34ad80607963e11f913a4f815569' });
const fixturePin = Object.freeze({ bytes: 9152, sha256: 'b8ae94cf4a14039f4c7966672c2e772c71d7c7974a2fe7cdc84af54254db5538' });

// Keep original factory/sample causes, cleanup and failed assertions separate.
function errorEvidence(error, seen = new Set(), depth = 0) {
  if (error === null || typeof error !== 'object') return { value: String(error) };
  if (seen.has(error)) return { repeatedObject: true };
  if (depth >= 12) return { observationTruncated: 'error depth 12' };
  seen.add(error);
  return {
    name: error.name, code: error.code, message: error.message,
    cause: error.cause === undefined ? null : errorEvidence(error.cause, seen, depth + 1),
    cleanupErrors: Array.isArray(error.cleanupErrors) ? error.cleanupErrors.map(value => errorEvidence(value, seen, depth + 1)) : [],
    observationErrors: Array.isArray(error.observationErrors) ? error.observationErrors.map(value => errorEvidence(value, seen, depth + 1)) : [],
  };
}

function freshOutputFile(args, identity) {
  assert.deepEqual(args.slice(0, 1), ['--output'], 'usage: sample-reentry.mjs --output <fresh absolute JSON file>');
  assert.equal(args.length, 2);
  const output = args[1];
  identity.physicalPathKey(output);
  identity.logicalPath(path.basename(output));
  assert.equal(identity.samePhysicalPath(repositoryOwner, output), false);
  let contained = false;
  try { identity.ownerRelativePath(repositoryOwner, output); contained = true; } catch (error) {
    if (!(error instanceof RangeError)) throw error;
  }
  assert.equal(contained, false, 'receipt must leave the repository owner');
  const parent = path.dirname(output), stat = lstatSync(parent);
  assert.ok(stat.isDirectory() && !stat.isSymbolicLink());
  assert.ok(identity.samePhysicalPath(parent, realpathSync(parent)), 'output parent must be its existing canonical physical owner');
  assert.equal(existsSync(output), false, 'never overwrite a prior receipt');
  return output;
}

// Snapshot the genuine captured frame's public data, including exact typed-view bytes.
function frameBytes(frame, identity) {
  return identity.canonicalTextBytes(JSON.stringify(frame, (_key, value) => ArrayBuffer.isView(value)
    ? { viewType: value.constructor.name, bytes: [...new Uint8Array(value.buffer, value.byteOffset, value.byteLength)] }
    : value));
}
const digest = bytes => createHash('sha256').update(bytes).digest('hex');

async function observeInvalidOuter(observation, bridge, fixture, identity) {
  const { egret, originalInput, withContext, boundedWait, findCode, frameOptions, snapshot, retained, committed } = fixture;
  let owner;
  await withContext(async c => {
    owner = c;
    let resources;
    try {
      resources = await boundedWait(bridge.createF2CoreResources(c.engine, c.scope, {
        input: originalInput, pageRef: c.pageRef,
      }), 'G1 ready resources', observationBoundMs);
    } catch (error) {
      observation.factoryError = errorEvidence(error);
      throw error;
    }
    let instance;
    try { instance = resources.createInstance(c.engine.createScope(), 'bend'); } catch (error) {
      observation.instanceConstructionError = errorEvidence(error);
      throw error;
    }
    assert.equal(resources.isDisposed, false);
    assert.equal(instance.state, 'live');
    const root = instance.display;
    assert.ok(root instanceof egret.DisplayObjectContainer);
    c.engine.stage.addChild(root);
    try { instance.sampleAt(0.5); } catch (error) {
      observation.preparationSampleError = errorEvidence(error);
      throw error;
    }
    observation.successfulSupportingSampleTimes = [0.5];
    const before = snapshot(instance);
    assert.ok(before.mesh instanceof egret.Mesh2D);
    assert.ok(egret.isTexturedGeometry2D(before.geometry));
    assert.equal(before.time, 0.5);
    const oldFrame = c.engine.captureTexturedFrame(frameOptions);
    assert.equal(oldFrame.commands.length, 1);
    assert.equal(oldFrame.geometries[0], before.geometry);
    const oldFrameBytes = frameBytes(oldFrame, identity);
    observation.before = { sampleTimeSeconds: before.time, capturedFrameSHA256: digest(oldFrameBytes) };

    const originalOwnDescriptor = Object.getOwnPropertyDescriptor(root, 'validateIndex');
    const originalResolvedMethod = root.validateIndex;
    assert.equal(typeof originalResolvedMethod, 'function', 'the genuine root supplies the original validator');
    let validateCalls = 0, nestedAttempts = 0, oneShot = true;
    let innerThrown = false, innerError, innerReturned = false;
    let outerThrown = false, outerError, outerReturned = false;
    const restoreErrors = [];
    Object.defineProperty(root, 'validateIndex', {
      configurable: true, enumerable: false, writable: true,
      value(...args) {
        validateCalls++;
        if (oneShot) {
          oneShot = false;
          nestedAttempts++;
          try { instance.sampleAt(0.25); innerReturned = true; } catch (error) {
            innerThrown = true;
            innerError = error;
          }
        }
        return Reflect.apply(originalResolvedMethod, this, args);
      },
    });
    try {
      await boundedWait(Promise.resolve().then(() => {
        try { instance.sampleAt(NaN); outerReturned = true; } catch (error) {
          outerThrown = true;
          outerError = error;
        }
      }), 'G1 invalid outer callback observation', observationBoundMs);
    } finally {
      // Always restore the full original own descriptor, including prior absence.
      try {
        if (originalOwnDescriptor === undefined) {
          if (!Reflect.deleteProperty(root, 'validateIndex')) throw new Error('TEST_VALIDATE_INDEX_DELETE_REFUSED');
        } else Object.defineProperty(root, 'validateIndex', originalOwnDescriptor);
      } catch (error) { restoreErrors.push(error); }
      observation.callback = { validateCalls, nestedAttempts, innerThrown, innerReturned };
      observation.innerSampleError = innerThrown ? errorEvidence(innerError) : null;
      observation.outerSampleError = outerThrown ? errorEvidence(outerError) : null;
      observation.outerThrown = outerThrown;
      observation.outerReturned = outerReturned;
      observation.restoreErrors = restoreErrors.map(error => errorEvidence(error));
    }
    if (restoreErrors.length) {
      const error = new Error('TEST_VALIDATE_INDEX_RESTORE');
      error.cleanupErrors = restoreErrors;
      throw error;
    }

    // No assertions or evidence serialization run inside the temporary callback.
    try {
      assert.deepEqual(Object.getOwnPropertyDescriptor(root, 'validateIndex'), originalOwnDescriptor);
      assert.equal(root.validateIndex, originalResolvedMethod);
      observation.originalOwnDescriptorRestored = true;
      assert.equal(nestedAttempts, 1, 'the callback attempts exactly one nested sample');
      assert.equal(validateCalls, 1, 'nested sampling refuses before reentering display validation');
      assert.equal(innerThrown, true, 'the nested call must throw, including falsy rejection values');
      assert.equal(innerReturned, false);
      assert.ok(innerError instanceof egret.EgretError);
      assert.equal(innerError.code, 'F2C_SAMPLE_REENTRANT');
      assert.ok(findCode(innerError, 'F2C_SAMPLE_REENTRANT'));
      assert.equal(outerThrown, true, 'the invalid outer call must throw');
      assert.equal(outerReturned, false);
      assert.ok(outerError instanceof egret.EgretError);
      assert.equal(outerError.code, 'F2C_TIME_INVALID');
      assert.ok(findCode(outerError, 'F2C_TIME_INVALID'));
      assert.equal(instance.state, 'live');
      assert.equal(resources.isDisposed, false);
      committed(before, instance);
      assert.deepEqual(frameBytes(oldFrame, identity), oldFrameBytes, 'retained captured frame bytes after invalid outer call');
      assert.equal(oldFrame.geometries[0], before.geometry);
      observation.afterRefusal = {
        state: instance.state, sampleTimeSeconds: instance.sampleTimeSeconds,
        sameGeometry: before.mesh.geometry === before.geometry,
        retainedGeometryBytes: true, retainedCapturedFrameBytes: true,
      };
    } catch (error) {
      observation.assertionError = errorEvidence(error);
      throw error;
    }

    try { instance.sampleAt(0.25); } catch (error) {
      observation.recoverySampleError = errorEvidence(error);
      throw error;
    }
    observation.successfulSupportingSampleTimes.push(0.25);
    try {
      assert.equal(instance.state, 'live');
      assert.equal(instance.sampleTimeSeconds, 0.25, 'restored ordinary sampling proves guard release');
      const recovered = snapshot(instance);
      assert.ok(recovered.mesh instanceof egret.Mesh2D);
      assert.ok(egret.isTexturedGeometry2D(recovered.geometry));
      retained(before);
      assert.deepEqual(frameBytes(oldFrame, identity), oldFrameBytes, 'captured old frame survives normal recovery sample');
      observation.afterRecovery = {
        state: instance.state, sampleTimeSeconds: instance.sampleTimeSeconds,
        guardReleased: true, retainedOldGeometryBytes: true, retainedCapturedFrameBytes: true,
      };
    } catch (error) {
      observation.assertionError = errorEvidence(error);
      throw error;
    }
  });
  try {
    assert.equal(owner.disposed.length, 1, 'genuine Scope/Engine cleanup retires the one page');
    assert.equal(owner.loads[0].texture.isDisposed, true);
    observation.finalOwnerCleanup = { pageDisposals: owner.disposed.length, pageRetired: true };
  } catch (error) {
    observation.assertionError = errorEvidence(error);
    throw error;
  }
}

async function main() {
  // Hash the helper's raw bytes before evaluating that helper through its file URL.
  const helperURL = new URL('../../../../tools/lib/file-identity.mjs', import.meta.url);
  const helperRaw = readFileSync(helperURL);
  assert.equal(helperRaw.length, helperPin.bytes);
  assert.equal(digest(helperRaw), helperPin.sha256, 'accepted raw identity helper pin');
  const identity = await import(helperURL.href);
  const output = freshOutputFile(process.argv.slice(2), identity);
  const receipt = {
    schema: 'F2C_SAMPLE_CALLBACK_REENTRY_OBSERVER_R1', status: 'NOT_RUN',
    host: { node: process.version, platform: process.platform, arch: process.arch },
    observationBounds: { factoryMs: observationBoundMs, callbackObservationMs: observationBoundMs, fixtureBodyMs: 15000, fixtureEngineCleanupMs: 5000 },
    scope: 'One public callback regression observer. Supporting genuine construction/samples do not complete any main case or numerical pose acceptance.',
    plannedObserverUnitIDs: [unitID], observerUnitsExecuted: 0, observerUnitsPassed: 0,
    mainBehaviorCasesExecuted: 0, fullMainCaseIDsExecuted: [], poseAcceptanceCasesExecuted: 0,
    nativeCasesExecuted: 0, nativePixels: 'not_run', cases: [],
  };
  let primaryCaptured = false, primary;
  try {
    const helper = identity.fingerprintFile(repositoryOwner, helperPath);
    assert.equal(helper.bytes, helperPin.bytes);
    assert.equal(helper.sha256, helperPin.sha256);
    const fixtureEntry = identity.fingerprintFile(repositoryOwner, fixturePath);
    assert.equal(fixtureEntry.bytes, fixturePin.bytes);
    assert.equal(fixtureEntry.sha256, fixturePin.sha256, 'accepted genuine public fixture pin');
    const entry = identity.fingerprintFile(repositoryOwner, entryPath);
    const entryRaw = readFileSync(new URL('./sample-reentry.mjs', import.meta.url));
    assert.deepEqual(identity.canonicalTextBytes(entryRaw.toString('utf8')), entryRaw, 'authored entry is canonical LF UTF-8');
    receipt.entryPinsOnly = [entry, helper, fixtureEntry, identity.fingerprintFile(repositoryOwner, builtEntryPath)];
    receipt.pinBoundary = 'Exact entry/helper/fixture/public built-entry bytes; not a transitive SDK or default-DAG attestation.';
    const bridge = await import(new URL('../dist/index.js', import.meta.url).href);
    const fixture = await import(new URL('./fixture.mjs', import.meta.url).href);
    assert.equal(typeof bridge.createF2CoreResources, 'function');
    const item = { id: unitID, status: 'ENTERED', observation: {} };
    receipt.cases.push(item);
    receipt.observerUnitsExecuted++;
    try {
      await observeInvalidOuter(item.observation, bridge, fixture, identity);
      item.status = 'PASS_CALLBACK_REGRESSION_OBSERVER_ONLY';
      receipt.observerUnitsPassed++;
      receipt.status = 'PASS_CALLBACK_REGRESSION_OBSERVER_ONLY';
    } catch (error) {
      item.status = 'FAIL_CALLBACK_REGRESSION_OBSERVER_ONLY';
      item.failure = errorEvidence(error);
      throw error;
    }
  } catch (error) {
    primaryCaptured = true;
    primary = error;
    receipt.status = 'FAIL_CALLBACK_REGRESSION_OBSERVER_ONLY';
    receipt.failure = errorEvidence(error);
  }
  try { writeFileSync(output, identity.canonicalTextBytes(JSON.stringify(receipt, null, 2)), { flag: 'wx' }); } catch (cleanup) {
    if (primaryCaptured) {
      const error = new Error('TEST_RECEIPT_WRITE', { cause: primary });
      error.cleanupErrors = [cleanup];
      throw error;
    }
    throw cleanup;
  }
  console.log(JSON.stringify({ status: receipt.status, observerUnitsExecuted: receipt.observerUnitsExecuted, observerUnitsPassed: receipt.observerUnitsPassed, mainBehaviorCasesExecuted: 0, poseAcceptanceCasesExecuted: 0, nativeCasesExecuted: 0, output }));
  if (primaryCaptured) throw primary;
}

await main().catch(error => { console.error(error); process.exitCode = 1; });
