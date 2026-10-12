import assert from 'node:assert/strict';

// Run this file in a fresh Node test-file process. Only public SDK roots load
// after installation. Ambient descriptors are restored before any test/cleanup;
// captured wrappers are then armed only around a stated synchronous operation.
const NativeBytes=globalThis.Uint8Array, NativeView=globalThis.DataView;
const bytesDescriptor=Object.getOwnPropertyDescriptor(globalThis,'Uint8Array');
const viewDescriptor=Object.getOwnPropertyDescriptor(globalThis,'DataView');
const typed=Object.getPrototypeOf(NativeBytes.prototype);
const setDescriptor=Object.getOwnPropertyDescriptor(typed,'set');
const names=['setInt8','setUint8','setInt16','setUint16','setInt32','setUint32','setFloat32','setFloat64'];
const setters=new Map(names.map(name=>[name,Object.getOwnPropertyDescriptor(NativeView.prototype,name)]));
const construct=Reflect.construct, apply=Reflect.apply;
let control;
const counts={ownedAllocations:0,viewAllocations:0,bulkCopies:0,scalarWrites:0,faultHits:0};
function reach(kind,name,forward) {
  if(control?.kind!==kind || (control.name!==undefined&&control.name!==name)) return forward();
  counts.faultHits++;
  if(control.phase==='after') forward(); // Exact native receiver/arguments; no prefix edits or retained buffers.
  throw control.token;
}
const guardedBytes=new Proxy(NativeBytes,{construct(target,args,newTarget){
  if(args.length===1&&typeof args[0]==='number') {
    counts.ownedAllocations++;
    return reach('allocation','Uint8Array',()=>construct(target,args,newTarget));
  }
  return construct(target,args,newTarget);
}});
const guardedView=new Proxy(NativeView,{construct(target,args,newTarget){
  counts.viewAllocations++;
  return reach('allocation','DataView',()=>construct(target,args,newTarget));
}});
const guardedSet=new Proxy(setDescriptor.value,{apply(target,receiver,args){
  counts.bulkCopies++;
  return reach('copy','set',()=>apply(target,receiver,args));
}});
let egret,runtime;
try {
  Object.defineProperty(globalThis,'Uint8Array',{...bytesDescriptor,value:guardedBytes});
  Object.defineProperty(globalThis,'DataView',{...viewDescriptor,value:guardedView});
  Object.defineProperty(typed,'set',{...setDescriptor,value:guardedSet});
  for(const [name,descriptor] of setters) Object.defineProperty(NativeView.prototype,name,{...descriptor,value:new Proxy(descriptor.value,{
    apply(target,receiver,args){counts.scalarWrites++;return reach('scalar',name,()=>apply(target,receiver,args));}
  })});
  egret=await import('@egret/engine'); runtime=await import('@egret/runtime');
} finally {
  Object.defineProperty(globalThis,'Uint8Array',bytesDescriptor);
  Object.defineProperty(globalThis,'DataView',viewDescriptor);
  Object.defineProperty(typed,'set',setDescriptor);
  for(const [name,descriptor] of setters) Object.defineProperty(NativeView.prototype,name,descriptor);
}
function ambientRestored() {
  assert.equal(globalThis.Uint8Array,NativeBytes); assert.equal(globalThis.DataView,NativeView);
  assert.equal(typed.set,setDescriptor.value);
  for(const [name,descriptor] of setters) assert.equal(NativeView.prototype[name],descriptor.value);
}
ambientRestored();
assert.equal(typeof egret.ByteWriter,'function','BW1_PUBLIC_WRITER_REQUIRED_FOR_CONTROLLED_FAULTS');
assert.equal(egret.ByteWriter,runtime.ByteWriter);
assert.equal(egret.BYTE_WRITER_LIMITS,runtime.BYTE_WRITER_LIMITS);
const Writer=egret.ByteWriter;
const writers=new Set(), observations=[];
function own(capacity) {const w=new Writer(capacity);writers.add(w);return w;}
function bytes(w) {return Array.from(w.toUint8Array());}
function state(w) {return [w.capacity,w.length,w.remainingCapacity,w.endian,w.disposed];}
function sameThrown(action,expected) {
  let thrown=false,actual;
  try{action();}catch(cause){thrown=true;actual=cause;}
  assert.equal(thrown,true,'A genuine armed native call must throw');
  assert.equal(actual,expected,'Abrupt completion identity must escape without wrapping');
}
function fault(kind,name,phase,action) {
  const token=Object.freeze({fault:kind,name,phase}), before=counts.faultHits;
  control={kind,name,phase,token};
  try{sameThrown(action,token);}finally{control=undefined;}
  assert.equal(counts.faultHits,before+1,'Reach exactly the one armed intrinsic boundary');
  ambientRestored();
}
function noPayloadWork(action,Type) {
  const before=[counts.ownedAllocations,counts.bulkCopies,counts.scalarWrites];
  assert.throws(action,e=>e instanceof Type && !(e instanceof egret.EgretError)
    && !Object.hasOwn(e,'code') && !Object.hasOwn(e,'cause'));
  assert.deepEqual([counts.ownedAllocations,counts.bulkCopies,counts.scalarWrites],before);
}

try {
  // Establish real successful public construction, scalar/bulk writes and copy-out
  // before any controlled abrupt completion. Expected bytes remain literal.
  const baseline=own(16); baseline.writeBytes(new NativeBytes([10,20]));
  baseline.writeUnsignedShort(4660); baseline.writeDouble(-2.5);
  assert.deepEqual(bytes(baseline),[10,20,18,52,192,4,0,0,0,0,0,0]);
  assert.deepEqual(state(baseline),[16,12,4,'bigEndian',false]);
  observations.push('BWAF00-genuine-public-baseline-before-fault');

  for(const name of ['Uint8Array','DataView']) {
    fault('allocation',name,'before',()=>new Writer(8));
    const recovered=own(2); recovered.writeBytes(new NativeBytes([10,20]));
    assert.deepEqual(bytes(recovered),[10,20]); recovered.dispose();
    observations.push('BWAF01-construction-'+name+'-exact-token-and-recovery');
  }

  const snapshotWriter=own(8); snapshotWriter.writeBytes(new NativeBytes([10,20,30]));
  const snapshotState=[8,3,5,'bigEndian',false];
  for(const [kind,name] of [['allocation','Uint8Array'],['copy','set']]) {
    fault(kind,name,'before',()=>snapshotWriter.toUint8Array());
    assert.deepEqual(state(snapshotWriter),snapshotState);
    assert.deepEqual(bytes(snapshotWriter),[10,20,30]);
    observations.push('BWAF02-snapshot-'+kind+'-preserves-whole-prefix');
  }

  const scalarRows=[
    ['writeByte','setInt8',-2,[254]],['writeUnsignedByte','setUint8',171,[171]],
    ['writeShort','setInt16',-257,[254,255]],['writeUnsignedShort','setUint16',4660,[18,52]],
    ['writeInt','setInt32',-2147483647,[128,0,0,1]],
    ['writeUnsignedInt','setUint32',2309737967,[137,171,205,239]],
    ['writeFloat','setFloat32',1.5,[63,192,0,0]],['writeDouble','setFloat64',-2.5,[192,4,0,0,0,0,0,0]],
  ];
  for(const [method,name,value,want] of scalarRows) {
    for(const phase of ['before','after']) {
      const w=own(16); w.writeBytes(new NativeBytes([10,20]));
      w[method](value); // Genuine reachability baseline for this exact setter.
      assert.deepEqual(bytes(w),[10,20,...want]); w.dispose();
      const failing=own(16); failing.writeBytes(new NativeBytes([10,20]));
      fault('scalar',name,phase,()=>failing[method](value));
      assert.deepEqual(state(failing),[16,2,14,'bigEndian',false]);
      assert.deepEqual(bytes(failing),[10,20],'Written tail is not committed or exposed');
      failing.writeUnsignedByte(77); assert.deepEqual(bytes(failing),[10,20,77]);
      failing.writeBytes(new NativeBytes([88])); assert.deepEqual(bytes(failing),[10,20,77,88]);
      observations.push('BWAF03-'+method+'-'+phase+'-length-prefix-and-retry');
    }
  }

  for(const phase of ['before','after']) {
    const w=own(8); w.writeBytes(new NativeBytes([10,20]));
    const source=new NativeBytes([30,40,50]);
    fault('copy','set',phase,()=>w.writeBytes(source));
    assert.deepEqual(state(w),[8,2,6,'bigEndian',false]); assert.deepEqual(bytes(w),[10,20]);
    w.writeUnsignedByte(77); assert.deepEqual(bytes(w),[10,20,77]);
    w.writeBytes(new NativeBytes([88,99])); assert.deepEqual(bytes(w),[10,20,77,88,99]);
    observations.push('BWAF04-bulk-'+phase+'-uncommitted-tail-and-retry');
  }

  const full=own(4); full.writeUnsignedInt(2309737967);
  noPayloadWork(()=>new Writer(-1,'invalid'),RangeError);
  noPayloadWork(()=>new Writer(16777217,'invalid'),TypeError);
  noPayloadWork(()=>new Writer(16777217),RangeError);
  noPayloadWork(()=>full.writeUnsignedByte('1'),TypeError);
  noPayloadWork(()=>full.writeUnsignedByte(1),RangeError);
  noPayloadWork(()=>full.writeUnsignedInt(4294967296),RangeError);
  let traps=0;
  const proxy=new Proxy(new NativeBytes(0),{get(){traps++;throw new Error('source trap');}});
  noPayloadWork(()=>full.writeBytes(proxy),TypeError);
  noPayloadWork(()=>full.writeBytes(new Uint16Array(0)),TypeError);
  noPayloadWork(()=>full.writeBytes(new NativeBytes([1])),RangeError);
  assert.equal(traps,0); assert.deepEqual(bytes(full),[137,171,205,239]);
  const bulk=own(3), ownedBefore=counts.ownedAllocations;
  bulk.writeBytes(new NativeBytes([11,22,33]));
  assert.equal(counts.ownedAllocations,ownedBefore,'Bulk append must not allocate a second owned payload');
  assert.deepEqual(bytes(bulk),[11,22,33]);
  observations.push('BWAF05-admission-precedes-payload-and-bulk-has-no-second-owned-clone');
} finally {
  control=undefined;
  ambientRestored();
  for(const w of writers) w.dispose();
}
for(const w of writers) assert.equal(w.disposed,true);
ambientRestored();
console.log(JSON.stringify({status:'PASS_CONTROLLED_PUBLIC_BW1_ABRUPT_COMPLETION',
  publicEntries:['@egret/engine','@egret/runtime'],baselineBeforeFault:true,observations,counts,
  ambientIntrinsicsRestored:true,writersDisposed:true,physicalOOMRecovery:false,
  arbitraryModifiedRealmIsolation:false,zeroizationOrReclamation:false}));
