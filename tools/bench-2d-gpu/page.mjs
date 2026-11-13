// SPDX-License-Identifier: Apache-2.0
// Browser side of tools/bench-2d-gpu.mjs: fixed 2D workloads drawn through the shared Hosts on this
// machine's graphics device. Each workload is drawn through the public SDK, first as fast as the Host
// accepts frames and then once per display frame.
//
// What is measured, per frame:
//   capture   the Engine turning the display list into a frame record (CPU)
//   submit    the Host preparing, uploading and encoding that record (CPU)
//   settle    from the end of submit until the Host reports the frame finished
//   gpu       time the device spent in the render passes of the frame, where the browser can tell:
//             WebGPU needs the `timestamp-query` feature, WebGL2 the EXT_disjoint_timer_query_webgl2
//             extension. Browsers round both to about 0.1 ms.
//   interval  time between display frames while the workload is drawn once per display frame
// The figures describe this machine and this run; they are not acceptance thresholds.
import * as sdk from '@egret/engine';

const WIDTH = 1280, HEIGHT = 720, FRAME = Object.freeze({ width: WIDTH, height: HEIGHT, clearColor: 0x101820, clearAlpha: 1 });
const round = (value, digits = 2) => value === null || value === undefined || !Number.isFinite(value) ? null : Math.round(value * 10 ** digits) / 10 ** digits;
const mean = values => values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length;
const quantile = (values, q) => { if (values.length === 0) return null; const sorted = [...values].sort((a, b) => a - b); return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]; };
const describe = error => String(error?.code ?? error?.message ?? error);

/** A 512x512 page of 16x16 cells, each of its own colour, so neighbouring regions differ. */
function atlasPixels(seed) {
  const size = 512, pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const cell = (y >> 4) * 32 + (x >> 4), o = 4 * (y * size + x);
    pixels[o] = (cell * 37 + seed * 61) & 255; pixels[o + 1] = (cell * 91 + seed * 17) & 255; pixels[o + 2] = (cell * 53 + seed * 29) & 255; pixels[o + 3] = 255;
  }
  return sdk.createImageData2D({ width: size, height: size, pixels });
}

/** Counts draws and times the render passes of a WebGPU device the Host is about to borrow. */
function instrumentWebGPU(device) {
  const stats = { draws: 0, gpu: [], timed: device.features.has('timestamp-query'), pending: [] };
  if (!stats.timed) {
    const create = device.createCommandEncoder.bind(device);
    device.createCommandEncoder = descriptor => {
      const encoder = create(descriptor), begin = encoder.beginRenderPass.bind(encoder);
      encoder.beginRenderPass = pass => { const opened = begin(pass), draw = opened.draw.bind(opened); opened.draw = (...args) => { stats.draws++; return draw(...args); }; return opened; };
      return encoder;
    };
    return { stats, async settle() {} };
  }
  // One query set serves every encoder: its values are resolved inside the encoder that wrote them.
  const PASSES = 64, set = device.createQuerySet({ type: 'timestamp', count: PASSES * 2 });
  const resolved = device.createBuffer({ size: PASSES * 16, usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC });
  const free = [], waiting = [];
  const create = device.createCommandEncoder.bind(device), submit = device.queue.submit.bind(device.queue);
  device.createCommandEncoder = descriptor => {
    const encoder = create(descriptor), begin = encoder.beginRenderPass.bind(encoder), finish = encoder.finish.bind(encoder);
    let passes = 0;
    encoder.beginRenderPass = pass => {
      const index = passes++;
      const opened = begin(index < PASSES ? { ...pass, timestampWrites: { querySet: set, beginningOfPassWriteIndex: index * 2, endOfPassWriteIndex: index * 2 + 1 } } : pass);
      const draw = opened.draw.bind(opened); opened.draw = (...args) => { stats.draws++; return draw(...args); };
      return opened;
    };
    encoder.finish = descriptor2 => {
      const count = Math.min(passes, PASSES) * 2;
      if (count > 0) {
        const target = free.pop() ?? device.createBuffer({ size: PASSES * 16, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });
        encoder.resolveQuerySet(set, 0, count, resolved, 0); encoder.copyBufferToBuffer(resolved, 0, target, 0, count * 8);
        waiting.push({ target, count });
      }
      return finish(descriptor2);
    };
    return encoder;
  };
  device.queue.submit = buffers => {
    const result = submit(buffers);
    for (const { target, count } of waiting.splice(0)) {
      stats.pending.push(target.mapAsync(GPUMapMode.READ, 0, count * 8).then(() => {
        const times = new BigUint64Array(target.getMappedRange(0, count * 8).slice(0));
        let nanoseconds = 0n;
        for (let i = 0; i < count; i += 2) if (times[i + 1] > times[i]) nanoseconds += times[i + 1] - times[i];
        stats.gpu.push(Number(nanoseconds) / 1e6); target.unmap(); free.push(target);
      }, () => {}));
    }
    return result;
  };
  return { stats, async settle() { await Promise.all(stats.pending.splice(0)); } };
}

/** Counts draws and times the first draw to the closing fence of each frame of a WebGL2 context. */
function instrumentWebGL2(gl) {
  const stats = { draws: 0, gpu: [], timed: false, pending: [] };
  const extension = gl.getExtension('EXT_disjoint_timer_query_webgl2');
  stats.timed = extension !== null;
  const draw = gl.drawArrays.bind(gl), fence = gl.fenceSync.bind(gl);
  let active = null;
  const waiting = [];
  gl.drawArrays = (...args) => {
    if (extension && active === null) { active = gl.createQuery(); gl.beginQuery(extension.TIME_ELAPSED_EXT, active); }
    stats.draws++; return draw(...args);
  };
  gl.fenceSync = (...args) => {
    if (active !== null) { gl.endQuery(extension.TIME_ELAPSED_EXT); waiting.push(active); active = null; }
    return fence(...args);
  };
  const collect = () => {
    for (let i = waiting.length - 1; i >= 0; i--) {
      const query = waiting[i];
      if (!gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE)) continue;
      // A disjoint event makes every value read since the last check unusable.
      if (!gl.getParameter(extension.GPU_DISJOINT_EXT)) stats.gpu.push(gl.getQueryParameter(query, gl.QUERY_RESULT) / 1e6);
      gl.deleteQuery(query); waiting.splice(i, 1);
    }
  };
  return { stats, async settle() {
    if (!extension) return;
    for (let turn = 0; turn < 120 && waiting.length > 0; turn++) { await new Promise(resolve => requestAnimationFrame(resolve)); collect(); }
    for (const query of waiting.splice(0)) gl.deleteQuery(query);
  } };
}

const WORKLOADS = [
  { id: 'bitmaps-1k-moving', label: '1,000 bitmaps of one atlas, all moving', build: (context) => bitmaps(context, 1000, 1, true) },
  { id: 'bitmaps-5k-moving', label: '5,000 bitmaps of one atlas, all moving', build: (context) => bitmaps(context, 5000, 1, true) },
  { id: 'bitmaps-20k-moving', label: '20,000 bitmaps of one atlas, all moving', build: (context) => bitmaps(context, 20000, 1, true), heavy: true },
  { id: 'bitmaps-5k-still', label: '5,000 bitmaps of one atlas, none moving', build: (context) => bitmaps(context, 5000, 1, false) },
  { id: 'bitmaps-5k-8-pages', label: '5,000 bitmaps, 8 atlases in turn, all moving', build: (context) => bitmaps(context, 5000, 8, true) },
  { id: 'rectangles-5k-moving', label: '5,000 filled rectangles, all moving', build: (context) => rectangles(context, 5000) },
  { id: 'overdraw-100', label: '100 translucent bitmaps, each covering the frame', build: (context) => overdraw(context, 100) },
];

async function bitmaps({ engine, scope }, count, pages, moving) {
  const leases = [], type = sdk.createAssetType('bench-2d-gpu-atlas', sdk.isTexture);
  engine.assets.register(type, { async load(ref) { return sdk.createTexture(atlasPixels(Number(ref.id.slice(5)))); }, dispose(value) { value.dispose(); } });
  for (let page = 0; page < pages; page++) leases.push(scope.use(await engine.assets.acquire(sdk.createAssetRef(type, 'page-' + page), { signal: scope.signal })));
  const all = [];
  for (let i = 0; i < count; i++) {
    const bitmap = scope.use(new sdk.Bitmap(leases[i % pages])), cell = i % 100;
    bitmap.sourceRect = { x: (cell % 32) * 16, y: Math.floor(cell / 32) * 16, width: 16, height: 16 };
    bitmap.x = (i * 37) % (WIDTH - 16); bitmap.y = (i * 53) % (HEIGHT - 16);
    engine.stage.addChild(bitmap); all.push(bitmap);
  }
  return moving ? frame => { const shift = frame % 2 === 0 ? 1 : -1; for (const bitmap of all) bitmap.x += shift; } : () => {};
}

async function rectangles({ engine, scope }, count) {
  const all = [];
  for (let i = 0; i < count; i++) {
    const sprite = scope.use(new sdk.Sprite());
    sprite.graphics.beginFill(0x204060 + (i % 200), 1).drawRect(0, 0, 12, 12).endFill();
    sprite.x = (i * 37) % (WIDTH - 12); sprite.y = (i * 53) % (HEIGHT - 12);
    engine.stage.addChild(sprite); all.push(sprite);
  }
  return frame => { const shift = frame % 2 === 0 ? 1 : -1; for (const sprite of all) sprite.x += shift; };
}

async function overdraw({ engine, scope }, count) {
  const type = sdk.createAssetType('bench-2d-gpu-cover', sdk.isTexture), texture = sdk.createTexture(atlasPixels(3));
  engine.assets.register(type, { async load() { return texture; }, dispose(value) { value.dispose(); } });
  const lease = scope.use(await engine.assets.acquire(sdk.createAssetRef(type, 'atlas'), { signal: scope.signal }));
  const all = [];
  for (let i = 0; i < count; i++) {
    const bitmap = scope.use(new sdk.Bitmap(lease));
    bitmap.scaleX = WIDTH / 512; bitmap.scaleY = HEIGHT / 512; bitmap.alpha = 0.1;
    engine.stage.addChild(bitmap); all.push(bitmap);
  }
  return frame => { all[frame % count].alpha = frame % 2 === 0 ? 0.12 : 0.1; };
}

/** The Host of one backend on a fresh canvas, with its device or context instrumented. */
async function openBackend(backend, canvas, note, offscreen) {
  if (backend === 'webgpu') {
    if (!navigator.gpu) return { unsupported: 'navigator.gpu is absent' };
    const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
    if (!adapter) return { unsupported: 'no WebGPU adapter' };
    const features = adapter.features.has('timestamp-query') ? ['timestamp-query'] : [];
    const device = await adapter.requestDevice({ requiredFeatures: features });
    const probe = instrumentWebGPU(device), info = adapter.info ?? {};
    if (offscreen) {
      // A browser without a display cannot back a WebGPU canvas. `?surface=texture` gives the Host an
      // ordinary texture of the same device to draw into; nothing reaches the screen.
      const surface = { description: undefined, texture: undefined,
        configure(description) { this.unconfigure(); this.description = description; },
        unconfigure() { this.texture?.destroy(); this.texture = undefined; this.description = undefined; },
        getConfiguration() { return this.description; },
        getCurrentTexture() { const d = this.description; return this.texture ??= d.device.createTexture({ size: [canvas.width, canvas.height], format: d.format, usage: d.usage ?? GPUTextureUsage.RENDER_ATTACHMENT, viewFormats: d.viewFormats ?? [] }); } };
      const real = canvas.getContext.bind(canvas);
      canvas.getContext = (type, ...rest) => type === 'webgpu' ? surface : real(type, ...rest);
    }
    const { createSharedWebGPUHost } = await import('@egret/engine/webgpu');
    const host = createSharedWebGPUHost({ canvas, device: { kind: 'borrow', device }, pixelRatio: 1, onDiagnostic: note });
    return { host, probe, device: { vendor: info.vendor ?? '', architecture: info.architecture ?? '', description: info.description ?? '', fallback: adapter.isFallbackAdapter ?? info.isFallbackAdapter ?? null }, close() { device.destroy(); } };
  }
  let probe, renderer = '';
  const real = canvas.getContext.bind(canvas);
  // The Host asks for the context itself; it is instrumented before the Host makes its first call.
  canvas.getContext = (type, ...rest) => {
    const context = real(type, ...rest);
    if (type === 'webgl2' && context && !probe) {
      probe = instrumentWebGL2(context);
      const debug = context.getExtension('WEBGL_debug_renderer_info');
      renderer = String(debug ? context.getParameter(debug.UNMASKED_RENDERER_WEBGL) : context.getParameter(context.RENDERER));
    }
    return context;
  };
  const { createSharedWebGL2Host } = await import('@egret/engine/webgl2');
  const host = createSharedWebGL2Host({ canvas, pixelRatio: 1, onDiagnostic: note });
  return { host, get probe() { return probe; }, get device() { return { description: renderer }; }, close() {} };
}

async function runWorkload(backend, workload, quick, offscreen) {
  const row = { backend, id: workload.id, label: workload.label, status: 'incomplete', diagnostics: [] };
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH; canvas.height = HEIGHT; canvas.style.width = WIDTH + 'px'; canvas.style.height = HEIGHT + 'px';
  document.querySelector('#stage').replaceChildren(canvas);
  const note = diagnostic => { if (row.diagnostics.length < 8) row.diagnostics.push(describe(diagnostic) + (diagnostic?.cause ? ': ' + describe(diagnostic.cause) : '')); };
  let opened, engine, scope;
  try {
    opened = await openBackend(backend, canvas, note, offscreen);
    if (opened.unsupported) { row.status = 'unsupported'; row.reason = opened.unsupported; return row; }
    const { host } = opened;
    engine = await sdk.createEngineForProfile({ host, shutdownTimeoutMs: 20000, onDiagnostic: note }, sdk.SHARED_FRAME_PROFILE_2D);
    scope = engine.createScope();
    const step = await workload.build({ engine, scope });
    const probe = opened.probe, stats = probe.stats;
    row.device = opened.device; row.gpuTimer = stats.timed;
    const draw = async index => {
      step(index);
      const start = performance.now(), frame = engine.captureSharedFrame(FRAME), captured = performance.now();
      host.renderSharedFrame(frame);
      const submitted = performance.now();
      await host.whenIdle();
      return { capture: captured - start, submit: submitted - captured, settle: performance.now() - submitted, commands: frame.commands.length };
    };
    // The first frames build pipelines and upload the pages; they are not measured.
    for (let i = 0; i < 3; i++) await draw(i);
    await probe.settle(); stats.gpu.length = 0; stats.draws = 0;
    const frames = quick ? 8 : workload.heavy ? 20 : 40, samples = [];
    for (let i = 0; i < frames; i++) samples.push(await draw(i));
    await probe.settle();
    row.commands = samples[0].commands; row.draws = round(stats.draws / frames, 1);
    row.captureMs = round(mean(samples.map(sample => sample.capture))); row.submitMs = round(mean(samples.map(sample => sample.submit)));
    row.settleMs = round(mean(samples.map(sample => sample.settle))); row.gpuMs = round(mean(stats.gpu), 3); row.gpuSamples = stats.gpu.length;
    // Once per display frame. A frame the Host refuses because two are still pending is counted, not drawn.
    const paced = quick ? 30 : 120, stamps = []; let refused = 0;
    await new Promise((resolve, reject) => {
      let index = 0;
      const tick = stamp => {
        stamps.push(stamp);
        if (index === paced) { resolve(); return; }
        try { step(index++); engine.renderSharedFrame(FRAME); }
        catch (error) { if (/_BACKPRESSURE$/.test(String(error?.code)) || /_BACKPRESSURE$/.test(String(error?.cause?.code))) refused++; else { reject(error); return; } }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    await host.whenIdle(); await probe.settle();
    const intervals = []; for (let i = 1; i < stamps.length; i++) intervals.push(stamps[i] - stamps[i - 1]);
    row.intervalMs = round(quantile(intervals, 0.5)); row.intervalP95Ms = round(quantile(intervals, 0.95)); row.refused = refused;
    const failure = host.getStatus().firstFailure;
    if (failure) { row.status = 'failed'; row.reason = describe(failure); } else row.status = 'complete';
  } catch (error) { row.status = 'failed'; row.reason = describe(error) + (error?.cause ? ': ' + describe(error.cause) : ''); }
  finally {
    try { scope?.dispose(); } catch { /* reported by the Engine */ }
    try { await engine?.dispose(); } catch { /* reported by the Engine */ }
    try { await opened?.host?.close(); } catch { /* reported by the Host */ }
    try { opened?.close?.(); } catch { /* the device is already gone */ }
  }
  return row;
}

const COLUMNS = [['backend', 'backend'], ['label', 'workload'], ['status', 'status'], ['draws', 'draws'], ['captureMs', 'capture ms'], ['submitMs', 'submit ms'], ['settleMs', 'settle ms'], ['gpuMs', 'gpu ms'], ['intervalMs', 'interval ms'], ['intervalP95Ms', 'p95 ms'], ['refused', 'refused']];
function show(report) {
  const table = document.querySelector('#rows'); table.replaceChildren();
  const head = table.insertRow(); for (const [, title] of COLUMNS) { const cell = document.createElement('th'); cell.textContent = title; head.append(cell); }
  for (const row of report.rows) { const line = table.insertRow(); for (const [key] of COLUMNS) line.insertCell().textContent = row[key] === null || row[key] === undefined ? (key === 'status' ? '' : '–') : String(row[key]) + (key === 'status' && row.reason ? ' (' + row.reason + ')' : ''); }
  document.querySelector('#json').value = JSON.stringify(report, null, 1);
}

async function main() {
  const params = new URLSearchParams(location.search), quick = params.get('quick') === '1';
  const backends = (params.get('backends') ?? 'webgpu,webgl2').split(',').filter(name => name === 'webgpu' || name === 'webgl2');
  const only = params.get('only'), offscreen = params.get('surface') === 'texture';
  const report = { tool: 'bench-2d-gpu', quick, frame: { width: WIDTH, height: HEIGHT }, userAgent: navigator.userAgent, devicePixelRatio, visible: document.visibilityState === 'visible', surface: offscreen ? 'texture' : 'canvas', rows: [] };
  const status = document.querySelector('#status');
  for (const backend of backends) for (const workload of WORKLOADS) {
    if (only && !workload.id.includes(only)) continue;
    status.textContent = 'Measuring ' + backend + ': ' + workload.label + ' …';
    report.rows.push(await runWorkload(backend, workload, quick, offscreen)); show(report);
  }
  status.textContent = 'Finished. The table is also kept below as JSON.';
  globalThis.__bench2dGpu = report;
  try { await fetch('/result', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(report) }); } catch { /* opened without the tool's server */ }
}
main().catch(error => { document.querySelector('#status').textContent = 'Failed: ' + describe(error); globalThis.__bench2dGpu = { tool: 'bench-2d-gpu', failure: describe(error), rows: [] }; });
