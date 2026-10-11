import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import * as egret from "@egret/engine";

function api() {
  assert.equal(typeof egret.ByteReader, "function", "Missing public ByteReader export");
  assert.equal(typeof egret.BYTE_READER_LIMITS, "object", "Missing public BYTE_READER_LIMITS export");
  assert.notEqual(egret.BYTE_READER_LIMITS, null);
  return egret.ByteReader;
}

function using(source, endian, check) {
  const reader = new (api())(source, endian);
  try { return check(reader); }
  finally { reader.dispose(); }
}

function diagnostics(reader) {
  return [reader.length, reader.position, reader.bytesAvailable, reader.endian];
}

// These bytes and numbers are handwritten from BR1, never produced by DataView
// setters, ByteReader, a product helper, or a resource-format implementation.
const integerCases = [
  { method: "readByte", big: [0x80], little: [0x80], want: -128 },
  { method: "readByte", big: [0x7f], little: [0x7f], want: 127 },
  { method: "readUnsignedByte", big: [0xff], little: [0xff], want: 255 },
  { method: "readShort", big: [0xff, 0xff], little: [0xff, 0xff], want: -1 },
  { method: "readShort", big: [0x80, 0x00], little: [0x00, 0x80], want: -32768 },
  { method: "readUnsignedShort", big: [0x01, 0x02], little: [0x02, 0x01], want: 258 },
  { method: "readUnsignedShort", big: [0xff, 0xff], little: [0xff, 0xff], want: 65535 },
  { method: "readInt", big: [0x80, 0x00, 0x00, 0x00], little: [0x00, 0x00, 0x00, 0x80], want: -2147483648 },
  { method: "readInt", big: [0x7f, 0xff, 0xff, 0xff], little: [0xff, 0xff, 0xff, 0x7f], want: 2147483647 },
  { method: "readUnsignedInt", big: [0xff, 0xff, 0xff, 0xff], little: [0xff, 0xff, 0xff, 0xff], want: 4294967295 },
];

const floatCases = [
  { method: "readFloat", big: [0, 0, 0, 0], little: [0, 0, 0, 0], want: 0 },
  { method: "readFloat", big: [128, 0, 0, 0], little: [0, 0, 0, 128], want: -0 },
  { method: "readFloat", big: [63, 128, 0, 0], little: [0, 0, 128, 63], want: 1 },
  { method: "readFloat", big: [192, 32, 0, 0], little: [0, 0, 32, 192], want: -2.5 },
  { method: "readFloat", big: [127, 128, 0, 0], little: [0, 0, 128, 127], want: Infinity },
  { method: "readFloat", big: [255, 128, 0, 0], little: [0, 0, 128, 255], want: -Infinity },
  { method: "readFloat", big: [127, 192, 0, 1], little: [1, 0, 192, 127], nan: true },
  { method: "readFloat", big: [0, 0, 0, 1], little: [1, 0, 0, 0], want: 1.401298464324817e-45 },
  { method: "readDouble", big: [0, 0, 0, 0, 0, 0, 0, 0], little: [0, 0, 0, 0, 0, 0, 0, 0], want: 0 },
  { method: "readDouble", big: [128, 0, 0, 0, 0, 0, 0, 0], little: [0, 0, 0, 0, 0, 0, 0, 128], want: -0 },
  { method: "readDouble", big: [63, 240, 0, 0, 0, 0, 0, 0], little: [0, 0, 0, 0, 0, 0, 240, 63], want: 1 },
  { method: "readDouble", big: [192, 4, 0, 0, 0, 0, 0, 0], little: [0, 0, 0, 0, 0, 0, 4, 192], want: -2.5 },
  { method: "readDouble", big: [127, 240, 0, 0, 0, 0, 0, 0], little: [0, 0, 0, 0, 0, 0, 240, 127], want: Infinity },
  { method: "readDouble", big: [255, 240, 0, 0, 0, 0, 0, 0], little: [0, 0, 0, 0, 0, 0, 240, 255], want: -Infinity },
  { method: "readDouble", big: [127, 248, 0, 0, 0, 0, 0, 1], little: [1, 0, 0, 0, 0, 0, 248, 127], nan: true },
  { method: "readDouble", big: [0, 0, 0, 0, 0, 0, 0, 1], little: [1, 0, 0, 0, 0, 0, 0, 0], want: 5e-324 },
];

test("default big endian interprets a literal header and advances the cursor", () => {
  const Reader = api();
  const reader = new Reader(new Uint8Array([1, 2, 3, 4]));
  try {
    assert.deepEqual(diagnostics(reader), [4, 0, 4, "bigEndian"]);
    assert.equal(reader.readUnsignedInt(), 16909060);
    assert.deepEqual(diagnostics(reader), [4, 4, 0, "bigEndian"]);
  } finally { reader.dispose(); }
});

test("byte order is explicit and can change between unaligned numeric records", () => {
  using(new Uint8Array([9, 1, 2, 3, 4, 4, 3, 2, 1]), undefined, reader => {
    assert.equal(reader.readUnsignedByte(), 9);
    assert.equal(reader.readUnsignedInt(), 16909060);
    reader.endian = "littleEndian";
    assert.equal(reader.position, 5);
    assert.equal(reader.readUnsignedInt(), 16909060);
    assert.equal(reader.bytesAvailable, 0);
    reader.seek(1);
    assert.equal(reader.readUnsignedInt(), 67305985);
  });
});

test("signed boundaries and unsigned-32 values are not narrowed or wrapped", () => {
  for (const row of integerCases) {
    for (const [order, bytes] of [["bigEndian", row.big], ["littleEndian", row.little]]) {
      using(new Uint8Array(bytes), order, reader => {
        assert.equal(reader[row.method](), row.want, row.method + "/" + order);
        assert.equal(reader.position, bytes.length);
        assert.equal(reader.bytesAvailable, 0);
      });
    }
  }
});

test("float/double literal encodings retain signed zero, infinities and subnormals", () => {
  for (const row of floatCases) {
    for (const [order, bytes] of [["bigEndian", row.big], ["littleEndian", row.little]]) {
      using(new Uint8Array(bytes), order, reader => {
        const actual = reader[row.method]();
        if (row.nan) assert.equal(Number.isNaN(actual), true);
        else assert.equal(Object.is(actual, row.want), true, row.method + "/" + order);
        assert.equal(reader.position, bytes.length);
      });
    }
  }
});

test("insufficient scalar reads leave cursor and bytes available for a retry", () => {
  for (const [method, width] of [["readByte", 1], ["readUnsignedByte", 1], ["readShort", 2], ["readUnsignedShort", 2], ["readInt", 4], ["readUnsignedInt", 4], ["readFloat", 4], ["readDouble", 8]]) {
    using(new Uint8Array(width), "littleEndian", reader => {
      reader.seek(1);
      const before = diagnostics(reader);
      assert.throws(() => reader[method](), RangeError, method);
      assert.deepEqual(diagnostics(reader), before);
      reader.seek(0);
      assert.equal(reader[method](), 0);
      assert.equal(reader.position, width);
    });
  }
});

test("seek/skip accept endpoints and normalize negative zero without coercion", () => {
  using(new Uint8Array([10, 20, 30]), undefined, reader => {
    assert.equal(reader.seek(-0), undefined);
    assert.equal(Object.is(reader.position, 0), true);
    assert.equal(reader.skip(-0), undefined);
    assert.deepEqual([...reader.readBytes(-0)], []);
    assert.equal(Object.is(reader.position, 0), true);
    assert.equal(reader.skip(2), undefined);
    assert.equal(reader.readUnsignedByte(), 30);
    reader.seek(3);
    assert.equal(reader.skip(0), undefined);
    reader.seek(1);
    assert.equal(reader.readUnsignedByte(), 20);
  });
});

test("invalid cursor/count/endian inputs preserve the current payload and cursor", () => {
  using(new Uint8Array([10, 20, 30, 40]), "littleEndian", reader => {
    reader.seek(1);
    const numericBad = [-1, 0.5, NaN, Infinity, -Infinity, 9007199254740992, 9007199254740991];
    const typeBad = ["1", null, true, 1n, {}, () => 1];
    for (const method of ["seek", "skip", "readBytes"]) {
      for (const value of numericBad) {
        const before = diagnostics(reader);
        assert.throws(() => reader[method](value), RangeError);
        assert.deepEqual(diagnostics(reader), before);
      }
      for (const value of typeBad) {
        const before = diagnostics(reader);
        assert.throws(() => reader[method](value), TypeError);
        assert.deepEqual(diagnostics(reader), before);
      }
    }
    for (const bad of [undefined, null, "middleEndian", false, {}]) {
      assert.throws(() => { reader.endian = bad; }, TypeError);
      assert.deepEqual(diagnostics(reader), [4, 1, 3, "littleEndian"]);
    }
    assert.throws(() => reader.seek(5), RangeError);
    assert.throws(() => reader.skip(4), RangeError);
    assert.throws(() => reader.readBytes(4), RangeError);
    assert.deepEqual([...reader.readBytes()], [20, 30, 40]);
  });
});

test("readBytes copies explicit/default ranges and empty results remain independent", () => {
  using(new Uint8Array([10, 20, 30, 40]), undefined, reader => {
    const first = reader.readBytes(2);
    const second = reader.readBytes(undefined);
    const emptyA = reader.readBytes();
    const emptyB = reader.readBytes(0);
    assert.deepEqual([...first], [10, 20]);
    assert.deepEqual([...second], [30, 40]);
    assert.deepEqual([...emptyA], []);
    assert.notEqual(emptyA, emptyB);
    assert.notEqual(emptyA.buffer, emptyB.buffer);
    first.fill(99);
    second.fill(88);
    reader.seek(0);
    assert.deepEqual([...reader.readBytes()], [10, 20, 30, 40]);
  });
});

test("an offset snapshot owns only its selected bytes and outputs are tight copies", () => {
  const backing = new Uint8Array([99, 10, 20, 30, 88]);
  const source = backing.subarray(1, 4);
  using(source, undefined, reader => {
    backing.fill(42);
    const first = reader.readBytes();
    reader.seek(0);
    const second = reader.readBytes();
    assert.deepEqual([...first], [10, 20, 30]);
    assert.deepEqual([...second], [10, 20, 30]);
    assert.equal(first.byteOffset, 0);
    assert.equal(first.byteLength, 3);
    assert.equal(first.buffer.byteLength, 3);
    assert.notEqual(first.buffer, backing.buffer);
    assert.notEqual(first.buffer, second.buffer);
    first[0] = 77;
    assert.deepEqual([...second], [10, 20, 30]);
  });
});

test("later input/output detachment cannot invalidate the owned reader", t => {
  if (typeof structuredClone !== "function") { t.skip("Transfer unavailable; detachment behavior untested"); return; }
  const source = new Uint8Array([10, 20, 30]);
  using(source, undefined, reader => {
    structuredClone(source.buffer, { transfer: [source.buffer] });
    const copy = reader.readBytes();
    assert.deepEqual([...copy], [10, 20, 30]);
    structuredClone(copy.buffer, { transfer: [copy.buffer] });
    reader.seek(0);
    assert.deepEqual([...reader.readBytes()], [10, 20, 30]);
  });
});

test("intrinsic cross-realm views and Uint8Array subclasses are accepted", () => {
  class Bytes extends Uint8Array {}
  for (const source of [vm.runInNewContext("new Uint8Array([1,2,3,4])"), new Bytes([1, 2, 3, 4])]) {
    using(source, undefined, reader => assert.equal(reader.readUnsignedInt(), 16909060));
  }
});

test("input identity and copies ignore poisoned metadata, iterators and species", () => {
  let reads = 0;
  class Bytes extends Uint8Array {
    static get [Symbol.species]() { reads++; throw new Error("caller species"); }
  }
  const source = new Bytes([1, 2, 3, 4]);
  for (const key of ["buffer", "byteLength", "byteOffset", "length", "constructor", "slice", Symbol.iterator, Symbol.toStringTag]) {
    Object.defineProperty(source, key, { get() { reads++; throw new Error("caller property"); } });
  }
  using(source, undefined, reader => {
    assert.equal(reader.readUnsignedInt(), 16909060);
    reader.seek(0);
    assert.deepEqual([...reader.readBytes()], [1, 2, 3, 4]);
  });
  assert.equal(reads, 0);
});

test("non-byte/forged/proxied inputs are rejected without property traps", () => {
  const Reader = api();
  let reads = 0;
  const trap = { get() { reads++; throw new Error("input get"); }, ownKeys() { reads++; throw new Error("input keys"); }, getPrototypeOf() { reads++; throw new Error("input prototype"); } };
  const revoked = Proxy.revocable(new Uint8Array(4), trap);
  revoked.revoke();
  const forged = Object.create(Uint8Array.prototype);
  for (const source of [null, undefined, 1, "bytes", true, () => {}, [1, 2, 3, 4], new Uint8ClampedArray(4), new Uint16Array(2), new DataView(new ArrayBuffer(4)), forged, new Proxy(new Uint8Array(4), trap), revoked.proxy]) {
    assert.throws(() => new Reader(source), TypeError);
  }
  assert.equal(reads, 0);
});

test("SharedArrayBuffer backing is rejected, including foreign-realm backing", t => {
  if (typeof SharedArrayBuffer !== "function") { t.skip("Shared storage unavailable; admission untested"); return; }
  const Reader = api();
  for (const source of [new Uint8Array(new SharedArrayBuffer(4)), vm.runInNewContext("new Uint8Array(new SharedArrayBuffer(4))")]) {
    assert.throws(() => new Reader(source), TypeError);
  }
});

test("resizable backing is rejected even for fixed-length and zero-length views", t => {
  const getter = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, "resizable")?.get;
  if (!getter) { t.skip("Resizable backing unavailable; admission untested"); return; }
  const Reader = api();
  const backing = new ArrayBuffer(4, { maxByteLength: 8 });
  assert.equal(Reflect.apply(getter, backing, []), true, "fixture must really be resizable");
  for (const source of [new Uint8Array(backing), new Uint8Array(backing, 0, 4), new Uint8Array(new ArrayBuffer(0, { maxByteLength: 8 })), vm.runInNewContext("new Uint8Array(new ArrayBuffer(4,{maxByteLength:8}),0,4)")]) {
    assert.throws(() => new Reader(source), TypeError);
  }
});

test("detached backing fails while attached zero-length input remains usable", t => {
  if (typeof structuredClone !== "function") { t.skip("Transfer unavailable; detached admission untested"); return; }
  const Reader = api();
  for (const count of [0, 4]) {
    const source = new Uint8Array(count);
    structuredClone(source.buffer, { transfer: [source.buffer] });
    assert.throws(() => new Reader(source), TypeError);
  }
  using(new Uint8Array(0), undefined, reader => {
    assert.deepEqual(diagnostics(reader), [0, 0, 0, "bigEndian"]);
    assert.deepEqual([...reader.readBytes()], []);
    assert.throws(() => reader.readUnsignedByte(), RangeError);
  });
});

test("the exact logical cap is admitted and cap plus one rejects RangeError", () => {
  const Reader = api();
  const source = new Uint8Array(16777216);
  source[0] = 17;
  source[16777215] = 23;
  const reader = new Reader(source);
  try {
    assert.equal(reader.readUnsignedByte(), 17);
    reader.seek(egret.BYTE_READER_LIMITS.maxBytes - 1);
    assert.equal(reader.readUnsignedByte(), 23);
    assert.equal(reader.bytesAvailable, 0);
  } finally { reader.dispose(); }
  assert.throws(() => new Reader(new Uint8Array(16777217)), RangeError);
  assert.equal(Object.isFrozen(egret.BYTE_READER_LIMITS), true);
});

test("invalid endian or backing wins before oversized capacity admission", t => {
  const Reader = api();
  const oversized = new Uint8Array(16777217);
  assert.throws(() => new Reader(oversized, "middleEndian"), TypeError);
  assert.throws(() => new Reader(oversized, null), TypeError);
  if (typeof SharedArrayBuffer === "function") {
    assert.throws(() => new Reader(new Uint8Array(new SharedArrayBuffer(16777217))), TypeError);
  } else t.diagnostic("Shared oversized precedence untested on this host");
  const getter = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, "resizable")?.get;
  if (getter) {
    const backing = new ArrayBuffer(16777217, { maxByteLength: 16777218 });
    assert.equal(Reflect.apply(getter, backing, []), true);
    assert.throws(() => new Reader(new Uint8Array(backing)), TypeError);
  } else t.diagnostic("Resizable oversized precedence untested on this host");
});

test("constructor rejects unsupported endian without coercion", () => {
  const Reader = api();
  let converted = 0;
  const value = { toString() { converted++; return "bigEndian"; }, valueOf() { converted++; return "bigEndian"; } };
  for (const endian of [null, "middleEndian", 1, true, value]) assert.throws(() => new Reader(new Uint8Array(0), endian), TypeError);
  assert.equal(converted, 0);
  using(new Uint8Array([1, 2]), undefined, reader => assert.equal(reader.readUnsignedShort(), 258));
});

test("borrowed methods reject forged/proxied receivers before argument coercion", () => {
  const Reader = api();
  const reader = new Reader(new Uint8Array([1, 2, 3, 4]));
  let reads = 0;
  const trap = { get() { reads++; throw new Error("receiver get"); }, getPrototypeOf() { reads++; throw new Error("receiver prototype"); }, ownKeys() { reads++; throw new Error("receiver keys"); } };
  const revoked = Proxy.revocable(reader, trap);
  revoked.revoke();
  const invalid = [{}, Object.create(Reader.prototype), new Proxy(reader, trap), revoked.proxy, null, undefined, 1];
  try {
    for (const name of ["seek", "skip", "readByte", "readUnsignedByte", "readShort", "readUnsignedShort", "readInt", "readUnsignedInt", "readFloat", "readDouble", "readBytes", "dispose"]) {
      const method = reader[name];
      for (const receiver of invalid) assert.throws(() => Reflect.apply(method, receiver, [0]), TypeError);
    }
    assert.equal(reads, 0);
    assert.deepEqual(diagnostics(reader), [4, 0, 4, "bigEndian"]);
    assert.equal(reader.readUnsignedInt(), 16909060);
  } finally { reader.dispose(); }
});

test("public diagnostic accessors authenticate genuine receivers without traps", () => {
  const Reader = api();
  const reader = new Reader(new Uint8Array([1]));
  let reads = 0;
  const forged = new Proxy({}, { get() { reads++; throw new Error("getter receiver"); }, getPrototypeOf() { reads++; throw new Error("getter prototype"); } });
  try {
    for (const name of ["length", "position", "bytesAvailable", "disposed", "endian"]) {
      let owner = reader, descriptor;
      while (owner && !descriptor) { descriptor = Object.getOwnPropertyDescriptor(owner, name); owner = Object.getPrototypeOf(owner); }
      assert.equal(typeof descriptor?.get, "function", "Public getter: " + name);
      assert.throws(() => Reflect.apply(descriptor.get, forged, []), TypeError);
      if (name === "endian") assert.throws(() => Reflect.apply(descriptor.set, forged, ["bigEndian"]), TypeError);
    }
    assert.equal(reads, 0);
  } finally { reader.dispose(); }
});

test("disposal is terminal/idempotent but diagnostics and returned copies survive", () => {
  const Reader = api();
  const reader = new Reader(new Uint8Array([10, 20, 30]), "littleEndian");
  const output = reader.readBytes(1);
  reader.dispose();
  reader.dispose();
  assert.equal(reader.disposed, true);
  assert.deepEqual(diagnostics(reader), [0, 0, 0, "littleEndian"]);
  assert.deepEqual([...output], [10]);
  // A live reader would reject -1 as RangeError: terminal TypeError must win.
  for (const name of ["seek", "skip", "readBytes"]) assert.throws(() => reader[name](-1), TypeError);
  for (const name of ["readByte", "readUnsignedByte", "readShort", "readUnsignedShort", "readInt", "readUnsignedInt", "readFloat", "readDouble"]) assert.throws(() => reader[name](), TypeError);
  assert.throws(() => { reader.endian = "middleEndian"; }, TypeError);
  assert.deepEqual(diagnostics(reader), [0, 0, 0, "littleEndian"]);
  output[0] = 99;
  assert.equal(output[0], 99);
});

test("genuine Engine/Scope cleanup owns readers without changing returned copies", async () => {
  const Reader = api();
  const adapter = {
    surface: {},
    async close() {},
    setTimeout(callback, delayMs) { const timer = setTimeout(callback, delayMs); return () => clearTimeout(timer); },
  };
  const engine = await egret.createEngine({ host: adapter });
  const local = new Reader(new Uint8Array([10, 20]));
  const engineOwned = new Reader(new Uint8Array([30, 40]));
  try {
    const scope = engine.createScope();
    assert.equal(scope.use(local), local);
    const copy = local.readBytes();
    scope.dispose();
    assert.equal(local.disposed, true);
    assert.deepEqual([...copy], [10, 20]);
    assert.throws(() => local.readByte(), TypeError);
    engine.createScope().use(engineOwned);
    await engine.dispose();
    assert.equal(engineOwned.disposed, true);
    assert.deepEqual(diagnostics(engineOwned), [0, 0, 0, "bigEndian"]);
  } finally {
    local.dispose(); engineOwned.dispose(); await engine.dispose();
  }
});
