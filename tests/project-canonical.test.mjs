import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const port=await import('../packages/project/dist/canonical.js').catch(()=>({}));
const cases=JSON.parse(readFileSync(new URL('./fixtures/project/canonical-cases.json',import.meta.url),'utf8'));
function emit(value){assert.equal(typeof port.canonicalize,'function','missing canonicalize port');return port.canonicalize(value);}
test('canonical bytes equal independent literal fixtures including numeric-looking keys',()=>{for(const c of cases){const actual=emit(c.input);assert.equal(actual,c.canonical,c.name);assert.deepEqual(Buffer.from(actual),Buffer.from(c.canonical),c.name);assert.deepEqual(JSON.parse(actual),JSON.parse(c.canonical));const prepared=port.prepareCanonical(c.input);assert.equal(prepared.canonical,c.canonical);assert.equal(prepared.nodeCount,c.nodes,c.name);assert.equal(prepared.utf8Bytes,Buffer.byteLength(c.canonical));}});
test('complete empty snapshot, history, and edit byte fixtures have no newline',()=>{for(const [file,nodes] of [['empty.snapshot.json',27],['empty.history.json',33],['edit.transaction.json',40]]){const bytes=readFileSync(new URL('./fixtures/project/'+file,import.meta.url));assert.notEqual(bytes.at(-1),10);const literal=bytes.toString('utf8');const value=JSON.parse(literal);assert.equal(emit(value),literal);assert.deepEqual(Buffer.from(emit(value)),bytes);assert.equal(port.prepareCanonical(value).nodeCount,nodes);}});
test('caller-normalized identity collections share bytes while authored arrays preserve order',()=>{
  // Shape normalization is Task 3. Both inputs below are independently literal
  // caller-normalized results of opposite authored collection permutations.
  const a={entities:[{id:'e_a'},{id:'e_b'}],files:[{id:'f_a'},{id:'f_b'}],retiredEntityIds:['e_c','e_d'],retiredFileIds:['f_c','f_d']};
  const b={retiredFileIds:['f_c','f_d'],retiredEntityIds:['e_c','e_d'],files:[{id:'f_a'},{id:'f_b'}],entities:[{id:'e_a'},{id:'e_b'}]};
  const expected='{"entities":[{"id":"e_a"},{"id":"e_b"}],"files":[{"id":"f_a"},{"id":"f_b"}],"retiredEntityIds":["e_c","e_d"],"retiredFileIds":["f_c","f_d"]}';
  assert.equal(emit(a),expected);assert.equal(emit(b),expected);
  assert.equal(emit({scope:{entityIds:['e_a','e_b'],fileIds:['f_a','f_b'],metadata:false,roots:false}}),'{"scope":{"entityIds":["e_a","e_b"],"fileIds":["f_a","f_b"],"metadata":false,"roots":false}}');
  for(const field of ['roots','references','operations'])assert.notEqual(emit({[field]:['a','b']}),emit({[field]:['b','a']}));
});
test('canonical preparation cannot silently turn private nonfinite candidates into null',()=>{for(const value of [Infinity,NaN,-Infinity,{n:Infinity}])assert.throws(()=>emit(value),/finite/u);assert.equal(emit(-0),'0');const cycle={};cycle.self=cycle;assert.throws(()=>port.prepareCanonical(cycle),/cycle/u);let calls=0;const accessor={get x(){calls++;return 0;}};assert.throws(()=>emit(accessor));assert.equal(calls,0);});
