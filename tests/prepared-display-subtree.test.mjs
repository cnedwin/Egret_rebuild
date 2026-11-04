// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';import assert from 'node:assert/strict';
import {createEngine,DisplayObjectContainer,Sprite} from '@egret/engine';
import {host} from './helpers.mjs';import {createScene,frameOptions} from '../examples/prepared-subtree/scene.mjs';
const code=c=>e=>e?.code===c;const stale=e=>['DISPLAY_SUBTREE_STALE','DISPLAY_SUBTREE_NODE_INVALID','DISPLAY_SUBTREE_OWNER_CLOSED','OBJECT_DISPOSED'].includes(e?.code);
async function fixture(body){const engine=await createEngine({host:host().adapter});const f=await createScene(engine);try{await body(f);}finally{f.close();await engine.dispose();}}
const shape=frame=>{const {frameId,...rest}=frame;return rest;};
test('candidate captures inherit transforms, clip and ordered Mesh/Bitmap without changing live topology',()=>fixture(f=>{
 const old=f.capture(),ticket=f.prepare(),next=f.engine.capturePreparedDisplaySharedFrame(ticket,frameOptions);
 assert.deepEqual(f.inspect(),{oldDisposed:false,candidateDisposed:false,oldAttached:true,candidateAttached:false,children:1,disposedTextures:0});
 assert.deepEqual(shape(f.capture()),shape(old));assert.ok(Object.isFrozen(next));assert.ok(Object.isFrozen(next.commands));
 const mesh=next.commands.find(c=>c.kind==='mesh');assert.deepEqual(mesh.matrix,{a:2,b:0,c:0,d:2,tx:16,ty:14});assert.equal(mesh.opacity,.5);assert.equal(mesh.clips.length,3);
 assert.deepEqual(next.commands.filter(c=>c.kind!=='barrier').map(c=>c.kind),['mesh','image','rect']);assert.equal(next.commands.at(-2)?.fillColor??next.commands.at(-1)?.fillColor,0x0000ff);
 ticket.commit();assert.deepEqual(shape(f.capture()),shape(next));assert.equal(f.old.parent,undefined);assert.equal(f.candidate.parent,f.target);assert.equal(f.old.isDisposed,false);assert.equal(f.disposals.length,0);
 ticket.dispose();assert.equal(f.candidate.parent,f.target);assert.equal(old.commands.find(c=>c.kind==='rect').fillColor,0xff0000);
 assert.throws(()=>ticket.commit(),code('DISPLAY_SUBTREE_RETIRED'));
}));
test('abort borrows all nodes and resources, retains captures, repeated disposal is inert',()=>fixture(f=>{
 const before=f.capture(),ticket=f.prepare(),next=f.engine.capturePreparedDisplaySharedFrame(ticket,frameOptions);ticket.dispose();ticket.dispose();
 assert.deepEqual(shape(f.capture()),shape(before));assert.equal(next.commands.filter(c=>c.kind==='mesh').length,1);assert.equal(f.candidate.isDisposed,false);assert.equal(f.disposals.length,0);
 assert.throws(()=>f.engine.capturePreparedDisplaySharedFrame(ticket,frameOptions),code('DISPLAY_SUBTREE_RETIRED'));
}));
test('only latest accepted target intent survives; invalid request preserves current candidate',()=>fixture(f=>{
 const first=f.prepare();assert.throws(()=>f.engine.prepareDisplaySubtree(f.ticketScope,f.target,f.old),code('DISPLAY_SUBTREE_ROOT_INVALID'));
 f.engine.capturePreparedDisplaySharedFrame(first,frameOptions);const second=f.prepare();assert.throws(()=>first.commit(),code('DISPLAY_SUBTREE_RETIRED'));first.dispose();second.commit();
}));
for(const [name,change] of [
 ['candidate transform',f=>f.candidate.x++],['ancestor clip',f=>f.parent.clipRect={x:0,y:0,width:1,height:1}],
 ['ancestor alpha',f=>f.parent.alpha=.25],['old content',f=>f.old.graphics.clear()],['candidate binding',f=>f.binding.prepare(f.leases[1],f.geometry).commit()],
 ['candidate child detach',f=>f.candidate.removeChild(f.bitmap)],['candidate reparent',f=>f.parent.addChild(f.candidate)],['target reparent',f=>f.engine.stage.addChild(f.target)],
 ['candidate disposal',f=>f.candidate.dispose()],['owner close',f=>f.newScope.dispose()],['sibling reorder',f=>f.parent.setChildIndex(f.sibling,0)],
])test(name+' refuses stale capture and commit before target publication',()=>fixture(f=>{
 const ticket=f.prepare();change(f);assert.throws(()=>f.engine.capturePreparedDisplaySharedFrame(ticket,frameOptions),stale);assert.throws(()=>ticket.commit(),stale);assert.equal(f.old.parent,f.target);ticket.dispose();
}));
test('released borrowed candidate lease refuses commit',()=>fixture(f=>{const ticket=f.prepare();f.leases[0].release();assert.throws(()=>ticket.commit());assert.equal(f.old.parent,f.target);}));
test('unrelated sibling content can change; the old candidate frame remains a snapshot',()=>fixture(f=>{
 const ticket=f.prepare(),snapshot=f.engine.capturePreparedDisplaySharedFrame(ticket,frameOptions);f.sibling.graphics.clear();f.sibling.graphics.beginFill(0xffffff).drawRect(0,0,3,3).endFill();ticket.commit();
 assert.equal(snapshot.commands.filter(c=>c.kind==='rect')[0].fillColor,0x0000ff);assert.equal(f.capture().commands.filter(c=>c.kind==='rect')[0].fillColor,0xffffff);
}));
test('foreign/forged tickets and scopes, getter facade and undefined are refused',()=>fixture(async f=>{
 const other=await createEngine({host:host().adapter});try{
  const ticket=f.prepare();assert.throws(()=>other.capturePreparedDisplaySharedFrame(ticket,frameOptions),code('DISPLAY_SUBTREE_TICKET_INVALID'));
  for(const input of [undefined,{},new Proxy(f.candidate,{get(){throw Error('must not read facade');}})])assert.throws(()=>f.engine.capturePreparedDisplaySharedFrame(input,frameOptions),code('DISPLAY_SUBTREE_TICKET_INVALID'));
  assert.throws(()=>f.engine.prepareDisplaySubtree(other.createScope(),f.target,f.candidate),code('DISPLAY_SUBTREE_SCOPE_INVALID'));
  assert.throws(()=>f.engine.prepareDisplaySubtree(f.ticketScope,f.target,new Proxy(f.candidate,{get(){throw Error('must not read facade');}})),code('DISPLAY_SUBTREE_NODE_INVALID'));
  assert.throws(()=>ticket.commit.call({}),code('DISPLAY_SUBTREE_TICKET_INVALID'));
 }finally{await other.dispose();}
}));
test('option getter cancellation or mutation cannot authorize a stale candidate',()=>fixture(f=>{
 let ticket=f.prepare();assert.throws(()=>f.engine.capturePreparedDisplaySharedFrame(ticket,{get width(){ticket.dispose();return 64;},height:64}),code('DISPLAY_SUBTREE_RETIRED'));assert.equal(f.old.parent,f.target);
 ticket=f.prepare();assert.throws(()=>f.engine.capturePreparedDisplaySharedFrame(ticket,{get width(){f.candidate.x++;return 64;},height:64}),stale);
}));
test('commit during capture option reentry refuses; scope close revokes only ticket',()=>fixture(f=>{
 const ticket=f.prepare();f.engine.capturePreparedDisplaySharedFrame(ticket,{get width(){assert.throws(()=>ticket.commit(),code('DISPLAY_SUBTREE_REENTRANT'));return 64;},height:64});
 f.ticketScope.dispose();assert.throws(()=>ticket.commit(),code('SCOPE_CLOSED'));assert.equal(f.candidate.isDisposed,false);assert.equal(f.old.parent,f.target);
}));
test('nested pending targets and shared candidate are refused without superseding first',()=>fixture(f=>{
 const ticket=f.prepare(),nested=f.oldScope.use(new DisplayObjectContainer()),next=f.newScope.use(new Sprite());f.old.addChild(nested);
 assert.throws(()=>f.engine.prepareDisplaySubtree(f.ticketScope,nested,next),code('DISPLAY_SUBTREE_OVERLAP'));
 const other=f.oldScope.use(new DisplayObjectContainer());f.parent.addChild(other);assert.throws(()=>f.engine.prepareDisplaySubtree(f.ticketScope,other,f.candidate),code('DISPLAY_SUBTREE_OVERLAP'));ticket.dispose();
}));
test('unrelated 6000-node scene retains existing capture capacity',()=>fixture(f=>{
 for(let i=0;i<6000;i++)f.engine.stage.addChild(f.oldScope.use(new Sprite()));const ticket=f.prepare();assert.ok(f.engine.capturePreparedDisplaySharedFrame(ticket,frameOptions));ticket.commit();
}));
test('affected node and depth limits refuse before publication',()=>fixture(f=>{
 for(let i=0;i<4096;i++)f.candidate.addChild(f.newScope.use(new Sprite()));assert.throws(()=>f.prepare(),code('DISPLAY_SUBTREE_LIMIT'));assert.equal(f.old.parent,f.target);
}));
test('candidate depth 129 is refused',()=>fixture(f=>{
 let current=f.candidate;for(let i=0;i<128;i++){const next=f.newScope.use(new DisplayObjectContainer());current.addChild(next);current=next;}assert.throws(()=>f.prepare(),code('DISPLAY_SUBTREE_LIMIT'));
}));

test('at most 32 pending targets; dispose returns capacity',()=>fixture(f=>{
 const tickets=[];for(let i=0;i<32;i++){const target=f.oldScope.use(new DisplayObjectContainer()),candidate=f.newScope.use(new Sprite());f.engine.stage.addChild(target);tickets.push(f.engine.prepareDisplaySubtree(f.ticketScope,target,candidate));}
 assert.throws(()=>f.prepare(),code('DISPLAY_SUBTREE_LIMIT'));tickets[0].dispose();f.prepare().dispose();for(const ticket of tickets)ticket.dispose();
}));

for(const count of [4094,4095])test('target direct children '+count+' respect the exact combined-root quota',()=>fixture(f=>{
 f.target.removeChildren();const children=[];for(let i=0;i<count;i++){const child=f.oldScope.use(new Sprite());children.push(child);f.target.addChild(child);}const candidate=f.newScope.use(new Sprite());
 if(count===4095){assert.throws(()=>f.engine.prepareDisplaySubtree(f.ticketScope,f.target,candidate),code('DISPLAY_SUBTREE_LIMIT'));assert.equal(f.target.numChildren,count);assert.equal(candidate.parent,undefined);}
 else {const ticket=f.engine.prepareDisplaySubtree(f.ticketScope,f.target,candidate);f.engine.capturePreparedDisplaySharedFrame(ticket,frameOptions);ticket.commit();assert.equal(f.target.numChildren,1);assert.equal(f.target.getChildAt(0),candidate);assert.equal(children[0].parent,undefined);assert.equal(children.at(-1).isDisposed,false);}
}));
test('a new candidate containing an existing pending candidate is rejected',()=>fixture(f=>{
 const other=f.oldScope.use(new DisplayObjectContainer());f.parent.addChild(other);const first=f.prepare(),outer=f.newScope.use(new DisplayObjectContainer());outer.addChild(f.candidate);
 assert.throws(()=>f.engine.prepareDisplaySubtree(f.ticketScope,other,outer),code('DISPLAY_SUBTREE_OVERLAP'));assert.equal(f.old.parent,f.target);assert.equal(other.numChildren,0);assert.equal(outer.parent,undefined);assert.throws(()=>first.commit(),stale);first.dispose();
 const accepted=f.engine.prepareDisplaySubtree(f.ticketScope,other,outer);accepted.commit();assert.equal(other.getChildAt(0),outer);
}));

test('already-bound preparation uses private state rather than fresh subclass hooks or tree getters',()=>fixture(f=>{
 class Guarded extends DisplayObjectContainer { blocked=false; assertUsable(){if(this.blocked)throw Error('custom semantic guard');super.assertUsable();}get parent(){if(this.blocked)throw Error('public parent getter');return super.parent;}get numChildren(){if(this.blocked)throw Error('public child getter');return super.numChildren;}getChildAt(index){if(this.blocked)throw Error('public child method');return super.getChildAt(index);} }
 const candidate=f.newScope.use(new Guarded()),child=f.newScope.use(new Sprite());candidate.addChild(child);candidate.blocked=true;
 try {const ticket=f.engine.prepareDisplaySubtree(f.ticketScope,f.target,candidate);f.engine.capturePreparedDisplaySharedFrame(ticket,frameOptions);ticket.commit();assert.equal(f.target.getChildAt(0),candidate);assert.equal(f.old.parent,undefined);}
 finally {candidate.blocked=false;}
}));
