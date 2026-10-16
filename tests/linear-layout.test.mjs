// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {planLinearLayout} from '@egret/engine/layout';

test('LL01 literal horizontal and vertical alignment boxes', () => {
  const items = [{width:2, height:3}, {width:4, height:1}];
  // Every expected placement is authored independently of the planner's cursor.
  const cases = [
    ['horizontal', 'start', 10, 5, [[1,1], [5,1]]],
    ['horizontal', 'center', 10, 5, [[1,1], [5,2]]],
    ['horizontal', 'end', 10, 5, [[1,1], [5,3]]],
    ['vertical', 'start', 6, 8, [[1,1], [1,6]]],
    ['vertical', 'center', 6, 8, [[2,1], [1,6]]],
    ['vertical', 'end', 6, 8, [[3,1], [1,6]]],
  ];
  for (const [axis, crossAlign, width, height, xy] of cases) {
    assert.deepEqual(planLinearLayout({axis, items, gap:2, padding:1, crossAlign}), {
      width, height, placements:[
        {index:0, x:xy[0][0], y:xy[0][1], width:2, height:3},
        {index:1, x:xy[1][0], y:xy[1][1], width:4, height:1},
      ],
    });
  }
});

test('LL02 empty padding boxes, one item and undefined-only defaults', () => {
  assert.deepEqual(planLinearLayout({axis:'horizontal', items:[]}), {width:0, height:0, placements:[]});
  assert.deepEqual(planLinearLayout({axis:'vertical', items:[], padding:2, gap:Number.MAX_VALUE}), {width:4, height:4, placements:[]});
  assert.deepEqual(planLinearLayout({axis:'vertical', items:[{width:3, height:5}], padding:2, gap:Number.MAX_VALUE, crossAlign:'end'}), {
    width:7, height:9, placements:[{index:0, x:2, y:2, width:3, height:5}],
  });
  const items = [{width:2, height:3}];
  assert.deepEqual(planLinearLayout({axis:'horizontal', items, gap:undefined, padding:undefined, crossAlign:undefined}), {
    width:2, height:3, placements:[{index:0, x:0, y:0, width:2, height:3}],
  });
});

test('LL03 exact binary fractions and zero-size items', () => {
  assert.deepEqual(planLinearLayout({axis:'horizontal', items:[{width:0.5, height:0.25}, {width:1.25, height:0.75}], gap:0.25, padding:0.125, crossAlign:'center'}), {
    width:2.25, height:1, placements:[
      {index:0, x:0.125, y:0.375, width:0.5, height:0.25},
      {index:1, x:0.875, y:0.125, width:1.25, height:0.75},
    ],
  });
  assert.deepEqual(planLinearLayout({axis:'horizontal', items:[{width:0, height:0}, {width:2, height:0}], gap:1}), {
    width:3, height:0, placements:[
      {index:0, x:0, y:0, width:0, height:0},
      {index:1, x:1, y:0, width:2, height:0},
    ],
  });
});

test('LL04 canonical positive zero never rewrites caller negative zero', () => {
  const item = {width:-0, height:-0};
  const result = planLinearLayout({axis:'vertical', items:[item], padding:-0, gap:-0, crossAlign:'center'});
  assert.equal(Object.is(item.width, -0), true);
  assert.equal(Object.is(item.height, -0), true);
  for (const value of [result.width, result.height, ...Object.values(result.placements[0])]) {
    assert.equal(value, 0);
    assert.equal(Object.is(value, -0), false);
  }
});

test('LL05 fresh deeply frozen output has no input aliases or input freezing', () => {
  const item = {width:2, height:3}, items = [item], options = {axis:'horizontal', items};
  const a = planLinearLayout(options), b = planLinearLayout(options);
  assert.deepEqual(a, b);
  assert.notEqual(a, b); assert.notEqual(a.placements, b.placements);
  assert.notEqual(a.placements[0], b.placements[0]);
  assert.notEqual(a.placements, items); assert.notEqual(a.placements[0], item);
  assert.equal(Object.isFrozen(a), true);
  assert.equal(Object.isFrozen(a.placements), true);
  assert.equal(Object.isFrozen(a.placements[0]), true);
  assert.equal(Object.isFrozen(options), false);
  assert.equal(Object.isFrozen(items), false);
  assert.equal(Object.isFrozen(item), false);
  item.width = 99; items.push({width:8, height:9});
  assert.equal(a.width, 2); assert.equal(a.placements.length, 1);
  assert.equal(a.placements[0].width, 2);
  assert.deepEqual(Object.keys(a).sort(), ['height', 'placements', 'width']);
  assert.deepEqual(Object.keys(a.placements[0]).sort(), ['height', 'index', 'width', 'x', 'y']);
  assert.doesNotThrow(() => planLinearLayout(Object.freeze({axis:'horizontal', items:Object.freeze([Object.freeze({width:1, height:1})])})));
});

test('LL06 the admitted cap is inclusive and preserves source indices', () => {
  const items = Array.from({length:4096}, () => ({width:1, height:2}));
  const result = planLinearLayout({axis:'horizontal', items});
  assert.equal(result.width, 4096); assert.equal(result.height, 2);
  assert.equal(result.placements.length, 4096);
  assert.deepEqual(result.placements[0], {index:0, x:0, y:0, width:1, height:2});
  assert.deepEqual(result.placements[4095], {index:4095, x:4095, y:0, width:1, height:2});
});


test('LL16 independently fixed public-spec examples and receiver independence', () => {
  const items = [{width:8, height:6}, {width:4, height:2}];
  const centered = Reflect.apply(planLinearLayout, null, [{axis:'horizontal', items, gap:2, padding:1, crossAlign:'center'}]);
  assert.deepEqual(centered, {width:16, height:8, placements:[
    {index:0, x:1, y:1, width:8, height:6},
    {index:1, x:11, y:3, width:4, height:2},
  ]});
  assert.deepEqual(Reflect.apply(planLinearLayout, {unrelated:true}, [{axis:'vertical', items, gap:2, padding:1, crossAlign:'end'}]), {
    width:10, height:12, placements:[
      {index:0, x:1, y:1, width:8, height:6},
      {index:1, x:5, y:9, width:4, height:2},
    ],
  });
  assert.deepEqual(planLinearLayout({axis:'horizontal', items:[], padding:3}), {width:6, height:6, placements:[]});
  assert.deepEqual(planLinearLayout({axis:'horizontal', items:[{width:2, height:4}], padding:2}), {
    width:6, height:8, placements:[{index:0, x:2, y:2, width:2, height:4}],
  });
});

test('LL17 binary64 left association and cross-extent grouping remain literal', () => {
  // Reassociating the last two widths would yield 10000000000000002.
  const main = planLinearLayout({axis:'horizontal', items:[{width:1e16,height:1},{width:1,height:1},{width:1,height:1}]});
  assert.equal(main.width, 1e16);
  assert.deepEqual(main.placements.map(row => row.x), [0,1e16,1e16]);
  // (1e16+1)+1 is 1e16; 1e16+(1+1) has a different result.
  const cross = planLinearLayout({axis:'vertical', items:[{width:1e16,height:0}], padding:1});
  assert.equal(cross.width, 1e16);
  assert.equal(cross.height, 2);
});

test('LL18 empty and nonempty immutable results have fresh ordinary identities', () => {
  const first = planLinearLayout({axis:'horizontal',items:[]});
  const second = planLinearLayout({axis:'horizontal',items:[]});
  assert.notEqual(first,second); assert.notEqual(first.placements,second.placements);
  assert.equal(Object.getPrototypeOf(first),Object.prototype);
  assert.equal(Object.isFrozen(first),true); assert.equal(Object.isFrozen(first.placements),true);
  assert.throws(()=>{first.width=1;},TypeError);
  assert.throws(()=>{first.placements.push({index:0,x:0,y:0,width:0,height:0});},TypeError);
  const result=planLinearLayout({axis:'vertical',items:[{width:2,height:3}]});
  assert.equal(Object.getPrototypeOf(result.placements[0]),Object.prototype);
  assert.throws(()=>{result.placements[0].x=99;},TypeError);
});
