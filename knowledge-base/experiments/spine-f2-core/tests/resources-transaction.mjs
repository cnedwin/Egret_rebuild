// SPDX-License-Identifier: Apache-2.0
// These are four resource-only partial checks; none completes whole F2C07.
import assert from 'node:assert/strict';
import path from 'node:path';
import { existsSync, lstatSync, realpathSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as bridge from '../dist/index.js';
import { egret, originalInput, withContext, boundedWait, findCode, rejectsCode } from './fixture.mjs';
import {
  canonicalTextBytes, fingerprintFile, logicalPath, ownerRelativePath,
  physicalPathKey, samePhysicalPath,
} from '../../../../tools/lib/file-identity.mjs';

const repositoryOwner = fileURLToPath(new URL('../../../../', import.meta.url));
const observationBoundMs = 5000;
const helperSha256 = '999b355c6e0d03f17853ee05f33abc9fecbb34ad80607963e11f913a4f815569';
const partialCaseIDs = Object.freeze([
  'F2C07_RESOURCE_A_FOREIGN_SCOPE',
  'F2C07_RESOURCE_B_CLOSED_BEFORE_OPTIONS',
  'F2C07_RESOURCE_C_CLOSE_DURING_OPTIONS',
  'F2C07_RESOURCE_D_CAPTURED_GROUP_FACTORY',
]);

// Only observations are bounded; no production lifetime rule is changed.
const factory = (engine, scope, options, label) => boundedWait(
  bridge.createF2CoreResources(engine, scope, options), label, observationBoundMs,
);
const optionsFor = c => ({ input: originalInput, pageRef: c.pageRef });

// Preserve cause and ordered cleanupErrors without altering the thrown object.
function errorEvidence(error, seen = new Set(), depth = 0) {
  if (error === null || typeof error !== 'object') return { value: String(error) };
  if (seen.has(error)) return { repeatedObject: true };
  if (depth >= 12) return { observationTruncated: 'error depth 12' };
  seen.add(error);
  return {
    name: error.name,
    code: error.code,
    message: error.message,
    cause: error.cause === undefined ? null : errorEvidence(error.cause, seen, depth + 1),
    cleanupErrors: Array.isArray(error.cleanupErrors)
      ? error.cleanupErrors.map(value => errorEvidence(value, seen, depth + 1)) : [],
    observationErrors: Array.isArray(error.observationErrors)
      ? error.observationErrors.map(value => errorEvidence(value, seen, depth + 1)) : [],
  };
}

function containsError(error, token, seen = new Set()) {
  if (error === token) return true;
  if (!error || typeof error !== 'object' || seen.has(error)) return false;
  seen.add(error);
  return containsError(error.cause, token, seen)
    || Array.isArray(error.cleanupErrors) && error.cleanupErrors.some(value => containsError(value, token, seen));
}

async function expectedFactoryFailure(action, nestedCode) {
  const factoryError = await rejectsCode(action, nestedCode);
  try {
    assert.ok(factoryError instanceof egret.EgretError, 'the factory preserves public EgretError identity');
    assert.equal(factoryError.code, 'F2C_RESOURCE_LOAD_FAILED', 'outer resource transaction code');
    assert.ok(findCode(factoryError.cause, nestedCode), 'the required cause is nested in the transaction');
  } catch (mismatch) {
    // Capture proves presence; a rejection value must never be tested for truthiness.
    // Keep the refusal and its cleanup separate from the failed observation.
    const error = new Error('TEST_FACTORY_REFUSAL_SHAPE', { cause: factoryError });
    error.observationErrors = [mismatch];
    throw error;
  }
  return factoryError;
}

async function foreignScope(observation) {
  let first, second;
  await withContext(async a => {
    first = a;
    const resourcesA = await factory(a.engine, a.scope, optionsFor(a), 'A first ready resources');
    await withContext(async b => {
      second = b;
      const resourcesB = await factory(b.engine, b.scope, optionsFor(b), 'A second ready resources');
      assert.equal(a.scope.state, 'open');
      assert.equal(b.scope.state, 'open');
      assert.equal(resourcesA.isDisposed, false);
      assert.equal(resourcesB.isDisposed, false);
      assert.equal(a.loads.length, 1);
      assert.equal(b.loads.length, 1);
      const before = [a.loads.length, b.loads.length];
      const error = await expectedFactoryFailure(
        () => factory(a.engine, b.scope, optionsFor(a), 'A foreign Scope refusal'),
        'ASSET_GROUP_SCOPE_INVALID',
      );
      const providerLoadDelta = [a.loads.length - before[0], b.loads.length - before[1]];
      assert.deepEqual(providerLoadDelta, [0, 0], 'the rejected call starts no provider');
      assert.equal(a.scope.state, 'open', 'the first valid Scope remains open');
      assert.equal(b.scope.state, 'open', 'the foreign valid Scope remains open');
      assert.equal(resourcesA.isDisposed, false, 'the first ready resources survive');
      assert.equal(resourcesB.isDisposed, false, 'the second ready resources survive');
      assert.equal(a.disposed.length, 0);
      assert.equal(b.disposed.length, 0);
      observation.readyPreparationLoads = before;
      observation.rejectedFactoryProviderLoadDelta = providerLoadDelta;
      observation.scopesAfterRefusal = [a.scope.state, b.scope.state];
      observation.resourcesDisposedAfterRefusal = [resourcesA.isDisposed, resourcesB.isDisposed];
      observation.expectedFailure = errorEvidence(error);
    });
  });
  assert.equal(first.disposed.length, 1, 'first legitimate owner cleanup retires one page');
  assert.equal(second.disposed.length, 1, 'second legitimate owner cleanup retires one page');
  observation.finalOwnerCleanupPageDisposals = [first.disposed.length, second.disposed.length];
}

async function closedBeforeOptions(observation) {
  await withContext(async c => {
    let callbackReads = 0;
    const token = new Error('B options must remain unobserved');
    const unexpectedRead = () => { callbackReads++; throw token; };
    const options = new Proxy(optionsFor(c), {
      get: unexpectedRead,
      getPrototypeOf: unexpectedRead,
      ownKeys: unexpectedRead,
      getOwnPropertyDescriptor: unexpectedRead,
      has: unexpectedRead,
    });
    c.scope.dispose();
    assert.equal(c.scope.state, 'closed');
    const error = await expectedFactoryFailure(
      () => factory(c.engine, c.scope, options, 'B already-closed Scope refusal'),
      'F2C_SCOPE_CLOSED',
    );
    assert.equal(callbackReads, 0, 'genuine closed Scope admission precedes options reflection');
    assert.equal(c.loads.length, 0);
    assert.equal(c.disposed.length, 0);
    assert.equal(containsError(error, token), false);
    observation.callbackReads = callbackReads;
    observation.providerLoads = c.loads.length;
    observation.scopeAfterRefusal = c.scope.state;
    observation.expectedFailure = errorEvidence(error);
  });
}

async function closeDuringOptions(observation) {
  await withContext(async c => {
    let ownKeysCalls = 0;
    const token = new Error('C original ownKeys throw after genuine Scope closure');
    const options = new Proxy(optionsFor(c), {
      ownKeys() {
        ownKeysCalls++;
        c.scope.dispose();
        throw token;
      },
    });
    const error = await expectedFactoryFailure(
      () => factory(c.engine, c.scope, options, 'C Scope closure during reflection'),
      'F2C_SCOPE_CLOSED',
    );
    assert.equal(ownKeysCalls, 1, 'the callback runs once before the lifetime recheck');
    assert.equal(c.scope.state, 'closed');
    assert.equal(c.loads.length, 0);
    assert.equal(c.disposed.length, 0);
    assert.equal(findCode(error, 'F2C_INPUT_INVALID'), undefined, 'Scope closure outranks the stale descriptor error');
    observation.ownKeysCalls = ownKeysCalls;
    observation.providerLoads = c.loads.length;
    observation.scopeAfterRefusal = c.scope.state;
    observation.expectedFailure = errorEvidence(error);
    // The spec requires closure precedence, not an invented additional token edge.
    observation.originalReflectionToken = errorEvidence(token);
    observation.originalTokenRetainedInObservedErrorTree = containsError(error, token);
  });
}

async function capturedGroupFactory(observation) {
  let owner;
  await withContext(async c => {
    owner = c;
    assert.equal(typeof egret.Engine.prototype.createAssetGroup, 'function');
    const originalOwnDescriptor = Object.getOwnPropertyDescriptor(c.engine, 'createAssetGroup');
    const originalResolvedMethod = c.engine.createAssetGroup;
    let shadowCalls = 0, resources, primary;
    const restoreErrors = [];
    Object.defineProperty(c.engine, 'createAssetGroup', {
      configurable: true, enumerable: false, writable: true,
      value() { shadowCalls++; throw new Error('D instance group shadow was invoked'); },
    });
    try {
      resources = await factory(c.engine, c.scope, optionsFor(c), 'D captured original group operation');
      assert.equal(shadowCalls, 0, 'an instance method replacement cannot hijack the captured operation');
      assert.equal(c.loads.length, 1);
      assert.equal(resources.isDisposed, false, 'the normal factory returns ready resources');
      assert.equal(c.scope.state, 'open');
      const page = c.loads[0].texture;
      assert.ok(page instanceof egret.Texture);
      assert.equal(page.isDisposed, false);
      observation.providerLoads = c.loads.length;
      observation.readyResourcesIsDisposed = resources.isDisposed;
      resources.dispose();
      await boundedWait(c.retired.promise, 'D explicit resource page retirement', observationBoundMs);
      assert.equal(resources.isDisposed, true);
      assert.equal(page.isDisposed, true);
      assert.equal(c.disposed.length, 1);
      assert.equal(c.scope.state, 'open', 'explicit resource cleanup leaves its Scope open');
      resources.dispose();
      assert.equal(c.disposed.length, 1, 'repeat facade disposal does not retire the page twice');
      assert.equal(c.scope.state, 'open');
      observation.explicitDisposeCalls = 2;
      observation.firstExplicitDisposePageRetirements = 1;
      observation.repeatExplicitDisposeAdditionalRetirements = 0;
      observation.resourcesDisposedAfterExplicitCleanup = resources.isDisposed;
      observation.scopeAfterExplicitCleanup = c.scope.state;
    } catch (error) {
      primary = error;
    } finally {
      // Restore the complete own descriptor even when factory/assertion/cleanup fails.
      try {
        if (originalOwnDescriptor === undefined) {
          assert.equal(Reflect.deleteProperty(c.engine, 'createAssetGroup'), true);
        } else {
          Object.defineProperty(c.engine, 'createAssetGroup', originalOwnDescriptor);
        }
      } catch (cleanup) {
        restoreErrors.push(cleanup);
      }
    }
    if (primary && restoreErrors.length) {
      const error = new Error('TEST_INSTANCE_METHOD_RESTORE', { cause: primary });
      error.cleanupErrors = restoreErrors;
      throw error;
    }
    if (primary) throw primary;
    if (restoreErrors.length) throw restoreErrors[0];
    assert.deepEqual(Object.getOwnPropertyDescriptor(c.engine, 'createAssetGroup'), originalOwnDescriptor);
    assert.equal(c.engine.createAssetGroup, originalResolvedMethod);
    observation.shadowCalls = shadowCalls;
    observation.originalOwnDescriptorRestored = true;
  });
  assert.equal(owner.disposed.length, 1, 'subsequent Scope/Engine cleanup stays idempotent');
  observation.finalOwnerCleanupPageDisposals = owner.disposed.length;
}

function freshOutputFile(args) {
  assert.deepEqual(args.slice(0, 1), ['--output'], 'usage: resources-transaction.mjs --output <fresh absolute JSON file>');
  assert.equal(args.length, 2);
  const output = args[1];
  physicalPathKey(output);
  logicalPath(path.basename(output));
  assert.equal(samePhysicalPath(repositoryOwner, output), false, 'output must leave the repository owner');
  let contained = false;
  try { ownerRelativePath(repositoryOwner, output); contained = true; } catch (error) {
    if (!(error instanceof RangeError)) throw error;
  }
  assert.equal(contained, false, 'receipt is a fresh external file');
  const parent = path.dirname(output), parentStat = lstatSync(parent);
  assert.ok(parentStat.isDirectory() && !parentStat.isSymbolicLink());
  assert.ok(samePhysicalPath(parent, realpathSync(parent)), 'the output parent is its canonical physical owner');
  assert.equal(existsSync(output), false, 'never overwrite a prior receipt');
  return output;
}

async function main() {
  const output = freshOutputFile(process.argv.slice(2));
  const receipt = {
    schema: 'F2C_TASK2_RESOURCE_TRANSACTION_PARTIAL_R1',
    status: 'NOT_RUN',
    host: { node: process.version, platform: process.platform, arch: process.arch },
    observationBounds: { factoryAndPageRetirementMs: observationBoundMs, fixtureBodyMs: 15000, fixtureEngineCleanupMs: 5000 },
    scope: 'Four resource-only partial assertions from F2C07; no whole main case is completed.',
    plannedResourcePartialCaseIDs: partialCaseIDs,
    resourcePartialCasesExecuted: 0,
    resourcePartialCasesPassed: 0,
    mainBehaviorCasesExecuted: 0,
    fullMainCaseIDsExecuted: [],
    instanceCasesExecuted: 0,
    corePoseCasesExecuted: 0,
    nativeCasesExecuted: 0,
    nativePixels: 'not_run',
    cases: [],
  };
  let primary;
  try {
    const helper = fingerprintFile(repositoryOwner, 'tools/lib/file-identity.mjs');
    assert.equal(helper.bytes, 5065);
    assert.equal(helper.sha256, helperSha256, 'the shared canonical identity helper matches its accepted raw pin');
    receipt.entryPinsOnly = [
      fingerprintFile(repositoryOwner, 'knowledge-base/experiments/spine-f2-core/tests/resources-transaction.mjs'),
      fingerprintFile(repositoryOwner, 'knowledge-base/experiments/spine-f2-core/tests/fixture.mjs'),
      fingerprintFile(repositoryOwner, 'knowledge-base/experiments/spine-f2-core/dist/index.js'),
      helper,
    ];
    assert.equal(typeof bridge.createF2CoreResources, 'function', 'required public built experimental factory');
    const runs = [foreignScope, closedBeforeOptions, closeDuringOptions, capturedGroupFactory];
    for (let index = 0; index < runs.length; index++) {
      const item = { id: partialCaseIDs[index], status: 'ENTERED', observation: {} };
      receipt.cases.push(item);
      receipt.resourcePartialCasesExecuted++;
      try {
        await runs[index](item.observation);
        item.status = 'PASS_RESOURCE_PARTIAL_ONLY';
        receipt.resourcePartialCasesPassed++;
      } catch (error) {
        item.status = 'FAIL_RESOURCE_PARTIAL_ONLY';
        item.failure = errorEvidence(error);
        throw error;
      }
    }
    receipt.status = 'PASS_TASK2_RESOURCE_PARTIAL_ONLY';
  } catch (error) {
    primary = error;
    receipt.status = 'FAIL_TASK2_RESOURCE_PARTIAL_ONLY';
    receipt.failure = errorEvidence(error);
  }
  try {
    writeFileSync(output, canonicalTextBytes(JSON.stringify(receipt, null, 2)), { flag: 'wx' });
  } catch (cleanup) {
    if (primary) {
      const error = new Error('TEST_RECEIPT_WRITE', { cause: primary });
      error.cleanupErrors = [cleanup];
      throw error;
    }
    throw cleanup;
  }
  console.log(JSON.stringify({ status: receipt.status, resourcePartialCasesExecuted: receipt.resourcePartialCasesExecuted, resourcePartialCasesPassed: receipt.resourcePartialCasesPassed, mainBehaviorCasesExecuted: 0, nativeCasesExecuted: 0, output }));
  if (primary) throw primary;
}

await main().catch(error => { console.error(error); process.exitCode = 1; });
