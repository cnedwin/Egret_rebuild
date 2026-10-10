import test from 'node:test';
import assert from 'node:assert/strict';
import { createPerspectiveProjection3D, createOrthographicProjection3D } from '../packages/engine/dist/rendering/projection3D.js';
import { Math3DError, transformHomogeneous4 } from '../packages/engine/dist/rendering/matrix4.js';

// The coefficients, raw vectors and NDC values below are the sealed independent
// dyadic oracle. Production transformation is the subject, never the expected oracle.
const profiles = [
    ['ZF', 'zeroToOne', 'forward'], ['ZR', 'zeroToOne', 'reverse'],
    ['NF', 'minusOneToOne', 'forward'], ['NR', 'minusOneToOne', 'reverse'],
];
const fields = ['left', 'right', 'bottom', 'top', 'near', 'far', 'depthRange', 'depthDirection'];
const numericFields = fields.slice(0, 6);
const factories = [['perspective', createPerspectiveProjection3D], ['orthographic', createOrthographicProjection3D]];
const codes = ['MATH3D_INPUT_INVALID', 'MATH3D_INPUT_READ_FAILED', 'MATH3D_GEOMETRY_INVALID', 'MATH3D_ARITHMETIC_RANGE', 'MATH3D_NATIVE_FAILED'];
function input(profile, values = {}) {
    return { left: -1, right: 1, bottom: -1, top: 1, near: 1, far: 9,
        depthRange: profile[1], depthDirection: profile[2], ...values };
}
function errorFrom(operation, code, cause, compareCause = false) {
    let error;
    try { operation(); } catch (caught) { error = caught; }
    assert.ok(error instanceof Math3DError);
    assert.equal(error.code, code);
    if (compareCause) { assert.equal(error.cause, cause); assert.notEqual(error, cause); }
    return error;
}
function tuple(actual, expected) {
    assert.deepEqual(actual, expected);
    for (let i = 0; i < expected.length; i++) if (expected[i] === 0) assert.ok(Object.is(actual[i], 0));
}
function result(actual, kind, profile, matrix) {
    assert.equal(actual.kind, kind);
    assert.deepEqual(actual.depth, { range: profile[1], direction: profile[2] });
    tuple(actual.matrix, matrix);
    assert.ok(Array.isArray(actual.matrix));
    for (const owned of [actual, actual.matrix, actual.depth]) assert.ok(Object.isFrozen(owned));
}
function witnesses(matrix, vectors, raw, ndc = []) {
    for (let i = 0; i < vectors.length; i++) {
        const clip = transformHomogeneous4(matrix, vectors[i]);
        tuple(clip, raw[i]); // raw w is asserted before the separate test-only divide.
        if (i < ndc.length) {
            assert.ok(clip[3] > 0);
            tuple([clip[0] / clip[3], clip[1] / clip[3], clip[2] / clip[3]], ndc[i]);
        }
    }
}
const p01 = [
    [1,0,0,0,0,1,0,0,0,0,-1.125,-1,0,0,-1.125,0],
    [1,0,0,0,0,1,0,0,0,0,0.125,-1,0,0,1.125,0],
    [1,0,0,0,0,1,0,0,0,0,-1.25,-1,0,0,-2.25,0],
    [1,0,0,0,0,1,0,0,0,0,1.25,-1,0,0,2.25,0],
];
const spVectors = [[1,-1,-1,1], [1.5,-1.5,-3,1], [9,-9,-9,1], [2,3,0,1], [1,2,1,1], [1,2,-1,0]];
const spRaw = [
    [[1,-1,0,1],[1.5,-1.5,2.25,3],[9,-9,9,9],[2,3,-1.125,0],[1,2,-2.25,-1],[1,2,1.125,1]],
    [[1,-1,1,1],[1.5,-1.5,0.75,3],[9,-9,0,9],[2,3,1.125,0],[1,2,1.25,-1],[1,2,-0.125,1]],
    [[1,-1,-1,1],[1.5,-1.5,1.5,3],[9,-9,9,9],[2,3,-2.25,0],[1,2,-3.5,-1],[1,2,1.25,1]],
    [[1,-1,1,1],[1.5,-1.5,-1.5,3],[9,-9,-9,9],[2,3,2.25,0],[1,2,3.5,-1],[1,2,-1.25,1]],
];
const spNdc = [
    [[1,-1,0],[0.5,-0.5,0.75],[1,-1,1]],
    [[1,-1,1],[0.5,-0.5,0.25],[1,-1,0]],
    [[1,-1,-1],[0.5,-0.5,0.5],[1,-1,1]],
    [[1,-1,1],[0.5,-0.5,-0.5],[1,-1,-1]],
];
const ap = {left:-2,right:6,bottom:-6,top:2,near:2,far:10};
const p02 = [
    [0.5,0,0,0,0,0.5,0,0,0.5,-0.5,-1.25,-1,0,0,-2.5,0],
    [0.5,0,0,0,0,0.5,0,0,0.5,-0.5,0.25,-1,0,0,2.5,0],
    [0.5,0,0,0,0,0.5,0,0,0.5,-0.5,-1.5,-1,0,0,-5,0],
    [0.5,0,0,0,0,0.5,0,0,0.5,-0.5,1.5,-1,0,0,5,0],
];
const apVectors = [[-2,-6,-2,1],[6,2,-2,1],[0,0,-2,1],[2,-2,-4,1],[30,10,-10,1]];
const apRaw = [
    [[-2,-2,0,2],[2,2,0,2],[-1,1,0,2],[-1,1,2.5,4],[10,10,10,10]],
    [[-2,-2,2,2],[2,2,2,2],[-1,1,2,2],[-1,1,1.5,4],[10,10,0,10]],
    [[-2,-2,-2,2],[2,2,-2,2],[-1,1,-2,2],[-1,1,1,4],[10,10,10,10]],
    [[-2,-2,2,2],[2,2,2,2],[-1,1,2,2],[-1,1,-1,4],[10,10,-10,10]],
];
const apNdc = [
    [[-1,-1,0],[1,1,0],[-0.5,0.5,0],[-0.25,0.25,0.625],[1,1,1]],
    [[-1,-1,1],[1,1,1],[-0.5,0.5,1],[-0.25,0.25,0.375],[1,1,0]],
    [[-1,-1,-1],[1,1,-1],[-0.5,0.5,-1],[-0.25,0.25,0.25],[1,1,1]],
    [[-1,-1,1],[1,1,1],[-0.5,0.5,1],[-0.25,0.25,-0.25],[1,1,-1]],
];
const op = {left:-2,right:6,bottom:-6,top:2,near:1,far:9};
const p03 = [
    [0.25,0,0,0,0,0.25,0,0,0,0,-0.125,0,-0.5,0.5,-0.125,1],
    [0.25,0,0,0,0,0.25,0,0,0,0,0.125,0,-0.5,0.5,1.125,1],
    [0.25,0,0,0,0,0.25,0,0,0,0,-0.25,0,-0.5,0.5,-1.25,1],
    [0.25,0,0,0,0,0.25,0,0,0,0,0.25,0,-0.5,0.5,1.25,1],
];
const opVectors = [[-2,-6,-1,1],[2,-2,-5,1],[6,2,-9,1],[4,8,-4,0]];
const opRaw = [
    [[-1,-1,0,1],[0,0,0.5,1],[1,1,1,1],[1,2,0.5,0]],
    [[-1,-1,1,1],[0,0,0.5,1],[1,1,0,1],[1,2,-0.5,0]],
    [[-1,-1,-1,1],[0,0,0,1],[1,1,1,1],[1,2,1,0]],
    [[-1,-1,1,1],[0,0,0,1],[1,1,-1,1],[1,2,-1,0]],
];
const opNdc = [
    [[-1,-1,0],[0,0,0.5],[1,1,1]], [[-1,-1,1],[0,0,0.5],[1,1,0]],
    [[-1,-1,-1],[0,0,0],[1,1,1]], [[-1,-1,1],[0,0,0],[1,1,-1]],
];
const p04 = [
    [0.25,0,0,0,0,0.25,0,0,0,0,-0.125,0,-0.5,0.5,0,1],
    [0.25,0,0,0,0,0.25,0,0,0,0,0.125,0,-0.5,0.5,1,1],
    [0.25,0,0,0,0,0.25,0,0,0,0,-0.25,0,-0.5,0.5,-1,1],
    [0.25,0,0,0,0,0.25,0,0,0,0,0.25,0,-0.5,0.5,1,1],
];
const o0Vectors = [[0,0,0,1],[2,-2,-4,1],[6,2,-8,1]];
const o0Raw = [
    [[-0.5,0.5,0,1],[0,0,0.5,1],[1,1,1,1]], [[-0.5,0.5,1,1],[0,0,0.5,1],[1,1,0,1]],
    [[-0.5,0.5,-1,1],[0,0,0,1],[1,1,1,1]], [[-0.5,0.5,1,1],[0,0,0,1],[1,1,-1,1]],
];
const o0Ndc = [
    [[-0.5,0.5,0],[0,0,0.5],[1,1,1]], [[-0.5,0.5,1],[0,0,0.5],[1,1,0]],
    [[-0.5,0.5,-1],[0,0,0],[1,1,1]], [[-0.5,0.5,1],[0,0,0],[1,1,-1]],
];
for (const [i, profile] of profiles.entries()) {
    test(`P01/${profile[0]}: symmetric coefficients, endpoints/interior and T05/T06 raw w`, () => {
        const projection = createPerspectiveProjection3D(input(profile));
        result(projection, 'perspective', profile, p01[i]);
        witnesses(projection.matrix, spVectors, spRaw[i], spNdc[i]);
    });
    test(`P02/${profile[0]}: asymmetric coefficients and five literal raw/NDC witnesses`, () => {
        const projection = createPerspectiveProjection3D(input(profile, ap));
        result(projection, 'perspective', profile, p02[i]);
        witnesses(projection.matrix, apVectors, apRaw[i], apNdc[i]);
    });
    test(`P03/${profile[0]}: orthographic coefficients, endpoints/interior and raw direction`, () => {
        const projection = createOrthographicProjection3D(input(profile, op));
        result(projection, 'orthographic', profile, p03[i]);
        witnesses(projection.matrix, opVectors, opRaw[i], opNdc[i]);
    });
    test(`P04/G06/${profile[0]}: orthographic near +/-0 owns literal normalized coefficients`, () => {
        for (const near of [0, -0]) {
            const projection = createOrthographicProjection3D(input(profile, {...op, near, far:8}));
            result(projection, 'orthographic', profile, p04[i]);
            witnesses(projection.matrix, o0Vectors, o0Raw[i], o0Ndc[i]);
            errorFrom(() => createPerspectiveProjection3D(input(profile, {near})), 'MATH3D_GEOMETRY_INVALID');
        }
    });
}
for (const [kind, factory] of factories) for (const profile of profiles) {
    test(`G01/${kind}/${profile[0]}: all six numeric fields require finite numbers without coercion`, () => {
        for (const field of numericFields) for (const value of [NaN, Infinity, -Infinity, '1', undefined, null, {}]) {
            const log = [], target = input(profile, {[field]:value});
            const proxy = new Proxy(target, { get(t,k,r) { log.push(k); return Reflect.get(t,k,r); } });
            errorFrom(() => factory(proxy), 'MATH3D_INPUT_INVALID');
            assert.deepEqual(log, fields);
        }
    });
    test(`G02-G04/${kind}/${profile[0]}: geometry and explicit depth flags have distinct codes`, () => {
        for (const values of [{left:1,right:1},{left:2,right:1},{bottom:1,top:1},{bottom:2,top:1},{near:-1},{far:1},{far:0}])
            errorFrom(() => factory(input(profile, values)), 'MATH3D_GEOMETRY_INVALID');
        for (const field of ['depthRange','depthDirection']) for (const value of [undefined, null, {}, 'ZEROtoOne', 'FORWARD', ''])
            errorFrom(() => factory(input(profile, {[field]:value})), 'MATH3D_INPUT_INVALID');
        for (const field of ['depthRange','depthDirection']) {
            const record=input(profile); delete record[field];
            errorFrom(() => factory(record), 'MATH3D_INPUT_INVALID');
        }
    });
    test(`G08-G09/${kind}/${profile[0]}: finite geometry cannot repair delta or endpoint-sum overflow`, () => {
        for (const values of [{left:-1e308,right:1e308},{bottom:-1e308,top:1e308},{left:1e308,right:1.1e308},{bottom:1e308,top:1.1e308}])
            errorFrom(() => factory(input(profile, values)), 'MATH3D_ARITHMETIC_RANGE');
    });
}
for (const [i, profile] of profiles.entries()) {
    test(`G07/${profile[0]}: only selected depth branch evaluates twoNF`, () => {
        const record=input(profile, {near:6.703903964971299e153,far:1.3407807929942597e154});
        if (i === 0) result(createPerspectiveProjection3D(record), 'perspective', profile,
            [6.703903964971299e153,0,0,0,0,6.703903964971299e153,0,0,0,0,-2,-1,0,0,-1.3407807929942597e154,0]);
        else if (i === 1) result(createPerspectiveProjection3D(record), 'perspective', profile,
            [6.703903964971299e153,0,0,0,0,6.703903964971299e153,0,0,0,0,1,-1,0,0,1.3407807929942597e154,0]);
        else errorFrom(() => createPerspectiveProjection3D(record), 'MATH3D_ARITHMETIC_RANGE');
    });
    test(`G10-G12-G14/${profile[0]}: fixed perspective intermediates and mandatory nonzero coefficients`, () => {
        for (const values of [{near:1e308,far:1.5e308},{near:1e200,far:2e200},
            {near:5e-324,far:1,left:0,right:1.7976931348623157e308,bottom:0,top:1},
            {near:5e-324,far:1e-323,left:-0.5,right:0.5,bottom:-0.5,top:0.5}])
            errorFrom(() => createPerspectiveProjection3D(input(profile, values)), 'MATH3D_ARITHMETIC_RANGE');
    });
}
test('G13: perspective ZR az and orthographic ZF positive-near bz cannot round to zero', () => {
    const values={near:5e-324,far:1.7976931348623157e308,left:-0.5,right:0.5,bottom:-0.5,top:0.5};
    errorFrom(() => createPerspectiveProjection3D(input(profiles[1], values)), 'MATH3D_ARITHMETIC_RANGE');
    errorFrom(() => createOrthographicProjection3D(input(profiles[0], values)), 'MATH3D_ARITHMETIC_RANGE');
});
test('C03: wrong NF range is a literal control against required ZF interior and convention', () => {
    const correct=createPerspectiveProjection3D(input(profiles[0])), wrong=createPerspectiveProjection3D(input(profiles[2]));
    result(correct, 'perspective', profiles[0], p01[0]); result(wrong, 'perspective', profiles[2], p01[2]);
    witnesses(correct.matrix, [[1.5,-1.5,-3,1]], [[1.5,-1.5,2.25,3]], [[0.5,-0.5,0.75]]);
    witnesses(wrong.matrix, [[1.5,-1.5,-3,1]], [[1.5,-1.5,1.5,3]], [[0.5,-0.5,0.5]]);
    assert.notDeepEqual(correct.matrix, wrong.matrix); assert.notDeepEqual(correct.depth, wrong.depth);
});
test('C04: manually omitted offsets give the wrong literal asymmetric-axis raw result', () => {
    const correct=createPerspectiveProjection3D(input(profiles[0], ap));
    const wrong=[0.5,0,0,0,0,0.5,0,0,0,0,-1.25,-1,0,0,-2.5,0];
    tuple(transformHomogeneous4(wrong, [0,0,-2,1]), [0,0,0,2]);
    tuple(transformHomogeneous4(correct.matrix, [0,0,-2,1]), [-1,1,0,2]);
    assert.notDeepEqual(correct.matrix, wrong);
});
for (const [kind, factory] of factories) {
    test(`I10/${kind}: exact ordered own-presence/value reads, ignored extras/prototype/coercion`, () => {
        const log=[], record=input(profiles[0]);
        Object.setPrototypeOf(record, {get ignored() {throw new Error('inherited extra');}});
        for (const key of ['extra','toJSON',Symbol.iterator,Symbol.toPrimitive]) Object.defineProperty(record,key,{get(){throw new Error('ignored extra');}});
        const proxy=new Proxy(record, {
            getOwnPropertyDescriptor(t,k) {log.push('own:'+k);return Reflect.getOwnPropertyDescriptor(t,k);},
            get(t,k,r) {log.push('read:'+String(k));return Reflect.get(t,k,r);},
        });
        factory(proxy);
        assert.deepEqual(log, ['own:left','read:left','own:right','read:right','own:bottom','read:bottom','own:top','read:top',
            'own:near','read:near','own:far','read:far','own:depthRange','read:depthRange','own:depthDirection','read:depthDirection']);
    });
    test(`I10/G05/${kind}: missing own numeric or flag captures remaining fields without inherited read`, () => {
        for (const missing of fields) {
            const log=[], record=input(profiles[0]); delete record[missing];
            Object.setPrototypeOf(record, Object.defineProperty({},missing,{get(){throw new Error('must ignore inherited');}}));
            const proxy=new Proxy(record,{get(t,k,r){log.push(k);return Reflect.get(t,k,r);}});
            errorFrom(() => factory(proxy), 'MATH3D_INPUT_INVALID');
            assert.deepEqual(log, fields.filter(k=>k!==missing));
        }
    });
    test(`I10/${kind}: frozen/class/null-prototype records are admitted; primitive/array inputs are invalid`, () => {
        class Record {constructor(){Object.assign(this,input(profiles[0]));}}
        for (const record of [Object.freeze(input(profiles[0])),new Record(),Object.assign(Object.create(null),input(profiles[0]))]) factory(record);
        let calls=0;
        for (const record of [null,undefined,1,'record',true,Symbol('record'),[],()=>{},
            {valueOf(){calls++;return 1;},toJSON(){calls++;},[Symbol.iterator](){calls++;}}])
            errorFrom(() => factory(record), 'MATH3D_INPUT_INVALID');
        assert.equal(calls,0);
    });
    test(`I10/${kind}: Array.isArray is read once and a revoked proxy retains its TypeError cause`, () => {
        const saved=Array.isArray, record=input(profiles[0]);let sourceCalls=0, ownedCalls=0;
        try {Array.isArray=value=>{if(value===record)sourceCalls++;else ownedCalls++;return saved(value);};
            factory(record);assert.equal(sourceCalls,1);assert.equal(ownedCalls,1);}
        finally {Array.isArray=saved;}
        const {proxy,revoke}=Proxy.revocable(input(profiles[0]),{});revoke();
        const error=errorFrom(()=>factory(proxy),'MATH3D_INPUT_READ_FAILED');assert.ok(error.cause instanceof TypeError);
    });
    test(`I09/I12/${kind}: source getter/own-presence/array-check throws retain every arbitrary cause`, () => {
        const causes=[...codes.map(code=>new Math3DError(code)),{name:'Math3DError',code:'MATH3D_ARITHMETIC_RANGE'},'primitive',null,undefined];
        for (const cause of causes) {
            for (const first of ['bad','missing']) {
                const record=input(profiles[0],{left:'invalid'});if(first==='missing')delete record.left;
                Object.defineProperty(record,'depthDirection',{get(){throw cause;}});
                errorFrom(()=>factory(record),'MATH3D_INPUT_READ_FAILED',cause,true);
            }
            const proxy=new Proxy(input(profiles[0]),{getOwnPropertyDescriptor(){throw cause;}});
            errorFrom(()=>factory(proxy),'MATH3D_INPUT_READ_FAILED',cause,true);
            const saved=Array.isArray;
            try {Array.isArray=()=>{throw cause;};errorFrom(()=>factory(input(profiles[0])),'MATH3D_INPUT_READ_FAILED',cause,true);}
            finally {Array.isArray=saved;}
        }
    });
    test(`I11/${kind}: left getter observes later right mutation and every result owns frozen values`, () => {
        for (const [i,profile] of profiles.entries()) {
            const record=input(profile,kind==='perspective'?{...ap,right:4}:{...op,right:4});let leftReads=0;
            Object.defineProperty(record,'left',{get(){leftReads++;record.right=6;return -2;}});
            const projection=factory(record), again=factory(record);assert.equal(leftReads,2);
            result(projection,kind,profile,kind==='perspective'?p02[i]:p03[i]);
            for(const key of ['matrix','depth'])assert.notEqual(projection[key],again[key]);assert.notEqual(projection,again);
            record.right=8;record.depthRange='invalid';record.depthDirection='invalid';
            const copy=Array.from(projection.matrix);copy[0]=99;
            assert.throws(()=>{projection.matrix[0]=99;},TypeError);
            assert.throws(()=>{projection.depth.range='invalid';},TypeError);
            assert.throws(()=>{projection.kind='invalid';},TypeError);
            result(projection,kind,profile,kind==='perspective'?p02[i]:p03[i]);
        }
    });
    test(`I09/${kind}: all three freeze boundaries and both owned tuple allocations preserve native cause`, () => {
        const causes=[...codes.map(code=>new Math3DError(code)),{code:'MATH3D_INPUT_INVALID'},'primitive',null,undefined];
        for (const cause of causes) {
            for (const selected of [1,2,3]) {
                const saved=Object.freeze;let calls=0;
                try {Object.freeze=value=>{if(++calls===selected)throw cause;return saved(value);};
                    errorFrom(()=>factory(input(profiles[0])),'MATH3D_NATIVE_FAILED',cause,true);assert.equal(calls,selected);}
                finally {Object.freeze=saved;}
            }
            for (const selected of [1,2]) {
                const saved=globalThis.Array;let calls=0;
                try {globalThis.Array=new Proxy(saved,{construct(target,args){if(++calls===selected)throw cause;return Reflect.construct(target,args);}});
                    errorFrom(()=>factory(input(profiles[0])),'MATH3D_NATIVE_FAILED',cause,true);assert.equal(calls,selected);}
                finally {globalThis.Array=saved;}
            }
        }
    });
    test(`I09/${kind}: a previous genuine geometry error has no authority when rethrown by source/native operations`, () => {
        const old=errorFrom(()=>factory(input(profiles[0],{far:1})),'MATH3D_GEOMETRY_INVALID');
        const record=input(profiles[0]);Object.defineProperty(record,'left',{get(){throw old;}});
        errorFrom(()=>factory(record),'MATH3D_INPUT_READ_FAILED',old,true);
        const saved=Object.freeze;
        try {Object.freeze=()=>{throw old;};errorFrom(()=>factory(input(profiles[0])),'MATH3D_NATIVE_FAILED',old,true);}
        finally {Object.freeze=saved;}
    });
}
