import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import * as egret from '@egret/engine';
import * as runtime from '@egret/runtime';

function api() {
  assert.equal(typeof egret.ByteWriter, 'function', 'BW1_PUBLIC_WRITER_REQUIRED');
  assert.equal(typeof runtime.ByteWriter, 'function', 'BW1_RUNTIME_WRITER_REQUIRED');
  assert.equal(egret.ByteWriter, runtime.ByteWriter, 'BW1_ORIGINAL_ROOT_CONSTRUCTOR_REQUIRED');
  assert.equal(typeof egret.BYTE_WRITER_LIMITS, 'object', 'BW1_PUBLIC_LIMITS_REQUIRED');
  assert.notEqual(egret.BYTE_WRITER_LIMITS, null, 'BW1_PUBLIC_LIMITS_REQUIRED');
  assert.equal(egret.BYTE_WRITER_LIMITS, runtime.BYTE_WRITER_LIMITS);
  assert.equal(Object.isFrozen(egret.BYTE_WRITER_LIMITS), true);
  assert.equal(egret.BYTE_WRITER_LIMITS.maxBytes, 16777216);
  return egret.ByteWriter;
}
function using(capacity, endian, check) {
  const writer = new (api())(capacity, endian);
  try { return check(writer); } finally { writer.dispose(); }
}
const state = w => [w.capacity, w.length, w.remainingCapacity, w.endian, w.disposed];
const bytes = w => Array.from(w.toUint8Array());
function nativeError(Type) {
  return e => e instanceof Type && !(e instanceof egret.EgretError)
    && !Object.hasOwn(e, 'code') && !Object.hasOwn(e, 'cause');
}
function hostAdapter() {
  return { surface: {}, async close() {}, setTimeout(callback, delay) {
    const timer = setTimeout(callback, delay); return () => clearTimeout(timer);
  } };
}

// Handwritten BW1 primary bytes; no setter, reader or writer computes these.
const primary = [
  ['writeByte', -2, [254], [254]],
  ['writeUnsignedByte', 171, [171], [171]],
  ['writeShort', -257, [254,255], [255,254]],
  ['writeUnsignedShort', 4660, [18,52], [52,18]],
  ['writeInt', -2147483647, [128,0,0,1], [1,0,0,128]],
  ['writeUnsignedInt', 2309737967, [137,171,205,239], [239,205,171,137]],
  ['writeFloat', 1.5, [63,192,0,0], [0,0,192,63]],
  ['writeDouble', -2.5, [192,4,0,0,0,0,0,0], [0,0,0,0,0,0,4,192]],
];
const integerEndpoints = [
  ['writeByte', -128, [128], [128]], ['writeByte',127,[127],[127]],
  ['writeUnsignedByte',0,[0],[0]], ['writeUnsignedByte',255,[255],[255]],
  ['writeShort',-32768,[128,0],[0,128]], ['writeShort',32767,[127,255],[255,127]],
  ['writeUnsignedShort',0,[0,0],[0,0]], ['writeUnsignedShort',65535,[255,255],[255,255]],
  ['writeInt',-2147483648,[128,0,0,0],[0,0,0,128]],
  ['writeInt',2147483647,[127,255,255,255],[255,255,255,127]],
  ['writeUnsignedInt',0,[0,0,0,0],[0,0,0,0]],
  ['writeUnsignedInt',4294967295,[255,255,255,255],[255,255,255,255]],
];
const floatLiterals = [
  ['writeFloat',0,[0,0,0,0],[0,0,0,0]],
  ['writeFloat',-0,[128,0,0,0],[0,0,0,128]],
  ['writeFloat',Infinity,[127,128,0,0],[0,0,128,127]],
  ['writeFloat',-Infinity,[255,128,0,0],[0,0,128,255]],
  ['writeFloat',16777217,[75,128,0,0],[0,0,128,75]],
  ['writeFloat',Number.MAX_VALUE,[127,128,0,0],[0,0,128,127]],
  ['writeFloat',Number.MIN_VALUE,[0,0,0,0],[0,0,0,0]],
  ['writeDouble',0,[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0]],
  ['writeDouble',-0,[128,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,128]],
  ['writeDouble',Infinity,[127,240,0,0,0,0,0,0],[0,0,0,0,0,0,240,127]],
  ['writeDouble',-Infinity,[255,240,0,0,0,0,0,0],[0,0,0,0,0,0,240,255]],
  ['writeDouble',Number.MIN_VALUE,[0,0,0,0,0,0,0,1],[1,0,0,0,0,0,0,0]],
];
function checkLiteralRows(rows) {
  for (const [method,value,big,little] of rows) {
    for (const [order,want] of [['bigEndian',big],['littleEndian',little]]) {
      using(want.length,order,w => {
        assert.equal(w[method](value),undefined,method+'/'+order);
        assert.deepEqual(bytes(w),want,method+'/'+order);
        assert.deepEqual(state(w),[want.length,want.length,0,order,false]);
      });
    }
  }
}

test('BW00 genuine old Engine Scope and literal ByteReader baseline precedes missing writer API', async () => {
  const engine = await egret.createEngine({host:hostAdapter()});
  let reader;
  try {
    const scope = engine.createScope();
    reader = scope.use(new egret.ByteReader(new Uint8Array([18,52])));
    assert.equal(reader.readUnsignedShort(),4660);
    scope.dispose();
    assert.equal(reader.disposed,true);
  } finally { await engine.dispose(); }
  assert.equal(reader.disposed,true);
  console.log('BW1_OLD_PUBLIC_BASELINE_COMPLETE');
  api();
});

test('BW01 eight handwritten scalar oracles cover both orders and unaligned concatenation', () => {
  checkLiteralRows(primary);
  const wholeBig=[254,171,254,255,18,52,128,0,0,1,137,171,205,239,63,192,0,0,192,4,0,0,0,0,0,0];
  const wholeLittle=[254,171,255,254,52,18,1,0,0,128,239,205,171,137,0,0,192,63,0,0,0,0,0,0,4,192];
  for (const [order,want] of [['bigEndian',wholeBig],['littleEndian',wholeLittle]]) {
    using(26,order,w => {
      for (const [method,value] of primary) w[method](value);
      assert.deepEqual(bytes(w),want);
      assert.deepEqual(state(w),[26,26,0,order,false]);
    });
  }
});

test('BW02 integer endpoints native floating interpretation and mutable exact endian', () => {
  checkLiteralRows(integerEndpoints); checkLiteralRows(floatLiterals);
  for (const [method,width,getter] of [['writeFloat',4,'getFloat32'],['writeDouble',8,'getFloat64']]) {
    for (const order of ['bigEndian','littleEndian']) using(width,order,w => {
      w[method](NaN);
      const output=w.toUint8Array();
      assert.equal(Number.isNaN(new DataView(output.buffer)[getter](0,order==='littleEndian')),true);
      assert.equal(w.length,width); // No NaN payload/sign-bit oracle.
    });
  }
  const Writer=api(), defaultWriter=new Writer(0), explicitWriter=new Writer(-0,undefined);
  try {
    assert.equal(defaultWriter.endian,'bigEndian');
    assert.equal(Object.is(explicitWriter.capacity,0),true);
    assert.equal(Object.is(explicitWriter.remainingCapacity,0),true);
    explicitWriter.endian='littleEndian';
    assert.equal(explicitWriter.endian,'littleEndian');
    assert.equal(explicitWriter.writeBytes(new Uint8Array(0)),undefined);
  } finally { defaultWriter.dispose(); explicitWriter.dispose(); }
  using(5,undefined,w => {
    w.writeUnsignedByte(170); w.writeUnsignedShort(4660);
    w.endian='littleEndian'; w.writeUnsignedShort(4660);
    assert.deepEqual(bytes(w),[170,18,52,52,18]);
    w.endian='bigEndian'; assert.equal(w.length,5);
    assert.deepEqual(bytes(w),[170,18,52,52,18]);
  });
  for (const [method,,big] of primary.slice(0,6)) using(big.length,undefined,w => {
    w[method](-0); assert.deepEqual(bytes(w),Array(big.length).fill(0));
  });
});

test('BW03 strict noncoercing domains and capacity precedence preserve committed state', () => {
  const Writer=api(); let coercions=0;
  const hostile={ [Symbol.toPrimitive]() { coercions++; throw new Error('coercion'); } };
  for (const capacity of [undefined,null,'1',true,1n,hostile,new Number(1)])
    assert.throws(()=>new Writer(capacity),nativeError(TypeError));
  for (const capacity of [-1,0.5,NaN,Infinity,-Infinity,9007199254740992])
    assert.throws(()=>new Writer(capacity,'invalid'),nativeError(RangeError));
  assert.throws(()=>new Writer(16777217,'invalid'),nativeError(TypeError));
  assert.throws(()=>new Writer(16777217),nativeError(RangeError));
  for (const order of [null,'invalid',0,false,hostile])
    assert.throws(()=>new Writer(0,order),nativeError(TypeError));
  using(16777216,undefined,w => {
    w.writeUnsignedByte(17); assert.deepEqual(bytes(w),[17]);
    assert.deepEqual(state(w),[16777216,1,16777215,'bigEndian',false]);
  });
  const integers=[['writeByte',-129,128],['writeUnsignedByte',-1,256],['writeShort',-32769,32768],
    ['writeUnsignedShort',-1,65536],['writeInt',-2147483649,2147483648],['writeUnsignedInt',-1,4294967296]];
  using(4,'littleEndian',w => {
    w.writeUnsignedInt(2309737967);
    const want=[239,205,171,137], before=[4,4,0,'littleEndian',false];
    for (const [method,below,above] of integers) {
      for (const value of [below,above,0.5,NaN,Infinity,-Infinity]) assert.throws(()=>w[method](value),nativeError(RangeError));
    }
    for (const [method] of primary) {
      for (const value of ['1',null,undefined,true,1n,hostile,new Number(1)]) assert.throws(()=>w[method](value),nativeError(TypeError));
      assert.throws(()=>w[method](1),nativeError(RangeError));
    }
    assert.throws(()=>w.writeBytes(new Uint16Array(0)),nativeError(TypeError));
    assert.throws(()=>w.writeBytes(new Uint8Array([1])),nativeError(RangeError));
    for (const order of [undefined,null,'invalid',false,hostile]) assert.throws(()=>{w.endian=order;},nativeError(TypeError));
    assert.equal(w.writeBytes(new Uint8Array(0)),undefined);
    assert.deepEqual(state(w),before); assert.deepEqual(bytes(w),want);
  });
  using(0,undefined,w => assert.throws(()=>w.writeUnsignedByte(0),nativeError(RangeError)));
  using(4,undefined,w => {
    w.writeUnsignedByte(10);
    assert.throws(()=>w.writeUnsignedInt(1),nativeError(RangeError));
    assert.deepEqual(bytes(w),[10]);
    w.writeUnsignedByte(20); assert.deepEqual(bytes(w),[10,20]);
  });
  assert.equal(coercions,0);
});

test('BW04 eligible selected views ignore caller overrides and complete source domain precedes capacity', () => {
  let traps=0;
  class Bytes extends Uint8Array { static get [Symbol.species]() { traps++; throw new Error('species'); } }
  const selectedBacking=new Uint8Array([99,11,22,33,88]);
  const selected=new Uint8Array(selectedBacking.buffer,1,3), subclass=new Bytes([11,22,33]);
  for (const key of ['buffer','byteLength','byteOffset','length','constructor','slice','subarray',Symbol.iterator,Symbol.toStringTag])
    Object.defineProperty(subclass,key,{get(){traps++; throw new Error('source override');}});
  const foreign=vm.runInNewContext('new Uint8Array(new Uint8Array([99,11,22,33,88]).buffer,1,3)');
  for (const source of [selected,subclass,foreign]) using(3,undefined,w => {
    w.writeBytes(source); assert.deepEqual(bytes(w),[11,22,33]);
  });
  assert.equal(traps,0);
  const trap={get(){traps++;throw new Error('source get');},ownKeys(){traps++;throw new Error('keys');},getPrototypeOf(){traps++;throw new Error('prototype');}};
  const revoked=Proxy.revocable(new Uint8Array(0),trap); revoked.revoke();
  assert.equal(typeof SharedArrayBuffer,'function','BW1 fixed Node baseline needs SAB');
  assert.equal(typeof structuredClone,'function','BW1 fixed Node baseline needs transfer');
  const rab=new ArrayBuffer(4,{maxByteLength:8});
  assert.equal(rab.resizable,true,'BW1 resizable fixture must be genuine');
  const detached=[];
  for (const size of [0,4]) {const source=new Uint8Array(size); structuredClone(source.buffer,{transfer:[source.buffer]}); detached.push(source);}
  const bad=[null,undefined,1,'bytes',true,[1],new Uint8ClampedArray(0),new Uint16Array(0),
    new DataView(new ArrayBuffer(0)),Object.create(Uint8Array.prototype),new Proxy(new Uint8Array(0),trap),revoked.proxy,
    new Uint8Array(new SharedArrayBuffer(0)),vm.runInNewContext('new Uint8Array(new SharedArrayBuffer(4))'),
    new Uint8Array(rab),new Uint8Array(rab,0,4),new Uint8Array(new ArrayBuffer(0,{maxByteLength:8})),
    vm.runInNewContext('new Uint8Array(new ArrayBuffer(4,{maxByteLength:8}),0,4)'),...detached];
  using(1,undefined,w => {
    w.writeUnsignedByte(170);
    for (const source of bad) {
      assert.throws(()=>w.writeBytes(source),nativeError(TypeError));
      assert.deepEqual(state(w),[1,1,0,'bigEndian',false]); assert.deepEqual(bytes(w),[170]);
    }
    w.writeBytes(new Uint8Array(0)); assert.deepEqual(bytes(w),[170]);
    assert.throws(()=>w.writeBytes(new Uint8Array([1,2])),nativeError(RangeError));
  });
  assert.equal(traps,0);
});

test('BW05 snapshots are fresh tight committed-prefix copies and survive all external mutations', () => {
  using(5,undefined,w => {
    const emptyA=w.toUint8Array(), emptyB=w.toUint8Array();
    assert.notEqual(emptyA,emptyB); assert.notEqual(emptyA.buffer,emptyB.buffer);
    assert.equal(emptyA.buffer.byteLength,0); assert.equal(emptyA.byteOffset,0);
    const backing=new Uint8Array([99,10,20,30,88]), source=backing.subarray(1,4);
    w.writeBytes(source); backing.fill(77);
    structuredClone(backing.buffer,{transfer:[backing.buffer]});
    const first=w.toUint8Array(), second=w.toUint8Array();
    assert.deepEqual(Array.from(first),[10,20,30]);
    for (const copy of [first,second]) {
      assert.equal(Object.getPrototypeOf(copy),Uint8Array.prototype);
      assert.equal(copy.byteOffset,0); assert.equal(copy.byteLength,3); assert.equal(copy.buffer.byteLength,3);
      assert.equal(copy.buffer.resizable,false);
    }
    assert.notEqual(first,second); assert.notEqual(first.buffer,second.buffer); assert.notEqual(first.buffer,source.buffer);
    first.fill(66); structuredClone(first.buffer,{transfer:[first.buffer]});
    assert.deepEqual(Array.from(second),[10,20,30]); assert.deepEqual(bytes(w),[10,20,30]);
    assert.throws(()=>w.writeUnsignedInt(1),nativeError(RangeError));
    w.writeUnsignedByte(40); assert.deepEqual(bytes(w),[10,20,30,40]);
    w.dispose(); assert.deepEqual(Array.from(second),[10,20,30]);
    second[0]=55; assert.equal(second[0],55);
  });
});

test('BW06 authentic receiver diagnostics disposal and genuine Scope lifetime remain separate', async () => {
  const Writer=api(), engine=await egret.createEngine({host:hostAdapter()});
  const local=new Writer(2,'littleEndian'), foreign=new Writer(1), late=new Writer(1);
  const dispose=Writer.prototype.dispose; let disposalCalls=0, receiverTraps=0;
  const hostile={ [Symbol.toPrimitive](){receiverTraps++;throw new Error('value coercion');} };
  const trap={get(){receiverTraps++;throw new Error('receiver get');},getPrototypeOf(){receiverTraps++;throw new Error('receiver prototype');}};
  const revoked=Proxy.revocable(local,trap); revoked.revoke();
  const fake=[{},Object.create(Writer.prototype),new Proxy(local,trap),revoked.proxy,null,undefined,1];
  try {
    for (const method of [...primary.map(row=>row[0]),'writeBytes','toUint8Array','dispose'])
      for (const receiver of fake) assert.throws(()=>Reflect.apply(Writer.prototype[method],receiver,[hostile]),nativeError(TypeError));
    for (const name of ['capacity','length','remainingCapacity','disposed','endian']) {
      const descriptor=Object.getOwnPropertyDescriptor(Writer.prototype,name);
      assert.equal(typeof descriptor?.get,'function');
      for (const receiver of fake) assert.throws(()=>Reflect.apply(descriptor.get,receiver,[]),nativeError(TypeError));
      if(name==='endian') for(const receiver of fake) assert.throws(()=>Reflect.apply(descriptor.set,receiver,[hostile]),nativeError(TypeError));
    }
    assert.equal(receiverTraps,0);
    local.writeUnsignedByte(11); const copy=local.toUint8Array();
    Object.defineProperty(local,'dispose',{value(){disposalCalls++;return Reflect.apply(dispose,this,[]);}});
    const a=engine.createScope(), b=engine.createScope();
    assert.equal(a.use(local),local); assert.equal(a.use(local),local); b.use(foreign);
    assert.throws(()=>b.use(local),e=>e instanceof egret.EgretError&&e.code==='OWNERSHIP_CONFLICT');
    assert.equal(local.disposed,false);
    let closingWrite=false;
    a.use({dispose(){
      local.writeUnsignedByte(22); assert.deepEqual(bytes(local),[11,22]); closingWrite=true;
    }}); // Still open until its own reverse-order cleanup.
    a.dispose(); assert.equal(closingWrite,true); assert.equal(disposalCalls,1);
    assert.deepEqual(state(local),[0,0,0,'littleEndian',true]); assert.deepEqual(Array.from(copy),[11]);
    assert.throws(()=>a.use(late),e=>e instanceof egret.EgretError&&e.code==='SCOPE_CLOSED');
    assert.equal(late.disposed,true);
    assert.throws(()=>a.use(foreign),e=>e instanceof egret.EgretError&&e.code==='OWNERSHIP_CONFLICT');
    assert.equal(foreign.disposed,false);
    assert.equal(Reflect.apply(dispose,local,[]),undefined);
    for (const [method] of primary) assert.throws(()=>local[method](-1),nativeError(TypeError));
    assert.throws(()=>local.writeBytes(hostile),nativeError(TypeError));
    assert.throws(()=>local.toUint8Array(),nativeError(TypeError));
    assert.throws(()=>{local.endian='invalid';},nativeError(TypeError));
    assert.deepEqual(state(local),[0,0,0,'littleEndian',true]);
    await engine.dispose(); assert.equal(foreign.disposed,true);
  } finally {
    Reflect.apply(dispose,local,[]); foreign.dispose(); late.dispose(); await engine.dispose();
  }
});

test('BW07 public ByteReader round trip supplements literals and late ambient shadows cannot replace captured writes', () => {
  using(26,undefined,w => {
    for (const [method,value] of primary) w[method](value);
    const reader=new egret.ByteReader(w.toUint8Array());
    try {
      for (const [method,value] of primary) assert.equal(Object.is(reader[method.replace('write','read')](),value),true);
      assert.equal(reader.bytesAvailable,0);
    } finally { reader.dispose(); }
  });
  using(7,undefined,w => {
    w.writeUnsignedByte(9);
    const typed=Object.getPrototypeOf(Uint8Array.prototype), oldSet=Object.getOwnPropertyDescriptor(typed,'set');
    const oldScalar=Object.getOwnPropertyDescriptor(DataView.prototype,'setUint32');
    const poison=Object.freeze({late:'ambient setter shadow'}); let ambientCalls=0;
    try {
      Object.defineProperty(typed,'set',{...oldSet,value(){ambientCalls++;throw poison;}});
      Object.defineProperty(DataView.prototype,'setUint32',{...oldScalar,value(){ambientCalls++;throw poison;}});
      w.writeUnsignedInt(16909060); w.writeBytes(new Uint8Array([5,6]));
      assert.deepEqual(bytes(w),[9,1,2,3,4,5,6]);
    } finally {
      Object.defineProperty(typed,'set',oldSet); Object.defineProperty(DataView.prototype,'setUint32',oldScalar);
    }
    assert.equal(ambientCalls,0); assert.deepEqual(state(w),[7,7,0,'bigEndian',false]);
  });
});
