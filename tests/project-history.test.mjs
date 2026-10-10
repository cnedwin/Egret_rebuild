import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as api from '@egret/project';
const ledger=JSON.parse(readFileSync(new URL('./fixtures/project/history-ledger.json',import.meta.url),'utf8'));
const rawCases=JSON.parse(readFileSync(new URL('./fixtures/project/history-raw-cases.json',import.meta.url),'utf8'));
const baseline=()=>JSON.parse(ledger.snapshot),edit=()=>JSON.parse(ledger.edit),restore=()=>JSON.parse(ledger.restore);
const plain=v=>JSON.parse(JSON.stringify(v));
const journal=(b,commands=[])=>JSON.stringify({historySchemaVersion:'1.0',baseline:b,transactions:commands});
function open(text,limits){
  assert.equal(typeof api.openProjectHistory,'function','missing complete openProjectHistory facade');
  return api.openProjectHistory(text,limits);
}
function created(b=baseline(),limits){
  assert.equal(typeof api.createProjectStore,'function','missing complete createProjectStore facade');
  const r=api.createProjectStore(b,limits);
  assert.equal(r.ok,true,JSON.stringify(r.diagnostics));
  return r.value;
}
function failure(r,code,pointer,cause,index){
  assert.equal(r.ok,false);
  assert.equal(Object.hasOwn(r,'value'),false);
  const d=r.diagnostics[0];
  assert.equal(d.code,code);
  if(pointer!==undefined)assert.equal(d.jsonPointer,pointer);
  if(cause!==undefined)assert.deepEqual(plain(d.details),{causeCode:cause,index});
  assert.ok(Object.isFrozen(r)&&Object.isFrozen(d)&&Object.isFrozen(d.details));
  return d;
}
function sameReopen(s){
  const exported=s.exportHistory();assert.equal(exported.ok,true);
  const r=open(exported.value,s.limits);
  assert.equal(r.ok,true,JSON.stringify(r.diagnostics));
  assert.deepEqual(plain(r.value.getSnapshot()),plain(s.getSnapshot()));
  assert.equal(r.value.exportHistory().value,exported.value);
  return r.value;
}
const entity=(data={})=>({id:'e_a',kind:'node',dataSchemaVersion:'1',name:'',data,references:[]});
const file=()=>({id:'f_a',path:'a.txt',role:'source',mediaType:'text/plain',sha256:'0'.repeat(64),byteLength:0});

test('empty and exact tool/a journal exports reopen with identical head and durable original retry receipt',()=>{
  const s=created();sameReopen(s);assert.equal(s.exportHistory().value,'{"baseline":'+ledger.snapshot+',"historySchemaVersion":"1.0","transactions":[]}');
  const first=s.commit(edit());assert.equal(first.status,'committed');assert.deepEqual(plain(first.snapshot),ledger.expectedSnapshot1);sameReopen(s);
  const next=s.commit(restore());assert.equal(next.status,'committed');assert.deepEqual(plain(next.snapshot),ledger.expectedSnapshot2);
  assert.equal(s.exportHistory().value,'{"baseline":'+ledger.snapshot+',"historySchemaVersion":"1.0","transactions":['+ledger.edit+','+ledger.restore+']}');
  const reopened=sameReopen(s);const retry=reopened.commit(edit());assert.equal(retry.status,'replayed');assert.equal(retry.snapshot.revision,2);assert.deepEqual(plain(retry.receipt),plain(first.receipt));
  assert.deepEqual(Object.keys(JSON.parse(s.exportHistory().value)).sort(),['baseline','historySchemaVersion','transactions']);
});

test('checkpoint retains retired IDs while severing earlier restore and retry authority',()=>{
  const b=baseline();b.entities=[entity()];const s=created(b),c=edit();c.operations=[{op:'removeEntity',id:'e_a'}];c.scope={entityIds:['e_a'],fileIds:[],metadata:false,roots:false};assert.equal(s.commit(c).status,'committed');
  const checkpoint=created(s.getSnapshot());assert.equal(checkpoint.earliestRevision,1);assert.deepEqual(plain(checkpoint.getSnapshot().retiredEntityIds),['e_a']);
  assert.equal(checkpoint.commit(c).diagnostics[0].code,'PROJECT_REVISION_CONFLICT');
  assert.equal(checkpoint.commit(restore()).diagnostics[0].code,'PROJECT_RESTORE_UNAVAILABLE');assert.equal(sameReopen(s).commit(c).status,'replayed');
  const parsed=api.parseProjectSnapshot(api.serializeProjectSnapshot(s.getSnapshot()).value);assert.equal(parsed.ok,true);assert.deepEqual(plain(parsed.value),plain(s.getSnapshot()));
});

test('whole journal rejects duplicate retries, CAS gaps, future restore, invalid lifecycle and admission with indices',()=>{
  failure(open(journal(baseline(),[edit(),edit()])), 'PROJECT_HISTORY_INVALID','/transactions/1/transactionId','PROJECT_TRANSACTION_ID_REUSED',2);
  const cas=edit();cas.baseRevision=4;failure(open(journal(baseline(),[cas])),'PROJECT_HISTORY_INVALID','/transactions/0/baseRevision','PROJECT_REVISION_CONFLICT',1);
  const future=restore();future.baseRevision=0;future.targetRevision=1;failure(open(journal(baseline(),[future])),'PROJECT_HISTORY_INVALID','/transactions/0/targetRevision','PROJECT_RESTORE_UNAVAILABLE',1);
  const absent=edit();absent.operations=[{op:'removeEntity',id:'e_a'}];absent.scope.entityIds=['e_a'];failure(open(journal(baseline(),[absent])),'PROJECT_HISTORY_INVALID','/transactions/0/operations/0','PROJECT_INPUT_INVALID',1);
  failure(open(journal(baseline(),[edit()]),{maxReplayWorkUnits:101}),'PROJECT_HISTORY_INVALID','/transactions/0','PROJECT_LIMIT_EXCEEDED',1);
  failure(open(journal(baseline()),{maxReplayWorkUnits:26}),'PROJECT_HISTORY_INVALID','/baseline','PROJECT_LIMIT_EXCEEDED',0);
  failure(open(journal(null)),'PROJECT_HISTORY_INVALID','/baseline','PROJECT_INPUT_INVALID',0);
});

test('embedded versions and mixed invalid baselines retain selected code pointer cause and index',()=>{
  for(const c of rawCases){const text=c.text??journal({...baseline(),...c.baselinePatch});failure(open(text),c.code,c.pointer,c.causeCode,c.index);}
  for(const mutate of [b=>b.projectSchemaVersion=2,b=>b.versions.toolProtocolVersion=2]){const b=baseline();mutate(b);failure(open(journal(b)),'PROJECT_HISTORY_INVALID',undefined,'PROJECT_INPUT_INVALID',0);}
  const numeric=edit();numeric.toolProtocolVersion=2;failure(open(journal(baseline(),[numeric])),'PROJECT_HISTORY_INVALID','/transactions/0/toolProtocolVersion','PROJECT_INPUT_INVALID',1);
  const actor=edit();actor.source.actorKind='bad';failure(open(journal(baseline(),[actor])),'PROJECT_HISTORY_INVALID','/transactions/0/source/actorKind','PROJECT_INPUT_INVALID',1);
  const b=baseline();b.files=[{...file(),path:'../x',role:17}];failure(open(journal(b)),'PROJECT_HISTORY_INVALID','/baseline/files/0/path','PROJECT_PATH_INVALID',0);
  const badRole=baseline();badRole.files=[{...file(),role:'bad'}];failure(open(journal(badRole)),'PROJECT_HISTORY_INVALID','/baseline/files/0/role','PROJECT_INPUT_INVALID',0);
  const exact=journal({...baseline(),revision:0,name:17}).replace('"revision":0','"revision":9007199254740991.1');failure(open(exact),'PROJECT_HISTORY_INVALID','/baseline/revision','PROJECT_LIMIT_EXCEEDED',0);
});

test('generated wrapper order interleaves baseline and sequential entry admission ahead of later errors',()=>{
  const bad=edit();bad.baseRevision=3;const later=restore();later.toolProtocolVersion='2.0';failure(open(journal(baseline(),[bad,later])),'PROJECT_HISTORY_INVALID','/transactions/0/baseRevision','PROJECT_REVISION_CONFLICT',1);
  const b={...baseline(),projectId:'bad'};failure(open(JSON.stringify({historySchemaVersion:'1.0',baseline:b})),'PROJECT_HISTORY_INVALID','/baseline/projectId','PROJECT_ID_INVALID',0);
  failure(open(JSON.stringify({historySchemaVersion:'1.0',baseline:b,transactions:17})),'PROJECT_HISTORY_INVALID','/baseline/projectId','PROJECT_ID_INVALID',0);
  failure(open(journal(b,[later])),'PROJECT_HISTORY_INVALID','/baseline/projectId','PROJECT_ID_INVALID',0);
  failure(open(JSON.stringify({...JSON.parse(journal(b)),extra:1})),'PROJECT_INPUT_INVALID','');
  failure(open(journal(b,[later])+' trailing'),'PROJECT_INPUT_INVALID');
});

test('whole raw and local raw UTF8 bounds count interior whitespace but exempt exterior payload whitespace',()=>{
  const empty='{"baseline":'+ledger.snapshot+',"historySchemaVersion":"1.0","transactions":[]}';assert.equal(Buffer.byteLength(empty),298);
  assert.equal(open(empty,{maxHistoryUtf8Bytes:298,maxSnapshotUtf8Bytes:238}).ok,true);failure(open(empty,{maxHistoryUtf8Bytes:297}),'PROJECT_LIMIT_EXCEEDED');
  const outside=' {"baseline":  '+ledger.snapshot+'  ,"historySchemaVersion":"1.0","transactions":[]} ';assert.equal(open(outside,{maxSnapshotUtf8Bytes:238}).ok,true);
  const inside='{"baseline":{ '+ledger.snapshot.slice(1)+',"historySchemaVersion":"1.0","transactions":[]}';failure(open(inside,{maxSnapshotUtf8Bytes:238}),'PROJECT_LIMIT_EXCEEDED','/baseline');
  assert.equal(api.parseProjectSnapshot(' '+ledger.snapshot,{maxSnapshotUtf8Bytes:239}).ok,true);failure(api.parseProjectSnapshot(' '+ledger.snapshot,{maxSnapshotUtf8Bytes:238}),'PROJECT_LIMIT_EXCEEDED');
  assert.equal(api.parseProjectTransaction(' '+ledger.edit,{maxTransactionUtf8Bytes:394}).ok,true);failure(api.parseProjectTransaction(' '+ledger.edit,{maxTransactionUtf8Bytes:393}),'PROJECT_LIMIT_EXCEEDED');
  // The incremental canonical estimate reaches 240 at the final protocol
  // value, before the later closing-object raw-span check can run.
  const unicode=ledger.snapshot.replace('"name":""','"name":"é"');assert.equal(Buffer.byteLength(unicode),240);assert.equal(open('{"baseline":'+unicode+',"historySchemaVersion":"1.0","transactions":[]}',{maxSnapshotUtf8Bytes:240,maxHistoryUtf8Bytes:300}).ok,true);failure(open('{"baseline":'+unicode+',"historySchemaVersion":"1.0","transactions":[]}',{maxSnapshotUtf8Bytes:239}),'PROJECT_LIMIT_EXCEEDED','/baseline/versions/toolProtocolVersion');
  const commandInside=ledger.edit.slice(0,-1)+' }';failure(open('{"baseline":'+ledger.snapshot+',"historySchemaVersion":"1.0","transactions":['+commandInside+']}',{maxTransactionUtf8Bytes:393}),'PROJECT_LIMIT_EXCEEDED','/transactions/0');
  assert.equal(open(' {"baseline":'+ledger.snapshot+',"historySchemaVersion":"1.0","transactions":[  '+ledger.edit+'  ]} ',{maxTransactionUtf8Bytes:393}).ok,true);
});

test('snapshot and transaction depth32 survive embedded resets while depth33 fails',()=>{
  let data={};for(let i=0;i<28;i++)data={x:data};const b=baseline();b.entities=[entity(data)];assert.equal(api.parseProjectSnapshot(JSON.stringify(b)).ok,true);assert.equal(open(journal(b)).ok,true);
  b.entities[0].data={x:data};failure(api.parseProjectSnapshot(JSON.stringify(b)),'PROJECT_LIMIT_EXCEEDED');failure(open(journal(b)),'PROJECT_LIMIT_EXCEEDED');
  let txData={};for(let i=0;i<27;i++)txData={x:txData};const c=edit();c.operations=[{op:'putEntity',entity:entity(txData)}];c.scope.entityIds=['e_a'];assert.equal(api.parseProjectTransaction(JSON.stringify(c)).ok,true);assert.equal(open(journal(baseline(),[c])).ok,true);
  c.operations[0].entity.data={x:txData};failure(api.parseProjectTransaction(JSON.stringify(c)),'PROJECT_LIMIT_EXCEEDED');failure(open(journal(baseline(),[c])),'PROJECT_LIMIT_EXCEEDED');
});

test('all successful public operations reopen at exact capacity, retry before CAS/count/bytes/work/revision',()=>{
  const s=created(undefined,{maxSnapshotUtf8Bytes:238,maxTransactionUtf8Bytes:393,maxHistoryUtf8Bytes:691,maxReplayWorkUnits:102,maxTransactions:1});sameReopen(s);const first=s.commit(edit());assert.equal(first.status,'committed');sameReopen(s);
  assert.equal(s.commit(edit()).status,'replayed');const changed=edit();changed.source.intent='x';assert.equal(s.commit(changed).diagnostics[0].code,'PROJECT_LIMIT_EXCEEDED');
  const invalid=edit();invalid.source.actorKind='bad';assert.equal(s.commit(invalid).diagnostics[0].code,'PROJECT_INPUT_INVALID');const fresh=edit();fresh.transactionId='t_b';fresh.baseRevision=1;assert.equal(s.commit(fresh).diagnostics[0].code,'PROJECT_LIMIT_EXCEEDED');sameReopen(s);
  failure(open(journal(baseline(),[edit(),{...edit(),transactionId:'t_b',baseRevision:1}]),{maxTransactions:1}),'PROJECT_HISTORY_INVALID',undefined,'PROJECT_LIMIT_EXCEEDED',2);
  const b=baseline();b.revision=9007199254740990;const max=created(b);const c=edit();c.baseRevision=b.revision;assert.equal(max.commit(c).status,'committed');assert.equal(max.commit(c).status,'replayed');sameReopen(max);
  for(const category of ['entities','files']){const b=baseline();if(category==='entities'){b.entities=[entity()];b.retiredEntityIds=['e_old'];}else{b.files=[file()];b.retiredFileIds=['f_old'];}const key=category==='entities'?'maxEntities':'maxFiles';sameReopen(created(b,{[key]:2}));failure(api.createProjectStore(b,{[key]:1}),'PROJECT_LIMIT_EXCEEDED');failure(open(journal(b),{[key]:1}),'PROJECT_HISTORY_INVALID',undefined,'PROJECT_LIMIT_EXCEEDED',0);}
});

test('public integer and general-number priorities distinguish nonfinite supplied values without leaking candidates',()=>{
  for(const value of [NaN,Infinity,-Infinity,-0,1.5,9007199254740992]){const b=baseline();b.revision=value;failure(api.createProjectStore(b),'PROJECT_LIMIT_EXCEEDED','/revision');failure(api.serializeProjectSnapshot(b),'PROJECT_LIMIT_EXCEEDED','/revision');}
  for(const token of ['1e999','-0e999','9007199254740991.1']){failure(api.parseProjectSnapshot(ledger.snapshot.replace('"revision":0','"revision":'+token)),'PROJECT_LIMIT_EXCEEDED','/revision');failure(open(journal(baseline()).replace('"revision":0','"revision":'+token)),'PROJECT_HISTORY_INVALID','/baseline/revision','PROJECT_LIMIT_EXCEEDED',0);}
  for(const value of [NaN,Infinity,-Infinity]){const b=baseline();b.entities=[entity({n:value})];failure(api.createProjectStore(b),'PROJECT_INPUT_INVALID','/entities/0/data/n');failure(api.serializeProjectSnapshot(b),'PROJECT_INPUT_INVALID','/entities/0/data/n');}
  const b=baseline();b.entities=[entity({n:0})];const overflow=JSON.stringify(b).replace('"n":0','"n":1e999');failure(api.parseProjectSnapshot(overflow),'PROJECT_INPUT_INVALID','/entities/0/data/n');failure(open(journal(b).replace('"n":0','"n":1e999')),'PROJECT_HISTORY_INVALID','/baseline/entities/0/data/n','PROJECT_INPUT_INVALID',0);
  b.entities[0].data.n=-0;const s=created(b);assert.equal(Object.is(s.getSnapshot().entities[0].data.n,-0),false);sameReopen(s);
  const c=edit();c.baseRevision=Infinity;assert.equal(s.commit(c).diagnostics[0].code,'PROJECT_LIMIT_EXCEEDED');
  const bad={...baseline(),projectId:'bad',revision:Infinity};failure(api.createProjectStore(bad),'PROJECT_ID_INVALID','/projectId');
});

test('public real identity permutations normalize retry scope while authored operations and roots keep order',()=>{
  const b=baseline();b.entities=[{...entity(),id:'e_z'},entity()];b.files=[{...file(),id:'f_z',path:'z.txt'},file()];b.retiredEntityIds=['e_zold','e_aold'];b.retiredFileIds=['f_zold','f_aold'];
  const reverse={...b,entities:[...b.entities].reverse(),files:[...b.files].reverse(),retiredEntityIds:[...b.retiredEntityIds].reverse(),retiredFileIds:[...b.retiredFileIds].reverse()};assert.equal(api.serializeProjectSnapshot(b).value,api.serializeProjectSnapshot(reverse).value);
  const s=created(b),c=edit();c.scope.entityIds=['e_z','e_a'];c.scope.fileIds=['f_z','f_a'];c.scope.roots=true;c.operations.push({op:'setRoots',roots:['e_a','e_z']});const first=s.commit(c);assert.equal(first.status,'committed');const perm=plain(c);perm.scope.entityIds.reverse();perm.scope.fileIds.reverse();assert.equal(s.commit(perm).status,'replayed');
  const different=plain(c);different.operations.reverse();assert.equal(s.commit(different).diagnostics[0].code,'PROJECT_TRANSACTION_ID_REUSED');const invalid=plain(c);invalid.toolProtocolVersion=2;assert.equal(s.commit(invalid).diagnostics[0].code,'PROJECT_INPUT_INVALID');sameReopen(s);
});

test('store results limits snapshots receipts and nested JSON are frozen and input getters are never invoked',()=>{
  const input=baseline(),limits={maxTransactions:1};const result=api.createProjectStore(input,limits);assert.equal(result.ok,true);const s=result.value;input.name='later';limits.maxTransactions=2;assert.equal(s.getSnapshot().name,'');assert.equal(s.limits.maxTransactions,1);
  const c=edit(),r=s.commit(c);c.source.actorId='later';assert.equal(r.receipt.source.actorId,'a');for(const v of [result,result.diagnostics,s,s.getSnapshot,s.commit,s.exportHistory,s.limits,r,r.receipt,r.receipt.source,r.receipt.diff,r.receipt.diff.addedEntityIds,r.snapshot,r.snapshot.versions,r.snapshot.entities,s.exportHistory()])assert.ok(Object.isFrozen(v));
  assert.throws(()=>s.limits.maxTransactions=2,TypeError);assert.throws(()=>r.snapshot.versions.engineVersion='x',TypeError);assert.throws(()=>r.receipt.source.actorId='x',TypeError);
  let reads=0;const hostile={...edit()};Object.defineProperty(hostile,'baseRevision',{enumerable:true,get(){reads++;return 1;}});const head=s.getSnapshot(),history=s.exportHistory().value;assert.equal(s.commit(hostile).status,'rejected');assert.equal(reads,0);assert.equal(s.getSnapshot(),head);assert.equal(s.exportHistory().value,history);
  for(const overrides of [{unknown:1},{maxTransactions:undefined},{maxTransactions:0},{maxJsonDepth:65}])failure(api.createProjectStore(baseline(),overrides),'PROJECT_INPUT_INVALID');sameReopen(s);
});

test('valid unauthenticated journal edits remain undetectable and diagnostics never disclose source',()=>{
  const s=created(),c=edit();c.operations[0].name='original';s.commit(c);const h=JSON.parse(s.exportHistory().value);h.transactions[0].operations[0].name='tampered';const r=open(JSON.stringify(h));assert.equal(r.ok,true);assert.equal(r.value.getSnapshot().name,'tampered');
  const invalid=edit();invalid.source.intent='secret';invalid.source.actorKind='bad';const d=failure(open(journal(baseline(),[invalid])),'PROJECT_HISTORY_INVALID',undefined,'PROJECT_INPUT_INVALID',1);assert.equal(JSON.stringify(d).includes('secret'),false);
  assert.deepEqual(Object.keys(api).sort(),['DEFAULT_PROJECT_LIMITS','createProjectStore','openProjectHistory','parseProjectSnapshot','parseProjectTransaction','serializeProjectSnapshot']);
});
