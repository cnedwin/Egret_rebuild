import { sharedWebGL2LayerVertexSource, sharedWebGL2LayerFragmentSource, sharedWebGL2LayerEffectFragmentSource } from './sharedWebGL2Shaders.js';
import { glFailure } from './webgl2Native.js';
export const MAX_LAYER_HANDLES = 512;
export const MAX_LAYER_EXTENT = 2048;
export const MAX_LAYER_BYTES = 32 * 1024 * 1024;
/** Apply the original logical-to-physical clipping and RGB bounds. */
export function readWebGL2LayerEffect(options, input, frameWidth, frameHeight) {
    if (!options.enableEffects || !input || typeof input !== 'object')
        throw glFailure('WEBGL2_LAYER_EFFECT_INVALID');
    const { bounds, multiply, add } = input;
    if (!bounds || typeof bounds !== 'object')
        throw glFailure('WEBGL2_LAYER_EFFECT_INVALID');
    const { x, y, width, height } = bounds;
    if (typeof x !== 'number' ||
        typeof y !== 'number' ||
        typeof width !== 'number' ||
        typeof height !== 'number' ||
        width <= 0 ||
        height <= 0)
        throw glFailure('WEBGL2_LAYER_EFFECT_INVALID');
    const ratio = options.pixelRatio, left = x * ratio, top = y * ratio, right = (x + width) * ratio, bottom = (y + height) * ratio;
    if (![left, top, right, bottom].every(value => Number.isFinite(value) && Math.abs(value) <= 8388608) ||
        right <= left ||
        bottom <= top)
        throw glFailure('WEBGL2_LAYER_EFFECT_INVALID');
    const scale = multiply === undefined ? undefined : readLayerColor(multiply, 4);
    const emission = add === undefined ? undefined : readLayerColor(add, 1);
    if ((!scale || scale.every(value => value === 1)) && (!emission || emission.every(value => value === 0)))
        return undefined;
    // Ceil-sized backing buffers can contain centers beyond the logical frame.
    const clippedLeft = Math.max(0, left), clippedTop = Math.max(0, top);
    const clippedRight = Math.min(frameWidth * ratio, right), clippedBottom = Math.min(frameHeight * ratio, bottom);
    if (clippedRight <= clippedLeft || clippedBottom <= clippedTop)
        return undefined;
    return {
        left: clippedLeft,
        top: clippedTop,
        right: clippedRight,
        bottom: clippedBottom,
        scale: scale ?? [1, 1, 1],
        emission: emission ?? [0, 0, 0]
    };
}
function readLayerColor(input, max) {
    if (!Array.isArray(input) || input.length !== 3)
        throw glFailure('WEBGL2_LAYER_EFFECT_INVALID');
    const rgb = [input[0], input[1], input[2]];
    if (!rgb.every(value => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= max))
        throw glFailure('WEBGL2_LAYER_EFFECT_INVALID');
    return rgb;
}
/** Convert one verified revision's placement after the Host's lifecycle checks. */
export function readWebGL2LayerPlacement(revision, x, y, width, height, ratio, light) {
    if (typeof x !== 'number' ||
        typeof y !== 'number' ||
        typeof width !== 'number' ||
        typeof height !== 'number' ||
        width <= 0 ||
        height <= 0)
        throw glFailure('WEBGL2_LAYER_INVALID');
    const physicalX = x * ratio, physicalY = y * ratio, physicalWidth = width * ratio, physicalHeight = height * ratio;
    if (![physicalX, physicalY, physicalWidth, physicalHeight, physicalX + physicalWidth, physicalY + physicalHeight].every(value => Number.isFinite(value) && Math.abs(value) <= 8388608))
        throw glFailure('WEBGL2_LAYER_INVALID');
    const visibleLight = light &&
        light.left < physicalX + physicalWidth &&
        light.right > physicalX &&
        light.top < physicalY + physicalHeight &&
        light.bottom > physicalY
        ? light
        : undefined;
    return {
        revision,
        x: physicalX,
        y: physicalY,
        width: physicalWidth,
        height: physicalHeight,
        effect: visibleLight
    };
}
/** Build program bindings; the Host owns generation invalidation and cache publication. */
export function createWebGL2LayerProgram(native, effect) {
    const gl = native.gl, program = native.program(sharedWebGL2LayerVertexSource, effect ? sharedWebGL2LayerEffectFragmentSource : sharedWebGL2LayerFragmentSource);
    const location = (name) => gl.getUniformLocation(program, name);
    const variant = {
        program,
        origin: location('origin'),
        extent: location('extent'),
        viewport: location('viewportSize'),
        texture: location('layerTexture'),
        effect: effect
            ? {
                min: location('effectMin'),
                max: location('effectMax'),
                scaleRG: location('multiplyRG'),
                scaleBAddR: location('multiplyBAddR'),
                addGB: location('addGB')
            }
            : undefined
    };
    return variant;
}
//# sourceMappingURL=webgl2LayerState.js.map