// SPDX-License-Identifier: Apache-2.0
// Surface descriptions consumed by the first-party shader library. All color
// values are linear RGB; factories accept 0xRRGGBB sRGB hex for convenience.
import { Resource3D, World3DError } from './core3D.js';
import { colorFromHex } from './math3D.js';
export function createCustomShader3D(input) {
    if (!input || typeof input.key !== 'string' || input.key.length === 0 || /[\s|/]/.test(input.key))
        throw new World3DError('WORLD3D_INPUT_INVALID', 'shader key');
    if (input.glsl === undefined &&
        input.wgsl === undefined &&
        input.glslVertex === undefined &&
        input.wgslVertex === undefined &&
        input.glslNormal === undefined &&
        input.wgslNormal === undefined)
        throw new World3DError('WORLD3D_INPUT_INVALID', 'shader source');
    const uniforms = new Float32Array(16);
    if (input.uniforms)
        uniforms.set(Array.from(input.uniforms).slice(0, 16));
    return Object.freeze({
        key: input.key,
        ...(input.glsl === undefined ? {} : { glsl: input.glsl }),
        ...(input.wgsl === undefined ? {} : { wgsl: input.wgsl }),
        ...(input.glslVertex === undefined ? {} : { glslVertex: input.glslVertex }),
        ...(input.wgslVertex === undefined ? {} : { wgslVertex: input.wgslVertex }),
        ...(input.glslNormal === undefined ? {} : { glslNormal: input.glslNormal }),
        ...(input.wgslNormal === undefined ? {} : { wgslNormal: input.wgslNormal }),
        uniforms
    });
}
export function setColor3D(out, input) {
    if (typeof input === 'number')
        colorFromHex(out, input);
    else if (Array.isArray(input) && input.length === 3 && input.every(Number.isFinite)) {
        out[0] = input[0];
        out[1] = input[1];
        out[2] = input[2];
    }
    else
        throw new World3DError('WORLD3D_INPUT_INVALID', 'color');
    return out;
}
/**
 * One material class carries the superset of surface parameters; `shading`
 * selects the lighting model. Assign fields freely and call touch() when a
 * change alters shader features (maps added or removed, alpha mode, side).
 * Scalar and color edits take effect on the next draw without touch().
 */
export class Material3D extends Resource3D {
    shading;
    color = new Float32Array([1, 1, 1]);
    opacity = 1;
    map;
    side = 'front';
    alphaMode = 'opaque';
    /** Fragments below this alpha are discarded in 'mask' mode. */
    alphaCutoff = 0.5;
    blending = 'normal';
    depthTest = true;
    depthWrite = true;
    /** Multiply the base color by the geometry's `color` attribute. */
    vertexColors = false;
    fog = true;
    toneMapped = true;
    visible = true;
    emissive = new Float32Array([0, 0, 0]);
    emissiveIntensity = 1;
    emissiveMap;
    normalMap;
    normalScale = 1;
    occlusionMap;
    occlusionStrength = 1;
    flatShading = false;
    wireframe = false;
    // Phong
    specular = new Float32Array([0.07, 0.07, 0.07]);
    shininess = 30;
    /** Optional fragment hook. Call touch() after assigning a different shader. */
    shader;
    /**
     * Baked lighting added to the indirect light of lit materials. It is sampled
     * with the texture's `channel`, normally 1 for a second, non-overlapping UV set.
     */
    lightMap;
    lightMapIntensity = 1;
    /**
     * A mirror image of the scene for a flat reflective surface on a standard
     * material, normally the texture of a PlanarReflection3D. It is read at
     * the pixel's own place on screen, so the mesh needs no coordinates for
     * it, and it takes the place of the environment map's reflection.
     */
    reflectionMap;
    reflectionStrength = 1;
    /** How far the surface normal pushes the mirror image sideways, as a share of the screen. */
    reflectionDistortion = 0.02;
    /**
     * For blended materials such as particles and haze: the distance over which
     * the surface fades out where it comes close to the solid geometry behind
     * it, instead of ending in a hard line. 0 turns the fade off.
     */
    softness = 0;
    /**
     * Ground layers blended by a weight map, for terrain: up to four tiling
     * textures, each shown where its channel of `weights` (R, G, B, A) is
     * strong. Weights are read with the mesh's coordinates as they are and
     * layers with those coordinates times their `repeat`. The layers take
     * the texture slots of map, emissiveMap, occlusionMap, metallicRoughnessMap
     * and lightMap, so leave those unset. Call touch() after assigning.
     */
    splat;
    /** Strength, 0 to 1, of a soft rim lobe for cloth and velvet on a standard material. */
    sheen = 0;
    sheenColor = new Float32Array([1, 1, 1]);
    sheenRoughness = 0.5;
    /**
     * How much light passes through a standard material, 0 to 1, as for glass.
     * What lies behind is drawn first and then seen through the surface,
     * tinted by its color and blurred by its roughness. Such a material is
     * drawn with the transparent objects whatever its alphaMode; other
     * see-through and transparent objects behind it do not show through.
     */
    transmission = 0;
    /** Index of refraction for transmission: 1 does not bend light, 1.5 is glass, 1.33 water. */
    ior = 1.5;
    /** How far, in world units, light travels inside a transmitting object. Zero means a thin sheet that does not bend the view. */
    thickness = 0;
    /** Color white light takes on after travelling `attenuationDistance` inside a transmitting object. */
    attenuationColor = new Float32Array([1, 1, 1]);
    attenuationDistance = Infinity;
    /** Strength, 0 to 1, of a clear lacquer layer over a standard material (car paint, varnish). */
    clearcoat = 0;
    clearcoatRoughness = 0.1;
    /** Number of light bands for toon shading. */
    toonSteps = 3;
    // Standard (metallic-roughness PBR)
    metallic = 0;
    roughness = 1;
    metallicRoughnessMap;
    environmentIntensity = 1;
    // Sprite and point rendering
    billboard = false;
    /** Treat vertex positions as normalized device coordinates; used by full-screen layers. */
    screenSpace = false;
    sizeAttenuation = true;
    rotation = 0;
    pointSize = 1;
    /** Polygon offset to resolve coplanar decals: [factor, units]. */
    polygonOffset;
    constructor(shading, options = {}) {
        super();
        this.shading = shading;
        this.name = options.name ?? '';
        if (options.color !== undefined)
            setColor3D(this.color, options.color);
        if (options.emissive !== undefined)
            setColor3D(this.emissive, options.emissive);
        this.opacity = options.opacity ?? 1;
        this.map = options.map;
        this.side = options.side ?? 'front';
        this.alphaMode = options.alphaMode ?? (this.opacity < 1 ? 'blend' : 'opaque');
        this.alphaCutoff = options.alphaCutoff ?? 0.5;
        this.blending = options.blending ?? 'normal';
        this.depthTest = options.depthTest ?? true;
        this.depthWrite = options.depthWrite ?? this.alphaMode !== 'blend';
        this.vertexColors = options.vertexColors ?? false;
        this.fog = options.fog ?? true;
        this.toneMapped = options.toneMapped ?? true;
        this.emissiveIntensity = options.emissiveIntensity ?? 1;
        this.emissiveMap = options.emissiveMap;
        this.normalMap = options.normalMap;
        this.normalScale = options.normalScale ?? 1;
        this.occlusionMap = options.occlusionMap;
        this.occlusionStrength = options.occlusionStrength ?? 1;
        this.flatShading = options.flatShading ?? false;
        this.wireframe = options.wireframe ?? false;
    }
    /** True when the material must be drawn in the sorted transparent pass. */
    get isTransparent() {
        return this.alphaMode === 'blend';
    }
    setColor(color) {
        setColor3D(this.color, color);
        return this;
    }
    setEmissive(color) {
        setColor3D(this.emissive, color);
        return this;
    }
    /** Independent copy sharing texture references. */
    clone() {
        const copy = new Material3D(this.shading);
        const skip = new Set(['id', 'shading', 'color', 'emissive', 'specular', 'sheenColor', 'attenuationColor']);
        for (const key of Object.keys(this)) {
            if (!skip.has(key))
                copy[key] = this[key];
        }
        copy.color.set(this.color);
        copy.emissive.set(this.emissive);
        copy.specular.set(this.specular);
        copy.sheenColor.set(this.sheenColor);
        copy.attenuationColor.set(this.attenuationColor);
        return copy;
    }
}
/** Constant color, unaffected by lights. */
export function createUnlitMaterial3D(options = {}) {
    return new Material3D('unlit', options);
}
/** Diffuse-only lighting; the cheapest lit model. */
export function createLambertMaterial3D(options = {}) {
    return new Material3D('lambert', options);
}
/** Diffuse plus Blinn-Phong specular highlights. */
export function createPhongMaterial3D(options = {}) {
    const material = new Material3D('phong', options);
    if (options.specular !== undefined)
        setColor3D(material.specular, options.specular);
    material.shininess = options.shininess ?? 30;
    return material;
}
/** Cel shading: diffuse light quantized into `steps` flat bands. */
export function createToonMaterial3D(options = {}) {
    const material = new Material3D('toon', options);
    material.toonSteps = Math.max(1, Math.floor(options.steps ?? 3));
    return material;
}
/**
 * Lighting baked into a sphere image: the surface color is looked up by the
 * view-space normal, so no lights are needed. The image is held in `emissiveMap`.
 */
export function createMatcapMaterial3D(options) {
    const material = new Material3D('matcap', options);
    material.emissiveMap = options.matcap;
    return material;
}
/**
 * A standard material set up as glass: smooth and see-through, with
 * reflections kept. Give it a `thickness` to bend the view like a solid block.
 */
export function createGlassMaterial3D(options = {}) {
    const material = createStandardMaterial3D({ roughness: 0.05, metallic: 0, ...options });
    material.transmission = options.transmission ?? 1;
    material.ior = options.ior ?? 1.5;
    material.thickness = options.thickness ?? 0;
    return material;
}
/** Physically based metallic-roughness model, matching glTF 2.0 materials. */
export function createStandardMaterial3D(options = {}) {
    const material = new Material3D('standard', options);
    material.metallic = options.metallic ?? 0;
    material.roughness = options.roughness ?? 1;
    material.metallicRoughnessMap = options.metallicRoughnessMap;
    material.environmentIntensity = options.environmentIntensity ?? 1;
    return material;
}
/** Camera-facing unlit quad material for Sprite3D. */
export function createSpriteMaterial3D(options = {}) {
    const material = new Material3D('unlit', { alphaMode: 'blend', side: 'double', ...options });
    material.billboard = true;
    material.sizeAttenuation = options.sizeAttenuation ?? true;
    material.rotation = options.rotation ?? 0;
    return material;
}
//# sourceMappingURL=Material3D.js.map