// SPDX-License-Identifier: Apache-2.0
// Numeric assembly units only; public UiRoot integration is tested separately.
import test from 'node:test';
import assert from 'node:assert/strict';
const ui = await import('@egret/runtime/ui').catch(() => ({}));
const ready = () => { assert.equal(typeof ui.captureUiLayout, 'function', 'built UI layout assembly is required'); assert.equal(typeof ui.planUiLayout, 'function'); };
const leaf = (id,w,h,extra={}) => ({id,kind:'leaf',measure:()=>({width:w,height:h,dependencyRevision:0}),...extra});
const plan = (node, previous, dirty) => {ready();return ui.planUiLayout(ui.captureUiLayout(node),{width:200,height:100},1,previous,dirty);};
const refuses = code => e => e.code === code;
test('literal column boxes and centered row agree with hand-authored coordinates',()=>{
 const p=plan({id:'root',kind:'column',explicitWidth:100,padding:5,gap:3,children:[leaf('a',20,10),{id:'r',kind:'row',explicitWidth:90,explicitHeight:30,gap:4,crossAlign:'center',children:[leaf('b',10,10),leaf('c',20,20)]}]});
 assert.deepEqual(p.boxes.map(b=>[b.id,b.x,b.y,b.width,b.height]),[['root',0,0,100,53],['a',5,5,20,10],['r',5,18,90,30],['b',5,28,10,10],['c',19,23,20,20]]);
 assert.equal(p.measurementCalls,3);assert.ok(Object.isFrozen(p.boxes));assert.ok(Object.isFrozen(p.boxes[0]));
});
test('copied descriptors and callback snapshot do not follow caller mutation',()=>{
 ready();let seen;const n=leaf('a',10,12,{measure:a=>{seen=a;return {width:10,height:12,dependencyRevision:2};}});const t=ui.captureUiLayout(n);n.explicitWidth=90;
 const p=ui.planUiLayout(t,{width:200,height:100},1);assert.equal(p.boxes[0].width,10);assert.deepEqual(seen,{availableWidth:200,availableHeight:100,density:1});assert.ok(Object.isFrozen(seen));
});
test('unchanged, paint, interaction and arrange invalidations reuse measurement',()=>{
 ready();let calls=0;const n=leaf('a',10,10,{measure:()=>{calls++;return {width:10,height:10,dependencyRevision:0};}});const t=ui.captureUiLayout(n);let p=ui.planUiLayout(t,{width:200,height:100},1);
 for(const kind of [undefined,'paint','interaction','semantic','arrange']){p=ui.planUiLayout(t,{width:200,height:100},1,p,kind?new Map([['a',kind]]):undefined);assert.equal(p.measurementCalls,0);assert.equal(p.reusedMeasurements,1);}assert.equal(calls,1);
});
test('one dirty leaf measures once and unchanged sibling reuses; width change invalidates descendants',()=>{
 ready();let a=0,b=0;const t=ui.captureUiLayout({id:'r',kind:'column',explicitWidth:100,children:[leaf('a',10,10,{measure:()=>({width:10,height:++a,dependencyRevision:a})}),leaf('b',10,10,{measure:()=>({width:10,height:++b,dependencyRevision:b})})]});
 let p=ui.planUiLayout(t,{width:200,height:100},1);p=ui.planUiLayout(t,{width:200,height:100},1,p,new Map([['a','measure']]));assert.equal(a,2);assert.equal(b,1);assert.equal(p.boxes[0].height,3);
 const t2=ui.captureUiLayout({...t.root,explicitWidth:120});ui.planUiLayout(t2,{width:200,height:100},1,p);assert.equal(a,3);assert.equal(b,2);
});
test('explicit axes skip corresponding intrinsic output and clamp intrinsic sizes',()=>{
 const p=plan(leaf('a',100,40,{explicitWidth:30,minHeight:50,maxHeight:60}));assert.deepEqual([p.boxes[0].width,p.boxes[0].height],[30,50]);
});
test('stretch uses definite parent cross size and intrinsic stretch cycle refuses',()=>{
 const p=plan({id:'r',kind:'column',explicitWidth:100,padding:5,crossAlign:'stretch',children:[leaf('a',10,10)]});assert.equal(p.boxes[1].width,90);
 assert.throws(()=>plan({id:'r',kind:'column',crossAlign:'stretch',children:[leaf('a',10,10)]}),refuses('UI_LAYOUT_CYCLE'));
});
test('strict numeric, unknown keys, duplicate ids/identity, cycles and list spacing refuse',()=>{
 ready();for(const x of [NaN,Infinity,-1,'2'])assert.throws(()=>plan(leaf('a',10,10,{explicitWidth:x})),refuses('UI_INVALID'));
 assert.throws(()=>plan(leaf('a',10,10,{minWidth:20,maxWidth:10})),refuses('UI_INVALID'));assert.throws(()=>plan(leaf('a',10,10,{explicitWidth:9,minWidth:10})),refuses('UI_INVALID'));
 assert.throws(()=>plan({...leaf('a',1,1),flex:1}),refuses('UI_INVALID'));const a=leaf('a',1,1);assert.throws(()=>plan({id:'r',kind:'row',children:[a,a]}),refuses('UI_LAYOUT_CYCLE'));
 assert.throws(()=>plan({id:'r',kind:'row',children:[a,leaf('a',1,1)]}),refuses('UI_DUPLICATE_ID'));const r={id:'r',kind:'row',children:[]};r.children.push(r);assert.throws(()=>plan(r),refuses('UI_LAYOUT_CYCLE'));
 assert.throws(()=>plan({id:'l',kind:'virtualList',explicitWidth:50,explicitHeight:50,padding:1,source:{}}),refuses('UI_INVALID'));
});
test('caps, list count, bad measurement, signed zero and deterministic callback order',()=>{
 ready();assert.throws(()=>ui.captureUiLayout({id:'r',kind:'row',children:Array.from({length:4096},(_,i)=>leaf('x'+i,1,1))}),refuses('UI_LIMIT'));
 let deep=leaf('a',1,1);for(let i=0;i<64;i++)deep={id:'p'+i,kind:'column',children:[deep]};assert.throws(()=>ui.captureUiLayout(deep),refuses('UI_LIMIT'));
 assert.throws(()=>plan({id:'r',kind:'row',children:[0,1].map(i=>({id:'l'+i,kind:'virtualList',explicitWidth:20,explicitHeight:20,source:{}}))}),refuses('UI_LIMIT'));
 assert.throws(()=>plan(leaf('a',Infinity,1)),refuses('UI_INVALID'));const p=plan(leaf('a',-0,-0));assert.ok(!Object.is(p.boxes[0].width,-0));
 const order=[];plan({id:'r',kind:'column',children:['a','b'].map(id=>leaf(id,1,1,{measure:()=>{order.push(id);return {width:1,height:1,dependencyRevision:0};}}))});assert.deepEqual(order,['a','b']);
});

test('caller child-array growth during first entry read cannot expand captured topology',()=>{
 const children=[leaf('a',1,1)];const first=children[0];Object.defineProperty(children,0,{get(){children.push(leaf('b',1,1));return first;}});
 const p=plan({id:'r',kind:'column',children});assert.deepEqual(p.boxes.map(b=>b.id),['r','a']);
});

test('leaving stretch restores cached intrinsic size; skipped intrinsic callback runs when first needed',()=>{
 ready();let calls=0;const child=leaf('a',10,10,{measure:()=>{calls++;return {width:10,height:10,dependencyRevision:0};}});
 const base={id:'r',kind:'column',explicitWidth:100,explicitHeight:100,children:[child]};const stretch=ui.captureUiLayout({...base,crossAlign:'stretch'}),start=ui.captureUiLayout({...base,crossAlign:'start'});
 const p=ui.planUiLayout(stretch,{width:200,height:100},1),q=ui.planUiLayout(start,{width:200,height:100},1,p);assert.equal(q.boxes[1].width,10);assert.equal(calls,1);
 let measured=0;const explicit=leaf('b',20,10,{explicitHeight:10,measure:()=>{measured++;return {width:20,height:10,dependencyRevision:0};}});const fixed={...base,children:[explicit]};
 const s=ui.planUiLayout(ui.captureUiLayout({...fixed,crossAlign:'stretch'}),{width:200,height:100},1);assert.equal(measured,0);
 const t=ui.planUiLayout(ui.captureUiLayout({...fixed,crossAlign:'start'}),{width:200,height:100},1,s);assert.equal(t.boxes[1].width,20);assert.equal(measured,1);
});

test('Proxy child length is captured once before topology traversal',()=>{
 ready();let reads=0,entries=0;const children=new Proxy([],{get(_target,p){if(p==='length')return ++reads===1?1:4097;entries++;return leaf('p'+p,1,1);}});
 const p=plan({id:'r',kind:'column',children});assert.equal(reads,1);assert.equal(entries,1);assert.deepEqual(p.boxes.map(b=>b.id),['r','p0']);
});
test('captured Proxy child length rejects noninteger or invalid bounds before entry reads',()=>{
 ready();for(const value of [-1,0.5,NaN,Infinity,'1',4097]){let reads=0,entries=0;const children=new Proxy([],{get(_target,p){if(p==='length'){reads++;return value;}entries++;return leaf('p'+p,1,1);}});assert.throws(()=>plan({id:'r',kind:'column',children}),refuses(value===4097?'UI_LIMIT':'UI_INVALID'));assert.equal(reads,1);assert.equal(entries,0);}
});
