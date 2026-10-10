/** Internal immutable sequence timing metadata; not a texture or player. */
export interface SequenceClip {
  readonly atlasWidth: number;
  readonly atlasHeight: number;
  readonly frameCount: number;
  readonly durationSeconds: number;
}
export interface SequenceRegion {
  readonly x: number; readonly y: number; readonly width: number; readonly height: number;
}
export interface SequenceSample {
  readonly frameIndex: number; readonly region: SequenceRegion;
  readonly positionSeconds: number; readonly atEnd: boolean; readonly stopped: boolean;
}
type SequenceClipErrorCode = 'SEQ_INPUT_INVALID' | 'SEQ_BUDGET' | 'SEQ_REGION_INVALID'
  | 'SEQ_TIME_INVALID' | 'SEQ_READ_FAILED' | 'SEQ_CLIP_INVALID';

class SequenceClipError extends Error {
  public constructor(public readonly code: SequenceClipErrorCode, cause?: unknown) {
    super(code, { cause });
    this.name = 'SequenceClipError';
  }
}

interface CapturedField { readonly present: boolean; readonly value: unknown; }
interface OwnedClip {
  readonly regions: readonly SequenceRegion[];
  readonly ends: readonly number[];
  readonly durationSeconds: number;
}
const MAX_FRAMES = 1024;
// Identity comes only from this module. Copies and proxies never gain authority,
// and the private value retains no caller object, array, clock or image resource.
const clips = new WeakMap<SequenceClip, OwnedClip>();

function admitObject(value: unknown): object {
  if (typeof value !== 'object' || value === null) throw new SequenceClipError('SEQ_INPUT_INVALID');
  let array: boolean;
  // Catch only the source admission operation. Preserve its actual cause;
  // never recreate a revoked proxy's native exception with a second probe.
  try { array = Array.isArray(value); }
  catch (cause) { throw new SequenceClipError('SEQ_READ_FAILED', cause); }
  if (array) throw new SequenceClipError('SEQ_INPUT_INVALID');
  return value;
}

function admitFrames(value: unknown): unknown[] {
  let array: boolean;
  try { array = Array.isArray(value); }
  catch (cause) { throw new SequenceClipError('SEQ_READ_FAILED', cause); }
  if (!array) throw new SequenceClipError('SEQ_INPUT_INVALID');
  return value as unknown[];
}

function captureOwn(source: object, key: string): CapturedField {
  let present: boolean, value: unknown = undefined;
  try {
    present = Object.hasOwn(source, key);
    if (present) value = (source as Record<string, unknown>)[key];
  } catch (cause) {
    // Never classify caller throws by their name, class or code. This wrapper
    // preserves the actual occurrence and exact cause, including throw undefined.
    throw new SequenceClipError('SEQ_READ_FAILED', cause);
  }
  return { present, value };
}

function positiveSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}
function nonnegativeSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}
function nonnegativeFinite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}
function positiveZero(value: number): number { return value === 0 ? 0 : value; }

export function createSequenceClip(input: unknown): SequenceClip {
  const source = admitObject(input);
  // Capture all required own fields in order before interpreting their values.
  // Missing fields do not suppress a later source fault in this capture stage.
  const widthField = captureOwn(source, 'atlasWidth');
  const heightField = captureOwn(source, 'atlasHeight');
  const framesField = captureOwn(source, 'frames');
  const frames = admitFrames(framesField.value);
  const lengthField = captureOwn(frames, 'length');
  const length = lengthField.value;
  if (!framesField.present || !lengthField.present || !positiveSafeInteger(length)) throw new SequenceClipError('SEQ_INPUT_INVALID');
  if (length > MAX_FRAMES) throw new SequenceClipError('SEQ_BUDGET');
  const atlasWidth = widthField.value, atlasHeight = heightField.value;
  if (!widthField.present || !heightField.present || !positiveSafeInteger(atlasWidth) || !positiveSafeInteger(atlasHeight)) throw new SequenceClipError('SEQ_INPUT_INVALID');

  const regions: SequenceRegion[] = [], ends: number[] = [];
  let durationSeconds = 0;
  for (let index = 0; index < length; index++) {
    const entry = captureOwn(frames, String(index));
    if (!entry.present) throw new SequenceClipError('SEQ_INPUT_INVALID');
    const frame = admitObject(entry.value);
    const xField = captureOwn(frame, 'x');
    const yField = captureOwn(frame, 'y');
    const frameWidthField = captureOwn(frame, 'width');
    const frameHeightField = captureOwn(frame, 'height');
    const durationField = captureOwn(frame, 'durationSeconds');
    if (!xField.present || !yField.present || !frameWidthField.present || !frameHeightField.present || !durationField.present) throw new SequenceClipError('SEQ_INPUT_INVALID');

    const x = xField.value, y = yField.value, width = frameWidthField.value, height = frameHeightField.value;
    if (!nonnegativeSafeInteger(x) || !nonnegativeSafeInteger(y) || !positiveSafeInteger(width) || !positiveSafeInteger(height)) throw new SequenceClipError('SEQ_REGION_INVALID');
    const right = x + width, bottom = y + height;
    if (!Number.isSafeInteger(right) || !Number.isSafeInteger(bottom) || right > atlasWidth || bottom > atlasHeight) throw new SequenceClipError('SEQ_REGION_INVALID');
    const duration = durationField.value;
    if (typeof duration !== 'number' || !Number.isFinite(duration) || duration <= 0) throw new SequenceClipError('SEQ_TIME_INVALID');
    // Seconds stay binary64, including positive subnormals. Each input-order
    // increment must survive rounding; no integer-tick or float32 conversion.
    const end = durationSeconds + duration;
    if (!Number.isFinite(end) || end <= durationSeconds) throw new SequenceClipError('SEQ_TIME_INVALID');
    regions.push({ x: positiveZero(x), y: positiveZero(y), width, height });
    ends.push(end); durationSeconds = end;
  }
  for (const region of regions) Object.freeze(region);
  const owned: OwnedClip = Object.freeze({ regions: Object.freeze(regions), ends: Object.freeze(ends), durationSeconds });
  const clip: SequenceClip = Object.freeze({ atlasWidth, atlasHeight, frameCount: length, durationSeconds });
  // Publish identity only after all validation, owned allocation and freezing.
  clips.set(clip, owned);
  return clip;
}

export function sampleSequenceClip(
  clip: SequenceClip,
  elapsedSeconds: number,
  options: { readonly mode: 'once' | 'loop'; readonly stopAtSeconds?: number },
): SequenceSample {
  const owned = typeof clip === 'object' && clip !== null ? clips.get(clip) : undefined;
  if (!owned) throw new SequenceClipError('SEQ_CLIP_INVALID');
  if (!nonnegativeFinite(elapsedSeconds)) throw new SequenceClipError('SEQ_TIME_INVALID');
  const source = admitObject(options);
  const modeField = captureOwn(source, 'mode');
  const stopField = captureOwn(source, 'stopAtSeconds');
  const mode = modeField.value, stopAtSeconds = stopField.value;
  if (!modeField.present || (mode !== 'once' && mode !== 'loop')) throw new SequenceClipError('SEQ_INPUT_INVALID');
  const stopped = stopField.present && stopAtSeconds !== undefined;
  if (stopped && !nonnegativeFinite(stopAtSeconds)) throw new SequenceClipError('SEQ_TIME_INVALID');
  const time = stopped ? stopAtSeconds as number : elapsedSeconds;
  const atEnd = mode === 'once' && time >= owned.durationSeconds;
  const positionSeconds = positiveZero(mode === 'loop' ? time % owned.durationSeconds : atEnd ? owned.durationSeconds : time);
  let frameIndex = owned.ends.length - 1;
  if (!atEnd) {
    // Upper bound selects the first end strictly greater than the position.
    // With 1..1024 ends this takes at most 11 comparisons, independent of cycles.
    let low = 0, high = owned.ends.length;
    while (low < high) {
      const middle = low + Math.floor((high - low) / 2);
      if (positionSeconds < owned.ends[middle]!) high = middle;
      else low = middle + 1;
    }
    frameIndex = low;
  }
  return Object.freeze({ frameIndex, region: owned.regions[frameIndex]!, positionSeconds, atEnd, stopped });
}
