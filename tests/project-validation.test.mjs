import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cloneLive } from '../packages/project/dist/live-input.js';
import { readText } from '../packages/project/dist/text-input.js';
import { resolveLimits, DEFAULT_PROJECT_LIMITS } from '../packages/project/dist/limits.js';
import { FORMAT_DEFINITIONS } from '../packages/project/dist/format-shape.generated.js';

const snapshotPort = await import('../packages/project/dist/validate-snapshot.js').catch(() => ({}));
const transactionPort = await import('../packages/project/dist/validate-transaction.js').catch(() => ({}));
const orderPort = await import('../packages/project/dist/validation-order.js').catch(() => ({}));
const shapePort = await import('../packages/project/dist/shape.js').catch(() => ({}));
const pathPort = await import('../packages/project/dist/paths.js').catch(() => ({}));
const cases = JSON.parse(readFileSync(new URL('./fixtures/project/validation-cases.json', import.meta.url), 'utf8'));

const pins = () => ({ engineVersion: '1', resourceFormatVersion: '1', toolProtocolVersion: '1.0' });
const entity = (id = 'e_a', extra = {}) => ({ id, kind: 'scene', dataSchemaVersion: '1', name: '', data: {}, references: [], ...extra });
const file = (id = 'f_a', extra = {}) => ({ id, path: `${id}.ts`, role: 'source', mediaType: 'text/plain', sha256: 'a'.repeat(64), byteLength: 0, ...extra });
const snapshot = (extra = {}) => ({ projectSchemaVersion: '1.0', projectId: 'p_a', revision: 0, name: '', versions: pins(), roots: [], entities: [], files: [], retiredEntityIds: [], retiredFileIds: [], ...extra });
const transaction = (extra = {}) => ({ command: 'edit', toolProtocolVersion: '1.0', projectId: 'p_a', transactionId: 't_a', baseRevision: 0, source: { actorId: 'a', actorKind: 'creator', toolId: 't', toolVersion: '1', intent: '' }, scope: { entityIds: [], fileIds: [], metadata: false, roots: true }, operations: [{ op: 'setRoots', roots: [] }], ...extra });
function limits(overrides) {
  const result = resolveLimits(overrides);
  assert.equal(result.ok, true);
  return result.value;
}
function validate(value, kind = 'snapshot', overrides, prefix = '') {
  const bound = limits(overrides);
  const input = cloneLive(value, kind, bound);
  if (!input.ok) return input;
  const port = kind === 'snapshot' ? snapshotPort.validateSnapshot : transactionPort.validateTransaction;
  assert.equal(typeof port, 'function', `missing validate${kind} port`);
  return port(input.value, { limits: bound, pointerPrefix: prefix });
}
function text(value, kind = 'snapshot', overrides) {
  const bound = limits(overrides);
  const input = readText(value, kind, bound);
  if (!input.ok) return input;
  const port = kind === 'snapshot' ? snapshotPort.validateSnapshot : transactionPort.validateTransaction;
  assert.equal(typeof port, 'function', `missing validate${kind} port`);
  return port(input.value.value, { limits: bound, pointerPrefix: '', numericTokens: input.value.numericTokens });
}
function fail(result, code, pointer) {
  assert.equal(result.ok, false);
  const errors = result.diagnostics.filter(item => item.severity === 'error');
  assert.equal(errors.length, 1);
  assert.deepEqual([errors[0].code, errors[0].jsonPointer], [code, pointer]);
  return errors[0];
}
function success(result) {
  assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
  return result.value;
}

test('literal mixed-invalid code and pointer pairs preserve generated node order', () => {
  for (const item of cases) fail(validate(snapshot(item.changes)), item.code, item.pointer);
  fail(validate(snapshot({ files: [file('f_a', { path: '../x', role: 17 })] })), 'PROJECT_PATH_INVALID', '/files/0/path');
  fail(text(JSON.stringify(snapshot({ name: 17 })).replace('"revision":0', '"revision":9007199254740991.1')), 'PROJECT_LIMIT_EXCEEDED', '/revision');
  fail(validate(transaction({ toolProtocolVersion: '2.0' }), 'transaction'), 'PROJECT_FORMAT_UNSUPPORTED', '/toolProtocolVersion');
  fail(validate(transaction({ source: { ...transaction().source, actorKind: 'robot' } }), 'transaction'), 'PROJECT_INPUT_INVALID', '/source/actorKind');
  fail(validate(snapshot({ files: [file('f_a', { role: 'script' })] })), 'PROJECT_INPUT_INVALID', '/files/0/role');
});

test('the structural probe stays local and the ordered coordinator is real', () => {
  assert.equal(typeof shapePort.inspectShapeNode, 'function');
  assert.deepEqual(shapePort.inspectShapeNode(snapshot({ projectId: 17 }), FORMAT_DEFINITIONS.ProjectSnapshot, ''), { ok: true });
  assert.deepEqual(shapePort.inspectShapeNode(undefined, FORMAT_DEFINITIONS.ProjectId, '/projectId'), { ok: false, reason: 'missing' });
  assert.equal(typeof orderPort.validateOrdered, 'function');
  fail(orderPort.validateOrdered(snapshot({ projectId: 'bad', revision: 1.5 }), 'ProjectSnapshot', { limits: DEFAULT_PROJECT_LIMITS, pointerPrefix: '' }), 'PROJECT_ID_INVALID', '/projectId');
  fail(validate(snapshot({ entities: [entity('e_a', { references: [{ slot: '', target: 'unknown', id: 17 }] })] })), 'PROJECT_INPUT_INVALID', '/entities/0/references/0/slot');
  fail(validate(snapshot({ entities: [entity('e_a', { references: [{ slot: 'x', target: 'unknown', id: 17 }] })] })), 'PROJECT_INPUT_INVALID', '/entities/0/references/0/target');
});

test('closed declarations reject each missing field and wrong type at that field', () => {
  for (const key of Object.keys(snapshot())) {
    const value = snapshot();
    delete value[key];
    fail(validate(value), 'PROJECT_INPUT_INVALID', `/${key}`);
  }
  for (const [key, bad] of [['name', 17], ['versions', []], ['roots', {}], ['entities', null], ['files', 'x'], ['retiredEntityIds', 0]]) {
    fail(validate(snapshot({ [key]: bad })), 'PROJECT_INPUT_INVALID', `/${key}`);
  }
  fail(validate(snapshot({ files: [file('f_a', { extra: 0 })] })), 'PROJECT_INPUT_INVALID', '/files/0');
});

test('namespace identity syntax, duplicates, overlap and scope sets have assigned codes', () => {
  for (const id of ['bad', 'p_', 'p_!', 'p_' + 'a'.repeat(127)]) fail(validate(snapshot({ projectId: id })), 'PROJECT_ID_INVALID', '/projectId');
  success(validate(snapshot({ projectId: 'p_' + 'a'.repeat(126) })));
  fail(validate(snapshot({ entities: [entity('f_a')] })), 'PROJECT_ID_INVALID', '/entities/0/id');
  fail(validate(snapshot({ files: [file('e_a')] })), 'PROJECT_ID_INVALID', '/files/0/id');
  fail(validate(transaction({ transactionId: 'p_a' }), 'transaction'), 'PROJECT_ID_INVALID', '/transactionId');
  const duplicates = [
    [snapshot({ entities: [entity(), entity()] }), '/entities/1/id', 'entities'],
    [snapshot({ files: [file(), file()] }), '/files/1/id', 'files'],
    [snapshot({ retiredEntityIds: ['e_a', 'e_a'] }), '/retiredEntityIds/1', 'retiredEntityIds'],
    [snapshot({ retiredFileIds: ['f_a', 'f_a'] }), '/retiredFileIds/1', 'retiredFileIds'],
    [snapshot({ roots: ['e_a', 'e_a'], entities: [entity()] }), '/roots/1', 'roots'],
    [snapshot({ entities: [entity('e_a', { references: [{ slot: 'x', target: 'entity', id: 'e_a', expectedKind: 'scene' }, { slot: 'x', target: 'entity', id: 'e_a', expectedKind: 'scene' }] })] }), '/entities/0/references/1/slot', 'slots']
  ];
  for (const [value, pointer, reason] of duplicates) assert.equal(fail(validate(value), 'PROJECT_ID_DUPLICATE', pointer).details.reason, reason);
  fail(validate(snapshot({ entities: [entity()], retiredEntityIds: ['e_a'] })), 'PROJECT_ID_REUSED', '/retiredEntityIds/0');
  fail(validate(snapshot({ files: [file()], retiredFileIds: ['f_a'] })), 'PROJECT_ID_REUSED', '/retiredFileIds/0');
  fail(validate(transaction({ scope: { ...transaction().scope, entityIds: ['e_a', 'e_a'] } }), 'transaction'), 'PROJECT_ID_DUPLICATE', '/scope/entityIds/1');
});

test('final roots and references resolve against complete candidates and allow cycles', () => {
  fail(validate(snapshot({ roots: ['e_missing'] })), 'PROJECT_REFERENCE_MISSING', '/roots/0');
  const ref = { slot: 'x', target: 'entity', id: 'e_b', expectedKind: 'scene' };
  fail(validate(snapshot({ entities: [entity('e_a', { references: [ref] })] })), 'PROJECT_REFERENCE_MISSING', '/entities/0/references/0/id');
  fail(validate(snapshot({ entities: [entity('e_a', { references: [{ ...ref, expectedKind: 'other' }] }), entity('e_b')] })), 'PROJECT_REFERENCE_TYPE_MISMATCH', '/entities/0/references/0/expectedKind');
  fail(validate(snapshot({ entities: [entity('e_a', { references: [{ slot: 'f', target: 'file', id: 'f_a', expectedRole: 'asset' }] })], files: [file()] })), 'PROJECT_REFERENCE_TYPE_MISMATCH', '/entities/0/references/0/expectedRole');
  success(validate(snapshot({ roots: ['e_b', 'e_a'], entities: [entity('e_a', { references: [ref] }), entity('e_b', { references: [{ ...ref, id: 'e_a' }] })] })));
  const cyclic = snapshot();
  cyclic.entities = [entity('e_a', { data: cyclic })];
  fail(validate(cyclic), 'PROJECT_INPUT_INVALID', '/entities/0/data');
});

test('raw numeric provenance decides integer nodes and every generic number is finite', () => {
  for (const raw of ['1.5', '-0', '-0.0', '-0e999', '9007199254740991.1', '9007199254740992', '1e999', '-1', '1e-999']) {
    fail(text(JSON.stringify(snapshot()).replace('"revision":0', `"revision":${raw}`)), 'PROJECT_LIMIT_EXCEEDED', '/revision');
  }
  for (const raw of ['0e999999', '1.0', '1e0', '9007199254740991']) success(text(JSON.stringify(snapshot()).replace('"revision":0', `"revision":${raw}`)));
  for (const value of [NaN, Infinity, -Infinity, -0, 1.5, Number.MAX_SAFE_INTEGER + 1]) fail(validate(snapshot({ revision: value })), 'PROJECT_LIMIT_EXCEEDED', '/revision');
  for (const value of [NaN, Infinity, -Infinity]) {
    fail(validate(snapshot({ entities: [entity('e_a', { data: { n: value } })] })), 'PROJECT_INPUT_INVALID', '/entities/0/data/n');
    fail(validate(snapshot({ projectId: 17, revision: value })), 'PROJECT_INPUT_INVALID', '/projectId');
    fail(validate(snapshot({ projectSchemaVersion: '2.0', revision: value })), 'PROJECT_FORMAT_UNSUPPORTED', '/projectSchemaVersion');
  }
  const generic = JSON.stringify(snapshot({ entities: [entity('e_a', { data: { n: 0 } })] }));
  fail(text(generic.replace('"n":0', '"n":1e999')), 'PROJECT_INPUT_INVALID', '/entities/0/data/n');
  for (const raw of ['-0', '0e999999', '1e-999', '5e-324']) {
    const prepared = success(text(generic.replace('"n":0', `"n":${raw}`)));
    assert.equal(Number.isFinite(prepared.value.entities[0].data.n), true);
    assert.equal(Object.is(prepared.value.entities[0].data.n, -0), false);
  }
  const d = fail(validate(snapshot({ revision: Infinity })), 'PROJECT_LIMIT_EXCEEDED', '/revision');
  assert.ok(!JSON.stringify(d).includes('null'));
  fail(text(JSON.stringify(snapshot({ projectId: 'bad' })).replace('"revision":0', '"revision":1e999')), 'PROJECT_ID_INVALID', '/projectId');
  fail(text(JSON.stringify(snapshot({ projectSchemaVersion: '2.0' })).replace('"revision":0', '"revision":1e999')), 'PROJECT_FORMAT_UNSUPPORTED', '/projectSchemaVersion');
  fail(text(JSON.stringify(snapshot()).replace('"revision":0', '"revision":NaN')), 'PROJECT_INPUT_INVALID', '');
});

test('identity scheduling handles malformed records without a diagnostic prepass', () => {
  const badPath = file('f_z', { path: '../x' });
  const badType = file(17);
  fail(validate(snapshot({ files: [badPath, badType] })), 'PROJECT_PATH_INVALID', '/files/0/path');
  fail(validate(snapshot({ files: [badType, badPath] })), 'PROJECT_PATH_INVALID', '/files/1/path');
  fail(validate(snapshot({ files: [file('f_z', { path: '../x' }), file('bad')] })), 'PROJECT_ID_INVALID', '/files/1/id');
  const missing = file();
  delete missing.id;
  fail(validate(snapshot({ files: [missing, badPath] })), 'PROJECT_PATH_INVALID', '/files/1/path');
  fail(validate(snapshot({ files: [null, badPath] })), 'PROJECT_PATH_INVALID', '/files/1/path');
  fail(validate(snapshot({ files: [null, missing] })), 'PROJECT_INPUT_INVALID', '/files/0');
  fail(validate(snapshot({ files: [file('f_a', { path: '../x' }), file('f_a', { role: 17 })] })), 'PROJECT_PATH_INVALID', '/files/0/path');
  fail(validate(snapshot({ files: [file('f_a', { role: 17 }), file('f_a', { path: '../x' })] })), 'PROJECT_INPUT_INVALID', '/files/0/role');
  fail(validate(snapshot({ retiredEntityIds: [17, 'bad'] })), 'PROJECT_ID_INVALID', '/retiredEntityIds/1');
  fail(validate(transaction({ scope: { ...transaction().scope, fileIds: [17, 'bad'] } }), 'transaction'), 'PROJECT_ID_INVALID', '/scope/fileIds/1');
});

test('numeric metadata follows original indices and escaped embedded prefixes', () => {
  const raw = JSON.stringify(snapshot({ files: [file('f_z'), file('f_a')] })).replace('"byteLength":0', '"byteLength":9007199254740991.1');
  fail(text(raw), 'PROJECT_LIMIT_EXCEEDED', '/files/0/byteLength');
  const wrapper = JSON.stringify({ 'a/b~': snapshot({ files: [file('f_z'), file('f_a')] }) }).replace('"byteLength":0', '"byteLength":9007199254740991.1');
  const parsed = readText(wrapper, 'snapshot', DEFAULT_PROJECT_LIMITS);
  assert.equal(parsed.ok, true);
  fail(snapshotPort.validateSnapshot(parsed.value.value['a/b~'], { limits: DEFAULT_PROJECT_LIMITS, numericTokens: parsed.value.numericTokens, pointerPrefix: '/a~1b~0' }), 'PROJECT_LIMIT_EXCEEDED', '/a~1b~0/files/0/byteLength');
});

test('portable lexical paths have exact bytes, device rules and collision keys', () => {
  for (const path of ['../x', '/x', 'C:/x', '//host/x', 'x\\y', '', 'x//y', './x', 'x/.', 'x/..', 'x\u0000y', 'x\u007fy', 'x:y', 'x*y', 'x?y', 'x"y', 'x<y', 'x>y', 'x|y', 'x.', 'x ', 'Con', 'PRN.txt', 'aux.X', 'nul', 'COM1.json', 'lpt9.x']) {
    fail(validate(snapshot({ files: [file('f_a', { path })] })), 'PROJECT_PATH_INVALID', '/files/0/path');
  }
  success(validate(snapshot({ files: [file('f_a', { path: 'é'.repeat(512) })] })));
  fail(validate(snapshot({ files: [file('f_a', { path: 'é'.repeat(512) + 'a' })] })), 'PROJECT_PATH_INVALID', '/files/0/path');
  for (const [a, b] of [['A/x', 'a/x'], ['é/x', 'e\u0301/x']]) fail(validate(snapshot({ files: [file('f_a', { path: a }), file('f_b', { path: b })] })), 'PROJECT_PATH_COLLISION', '/files/1/path');
  assert.equal(typeof pathPort.pathCollisionKey, 'function');
  assert.equal(pathPort.pathCollisionKey('E\u0301/X'), 'é/x');
  success(validate(snapshot({ files: [file('f_a', { path: 'ß' }), file('f_b', { path: 'ss' }), file('f_c', { path: 'COM0.txt' })] })));
});

test('semantic string boundaries are byte exact and fields keep their own constraints', () => {
  success(validate(snapshot({ name: 'é'.repeat(128) })));
  fail(validate(snapshot({ name: 'é'.repeat(128) + 'a' })), 'PROJECT_INPUT_INVALID', '/name');
  for (const field of ['kind', 'dataSchemaVersion']) {
    success(validate(snapshot({ entities: [entity('e_a', { [field]: 'é'.repeat(64) })] })));
    for (const value of ['', 'é'.repeat(64) + 'a', 'x\u007f']) fail(validate(snapshot({ entities: [entity('e_a', { [field]: value })] })), 'PROJECT_INPUT_INVALID', `/entities/0/${field}`);
  }
  for (const field of ['engineVersion', 'resourceFormatVersion']) {
    success(validate(snapshot({ versions: { ...pins(), [field]: 'x'.repeat(128) } })));
    fail(validate(snapshot({ versions: { ...pins(), [field]: 'x'.repeat(129) } })), 'PROJECT_INPUT_INVALID', `/versions/${field}`);
  }
  for (const field of ['actorId', 'toolId', 'toolVersion', 'intent']) {
    const max = field === 'intent' ? 1024 : 128;
    success(validate(transaction({ source: { ...transaction().source, [field]: 'x'.repeat(max) } }), 'transaction'));
    fail(validate(transaction({ source: { ...transaction().source, [field]: 'x'.repeat(max + 1) } }), 'transaction'), 'PROJECT_INPUT_INVALID', `/source/${field}`);
  }
  success(validate(snapshot({ files: [file('f_a', { mediaType: 'x'.repeat(128) })] })));
  for (const value of ['', 'x'.repeat(129), 'text plain', 'é', '\u007f']) fail(validate(snapshot({ files: [file('f_a', { mediaType: value })] })), 'PROJECT_INPUT_INVALID', '/files/0/mediaType');
  for (const value of ['a'.repeat(63), 'a'.repeat(65), 'A'.repeat(64), 'g'.repeat(64)]) fail(validate(snapshot({ files: [file('f_a', { sha256: value })] })), 'PROJECT_INPUT_INVALID', '/files/0/sha256');
});

test('real collection permutations normalize while authored arrays preserve order', () => {
  const a = snapshot({ roots: ['e_b', 'e_a'], entities: [entity('e_b'), entity('e_a', { data: { '10': -0, '2': '\n', constructor: 1 } })], files: [file('f_b'), file('f_a')], retiredEntityIds: ['e_z', 'e_y'], retiredFileIds: ['f_z', 'f_y'] });
  const b = structuredClone(a);
  for (const key of ['entities', 'files', 'retiredEntityIds', 'retiredFileIds']) b[key].reverse();
  const first = success(validate(a));
  const second = success(validate(b));
  assert.equal(first.canonical, second.canonical);
  assert.deepEqual(first.value.entities.map(item => item.id), ['e_a', 'e_b']);
  assert.deepEqual(first.value.roots, ['e_b', 'e_a']);
  assert.equal(first.value.entities[0].data['10'], 0);
  assert.ok(first.canonical.includes('"data":{"10":0,"2":"\\n","constructor":1}'));
  b.roots.reverse();
  assert.notEqual(first.canonical, success(validate(b)).canonical);
  const command = transaction({ scope: { entityIds: ['e_z', 'e_a'], fileIds: ['f_z', 'f_a'], metadata: true, roots: true }, operations: [{ op: 'setRoots', roots: [] }, { op: 'setMetadata', name: '', versions: pins() }] });
  const other = structuredClone(command);
  other.scope.entityIds.reverse(); other.scope.fileIds.reverse();
  assert.equal(success(validate(command, 'transaction')).canonical, success(validate(other, 'transaction')).canonical);
  other.operations.reverse();
  assert.notEqual(success(validate(command, 'transaction')).canonical, success(validate(other, 'transaction')).canonical);
  assert.ok(Object.isFrozen(first)); assert.ok(Object.isFrozen(first.value)); assert.ok(Object.isFrozen(first.value.entities[0].data));
  assert.throws(() => { first.value.entities.push(entity('e_new')); });
  assert.throws(() => { first.value.entities[0].data['10'] = 7; });
  a.entities[0].name = 'later';
  assert.equal(first.value.entities[1].name, '');
  assert.equal(DEFAULT_PROJECT_LIMITS.maxEntities, 100000);
});

test('unchecked summaries, exact collection limits and stage priorities stay explicit', () => {
  const warnings = validate(snapshot({ entities: [entity('e_a', { data: { arbitrary: { controls: '\n' } } }), entity('e_b')], files: [file()] }));
  success(warnings);
  assert.deepEqual(warnings.diagnostics.map(d => [d.code, d.details.count]), [['PROJECT_KIND_UNCHECKED', 2], ['PROJECT_CONTENT_UNVERIFIED', 1]]);
  success(validate(snapshot({ entities: [entity()], retiredEntityIds: ['e_z'] }), 'snapshot', { maxEntities: 2 }));
  fail(validate(snapshot({ entities: [entity()], retiredEntityIds: ['e_z'] }), 'snapshot', { maxEntities: 1 }), 'PROJECT_LIMIT_EXCEEDED', '/entities');
  success(validate(snapshot({ files: [file()], retiredFileIds: ['f_z'] }), 'snapshot', { maxFiles: 2 }));
  fail(validate(snapshot({ files: [file()], retiredFileIds: ['f_z'] }), 'snapshot', { maxFiles: 1 }), 'PROJECT_LIMIT_EXCEEDED', '/files');
  const refs = [{ slot: 'a', target: 'entity', id: 'e_a', expectedKind: 'scene' }, { slot: 'b', target: 'entity', id: 'e_a', expectedKind: 'scene' }];
  success(validate(snapshot({ entities: [entity('e_a', { references: refs })] }), 'snapshot', { maxReferencesPerEntity: 2 }));
  fail(validate(snapshot({ entities: [entity('e_a', { references: refs })] }), 'snapshot', { maxReferencesPerEntity: 1 }), 'PROJECT_LIMIT_EXCEEDED', '/entities/0/references');
  fail(validate(snapshot({ roots: ['e_missing'], entities: [entity()], retiredEntityIds: ['e_z'] }), 'snapshot', { maxEntities: 1 }), 'PROJECT_REFERENCE_MISSING', '/roots/0');
  fail(validate(snapshot({ projectId: 'bad', roots: ['e_missing'] })), 'PROJECT_ID_INVALID', '/projectId');
  fail(text(JSON.stringify(snapshot({ projectId: 'bad' })), 'snapshot', { maxSnapshotUtf8Bytes: 1 }), 'PROJECT_LIMIT_EXCEEDED', '');
  fail(validate(transaction({ operations: [] }), 'transaction'), 'PROJECT_INPUT_INVALID', '/operations');
  const ops = [{ op: 'setRoots', roots: [] }, { op: 'setMetadata', name: '', versions: pins() }];
  success(validate(transaction({ operations: ops }), 'transaction', { maxOperationsPerTransaction: 2 }));
  fail(validate(transaction({ operations: ops }), 'transaction', { maxOperationsPerTransaction: 1 }), 'PROJECT_LIMIT_EXCEEDED', '/operations');
});

test('unions preserve their generated prefix before branch-dependent closure', () => {
  fail(validate(snapshot({ entities: [entity('e_a', { references: [{ slot: '', target: 'unknown', extra: true }] })] })), 'PROJECT_INPUT_INVALID', '/entities/0/references/0/slot');
  fail(validate(snapshot({ entities: [entity('e_a', { extra: true, kind: '' })] })), 'PROJECT_INPUT_INVALID', '/entities/0');
  fail(validate(transaction({ command: 'unknown', toolProtocolVersion: '2.0' }), 'transaction'), 'PROJECT_INPUT_INVALID', '/command');
  const restore = transaction({ command: 'restore', targetRevision: 0 });
  delete restore.scope; delete restore.operations;
  success(validate(restore, 'transaction'));
  fail(validate({ ...restore, targetRevision: -0 }, 'transaction'), 'PROJECT_LIMIT_EXCEEDED', '/targetRevision');
  fail(validate(transaction({ toolProtocolVersion: 2 }), 'transaction'), 'PROJECT_INPUT_INVALID', '/toolProtocolVersion');
  fail(validate(snapshot({ versions: { ...pins(), toolProtocolVersion: 2 } })), 'PROJECT_INPUT_INVALID', '/versions/toolProtocolVersion');
});

test('all remaining constrained fields and operation variants have exact bounds', () => {
  for (const field of ['slot', 'expectedKind']) {
    const ref = { slot: 'x', target: 'entity', id: 'e_a', expectedKind: 'x'.repeat(128), [field]: 'x'.repeat(128) };
    success(validate(snapshot({ entities: [entity('e_a', { kind: 'x'.repeat(128), references: [ref] })] })));
    fail(validate(snapshot({ entities: [entity('e_a', { references: [{ ...ref, [field]: 'x'.repeat(129) }] })] })), 'PROJECT_INPUT_INVALID', `/entities/0/references/0/${field}`);
    fail(validate(snapshot({ entities: [entity('e_a', { references: [{ ...ref, [field]: '' }] })] })), 'PROJECT_INPUT_INVALID', `/entities/0/references/0/${field}`);
  }
  success(validate(snapshot({ entities: [entity('e_a', { name: 'x'.repeat(256) })] })));
  fail(validate(snapshot({ entities: [entity('e_a', { name: 'x'.repeat(257) })] })), 'PROJECT_INPUT_INVALID', '/entities/0/name');
  fail(validate(snapshot({ name: '\n' })), 'PROJECT_INPUT_INVALID', '/name');
  fail(validate(transaction({ source: { ...transaction().source, intent: '\n' } }), 'transaction'), 'PROJECT_INPUT_INVALID', '/source/intent');
  success(validate(snapshot({ revision: Number.MAX_SAFE_INTEGER, files: [file('f_a', { byteLength: Number.MAX_SAFE_INTEGER })] })));
  fail(validate(snapshot({ files: [file('f_a', { byteLength: Number.MAX_SAFE_INTEGER + 1 })] })), 'PROJECT_LIMIT_EXCEEDED', '/files/0/byteLength');
  fail(validate(transaction({ baseRevision: -0 }), 'transaction'), 'PROJECT_LIMIT_EXCEEDED', '/baseRevision');
  const operations = [
    { op: 'putEntity', entity: entity('e_a', { references: [{ slot: 'x', target: 'entity', id: 'e_forward', expectedKind: 'scene' }] }) },
    { op: 'removeEntity', id: 'e_b' }, { op: 'putFile', file: file() }, { op: 'removeFile', id: 'f_b' },
    { op: 'setMetadata', name: '', versions: pins() }, { op: 'setRoots', roots: ['e_forward'] }
  ];
  const result = validate(transaction({ operations }), 'transaction');
  success(result);
  assert.deepEqual(result.diagnostics.map(d => [d.code, d.details.count]), [['PROJECT_KIND_UNCHECKED', 1], ['PROJECT_CONTENT_UNVERIFIED', 1]]);
  fail(validate(transaction({ operations: [{ op: 'setRoots', roots: ['e_a', 'e_a'] }] }), 'transaction'), 'PROJECT_ID_DUPLICATE', '/operations/0/roots/1');
  for (const actorKind of ['creator', 'agent', 'legacy-converter', 'tool']) success(validate(transaction({ source: { ...transaction().source, actorKind } }), 'transaction'));
  for (const role of ['source', 'asset', 'configuration', 'legacy-original', 'other']) success(validate(snapshot({ files: [file('f_a', { role })] })));
});

test('real normalized snapshot bytes have a handwritten complete oracle', () => {
  const input = snapshot({ entities: [entity('e_b'), entity('e_a')], files: [file('f_b'), file('f_a')], retiredEntityIds: ['e_z', 'e_y'], retiredFileIds: ['f_z', 'f_y'] });
  const expected = '{"entities":[{"data":{},"dataSchemaVersion":"1","id":"e_a","kind":"scene","name":"","references":[]},{"data":{},"dataSchemaVersion":"1","id":"e_b","kind":"scene","name":"","references":[]}],"files":[{"byteLength":0,"id":"f_a","mediaType":"text/plain","path":"f_a.ts","role":"source","sha256":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"},{"byteLength":0,"id":"f_b","mediaType":"text/plain","path":"f_b.ts","role":"source","sha256":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}],"name":"","projectId":"p_a","projectSchemaVersion":"1.0","retiredEntityIds":["e_y","e_z"],"retiredFileIds":["f_y","f_z"],"revision":0,"roots":[],"versions":{"engineVersion":"1","resourceFormatVersion":"1","toolProtocolVersion":"1.0"}}';
  const result = success(validate(input));
  assert.equal(result.canonical, expected);
  assert.deepEqual(Buffer.from(result.canonical), Buffer.from(expected));
  assert.equal(result.utf8Bytes, Buffer.byteLength(expected));
  success(text(expected, 'snapshot', { maxSnapshotUtf8Bytes: Buffer.byteLength(expected) }));
  fail(text(expected, 'snapshot', { maxSnapshotUtf8Bytes: Buffer.byteLength(expected) - 1 }), 'PROJECT_LIMIT_EXCEEDED', '');
});

test('selected deep-data failure truncates only complete escaped pointer segments', () => {
  const data = { safe: { ['é/~'.repeat(400)]: Infinity } };
  const result = validate(snapshot({ entities: [entity('e_a', { data })] }));
  const diagnostic = fail(result, 'PROJECT_INPUT_INVALID', '/entities/0/data/safe');
  assert.equal(diagnostic.details.pointerTruncated, true);
  assert.ok(Buffer.byteLength(diagnostic.jsonPointer) <= 1024);
  assert.ok(Buffer.byteLength(JSON.stringify(diagnostic.details)) <= 4096);
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(diagnostic.details), true);
});

test('collection integrity follows generated declaration order after every node passes', () => {
  fail(validate(snapshot({ roots: ['e_a', 'e_a'], entities: [entity(), entity()] })), 'PROJECT_ID_DUPLICATE', '/roots/1');
  const duplicateSlots = entity('e_a', { references: [{ slot: 'x', target: 'entity', id: 'e_a', expectedKind: 'scene' }, { slot: 'x', target: 'entity', id: 'e_a', expectedKind: 'scene' }] });
  fail(validate(snapshot({ entities: [duplicateSlots, entity('e_b'), entity('e_b')] })), 'PROJECT_ID_DUPLICATE', '/entities/2/id');
  fail(validate(snapshot({ files: [file('f_z'), file('f_a', { path: 'same' }), file('f_b', { path: 'same' }), file('f_z')] })), 'PROJECT_ID_DUPLICATE', '/files/3/id');
  fail(validate(snapshot({ files: [file('f_z', { path: 'same' }), file('f_a', { path: 'same' })] })), 'PROJECT_PATH_COLLISION', '/files/0/path');
  fail(validate(snapshot({ entities: [entity()], retiredEntityIds: ['e_a', 'e_z', 'e_z'] })), 'PROJECT_ID_DUPLICATE', '/retiredEntityIds/2');
  fail(validate(snapshot({ roots: ['e_a', 'e_a'], entities: [entity('e_a', { kind: '' })] })), 'PROJECT_INPUT_INVALID', '/entities/0/kind');
});
