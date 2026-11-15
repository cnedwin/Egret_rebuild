// SPDX-License-Identifier: Apache-2.0
import { DisplayObject, EgretError } from '@egret/runtime';
const finite = (value) => typeof value === 'number' && Number.isFinite(value);
const positive = (value) => finite(value) && value > 0;
const record = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const point = (value) => record(value) && finite(value['x']) && finite(value['y']);
const rect = (value) => record(value) &&
    finite(value['x']) &&
    finite(value['y']) &&
    finite(value['width']) &&
    finite(value['height']) &&
    value['width'] >= 0 &&
    value['height'] >= 0;
const smooth = (t) => t * t * (3 - 2 * t);
const read = (object) => ({
    x: object.x,
    y: object.y,
    scaleX: object.scaleX,
    scaleY: object.scaleY,
    rotation: object.rotation,
    anchorOffsetX: object.anchorOffsetX,
    anchorOffsetY: object.anchorOffsetY
});
function write(object, placed) {
    object.anchorOffsetX = placed.anchorOffsetX;
    object.anchorOffsetY = placed.anchorOffsetY;
    object.scaleX = placed.scaleX;
    object.scaleY = placed.scaleY;
    object.rotation = placed.rotation;
    object.x = placed.x;
    object.y = placed.y;
}
/** Smooth noise between -1 and 1: two random values a step apart, eased between. The same seed gives the same shake. */
function noise(seed, channel, t) {
    const at = Math.floor(t), f = t - at;
    const hash = (n) => {
        let h = Math.imul(n ^ Math.imul(seed, 0x9e3779b1) ^ Math.imul(channel + 1, 0x85ebca6b), 0x27d4eb2d);
        h ^= h >>> 15;
        h = Math.imul(h, 0x2c1b3c6d);
        h ^= h >>> 12;
        return ((h >>> 0) / 0xffffffff) * 2 - 1;
    };
    return hash(at) + (hash(at + 1) - hash(at)) * smooth(f);
}
/**
 * A camera over a container that holds the world. It places that container, and the layers given it,
 * so that the world is seen from where the camera looks. It keeps no clock: `update` moves it.
 */
export function createCamera2D(options) {
    if (!record(options))
        throw new EgretError('CAMERA_OPTIONS_INVALID');
    const { world, width: w0, height: h0, center: c0, zoom: z0 = 1, minZoom = 0.25, maxZoom = 4, rotation: r0 = 0, bounds: b0, shakeOffset = 16, shakeRotation = 0, shakeDecay = 1, shakeFrequency = 15, seed = 1, roundToPixel = false } = options;
    if (!(world instanceof DisplayObject) ||
        world.isDisposed ||
        !positive(w0) ||
        !positive(h0) ||
        (c0 !== undefined && !point(c0)) ||
        !positive(minZoom) ||
        !positive(maxZoom) ||
        minZoom > maxZoom ||
        !finite(z0) ||
        z0 < minZoom ||
        z0 > maxZoom ||
        !finite(r0) ||
        (b0 !== undefined && !rect(b0)) ||
        !finite(shakeOffset) ||
        shakeOffset < 0 ||
        !finite(shakeRotation) ||
        shakeRotation < 0 ||
        !finite(shakeDecay) ||
        shakeDecay < 0 ||
        !positive(shakeFrequency) ||
        !Number.isSafeInteger(seed) ||
        typeof roundToPixel !== 'boolean')
        throw new EgretError('CAMERA_OPTIONS_INVALID');
    const before = read(world);
    const layers = [];
    let width = w0, height = h0, zoom = z0, rotation = r0, bounds = b0 === undefined ? undefined : { ...b0 };
    let cx = c0?.x ?? width / 2, cy = c0?.y ?? height / 2, trauma = 0, time = 0, closed = false;
    let follow, move, zoomMove;
    let shakeX = 0, shakeY = 0, shakeAngle = 0;
    function open() {
        if (closed)
            throw new EgretError('CAMERA_CLOSED');
    }
    function clamp() {
        if (bounds === undefined)
            return;
        const halfW = width / zoom / 2, halfH = height / zoom / 2;
        cx =
            bounds.width <= halfW * 2
                ? bounds.x + bounds.width / 2
                : Math.min(Math.max(cx, bounds.x + halfW), bounds.x + bounds.width - halfW);
        cy =
            bounds.height <= halfH * 2
                ? bounds.y + bounds.height / 2
                : Math.min(Math.max(cy, bounds.y + halfH), bounds.y + bounds.height - halfH);
    }
    function targetOf(target) {
        if (target instanceof DisplayObject) {
            if (target.isDisposed)
                throw new EgretError('CAMERA_TARGET_INVALID');
            // The target's place in world units, wherever it is nested inside the world: out to the stage and back.
            const onStage = target.localToGlobal(0, 0);
            return world.globalToLocal(onStage.x, onStage.y);
        }
        const value = target();
        if (!point(value))
            throw new EgretError('CAMERA_TARGET_INVALID');
        return value;
    }
    function place() {
        const sx = viewX(), sy = viewY();
        write(world, {
            anchorOffsetX: cx,
            anchorOffsetY: cy,
            scaleX: zoom,
            scaleY: zoom,
            rotation: rotation + shakeAngle,
            x: sx,
            y: sy
        });
        for (const layer of layers) {
            const scale = 1 + (zoom - 1) * layer.zoomFactor;
            // At the middle of the view a layer is where it was put; it moves the part of the camera's way its factor says.
            write(layer.object, {
                anchorOffsetX: width / 2 + (cx - width / 2) * layer.fx,
                anchorOffsetY: height / 2 + (cy - height / 2) * layer.fy,
                scaleX: scale,
                scaleY: scale,
                rotation: rotation + shakeAngle,
                x: sx,
                y: sy
            });
        }
    }
    const viewX = () => {
        const x = width / 2 + shakeX;
        return roundToPixel ? Math.round(x - cx * zoom) + cx * zoom : x;
    };
    const viewY = () => {
        const y = height / 2 + shakeY;
        return roundToPixel ? Math.round(y - cy * zoom) + cy * zoom : y;
    };
    function settle() {
        clamp();
        place();
    }
    clamp();
    try {
        place();
    }
    catch (cause) {
        write(world, before);
        throw cause;
    }
    const camera = Object.freeze({
        get state() {
            return closed ? 'closed' : 'active';
        },
        get center() {
            return Object.freeze({ x: cx, y: cy });
        },
        get zoom() {
            return zoom;
        },
        get rotation() {
            return rotation;
        },
        get width() {
            return width;
        },
        get height() {
            return height;
        },
        lookAt(x, y) {
            if (!finite(x) || !finite(y))
                throw new EgretError('CAMERA_OPTIONS_INVALID');
            open();
            move = undefined;
            cx = x;
            cy = y;
            settle();
        },
        panTo(x, y, seconds) {
            if (!finite(x) || !finite(y) || !finite(seconds) || seconds < 0)
                throw new EgretError('CAMERA_OPTIONS_INVALID');
            open();
            follow = undefined;
            if (seconds === 0) {
                move = undefined;
                cx = x;
                cy = y;
                settle();
                return;
            }
            move = { fromX: cx, fromY: cy, toX: x, toY: y, seconds, elapsed: 0 };
        },
        setZoom(value) {
            if (!finite(value) || value < minZoom || value > maxZoom)
                throw new EgretError('CAMERA_OPTIONS_INVALID');
            open();
            zoomMove = undefined;
            zoom = value;
            settle();
        },
        zoomTo(value, seconds) {
            if (!finite(value) || value < minZoom || value > maxZoom || !finite(seconds) || seconds < 0)
                throw new EgretError('CAMERA_OPTIONS_INVALID');
            open();
            if (seconds === 0) {
                zoomMove = undefined;
                zoom = value;
                settle();
                return;
            }
            zoomMove = { from: zoom, to: value, seconds, elapsed: 0 };
        },
        setRotation(degrees) {
            if (!finite(degrees))
                throw new EgretError('CAMERA_OPTIONS_INVALID');
            open();
            rotation = degrees;
            place();
        },
        follow(target, followOptions = {}) {
            if (!(target instanceof DisplayObject) && typeof target !== 'function')
                throw new EgretError('CAMERA_TARGET_INVALID');
            if (!record(followOptions))
                throw new EgretError('CAMERA_OPTIONS_INVALID');
            const { smoothing = 0.15, deadZone, offset } = followOptions;
            if (!finite(smoothing) ||
                smoothing < 0 ||
                (deadZone !== undefined &&
                    (!record(deadZone) ||
                        !finite(deadZone.width) ||
                        !finite(deadZone.height) ||
                        deadZone.width < 0 ||
                        deadZone.height < 0)) ||
                (offset !== undefined && !point(offset)))
                throw new EgretError('CAMERA_OPTIONS_INVALID');
            open();
            move = undefined;
            follow = {
                target,
                smoothing,
                deadWidth: deadZone === undefined ? 0 : deadZone.width,
                deadHeight: deadZone === undefined ? 0 : deadZone.height,
                ox: offset?.x ?? 0,
                oy: offset?.y ?? 0
            };
        },
        stopFollowing() {
            follow = undefined;
        },
        setBounds(value) {
            if (value !== undefined && !rect(value))
                throw new EgretError('CAMERA_OPTIONS_INVALID');
            open();
            bounds = value === undefined ? undefined : { ...value };
            settle();
        },
        resize(newWidth, newHeight) {
            if (!positive(newWidth) || !positive(newHeight))
                throw new EgretError('CAMERA_OPTIONS_INVALID');
            open();
            width = newWidth;
            height = newHeight;
            settle();
        },
        shake(shakeOptions = {}) {
            if (!record(shakeOptions))
                throw new EgretError('CAMERA_OPTIONS_INVALID');
            const { trauma: added = 0.5 } = shakeOptions;
            if (!finite(added) || added < 0 || added > 1)
                throw new EgretError('CAMERA_OPTIONS_INVALID');
            open();
            trauma = Math.min(1, trauma + added);
        },
        addLayer(layer, layerOptions = {}) {
            if (!(layer instanceof DisplayObject) ||
                layer.isDisposed ||
                layer === world ||
                layers.some(other => other.object === layer))
                throw new EgretError('CAMERA_LAYER_INVALID');
            if (!record(layerOptions))
                throw new EgretError('CAMERA_OPTIONS_INVALID');
            const { factor = 0.5, zoomFactor = 1 } = layerOptions;
            const fx = typeof factor === 'number' ? factor : point(factor) ? factor.x : NaN, fy = typeof factor === 'number' ? factor : point(factor) ? factor.y : NaN;
            if (!finite(fx) || !finite(fy) || !finite(zoomFactor) || zoomFactor < 0 || zoomFactor > 1)
                throw new EgretError('CAMERA_OPTIONS_INVALID');
            open();
            const entry = { object: layer, fx, fy, zoomFactor, before: read(layer) };
            layers.push(entry);
            place();
            return () => {
                const index = layers.indexOf(entry);
                if (index < 0)
                    return;
                layers.splice(index, 1);
                if (!layer.isDisposed)
                    write(layer, entry.before);
            };
        },
        update(seconds) {
            if (!finite(seconds) || seconds < 0)
                throw new EgretError('CAMERA_OPTIONS_INVALID');
            open();
            time += seconds;
            if (zoomMove !== undefined) {
                zoomMove.elapsed = Math.min(zoomMove.seconds, zoomMove.elapsed + seconds);
                zoom = zoomMove.from + (zoomMove.to - zoomMove.from) * smooth(zoomMove.elapsed / zoomMove.seconds);
                if (zoomMove.elapsed >= zoomMove.seconds) {
                    zoom = zoomMove.to;
                    zoomMove = undefined;
                }
            }
            if (move !== undefined) {
                move.elapsed = Math.min(move.seconds, move.elapsed + seconds);
                const t = smooth(move.elapsed / move.seconds);
                cx = move.fromX + (move.toX - move.fromX) * t;
                cy = move.fromY + (move.toY - move.fromY) * t;
                if (move.elapsed >= move.seconds) {
                    cx = move.toX;
                    cy = move.toY;
                    move = undefined;
                }
            }
            else if (follow !== undefined) {
                const target = targetOf(follow.target), tx = target.x + follow.ox, ty = target.y + follow.oy;
                // Inside the dead zone the target moves alone; outside it the camera is pulled to its edge.
                const halfW = follow.deadWidth / 2, halfH = follow.deadHeight / 2;
                const wantX = tx > cx + halfW ? tx - halfW : tx < cx - halfW ? tx + halfW : cx;
                const wantY = ty > cy + halfH ? ty - halfH : ty < cy - halfH ? ty + halfH : cy;
                // The same distance closed in the same time, whatever the frames.
                const pull = follow.smoothing === 0 ? 1 : 1 - Math.exp(-seconds / follow.smoothing);
                cx += (wantX - cx) * pull;
                cy += (wantY - cy) * pull;
            }
            trauma = Math.max(0, trauma - shakeDecay * seconds);
            const strength = trauma * trauma, t = time * shakeFrequency;
            shakeX = shakeOffset * strength * noise(seed, 0, t);
            shakeY = shakeOffset * strength * noise(seed, 1, t);
            shakeAngle = shakeRotation * strength * noise(seed, 2, t);
            settle();
        },
        worldToScreen(x, y) {
            if (!finite(x) || !finite(y))
                throw new EgretError('CAMERA_OPTIONS_INVALID');
            const angle = ((rotation + shakeAngle) * Math.PI) / 180, cos = Math.cos(angle), sin = Math.sin(angle);
            const dx = (x - cx) * zoom, dy = (y - cy) * zoom;
            return Object.freeze({ x: viewX() + dx * cos - dy * sin, y: viewY() + dx * sin + dy * cos });
        },
        screenToWorld(x, y) {
            if (!finite(x) || !finite(y))
                throw new EgretError('CAMERA_OPTIONS_INVALID');
            const angle = ((rotation + shakeAngle) * Math.PI) / 180, cos = Math.cos(angle), sin = Math.sin(angle);
            const dx = x - viewX(), dy = y - viewY();
            return Object.freeze({ x: cx + (dx * cos + dy * sin) / zoom, y: cy + (-dx * sin + dy * cos) / zoom });
        },
        isVisible(value) {
            if (!rect(value))
                throw new EgretError('CAMERA_OPTIONS_INVALID');
            const halfW = width / zoom / 2, halfH = height / zoom / 2;
            return (value.x <= cx + halfW &&
                value.x + value.width >= cx - halfW &&
                value.y <= cy + halfH &&
                value.y + value.height >= cy - halfH);
        },
        snapshot() {
            const halfW = width / zoom / 2, halfH = height / zoom / 2;
            return Object.freeze({
                center: Object.freeze({ x: cx, y: cy }),
                zoom,
                rotation,
                trauma,
                view: Object.freeze({ x: cx - halfW, y: cy - halfH, width: halfW * 2, height: halfH * 2 }),
                following: follow !== undefined,
                time
            });
        },
        dispose() {
            if (closed)
                return;
            closed = true;
            follow = undefined;
            move = undefined;
            zoomMove = undefined;
            const failures = [];
            for (const layer of layers.splice(0))
                try {
                    if (!layer.object.isDisposed)
                        write(layer.object, layer.before);
                }
                catch (cause) {
                    failures.push(cause);
                }
            try {
                if (!world.isDisposed)
                    write(world, before);
            }
            catch (cause) {
                failures.push(cause);
            }
            if (failures.length > 0)
                throw new EgretError('CAMERA_CLEANUP_FAILED', { cause: failures[0], cleanupErrors: failures.slice(1) });
        }
    });
    return camera;
}
//# sourceMappingURL=camera2d.js.map