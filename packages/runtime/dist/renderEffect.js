import { readBitmapState as bitmapCaptureState } from './bitmapDisplayState.js';
import { assertLive } from './displayTreeState.js';
import { engineOf } from './ownership.js';
import { assertVisualMutable, copyRect, visualOf, recordVisualChange, VISUAL_APPEARANCE } from './displayVisualState.js';
import { EgretError } from './EgretError.js';
const finite = (value) => typeof value === 'number' && Number.isFinite(value);
const between = (value, low, high) => finite(value) && value >= low && value <= high;
const colour = (value) => Number.isSafeInteger(value) && value >= 0 && value <= 0xffffff;
const flag = (value) => {
    if (value !== undefined && typeof value !== 'boolean')
        throw new EgretError('DISPLAY_EFFECT_INVALID');
    return value === true;
};
function readMatrix(input) {
    if (!Array.isArray(input) || input.length !== 20)
        throw new EgretError('DISPLAY_EFFECT_INVALID');
    const copy = Array.from({ length: 20 }, (_, i) => {
        const value = input[i];
        if (!finite(value) || Math.abs(value) > 65536)
            throw new EgretError('DISPLAY_EFFECT_INVALID');
        return value;
    });
    return Object.freeze(copy);
}
function readGlow(input) {
    if (input === null || typeof input !== 'object')
        throw new EgretError('DISPLAY_EFFECT_INVALID');
    const { color, alpha = 1, blur = 6, strength = 2, offsetX = 0, offsetY = 0 } = input, inner = flag(input.inner), knockout = flag(input.knockout);
    if (!colour(color) ||
        !between(alpha, 0, 1) ||
        !between(blur, 0, 16) ||
        !between(strength, 0, 255) ||
        !between(offsetX, -256, 256) ||
        !between(offsetY, -256, 256))
        throw new EgretError('DISPLAY_EFFECT_INVALID');
    return Object.freeze({ color, alpha, blur, strength, inner, knockout, offsetX, offsetY });
}
function readOutline(input) {
    if (input === null || typeof input !== 'object')
        throw new EgretError('DISPLAY_EFFECT_INVALID');
    const { color, width, alpha = 1 } = input;
    if (!colour(color) || !between(width, 1, 8) || !between(alpha, 0, 1))
        throw new EgretError('DISPLAY_EFFECT_INVALID');
    return Object.freeze({ color, width, alpha });
}
export function setRenderEffect(node, input) {
    assertVisualMutable(node);
    let value;
    if (input !== undefined) {
        if (input === null || typeof input !== 'object')
            throw new EgretError('DISPLAY_EFFECT_INVALID');
        const radius = input.blurRadius ?? 0, mask = input.alphaMask, rect = input.maskRect;
        if (!Number.isInteger(radius) || radius < 0 || radius > 8)
            throw new EgretError('DISPLAY_EFFECT_INVALID');
        let bounds;
        if (mask !== undefined) {
            if (!bitmapCaptureState(mask))
                throw new EgretError('DISPLAY_EFFECT_MASK_INVALID');
            assertLive(mask);
            if (engineOf(mask) !== engineOf(node))
                throw new EgretError('ENGINE_MISMATCH');
            if (rect === undefined)
                throw new EgretError('DISPLAY_EFFECT_INVALID');
            bounds = copyRect(rect, 'DISPLAY_EFFECT_INVALID');
            if (bounds.width <= 0 || bounds.height <= 0)
                throw new EgretError('DISPLAY_EFFECT_INVALID');
        }
        else if (rect !== undefined)
            throw new EgretError('DISPLAY_EFFECT_INVALID');
        const matrix = input.colorMatrix === undefined ? undefined : readMatrix(input.colorMatrix);
        const glow = input.glow === undefined ? undefined : readGlow(input.glow), outline = input.outline === undefined ? undefined : readOutline(input.outline);
        if (glow !== undefined && outline !== undefined)
            throw new EgretError('DISPLAY_EFFECT_INVALID');
        value = Object.freeze({
            blurRadius: radius,
            ...(mask === undefined ? {} : { alphaMask: mask, maskRect: bounds }),
            ...(matrix === undefined ? {} : { colorMatrix: matrix }),
            ...(glow === undefined ? {} : { glow }),
            ...(outline === undefined ? {} : { outline })
        });
    }
    // Descriptor reads may execute application getters; publish only after life recheck.
    assertVisualMutable(node);
    visualOf(node).renderEffect = value;
    recordVisualChange(node, VISUAL_APPEARANCE);
}
//# sourceMappingURL=renderEffect.js.map