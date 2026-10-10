import test from 'node:test';
import assert from 'node:assert/strict';
import { createWebGPUMeshPipeline, encodeWebGPUMesh } from '../packages/engine/dist/web/webgpuMeshPass.js';

// Independent first-party fixture, selected before the implementation. These tests
// inspect actual helper output; they do not compile WGSL or establish GPU pixels.
const expectedShader = `struct MeshUniform {
    mvp: mat4x4<f32>,
}
@group(0) @binding(0) var<uniform> draw: MeshUniform;

struct MeshVertexOutput {
    @builtin(position) clip: vec4<f32>,
    @location(0) rgb: vec3<f32>,
}

@vertex fn vertexMain(
    @location(0) position: vec3<f32>,
    @location(1) color: vec3<f32>,
) -> MeshVertexOutput {
    var result: MeshVertexOutput;
    result.clip = draw.mvp * vec4<f32>(position, 1.0);
    result.rgb = color;
    return result;
}

@fragment fn fragmentMain(input: MeshVertexOutput) -> @location(0) vec4<f32> {
    return vec4<f32>(input.rgb, 1.0);
}
`;

function expectedDescriptor(module, format) {
    return {
        layout: 'auto',
        vertex: {
            module, entryPoint: 'vertexMain',
            buffers: [{ arrayStride: 24, stepMode: 'vertex', attributes: [
                { shaderLocation: 0, offset: 0, format: 'float32x3' },
                { shaderLocation: 1, offset: 12, format: 'float32x3' },
            ] }],
        },
        fragment: { module, entryPoint: 'fragmentMain', targets: [{ format, writeMask: 15 }] },
        primitive: { topology: 'triangle-list', frontFace: 'ccw', cullMode: 'none', unclippedDepth: false },
        depthStencil: { format: 'depth32float', depthWriteEnabled: true, depthCompare: 'greater', depthBias: 0, depthBiasSlopeScale: 0, depthBiasClamp: 0 },
        multisample: { count: 1, alphaToCoverageEnabled: false },
    };
}

for (const [id, format] of [['D01_rgba_exact_descriptor', 'rgba8unorm'], ['D02_bgra_exact_descriptor', 'bgra8unorm']]) {
    // Break caught: wrong descriptor ABI, callback order/module identity, or wrapped Promise.
    test(id, async () => {
        const module = Object.freeze({ module: format }), pipeline = Object.freeze({ pipeline: format });
        const calls = [], supplied = Promise.resolve(pipeline);
        let shaderDescriptor, pipelineDescriptor;
        const actual = createWebGPUMeshPipeline(
            value => { calls.push('shader'); shaderDescriptor = value; return module; },
            value => { calls.push('pipeline'); pipelineDescriptor = value; return supplied; },
            format,
        );
        assert.deepEqual(calls, ['shader', 'pipeline']);
        assert.equal(actual, supplied);
        assert.equal(await actual, pipeline);
        assert.deepEqual(pipelineDescriptor, expectedDescriptor(module, format));
        assert.deepEqual(shaderDescriptor, { code: expectedShader });
        assert.equal(pipelineDescriptor.vertex.module, module);
        assert.equal(pipelineDescriptor.fragment.module, module);
        const target = pipelineDescriptor.fragment.targets[0];
        for (const [object, key] of [[target, 'blend'], [pipelineDescriptor.primitive, 'stripIndexFormat'],
            ...['stencilFront', 'stencilBack', 'stencilReadMask', 'stencilWriteMask'].map(key => [pipelineDescriptor.depthStencil, key])]) {
            assert.equal(Object.hasOwn(object, key), false, `unsupported field ${key}`);
        }
    });
}

// Break caught: transpose/division/Y conversion/color conversion or wrong uniform/input ABI.
test('D03_exact_WGSL_source', async () => {
    let descriptor;
    const actual = createWebGPUMeshPipeline(value => { descriptor = value; return {}; }, () => Promise.resolve({}), 'rgba8unorm');
    await actual;
    assert.deepEqual(Reflect.ownKeys(descriptor), ['code']);
    assert.equal(descriptor.code, expectedShader);
    const code = descriptor.code;
    assert.equal(code.includes('\r'), false);
    assert.equal(code.startsWith('struct MeshUniform'), true);
    assert.equal(code.endsWith('\n'), true);
    assert.match(code, /struct MeshUniform\s*\{\s*mvp:\s*mat4x4<f32>,\s*\}/);
    assert.equal((code.match(/var<uniform>/g) ?? []).length, 1);
    assert.match(code, /@group\(0\) @binding\(0\) var<uniform> draw: MeshUniform/);
    assert.match(code, /@location\(0\) position: vec3<f32>/);
    assert.match(code, /@location\(1\) color: vec3<f32>/);
    assert.match(code, /result\.clip = draw\.mvp \* vec4<f32>\(position, 1\.0\)/);
    assert.match(code, /result\.rgb = color/);
    assert.match(code, /return vec4<f32>\(input\.rgb, 1\.0\)/);
    assert.doesNotMatch(code, /@interpolate\(flat\)|\b(?:pow|clamp|transpose|textureSample|textureLoad|discard)\b|\/|-[\s]*position\.y/);
    // The authored column-major fixture gives (x+w, 2y-2w, z/4+3w, -z):
    // [2,1,-4,1] -> [3,0,2,4]. This explains policy, not shader execution.
});

const arbitraryCauses = [undefined, null, false, 0, -0, NaN, 'fault', 7n, Symbol('fault'), Object.freeze({ fault: true }), new Error('fault')];
function catchesExactly(operation, cause) {
    let didThrow = false, thrown;
    try { operation(); } catch (error) { didThrow = true; thrown = error; }
    assert.equal(didThrow, true, 'operation must throw, even when the cause is undefined');
    assert.equal(Object.is(thrown, cause), true, 'original thrown value must survive');
}

// Break caught: swallowing/reclassifying shader errors or invoking pipeline after a shader fault.
test('D04_shader_sync_throw', () => {
    for (const cause of arbitraryCauses) {
        let pipelineCalls = 0;
        catchesExactly(() => createWebGPUMeshPipeline(() => { throw cause; }, () => { pipelineCalls++; return Promise.resolve({}); }, 'rgba8unorm'), cause);
        assert.equal(pipelineCalls, 0);
    }
});

// Break caught: async conversion or reclassification of a synchronous pipeline callback fault.
test('D05_pipeline_sync_throw', () => {
    for (const cause of arbitraryCauses) {
        const calls = [];
        catchesExactly(() => createWebGPUMeshPipeline(() => { calls.push('shader'); return {}; }, () => { calls.push('pipeline'); throw cause; }, 'bgra8unorm'), cause);
        assert.deepEqual(calls, ['shader', 'pipeline']);
    }
});

// Break caught: wrapped/substituted Promise or changed rejection value.
test('D06_pipeline_reject', async () => {
    for (const cause of arbitraryCauses) {
        const supplied = Promise.reject(cause);
        // Observe both supplied and returned work immediately, even if the helper is faulty.
        const suppliedObservation = supplied.then(() => ({ rejected: false }), value => ({ rejected: true, value }));
        const actual = createWebGPUMeshPipeline(() => ({}), () => supplied, 'rgba8unorm');
        const actualObservation = actual.then(() => ({ rejected: false }), value => ({ rejected: true, value }));
        assert.equal(actual, supplied);
        const observed = await actualObservation;
        assert.equal(observed.rejected, true);
        assert.equal(Object.is(observed.value, cause), true);
        await suppliedObservation;
    }
});

const methods = ['setPipeline', 'setViewport', 'setScissorRect', 'setVertexBuffer', 'setIndexBuffer', 'setBindGroup', 'drawIndexed'];
const forbidden = ['beginRenderPass', 'end', 'finish', 'submit', 'createBuffer', 'createTexture', 'writeBuffer', 'pushErrorScope', 'popErrorScope', 'onSubmittedWorkDone'];
function passRecorder(calls, failAt, cause) {
    const pass = {};
    for (const name of methods) {
        pass[name] = function (...args) {
            assert.equal(this, pass, `actual receiver for ${name}`);
            calls.push([name, ...args]);
            if (name === failAt) throw cause;
        };
    }
    for (const name of forbidden) Object.defineProperty(pass, name, { get() { assert.fail(`host-owned operation ${name} must not be read`); } });
    return pass;
}
const pipelineToken = Object.freeze({ pipeline: true }), verticesToken = Object.freeze({ vertices: true }), indicesToken = Object.freeze({ indices: true });
function expectedTrace(bindings) {
    return [['setPipeline', pipelineToken], ['setViewport', 0, 0, 20, 12, 0, 1], ['setScissorRect', 0, 0, 20, 12],
        ['setVertexBuffer', 0, verticesToken], ['setIndexBuffer', indicesToken, 'uint32'], ['setBindGroup', 0, bindings], ['drawIndexed', 3, 1, 0, 0, 0]];
}

// Break caught: wrong receiver, resource/viewport/index arguments, call order or ownership operations.
test('D07_nonempty_encode', () => {
    const calls = [], bindings = Object.freeze({ bindings: true }), pass = passRecorder(calls);
    assert.equal(encodeWebGPUMesh(pass, pipelineToken, verticesToken, indicesToken, bindings, 3, 20, 12), undefined);
    assert.deepEqual(calls, expectedTrace(bindings));
});

// Break caught: any empty-path property read or state/draw operation.
test('D08_empty_encode', () => {
    let reads = 0;
    const inaccessible = new Proxy({}, { get() { reads++; assert.fail('empty draw must not read the pass'); } });
    assert.equal(encodeWebGPUMesh(inaccessible, pipelineToken, verticesToken, indicesToken, {}, 0, 20, 12), undefined);
    assert.equal(reads, 0);
});

// Break caught: continued encoding after any throw, altered cause, or incorrect failure prefix.
test('D09_pass_throw_prefix', () => {
    for (const name of methods) for (const cause of arbitraryCauses) {
        const calls = [], bindings = Object.freeze({ bindings: name }), pass = passRecorder(calls, name, cause);
        catchesExactly(() => encodeWebGPUMesh(pass, pipelineToken, verticesToken, indicesToken, bindings, 3, 20, 12), cause);
        assert.deepEqual(calls, expectedTrace(bindings).slice(0, methods.indexOf(name) + 1));
    }
});

// Break caught: caching/replacing supplied per-draw bindings or reordering repeated draws.
test('D10_two_draw_binding_order', () => {
    const calls = [], first = Object.freeze({ uniform: 'first' }), second = Object.freeze({ uniform: 'second' }), pass = passRecorder(calls);
    assert.notEqual(first, second);
    encodeWebGPUMesh(pass, pipelineToken, verticesToken, indicesToken, first, 3, 20, 12);
    encodeWebGPUMesh(pass, pipelineToken, verticesToken, indicesToken, second, 3, 20, 12);
    assert.deepEqual(calls, [...expectedTrace(first), ...expectedTrace(second)]);
    // Supplied tokens test helper order only; they do not authenticate scene/geometry or allocate uniforms.
});
