// SPDX-License-Identifier: Apache-2.0
// Light nodes. Directional and spot lights shine along their local negative
// Z axis, matching cameras and glTF punctual lights. Colors are linear RGB.
import { setColor3D } from './Material3D.js';
import { Object3D } from './Object3D.js';
export const LIGHT3D_LIMITS = Object.freeze({
    maxDirectional: 4,
    maxPoint: 8,
    maxSpot: 4,
    maxShadows: 4
});
export class Light3D extends Object3D {
    lightType;
    color = new Float32Array([1, 1, 1]);
    intensity = 1;
    /** Lower hemisphere color for hemisphere lights. */
    groundColor = new Float32Array([0, 0, 0]);
    range = 0;
    angle = Math.PI / 4;
    penumbra = 0.1;
    shadow = {
        mapSize: 1024,
        bias: 0.0005,
        normalBias: 0.02,
        near: 0.1,
        far: 100,
        extent: 10,
        radius: 1,
        cascades: 1,
        cascadeDistance: 100,
        cascadeLambda: 0.7
    };
    constructor(lightType = 'directional') {
        super('light');
        this.lightType = lightType;
        this.castShadow = false;
    }
    clone(recursive = true) {
        const copy = new Light3D(this.lightType);
        copy.copyFrom(this);
        if (recursive)
            for (const child of this.children)
                copy.addChild(child.clone(true));
        return copy;
    }
    copyFrom(source) {
        super.copyFrom(source);
        this.color.set(source.color);
        this.groundColor.set(source.groundColor);
        this.intensity = source.intensity;
        this.range = source.range;
        this.angle = source.angle;
        this.penumbra = source.penumbra;
        Object.assign(this.shadow, source.shadow);
    }
}
function base(light, options) {
    if (options.color !== undefined)
        setColor3D(light.color, options.color);
    light.intensity = options.intensity ?? 1;
    light.castShadow = options.castShadow ?? false;
    return light;
}
/** Uniform light from every direction. */
export function createAmbientLight3D(options = {}) {
    return base(new Light3D('ambient'), { ...options, castShadow: false });
}
/** Sky color from above blending to a ground color from below (world Y axis). */
export function createHemisphereLight3D(options = {}) {
    const light = base(new Light3D('hemisphere'), { ...options, castShadow: false });
    if (options.groundColor !== undefined)
        setColor3D(light.groundColor, options.groundColor);
    return light;
}
/** Parallel rays, such as sunlight. Aim it with lookAt(). */
export function createDirectionalLight3D(options = {}) {
    return base(new Light3D('directional'), options);
}
export function createPointLight3D(options = {}) {
    const light = base(new Light3D('point'), options);
    light.range = options.range ?? 0;
    return light;
}
export function createSpotLight3D(options = {}) {
    const light = base(new Light3D('spot'), options);
    light.range = options.range ?? 0;
    light.angle = options.angle ?? Math.PI / 4;
    light.penumbra = options.penumbra ?? 0.1;
    return light;
}
//# sourceMappingURL=Light3D.js.map