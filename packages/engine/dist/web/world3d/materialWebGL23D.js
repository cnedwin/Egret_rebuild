import { TEXTURE_UNITS_3D } from './shaders3D.js';
// Program variant bits contributed by geometry, mesh and frame state.
export const MATERIAL_VARIANT_WEBGL2_3D = Object.freeze({
    normal: 1,
    tangent: 2,
    uv: 4,
    color: 8,
    skin: 16,
    morph: 32,
    morphNormals: 64,
    instancing: 128,
    instanceColor: 256,
    receiveShadow: 512,
    fog: 1024,
    toneMapped: 2048,
    environment: 4096,
    points: 8192,
    depthOnly: 16384,
    linearOutput: 32768,
    mapFromTarget: 65536,
    uv1: 131072,
    occlusionSecond: 262144,
    emissiveSecond: 524288,
    lightSecond: 1048576,
    transmission: 2097152,
    skinInstancing: 4194304,
    gpuParticles: 8388608,
    softDepth: 16777216
});
const IDENTITY3 = new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]);
/** Preserve define order because the renderer uses it as part of the linked-program key. */
export function buildMaterialDefinesWebGL23D(material, variant, depthOnly) {
    const has = (bit) => (variant & bit) !== 0;
    const uv = has(MATERIAL_VARIANT_WEBGL2_3D.uv), defines = [];
    if (depthOnly)
        defines.push('DEPTH_ONLY');
    else
        defines.push(material.shading === 'unlit'
            ? 'SHADING_UNLIT'
            : material.shading === 'lambert'
                ? 'SHADING_LAMBERT'
                : material.shading === 'phong'
                    ? 'SHADING_PHONG'
                    : material.shading === 'toon'
                        ? 'SHADING_TOON'
                        : material.shading === 'matcap'
                            ? 'SHADING_MATCAP'
                            : 'SHADING_STANDARD');
    if (has(MATERIAL_VARIANT_WEBGL2_3D.normal))
        defines.push('USE_NORMAL');
    if (has(MATERIAL_VARIANT_WEBGL2_3D.skin))
        defines.push('USE_SKINNING');
    if (has(MATERIAL_VARIANT_WEBGL2_3D.morph))
        defines.push('USE_MORPH');
    if (has(MATERIAL_VARIANT_WEBGL2_3D.morphNormals) && (!depthOnly || material.shader?.glslVertex !== undefined))
        defines.push('USE_MORPH_NORMALS');
    if (has(MATERIAL_VARIANT_WEBGL2_3D.instancing))
        defines.push('USE_INSTANCING');
    if (has(MATERIAL_VARIANT_WEBGL2_3D.skinInstancing))
        defines.push('USE_SKIN_INSTANCING');
    if (has(MATERIAL_VARIANT_WEBGL2_3D.gpuParticles) && !depthOnly)
        defines.push('GPU_PARTICLES');
    if (has(MATERIAL_VARIANT_WEBGL2_3D.softDepth))
        defines.push('USE_SOFT_DEPTH');
    if (has(MATERIAL_VARIANT_WEBGL2_3D.points))
        defines.push('POINTS');
    if (material.screenSpace)
        defines.push('SCREEN_SPACE');
    else if (material.billboard)
        defines.push('BILLBOARD');
    if (uv && material.map) {
        defines.push('USE_MAP');
        if (has(MATERIAL_VARIANT_WEBGL2_3D.mapFromTarget))
            defines.push('MAP_FROM_TARGET');
    }
    if (uv && material.splat && !depthOnly)
        defines.push('USE_SPLAT');
    if (material.alphaMode === 'mask')
        defines.push('ALPHA_MASK');
    if (material.alphaMode === 'blend') {
        defines.push('ALPHA_BLEND');
        if (!depthOnly && material.blending === 'premultiplied')
            defines.push('PREMULTIPLIED_ALPHA');
    }
    if (has(MATERIAL_VARIANT_WEBGL2_3D.color))
        defines.push('USE_VERTEX_COLOR');
    if (!depthOnly) {
        const lit = material.shading !== 'unlit' && material.shading !== 'matcap';
        if (has(MATERIAL_VARIANT_WEBGL2_3D.instanceColor))
            defines.push('USE_INSTANCE_COLOR');
        if (lit && uv && material.normalMap) {
            defines.push('USE_NORMAL_MAP');
            if (has(MATERIAL_VARIANT_WEBGL2_3D.tangent))
                defines.push('USE_TANGENT');
        }
        if (lit && uv && material.metallicRoughnessMap && material.shading === 'standard')
            defines.push('USE_MR_MAP');
        // A map on the second coordinate set needs only that set; it falls back to the first when the geometry lacks it.
        const aoSecond = has(MATERIAL_VARIANT_WEBGL2_3D.occlusionSecond), emissiveSecond = has(MATERIAL_VARIANT_WEBGL2_3D.emissiveSecond);
        if (lit && (uv || aoSecond) && material.occlusionMap) {
            defines.push('USE_AO_MAP');
            if (aoSecond)
                defines.push('AO_UV1');
        }
        if ((uv || emissiveSecond) && material.emissiveMap && material.shading !== 'matcap') {
            defines.push('USE_EMISSIVE_MAP');
            if (emissiveSecond)
                defines.push('EMISSIVE_UV1');
        }
        if (lit && material.lightMap && (uv || has(MATERIAL_VARIANT_WEBGL2_3D.lightSecond))) {
            defines.push('USE_LIGHT_MAP');
            if (has(MATERIAL_VARIANT_WEBGL2_3D.lightSecond))
                defines.push('LIGHT_UV1');
        }
        if (material.flatShading)
            defines.push('FLAT_SHADED');
        if (material.side === 'double')
            defines.push('DOUBLE_SIDED');
        if (lit && has(MATERIAL_VARIANT_WEBGL2_3D.receiveShadow))
            defines.push('RECEIVE_SHADOW');
        if (lit && has(MATERIAL_VARIANT_WEBGL2_3D.environment))
            defines.push('USE_ENVIRONMENT');
        if (has(MATERIAL_VARIANT_WEBGL2_3D.fog) && material.fog)
            defines.push('USE_FOG');
        if (has(MATERIAL_VARIANT_WEBGL2_3D.toneMapped) && material.toneMapped)
            defines.push('TONE_MAPPED');
        if (has(MATERIAL_VARIANT_WEBGL2_3D.linearOutput))
            defines.push('LINEAR_OUTPUT');
        if (has(MATERIAL_VARIANT_WEBGL2_3D.transmission) && material.shading === 'standard')
            defines.push('USE_TRANSMISSION');
        if (material.reflectionMap && material.shading === 'standard')
            defines.push('USE_REFLECTION_MAP');
    }
    return defines;
}
/** Apply uniforms and textures in draw order using the renderer's existing scratch matrix. */
export function applyMaterialWebGL23D(gl, u, resources, scratch9, material, depthOnly) {
    if (u['uColor'])
        gl.uniform4f(u['uColor'], material.color[0], material.color[1], material.color[2], material.opacity);
    if (u['uAlphaCutoff'])
        gl.uniform1f(u['uAlphaCutoff'], material.alphaCutoff);
    const customLocation = u['uCustom[0]'] ?? u['uCustom'];
    if (customLocation && material.shader)
        gl.uniform4fv(customLocation, material.shader.uniforms);
    if (u['uMap'] && material.map)
        resources.bindTexture(TEXTURE_UNITS_3D.map, material.map);
    if (u['uUvTransform']) {
        const map = material.map;
        if (map?.hasTransform) {
            const c = Math.cos(map.rotation), s = Math.sin(map.rotation), m = scratch9;
            m[0] = c * map.repeat[0];
            m[1] = s * map.repeat[0];
            m[2] = 0;
            m[3] = -s * map.repeat[1];
            m[4] = c * map.repeat[1];
            m[5] = 0;
            m[6] = map.offset[0];
            m[7] = map.offset[1];
            m[8] = 1;
            gl.uniformMatrix3fv(u['uUvTransform'], false, m);
        }
        else
            gl.uniformMatrix3fv(u['uUvTransform'], false, IDENTITY3);
    }
    if (u['uSprite'])
        gl.uniform4f(u['uSprite'], material.rotation, material.sizeAttenuation ? 1 : 0, 0, 0);
    if (u['uPointSize'])
        gl.uniform2f(u['uPointSize'], material.pointSize, material.sizeAttenuation ? 1 : 0);
    if (depthOnly)
        return;
    const e = material.emissiveIntensity;
    if (u['uEmissive'])
        gl.uniform3f(u['uEmissive'], material.emissive[0] * e, material.emissive[1] * e, material.emissive[2] * e);
    if (u['uClearcoat'])
        gl.uniform2f(u['uClearcoat'], material.clearcoat, material.clearcoatRoughness);
    if (u['uSurface'])
        gl.uniform4f(u['uSurface'], material.metallic, material.roughness, material.normalScale, material.occlusionStrength);
    if (u['uSpecular'])
        gl.uniform4f(u['uSpecular'], material.specular[0], material.specular[1], material.specular[2], material.shading === 'toon' ? material.toonSteps : material.shininess);
    if (u['uEnvironmentScale'])
        gl.uniform1f(u['uEnvironmentScale'], material.environmentIntensity);
    if (u['uNormalMap'] && material.normalMap)
        resources.bindTexture(TEXTURE_UNITS_3D.normalMap, material.normalMap);
    if (u['uMetallicRoughnessMap'] && material.metallicRoughnessMap)
        resources.bindTexture(TEXTURE_UNITS_3D.metallicRoughnessMap, material.metallicRoughnessMap);
    if (u['uOcclusionMap'] && material.occlusionMap)
        resources.bindTexture(TEXTURE_UNITS_3D.occlusionMap, material.occlusionMap);
    if (u['uEmissiveMap'] && material.emissiveMap)
        resources.bindTexture(TEXTURE_UNITS_3D.emissiveMap, material.emissiveMap);
    if (u['uLightMap'] && material.lightMap)
        resources.bindTexture(TEXTURE_UNITS_3D.lightMap, material.lightMap);
    if (u['uReflectionMap'] && material.reflectionMap)
        resources.bindTexture(TEXTURE_UNITS_3D.reflectionMap, material.reflectionMap);
    const splat = material.splat;
    if (u['uSplatRepeat'] && splat) {
        // Layers borrow the units of the maps they stand in for; a missing layer reads the first.
        const layer = (i) => splat.layers[i] ?? splat.layers[0];
        resources.bindTexture(TEXTURE_UNITS_3D.map, layer(0));
        resources.bindTexture(TEXTURE_UNITS_3D.emissiveMap, layer(1));
        resources.bindTexture(TEXTURE_UNITS_3D.occlusionMap, layer(2));
        resources.bindTexture(TEXTURE_UNITS_3D.metallicRoughnessMap, layer(3));
        resources.bindTexture(TEXTURE_UNITS_3D.lightMap, splat.weights);
        gl.uniform4f(u['uSplatRepeat'], splat.repeat[0] ?? 1, splat.repeat[1] ?? 1, splat.repeat[2] ?? 1, splat.repeat[3] ?? 1);
    }
    if (u['uSoftness'])
        gl.uniform1f(u['uSoftness'], material.softness);
    if (u['uReflection'])
        gl.uniform2f(u['uReflection'], material.reflectionStrength, material.reflectionDistortion);
    if (u['uSheen'])
        gl.uniform4f(u['uSheen'], material.sheenColor[0] * material.sheen, material.sheenColor[1] * material.sheen, material.sheenColor[2] * material.sheen, material.sheenRoughness);
    if (u['uExtra'])
        gl.uniform2f(u['uExtra'], material.lightMapIntensity, material.transmission);
    if (u['uRefraction'])
        gl.uniform4f(u['uRefraction'], material.ior, material.thickness, Number.isFinite(material.attenuationDistance) ? material.attenuationDistance : 0, 0);
    if (u['uAttenuation'])
        gl.uniform3f(u['uAttenuation'], material.attenuationColor[0], material.attenuationColor[1], material.attenuationColor[2]);
}
//# sourceMappingURL=materialWebGL23D.js.map