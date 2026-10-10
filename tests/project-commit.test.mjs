import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cloneLive } from '../packages/project/dist/live-input.js';
import { validateSnapshot } from '../packages/project/dist/validate-snapshot.js';
import { validateTransaction } from '../packages/project/dist/validate-transaction.js';
import { canonicalize } from '../packages/project/dist/canonical.js';
import { resolveLimits } from '../packages/project/dist/limits.js';
import { createState } from '../packages/project/dist/state.js';
import { historyBytes } from '../packages/project/dist/history-bytes.js';
const commitPort = await import('../packages/project/dist/commit.js').catch(() => ({}));
const ledger = JSON.parse(readFileSync(new URL('./fixtures/project/retry-ledger.json', import.meta.url), 'utf8'));
const work = JSON.parse(readFileSync(new URL('./fixtures/project/work-ledger.json', import.meta.url), 'utf8'));
const editLedger = JSON.parse(readFileSync(new URL('./fixtures/project/edit-ledger.json', import.meta.url), 'utf8'));
const pins = () => ({ engineVersion:'1', resourceFormatVersion:'1', toolProtocolVersion:'1.0' });
const entity = (id = 'e_a', extra = {}) => ({ id, kind:'scene', dataSchemaVersion:'1', name:'', data:{}, references:[], ...extra });
const file = () => ({id:'f_a',path:'a.ts',role:'source',mediaType:'text/plain',sha256:'a'.repeat(64),byteLength:0});
const scope = (extra = {}) => ({ entityIds:[], fileIds:[], metadata:false, roots:false, ...extra });
function success(result) { assert.equal(result.ok,true,JSON.stringify(result.diagnostics)); return result.value; }
function prepare(value,kind,limits) {
  const copied = cloneLive(value,kind,limits); if (!copied.ok) return copied;
  return (kind === 'snapshot' ? validateSnapshot : validateTransaction)(copied.value,{limits,pointerPrefix:''});
}
function initial(overrides, baseline = JSON.parse(work.snapshot)) {
  const limits = success(resolveLimits(overrides));
  return success(createState(success(prepare(baseline,'snapshot',limits)),limits));
}
function edit(id = 't_a', baseRevision = 0, name = '') {
  const input = JSON.parse(work.metadataEdit);
  input.transactionId = id; input.baseRevision = baseRevision; input.operations[0].name = name;
  return input;
}
function operations(id,baseRevision,list,declared) { return {...edit(id,baseRevision),operations:list,scope:declared}; }
// This represents the exact adapter boundary required by the brief. Task 5
// must additionally exercise the public facade; this is not a facade stub.
function commit(state,input) {
  assert.equal(typeof commitPort.commitPrepared,'function','missing atomic commit port');
  const prepared = prepare(input,'transaction',state.limits);
  if (!prepared.ok) return {state,result:{status:'rejected',snapshot:state.head,diagnostics:prepared.diagnostics}};
  return commitPort.commitPrepared(state,prepared.value,() => { throw new Error('Restore is outside these edit-only tests.'); });
}
function reject(state,input,code) {
  const priorBytes = canonicalize(state.head), priorHistory = historyBytes(state.baseline,state.commands);
  const transition = commit(state,input);
  assert.equal(transition.result.status,'rejected'); assert.equal(transition.result.diagnostics[0].code,code);
  assert.equal(transition.state,state); assert.equal(transition.result.snapshot,state.head);
  assert.equal(canonicalize(state.head),priorBytes); assert.equal(historyBytes(state.baseline,state.commands),priorHistory);
  return transition;
}
function accepted(transition,status = 'committed') { assert.equal(transition.result.status,status,JSON.stringify(transition.result.diagnostics)); return transition.state; }
function equalJson(actual,expected) { assert.deepEqual(JSON.parse(JSON.stringify(actual)),expected); }
const journal = (baseline, commands) => '{"baseline":'+baseline+',"historySchemaVersion":"1.0","transactions":['+commands.join(',')+']}';

test('nonzero A B C retries retain current head and the original independent receipt and journal bytes', () => {
  const baseline = initial(undefined,JSON.parse(ledger.baseline4));
  assert.equal(canonicalize(baseline.head),ledger.baseline4);
  const A = JSON.parse(ledger.commandA), C = JSON.parse(ledger.commandC);
  const first = commit(baseline,A); const at5 = accepted(first);
  assert.equal(canonicalize(at5.head),ledger.snapshot5); equalJson(first.result.receipt,ledger.receiptA);
  assert.equal(canonicalize(first.result.receipt),ledger.receiptABytes);
  assert.equal(historyBytes(at5.baseline,at5.commands),journal(ledger.baseline4,[ledger.commandA]));
  reject(at5,edit('t_b',4,'B'),ledger.outcomes.B);
  assert.equal(at5.identities.has('t_b'),false);
  const third = commit(at5,C); const at6 = accepted(third);
  assert.equal(canonicalize(at6.head),ledger.snapshot6);
  const expectedHistory = journal(ledger.baseline4,[ledger.commandA,ledger.commandC]);
  assert.equal(historyBytes(at6.baseline,at6.commands),expectedHistory);
  const replay = commit(at6,A); accepted(replay,'replayed');
  assert.equal(replay.state,at6); assert.equal(replay.result.snapshot,at6.head);
  assert.equal(replay.result.receipt,first.result.receipt); equalJson(replay.result.receipt,ledger.receiptA);
  assert.equal(historyBytes(at6.baseline,at6.commands),expectedHistory);
  reject(at6,edit('t_a',999,'different'),'PROJECT_TRANSACTION_ID_REUSED');
  reject(at6,{...A,projectId:'p_other'},'PROJECT_TRANSACTION_ID_REUSED');
  const invalidA = {...A,source:{...A.source,actorId:17}};
  reject(at6,invalidA,'PROJECT_INPUT_INVALID');
  const at7 = accepted(commit(at6,edit('t_b',6,'corrected')));
  assert.equal(at7.head.revision,7); assert.equal(at7.commands.length,3);
  assert.equal(canonicalize(at5.head),ledger.snapshot5); assert.equal(canonicalize(baseline.head),ledger.baseline4);
});

test('exact metadata work and literal journal capacity admit once and retries bypass every new-commit bound', () => {
  const expectedHistory = journal(work.snapshot,[work.metadataEdit]);
  const exactBytes = Buffer.byteLength(expectedHistory);
  const input = JSON.parse(work.metadataEdit);
  const prepared = success(prepare(input,'transaction',success(resolveLimits())));
  assert.equal(prepared.canonical,work.metadataEdit); assert.equal(prepared.nodeCount,48);
  const state = initial({maxReplayWorkUnits:102,maxTransactions:1,maxHistoryUtf8Bytes:exactBytes});
  const after = accepted(commit(state,input));
  assert.deepEqual(after.prefixCosts,[27,102]); assert.equal(after.historyUtf8Bytes,exactBytes);
  assert.equal(historyBytes(after.baseline,after.commands),expectedHistory);
  assert.equal(after.head.revision,1); assert.deepEqual(after.receipts.get('t_a').diff,editLedger.diffs.empty);
  const replay = commit(after,input); accepted(replay,'replayed'); assert.equal(replay.state,after);
  reject(after,edit('t_new',1),'PROJECT_LIMIT_EXCEEDED');
  reject(initial({maxReplayWorkUnits:101}),input,'PROJECT_LIMIT_EXCEEDED');
  reject(initial({maxHistoryUtf8Bytes:exactBytes-1}),input,'PROJECT_LIMIT_EXCEEDED');
  const nearMax = {...JSON.parse(work.snapshot),revision:Number.MAX_SAFE_INTEGER-1};
  const maxInput = edit('t_max',Number.MAX_SAFE_INTEGER-1);
  const maximal = accepted(commit(initial({maxTransactions:1},nearMax),maxInput));
  assert.equal(maximal.head.revision,Number.MAX_SAFE_INTEGER);
  const maxRetry = commit(maximal,maxInput); accepted(maxRetry,'replayed'); assert.equal(maxRetry.state,maximal);
  reject(maximal,edit('t_over',Number.MAX_SAFE_INTEGER),'PROJECT_LIMIT_EXCEEDED');
});

test('scope permutations replay while authored operation permutations change retry identity', () => {
  const list = [{op:'putEntity',entity:entity('e_a')},{op:'putEntity',entity:entity('e_b')}];
  const input = operations('t_a',0,list,scope({entityIds:['e_b','e_a']}));
  const after = accepted(commit(initial(),input));
  const same = {...input,scope:scope({entityIds:['e_a','e_b']})};
  const replay = commit(after,same); accepted(replay,'replayed'); assert.equal(replay.state,after);
  reject(after,{...same,operations:[list[1],list[0]]},'PROJECT_TRANSACTION_ID_REUSED');
  const newNoOp = accepted(commit(after,operations('t_b',1,list,scope({entityIds:['e_b','e_a']}))));
  assert.equal(newNoOp.head.revision,2); assert.deepEqual(newNoOp.receipts.get('t_b').diff,editLedger.diffs.empty);
});

test('committed receipt command indexes and old snapshots are owned deeply and copied together', () => {
  const state = initial(); const input = edit('t_a',0,'A');
  const transition = commit(state,input); const after = accepted(transition);
  assert.notEqual(after,state); assert.notEqual(after.identities,state.identities); assert.notEqual(after.receipts,state.receipts);
  assert.equal(state.identities.size,0); assert.equal(state.receipts.size,0); assert.equal(state.commands.length,0);
  assert.equal(after.identities.size,1); assert.equal(after.receipts.size,1); assert.equal(after.commands.length,1);
  assert.equal(after.receipts.get('t_a'),transition.result.receipt);
  input.source.intent = 'changed later'; input.operations[0].name = 'changed later';
  assert.equal(after.commands[0].source.intent,''); assert.equal(after.head.name,'A');
  assert.throws(() => transition.result.receipt.source.intent = 'bad',TypeError);
  assert.throws(() => transition.result.receipt.diff.addedEntityIds.push('e_a'),TypeError);
  assert.throws(() => after.commands.push(edit()),TypeError);
  assert.throws(() => after.prefixCosts.push(999),TypeError);
  assert.equal(canonicalize(state.head),work.snapshot);
});

test('replay warnings count the current head while the original receipt remains unchanged', () => {
  const A = edit('t_a',0); const first = commit(initial(),A); const at1 = accepted(first);
  const put = operations('t_b',1,[{op:'putEntity',entity:entity()},{op:'putFile',file:file()}],scope({entityIds:['e_a'],fileIds:['f_a']}));
  const at2 = accepted(commit(at1,put));
  const replay = commit(at2,A); accepted(replay,'replayed');
  assert.equal(replay.result.receipt,first.result.receipt);
  assert.deepEqual(replay.result.diagnostics.map(item=>[item.code,item.details.count]),[['PROJECT_KIND_UNCHECKED',1],['PROJECT_CONTENT_UNVERIFIED',1]]);
  assert.deepEqual(first.result.diagnostics,[]);
  assert.throws(() => replay.result.diagnostics[0].details.count = 99,TypeError);
});

test('literal mixed-invalid priority follows schema retry CAS operation final refs and capacity', () => {
  const full = accepted(commit(initial({maxTransactions:1}),edit()));
  const invalid = {...edit('t_a',999),toolProtocolVersion:'2.0',scope:scope()};
  reject(full,invalid,'PROJECT_FORMAT_UNSUPPORTED');
  reject(full,{...edit('t_a',999),scope:scope()},'PROJECT_TRANSACTION_ID_REUSED');
  reject(full,operations('t_new',0,[{op:'putEntity',entity:entity()}],scope()),'PROJECT_REVISION_CONFLICT');
  const dangling = entity('e_a',{references:[{slot:'x',target:'entity',id:'e_missing',expectedKind:'scene'}]});
  reject(full,operations('t_new',1,[{op:'putEntity',entity:dangling}],scope()),'PROJECT_SCOPE_VIOLATION');
  reject(full,operations('t_new',1,[{op:'putEntity',entity:dangling}],scope({entityIds:['e_a']})),'PROJECT_REFERENCE_MISSING');
  reject(full,edit('t_new',1),'PROJECT_LIMIT_EXCEEDED');
  reject(full,{...edit('t_wrong',999),projectId:'p_b'},'PROJECT_INPUT_INVALID');
  assert.equal(full.identities.has('t_new'),false); assert.equal(full.identities.has('t_wrong'),false);
});

test('every operation and final-state rejection preserves prior identity bytes and unreserved command IDs', () => {
  const baseline = {...JSON.parse(work.snapshot),entities:[entity()],files:[file()],roots:['e_a'],retiredEntityIds:['e_old'],retiredFileIds:['f_old']};
  const state = initial(undefined,baseline);
  const cases = [
    [operations('t_new',0,[{op:'removeEntity',id:'e_absent'}],scope({entityIds:['e_absent']})),'PROJECT_INPUT_INVALID'],
    [operations('t_new',0,[{op:'putEntity',entity:entity('e_old')}],scope({entityIds:['e_old']})),'PROJECT_ID_REUSED'],
    [operations('t_new',0,[{op:'putEntity',entity:entity('e_a',{kind:'other'})}],scope({entityIds:['e_a']})),'PROJECT_ID_REUSED'],
    [operations('t_new',0,[{op:'putFile',file:{...file(),role:'asset'}}],scope({fileIds:['f_a']})),'PROJECT_ID_REUSED'],
    [operations('t_new',0,[{op:'setRoots',roots:[]},{op:'setRoots',roots:[]}],scope({roots:true})),'PROJECT_OPERATION_DUPLICATE'],
    [operations('t_new',0,[{op:'removeEntity',id:'e_a'}],scope({entityIds:['e_a']})),'PROJECT_REFERENCE_MISSING'],
    [operations('t_new',0,[{op:'putEntity',entity:entity('e_b',{references:[{slot:'x',target:'file',id:'f_a',expectedRole:'asset'}]})}],scope({entityIds:['e_b']})),'PROJECT_REFERENCE_TYPE_MISMATCH'],
    [operations('t_new',0,[{op:'putFile',file:{...file(),id:'f_b',path:'A.ts'}}],scope({fileIds:['f_b']})),'PROJECT_PATH_COLLISION']
  ];
  for (const [input,code] of cases) { reject(state,input,code); assert.equal(state.identities.has('t_new'),false); }
  assert.equal(accepted(commit(state,edit('t_new',0))).head.revision,1);
});
