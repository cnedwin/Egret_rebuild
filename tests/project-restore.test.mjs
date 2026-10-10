import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as api from '@egret/project';
const ledger=JSON.parse(readFileSync(new URL('./fixtures/project/history-ledger.json',import.meta.url),'utf8'));
const baseline=()=>JSON.parse(ledger.snapshot);
const source={actorId:'a',actorKind:'tool',toolId:'a',toolVersion:'1',intent:''};
const pins={engineVersion:'1',resourceFormatVersion:'1',toolProtocolVersion:'1.0'};
const entity=(id='e_a')=>({id,kind:'node',dataSchemaVersion:'1',name:'',data:{},references:[]});
const file=(id='f_a')=>({id,path:id+'.txt',role:'source',mediaType:'text/plain',sha256:'0'.repeat(64),byteLength:0});
const edit=(id,base,operations,scope={entityIds:[],fileIds:[],metadata:true,roots:false})=>({command:'edit',toolProtocolVersion:'1.0',projectId:'p_a',transactionId:id,baseRevision:base,source,scope,operations});
const restore=(id,base,target)=>({command:'restore',toolProtocolVersion:'1.0',projectId:'p_a',transactionId:id,baseRevision:base,source,targetRevision:target});
function store(b=baseline(),limits){assert.equal(typeof api.createProjectStore,'function','missing complete createProjectStore facade');const r=api.createProjectStore(b,limits);assert.equal(r.ok,true);return r.value;}
const plain=value=>JSON.parse(JSON.stringify(value));
function accepted(s,c){const r=s.commit(c);assert.equal(r.status,'committed',JSON.stringify(r.diagnostics));return r;}
function rejected(s,c,code){const head=s.getSnapshot(),bytes=s.exportHistory().value;const r=s.commit(c);assert.equal(r.status,'rejected');assert.equal(r.diagnostics[0].code,code);assert.equal(r.snapshot,head);assert.equal(s.getSnapshot(),head);assert.equal(s.exportHistory().value,bytes);return r;}

test('independently authored tool/a literals fix byte and per-key work oracles before real restore',()=>{
  for(const [name,bytes] of [['snapshot',238],['edit',393],['restore',212]])assert.equal(Buffer.byteLength(ledger[name]),bytes);
  assert.equal(Buffer.byteLength('{"baseline":'+ledger.snapshot+',"historySchemaVersion":"1.0","transactions":[]}'),298);
  assert.equal(Buffer.byteLength('{"baseline":'+ledger.snapshot+',"historySchemaVersion":"1.0","transactions":['+ledger.edit+']}'),691);
  assert.equal(Buffer.byteLength('{"baseline":'+ledger.snapshot+',"historySchemaVersion":"1.0","transactions":['+ledger.edit+','+ledger.restore+']}'),904);
  assert.equal(Object.values(ledger.snapshotContributions).reduce((a,b)=>a+b,0),27);
  assert.equal(Object.values(ledger.editContributions).reduce((a,b)=>a+b,0),48);
  assert.equal(Object.values(ledger.restoreContributions).reduce((a,b)=>a+b,0),25);
  const s=store(undefined,{maxReplayWorkUnits:181});accepted(s,JSON.parse(ledger.edit));const r=accepted(s,JSON.parse(ledger.restore));assert.deepEqual(plain(r.snapshot),ledger.expectedSnapshot2);
  const low=store(undefined,{maxReplayWorkUnits:180});accepted(low,JSON.parse(ledger.edit));rejected(low,JSON.parse(ledger.restore),'PROJECT_LIMIT_EXCEEDED');
  assert.equal(s.commit(JSON.parse(ledger.restore)).status,'replayed');
});

test('entity and file restoration revives original categories and preserves retirement union across cycles',()=>{
  const b=baseline();b.entities=[entity()];b.files=[file()];b.retiredEntityIds=['e_old'];b.retiredFileIds=['f_old'];
  const s=store(b);const scope={entityIds:['e_a'],fileIds:['f_a'],metadata:false,roots:false};
  accepted(s,edit('t_a',0,[{op:'removeEntity',id:'e_a'},{op:'removeFile',id:'f_a'}],scope));
  const revived=accepted(s,restore('t_b',1,0));assert.deepEqual(plain(revived.snapshot),{...b,revision:2});
  accepted(s,edit('t_c',2,[{op:'removeEntity',id:'e_a'},{op:'removeFile',id:'f_a'}],scope));
  assert.deepEqual(plain(accepted(s,restore('t_d',3,0)).snapshot),{...b,revision:4});
  rejected(s,edit('t_e',4,[{op:'putEntity',entity:{...entity(),kind:'other'}}],scope),'PROJECT_ID_REUSED');
  rejected(s,edit('t_f',4,[{op:'putFile',file:{...file(),role:'asset'}}],scope),'PROJECT_ID_REUSED');
  const checkpoint=store(s.getSnapshot());rejected(checkpoint,edit('t_g',4,[{op:'putEntity',entity:entity('e_old')}],{...scope,entityIds:['e_old']}),'PROJECT_ID_REUSED');
  rejected(checkpoint,edit('t_h',4,[{op:'putFile',file:{...file(),role:'asset'}}],scope),'PROJECT_ID_REUSED');
});

test('restore retires post-target active and retired identities without rewinding knowledge',()=>{
  const s=store();const scope={entityIds:['e_a','e_b'],fileIds:['f_a','f_b'],metadata:false,roots:false};
  accepted(s,edit('t_a',0,[{op:'putEntity',entity:entity()},{op:'putFile',file:file()}],scope));
  accepted(s,edit('t_b',1,[{op:'removeEntity',id:'e_a'},{op:'removeFile',id:'f_a'},{op:'putEntity',entity:entity('e_b')},{op:'putFile',file:file('f_b')}],scope));
  accepted(s,restore('t_c',2,0));assert.deepEqual(plain(s.getSnapshot()),{...baseline(),revision:3,retiredEntityIds:['e_a','e_b'],retiredFileIds:['f_a','f_b']});
  const revived=accepted(s,restore('t_d',3,1));assert.deepEqual(plain(revived.snapshot),{...baseline(),revision:4,entities:[entity()],files:[file()],retiredEntityIds:['e_b'],retiredFileIds:['f_b']});
  rejected(s,edit('t_e',4,[{op:'putEntity',entity:entity('e_b')}],scope),'PROJECT_ID_REUSED');
  rejected(s,restore('t_f',4,5),'PROJECT_RESTORE_UNAVAILABLE');
});

test('nonzero baseline indices and several restore targets use full prefix rather than local target cost',()=>{
  for(const limit of [564,563]){const b=baseline();b.revision=7;const s=store(b,{maxReplayWorkUnits:limit});
    accepted(s,edit('t_a',7,[{op:'setMetadata',name:'',versions:pins}]));
    accepted(s,restore('t_b',8,8));
    const c=restore('t_c',9,9);if(limit===564)assert.equal(accepted(s,c).snapshot.revision,10);else rejected(s,c,'PROJECT_LIMIT_EXCEEDED');
    rejected(s,restore('t_d',s.getSnapshot().revision,6),'PROJECT_RESTORE_UNAVAILABLE');
  }
});

test('near-maxTransactions nested restores reconstruct without call-stack recursion or snapshot cache',async()=>{
  const b=baseline(),s=store(b);for(let i=0;i<1000;i++)accepted(s,restore('t_'+i,i,0));
  accepted(s,restore('t_nested',1000,1000));const r=accepted(s,restore('t_outer',1001,1001));assert.equal(r.snapshot.revision,1002);
  const opened=api.openProjectHistory(s.exportHistory().value,s.limits);assert.equal(opened.ok,true);assert.deepEqual(plain(opened.value.getSnapshot()),{...b,revision:1002});
});
