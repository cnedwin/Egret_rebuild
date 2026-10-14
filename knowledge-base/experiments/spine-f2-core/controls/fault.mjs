// SPDX-License-Identifier: Apache-2.0
// Controlled units use public Egret/bridge operations and one copied audit export.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join, resolve } from 'node:path';

const repository = fileURLToPath(new URL('../../../../', import.meta.url));
const helper = join(repository, 'tools/lib/file-identity.mjs');
const bytes = readFileSync(helper);
assert.equal(bytes.length, 5065);
assert.equal(createHash('sha256').update(bytes).digest('hex'), '999b355c6e0d03f17853ee05f33abc9fecbb34ad80607963e11f913a4f815569');
const { canonicalTextBytes, fingerprintFile, ownerRelativePath, samePhysicalPath } = await import(pathToFileURL(helper).href);
fingerprintFile(repository, '.task4-owner.json');
const owner = JSON.parse(readFileSync(join(repository, '.task4-owner.json'), 'utf8'));
assert.match(owner.marker, /^[0-9a-f-]{36}$/); assert.ok(samePhysicalPath(join(owner.output, 'stage'), repository));
assert.equal(process.argv.length, 6); assert.equal(process.argv[2], '--fault'); assert.equal(process.argv[4], '--output');
const fault = process.argv[3], output = resolve(process.argv[5]);
ownerRelativePath(owner.output, output);
assert.throws(() => ownerRelativePath(repository, output), 'child observations must leave stage');
ownerRelativePath(repository, fileURLToPath(import.meta.url));
assert.ok(['post-apply', 'create-rollback', 'factory-cleanup'].includes(fault));
const report = { kind: 'CONTROLLED_UNIT_ONLY', fault, actualControlledUnitsEntered: 0, mainCasesEntered: 0,
  status: 'NOT_ENTERED', native: 'not_run', performance: 'not_accepted', rights: 'unverified' };
const errorEvidence = (error, seen = new Set()) => {
  if (error === null || typeof error !== 'object') return { value: String(error) };
  if (seen.has(error)) return { repeatedObject: true }; seen.add(error);
  return { name: error.name, code: error.code, message: error.message, stack: error.stack,
    cause: 'cause' in error ? errorEvidence(error.cause, seen) : null,
    cleanupErrors: Array.isArray(error.cleanupErrors) ? error.cleanupErrors.map(value => errorEvidence(value, seen)) : [] };
};
let failed = false;
try {
  const { createF2CoreResources } = await import('../dist/index.js');
  // Privileged audit reading is restricted to this disposable experiment module.
  const auditModule = fault === 'factory-cleanup' ? await import('../dist/resources.js') : await import('../dist/instance.js');
  const { f2cTask4Audit: audit } = auditModule;
  assert.ok(audit && audit.token instanceof Error);
  const fixture = await import('../tests/fixture.mjs');
  const { egret, originalInput, oracle, withContext, frameOptions, snapshot, committed, pose, leaf, throwsCode } = fixture;
  await withContext(async c => {
    report.actualControlledUnitsEntered = 1;
    writeFileSync(output + '.entered.json', canonicalTextBytes(JSON.stringify({ fault, actualControlledUnitsEntered: 1, mainCasesEntered: 0 })), { flag: 'wx' });
    if (fault === 'factory-cleanup') {
      let thrown;
      try { await createF2CoreResources(c.engine, c.scope, { input: originalInput, pageRef: c.pageRef }); }
      catch (error) { thrown = error; }
      assert.ok(thrown instanceof egret.EgretError); assert.equal(thrown.code, 'F2C_RESOURCE_LOAD_FAILED');
      assert.ok(thrown.cause instanceof egret.EgretError); assert.equal(thrown.cause.code, 'F2C_CORE_COMPATIBILITY');
      assert.equal(thrown.cause.cause, audit.token); assert.notEqual(audit.token, audit.secondary);
      assert.deepEqual(thrown.cleanupErrors, [audit.secondary]); assert.equal(thrown.cleanupErrors[0], audit.secondary);
      assert.deepEqual(audit.events, ['primary-after-qualification', 'wrapper-retired', 'page']);
      assert.equal(c.scope.state, 'open'); assert.equal(c.loads.length, 1); assert.equal(c.disposed.length, 1);
      assert.equal(c.loads[0].texture.isDisposed, true); assert.equal(c.engine.captureTexturedFrame(frameOptions).commands.length, 0);
      report.cleanupOrder = [...audit.events]; report.causeIdentity = true; report.distinctSecondaryIdentity = true;
      const fresh = await createF2CoreResources(c.engine, c.scope, { input: originalInput, pageRef: c.pageRef });
      const instance = fresh.createInstance(c.engine.createScope(), oracle.animationName);
      instance.sampleAt(0.5); pose(instance, 0.5, c.loads[1].texture);
      assert.equal(c.scope.state, 'open'); instance.dispose(); fresh.dispose(); fresh.dispose();
      assert.equal(c.loads.length, 2); assert.equal(c.disposed.length, 2);
      report.failedFactoryPageDisposals = 1; report.scopeRemainedUsable = true;
      return;
    }
    const resources = await createF2CoreResources(c.engine, c.scope, { input: originalInput, pageRef: c.pageRef });
    const make = () => resources.createInstance(c.engine.createScope(), oracle.animationName);
    const a = make(), page = c.loads[0].texture;
    c.engine.stage.addChild(a.display); a.sampleAt(0.5); pose(a, 0.5, page);
    const old = snapshot(a), frame = c.engine.captureTexturedFrame(frameOptions), frameBytes = JSON.stringify(frame);
    if (fault === 'post-apply') {
      const b = make(); c.engine.stage.addChild(b.display); b.sampleAt(0.25);
      let thrown; try { a.sampleAt(0.75); } catch (error) { thrown = error; }
      assert.ok(thrown instanceof egret.EgretError); assert.equal(thrown.code, 'F2C_SAMPLE_FAILED');
      assert.equal(thrown.cause, audit.token); assert.equal(a.state, 'failed'); committed(old, a);
      assert.equal(audit.applied.at(-1), 0.75, 'genuine apply returned before deliberate fault');
      const entered = audit.applied.length;
      throwsCode(() => a.sampleAt(0.25), 'F2C_INSTANCE_TERMINAL'); assert.equal(audit.applied.length, entered);
      throwsCode(make, 'F2C_INSTANCE_CAPACITY'); assert.equal(audit.applied.length, entered);
      assert.equal(JSON.stringify(frame), frameBytes); assert.equal(frame.geometries[0], old.geometry);
      const failedFrame = c.engine.captureTexturedFrame(frameOptions); assert.equal(failedFrame.geometries[0], old.geometry);
      b.sampleAt(1); pose(b, 1, page); assert.equal(resources.isDisposed, false); assert.equal(c.disposed.length, 0);
      a.dispose(); assert.equal(a.state, 'disposed'); assert.equal(a.display, undefined);
      const replacement = make(); pose(replacement, 0, page); replacement.dispose();
      pose(b, 1, page); b.dispose(); report.causeIdentity = true; report.failedOccupiedQuotaUntilDisposal = true;
    } else {
      let thrown; try { make(); } catch (error) { thrown = error; }
      assert.equal(thrown, audit.token, 'initiating construction fault remains exact');
      assert.ok(audit.root instanceof egret.DisplayObjectContainer); assert.ok(audit.mesh instanceof egret.Mesh2D);
      assert.equal(audit.root.isDisposed, true); assert.equal(audit.mesh.isDisposed, true);
      committed(old, a); assert.equal(JSON.stringify(frame), frameBytes); assert.equal(a.state, 'live');
      assert.equal(c.disposed.length, 0); assert.equal(page.isDisposed, false); assert.equal(resources.isDisposed, false);
      const b = make(); c.engine.stage.addChild(b.display); b.sampleAt(0.25); pose(b, 0.25, page);
      assert.equal(leaf(a).textureLease.value, leaf(b).textureLease.value); throwsCode(make, 'F2C_INSTANCE_CAPACITY');
      assert.equal(c.engine.captureTexturedFrame(frameOptions).commands.length, 2); b.dispose();
      report.causeIdentity = true; report.boundRootAndMeshRetired = true; report.reservationReleased = true;
    }
    a.dispose(); assert.equal(c.disposed.length, 0); resources.dispose(); resources.dispose();
    assert.equal(c.loads.length, 1); assert.equal(c.disposed.length, 1); assert.equal(page.isDisposed, true);
    report.sharedPageDisposals = c.disposed.length;
  }, { onPageDispose() { audit.events.push('page'); } });
  report.status = 'ACTUAL_CONTROLLED_UNIT_GREEN';
} catch (error) { failed = true; report.status = 'ACTUAL_CONTROLLED_UNIT_RED'; report.failure = errorEvidence(error); }
writeFileSync(output, canonicalTextBytes(JSON.stringify(report, null, 2)), { flag: 'wx' });
console.log(JSON.stringify(report));
if (failed) process.exitCode = 1;
