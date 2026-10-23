// SPDX-License-Identifier: Apache-2.0
// Independent linear-array reference; no private emitted-module imports.
import test from 'node:test';import assert from 'node:assert/strict';
const ui=await import('@egret/runtime/ui').catch(()=>({}));
const records=hs=>hs.map((h,i)=>({key:'k'+i,contentVersion:0,estimatedHeight:h}));
const make=hs=>{assert.equal(typeof ui.UiHeightIndex,'function','built UI height-index assembly is required');return new ui.UiHeightIndex(records(hs),100,1);};
const refuses=code=>e=>e.code===code;
const prefix=(hs,n)=>hs.slice(0,n).reduce((a,b)=>a+b,0);
const locate=(hs,x)=>{if(!hs.length)return -1;let top=0;for(let i=0;i<hs.length;i++){top+=hs[i];if(x<top)return i;}return hs.length-1;};
const range=(hs,s,v,o)=>{s=Math.max(0,Math.min(s,Math.max(0,prefix(hs,hs.length)-v)));if(!hs.length)return {start:0,end:0,visibleStart:0,visibleEnd:0};let start=locate(hs,s),end=start;while(end<hs.length&&prefix(hs,end)<s+v)end++;return {start:Math.max(0,start-o),end:Math.min(hs.length,end+o),visibleStart:start,visibleEnd:end};};
test('empty, exact half-open edges, extremes and small literal ranges',()=>{
 const e=make([]);assert.equal(e.find(0),-1);assert.equal(e.clampScroll(1e300,20),0);assert.equal(e.anchor(0),undefined);assert.deepEqual(e.range(0,20,2),range([],0,20,2));
 const a=make([24,40,64]);for(const x of [-1e300,0,23.9,24,63.9,64,127,128,1e300])assert.equal(a.find(x),locate([24,40,64],x));
 for(const s of [-1e300,0,24,30,64,1e300])assert.deepEqual(a.range(s,40,1),range([24,40,64],s,40,1));assert.equal(a.prefix(3),128);
});
test('sparse journal leaves old index intact, then applies once with logarithmic cell work',()=>{
 const a=make(Array(50000).fill(24));const old=a.totalHeight;const j=a.stageHeights([{key:'k123',height:40,contentVersion:0}]);assert.equal(a.heightAt(123),24);assert.equal(a.totalHeight,old);assert.equal(j.heightAt(123),40);assert.equal(j.totalHeight,old+16);assert.ok(j.cellWork<=32);assert.equal(j.changedCount,1);j.apply();assert.equal(a.heightAt(123),40);assert.equal(a.measuredCount,1);assert.throws(()=>j.apply(),refuses('UI_STALE'));
});
test('batch rejection is atomic and stale version ignored',()=>{
 const a=make([10,20]);for(const updates of [[{key:'missing',height:10,contentVersion:0}],[{key:'k0',height:2,contentVersion:0},{key:'k0',height:3,contentVersion:0}],[{key:'k0',height:0,contentVersion:0}]])assert.throws(()=>a.stageHeights(updates));assert.equal(a.totalHeight,30);
 const j=a.stageHeights([{key:'k0',height:90,contentVersion:1}]);assert.equal(j.changedCount,0);j.apply();assert.equal(a.totalHeight,30);
});
test('height changes preserve anchor offset and shrink clamps within row before final scroll clamp',()=>{
 const a=make([24,40,64,64]);const anchor=a.anchor(34);assert.deepEqual(anchor,{key:'k1',offset:10});let j=a.stageHeights([{key:'k0',height:50,contentVersion:0}]);assert.equal(j.preserveAnchor(anchor,a,20),60);j.apply();
 const b=a.anchor(80);j=a.stageHeights([{key:'k1',height:5,contentVersion:0}]);assert.equal(j.preserveAnchor(b,a,20),55);
});
test('deleted anchor chooses old-order successor, predecessor, new first, then empty',()=>{
 const a=make([10,20,30,40]);const anchor=a.anchor(15);
 for(const [keys,expect] of [[['k3','k2','k0'],40],[['k0'],0],[['z'],0],[[],0]]){const b=new ui.UiHeightIndex(keys.map(key=>({key,contentVersion:0,estimatedHeight:key==='k3'?40:10})),100,1);assert.equal(b.preserveAnchor(anchor,a,1),expect);}
 const b=new ui.UiHeightIndex(['k3','k1','k0','k2'].map(key=>({key,contentVersion:0,estimatedHeight:20})),100,1);assert.equal(b.preserveAnchor(anchor,a,1),25);
});
test('structural/width rebuild reuses measured tuple only for exact key/version/width/density',()=>{
 const a=make([10,20]);a.stageHeights([{key:'k0',height:30,contentVersion:0}]).apply();const b=new ui.UiHeightIndex(records([10,20]).reverse(),100,1,a);assert.equal(b.heightAt(1),30);assert.equal(b.measuredCount,1);
 for(const [width,density] of [[101,1],[100,2]]){const c=new ui.UiHeightIndex(records([10,20]),width,density,a);assert.equal(c.heightAt(0),10);assert.equal(c.measuredCount,0);}const c=new ui.UiHeightIndex([{key:'k0',contentVersion:1,estimatedHeight:5}],100,1,a);assert.equal(c.heightAt(0),5);
});
test('captured records resist mutation; strict numeric/cap/duplicate checks canonicalize zero',()=>{
 const a=make([10]);const rs=records([10]);const b=new ui.UiHeightIndex(rs,100,1);rs[0].estimatedHeight=90;rs[0].key='other';assert.equal(b.heightAt(0),10);assert.equal(b.keyAt(0),'k0');
 for(const n of [NaN,Infinity,'4'])assert.throws(()=>a.clampScroll(n,1),refuses('UI_INVALID'));assert.ok(!Object.is(a.clampScroll(-0,1),-0));
 for(const n of [0,-1,NaN,Infinity,1048577,'1'])assert.throws(()=>make([n]),refuses('UI_INVALID'));assert.throws(()=>make(Array(50001).fill(1)),refuses('UI_LIMIT'));
 assert.throws(()=>new ui.UiHeightIndex([{key:'x',contentVersion:0,estimatedHeight:1},{key:'x',contentVersion:0,estimatedHeight:1}],100,1),refuses('UI_DUPLICATE_KEY'));assert.throws(()=>a.range(0,1,33),refuses('UI_INVALID'));
});
test('50000 deterministic records and point/structure mutations match independent sampled arrays',()=>{
 const hs=Array.from({length:50000},(_,i)=>[24,40,64][(i*17)%3]);const a=make(hs);for(let i=0;i<100;i++){const k=(i*493)%hs.length;const h=1+(i*31)%100;const j=a.stageHeights([{key:'k'+k,height:h,contentVersion:0}]);hs[k]=h;for(const n of [0,k,k+1,hs.length])assert.equal(j.prefix(n),prefix(hs,n));j.apply();}
 for(let i=0;i<100;i++){const s=i*19131.25;assert.equal(a.find(s),locate(hs,s));assert.deepEqual(a.range(s,480,2),range(hs,s,480,2));}
 const rs=records(hs).reverse();const b=new ui.UiHeightIndex(rs,100,1,a);const rev=hs.slice().reverse();for(const n of [0,1,2222,49999,50000])assert.equal(b.prefix(n),prefix(rev,n));assert.equal(b.size,50000);assert.ok(b.logicalBytes>50000*16);
});

test('caller array growth during first entry read cannot expand the captured record bound',()=>{
 const rs=[{key:'a',contentVersion:0,estimatedHeight:10}];const first=rs[0];Object.defineProperty(rs,0,{get(){rs.push({key:'b',contentVersion:0,estimatedHeight:20});return first;}});
 const a=new ui.UiHeightIndex(rs,100,1);assert.equal(a.size,1);assert.equal(a.totalHeight,10);
});

test('Proxy record length is captured exactly once for admission, allocation and traversal',()=>{
 let reads=0,entries=0;const rs=new Proxy([],{get(_target,property){if(property==='length')return ++reads===1?1:50001;entries++;return {key:'p'+property,contentVersion:0,estimatedHeight:10};}});
 const a=new ui.UiHeightIndex(rs,100,1);assert.equal(reads,1);assert.equal(entries,1);assert.equal(a.size,1);assert.equal(a.totalHeight,10);
});
test('Proxy height-update length is captured exactly once and cannot expand candidate updates',()=>{
 const a=make([10,20]);let reads=0,entries=0;const updates=new Proxy([],{get(_target,property){if(property==='length')return ++reads===1?1:50001;entries++;return {key:'k'+property,contentVersion:0,height:40};}});
 const j=a.stageHeights(updates);assert.equal(reads,1);assert.equal(entries,1);assert.equal(j.changedCount,1);assert.equal(a.totalHeight,30);j.apply();assert.equal(a.totalHeight,60);assert.equal(a.heightAt(1),20);
});
test('captured Proxy record/update length must be a finite integer within the hard cap',()=>{
 const a=make([10]);for(const value of [-1,0.5,NaN,Infinity,'1',50001]){let reads=0,entries=0;const makeProxy=()=>new Proxy([],{get(_target,p){if(p==='length'){reads++;return value;}entries++;return {key:'k0',contentVersion:0,estimatedHeight:10,height:20};}});const code=value===50001?'UI_LIMIT':'UI_INVALID';
  assert.throws(()=>new ui.UiHeightIndex(makeProxy(),100,1),refuses(code));assert.equal(reads,1);assert.equal(entries,0);reads=0;assert.throws(()=>a.stageHeights(makeProxy()),refuses(code));assert.equal(reads,1);assert.equal(entries,0);assert.equal(a.totalHeight,10);
 }
});
