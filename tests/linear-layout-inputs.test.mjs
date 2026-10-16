// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {EgretError} from '@egret/engine';
import {planLinearLayout} from '@egret/engine/layout';

function refuses(action, expected, originalCause, checkCause = false) {
  let occurred = false, failure;
  try { action(); } catch (cause) { occurred = true; failure = cause; }
  assert.equal(occurred, true, expected);
  assert.ok(failure instanceof EgretError);
  assert.equal(failure.code, expected);
  if (checkCause) {
    assert.equal(Object.hasOwn(failure, 'cause'), true);
    assert.equal(failure.cause, originalCause);
  }
  return failure;
}
const ordinary = () => ({axis:'horizontal', items:[{width:1, height:2}]});

test('LL07 one ordered capture ignores extra fields and the caller iterator', () => {
  const trace = [];
  const item = {get width(){trace.push('width'); return 2;}, get height(){trace.push('height'); return 3;}, get unused(){throw new Error('unused item');}};
  const items = new Proxy([item], {get(target, key, receiver) {
    trace.push(typeof key === 'symbol' ? key.toString() : key);
    if (key === Symbol.iterator) throw new Error('iterator must not be read');
    return Reflect.get(target, key, receiver);
  }});
  const options = {};
  for (const [name, value] of [['axis','horizontal'], ['items',items], ['gap',1], ['padding',2], ['crossAlign','end']]) {
    Object.defineProperty(options, name, {get(){trace.push(name); return value;}});
  }
  Object.defineProperty(options, 'unused', {get(){throw new Error('unused option');}});
  assert.deepEqual(planLinearLayout(options), {width:6, height:7, placements:[{index:0, x:2, y:2, width:2, height:3}]});
  assert.deepEqual(trace, ['axis','items','length','gap','padding','crossAlign','0','width','height']);
});

test('LL08 the first invalid field stops subsequent caller reads', () => {
  let reads = 0;
  refuses(() => planLinearLayout({axis:'diagonal', get items(){reads++; throw undefined;}}), 'LAYOUT_OPTIONS_INVALID');
  assert.equal(reads, 0);
  refuses(() => planLinearLayout({axis:'horizontal', items:{length:0}, get gap(){reads++; throw undefined;}}), 'LAYOUT_OPTIONS_INVALID');
  assert.equal(reads, 0);
  refuses(() => planLinearLayout({...ordinary(), gap:null, get padding(){reads++; throw undefined;}}), 'LAYOUT_OPTIONS_INVALID');
  refuses(() => planLinearLayout({...ordinary(), padding:null, get crossAlign(){reads++; throw undefined;}}), 'LAYOUT_OPTIONS_INVALID');
  const items = new Proxy([{width:1, height:1}], {get(target, key, receiver){if(key === '0') reads++; return Reflect.get(target,key,receiver);}});
  refuses(() => planLinearLayout({axis:'horizontal', items, crossAlign:null}), 'LAYOUT_OPTIONS_INVALID');
  refuses(() => planLinearLayout({axis:'horizontal', items:[{width:-1, get height(){reads++; throw undefined;}}]}), 'LAYOUT_OPTIONS_INVALID');
  assert.equal(reads, 0);
});

test('LL09 strict records and scalar values perform no coercion', () => {
  for (const options of [undefined, null, [], () => {}, 1, 'options']) refuses(() => planLinearLayout(options), 'LAYOUT_OPTIONS_INVALID');
  for (const items of [null, {}, new Set(), new Uint8Array(0)]) refuses(() => planLinearLayout({axis:'horizontal', items}), 'LAYOUT_OPTIONS_INVALID');
  for (const item of [null, [], () => {}, 1]) refuses(() => planLinearLayout({axis:'horizontal', items:[item]}), 'LAYOUT_OPTIONS_INVALID');
  for (const value of [undefined, null, true, '1', NaN, Infinity, -1]) {
    refuses(() => planLinearLayout({axis:'horizontal', items:[{width:value, height:1}]}), 'LAYOUT_OPTIONS_INVALID');
    refuses(() => planLinearLayout({axis:'vertical', items:[{width:1, height:value}]}), 'LAYOUT_OPTIONS_INVALID');
  }
  for (const name of ['gap','padding']) for (const value of [null, '1', false, NaN, Infinity, -1]) refuses(() => planLinearLayout({...ordinary(), [name]:value}), 'LAYOUT_OPTIONS_INVALID');
  for (const crossAlign of [null, 'stretch', 0]) refuses(() => planLinearLayout({...ordinary(), crossAlign}), 'LAYOUT_OPTIONS_INVALID');
  let conversions = 0;
  refuses(() => planLinearLayout({axis:'horizontal', items:[{width:{valueOf(){conversions++; return 1;}}, height:1}]}), 'LAYOUT_OPTIONS_INVALID');
  assert.equal(conversions, 0);
  class Item {get width(){return 2;} get height(){return 3;}}
  class Options {axis = 'horizontal'; items = [new Item()];}
  assert.equal(planLinearLayout(new Options()).width, 2);
});

test('LL10 observed Array length is strict, bounded and authoritative', () => {
  for (const length of [-1, 0.5, NaN, Infinity, undefined, '1', 2**32]) {
    let optionalReads = 0;
    const items = new Proxy([], {get(target,key,receiver){return key === 'length' ? length : Reflect.get(target,key,receiver);}});
    refuses(() => planLinearLayout({axis:'horizontal', items, get gap(){optionalReads++; return 0;}}), 'LAYOUT_OPTIONS_INVALID');
    assert.equal(optionalReads, 0);
  }
  for (const length of [4097, 2**32-1]) {
    let optionalReads = 0;
    const items = new Proxy([], {get(target,key,receiver){return key === 'length' ? length : Reflect.get(target,key,receiver);}});
    refuses(() => planLinearLayout({axis:'horizontal', items, get gap(){optionalReads++; throw undefined;}}), 'LAYOUT_LIMIT');
    assert.equal(optionalReads, 0);
  }
  const empty = new Proxy([{get width(){throw new Error('unvisited');}}], {get(target,key,receiver){return key === 'length' ? 0 : Reflect.get(target,key,receiver);}});
  assert.deepEqual(planLinearLayout({axis:'horizontal', items:empty}), {width:0, height:0, placements:[]});
  const revoked = Proxy.revocable([], {}); revoked.revoke();
  const failure = refuses(() => planLinearLayout({axis:'horizontal', items:revoked.proxy}), 'LAYOUT_OPTIONS_INVALID');
  assert.ok(failure.cause instanceof TypeError);
});

test('LL11 original read failures retain exact causes, including undefined', () => {
  refuses(() => planLinearLayout({get axis(){throw undefined;}}), 'LAYOUT_OPTIONS_INVALID', undefined, true);
  const marker = {original:'length getter'};
  const items = new Proxy([], {get(target,key,receiver){if(key === 'length') throw marker; return Reflect.get(target,key,receiver);}});
  refuses(() => planLinearLayout({axis:'horizontal', items}), 'LAYOUT_OPTIONS_INVALID', marker, true);
  const token = Symbol('height occurrence');
  refuses(() => planLinearLayout({axis:'vertical', items:[{width:1, get height(){throw token;}}]}), 'LAYOUT_OPTIONS_INVALID', token, true);
});

test('LL12 all valid item reads precede arithmetic, while later throwing reads win', () => {
  const trace = [];
  const item = name => ({get width(){trace.push(name+'.width'); return Number.MAX_VALUE;}, get height(){trace.push(name+'.height'); return 0;}});
  refuses(() => planLinearLayout({axis:'horizontal', padding:Number.MAX_VALUE, items:[item('first'), item('second')]}), 'LAYOUT_OVERFLOW');
  assert.deepEqual(trace, ['first.width','first.height','second.width','second.height']);
  let laterHeight = 0;
  refuses(() => planLinearLayout({axis:'horizontal', padding:Number.MAX_VALUE, items:[
    {width:Number.MAX_VALUE, height:0},
    {get width(){throw undefined;}, get height(){laterHeight++; return 0;}},
  ]}), 'LAYOUT_OPTIONS_INVALID', undefined, true);
  assert.equal(laterHeight, 0);
});

test('LL13 main, cross and empty overflow refuse; no trailing gap is evaluated', () => {
  refuses(() => planLinearLayout({axis:'horizontal', items:[{width:Number.MAX_VALUE, height:0}, {width:Number.MAX_VALUE, height:0}]}), 'LAYOUT_OVERFLOW');
  refuses(() => planLinearLayout({axis:'vertical', items:[{width:0, height:Number.MAX_VALUE}, {width:0, height:Number.MAX_VALUE}]}), 'LAYOUT_OVERFLOW');
  refuses(() => planLinearLayout({axis:'horizontal', padding:Number.MAX_VALUE/2, items:[{width:0, height:Number.MAX_VALUE}]}), 'LAYOUT_OVERFLOW');
  refuses(() => planLinearLayout({axis:'horizontal', padding:Number.MAX_VALUE, items:[]}), 'LAYOUT_OVERFLOW');
  assert.deepEqual(planLinearLayout({axis:'horizontal', items:[{width:0, height:1}, {width:0, height:1}], gap:Number.MAX_VALUE}), {
    width:Number.MAX_VALUE, height:1, placements:[
      {index:0, x:0, y:0, width:0, height:1},
      {index:1, x:Number.MAX_VALUE, y:0, width:0, height:1},
    ],
  });
});

test('LL14 independent reentry and captured numbers preserve caller side effects', () => {
  let nested, heightReads = 0;
  const second = {width:1, height:1};
  const first = {width:2, get height() {
    heightReads++;
    first.width = 99; second.width = 5;
    nested = planLinearLayout({axis:'vertical', items:[{width:3, height:4}], padding:1});
    return 1;
  }};
  const result = planLinearLayout({axis:'horizontal', items:[first, second]});
  assert.equal(heightReads, 1);
  assert.equal(first.width, 99); assert.equal(second.width, 5);
  assert.deepEqual(nested, {width:5, height:6, placements:[{index:0, x:1, y:1, width:3, height:4}]});
  assert.deepEqual(result, {width:7, height:1, placements:[
    {index:0, x:0, y:0, width:2, height:1},
    {index:1, x:2, y:0, width:5, height:1},
  ]});
});

test('LL15 fixed upper bound and ordinary indexed Gets observe local array mutations', () => {
  const appended = [{get width(){appended.push({get width(){throw new Error('outside captured length');}, height:1}); return 1;}, height:1}, {width:2, height:1}];
  const result = planLinearLayout({axis:'horizontal', items:appended});
  assert.equal(appended.length, 3);
  assert.equal(result.placements.length, 2); assert.equal(result.width, 3);
  const inherited = new Array(1);
  Object.setPrototypeOf(inherited, Object.assign(Object.create(Array.prototype), {0:{width:2, height:3}}));
  assert.deepEqual(planLinearLayout({axis:'horizontal', items:inherited}), {width:2, height:3, placements:[{index:0, x:0, y:0, width:2, height:3}]});
  const replaced = [{get width(){delete replaced[1]; return 1;}, height:1}, {width:99, height:1}];
  Object.setPrototypeOf(replaced, Object.assign(Object.create(Array.prototype), {1:{width:4, height:1}}));
  assert.equal(planLinearLayout({axis:'horizontal', items:replaced}).width, 5);
  refuses(() => planLinearLayout({axis:'horizontal', items:new Array(1)}), 'LAYOUT_OPTIONS_INVALID');
  const shrunk = [{get width(){shrunk.length = 1; return 1;}, height:1}, {width:2, height:1}];
  refuses(() => planLinearLayout({axis:'horizontal', items:shrunk}), 'LAYOUT_OPTIONS_INVALID');
  assert.equal(shrunk.length, 1);
});


test('LL19 every caller Get retains original thrown identity and stops the suffix', () => {
  const order=['axis','items','length','gap','padding','crossAlign','0','width','height'];
  for(const failing of order) for(const token of [undefined,Symbol(failing)]) {
    const trace=[];
    const get=(name,value)=>{trace.push(name);if(name===failing)throw token;return value;};
    const item={get width(){return get('width',1);},get height(){return get('height',2);}};
    const items=new Proxy([item],{get(target,key,receiver){if(key==='length')return get('length',1);if(key==='0')return get('0',item);return Reflect.get(target,key,receiver);}});
    const options={get axis(){return get('axis','horizontal');},get items(){return get('items',items);},get gap(){return get('gap',0);},get padding(){return get('padding',0);},get crossAlign(){return get('crossAlign','start');}};
    const error=refuses(()=>planLinearLayout(options),'LAYOUT_OPTIONS_INVALID',token,true);
    assert.notEqual(error,token);
    assert.deepEqual(trace,order.slice(0,order.indexOf(failing)+1));
  }
});

test('LL20 inherited records, captured item identity and future slot replacement', () => {
  const original={get width(){items[0]={width:99,height:99};items[1]={width:4,height:5};return 2;},height:3};
  const items=[original,{width:88,height:88}];
  const options=Object.create({axis:'horizontal',items,gap:1,padding:1,crossAlign:'end'});
  assert.deepEqual(planLinearLayout(options),{width:9,height:7,placements:[
    {index:0,x:1,y:3,width:2,height:3},
    {index:1,x:4,y:1,width:4,height:5},
  ]});
  assert.deepEqual(items[0],{width:99,height:99});
  const inheritedItem=Object.create({width:2,height:3});
  assert.equal(planLinearLayout({axis:'vertical',items:[inheritedItem]}).height,3);
});

test('LL21 invalid late scalar beats already captured overflow operands', () => {
  refuses(()=>planLinearLayout({axis:'horizontal',padding:Number.MAX_VALUE,items:[
    {width:Number.MAX_VALUE,height:0},{width:0,height:NaN},
  ]}),'LAYOUT_OPTIONS_INVALID');
  refuses(()=>planLinearLayout({axis:'horizontal',items:[
    {width:Number.MAX_VALUE,height:0},{width:0,height:0},
  ],gap:Number.MAX_VALUE}),'LAYOUT_OVERFLOW');
  refuses(()=>planLinearLayout({axis:'horizontal',items:[{width:Number.MAX_VALUE,height:0}],padding:Number.MAX_VALUE/2}),'LAYOUT_OVERFLOW');
});

test('LL22 observed Proxy length 4096 is admitted without consulting actual length again', () => {
  let lengthReads=0,slots=0;
  const item=Object.freeze({width:0,height:0});
  const items=new Proxy([],{get(target,key,receiver){
    if(key==='length'){lengthReads++;return 4096;}
    if(typeof key==='string' && /^(0|[1-9][0-9]*)$/.test(key)){slots++;return item;}
    throw new Error('unexpected caller access '+String(key));
  }});
  const plan=planLinearLayout({axis:'vertical',items});
  assert.equal(lengthReads,1);assert.equal(slots,4096);
  assert.equal(plan.width,0);assert.equal(plan.height,0);
  assert.deepEqual(plan.placements[4095],{index:4095,x:0,y:0,width:0,height:0});
});

test('LL23 classification failures are wrapped and calls preserve input descriptors', () => {
  const revoked=Proxy.revocable({},{});revoked.revoke();
  const failure=refuses(()=>planLinearLayout(revoked.proxy),'LAYOUT_OPTIONS_INVALID');
  assert.equal(Object.hasOwn(failure,'cause'),true);assert.ok(failure.cause instanceof TypeError);
  const item=Object.freeze({width:2,height:3});
  const array=Object.freeze([item]);const options=Object.freeze({axis:'horizontal',items:array});
  const before=[Object.getOwnPropertyDescriptors(item),Object.getOwnPropertyDescriptors(array),Object.getOwnPropertyDescriptors(options)];
  planLinearLayout(options);
  assert.deepEqual([Object.getOwnPropertyDescriptors(item),Object.getOwnPropertyDescriptors(array),Object.getOwnPropertyDescriptors(options)],before);
});


test('LL24 a genuine caller EgretError receives a fresh wrapper before any later Get', () => {
  const original = new EgretError('CALLER_GETTER_FAILED', {cause: Symbol('caller origin')});
  const trace = [];
  const items = [{
    get width() { trace.push('first.width'); throw original; },
    get height() { trace.push('first.height'); return 1; },
  }, {width: 2, height: 3}];
  Object.defineProperty(items, '1', {get() {
    trace.push('later.slot');
    return {width: 2, height: 3};
  }});
  // A shortcut that rethrows an existing EgretError violates fresh wrapping.
  const outer = refuses(() => planLinearLayout({axis: 'horizontal', items}),
    'LAYOUT_OPTIONS_INVALID', original, true);
  assert.ok(outer instanceof EgretError);
  assert.notEqual(outer, original);
  assert.equal(outer.code, 'LAYOUT_OPTIONS_INVALID');
  assert.equal(outer.cause, original);
  assert.deepEqual(trace, ['first.width']);
});
