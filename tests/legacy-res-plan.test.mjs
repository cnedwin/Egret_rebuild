// Independent literal conversion-intent expectations; no file copying or decoding.
import test from 'node:test';
import assert from 'node:assert/strict';
import { planLegacyResourceManifestConversion as plan } from '../packages/project/dist/legacy-res-plan.js';

const BASE = '{"resources":[{"name":"hero","type":"image","url":"hero.png"},{"name":"settings","type":"json","url":"settings.json"},{"name":"heroAlias","type":"image","url":"hero.png"}],"groups":[{"name":"boot","keys":"hero,settings,hero"},{"name":"alternate","keys":"heroAlias,hero"},{"name":"empty","keys":""}]}';
const EMPTY = '{"resources":[],"groups":[]}';
const ACCEPTANCE = { fileExistence: 'unverified', decoding: 'unverified', execution: 'unverified', migration: 'unverified' };

function resourceText(resource, groups = []) {
  // Input construction only. Expected answers below are authored literals.
  return JSON.stringify({ resources: [resource], groups });
}
function frozen(value) {
  if (value === null || typeof value !== 'object') return;
  assert.equal(Object.isFrozen(value), true);
  for (const member of Object.values(value)) frozen(member);
}
function blocked(result, status, diagnostics) {
  assert.equal(result.planVersion, '0.1');
  assert.equal(result.scope, 'legacy-res-conversion-intents');
  assert.equal(result.status, status);
  assert.equal(result.report.status, status);
  assert.equal(result.plan, null);
  assert.deepEqual(result.report.acceptance, ACCEPTANCE);
  assert.deepEqual(result.report.diagnostics.map(({ code, source, severity, jsonPointer }) =>
    ({ code, source, severity, jsonPointer })), diagnostics);
  frozen(result);
}
function d(code, jsonPointer = '', source = 'text', severity = 'error') {
  return { code, source, severity, jsonPointer };
}

test('P01 literal ordered copy intents, alias references and three groups', () => {
  const result = plan(BASE, 'assets');
  assert.equal(result.planVersion, '0.1');
  assert.equal(result.scope, 'legacy-res-conversion-intents');
  assert.equal(result.status, 'planned');
  assert.equal(result.report.status, 'recognized');
  assert.equal(result.report.originalText, BASE);
  assert.deepEqual(result.report.diagnostics, []);
  assert.deepEqual(result.report.acceptance, ACCEPTANCE);
  assert.deepEqual(result.plan, {
    resourceRoot: 'assets',
    files: [
      { sourcePath: 'assets/hero.png', destinationPath: 'assets/hero.png' },
      { sourcePath: 'assets/settings.json', destinationPath: 'assets/settings.json' },
    ],
    resources: [
      { name: 'hero', type: 'image', fileIndex: 0 },
      { name: 'settings', type: 'json', fileIndex: 1 },
      { name: 'heroAlias', type: 'image', fileIndex: 0 },
    ],
    groups: [
      { name: 'boot', resourceIndices: [0, 1, 0] },
      { name: 'alternate', resourceIndices: [2, 0] },
      { name: 'empty', resourceIndices: [] },
    ],
  });
  frozen(result);
});

test('P02 equal-path image/json retain separate types and share one copy intent', () => {
  const text = '{"resources":[{"name":"picture","type":"image","url":"shared.dat"},{"name":"data","type":"json","url":"shared.dat"}],"groups":[{"name":"both","keys":"data,picture,data"}]}';
  const result = plan(text, 'res/local');
  assert.equal(result.status, 'planned');
  assert.deepEqual(result.plan, {
    resourceRoot: 'res/local',
    files: [{ sourcePath: 'res/local/shared.dat', destinationPath: 'res/local/shared.dat' }],
    resources: [
      { name: 'picture', type: 'image', fileIndex: 0 },
      { name: 'data', type: 'json', fileIndex: 0 },
    ],
    groups: [{ name: 'both', resourceIndices: [1, 0, 1] }],
  });
  assert.deepEqual(result.report.acceptance, ACCEPTANCE);
});

test('P03 same input yields equal data and fresh deeply frozen ownership', () => {
  const a = plan(BASE, 'assets');
  const b = plan(BASE, 'assets');
  assert.deepEqual(a, b);
  for (const [left, right] of [
    [a, b], [a.report, b.report], [a.report.diagnostics, b.report.diagnostics],
    [a.report.acceptance, b.report.acceptance], [a.plan, b.plan],
    [a.plan.files, b.plan.files], [a.plan.files[0], b.plan.files[0]],
    [a.plan.resources, b.plan.resources], [a.plan.resources[0], b.plan.resources[0]],
    [a.plan.groups, b.plan.groups], [a.plan.groups[0], b.plan.groups[0]],
    [a.plan.groups[0].resourceIndices, b.plan.groups[0].resourceIndices],
  ]) assert.notStrictEqual(left, right);
  frozen(a); frozen(b);
  assert.throws(() => { a.plan.files[0].sourcePath = 'changed'; }, TypeError);
  assert.throws(() => { a.plan.groups[0].resourceIndices.push(99); }, TypeError);
});

test('P04 recognized empty declarations yield a nonnull empty plan', () => {
  const result = plan(EMPTY, 'res');
  assert.equal(result.status, 'planned');
  assert.deepEqual(result.plan, { resourceRoot: 'res', files: [], resources: [], groups: [] });
  frozen(result);
});

test('P05 primitive text/root admission does not read or coerce foreign objects', () => {
  let touches = 0;
  const hostile = new Proxy({}, { get() { touches++; throw new Error('foreign read'); } });
  const lookalike = { status: 'recognized', resources: [], groups: [] };
  blocked(plan(hostile, hostile), 'invalid', [d('LEGACY_RES_INPUT_INVALID')]);
  blocked(plan(lookalike, 'res'), 'invalid', [d('LEGACY_RES_INPUT_INVALID')]);
  for (const root of [null, undefined, 0, false, [], hostile, new String('res')]) {
    blocked(plan(EMPTY, root), 'invalid', [d('LEGACY_RES_INPUT_INVALID', '', 'resourceRoot')]);
  }
  assert.equal(touches, 0);
});

test('P06 root portability, Unicode and exact limits are inherited', () => {
  for (const root of ['', '/res', 'res/', 'res//sub', '.', '..', '../res', 'res/../sub', 'res\\sub', 'C:/res', 'https://host/res', 'res?', 'res ', 'res.', 'CON', 'res/NUL', 'res/\u0000']) {
    blocked(plan(EMPTY, root), 'invalid', [d('LEGACY_RES_PATH_INVALID', '', 'resourceRoot')]);
  }
  blocked(plan(EMPTY, '\ud800'), 'invalid', [d('LEGACY_RES_INPUT_INVALID', '', 'resourceRoot')]);
  blocked(plan(EMPTY, 'r'.repeat(1025)), 'invalid', [d('LEGACY_RES_PATH_INVALID', '', 'resourceRoot')]);
  blocked(plan(EMPTY, 'r'.repeat(4097)), 'invalid', [d('LEGACY_RES_LIMIT_EXCEEDED', '', 'resourceRoot')]);
  assert.equal(plan(EMPTY, 'r'.repeat(1024)).status, 'planned');
  // After primitive/Unicode gates, JSON syntax still precedes path semantics.
  blocked(plan('{', '../res'), 'invalid', [d('LEGACY_RES_SYNTAX_INVALID')]);
});

test('P07 literal nested prefix, total join limit and collision admission', () => {
  const result = plan(resourceText({ name: 'one', type: 'image', url: 'icons/one.png' }), 'res/local');
  assert.deepEqual(result.plan.files, [{ sourcePath: 'res/local/icons/one.png', destinationPath: 'res/local/icons/one.png' }]);
  const short = resourceText({ name: 'one', type: 'image', url: 'x' });
  assert.equal(plan(short, 'r'.repeat(1022)).status, 'planned');
  blocked(plan(short, 'r'.repeat(1023)), 'invalid', [d('LEGACY_RES_PATH_INVALID', '/resources/0/url')]);
  for (const pair of [['A.png', 'a.png'], ['\u00e9.png', 'e\u0301.png']]) {
    const text = JSON.stringify({ resources: [
      { name: 'one', type: 'image', url: pair[0] },
      { name: 'two', type: 'image', url: pair[1] },
    ], groups: [] });
    blocked(plan(text, 'res'), 'invalid', [d('LEGACY_RES_PATH_COLLISION', '/resources/1/url')]);
  }
});

test('P08 malformed required declarations and duplicate names have no plan', () => {
  blocked(plan('{"resources":[{"name":"one","type":"image"}],"groups":[]}', 'res'), 'invalid', [d('LEGACY_RES_INPUT_INVALID', '/resources/0/url')]);
  blocked(plan('{"resources":[{"name":"one","type":"image","url":"a.png"},{"name":"one","type":"image","url":"b.png"}],"groups":[]}', 'res'), 'invalid', [d('LEGACY_RES_NAME_DUPLICATE', '/resources/1/name')]);
  blocked(plan('{"resources":[],"groups":[{"name":"g","keys":""},{"name":"g","keys":""}]}', 'res'), 'invalid', [d('LEGACY_RES_NAME_DUPLICATE', '/groups/1/name')]);
  blocked(plan('{"resources":[],"groups":[],"extension":true,}', 'res'), 'invalid', [d('LEGACY_RES_SYNTAX_INVALID')]);
});

test('P09 every resource unsupported feature blocks all intents', () => {
  const cases = [
    [{ name: 'one', type: 'sheet', url: 'one.png' }, 'LEGACY_RES_TYPE_UNSUPPORTED', '/resources/0/type'],
    [{ name: 'one', type: 'image', url: 'https://host/one.png' }, 'LEGACY_RES_URL_UNSUPPORTED', '/resources/0/url'],
    [{ name: 'one', type: 'image', url: '//host/one.png' }, 'LEGACY_RES_URL_UNSUPPORTED', '/resources/0/url'],
    [{ name: 'one', type: 'image', url: 'one.png?x' }, 'LEGACY_RES_URL_UNSUPPORTED', '/resources/0/url'],
    [{ name: 'one', type: 'image', url: 'one%2epng' }, 'LEGACY_RES_URL_UNSUPPORTED', '/resources/0/url'],
    [{ name: 'one', type: 'image', url: 'one.png', subkeys: '' }, 'LEGACY_RES_SUBKEYS_UNSUPPORTED', '/resources/0/subkeys'],
    [{ name: 'one', type: 'image', url: 'one.png', scale9grid: '1,1,2,2' }, 'LEGACY_RES_SCALE9GRID_UNSUPPORTED', '/resources/0/scale9grid'],
  ];
  for (const [resource, code, pointer] of cases) {
    const result = plan(resourceText(resource), 'res');
    blocked(result, 'unsupported', [d(code, pointer, 'text', 'warning')]);
    assert.equal(result.report.resources.length, 1);
  }
});

test('P10 unresolved comma tokens retain diagnostic order and never partial intents', () => {
  const text = resourceText({ name: 'hero', type: 'image', url: 'hero.png' }, [
    { name: 'first', keys: 'hero,missing' }, { name: 'second', keys: ' hero,,hero' },
  ]);
  blocked(plan(text, 'res'), 'unsupported', [
    d('LEGACY_RES_REFERENCE_UNRESOLVED', '/groups/0/keys', 'text', 'warning'),
    d('LEGACY_RES_REFERENCE_UNRESOLVED', '/groups/1/keys', 'text', 'warning'),
    d('LEGACY_RES_REFERENCE_UNRESOLVED', '/groups/1/keys', 'text', 'warning'),
  ]);
});

test('P11 unknown schema is whole unsupported; required invalid URL wins first', () => {
  const text = '{"resources":[],"groups":[],"extension":1}';
  const result = plan(text, 'res');
  blocked(result, 'unsupported', [d('LEGACY_RES_SCHEMA_UNSUPPORTED', '/extension', 'text', 'warning')]);
  assert.equal(result.report.originalText, text);
  assert.deepEqual(result.report.resources, []);
  blocked(plan('{"resources":[{"name":"one","type":"image","url":"../one.png","extension":true}],"groups":[]}', 'res'), 'invalid', [d('LEGACY_RES_PATH_INVALID', '/resources/0/url')]);
});

test('P12 literal resource warning order precedes group warnings', () => {
  const text = resourceText({ name: 'one', type: 'sheet', url: 'one.png?x', subkeys: 'a', scale9grid: '' }, [{ name: 'g', keys: 'missing' }]);
  blocked(plan(text, 'res'), 'unsupported', [
    d('LEGACY_RES_TYPE_UNSUPPORTED', '/resources/0/type', 'text', 'warning'),
    d('LEGACY_RES_URL_UNSUPPORTED', '/resources/0/url', 'text', 'warning'),
    d('LEGACY_RES_SUBKEYS_UNSUPPORTED', '/resources/0/subkeys', 'text', 'warning'),
    d('LEGACY_RES_SCALE9GRID_UNSUPPORTED', '/resources/0/scale9grid', 'text', 'warning'),
    d('LEGACY_RES_REFERENCE_UNRESOLVED', '/groups/0/keys', 'text', 'warning'),
  ]);
});

test('P13 invalid local URL forms remain invalid even with an opaque suffix', () => {
  for (const url of ['', '/one.png?x', 'one\\x?y', 'C:/one.png', '../one.png', 'one//two']) {
    blocked(plan(resourceText({ name: 'one', type: 'image', url }), 'res'), 'invalid', [d('LEGACY_RES_PATH_INVALID', '/resources/0/url')]);
  }
});

test('P14 incomplete analyzer outcome forwards without plan or cause coercion', { concurrency: false }, () => {
  // The actual strict parser calls native JSON.parse synchronously after validation.
  // No await, no child process, no product injection seam; always restore first.
  const savedParse = JSON.parse;
  let interceptions = 0;
  let coercions = 0;
  const cause = { [Symbol.toPrimitive]() { coercions++; throw new Error('coerced fault'); } };
  let result;
  try {
    JSON.parse = function (text, ...args) {
      if (text === EMPTY) { interceptions++; throw cause; }
      return Reflect.apply(savedParse, this, [text, ...args]);
    };
    result = plan(EMPTY, 'res');
  } finally {
    JSON.parse = savedParse;
  }
  assert.strictEqual(JSON.parse, savedParse);
  assert.equal(interceptions, 1);
  assert.equal(coercions, 0);
  blocked(result, 'incomplete', [d('LEGACY_RES_INTERNAL_FAILED')]);
  assert.equal(result.report.originalText, null);
  assert.deepEqual(result.report.resources, []);
});
