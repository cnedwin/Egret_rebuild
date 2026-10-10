import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolveLimits } from '../packages/project/dist/limits.js';
import { cloneLive } from '../packages/project/dist/live-input.js';
import { openProjectHistory } from '@egret/project';
const input=await import('../packages/project/dist/text-input.js').catch(()=>({}));
const integers=await import('../packages/project/dist/integer-token.js').catch(()=>({}));
const cases=JSON.parse(readFileSync(new URL('./fixtures/project/text-cases.json',import.meta.url),'utf8'));
function read(text, overrides={},kind='snapshot'){assert.equal(typeof input.readText,'function','missing readText port');return input.readText(text,kind,resolveLimits(overrides).value);}
function rejected(r,code='PROJECT_INPUT_INVALID'){assert.equal(r.ok,false);assert.equal(r.diagnostics[0].code,code);assert.equal(r.diagnostics[0].phase,'parse');return r.diagnostics[0];}
test('strict text rejects decoded duplicates, syntax, and Unicode at every depth',()=>{for(const text of cases.invalid){const d=rejected(read(text));assert.ok(!JSON.stringify(d).includes(text.length>8?text:'RAW_SOURCE_SENTINEL'));}const valid=read('{"__proto__":1,"constructor":{"x":[]},"a":"😀"}');assert.equal(valid.ok,true);assert.equal(Object.getPrototypeOf(valid.value.value),null);assert.equal(valid.value.value.__proto__,1);assert.ok(Object.isFrozen(valid.value.value.constructor.x));});
test('integer tokens classify exact mathematical values independently of rounded callbacks',()=>{assert.equal(typeof integers.classifyIntegerToken,'function','missing integer token port');for(const c of cases.numeric){assert.deepEqual(integers.classifyIntegerToken(c.raw,5),{offset:5,length:c.raw.length,integerSafe:c.safe,negativeZero:c.negativeZero});const r=read('{"n":'+c.raw+'}');assert.equal(r.ok,true);assert.deepEqual(r.value.numericTokens.get('/n'),{offset:5,length:c.raw.length,integerSafe:c.safe,negativeZero:c.negativeZero});}assert.equal(read('{"n":9007199254740991.1}').value.value.n,9007199254740991);assert.equal(read('{"n":1e999}').value.value.n,Infinity);assert.ok(Object.is(read('{"n":-0}').value.value.n,-0));assert.equal(read('{"n":1e-999}').value.value.n,0);});
test('bounded huge exponents never reject zero because of exponent length',()=>{const exponent='9'.repeat(4096);for(const raw of ['0e'+exponent,'0e-'+exponent,'-0e'+exponent,'1e'+exponent,'1e-'+exponent]){const r=read(raw);assert.equal(r.ok,true);assert.equal(r.value.numericTokens.get('').integerSafe,raw.startsWith('0'));assert.equal(r.value.numericTokens.get('').negativeZero,raw.startsWith('-0'));}});
test('raw numeric offsets and escaped pointers are UTF16 metadata',()=>{const r=read('{"é":1.0,"a/b":{"~":1000e-3}}');assert.equal(r.ok,true);assert.deepEqual(r.value.numericTokens.get('/é'),{offset:5,length:3,integerSafe:true,negativeZero:false});assert.deepEqual(r.value.numericTokens.get('/a~1b/~0'),{offset:20,length:7,integerSafe:true,negativeZero:false});});
test('whole raw input and Unicode byte spans bound independently',()=>{assert.equal(read(' {} ',{maxSnapshotUtf8Bytes:4}).ok,true);rejected(read(' {} ',{maxSnapshotUtf8Bytes:3}),'PROJECT_LIMIT_EXCEEDED');assert.equal(read('"é"',{maxSnapshotUtf8Bytes:4,maxStringUtf8Bytes:2}).ok,true);rejected(read('"é"',{maxStringUtf8Bytes:1}),'PROJECT_LIMIT_EXCEEDED');const text=' {"historySchemaVersion":"1.0","baseline":{"é":1},"transactions":[{"n":1e0}]} ';assert.equal(Buffer.byteLength(text),79);const r=read(text,{maxSnapshotUtf8Bytes:8,maxTransactionUtf8Bytes:9,maxHistoryUtf8Bytes:79},'history');assert.equal(r.ok,true);assert.deepEqual(r.value.payloadSpans.get('/baseline'),{start:42,end:49,utf8Bytes:8});assert.deepEqual(r.value.payloadSpans.get('/transactions/0'),{start:66,end:75,utf8Bytes:9});rejected(read(text,{maxSnapshotUtf8Bytes:7},'history'),'PROJECT_LIMIT_EXCEEDED');rejected(read(text,{maxTransactionUtf8Bytes:8},'history'),'PROJECT_LIMIT_EXCEEDED');rejected(read(text,{maxHistoryUtf8Bytes:78},'history'),'PROJECT_LIMIT_EXCEEDED');});
test('logical history depth resets and scanner rejects deep trees before recursive visitor',()=>{assert.equal(read('{"a":{}}',{maxJsonDepth:2}).ok,true);rejected(read('{"a":{}}',{maxJsonDepth:1}),'PROJECT_LIMIT_EXCEEDED');assert.equal(read('{"historySchemaVersion":"1.0","baseline":{"a":{}},"transactions":[{"b":{}}]}',{maxJsonDepth:2},'history').ok,true);rejected(read('['.repeat(20000)+'0'+']'.repeat(20000)),'PROJECT_LIMIT_EXCEEDED');});
test('syntax error offset is safe and input does not leak through diagnostics',()=>{const d=rejected(read('{"a":1,}'));assert.equal(d.details.offset,7);assert.equal(d.details.length,1);const x=rejected(read('{"RAW_SOURCE_SENTINEL":}'));assert.ok(!JSON.stringify(x).includes('RAW_SOURCE_SENTINEL'));});
test('read text freezes result envelopes and separately limits canonical expansion',()=>{assert.ok(Object.isFrozen(read('{}')));assert.ok(Object.isFrozen(read('{')));assert.equal(read('1e20',{maxSnapshotUtf8Bytes:21}).ok,true);rejected(read('1e20',{maxSnapshotUtf8Bytes:20}),'PROJECT_LIMIT_EXCEEDED');const r=read('{"historySchemaVersion":"1.0","baseline":{},"transactions":[{"n":1e20}]}',{maxTransactionUtf8Bytes:27},'history');assert.equal(r.ok,true);rejected(read('{"historySchemaVersion":"1.0","baseline":{},"transactions":[{"n":1e20}]}',{maxTransactionUtf8Bytes:26},'history'),'PROJECT_LIMIT_EXCEEDED');});

test('misleading baseline in an unqualified history never receives a local snapshot budget', () => {
  const limits = resolveLimits({ maxSnapshotUtf8Bytes: 1 }).value;
  for (const text of [
    '{"baseline":{}}',
    '{"baseline":{},"transactions":[]}',
    '{"baseline":{},"historySchemaVersion":"1.0","transactions":[],"extra":0}',
    '{"baseline":{},"historySchemaVersion":1,"transactions":[]}',
    '{"baseline":{},"historySchemaVersion":"1.0","transactions":{}}'
  ]) {
    const result = read(text, { maxSnapshotUtf8Bytes: 1 }, 'history');
    assert.equal(result.ok, true, text);
    assert.equal(result.value.payloadSpans.size, 0, text);
    const live = cloneLive(JSON.parse(text), 'history', limits);
    assert.equal(live.ok, true, text);
    assert.deepEqual(result.value.value, live.value);
  }
});

test('unqualified transactions never receive local budgets or payload depth exemptions', () => {
  const text = '{"transactions":[{}]}';
  const limits = resolveLimits({ maxTransactionUtf8Bytes: 1, maxJsonDepth: 3 }).value;
  const result = read(text, { maxTransactionUtf8Bytes: 1, maxJsonDepth: 3 }, 'history');
  assert.equal(result.ok, true);
  assert.equal(result.value.payloadSpans.size, 0);
  assert.equal(cloneLive(JSON.parse(text), 'history', limits).ok, true);
  const shallow = rejected(read(text, { maxTransactionUtf8Bytes: 1, maxJsonDepth: 2 }, 'history'), 'PROJECT_LIMIT_EXCEEDED');
  assert.ok(shallow.message.includes('depth'));
  rejected(cloneLive(JSON.parse(text), 'history', resolveLimits({ maxTransactionUtf8Bytes: 1, maxJsonDepth: 2 }).value), 'PROJECT_LIMIT_EXCEEDED');
  rejected(read(text, { maxHistoryUtf8Bytes: 20 }, 'history'), 'PROJECT_LIMIT_EXCEEDED');
});

test('qualified history key permutations preserve exact local bytes, spans, and payload depth', () => {
  // Independent literals place the qualification keys before and after payloads.
  const cases = [
    {
      text: '{"historySchemaVersion":"1.0","baseline":{},"transactions":[{}]}',
      baseline: { start: 41, end: 43, utf8Bytes: 2 },
      transaction: { start: 60, end: 62, utf8Bytes: 2 }
    },
    {
      text: '{"transactions":[{}],"baseline":{},"historySchemaVersion":"1.0"}',
      baseline: { start: 32, end: 34, utf8Bytes: 2 },
      transaction: { start: 17, end: 19, utf8Bytes: 2 }
    },
    {
      text: '{"baseline":{},"transactions":[{}],"historySchemaVersion":"1.0"}',
      baseline: { start: 12, end: 14, utf8Bytes: 2 },
      transaction: { start: 31, end: 33, utf8Bytes: 2 }
    }
  ];
  for (const c of cases) {
    const exact = { maxSnapshotUtf8Bytes: 2, maxTransactionUtf8Bytes: 2, maxJsonDepth: 1 };
    const result = read(c.text, exact, 'history');
    assert.equal(result.ok, true, c.text);
    assert.deepEqual(result.value.payloadSpans.get('/baseline'), c.baseline);
    assert.deepEqual(result.value.payloadSpans.get('/transactions/0'), c.transaction);
    assert.equal(cloneLive(JSON.parse(c.text), 'history', resolveLimits(exact).value).ok, true);
    assert.equal(rejected(read(c.text, { ...exact, maxSnapshotUtf8Bytes: 1 }, 'history'), 'PROJECT_LIMIT_EXCEEDED').jsonPointer, '/baseline');
    assert.equal(rejected(read(c.text, { ...exact, maxTransactionUtf8Bytes: 1 }, 'history'), 'PROJECT_LIMIT_EXCEEDED').jsonPointer, '/transactions/0');
  }
  const spaced = '{"transactions":[{ }],"baseline":{},"historySchemaVersion":"1.0"}';
  const result = read(spaced, { maxSnapshotUtf8Bytes: 2, maxTransactionUtf8Bytes: 3, maxJsonDepth: 1 }, 'history');
  assert.equal(result.ok, true);
  assert.deepEqual(result.value.payloadSpans.get('/transactions/0'), { start: 17, end: 20, utf8Bytes: 3 });
  const raw = rejected(read(spaced, { maxSnapshotUtf8Bytes: 2, maxTransactionUtf8Bytes: 2, maxJsonDepth: 1 }, 'history'), 'PROJECT_LIMIT_EXCEEDED');
  assert.equal(raw.jsonPointer, '/transactions/0');
  assert.ok(raw.message.includes('raw span'));
  const nested = '{"transactions":[{"x":{}}],"baseline":{},"historySchemaVersion":"1.0"}';
  assert.equal(read(nested, { maxJsonDepth: 2 }, 'history').ok, true);
  assert.equal(cloneLive(JSON.parse(nested), 'history', resolveLimits({ maxJsonDepth: 2 }).value).ok, true);
  rejected(read(nested, { maxJsonDepth: 1 }, 'history'), 'PROJECT_LIMIT_EXCEEDED');
});

for (const payload of ['baseline', 'transaction']) {
test('qualified scalar ' + payload + ' budget accepts exact bytes and rejects one byte under', () => {
  const cases = [
    { raw: 'null', value: null, bytes: 4 },
    { raw: 'false', value: false, bytes: 5 },
    { raw: '"é"', value: 'é', bytes: 4 },
    // Escaped newline remains a four-byte canonical string, not one data byte.
    { raw: '"\\n"', value: '\n', bytes: 4 },
    { raw: '1e20', value: 1e20, bytes: 21 }
  ];
  for (const c of cases) {
      const pointer = payload === 'baseline' ? '/baseline' : '/transactions/0';
      const key = payload === 'baseline' ? 'maxSnapshotUtf8Bytes' : 'maxTransactionUtf8Bytes';
      const texts = payload === 'baseline' ? [
        '{"historySchemaVersion":"1.0","baseline":' + c.raw + ',"transactions":[]}',
        '{"transactions":[],"baseline":' + c.raw + ',"historySchemaVersion":"1.0"}'
      ] : [
        '{"historySchemaVersion":"1.0","baseline":{},"transactions":[' + c.raw + ']}',
        '{"transactions":[' + c.raw + '],"baseline":{},"historySchemaVersion":"1.0"}'
      ];
      for (const text of texts) {
        const exact = { [key]: c.bytes };
        const accepted = read(text, exact, 'history');
        assert.equal(accepted.ok, true, text);
        assert.equal(accepted.value.payloadSpans.has(pointer), false);
        const live = cloneLive(JSON.parse(text), 'history', resolveLimits(exact).value);
        assert.equal(live.ok, true);
        assert.deepEqual(accepted.value.value, live.value);
        const under = { [key]: c.bytes - 1 };
        const textDiagnostic = rejected(read(text, under, 'history'), 'PROJECT_LIMIT_EXCEEDED');
        const liveDiagnostic = rejected(cloneLive(JSON.parse(text), 'history', resolveLimits(under).value), 'PROJECT_LIMIT_EXCEEDED');
        assert.equal(textDiagnostic.jsonPointer, pointer);
        assert.equal(liveDiagnostic.jsonPointer, pointer);
        assert.equal(textDiagnostic.code, liveDiagnostic.code);
      }
  }
});
}

test('scalar local budgets preserve wrapper exclusion and grammar before schema', () => {
  for (const text of ['{"baseline":null}', '{"transactions":[null]}']) {
    const result = read(text, { maxSnapshotUtf8Bytes: 3, maxTransactionUtf8Bytes: 3 }, 'history');
    assert.equal(result.ok, true);
    assert.equal(result.value.payloadSpans.size, 0);
  }
  const malformed = '{"historySchemaVersion":"1.0","baseline":null,"transactions":[null,]}';
  const grammar = rejected(read(malformed, { maxSnapshotUtf8Bytes: 3, maxTransactionUtf8Bytes: 3 }, 'history'));
  assert.equal(grammar.jsonPointer, '');
  assert.equal(grammar.details.offset, 67);
  const baselineText = '{"historySchemaVersion":"1.0","baseline":null,"transactions":[]}';
  const atCap = openProjectHistory(baselineText, { maxSnapshotUtf8Bytes: 4 });
  assert.equal(atCap.ok, false);
  assert.equal(atCap.diagnostics[0].code, 'PROJECT_HISTORY_INVALID');
  assert.equal(atCap.diagnostics[0].details.causeCode, 'PROJECT_INPUT_INVALID');
  assert.equal(atCap.diagnostics[0].details.index, 0);
  const underCap = rejected(openProjectHistory(baselineText, { maxSnapshotUtf8Bytes: 3 }), 'PROJECT_LIMIT_EXCEEDED');
  assert.equal(underCap.jsonPointer, '/baseline');
  const snapshot = readFileSync(new URL('./fixtures/project/empty.snapshot.json', import.meta.url), 'utf8');
  const transactionText = '{"historySchemaVersion":"1.0","baseline":' + snapshot + ',"transactions":[null]}';
  const transactionAtCap = openProjectHistory(transactionText, { maxTransactionUtf8Bytes: 4 });
  assert.equal(transactionAtCap.ok, false);
  assert.equal(transactionAtCap.diagnostics[0].code, 'PROJECT_HISTORY_INVALID');
  assert.equal(transactionAtCap.diagnostics[0].details.causeCode, 'PROJECT_INPUT_INVALID');
  assert.equal(transactionAtCap.diagnostics[0].details.index, 1);
  const transactionUnder = rejected(openProjectHistory(transactionText, { maxTransactionUtf8Bytes: 3 }), 'PROJECT_LIMIT_EXCEEDED');
  assert.equal(transactionUnder.jsonPointer, '/transactions/0');
});
