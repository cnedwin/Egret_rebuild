import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {createMeshGeometry3D, isMeshGeometry3D, MeshGeometry3DError, getMeshGeometry3DErrorOrigin} from '../packages/engine/dist/rendering/meshGeometry3D.js';

// Independent C01 literals; expected payload and counts never use a production helper.
const positions = [-.75,-.75,-2,.75,-.75,-2,0,.75,-2];
const colors = [0,0,1,0,0,1,0,0,1];
const indices = [0,1,2];
const triangle = () => ({positions:[...positions],colors:[...colors],indices:[...indices]});
const keys = ['positions','colors','indices'];
function thrown(action) {
    let value, caught = false;
    try { action(); } catch (error) { value = error; caught = true; }
    assert.equal(caught, true, 'factory must reject');
    return value;
}
function rejects(input, code = 'MESH3D_INPUT_INVALID', origin = 'validation', cause) {
    const error = thrown(() => createMeshGeometry3D(input));
    assert.ok(error instanceof MeshGeometry3DError);
    assert.equal(error.code, code);
    assert.equal(getMeshGeometry3DErrorOrigin(error), origin);
    assert.equal(error.cause, cause);
    assert.equal(isMeshGeometry3D(error), false);
    return error;
}
// Each trace assertion catches an extra/inherited read, early semantic rejection,
// or changed capture ordering. Proxy traps are the real external read surfaces.
function tracedArray(values, name, trace) {
    return new Proxy(values, {
        getOwnPropertyDescriptor(target,key) { trace.push(`own:${name}:${String(key)}`); return Reflect.getOwnPropertyDescriptor(target,key); },
        get(target,key,receiver) { trace.push(`get:${name}:${String(key)}`); return Reflect.get(target,key,receiver); }
    });
}

test('C01 triangle_snapshot_has_literal_payload_and_bytes', () => {
    const input = triangle(), value = createMeshGeometry3D(input);
    assert.deepEqual(value, {positions,colors,indices,vertexCount:3,indexCount:3,logicalBytes:168});
    assert.equal(isMeshGeometry3D(value), true);
    assert.deepEqual(Object.getOwnPropertySymbols(value), []);
    for (const part of [value,...keys.map(key => value[key])]) assert.equal(Object.isFrozen(part), true);
    for (const key of keys) { assert.ok(Array.isArray(value[key])); assert.notEqual(value[key], input[key]); }
});
test('C11 source_mutation_and_copyout_do_not_change_authentic_geometry', () => {
    const input = triangle(), a = createMeshGeometry3D(input), b = createMeshGeometry3D(input);
    input.positions[0] = 9; input.colors[0] = 1; input.indices[0] = 2;
    for (const key of keys) { const copy = [...a[key]]; copy[0] = 7; assert.notEqual(a[key], b[key]); }
    assert.notEqual(a,b);
    assert.deepEqual(a.positions, positions); assert.deepEqual(a.colors, colors); assert.deepEqual(a.indices, indices);
    assert.throws(() => { a.positions[0] = 2; }, TypeError);
    assert.throws(() => { a.vertexCount = 42; }, TypeError);
    assert.equal(isMeshGeometry3D({...a}), false);
    assert.equal(isMeshGeometry3D(new Proxy(a, {})), false);
});
test('identity_and_error_origin_do_not_observe_caller_fields', () => {
    const trap = () => { throw Error('identity must not inspect'); };
    const fake = new Proxy({}, {get:trap,getOwnPropertyDescriptor:trap,getPrototypeOf:trap,has:trap});
    assert.equal(isMeshGeometry3D(fake), false); assert.equal(getMeshGeometry3DErrorOrigin(fake), undefined);
    const revoked = Proxy.revocable({}, {}); revoked.revoke();
    assert.equal(isMeshGeometry3D(revoked.proxy), false); assert.equal(getMeshGeometry3DErrorOrigin(revoked.proxy), undefined);
    for (const value of [null,undefined,0,'mesh',false,Symbol(),()=>{}]) {
        assert.equal(isMeshGeometry3D(value), false); assert.equal(getMeshGeometry3DErrorOrigin(value), undefined);
    }
    const real = rejects(null);
    assert.equal(getMeshGeometry3DErrorOrigin(new Proxy(real, {})), undefined);
    for (const code of ['MESH3D_INPUT_INVALID','MESH3D_BUDGET','MESH3D_INPUT_READ_FAILED','MESH3D_NATIVE_FAILED']) {
        assert.equal(getMeshGeometry3DErrorOrigin(new MeshGeometry3DError(code)), undefined);
        assert.equal(getMeshGeometry3DErrorOrigin({code}), undefined);
    }
});
test('C02 C03 empty_and_degenerate_are_structural_values', () => {
    const empty = createMeshGeometry3D({positions:[],colors:[],indices:[]});
    assert.deepEqual(empty, {positions:[],colors:[],indices:[],vertexCount:0,indexCount:0,logicalBytes:0});
    const input = triangle(); input.indices = [0,0,0];
    assert.deepEqual(createMeshGeometry3D(input).indices, [0,0,0]);
    input.positions = Array(9).fill(1);
    assert.deepEqual(createMeshGeometry3D(input).positions, [1,1,1,1,1,1,1,1,1]);
    input.positions.push(1,2,3); input.colors.push(.25,.5,.75);
    assert.deepEqual(createMeshGeometry3D(input), {positions:[1,1,1,1,1,1,1,1,1,1,2,3],colors:[0,0,1,0,0,1,0,0,1,.25,.5,.75],indices:[0,0,0],vertexCount:4,indexCount:3,logicalBytes:216});
});
test('C04 field_length_index_trace_is_once_and_own_only', () => {
    const trace=[], raw=triangle(), input={};
    for (const key of keys) Object.defineProperty(input,key,{get:()=>tracedArray(raw[key],key,trace),configurable:true});
    Object.defineProperty(input,'extra',{get:()=>{throw Error('extra read');}});
    const source = new Proxy(input, {
        getOwnPropertyDescriptor(target,key) {trace.push(`own:${String(key)}`);return Reflect.getOwnPropertyDescriptor(target,key);},
        get(target,key,receiver) {trace.push(`get:${String(key)}`);return Reflect.get(target,key,receiver);}
    });
    assert.deepEqual(createMeshGeometry3D(source).indices, indices);
    const expected=['own:positions','get:positions','own:colors','get:colors','own:indices','get:indices',
        'own:positions:length','get:positions:length','own:colors:length','get:colors:length','own:indices:length','get:indices:length'];
    for (const [key,length] of [['positions',9],['colors',9],['indices',3]]) {
        for (let i=0;i<length;i++) expected.push(`own:${key}:${i}`,`get:${key}:${i}`);
    }
    assert.deepEqual(trace, expected);
});
test('field_capture_finishes_before_missing_or_invalid_fields_are_rejected', () => {
    const token={}, trace=[];
    const input={get colors(){trace.push('colors');return [];},get indices(){trace.push('indices');throw token;}};
    rejects(input,'MESH3D_INPUT_READ_FAILED','source',token); assert.deepEqual(trace,['colors','indices']);
    const bad={get positions(){trace.push('positions');return 0;},get colors(){throw token;}};
    rejects(bad,'MESH3D_INPUT_READ_FAILED','source',token);
});
test('brands_and_admitted_lengths_finish_before_shape_rejection_without_nonarray_length_reads', () => {
    const token={}, notArray=new Proxy({},{get(){throw Error('nonarray length read');}});
    const later=new Proxy([],{get(target,key){if(key==='length')throw token;return Reflect.get(target,key);}});
    rejects({positions:notArray,colors:later,indices:[]},'MESH3D_INPUT_READ_FAILED','source',token);
    const badLength=new Proxy([],{get(target,key){return key==='length'?1.5:Reflect.get(target,key);}});
    rejects({positions:badLength,colors:[],indices:later},'MESH3D_INPUT_READ_FAILED','source',token);
    const trace=[];
    rejects({positions:notArray,colors:tracedArray([], 'colors',trace),indices:tracedArray([], 'indices',trace)});
    assert.deepEqual(trace,['own:colors:length','get:colors:length','own:indices:length','get:indices:length']);
});
test('prototype_fields_slots_iterators_and_coercion_are_never_used', () => {
    const input=triangle();
    Object.defineProperty(input.positions,Symbol.iterator,{get(){throw Error('iterator');}});
    Object.defineProperty(input.positions,'valueOf',{get(){throw Error('coerce');}});
    assert.deepEqual(createMeshGeometry3D(input).positions,positions);
    const proto=Object.create(Array.prototype); Object.defineProperty(proto,'0',{get(){throw Error('inherited slot');}});
    delete input.positions[0]; Object.setPrototypeOf(input.positions,proto); rejects(input);
    const inherited=Object.create({get positions(){throw Error('inherited field');}});
    inherited.colors=[]; inherited.indices=[]; rejects(inherited);
    const exotic=Object.create(null); Object.assign(exotic,triangle());
    assert.equal(createMeshGeometry3D(exotic).vertexCount,3);
    const crossRealm=vm.runInNewContext('({positions:[0,0,0,1,0,0,0,1,0],colors:[1,0,0,1,0,0,1,0,0],indices:[0,1,2]})');
    assert.equal(createMeshGeometry3D(crossRealm).logicalBytes,168);
});
test('C05 late_getter_fault_overrides_earlier_hole_or_invalid_number', () => {
    for (const first of ['hole','bad']) {
        const input=triangle(), token={first};
        if(first==='hole')delete input.positions[0];else input.positions[0]=NaN;
        Object.defineProperty(input.colors,'8',{get(){throw token;}});
        rejects(input,'MESH3D_INPUT_READ_FAILED','source',token);
    }
    const input=triangle(), token={}; input.colors[0]=2;
    Object.defineProperty(input.indices,'2',{get(){throw token;}});
    rejects(input,'MESH3D_INPUT_READ_FAILED','source',token);
});
test('own_presence_faults_and_revoked_array_brands_retain_exact_source_causes', () => {
    const token=Symbol('presence');
    const top=new Proxy(triangle(),{getOwnPropertyDescriptor(){throw token;}});
    rejects(top,'MESH3D_INPUT_READ_FAILED','source',token);
    for (const point of ['length','0']) {
        const input=triangle(); input.positions=new Proxy(input.positions,{getOwnPropertyDescriptor(target,key){if(key===point)throw token;return Reflect.getOwnPropertyDescriptor(target,key);}});
        rejects(input,'MESH3D_INPUT_READ_FAILED','source',token);
    }
    const revoked=Proxy.revocable([],{}); revoked.revoke();
    const e=thrown(()=>createMeshGeometry3D({positions:revoked.proxy,colors:[],indices:[]}));
    assert.equal(e.code,'MESH3D_INPUT_READ_FAILED'); assert.equal(getMeshGeometry3DErrorOrigin(e),'source'); assert.ok(e.cause instanceof TypeError);
});
test('C06 invalid_numbers_RGB_and_indices_are_rejected_without_coercion', () => {
    for (const bad of [null,undefined,NaN,Infinity,-Infinity,'0',true,1n,{valueOf(){throw Error('coerce');}}]) {
        const input=triangle(); input.positions[0]=bad; rejects(input);
    }
    for (const bad of [-1,2,NaN,Infinity,-Infinity,null,undefined,'0']) {const input=triangle();input.colors[0]=bad;rejects(input);}
    for (const bad of [-1,.5,3,NaN,Infinity,-Infinity,null,undefined,'0',Number.MAX_SAFE_INTEGER+1]) {const input=triangle();input.indices[0]=bad;rejects(input);}
});
test('unused_vertex_is_validated_and_all_three_payloads_finish_before_value_checks', () => {
    const input=triangle(); input.positions.push(0,Infinity,0); input.colors.push(0,0,0); rejects(input);
    input.positions[10]=0; input.colors[11]=-1; rejects(input);
    const trace=[], raw=triangle(); raw.positions[0]=null;
    for(const key of keys)raw[key]=tracedArray(raw[key],key,trace);
    rejects(raw); assert.deepEqual(trace.slice(-6),['own:indices:0','get:indices:0','own:indices:1','get:indices:1','own:indices:2','get:indices:2']);
});
test('C07 signed_zero_is_positive', () => {
    const input=triangle();input.positions[0]=-0;input.colors[0]=-0;input.indices[0]=-0;
    const value=createMeshGeometry3D(input);
    for(const key of keys)assert.equal(Object.is(value[key][0],-0),false);
    assert.deepEqual([value.positions[0],value.colors[0],value.indices[0]],[0,0,0]);
});
test('C07 empty_proxy_lengths_canonicalize_all_output_counts_to_positive_zero', () => {
    // A proxy length is a source observation, so valid numeric -0 must not
    // survive in derived output metadata even though ordinary Array length is +0.
    const empty=()=>new Proxy([],{get(target,key){return key==='length'?-0:Reflect.get(target,key);}});
    const value=createMeshGeometry3D({positions:empty(),colors:empty(),indices:empty()});
    for(const key of ['vertexCount','indexCount','logicalBytes']) {
        assert.equal(value[key],0);assert.equal(Object.is(value[key],-0),false);
    }
});
test('C08 finite_outside_f32_is_accepted_without_gpu_claim', () => {
    const input=triangle();input.positions[0]=1e39;input.positions[1]=1e-50;input.positions[2]=Number.MAX_VALUE;
    assert.deepEqual(createMeshGeometry3D(input).positions,[1e39,1e-50,Number.MAX_VALUE,.75,-.75,-2,0,.75,-2]);
});
test('shape_invalid_has_validation_authority_and_precedes_budget', () => {
    for(const input of [null,undefined,1,'x',()=>{}])rejects(input);
    for(const key of keys)for(const value of [new Float64Array(9),new Set(),{},null]) {const input=triangle();input[key]=value;rejects(input);}
    for(const [p,c,i] of [[0,0,3],[9,9,0],[3,3,3],[6,6,3],[9,6,3],[10,10,3],[9,9,4],[196611,196608,3]]) {
        const input={positions:Array(p),colors:Array(c),indices:Array(i)};rejects(input);
    }
    for(const bad of [-1,1.5,NaN,Infinity,'9',Number.MAX_SAFE_INTEGER+1]) {
        const input=triangle();input.positions=new Proxy(input.positions,{get(t,key){return key==='length'?bad:Reflect.get(t,key);}});rejects(input);
    }
});
test('C09 counts_and_logical_budget_precede_payload_reads_and_allocation', () => {
    for(const [p,c,i] of [[196611,196611,3],[9,9,196611],[196608,196608,131073],[196608,196608,196608]]) {
        let reads=0,allocations=0; const input={};
        for(const [key,length] of [['positions',p],['colors',c],['indices',i]])input[key]=new Proxy(Array(length),{get(t,k){if(k!=='length'){reads++;throw Error('payload');}return Reflect.get(t,k);},getOwnPropertyDescriptor(t,k){if(k!=='length')reads++;return Reflect.getOwnPropertyDescriptor(t,k);}});
        const OriginalArray=globalThis.Array;
        function ControlledArray(){allocations++;throw Error('payload allocated before quota');} ControlledArray.isArray=OriginalArray.isArray;
        let error;try{globalThis.Array=ControlledArray;error=thrown(()=>createMeshGeometry3D(input));}finally{globalThis.Array=OriginalArray;}
        assert.equal(error.code,'MESH3D_BUDGET');assert.equal(getMeshGeometry3DErrorOrigin(error),'budget');assert.equal(reads,0);assert.equal(allocations,0);
    }
});
test('C09 individual_maximum_index_count_is_admitted_below_logical_budget', () => {
    const input=triangle();input.indices=Array(196608).fill(0);
    const value=createMeshGeometry3D(input);
    assert.equal(value.vertexCount,3);assert.equal(value.indexCount,196608);assert.equal(value.logicalBytes,1573008);
});
test('C10 logical_boundary_accepts_4194288_and_rejects_4194312_before_payload', () => {
    const input={positions:Array(196608).fill(0),colors:Array(196608).fill(0),indices:Array(131070).fill(0)};
    const value=createMeshGeometry3D(input);
    assert.deepEqual([value.vertexCount,value.indexCount,value.logicalBytes],[65536,131070,4194288]);
    input.indices.length=131073;
    Object.defineProperty(input.positions,'0',{get(){throw Error('over budget payload read');}});
    rejects(input,'MESH3D_BUDGET','budget');
});
test('C12 source_faults_cannot_forge_validation_budget_or_native_authority', () => {
    const trusted=rejects(null);
    for(const cause of [trusted,new MeshGeometry3DError('MESH3D_BUDGET'),new MeshGeometry3DError('MESH3D_NATIVE_FAILED'),{code:'MESH3D_BUDGET'},undefined,null,17]) {
        const input=triangle();Object.defineProperty(input.indices,'2',{get(){throw cause;}});
        rejects(input,'MESH3D_INPUT_READ_FAILED','source',cause);
    }
});
test('C12 controlled_allocation_freeze_and_registration_faults_keep_native_cause_without_publication', () => {
    const input=triangle();
    // Finite controls restore intrinsics before assertions. They establish only
    // recoverable injected faults, not universal recovery from OOM/poisoning.
    for(const point of ['allocation','freeze','registration','copy']) {
        const token=new MeshGeometry3DError('MESH3D_BUDGET'), originalArray=globalThis.Array, originalFreeze=Object.freeze, originalSet=WeakMap.prototype.set;
        let calls=0,error,published;
        try {
            if(point==='allocation'){function BadArray(){throw token;}BadArray.isArray=originalArray.isArray;globalThis.Array=BadArray;}
            if(point==='copy'){function BadArray(length){return new Proxy(new originalArray(length),{set(){throw token;}});}BadArray.isArray=originalArray.isArray;globalThis.Array=BadArray;}
            if(point==='freeze')Object.freeze=()=>{throw token;};
            if(point==='registration')WeakMap.prototype.set=function(key,value){if(calls++===0)throw token;return originalSet.call(this,key,value);};
            try { published=createMeshGeometry3D(input); } catch(cause) {error=cause;}
        } finally {globalThis.Array=originalArray;Object.freeze=originalFreeze;WeakMap.prototype.set=originalSet;}
        assert.equal(published,undefined);assert.ok(error instanceof MeshGeometry3DError);assert.equal(error.code,'MESH3D_NATIVE_FAILED');assert.equal(error.cause,token);assert.equal(getMeshGeometry3DErrorOrigin(error),'native');
        assert.equal(getMeshGeometry3DErrorOrigin(token),undefined);assert.equal(isMeshGeometry3D(createMeshGeometry3D(input)),true);
    }
});
