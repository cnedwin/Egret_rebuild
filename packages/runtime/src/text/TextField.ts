import type { CancellationSignal } from '@egret/contracts';
import { AssetLease } from '../AssetLease.js';
import { CancellationController } from '../CancellationController.js';
import { DisplayObject } from '../DisplayObject.js';
import { EgretError } from '../EgretError.js';
import { Scope } from '../Scope.js';
import { readBitmapImage } from '../Bitmap.js';
import { assertTextFieldScope, writeTextFieldState } from '../textDisplayState.js';
import type { TextFieldCommittedDisplay } from '../textDisplayState.js';
import type { EngineContext } from '../ownership.js';
import type { PreparedTextRaster, TextRasterMetrics, TextRasterRequestInput } from './types.js';

export interface TextFieldCachePort {
  readonly context: EngineContext;
  assertOpen(): void;
  adopt(input: TextRasterRequestInput, revalidate: () => void): TextRasterRequestInput;
  acquire(input: TextRasterRequestInput, signal: CancellationSignal): Promise<PreparedTextRaster>;
}
interface Demand {
  readonly revision: number;
  readonly controller: CancellationController;
  readonly resolve: (metrics: TextRasterMetrics) => void;
  readonly reject: (cause: unknown) => void;
}
interface State {
  readonly scope: Scope;
  readonly cache: TextFieldCachePort;
  disposed: boolean;
  reading: boolean;
  desiredRevision: number;
  desired: TextRasterRequestInput | undefined;
  committedRevision: number | undefined;
  metrics: TextRasterMetrics | undefined;
  committed: TextFieldCommittedDisplay | undefined;
  pending: Demand | undefined;
}
const states = new WeakMap<object, State>();
const CREATION_TOKEN: unique symbol = Symbol('egret.textFieldFactory');
const APPLY = Reflect.apply;
const FREEZE = Object.freeze;
const USE_SCOPE = Scope.prototype.use;
const DISPOSE_DISPLAY = DisplayObject.prototype.dispose;
const RELEASE_LEASE = AssetLease.prototype.release;
const ABORT = CancellationController.prototype.abort;
const SAFE_INTEGER = Number.isSafeInteger;

function stateOf(value: unknown): State {
  const state = states.get(value as object);
  if (state === undefined) throw new EgretError('TEXT_FIELD_INVALID');
  return state;
}
function live(state: State): void {
  if (state.disposed) throw new EgretError('TEXT_FIELD_DISPOSED');
  state.cache.context.assertOpen();
  assertTextFieldScope(state.scope);
}
function publish(node: object, state: State): void {
  writeTextFieldState(node, FREEZE({ scope: state.scope, committed: state.committed }));
}
function release(committed: TextFieldCommittedDisplay | undefined): void {
  if (committed?.lease !== undefined) APPLY(RELEASE_LEASE, committed.lease, []);
}
function cancel(demand: Demand | undefined, cause: unknown): void {
  if (demand === undefined) return;
  // Promise authority is retired before the provider's synchronous abort observer.
  demand.reject(cause);
  APPLY(ABORT, demand.controller, [cause]);
}
function copyMetrics(value: TextRasterMetrics): TextRasterMetrics {
  const copyBounds = (bounds: typeof value.logicalBounds) => FREEZE({ ...bounds });
  return FREEZE({ logicalBounds: copyBounds(value.logicalBounds),
    inkBounds: value.inkBounds === undefined ? undefined : copyBounds(value.inkBounds),
    contentBounds: copyBounds(value.contentBounds),
    lines: FREEZE(value.lines.map(line => FREEZE({ source: FREEZE({ ...line.source }),
      advance: line.advance, baselineY: line.baselineY,
      inkBounds: line.inkBounds === undefined ? undefined : copyBounds(line.inkBounds) }))),
    raster: value.raster === undefined ? undefined : FREEZE({ ...value.raster }) });
}

/** This class never enters a public namespace; only authentic cache assembly constructs it. */
class TextFieldLeaf extends DisplayObject {
  public constructor(scope: Scope, cache: TextFieldCachePort, token: typeof CREATION_TOKEN) {
    // prototype.constructor is observable; validate before display registration or external reads.
    if (token !== CREATION_TOKEN) throw new EgretError('TEXT_FIELD_INVALID');
    super();
    cache.context.assertOpen(); assertTextFieldScope(scope); cache.assertOpen();
    const state: State = { scope, cache, disposed: false, reading: false, desiredRevision: 0,
      desired: undefined, committedRevision: undefined, metrics: undefined, committed: undefined, pending: undefined };
    states.set(this, state); publish(this, state);
    APPLY(USE_SCOPE, scope, [this]);
  }

  public setRequest(input: TextRasterRequestInput): void {
    const state = stateOf(this); live(state);
    if (state.reading) throw new EgretError('TEXT_FIELD_BUSY');
    state.reading = true;
    let previous: Demand | undefined;
    try {
      // The private callback runs after successful source reads, before semantics.
      const desired = state.cache.adopt(input, () => { live(state); });
      live(state);
      const revision = state.desiredRevision + 1;
      if (!SAFE_INTEGER(revision)) throw new EgretError('TEXT_FIELD_REVISION_LIMIT');
      previous = state.pending; state.pending = undefined;
      state.desired = desired; state.desiredRevision = revision;
    } finally { state.reading = false; }
    // Abort reentry sees the new request and a retired synchronous admission guard.
    cancel(previous, new EgretError('TEXT_FIELD_SUPERSEDED'));
  }

  public prepare(): Promise<TextRasterMetrics> {
    return new Promise((resolve, reject) => {
      let state: State, demand: Demand;
      try {
        state = stateOf(this); live(state);
        if (state.reading || state.pending !== undefined) throw new EgretError('TEXT_FIELD_BUSY');
        if (state.desired === undefined) throw new EgretError('TEXT_FIELD_UNPREPARED');
        state.cache.assertOpen();
        const controller = new CancellationController(diagnostic => {
          state.cache.context.captureCleanup(diagnostic.cause); state.cache.context.report(diagnostic);
        });
        demand = { revision: state.desiredRevision, controller, resolve, reject };
        state.pending = demand;
        const acquired = state.cache.acquire(state.desired, controller.signal);
        void acquired.then(result => {
          let staged: TextFieldCommittedDisplay | undefined;
          let ownsResult = result.kind === 'image';
          try {
            // A stale demand has already rejected; it can only retire its result.
            if (state.pending !== demand) {
              if (result.kind === 'image') APPLY(RELEASE_LEASE, result.lease, []);
              ownsResult = false;
              return;
            }
            live(state); state.cache.assertOpen();
            if (state.desiredRevision !== demand.revision) throw new EgretError('TEXT_FIELD_SUPERSEDED');
            const metrics = copyMetrics(result.metrics);
            let sourceRect;
            if (result.kind === 'image') sourceRect = FREEZE({ ...readBitmapImage(result.lease).sourceRect });
            staged = FREEZE({ contentBounds: metrics.contentBounds,
              raster: metrics.raster === undefined ? undefined : FREEZE({ x: metrics.raster.x, y: metrics.raster.y,
                width: metrics.raster.logicalWidth, height: metrics.raster.logicalHeight }),
              lease: result.kind === 'image' ? result.lease : undefined, sourceRect });
            live(state); state.cache.assertOpen();
            if (state.pending !== demand || state.desiredRevision !== demand.revision) throw new EgretError('TEXT_FIELD_SUPERSEDED');
            const previous = state.committed;
            state.pending = undefined; state.committed = staged; state.metrics = metrics;
            state.committedRevision = demand.revision; publish(this, state); ownsResult = false;
            // Publication precedes old-lease cleanup; terminal reentry cannot roll it back.
            release(previous);
            demand.resolve(metrics);
          } catch (cause) {
            if (state.pending === demand) state.pending = undefined;
            if (ownsResult && result.kind === 'image') {
              try { APPLY(RELEASE_LEASE, result.lease, []); }
              catch (cleanup) { state.cache.context.captureCleanup(cleanup); }
            }
            demand.reject(cause);
          }
        }, cause => {
          if (state.pending === demand) { state.pending = undefined; demand.reject(cause); }
        }).catch(cause => {
          // A stale lease retirement can throw; observe and report without resurrecting demand.
          state.cache.context.captureCleanup(cause);
          state.cache.context.report({ code: 'TEXT_FIELD_CLEANUP_FAILED', phase: 'assets', severity: 'error', cause });
        });
      } catch (cause) {
        reject(cause);
      }
    });
  }

  public getStatus(): { readonly state: 'unprepared' | 'ready' | 'disposed'; readonly desiredRevision: number;
    readonly committedRevision: number | undefined; readonly pending: boolean; readonly metrics: TextRasterMetrics | undefined } {
    const state = stateOf(this);
    return FREEZE({ state: state.disposed ? 'disposed' : state.committedRevision === undefined ? 'unprepared' : 'ready',
      desiredRevision: state.desiredRevision, committedRevision: state.committedRevision,
      pending: state.pending !== undefined, metrics: state.metrics });
  }

  public override dispose(): void {
    const state = stateOf(this);
    if (state.disposed) return;
    state.disposed = true;
    const pending = state.pending, committed = state.committed;
    state.pending = undefined; state.committed = undefined; state.desired = undefined; publish(this, state);
    let failed = false, first: unknown;
    const attempt = (action: () => void): void => {
      try { action(); } catch (cause) { if (!failed) { failed = true; first = cause; } }
    };
    // Terminate the display before any cancellation/release callback can reenter it.
    attempt(() => { APPLY(DISPOSE_DISPLAY, this, []); });
    attempt(() => { cancel(pending, new EgretError('TEXT_FIELD_DISPOSED')); });
    attempt(() => { release(committed); });
    if (failed) throw first;
  }
}

export function createTextFieldLeaf(scope: Scope, cache: TextFieldCachePort): DisplayObject {
  return new TextFieldLeaf(scope, cache, CREATION_TOKEN);
}
