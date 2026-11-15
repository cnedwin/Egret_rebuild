import { setRenderEffect } from './renderEffect.js';
import { assertManagedMutable } from './ui/managedState.js';
import { createSharedMaterial2D, isSharedMaterial2D } from '@egret/contracts';
import { registerDisplayHitNode, readDisplayHitState, writeDisplayHitArea, writeDisplayTouchEnabled } from './displayHitState.js';
import { queryDisplayBounds } from './displayBounds.js';
import { queryDisplayPoint } from './displayCoordinates.js';
import { EgretError } from './EgretError.js';
import { assertVisualMutable, copyRect, finite, unit, registerVisual, visualOf, readAnchorOffset, writeAnchorOffset, recordVisualChange, VISUAL_TRANSFORM, VISUAL_APPEARANCE } from './displayVisualState.js';
import { EventDispatcher } from './EventDispatcher.js';
import { ASSERT_ATTACHABLE, ASSERT_BINDABLE, OWNERSHIP_CHILDREN } from './ownership.js';
import { assertLive, isTerminated, parentOf, registerNode, terminateNode } from './displayTreeState.js';
/** Egret's names of blend modes, and the blends of the shared material they are. */
const BLENDS = Object.freeze({
    normal: 'normal',
    add: 'add-accumulate',
    multiply: 'multiply-factor',
    screen: 'screen',
    erase: 'erase'
});
// Equality is checked only after the original validation; signed zero stays distinct.
const sameVisualValue = Object.is;
/** The scale that gives a size on the parent from a size in the object's own units, with the sign the scale had. */
function sizeScale(value, own, scale) {
    if (!finite(value) || value < 0)
        throw new EgretError('DISPLAY_VALUE_INVALID');
    if (own === 0) {
        if (value === 0)
            return scale;
        throw new EgretError('DISPLAY_SIZE_UNAVAILABLE');
    }
    return ((scale < 0 ? -1 : 1) * value) / own;
}
/** A live display node; detach and terminal dispose are separate operations. */
export class DisplayObject extends EventDispatcher {
    constructor() {
        super();
        registerNode(this);
        registerVisual(this);
        registerDisplayHitNode(this);
    }
    /** Explicit input regions are separate from rendering content and opacity. */
    get touchEnabled() {
        return readDisplayHitState(this).touchEnabled;
    }
    set touchEnabled(value) {
        writeDisplayTouchEnabled(this, value);
    }
    get hitArea() {
        return readDisplayHitState(this).hitArea;
    }
    set hitArea(value) {
        writeDisplayHitArea(this, value);
    }
    get x() {
        return visualOf(this).x;
    }
    set x(value) {
        assertVisualMutable(this);
        if (!finite(value))
            throw new EgretError('DISPLAY_VALUE_INVALID');
        const state = visualOf(this), changed = !sameVisualValue(state.x, value);
        state.x = value;
        if (changed)
            recordVisualChange(this, VISUAL_TRANSFORM);
    }
    get y() {
        return visualOf(this).y;
    }
    set y(value) {
        assertVisualMutable(this);
        if (!finite(value))
            throw new EgretError('DISPLAY_VALUE_INVALID');
        const state = visualOf(this), changed = !sameVisualValue(state.y, value);
        state.y = value;
        if (changed)
            recordVisualChange(this, VISUAL_TRANSFORM);
    }
    /** Local pivot in logical pixels; finite values are stored without coercion. */
    get anchorOffsetX() {
        return readAnchorOffset(this, 'anchorOffsetX');
    }
    set anchorOffsetX(value) {
        writeAnchorOffset(this, 'anchorOffsetX', value);
    }
    /** The pivot remains readable after disposal; writes obey node/Engine life. */
    get anchorOffsetY() {
        return readAnchorOffset(this, 'anchorOffsetY');
    }
    set anchorOffsetY(value) {
        writeAnchorOffset(this, 'anchorOffsetY', value);
    }
    get scaleX() {
        return visualOf(this).scaleX;
    }
    set scaleX(value) {
        assertVisualMutable(this);
        if (!finite(value))
            throw new EgretError('DISPLAY_VALUE_INVALID');
        const state = visualOf(this), changed = !sameVisualValue(state.scaleX, value);
        state.scaleX = value;
        if (changed)
            recordVisualChange(this, VISUAL_TRANSFORM);
    }
    get scaleY() {
        return visualOf(this).scaleY;
    }
    set scaleY(value) {
        assertVisualMutable(this);
        if (!finite(value))
            throw new EgretError('DISPLAY_VALUE_INVALID');
        const state = visualOf(this), changed = !sameVisualValue(state.scaleY, value);
        state.scaleY = value;
        if (changed)
            recordVisualChange(this, VISUAL_TRANSFORM);
    }
    get rotation() {
        return visualOf(this).rotation;
    }
    set rotation(value) {
        assertVisualMutable(this);
        if (!finite(value))
            throw new EgretError('DISPLAY_VALUE_INVALID');
        const state = visualOf(this), changed = !sameVisualValue(state.rotation, value);
        state.rotation = value;
        if (changed)
            recordVisualChange(this, VISUAL_TRANSFORM);
    }
    /** Degrees by which the y axis is turned beyond the rotation, so that upright lines lean. 0 unless set. */
    get skewX() {
        return visualOf(this).skewX;
    }
    set skewX(value) {
        assertVisualMutable(this);
        if (!finite(value))
            throw new EgretError('DISPLAY_VALUE_INVALID');
        const state = visualOf(this), changed = !sameVisualValue(state.skewX, value);
        state.skewX = value;
        if (changed)
            recordVisualChange(this, VISUAL_TRANSFORM);
    }
    /** Degrees by which the x axis is turned beyond the rotation, so that level lines slope. 0 unless set. */
    get skewY() {
        return visualOf(this).skewY;
    }
    set skewY(value) {
        assertVisualMutable(this);
        if (!finite(value))
            throw new EgretError('DISPLAY_VALUE_INVALID');
        const state = visualOf(this), changed = !sameVisualValue(state.skewY, value);
        state.skewY = value;
        if (changed)
            recordVisualChange(this, VISUAL_TRANSFORM);
    }
    /** A name the application gives the object, for `getChildByName`. Empty unless set; it changes nothing that is drawn. */
    get name() {
        return visualOf(this).name;
    }
    set name(value) {
        assertVisualMutable(this);
        if (typeof value !== 'string')
            throw new EgretError('DISPLAY_VALUE_INVALID');
        visualOf(this).name = value;
    }
    /**
     * The width the object takes on its parent: the width of what it and its children draw, in its own units, times its
     * scaleX without the sign. Setting it sets scaleX, keeping its sign, so that the width becomes the value; an object
     * that draws nothing has no width to scale and refuses any but 0.
     */
    get width() {
        return this.getBounds().width * Math.abs(visualOf(this).scaleX);
    }
    set width(value) {
        this.scaleX = sizeScale(value, this.getBounds().width, visualOf(this).scaleX);
    }
    /** As `width`, down the object and with scaleY. */
    get height() {
        return this.getBounds().height * Math.abs(visualOf(this).scaleY);
    }
    set height(value) {
        this.scaleY = sizeScale(value, this.getBounds().height, visualOf(this).scaleY);
    }
    get alpha() {
        return visualOf(this).alpha;
    }
    set alpha(value) {
        assertVisualMutable(this);
        if (!unit(value))
            throw new EgretError('DISPLAY_VALUE_INVALID');
        const state = visualOf(this), changed = !sameVisualValue(state.alpha, value);
        state.alpha = value;
        if (changed)
            recordVisualChange(this, VISUAL_APPEARANCE);
    }
    get visible() {
        return visualOf(this).visible;
    }
    set visible(value) {
        assertVisualMutable(this);
        if (typeof value !== 'boolean')
            throw new EgretError('DISPLAY_VALUE_INVALID');
        const state = visualOf(this), changed = !sameVisualValue(state.visible, value);
        state.visible = value;
        if (changed)
            recordVisualChange(this, VISUAL_APPEARANCE);
    }
    /** A complete material value overrides the nearest inherited value. */
    get sharedMaterial() {
        return visualOf(this).sharedMaterial;
    }
    set sharedMaterial(value) {
        assertVisualMutable(this);
        if (value !== null && !isSharedMaterial2D(value))
            throw new EgretError('DISPLAY_VALUE_INVALID');
        const state = visualOf(this), changed = state.sharedMaterial !== value;
        state.sharedMaterial = value;
        if (changed)
            recordVisualChange(this, VISUAL_APPEARANCE);
    }
    /**
     * How what this object and its children draw is combined with what is under it, by Egret's names: `add` brightens,
     * `multiply` darkens, `screen` lightens softly and `erase` takes away by its alpha. It is the blend of `sharedMaterial`:
     * setting it keeps the material's tints and replaces only its blend, and a child with a material of its own keeps that.
     */
    get blendMode() {
        const blend = visualOf(this).sharedMaterial?.blend ?? 'normal';
        return blend === 'add-accumulate' || blend === 'add-preserve'
            ? 'add'
            : blend === 'multiply-factor'
                ? 'multiply'
                : blend;
    }
    set blendMode(value) {
        assertVisualMutable(this);
        if (typeof value !== 'string' || !Object.hasOwn(BLENDS, value))
            throw new EgretError('DISPLAY_VALUE_INVALID');
        const blend = BLENDS[value];
        const state = visualOf(this), base = state.sharedMaterial;
        if (base === null && blend === 'normal')
            return;
        if (base !== null && base.blend === blend)
            return;
        const next = createSharedMaterial2D({
            light: base?.light,
            dark: base?.dark,
            blend,
            samplingDomain: base?.samplingDomain,
            filter: base?.filter,
            addressU: base?.addressU,
            addressV: base?.addressV,
            regionIsolation: base?.regionIsolation,
            minFilter: base?.minFilter,
            magFilter: base?.magFilter
        });
        state.sharedMaterial = next;
        recordVisualChange(this, VISUAL_APPEARANCE);
    }
    /** Shared backends execute effects; legacy captures explicitly refuse them. */
    get renderEffect() {
        return visualOf(this).renderEffect;
    }
    set renderEffect(value) {
        setRenderEffect(this, value);
    }
    /** An ordering boundary is metadata, not another display or resource owner. */
    get renderBoundary() {
        return visualOf(this).renderBoundary;
    }
    set renderBoundary(value) {
        assertVisualMutable(this);
        if (value !== 'none' && value !== 'isolate')
            throw new EgretError('DISPLAY_VALUE_INVALID');
        const state = visualOf(this), changed = state.renderBoundary !== value;
        state.renderBoundary = value;
        if (changed)
            recordVisualChange(this, VISUAL_APPEARANCE);
    }
    get clipRect() {
        return visualOf(this).clipRect;
    }
    set clipRect(value) {
        assertVisualMutable(this);
        let copy;
        try {
            copy = value === undefined ? undefined : copyRect(value, 'DISPLAY_VALUE_INVALID');
        }
        catch (cause) {
            if (cause instanceof EgretError)
                throw cause;
            throw new EgretError('DISPLAY_VALUE_INVALID', { cause });
        }
        assertVisualMutable(this);
        const state = visualOf(this), changed = !sameVisualValue(state.clipRect, copy);
        state.clipRect = copy;
        if (changed)
            recordVisualChange(this, VISUAL_APPEARANCE);
    }
    get parent() {
        return parentOf(this);
    }
    get isDisposed() {
        return isTerminated(this);
    }
    /** Map logical coordinates through the actual root, including its transform. */
    localToGlobal(localX, localY, options) {
        return queryDisplayPoint(this, localX, localY, options, false);
    }
    /** Solve the stored world matrix and return one owned, frozen point. */
    globalToLocal(globalX, globalY, options) {
        return queryDisplayPoint(this, globalX, globalY, options, true);
    }
    /** Measure descendant-transformed content in this node's local coordinates. */
    getBounds(options) {
        return queryDisplayBounds(this, options);
    }
    assertUsable() {
        assertLive(this);
    }
    eventParent() {
        return this.parent;
    }
    [ASSERT_BINDABLE]() {
        this.assertUsable();
    }
    [ASSERT_ATTACHABLE]() {
        this.assertUsable();
    }
    [OWNERSHIP_CHILDREN]() {
        return [];
    }
    /** Mark terminal before removing listeners, so callback reentry sees disposal. */
    dispose() {
        if (isTerminated(this))
            return;
        assertManagedMutable(this);
        terminateNode(this);
        this.clearListeners();
    }
}
//# sourceMappingURL=DisplayObject.js.map