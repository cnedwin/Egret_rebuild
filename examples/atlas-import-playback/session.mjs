// SPDX-License-Identifier: Apache-2.0
// Public SDK example composition. Node supplies normalized inputs; this module never parses metadata.
import {
  Sprite, createAssetRef, createAssetType, createEngine, createEngineForProfile,
  createSequenceClip, createSpriteSheet, createTexture, isTexture, TEXTURED_FRAME_PROFILE_2D,
} from '@egret/engine';

const PROFILE = 'trim-rotation-v1';
const FRAME = Object.freeze({ width: 24, height: 16, clearColor: 0, clearAlpha: 0 });
function errorView(cause, seen = new Set(), depth = 0) {
  const result = { wasUndefined: cause === undefined };
  try {
    result.name = typeof cause?.name === 'string' ? cause.name : null;
    result.code = typeof cause?.code === 'string' ? cause.code : null;
    result.message = String(cause?.message ?? cause);
    if (cause !== null && (typeof cause === 'object' || typeof cause === 'function')) {
      if (seen.has(cause)) { result.cycle = true; return result; }
      seen.add(cause);
      if (depth >= 8) { result.truncated = true; return result; }
      if (Object.hasOwn(cause, 'cause')) result.cause = errorView(cause.cause, new Set(seen), depth + 1);
      for (const key of ['errors', 'cleanupErrors']) {
        if (Array.isArray(cause[key])) result[key] = cause[key].map(value => errorView(value, new Set(seen), depth + 1));
      }
    }
  } catch { result.unreadable = true; }
  return result;
}

export async function createAtlasImportSession({ host, profile, image, sequenceInput, spriteSheetFrames }) {
  if (profile !== 'canvas-2d' && profile !== 'webgpu-textured-2d') {
    throw new TypeError('Fixed 2D profile required');
  }
  const diagnostics = [], ticks = [], cleanupErrors = [], leases = [], textures = [];
  const sheets = [], bitmaps = [], parents = [], controllers = [];
  const providerDisposalAttempts = [], providerDisposals = [];
  const options = { host, onDiagnostic(row) { diagnostics.push(row); } };
  const engine = await (profile === 'canvas-2d'
    ? createEngine(options) : createEngineForProfile(options, TEXTURED_FRAME_PROFILE_2D));
  let displayScope, animationScope, actor, clip, closePromise;
  let state = 'starting', sourceSeconds = 0, initialized = false;

  function resources() {
    // Raw references let CPU callers verify the exact original objects, without private SDK hooks.
    return Object.freeze({
      leases: Object.freeze([...leases]), textures: Object.freeze([...textures]),
      providerDisposalAttempts: Object.freeze([...providerDisposalAttempts]),
      providerDisposals: Object.freeze([...providerDisposals]),
    });
  }
  function diagnosticViews() {
    return diagnostics.map(row => ({
      code: row.code, severity: row.severity, phase: row.phase, cause: errorView(row.cause),
    }));
  }
  function retirementEvidence() {
    const released = leases.map(lease => {
      try { void lease.value; return false; }
      catch (cause) {
        if (cause?.code !== 'ASSET_LEASE_RELEASED') throw cause;
        return true;
      }
    });
    return {
      state,
      scopes: [displayScope, animationScope].filter(Boolean).map(scope => scope.state),
      controllers: controllers.map(value => value.isDisposed),
      bitmaps: bitmaps.map(value => value.isDisposed),
      parents: parents.map(value => value.isDisposed),
      sheets: sheets.map(value => value.isDisposed),
      leases: released,
      textures: textures.map(value => value.isDisposed),
      provider: {
        loads: textures.length, disposalAttempts: providerDisposalAttempts.length,
        disposals: providerDisposals.length,
        exactOriginals: textures.map(texture =>
          providerDisposalAttempts.filter(value => value === texture).length === 1
          && providerDisposals.filter(value => value === texture).length === 1),
      },
      stage: engine.stage.isDisposed, clock: engine.clock.state,
      cleanupErrors: cleanupErrors.length,
      cleanupFailures: cleanupErrors.map(row => ({ name: row.name, error: errorView(row.cause) })),
      diagnostics: diagnosticViews(),
    };
  }
  async function runClose() {
    const keep = async (name, run) => {
      try { await run(); } catch (cause) { cleanupErrors.push({ name, cause }); }
    };
    // Controllers retire before their display objects, and those before the exact atlas lease.
    await keep('animation Scope', () => animationScope?.dispose());
    await keep('display and lease Scope', () => displayScope?.dispose());
    await keep('Engine and original Host', () => engine.dispose());
    state = 'closed';
    const retired = retirementEvidence();
    if (cleanupErrors.length || diagnostics.length) {
      // Scope.dispose reports rather than throws; retain every authentic diagnostic cause as well.
      const causes = [...cleanupErrors.map(row => row.cause), ...diagnostics.map(row => row.cause)];
      const error = new AggregateError(causes, 'Atlas import session cleanup failed', { cause: causes[0] });
      error.cleanupFailures = Object.freeze([...cleanupErrors]);
      error.diagnostics = Object.freeze([...diagnostics]);
      error.retirement = retired;
      throw error;
    }
    if (initialized && (
      retired.scopes.length !== 2 || retired.scopes.some(value => value !== 'closed')
      || !['controllers', 'bitmaps', 'parents', 'sheets', 'leases', 'textures'].every(key =>
        retired[key].length === 1 && retired[key].every(value => value === true))
      || !retired.stage || retired.clock !== 'closed'
      || retired.provider.loads !== 1 || retired.provider.disposalAttempts !== 1
      || retired.provider.disposals !== 1 || retired.provider.exactOriginals[0] !== true
    )) throw new Error('Original atlas import owners did not retire');
    return retired;
  }
  function close() {
    if (closePromise !== undefined) return closePromise;
    // Publish the exact close promise before the first callback-capable Scope operation.
    let resolveClose, rejectClose;
    closePromise = new Promise((resolve, reject) => { resolveClose = resolve; rejectClose = reject; });
    state = 'closing';
    void runClose().then(resolveClose, rejectClose);
    return closePromise;
  }
  try {
    displayScope = engine.createScope();
    animationScope = engine.createScope();
    engine.clock.onTick(animationScope, tick => { ticks.push({ ...tick }); });
    engine.advanceTime(0);
    const type = createAssetType('egret.example.atlas-import', isTexture);
    const ref = createAssetRef(type, 'egret.atlas-import.original-atlas');
    engine.assets.register(type, {
      load() {
        // Original full image: neither a derived Texture nor a cropped replacement lease.
        const value = createTexture(image);
        textures.push(value);
        return Promise.resolve(value);
      },
      dispose(value) {
        providerDisposalAttempts.push(value);
        value.dispose();
        providerDisposals.push(value);
      },
    });
    const lease = displayScope.use(await engine.assets.acquire(ref, { signal: displayScope.signal }));
    leases.push(lease);
    const sheet = displayScope.use(createSpriteSheet(lease, spriteSheetFrames, PROFILE));
    sheets.push(sheet);
    clip = createSequenceClip(sequenceInput, PROFILE);
    const parent = displayScope.use(new Sprite());
    parents.push(parent);
    const bitmap = displayScope.use(sheet.createBitmap(sheet.names[0]));
    bitmaps.push(bitmap);
    parent.x = 2; parent.y = 2;
    parent.addChild(bitmap); engine.stage.addChild(parent);
    // The example has one once controller; loop composition is a separate public CPU fixture.
    const playback = engine.createSequencePlayback(animationScope, bitmap, clip, { mode: 'once' });
    controllers.push(playback);
    actor = Object.freeze({ parent, bitmap, sheet, lease, playback, mode: 'once' });
    initialized = true;
    state = 'ready';
  } catch (cause) {
    try { await close(); }
    catch (cleanup) {
      throw new AggregateError([cause, cleanup], 'Atlas import initialization and cleanup failed', { cause });
    }
    throw cause;
  }

  function open() { if (state !== 'ready') throw new Error('Atlas import session is closed'); }
  function inspect() {
    return {
      state, sourceSeconds, gameSeconds: engine.clock.elapsedSeconds, tickId: engine.clock.tickId,
      ticks: ticks.map(row => ({ ...row })), diagnostics: diagnosticViews(),
      actor: {
        mode: actor.mode, state: actor.playback.state, elapsed: actor.playback.elapsedSeconds,
        isDisposed: actor.playback.isDisposed, sample: actor.playback.lastSample ?? null,
        bitmapDisposed: actor.bitmap.isDisposed,
        naturalWidth: actor.bitmap.naturalWidth, naturalHeight: actor.bitmap.naturalHeight,
        sourceRect: actor.bitmap.sourceRect,
        bounds: actor.bitmap.isDisposed ? null : actor.bitmap.getBounds(),
        parent: {
          x: actor.parent.x, y: actor.parent.y, rotation: actor.parent.rotation,
          scaleX: actor.parent.scaleX, scaleY: actor.parent.scaleY,
          anchorOffsetX: actor.parent.anchorOffsetX, anchorOffsetY: actor.parent.anchorOffsetY,
          clipRect: actor.parent.clipRect ?? null,
        },
      },
      cleanupErrors: cleanupErrors.map(row => ({ name: row.name, error: errorView(row.cause) })),
    };
  }
  return Object.freeze({
    engine, actor, clip, resources, inspect, close, retire: close,
    advanceTo(seconds) {
      open();
      const tick = engine.advanceTime(seconds);
      sourceSeconds = seconds;
      return tick;
    },
    capture() {
      open();
      return profile === 'canvas-2d' ? engine.captureFrame(FRAME) : engine.captureTexturedFrame(FRAME);
    },
  });
}
