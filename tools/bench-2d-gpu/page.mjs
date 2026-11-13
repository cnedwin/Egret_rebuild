// SPDX-License-Identifier: Apache-2.0
// Browser side of tools/bench-2d-gpu.mjs: fixed 2D workloads drawn through the shared Hosts on this
// machine's graphics device. Each workload is drawn through the public SDK, first as fast as the Host
// accepts frames and then once per browser animation callback.
//
// What is measured, per frame:
//   capture   the Engine turning the display list into a frame record (CPU)
//   submit    the Host preparing, uploading and encoding that record (CPU)
//   settle    from the end of submit until the Host reports the frame finished
//   gpu       time the device spent in the render passes of the frame, where the browser can tell:
//             WebGPU needs the `timestamp-query` feature, WebGL2 the EXT_disjoint_timer_query_webgl2
//             extension. Browsers round both to about 0.1 ms.
//   interval  browser animation callback spacing while attempting one frame per callback
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
  const stats = { draws: 0, counting: false, gpu: [], timed: device.features.has('timestamp-query') };
  const PASSES = 64;
  let timer;
  const create = device.createCommandEncoder.bind(device), submit = device.queue.submit.bind(device.queue);
  device.createCommandEncoder = descriptor => {
    const encoder = create(descriptor), measuring = timer;
    if (!measuring && !stats.counting) return encoder;
    const begin = encoder.beginRenderPass.bind(encoder);
    let passes = 0;
    encoder.beginRenderPass = pass => {
      const index = passes++;
      const opened = measuring && index < PASSES ? begin({ ...pass, timestampWrites: { querySet: measuring.set,
        beginningOfPassWriteIndex: index * 2, endOfPassWriteIndex: index * 2 + 1 } }) : begin(pass);
      if (stats.counting) {
        const draw = opened.draw.bind(opened);
        opened.draw = (...args) => { stats.draws++; return draw(...args); };
      }
      return opened;
    };
    if (measuring) {
      const finish = encoder.finish.bind(encoder);
      encoder.finish = descriptor2 => {
        const count = Math.min(passes, PASSES) * 2;
        if (count === 0) return finish(descriptor2);
        let target = measuring.free.pop();
        if (!target) {
          target = device.createBuffer({ size: PASSES * 16, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });
          measuring.buffers.push(target);
        }
        encoder.resolveQuerySet(measuring.set, 0, count, measuring.resolved, 0);
        encoder.copyBufferToBuffer(measuring.resolved, 0, target, 0, count * 8);
        const commands = finish(descriptor2);
        measuring.waiting.set(commands, { target, count });
        return commands;
      };
    }
    return encoder;
  };
  if (stats.timed) device.queue.submit = buffers => {
    const measuring = timer;
    if (!measuring) return submit(buffers);
    const commands = [...buffers];
    const result = submit(commands);
    for (const command of commands) {
      const pending = measuring.waiting.get(command);
      if (!pending) continue;
      measuring.waiting.delete(command);
      const { target, count } = pending;
      measuring.pending.push(target.mapAsync(GPUMapMode.READ, 0, count * 8).then(() => {
        try {
          const times = new BigUint64Array(target.getMappedRange(0, count * 8));
          let nanoseconds = 0n;
          for (let i = 0; i < count; i += 2) if (times[i + 1] > times[i]) nanoseconds += times[i + 1] - times[i];
          stats.gpu.push(Number(nanoseconds) / 1e6);
        } finally { target.unmap(); }
        measuring.free.push(target);
      }).catch(() => { /* An unavailable mapping contributes no sample. */ }));
    }
    return result;
  };
  return {
    stats,
    start() {
      if (!stats.timed) return;
      timer = { set: device.createQuerySet({ type: 'timestamp', count: PASSES * 2 }), resolved: undefined,
        waiting: new WeakMap(), pending: [], free: [], buffers: [] };
      timer.resolved = device.createBuffer({ size: PASSES * 16, usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC });
    },
    async settle() { if (timer) await Promise.all(timer.pending); },
    stop() {
      if (!timer) return;
      const measuring = timer; timer = undefined;
      for (const buffer of measuring.buffers) buffer.destroy();
      measuring.resolved?.destroy();
      measuring.set.destroy();
    },
  };
}

/** Counts draws and times the first draw to the closing fence of each measured WebGL2 frame. */
function instrumentWebGL2(gl) {
  const extension = gl.getExtension('EXT_disjoint_timer_query_webgl2');
  const stats = { draws: 0, counting: false, gpu: [], timed: Boolean(extension && gl.getQuery(extension.TIME_ELAPSED_EXT, extension.QUERY_COUNTER_BITS_EXT) > 0) };
  const draw = gl.drawArrays.bind(gl), fence = gl.fenceSync.bind(gl);
  let measuring = false, active = null;
  const waiting = [];
  gl.drawArrays = (...args) => {
    if (measuring && active === null) {
      active = gl.createQuery();
      if (active !== null) gl.beginQuery(extension.TIME_ELAPSED_EXT, active);
    }
    if (stats.counting) stats.draws++;
    return draw(...args);
  };
  gl.fenceSync = (...args) => {
    if (active !== null) { gl.endQuery(extension.TIME_ELAPSED_EXT); waiting.push(active); active = null; }
    return fence(...args);
  };
  return {
    stats,
    start() {
      if (!stats.timed) return;
      // This read clears earlier disjoint events before the measured cohort starts.
      gl.getParameter(extension.GPU_DISJOINT_EXT);
      measuring = true;
    },
    async settle() {
      const newest = waiting.at(-1);
      if (!newest) return;
      for (let turn = 0; turn < 120; turn++) {
        await new Promise(resolve => requestAnimationFrame(resolve));
        if (!gl.getQueryParameter(newest, gl.QUERY_RESULT_AVAILABLE)) continue;
        // The newest available elapsed query also proves earlier results are available. A disjoint read
        // consumes the flag for the whole cohort, so check once before accepting any result.
        if (!gl.getParameter(extension.GPU_DISJOINT_EXT)) {
          for (const query of waiting) {
            const result = gl.getQueryParameter(query, gl.QUERY_RESULT);
            if (Number.isFinite(result) && result >= 0) stats.gpu.push(result / 1e6);
          }
        }
        return;
      }
    },
    stop() {
      measuring = false;
      if (active !== null) { gl.endQuery(extension.TIME_ELAPSED_EXT); waiting.push(active); active = null; }
      for (const query of waiting.splice(0)) gl.deleteQuery(query);
    },
  };
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
    const frames = quick ? 8 : workload.heavy ? 20 : 40, samples = [];
    stats.counting = true;
    for (let i = 0; i < frames; i++) samples.push(await draw(i));
    stats.counting = false;
    row.commands = samples[0].commands; row.draws = round(stats.draws / frames, 1);
    row.captureMs = round(mean(samples.map(sample => sample.capture))); row.submitMs = round(mean(samples.map(sample => sample.submit)));
    row.settleMs = round(mean(samples.map(sample => sample.settle)));
    // Query resolve, readback and polling affect submission and pacing. Run the timer on its own
    // repeat of the same warmed workload without collecting CPU or rAF measurements.
    if (stats.timed) {
      probe.start();
      for (let i = 0; i < frames; i++) await draw(i);
      await probe.settle();
      probe.stop();
    }
    row.gpuMs = round(mean(stats.gpu), 3); row.gpuSamples = stats.gpu.length;
    // Keep the original attempt on every callback and observe rejected work separately.
    const paced = quick ? 30 : 120, stamps = [], attempts = [];
    let hidden = document.visibilityState !== 'visible';
    const observeVisibility = () => { hidden ||= document.visibilityState !== 'visible'; };
    document.addEventListener('visibilitychange', observeVisibility);
    try {
      await new Promise((resolve, reject) => {
        let index = 0;
        const tick = stamp => {
          observeVisibility();
          stamps.push(stamp);
          if (index === paced) { resolve(); return; }
          const start = performance.now();
          try { step(index++); } catch (error) { reject(error); return; }
          const updated = performance.now();
          let admitted = true;
          try { engine.renderSharedFrame(FRAME); }
          catch (error) {
            if ([error?.code, error?.cause?.code].some(code => /_BACKPRESSURE$/.test(String(code)))) admitted = false;
            else { reject(error); return; }
          }
          attempts.push({ admitted, mutationMs: updated - start, renderAttemptMs: performance.now() - updated });
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
    } finally { document.removeEventListener('visibilitychange', observeVisibility); }
    await host.whenIdle();
    const intervals = stamps.slice(1).map((stamp, index) => stamp - stamps[index]);
    row.pacing = { visibleThroughout: !hidden, callbacks: stamps.length, intervalsMs: intervals, attempts };
    row.refused = attempts.filter(attempt => !attempt.admitted).length;
    row.intervalMs = hidden ? null : round(quantile(intervals, 0.5));
    row.intervalP95Ms = hidden ? null : round(quantile(intervals, 0.95));
    const failure = host.getStatus().firstFailure;
    if (failure) { row.status = 'failed'; row.reason = describe(failure); } else row.status = 'complete';
  } catch (error) { row.status = 'failed'; row.reason = describe(error) + (error?.cause ? ': ' + describe(error.cause) : ''); }
  finally {
    try { opened?.probe?.stop(); } catch { /* the context or device may already be gone */ }
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
