import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createEngine, createAssetType, createAssetRef } from '@egret/engine';

// Filesystem and JSON decoding belong to this injected provider, outside the core.
const panelType = createAssetType('cpu-panel-json', value =>
  typeof value === 'object' && value !== null && typeof value.title === 'string' &&
  Array.isArray(value.items) && value.items.every(item => typeof item === 'string'));
const panelRef = createAssetRef(panelType, 'ui/panel');
const trace = [];
const engine = await createEngine({ host: {
  surface: {},
  stop: () => trace.push('host.stop'),
  close: async () => { trace.push('host.close'); },
  setTimeout: (callback, milliseconds) => {
    const timer = setTimeout(callback, milliseconds);
    return () => clearTimeout(timer);
  },
} });
let loads = 0;
let cleanups = 0;
engine.assets.register(panelType, {
  async load(ref, context) {
    loads++;
    trace.push(`read:${ref.id}:generation-${context.resourceGeneration}:task-${context.taskId}`);
    const json = await readFile(new URL('./fixtures/ui-panel.json', import.meta.url), 'utf8');
    // The provider chooses how its real asynchronous operation handles cancellation.
    if (context.signal.aborted) throw context.signal.reason;
    return JSON.parse(json);
  },
  dispose(value) {
    cleanups++;
    trace.push(`dispose:${value.title}`);
  },
});

try {
  const scope = engine.createScope();
  const [first, second] = await Promise.all([
    engine.assets.acquire(panelRef, { signal: scope.signal }),
    engine.assets.acquire(panelRef),
  ]);
  scope.use(first);
  assert.equal(loads, 1);
  assert.equal(first.value, second.value);
  second.release();
  assert.equal(cleanups, 0);

  // Invalidating affects future demand while the existing scoped value stays live.
  engine.assets.invalidate(panelRef);
  const reloaded = await engine.assets.acquire(panelRef);
  assert.equal(loads, 2);
  assert.ok(reloaded.resourceGeneration > first.resourceGeneration);
  assert.equal(first.value.title, reloaded.value.title);
  assert.notEqual(first.value, reloaded.value);
  scope.dispose();
  assert.equal(cleanups, 1);
  reloaded.release();
  assert.equal(cleanups, 2);
} finally {
  await engine.dispose();
}
console.log(JSON.stringify({ result: 'PASS', loads, cleanups, trace }, null, 2));
