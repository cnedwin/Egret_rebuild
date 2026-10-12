import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {createMeshGeometry3D,isMeshGeometry3D,MeshGeometry3DError,getMeshGeometry3DErrorOrigin,createSceneFrame3D,isSceneFrame3D,Scene3DError,getScene3DErrorOrigin} from '@egret/engine/scene3d';

// Built bare public route only. Literal answers are independent of production
// projection, multiplication, packing and private authenticity storage.
const ID=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
const ORTHO=[1,0,0,0,0,1,0,0,0,0,.5,0,0,0,1,1];
const PERSPECTIVE=[1,0,0,0,0,1,0,0,0,0,1,-1,0,0,2,0];
const projection=()=>({kind:'orthographic',left:-1,right:1,bottom:-1,top:1,near:0,far:2});
const triangleInput=()=>({positions:[0,0,-1,1,0,-1,0,1,-1],colors:[1,0,0,0,1,0,0,0,1],indices:[0,1,2]});
const triangle=()=>createMeshGeometry3D(triangleInput());
const empty=()=>createMeshGeometry3D({positions:[],colors:[],indices:[]});
const sceneInput=(geometry=triangle(),modelView=[...ID])=>({projection:projection(),draws:[{geometry,modelView}]});
function caught(action){let threw=false,value;try{action();}catch(error){threw=true;value=error;}assert.equal(threw,true,'expected actual public refusal');return value;}
function meshFailure(action,code='MESH3D_INPUT_INVALID',origin='validation',cause){const e=caught(action);assert.ok(e instanceof MeshGeometry3DError);assert.equal(e.code,code);assert.equal(getMeshGeometry3DErrorOrigin(e),origin);assert.equal(e.cause,cause);return e;}
function sceneFailure(action,code='SCENE3D_INPUT_INVALID',origin='validation',cause){const e=caught(action);assert.ok(e instanceof Scene3DError);assert.equal(e.code,code);assert.equal(getScene3DErrorOrigin(e),origin);if(arguments.length===4)assert.equal(e.cause,cause);return e;}
function tuple(actual,want){assert.deepEqual(actual,want);assert.equal(Array.isArray(actual),true);assert.equal(Object.isFrozen(actual),true);for(const n of actual)if(n===0)assert.equal(Object.is(n,0),true);}
function sourceGetter(object,key,value,reads){Object.defineProperty(object,key,{configurable:true,enumerable:true,get(){reads[key]=(reads[key]??0)+1;return value;}});}

// Callable RED assignments: disposable frozen-clone wrappers must reach these
// named predicate assertions, with modules/maps present and inputs unchanged.
test('authentic-public-geometry',()=>{
  const geometry=triangle();
  assert.equal(isMeshGeometry3D(geometry),true,'authentic-public-geometry');
  assert.deepEqual([geometry.vertexCount,geometry.indexCount,geometry.logicalBytes],[3,3,168]);
  assert.equal(isMeshGeometry3D(Object.freeze({...geometry})),false);
});
test('authentic-public-scene',()=>{
  const geometry=triangle(),scene=createSceneFrame3D(sceneInput(geometry));
  assert.equal(isSceneFrame3D(scene),true,'authentic-public-scene');
  assert.equal(scene.draws[0].geometry,geometry);
  assert.deepEqual([scene.cpuLogicalBytes,scene.sceneBytes,scene.uniformBytes],[168,84,64]);
  assert.equal(isSceneFrame3D(Object.freeze({...scene})),false);
});
test('public capture owns frozen storage and retains authentic geometry identity',()=>{
  const input=triangleInput(),g=createMeshGeometry3D(input),other=createMeshGeometry3D(input);
  for(const value of [g,g.positions,g.colors,g.indices])assert.equal(Object.isFrozen(value),true);
  for(const key of ['positions','colors','indices']){assert.notEqual(g[key],input[key]);assert.notEqual(g[key],other[key]);}
  input.positions[0]=99;input.colors[0]=0;input.indices[0]=2;
  assert.deepEqual(g.positions,[0,0,-1,1,0,-1,0,1,-1]);assert.deepEqual(g.colors,[1,0,0,0,1,0,0,0,1]);assert.deepEqual(g.indices,[0,1,2]);
  const source=sceneInput(g),s=createSceneFrame3D(source),t=createSceneFrame3D(source);
  for(const value of [s,s.draws,s.geometries,s.draws[0],s.draws[0].mvp])assert.equal(Object.isFrozen(value),true);
  assert.notEqual(s,t);assert.notEqual(s.draws,t.draws);assert.notEqual(s.draws[0],t.draws[0]);assert.notEqual(s.draws[0].mvp,t.draws[0].mvp);
  source.projection.far=3;source.draws[0].modelView[0]=9;source.draws.length=0;tuple(s.draws[0].mvp,ORTHO);
  assert.throws(()=>{g.positions[0]=7;},TypeError);assert.throws(()=>{s.draws[0].mvp[0]=2;},TypeError);
  const a=createSceneFrame3D({projection:projection(),draws:[]}),b=createSceneFrame3D({projection:projection(),draws:[]});
  assert.equal(isSceneFrame3D(a),true);assert.notEqual(a,b);assert.notEqual(a.draws,b.draws);assert.notEqual(a.geometries,b.geometries);
  assert.deepEqual(a,{draws:[],geometries:[],cpuLogicalBytes:0,sceneBytes:0,uniformBytes:0});
});
test('public identity predicates and origin functions observe no foreign field or prototype',()=>{
  const g=triangle(),s=createSceneFrame3D(sceneInput(g));let reads=0;
  const hostile=new Proxy({}, {get(){reads++;throw 'field';},getOwnPropertyDescriptor(){reads++;throw 'own';},getPrototypeOf(){reads++;throw 'prototype';}});
  const revoked=Proxy.revocable({},{});revoked.revoke();
  for(const value of [undefined,null,0,'x',()=>{},hostile,revoked.proxy,{...g},new Proxy(g,{}),{...s},new Proxy(s,{})]) {
    assert.equal(isMeshGeometry3D(value),false);assert.equal(isSceneFrame3D(value),false);
    assert.equal(getMeshGeometry3DErrorOrigin(value),undefined);assert.equal(getScene3DErrorOrigin(value),undefined);
  }
  assert.equal(reads,0);
  assert.equal(getMeshGeometry3DErrorOrigin(new MeshGeometry3DError('MESH3D_BUDGET')),undefined);
  assert.equal(getScene3DErrorOrigin(new Scene3DError('SCENE3D_BUDGET')),undefined);
});
test('public geometry getters are read once and full payload capture precedes semantics',()=>{
  const raw=triangleInput(),reads={},input={};
  for(const key of ['positions','colors','indices'])sourceGetter(input,key,raw[key],reads);
  for(const [key,array]of Object.entries(raw))for(let i=0;i<array.length;i++){const n=array[i];Object.defineProperty(array,String(i),{get(){reads[key+':'+i]=(reads[key+':'+i]??0)+1;return n;}});}
  const g=createMeshGeometry3D(input);assert.equal(isMeshGeometry3D(g),true);for(const count of Object.values(reads))assert.equal(count,1);
  const token=Symbol('later capture'),bad=triangleInput();bad.positions[0]=NaN;Object.defineProperty(bad.indices,'2',{get(){throw token;}});
  meshFailure(()=>createMeshGeometry3D(bad),'MESH3D_INPUT_READ_FAILED','source',token);
});
test('public scene forwards once through top projection draw and model getters',()=>{
  const g=triangle(),counts={},model=[...ID],draw={},p={},top={};
  for(const [key,value]of Object.entries(projection()))sourceGetter(p,key,value,counts);
  sourceGetter(draw,'geometry',g,counts);sourceGetter(draw,'modelView',model,counts);
  sourceGetter(top,'projection',p,counts);sourceGetter(top,'draws',[draw],counts);
  for(let i=0;i<16;i++){const n=model[i];Object.defineProperty(model,String(i),{get(){counts['model:'+i]=(counts['model:'+i]??0)+1;return n;}});}
  const s=createSceneFrame3D(top);tuple(s.draws[0].mvp,ORTHO);for(const count of Object.values(counts))assert.equal(count,1);
});
test('public factory errors retain class origin and exact original source causes',()=>{
  const priorMesh=meshFailure(()=>createMeshGeometry3D(null)),priorScene=sceneFailure(()=>createSceneFrame3D(null));
  for(const token of [undefined,null,17,Symbol('cause'),new Error('caller'),priorMesh,priorScene]) {
    const mesh={get positions(){throw token;}};const e=meshFailure(()=>createMeshGeometry3D(mesh),'MESH3D_INPUT_READ_FAILED','source',token);
    assert.equal(getMeshGeometry3DErrorOrigin(new Proxy(e,{})),undefined);
    const input={get projection(){throw token;}};sceneFailure(()=>createSceneFrame3D(input),'SCENE3D_INPUT_READ_FAILED','source',token);
    const model=sceneInput();Object.defineProperty(model.draws[0].modelView,'15',{get(){throw token;}});
    const wrapped=sceneFailure(()=>createSceneFrame3D(model),'SCENE3D_INPUT_READ_FAILED','source');
    assert.equal(wrapped.cause.code,'MATH3D_INPUT_READ_FAILED');assert.equal(wrapped.cause.cause,token);
  }
});
test('public runtime shape policy accepts cross-realm Arrays and refuses typed arrays holes inherited slots and foreign geometry',()=>{
  const cross=vm.runInNewContext('({positions:[0,0,-1,1,0,-1,0,1,-1],colors:[1,0,0,0,1,0,0,0,1],indices:[0,1,2]})');
  assert.equal(isMeshGeometry3D(createMeshGeometry3D(cross)),true);
  for(const field of ['positions','colors','indices']){const a=triangleInput();a[field]=new Float32Array(a[field]);meshFailure(()=>createMeshGeometry3D(a));}
  const hole=triangleInput();delete hole.positions[0];const proto=Object.create(Array.prototype);Object.defineProperty(proto,'0',{get(){throw 'inherited';}});Object.setPrototypeOf(hole.positions,proto);meshFailure(()=>createMeshGeometry3D(hole));
  let reads=0;const foreign=new Proxy({}, {get(){reads++;throw 'foreign';},getOwnPropertyDescriptor(){reads++;throw 'own';}});
  for(const g of [foreign,{...triangle()},new Proxy(triangle(),{})])sceneFailure(()=>createSceneFrame3D(sceneInput(g)));
  assert.equal(reads,0);
  for(const value of [new Float32Array(16),new Set(ID)])sceneFailure(()=>createSceneFrame3D(sceneInput(triangle(),value)));
});
test('public geometry validation covers finite RGB index triangle shape and signed zero',()=>{
  for(const [field,index,value]of [['positions',8,NaN],['positions',8,Infinity],['colors',8,-.5],['colors',8,1.5],['indices',2,3],['indices',2,.5]]){const a=triangleInput();a[field][index]=value;meshFailure(()=>createMeshGeometry3D(a));}
  for(const input of [{positions:[],colors:[],indices:[0,0,0]},{positions:[0,0,0],colors:[0,0,0],indices:[0,0,0]},{positions:[0,0,0,0],colors:[0,0,0,0],indices:[0,0,0]}])meshFailure(()=>createMeshGeometry3D(input));
  const a=triangleInput();a.positions[0]=-0;a.colors[0]=-0;a.indices[0]=-0;const g=createMeshGeometry3D(a);
  for(const n of [g.positions[0],g.colors[0],g.indices[0]])assert.equal(Object.is(n,0),true);
});
test('public literal perspective orthographic translation and camera frustum precedence',()=>{
  const g=triangle(),perspective={kind:'perspective',left:-1,right:1,bottom:-1,top:1,near:1,far:2};
  tuple(createSceneFrame3D({projection:perspective,draws:[{geometry:g,modelView:ID}]}).draws[0].mvp,PERSPECTIVE);
  tuple(createSceneFrame3D(sceneInput(g)).draws[0].mvp,ORTHO);
  tuple(createSceneFrame3D(sceneInput(g,[1,0,0,0,0,1,0,0,0,0,1,0,.5,0,-1,1])).draws[0].mvp,[1,0,0,0,0,1,0,0,0,0,.5,0,.5,0,.5,1]);
  // At z=-1/-2 perspective literal numerator/denominator gives 1/0.
  assert.deepEqual([-PERSPECTIVE[10]+PERSPECTIVE[14],-2*PERSPECTIVE[10]+PERSPECTIVE[14]],[1,0]);
  for(const p of [{...projection(),right:-1},{...projection(),far:0},{...perspective,near:0},{...projection(),near:-1}])sceneFailure(()=>createSceneFrame3D({projection:p,draws:[]}));
  const input=sceneInput();input.projection.kind='wrong';const token=Symbol('model-before-projection');Object.defineProperty(input.draws[0].modelView,'15',{get(){throw token;}});
  assert.equal(sceneFailure(()=>createSceneFrame3D(input),'SCENE3D_INPUT_READ_FAILED','source').cause.cause,token);
});
test('public raw homogeneous w retains camera crossings without CPU culling or division',()=>{
  const g=createMeshGeometry3D({positions:[0,0,0,0,0,1,0,0,-3],colors:[1,0,0,0,1,0,0,0,1],indices:[0,1,2]});
  const s=createSceneFrame3D({projection:{kind:'perspective',left:-1,right:1,bottom:-1,top:1,near:1,far:2},draws:[{geometry:g,modelView:ID}]});
  tuple(s.draws[0].mvp,PERSPECTIVE);assert.equal(s.draws.length,1);assert.equal(s.draws[0].geometry,g);assert.deepEqual(g.positions,[0,0,0,0,0,1,0,0,-3]);
  const m=s.draws[0].mvp;assert.deepEqual([m[11]*g.positions[2]+m[15],m[11]*g.positions[5]+m[15],m[11]*g.positions[8]+m[15]],[0,-1,3]);
});
test('public scene precision applies to geometry and final MVP with exact normal f32 boundaries',()=>{
  for(const n of [1.1754943508222875e-38,-1.1754943508222875e-38,3.4028234663852886e38,-3.4028234663852886e38]){const a=sceneInput(empty());a.draws[0].modelView[0]=n;assert.equal(createSceneFrame3D(a).draws[0].mvp[0],n);}
  for(const n of [1.1754942106924411e-38,1.401298464324817e-45,5e-324,3.402823669209385e38,.1]){const a=sceneInput(empty());a.draws[0].modelView[0]=n;sceneFailure(()=>createSceneFrame3D(a),'SCENE3D_PRECISION_UNSUPPORTED');}
  for(const field of ['positions','colors']){const raw=triangleInput();raw[field][8]=.1;const g=createMeshGeometry3D(raw);assert.equal(isMeshGeometry3D(g),true);sceneFailure(()=>createSceneFrame3D(sceneInput(g)),'SCENE3D_PRECISION_UNSUPPORTED');}
  const a=sceneInput(empty());a.projection={kind:'orthographic',left:0,right:2**-127,bottom:-1,top:1,near:0,far:2};a.draws[0].modelView[0]=2**-128;
  assert.equal(createSceneFrame3D(a).draws[0].mvp[0],1);
});
test('public arithmetic headroom accepts the cap and refuses next f32 and absolute cancellation',()=>{
  const point=n=>createMeshGeometry3D({positions:[n,0,0,n,0,0,n,0,0],colors:[0,0,0,0,0,0,0,0,0],indices:[0,1,2]});
  assert.equal(createSceneFrame3D(sceneInput(point(1.329227995784916e36))).sceneBytes,84);
  sceneFailure(()=>createSceneFrame3D(sceneInput(point(1.329228154241241e36))),'SCENE3D_ARITHMETIC_RANGE');
  const g=createMeshGeometry3D({positions:[1,1,1,1,1,1,1,1,1],colors:[0,0,0,0,0,0,0,0,0],indices:[0,1,2]});
  const model=[6.64613997892458e35,0,0,0,6.64613997892458e35,1,0,0,-6.64613997892458e35,0,1,0,0,0,0,1];
  sceneFailure(()=>createSceneFrame3D(sceneInput(g,model)),'SCENE3D_ARITHMETIC_RANGE');
});
test('public identity accounting charges repeated distinct empty and unreferenced geometry literally',()=>{
  const a=triangle(),b=triangle();let s=createSceneFrame3D({projection:projection(),draws:[{geometry:a,modelView:ID},{geometry:a,modelView:ID}]});
  assert.deepEqual([s.cpuLogicalBytes,s.sceneBytes,s.uniformBytes],[168,84,128]);assert.deepEqual(s.geometries,[a]);
  s=createSceneFrame3D({projection:projection(),draws:[{geometry:a,modelView:ID},{geometry:b,modelView:ID}]});assert.deepEqual([s.cpuLogicalBytes,s.sceneBytes,s.uniformBytes],[336,168,128]);assert.deepEqual(s.geometries,[a,b]);
  const e=empty();s=createSceneFrame3D({projection:projection(),draws:[{geometry:e,modelView:ID},{geometry:e,modelView:ID}]});assert.deepEqual([s.cpuLogicalBytes,s.sceneBytes,s.uniformBytes],[0,0,128]);assert.equal(s.geometries.length,1);
  const g=createMeshGeometry3D({positions:[0,0,0,1,0,0,0,1,0,2,2,2],colors:[1,0,0,1,0,0,1,0,0,1,0,0],indices:[0,1,2]});
  s=createSceneFrame3D(sceneInput(g));assert.deepEqual([s.cpuLogicalBytes,s.sceneBytes,s.uniformBytes],[216,108,64]);
});
test('public draw budget refuses 65 before projection payload and admits 64 empty identities',()=>{
  const s=createSceneFrame3D({projection:projection(),draws:Array.from({length:64},()=>({geometry:empty(),modelView:ID}))});
  assert.deepEqual([s.geometries.length,s.uniformBytes,s.cpuLogicalBytes,s.sceneBytes],[64,4096,0,0]);let reads=0;
  const draws=new Proxy(new Array(65),{get(t,k){if(k==='length')return 65;reads++;throw 'payload';}});
  const p=new Proxy({}, {get(){reads++;throw 'projection';}});sceneFailure(()=>createSceneFrame3D({projection:p,draws}),'SCENE3D_BUDGET','budget');assert.equal(reads,0);
});
test('public geometry count and CPU budgets reject before indexed payload reads',()=>{
  for(const [p,c,i]of [[196611,196611,3],[9,9,196611],[196608,196608,131073]]) {
    let reads=0;const array=length=>new Proxy(new Array(length),{get(t,k){if(k==='length')return length;reads++;throw 'payload';}});
    meshFailure(()=>createMeshGeometry3D({positions:array(p),colors:array(c),indices:array(i)}),'MESH3D_BUDGET','budget');assert.equal(reads,0);
  }
  const g=createMeshGeometry3D({positions:triangleInput().positions,colors:triangleInput().colors,indices:new Array(196608).fill(0)});
  assert.deepEqual([g.vertexCount,g.indexCount,g.logicalBytes],[3,196608,1573008]);
});
test('public reachable aggregate CPU and packed limits use authentic near-cap values',()=>{
  const max=()=>createMeshGeometry3D({positions:new Array(196608).fill(0),colors:new Array(196608).fill(0),indices:new Array(131070).fill(0)});
  const a=max(),b=max();assert.equal(a.logicalBytes,4194288);
  const s=createSceneFrame3D({projection:projection(),draws:[{geometry:a,modelView:ID},{geometry:b,modelView:ID}]});
  assert.deepEqual([s.cpuLogicalBytes,s.sceneBytes,s.uniformBytes],[8388576,4194288,128]);
  sceneFailure(()=>createSceneFrame3D({projection:projection(),draws:[{geometry:a,modelView:ID},{geometry:b,modelView:ID},{geometry:triangle(),modelView:ID}]}),'SCENE3D_BUDGET','budget');
  // CPU/packed limits are coupled; neither cap equality nor defensive packing
  // overflow is claimed. A 65th identity/uniform overflow hits draw admission.
});

// Matrix authoring stays on the built public namespace. Missing exports must
// fail these assertions on the old SDK, never module linking or setup.
import * as matrixAuthoringPublic from '@egret/engine/scene3d';
function matrixAuthoringAPI(){
  for(const name of ['createMatrix4','multiplyMatrix4','Math3DError'])
    assert.equal(typeof matrixAuthoringPublic[name],'function','public-matrix-api missing '+name);
  return matrixAuthoringPublic;
}
// Literal column-major answers: parent rotates +90 degrees about z; local
// translates +3 along x. Parent*local therefore translates +3 along y.
const MATRIX_PARENT=[0,1,0,0,-1,0,0,0,0,0,1,0,0,0,0,1];
const MATRIX_LOCAL=[1,0,0,0,0,1,0,0,0,0,1,0,3,0,0,1];
const MATRIX_COMPOSED=[0,1,0,0,-1,0,0,0,0,0,1,0,0,3,0,1];

test('public-matrix-authoring-owned-array',()=>{
  const {createMatrix4}=matrixAuthoringAPI(),source=[...ID];
  const matrix=createMatrix4(source),other=createMatrix4(source);
  tuple(matrix,ID);tuple(other,ID);assert.deepEqual(source,ID);
  assert.notEqual(matrix,source);assert.notEqual(matrix,other);
  source[0]=9;tuple(matrix,ID);tuple(other,ID);
});
test('public-matrix-composition-literal-order',()=>{
  const {createMatrix4,multiplyMatrix4}=matrixAuthoringAPI();
  const parent=createMatrix4(MATRIX_PARENT),local=createMatrix4(MATRIX_LOCAL);
  const composed=multiplyMatrix4(parent,local),reversed=multiplyMatrix4(local,parent);
  tuple(composed,MATRIX_COMPOSED);
  tuple(reversed,[0,1,0,0,-1,0,0,0,0,0,1,0,3,0,0,1]);
  assert.notDeepEqual(composed,reversed);
  assert.notEqual(composed,parent);assert.notEqual(composed,local);
  tuple(parent,MATRIX_PARENT);tuple(local,MATRIX_LOCAL);
});
test('public-matrix-original-diagnostic',()=>{
  const {createMatrix4,multiplyMatrix4,Math3DError}=matrixAuthoringAPI();
  const invalid=caught(()=>createMatrix4([]));
  assert.ok(invalid instanceof Math3DError);assert.equal(invalid.constructor,Math3DError);
  assert.equal(invalid.name,'Math3DError');assert.equal(invalid.code,'MATH3D_INPUT_INVALID');
  assert.equal(invalid.cause,undefined);
  const cause={id:'public-matrix-caller-cause'},source=[...ID];
  Object.defineProperty(source,'15',{get(){throw cause;}});
  const failure=caught(()=>createMatrix4(source));
  assert.ok(failure instanceof Math3DError);assert.equal(failure.constructor,Math3DError);
  assert.equal(failure.code,'MATH3D_INPUT_READ_FAILED');assert.equal(failure.cause,cause);
  const productFailure=caught(()=>multiplyMatrix4(createMatrix4(ID),source));
  assert.ok(productFailure instanceof Math3DError);assert.equal(productFailure.constructor,Math3DError);
  assert.equal(productFailure.code,'MATH3D_INPUT_READ_FAILED');assert.equal(productFailure.cause,cause);
  // The existing scene factory invokes original math and retains its error as
  // cause. Compare that actual class, without importing any private module.
  const sceneSource=sceneInput();sceneSource.draws[0].modelView=source;
  const wrapped=sceneFailure(()=>createSceneFrame3D(sceneSource),'SCENE3D_INPUT_READ_FAILED','source');
  assert.equal(wrapped.cause.constructor,Math3DError);
  assert.ok(wrapped.cause instanceof Math3DError);
  assert.equal(wrapped.cause.code,'MATH3D_INPUT_READ_FAILED');
  assert.equal(wrapped.cause.cause,cause);
});
test('public-composed-matrix-scene-admission',()=>{
  const {createMatrix4,multiplyMatrix4}=matrixAuthoringAPI();
  const composed=multiplyMatrix4(createMatrix4(MATRIX_PARENT),createMatrix4(MATRIX_LOCAL));
  const geometry=triangle(),scene=createSceneFrame3D(sceneInput(geometry,composed));
  assert.equal(isSceneFrame3D(scene),true);assert.equal(scene.draws[0].geometry,geometry);
  tuple(composed,MATRIX_COMPOSED);
  // This admitted orthographic MVP is independent literal data. General
  // binary64 matrices still face the original scene precision/budget gates.
  tuple(scene.draws[0].mvp,[0,1,0,0,-1,0,0,0,0,0,.5,0,0,3,1,1]);
  assert.notEqual(scene.draws[0].mvp,composed);
  assert.deepEqual([scene.cpuLogicalBytes,scene.sceneBytes,scene.uniformBytes],[168,84,64]);
});
