// SPDX-License-Identifier: Apache-2.0
import { admitResourceManifest } from '@egret/contracts/resources';
import {
  createEngineForProfile,
  createAssetType,
  isTexture,
  createSpriteSheet,
  createSequenceClip
} from '@egret/engine';
import { createManifestAssetBinding } from '@egret/engine/resources';
import { createManifestByteSource, createManifestTextureProvider } from '@egret/engine/web/resources';
import { createSharedWebGPUHost } from '@egret/engine/webgpu';
import { createSharedWebGL2Host } from '@egret/engine/webgl2';
import { createManifestSpineContentLoader } from '@egret/spine/web';
import { createOutfitScene, presentOutfitPair } from './scene.mjs';
const canvas = document.querySelector('canvas'),
  status = document.querySelector('#status');
const backend = new URL(location.href).searchParams.get('backend') ?? 'webgpu';
if (!['webgpu', 'webgl2'].includes(backend)) throw Error('BACKEND');
const frameOptions = Object.freeze({
  width: 640,
  height: 400,
  clearColor: 0x18243a,
  clearAlpha: 1,
  outputAlpha: 'opaque'
});
let current,
  serial = 0,
  playing = false,
  raf = 0,
  closedReport,
  openingRequest,
  intent = 0,
  preview = 0;
const errors = [];
const errorView = e => ({ code: e?.code ?? null, message: String(e?.message ?? e) });
function describe() {
  const s = inspect();
  status.textContent = JSON.stringify(
    {
      state: s.state,
      backend,
      seconds: s.seconds,
      counts: s.scene?.counts,
      sharedSetup: s.loader,
      pairVersion: s.scene?.pairVersion,
      replacing: s.replacing,
      selected: s.scene?.players[Number(document.querySelector('#player').value)],
      transport: s.transport,
      cleanup: s.cleanup,
      errors
    },
    null,
    2
  );
}
export function inspect() {
  const r = current;
  return r
    ? {
        state: r.state,
        openingId: r.id,
        openMs: r.openMs,
        readyAt: r.readyAt,
        backend,
        seconds: r.seconds,
        scene: r.scene?.inspect(),
        replacing: !!r.pendingPair,
        loader: r.loader?.getStatus(),
        transport: r.loader?.getTransportStatus(),
        sequenceTransport: { source: r.source?.getStatus(), provider: r.provider?.getStatus() },
        diagnostics: [...r.diagnostics],
        cleanup: r.cleanup,
        errors: [...errors]
      }
    : (closedReport ?? { state: 'idle', backend });
}
function assertReady() {
  if (current?.state !== 'ready') throw Error('SCENE_NOT_READY');
  return current;
}
export function render() {
  const r = assertReady();
  return r.engine.renderSharedFrame(frameOptions);
}
function update(delta, change) {
  const r = assertReady();
  if (!Number.isFinite(delta) || delta < 0 || delta > 0.1) throw Error('STEP_RANGE');
  r.work = (r.work ?? Promise.resolve())
    .catch(() => {})
    .then(async () => {
      if (r !== current || r.state !== 'ready') throw Error('SCENE_NOT_READY');
      await r.host.whenIdle();
      if (r !== current || r.state !== 'ready') throw Error('SCENE_NOT_READY');
      change?.();
      r.seconds += delta;
      r.engine.advanceTime(r.seconds);
      render();
      await r.host.whenIdle();
      describe();
      return inspect();
    });
  return r.work;
}
export function step(delta = 1 / 60) {
  return update(delta);
}
/**
 * Times `frames` steps of 1/60 second, each part by itself, in milliseconds: `animation` is the engine advancing every
 * Spine instance and sequence controller; `capture` is the engine taking the shared frame; `render` is taking it again
 * and the Host preparing and submitting it; `settle` is the wait until the Host has nothing in flight. The frame is
 * captured twice in a step, so `render` less `capture` is roughly the Host's part. Nothing is written to the page
 * between steps.
 */
export function measure(frames = 120) {
  const r = assertReady();
  if (!Number.isSafeInteger(frames) || frames < 1 || frames > 3600) throw Error('MEASURE_RANGE');
  r.work = (r.work ?? Promise.resolve())
    .catch(() => {})
    .then(async () => {
      const rows = { animation: [], capture: [], render: [], settle: [] },
        heap = () => performance.memory?.usedJSHeapSize ?? null,
        before = heap();
      let foregroundFrames = 0;
      for (let i = 0; i < frames; i++) {
        if (r !== current || r.state !== 'ready') throw Error('SCENE_NOT_READY');
        await r.host.whenIdle();
        r.seconds += 1 / 60;
        if (document.visibilityState === 'visible' && document.hasFocus()) foregroundFrames++;
        const t0 = performance.now();
        r.engine.advanceTime(r.seconds);
        const t1 = performance.now();
        r.engine.captureSharedFrame(frameOptions);
        const t2 = performance.now();
        render();
        const t3 = performance.now();
        await r.host.whenIdle();
        const t4 = performance.now();
        rows.animation.push(t1 - t0);
        rows.capture.push(t2 - t1);
        rows.render.push(t3 - t2);
        rows.settle.push(t4 - t3);
      }
      const summary = values => {
        const sorted = [...values].sort((x, y) => x - y),
          at = q => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
        return { p50: at(0.5), p95: at(0.95), max: sorted[sorted.length - 1] };
      };
      describe();
      return {
        frames,
        foregroundFrames,
        backend,
        counts: r.scene.inspect().counts,
        animation: summary(rows.animation),
        capture: summary(rows.capture),
        render: summary(rows.render),
        settle: summary(rows.settle),
        heapBytes: before === null ? null : { before, after: heap() }
      };
    });
  return r.work;
}
export function edit(index, values) {
  const r = assertReady();
  return update(1 / 60, () => r.scene.edit(index, values));
}
export async function pixels() {
  const r = assertReady();
  await r.work;
  await r.host.whenIdle();
  const ticket = r.host.requestReadback();
  render();
  const result = await ticket;
  await r.host.whenIdle();
  return { width: result.width, height: result.height, bytes: Array.from(result.bytes) };
}
export function cancelPair() {
  const pending = current?.pendingPair;
  if (!pending || pending.committed) return false;
  current.pendingPair = undefined;
  pending.upload?.dispose();
  pending.ticket?.dispose();
  pending.owner.dispose();
  return true;
}

// Load both resource families offstage. Only the last, GPU-backed publication joins the scene's frame queue.
export function replacePair(version) {
  const r = assertReady(),
    source = r.pairSources[version];
  if (!Object.hasOwn(r.pairSources, version)) throw Error('PAIR_VERSION');
  cancelPair();
  const owner = r.engine.createScope(),
    pending = { owner, committed: false };
  r.pendingPair = pending;
  const live = () => {
    if (r !== current || r.state !== 'ready' || r.pendingPair !== pending) throw Error('PAIR_CANCELLED');
  };
  const operation = (async () => {
    try {
      const group = r.loader.load(owner, [source.assetId]);
      const sequences = r.loadSequence(owner, source);
      await Promise.all([group.ready, sequences.ready]);
      live();
      const sheet = owner.use(
        createSpriteSheet(sequences.get(source.page), [{ name: 'spark', x: 0, y: 0, width: 1, height: 1 }])
      );
      const clip = createSequenceClip(sequences.get(source.sequence).value);
      r.work = (r.work ?? Promise.resolve())
        .catch(() => {})
        .then(async () => {
          await r.host.whenIdle();
          live();
          pending.ticket = r.scene.preparePair(owner, group.getSpine(source.assetId), sheet, clip, version);
          await presentOutfitPair(pending, r.host, frameOptions, live);
        });
      await r.work;
      return version;
    } finally {
      pending.upload?.dispose();
      pending.ticket?.dispose();
      if (!pending.committed) owner.dispose();
      if (r.pendingPair === pending) r.pendingPair = undefined;
      if (r === current) describe();
    }
  })();
  r.pendingOperation = operation;
  return operation;
}
export function close() {
  intent++;
  return closeCurrent();
}
function closeCurrent() {
  preview++;
  playing = false;
  cancelAnimationFrame(raf);
  const r = current;
  if (!r) return Promise.resolve(inspect());
  if (r.closing) return r.closing;
  r.cancelled = true;
  r.state = 'closing';
  r.abort.abort();
  cancelPair();
  // Revoke scopes before awaiting pending source work, including close during load.
  r.scene?.dispose();
  r.data?.dispose();
  r.owner?.dispose();
  r.loader?.dispose();
  r.closing = (async () => {
    await r.opening.catch(() => {});
    await r.pendingOperation?.catch(() => {});
    await r.work?.catch(() => {});
    const failures = [];
    const attempt = async fn => {
      try {
        await fn();
      } catch (e) {
        failures.push(errorView(e));
      }
    };
    await attempt(() => r.scene?.dispose());
    await attempt(() => r.data?.dispose());
    await attempt(() => r.owner?.dispose());
    await attempt(() => r.loader?.close());
    await attempt(() => r.provider?.close());
    await attempt(() => r.source?.close());
    r.cleanup = {
      data: r.data?.state,
      owner: r.owner?.state,
      sheetDisposed: r.sheet?.isDisposed,
      sequenceTextureDisposed: r.texture?.isDisposed,
      groupDisposed: r.group?.isDisposed,
      loader: r.loader?.getStatus(),
      scene: r.scene?.inspect().ownership,
      counts: r.scene?.inspect().counts,
      failures
    };
    await attempt(() => r.engine?.dispose());
    await attempt(() => r.host?.close());
    r.cleanup.host = r.host?.getSharedStatus();
    r.state = 'closed';
    closedReport = inspect();
    describe();
    return closedReport;
  })();
  return r.closing;
}
export function open() {
  if (openingRequest) return openingRequest;
  const ticket = ++intent;
  openingRequest = openOnce(ticket, performance.now()).finally(() => {
    openingRequest = undefined;
  });
  return openingRequest;
}
async function openOnce(ticket, start) {
  await closeCurrent();
  if (ticket !== intent) throw Error('SCENE_CANCELLED');
  const r = {
    id: ++serial,
    state: 'loading',
    seconds: 0,
    cancelled: false,
    abort: new AbortController(),
    diagnostics: []
  };
  current = r;
  const live = () => {
    if (r.cancelled) throw Error('SCENE_CANCELLED');
  };
  r.opening = (async () => {
    const base = new URL('/work/animation-outfits/', location.href),
      response = await fetch(new URL('manifest.json', base), {
        signal: r.abort.signal,
        cache: 'no-store',
        redirect: 'error'
      });
    if (!response.ok) throw Error('CONTENT_HTTP');
    const admitted = admitResourceManifest(await response.json());
    if (!admitted.ok) throw Error('CONTENT_MANIFEST');
    live();
    const manifest = admitted.value;
    const onDiagnostic = d => r.diagnostics.push({ code: d.code, phase: d.phase });
    r.host = (backend === 'webgpu' ? createSharedWebGPUHost : createSharedWebGL2Host)({
      canvas,
      pixelRatio: 1,
      outputAlpha: 'opaque',
      enableReadback: true,
      onDiagnostic
    });
    r.engine = await createEngineForProfile({ host: r.host, onDiagnostic }, 'egret.shared-frame2d/1');
    live();
    r.owner = r.engine.createScope();
    r.data = r.engine.createScope();
    r.loader = createManifestSpineContentLoader(r.engine, r.owner, manifest, {
      baseUrl: base.href,
      deadlineMs: 15000,
      networkRetries: 0
    });
    r.group = r.loader.load(r.data, ['e_character']);
    const imageType = createAssetType('outfit-sequence-image', isTexture),
      metadataType = createAssetType('outfit-sequence-metadata', v => v !== null && typeof v === 'object');
    r.pairSources = {};
    for (const [version, suffix] of [
      ['original', ''],
      ['alternate', '_alt']
    ]) {
      r.pairSources[version] = {
        assetId: 'e_character' + suffix,
        page: createManifestAssetBinding(manifest, 'e_sparks' + suffix, imageType),
        sequenceId: 'e_sequence' + suffix,
        sequence: createManifestAssetBinding(manifest, 'e_sequence' + suffix, metadataType)
      };
    }
    const bindings = Object.values(r.pairSources).flatMap(entry => [entry.page, entry.sequence]);
    const { page, sequence } = r.pairSources.original;
    r.source = createManifestByteSource(manifest, bindings, {
      baseUrl: base.href,
      deadlineMs: 15000,
      networkRetries: 0
    });
    r.provider = createManifestTextureProvider(r.source);
    r.engine.assets.register(imageType, r.provider);
    r.engine.assets.register(metadataType, {
      async load(ref, context) {
        return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await r.source.readBytes(ref, context)));
      },
      dispose() {}
    });
    r.loadSequence = (scope, entry) =>
      r.engine.createManifestGroup(scope, manifest, [entry.sequenceId], [entry.page, entry.sequence]);
    r.sequenceGroup = r.loadSequence(r.data, r.pairSources.original);
    await Promise.all([r.group.ready, r.sequenceGroup.ready]);
    live();
    const lease = r.sequenceGroup.get(page);
    r.texture = lease.value;
    r.sheet = r.data.use(createSpriteSheet(lease, [{ name: 'spark', x: 0, y: 0, width: 1, height: 1 }]));
    const clip = createSequenceClip(r.sequenceGroup.get(sequence).value);
    r.scene = createOutfitScene(r.engine, r.group.getSpine('e_character'), r.sheet, clip);
    r.engine.advanceTime(0);
    r.state = 'ready';
    render();
    r.readyAt = performance.now();
    r.openMs = r.readyAt - start;
    describe();
    return inspect();
  })().catch(e => {
    if (!r.cancelled) {
      r.state = 'failed';
      errors.push(errorView(e));
      describe();
    }
    throw e;
  });
  try {
    return await r.opening;
  } catch (e) {
    await close();
    throw e;
  }
}
async function animate(token) {
  if (token !== preview || !playing || current?.state !== 'ready') return;
  try {
    await step(1 / 60);
    if (playing && token === preview) raf = requestAnimationFrame(() => animate(token));
  } catch (e) {
    playing = false;
    errors.push(errorView(e));
    describe();
  }
}
const playerSelect = document.querySelector('#player');
for (let i = 0; i < 20; i++) {
  const option = document.createElement('option');
  option.value = String(i);
  option.textContent = String(i + 1);
  playerSelect.append(option);
}
function values() {
  return {
    outfit: document.querySelector('#outfit').value,
    animation: document.querySelector('#animation').value,
    plays: document.querySelector('#plays').value === 'infinite' ? 'infinite' : 2,
    rate: Number(document.querySelector('#rate').value),
    paused: document.querySelector('#pause').checked
  };
}
for (const button of document.querySelectorAll('[data-action]'))
  button.addEventListener('click', () => {
    const kind = button.dataset.action;
    Promise.resolve()
      .then(() => {
        if (kind === 'open') return open();
        if (kind === 'close') return close();
        if (kind === 'pair') return replacePair(inspect().scene?.pairVersion === 'original' ? 'alternate' : 'original');
        if (kind === 'cancel-pair') return cancelPair();
        if (kind === 'step') return step(0.1);
        if (kind === 'apply') return edit(Number(playerSelect.value), values());
        if (kind === 'run') {
          playing = !playing;
          const token = ++preview;
          if (playing) animate(token);
          else cancelAnimationFrame(raf);
        }
      })
      .catch(e => {
        errors.push(errorView(e));
        describe();
      });
  });
window.addEventListener(
  'pagehide',
  () => {
    void close();
  },
  { once: true }
);
export const ready = open();
void ready.catch(() => {});
