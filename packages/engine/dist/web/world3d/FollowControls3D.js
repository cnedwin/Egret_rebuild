import { FollowCamera3D } from '../../rendering/world3d/Character3D.js';
import { World3DError } from '../../rendering/world3d/core3D.js';
export class FollowControls3D {
    element;
    /** The camera rig; read `follow.yaw` or call `follow.moveDirection()` to steer a character relative to the view. */
    follow;
    rotateSpeed;
    zoomSpeed;
    enabled = true;
    #pointers = new Map();
    #listeners;
    #previousTouchAction;
    #previousTouchActionPriority;
    #pinch = 0;
    #disposed = false;
    constructor(camera, element, target, options = {}) {
        if (!camera || !element || typeof element.addEventListener !== 'function')
            throw new World3DError('WORLD3D_INPUT_INVALID', 'controls');
        this.element = element;
        this.follow = new FollowCamera3D(camera, target, options);
        this.rotateSpeed = options.rotateSpeed ?? 0.005;
        this.zoomSpeed = options.zoomSpeed ?? 0.1;
        const down = (event) => {
            if (!this.enabled)
                return;
            this.#pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
            this.element.setPointerCapture?.(event.pointerId);
            this.#pinch = 0;
        };
        const move = (event) => {
            const last = this.#pointers.get(event.pointerId);
            if (!last || !this.enabled)
                return;
            const dx = event.clientX - last.x, dy = event.clientY - last.y;
            last.x = event.clientX;
            last.y = event.clientY;
            if (this.#pointers.size === 1) {
                this.follow.yaw -= dx * this.rotateSpeed;
                this.follow.pitch += dy * this.rotateSpeed;
                return;
            }
            // Two fingers: the change in their spread zooms.
            const [a, b] = [...this.#pointers.values()], spread = Math.hypot(a.x - b.x, a.y - b.y);
            if (this.#pinch > 0 && spread > 0)
                this.follow.distance *= this.#pinch / spread;
            this.#pinch = spread;
        };
        const up = (event) => {
            if (this.forgetPointer(event.pointerId))
                this.releaseCapture(event.pointerId);
        };
        const lost = (event) => {
            // A descendant losing its capture does not end a capture on this element.
            if (event.target === element)
                this.forgetPointer(event.pointerId);
        };
        const wheel = (event) => {
            if (!this.enabled)
                return;
            event.preventDefault();
            this.follow.distance *= 1 + Math.sign(event.deltaY) * this.zoomSpeed;
        };
        this.#listeners = [
            ['pointerdown', down, undefined],
            ['pointermove', move, undefined],
            ['pointerup', up, undefined],
            ['pointercancel', up, undefined],
            ['lostpointercapture', lost, undefined],
            ['wheel', wheel, { passive: false }]
        ];
        for (const [type, listener, listenerOptions] of this.#listeners)
            element.addEventListener(type, listener, listenerOptions);
        // Disable native gestures while attached without losing the host's inline style.
        this.#previousTouchAction = element.style.getPropertyValue('touch-action');
        this.#previousTouchActionPriority = element.style.getPropertyPriority('touch-action');
        if (this.#previousTouchAction !== 'none')
            element.style.setProperty('touch-action', 'none', this.#previousTouchActionPriority);
    }
    /** Place the camera; call once per frame after moving the target. */
    update(deltaSeconds = 0) {
        if (!this.#disposed)
            this.follow.update(deltaSeconds);
    }
    dispose() {
        if (this.#disposed)
            return;
        this.#disposed = true;
        const element = this.element;
        for (const [type, listener, listenerOptions] of this.#listeners)
            element.removeEventListener(type, listener, listenerOptions);
        for (const id of this.#pointers.keys())
            this.releaseCapture(id);
        this.#pointers.clear();
        this.#pinch = 0;
        const style = element.style;
        // Preserve any later inline style installed by the caller.
        if (this.#previousTouchAction !== 'none' &&
            style.getPropertyValue('touch-action') === 'none' &&
            style.getPropertyPriority('touch-action') === this.#previousTouchActionPriority) {
            style.setProperty('touch-action', this.#previousTouchAction, this.#previousTouchActionPriority);
        }
    }
    forgetPointer(id) {
        if (!this.#pointers.delete(id))
            return false;
        this.#pinch = 0;
        return true;
    }
    releaseCapture(id) {
        if (this.element.hasPointerCapture?.(id))
            this.element.releasePointerCapture(id);
    }
}
export function createFollowControls3D(camera, element, target, options = {}) {
    return new FollowControls3D(camera, element, target, options);
}
//# sourceMappingURL=FollowControls3D.js.map