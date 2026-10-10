import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createMatrix4,createVector4,multiplyMatrix4,transformHomogeneous4,Math3DError} from '../packages/engine/dist/rendering/matrix4.js';

// Independent literal witnesses from the sealed B0 oracle; no production operation
// computes an expected matrix/vector, and no projection-construction port is used.
const ID=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
const ZERO=[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0];
const PARENT=[0,1,0,0,-1,0,0,0,0,0,1,0,0,0,0,1];
const LOCAL=[1,0,0,0,0,1,0,0,0,0,1,0,3,0,0,1];
const COMPOSED=[0,1,0,0,-1,0,0,0,0,0,1,0,0,3,0,1];
function tuple(actual,expected){assert.equal(Array.isArray(actual),true);assert.equal(Object.getPrototypeOf(actual),Array.prototype);assert.equal(Object.isFrozen(actual),true);assert.deepEqual(actual,expected);for(const value of actual)if(value===0)assert.equal(Object.is(value,0),true);}
function caught(action){try{action();}catch(error){return error;}assert.fail('Expected a throw');}
function code(action,expected){const error=caught(action);assert.ok(error instanceof Math3DError);assert.equal(error.name,'Math3DError');assert.equal(error.code,expected);return error;}
function origin(action,expected,cause){const error=code(action,expected);assert.notEqual(error,cause);assert.equal(Object.hasOwn(error,'cause'),true);assert.equal(error.cause,cause);return error;}
const sources=[['matrix',createMatrix4,ID,16],['vector',createVector4,[1,2,3,4],4]];
const causes=()=>[new Math3DError('MATH3D_ARITHMETIC_RANGE','old'),new Math3DError('MATH3D_INPUT_INVALID'),new Math3DError('MATH3D_NATIVE_FAILED'),{name:'Math3DError',code:'MATH3D_GEOMETRY_INVALID'},new Error('plain'),'primitive',null,undefined];
function counted(values,events){return new Proxy(values,{get(target,key){events.push('get:'+String(key));return Reflect.get(target,key);},getOwnPropertyDescriptor(target,key){events.push('own:'+String(key));return Reflect.getOwnPropertyDescriptor(target,key);}});}
const MATRIX_READS=['get:length','own:0','get:0','own:1','get:1','own:2','get:2','own:3','get:3','own:4','get:4','own:5','get:5','own:6','get:6','own:7','get:7','own:8','get:8','own:9','get:9','own:10','get:10','own:11','get:11','own:12','get:12','own:13','get:13','own:14','get:14','own:15','get:15'];
const VECTOR_READS=['get:length','own:0','get:0','own:1','get:1','own:2','get:2','own:3','get:3'];

for(const [name,factory,values,count] of sources){
 test('I01 '+name+' admits frozen arrays but rejects non-arrays without coercion or iteration',()=>{
  tuple(factory(Object.freeze([...values])),values);let calls=0;const hostile={length:count,get [Symbol.iterator](){calls++;throw 'iterator';},get toJSON(){calls++;throw 'json';},valueOf(){calls++;throw 'coerce';}};
  for(const invalid of [null,undefined,1,'1',hostile,new Set(values),new Float32Array(count),new Float64Array(count)])code(()=>factory(invalid),'MATH3D_INPUT_INVALID');assert.equal(calls,0);
 });
 test('I02 '+name+' length is one source read and rejects before numeric admission',()=>{
  for(const length of [count-1,count+1]){const events=[],input=new Proxy(new Array(length),{get(target,key){events.push('get:'+String(key));if(key!=='length')throw 'numeric';return Reflect.get(target,key);},getOwnPropertyDescriptor(){throw 'presence';}});code(()=>factory(input),'MATH3D_INPUT_INVALID');assert.deepEqual(events,['get:length']);}
  for(const cause of causes()){let lengthReads=0;const input=new Proxy([...values],{get(target,key){if(key==='length'){lengthReads++;throw cause;}assert.fail('numeric read after throwing length');}});origin(()=>factory(input),'MATH3D_INPUT_READ_FAILED',cause);assert.equal(lengthReads,1);}
 });
 test('I03 '+name+' own presence/value order is ascending once with ignored machinery',()=>{
  const events=[],input=[...values];Object.defineProperty(input,Symbol.iterator,{get(){throw 'iterator';}});Object.defineProperty(input,'toJSON',{get(){throw 'json';}});tuple(factory(counted(input,events)),values);assert.deepEqual(events,count===16?MATRIX_READS:VECTOR_READS);
 });
 test('I03/I06 '+name+' holes never invoke inherited values and later own reads continue',()=>{
  const input=[...values],proto=Object.create(Array.prototype);let inherited=0,last=0;delete input[0];Object.defineProperty(proto,'0',{get(){inherited++;throw 'prototype';}});Object.setPrototypeOf(input,proto);Object.defineProperty(input,String(count-1),{get(){last++;return values[count-1];}});code(()=>factory(input),'MATH3D_INPUT_INVALID');assert.equal(inherited,0);assert.equal(last,1);
 });
 test('I05 '+name+' invalid components are checked only after complete capture without coercion',()=>{
  let coercions=0;for(const invalid of [undefined,null,'1',NaN,Infinity,-Infinity,1n,Symbol('value'),{valueOf(){coercions++;return 1;}}]){const input=[...values];input[0]=invalid;const events=[];code(()=>factory(counted(input,events)),'MATH3D_INPUT_INVALID');assert.deepEqual(events,count===16?MATRIX_READS:VECTOR_READS);}assert.equal(coercions,0);
 });
 test('I05 '+name+' revoked array and own-presence faults preserve exact source causes',()=>{
  const revocable=Proxy.revocable([...values],{});revocable.revoke();const error=code(()=>factory(revocable.proxy),'MATH3D_INPUT_READ_FAILED');assert.ok(error.cause instanceof TypeError);
  for(const cause of causes()){let checks=0;const input=new Proxy([...values],{getOwnPropertyDescriptor(){checks++;throw cause;}});origin(()=>factory(input),'MATH3D_INPUT_READ_FAILED',cause);assert.equal(checks,1);}
 });
 test('I06/I09 '+name+' later getter wins over a captured hole or invalid value',()=>{
  for(const first of ['hole','invalid'])for(const cause of causes()){const input=[...values];if(first==='hole')delete input[0];else input[0]=NaN;let reads=0;Object.defineProperty(input,String(count-1),{get(){reads++;throw cause;}});origin(()=>factory(input),'MATH3D_INPUT_READ_FAILED',cause);assert.equal(reads,1);}
 });
 test('I07 '+name+' capture normalizes every negative zero',()=>{const input=count===16?[-0,0,-0,0,-0,0,-0,0,-0,0,-0,0,-0,0,-0,0]:[-0,0,-0,0];tuple(factory(input),count===16?ZERO:[0,0,0,0]);assert.equal(Object.is(input[0],-0),true);});
 test('I08 '+name+' fresh frozen ordinary tuples own values independently',()=>{
  const input=[...values],first=factory(input),second=factory(input);assert.notEqual(first,input);assert.notEqual(first,second);const mutable=Array.from(first);input[0]=99;mutable[0]=88;tuple(first,values);tuple(second,values);assert.throws(()=>{first[0]=77;},TypeError);assert.throws(()=>{first.push(1);},TypeError);
 });
 test('I09 '+name+' Array.isArray executes once and its thrown class has read origin',()=>{
  const original=Array.isArray;for(const cause of causes()){let calls=0,error;try{Array.isArray=value=>{calls++;assert.equal(value,values);throw cause;};error=caught(()=>factory(values));}finally{Array.isArray=original;}assert.equal(calls,1);assert.equal(error.code,'MATH3D_INPUT_READ_FAILED');assert.equal(error.cause,cause);assert.notEqual(error,cause);}
  let calls=0;try{Array.isArray=value=>{calls++;return original(value);};tuple(factory(values),values);}finally{Array.isArray=original;}assert.equal(calls,2); // one production call, plus tuple's independent ordinary-array assertion
 });
}

test('I04 vector getter reentry captures each own slot once, without simultaneous-snapshot claims',()=>{
 const input=[1,2,3,4],events=[];let last=4;for(const index of [0,1,2,3])Object.defineProperty(input,String(index),{get(){events.push(index);if(index===0)last=8;return index===3?last:index+1;}});const result=createVector4(input);tuple(result,[1,2,3,8]);assert.deepEqual(events,[0,1,2,3]);last=9;tuple(result,[1,2,3,8]);
});
test('I04 matrix getter reentry changes the later captured m15 exactly once',()=>{
 const input=[...ID];let reads=0;Object.defineProperty(input,'0',{get(){reads++;input[15]=2;return 1;}});const result=createMatrix4(input);tuple(result,[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,2]);assert.equal(reads,1);input[15]=7;tuple(result,[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,2]);
});
test('I12 multiply captures left completely before right and earlier failure leaves right unread',()=>{
 const events=[],left=counted([...ID],events),right=new Proxy([...ID],{get(target,key){events.push('right:'+String(key));return Reflect.get(target,key);},getOwnPropertyDescriptor(target,key){events.push('right-own:'+String(key));return Reflect.getOwnPropertyDescriptor(target,key);}});tuple(multiplyMatrix4(left,right),ID);assert.deepEqual(events.slice(0,MATRIX_READS.length),MATRIX_READS);assert.equal(events[MATRIX_READS.length],'right:length');
 let reads=0;const unread=new Proxy([...ID],{get(){reads++;throw 'right';},getOwnPropertyDescriptor(){reads++;throw 'right own';}});code(()=>multiplyMatrix4(null,unread),'MATH3D_INPUT_INVALID');assert.equal(reads,0);
});
test('I12 transform captures matrix before vector and earlier failure leaves vector unread',()=>{
 let reads=0;const unread=new Proxy([1,2,3,4],{get(){reads++;throw 'vector';},getOwnPropertyDescriptor(){reads++;throw 'vector own';}});const cause=new Math3DError('MATH3D_ARITHMETIC_RANGE');const left=[...ID];Object.defineProperty(left,'15',{get(){throw cause;}});origin(()=>transformHomogeneous4(left,unread),'MATH3D_INPUT_READ_FAILED',cause);assert.equal(reads,0);
 const events=[],matrix=counted([...ID],events),vector=new Proxy([1,2,3,4],{get(target,key){events.push('vector:'+String(key));return Reflect.get(target,key);}});tuple(transformHomogeneous4(matrix,vector),[1,2,3,4]);assert.deepEqual(events.slice(0,MATRIX_READS.length),MATRIX_READS);assert.equal(events[MATRIX_READS.length],'vector:length');
});
test('I12 one caller array passed twice produces two ordered captures',()=>{
 const input=[...ID];let lengths=0,zeros=0;const proxy=new Proxy(input,{get(target,key){if(key==='length'){lengths++;if(lengths===2)target[0]=2;}if(key==='0')zeros++;return Reflect.get(target,key);}});tuple(multiplyMatrix4(proxy,proxy),[2,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);assert.equal(lengths,2);assert.equal(zeros,2);
});

const operations=[['matrix snapshot',()=>createMatrix4(ID),1],['vector snapshot',()=>createVector4([1,2,3,4]),1],['multiply',()=>multiplyMatrix4(ID,ID),3],['transform',()=>transformHomogeneous4(ID,[1,2,3,4]),3]];
for(const [name,action,total] of operations){
 test('I09 '+name+' every freeze boundary reports native origin with exact arbitrary cause',()=>{
  const original=Object.freeze;for(let selected=1;selected<=total;selected++)for(const cause of causes()){let calls=0,error;try{Object.freeze=value=>{calls++;if(calls===selected)throw cause;return original(value);};error=caught(action);}finally{Object.freeze=original;}assert.equal(calls,selected);assert.ok(error instanceof Math3DError);assert.equal(error.code,'MATH3D_NATIVE_FAILED');assert.equal(error.cause,cause);assert.notEqual(error,cause);}
 });
 test('I09 '+name+' private temporary/result allocation faults remain native',()=>{
  const original=globalThis.Array;for(let selected=1;selected<=total;selected++)for(const cause of causes()){let calls=0,error;function FaultArray(length){calls++;if(calls===selected)throw cause;return new original(length);}Object.setPrototypeOf(FaultArray,original);try{globalThis.Array=FaultArray;error=caught(action);}finally{globalThis.Array=original;}assert.equal(calls,selected);assert.ok(error instanceof Math3DError);assert.equal(error.code,'MATH3D_NATIVE_FAILED');assert.equal(error.cause,cause);assert.notEqual(error,cause);}
 });
}
test('I08 multiplication and transformation results are fresh and cannot mutate caller storage',()=>{
 const matrix=[...ID],vector=[1,2,3,4],a=multiplyMatrix4(matrix,matrix),b=multiplyMatrix4(matrix,matrix),c=transformHomogeneous4(matrix,vector),d=transformHomogeneous4(matrix,vector);assert.notEqual(a,b);assert.notEqual(c,d);assert.notEqual(a,matrix);assert.notEqual(c,vector);tuple(a,ID);tuple(c,[1,2,3,4]);matrix[0]=9;vector[0]=8;const mutable=Array.from(c);mutable[1]=7;tuple(a,ID);tuple(c,[1,2,3,4]);assert.throws(()=>{a[0]=0;},TypeError);assert.throws(()=>{c[3]=0;},TypeError);
});
test('Math3DError diagnostic codes and cause are ordinary ES2022 error data',()=>{const cause={id:'cause'};for(const value of ['MATH3D_INPUT_INVALID','MATH3D_INPUT_READ_FAILED','MATH3D_GEOMETRY_INVALID','MATH3D_ARITHMETIC_RANGE','MATH3D_NATIVE_FAILED']){const error=new Math3DError(value,cause);assert.ok(error instanceof Error);assert.equal(error.name,'Math3DError');assert.equal(error.code,value);assert.equal(error.cause,cause);}});

test('T01 parent times local has the independent literal point and direction witnesses',()=>{const result=multiplyMatrix4(PARENT,LOCAL);tuple(result,COMPOSED);tuple(transformHomogeneous4(result,[1,2,4,1]),[-2,4,4,1]);tuple(transformHomogeneous4(result,[1,2,4,0]),[-2,1,4,0]);});
test('C01 wrong composition order has the different specified literal result',()=>{const wrong=multiplyMatrix4(LOCAL,PARENT);tuple(wrong,[0,1,0,0,-1,0,0,0,0,0,1,0,3,0,0,1]);assert.notDeepEqual(wrong,COMPOSED);const point=transformHomogeneous4(wrong,[1,2,4,1]);tuple(point,[1,1,4,1]);assert.notDeepEqual(point,[-2,4,4,1]);});
test('T02 supplied literal view transforms eye target and forward direction only',()=>{const view=[0,0,1,0,0,1,0,0,-1,0,0,0,0,0,-3,1];tuple(transformHomogeneous4(view,[3,0,0,1]),[0,0,0,1]);tuple(transformHomogeneous4(view,[0,0,0,1]),[0,0,-3,1]);tuple(transformHomogeneous4(view,[-1,0,0,0]),[0,0,-1,0]);});
test('T03 supplied finite reflection transforms without culling or normal policy',()=>{const reflection=[-1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];tuple(transformHomogeneous4(reflection,[1,2,4,1]),[-1,2,4,1]);tuple(transformHomogeneous4(reflection,[1,2,4,0]),[-1,2,4,0]);});
test('T04 nonaffine point and direction preserve changed raw w without divide',()=>{const projective=[1,0,0,2,0,1,0,0,0,0,1,0,0,0,0,1];tuple(transformHomogeneous4(projective,[1,2,3,1]),[1,2,3,3]);tuple(transformHomogeneous4(projective,[1,2,3,0]),[1,2,3,2]);});
const RAW_PROFILES=[
 ['ZF',[1,0,0,0,0,1,0,0,0,0,-1.125,-1,0,0,-1.125,0],[2,3,-1.125,0],[1,2,-2.25,-1],[1,2,1.125,1]],
 ['ZR',[1,0,0,0,0,1,0,0,0,0,0.125,-1,0,0,1.125,0],[2,3,1.125,0],[1,2,1.25,-1],[1,2,-0.125,1]],
 ['NF',[1,0,0,0,0,1,0,0,0,0,-1.25,-1,0,0,-2.25,0],[2,3,-2.25,0],[1,2,-3.5,-1],[1,2,1.25,1]],
 ['NR',[1,0,0,0,0,1,0,0,0,0,1.25,-1,0,0,2.25,0],[2,3,2.25,0],[1,2,3.5,-1],[1,2,-1.25,1]],
];
for(const [name,matrix,zero,behind,direction] of RAW_PROFILES){test('T05 '+name+' literal projective input returns finite raw zero w',()=>tuple(transformHomogeneous4(matrix,[2,3,0,1]),zero));test('T06 '+name+' negative and changed direction w remain raw',()=>{tuple(transformHomogeneous4(matrix,[1,2,1,1]),behind);tuple(transformHomogeneous4(matrix,[1,2,-1,0]),direction);});}
test('C02 transposed storage discriminates XY Z and W from the correct literal input',()=>{const correct=[0.5,0,0,0,0,0.5,0,0,0.5,-0.5,-1.25,-1,0,0,-2.5,0],transposed=[0.5,0,0.5,0,0,0.5,-0.5,0,0,0,-1.25,-2.5,0,0,-1,0];tuple(transformHomogeneous4(correct,[0,0,-2,1]),[-1,1,0,2]);const wrong=transformHomogeneous4(transposed,[0,0,-2,1]);tuple(wrong,[0,0,1.5,5]);assert.notDeepEqual(wrong,[-1,1,0,2]);});

test('N01 binary64 coefficients beyond f32 retain literal identity products and raw transforms',()=>{for(const [matrix,expected] of [[[1.6069380442589903e60,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],[1.6069380442589903e60,2,3,1]],[[6.223015277861142e-61,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],[6.223015277861142e-61,2,3,1]]]){tuple(createMatrix4(matrix),matrix);tuple(multiplyMatrix4(ID,matrix),matrix);tuple(multiplyMatrix4(matrix,ID),matrix);tuple(transformHomogeneous4(matrix,[1,2,3,1]),expected);}});
test('N02 finite product overflow is range failure after both complete operand captures',()=>{
 const huge=[1.7976931348623157e308,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],right=[2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0];code(()=>transformHomogeneous4(huge,[2,0,0,0]),'MATH3D_ARITHMETIC_RANGE');code(()=>multiplyMatrix4(huge,right),'MATH3D_ARITHMETIC_RANGE');
 for(const [action,input,last] of [[value=>transformHomogeneous4(huge,value),[2,0,0,0],3],[value=>multiplyMatrix4(huge,value),right,15]]){const cause={capture:'before arithmetic'};const source=[...input];Object.defineProperty(source,String(last),{get(){throw cause;}});origin(()=>action(source),'MATH3D_INPUT_READ_FAILED',cause);}
});
test('N03 finite products with overflowing intermediate sum reject despite real cancellation',()=>{const matrix=[1.7976931348623157e308,0,0,0,1.7976931348623157e308,0,0,0,-1.7976931348623157e308,0,0,0,-1.7976931348623157e308,0,0,0],right=[1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0];code(()=>transformHomogeneous4(matrix,[1,1,1,1]),'MATH3D_ARITHMETIC_RANGE');code(()=>multiplyMatrix4(matrix,right),'MATH3D_ARITHMETIC_RANGE');});
test('N04 fixed four-product sum order yields one rather than the exact-real two',()=>{const matrix=[9007199254740992,0,0,0,1,0,0,0,-9007199254740992,0,0,0,1,0,0,0],right=[1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0],raw=transformHomogeneous4(matrix,[1,1,1,1]);tuple(raw,[1,0,0,0]);assert.notDeepEqual(raw,[2,0,0,0]);tuple(multiplyMatrix4(matrix,right),[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]);});
test('N05 singular matrices and generic underflow remain valid with positive output zero',()=>{tuple(createMatrix4(ZERO),ZERO);tuple(transformHomogeneous4(ZERO,[1,2,3,1]),[0,0,0,0]);tuple(multiplyMatrix4(ZERO,ID),ZERO);tuple(multiplyMatrix4(ID,ZERO),ZERO);const tiny=[5e-324,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],half=[0.5,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];tuple(multiplyMatrix4(tiny,half),[0,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);tuple(transformHomogeneous4([-5e-324,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0.5,0,0,0]),[0,0,0,0]);});
