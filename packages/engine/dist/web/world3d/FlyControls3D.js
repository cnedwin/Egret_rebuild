import { World3DError } from '../../rendering/world3d/core3D.js';
const DEFAULT_KEYS = Object.freeze({
    forward: ['KeyW', 'ArrowUp'],
    back: ['KeyS', 'ArrowDown'],
    left: ['KeyA', 'ArrowLeft'],
    right: ['KeyD', 'ArrowRight'],
    up: ['Space', 'KeyE'],
    down: ['KeyC', 'KeyQ'],
    sprint: ['ShiftLeft', 'ShiftRight']
});
const LIMIT = Math.PI / 2 - 0.001;
export class FlyControls3D {
    camera;
    element;
    moveSpeed;
    sprintMultiplier;
    lookSpeed;
    fly;
    pointerLock;
    damping;
    enabled = true;
    /** Heading about +Y and elevation, in radians. Write them to aim the camera. */
    yaw = 0;
    pitch = 0;
    /** Current velocity in world units per second. */
    velocity = new Float32Array(3);
    #keys;
    #down = new Set();
    #listeners = [];
    #dragging = false;
    #disposed = false;
    constructor(camera, element, options = {}) {
        if (!camera || !element || typeof element.addEventListener !== 'function')
            throw new World3DError('WORLD3D_INPUT_INVALID', 'controls target');
        this.camera = camera;
        this.element = element;
        this.moveSpeed = options.moveSpeed ?? 5;
        this.sprintMultiplier = options.sprintMultiplier ?? 2.5;
        this.lookSpeed = options.lookSpeed ?? 0.0025;
        this.fly = options.fly ?? true;
        this.pointerLock = options.pointerLock ?? true;
        this.damping = options.damping ?? 0.8;
        this.#keys = { ...DEFAULT_KEYS, ...options.keys };
        // Start from the camera's current facing: its local -Z axis in world space.
        camera.updateWorldMatrices();
        const m = camera.matrixWorld, fx = -m[8], fy = -m[9], fz = -m[10], length = Math.hypot(fx, fy, fz) || 1;
        this.pitch = Math.asin(Math.min(Math.max(fy / length, -1), 1));
        this.yaw = Math.atan2(-fx, -fz);
        const root = element.ownerDocument, listen = (target, type, listener) => {
            target.addEventListener(type, listener);
            this.#listeners.push([target, type, listener]);
        };
        listen(element, 'pointerdown', event => {
            if (!this.enabled)
                return;
            if (this.pointerLock) {
                if (root.pointerLockElement !== element)
                    void Promise.resolve(element.requestPointerLock?.()).catch(() => undefined);
            }
            else {
                this.#dragging = true;
                element.setPointerCapture?.(event.pointerId);
            }
        });
        listen(element, 'pointerup', event => {
            this.#dragging = false;
            element.releasePointerCapture?.(event.pointerId);
        });
        listen(element, 'pointercancel', () => {
            this.#dragging = false;
        });
        listen(root, 'pointermove', event => {
            if (!this.enabled || !(this.pointerLock ? root.pointerLockElement === element : this.#dragging))
                return;
            const move = event;
            this.yaw -= move.movementX * this.lookSpeed;
            this.pitch = Math.min(Math.max(this.pitch - move.movementY * this.lookSpeed, -LIMIT), LIMIT);
        });
        const view = root.defaultView ?? globalThis;
        listen(view, 'keydown', event => {
            if (this.enabled && this.isLooking(root))
                this.#down.add(event.code);
        });
        listen(view, 'keyup', event => {
            this.#down.delete(event.code);
        });
        // Keys released while the window is unfocused never send keyup.
        listen(view, 'blur', () => {
            this.#down.clear();
            this.#dragging = false;
        });
    }
    isLooking(root) {
        return !this.pointerLock || root.pointerLockElement === this.element;
    }
    /** True while the pointer is captured for looking around. */
    get isLocked() {
        return this.element.ownerDocument.pointerLockElement === this.element;
    }
    /** Release pointer lock, as when opening a menu. */
    unlock() {
        if (this.isLocked)
            this.element.ownerDocument.exitPointerLock();
    }
    pressed(action) {
        for (const code of action)
            if (this.#down.has(code))
                return true;
        return false;
    }
    update(deltaSeconds) {
        if (this.#disposed)
            return;
        const keys = this.#keys, dt = Math.max(deltaSeconds, 0), cosPitch = Math.cos(this.pitch), sinYaw = Math.sin(this.yaw), cosYaw = Math.cos(this.yaw);
        // Forward and right in world space; walking keeps forward level.
        const fx = -sinYaw * (this.fly ? cosPitch : 1), fy = this.fly ? Math.sin(this.pitch) : 0, fz = -cosYaw * (this.fly ? cosPitch : 1), rx = cosYaw, rz = -sinYaw;
        let ahead = 0, side = 0, lift = 0;
        if (this.enabled) {
            ahead = (this.pressed(keys.forward) ? 1 : 0) - (this.pressed(keys.back) ? 1 : 0);
            side = (this.pressed(keys.right) ? 1 : 0) - (this.pressed(keys.left) ? 1 : 0);
            if (this.fly)
                lift = (this.pressed(keys.up) ? 1 : 0) - (this.pressed(keys.down) ? 1 : 0);
        }
        let x = fx * ahead + rx * side, y = fy * ahead + lift, z = fz * ahead + rz * side;
        const length = Math.hypot(x, y, z), speed = this.moveSpeed * (this.pressed(keys.sprint) ? this.sprintMultiplier : 1);
        if (length > 0) {
            x = (x / length) * speed;
            y = (y / length) * speed;
            z = (z / length) * speed;
        }
        // Ease toward the wanted velocity; the factor is frame-rate independent.
        const keep = this.damping > 0 ? Math.pow(this.damping, dt * 60) : 0, v = this.velocity;
        v[0] = x + (v[0] - x) * keep;
        v[1] = y + (v[1] - y) * keep;
        v[2] = z + (v[2] - z) * keep;
        const camera = this.camera, p = camera.position;
        camera.setPosition(p[0] + v[0] * dt, p[1] + v[1] * dt, p[2] + v[2] * dt);
        // Yaw about +Y, then pitch about the camera's own X axis.
        const hy = this.yaw / 2, hp = this.pitch / 2, sy = Math.sin(hy), cy = Math.cos(hy), sp = Math.sin(hp), cp = Math.cos(hp);
        camera.quaternion[0] = cy * sp;
        camera.quaternion[1] = sy * cp;
        camera.quaternion[2] = -sy * sp;
        camera.quaternion[3] = cy * cp;
        camera.markTransformDirty();
    }
    dispose() {
        if (this.#disposed)
            return;
        this.#disposed = true;
        this.unlock();
        for (const [target, type, listener] of this.#listeners)
            target.removeEventListener(type, listener);
        this.#listeners.length = 0;
        this.#down.clear();
    }
}
export function createFlyControls3D(camera, element, options = {}) {
    return new FlyControls3D(camera, element, options);
}
//# sourceMappingURL=FlyControls3D.js.map