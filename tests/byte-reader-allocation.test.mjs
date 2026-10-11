import assert from "node:assert/strict";

// Controlled CPU fault evidence for the actual built public entry. These hooks
// are installed before a fresh module import, then ambient globals are restored.
// They throw at the real captured allocation/copy call sites; this is not OOM.
const NativeBytes = globalThis.Uint8Array;
const bytesDescriptor = Object.getOwnPropertyDescriptor(globalThis, "Uint8Array");
const typedPrototype = Object.getPrototypeOf(NativeBytes.prototype);
const setDescriptor = Object.getOwnPropertyDescriptor(typedPrototype, "set");
const nativeSet = setDescriptor.value;
const construct = Reflect.construct;
const apply = Reflect.apply;
const allocationFault = Object.freeze({ stage: "controlled-owned-allocation" });
const copyFault = Object.freeze({ stage: "controlled-native-bulk-copy" });
let failAllocation = false;
let failCopy = false;
let ownedAllocationCalls = 0;
let bulkCopyCalls = 0;
let allocationFaultCalls = 0;
let copyFaultCalls = 0;

const guardedBytes = new Proxy(NativeBytes, {
  construct(target, args, newTarget) {
    // A length argument denotes an owned output. Buffer-view admission probes
    // and selected views do not allocate a payload and are counted separately.
    if (args.length === 1 && typeof args[0] === "number") {
      ownedAllocationCalls++;
      if (failAllocation) {
        allocationFaultCalls++;
        throw allocationFault;
      }
    }
    return construct(target, args, newTarget);
  }
});
const guardedSet = new Proxy(nativeSet, {
  apply(target, receiver, args) {
    bulkCopyCalls++;
    if (failCopy) {
      copyFaultCalls++;
      throw copyFault;
    }
    return apply(target, receiver, args);
  }
});

let egret;
try {
  Object.defineProperty(globalThis, "Uint8Array", { ...bytesDescriptor, value: guardedBytes });
  Object.defineProperty(typedPrototype, "set", { ...setDescriptor, value: guardedSet });
  egret = await import("@egret/engine");
} finally {
  Object.defineProperty(globalThis, "Uint8Array", bytesDescriptor);
  Object.defineProperty(typedPrototype, "set", setDescriptor);
}
assert.equal(globalThis.Uint8Array, NativeBytes);
assert.equal(typedPrototype.set, nativeSet);
assert.equal(typeof egret.ByteReader, "function");

function diagnostics(reader) {
  return [reader.length, reader.position, reader.bytesAvailable, reader.endian, reader.disposed];
}
function sameThrown(action, expected) {
  let observed;
  try { action(); } catch (error) { observed = error; }
  assert.equal(observed, expected, "The real abrupt completion must escape unchanged");
}
function noOwnedWork(action, errorType) {
  const allocationBefore = ownedAllocationCalls;
  const copyBefore = bulkCopyCalls;
  assert.throws(action, errorType);
  assert.equal(ownedAllocationCalls, allocationBefore);
  assert.equal(bulkCopyCalls, copyBefore);
}

// Establish genuine successful construction and copy-out before any fault.
const reader = new egret.ByteReader(new NativeBytes([0, 11, 22, 33]));
const observations = [];
try {
  reader.seek(1);
  const baseline = reader.readBytes(2);
  assert.deepEqual(Array.from(baseline), [11, 22]);
  assert.deepEqual(diagnostics(reader), [4, 3, 1, "bigEndian", false]);
  observations.push("genuine-public-baseline-before-fault");

  reader.seek(1);
  const beforeAllocation = diagnostics(reader);
  failAllocation = true;
  try { sameThrown(() => reader.readBytes(2), allocationFault); }
  finally { failAllocation = false; }
  assert.equal(allocationFaultCalls, 1);
  assert.deepEqual(diagnostics(reader), beforeAllocation);
  assert.deepEqual(Array.from(reader.readBytes()), [11, 22, 33]);
  assert.deepEqual(diagnostics(reader), [4, 4, 0, "bigEndian", false]);
  observations.push("owned-output-allocation-abrupt-completion-is-atomic");

  reader.seek(1);
  const beforeCopy = diagnostics(reader);
  failCopy = true;
  try { sameThrown(() => reader.readBytes(2), copyFault); }
  finally { failCopy = false; }
  assert.equal(copyFaultCalls, 1);
  assert.deepEqual(diagnostics(reader), beforeCopy);
  const recovered = reader.readBytes();
  assert.deepEqual(Array.from(recovered), [11, 22, 33]);
  assert.deepEqual(diagnostics(reader), [4, 4, 0, "bigEndian", false]);
  assert.deepEqual(Array.from(baseline), [11, 22]);
  assert.notEqual(recovered.buffer, baseline.buffer);
  observations.push("captured-bulk-copy-abrupt-completion-is-atomic-and-recoverable");

  const overCapacity = new NativeBytes(16777217);
  noOwnedWork(() => new egret.ByteReader(overCapacity), RangeError);
  noOwnedWork(() => new egret.ByteReader(overCapacity, "invalid"), TypeError);
  let inputTraps = 0;
  const forged = new Proxy(overCapacity, {
    get() { inputTraps++; throw new Error("Untrusted source property read"); }
  });
  noOwnedWork(() => new egret.ByteReader(forged), TypeError);
  assert.equal(inputTraps, 0);
  observations.push("capacity-and-type-precedence-reject-before-owned-allocation-or-copy");

  // The exact public limit must also reach the real successful owned-copy path.
  const exact = new egret.ByteReader(new NativeBytes(16777216));
  try {
    assert.equal(exact.length, 16777216);
    assert.equal(exact.readUnsignedByte(), 0);
    observations.push("exact-capacity-public-construction-and-read");
  } finally { exact.dispose(); }
} finally {
  failAllocation = false;
  failCopy = false;
  reader.dispose();
}
assert.equal(reader.disposed, true);
assert.equal(globalThis.Uint8Array, NativeBytes);
assert.equal(typedPrototype.set, nativeSet);
console.log(JSON.stringify({
  status: "PASS_CONTROLLED_PUBLIC_BYTE_READER_ABRUPT_COMPLETION",
  publicEntry: "@egret/engine",
  baselineEstablishedBeforeFault: true,
  observations,
  allocationFaultCalls,
  copyFaultCalls,
  ambientIntrinsicsRestored: true,
  readerDisposed: true,
  realOOMRecoveryProven: false,
  physicalReclamationProven: false
}));
