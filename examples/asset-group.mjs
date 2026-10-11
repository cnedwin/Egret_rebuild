import { Bitmap, createAssetRef, createAssetType, createEngine, createImageData2D, createTexture, isTexture } from '@egret/engine';

// Two authored one-pixel CPU fixtures; this example performs no browser/GPU work.
const fixtures = new Map([
  ['red', new Uint8Array([220, 40, 40, 255])],
  ['blue', new Uint8Array([40, 80, 220, 255])],
]);
const trace = [], timers = new Set();
const host = {
  surface: {},
  start() { trace.push('host.start'); },
  stop() { trace.push('host.stop'); },
  async close() { trace.push('host.close'); },
  setTimeout(callback, delayMs) {
    const timer = setTimeout(() => { timers.delete(timer); callback(); }, delayMs);
    timers.add(timer);
    return () => { timers.delete(timer); clearTimeout(timer); };
  },
};
const engine = await createEngine({ host });
const scope = engine.createScope(), type = createAssetType('RG1 fixture texture', isTexture);
const disposed = [];
engine.assets.register(type, {
  async load(ref) {
    const pixels = fixtures.get(ref.id);
    if (pixels === undefined) throw new Error('Unknown fixture');
    trace.push('load:' + ref.id);
    return createTexture(createImageData2D({ width: 1, height: 1, pixels }));
  },
  dispose(texture) { disposed.push(texture.imageData); texture.dispose(); trace.push('texture.dispose'); },
});
let result;
try {
  const group = engine.createAssetGroup(scope, [createAssetRef(type, 'red'), createAssetRef(type, 'blue')], { concurrency: 2 });
  const leases = await group.ready;
  const red = scope.use(new Bitmap(leases[0])), blue = scope.use(new Bitmap(leases[1]));
  blue.x = 1;
  engine.stage.addChild(red); engine.stage.addChild(blue);
  const frame = engine.captureFrame({ width: 2, height: 1 });
  const readyState = group.state;
  scope.dispose();
  result = {
    readyState, finalState: group.state, scopeState: scope.state,
    commandKinds: frame.commands.map(command => command.kind),
    positions: frame.commands.map(command => command.matrix.tx),
    imageCount: frame.images.length, generations: leases.map(lease => lease.resourceGeneration),
    disposedTextures: disposed.length,
  };
} finally { scope.dispose(); await engine.dispose(); }
console.log(JSON.stringify({ ...result, trace, pendingTimers: timers.size }, null, 2));
