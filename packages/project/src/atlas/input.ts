// SPDX-License-Identifier: Apache-2.0
import {
  utf8Length
} from '../unicode.js';
import {
  isPortablePath
} from '../paths.js';
import type {
  AtlasImportDiagnosticCode,
  AtlasSourceSpan,
  AtlasProvenance,
  AtlasTextSource,
  AtlasPageBinding,
  AtlasImportLimits
} from './types.js';
export const ATLAS_IMPORT_LIMITS: Readonly<AtlasImportLimits> = Object.freeze({
  "maxSourceUtf8Bytes": 1048576,
  "maxJsonDepth": 16,
  "maxJsonNodes": 65536,
  "maxJsonProperties": 49152,
  "maxJsonKeyUtf8Bytes": 256,
  "maxJsonStringUtf8Bytes": 4096,
  "maxSourceIdUtf8Bytes": 256,
  "maxAssetIdUtf8Bytes": 256,
  "maxNameUtf8Bytes": 1024,
  "maxNameUtf16Units": 128,
  "maxTotalNameUtf16Units": 32768,
  "maxPageNameUtf8Bytes": 255,
  "maxFrames": 1024,
  "maxAtlasEdge": 4096,
  "maxAtlasPixels": 1048576,
  "maxSourceDimension": 65535,
  "maxDurationMilliseconds": 65535,
  "maxProvenanceFieldUtf8Bytes": 4096,
  "maxProvenanceTotalUtf8Bytes": 24576,
  "maxDiagnosticPointerUtf8Bytes": 2048
});
export interface PlanningContext {
  readonly fail: (code: AtlasImportDiagnosticCode, source: 'input' | 'metadata', pointer: string, span?: AtlasSourceSpan, relatedSpan?: AtlasSourceSpan) => never;
  readonly readFailure: (pointer: string, cause: unknown) => never;
}
export interface CapturedInput {
  readonly profile: string;
  readonly source: AtlasTextSource;
  readonly page: AtlasPageBinding;
}
type CapturedRecord = Record<string, unknown>;
function record(context: PlanningContext, value: unknown, required: readonly string[], optional: readonly string[], pointer: string): CapturedRecord {
  if (value === null || typeof value !== 'object') context.fail('ATLAS_INPUT_INVALID', 'input', pointer);
  let array: boolean;
  try {
    array = Array.isArray(value);
  } catch (cause) {
    context.readFailure(pointer, cause);
  }
  if (array!) context.fail('ATLAS_INPUT_INVALID', 'input', pointer);
  let prototype: unknown;
  try {
    prototype = Object.getPrototypeOf(value);
  } catch (cause) {
    context.readFailure(pointer, cause);
  }
  if (prototype !== null && prototype !== Object.prototype) context.fail('ATLAS_INPUT_INVALID', 'input', pointer);
  let keys: readonly PropertyKey[];
  try {
    keys = Reflect.ownKeys(value);
  } catch (cause) {
    context.readFailure(pointer, cause);
  }
  if (keys!.some(key => typeof key !== 'string' || !required.includes(key) && !optional.includes(key))) context.fail('ATLAS_INPUT_INVALID', 'input', pointer);
  for (const key of required) if (!keys!.includes(key)) context.fail('ATLAS_INPUT_INVALID', 'input', pointer+'/'+key);
  const out: CapturedRecord = Object.create(null) as CapturedRecord;
  for (const key of [...required, ...optional]) {
    if (!keys!.includes(key)) continue;
    let descriptor: PropertyDescriptor | undefined;
    try {
      descriptor = Object.getOwnPropertyDescriptor(value, key);
    } catch (cause) {
      context.readFailure(pointer+'/'+key, cause);
    }
    if (!descriptor || !descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) context.fail('ATLAS_INPUT_INVALID', 'input', pointer+'/'+key);
    out[key] = descriptor.value;
  }
  return out;
}
function text(context: PlanningContext, value: unknown, pointer: string, ceiling: number, nonempty = true): string {
  if (typeof value !== 'string' || nonempty && value.length === 0)context.fail('ATLAS_INPUT_INVALID', 'input', pointer);
  const bytes = utf8Length(value);
  if (!bytes.ok)context.fail('ATLAS_INPUT_INVALID', 'input', pointer);
  if (bytes.value>ceiling)context.fail('ATLAS_LIMIT_EXCEEDED', 'input', pointer);
  return value;
}
export function portablePng(value: string): boolean {
  return value.endsWith('.png') && value.length>4 && !value.includes('/') && isPortablePath(value);
}
export function captureInput(context: PlanningContext, value: unknown): CapturedInput {
  // Capture the complete bounded descriptor tree before validating primitives.
  const root = record(context, value, ['profile', 'source', 'page'], [], '');
  const source = record(context, root.source, ['id', 'text', 'provenance'], [], '/source');
  const sourceProvenance = record(context, source.provenance, ['origin', 'license', 'notice'], ['sha256'], '/source/provenance');
  const page = record(context, root.page, ['pageName', 'assetId', 'width', 'height', 'provenance'], [], '/page');
  const pageProvenance = record(context, page.provenance, ['origin', 'license', 'notice'], ['sha256'], '/page/provenance');
  if (typeof root.profile !== 'string' || !utf8Length(root.profile).ok)context.fail('ATLAS_INPUT_INVALID', 'input', '/profile');
  const id = text(context, source.id, '/source/id', ATLAS_IMPORT_LIMITS.maxSourceIdUtf8Bytes);
  if (typeof source.text !== 'string')context.fail('ATLAS_INPUT_INVALID', 'input', '/source/text');
  let total = 0;
  const provenance = (raw: CapturedRecord, pointer: string): AtlasProvenance => {
    const out: Record<string, string >= Object.create(null) as Record<string, string>;
    for (const key of ['origin', 'license', 'notice', 'sha256']) {
      if (!Object.hasOwn(raw, key))continue;
      const item = text(context, raw[key], pointer+'/'+key, ATLAS_IMPORT_LIMITS.maxProvenanceFieldUtf8Bytes);
      if (key === 'sha256' && !/^[0-9a-f]{64}$/u.test(item))context.fail('ATLAS_INPUT_INVALID', 'input', pointer+'/'+key);
      const bytes = utf8Length(item);
      if (!bytes.ok)context.fail('ATLAS_INPUT_INVALID', 'input', pointer+'/'+key);
      total+=bytes.value;
      if (total>ATLAS_IMPORT_LIMITS.maxProvenanceTotalUtf8Bytes)context.fail('ATLAS_LIMIT_EXCEEDED', 'input', pointer+'/'+key);
      out[key] = item;
    }
    return {
      origin: out.origin!,
      license: out.license!,
      notice: out.notice!,...(out.sha256 === undefined?{} : {
        sha256: out.sha256
      })
    };
  };
  const metadataProvenance = provenance(sourceProvenance, '/source/provenance');
  const pageName = text(context, page.pageName, '/page/pageName', ATLAS_IMPORT_LIMITS.maxPageNameUtf8Bytes, false);
  if (!portablePng(pageName))context.fail('ATLAS_PAGE_BINDING_INVALID', 'input', '/page/pageName');
  const assetId = text(context, page.assetId, '/page/assetId', ATLAS_IMPORT_LIMITS.maxAssetIdUtf8Bytes);
  for (const key of ['width', 'height']) {
    const n = page[key];
    if (typeof n !== 'number' || !Number.isSafeInteger(n) || n <= 0)context.fail('ATLAS_INPUT_INVALID', 'input', '/page/'+key);
    if (n>ATLAS_IMPORT_LIMITS.maxAtlasEdge)context.fail('ATLAS_LIMIT_EXCEEDED', 'input', '/page/'+key);
  }
  if ((page.width as number)*(page.height as number)>ATLAS_IMPORT_LIMITS.maxAtlasPixels)context.fail('ATLAS_LIMIT_EXCEEDED', 'input', '/page');
  const bindingProvenance = provenance(pageProvenance, '/page/provenance');
  return {
    profile: root.profile,
    source: {
      id,
      text: source.text,
      provenance: metadataProvenance
    },
    page: {
      pageName,
      assetId,
      width: page.width as number,
      height: page.height as number,
      provenance: bindingProvenance
    }
  };
}
