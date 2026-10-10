import test from 'node:test';
import assert from 'node:assert/strict';
import * as egret from '@egret/engine';
import {host} from './helpers.mjs';

// Public logical content-bounds regressions with independently reviewed literals.
// All geometry expectations below are independent literals from the reviewed
// contract. No private runtime, production transform, inverse or bounds oracle.
const FRAME={width:64,height:64};
const MAX=Number.MAX_VALUE,TWO53=9007199254740992;
let assetId=0;

function capability(){
  // Check facade initialization before missing-API RED and before allocations.
  assert.equal(typeof egret.Bitmap,'function','public facade Bitmap must load');
  assert.equal(typeof egret.DisplayObject,'function','public DisplayObject facade');
  const method=egret.DisplayObject.prototype.getBounds;
  assert.equal(typeof method,'function','public DisplayObject.getBounds capability');
  return method;
}
function bounds(node,...args){return Reflect.apply(capability(),node,args);}
function code(run,want,...expectedCause){
  let didThrow=false,error;
  try{run();}catch(value){didThrow=true;error=value;}
  assert.equal(didThrow,true,'operation must throw, including throw undefined');
  assert.ok(error instanceof egret.EgretError,'public structured EgretError');
  assert.equal(error.code,want);
  // Presence of a rest argument distinguishes supplied undefined from omission.
  if(expectedCause.length){assert.equal(expectedCause.length,1);assert.equal(error.cause,expectedCause[0]);}
  return error;
}
function owned(value){
  assert.deepEqual(Reflect.ownKeys(value).sort(),['height','width','x','y']);
  assert.ok(Object.isFrozen(value),'caller-owned frozen bounds');
  for(const key of ['x','y','width','height']){
    assert.equal(typeof value[key],'number');assert.ok(Number.isFinite(value[key]));
    assert.equal(Object.is(value[key],-0),false,'positive-zero normalization');
  }
  return value;
}
function rectangle(value,x,y,width,height){owned(value);assert.deepEqual(value,{x,y,width,height});return value;}
function near(value,x,y,width,height){
  owned(value);
  for(const [key,want] of [['x',x],['y',y],['width',width],['height',height]]){
    assert.ok(Math.abs(value[key]-want)<=1e-10,`${key} near independent ideal ${want}`);
  }
  return value;
}
function rect(node,x,y,width,height,alpha=1){node.graphics.beginFill(0x336699,alpha).drawRect(x,y,width,height);return node;}
async function withEngine(run,overrides={}){
  const port=host(overrides),diagnostics=[];
  const engine=await egret.createEngine({host:port.adapter,onDiagnostic:value=>diagnostics.push(value)});
  try{return await run(engine,port,diagnostics);}finally{await engine.dispose();}
}
async function withBitmap(run){
  return withEngine(async(engine,port,diagnostics)=>{
    const image=egret.createImageData2D({width:8,height:9,pixels:new Uint8Array(288)});
    const texture=egret.createTexture(image);let loads=0,disposals=0,lease,bitmap;
    try{
      const type=egret.createAssetType('bounds-atlas',egret.isTexture);
      engine.assets.register(type,{load:async()=>{loads++;return texture;},dispose:value=>{disposals++;value.dispose();}});
      const ref=egret.createAssetRef(type,`bounds-${++assetId}`);lease=await engine.assets.acquire(ref);
      bitmap=new egret.Bitmap(lease);bitmap.sourceRect={x:2,y:3,width:4,height:5};engine.stage.addChild(bitmap);
      return await run({engine,port,diagnostics,image,texture,lease,bitmap,ref,counts:()=>({loads,disposals})});
    }finally{bitmap?.dispose();lease?.release();texture.dispose();}
  });
}

// B01: inherited surface, exact readonly shape and independent saved ownership.
test('B01 public getBounds returns distinct frozen owned rectangles',()=>{
  const method=capability();
  for(const Constructor of [egret.DisplayObjectContainer,egret.Sprite,egret.Bitmap,egret.Stage]){
    assert.equal(typeof Constructor,'function');assert.equal(Constructor.prototype.getBounds,method);
  }
  assert.equal(Object.hasOwn(egret,'BoundsQueryOptions'),false,'type-only options export');
  const node=new egret.Sprite();
  try{
    rect(node,-0,-0,2,3);const options=Object.freeze({maxNodes:1,maxPrimitives:1});
    const first=rectangle(bounds(node,options),0,0,2,3),second=rectangle(bounds(node,options),0,0,2,3);
    assert.notEqual(first,second);assert.throws(()=>{first.width=99;},TypeError);
    node.graphics.clear();rect(node,20,30,1,1);node.dispose();rectangle(first,0,0,2,3);
  }finally{node.dispose();}
});

// B02: the receiver and ancestors are excluded, including singular bound nodes.
test('B02 receiver-local geometry excludes own ancestor and Stage transforms',async()=>{
  capability();const ancestor=new egret.Sprite(),receiver=new egret.Sprite(),other=new egret.Sprite();
  try{
    rect(receiver,-2,3,4,5);receiver.x=MAX;receiver.y=-MAX;receiver.rotation=45;receiver.scaleX=0;receiver.scaleY=0;
    ancestor.scaleX=MAX;ancestor.scaleY=MAX;ancestor.addChild(receiver);
    rectangle(bounds(receiver),-2,3,4,5);ancestor.removeChild(receiver);rectangle(bounds(receiver),-2,3,4,5);
    other.x=99;other.rotation=-45;other.addChild(receiver);rectangle(bounds(receiver),-2,3,4,5);
    other.removeChild(receiver);
    await withEngine(async engine=>{
      engine.stage.x=100;engine.stage.y=-80;engine.stage.rotation=45;engine.stage.scaleX=0;
      engine.stage.addChild(receiver);rectangle(bounds(receiver),-2,3,4,5);engine.stage.removeChild(receiver);
      const child=new egret.Sprite();rect(child,0,0,2,3);child.x=7;child.y=9;engine.stage.addChild(child);
      rectangle(bounds(engine.stage),7,9,2,3);rectangle(bounds(child),0,0,2,3);
    });
  }finally{receiver.dispose();ancestor.dispose();other.dispose();}
});

// B03: literal reflected child corners and root geometry share one exact union.
test('B03 own and child rectangles union without origin seeding',()=>{
  capability();const root=new egret.Sprite(),child=new egret.Sprite();
  try{
    rect(root,1,2,3,4);rect(child,0,0,2,1);child.x=10;child.y=-3;child.scaleX=-2;child.scaleY=3;root.addChild(child);
    rectangle(bounds(root),1,-3,9,9);
  }finally{child.dispose();root.dispose();}
});

// B04: authored zero area is skipped, while transformed point/line content stays.
test('B04 zero-area empty and degenerate positive contributors stay distinct',()=>{
  capability();const root=new egret.Sprite(),child=new egret.Sprite();
  try{
    rect(root,10,20,2,3);rectangle(bounds(root),10,20,2,3);root.graphics.clear();
    rect(root,100,200,0,5);const empty=rectangle(bounds(root),0,0,0,0);
    assert.notEqual(empty,bounds(root));root.graphics.clear();
    rect(child,0,0,2,3);child.x=7;child.y=9;child.scaleX=0;child.scaleY=0;root.addChild(child);
    const point=rectangle(bounds(root),7,9,0,0);child.scaleX=2;rectangle(bounds(root),7,9,4,0);
    child.dispose();rectangle(point,7,9,0,0);
  }finally{child.dispose();root.dispose();}
});

// B05: noncommuting rotations/nonuniform scale produce the independently ideal
// relative matrix [[1.5,.5],[.5,1.5]]; only this trig fixture uses 1e-10 tolerance.
test('B05 parent-times-local transforms preserve noncommuting literal geometry',()=>{
  capability();const root=new egret.Sprite(),parent=new egret.Sprite(),child=new egret.Sprite();
  try{
    parent.rotation=45;parent.scaleX=2;parent.scaleY=1;child.rotation=-45;rect(child,0,0,2,1);
    parent.addChild(child);root.addChild(parent);near(bounds(root),0,0,3.5,2.5);
  }finally{child.dispose();parent.dispose();root.dispose();}
});

// B06: +45/-45 cancel before direct primitive corners. Transforming an aggregate
// child AABB would instead give ideal (-.5,-1,3,3), which this literal rejects.
test('B06 direct primitive corners avoid child aggregate AABB inflation',()=>{
  capability();const root=new egret.Sprite(),parent=new egret.Sprite(),child=new egret.Sprite();
  try{
    parent.rotation=45;child.rotation=-45;rect(child,0,0,2,1);parent.addChild(child);root.addChild(parent);
    near(bounds(root),0,0,2,1);
  }finally{child.dispose();parent.dispose();root.dispose();}
});

// B07: content is logical, and queries do not capture frames or call the host.
test('B07 visibility alpha clipping and host state do not filter logical bounds',async()=>{
  capability();let draws=0;
  await withEngine(async(engine,port,diagnostics)=>{
    const ancestor=new egret.Sprite(),root=new egret.Sprite();rect(root,10,20,2,3,0);
    ancestor.visible=false;ancestor.alpha=0;ancestor.clipRect={x:0,y:0,width:0,height:0};
    root.visible=false;root.alpha=0;root.clipRect={x:0,y:0,width:0,height:0};ancestor.addChild(root);engine.stage.addChild(ancestor);
    const before=engine.captureFrame(FRAME),trace=[...port.trace],timers=port.timers.size;
    for(let index=0;index<3;index++)rectangle(bounds(root),10,20,2,3);
    rectangle(bounds(ancestor),10,20,2,3);const after=engine.captureFrame(FRAME);
    assert.equal(after.frameId,before.frameId+1,'queries consume no frame identifiers');assert.equal(draws,0);
    assert.deepEqual(port.trace,trace);assert.equal(port.timers.size,timers);assert.deepEqual(diagnostics,[]);
    assert.equal(root.parent,ancestor);assert.equal(ancestor.parent,engine.stage);
  },{renderFrame(){draws++;}});
});

// B08: crop origin is not content origin; retired pixels cannot erase metadata or
// be revived by measurement. Saved rectangles outlive clear/dispose/Engine close.
test('B08 Bitmap cached crop geometry survives lease retirement and clearing',async()=>{
  capability();await withBitmap(async f=>{
    const saved=rectangle(bounds(f.bitmap),0,0,4,5);assert.equal(f.bitmap.textureLease,f.lease);
    assert.deepEqual(f.counts(),{loads:1,disposals:0});f.lease.release();f.texture.dispose();
    rectangle(bounds(f.bitmap),0,0,4,5);assert.deepEqual(f.counts(),{loads:1,disposals:1});
    code(()=>f.lease.value,'ASSET_LEASE_RELEASED');assert.equal(f.bitmap.textureLease,f.lease);
    f.bitmap.textureLease=undefined;rectangle(bounds(f.bitmap),0,0,0,0);
    assert.deepEqual(f.counts(),{loads:1,disposals:1});f.engine.stage.removeChild(f.bitmap);await f.engine.dispose();
    code(()=>bounds(f.bitmap),'ENGINE_CLOSED');f.bitmap.dispose();let reads=0;
    code(()=>bounds(f.bitmap,{get maxNodes(){reads++;return 1;}}),'OBJECT_DISPOSED');assert.equal(reads,0);
    rectangle(saved,0,0,4,5);
  });
});

// B09: finite authored fields may overflow endpoints; zero height skips that
// arithmetic but still consumes a primitive unit. Vertical overflow is distinct.
test('B09 endpoint overflow rejects only positive authored geometry',()=>{
  capability();const root=new egret.Sprite();
  try{
    rect(root,MAX,0,MAX,0);rectangle(bounds(root,{maxPrimitives:1}),0,0,0,0);
    rect(root,MAX,0,MAX,1);code(()=>bounds(root,{maxPrimitives:1}),'BOUNDS_CONTENT_LIMIT');root.graphics.clear();
    rect(root,MAX,0,MAX,1);code(()=>bounds(root),'BOUNDS_ARITHMETIC_RANGE');root.graphics.clear();
    rect(root,0,MAX,1,MAX);code(()=>bounds(root),'BOUNDS_ARITHMETIC_RANGE');
  }finally{root.dispose();}
});

// B10: descendant matrices precede their content budget, root content precedes
// children, and child admission precedes any child geometry. Empty nodes count.
test('B10 finite matrix corner and traversal failure stages keep their order',()=>{
  capability();const root=new egret.Sprite(),parent=new egret.Sprite(),child=new egret.Sprite();
  try{
    parent.scaleX=MAX;child.scaleX=2;parent.addChild(child);root.addChild(parent);
    code(()=>bounds(root),'BOUNDS_ARITHMETIC_RANGE');
  }finally{child.dispose();parent.dispose();root.dispose();}
  const receiver=new egret.Sprite(),descendant=new egret.Sprite(),grandchild=new egret.Sprite();
  try{
    rect(receiver,0,0,1,1);descendant.scaleX=MAX;grandchild.scaleX=2;rect(grandchild,0,0,1,1);
    descendant.addChild(grandchild);receiver.addChild(descendant);
    code(()=>bounds(receiver,{maxPrimitives:1}),'BOUNDS_ARITHMETIC_RANGE');
    grandchild.scaleX=1;code(()=>bounds(receiver,{maxPrimitives:1}),'BOUNDS_CONTENT_LIMIT');
    grandchild.scaleX=2;code(()=>bounds(receiver,{maxNodes:1}),'BOUNDS_TREE_LIMIT');
    receiver.graphics.clear();rect(receiver,MAX,0,MAX,1);code(()=>bounds(receiver,{maxNodes:1}),'BOUNDS_ARITHMETIC_RANGE');
  }finally{grandchild.dispose();descendant.dispose();receiver.dispose();}
  const local=new egret.Sprite(),corner=new egret.Sprite(),ancestor=new egret.Sprite();
  try{
    corner.scaleX=2;rect(corner,0,0,MAX,1);local.addChild(corner);code(()=>bounds(local),'BOUNDS_ARITHMETIC_RANGE');
    corner.dispose();rect(local,1,2,3,4);local.scaleX=2;ancestor.scaleX=MAX;ancestor.addChild(local);
    rectangle(bounds(local),1,2,3,4);
  }finally{corner.dispose();local.dispose();ancestor.dispose();}
  const ordered=new egret.Sprite(),first=new egret.Sprite(),nested=new egret.Sprite(),second=new egret.Sprite();
  try{
    // DFS reaches the first child's poisoned primitive before the second child.
    // Reordering the siblings consumes the only item first, so content limit wins
    // before that poisoned primitive's geometry is accessed.
    rect(nested,MAX,0,MAX,1);first.addChild(nested);rect(second,0,0,1,1);ordered.addChild(first);ordered.addChild(second);
    code(()=>bounds(ordered,{maxPrimitives:1}),'BOUNDS_ARITHMETIC_RANGE');
    ordered.setChildIndex(second,0);code(()=>bounds(ordered,{maxPrimitives:1}),'BOUNDS_CONTENT_LIMIT');
  }finally{nested.dispose();first.dispose();second.dispose();ordered.dispose();}
});

// B11: independently finite endpoints/corners can still overflow final extents.
test('B11 final width and height subtraction are checked after union',()=>{
  capability();const root=new egret.Sprite();
  try{
    rect(root,-MAX,0,MAX,1);rect(root,0,0,MAX,1);code(()=>bounds(root),'BOUNDS_ARITHMETIC_RANGE');root.graphics.clear();
    rect(root,0,-MAX,1,MAX);rect(root,0,0,1,MAX);code(()=>bounds(root),'BOUNDS_ARITHMETIC_RANGE');
  }finally{root.dispose();}
});

// B12: ordinary finite underflow and loss of the unit at 2^53 are accepted.
test('B12 finite rounding collapse retains independently literal position',()=>{
  capability();const root=new egret.Sprite(),child=new egret.Sprite();
  try{
    child.scaleX=2**-600;rect(child,0,2,Number.MIN_VALUE,3);root.addChild(child);rectangle(bounds(root),0,2,0,3);
    child.graphics.clear();child.scaleX=1;child.scaleY=0;child.x=TWO53;rect(child,0,0,1,1);
    rectangle(bounds(root),TWO53,0,0,0);
  }finally{child.dispose();root.dispose();}
});

// B13: exact difference 2^53+1 ties to even width 2^53. No outward enclosure or
// reconstructed-right equality is promised by the reviewed binary64 contract.
test('B13 ordinary subtraction follows the explicit non-enclosure boundary',()=>{
  capability();const root=new egret.Sprite();
  try{rect(root,1,0,1,1);rect(root,TWO53,0,2,1);rectangle(bounds(root),1,0,TWO53,1);}
  finally{root.dispose();}
});

// B14: receiver authentication, narrow options admission, ordered reads and exact
// supplied causes—including undefined—precede successful-read lifetime/semantics.
test('B14 ordered option faults preserve exact causes and lifetime priority',async()=>{
  capability();const root=new egret.Sprite();
  try{
    let receiverReads=0,optionReads=0;const options={get maxNodes(){optionReads++;throw Error('unread options');}};
    const proxy=new Proxy(root,{get(){receiverReads++;throw Error('unread receiver');}}),forged=Object.create(egret.DisplayObject.prototype);
    const revokedReceiver=Proxy.revocable(root,{});revokedReceiver.revoke();
    for(const receiver of [undefined,null,1,{},forged,proxy,revokedReceiver.proxy])code(()=>bounds(receiver,options),'BOUNDS_RECEIVER_INVALID');
    assert.equal(receiverReads,0);assert.equal(optionReads,0);
    for(const value of [null,[],1,'x',true,1n,Symbol('options'),()=>{}])code(()=>bounds(root,value),'BOUNDS_INPUT_INVALID');
    const causes=[{sentinel:true},null,undefined,new egret.EgretError('OBJECT_DISPOSED')];
    for(const cause of causes){
      const trace=[];code(()=>bounds(root,{get maxNodes(){trace.push('maxNodes');return 0;},get maxPrimitives(){trace.push('maxPrimitives');throw cause;}}),'BOUNDS_INPUT_INVALID',cause);
      assert.deepEqual(trace,['maxNodes','maxPrimitives']);
      const first=[];code(()=>bounds(root,{get maxNodes(){first.push('maxNodes');throw cause;},get maxPrimitives(){first.push('maxPrimitives');return 1;}}),'BOUNDS_INPUT_INVALID',cause);
      assert.deepEqual(first,['maxNodes']);
    }
    let revokedReads=0;const revoked=Proxy.revocable({get maxNodes(){revokedReads++;return 1;}},{get(){revokedReads++;throw Error('revoked get trap');}});revoked.revoke();
    const admission=code(()=>bounds(root,revoked.proxy),'BOUNDS_INPUT_INVALID');assert.ok(admission.cause instanceof TypeError);assert.equal(revokedReads,0);
    const trace=[],inherited={get maxNodes(){trace.push('maxNodes');return 1;},get maxPrimitives(){trace.push('maxPrimitives');return 1;}};
    const input=Object.create(inherited);Object.defineProperty(input,'unknown',{get(){throw Error('unknown field read');}});
    Object.defineProperty(input,'x',{get(){throw Error('legacy output field read');}});
    rectangle(bounds(root,input),0,0,0,0);assert.deepEqual(trace,['maxNodes','maxPrimitives']);
    let probes=0;const guarded=new Proxy({maxNodes:1,maxPrimitives:1},{ownKeys(){probes++;throw Error('enumeration');},getPrototypeOf(){probes++;throw Error('prototype probe');}});
    rectangle(bounds(root,guarded),0,0,0,0);assert.equal(probes,0);
  }finally{root.dispose();}
  for(const cause of [undefined,{disposedThenThrow:true}]){
    const node=new egret.Sprite(),trace=[];
    try{code(()=>bounds(node,{get maxNodes(){trace.push('maxNodes');node.dispose();return 1;},get maxPrimitives(){trace.push('maxPrimitives');throw cause;}}),'BOUNDS_INPUT_INVALID',cause);assert.deepEqual(trace,['maxNodes','maxPrimitives']);}
    finally{node.dispose();}
  }
  const disposed=new egret.Sprite(),trace=[];
  try{code(()=>bounds(disposed,{get maxNodes(){trace.push('maxNodes');disposed.dispose();return 0;},get maxPrimitives(){trace.push('maxPrimitives');return 0;}}),'OBJECT_DISPOSED');assert.deepEqual(trace,['maxNodes','maxPrimitives']);}
  finally{disposed.dispose();}
  await withEngine(async engine=>{
    const node=new egret.Sprite();engine.stage.addChild(node);engine.stage.removeChild(node);let closing;const order=[],cause=undefined;
    try{code(()=>bounds(node,{get maxNodes(){order.push('maxNodes');closing=engine.dispose();return 0;},get maxPrimitives(){order.push('maxPrimitives');throw cause;}}),'BOUNDS_INPUT_INVALID',cause);assert.deepEqual(order,['maxNodes','maxPrimitives']);await closing;
      node.dispose();let reads=0;code(()=>bounds(node,{get maxNodes(){reads++;return 1;}}),'OBJECT_DISPOSED');assert.equal(reads,0);
    }finally{await closing;node.dispose();}
  });
});

// B15: completed option mutations are observed; nested calls own their state.
test('B15 getter mutation reparenting reentry and closure use completed capture',async()=>{
  capability();const root=new egret.Sprite(),child=new egret.Sprite(),other=new egret.Sprite();
  try{
    rect(root,1,2,3,4);rect(child,0,0,1,1);child.x=10;root.addChild(child);const trace=[];
    rectangle(bounds(root,{get maxNodes(){trace.push('maxNodes');root.graphics.clear();rect(root,20,30,2,3);return 8;},get maxPrimitives(){trace.push('maxPrimitives');other.addChild(child);rect(root,-2,-3,1,1);return 8;}}),-2,-3,24,36);
    assert.deepEqual(trace,['maxNodes','maxPrimitives']);assert.equal(child.parent,other);
    root.graphics.clear();rect(root,1,2,3,4);child.graphics.clear();rect(child,0,0,2,1);root.addChild(child);let inner;
    const outer=rectangle(bounds(root,{get maxNodes(){inner=rectangle(bounds(root),1,0,11,6);return 8;},get maxPrimitives(){root.graphics.clear();rect(root,3,4,1,1);return 8;}}),3,0,9,5);
    rectangle(inner,1,0,11,6);assert.notEqual(inner,outer);rectangle(bounds(child),0,0,2,1);
  }finally{child.dispose();root.dispose();other.dispose();}
  await withEngine(async engine=>{
    const node=new egret.Sprite();engine.stage.addChild(node);engine.stage.removeChild(node);let closing;const trace=[];
    try{code(()=>bounds(node,{get maxNodes(){trace.push('maxNodes');closing=engine.dispose();return 0;},get maxPrimitives(){trace.push('maxPrimitives');return 0;}}),'ENGINE_CLOSED');assert.deepEqual(trace,['maxNodes','maxPrimitives']);await closing;}
    finally{await closing;node.dispose();}
  });
});

// B16: attach first through legitimate public preflight, then install hostile
// getters/hooks. A separate unbound subclass needs no attach or setter callback.
test('B16 authoritative tree transform lifetime and Bitmap state ignore public hooks',async()=>{
  capability();await withBitmap(async f=>{
    const root=new egret.Sprite(),child=new egret.Sprite();rect(child,1,2,3,4);child.x=3;f.bitmap.x=9;root.addChild(child);root.addChild(f.bitmap);
    const restorers=[];let reads=0;
    function hostile(node,key){const prior=Object.getOwnPropertyDescriptor(node,key);Object.defineProperty(node,key,{configurable:true,get(){reads++;throw Error('public authority getter');}});restorers.push(()=>{if(prior)Object.defineProperty(node,key,prior);else delete node[key];});}
    try{
      for(const node of [root,child,f.bitmap])for(const key of ['x','y','scaleX','scaleY','rotation','parent','children','numChildren','getChildAt','isDisposed','visible','alpha','clipRect','assertUsable'])hostile(node,key);
      for(const key of ['naturalWidth','naturalHeight','textureLease','sourceRect'])hostile(f.bitmap,key);
      rectangle(bounds(root),4,0,9,6);rectangle(bounds(f.bitmap),0,0,4,5);assert.equal(reads,0);
    }finally{for(const restore of restorers.reverse())restore();child.dispose();root.dispose();}
  });
  let hooks=0;class Hostile extends egret.Sprite{assertUsable(){hooks++;throw Error('unbound subclass hook');}}
  const node=new Hostile();try{rectangle(bounds(node),0,0,0,0);assert.equal(hooks,0);}finally{node.dispose();}
});

// B17: node/content accounting includes zero primitives and occupied Bitmap;
// clearing removes only the slot. Upper admission caps need no large allocation.
test('B17 small independent budgets defaults and hard numeric admission limits',async()=>{
  capability();await withBitmap(async f=>{
    const root=new egret.Sprite();rect(root,100,200,0,5);rect(root,1,2,3,4);f.bitmap.x=10;root.addChild(f.bitmap);
    try{
      rectangle(bounds(root,{maxNodes:2,maxPrimitives:3}),1,0,13,6);
      code(()=>bounds(root,{maxNodes:2,maxPrimitives:2}),'BOUNDS_CONTENT_LIMIT');code(()=>bounds(root,{maxNodes:1,maxPrimitives:3}),'BOUNDS_TREE_LIMIT');
      rectangle(bounds(root,{maxNodes:65536,maxPrimitives:262144}),1,0,13,6);
      rectangle(bounds(root,undefined),1,0,13,6);rectangle(bounds(root,{maxNodes:undefined,maxPrimitives:undefined}),1,0,13,6);
      f.bitmap.textureLease=undefined;rectangle(bounds(root,{maxNodes:2,maxPrimitives:2}),1,2,3,4);
      code(()=>bounds(root,{maxNodes:2,maxPrimitives:1}),'BOUNDS_CONTENT_LIMIT');
      let coercions=0;const coercible={valueOf(){coercions++;return 1;}};
      for(const [key,above] of [['maxNodes',65537],['maxPrimitives',262145]])for(const value of [null,0,-1,1.5,above,NaN,Infinity,-Infinity,'1',true,1n,Symbol('budget'),new Number(1),coercible]){
        code(()=>bounds(root,{[key]:value}),'BOUNDS_INPUT_INVALID');
      }
      assert.equal(coercions,0);rectangle(bounds(root,{maxNodes:2,maxPrimitives:2}),1,2,3,4);
    }finally{root.dispose();}
  });
});

// B18: query budgets include the root and all hidden/clipped empty nodes. Tree
// construction is outside those budgets. Bottom-up cleanup avoids recursive
// container disposal; no elapsed-time or absence-of-copy claim is made here.
test('B18 deep and wide genuine trees respect receiver-inclusive node budgets',()=>{
  capability();const nodes=[new egret.Sprite()];
  try{
    for(let index=1;index<4097;index++){const next=new egret.Sprite();nodes[index-1].addChild(next);nodes.push(next);}
    rect(nodes[4096],1,2,3,4);code(()=>bounds(nodes[0]),'BOUNDS_TREE_LIMIT');
    rectangle(bounds(nodes[1]),1,2,3,4);rectangle(bounds(nodes[0],{maxNodes:4097,maxPrimitives:1}),1,2,3,4);
  }finally{for(let index=nodes.length-1;index>=0;index--)nodes[index].dispose();}
  const wide=new egret.Sprite(),children=[];
  try{
    for(let index=0;index<128;index++){const child=new egret.Sprite();child.visible=false;child.alpha=0;child.clipRect={x:0,y:0,width:0,height:0};wide.addChild(child);children.push(child);}
    code(()=>bounds(wide,{maxNodes:1}),'BOUNDS_TREE_LIMIT');rectangle(bounds(wide,{maxNodes:129}),0,0,0,0);
  }finally{for(let index=children.length-1;index>=0;index--)children[index].dispose();wide.dispose();}
});
