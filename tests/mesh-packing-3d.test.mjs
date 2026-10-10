import test from 'node:test';
import assert from 'node:assert/strict';
import {createMeshGeometry3D} from '../packages/engine/dist/rendering/meshGeometry3D.js';
import {packMeshGeometry3D, MeshPacking3DError, getMeshPacking3DErrorOrigin} from '../packages/engine/dist/rendering/packMeshGeometry3D.js';

const positions=[-.75,-.75,-2,.75,-.75,-2,0,.75,-2];
const colors=[0,0,1,0,0,1,0,0,1];
const triangle=()=>({positions:[...positions],colors:[...colors],indices:[0,1,2]});
const geometry=()=>createMeshGeometry3D(triangle());
function caught(action) {
    let value, didThrow=false;
    try {action();} catch(error) {value=error;didThrow=true;}
    assert.equal(didThrow,true,'packing must reject');
    return value;
}
function failure(error,code,origin,cause) {
    assert.ok(error instanceof MeshPacking3DError);
    assert.equal(error.code,code);
    assert.equal(getMeshPacking3DErrorOrigin(error),origin);
    assert.equal(error.cause,cause);
}
function unsupported(input) {
    const value=createMeshGeometry3D(input);
    failure(caught(()=>packMeshGeometry3D(value)),'MESH3D_PACK_F32_UNSUPPORTED','validation');
    return value;
}

test('P01 interleaved_literals_and_uint32_indices', () => {
    const value=packMeshGeometry3D(geometry());
    assert.deepEqual([...value.vertices],[-.75,-.75,-2,0,0,1,.75,-.75,-2,0,0,1,0,.75,-2,0,0,1]);
    assert.deepEqual([...value.indices],[0,1,2]);
    assert.deepEqual([value.vertexCount,value.indexCount,value.vertexBytes,value.indexBytes],[3,3,72,12]);
    assert.ok(value.vertices instanceof Float32Array);
    assert.ok(value.indices instanceof Uint32Array);
    assert.ok(value.vertices.buffer instanceof ArrayBuffer);
    assert.ok(value.indices.buffer instanceof ArrayBuffer);
    assert.equal(value.vertices.byteOffset,0);assert.equal(value.indices.byteOffset,0);
    assert.deepEqual(Object.keys(value),['vertices','indices','vertexCount','indexCount','vertexBytes','indexBytes']);
});
test('P01 independently_authored_IEEE_words_and_observed_runtime_bytes', () => {
    const value=packMeshGeometry3D(geometry());
    // P01 gives numeric interleaving, not byte arrays. These words/bytes are
    // hand-derived IEEE754 fixtures: -.75=bf400000, +.75=3f400000,
    // -2=c0000000 and +1=3f800000. Production packing builds no expectations.
    assert.deepEqual([...new Uint32Array(value.vertices.buffer)],[
        0xbf400000,0xbf400000,0xc0000000,0,0,0x3f800000,
        0x3f400000,0xbf400000,0xc0000000,0,0,0x3f800000,
        0,0x3f400000,0xc0000000,0,0,0x3f800000,
    ]);
    const probe=new Uint32Array([0x01020304]);
    const bytes=[...new Uint8Array(probe.buffer)];
    // The actual fixture environment is qualified as little-endian here;
    // this is not a portability assertion about every CPU/runtime.
    assert.deepEqual(bytes,[4,3,2,1]);
    assert.deepEqual([...new Uint8Array(value.vertices.buffer)],[
        0,0,64,191,0,0,64,191,0,0,0,192,0,0,0,0,0,0,0,0,0,0,128,63,
        0,0,64,63,0,0,64,191,0,0,0,192,0,0,0,0,0,0,0,0,0,0,128,63,
        0,0,0,0,0,0,64,63,0,0,0,192,0,0,0,0,0,0,0,0,0,0,128,63,
    ]);
    assert.deepEqual([...new Uint8Array(value.indices.buffer)],[0,0,0,0,1,0,0,0,2,0,0,0]);
});
test('P02 exact_normal_edges_and_negative_positions_keep_literal_words', () => {
    const input=triangle();
    input.positions[0]=1.1754943508222875e-38;
    input.positions[1]=3.4028234663852886e38;
    input.positions[2]=-1.1754943508222875e-38;
    input.positions[3]=-3.4028234663852886e38;
    input.colors[0]=1.1754943508222875e-38;
    const value=packMeshGeometry3D(createMeshGeometry3D(input));
    const words=[...new Uint32Array(value.vertices.buffer)];
    assert.deepEqual(words.slice(0,4),[0x00800000,0x7f7fffff,0x80800000,0x00800000]);
    assert.equal(words[6],0xff7fffff);
});
test('P03 binary64_overflow_acceptance_does_not_pass_f32', () => {
    for(const number of [1e39,-1e39,Number.MAX_VALUE,-Number.MAX_VALUE]) {
        const input=triangle();input.positions[0]=number;
        assert.equal(unsupported(input).positions[0],number);
    }
});
test('P03 rounded_subnormal_and_nonzero_to_zero_are_unsupported', () => {
    for(const number of [1/3,-1/3,1e-50,-1e-50,1.401298464324817e-45,-1.401298464324817e-45,2**-127]) {
        const input=triangle();input.positions[0]=number;unsupported(input);
    }
});
test('P03 colors_obey_the_same_exact_normal_profile', () => {
    for(const number of [1/3,1e-50,1.401298464324817e-45]) {
        const input=triangle();input.colors[8]=number;unsupported(input);
    }
});
test('P03 late_unsupported_unused_vertex_precedes_both_typed_allocations', () => {
    const input=triangle();input.positions.push(0,0,1/3);input.colors.push(0,0,1);
    const owned=createMeshGeometry3D(input);
    const originalF32=globalThis.Float32Array,originalU32=globalThis.Uint32Array;
    let allocations=0,error;
    try {
        globalThis.Float32Array=function(){allocations++;throw Error('early f32 allocation');};
        globalThis.Uint32Array=function(){allocations++;throw Error('early u32 allocation');};
        error=caught(()=>packMeshGeometry3D(owned));
    } finally {globalThis.Float32Array=originalF32;globalThis.Uint32Array=originalU32;}
    failure(error,'MESH3D_PACK_F32_UNSUPPORTED','validation');
    assert.equal(allocations,0);
});
test('P03 late_unsupported_color_precedes_both_typed_allocations', () => {
    const input=triangle();input.colors[8]=1/3;const owned=createMeshGeometry3D(input);
    const originalF32=globalThis.Float32Array,originalU32=globalThis.Uint32Array;
    let allocations=0,error;
    try {
        globalThis.Float32Array=function(){allocations++;throw Error('early f32 allocation');};
        globalThis.Uint32Array=function(){allocations++;throw Error('early u32 allocation');};
        error=caught(()=>packMeshGeometry3D(owned));
    } finally {globalThis.Float32Array=originalF32;globalThis.Uint32Array=originalU32;}
    failure(error,'MESH3D_PACK_F32_UNSUPPORTED','validation');assert.equal(allocations,0);
});
test('preflight_visits_positions_then_colors_and_stops_at_first_unsupported', () => {
    const input=triangle();input.positions[8]=1/3;input.colors[0]=1/3;
    const owned=createMeshGeometry3D(input),original=Math.fround,trace=[];
    let error;
    try {
        Math.fround=function(value){trace.push(value);return original(value);};
        error=caught(()=>packMeshGeometry3D(owned));
    } finally {Math.fround=original;}
    failure(error,'MESH3D_PACK_F32_UNSUPPORTED','validation');
    assert.deepEqual(trace,[-.75,-.75,-2,.75,-.75,-2,.75,1/3]);
});
test('P04 payload_and_empty_metadata_are_positive_zero', () => {
    const input={positions:Array(9).fill(-0),colors:Array(9).fill(-0),indices:[-0,-0,-0]};
    const value=packMeshGeometry3D(createMeshGeometry3D(input));
    assert.deepEqual([...new Uint32Array(value.vertices.buffer)],Array(18).fill(0));
    assert.deepEqual([...value.indices],[0,0,0]);
    for(const number of [...value.vertices,...value.indices])assert.equal(Object.is(number,-0),false);
    const empty=packMeshGeometry3D(createMeshGeometry3D({positions:[],colors:[],indices:[]}));
    for(const key of ['vertexCount','indexCount','vertexBytes','indexBytes']){
        assert.equal(empty[key],0);assert.equal(Object.is(empty[key],-0),false);
    }
});
test('P04 fresh_pack_does_not_alias_geometry_or_prior_pack', () => {
    const input=triangle(),owned=createMeshGeometry3D(input);
    const a=packMeshGeometry3D(owned),b=packMeshGeometry3D(owned);
    assert.notEqual(a,b);
    for(const key of ['vertices','indices']) {
        assert.notEqual(a[key],b[key]);assert.notEqual(a[key].buffer,b[key].buffer);
    }
    assert.notEqual(a.vertices.buffer,a.indices.buffer);
    assert.equal(Object.isFrozen(a),true);
    assert.equal(Object.isFrozen(a.vertices),false);assert.equal(Object.isFrozen(a.indices),false);
    a.vertices[0]=17;a.vertices[3]=.5;a.indices[0]=2;
    input.positions[1]=99;input.colors[1]=.5;input.indices[1]=0;
    assert.deepEqual(owned.positions,positions);assert.deepEqual(owned.colors,colors);assert.deepEqual(owned.indices,[0,1,2]);
    assert.deepEqual([...b.vertices],[-.75,-.75,-2,0,0,1,.75,-.75,-2,0,0,1,0,.75,-2,0,0,1]);
    assert.deepEqual([...b.indices],[0,1,2]);
    assert.throws(()=>{a.vertexCount=9;},TypeError);
    assert.throws(()=>{a.vertices=new Float32Array();},TypeError);
});
test('all_empty_packs_still_own_distinct_zero_length_buffers', () => {
    const owned=createMeshGeometry3D({positions:[],colors:[],indices:[]});
    const a=packMeshGeometry3D(owned),b=packMeshGeometry3D(owned);
    assert.deepEqual([a.vertices.length,a.indices.length,a.vertexBytes,a.indexBytes],[0,0,0,0]);
    assert.notEqual(a.vertices.buffer,a.indices.buffer);
    assert.notEqual(a.vertices.buffer,b.vertices.buffer);assert.notEqual(a.indices.buffer,b.indices.buffer);
    assert.equal(Object.isFrozen(a),true);
});
test('maximum_authentic_logical_geometry_packs_2097144_bytes', () => {
    // This legal witness reaches the largest multiple-of-three budget. It
    // does not fabricate an authentic oversized snapshot for branch coverage.
    const owned=createMeshGeometry3D({positions:Array(196608).fill(0),colors:Array(196608).fill(0),indices:Array(131070).fill(0)});
    const value=packMeshGeometry3D(owned);
    assert.deepEqual([owned.logicalBytes,value.vertexCount,value.indexCount,value.vertexBytes,value.indexBytes],[4194288,65536,131070,1572864,524280]);
    assert.equal(value.vertices.byteLength+value.indices.byteLength,2097144);
    assert.equal(value.vertices[value.vertices.length-1],0);assert.equal(value.indices[value.indices.length-1],0);
});
test('maximum_index_count_keeps_uint32_order_without_rebasing', () => {
    const input=triangle();input.indices=Array(196608).fill(2);input.indices[0]=1;input.indices[196607]=0;
    const value=packMeshGeometry3D(createMeshGeometry3D(input));
    assert.deepEqual([value.indexCount,value.indexBytes,value.indices[0],value.indices[1],value.indices[196607]],[196608,786432,1,2,0]);
});
test('genuine_identity_precedes_geometry_getters_and_allocation', () => {
    let reads=0,allocations=0;
    const trap=()=>{reads++;throw Error('caller reflection');};
    const fake=new Proxy({},{get:trap,getOwnPropertyDescriptor:trap,getPrototypeOf:trap,has:trap});
    const revoked=Proxy.revocable({},{});revoked.revoke();
    const real=geometry(),values=[fake,revoked.proxy,{...real},new Proxy(real,{}),Object.create(real),null,undefined,0,'mesh',false,Symbol(),()=>{}];
    const originalF32=globalThis.Float32Array,originalU32=globalThis.Uint32Array,errors=[];
    try {
        globalThis.Float32Array=function(){allocations++;throw Error('unauthentic allocation');};
        globalThis.Uint32Array=function(){allocations++;throw Error('unauthentic allocation');};
        for(const value of values)errors.push(caught(()=>packMeshGeometry3D(value)));
    } finally {globalThis.Float32Array=originalF32;globalThis.Uint32Array=originalU32;}
    for(const error of errors)failure(error,'MESH3D_PACK_INPUT_INVALID','validation');
    assert.equal(reads,0);assert.equal(allocations,0);
});
test('error_provenance_does_not_trust_caller_classes_codes_or_proxies', () => {
    const real=caught(()=>packMeshGeometry3D(null));
    failure(real,'MESH3D_PACK_INPUT_INVALID','validation');
    const trap=()=>{throw Error('origin reflection');};
    const fake=new Proxy({},{get:trap,getOwnPropertyDescriptor:trap,getPrototypeOf:trap,has:trap});
    const revoked=Proxy.revocable({},{});revoked.revoke();
    for(const value of [fake,revoked.proxy,new Proxy(real,{}),{code:'MESH3D_PACK_INPUT_INVALID'},null,undefined,0,'error',()=>{}])assert.equal(getMeshPacking3DErrorOrigin(value),undefined);
    for(const code of ['MESH3D_PACK_INPUT_INVALID','MESH3D_PACK_BUDGET','MESH3D_PACK_F32_UNSUPPORTED','MESH3D_PACK_NATIVE_FAILED'])assert.equal(getMeshPacking3DErrorOrigin(new MeshPacking3DError(code)),undefined);
});
test('recoverable_identity_intrinsic_fault_retains_exact_native_cause', () => {
    const owned=geometry(),original=WeakMap.prototype.has,token=Symbol('identity'),before=[];
    let error,published;
    try {
        WeakMap.prototype.has=function(key){before.push(key);throw token;};
        try {published=packMeshGeometry3D(owned);} catch(value) {error=value;}
    } finally {WeakMap.prototype.has=original;}
    assert.equal(published,undefined);assert.deepEqual(before,[owned]);
    failure(error,'MESH3D_PACK_NATIVE_FAILED','native',token);
});
test('recoverable_math_fault_is_native_and_not_f32_validation', () => {
    const owned=geometry(),original=Math.fround,token={code:'MESH3D_PACK_F32_UNSUPPORTED'};
    let error,published;
    try {
        Math.fround=()=>{throw token;};
        try {published=packMeshGeometry3D(owned);} catch(value) {error=value;}
    } finally {Math.fround=original;}
    assert.equal(published,undefined);failure(error,'MESH3D_PACK_NATIVE_FAILED','native',token);
});
test('allocation_failure_retains_arbitrary_native_cause_without_publication', () => {
    const owned=geometry();
    for(const point of ['vertices','indices'])for(const token of [undefined,null,17,Symbol('allocation'),new MeshPacking3DError('MESH3D_PACK_BUDGET')]) {
        const originalF32=globalThis.Float32Array,originalU32=globalThis.Uint32Array,trace=[];
        let error,published;
        try {
            globalThis.Float32Array=function(length){trace.push(['vertices',length]);if(point==='vertices')throw token;return new originalF32(length);};
            globalThis.Uint32Array=function(length){trace.push(['indices',length]);throw token;};
            try {published=packMeshGeometry3D(owned);} catch(value) {error=value;}
        } finally {globalThis.Float32Array=originalF32;globalThis.Uint32Array=originalU32;}
        assert.equal(published,undefined);failure(error,'MESH3D_PACK_NATIVE_FAILED','native',token);
        assert.deepEqual(trace,point==='vertices'?[['vertices',18]]:[['vertices',18],['indices',3]]);
        assert.equal(getMeshPacking3DErrorOrigin(token),undefined);
    }
});
test('fill_failure_retains_exact_native_cause_and_no_output', () => {
    const owned=geometry(),token={point:'fill'};
    for(const point of ['vertices','indices']) {
        const originalF32=globalThis.Float32Array,originalU32=globalThis.Uint32Array;
        let error,published,writes=0;
        const rejectFill=target=>new Proxy(target,{set(){writes++;throw token;}});
        try {
            if(point==='vertices')globalThis.Float32Array=function(length){return rejectFill(new originalF32(length));};
            else globalThis.Uint32Array=function(length){return rejectFill(new originalU32(length));};
            try {published=packMeshGeometry3D(owned);} catch(value) {error=value;}
        } finally {globalThis.Float32Array=originalF32;globalThis.Uint32Array=originalU32;}
        assert.equal(published,undefined);assert.equal(writes,1);failure(error,'MESH3D_PACK_NATIVE_FAILED','native',token);
    }
});
test('wrapper_freeze_failure_retains_exact_native_cause_and_no_output', () => {
    const owned=geometry(),token=Symbol('freeze'),original=Object.freeze;
    let error,published,calls=0;
    try {
        Object.freeze=()=>{calls++;throw token;};
        try {published=packMeshGeometry3D(owned);} catch(value) {error=value;}
    } finally {Object.freeze=original;}
    assert.equal(published,undefined);assert.equal(calls,1);failure(error,'MESH3D_PACK_NATIVE_FAILED','native',token);
});
test('one_shot_origin_registration_fault_becomes_native_with_exact_cause', () => {
    const input=triangle();input.colors[8]=1/3;const unsupportedOwned=createMeshGeometry3D(input);
    const token={point:'registration'},original=WeakMap.prototype.set;
    for(const value of [null,unsupportedOwned]) {
        let error,published,calls=0;
        try {
            WeakMap.prototype.set=function(key,origin){if(calls++===0)throw token;return original.call(this,key,origin);};
            try {published=packMeshGeometry3D(value);} catch(cause) {error=cause;}
        } finally {WeakMap.prototype.set=original;}
        assert.equal(published,undefined);assert.equal(calls,2);failure(error,'MESH3D_PACK_NATIVE_FAILED','native',token);
        assert.equal(getMeshPacking3DErrorOrigin(token),undefined);
    }
});
