// SPDX-License-Identifier: Apache-2.0
// Fresh-process observer. Instrumentation forwards successful native results unchanged.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { registerHooks, syncBuiltinESMExports } from 'node:module';

const [mode, supplied] = process.argv.slice(2);
assert.equal(process.argv.length, 4);
assert.ok(['root-baseline', 'bridge-baseline', 'help-baseline', 'root-audit', 'bridge-audit', 'help-audit', 'audit-control'].includes(mode));
const sdk = fs.realpathSync(supplied);
const experiment = fileURLToPath(new URL('../', import.meta.url));
const audited = mode.endsWith('-audit') || mode === 'audit-control';
const report = { mode, observer: audited ? 'forwarding-native-hooks-and-selected-traps' : 'ordinary-no-hooks',
  moduleResolutions: [], moduleLoads: [], selectedSDKFsCalls: [], selectedSourceFsCalls: [], browserGlobalReads: [], schedulerCalls: [],
  actualMainExecutedCases: 0, actualPoseCases: 0, actualNativeCases: 0 };
const restorations = [];
const cleanupErrors = [];
let hook, primary, primaryCaught = false;
function failure(cause) {
  if (cause === undefined) return { type: 'undefined' };
  if (cause === null) return { type: 'null', value: null };
  const type = typeof cause;
  if (type !== 'object') return { type, value: type === 'string' || type === 'boolean' || type === 'number' && Number.isFinite(cause) ? cause : String(cause) };
  return { type, name: cause.name ?? null, code: cause.code ?? null, message: cause.message ?? null, stack: cause.stack ?? null };
}
function selected(file) {
  if (file instanceof URL) { if (file.protocol !== 'file:') return false; file = fileURLToPath(file); }
  if (typeof file !== 'string' || !path.isAbsolute(file)) return false;
  const relative = path.relative(sdk, file);
  return relative === '' || (!path.isAbsolute(relative) && relative !== '..' && !relative.startsWith('..' + path.sep));
}
function optional(url) {
  if (typeof url !== 'string' || !url.startsWith('file:')) return false;
  const file = fileURLToPath(url);
  return selected(file) || file.includes(path.sep + 'spine-f2-core' + path.sep + 'dist' + path.sep);
}
function patch(owner, name, replacement) {
  const descriptor = Object.getOwnPropertyDescriptor(owner, name);
  assert.ok(descriptor === undefined || descriptor.configurable, 'configurable observer target: ' + name);
  Object.defineProperty(owner, name, replacement);
  restorations.push({ name, restore() {
    if (descriptor === undefined) assert.equal(Reflect.deleteProperty(owner, name), true);
    else Object.defineProperty(owner, name, descriptor);
    assert.deepEqual(Object.getOwnPropertyDescriptor(owner, name), descriptor);
  } });
}
try {
  if (audited) {
    // These hooks never rewrite a URL, source, format, conditions or import attributes.
    hook = registerHooks({
      resolve(specifier, context, nextResolve) {
        const original = nextResolve(specifier, context);
        report.moduleResolutions.push({ specifier, parentURL: context.parentURL ?? null, url: original.url });
        return original;
      },
      load(url, context, nextLoad) {
        const original = nextLoad(url, context);
        report.moduleLoads.push({ url, format: original.format });
        return original;
      },
    });
    for (const name of ['readFileSync', 'statSync', 'lstatSync', 'realpathSync', 'existsSync', 'accessSync', 'readdirSync']) {
      const original = fs[name];
      patch(fs, name, { configurable: true, writable: true, enumerable: true, value: function (...args) {
        if (selected(args[0])) report.selectedSDKFsCalls.push({ operation: name, path: String(args[0]) });
        if (typeof args[0] === 'string' && path.isAbsolute(args[0])) {
          const key = path.relative(experiment, args[0]).replaceAll(path.sep, '/');
          if (key === 'manifest.json' || key.startsWith('assets/') || key.startsWith('src/')) report.selectedSourceFsCalls.push({ operation: name, path: key });
        }
        return Reflect.apply(original, this, args);
      } });
    }
    syncBuiltinESMExports();
    for (const name of ['window', 'document', 'navigator', 'ImageBitmap', 'ImageData', 'HTMLImageElement', 'createImageBitmap', 'Blob', 'OffscreenCanvas', 'requestAnimationFrame']) {
      patch(globalThis, name, { configurable: true, get() {
        report.browserGlobalReads.push(name);
        throw new Error('F2C_COLD_BROWSER_GLOBAL_READ:' + name);
      } });
    }
    for (const name of ['setTimeout', 'setInterval', 'setImmediate']) {
      const original = globalThis[name];
      patch(globalThis, name, { configurable: true, writable: true, value: function (...args) {
        report.schedulerCalls.push(name);
        return Reflect.apply(original, this, args);
      } });
    }
  }
  if (mode.startsWith('root-')) {
    const egret = await import('@egret/engine');
    assert.equal(typeof egret.createEngine, 'function');
    assert.equal('createF2CoreResources' in egret, false);
    assert.equal('Skeleton' in egret, false);
    report.publicKeys = Object.keys(egret);
  } else if (mode.startsWith('bridge-')) {
    const entry = await import('../dist/index.js');
    assert.deepEqual(Object.keys(entry), ['createF2CoreResources']);
    report.publicKeys = Object.keys(entry);
  } else if (mode.startsWith('help-')) {
    // Import the unchanged real runner as a CLI: no source injection or product loader.
    process.argv = [process.execPath, path.join(experiment, 'run.mjs'), '--help'];
    await import('../run.mjs');
    assert.equal(process.exitCode ?? 0, 0);
    report.helpCompleted = true;
  } else {
    // Controls observe genuine file access and the genuine optional public package.
    fs.readFileSync(path.join(sdk, 'package.json'));
    fs.readFileSync(path.join(experiment, 'manifest.json'));
    const core = await import('@esotericsoftware/spine-core');
    assert.equal(typeof core.Skeleton, 'function');
    assert.throws(() => Reflect.get(globalThis, 'document'), /F2C_COLD_BROWSER_GLOBAL_READ:document/);
    assert.ok(report.selectedSDKFsCalls.length > 0);
    assert.ok(report.moduleLoads.some(row => selected(new URL(row.url))));
    assert.deepEqual(report.browserGlobalReads, ['document']);
    assert.ok(report.selectedSourceFsCalls.some(row => row.operation === 'readFileSync' && row.path === 'manifest.json'));
    // Observe the genuine scheduler once for settlement and once for cancellation.
    await new Promise(resolve => setImmediate(resolve));
    let canceledCallbackRan = false;
    const canceled = setImmediate(() => { canceledCallbackRan = true; });
    clearImmediate(canceled);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(canceledCallbackRan, false);
    assert.deepEqual(report.schedulerCalls, ['setImmediate', 'setImmediate', 'setImmediate']);
    report.schedulerControl = { settled: true, canceledCallbackRan };
    report.controlsDiscriminated = true;
  }
  if (audited && mode !== 'audit-control') {
    assert.deepEqual(report.browserGlobalReads, []);
    assert.deepEqual(report.schedulerCalls, []);
    if (!mode.startsWith('bridge-')) {
      assert.deepEqual(report.selectedSDKFsCalls, []);
      assert.equal(report.moduleResolutions.some(row => optional(row.url)), false);
      assert.equal(report.moduleLoads.some(row => optional(row.url)), false);
    } else {
      assert.ok(report.moduleLoads.some(row => row.url.startsWith('file:') && selected(new URL(row.url))));
    }
    if (mode.startsWith('help-')) {
      assert.deepEqual(report.selectedSourceFsCalls, []);
    }
  }
} catch (cause) { primaryCaught = true; primary = cause; }
function cleanupStep(step, action) {
  try { action(); } catch (cause) { cleanupErrors.push({ step, cause }); }
}
if (hook) cleanupStep('hook.deregister', () => hook.deregister());
for (const entry of restorations.reverse()) cleanupStep('descriptor:' + entry.name, entry.restore);
if (audited) cleanupStep('syncBuiltinESMExports', () => syncBuiltinESMExports());
report.restorationIncomplete = cleanupErrors.length > 0;
report.observerRestored = !report.restorationIncomplete;
report.primaryCaught = primaryCaught;
report.status = primaryCaught || cleanupErrors.length > 0 ? 'FAIL' : 'PASS';
report.failure = primaryCaught ? failure(primary) : null;
report.cleanupErrors = cleanupErrors.map(entry => ({ step: entry.step, failure: failure(entry.cause) }));
report.scope = 'Observed successful native resolution/load results after registration, listed synchronous fs calls into the supplied SDK owner and experiment manifest/assets/src, listed browser global getters and scheduler functions only. Initial observer setup resolves supplied owner before registration. No universal filesystem, module evaluation, asynchronous fs, GPU, allocation, timing or entitlement assertion.';
console.log('F2C_COLD_RESULT ' + JSON.stringify(report));
if (primaryCaught || cleanupErrors.length > 0) process.exitCode = 1;
