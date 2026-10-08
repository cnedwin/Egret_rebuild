import test from 'node:test';
import assert from 'node:assert/strict';
// This narrow private-built import tests geometry, never public host behavior.
import { copyFrame2D, FrameCopyError } from '../packages/engine/dist/rendering/copyFrame2D.js';
import { prepareRectangles2D, GeometryPreparationError } from '../packages/engine/dist/rendering/prepareRectangles2D.js';
const identity={a:1,b:0,c:0,d:1,tx:0,ty:0};
const rect=(x=0,y=0,width=2,height=2)=>({x,y,width,height});
const clip=(matrix=identity,r=rect())=>({matrix:{...matrix},rect:r});
const command=(r=rect(),clips=[],matrix=identity)=>({kind:'rect',matrix:{...matrix},rect:r,color:0xff0000,alpha:1,clips});
const frame=(commands=[command()],width=16,height=16)=>({frameId:1,width,height,clearColor:0,clearAlpha:0,commands});
const copyOptions={pixelRatio:1,maxBackingPixels:16777216,maxCommands:65536,maxClipRectangles:262144};
const prepareOptions={pixelRatio:1,maxPreparedVertices:1048576,maxClipEdgeTests:4194304};
function prepare(v=frame(),options={},copyOverrides={}){const copied=copyFrame2D(v,{...copyOptions,...copyOverrides});return prepareRectangles2D(copied.frame,copied.width,copied.height,{...prepareOptions,...options});}
function polygon(result,index=0){return result.commands[index]?.pointIndices.map(i=>[result.points[i].x,result.points[i].y])??[];}
function canonical(points){if(!points.length)return points;const variants=[];for(const direction of [points,[...points].reverse()])for(let i=0;i<points.length;i++)variants.push([...direction.slice(i),...direction.slice(0,i)]);return variants.sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)))[0];}
function literal(result,points){assert.deepEqual(canonical(polygon(result)),canonical(points));}
const geometryReason=reason=>error=>error instanceof GeometryPreparationError&&error.reason===reason;
const copyReason=reason=>error=>error instanceof FrameCopyError&&error.reason===reason;
const diamond=clip({a:3,b:3,c:-3,d:3,tx:0,ty:-3},rect(0,0,1,1));

test('literal square/diamond intersection has five exact vertices',()=>literal(prepare(frame([command(rect(),[diamond])])),[[0,0],[2,0],[2,1],[1,2],[0,2]]));
test('adapted orientation normalizes the literal unit triangle to positive winding',()=>{
 const p=polygon(prepare(frame([command(rect(0,0,1,1),[clip({a:2,b:-2,c:-2,d:-2,tx:-1,ty:2},rect(0,0,1,1))])])));
 assert.equal(p.length,3);const [a,b,c]=p;
 assert.ok((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])>0);
});
test('literal affine half-plane intersections are binary exact',()=>literal(prepare(frame([command(rect(),[clip({a:20,b:-10,c:-10,d:-20,tx:-10,ty:6.5},rect(0,0,1,1))])])),[[0,0],[2,0],[2,0.5],[0,1.5]]));

// Test-only rational oracle: neither expected coordinates nor tolerances use production math.
function rational(n,d){return Number(BigInt(n))/Number(BigInt(d));}
function ulpDistance(a,b){const data=new DataView(new ArrayBuffer(8));data.setFloat64(0,a);const x=data.getBigUint64(0);data.setFloat64(0,b);return x>data.getBigUint64(0)?x-data.getBigUint64(0):data.getBigUint64(0)-x;}
function exactDisplacement(value,numerator,denominator){
 const data=new DataView(new ArrayBuffer(8));data.setFloat64(0,value);const bits=data.getBigUint64(0),exponent=Number((bits>>52n)&2047n)-1023-52;
 let n=(bits&((1n<<52n)-1n))|(1n<<52n),d=1n;if(bits>>63n)n=-n;if(exponent>=0)n<<=BigInt(exponent);else d<<=BigInt(-exponent);
 let delta=n*BigInt(denominator)-BigInt(numerator)*d;if(delta<0n)delta=-delta;
 return Number(delta)/Number(d*BigInt(denominator));
}
test('x+3y <= 4 uses independent rational 2/3 and 4/3 within eight ULP',t=>{
 const out=prepare(frame([command(rect(),[clip({a:12,b:-4,c:-3,d:-9,tx:-8,ty:4},rect(0,0,1,1))])]));
 const points=polygon(out);assert.equal(points.length,4);
 for(const [x,y] of [[0,0],[2,0],[2,rational(2,3)],[0,rational(4,3)]])assert.ok(points.some(p=>p[0]===x&&ulpDistance(p[1],y)<=8n),JSON.stringify({x,y,points}));
 t.diagnostic(JSON.stringify({fixture:'x+3y<=4',points,maxConstructionDisplacement:Math.max(exactDisplacement(points.find(p=>p[0]===2&&p[1]>0)[1],2,3),exactDisplacement(points.find(p=>p[0]===0&&p[1]>0)[1],4,3))}));
});
test('zero dimensions, singular determinant, collinear, edge/corner touching and disjoint are empty',()=>{
 for(const c of [command(rect(0,0,0,2)),command(rect(0,0,2,0)),command(rect(),[],{a:1,b:2,c:2,d:4,tx:0.1,ty:0.2}),command(rect(),[clip(identity,rect(2,0,2,2))]),command(rect(),[clip(identity,rect(2,2,2,2))]),command(rect(),[clip(identity,rect(3,0,2,2))]),command(rect(),[clip({a:1,b:2,c:2,d:4,tx:0.1,ty:0.2})])])assert.equal(prepare(frame([c])).commands.length,0);
});
test('reflection, shear, reversed traversal and repeated clips retain exact ordinary coverage',()=>{
 literal(prepare(frame([command(rect(),[],{...identity,a:-1,tx:2})])),[[0,0],[2,0],[2,2],[0,2]]);
 literal(prepare(frame([command(rect(),[],{...identity,c:0.5})])),[[0,0],[2,0],[3,2],[1,2]]);
 const reversed=clip({a:-3,b:3,c:3,d:3,tx:0,ty:-3},rect(0,0,1,1));
 for(const clips of [[diamond,diamond],[reversed],[diamond,reversed,diamond]])literal(prepare(frame([command(rect(),clips)])),[[0,0],[2,0],[2,1],[1,2],[0,2]]);
});
test('positive thin rectangle and small-slope clips, reflections and repetitions are accepted',t=>{
 const thin=prepare(frame([command(rect(1,1,8,2**-40))]));assert.equal(polygon(thin).length,4);
 const packed=polygon(thin).map(([x,y])=>[Math.fround(2*x/16-1),Math.fround(1-2*y/16)]);
 assert.equal(new Set(packed.map(p=>p[1])).size,1);
 t.diagnostic(JSON.stringify({fixture:'thin-2^-40',points:polygon(thin),predictedFloat32FanCollapse:2,maxPredictedBackingDisplacement:2**-40,scope:'test-only NDC prediction; production packer belongs to Task3'}));
 const slope=clip({...identity,b:2**-30},rect(0,0,8,8));
 for(const clips of [[slope],[slope,slope],[slope,clip({...identity,a:-1,b:-(2**-30),tx:8,ty:8*(2**-30)},rect(0,0,8,8))]])assert.ok(polygon(prepare(frame([command(rect(1,1,4,4),clips)]))).length>=3);
});
test('non-dyadic nested rational clips and large/small supported geometry pass',t=>{
 const rationalClip=clip({a:12,b:-4,c:-3,d:-9,tx:-8,ty:4},rect(0,0,1,1));
 const out=prepare(frame([command(rect(),[rationalClip,clip(identity,rect(0.5,0,2,2))])]));
 const points=polygon(out);assert.ok(points.some(([x,y])=>x===0.5&&ulpDistance(y,rational(7,6))<=8n));
 t.diagnostic(JSON.stringify({fixture:'nested-rational',points,constructionDisplacementAt7over6:exactDisplacement(points.find(p=>p[0]===0.5&&p[1]>0)[1],7,6)}));
 const large=frame([command(rect(0,0,2,2),[],{...identity,tx:2**19,ty:2**19})],2**19+4,2**19+4);
 assert.equal(polygon(prepare(large,{},{maxBackingPixels:2**40})).length,4);
 assert.equal(polygon(prepare(frame([command(rect(2**-50,2**-50,2**-50,2**-50))]))).length,4);
});
test('range rejects extreme scalar and nonfinite corner intermediates even for invisible commands',()=>{
 for(const scalar of [2**21,2**-101]){const v=frame();v.commands[0].alpha=0;v.commands[0].matrix.tx=scalar;assert.throws(()=>prepare(v),geometryReason('range'));}
 const v=frame();v.commands[0].matrix.a=Number.MAX_VALUE;assert.throws(()=>copyFrame2D(v,copyOptions),copyReason('invalid'));
});
test('endpoint-rounded t===1 crossing constructs a sliver removed by the closed viewport',()=>{
 // The former strict-rule rejection is retained in Task 4 numerical history.
 const c=command(rect(-1,0,1,1),[clip(identity,rect(-(2**-60),-1,1,3))]);
 const out=prepare(frame([c]));assert.deepEqual(out.points,[]);assert.deepEqual(out.commands,[]);
});
test('represented rounded corners with mixed turns reject precision; exact singular matrix wins first',()=>{
 const points=[[0.2,0.1],[1.2,1.1],[3.2,3.1000000000000005],[2.2,2.1000000000000005]].map(p=>p.map(x=>BigInt(x*2**60)));
 const signs=points.map((a,i)=>{const b=points[(i+1)%4],c=points[(i+2)%4];const cross=(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);return cross<0n?-1:cross>0n?1:0;});
 assert.deepEqual(signs,[-1,1,1,1]);
 const matrix={a:1,b:1,c:2,d:2+2**-51,tx:0.2,ty:0.1};
 assert.throws(()=>prepare(frame([command(rect(0,0,1,1),[],matrix)])),geometryReason('precision'));
 assert.equal(prepare(frame([command(rect(0,0,1,1),[],{...matrix,d:2})])).commands.length,0);
});
test('fixed polygon cap accepts 1024 convex vertices and rejects the next four-sided clip',()=>{
 function fixture(count){const clips=Array.from({length:count},(_,i)=>{const angle=i*Math.PI/(2*count),a=Math.cos(angle),b=Math.sin(angle);return clip({a,b,c:-b,d:a,tx:500,ty:500},rect(-100,-100,200,200));});return frame([command(rect(0,0,1000,1000),clips)],1000,1000);}
 assert.equal(polygon(prepare(fixture(256))).length,1024);
 assert.throws(()=>prepare(fixture(257)),geometryReason('budget'));
});
test('DPR envelope applies even to clear-only frames',()=>{
 for(const pixelRatio of [2**-101,2**21]){
   const copied=copyFrame2D(frame([],2**-20,2**-20),{...copyOptions,pixelRatio});
   assert.throws(()=>prepareRectangles2D(copied.frame,copied.width,copied.height,{...prepareOptions,pixelRatio}),geometryReason('range'));
 }
});
test('predicted fan and predicate budgets have exact inclusive boundaries',()=>{
 const normal=prepare();assert.equal(normal.edgeTests,57);assert.equal(prepare(frame(),{maxPreparedVertices:6,maxClipEdgeTests:57}).edgeTests,57);
 assert.throws(()=>prepare(frame(),{maxPreparedVertices:5}),geometryReason('budget'));
 assert.throws(()=>prepare(frame(),{maxClipEdgeTests:normal.edgeTests-1}),geometryReason('budget'));
});
test('prepared DTO retains painter order, RGBA inputs, nominal DPR and stable input snapshot',()=>{
 const first=command(rect(1,1,2,2)),second=command(rect(4,4,2,2));first.color=1;first.alpha=0.5;second.color=2;second.alpha=0.75;
 const input=frame([first,second],10.2,10.2),copied=copyFrame2D(input,{...copyOptions,pixelRatio:1.5});
 first.matrix.tx=100;first.rect.width=100;input.commands.reverse();
 const out=prepareRectangles2D(copied.frame,copied.width,copied.height,{...prepareOptions,pixelRatio:1.5});
 assert.equal(copied.width,16);assert.deepEqual(out.commands.map(c=>[c.color,c.alpha]),[[1,0.5],[2,0.75]]);
 assert.deepEqual(canonical(polygon(out)),canonical([[1.5,1.5],[4.5,1.5],[4.5,4.5],[1.5,4.5]]));
 assert.throws(()=>{copied.frame.commands[0].matrix.tx=99;},TypeError);
 assert.throws(()=>prepareRectangles2D(copied.frame,copied.width,copied.height,{...prepareOptions,pixelRatio:1.5,maxPreparedVertices:11}),geometryReason('budget'));
});
test('copier snapshots scalars/elements once, ignores iterators and retains faults by identity',()=>{
 const v=frame([command(rect(),[clip()])]);
 // Independent per-object counters avoid conflating identical property names.
 const counts=[];function single(object){for(const key of Object.keys(object)){let n=0;const value=object[key];Object.defineProperty(object,key,{get(){assert.equal(++n,1,`reread ${key}`);counts.push(key);return value;}});}}
 const objects=[v,v.commands[0],v.commands[0].matrix,v.commands[0].rect,v.commands[0].clips[0],v.commands[0].clips[0].matrix,v.commands[0].clips[0].rect];
 v.commands[Symbol.iterator]=()=>{throw Error('iterator');};v.commands[0].clips[Symbol.iterator]=()=>{throw Error('clip iterator');};
 for(const object of objects)single(object);
 assert.equal(copyFrame2D(v,copyOptions).frame.commands.length,1);assert.ok(counts.length>20);
 for(const raw of [Error('raw getter'),new FrameCopyError('budget'),new GeometryPreparationError('precision')]){
   const bad=frame();Object.defineProperty(bad,'width',{get(){throw raw;}});
   assert.throws(()=>copyFrame2D(bad,copyOptions),e=>!(e instanceof FrameCopyError)&&e.cause===raw);
 }
 assert.throws(()=>copyFrame2D({...frame(),clearAlpha:2},copyOptions),copyReason('invalid'));
 assert.throws(()=>copyFrame2D(frame([],20,20),{...copyOptions,maxBackingPixels:399}),copyReason('backing'));
});
test('copier command and total clip bounds include inactive geometry and reject before element reads',()=>{
 const v=frame([command(rect(0,0,0,0),[clip(),clip()])]);v.commands[0].alpha=0;
 assert.equal(copyFrame2D(v,{...copyOptions,maxCommands:1,maxClipRectangles:2}).frame.commands[0].clips.length,2);
 assert.throws(()=>copyFrame2D(v,{...copyOptions,maxClipRectangles:1}),copyReason('budget'));
 const input=frame();Object.defineProperty(input.commands,0,{get(){throw Error('must not read');}});
 assert.throws(()=>copyFrame2D(input,{...copyOptions,maxCommands:0}),copyReason('budget'));
});
test('array lengths and indexed elements are each read once and raw allocation faults remain intact',()=>{
 const v=frame([command(rect(),[clip()])]);
 for(const location of [[v,'commands'],[v.commands[0],'clips']]){
   const source=location[0][location[1]],reads=new Map();location[0][location[1]]=new Proxy(source,{get(target,key,receiver){if(key==='length'||/^[0-9]+$/.test(String(key))){reads.set(key,(reads.get(key)??0)+1);assert.equal(reads.get(key),1,`array reread ${String(key)}`);}return Reflect.get(target,key,receiver);}});
 }
 assert.equal(copyFrame2D(v,copyOptions).frame.commands.length,1);
 const cause=Error('controlled allocation fault'),push=Array.prototype.push;let caught;
 try{Array.prototype.push=function(){throw cause;};copyFrame2D(frame(),copyOptions);}catch(error){caught=error;}finally{Array.prototype.push=push;}
 assert.equal(caught,cause);
});
