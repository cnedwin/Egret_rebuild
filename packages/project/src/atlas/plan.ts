// SPDX-License-Identifier: Apache-2.0
import {
  captureInput,
  portablePng,
  ATLAS_IMPORT_LIMITS as limits
} from './input.js';
import type {
  CapturedInput
} from './input.js';
import {
  readMetadata
} from './json.js';
import type {
  JsonNode,
  JsonProperty
} from './json.js';
import {
  utf8Length
} from '../unicode.js';
import type {
  PlanningContext
} from './input.js';
import type {
  AtlasImportDiagnostic,
  AtlasImportDiagnosticCode,
  AtlasImportResult,
  AtlasImportPlan,
  AtlasSpriteSheetFrame,
  AtlasSequenceFrame,
  AtlasFrameOrigin,
  AtlasSourceSpan
} from './types.js';
const messages: Record<AtlasImportDiagnosticCode, string> = {
  "ATLAS_INPUT_INVALID": "Input must use the supported data descriptors.",
  "ATLAS_READ_FAILED": "Reading an input descriptor failed.",
  "ATLAS_LIMIT_EXCEEDED": "Input exceeds an atlas planning limit.",
  "ATLAS_JSON_SYNTAX": "Metadata must be strict finite Unicode JSON.",
  "ATLAS_JSON_DUPLICATE_KEY": "Metadata contains a duplicate decoded key.",
  "ATLAS_SCHEMA_INVALID": "Metadata does not have the selected schema.",
  "ATLAS_MARKER_MISSING": "A required exporter marker is missing.",
  "ATLAS_MARKER_INVALID": "An exporter marker has the wrong primitive type.",
  "ATLAS_PROFILE_UNSUPPORTED": "Metadata is outside the selected atlas profile.",
  "ATLAS_PAGE_BINDING_INVALID": "Metadata needs one exact declared PNG binding.",
  "ATLAS_NAME_INVALID": "Frame names must be nonempty and unique.",
  "ATLAS_REGION_INVALID": "Frame geometry is invalid.",
  "ATLAS_TIME_INVALID": "Frame durations must form a positive finite sequence."
};
export function createAtlasImportPlan(input: unknown): AtlasImportResult {
  const sentinel = {};
  let failure: AtlasImportDiagnostic|undefined;
  const context: PlanningContext = {
    fail(code, source, pointer, span, relatedSpan) {
      failure = Object.freeze({
        code,
        severity: 'error',
        source,
        pointer,
        message: messages[code],...(span === undefined?{} : {
          span
        }),...(relatedSpan === undefined?{} : {
          relatedSpan
        })
      });
      throw sentinel;
    },
    readFailure(pointer, cause) {
      failure = Object.freeze({
        code: 'ATLAS_READ_FAILED',
        severity: 'error',
        source: 'input',
        pointer,
        message: messages.ATLAS_READ_FAILED,
        cause
      });
      throw sentinel;
    }
  };
  try {
    const captured = captureInput(context, input);
    const parsed = readMetadata(context, captured.source);
    const value = translate(context, captured, parsed.root, parsed.utf8Bytes);
    return freezeOwned({
      ok: true,
      value,
      diagnostics: [] as const
    });
  } catch (cause) {
    if (cause !== sentinel)throw cause;
    return Object.freeze({
      ok: false,
      diagnostics: Object.freeze([failure!] as const)
    });
  }
}
function freezeOwned<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    for (const child of Object.values(value))freezeOwned(child);
    Object.freeze(value);
  }
  return value;
}
function translate(context: PlanningContext, input: CapturedInput, root: JsonNode, utf8Bytes: number): AtlasImportPlan {
  const fail: (code: AtlasImportDiagnosticCode, node: JsonNode) => never = (code, node) => context.fail(code, 'metadata', node.pointer, node.span);
  const object = (node: JsonNode): JsonNode => {
    if (node.kind !== 'object')fail('ATLAS_SCHEMA_INVALID', node);
    return node;
  };
  const get = (node: JsonNode, key: string): JsonProperty|undefined => node.properties?.find(item => item.key === key);
  const required = (node: JsonNode, key: string, code: AtlasImportDiagnosticCode = 'ATLAS_SCHEMA_INVALID'): JsonNode => {
    const property = get(node, key);
    if (!property)context.fail(code, 'metadata', node.pointer+'/'+key, node.span);
    return property.node!;
  };
  const scalarString = (node: JsonNode, code: AtlasImportDiagnosticCode): string => {
    if (node.kind !== 'literal' || typeof node.value !== 'string')fail(code, node);
    return node.value as string;
  };
  let firstConcern: {
    offset: number;
    pointer: string;
    span: AtlasSourceSpan
  }
  |undefined;
  const concern = (property: JsonProperty, node?: JsonNode): void => {
    if (!firstConcern || property.span.offset<firstConcern.offset)firstConcern = {
      offset: property.span.offset,
      pointer: property.pointer,
      span: node?.span ?? property.span
    };
  };
  const allowed = (node: JsonNode, keys: readonly string[]): void => {
    for (const property of node.properties!)if (!keys.includes(property.key))concern(property);
  };
  const integer = (node: JsonNode, positive: boolean, ceiling: number, code: AtlasImportDiagnosticCode): number => {
    const n = node.value;
    if (node.kind !== 'literal' || typeof n !== 'number' || !Number.isSafeInteger(n) || (positive?n <= 0: n<0))fail(code, node);
    if ((n as number)>ceiling)fail('ATLAS_LIMIT_EXCEEDED', node);
    return (n as number) === 0?0: n as number;
  };
  object(root);
  const frames = required(root, 'frames'),
  meta = object(required(root, 'meta'));
  if (frames.kind !== 'array' && frames.kind !== 'object')fail('ATLAS_SCHEMA_INVALID', frames);
  if (input.profile !== 'aseprite-json-array-1.3.18.6-v1')context.fail('ATLAS_PROFILE_UNSUPPORTED', 'input', '/profile');
  for (const [key, values] of [['app', ['http://www.aseprite.org/', 'https://www.aseprite.org/']], ['version', ['1.3.18.6']], ['format', ['RGBA8888']], ['scale', ['1']]] as const) {
    const node = required(meta, key, 'ATLAS_MARKER_MISSING'),
    value = scalarString(node, 'ATLAS_MARKER_INVALID');
    if (!(values as readonly string[]).includes(value))fail('ATLAS_PROFILE_UNSUPPORTED', node);
  }
  if (frames.kind === 'object')fail('ATLAS_PROFILE_UNSUPPORTED', frames);
  allowed(root, ['frames', 'meta']);
  allowed(meta, ['app', 'version', 'image', 'format', 'size', 'scale', 'frameTags', 'layers', 'slices']);
  const imageNode = required(meta, 'image'),
  image = scalarString(imageNode, 'ATLAS_SCHEMA_INVALID');
  const imageBytes = utf8Length(image);
  if (!imageBytes.ok)fail('ATLAS_JSON_SYNTAX', imageNode);
  if (imageBytes.value>limits.maxPageNameUtf8Bytes)fail('ATLAS_LIMIT_EXCEEDED', imageNode);
  if (!portablePng(image) || image !== input.page.pageName)fail('ATLAS_PAGE_BINDING_INVALID', imageNode);
  const size = object(required(meta, 'size'));
  allowed(size, ['w', 'h']);
  const widthNode = required(size, 'w'),
  heightNode = required(size, 'h');
  const width = integer(widthNode, true, limits.maxAtlasEdge, 'ATLAS_REGION_INVALID'),
  height = integer(heightNode, true, limits.maxAtlasEdge, 'ATLAS_REGION_INVALID');
  if (width*height>limits.maxAtlasPixels)fail('ATLAS_LIMIT_EXCEEDED', size);
  if (width !== input.page.width)fail('ATLAS_PAGE_BINDING_INVALID', widthNode);
  if (height !== input.page.height)fail('ATLAS_PAGE_BINDING_INVALID', heightNode);
  for (const key of ['frameTags', 'layers', 'slices']) {
    const property = get(meta, key);
    if (property) {
      const node = property.node!;
      if (node.kind !== 'array')fail('ATLAS_SCHEMA_INVALID', node);
      if (node.elements!.length)concern(property, node);
    }
  }
  if (frames.elements!.length === 0)fail('ATLAS_SCHEMA_INVALID', frames);
  if (frames.elements!.length>limits.maxFrames)fail('ATLAS_LIMIT_EXCEEDED', frames);
  const names: string[] = [],
  spriteSheetFrames: AtlasSpriteSheetFrame[] = [],
  sequenceFrames: AtlasSequenceFrame[] = [],
  origins: AtlasFrameOrigin[] = [];
  const seen = new Map<string,
  AtlasSourceSpan>();
  let totalSeconds = 0,
  totalNameUnits = 0;
  let firstSource: {
    w: number;
    h: number
  }
  |undefined;
  for (const [index, node] of frames.elements!.entries()) {
    object(node);
    allowed(node, ['filename', 'frame', 'rotated', 'trimmed', 'spriteSourceSize', 'sourceSize', 'duration']);
    const nameNode = required(node, 'filename'),
    name = scalarString(nameNode, 'ATLAS_NAME_INVALID'),
    nameBytes = utf8Length(name);
    if (!nameBytes.ok)fail('ATLAS_JSON_SYNTAX', nameNode);
    if (name.length>limits.maxNameUtf16Units || nameBytes.value>limits.maxNameUtf8Bytes)fail('ATLAS_LIMIT_EXCEEDED', nameNode);
    totalNameUnits+=name.length;
    if (totalNameUnits>limits.maxTotalNameUtf16Units)fail('ATLAS_LIMIT_EXCEEDED', nameNode);
    if (name.length === 0)fail('ATLAS_NAME_INVALID', nameNode);
    const earlier = seen.get(name);
    if (earlier)context.fail('ATLAS_NAME_INVALID', 'metadata', nameNode.pointer, nameNode.span, earlier);
    seen.set(name, nameNode.span);
    names.push(name);
    const frame = object(required(node, 'frame')),
    source = object(required(node, 'sourceSize')),
    trim = object(required(node, 'spriteSourceSize'));
    allowed(frame, ['x', 'y', 'w', 'h']);
    allowed(source, ['w', 'h']);
    allowed(trim, ['x', 'y', 'w', 'h']);
    const xNode = required(frame, 'x'),
    yNode = required(frame, 'y'),
    wNode = required(frame, 'w'),
    hNode = required(frame, 'h');
    const x = integer(xNode, false, Number.MAX_SAFE_INTEGER, 'ATLAS_REGION_INVALID'),
    y = integer(yNode, false, Number.MAX_SAFE_INTEGER, 'ATLAS_REGION_INVALID'),
    w = integer(wNode, true, Number.MAX_SAFE_INTEGER, 'ATLAS_REGION_INVALID'),
    h = integer(hNode, true, Number.MAX_SAFE_INTEGER, 'ATLAS_REGION_INVALID');
    if (!Number.isSafeInteger(x+w) || x+w>width)fail('ATLAS_REGION_INVALID', frame);
    if (!Number.isSafeInteger(y+h) || y+h>height)fail('ATLAS_REGION_INVALID', frame);
    const sw = integer(required(source, 'w'), true, limits.maxSourceDimension, 'ATLAS_REGION_INVALID'),
    sh = integer(required(source, 'h'), true, limits.maxSourceDimension, 'ATLAS_REGION_INVALID');
    const tx = integer(required(trim, 'x'), false, Number.MAX_SAFE_INTEGER, 'ATLAS_REGION_INVALID'),
    ty = integer(required(trim, 'y'), false, Number.MAX_SAFE_INTEGER, 'ATLAS_REGION_INVALID'),
    tw = integer(required(trim, 'w'), true, Number.MAX_SAFE_INTEGER, 'ATLAS_REGION_INVALID'),
    th = integer(required(trim, 'h'), true, Number.MAX_SAFE_INTEGER, 'ATLAS_REGION_INVALID');
    if (!Number.isSafeInteger(tx+tw) || tx+tw>sw || !Number.isSafeInteger(ty+th) || ty+th>sh)fail('ATLAS_REGION_INVALID', trim);
    const rotation = required(node, 'rotated'),
    trimmed = required(node, 'trimmed');
    if (rotation.kind !== 'literal' || typeof rotation.value !== 'boolean')fail('ATLAS_SCHEMA_INVALID', rotation);
    if (trimmed.kind !== 'literal' || typeof trimmed.value !== 'boolean')fail('ATLAS_SCHEMA_INVALID', trimmed);
    if (rotation.value === true)concern(get(node, 'rotated')!, rotation); else if (tw !== w || th !== h)fail('ATLAS_REGION_INVALID', trim);
    if (trimmed.value === false && (tx !== 0 || ty !== 0 || tw !== sw || th !== sh))fail('ATLAS_REGION_INVALID', trim);
    if (firstSource && (firstSource.w !== sw || firstSource.h !== sh))concern(get(node, 'sourceSize')!, source);
    firstSource ??= {
      w: sw,
      h: sh
    };
    const durationNode = required(node, 'duration'),
    milliseconds = integer(durationNode, true, limits.maxDurationMilliseconds, 'ATLAS_TIME_INVALID'),
    seconds = milliseconds/1000,
    next = totalSeconds+seconds;
    if (!Number.isFinite(next) || next <= totalSeconds)fail('ATLAS_TIME_INVALID', durationNode);
    totalSeconds = next;
    // Branches and every layout own separate objects, including equal crops.
    spriteSheetFrames.push({
      name,
      x,
      y,
      width: w,
      height: h,
      layout: {
        sourceWidth: sw,
        sourceHeight: sh,
        trimX: tx,
        trimY: ty,
        packedRotation: 0
      }
    });
    sequenceFrames.push({
      x,
      y,
      width: w,
      height: h,
      durationSeconds: seconds,
      layout: {
        sourceWidth: sw,
        sourceHeight: sh,
        trimX: tx,
        trimY: ty,
        packedRotation: 0
      }
    });
    origins.push({
      index,
      pointer: node.pointer,
      name: {...nameNode.span
      },
      frame: {...frame.span
      },
      sourceSize: {...source.span
      },
      spriteSourceSize: {...trim.span
      },
      duration: {...durationNode.span
      }
    });
  }
  if (firstConcern)context.fail('ATLAS_PROFILE_UNSUPPORTED', 'metadata', firstConcern.pointer, firstConcern.span);
  return {
    planVersion: 1,
    profile: 'aseprite-json-array-1.3.18.6-v1',
    exportVersion: '1.3.18.6',
    sourceDeclarations: {
      metadata: {
        id: input.source.id,
        provenance: {...input.source.provenance
        },
        utf8Bytes,
        hashVerification: 'declared_unverified'
      }
    },
    page: {...input.page,
      provenance: {...input.page.provenance
      }
    },
    names,
    spriteSheetFrames,
    sequenceInput: {
      atlasWidth: width,
      atlasHeight: height,
      frames: sequenceFrames
    },
    origins,
    acceptance: {
      exporterArtifact: 'unverified',
      assetPixels: 'not_run',
      runtimeComposition: 'not_run',
      rendering: 'not_run',
      licenseEntitlement: 'unverified'
    }
  };
}
