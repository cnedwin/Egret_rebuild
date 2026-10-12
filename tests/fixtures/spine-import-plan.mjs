// SPDX-License-Identifier: Apache-2.0
// Original programmatic Egret planning fixtures. These are not Spine Editor
// exports and contain no upstream runtime implementation, images or assets.
// Every outcome below is a prospective specification oracle: NOT_RUN.

export const FIXTURE_STATUS = 'NOT_RUN';

export const EXPECTED_RUNTIME_EXPORTS = Object.freeze([
  'SPINE_IMPORT_LIMITS', 'createSpineImportPlan'
]);

export const EXPECTED_TYPE_EXPORTS = Object.freeze([
  'SpineImportInput', 'SpineTextSource', 'SpinePageBinding', 'SpineProvenance',
  'SpineImportPlan', 'SpineImportResult', 'SpineImportDiagnostic',
  'SpineImportDiagnosticCode', 'SpineSourceSpan', 'SpinePagePlan', 'SpineRegionPlan'
]);

// These literal numbers are selected by the specification, not read from the
// candidate implementation. Limits are inclusive and cannot be overridden.
export const EXPECTED_LIMITS = Object.freeze({
  maxSkeletonUtf8Bytes: 8388608,
  maxAtlasUtf8Bytes: 1048576,
  maxJsonDepth: 32,
  maxJsonNodes: 262144,
  maxJsonProperties: 131072,
  maxJsonStringUtf8Bytes: 65536,
  maxJsonKeyUtf8Bytes: 1024,
  maxSourceIdUtf8Bytes: 256,
  maxAssetIdUtf8Bytes: 256,
  maxNameUtf8Bytes: 1024,
  maxPagePathUtf8Bytes: 1024,
  maxProvenanceFieldUtf8Bytes: 4096,
  maxProvenanceTotalUtf8Bytes: 262144,
  maxAtlasPages: 64,
  maxAtlasRegions: 8192,
  maxAtlasFieldsPerSection: 32,
  maxAtlasLineUtf8Bytes: 4096,
  maxAtlasPageDimension: 16384,
  maxAtlasRegionCoordinate: 16384,
  maxAtlasPackedDimension: 16384,
  maxAtlasOffset: 16384,
  maxAtlasOriginalDimension: 16384,
  maxAtlasIndex: 2147483647,
  maxNamesPerCollection: 4096,
  maxObservations: 4096,
  maxSuccessDiagnostics: 16,
  maxDiagnosticPointerUtf8Bytes: 2048,
  maxObservationValueUtf8Bytes: 4096
});

export const DIAGNOSTIC_CODES = Object.freeze([
  'SPINE_INPUT_INVALID', 'SPINE_LIMIT_EXCEEDED', 'SPINE_JSON_SYNTAX',
  'SPINE_JSON_DUPLICATE_KEY', 'SPINE_JSON_SCHEMA', 'SPINE_VERSION_INVALID',
  'SPINE_VERSION_PRERELEASE', 'SPINE_VERSION_MISMATCH', 'SPINE_ATLAS_SYNTAX',
  'SPINE_ATLAS_PROFILE_UNSUPPORTED', 'SPINE_ATLAS_DUPLICATE',
  'SPINE_PAGE_BINDING_INVALID', 'SPINE_PROFILE_UNSUPPORTED',
  'SPINE_INVENTORY_PARTIAL', 'SPINE_PROVENANCE_UNVERIFIED'
]);

export const FORMATS = Object.freeze([
  'Alpha', 'Intensity', 'LuminanceAlpha', 'RGB565', 'RGBA4444', 'RGB888', 'RGBA8888'
]);
export const FILTERS = Object.freeze([
  'Nearest', 'Linear', 'MipMap', 'MipMapNearestNearest', 'MipMapLinearNearest',
  'MipMapNearestLinear', 'MipMapLinearLinear'
]);

export const MINIMAL_SKELETON = '{"skeleton":{"spine":"4.3.13"}}';
export const NAMED_SKELETON = '{"skeleton":{"spine":"4.3.13"},"bones":[{"name":"root"}],"slots":[{"name":"slot","bone":"root"}],"skins":[{"name":"default"}],"animations":{"idle":{}}}';
export const BASE_ATLAS = 'page.png\nsize: 16,16\nsprite\nbounds: 1,2,3,4\n';
export const PAGE_SPAN = Object.freeze({
  source: 'atlas', sourceId: 'atlas-original', offset: 0, length: 8, line: 1, column: 1
});
export const REGION_SPAN = Object.freeze({
  source: 'atlas', sourceId: 'atlas-original', offset: 21, length: 6, line: 3, column: 1
});

export function provenance() {
  return {
    origin: 'Original programmatic Egret fixture',
    license: 'Apache-2.0',
    notice: 'Synthetic planning data; not an Editor export.'
  };
}

export function input(skeletonText = MINIMAL_SKELETON, atlasText = BASE_ATLAS, pages) {
  return {
    skeleton: { id: 'skeleton-original', text: skeletonText, provenance: provenance() },
    atlas: { id: 'atlas-original', text: atlasText, provenance: provenance() },
    pages: pages ?? [{ pageName: 'page.png', assetId: 'asset:page', provenance: provenance() }]
  };
}

export function jsonInput(extra = {}, atlas = BASE_ATLAS, pages) {
  return input(JSON.stringify({ skeleton: { spine: '4.3.13' }, ...extra }), atlas, pages);
}

export function pageAtlas(fields = [], regionFields = ['bounds: 1,2,3,4']) {
  return ['page.png', 'size: 16,16', ...fields,
    ...(regionFields === null ? [] : ['sprite', ...regionFields]), ''].join('\n');
}

export function atlasPages(count) {
  const pages = Array.from({ length: count }, (_, i) => ({
    pageName: `p${i}.png`, assetId: 'shared:page', provenance: provenance()
  }));
  const atlas = pages.map(page => `${page.pageName}\nsize: 16,16\n`).join('\n');
  return input(MINIMAL_SKELETON, atlas, pages);
}

export function atlasRegions(count) {
  // No custom fields: this isolates region allocation from observation capacity.
  const regions = Array.from({ length: count }, (_, i) => `r${i}\nbounds: 0,0,1,1\n`).join('');
  return input(MINIMAL_SKELETON, `page.png\nsize: 16,16\n${regions}`);
}

export function namesInput(collection, count) {
  const names = Array.from({ length: count }, (_, i) => `n${i}`);
  let records;
  if (collection === 'animations') records = Object.fromEntries(names.map(name => [name, {}]));
  else if (collection === 'slots') records = names.map(name => ({ name, bone: 'unresolved:declared' }));
  else records = names.map(name => ({ name }));
  return jsonInput({ [collection]: records });
}

export function observationsInput(count, value = 0) {
  // Each unknown root member is one marker. No attachment/profile marker is added.
  const fields = Object.fromEntries(Array.from({ length: count }, (_, i) => [`u${i}`, value]));
  return jsonInput(fields);
}

export function provenanceTotalInput(extraByte = false) {
  const request = atlasPages(64);
  const records = [request.skeleton.provenance, request.atlas.provenance,
    ...request.pages.map(page => page.provenance)];
  for (const record of records) Object.assign(record, { origin: 'x', license: 'x', notice: 'x' });
  // 66 records * 3 fields = 198 initial bytes. 63 fields receive 4,095
  // additional bytes, the next receives 3,961: 198+257,985+3,961=262,144.
  for (let i = 0; i < 63; i++) records[Math.floor(i / 3)][['origin', 'license', 'notice'][i % 3]] = 'x'.repeat(4096);
  records[21].origin = 'x'.repeat(3962);
  if (extraByte) request.pages[63].provenance.notice = 'xx';
  return request;
}

export const STAGE_CASES = Object.freeze([
  {
    id: 'duplicate-before-later-depth',
    text: '{"skeleton":{"spine":"4.3.13"},"a":1,"a":2,"z":' + '['.repeat(32) + '0' + ']'.repeat(32) + '}',
    expected: { code: 'SPINE_LIMIT_EXCEEDED', source: 'skeleton', pointer: '',
      span: { source: 'skeleton', sourceId: 'skeleton-original', offset: 78, length: 1, line: 1, column: 79 } }
  },
  {
    id: 'duplicate-after-safe-depth',
    text: '{"skeleton":{"spine":"4.3.13"},"a":1,"a":2,"z":' + '['.repeat(31) + '0' + ']'.repeat(31) + '}',
    expected: { code: 'SPINE_JSON_DUPLICATE_KEY', source: 'skeleton', pointer: '/a',
      span: { source: 'skeleton', sourceId: 'skeleton-original', offset: 37, length: 3, line: 1, column: 38 },
      relatedSpan: { source: 'skeleton', sourceId: 'skeleton-original', offset: 31, length: 3, line: 1, column: 32 } }
  },
  {
    id: 'missing-comma-before-later-depth',
    text: '{"skeleton":{"spine":"4.3.13"},"a":1"a":2,"z":' + '['.repeat(32) + '0' + ']'.repeat(32) + '}',
    expected: { code: 'SPINE_LIMIT_EXCEEDED', source: 'skeleton', pointer: '',
      span: { source: 'skeleton', sourceId: 'skeleton-original', offset: 77, length: 1, line: 1, column: 78 } }
  },
  {
    id: 'missing-comma-after-safe-depth',
    text: '{"skeleton":{"spine":"4.3.13"},"a":1"a":2,"z":' + '['.repeat(31) + '0' + ']'.repeat(31) + '}',
    expected: { code: 'SPINE_JSON_SYNTAX', source: 'skeleton', pointer: '',
      span: { source: 'skeleton', sourceId: 'skeleton-original', offset: 36, length: 3, line: 1, column: 37 } }
  },
  {
    id: 'unknown-token-before-depth',
    text: '{"skeleton":{"spine":"4.3.13"},"a":1,"a":2,"z":@' + '['.repeat(32) + '0' + ']'.repeat(32) + '}',
    expected: { code: 'SPINE_JSON_SYNTAX', source: 'skeleton', pointer: '',
      span: { source: 'skeleton', sourceId: 'skeleton-original', offset: 47, length: 1, line: 1, column: 48 } }
  },
  {
    id: 'later-unterminated-string-before-visitor-duplicate',
    text: '{"skeleton":{"spine":"4.3.13"},"a":1,"a":2,"z":"unterminated',
    expected: { code: 'SPINE_JSON_SYNTAX', source: 'skeleton', pointer: '',
      span: { source: 'skeleton', sourceId: 'skeleton-original', offset: 47, length: 13, line: 1, column: 48 } }
  },
  {
    id: 'visitor-duplicate-before-later-trailing-comma',
    text: '{"skeleton":{"spine":"4.3.13"},"a":1,"a":2,"z":' + '['.repeat(31) + '0' + ']'.repeat(31) + ',}',
    expected: { code: 'SPINE_JSON_DUPLICATE_KEY', source: 'skeleton', pointer: '/a',
      span: { source: 'skeleton', sourceId: 'skeleton-original', offset: 37, length: 3, line: 1, column: 38 },
      relatedSpan: { source: 'skeleton', sourceId: 'skeleton-original', offset: 31, length: 3, line: 1, column: 32 } }
  }
]);

export const DUPLICATE_CASES = Object.freeze([
  {
    text: '{"skeleton":{"spine":"4.3.13","sp\\u0069ne":"4.3.13"}}',
    expected: { code: 'SPINE_JSON_DUPLICATE_KEY', source: 'skeleton', pointer: '/skeleton/spine',
      span: { source: 'skeleton', sourceId: 'skeleton-original', offset: 30, length: 12, line: 1, column: 31 },
      relatedSpan: { source: 'skeleton', sourceId: 'skeleton-original', offset: 13, length: 7, line: 1, column: 14 } }
  },
  {
    text: '{"skeleton":{"spine":"4.3.13"},"__proto__":1,"__pr\\u006fto__":2}',
    expected: { code: 'SPINE_JSON_DUPLICATE_KEY', source: 'skeleton', pointer: '/__proto__',
      span: { source: 'skeleton', sourceId: 'skeleton-original', offset: 45, length: 16, line: 1, column: 46 },
      relatedSpan: { source: 'skeleton', sourceId: 'skeleton-original', offset: 31, length: 11, line: 1, column: 32 } }
  }
]);

export const INTEGER_CASES = Object.freeze([
  ['bounds', '0,0,1e3,1', 'SPINE_ATLAS_SYNTAX'],
  ['bounds', '0,0,+1,1', 'SPINE_ATLAS_SYNTAX'],
  ['bounds', '0,0,01,1', 'SPINE_ATLAS_SYNTAX'],
  ['bounds', '0,0,1.0,1', 'SPINE_ATLAS_SYNTAX'],
  ['bounds', '0,0,1junk,1', 'SPINE_ATLAS_SYNTAX'],
  ['bounds', '0,0,0,1', 'SPINE_ATLAS_SYNTAX'],
  ['bounds', '0,0,-1,1', 'SPINE_ATLAS_SYNTAX'],
  ['bounds', '0,0,16385,bad', 'SPINE_LIMIT_EXCEEDED'],
  ['bounds', '0,0,1', 'SPINE_ATLAS_SYNTAX'],
  ['bounds', '16385,bad,1', 'SPINE_ATLAS_SYNTAX'],
  ['offsets', '0,0,9007199254740993,1', 'SPINE_LIMIT_EXCEEDED'],
  ['offsets', '0,0,16385,1', 'SPINE_LIMIT_EXCEEDED'],
  ['offsets', '0,0,1e3,1', 'SPINE_ATLAS_SYNTAX'],
  ['offsets', '0,0,-1,1', 'SPINE_ATLAS_SYNTAX'],
  ['offsets', '0,0,' + '9'.repeat(400) + ',1', 'SPINE_LIMIT_EXCEEDED'],
  ['index', '-2', 'SPINE_ATLAS_SYNTAX'],
  ['index', '2147483648', 'SPINE_LIMIT_EXCEEDED'],
  ['index', '9007199254740993', 'SPINE_LIMIT_EXCEEDED'],
  ['rotate', '45', 'SPINE_ATLAS_PROFILE_UNSUPPORTED'],
  ['rotate', '-1', 'SPINE_ATLAS_PROFILE_UNSUPPORTED'],
  ['rotate', '9007199254740993', 'SPINE_LIMIT_EXCEEDED'],
  ['rotate', '90junk', 'SPINE_ATLAS_SYNTAX']
]);

export const PROFILE_SKELETON = JSON.stringify({
  skeleton: { spine: '4.3.13' },
  bones: [{ name: 'root' }],
  slots: [{ name: 'early', bone: 'root' }, { name: 'later', bone: 'root', blend: 'additive', dark: '334455' }],
  skins: [
    { name: 'default', attachments: { early: { sprite: { type: 'region' } } } },
    { name: 'alternate', attachments: { 'late/slot~': {
      mesh: { type: 'mesh', sequence: {} }, clip: { type: 'clipping' }
    } } }
  ],
  constraints: [{ name: 'declared-only' }],
  animations: { idle: {}, 'late/animation~': { slots: { 'late/slot~': { rgba2: [], rgb2: [] } } } },
  producerNote: 'original synthetic fixture'
});

export const PROFILE_ATLAS = 'page.png\nsize: 16,16\nformat: RGB888\nfilter: Linear,Nearest\nrepeat: x\npma: true\nsprite\nbounds: 0,0,1,1\npad: 0,0,0,0\n';

export const PROFILE_OBSERVATIONS = Object.freeze([
  ['slot-blend', '/slots/1/blend', 'additive'],
  ['slot-dark', '/slots/1/dark', '334455'],
  ['attachment-type', '/skins/0/attachments/early/sprite/type', 'region'],
  ['attachment-type', '/skins/1/attachments/late~1slot~0/mesh/type', 'mesh'],
  ['attachment-sequence', '/skins/1/attachments/late~1slot~0/mesh/sequence'],
  ['attachment-type', '/skins/1/attachments/late~1slot~0/clip/type', 'clipping'],
  ['constraint', '/constraints/0'],
  ['dark-timeline', '/animations/late~1animation~0/slots/late~1slot~0/rgba2'],
  ['dark-timeline', '/animations/late~1animation~0/slots/late~1slot~0/rgb2'],
  ['unknown-root-field', '/producerNote', 'original synthetic fixture'],
  ['atlas-format', '/pages/0/format', 'RGB888'],
  ['atlas-sampler', '/pages/0/filter', 'Linear,Nearest'],
  ['atlas-repeat', '/pages/0/repeat', 'x'],
  ['atlas-pma', '/pages/0/pma', 'true'],
  ['extra-atlas-field', '/pages/0/regions/0/pad', '0,0,0,0']
]);

// This is a finite coverage plan, not an execution ledger. Capacity tests are
// lazy; each large source/node/property fixture is built only for its own test.
export const LIMIT_COVERAGE = Object.freeze([
  ['maxSkeletonUtf8Bytes', 'whole-source-at-and-plus-one'],
  ['maxAtlasUtf8Bytes', 'whole-source-at-and-plus-one'],
  ['maxJsonDepth', 'safe-D31-and-preflight-D32'],
  ['maxJsonNodes', 'events-values-262139-and-262140'],
  ['maxJsonProperties', 'events-properties-131069-and-131070'],
  ['maxJsonStringUtf8Bytes', 'event-string-65536-and-65537'],
  ['maxJsonKeyUtf8Bytes', 'event-key-1024-and-1025'],
  ['maxSourceIdUtf8Bytes', 'source-ID-256-and-257'],
  ['maxAssetIdUtf8Bytes', 'untrimmed-asset-ID-256-and-257'],
  ['maxNameUtf8Bytes', 'bone-and-region-name-1024-and-1025'],
  ['maxPagePathUtf8Bytes', 'atlas-and-binding-name-1024-and-1025'],
  ['maxProvenanceFieldUtf8Bytes', 'field-4096-and-4097'],
  ['maxProvenanceTotalUtf8Bytes', '66-record-total-262144-and-262145'],
  ['maxAtlasPages', 'page-count-64-and-65'],
  ['maxAtlasRegions', 'region-count-8192-and-8193'],
  ['maxAtlasFieldsPerSection', 'page-and-region-fields-32-and-33'],
  ['maxAtlasLineUtf8Bytes', 'custom-line-4096-and-4097'],
  ['maxAtlasPageDimension', 'page-size-16384-and-16385'],
  ['maxAtlasRegionCoordinate', '16384-reaches-containment-syntax-16385-limit'],
  ['maxAtlasPackedDimension', 'packed-width-and-height-16384-and-16385'],
  ['maxAtlasOffset', '16384-reaches-containment-syntax-16385-limit'],
  ['maxAtlasOriginalDimension', 'original-width-and-height-16384-and-16385'],
  ['maxAtlasIndex', 'index-2147483647-and-2147483648'],
  ['maxNamesPerCollection', 'all-four-collections-4096-and-4097'],
  ['maxObservations', 'unknown-root-markers-4096-and-4097'],
  ['maxSuccessDiagnostics', 'literal-16-and-fixed-at-most-three-warning-classes'],
  ['maxDiagnosticPointerUtf8Bytes', 'escaped-pointer-2048-and-2049'],
  ['maxObservationValueUtf8Bytes', 'marker-value-4096-preserved-4097-omitted']
]);
