import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdir,mkdtemp,cp,rm,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const root=fileURLToPath(new URL('..',import.meta.url));
const api=await import(process.env.PROJECT_ORACLE_COPY?pathToFileURL(path.join(process.env.PROJECT_ORACLE_COPY,'index.js')).href:'@egret/project');
const literal=JSON.parse(await readFile(new URL('./fixtures/project/history-ledger.json',import.meta.url),'utf8'));
const snap=()=>JSON.parse(literal.snapshot),edit=()=>JSON.parse(literal.edit),restore=()=>JSON.parse(literal.restore);
const plain=value=>JSON.parse(JSON.stringify(value));
const emptyDiff={addedEntityIds:[],changedEntityIds:[],removedEntityIds:[],addedFileIds:[],changedFileIds:[],removedFileIds:[],metadataChanged:false,rootsChanged:false};
const history=(commands=[])=>' {"historySchemaVersion":"1.0","baseline":'+literal.snapshot+',"transactions":['+commands.join(',')+']}';
const good=result=>{assert.equal(result.ok,true);return result.value;};
const code=result=>result.diagnostics[0].code;

test('UTF16 canonical bytes preserve supplementary-before-BMP and numeric-key ordering',()=>{
 const baseline=snap();baseline.entities=[{id:'e_a',kind:'scene',dataSchemaVersion:'1',name:'',data:{'\uE000':1,'😀':2,'2':2,'10':1},references:[]}];
 const bytes=good(api.serializeProjectSnapshot(baseline));
 assert.ok(bytes.includes('"data":{"10":1,"2":2,"😀":2,"\uE000":1}'));
});
test('getter input is rejected without evaluation or store authority mutation',()=>{
 const baseline=snap();let reads=0;
 Object.defineProperty(baseline,'name',{enumerable:true,get(){reads++;return '';}});
 assert.equal(api.createProjectStore(baseline).ok,false);assert.equal(reads,0);
});
test('exact mathematical integer token cannot round into accepted revision',()=>{
 const text=literal.snapshot.replace('"revision":0','"revision":9007199254740991.1');
 const result=api.parseProjectSnapshot(text);assert.equal(result.ok,false);assert.equal(code(result),'PROJECT_LIMIT_EXCEEDED');
 assert.equal(result.diagnostics[0].jsonPointer,'/revision');
});
test('known canonical retry precedes CAS and retains original receipt and current head',()=>{
 const store=good(api.createProjectStore(snap(),{maxTransactions:1,maxReplayWorkUnits:102,maxHistoryUtf8Bytes:691}));
 const command=edit(),first=store.commit(command),before=store.exportHistory();
 assert.equal(first.status,'committed');assert.deepEqual(plain(first.receipt),{transactionId:'t_a',beforeRevision:0,afterRevision:1,source:command.source,diff:emptyDiff});
 const retry=store.commit(edit());assert.equal(retry.status,'replayed');assert.equal(retry.receipt,first.receipt);assert.equal(retry.snapshot,first.snapshot);
 assert.deepEqual(store.exportHistory(),before);
});
test('empty history admission accounts for its complete 298 byte envelope',()=>{
 const result=api.createProjectStore(snap(),{maxHistoryUtf8Bytes:297});
 assert.equal(result.ok,false);assert.equal(code(result),'PROJECT_LIMIT_EXCEEDED');
 const store=good(api.createProjectStore(snap(),{maxHistoryUtf8Bytes:298,maxReplayWorkUnits:27}));
 assert.equal(good(store.exportHistory()),'{"baseline":'+literal.snapshot+',"historySchemaVersion":"1.0","transactions":[]}');
 assert.equal(good(api.openProjectHistory(good(store.exportHistory()),store.limits)).getSnapshot().revision,0);
});
test('duplicate journal retry rejects rather than silently producing a replayed entry',()=>{
 const result=api.openProjectHistory(history([literal.edit,literal.edit]));
 assert.equal(result.ok,false);assert.equal(code(result),'PROJECT_HISTORY_INVALID');
 assert.deepEqual(plain(result.diagnostics[0].details),{causeCode:'PROJECT_TRANSACTION_ID_REUSED',index:2});
});
test('restore preserves learned retirement and complete authored snapshot expectations',()=>{
 const store=good(api.createProjectStore(snap()));
 const command=edit();command.scope={entityIds:['e_a'],fileIds:[],metadata:false,roots:false};
 command.operations=[{op:'putEntity',entity:{id:'e_a',kind:'scene',dataSchemaVersion:'1',name:'',data:{},references:[]}}];
 const added=store.commit(command);assert.equal(added.status,'committed');
 assert.deepEqual(plain(added.receipt.diff),{...emptyDiff,addedEntityIds:['e_a']});
 const restored=store.commit(restore());assert.equal(restored.status,'committed');
 assert.deepEqual(plain(restored.snapshot),{...snap(),revision:2,retiredEntityIds:['e_a']});
 assert.deepEqual(plain(restored.receipt.diff),{...emptyDiff,removedEntityIds:['e_a']});
});
test('complete retained target P is charged without recursive or local accounting',()=>{
 const store=good(api.createProjectStore(snap(),{maxReplayWorkUnits:563}));
 assert.equal(store.commit(edit()).status,'committed');
 const second=restore();second.targetRevision=1;assert.equal(store.commit(second).status,'committed');
 const third={...restore(),baseRevision:2,targetRevision:2,transactionId:'t_c'};
 const head=store.getSnapshot(),before=good(store.exportHistory());
 assert.equal(store.commit(third).status,'rejected');assert.equal(store.getSnapshot(),head);assert.equal(good(store.exportHistory()),before);
 const admitted=good(api.createProjectStore(snap(),{maxReplayWorkUnits:564}));
 admitted.commit(edit());admitted.commit(second);assert.equal(admitted.commit(third).status,'committed');
});
test('rejected final reference preserves head identity history and unreserved transaction ID',()=>{
 const store=good(api.createProjectStore(snap()));const old=store.getSnapshot(),before=good(store.exportHistory());
 const command=edit();command.operations=[{op:'setRoots',roots:['e_missing']}];command.scope={entityIds:[],fileIds:[],metadata:false,roots:true};
 const result=store.commit(command);assert.equal(result.status,'rejected');
 assert.equal(store.getSnapshot(),old);assert.equal(good(store.exportHistory()),before);assert.equal(code(result),'PROJECT_REFERENCE_MISSING');
 assert.equal(store.commit(edit()).status,'committed');
});
test('independent literal bytes work histories and selected ordering survive the public facade',()=>{
 assert.equal(Buffer.byteLength(literal.snapshot),238);assert.equal(Buffer.byteLength(literal.edit),393);assert.equal(Buffer.byteLength(literal.restore),212);
 const store=good(api.createProjectStore(snap(),{maxReplayWorkUnits:181,maxHistoryUtf8Bytes:904}));
 const first=store.commit(edit());assert.equal(first.status,'committed');assert.deepEqual(plain(first.snapshot),literal.expectedSnapshot1);
 const second=store.commit(restore());assert.equal(second.status,'committed');assert.deepEqual(plain(second.snapshot),literal.expectedSnapshot2);
 const bytes=good(store.exportHistory());assert.equal(bytes,'{"baseline":'+literal.snapshot+',"historySchemaVersion":"1.0","transactions":['+literal.edit+','+literal.restore+']}');
 assert.equal(Buffer.byteLength(bytes),904);assert.deepEqual(plain(good(api.openProjectHistory(bytes,store.limits)).getSnapshot()),literal.expectedSnapshot2);
 const wrong=edit();wrong.baseRevision=8;const later={...restore(),toolProtocolVersion:'2.0'};
 const failed=api.openProjectHistory(history([JSON.stringify(wrong),JSON.stringify(later)]));
 assert.equal(code(failed),'PROJECT_HISTORY_INVALID');assert.deepEqual(plain(failed.diagnostics[0].details),{causeCode:'PROJECT_REVISION_CONFLICT',index:1});
 const small=good(api.createProjectStore(snap(),{maxReplayWorkUnits:180}));small.commit(edit());assert.equal(small.commit(restore()).status,'rejected');
 const malformed=snap();malformed.projectId='bad';malformed.extra=true;
 const local=api.createProjectStore(malformed);assert.equal(code(local),'PROJECT_INPUT_INVALID');assert.equal(local.diagnostics[0].jsonPointer,'');
});

// Each controlled defect changes only a disposable copy of real build artifacts.
// Child failures must identify the intended assertion, never an import or crash.
if(!process.env.PROJECT_ORACLE_COPY){
 const variants=[
  ['swapped UTF16','canonical.js','keys.sort();','keys.sort((a,b)=>b<a?-1:b>a?1:0);','UTF16 canonical bytes','ERR_ASSERTION'],
  ['getter evaluation','live-input.js','const descriptor = Object.getOwnPropertyDescriptor(value, key);','const descriptor = Object.getOwnPropertyDescriptor(value, key); if (descriptor && !("value" in descriptor)) Reflect.get(value, key);','getter input','ERR_ASSERTION'],
  ['Number-only integer','validation-order.js','|| token && (!token.integerSafe || token.negativeZero)','|| false','exact mathematical integer','ERR_ASSERTION'],
  ['retry after CAS','commit.js','const identity = state.identities.get(command.transactionId);','if(command.baseRevision !== state.head.revision) return fail("PROJECT_REVISION_CONFLICT", "/baseRevision"); const identity = state.identities.get(command.transactionId);','known canonical retry','ERR_ASSERTION'],
  ['empty envelope omitted','state.js','history.value > limits.maxHistoryUtf8Bytes','false','empty history admission','ERR_ASSERTION'],
  ['duplicate journal retry','history.js','if (state.identities.has(command.value.value.transactionId))','if (false)','duplicate journal retry','ERR_ASSERTION',true],
  ['retirement rewind','restore.js','new Set([...current.entities.map(item => item.id), ...current.retiredEntityIds, ...target.retiredEntityIds])','new Set(target.retiredEntityIds)','restore preserves','ERR_ASSERTION'],
  ['local P','commit.js','state.prefixCosts[command.targetRevision - state.baseline.revision]','state.prefixCosts[0]','complete retained target P','ERR_ASSERTION'],
  ['recursive P omission','replay-cost.js','return cost;','return targetCost === undefined ? cost : nextPrefixCost(previous, commandNodes, snapshotNodes, undefined, limit);','complete retained target P','ERR_ASSERTION'],
  ['head before validation','store.js','const transition = commitPrepared(state, checked.value, restoreCandidate);','state = { ...state, head: { ...state.head, revision: state.head.revision + 1 } }; const transition = commitPrepared(state, checked.value, restoreCandidate);','rejected final reference','ERR_ASSERTION']
 ];
 for(const [name,file,needle,replacement,pattern,reason,duplicate] of variants)test('isolated sensitivity: '+name,async t=>{
  const parent=path.resolve(root,'work');await mkdir(parent,{recursive:true});const dir=await mkdtemp(path.join(parent,'project-oracle-'));
  const dist=path.join(dir,'dist'),source=path.join(root,'packages/project/dist');
  const digest=body=>createHash('sha256').update(body).digest('hex');
  const original=await readFile(path.join(source,file),'utf8');
  try{
   await cp(source,dist,{recursive:true});
   const require=createRequire(path.join(root,'packages/project/package.json'));
   const dependency=path.resolve(path.dirname(require.resolve('jsonc-parser')),'../..');
   await cp(dependency,path.join(dir,'node_modules/jsonc-parser'),{recursive:true});
   const target=path.join(dist,file);assert.ok(original.includes(needle),'exact mutation anchor exists');
   let changed=original.replace(needle,replacement);
   if(duplicate)changed=changed.replace('transition.result.status !== "committed"','transition.result.status === "rejected"');
   await writeFile(target,changed);
   const args=['--test','--test-name-pattern',pattern,fileURLToPath(import.meta.url)];
   const env={...process.env,PROJECT_ORACLE_COPY:dist};
   // A new CLI test process must not inherit the parent's node:test child marker.
   delete env.NODE_TEST_CONTEXT;
   const red=spawnSync(process.execPath,args,{cwd:root,env,encoding:'utf8',timeout:30000});
   t.diagnostic(JSON.stringify({name,status:red.status,stdout:red.stdout,stderr:red.stderr}));
   assert.equal(red.status,1);assert.match(red.stdout,new RegExp(reason));assert.doesNotMatch(red.stdout+'\n'+red.stderr,/ERR_MODULE_NOT_FOUND|SyntaxError|ReferenceError/);
   await writeFile(target,original);assert.equal(digest(await readFile(target)),digest(original));
   const restored=spawnSync(process.execPath,args,{cwd:root,env,encoding:'utf8',timeout:30000});
   t.diagnostic(JSON.stringify({name,restoredStatus:restored.status,stdout:restored.stdout,stderr:restored.stderr}));assert.equal(restored.status,0);
   assert.equal(digest(await readFile(path.join(source,file))),digest(original));
  }finally{
   const resolved=path.resolve(dir);assert.ok(resolved.startsWith(parent+path.sep));assert.ok(path.basename(resolved).startsWith('project-oracle-'));
   await rm(resolved,{recursive:true,force:true});
  }
 });
}
