import { SkinnedInstancedMesh3D } from '../../rendering/world3d/AnimationTexture3D.js';
import { MAX_MORPH_INFLUENCES_WGSL_3D } from './wgsl3D.js';
export function convertVertexAttribute3D(name, attribute) {
    const data = attribute.data;
    // Joint indices stay integers; everything else is uploaded as 32-bit floats,
    // which sidesteps the vertex formats WebGPU does not offer.
    if (name === 'joints')
        return data instanceof Uint32Array ? data : Uint32Array.from(data);
    if (data instanceof Float32Array)
        return data;
    const out = new Float32Array(data.length);
    if (!attribute.normalized) {
        out.set(data);
        return out;
    }
    const signed = data instanceof Int8Array || data instanceof Int16Array, max = signed
        ? data instanceof Int8Array
            ? 127
            : 32767
        : data instanceof Uint8Array
            ? 255
            : data instanceof Uint16Array
                ? 65535
                : 4294967295;
    for (let i = 0; i < data.length; i++)
        out[i] = signed ? Math.max(data[i] / max, -1) : data[i] / max;
    return out;
}
export function packMorphStorage3D(targets, channels, vertexCount) {
    const data = new Float32Array(targets.length * channels * vertexCount * 4);
    targets.forEach((target, t) => {
        [target.position, target.normal].slice(0, channels).forEach((source, k) => {
            if (!source)
                return;
            const base = (t * channels + k) * vertexCount * 4;
            for (let v = 0; v < vertexCount; v++) {
                data[base + v * 4] = source[v * 3];
                data[base + v * 4 + 1] = source[v * 3 + 1];
                data[base + v * 4 + 2] = source[v * 3 + 2];
            }
        });
    });
    return data;
}
export function packWireIndices3D(geometry) {
    const source = geometry.index?.data, triangles = Math.floor(geometry.drawCount / 3), lines = new Uint32Array(triangles * 6);
    for (let t = 0; t < triangles; t++) {
        const a = source ? source[t * 3] : t * 3, b = source ? source[t * 3 + 1] : t * 3 + 1, c = source ? source[t * 3 + 2] : t * 3 + 2;
        lines.set([a, b, b, c, c, a], t * 6);
    }
    return lines;
}
/** The renderer calls this only when its geometry has a morph storage buffer. */
export function writeObjectMorph3D(mesh, gpu, floats, ints, o) {
    // Keep the strongest influences; the shader blends at most a fixed number.
    const weights = mesh.morphWeights, indices = o + 48, values = o + 56;
    let count = 0;
    for (let i = 0; i < weights.length; i++) {
        const weight = weights[i];
        if (weight === 0)
            continue;
        if (count < MAX_MORPH_INFLUENCES_WGSL_3D) {
            ints[indices + count] = i;
            floats[values + count] = weight;
            count++;
            continue;
        }
        let weakest = 0;
        for (let k = 1; k < count; k++)
            if (Math.abs(floats[values + k]) < Math.abs(floats[values + weakest]))
                weakest = k;
        if (Math.abs(weight) > Math.abs(floats[values + weakest])) {
            ints[indices + weakest] = i;
            floats[values + weakest] = weight;
        }
    }
    // Baked instances take their morph weights from the table; the shader only needs to know how many targets to read.
    if (mesh instanceof SkinnedInstancedMesh3D && !mesh.skeleton)
        count = Math.min(MAX_MORPH_INFLUENCES_WGSL_3D, mesh.animations.morphCount, mesh.geometry.morphTargets.length);
    ints[o + 44] = gpu.morph.vertexCount;
    ints[o + 45] = gpu.morph.channels;
    ints[o + 46] = count;
    ints[o + 47] = 0;
}
//# sourceMappingURL=webgpuPacking3D.js.map