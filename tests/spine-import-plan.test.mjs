// SPDX-License-Identifier: Apache-2.0
// Independently authored SP1-A behavior oracles. Authoring status: NOT_RUN.
// The coordinator owns the separate genuine public-entry baseline/RED and the
// later behavior GREEN. An import/setup failure here is not assigned RED.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as spine from '@egret/project/spine';
import {
  FIXTURE_STATUS, EXPECTED_RUNTIME_EXPORTS, EXPECTED_TYPE_EXPORTS, EXPECTED_LIMITS,
  DIAGNOSTIC_CODES, FORMATS, FILTERS, MINIMAL_SKELETON, NAMED_SKELETON, BASE_ATLAS,
  PAGE_SPAN, REGION_SPAN, provenance, input, jsonInput, pageAtlas, atlasPages,
  atlasRegions, namesInput, observationsInput, provenanceTotalInput, STAGE_CASES,
  DUPLICATE_CASES, INTEGER_CASES, PROFILE_SKELETON, PROFILE_ATLAS,
  PROFILE_OBSERVATIONS, LIMIT_COVERAGE
} from './fixtures/spine-import-plan.mjs';

const { createSpineImportPlan, SPINE_IMPORT_LIMITS } = spine;
// Prototype choice is not an extra public constraint on ordinary/null records.
// Shape/descriptors are checked separately; this compares only owned JSON data.
const plain = value => JSON.parse(JSON.stringify(value));
const ownKeys = value => Reflect.ownKeys(value).map(key => {
  assert.equal(typeof key, 'string');
  return key;
}).sort();
const keys = (value, expected) => assert.deepEqual(ownKeys(value), [...expected].sort());
const skeletonSpan = (offset, length) => ({
  source: 'skeleton', sourceId: 'skeleton-original', offset, length, line: 1, column: offset + 1
});
const atlasSpan = (offset, length, line, column = 1) => ({
  source: 'atlas', sourceId: 'atlas-original', offset, length, line, column
});

function frozenTree(value, seen = new Set()) {
  if (value === null || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value);
  assert.ok(Object.isFrozen(value), 'every owned output container is frozen');
  const prototype = Object.getPrototypeOf(value);
  assert.ok(Array.isArray(value) ? prototype === Array.prototype
    : prototype === null || prototype === Object.prototype);
  for (const key of Reflect.ownKeys(value)) {
    assert.equal(typeof key, 'string');
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    assert.ok('value' in descriptor, 'no accessor in owned output');
    if (Array.isArray(value) && key === 'length') continue;
    assert.equal(descriptor.enumerable, true);
    frozenTree(descriptor.value, seen);
  }
}

function diagnosticShape(diagnostic) {
  const optional = ['span', 'relatedSpan'].filter(key => Object.hasOwn(diagnostic, key));
  keys(diagnostic, ['code', 'severity', 'source', 'pointer', 'message', ...optional]);
  assert.ok(DIAGNOSTIC_CODES.includes(diagnostic.code));
  assert.ok(['input', 'skeleton', 'atlas'].includes(diagnostic.source));
  assert.ok(['error', 'warning'].includes(diagnostic.severity));
  assert.equal(typeof diagnostic.message, 'string');
  assert.ok(diagnostic.message.length > 0);
  assert.doesNotMatch(diagnostic.message, /[\u3400-\u9fff]/u, 'fixed public diagnostic messages are English');
  assert.equal(typeof diagnostic.pointer, 'string');
  assert.ok(Buffer.byteLength(diagnostic.pointer, 'utf8') <= 2048);
  if (diagnostic.source === 'input') assert.equal(Object.hasOwn(diagnostic, 'span'), false);
  for (const key of optional) {
    const span = diagnostic[key];
    keys(span, ['source', 'sourceId', 'offset', 'length', 'line', 'column']);
    assert.ok(['skeleton', 'atlas'].includes(span.source));
    if (key === 'span') assert.equal(span.source, diagnostic.source);
    assert.ok(Number.isSafeInteger(span.offset) && span.offset >= 0);
    assert.ok(Number.isSafeInteger(span.length) && span.length >= 0);
    assert.ok(Number.isSafeInteger(span.line) && span.line >= 1);
    assert.ok(Number.isSafeInteger(span.column) && span.column >= 1);
  }
}

function resultFor(request) {
  let result;
  assert.doesNotThrow(() => { result = createSpineImportPlan(request); });
  frozenTree(result);
  for (const diagnostic of result.diagnostics) diagnosticShape(diagnostic);
  return result;
}

function success(request) {
  const result = resultFor(request);
  keys(result, ['ok', 'value', 'diagnostics']);
  assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
  assert.ok(result.diagnostics.length <= 3, 'three fixed classes; no reachable 16/17 input witness');
  assert.deepEqual(plain(result.value.acceptance), {
    animationSemantics: 'not_run', rendering: 'not_run',
    licenseEntitlement: 'unverified', featureInventory: 'partial'
  });
  assert.equal(result.value.runtimeCandidate.artifactVerification, 'not_run');
  assert.ok(result.diagnostics.every(diagnostic => diagnostic.severity === 'warning'));
  assert.deepEqual(result.diagnostics.map(diagnostic => diagnostic.code),
    result.diagnostics.some(diagnostic => diagnostic.code === 'SPINE_PROFILE_UNSUPPORTED')
      ? ['SPINE_PROFILE_UNSUPPORTED', 'SPINE_INVENTORY_PARTIAL', 'SPINE_PROVENANCE_UNVERIFIED']
      : ['SPINE_INVENTORY_PARTIAL', 'SPINE_PROVENANCE_UNVERIFIED']);
  const inventory = result.diagnostics.find(diagnostic => diagnostic.code === 'SPINE_INVENTORY_PARTIAL');
  assert.deepEqual(plain([inventory.source, inventory.pointer, inventory.span]),
    ['skeleton', '', { ...skeletonSpan(0, 1), sourceId: request.skeleton.id }]);
  const declared = result.diagnostics.at(-1);
  assert.deepEqual([declared.source, declared.pointer], ['input', '']);
  assert.equal(Object.hasOwn(declared, 'span'), false);
  return result;
}

function failure(request, expected) {
  const result = resultFor(request);
  keys(result, ['ok', 'diagnostics']);
  assert.equal(result.ok, false);
  assert.equal(result.diagnostics.length, 1, 'one fatal and no previous warnings or partial plan');
  const diagnostic = result.diagnostics[0];
  assert.equal(diagnostic.severity, 'error');
  assert.deepEqual([diagnostic.code, diagnostic.source, diagnostic.pointer],
    [expected.code, expected.source, expected.pointer]);
  for (const name of ['span', 'relatedSpan']) {
    if (Object.hasOwn(expected, name)) assert.deepEqual(plain(diagnostic[name]), expected[name]);
    else if (expected.noSpans || name === 'relatedSpan') assert.equal(Object.hasOwn(diagnostic, name), false);
  }
  return diagnostic;
}

const fatal = (code, source, pointer, span, relatedSpan) => ({
  code, source, pointer,
  ...(span === undefined ? {} : { span }),
  ...(relatedSpan === undefined ? {} : { relatedSpan })
});

test('SP1-A exact optional runtime exports, eleven type names and 28 immutable limits', () => {
  assert.equal(FIXTURE_STATUS, 'NOT_RUN');
  assert.deepEqual(Object.keys(spine).sort(), EXPECTED_RUNTIME_EXPORTS);
  assert.equal(typeof createSpineImportPlan, 'function');
  assert.equal(EXPECTED_TYPE_EXPORTS.length, 11);
  assert.equal(new Set(EXPECTED_TYPE_EXPORTS).size, 11);
  assert.equal(ownKeys(SPINE_IMPORT_LIMITS).length, 28);
  assert.deepEqual(plain(SPINE_IMPORT_LIMITS), EXPECTED_LIMITS);
  frozenTree(SPINE_IMPORT_LIMITS);
  for (const key of Object.keys(EXPECTED_LIMITS)) {
    const descriptor = Object.getOwnPropertyDescriptor(SPINE_IMPORT_LIMITS, key);
    assert.equal(descriptor.enumerable, true);
    assert.equal(descriptor.writable, false);
    assert.equal(descriptor.configurable, false);
  }
  assert.deepEqual(LIMIT_COVERAGE.map(row => row[0]).sort(), Object.keys(EXPECTED_LIMITS).sort());
});

test('SP1-A original named fixture has exact owned plan, dependency, defaults and literal atlas spans', () => {
  const request = input(NAMED_SKELETON);
  const callerBefore = JSON.stringify(request);
  const result = success(request), plan = result.value;
  assert.equal(JSON.stringify(request), callerBefore);
  keys(plan, ['planVersion', 'sourceDeclarations', 'exportVersion', 'runtimeCandidate',
    'names', 'pages', 'observations', 'acceptance']);
  assert.equal(plan.planVersion, 1);
  assert.equal(plan.exportVersion, '4.3.13');
  assert.deepEqual(plain(plan.runtimeCandidate), {
    series: '4.3', package: '@esotericsoftware/spine-core', sourceTag: 'spine-ts-4.3.13',
    sourceCommit: 'b7beb2ccbbce667a12c02f44d070644f59b04968', artifactVerification: 'not_run'
  });
  assert.deepEqual(plain(plan.names), { bones: ['root'], slots: ['slot'], skins: ['default'], animations: ['idle'] });
  keys(plan.sourceDeclarations, ['skeleton', 'atlas']);
  for (const source of ['skeleton', 'atlas']) {
    const declaration = plan.sourceDeclarations[source];
    keys(declaration, ['id', 'provenance', 'utf8Bytes', 'hashVerification']);
    assert.equal(declaration.id, request[source].id);
    assert.deepEqual(plain(declaration.provenance), request[source].provenance);
    assert.equal(declaration.utf8Bytes, Buffer.byteLength(request[source].text, 'utf8'));
    assert.equal(declaration.hashVerification, 'declared_unverified');
    assert.equal(Object.hasOwn(declaration, 'text'), false);
  }
  assert.equal(plan.sourceDeclarations.skeleton.utf8Bytes, 151);
  assert.equal(plan.sourceDeclarations.atlas.utf8Bytes, 44);
  assert.deepEqual(plain(plan.pages), [{
    name: 'page.png', assetId: 'asset:page', provenance: provenance(),
    width: 16, height: 16, format: 'RGBA8888', minFilter: 'Nearest', magFilter: 'Nearest',
    repeat: 'none', pma: false, span: PAGE_SPAN, extraFields: [], regions: [{
      name: 'sprite', index: -1, x: 1, y: 2, width: 3, height: 4, rotation: 0,
      offsetLeft: 0, offsetBottom: 0, originalWidth: 3, originalHeight: 4,
      span: REGION_SPAN, extraFields: []
    }]
  }]);
  assert.deepEqual(plan.observations, []);
  const before = JSON.stringify(result);
  request.skeleton.id = 'mutated'; request.atlas.provenance.notice = 'mutated';
  request.pages[0].assetId = 'mutated'; request.pages.push({});
  assert.equal(JSON.stringify(result), before);
  assert.notEqual(plan.pages[0].provenance, request.pages[0].provenance);
  assert.notEqual(plan.sourceDeclarations.skeleton.provenance, request.skeleton.provenance);
  assert.throws(() => { plan.pages[0].regions[0].width = 99; }, TypeError);
});

test('SP1-A CR, LF, CRLF and UTF16 authored names retain original page/region locations', () => {
  for (const [terminator, regionOffset] of [['\n', 21], ['\r', 21], ['\r\n', 23]]) {
    const plan = success(input(MINIMAL_SKELETON, BASE_ATLAS.replaceAll('\n', terminator))).value;
    assert.deepEqual(plain(plan.pages[0].span), PAGE_SPAN);
    assert.deepEqual(plain(plan.pages[0].regions[0].span), atlasSpan(regionOffset, 6, 3));
  }
  const request = input(MINIMAL_SKELETON, '😀.png\nsize: 16,16\n😀sprite\nbounds: 0,0,1,1\n',
    [{ pageName: '😀.png', assetId: '\tpage:original\u00a0', provenance: provenance() }]);
  const plan = success(request).value;
  assert.equal(plan.pages[0].assetId, '\tpage:original\u00a0');
  assert.deepEqual(plain(plan.pages[0].span), atlasSpan(0, 6, 1));
  assert.deepEqual(plain(plan.pages[0].regions[0].span), atlasSpan(19, 8, 3));
});

test('SP1-A shared assets, case-sensitive indexed regions, rotated packing and unrotated trimming', () => {
  const atlas = 'a.png\nsize: 16,16\nsprite\nbounds: 0,0,1,1\nindex: 0\n\nb.png\nsize: 16,16\nsprite\nbounds: 12,10,3,4\nrotate: 90\noffsets: 2,1,5,5\nindex: 1\n';
  const request = input(MINIMAL_SKELETON, atlas, ['a.png', 'b.png'].map(pageName => ({
    pageName, assetId: 'same:asset', provenance: provenance()
  })));
  const plan = success(request).value;
  assert.deepEqual(plan.pages.map(page => [page.name, page.assetId]), [['a.png', 'same:asset'], ['b.png', 'same:asset']]);
  assert.deepEqual(plan.pages.map(page => page.regions[0].index), [0, 1]);
  assert.deepEqual(plain(plan.pages[1].span), atlasSpan(51, 5, 7));
  const rotated = plan.pages[1].regions[0];
  assert.deepEqual([rotated.x, rotated.y, rotated.width, rotated.height, rotated.rotation,
    rotated.offsetLeft, rotated.offsetBottom, rotated.originalWidth, rotated.originalHeight],
  [12, 10, 3, 4, 90, 2, 1, 5, 5]);
  success(input(MINIMAL_SKELETON, pageAtlas([], ['bounds: 0,0,1,1', 'index: 0',
    'Sprite', 'bounds: 0,0,1,1', 'index: 0'])));
});

test('SP1-A every later setup/skin/animation concern is observed without normalization', () => {
  const result = success(input(PROFILE_SKELETON, PROFILE_ATLAS)), plan = result.value;
  assert.deepEqual(plan.observations.map(observation => [observation.kind, observation.pointer,
    ...(Object.hasOwn(observation, 'value') ? [observation.value] : [])]), PROFILE_OBSERVATIONS);
  for (const observation of plan.observations) keys(observation,
    ['kind', 'pointer', 'span', ...(Object.hasOwn(observation, 'value') ? ['value'] : [])]);
  const page = plan.pages[0];
  assert.deepEqual([page.format, page.minFilter, page.magFilter, page.repeat, page.pma],
    ['RGB888', 'Linear', 'Nearest', 'x', true]);
  assert.deepEqual(plain(page.regions[0].extraFields), [{
    key: 'pad', value: '0,0,0,0', span: atlasSpan(102, 12, 9)
  }]);
  const first = plan.observations[0], warning = result.diagnostics[0];
  assert.deepEqual(plain(first.span), skeletonSpan(135, 10));
  assert.deepEqual([warning.source, warning.pointer, warning.span],
    ['skeleton', '/slots/1/blend', first.span]);
});

test('SP1-A case-sensitive format/filter/repeat/PMA tokens retain declarations and concerns', () => {
  for (const format of FORMATS) {
    const result = success(input(MINIMAL_SKELETON, pageAtlas([`format: ${format}`], null)));
    assert.equal(result.value.pages[0].format, format);
    assert.equal(result.value.observations.some(observation => observation.kind === 'atlas-format'), format !== 'RGBA8888');
  }
  for (const filter of FILTERS) for (const member of [0, 1]) {
    const pair = member === 0 ? `${filter},Nearest` : `Nearest,${filter}`;
    const result = success(input(MINIMAL_SKELETON, pageAtlas([`filter: ${pair}`], null)));
    assert.equal(result.value.pages[0][member === 0 ? 'minFilter' : 'magFilter'], filter);
    assert.equal(result.value.observations.some(observation => observation.kind === 'atlas-sampler'), filter !== 'Nearest');
  }
  for (const repeat of ['none', 'x', 'y', 'xy']) assert.equal(
    success(input(MINIMAL_SKELETON, pageAtlas([`repeat: ${repeat}`], null))).value.pages[0].repeat, repeat);
  for (const pma of ['false', 'true']) assert.equal(
    success(input(MINIMAL_SKELETON, pageAtlas([`pma: ${pma}`], null))).value.pages[0].pma, pma === 'true');
  for (const line of ['format: rgba8888', 'format: RGBA8888,RGB888', 'filter: nearest,Nearest',
    'filter: Nearest', 'filter: Nearest,Nearest,Nearest', 'repeat: X', 'pma: TRUE']) {
    failure(input(MINIMAL_SKELETON, pageAtlas([line], null)),
      fatal('SPINE_ATLAS_SYNTAX', 'atlas', '/pages/0/' + line.split(':')[0], atlasSpan(21, line.length, 3)));
  }
  for (const [spelling, rotation] of [['false', 0], ['0', 0], ['-0', 0], ['true', 90], ['90', 90]]) {
    assert.equal(success(input(MINIMAL_SKELETON, pageAtlas([], ['bounds: 0,0,1,1', `rotate: ${spelling}`])))
      .value.pages[0].regions[0].rotation, rotation);
  }
});

test('SP1-A the seven staged duplicate/grammar/depth witnesses have literal source positions', () => {
  const safeDepth = '{"skeleton":{"spine":"4.3.13"},"z":' + '['.repeat(31) + '0' + ']'.repeat(31) + '}';
  assert.equal(success(input(safeDepth)).value.observations[0].pointer, '/z');
  for (const witness of STAGE_CASES) failure(input(witness.text), witness.expected);
  for (const witness of DUPLICATE_CASES) failure(input(witness.text), witness.expected);
  success(input('{"skeleton":{"spine":"4.3.13"},"__proto__":1,"constructor":{},"a/~":null}'));
});

test('SP1-A strict JSON syntax, Unicode, finiteness and schema remain separate stages', () => {
  failure(input('\ufeff' + MINIMAL_SKELETON), fatal('SPINE_JSON_SYNTAX', 'skeleton', '', skeletonSpan(0, 1)));
  failure(input('{/* original */"skeleton":{"spine":"4.3.13"}}'),
    fatal('SPINE_JSON_SYNTAX', 'skeleton', '', skeletonSpan(1, 14)));
  failure(input('{"skeleton":{"spine":"4.3.13"},}'),
    fatal('SPINE_JSON_SYNTAX', 'skeleton', '', skeletonSpan(31, 1)));
  failure(input(MINIMAL_SKELETON + '\ud800'),
    { code: 'SPINE_JSON_SYNTAX', source: 'skeleton', pointer: '', noSpans: true });
  failure(input(MINIMAL_SKELETON, BASE_ATLAS + '\udc00'),
    { code: 'SPINE_ATLAS_SYNTAX', source: 'atlas', pointer: '', noSpans: true });
  const decoded = '{"skeleton":{"spine":"4.3.13"},"events":{"x":"\\ud800"}}';
  failure(input(decoded), fatal('SPINE_JSON_SYNTAX', 'skeleton', '/events/x', skeletonSpan(45, 8)));
  const infinite = '{"skeleton":{"spine":"4.3.13"},"events":{"x":1e999}}';
  failure(input(infinite), fatal('SPINE_JSON_SYNTAX', 'skeleton', '/events/x', skeletonSpan(45, 5)));
  success(input('{"skeleton":{"spine":"4.3.13"},"events":{"x":9007199254740993,"fraction":0.5,"zero":-0}}'));
  failure(input('{}'), fatal('SPINE_JSON_SCHEMA', 'skeleton', '/skeleton', skeletonSpan(0, 1)));
  failure(input('{"skeleton":[]}'), fatal('SPINE_JSON_SCHEMA', 'skeleton', '/skeleton', skeletonSpan(12, 1)));
  failure(input('{"skeleton":{"spine":"bad"},"bones":17}'),
    fatal('SPINE_JSON_SCHEMA', 'skeleton', '/bones', skeletonSpan(36, 2)));
  for (const [field, value] of [['bones', {}], ['slots', {}], ['skins', {}], ['constraints', {}],
    ['events', []], ['animations', []]]) {
    const request = jsonInput({ [field]: value }), token = field === 'events' || field === 'animations' ? '[' : '{';
    const offset = request.skeleton.text.lastIndexOf(token);
    failure(request, fatal('SPINE_JSON_SCHEMA', 'skeleton', '/' + field, skeletonSpan(offset, 1)));
  }
  failure(jsonInput({ slots: [{ name: 'slot' }] }), fatal('SPINE_JSON_SCHEMA', 'skeleton', '/slots/0/bone', skeletonSpan(40, 1)));
  failure(jsonInput({ skins: [{ name: 'alternate', attachments: { slot: [] } }] }),
    fatal('SPINE_JSON_SCHEMA', 'skeleton', '/skins/0/attachments/slot', skeletonSpan(82, 1)));
});

test('SP1-A stable versions preserve spelling; prerelease, malformed and other series refuse', () => {
  for (const version of ['4.3.0', '4.3.13', '4.3.999']) assert.equal(
    success(jsonInput({ skeleton: { spine: version } })).value.exportVersion, version);
  for (const [version, code] of [
    ['4.3.14-beta', 'SPINE_VERSION_PRERELEASE'], ['4.3.14-alpha', 'SPINE_VERSION_PRERELEASE'],
    ['4.3.14-rc1', 'SPINE_VERSION_PRERELEASE'], ['4.2.67', 'SPINE_VERSION_MISMATCH'],
    ['5.0.0', 'SPINE_VERSION_MISMATCH'], ['4.3', 'SPINE_VERSION_INVALID'],
    ['04.3.13', 'SPINE_VERSION_INVALID'], ['4.3.013', 'SPINE_VERSION_INVALID'],
    ['4.3.9007199254740993', 'SPINE_VERSION_INVALID']
  ]) failure(jsonInput({ skeleton: { spine: version } }),
    fatal(code, 'skeleton', '/skeleton/spine', skeletonSpan(21, version.length + 2)));
  failure(input('{"skeleton":{}}'),
    fatal('SPINE_VERSION_INVALID', 'skeleton', '/skeleton/spine', skeletonSpan(12, 1)));
  failure(input('{"skeleton":{"spine":17}}'),
    fatal('SPINE_VERSION_INVALID', 'skeleton', '/skeleton/spine', skeletonSpan(21, 2)));
});

test('SP1-A full-token atlas integers preserve exact lower bounds and reject truncation/rounding', () => {
  for (const [field, raw, code] of INTEGER_CASES) {
    const line = `${field}: ${raw}`;
    const request = input(MINIMAL_SKELETON, pageAtlas([], field === 'bounds'
      ? [line] : ['bounds: 0,0,1,1', line]));
    failure(request, fatal(code, 'atlas', '/pages/0/regions/0/' + field,
      atlasSpan(field === 'bounds' ? 28 : 44, line.length, field === 'bounds' ? 4 : 5)));
  }
  const region = success(input(MINIMAL_SKELETON, pageAtlas([], ['bounds: -0,-0,1,1',
    'offsets: -0,-0,1,1', 'index: -1']))).value.pages[0].regions[0];
  assert.deepEqual([region.x, region.y, region.offsetLeft, region.offsetBottom, region.index], [0, 0, 0, 0, -1]);
  for (const line of ['size: 0,16', 'size: -1,16', 'size: 1e3,16', 'size: 16', 'size: 16385,bad']) {
    failure(input(MINIMAL_SKELETON, `page.png\n${line}\n`),
      fatal(line === 'size: 16385,bad' ? 'SPINE_LIMIT_EXCEEDED' : 'SPINE_ATLAS_SYNTAX',
        'atlas', '/pages/0/size', atlasSpan(9, line.length, 2)));
  }
  failure(input(MINIMAL_SKELETON, pageAtlas([], ['bounds: 13,0,3,4', 'rotate: 90'])),
    fatal('SPINE_ATLAS_SYNTAX', 'atlas', '/pages/0/regions/0/bounds', atlasSpan(28, 16, 4)));
  failure(input(MINIMAL_SKELETON, pageAtlas([], ['bounds: 0,0,3,4', 'offsets: 2,1,4,5'])),
    fatal('SPINE_ATLAS_SYNTAX', 'atlas', '/pages/0/regions/0/offsets', atlasSpan(44, 16, 5)));
});

test('SP1-A exact bindings use separate input and atlas locations with deterministic order', () => {
  const request = input(); request.pages = [];
  failure(request, fatal('SPINE_PAGE_BINDING_INVALID', 'atlas', '/pages/0', PAGE_SPAN));
  const caseOnly = input(); caseOnly.pages[0].pageName = 'PAGE.png';
  failure(caseOnly, fatal('SPINE_PAGE_BINDING_INVALID', 'atlas', '/pages/0', PAGE_SPAN));
  for (const name of ['page.png', 'PAGE.png']) {
    const duplicate = input(); duplicate.pages.push({ pageName: name, assetId: 'other', provenance: provenance() });
    const diagnostic = failure(duplicate, fatal('SPINE_PAGE_BINDING_INVALID', 'input', '/pages/1/pageName', undefined, PAGE_SPAN));
    assert.equal(Object.hasOwn(diagnostic, 'span'), false);
  }
  const extra = input(); extra.pages.push({ pageName: 'extra.png', assetId: 'other', provenance: provenance() });
  failure(extra, { code: 'SPINE_PAGE_BINDING_INVALID', source: 'input', pointer: '/pages/1/pageName', noSpans: true });
  const traversal = input(); traversal.pages[0].pageName = '../page.png';
  failure(traversal, { code: 'SPINE_PAGE_BINDING_INVALID', source: 'input', pointer: '/pages/0/pageName', noSpans: true });
  const normalized = input(MINIMAL_SKELETON, 'é.png\nsize: 16,16\n',
    ['é.png', 'e\u0301.png'].map(pageName => ({ pageName, assetId: 'shared', provenance: provenance() })));
  failure(normalized, fatal('SPINE_PAGE_BINDING_INVALID', 'input', '/pages/1/pageName', undefined, atlasSpan(0, 5, 1)));
  const exactUnicode = input(MINIMAL_SKELETON, 'é.png\nsize: 16,16\n',
    [{ pageName: 'e\u0301.png', assetId: 'shared', provenance: provenance() }]);
  failure(exactUnicode, fatal('SPINE_PAGE_BINDING_INVALID', 'atlas', '/pages/0', atlasSpan(0, 5, 1)));
  for (const id of [' ', '\t', '\u00a0']) {
    const blank = input(); blank.pages[0].assetId = id;
    failure(blank, { code: 'SPINE_INPUT_INVALID', source: 'input', pointer: '/pages/0/assetId', noSpans: true });
  }
  const spelled = input(); spelled.pages[0].assetId = '\tpage:original\u00a0';
  assert.equal(success(spelled).value.pages[0].assetId, '\tpage:original\u00a0');
});

test('SP1-A declared hashes/unknown markers are retained without rights or semantic acceptance', () => {
  const request = jsonInput({ skeleton: { spine: '4.3.13', hash: 'exporter-hash-is-not-sha256' },
    originalMarker: 'declaration' });
  request.skeleton.provenance.sha256 = 'a'.repeat(64);
  request.atlas.provenance.sha256 = 'b'.repeat(64);
  request.pages[0].provenance.sha256 = 'c'.repeat(64);
  const plan = success(request).value;
  assert.equal(plan.sourceDeclarations.skeleton.provenance.sha256, 'a'.repeat(64));
  assert.equal(plan.sourceDeclarations.skeleton.hashVerification, 'declared_unverified');
  assert.deepEqual(plan.observations.map(observation => [observation.kind, observation.pointer, observation.value]),
    [['unknown-root-field', '/originalMarker', 'declaration']]);
  const escaped = success(jsonInput({ 'a/~': 0 })).value.observations[0];
  assert.deepEqual([escaped.kind, escaped.pointer, Object.hasOwn(escaped, 'value')], ['unknown-root-field', '/a~1~0', false]);
  const nullRecords = input();
  for (const source of ['skeleton', 'atlas']) {
    nullRecords[source].provenance = Object.assign(Object.create(null), nullRecords[source].provenance);
    nullRecords[source] = Object.assign(Object.create(null), nullRecords[source]);
  }
  nullRecords.pages[0].provenance = Object.assign(Object.create(null), nullRecords.pages[0].provenance);
  nullRecords.pages[0] = Object.assign(Object.create(null), nullRecords.pages[0]);
  success(Object.assign(Object.create(null), nullRecords));
});

test('SP1-A whole-source byte limits are checked before parser work and disclose no fabricated span', () => {
  // One boundary pair per source. Padding is inert whitespace; no quadratic
  // cross-product of maximum pages, names, regions or decoded strings is built.
  for (const [source, ceiling] of [['skeleton', 8388608], ['atlas', 1048576]]) {
    const request = input();
    if (source === 'skeleton') request.skeleton.text = MINIMAL_SKELETON + ' '.repeat(ceiling - 31);
    else {
      const rest = ceiling - 44;
      request.atlas.text = BASE_ATLAS + (' '.repeat(4095) + '\n').repeat(Math.floor(rest / 4096))
        + ' '.repeat(rest % 4096);
    }
    assert.equal(Buffer.byteLength(request[source].text), ceiling);
    success(request);
    request[source].text += ' ';
    failure(request, { code: 'SPINE_LIMIT_EXCEEDED', source, pointer: '', noSpans: true });
  }
});

test('SP1-A node/property budgets charge containers and keys with independent at/+1 sources', () => {
  // Node baseline: root+skeleton+version+events+values array = five nodes.
  for (const [count, admitted] of [[262139, true], [262140, false]]) {
    const prefix = '{"skeleton":{"spine":"4.3.13"},"events":{"values":[';
    const text = prefix + Array(count).fill('0').join(',') + ']}}';
    const request = input(text);
    if (admitted) success(request);
    else failure(request, fatal('SPINE_LIMIT_EXCEEDED', 'skeleton', '/events/values/262139',
      skeletonSpan(prefix.length + 262139 * 2, 1)));
  }
  // Object-property baseline: root.skeleton+root.events+skeleton.spine = three.
  for (const [count, admitted] of [[131069, true], [131070, false]]) {
    const properties = Array.from({ length: count }, (_, i) => `"p${i}":0`).join(',');
    const prefix = '{"skeleton":{"spine":"4.3.13"},"events":{';
    const text = prefix + properties + '}}', request = input(text);
    if (admitted) success(request);
    else failure(request, fatal('SPINE_LIMIT_EXCEEDED', 'skeleton', '/events/p131069',
      skeletonSpan(text.lastIndexOf('"p131069"'), 9)));
  }
});

test('SP1-A decoded string/key/pointer limits are independent of raw source byte capacity', () => {
  for (const [length, admitted] of [[65536, true], [65537, false]]) {
    const text = '{"skeleton":{"spine":"4.3.13"},"events":{"x":"' + 'a'.repeat(length) + '"}}';
    if (admitted) success(input(text));
    else failure(input(text), fatal('SPINE_LIMIT_EXCEEDED', 'skeleton', '/events/x', skeletonSpan(45, length + 2)));
  }
  for (const [length, admitted] of [[1024, true], [1025, false]]) {
    const name = 'a'.repeat(length), text = '{"skeleton":{"spine":"4.3.13"},"events":{"' + name + '":0}}';
    if (admitted) success(input(text));
    else failure(input(text), fatal('SPINE_LIMIT_EXCEEDED', 'skeleton', '/events/' + name, skeletonSpan(41, length + 2)));
  }
  for (const [suffix, admitted] of [['', true], ['x', false]]) {
    const name = '~'.repeat(1020) + suffix;
    const text = '{"skeleton":{"spine":"4.3.13"},"events":{"' + name + '":0}}';
    assert.equal(Buffer.byteLength('/events/' + '~0'.repeat(1020) + suffix), admitted ? 2048 : 2049);
    if (admitted) success(input(text));
    else failure(input(text), fatal('SPINE_LIMIT_EXCEEDED', 'skeleton', '/events', skeletonSpan(41, name.length + 2)));
  }
});

test('SP1-A metadata IDs and provenance are untrimmed UTF8 budgets, not authenticated asset refs', () => {
  for (const source of ['skeleton', 'atlas']) {
    const request = input(); request[source].id = '界'.repeat(85) + 'a';
    assert.equal(success(request).value.sourceDeclarations[source].id, request[source].id);
    request[source].id += 'b';
    failure(request, { code: 'SPINE_LIMIT_EXCEEDED', source: 'input', pointer: '/' + source + '/id', noSpans: true });
  }
  const asset = input(); asset.pages[0].assetId = '界'.repeat(85) + 'a';
  assert.equal(success(asset).value.pages[0].assetId, asset.pages[0].assetId);
  asset.pages[0].assetId += 'b';
  failure(asset, { code: 'SPINE_LIMIT_EXCEEDED', source: 'input', pointer: '/pages/0/assetId', noSpans: true });
  for (const [target, pointer] of [
    [request => request.skeleton.provenance, '/skeleton/provenance'],
    [request => request.atlas.provenance, '/atlas/provenance'],
    [request => request.pages[0].provenance, '/pages/0/provenance']
  ]) for (const field of ['origin', 'license', 'notice']) {
    const request = input(); target(request)[field] = 'x'.repeat(4096); success(request);
    target(request)[field] += 'x';
    failure(request, { code: 'SPINE_LIMIT_EXCEEDED', source: 'input', pointer: pointer + '/' + field, noSpans: true });
  }
  success(provenanceTotalInput());
  failure(provenanceTotalInput(true), {
    code: 'SPINE_LIMIT_EXCEEDED', source: 'input', pointer: '/pages/63/provenance/notice', noSpans: true
  });
});

test('SP1-A collection/page/region/observation allocation ceilings have isolated at/+1 witnesses', () => {
  for (const collection of ['bones', 'slots', 'skins', 'animations']) {
    const plan = success(namesInput(collection, 4096)).value;
    assert.equal(plan.names[collection].length, 4096);
    assert.deepEqual([plan.names[collection][0], plan.names[collection].at(-1)], ['n0', 'n4095']);
    const request = namesInput(collection, 4097);
    const pointer = collection === 'animations' ? '/animations/n4096' : '/' + collection + '/4096/name';
    failure(request, fatal('SPINE_LIMIT_EXCEEDED', 'skeleton', pointer,
      skeletonSpan(request.skeleton.text.lastIndexOf('"n4096"'), 7)));
  }
  assert.equal(success(atlasPages(64)).value.pages.length, 64);
  const pages = atlasPages(65), lastPageOffset = pages.atlas.text.lastIndexOf('p64.png');
  failure(pages, fatal('SPINE_LIMIT_EXCEEDED', 'atlas', '/pages/64', atlasSpan(lastPageOffset, 7, 193)));
  assert.equal(success(atlasRegions(8192)).value.pages[0].regions.length, 8192);
  const regions = atlasRegions(8193), lastRegionOffset = regions.atlas.text.lastIndexOf('r8192');
  failure(regions, fatal('SPINE_LIMIT_EXCEEDED', 'atlas', '/pages/0/regions/8192', atlasSpan(lastRegionOffset, 5, 16387)));
  assert.equal(success(observationsInput(4096)).value.observations.length, 4096);
  const markers = observationsInput(4097);
  failure(markers, fatal('SPINE_LIMIT_EXCEEDED', 'skeleton', '/u4096',
    skeletonSpan(markers.skeleton.text.lastIndexOf('"u4096"'), 7)));
});

test('SP1-A observation value threshold omits oversized/non-string values without dropping markers', () => {
  for (const value of ['x'.repeat(4096), 'x'.repeat(4097), null, { original: true }]) {
    const observation = success(jsonInput({ originalMarker: value })).value.observations[0];
    assert.equal(observation.kind, 'unknown-root-field');
    assert.equal(observation.pointer, '/originalMarker');
    const preserved = typeof value === 'string' && value.length === 4096;
    assert.equal(Object.hasOwn(observation, 'value'), preserved);
    if (preserved) assert.equal(observation.value, value);
  }
});

test('SP1-A packed/original dimension and index limits distinguish integer admission from containment', () => {
  for (const dimension of [0, 1]) {
    const size = dimension === 0 ? '16384,16' : '16,16384';
    assert.equal(success(input(MINIMAL_SKELETON, `page.png\nsize: ${size}\n`))
      .value.pages[0][dimension === 0 ? 'width' : 'height'], 16384);
    const line = `size: ${dimension === 0 ? '16385,16' : '16,16385'}`;
    failure(input(MINIMAL_SKELETON, `page.png\n${line}\n`),
      fatal('SPINE_LIMIT_EXCEEDED', 'atlas', '/pages/0/size', atlasSpan(9, line.length, 2)));
  }
  for (const axis of [0, 1]) {
    for (const [ceiling, code] of [[16384, 'SPINE_ATLAS_SYNTAX'], [16385, 'SPINE_LIMIT_EXCEEDED']]) {
      const tuple = axis === 0 ? `${ceiling},0,1,1` : `0,${ceiling},1,1`, line = 'bounds: ' + tuple;
      failure(input(MINIMAL_SKELETON, `page.png\nsize: 16384,16384\nsprite\n${line}\n`),
        fatal(code, 'atlas', '/pages/0/regions/0/bounds', atlasSpan(34, line.length, 4)));
    }
    for (const [ceiling, admitted] of [[16384, true], [16385, false]]) {
      const tuple = axis === 0 ? `0,0,${ceiling},1` : `0,0,1,${ceiling}`, line = 'bounds: ' + tuple;
      const request = input(MINIMAL_SKELETON, `page.png\nsize: 16384,16384\nsprite\n${line}\n`);
      if (admitted) assert.equal(success(request).value.pages[0].regions[0][axis === 0 ? 'width' : 'height'], ceiling);
      else failure(request, fatal('SPINE_LIMIT_EXCEEDED', 'atlas', '/pages/0/regions/0/bounds', atlasSpan(34, line.length, 4)));
    }
    for (const [ceiling, code] of [[16384, 'SPINE_ATLAS_SYNTAX'], [16385, 'SPINE_LIMIT_EXCEEDED']]) {
      const tuple = axis === 0 ? `${ceiling},0,16384,1` : `0,${ceiling},1,16384`, line = 'offsets: ' + tuple;
      failure(input(MINIMAL_SKELETON, pageAtlas([], ['bounds: 0,0,1,1', line])),
        fatal(code, 'atlas', '/pages/0/regions/0/offsets', atlasSpan(44, line.length, 5)));
    }
    for (const [ceiling, admitted] of [[16384, true], [16385, false]]) {
      const tuple = axis === 0 ? `0,0,${ceiling},1` : `0,0,1,${ceiling}`, line = 'offsets: ' + tuple;
      const request = input(MINIMAL_SKELETON, pageAtlas([], ['bounds: 0,0,1,1', line]));
      if (admitted) assert.equal(success(request).value.pages[0].regions[0][axis === 0 ? 'originalWidth' : 'originalHeight'], ceiling);
      else failure(request, fatal('SPINE_LIMIT_EXCEEDED', 'atlas', '/pages/0/regions/0/offsets', atlasSpan(44, line.length, 5)));
    }
  }
  assert.equal(success(input(MINIMAL_SKELETON, pageAtlas([], ['bounds: 0,0,1,1', 'index: 2147483647'])))
    .value.pages[0].regions[0].index, 2147483647);
  failure(input(MINIMAL_SKELETON, pageAtlas([], ['bounds: 0,0,1,1', 'index: 2147483648'])),
    fatal('SPINE_LIMIT_EXCEEDED', 'atlas', '/pages/0/regions/0/index', atlasSpan(44, 17, 5)));
});

test('SP1-A record descriptors refuse at their containing pointer without calling getters', () => {
  const cases = [
    [request => { request.extra = 0; }, ''],
    [request => { request.limits = {}; }, ''],
    [request => { request.callback = () => { throw new Error('not invoked'); }; }, ''],
    [request => { request[Symbol('original')] = 0; }, ''],
    [request => { Object.setPrototypeOf(request, { inherited: true }); }, ''],
    [request => { delete request.skeleton.id; }, '/skeleton'],
    [request => { request.skeleton.extra = 0; }, '/skeleton'],
    [request => { request.atlas.extra = 0; }, '/atlas'],
    [request => { request.pages[0].extra = 0; }, '/pages/0'],
    [request => { request.skeleton.provenance.extra = 0; }, '/skeleton/provenance'],
    [request => { delete request.pages[0].provenance.notice; }, '/pages/0/provenance'],
    [request => { Object.defineProperty(request.skeleton, 'text', { value: request.skeleton.text, enumerable: false }); }, '/skeleton'],
    [request => { request.pages = Array(1); }, '/pages'],
    [request => { request.pages.extra = 0; }, '/pages'],
    [request => { request.pages[Symbol('original')] = 0; }, '/pages'],
    [request => { Object.setPrototypeOf(request.pages, null); }, '/pages']
  ];
  for (const [mutate, pointer] of cases) {
    const request = input(); mutate(request);
    failure(request, { code: 'SPINE_INPUT_INVALID', source: 'input', pointer, noSpans: true });
  }
  for (const [select, field, pointer] of [
    [request => request.skeleton, 'text', '/skeleton'],
    [request => request.atlas, 'text', '/atlas'],
    [request => request.pages[0], 'assetId', '/pages/0'],
    [request => request.skeleton.provenance, 'origin', '/skeleton/provenance'],
    [request => request.pages, '0', '/pages']
  ]) {
    const request = input(); let reads = 0;
    Object.defineProperty(select(request), field, {
      enumerable: true, configurable: true,
      get() { reads++; throw new Error('PRIVATE_GETTER_SENTINEL'); }
    });
    const diagnostic = failure(request, { code: 'SPINE_INPUT_INVALID', source: 'input', pointer, noSpans: true });
    assert.equal(reads, 0);
    assert.ok(!diagnostic.message.includes('PRIVATE_GETTER_SENTINEL'));
  }
  for (const trap of ['getPrototypeOf', 'ownKeys', 'getOwnPropertyDescriptor']) {
    const request = input();
    request.skeleton = new Proxy(request.skeleton, { [trap]() { throw new Error('PRIVATE_REFLECTION_SENTINEL'); } });
    const diagnostic = failure(request, { code: 'SPINE_INPUT_INVALID', source: 'input', pointer: '/skeleton', noSpans: true });
    assert.ok(!diagnostic.message.includes('PRIVATE_REFLECTION_SENTINEL'));
  }
});

test('SP1-A primitive metadata failure uses field pointers and fixed source-free messages', () => {
  for (const [mutate, pointer] of [
    [request => { request.skeleton.text = 17; }, '/skeleton/text'],
    [request => { request.atlas.text = null; }, '/atlas/text'],
    [request => { request.skeleton.id = ''; }, '/skeleton/id'],
    [request => { request.atlas.id = 17; }, '/atlas/id'],
    [request => { request.pages[0].assetId = { id: 'structural-lookalike' }; }, '/pages/0/assetId'],
    [request => { request.pages[0].pageName = 17; }, '/pages/0/pageName'],
    [request => { request.skeleton.provenance.origin = ''; }, '/skeleton/provenance/origin'],
    [request => { request.atlas.provenance.license = 17; }, '/atlas/provenance/license'],
    [request => { request.pages[0].provenance.notice = ''; }, '/pages/0/provenance/notice'],
    [request => { request.skeleton.provenance.sha256 = 'A'.repeat(64); }, '/skeleton/provenance/sha256'],
    [request => { request.atlas.provenance.sha256 = 'a'.repeat(63); }, '/atlas/provenance/sha256'],
    [request => { request.skeleton.id = '\ud800'; }, '/skeleton/id'],
    [request => { request.pages[0].assetId = '\udc00'; }, '/pages/0/assetId']
  ]) {
    const request = input(); mutate(request);
    failure(request, { code: 'SPINE_INPUT_INVALID', source: 'input', pointer, noSpans: true });
  }
  const opaque = input(); opaque.skeleton.id = ' '; opaque.pages[0].assetId = '$(opaque:original)';
  const plan = success(opaque).value;
  assert.equal(plan.sourceDeclarations.skeleton.id, ' ');
  assert.equal(plan.pages[0].assetId, '$(opaque:original)');
  const messages = [];
  for (const value of ['RAW_SECRET_A', 'RAW_SECRET_B']) {
    const request = input(`{"skeleton":{"spine":"${value}"}}`);
    const diagnostic = failure(request, fatal('SPINE_VERSION_INVALID', 'skeleton', '/skeleton/spine', skeletonSpan(21, value.length + 2)));
    assert.ok(!diagnostic.message.includes(value)); messages.push(diagnostic.message);
  }
  assert.equal(messages[0], messages[1], 'fixed English template is independent of source text');
});

test('SP1-A metadata and complete source admission precede scanner and later warnings', () => {
  const binding = input('{'); binding.pages[0].assetId = 17;
  failure(binding, { code: 'SPINE_INPUT_INVALID', source: 'input', pointer: '/pages/0/assetId', noSpans: true });
  const atlasMetadata = input('{'); atlasMetadata.atlas.text = 17;
  failure(atlasMetadata, { code: 'SPINE_INPUT_INVALID', source: 'input', pointer: '/atlas/text', noSpans: true });
  const atlasUnicode = input('{', '\ud800');
  failure(atlasUnicode, { code: 'SPINE_ATLAS_SYNTAX', source: 'atlas', pointer: '', noSpans: true });
  const concern = input(PROFILE_SKELETON, PROFILE_ATLAS, []);
  failure(concern, fatal('SPINE_PAGE_BINDING_INVALID', 'atlas', '/pages/0', PAGE_SPAN));
});

test('SP1-A decoded invalid Unicode keys refuse at admitted parents rather than invalid pointers', () => {
  failure(input('{"skeleton":{"spine":"4.3.13"},"\\ud800":0}'),
    fatal('SPINE_JSON_SYNTAX', 'skeleton', '', skeletonSpan(31, 8)));
  failure(input('{"skeleton":{"spine":"4.3.13"},"outer":{"\\ud800":0}}'),
    fatal('SPINE_JSON_SYNTAX', 'skeleton', '/outer', skeletonSpan(40, 8)));
});

test('SP1-A names are schema declarations with escaped duplicate locations, not resolved links', () => {
  const duplicate = '{"skeleton":{"spine":"4.3.13"},"bones":[{"name":"same"},{"name":"same"}]}';
  failure(input(duplicate), fatal('SPINE_JSON_SCHEMA', 'skeleton', '/bones/1/name',
    skeletonSpan(64, 6), skeletonSpan(48, 6)));
  for (const collection of ['slots', 'skins']) {
    const record = collection === 'slots' ? { name: 'same', bone: 'declared-only' } : { name: 'same' };
    const request = jsonInput({ [collection]: [{ ...record }, { ...record }] });
    failure(request, fatal('SPINE_JSON_SCHEMA', 'skeleton', '/' + collection + '/1/name',
      skeletonSpan(request.skeleton.text.lastIndexOf('"same"'), 6),
      skeletonSpan(request.skeleton.text.indexOf('"same"'), 6)));
  }
  for (const collection of ['bones', 'slots', 'skins']) {
    const record = collection === 'slots' ? { name: '', bone: 'missing:declared' } : { name: '' };
    const request = jsonInput({ [collection]: [record] });
    failure(request, fatal('SPINE_JSON_SCHEMA', 'skeleton', '/' + collection + '/0/name',
      skeletonSpan(request.skeleton.text.indexOf('""'), 2)));
  }
  failure(input('{"skeleton":{"spine":"4.3.13"},"animations":{"":{}}}'),
    fatal('SPINE_JSON_SCHEMA', 'skeleton', '/animations/', skeletonSpan(45, 2)));
  success(jsonInput({ bones: [{ name: 'unresolved/root' }],
    slots: [{ name: 'unresolved/slot', bone: 'no-linked-bone' }],
    skins: [{ name: 'unresolved/skin' }], animations: { declared: { unvalidatedNumeric: 0.5 } } }));
  const opaqueNames = success(jsonInput({ bones: [{ name: 'bone:opaque' }],
    slots: [{ name: 'slot/opaque~', bone: 'unresolved:bone' }],
    skins: [{ name: 'skin:opaque' }], animations: { 'animation:opaque': {} } })).value.names;
  assert.deepEqual(plain(opaqueNames), {
    bones: ['bone:opaque'], slots: ['slot/opaque~'], skins: ['skin:opaque'], animations: ['animation:opaque']
  });
  for (const attachments of [[], { slot: [] }, { slot: { sprite: [] } }]) {
    const request = jsonInput({ skins: [{ name: 'other', attachments }] });
    const depth = Array.isArray(attachments) ? '' : Array.isArray(attachments.slot) ? '/slot' : '/slot/sprite';
    failure(request, fatal('SPINE_JSON_SCHEMA', 'skeleton', '/skins/0/attachments' + depth,
      skeletonSpan(request.skeleton.text.indexOf('[' , request.skeleton.text.indexOf('"attachments"')), 1)));
  }
  for (const slots of [[], { slot: [] }]) {
    const request = jsonInput({ animations: { later: { slots } } });
    const depth = Array.isArray(slots) ? '' : '/slot';
    failure(request, fatal('SPINE_JSON_SCHEMA', 'skeleton', '/animations/later/slots' + depth,
      skeletonSpan(request.skeleton.text.lastIndexOf('['), 1)));
  }
});

test('SP1-A atlas names, fields and indexed identities retain precise original refusal lines', () => {
  failure(input(MINIMAL_SKELETON, ''), { code: 'SPINE_ATLAS_SYNTAX', source: 'atlas', pointer: '', noSpans: true });
  failure(input(MINIMAL_SKELETON, 'page.png\n'), fatal('SPINE_ATLAS_SYNTAX', 'atlas', '/pages/0/size', PAGE_SPAN));
  failure(input(MINIMAL_SKELETON, pageAtlas([], ['index: 0'])),
    fatal('SPINE_ATLAS_SYNTAX', 'atlas', '/pages/0/regions/0/bounds', REGION_SPAN));
  failure(input(MINIMAL_SKELETON, 'size: 16,16\n'),
    fatal('SPINE_ATLAS_PROFILE_UNSUPPORTED', 'atlas', '', atlasSpan(0, 11, 1)));
  failure(input(MINIMAL_SKELETON, 'orphan: original\n'),
    fatal('SPINE_ATLAS_SYNTAX', 'atlas', '', atlasSpan(0, 16, 1)));
  failure(input(MINIMAL_SKELETON, pageAtlas([], ['xy: 0,0'])),
    fatal('SPINE_ATLAS_PROFILE_UNSUPPORTED', 'atlas', '/pages/0/regions/0/xy', atlasSpan(28, 7, 4)));
  failure(input(MINIMAL_SKELETON, pageAtlas(['custom: '], null)),
    fatal('SPINE_ATLAS_SYNTAX', 'atlas', '/pages/0/custom', atlasSpan(21, 7, 3)));
  failure(input(MINIMAL_SKELETON, 'page.png\nsize: 16,16\nsize: 16,16\n'),
    fatal('SPINE_ATLAS_DUPLICATE', 'atlas', '/pages/0/size', atlasSpan(21, 11, 3), atlasSpan(9, 11, 2)));
  failure(input(MINIMAL_SKELETON, pageAtlas([], ['bounds: 0,0,1,1', 'bounds: 0,0,1,1'])),
    fatal('SPINE_ATLAS_DUPLICATE', 'atlas', '/pages/0/regions/0/bounds', atlasSpan(44, 15, 5), atlasSpan(28, 15, 4)));
  failure(input(MINIMAL_SKELETON, pageAtlas([], ['bounds: 0,0,1,1', 'sprite', 'bounds: 0,0,1,1'])),
    fatal('SPINE_ATLAS_DUPLICATE', 'atlas', '/pages/0/regions/1/name', atlasSpan(44, 6, 5), REGION_SPAN));
  failure(input(MINIMAL_SKELETON, 'page.png\nsize: 16,16\n\nPAGE.png\nsize: 16,16\n'),
    fatal('SPINE_ATLAS_DUPLICATE', 'atlas', '/pages/1/name', atlasSpan(22, 8, 4), PAGE_SPAN));
  failure(input(MINIMAL_SKELETON, 'é.png\nsize: 16,16\n\ne\u0301.png\nsize: 16,16\n'),
    fatal('SPINE_ATLAS_DUPLICATE', 'atlas', '/pages/1/name', atlasSpan(19, 6, 4), atlasSpan(0, 5, 1)));
  for (const name of ['../p.png', '/p.png', 'a\\b.png', 'CON.png', 'a/NUL.txt', 'a /p.png']) {
    failure(input(MINIMAL_SKELETON, `${name}\nsize: 16,16\n`),
      fatal('SPINE_ATLAS_SYNTAX', 'atlas', '/pages/0/name', atlasSpan(0, name.length, 1)));
  }
  const trimmed = ' \tpage.png\t  \n size: 16,16 \n';
  const page = success(input(MINIMAL_SKELETON, trimmed)).value.pages[0];
  assert.equal(page.name, 'page.png');
  assert.deepEqual(plain(page.span), atlasSpan(2, 8, 1, 3));
});

test('SP1-A name/path byte ceilings cover JSON, atlas and input without lossy normalization', () => {
  const bone = '界'.repeat(341) + 'a';
  assert.equal(Buffer.byteLength(bone), 1024);
  assert.equal(success(jsonInput({ bones: [{ name: bone }] })).value.names.bones[0], bone);
  const longBone = bone + 'b', request = jsonInput({ bones: [{ name: longBone }] });
  failure(request, fatal('SPINE_LIMIT_EXCEEDED', 'skeleton', '/bones/0/name',
    skeletonSpan(request.skeleton.text.indexOf(JSON.stringify(longBone)), longBone.length + 2)));
  const region = 'r'.repeat(1024);
  assert.equal(success(input(MINIMAL_SKELETON, `page.png\nsize: 16,16\n${region}\nbounds: 0,0,1,1\n`))
    .value.pages[0].regions[0].name, region);
  failure(input(MINIMAL_SKELETON, `page.png\nsize: 16,16\n${region}r\nbounds: 0,0,1,1\n`),
    fatal('SPINE_LIMIT_EXCEEDED', 'atlas', '/pages/0/regions/0/name', atlasSpan(21, 1025, 3)));
  const page = 'p'.repeat(1020) + '.png';
  const binding = { pageName: page, assetId: 'original:page', provenance: provenance() };
  assert.equal(success(input(MINIMAL_SKELETON, `${page}\nsize: 16,16\n`, [binding])).value.pages[0].name, page);
  const longPage = page + 'x';
  failure(input(MINIMAL_SKELETON, `${longPage}\nsize: 16,16\n`),
    fatal('SPINE_LIMIT_EXCEEDED', 'atlas', '/pages/0/name', atlasSpan(0, 1025, 1)));
  failure(input(MINIMAL_SKELETON, BASE_ATLAS, [{ ...binding, pageName: longPage }]),
    { code: 'SPINE_LIMIT_EXCEEDED', source: 'input', pointer: '/pages/0/pageName', noSpans: true });
});

test('SP1-A per-page/per-region field and original-line budgets refuse before field expansion', () => {
  for (const region of [false, true]) {
    const fields = Array.from({ length: 31 }, (_, i) => `e${i}: 0`);
    const atlas = region ? pageAtlas([], ['bounds: 0,0,1,1', ...fields]) : pageAtlas(fields, null);
    const section = region ? '/pages/0/regions/0' : '/pages/0';
    const plan = success(input(MINIMAL_SKELETON, atlas)).value;
    assert.equal((region ? plan.pages[0].regions[0] : plan.pages[0]).extraFields.length, 31);
    const last = 'e31: 0', over = region ? pageAtlas([], ['bounds: 0,0,1,1', ...fields, last]) : pageAtlas([...fields, last], null);
    failure(input(MINIMAL_SKELETON, over), fatal('SPINE_LIMIT_EXCEEDED', 'atlas', section,
      atlasSpan(over.lastIndexOf(last), 6, region ? 36 : 34)));
  }
  const line = 'custom: ' + 'x'.repeat(4088);
  assert.equal(line.length, 4096);
  const plan = success(input(MINIMAL_SKELETON, pageAtlas([line], null))).value;
  assert.equal(plan.pages[0].extraFields[0].value.length, 4088);
  failure(input(MINIMAL_SKELETON, pageAtlas([line + 'x'], null)),
    fatal('SPINE_LIMIT_EXCEEDED', 'atlas', '/pages/0', atlasSpan(21, 4097, 3)));
  const numeric = 'bounds: 0,0,16385,1';
  for (const [length, pointer] of [[4096, '/pages/0/regions/0/bounds'], [4097, '/pages/0/regions/0']]) {
    const raw = numeric + ' '.repeat(length - 19);
    failure(input(MINIMAL_SKELETON, pageAtlas([], [raw])),
      fatal('SPINE_LIMIT_EXCEEDED', 'atlas', pointer, atlasSpan(28, 19, 4)));
  }
});

test('SP1-A ordinary malformed inputs are total refusals rather than thrown setup errors', () => {
  for (const request of [undefined, null, 17, 'original', true, []]) {
    failure(request, { code: 'SPINE_INPUT_INVALID', source: 'input', pointer: '', noSpans: true });
  }
});

test('SP1-A CRLF duplicate positions use original UTF16 coordinates, not decoded callbacks', () => {
  const text = '{\r\n "skeleton":{"spine":"4.3.13"},\r\n "a":1,\r\n "a":2\r\n}';
  failure(input(text), {
    code: 'SPINE_JSON_DUPLICATE_KEY', source: 'skeleton', pointer: '/a',
    span: { source: 'skeleton', sourceId: 'skeleton-original', offset: 46, length: 3, line: 4, column: 2 },
    relatedSpan: { source: 'skeleton', sourceId: 'skeleton-original', offset: 37, length: 3, line: 3, column: 2 }
  });
});

test('SP1-A absent attachment type and primitive feature markers remain unvalidated declarations', () => {
  const plainRegion = jsonInput({ skins: [{ name: 'default', attachments: { slot: { sprite: {} } } }] });
  const observation = success(plainRegion).value.observations[0];
  assert.deepEqual(plain(observation), {
    kind: 'attachment-type', pointer: '/skins/0/attachments/slot/sprite/type',
    span: skeletonSpan(90, 1), value: 'region'
  });
  const request = jsonInput({
    slots: [{ name: 'slot', bone: 'declared-only', dark: { unvalidated: true } }],
    skins: [{ name: 'alternate', attachments: { slot: { sprite: { sequence: 'declared-only' } } } }],
    animations: { later: { slots: { slot: { rgba2: 17, rgb2: null } } } }
  });
  const plan = success(request).value;
  assert.deepEqual(plan.observations.map(marker => [marker.kind, marker.pointer,
    ...(Object.hasOwn(marker, 'value') ? [marker.value] : [])]), [
    ['slot-dark', '/slots/0/dark'],
    ['attachment-type', '/skins/0/attachments/slot/sprite/type', 'region'],
    ['attachment-sequence', '/skins/0/attachments/slot/sprite/sequence', 'declared-only'],
    ['dark-timeline', '/animations/later/slots/slot/rgba2'],
    ['dark-timeline', '/animations/later/slots/slot/rgb2']
  ]);
});

test('SP1-A JSON observations preserve authored property order, including numeric-looking names', () => {
  const text = '{"skeleton":{"spine":"4.3.13"},"9":0,"2":0}';
  const markers = success(input(text)).value.observations;
  assert.deepEqual(markers.map(marker => [marker.kind, marker.pointer]),
    [['unknown-root-field', '/9'], ['unknown-root-field', '/2']]);
  assert.deepEqual(plain(markers.map(marker => marker.span)), [skeletonSpan(31, 3), skeletonSpan(37, 3)]);
  assert.equal(Object.hasOwn(Object.prototype, 'SP1_ORIGINAL_SENTINEL'), false);
  success(input('{"skeleton":{"spine":"4.3.13"},"__proto__":{"SP1_ORIGINAL_SENTINEL":true}}'));
  assert.equal(Object.hasOwn(Object.prototype, 'SP1_ORIGINAL_SENTINEL'), false);
});

test('SP1-A split/pad/custom fields preserve authored order and raw values without UI interpretation', () => {
  const atlas = pageAtlas([], ['bounds: 0,0,1,1', 'split: 1, 2,3,4', 'pad: 0,0,0,0', 'custom:  7, 8 ']);
  const plan = success(input(MINIMAL_SKELETON, atlas)).value;
  assert.deepEqual(plain(plan.pages[0].regions[0].extraFields), [
    { key: 'split', value: '1, 2,3,4', span: atlasSpan(44, 15, 5) },
    { key: 'pad', value: '0,0,0,0', span: atlasSpan(60, 12, 6) },
    { key: 'custom', value: '7, 8', span: atlasSpan(73, 13, 7) }
  ]);
  assert.deepEqual(plan.observations.map(marker => [marker.kind, marker.pointer, marker.value]), [
    ['extra-atlas-field', '/pages/0/regions/0/split', '1, 2,3,4'],
    ['extra-atlas-field', '/pages/0/regions/0/pad', '0,0,0,0'],
    ['extra-atlas-field', '/pages/0/regions/0/custom', '7, 8']
  ]);
});
