import test from 'node:test';
import assert from 'node:assert/strict';
import * as egret from '@egret/engine';
import {host} from './helpers.mjs';

// Coordinate contract regressions consume only the built public facade.
// Public API only: mathematical literals are oracles, not production helpers.
const FRAME={width:32,height:32};

function operation(name){
  const fn=egret.DisplayObject.prototype[name];
  assert.equal(typeof fn,'function',`public DisplayObject.${name} capability`);
  return fn;
}
function query(node,name,...args){return Reflect.apply(operation(name),node,args);}
function forward(node,...args){return query(node,'localToGlobal',...args);}
function inverse(node,...args){return query(node,'globalToLocal',...args);}
function thrown(run){try{run();}catch(cause){return cause;}assert.fail('operation must throw');}
function code(run,want,...causes){
  const error=thrown(run);assert.ok(error instanceof egret.EgretError);
  // A supplied undefined is an exact cause assertion, distinct from omission.
  assert.equal(error.code,want);if(causes.length)assert.equal(error.cause,causes[0]);
  return error;
}
function ownedPoint(value){
  assert.deepEqual(Reflect.ownKeys(value),['x','y']);assert.ok(Object.isFrozen(value));
  for(const axis of ['x','y']){
    assert.equal(typeof value[axis],'number');assert.ok(Number.isFinite(value[axis]));
    assert.equal(Object.is(value[axis],-0),false);
  }return value;
}
function point(value,x,y){ownedPoint(value);assert.deepEqual(value,{x,y});return value;}
function near(value,x,y,tolerance=1e-10){
  ownedPoint(value);assert.ok(Math.abs(value.x-x)<=tolerance,`x near ${x}`);
  assert.ok(Math.abs(value.y-y)<=tolerance,`y near ${y}`);return value;
}
async function withEngine(run,overrides={}){
  const port=host(overrides),diagnostics=[];
  const engine=await egret.createEngine({host:port.adapter,onDiagnostic:d=>diagnostics.push(d)});
  try{return await run(engine,port,diagnostics);}finally{await engine.dispose();}
}
function hierarchy(){
  const parent=new egret.Sprite(),child=new egret.Sprite();
  parent.x=10;parent.y=20;parent.scaleX=2;
  child.x=3;child.y=4;child.rotation=90;parent.addChild(child);
  return {parent,child};
}

// Genuine baseline RED is missing query capability, not module/setup failure.
test('C01 public DisplayObject offers localToGlobal',()=>{operation('localToGlobal');});
test('C02 public DisplayObject offers globalToLocal',()=>{operation('globalToLocal');});

test('C03 independent defaults and fresh frozen values on unbound nodes',()=>{
  const node=new egret.DisplayObject();try{
    point(forward(node),0,0);point(inverse(node),0,0);
    point(forward(node,undefined,4),0,4);point(inverse(node,3,undefined),3,0);
    const a=point(forward(node,3,-4),3,-4),b=point(forward(node,3,-4),3,-4);
    assert.notEqual(a,b);assert.throws(()=>{a.x=99;},TypeError);
    node.x=20;node.dispose();point(a,3,-4);
  }finally{node.dispose();}
});

test('C04 literal parent-times-local geometry and independent inverse input',()=>{
  const {parent,child}=hierarchy();try{
    near(forward(child,1,2),12,25);near(inverse(child,4,28),4,6);
    near(forward(child,4,6),4,28);
  }finally{parent.dispose();}
});

test('C05 Stage includes its transform and detach uses actual roots',async()=>{
  await withEngine(async engine=>{
    const {parent,child}=hierarchy();engine.stage.addChild(parent);
    engine.stage.x=7;engine.stage.y=-3;engine.stage.scaleX=3;engine.stage.scaleY=-2;
    const saved=near(forward(child,1,2),43,-53);near(inverse(child,43,-53),1,2);
    point(forward(engine.stage),7,-3);point(inverse(engine.stage,7,-3),0,0);
    engine.stage.removeChild(parent);near(forward(child,1,2),12,25);
    parent.removeChild(child);near(forward(child,1,2),1,5);near(saved,43,-53);
    child.dispose();parent.dispose();
  });
});

test('C06 reparenting changes current coordinates but saved values survive',()=>{
  const a=new egret.Sprite(),b=new egret.Sprite(),leaf=new egret.DisplayObject();
  try{a.x=10;b.x=-20;leaf.x=3;a.addChild(leaf);
    const saved=point(forward(leaf,2,4),15,4);b.addChild(leaf);
    point(forward(leaf,2,4),-15,4);point(inverse(leaf,-15,4),2,4);point(saved,15,4);
  }finally{a.dispose();b.dispose();leaf.dispose();}
});

test('C07 reflection and forward collapse are separate from inverse singularity',()=>{
  const node=new egret.DisplayObject();try{
    node.x=5;node.y=-7;node.scaleX=-2;node.scaleY=3;
    point(forward(node,4,-2),-3,-13);point(inverse(node,-3,-13),4,-2);
    node.scaleX=0;point(forward(node,4,-2),5,-13);
    code(()=>inverse(node,Number.MAX_VALUE,Number.MAX_VALUE),'COORDINATE_TRANSFORM_SINGULAR');
    node.scaleY=0;point(forward(node,4,-2),5,-7);
    code(()=>inverse(node),'COORDINATE_TRANSFORM_SINGULAR');
  }finally{node.dispose();}
});

for(const [angle,x,y] of [[-90,3,-2],[270,3,-2],[450,-3,2]]){
  test(`C08 degree modulo rotation ${angle}`,()=>{
    const node=new egret.DisplayObject();try{node.rotation=angle;near(forward(node,2,3),x,y);}
    finally{node.dispose();}
  });
}

test('C09 authoritative state ignores hostile public getters and subclass hooks',()=>{
  class Hostile extends egret.Sprite{assertUsable(){throw Error('overridden usable hook');}}
  const parent=new egret.Sprite(),leaf=new Hostile();
  // Attach before installing throwing hooks; genuine public structural preflight
  // is allowed to invoke subclass hooks, coordinate queries are not.
  const plain=new egret.Sprite();parent.x=10;plain.x=3;parent.addChild(plain);
  let reads=0;
  try{
    for(const node of [parent,plain,leaf])for(const key of ['x','y','scaleX','scaleY','rotation','parent','isDisposed','numChildren']){
      Object.defineProperty(node,key,{get(){reads++;throw Error('public authority read');}});
    }
    point(forward(plain,2,4),15,4);point(inverse(plain,15,4),2,4);
    point(forward(leaf,2,4),2,4);point(inverse(leaf,2,4),2,4);assert.equal(reads,0);
  }finally{parent.dispose();plain.dispose();leaf.dispose();}
});

test('C10 receiver identity precedes public receiver and options reads',()=>{
  operation('localToGlobal');operation('globalToLocal');
  const real=new egret.DisplayObject();let receiverReads=0,optionReads=0;
  const options={get maxNodes(){optionReads++;throw Error('unread options');}};
  const proxy=new Proxy(real,{get(){receiverReads++;throw Error('unread receiver');}});
  const revoked=Proxy.revocable({maxNodes:1},{});revoked.revoke();
  const forged=Object.create(egret.DisplayObject.prototype);
  try{for(const value of [null,undefined,1,{},forged,proxy])for(const name of ['localToGlobal','globalToLocal']){
    code(()=>query(value,name,NaN,0,options),'COORDINATE_RECEIVER_INVALID');
    code(()=>query(value,name,0,0,revoked.proxy),'COORDINATE_RECEIVER_INVALID');
  }assert.equal(receiverReads,0);assert.equal(optionReads,0);
  }finally{real.dispose();}
});

test('C11 primitive inputs reject without conversion or option admission',()=>{
  const node=new egret.DisplayObject();let coercions=0,reads=0;
  const value={valueOf(){coercions++;return 1;}},options={get maxNodes(){reads++;throw Error('unread');}};
  const bad=[null,NaN,Infinity,-Infinity,'1',true,1n,Symbol('not coordinate'),new Number(1),value];
  try{for(const name of ['localToGlobal','globalToLocal'])for(const input of bad){
    code(()=>query(node,name,input,0,options),'COORDINATE_INPUT_INVALID');
    code(()=>query(node,name,0,input,options),'COORDINATE_INPUT_INVALID');
  }assert.equal(coercions,0);assert.equal(reads,0);point(forward(node,1,2),1,2);
  }finally{node.dispose();}
});

test('C12 options shapes and maxNodes numeric bounds reject atomically',()=>{
  const node=new egret.DisplayObject();node.x=3;try{
    for(const name of ['localToGlobal','globalToLocal']){
      for(const options of [null,[],1,'x',true,1n,Symbol('not options'),()=>{}])code(()=>query(node,name,0,0,options),'COORDINATE_INPUT_INVALID');
      for(const maxNodes of [null,0,-1,1.5,65537,NaN,Infinity,'1',new Number(1)]){
        code(()=>query(node,name,0,0,{maxNodes}),'COORDINATE_INPUT_INVALID');
      }
    }point(forward(node,1,2,{maxNodes:65536}),4,2);assert.equal(node.x,3);
    point(forward(node,1,2,{maxNodes:undefined}),4,2);
  }finally{node.dispose();}
});

test('C13 one inherited options read without enumeration/prototype inspection',()=>{
  const node=new egret.DisplayObject();let inherited=0,reads=0;
  const inheritedOptions=Object.create({get maxNodes(){inherited++;return 1;}});
  const options=new Proxy({maxNodes:1},{
    ownKeys(){throw Error('options enumeration');},getPrototypeOf(){throw Error('prototype inspection');},
    get(target,key){assert.equal(key,'maxNodes');reads++;return target[key];},
  });
  try{point(forward(node,1,2,inheritedOptions),1,2);assert.equal(inherited,1);
    point(inverse(node,1,2,options),1,2);assert.equal(reads,1);
    const ignored={maxNodes:1,get x(){throw Error('not output');},get y(){throw Error('not output');},get unknown(){throw Error('unknown');}};
    point(forward(node,3,4,ignored),3,4);
    const extra={maxNodes:1,x:90,y:91};point(inverse(node,3,4,extra),3,4);
    assert.deepEqual(extra,{maxNodes:1,x:90,y:91});
  }finally{node.dispose();}
});

for(const [index,cause] of [undefined,null,{source:'literal'},new egret.EgretError('ENGINE_CLOSED')].entries()){
  test(`C14 source getter preserves exact thrown cause ${index}`,()=>{
    const node=new egret.DisplayObject();let reads=0;try{
      code(()=>forward(node,0,0,{get maxNodes(){reads++;throw cause;}}),'COORDINATE_INPUT_INVALID',cause);
      assert.equal(reads,1);point(forward(node,1,2),1,2);
    }finally{node.dispose();}
  });
}

test('C15 revoked object/array admission is wrapped and primitive precedence survives',()=>{
  const node=new egret.DisplayObject();try{
    for(const target of [{maxNodes:1},[]]){
      const {proxy,revoke}=Proxy.revocable(target,{});revoke();
      const error=code(()=>forward(node,0,0,proxy),'COORDINATE_INPUT_INVALID');
      assert.ok(error.cause instanceof TypeError,'actual revoked-proxy admission exception');
      const earlier=code(()=>inverse(node,NaN,0,proxy),'COORDINATE_INPUT_INVALID');
      assert.equal(earlier.cause,undefined,'primitive semantics precede array admission');
    }
  }finally{node.dispose();}
});

test('C16 successful getter mutation/reparent is captured once before traversal',()=>{
  const a=new egret.Sprite(),b=new egret.Sprite(),leaf=new egret.DisplayObject();let reads=0;
  try{a.x=7;b.x=20;leaf.x=2;a.addChild(leaf);
    point(forward(leaf,1,0,{get maxNodes(){reads++;b.addChild(leaf);return 2;}}),23,0);
    assert.equal(reads,1);assert.equal(leaf.parent,b);
    point(forward(leaf,3,0,{get maxNodes(){b.removeChild(leaf);return 1;}}),5,0);
  }finally{a.dispose();b.dispose();leaf.dispose();}
});

test('C17 option reentry owns separate results and observes completed mutation',()=>{
  const node=new egret.DisplayObject();let nested,reads=0;
  try{node.x=3;const outer=forward(node,1,2,{get maxNodes(){
    reads++;nested=forward(node,5,6,{maxNodes:1});node.x=10;return 1;
  }});point(nested,8,6);point(outer,11,2);assert.notEqual(nested,outer);assert.equal(reads,1);
  }finally{node.dispose();}
});

test('C18 getter disposal precedes budget semantics but throwing source preserves cause',()=>{
  const node=new egret.DisplayObject(),other=new egret.DisplayObject(),cause={source:'dispose then throw'};
  try{code(()=>forward(node,0,0,{get maxNodes(){node.dispose();return 0;}}),'OBJECT_DISPOSED');
    code(()=>inverse(other,0,0,{get maxNodes(){other.dispose();throw cause;}}),'COORDINATE_INPUT_INVALID',cause);
  }finally{node.dispose();other.dispose();}
});

test('C19 disposed identity and bound engine closure precede options reads',async()=>{
  await withEngine(async engine=>{
    let reads=0;const options={get maxNodes(){reads++;throw Error('unread');}};
    const revoked=Proxy.revocable({maxNodes:1},{});revoked.revoke();
    const disposed=new egret.DisplayObject(),detached=new egret.DisplayObject();
    engine.stage.addChild(disposed);engine.stage.addChild(detached);disposed.dispose();engine.stage.removeChild(detached);
    try{code(()=>forward(disposed,NaN,0,options),'OBJECT_DISPOSED');
      code(()=>inverse(disposed,0,0,revoked.proxy),'OBJECT_DISPOSED');
      await engine.dispose();assert.equal(detached.isDisposed,false);
      code(()=>inverse(detached,NaN,0,options),'ENGINE_CLOSED');
      code(()=>forward(detached,0,0,revoked.proxy),'ENGINE_CLOSED');
      code(()=>forward(disposed,0,0,options),'OBJECT_DISPOSED');
      assert.equal(reads,0);
    }finally{detached.dispose();}
  });
});

test('C20 closing live objects reject while rendering cleanup waits for unwind',async()=>{
  operation('localToGlobal');operation('globalToLocal');
  let engine,closing,reads=0;const detached=new egret.DisplayObject();
  const options={get maxNodes(){reads++;throw Error('unread');}};
  const port=host({renderFrame(){
    closing=engine.dispose();assert.equal(engine.stage.isDisposed,false);
    code(()=>forward(engine.stage,0,0,options),'ENGINE_CLOSED');
    code(()=>inverse(detached,0,0,options),'ENGINE_CLOSED');return undefined;
  }});
  engine=await egret.createEngine({host:port.adapter});
  try{engine.stage.addChild(detached);engine.stage.removeChild(detached);
    engine.renderFrame(FRAME);await closing;assert.equal(reads,0);
  }finally{detached.dispose();await engine.dispose();}
});

test('C21 successful getter closure wins invalid budget for a detached bound node',async()=>{
  await withEngine(async engine=>{
    const node=new egret.DisplayObject();engine.stage.addChild(node);engine.stage.removeChild(node);let closing;
    try{code(()=>forward(node,0,0,{get maxNodes(){closing=engine.dispose();return 0;}}),'ENGINE_CLOSED');await closing;
    }finally{node.dispose();}
  });
});

test('C22 separate Engines have separate Stage spaces with no implicit root',async()=>{
  await withEngine(async a=>withEngine(async b=>{
    a.stage.x=10;b.stage.x=-20;const x=new egret.DisplayObject(),y=new egret.DisplayObject();
    a.stage.addChild(x);b.stage.addChild(y);point(forward(x,1,2),11,2);point(forward(y,1,2),-19,2);
    a.stage.removeChild(x);point(forward(x,1,2),1,2);x.dispose();
  }));
});

test('C23 render-state independence and no query frame/host/diagnostic work',async()=>{
  let draws=0;await withEngine(async(engine,port,diagnostics)=>{
    const parent=new egret.Sprite(),node=new egret.DisplayObject();parent.x=10;node.x=3;
    parent.addChild(node);engine.stage.addChild(parent);const first=engine.captureFrame(FRAME);
    parent.visible=false;parent.alpha=0;parent.clipRect={x:0,y:0,width:0,height:1};
    Object.defineProperty(port.adapter,'pixelRatio',{get(){throw Error('host pixel ratio read');}});
    point(forward(node,2,4),15,4);point(inverse(node,15,4),2,4);
    code(()=>forward(node,NaN,0),'COORDINATE_INPUT_INVALID');
    const second=engine.captureFrame(FRAME);assert.equal(second.frameId,first.frameId+1);
    assert.equal(draws,0);assert.equal(port.timers.size,0);assert.deepEqual(diagnostics,[]);
    assert.deepEqual(port.trace,['start']);
  },{renderFrame(){draws++;}});
});

test('C24 Bitmap geometry ignores released image entitlement',async()=>{
  await withEngine(async engine=>{
    let loads=0,retired=0;
    const image=egret.createImageData2D({width:1,height:1,pixels:new Uint8Array([1,2,3,255])});
    const texture=egret.createTexture(image),type=egret.createAssetType('coordinate-texture',egret.isTexture);
    engine.assets.register(type,{load:async()=>{loads++;return texture;},dispose:value=>{retired++;value.dispose();}});
    const lease=await engine.assets.acquire(egret.createAssetRef(type,'one'));
    const node=new egret.Bitmap(lease);node.x=5;node.scaleX=-2;engine.stage.addChild(node);
    lease.release();const before={loads,retired};
    point(forward(node,4,2),-3,2);point(inverse(node,-3,2),4,2);
    assert.deepEqual({loads,retired},before);assert.equal(node.textureLease,lease);
    code(()=>engine.captureFrame(FRAME),'ASSET_LEASE_RELEASED');
  });
});

for(const exponent of [-600,600]){
  test(`C25 uniform scale exponent ${exponent} does not use raw determinant range`,()=>{
    const node=new egret.DisplayObject();try{const s=2**exponent;node.scaleX=s;node.scaleY=s;
      point(inverse(node,3*s,-2*s),3,-2);
    }finally{node.dispose();}
  });
}

for(const [sx,sy,label] of [[1,2**-46,'former cutoff'],[2**600,2**-600,'1200-exponent anisotropy']]){
  test(`C26 nonsingular ${label} is accepted`,()=>{
    const node=new egret.DisplayObject();try{node.scaleX=sx;node.scaleY=sy;
      point(inverse(node,2*sx,3*sy),2,3);
    }finally{node.dispose();}
  });
}

test('C27 exact solve retains a representable subnormal RHS quotient',()=>{
  const node=new egret.DisplayObject();try{node.scaleX=2**600;node.scaleY=2**555;
    point(inverse(node,0,2**-500),0,2**-1055);
    point(inverse(node,0,-(2**-500)),0,-(2**-1055));
  }finally{node.dispose();}
});

test('C28 exact translated numerator avoids premature overflowing subtraction',()=>{
  const node=new egret.DisplayObject();try{node.scaleX=2**1023;node.scaleY=2**1023;node.x=-(2**1023);
    point(inverse(node,2**1023,0),2,0);node.x=2**1023;point(inverse(node,-(2**1023),0),-2,0);
  }finally{node.dispose();}
});

test('C29 huge rotated inverse has finite analytic coordinates',()=>{
  const node=new egret.DisplayObject();try{node.rotation=45;
    const G=3*2**1022,expected=G/Math.SQRT2,result=ownedPoint(inverse(node,G,0));
    // Analytic 45-degree oracle, independent of the production solve; runtime
    // trig approximations can shift the stored-matrix result by a few ulps.
    assert.ok(Math.abs(result.x/expected-1)<=8*Number.EPSILON);
    assert.ok(Math.abs(result.y/(-expected)-1)<=8*Number.EPSILON);
  }finally{node.dispose();}
});

test('C30 final inverse overflow rejects without a partial point',()=>{
  const node=new egret.DisplayObject();try{node.x=-Number.MAX_VALUE;
    code(()=>inverse(node,Number.MAX_VALUE,0),'COORDINATE_ARITHMETIC_RANGE');
    node.x=0;node.scaleX=Number.MIN_VALUE;code(()=>inverse(node,1,0),'COORDINATE_ARITHMETIC_RANGE');
    point(inverse(node,Number.MIN_VALUE,0),1,0);
  }finally{node.dispose();}
});

test('C31 forward world overflow rejects even the origin and preserves capture errors',async()=>{
  await withEngine(async engine=>{
    const parent=new egret.Sprite(),node=new egret.Sprite();parent.scaleX=Number.MAX_VALUE;node.scaleX=2;
    node.graphics.beginFill(1).drawRect(0,0,1,1);parent.addChild(node);engine.stage.addChild(parent);
    code(()=>forward(node,0,0),'COORDINATE_ARITHMETIC_RANGE');
    code(()=>inverse(node,0,0),'COORDINATE_ARITHMETIC_RANGE');
    code(()=>engine.captureFrame(FRAME),'FRAME_TRANSFORM_INVALID');
  });
});

test('C32 forward point overflow and ordinary underflow remain binary64',()=>{
  const node=new egret.DisplayObject();try{node.scaleX=Number.MAX_VALUE;
    code(()=>forward(node,2,0),'COORDINATE_ARITHMETIC_RANGE');point(forward(node,0,0),0,0);
    node.scaleX=-Number.MIN_VALUE;point(forward(node,.5,-0),0,0);
  }finally{node.dispose();}
});

test('C33 forward sum order retains ordinary rounding instead of exact inverse arithmetic',()=>{
  const parent=new egret.Sprite(),node=new egret.DisplayObject();try{
    parent.x=2**53;node.x=1;parent.addChild(node);
    // Current composition loses the +1 before point evaluation, by design.
    point(forward(node,-(2**53),0),0,0);
    point(inverse(node,0,0),-(2**53),0);
  }finally{parent.dispose();}
});

test('C34 nearest-even subnormal ties and negative mirrors canonicalize zero',()=>{
  const node=new egret.DisplayObject();try{node.scaleX=2;
    point(inverse(node,Number.MIN_VALUE,0),0,0);point(inverse(node,-Number.MIN_VALUE,0),0,0);
    point(inverse(node,3*Number.MIN_VALUE,0),2*Number.MIN_VALUE,0);
    point(inverse(node,-3*Number.MIN_VALUE,0),-2*Number.MIN_VALUE,0);
    node.scaleX=-1;point(inverse(node,-0,3),0,3);
  }finally{node.dispose();}
});

test('C35 reciprocal, normal significand carry and subnormal-to-normal carry',()=>{
  const node=new egret.DisplayObject();try{
    node.scaleX=1+2**-52;point(inverse(node,1,0),1-2**-52,0);
    node.scaleX=1;node.x=-(2**-53);point(inverse(node,2-2**-52,0),2,0);
    node.x=0;node.scaleX=2;point(inverse(node,2**-1021-Number.MIN_VALUE,0),2**-1022,0);
    point(inverse(node,-(2**-1021-Number.MIN_VALUE),0),-(2**-1022),0);
  }finally{node.dispose();}
});

test('C36 maximum finite midpoint rounds only the below-midpoint case to MAX',()=>{
  const node=new egret.DisplayObject();try{
    for(const sign of [1,-1]){
      node.x=-sign*2**969;point(inverse(node,sign*Number.MAX_VALUE,0),sign*Number.MAX_VALUE,0);
      node.x=-sign*2**970;code(()=>inverse(node,sign*Number.MAX_VALUE,0),'COORDINATE_ARITHMETIC_RANGE');
      node.x=-sign*3*2**969;code(()=>inverse(node,sign*Number.MAX_VALUE,0),'COORDINATE_ARITHMETIC_RANGE');
    }
  }finally{node.dispose();}
});

test('C37 exact cancellation uses observed public capture coefficients, never a private import',async()=>{
  operation('globalToLocal');await withEngine(async engine=>{
    const parent=new egret.Sprite(),node=new egret.Sprite();parent.rotation=45;parent.scaleY=2**-120;node.rotation=45;
    node.graphics.beginFill(1).drawRect(0,0,1,1);parent.addChild(node);engine.stage.addChild(parent);
    const frame=engine.captureFrame(FRAME);assert.equal(frame.commands.length,1);
    const m=frame.commands[0].matrix,u=2**-53;
    assert.deepEqual([m.a,m.b,m.c,m.d,m.tx,m.ty],[.5+u,.5,-.5,-.5+u,0,0],
      'pinned-runtime coefficient gate: failure requires a new public fixture, never silent skip');
    assert.equal(m.a*m.d-m.b*m.c,0,'ordinary rounded determinant cannot identify the exact rank');
    // (1/2+u)*(-1/2+u) - (1/2)*(-1/2) = u^2 = 2^-106.
    point(inverse(node,0,2**-106),.5,.5+u);
    point(inverse(node,0,-(2**-106)),-.5,-(.5+u));
  });
});

test('C38 receiver-inclusive budgets and detached roots',async()=>{
  await withEngine(async engine=>{
    const parent=new egret.Sprite(),leaf=new egret.DisplayObject();parent.addChild(leaf);engine.stage.addChild(parent);
    point(forward(leaf,1,2,{maxNodes:3}),1,2);code(()=>forward(leaf,1,2,{maxNodes:2}),'COORDINATE_TREE_LIMIT');
    code(()=>inverse(leaf,1,2,{maxNodes:2}),'COORDINATE_TREE_LIMIT');
    parent.removeChild(leaf);point(forward(leaf,1,2,{maxNodes:1}),1,2);leaf.dispose();
  });
});

test('C39 ancestor-only queries do not traverse overflowing descendant geometry',()=>{
  const root=new egret.Sprite(),child=new egret.Sprite(),leaf=new egret.DisplayObject();
  try{child.scaleX=Number.MAX_VALUE;leaf.scaleX=2;child.addChild(leaf);root.addChild(child);
    point(forward(root,1,2,{maxNodes:1}),1,2);point(inverse(root,1,2,{maxNodes:1}),1,2);
  }finally{root.dispose();}
});

test('C40 default 4096/4097 path boundary is iterative with bottom-up cleanup',()=>{
  operation('localToGlobal');operation('globalToLocal');
  const nodes=Array.from({length:4097},()=>new egret.DisplayObjectContainer());
  try{
    for(let index=0;index<nodes.length-1;index++)nodes[index].addChild(nodes[index+1]);
    const leaf=nodes.at(-1);point(forward(leaf,1,2,{maxNodes:4097}),1,2);
    code(()=>forward(leaf,1,2),'COORDINATE_TREE_LIMIT');code(()=>inverse(leaf,1,2),'COORDINATE_TREE_LIMIT');
    nodes[0].removeChild(nodes[1]);point(forward(leaf,1,2),1,2);point(inverse(leaf,1,2),1,2);
  }finally{for(let index=nodes.length-1;index>=0;index--)nodes[index].dispose();}
});

test('C41 public entry keeps types type-only and numerical authority private',()=>{
  operation('localToGlobal');operation('globalToLocal');
  for(const name of ['Point2D','CoordinateQueryOptions','composeDisplayTransform','queryDisplayPoint',
    'decodeFiniteDyadic','sumDyadicProducts','roundDyadicRatio','invertCoordinatePoint']){
    assert.equal(name in egret,false,`${name} is not an executable public export`);
  }
});

test('C42 rank lost during ordinary world composition remains authoritative',()=>{
  const parent=new egret.Sprite(),node=new egret.DisplayObject();try{
    parent.scaleX=Number.MIN_VALUE;node.scaleX=.5;parent.addChild(node);
    assert.notEqual(parent.scaleX,0);assert.notEqual(node.scaleX,0);
    point(forward(node,1,2),0,2);code(()=>inverse(node,0,2),'COORDINATE_TRANSFORM_SINGULAR');
  }finally{parent.dispose();}
});
