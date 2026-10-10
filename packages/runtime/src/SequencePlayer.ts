import type { AssetLease } from './AssetLease.js';
import { Bitmap, readBitmapBinding, readBitmapImage } from './Bitmap.js';
import { EgretError } from './EgretError.js';
import { commitBinding, engineOf } from './ownership.js';
import { sampleSequenceClip } from './sequenceClip.js';
import type { SequenceClip, SequencePlaybackMode, SequenceSample } from './sequenceClip.js';
import type { Texture } from './Texture.js';

interface Binding {
  readonly bitmap: Bitmap;
  readonly lease: AssetLease<Texture>;
  readonly clip: SequenceClip;
  readonly mode: SequencePlaybackMode;
}
interface PlayerState {
  binding: Binding | undefined;
  lastSample: SequenceSample | undefined;
}
const states = new WeakMap<object, PlayerState>();
// Capture the trusted operation once; caller overrides never supply crop authority.
const setCrop = Object.getOwnPropertyDescriptor(Bitmap.prototype, 'sourceRect')!.set!;

function stateOf(receiver: unknown): PlayerState {
  const state = states.get(receiver as object);
  if (state === undefined) throw new EgretError('SEQ_PLAYER_INVALID');
  return state;
}

/** Explicit absolute-time selection borrowing a target and its exact current lease. */
export class SequencePlayer {
  public constructor(bitmap: Bitmap, clip: SequenceClip, mode: SequencePlaybackMode = 'once') {
    const target = readBitmapBinding(bitmap);
    if (target === undefined) throw new EgretError('BITMAP_TEXTURE_REQUIRED');
    const snapshot = readBitmapImage(target.lease);
    if (mode !== 'once' && mode !== 'loop') throw new EgretError('SEQ_INPUT_INVALID');
    // Authenticate before reading even frozen-looking public clip dimensions.
    sampleSequenceClip(clip, 0, { mode });
    const { image, sourceRect } = snapshot;
    if (sourceRect.x !== 0 || sourceRect.y !== 0
      || sourceRect.width !== image.width || sourceRect.height !== image.height
      || clip.atlasWidth !== image.width || clip.atlasHeight !== image.height) {
      throw new EgretError('SEQ_ATLAS_MISMATCH');
    }
    states.set(this, { binding: { bitmap, lease: target.lease, clip, mode }, lastSample: undefined });
    // Affinity survives disposal, but cleanup belongs only to an adopting Scope.
    commitBinding([this], engineOf(bitmap)!);
  }

  public applyAt(elapsedSeconds: number): SequenceSample {
    const state = stateOf(this);
    const binding = state.binding;
    if (binding === undefined) throw new EgretError('SEQ_PLAYER_DISPOSED');
    const target = readBitmapBinding(binding.bitmap);
    // Exact identity precedes entitlement, including a cleared target slot.
    if (target?.lease !== binding.lease) throw new EgretError('SEQ_BINDING_CHANGED');
    readBitmapImage(binding.lease);
    const sample = sampleSequenceClip(binding.clip, elapsedSeconds, { mode: binding.mode });
    Reflect.apply(setCrop, binding.bitmap, [sample.region]);
    // Crop and natural geometry have committed; only now publish the sample.
    state.lastSample = sample;
    return sample;
  }

  public get lastSample(): SequenceSample | undefined { return stateOf(this).lastSample; }
  public get isDisposed(): boolean { return stateOf(this).binding === undefined; }

  /** Drop every borrow; the last owned immutable sample is safe to retain. */
  public dispose(): void { stateOf(this).binding = undefined; }
}
