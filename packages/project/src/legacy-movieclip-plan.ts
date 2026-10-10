import { readLegacyResourceJSON } from './legacy-res-json.js';
import { utf8Length } from './unicode.js';
import { isPortablePath } from './paths.js';

/** Internal CPU conversion intent; never loads, decodes or certifies an atlas. */
export type LegacyMovieClipConversionStatus = 'planned' | 'invalid' | 'unsupported' | 'incomplete';
export type LegacyMovieClipDiagnosticCode =
  | 'LEGACY_MOVIECLIP_INPUT_INVALID' | 'LEGACY_MOVIECLIP_SYNTAX_INVALID'
  | 'LEGACY_MOVIECLIP_LIMIT_EXCEEDED' | 'LEGACY_MOVIECLIP_PATH_INVALID'
  | 'LEGACY_MOVIECLIP_CLIP_NOT_FOUND' | 'LEGACY_MOVIECLIP_REFERENCE_UNRESOLVED'
  | 'LEGACY_MOVIECLIP_RATE_INVALID' | 'LEGACY_MOVIECLIP_DURATION_INVALID'
  | 'LEGACY_MOVIECLIP_REGION_INVALID' | 'LEGACY_MOVIECLIP_TIME_INVALID'
  | 'LEGACY_MOVIECLIP_SCHEMA_UNSUPPORTED' | 'LEGACY_MOVIECLIP_FEATURE_UNSUPPORTED'
  | 'LEGACY_MOVIECLIP_INTERNAL_FAILED';
export interface LegacyMovieClipDiagnostic {
  readonly code: LegacyMovieClipDiagnosticCode;
  readonly source: 'text' | 'clipName' | 'atlasPath' | 'atlasWidth' | 'atlasHeight';
  readonly severity: 'error' | 'warning';
  readonly jsonPointer: string;
  readonly message: string;
}
export interface LegacyMovieClipSequenceFrame {
  readonly x: number; readonly y: number;
  readonly width: number; readonly height: number;
  readonly durationSeconds: number;
}
export interface LegacyMovieClipSequenceInput {
  readonly atlasWidth: number; readonly atlasHeight: number;
  readonly frames: readonly LegacyMovieClipSequenceFrame[];
}
export interface LegacyMovieClipHold {
  readonly resourceName: string;
  readonly offsetX: number; readonly offsetY: number;
  readonly firstLegacyFrame: number; readonly durationFrames: number;
}
export interface LegacyMovieClipConversionPlan {
  readonly clipName: string; readonly atlasPath: string;
  readonly totalLegacyFrames: number;
  readonly sequenceInput: LegacyMovieClipSequenceInput;
  readonly holds: readonly LegacyMovieClipHold[];
}
export interface LegacyMovieClipConversionResult {
  readonly planVersion: '0.1';
  readonly profile: 'legacy-movieclip-single-atlas-0.1';
  readonly status: LegacyMovieClipConversionStatus;
  readonly diagnostics: readonly LegacyMovieClipDiagnostic[];
  readonly acceptance: {
    readonly fileExistence: 'unverified'; readonly decoding: 'unverified';
    readonly execution: 'unverified'; readonly migration: 'unverified';
  };
  readonly plan: LegacyMovieClipConversionPlan | null;
}

type DiagnosticSource = LegacyMovieClipDiagnostic['source'];
type RefusalStatus = Exclude<LegacyMovieClipConversionStatus, 'planned'>;
interface OwnField { readonly present: boolean; readonly value: unknown; }
interface Crop {
  readonly record: Record<string, unknown>;
  readonly x: number; readonly y: number; readonly width: number; readonly height: number;
}
interface ValidatedHold {
  readonly record: Record<string, unknown>;
  readonly resourceName: string | undefined; readonly crop: Crop | undefined;
  readonly offsetX: number; readonly offsetY: number;
  readonly firstLegacyFrame: number; readonly durationFrames: number; readonly seconds: number;
}

function own(record: Record<string, unknown>, key: string): OwnField {
  const present = Object.hasOwn(record, key);
  return { present, value: present ? record[key] : undefined };
}
function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function positiveSafe(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}
function nonnegativeSafe(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}
function signedOffset(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= -2147483648 && value <= 2147483647;
}
function positiveZero(value: number): number { return value === 0 ? 0 : value; }
function pointerPart(value: string): string { return value.replaceAll('~', '~0').replaceAll('/', '~1'); }
function firstUnknown(source: Record<string, unknown>, allowed: readonly string[], prefix: string): string | undefined {
  const key = Object.keys(source).filter(key => !allowed.includes(key)).sort()[0];
  return key === undefined ? undefined : prefix + '/' + pointerPart(key);
}
function diagnostic(code: LegacyMovieClipDiagnosticCode, jsonPointer: string, source: DiagnosticSource, status: RefusalStatus): LegacyMovieClipDiagnostic {
  return Object.freeze({ code, source, severity: status === 'unsupported' ? 'warning' : 'error', jsonPointer,
    message: code === 'LEGACY_MOVIECLIP_INTERNAL_FAILED' ? 'MovieClip conversion failed internally.'
      : status === 'unsupported' ? 'Declaration is outside this MovieClip profile.'
      : 'MovieClip declaration input is invalid or exceeds this profile.' });
}
function publish(status: LegacyMovieClipConversionStatus, diagnostics: LegacyMovieClipDiagnostic[], plan: LegacyMovieClipConversionPlan | null): LegacyMovieClipConversionResult {
  // Every refusal owns fresh containers too. This assumes allocation succeeds;
  // it is not a general guarantee of recovery from an out-of-memory condition.
  return Object.freeze({ planVersion: '0.1', profile: 'legacy-movieclip-single-atlas-0.1', status,
    diagnostics: Object.freeze(diagnostics), acceptance: Object.freeze({ fileExistence: 'unverified', decoding: 'unverified',
      execution: 'unverified', migration: 'unverified' }), plan });
}

/** Plan one named clip using declared atlas dimensions, without input execution. */
export function planLegacyMovieClipConversion(
  text: unknown, clipName: unknown, atlasPath: unknown,
  atlasWidth: unknown, atlasHeight: unknown,
): LegacyMovieClipConversionResult {
  // Only this per-call identity authenticates deliberate refusals. Foreign
  // throws are never classified by reading their code/name or coercing them.
  const sentinel = {};
  let refusal: { readonly status: RefusalStatus; readonly diagnostic: LegacyMovieClipDiagnostic } | undefined;
  function reject(code: LegacyMovieClipDiagnosticCode, at = '', source: DiagnosticSource = 'text', status: RefusalStatus = 'invalid'): never {
    refusal = { status, diagnostic: diagnostic(code, at, source, status) };
    throw sentinel;
  }
  try {
    // All primitive gates precede parsing, Unicode scans and semantic checks.
    if (typeof text !== 'string') reject('LEGACY_MOVIECLIP_INPUT_INVALID', '', 'text');
    if (typeof clipName !== 'string') reject('LEGACY_MOVIECLIP_INPUT_INVALID', '', 'clipName');
    if (typeof atlasPath !== 'string') reject('LEGACY_MOVIECLIP_INPUT_INVALID', '', 'atlasPath');
    if (typeof atlasWidth !== 'number') reject('LEGACY_MOVIECLIP_INPUT_INVALID', '', 'atlasWidth');
    if (typeof atlasHeight !== 'number') reject('LEGACY_MOVIECLIP_INPUT_INVALID', '', 'atlasHeight');
    const parsed = readLegacyResourceJSON(text);
    if (parsed.status !== 'ok') {
      // These four codes belong to the actual internally invoked producer;
      // caller reports and unknown producer states never acquire authority.
      if (parsed.status === 'invalid') {
        switch (parsed.diagnostic.code) {
          case 'LEGACY_RES_INPUT_INVALID': reject('LEGACY_MOVIECLIP_INPUT_INVALID', parsed.diagnostic.jsonPointer);
          case 'LEGACY_RES_SYNTAX_INVALID': reject('LEGACY_MOVIECLIP_SYNTAX_INVALID', parsed.diagnostic.jsonPointer);
          case 'LEGACY_RES_LIMIT_EXCEEDED': reject('LEGACY_MOVIECLIP_LIMIT_EXCEEDED', parsed.diagnostic.jsonPointer);
        }
      }
      if (parsed.status === 'incomplete' && parsed.diagnostic.code === 'LEGACY_RES_INTERNAL_FAILED') reject('LEGACY_MOVIECLIP_INTERNAL_FAILED', '', 'text', 'incomplete');
      reject('LEGACY_MOVIECLIP_INTERNAL_FAILED', '', 'text', 'incomplete');
    }
    const nameBytes = utf8Length(clipName);
    if (clipName === '' || !nameBytes.ok) reject('LEGACY_MOVIECLIP_INPUT_INVALID', '', 'clipName');
    if (nameBytes.value > 256) reject('LEGACY_MOVIECLIP_LIMIT_EXCEEDED', '', 'clipName');
    const pathBytes = utf8Length(atlasPath);
    if (!pathBytes.ok) reject('LEGACY_MOVIECLIP_INPUT_INVALID', '', 'atlasPath');
    if (pathBytes.value > 1024) reject('LEGACY_MOVIECLIP_LIMIT_EXCEEDED', '', 'atlasPath');
    if (!isPortablePath(atlasPath) || /[?#%]/u.test(atlasPath)) reject('LEGACY_MOVIECLIP_PATH_INVALID', '', 'atlasPath');
    if (!positiveSafe(atlasWidth)) reject('LEGACY_MOVIECLIP_INPUT_INVALID', '', 'atlasWidth');
    if (!positiveSafe(atlasHeight)) reject('LEGACY_MOVIECLIP_INPUT_INVALID', '', 'atlasHeight');

    const root = parsed.value;
    if (!record(root)) reject('LEGACY_MOVIECLIP_INPUT_INVALID');
    const mc = own(root, 'mc').value;
    if (!record(mc)) reject('LEGACY_MOVIECLIP_INPUT_INVALID', '/mc');
    const res = own(root, 'res').value;
    if (!record(res)) reject('LEGACY_MOVIECLIP_INPUT_INVALID', '/res');
    if (Object.keys(mc).length > 64) reject('LEGACY_MOVIECLIP_LIMIT_EXCEEDED', '/mc');
    if (Object.keys(res).length > 4096) reject('LEGACY_MOVIECLIP_LIMIT_EXCEEDED', '/res');
    const clipPointer = '/mc/' + pointerPart(clipName);
    const clipField = own(mc, clipName);
    if (!clipField.present) reject('LEGACY_MOVIECLIP_CLIP_NOT_FOUND', clipPointer);
    const clip = clipField.value;
    if (!record(clip)) reject('LEGACY_MOVIECLIP_INPUT_INVALID', clipPointer);
    const framesField = own(clip, 'frames'), framesPointer = clipPointer + '/frames';
    if (!framesField.present || !Array.isArray(framesField.value) || framesField.value.length === 0) reject('LEGACY_MOVIECLIP_INPUT_INVALID', framesPointer);
    const frames = framesField.value;
    if (frames.length > 1024) reject('LEGACY_MOVIECLIP_LIMIT_EXCEEDED', framesPointer);

    const rateField = own(clip, 'frameRate'), labelsField = own(clip, 'labels'), eventsField = own(clip, 'events');
    const rate = rateField.present ? rateField.value : 24;
    if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) reject('LEGACY_MOVIECLIP_RATE_INVALID', clipPointer + '/frameRate');
    for (const [field, name] of [[labelsField, 'labels'], [eventsField, 'events']] as const) {
      if (field.present && field.value !== null && !Array.isArray(field.value)) reject('LEGACY_MOVIECLIP_INPUT_INVALID', clipPointer + '/' + name);
    }

    // Validation scratch is bounded by authored frames and can refer to the
    // private JSON graph. No published frame/hold is built until all invalid
    // values and deferred unsupported declarations have been considered.
    const validated: ValidatedHold[] = [], regions = new Map<string, Crop>();
    let totalTicks = 0, end = 0, firstBlank: string | undefined;
    for (let index = 0; index < frames.length; index++) {
      const framePointer = framesPointer + '/' + index;
      const frame = frames[index];
      if (!Object.hasOwn(frames, index) || !record(frame)) reject('LEGACY_MOVIECLIP_INPUT_INVALID', framePointer);
      const resource = own(frame, 'res');
      let resourceName: string | undefined;
      if (resource.present && typeof resource.value !== 'string') reject('LEGACY_MOVIECLIP_INPUT_INVALID', framePointer + '/res');
      if (resource.present && resource.value !== '') {
        resourceName = resource.value as string;
        const bytes = utf8Length(resourceName);
        if (!bytes.ok) reject('LEGACY_MOVIECLIP_INPUT_INVALID', framePointer + '/res');
        if (bytes.value > 256) reject('LEGACY_MOVIECLIP_LIMIT_EXCEEDED', framePointer + '/res');
      } else firstBlank ??= framePointer + '/res';
      const xField = own(frame, 'x'), yField = own(frame, 'y'), durationField = own(frame, 'duration');
      const offsetX = xField.present ? xField.value : 0, offsetY = yField.present ? yField.value : 0;
      if (!signedOffset(offsetX)) reject('LEGACY_MOVIECLIP_INPUT_INVALID', framePointer + '/x');
      if (!signedOffset(offsetY)) reject('LEGACY_MOVIECLIP_INPUT_INVALID', framePointer + '/y');
      const ticks = durationField.present ? durationField.value : 1;
      if (!positiveSafe(ticks)) reject('LEGACY_MOVIECLIP_DURATION_INVALID', framePointer + '/duration');
      let crop: Crop | undefined;
      if (resourceName !== undefined) {
        crop = regions.get(resourceName);
        if (crop === undefined) {
          const regionField = own(res, resourceName), regionPointer = '/res/' + pointerPart(resourceName);
          if (!regionField.present) reject('LEGACY_MOVIECLIP_REFERENCE_UNRESOLVED', framePointer + '/res');
          const region = regionField.value;
          if (!record(region)) reject('LEGACY_MOVIECLIP_REGION_INVALID', regionPointer);
          const regionX = own(region, 'x'), regionY = own(region, 'y'), regionW = own(region, 'w'), regionH = own(region, 'h');
          if (!regionX.present || !nonnegativeSafe(regionX.value)) reject('LEGACY_MOVIECLIP_REGION_INVALID', regionPointer + '/x');
          if (!regionY.present || !nonnegativeSafe(regionY.value)) reject('LEGACY_MOVIECLIP_REGION_INVALID', regionPointer + '/y');
          if (!regionW.present || !positiveSafe(regionW.value)) reject('LEGACY_MOVIECLIP_REGION_INVALID', regionPointer + '/w');
          if (!regionH.present || !positiveSafe(regionH.value)) reject('LEGACY_MOVIECLIP_REGION_INVALID', regionPointer + '/h');
          const right = regionX.value + regionW.value, bottom = regionY.value + regionH.value;
          if (!Number.isSafeInteger(right) || right > atlasWidth) reject('LEGACY_MOVIECLIP_REGION_INVALID', regionPointer + '/w');
          if (!Number.isSafeInteger(bottom) || bottom > atlasHeight) reject('LEGACY_MOVIECLIP_REGION_INVALID', regionPointer + '/h');
          crop = { record: region, x: positiveZero(regionX.value), y: positiveZero(regionY.value), width: regionW.value, height: regionH.value };
          regions.set(resourceName, crop);
        }
      }
      const firstLegacyFrame = totalTicks + 1, nextTicks = totalTicks + ticks;
      if (!Number.isSafeInteger(nextTicks) || nextTicks > 1048576) reject('LEGACY_MOVIECLIP_LIMIT_EXCEEDED', framePointer + '/duration');
      // Divide once per authored hold and retain binary64, including positive
      // subnormals. Compressed holds intentionally differ from repeat expansion.
      const seconds = ticks / rate, nextEnd = end + seconds;
      if (!Number.isFinite(seconds) || seconds <= 0 || !Number.isFinite(nextEnd) || nextEnd <= end) reject('LEGACY_MOVIECLIP_TIME_INVALID', framePointer + '/duration');
      validated.push({ record: frame, resourceName, crop, offsetX: positiveZero(offsetX), offsetY: positiveZero(offsetY),
        firstLegacyFrame, durationFrames: ticks, seconds });
      totalTicks = nextTicks; end = nextEnd;
    }

    // Unknown-field refusal is deliberately deferred: an invalid late region
    // wins over an earlier unknown field, blank frame or nonempty event list.
    const unknownRoot = firstUnknown(root, ['mc', 'res'], '');
    if (unknownRoot !== undefined) reject('LEGACY_MOVIECLIP_SCHEMA_UNSUPPORTED', unknownRoot, 'text', 'unsupported');
    const unknownClip = firstUnknown(clip, ['frames', 'frameRate', 'labels', 'events'], clipPointer);
    if (unknownClip !== undefined) reject('LEGACY_MOVIECLIP_SCHEMA_UNSUPPORTED', unknownClip, 'text', 'unsupported');
    for (let index = 0; index < validated.length; index++) {
      const unknown = firstUnknown(validated[index]!.record, ['res', 'x', 'y', 'duration'], framesPointer + '/' + index);
      if (unknown !== undefined) reject('LEGACY_MOVIECLIP_SCHEMA_UNSUPPORTED', unknown, 'text', 'unsupported');
    }
    for (const [name, crop] of regions) {
      const unknown = firstUnknown(crop.record, ['x', 'y', 'w', 'h'], '/res/' + pointerPart(name));
      if (unknown !== undefined) reject('LEGACY_MOVIECLIP_SCHEMA_UNSUPPORTED', unknown, 'text', 'unsupported');
    }
    if (firstBlank !== undefined) reject('LEGACY_MOVIECLIP_FEATURE_UNSUPPORTED', firstBlank, 'text', 'unsupported');
    for (const [field, name] of [[labelsField, 'labels'], [eventsField, 'events']] as const) {
      if (Array.isArray(field.value) && field.value.length > 0) reject('LEGACY_MOVIECLIP_FEATURE_UNSUPPORTED', clipPointer + '/' + name, 'text', 'unsupported');
    }

    // Copy only admitted scalars. No parsed record, cache, resource object or
    // runtime-private identity escapes; a later real factory must re-admit it.
    const sequenceFrames: LegacyMovieClipSequenceFrame[] = [], holds: LegacyMovieClipHold[] = [];
    for (const input of validated) {
      const crop = input.crop!;
      sequenceFrames.push(Object.freeze({ x: crop.x, y: crop.y, width: crop.width, height: crop.height, durationSeconds: input.seconds }));
      holds.push(Object.freeze({ resourceName: input.resourceName!, offsetX: input.offsetX, offsetY: input.offsetY,
        firstLegacyFrame: input.firstLegacyFrame, durationFrames: input.durationFrames }));
    }
    const sequenceInput = Object.freeze({ atlasWidth, atlasHeight, frames: Object.freeze(sequenceFrames) });
    const plan = Object.freeze({ clipName, atlasPath, totalLegacyFrames: totalTicks, sequenceInput, holds: Object.freeze(holds) });
    return publish('planned', [], plan);
  } catch (cause) {
    if (cause === sentinel && refusal !== undefined) return publish(refusal.status, [refusal.diagnostic], null);
    return publish('incomplete', [diagnostic('LEGACY_MOVIECLIP_INTERNAL_FAILED', '', 'text', 'incomplete')], null);
  }
}
