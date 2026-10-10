import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cloneLive } from '../packages/project/dist/live-input.js';
import { validateSnapshot } from '../packages/project/dist/validate-snapshot.js';
import { validateTransaction } from '../packages/project/dist/validate-transaction.js';
import { resolveLimits } from '../packages/project/dist/limits.js';
const editPort = await import('../packages/project/dist/edit.js').catch(() => ({}));
const diffPort = await import('../packages/project/dist/diff.js').catch(() => ({}));
const ledger = JSON.parse(readFileSync(new URL('./fixtures/project/edit-ledger.json', import.meta.url), 'utf8'));
const work = JSON.parse(readFileSync(new URL('./fixtures/project/work-ledger.json', import.meta.url), 'utf8'));
const pins = () => ({ engineVersion:'1', resourceFormatVersion:'1', toolProtocolVersion:'1.0' });
const snapshot = (extra = {}) => ({ ...JSON.parse(work.snapshot), ...extra });
const entity = (id, extra = {}) => ({ id, kind:'scene', dataSchemaVersion:'1', name:'', data:{}, references:[], ...extra });
const file = (extra = {}) => ({ id:'f_a', path:'a.ts', role:'source', mediaType:'text/plain', sha256:'a'.repeat(64), byteLength:1, ...extra });
const scope = (extra = {}) => ({ entityIds:[], fileIds:[], metadata:false, roots:false, ...extra });
const command = (operations, declared = scope(), extra = {}) => ({ command:'edit', toolProtocolVersion:'1.0', projectId:'p_a', transactionId:'t_a', baseRevision:0, source:{actorId:'a',actorKind:'creator',toolId:'t',toolVersion:'1',intent:''}, scope:declared, operations, ...extra });
function success(result) { assert.equal(result.ok, true, JSON.stringify(result.diagnostics)); return result.value; }
// Compare protocol values to handwritten JSON, allowing the required inert
// null-prototype representation. This never creates an expected value.
function equalJson(actual, expected) { assert.deepEqual(JSON.parse(JSON.stringify(actual)), expected); }
function bounds(overrides) { return success(resolveLimits(overrides)); }
function checked(value, kind) {
  const limits = bounds(); const copied = success(cloneLive(value, kind, limits));
  return success((kind === 'snapshot' ? validateSnapshot : validateTransaction)(copied, { limits, pointerPrefix:'' }));
}
function apply(head, transaction, overrides) {
  assert.equal(typeof editPort.applyEdit, 'function', 'missing complete edit port');
  return editPort.applyEdit(checked(head,'snapshot').value, checked(transaction,'transaction').value, bounds(overrides));
}
function diff(before, after) {
  assert.equal(typeof diffPort.diffSnapshots, 'function', 'missing independent diff port');
  return diffPort.diffSnapshots(before,after);
}
function fails(result, code, pointer) {
  assert.equal(result.ok,false); assert.equal(result.diagnostics[0].code,code);
  if (pointer !== undefined) assert.equal(result.diagnostics[0].jsonPointer,pointer);
}
const forward = () => command([
  {op:'putEntity',entity:entity('e_a',{name:'A',data:{value:1},references:[{slot:'next',target:'entity',id:'e_b',expectedKind:'scene'}]})},
  {op:'putEntity',entity:entity('e_b',{name:'B'})},
  {op:'setRoots',roots:['e_a']}
],scope({entityIds:['e_b','e_a','e_unused'],roots:true}));

test('complete candidate permits forward references and leaves original authority intact on dangling failure', () => {
  const head = checked(snapshot(),'snapshot');
  assert.equal(typeof editPort.applyEdit,'function','missing complete edit port');
  const input = forward(); const validated = checked(input,'transaction');
  const after = success(editPort.applyEdit(head.value,validated.value,bounds()));
  equalJson(after.value,ledger.forwardSnapshot);
  assert.deepEqual(diff(head.value,after.value),ledger.diffs.forward);
  input.operations[0].entity.data.value = 9;
  assert.equal(after.value.entities[0].data.value,1);
  assert.throws(() => after.value.entities.push(entity('e_new')),TypeError);
  const dangling = command([{op:'putEntity',entity:entity('e_good')},{op:'putEntity',entity:entity('e_bad',{references:[{slot:'next',target:'entity',id:'e_missing',expectedKind:'scene'}]})}],scope({entityIds:['e_bad','e_good']}));
  const rejected = editPort.applyEdit(head.value,checked(dangling,'transaction').value,bounds());
  fails(rejected,'PROJECT_REFERENCE_MISSING');
  assert.equal(head.canonical,work.snapshot); equalJson(head.value,snapshot());
});

test('every direct scope and operation target is checked without demanding indirect targets', () => {
  const cases = [
    [command([{op:'putEntity',entity:entity('e_a')}]),'PROJECT_SCOPE_VIOLATION','/operations/0'],
    [command([{op:'putFile',file:file()}]),'PROJECT_SCOPE_VIOLATION','/operations/0'],
    [command([{op:'setMetadata',name:'x',versions:pins()}]),'PROJECT_SCOPE_VIOLATION','/operations/0'],
    [command([{op:'setRoots',roots:[]}]),'PROJECT_SCOPE_VIOLATION','/operations/0'],
    [command([{op:'putEntity',entity:entity('e_a')},{op:'removeEntity',id:'e_a'}],scope({entityIds:['e_a']})),'PROJECT_OPERATION_DUPLICATE','/operations/1'],
    [command([{op:'putFile',file:file()},{op:'putFile',file:file()}],scope({fileIds:['f_a']})),'PROJECT_OPERATION_DUPLICATE','/operations/1'],
    [command([{op:'setMetadata',name:'',versions:pins()},{op:'setMetadata',name:'',versions:pins()}],scope({metadata:true})),'PROJECT_OPERATION_DUPLICATE','/operations/1'],
    [command([{op:'setRoots',roots:[]},{op:'setRoots',roots:[]}],scope({roots:true})),'PROJECT_OPERATION_DUPLICATE','/operations/1']
  ];
  for (const [input,code,pointer] of cases) fails(apply(snapshot(),input),code,pointer);
  const indirect = command([{op:'putEntity',entity:entity('e_a',{references:[{slot:'other',target:'entity',id:'e_b',expectedKind:'scene'}]})}],scope({entityIds:['e_a','e_unused']}));
  assert.equal(apply(snapshot({entities:[entity('e_b')]}),indirect).ok,true);
});

test('absent removal, retirement and immutable kinds or roles reject without cascading', () => {
  for (const [operations,declared] of [[[{op:'removeEntity',id:'e_a'}],scope({entityIds:['e_a']})],[[{op:'removeFile',id:'f_a'}],scope({fileIds:['f_a']})]]) {
    fails(apply(snapshot(),command(operations,declared)),'PROJECT_INPUT_INVALID');
  }
  fails(apply(snapshot({retiredEntityIds:['e_a']}),command([{op:'putEntity',entity:entity('e_a')}],scope({entityIds:['e_a']}))),'PROJECT_ID_REUSED');
  fails(apply(snapshot({retiredFileIds:['f_a']}),command([{op:'putFile',file:file()}],scope({fileIds:['f_a']}))),'PROJECT_ID_REUSED');
  fails(apply(snapshot({entities:[entity('e_a')]}),command([{op:'putEntity',entity:entity('e_a',{kind:'other'})}],scope({entityIds:['e_a']}))),'PROJECT_ID_REUSED');
  fails(apply(snapshot({files:[file()]}),command([{op:'putFile',file:file({role:'asset'})}],scope({fileIds:['f_a']}))),'PROJECT_ID_REUSED');
  const original = ledger.forwardSnapshot;
  fails(apply(original,command([{op:'removeEntity',id:'e_b'}],scope({entityIds:['e_b']}))),'PROJECT_REFERENCE_MISSING');
  const removal = command([{op:'setRoots',roots:[]},{op:'removeEntity',id:'e_b'},{op:'removeEntity',id:'e_a'}],scope({entityIds:['e_a','e_b'],roots:true}));
  const removed = success(apply(original,removal));
  equalJson(removed.value,ledger.retiredSnapshot);
  assert.deepEqual(diff(original,removed.value),ledger.diffs.retired);
});

test('complete record replacement and identical puts produce independent full-content diffs', () => {
  const before = snapshot({entities:[entity('e_a',{name:'old',data:{keep:1,remove:2}})]});
  const after = success(apply(before,command([{op:'putEntity',entity:entity('e_a',{data:{keep:1}})}],scope({entityIds:['e_a']})))).value;
  equalJson(after,ledger.replacedEntitySnapshot);
  equalJson(after.entities,[{id:'e_a',kind:'scene',dataSchemaVersion:'1',name:'',data:{keep:1},references:[]}]);
  assert.deepEqual(diff(before,after),ledger.diffs.entityChanged);
  const same = success(apply(after,command([{op:'putEntity',entity:after.entities[0]}],scope({entityIds:['e_a']})))).value;
  equalJson(same,ledger.identicalEntitySnapshot);
  assert.equal(same.revision,2); assert.deepEqual(diff(after,same),ledger.diffs.empty);
  const schemaChanged = success(apply(same,command([{op:'putEntity',entity:{...same.entities[0],dataSchemaVersion:'2'}}],scope({entityIds:['e_a']})))).value;
  assert.deepEqual(diff(same,schemaChanged),ledger.diffs.entityChanged);
});

test('file lifecycle compares complete records and retains monotonic retirement', () => {
  const empty = snapshot();
  const added = success(apply(empty,command([{op:'putFile',file:file()}],scope({fileIds:['f_a']})))).value;
  equalJson(added,ledger.fileSnapshot); assert.deepEqual(diff(empty,added),ledger.diffs.fileAdded);
  const changed = success(apply(added,command([{op:'putFile',file:file({path:'b.ts',mediaType:'text/javascript',sha256:'b'.repeat(64),byteLength:2})}],scope({fileIds:['f_a']})))).value;
  equalJson(changed,ledger.changedFileSnapshot);
  equalJson(changed.files,[{id:'f_a',path:'b.ts',role:'source',mediaType:'text/javascript',sha256:'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',byteLength:2}]);
  assert.deepEqual(diff(added,changed),ledger.diffs.fileChanged);
  const removed = success(apply(changed,command([{op:'removeFile',id:'f_a'}],scope({fileIds:['f_a']})))).value;
  equalJson(removed,ledger.removedFileSnapshot);
  assert.deepEqual(removed.files,[]); assert.deepEqual(removed.retiredFileIds,['f_a']);
  assert.deepEqual(diff(changed,removed),ledger.diffs.fileRemoved);
  const noOp = success(apply(removed,command([{op:'setRoots',roots:[]}],scope({roots:true})))).value;
  assert.deepEqual(noOp.retiredFileIds,['f_a']); assert.deepEqual(diff(removed,noOp),ledger.diffs.empty);
});

test('metadata pins, authored roots and reference order count while revisions and retirement do not', () => {
  const before = snapshot({entities:[entity('e_a'),entity('e_b')],roots:['e_a','e_b']});
  const after = success(apply(before,command([{op:'setMetadata',name:'new',versions:{...pins(),engineVersion:'2'}},{op:'setRoots',roots:['e_b','e_a']}],scope({metadata:true,roots:true})))).value;
  equalJson(after,ledger.metadataRootsSnapshot);
  assert.equal(after.name,'new'); equalJson(after.versions,{engineVersion:'2',resourceFormatVersion:'1',toolProtocolVersion:'1.0'});
  assert.deepEqual(after.roots,['e_b','e_a']); assert.deepEqual(diff(before,after),ledger.diffs.metadataRoots);
  assert.deepEqual(diff(before,{...before,revision:4,retiredEntityIds:['e_old'],retiredFileIds:['f_old']}),ledger.diffs.empty);
  const refs = [{slot:'one',target:'entity',id:'e_b',expectedKind:'scene'},{slot:'two',target:'entity',id:'e_b',expectedKind:'scene'}];
  const first = snapshot({entities:[entity('e_a',{references:refs}),entity('e_b')]});
  assert.deepEqual(diff(first,snapshot({entities:[entity('e_b'),entity('e_a',{references:[refs[1],refs[0]]})]})),ledger.diffs.entityChanged);
});

test('completed candidates reject final mismatch, portable collisions and later local capacities', () => {
  fails(apply(snapshot({entities:[entity('e_b',{kind:'other'})]}),command([{op:'putEntity',entity:entity('e_a',{references:[{slot:'x',target:'entity',id:'e_b',expectedKind:'scene'}]})}],scope({entityIds:['e_a']}))),'PROJECT_REFERENCE_TYPE_MISMATCH');
  fails(apply(snapshot({files:[file()]}),command([{op:'putFile',file:file({id:'f_b',path:'A.ts'})}],scope({fileIds:['f_b']}))),'PROJECT_PATH_COLLISION');
  fails(apply(snapshot({retiredEntityIds:['e_old']}),command([{op:'putEntity',entity:entity('e_a')}],scope({entityIds:['e_a']})),{maxEntities:1}),'PROJECT_LIMIT_EXCEEDED');
  fails(apply(snapshot(),forward(),{maxSnapshotUtf8Bytes:238}),'PROJECT_LIMIT_EXCEEDED');
});
