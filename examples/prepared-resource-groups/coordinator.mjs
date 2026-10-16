// SPDX-License-Identifier: Apache-2.0
// Example-local public SDK composition; no DOM or private SDK ports.
import { AssetLease, EgretError, Scope, Texture, isTexture } from '@egret/engine';

const APPLY = Reflect.apply, FREEZE = Object.freeze, THEN = Promise.prototype.then;
const SCOPE_STATE = Object.getOwnPropertyDescriptor(Scope.prototype, 'state').get;
const SCOPE_USE = Scope.prototype.use, SCOPE_DISPOSE = Scope.prototype.dispose;
const LEASE_VALUE = Object.getOwnPropertyDescriptor(AssetLease.prototype, 'value').get;
const TEXTURE_IMAGE = Object.getOwnPropertyDescriptor(Texture.prototype, 'imageData').get;
const TEXTURE_RECT = Object.getOwnPropertyDescriptor(Texture.prototype, 'sourceRect').get;
const WEAK_GET = WeakMap.prototype.get;
const SET_SIZE = Object.getOwnPropertyDescriptor(Set.prototype, 'size').get;
const SETS = FREEZE({ classic:FREEZE(['A','B']), summer:FREEZE(['C','D']), mix:FREEZE(['A','D']) });
const PINS = FREEZE({
  A:FREEZE({bytes:83,sha256:'376a6eaaeb1ca8861b6a0ee62db3edbb0ec926648f8c20cfd5f6e57c1bf44960'}),
  B:FREEZE({bytes:80,sha256:'c37296e1b63b40da2e17d8cc31d88819f35f52e1d219abc367288fda45ceaa78'}),
  C:FREEZE({bytes:81,sha256:'e27c682265405cf30b6cbe9dc453ea2d7d01235e6c2512286f9fc7e1603dbd66'}),
  D:FREEZE({bytes:83,sha256:'d2c3b3461b2b5d8e6a48608c83528efe78c6a0d3b219dc0038c23ccf016c3f98'}),
});
const MAXIMUM = FREEZE({sets:3,encodedBytes:498,decodedBytes:6144});
const IGNORE = () => {};
function fault(code, cause) { return new EgretError('PREPARED_OUTFIT_'+code,{cause}); }
function selected(key) {
  if (typeof key!=='string'||!Object.hasOwn(SETS,key)) throw fault('KEY_INVALID');
  return SETS[key];
}
function charge(key) {
  const ids=selected(key);
  return {sets:1,encodedBytes:PINS[ids[0]].bytes+PINS[ids[1]].bytes,decodedBytes:2048};
}

/** Caller hands over same-Engine genuine Scopes, fixed refs and an already-ready group. */
export function createPreparedOutfitCoordinator(options) {
  const {engine,sceneScope,initial,assetEvidence}=options;
  const targets=FREEZE([...options.targets]);
  const refs=FREEZE({A:options.refs.A,B:options.refs.B,C:options.refs.C,D:options.refs.D});
  const sourceTasks=options.sourceLedger.active;
  const limits={};
  for(const name of ['sets','encodedBytes','decodedBytes']) {
    const value=options.limits?.[name]??MAXIMUM[name];
    if(!Number.isSafeInteger(value)||value<1||value>MAXIMUM[name]) throw fault('BUDGET_EXCEEDED');
    limits[name]=value;
  }
  const reservations=new Set();
  let state='open',selection=initial.key,current,pending,latest={};
  function sceneOpen() {
    if(APPLY(SCOPE_STATE,sceneScope,[])!=='open') throw new EgretError('SCOPE_CLOSED');
  }
  function assertOpen() {
    if(state!=='open') throw fault('DISPOSED');
    sceneOpen();
  }
  function active(record) {
    return state==='open'&&pending===record&&latest===record.intent
      &&APPLY(SCOPE_STATE,sceneScope,[])==='open';
  }
  function totals() {
    const sum={sets:0,encodedBytes:0,decodedBytes:0};
    for(const record of reservations) {
      sum.sets+=record.charge.sets;sum.encodedBytes+=record.charge.encodedBytes;sum.decodedBytes+=record.charge.decodedBytes;
    }
    return sum;
  }
  function reserve(record) {
    const used=totals();
    for(const name of ['sets','encodedBytes','decodedBytes']) {
      if(used[name]+record.charge[name]>limits[name]) throw fault('BUDGET_EXCEEDED');
    }
    reservations.add(record);
  }
  function sourcePending() { return APPLY(SET_SIZE,sourceTasks,[]); }
  function validateMembers(key,members) {
    const ids=selected(key);
    if(!Array.isArray(members)||members.length!==2) throw fault('CONTENT_INVALID');
    for(let index=0;index<2;index++) {
      const texture=APPLY(LEASE_VALUE,members[index],[]);
      if(!isTexture(texture)) throw fault('CONTENT_INVALID');
      const evidence=APPLY(WEAK_GET,assetEvidence,[texture]),pin=PINS[ids[index]];
      const image=APPLY(TEXTURE_IMAGE,texture,[]),rect=APPLY(TEXTURE_RECT,texture,[]);
      if(evidence===undefined||evidence.assetId!==ids[index]||evidence.bytes!==pin.bytes||evidence.sha256!==pin.sha256
        ||evidence.width!==16||evidence.height!==16||evidence.contentRevision!=='p02-outfits-r1'
        ||evidence.layoutRevision!=='two-layer-r1'||image.width!==16||image.height!==16
        ||rect.x!==0||rect.y!==0||rect.width!==16||rect.height!==16) throw fault('CONTENT_INVALID');
    }
  }
  function retire(record) {
    if(record===undefined||record.retired) return;
    record.retired=true;
    // Keep the reservation through abort/disposer reentry until all owner cleanup returns.
    try { record.ticket?.dispose(); }
    finally {
      try { if(record.groupScope!==undefined) APPLY(SCOPE_DISPOSE,record.groupScope,[]); }
      finally {
        try { if(record.bindingScope!==undefined) APPLY(SCOPE_DISPOSE,record.bindingScope,[]); }
        finally { reservations.delete(record); }
      }
    }
  }
  function settleRejected(record,cause) {
    if(record.settled) return;
    record.settled=true;record.reject(cause);
  }
  function retirePending(record,cause) {
    if(record===undefined) return;
    // Invalidate/clear before any Scope abort or group disposer can reenter.
    record.ticket?.dispose();
    settleRejected(record,cause);
    retire(record);
  }
  function fail(record,cause) {
    if(record.committed) return;
    if(pending===record) pending=undefined;
    settleRejected(record,cause);
    retire(record);
  }
  function ready(record,members) {
    try {
      if(!active(record)) { retire(record);return; }
      validateMembers(record.key,members);
      if(!active(record)) { retire(record);return; }
      // Intrinsic Scope state and genuine SDK ticket methods retain lifecycle authority.
      sceneOpen();record.ticket.prepare(members);
      if(!active(record)) { retire(record);return; }
      record.ticket.commit();
      const previous=current;
      // No application callback separates publication, business state and logical success.
      record.committed=true;current=record;selection=record.key;pending=undefined;
      record.settled=true;record.resolve();
      // The original logical Promise is already fulfilled; cleanup cannot roll it back.
      retire(previous);
    } catch(cause) { fail(record,cause); }
  }
  function replace(key) {
    assertOpen();const ids=selected(key);
    let resolve,reject;
    const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});
    void APPLY(THEN,promise,[undefined,IGNORE]);
    const record={key,intent:{},promise,resolve,reject,charge:charge(key),retired:false,settled:false,committed:false,
      ticket:undefined,bindingScope:undefined,groupScope:undefined,group:undefined};
    const previous=pending;
    latest=record.intent;pending=record;
    if(previous!==undefined) retirePending(previous,fault('SUPERSEDED'));
    if(!active(record)) return promise;
    try {
      reserve(record);
      // Conservative two-source admission; the adapter separately owns actual job occupancy.
      if(sourcePending()+2>4) throw fault('SOURCE_LIMIT');
      record.bindingScope=engine.createScope();
      record.groupScope=engine.createScope();
      record.ticket=engine.captureBitmapBindings(record.bindingScope,targets);
      if(!active(record)) { retire(record);return promise; }
      const group=engine.createAssetGroup(record.groupScope,ids.map(id=>refs[id]));
      record.group=group;
      // Group/Scope registered before its loaders; always observe even a stale returned group.
      const observed=APPLY(THEN,group.ready,[members=>ready(record,members),cause=>fail(record,cause)]);
      void APPLY(THEN,observed,[undefined,cause=>fail(record,cause)]);
    } catch(cause) { fail(record,cause); }
    return promise;
  }
  function cancel(reason) {
    if(state!=='open'||pending===undefined) return;
    const previous=pending;latest={};pending=undefined;
    retirePending(previous,fault('CANCELLED',reason));
  }
  function dispose() {
    if(state==='disposed') return;
    state='disposed';latest={};
    const previousPending=pending,previousCurrent=current;
    pending=undefined;current=undefined;
    // Retire all publication authority before the first resource cleanup callout.
    previousPending?.ticket?.dispose();previousCurrent?.ticket?.dispose();
    if(previousPending!==undefined) settleRejected(previousPending,fault('DISPOSED'));
    try { retire(previousPending); } finally { retire(previousCurrent); }
  }
  function snapshot() {
    return FREEZE({state,selection,pendingKey:pending?.key??null,logical:FREEZE(totals()),sourcePending:sourcePending()});
  }
  const facade=FREEZE({replace,cancel,dispose,get selection(){return selection;},snapshot});
  assertOpen();selected(initial.key);
  if(targets.length!==2||initial.group.state!=='ready') throw fault('CONTENT_INVALID');
  validateMembers(initial.key,initial.members);
  const first={key:initial.key,charge:charge(initial.key),group:initial.group,groupScope:undefined,
    bindingScope:undefined,ticket:undefined,retired:false,settled:true,committed:false};
  reserve(first);
  try {
    first.bindingScope=engine.createScope();
    first.ticket=engine.captureBitmapBindings(first.bindingScope,targets);
    first.ticket.prepare(initial.members);sceneOpen();first.ticket.commit();
    // Accept exclusive group cleanup handoff only after the initial publication succeeds.
    first.groupScope=initial.groupScope;first.committed=true;current=first;
    APPLY(SCOPE_USE,sceneScope,[facade]);
  } catch(cause) { dispose();retire(first);throw cause; }
  return facade;
}
