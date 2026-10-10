import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {createSceneFrame3D, isSceneFrame3D, Scene3DError, getScene3DErrorOrigin} from '../packages/engine/dist/rendering/sceneFrame3D.js';
import {createMeshGeometry3D} from '../packages/engine/dist/rendering/meshGeometry3D.js';
import {Math3DError} from '../packages/engine/dist/rendering/matrix4.js';

// Newly authored fixed CPU witnesses. Production math never builds an expected
// matrix/charge, and these tests make no graphics or performance assertion.
const ID=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
const BASE=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,-1,1];
const projection=()=>({kind:'orthographic',left:-1,right:1,bottom:-1,top:1,near:0,far:1});
const triangle=()=>createMeshGeometry3D({positions:[-1.25,.5,-3,.75,.5,-3,-.25,1.5,-3],colors:[1,.5,0,0,1,.5,.5,0,1],indices:[0,1,2]});
const empty=()=>createMeshGeometry3D({positions:[],colors:[],indices:[]});
const input=(geometry=triangle(),modelView=[...BASE])=>({projection:projection(),draws:[{geometry,modelView}]});
function thrown(action){let error,didThrow=false;try{action();}catch(value){error=value;didThrow=true;}assert.equal(didThrow,true,'factory must reject');return error;}
function failure(action,code='SCENE3D_INPUT_INVALID',origin='validation',cause){const error=thrown(action);assert.ok(error instanceof Scene3DError);assert.equal(error.code,code);assert.equal(getScene3DErrorOrigin(error),origin);assert.equal(error.cause,cause);return error;}
function tuple(actual,expected){assert.deepEqual(actual,expected);assert.equal(Array.isArray(actual),true);assert.equal(Object.isFrozen(actual),true);for(const n of actual)if(n===0)assert.equal(Object.is(n,0),true);}
function traceRecord(target,label,trace){return new Proxy(target,{getOwnPropertyDescriptor(t,k){trace.push(`own:${label}:${String(k)}`);return Reflect.getOwnPropertyDescriptor(t,k);},get(t,k,r){trace.push(`get:${label}:${String(k)}`);return Reflect.get(t,k,r);}});}
const causes=()=>[undefined,null,17,Symbol('cause'),{code:'MATH3D_ARITHMETIC_RANGE'},new Math3DError('MATH3D_ARITHMETIC_RANGE'),new Scene3DError('SCENE3D_BUDGET')];

test('scene_literal_identity_owns_frozen_outputs_and_retains_only_geometry',()=>{
 const g=triangle(),source=input(g),a=createSceneFrame3D(source),b=createSceneFrame3D(source);
 assert.equal(isSceneFrame3D(a),true);assert.deepEqual(Object.keys(a),['draws','geometries','cpuLogicalBytes','sceneBytes','uniformBytes']);
 assert.deepEqual([a.cpuLogicalBytes,a.sceneBytes,a.uniformBytes],[168,84,64]);assert.equal(a.draws[0].geometry,g);assert.deepEqual(a.geometries,[g]);tuple(a.draws[0].mvp,ID);
 for(const part of [a,a.draws,a.geometries,a.draws[0],a.draws[0].mvp])assert.equal(Object.isFrozen(part),true);
 for(const part of ['draws','geometries'])assert.notEqual(a[part],b[part]);assert.notEqual(a,b);assert.notEqual(a.draws[0],b.draws[0]);assert.notEqual(a.draws[0].mvp,b.draws[0].mvp);
 source.draws[0].modelView[0]=9;source.draws.length=0;source.projection.far=2;const copy=[...a.draws[0].mvp];copy[0]=99;tuple(a.draws[0].mvp,ID);
 assert.throws(()=>{a.draws[0].mvp[0]=7;},TypeError);
});
test('scene_empty_calls_have_fresh_frozen_empty_arrays_and_zero_charges',()=>{
 const a=createSceneFrame3D({projection:projection(),draws:[]}),b=createSceneFrame3D({projection:projection(),draws:[]});
 assert.deepEqual(a,{draws:[],geometries:[],cpuLogicalBytes:0,sceneBytes:0,uniformBytes:0});assert.equal(isSceneFrame3D(a),true);
 for(const key of ['draws','geometries']){assert.equal(Object.isFrozen(a[key]),true);assert.notEqual(a[key],b[key]);}assert.notEqual(a,b);
});
test('scene_and_error_identity_never_observe_foreign_properties',()=>{
 const a=createSceneFrame3D(input()),real=failure(()=>createSceneFrame3D(null)),bad=()=>{throw Error('identity inspected');};
 const revoked=Proxy.revocable({},{});revoked.revoke();
 for(const value of [null,undefined,0,'scene',()=>{},new Proxy({}, {get:bad,getPrototypeOf:bad,getOwnPropertyDescriptor:bad}),revoked.proxy,{...a},new Proxy(a,{})]){assert.equal(isSceneFrame3D(value),false);assert.equal(getScene3DErrorOrigin(value),undefined);}
 for(const value of [new Scene3DError('SCENE3D_BUDGET'),{code:'SCENE3D_INPUT_INVALID'},new Proxy(real,{})])assert.equal(getScene3DErrorOrigin(value),undefined);
});
test('scene_foreign_geometry_refuses_without_reading_its_fields',()=>{
 const foreign=new Proxy({}, {get(){throw 'foreign read';},getOwnPropertyDescriptor(){throw 'foreign own';}});
 for(const g of [foreign,{...triangle()},new Proxy(triangle(),{})])failure(()=>createSceneFrame3D(input(g)));
});
test('scene_own_field_and_slot_capture_order_ignores_extra_machinery',()=>{
 const trace=[],g=triangle(),p=projection(),m=[...BASE],draw={geometry:g,modelView:m},draws=[draw],top={projection:p,draws};
 for(const obj of [top,p,draw,m,draws])for(const key of [Symbol.iterator,'toJSON',Symbol.toPrimitive,'extra','depthRange','depthDirection'])Object.defineProperty(obj,key,{get(){throw 'ignored';}});
 top.projection=traceRecord(p,'projection',trace);top.draws=traceRecord(draws,'draws',trace);draws[0]=traceRecord(draw,'draw',trace);draw.modelView=traceRecord(m,'model',trace);
 createSceneFrame3D(traceRecord(top,'top',trace));
 const expected=['own:top:projection','get:top:projection','own:top:draws','get:top:draws','own:draws:length','get:draws:length'];
 for(const key of ['kind','left','right','bottom','top','near','far'])expected.push(`own:projection:${key}`,`get:projection:${key}`);
 expected.push('own:draws:0','get:draws:0','own:draw:geometry','get:draw:geometry','own:draw:modelView','get:draw:modelView','get:model:length');
 for(let i=0;i<16;i++)expected.push(`own:model:${i}`,`get:model:${i}`);
 assert.deepEqual(trace,expected);
});
test('scene_source_fault_precedence_top_projection_draw_indices_and_fields',()=>{
 for(const token of causes()){
  const top={};Object.defineProperty(top,'draws',{get(){throw token;}});failure(()=>createSceneFrame3D(top),'SCENE3D_INPUT_READ_FAILED','source',token);
  const a=input();a.projection.kind='bad';Object.defineProperty(a.draws[0],'modelView',{get(){throw token;}});failure(()=>createSceneFrame3D(a),'SCENE3D_INPUT_READ_FAILED','source',token);
  const b=input();delete b.projection.left;Object.defineProperty(b.draws,'0',{get(){throw token;}});failure(()=>createSceneFrame3D(b),'SCENE3D_INPUT_READ_FAILED','source',token);
  const c=input();c.draws.length=2;delete c.draws[0];Object.defineProperty(c.draws,'1',{get(){throw token;}});failure(()=>createSceneFrame3D(c),'SCENE3D_INPUT_READ_FAILED','source',token);
  const d=input();delete d.draws[0].geometry;d.draws.push({geometry:triangle(),get modelView(){throw token;}});failure(()=>createSceneFrame3D(d),'SCENE3D_INPUT_READ_FAILED','source',token);
 }
});
test('scene_holes_and_inherited_required_properties_are_not_read',()=>{
 const a=input(),p={...a.projection};delete p.left;Object.setPrototypeOf(p,{get left(){throw 'inherited projection';}});a.projection=p;failure(()=>createSceneFrame3D(a));
 const b=input(),proto=Object.create(Array.prototype);Object.defineProperty(proto,'0',{get(){throw 'inherited draw';}});delete b.draws[0];Object.setPrototypeOf(b.draws,proto);failure(()=>createSceneFrame3D(b));
 const c=input();delete c.draws[0].geometry;Object.setPrototypeOf(c.draws[0],{get geometry(){throw 'inherited geometry';}});failure(()=>createSceneFrame3D(c));
});
test('scene_draw_quota_and_shape_refuse_before_payload_or_projection_reads',()=>{
 let reads=0;const draws=new Proxy(new Array(65),{get(t,k){if(k==='length')return 65;reads++;throw 'payload';}}),p=new Proxy({}, {get(){reads++;throw 'projection';}});
 failure(()=>createSceneFrame3D({projection:p,draws}),'SCENE3D_BUDGET','budget');assert.equal(reads,0);
 for(const value of [null,undefined,17,()=>{},new Float32Array(1),{get length(){throw 'length';}}])failure(()=>createSceneFrame3D({projection:projection(),draws:value}));
 const malformed=new Proxy([],{get(t,k){if(k==='length')return NaN;throw 'payload';}});failure(()=>createSceneFrame3D({projection:projection(),draws:malformed}));
});
test('scene_record_shape_refusal_stops_later_payload_fields',()=>{
 const a=input();a.draws=[17,{get geometry(){throw 'later field';}}];failure(()=>createSceneFrame3D(a));
 for(const value of [null,undefined,[],17,'projection']){const b=input();b.projection=value;failure(()=>createSceneFrame3D(b));}
 for(const kind of ['bad',null,0]){const b=input();b.projection.kind=kind;failure(()=>createSceneFrame3D(b));}
});
test('scene_cross_realm_array_records_are_captured_without_iteration',()=>{
 const a=vm.runInNewContext('({projection:{kind:"orthographic",left:-1,right:1,bottom:-1,top:1,near:0,far:1},draws:[{modelView:[1,0,0,0,0,1,0,0,0,0,1,0,0,0,-1,1]}]})');a.draws[0].geometry=triangle();tuple(createSceneFrame3D(a).draws[0].mvp,ID);
});
test('scene_B0_model_capture_preserves_wrapper_cause_and_local_precedence',()=>{
 for(const token of causes()){
  const a=input();a.draws[0].modelView[0]='bad';Object.defineProperty(a.draws[0].modelView,'15',{get(){throw token;}});
  const e=thrown(()=>createSceneFrame3D(a));assert.equal(e.code,'SCENE3D_INPUT_READ_FAILED');assert.equal(getScene3DErrorOrigin(e),'source');assert.ok(e.cause instanceof Math3DError);assert.equal(e.cause.code,'MATH3D_INPUT_READ_FAILED');assert.equal(e.cause.cause,token);
 }
 const a=input();a.draws[0].modelView[0]=NaN;let later=0;a.draws.push({geometry:triangle(),modelView:new Proxy([...BASE],{get(){later++;throw 'model1';}})});
 const e=thrown(()=>createSceneFrame3D(a));assert.equal(e.code,'SCENE3D_INPUT_INVALID');assert.equal(getScene3DErrorOrigin(e),'validation');assert.equal(e.cause.code,'MATH3D_INPUT_INVALID');assert.equal(later,0);
});
test('scene_model_calls_complete_before_projection_semantics_and_reflect_alias_mutation',()=>{
 const a=input();a.projection.kind='bad';const token=Symbol('model before kind');Object.defineProperty(a.draws[0].modelView,'15',{get(){throw token;}});assert.equal(thrown(()=>createSceneFrame3D(a)).cause.cause,token);
 const g=triangle(),model=[...BASE];let captures=0;const aliased=new Proxy(model,{get(t,k){if(k==='length'&&++captures===2)t[0]=2;return Reflect.get(t,k);}});
 const scene=createSceneFrame3D({projection:projection(),draws:[{geometry:g,modelView:aliased},{geometry:g,modelView:aliased}]});tuple(scene.draws[0].mvp,ID);tuple(scene.draws[1].mvp,[2,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);assert.equal(captures,2);
});
test('scene_asymmetric_perspective_has_independent_literal_P_times_model',()=>{
 const a=input();a.projection={kind:'perspective',left:-3,right:1,bottom:-1,top:7,near:2,far:6};a.draws[0].modelView=[2,0,0,0,0,4,0,0,0,0,1,0,1,-2,-4,1];
 tuple(createSceneFrame3D(a).draws[0].mvp,[2,0,0,0,0,2,0,0,-.5,.75,.5,-1,3,-4,1,4]);
 const identity=input(triangle(),ID);identity.projection=a.projection;tuple(createSceneFrame3D(identity).draws[0].mvp,[1,0,0,0,0,.5,0,0,-.5,.75,.5,-1,0,0,3,0]);
});
test('scene_asymmetric_orthographic_and_reverse_endpoints_are_literal',()=>{
 const a=input();a.projection={kind:'orthographic',left:-3,right:5,bottom:-7,top:1,near:0,far:4};a.draws[0].modelView=[2,0,0,0,0,1,0,0,0,0,4,0,1,-3,-2,1];tuple(createSceneFrame3D(a).draws[0].mvp,[.5,0,0,0,0,.25,0,0,0,0,1,0,0,0,.5,1]);
 const b=input(empty(),ID);b.projection=a.projection;tuple(createSceneFrame3D(b).draws[0].mvp,[.25,0,0,0,0,.25,0,0,0,0,.25,0,-.25,.75,1,1]);
});
test('scene_keeps_zero_negative_w_and_near_crossing_geometry_without_division',()=>{
 const g=createMeshGeometry3D({positions:[0,0,0,0,0,1,0,0,-3],colors:[1,0,0,0,1,0,0,0,1],indices:[0,1,2]}),a=input(g,ID);a.projection={kind:'perspective',left:-3,right:1,bottom:-1,top:7,near:2,far:6};
 const s=createSceneFrame3D(a);assert.equal(s.draws[0].geometry,g);assert.equal(s.draws.length,1);tuple(s.draws[0].mvp,[1,0,0,0,0,.5,0,0,-.5,.75,.5,-1,0,0,3,0]);
});
test('scene_B0_geometry_and_arithmetic_failures_are_mapped_only_at_invocation',()=>{
 for(const p of [{...projection(),left:1,right:1},{...projection(),near:-1}]){const a=input();a.projection=p;const e=thrown(()=>createSceneFrame3D(a));assert.equal(e.code,'SCENE3D_INPUT_INVALID');assert.equal(e.cause.code,'MATH3D_GEOMETRY_INVALID');assert.equal(getScene3DErrorOrigin(e),'validation');}
 const a=input();a.projection={...projection(),left:-Number.MAX_VALUE,right:Number.MAX_VALUE};let e=thrown(()=>createSceneFrame3D(a));assert.equal(e.code,'SCENE3D_ARITHMETIC_RANGE');assert.equal(e.cause.code,'MATH3D_ARITHMETIC_RANGE');
 const b=input(empty(),[1e308,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);b.projection={kind:'perspective',left:-.5,right:.5,bottom:-.5,top:.5,near:1,far:2};e=thrown(()=>createSceneFrame3D(b));assert.equal(e.code,'SCENE3D_ARITHMETIC_RANGE');assert.equal(e.cause.code,'MATH3D_ARITHMETIC_RANGE');
 const token=new Math3DError('MATH3D_ARITHMETIC_RANGE'),c=input();Object.defineProperty(c.projection,'left',{get(){throw token;}});failure(()=>createSceneFrame3D(c),'SCENE3D_INPUT_READ_FAILED','source',token);
});
test('scene_exact_normal_f32_edges_apply_to_geometry_and_all_MVP_coefficients',()=>{
 for(const n of [1.1754943508222875e-38,-1.1754943508222875e-38,3.4028234663852886e38,-3.4028234663852886e38]){const a=input(empty());a.draws[0].modelView[0]=n;assert.equal(createSceneFrame3D(a).draws[0].mvp[0],n);}
 for(const n of [1.1754942106924411e-38,1.401298464324817e-45,5e-324,3.402823669209385e38,.1]){const a=input(empty());a.draws[0].modelView[0]=n;failure(()=>createSceneFrame3D(a),'SCENE3D_PRECISION_UNSUPPORTED');}
 for(let slot=0;slot<16;slot++){const a=input(empty());a.draws[0].modelView[slot]=.1;failure(()=>createSceneFrame3D(a),'SCENE3D_PRECISION_UNSUPPORTED');}
 const g=createMeshGeometry3D({positions:[1.1754943508222875e-38,0,0,-1.1754943508222875e-38,0,0,0,0,0],colors:[0,0,0,0,0,0,0,0,0],indices:[0,1,2]});assert.equal(createSceneFrame3D(input(g)).sceneBytes,84);
});
test('scene_unreferenced_position_and_last_RGB_are_still_profiled',()=>{
 for(const kind of ['position','color']){const positions=[0,0,0,1,0,0,0,1,0,2,2,2],colors=[1,0,0,1,0,0,1,0,0,1,0,0];if(kind==='position')positions[11]=.1;else colors[11]=.1;const g=createMeshGeometry3D({positions,colors,indices:[0,1,2]});failure(()=>createSceneFrame3D(input(g)),'SCENE3D_PRECISION_UNSUPPORTED');}
});
test('scene_model_binary64_is_allowed_when_final_MVP_is_exact_normal',()=>{
 const a=input(empty());
 // A binary64 model below the normal float32 range and a huge projection scale compose to exact1;
 // only the final MVP is restricted to the exact-normal-f32 profile.
 a.projection={kind:'orthographic',left:0,right:2**-127,bottom:-1,top:1,near:0,far:1};a.draws[0].modelView[0]=2**-128;
 const s=createSceneFrame3D(a);assert.equal(s.draws[0].mvp[0],1);assert.equal(s.draws[0].mvp[12],-1);
});
test('scene_normalizes_signed_zero_in_published_MVP',()=>{const a=input(empty());for(let i=0;i<16;i++)if(a.draws[0].modelView[i]===0)a.draws[0].modelView[i]=-0;tuple(createSceneFrame3D(a).draws[0].mvp,ID);});
function pointGeometry(point){return createMeshGeometry3D({positions:[...point,...point,...point],colors:[0,0,0,0,0,0,0,0,0],indices:[0,1,2]});}
test('scene_headroom_cap_next_f32_and_abs_cancellation_use_literal_witnesses',()=>{
 assert.equal(createSceneFrame3D(input(pointGeometry([1.329227995784916e36,0,0]))).sceneBytes,84);
 failure(()=>createSceneFrame3D(input(pointGeometry([1.329228154241241e36,0,0]))),'SCENE3D_ARITHMETIC_RANGE');
 const model=[6.64613997892458e35,0,0,0,6.64613997892458e35,1,0,0,0,0,1,0,0,0,-1,1];assert.equal(createSceneFrame3D(input(pointGeometry([1,1,0]),model)).sceneBytes,84);
 failure(()=>createSceneFrame3D(input(pointGeometry([1.0000001192092896,1,0]),model)),'SCENE3D_ARITHMETIC_RANGE');
 model[8]=-6.64613997892458e35;failure(()=>createSceneFrame3D(input(pointGeometry([1,1,1]),model)),'SCENE3D_ARITHMETIC_RANGE');
 failure(()=>createSceneFrame3D(input(pointGeometry([3.4028234663852886e38,0,0]))),'SCENE3D_ARITHMETIC_RANGE');
});
test('scene_repeated_distinct_empty_and_unreferenced_charges_are_literal',()=>{
 const a=triangle(),b=triangle();let s=createSceneFrame3D({projection:projection(),draws:[{geometry:a,modelView:BASE},{geometry:a,modelView:BASE}]});assert.deepEqual([s.cpuLogicalBytes,s.sceneBytes,s.uniformBytes],[168,84,128]);assert.deepEqual(s.geometries,[a]);
 s=createSceneFrame3D({projection:projection(),draws:[{geometry:a,modelView:BASE},{geometry:b,modelView:BASE}]});assert.deepEqual([s.cpuLogicalBytes,s.sceneBytes,s.uniformBytes],[336,168,128]);assert.deepEqual(s.geometries,[a,b]);
 const e=empty();s=createSceneFrame3D({projection:projection(),draws:[{geometry:e,modelView:BASE},{geometry:e,modelView:BASE}]});assert.deepEqual([s.cpuLogicalBytes,s.sceneBytes,s.uniformBytes],[0,0,128]);assert.equal(s.geometries.length,1);
 s=createSceneFrame3D({projection:projection(),draws:Array.from({length:64},()=>({geometry:empty(),modelView:BASE}))});assert.deepEqual([s.geometries.length,s.uniformBytes,s.cpuLogicalBytes,s.sceneBytes],[64,4096,0,0]);
 const g=createMeshGeometry3D({positions:[0,0,0,1,0,0,0,1,0,2,2,2],colors:[1,0,0,1,0,0,1,0,0,1,0,0],indices:[0,1,2]});s=createSceneFrame3D(input(g));assert.deepEqual([s.cpuLogicalBytes,s.sceneBytes,s.uniformBytes],[216,108,64]);
});
test('scene_authentic_maximum_geometry_budget_witnesses_never_forge_identity',()=>{
 const max=()=>createMeshGeometry3D({positions:new Array(196608).fill(0),colors:new Array(196608).fill(0),indices:new Array(131070).fill(0)}),a=max(),b=max();
 assert.equal(a.logicalBytes,4194288);let s=createSceneFrame3D({projection:projection(),draws:[{geometry:a,modelView:BASE},{geometry:b,modelView:BASE}]});assert.deepEqual([s.cpuLogicalBytes,s.sceneBytes,s.uniformBytes],[8388576,4194288,128]);
 failure(()=>createSceneFrame3D({projection:projection(),draws:[{geometry:a,modelView:BASE},{geometry:b,modelView:BASE},{geometry:triangle(),modelView:BASE}]}),'SCENE3D_BUDGET','budget');
 s=createSceneFrame3D({projection:projection(),draws:Array.from({length:64},()=>({geometry:a,modelView:BASE}))});assert.deepEqual([s.cpuLogicalBytes,s.sceneBytes,s.uniformBytes],[4194288,2097144,4096]);
});
test('scene_JS_owned_fault_controls_restore_intrinsics_and_publish_no_result',()=>{
 const g=triangle();for(const point of ['allocation','copy','freeze','identity','math','registration','error-registration'])for(const token of [undefined,Symbol(point),new Scene3DError('SCENE3D_BUDGET')]){
  const a=input(g),savedArray=globalThis.Array,savedFreeze=Object.freeze,savedHas=WeakMap.prototype.has,savedSet=WeakMap.prototype.set,savedFround=Math.fround;let error,published,calls=0,didThrow=false;
  try{
   if(point==='allocation'||point==='copy')globalThis.Array=new Proxy(savedArray,{construct(t,args){const value=Reflect.construct(t,args);if(args[0]===7){calls++;if(point==='allocation')throw token;return new Proxy(value,{set(){throw token;}});}return value;}});
   if(point==='freeze')Object.freeze=value=>{if(value&&Object.hasOwn(value,'draws')){calls++;throw token;}return savedFreeze(value);};
   if(point==='identity')WeakMap.prototype.has=function(key){if(key===g){calls++;throw token;}return savedHas.call(this,key);};
   if(point==='math')Math.fround=()=>{calls++;throw token;};
   if(point==='registration')WeakMap.prototype.set=function(key,value){if(value===true&&Object.hasOwn(key,'draws')){calls++;throw token;}return savedSet.call(this,key,value);};
   if(point==='error-registration'){a.projection.kind='bad';WeakMap.prototype.set=function(key,value){if(value==='validation'&&calls++===0)throw token;return savedSet.call(this,key,value);};}
   try{published=createSceneFrame3D(a);}catch(value){error=value;didThrow=true;}
  }finally{globalThis.Array=savedArray;Object.freeze=savedFreeze;WeakMap.prototype.has=savedHas;WeakMap.prototype.set=savedSet;Math.fround=savedFround;}
  assert.equal(didThrow,true,point);assert.equal(published,undefined);assert.ok(calls>=1,point);assert.ok(error instanceof Scene3DError);assert.equal(error.code,'SCENE3D_NATIVE_FAILED',point);assert.equal(getScene3DErrorOrigin(error),'native');assert.equal(error.cause,token);assert.equal(getScene3DErrorOrigin(token),undefined);assert.equal(isSceneFrame3D(createSceneFrame3D(input(g))),true);
 }
});
test('scene_B0_native_wrapper_and_unexpected_constructor_fault_keep_exact_causes',()=>{
 const a=input(),token=Symbol('B0 owned tuple freeze'),saved=Object.freeze;let error;
 try{Object.freeze=value=>{if(Array.isArray(value)&&value.length===16)throw token;return saved(value);};error=thrown(()=>createSceneFrame3D(a));}finally{Object.freeze=saved;}
 assert.equal(error.code,'SCENE3D_NATIVE_FAILED');assert.equal(getScene3DErrorOrigin(error),'native');assert.equal(error.cause.code,'MATH3D_NATIVE_FAILED');assert.equal(error.cause.cause,token);
 const descriptor=Object.getOwnPropertyDescriptor(Math3DError.prototype,'name'),unexpected=Symbol('B0 constructor fault'),b=input();b.draws[0].modelView[0]=NaN;
 try{Object.defineProperty(Math3DError.prototype,'name',{configurable:true,set(){throw unexpected;}});error=thrown(()=>createSceneFrame3D(b));}finally{if(descriptor)Object.defineProperty(Math3DError.prototype,'name',descriptor);else delete Math3DError.prototype.name;}
 assert.equal(error.code,'SCENE3D_NATIVE_FAILED');assert.equal(getScene3DErrorOrigin(error),'native');assert.equal(error.cause,unexpected);
});
test('scene_rethrown_registered_error_does_not_override_new_source_origin',()=>{
 const old=failure(()=>createSceneFrame3D(null)),a=input();Object.defineProperty(a.draws[0],'geometry',{get(){throw old;}});const e=failure(()=>createSceneFrame3D(a),'SCENE3D_INPUT_READ_FAILED','source',old);assert.notEqual(e,old);
});
