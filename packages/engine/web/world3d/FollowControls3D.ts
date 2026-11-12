// SPDX-License-Identifier: Apache-2.0
// Pointer input for the third-person follow camera: drag to look around the
// target, scroll or pinch to change the distance. Works with mouse, pen and
// touch through Pointer Events. Call update() once per frame after the target
// has moved.
import type {Disposable} from '@egret/contracts';
import type {Camera3D} from '../../rendering/world3d/Camera3D.js';
import {FollowCamera3D} from '../../rendering/world3d/Character3D.js';
import type {FollowCameraOptions3D} from '../../rendering/world3d/Character3D.js';
import {World3DError} from '../../rendering/world3d/core3D.js';
import type {Object3D} from '../../rendering/world3d/Object3D.js';

export interface FollowControlsOptions3D extends FollowCameraOptions3D {
    /** Radians turned per pixel dragged. Defaults to 0.005. */
    readonly rotateSpeed?: number;
    /** Share of the distance changed per wheel notch. Defaults to 0.1. */
    readonly zoomSpeed?: number;
}

export class FollowControls3D implements Disposable {
    readonly element: HTMLElement;
    /** The camera rig; read `follow.yaw` or call `follow.moveDirection()` to steer a character relative to the view. */
    readonly follow: FollowCamera3D;
    rotateSpeed: number;
    zoomSpeed: number;
    enabled = true;
    readonly #pointers = new Map<number, {x: number; y: number}>();
    readonly #listeners: [string, EventListener, AddEventListenerOptions | undefined][];
    readonly #previousTouchAction: string;
    readonly #previousTouchActionPriority: string;
    #pinch = 0;
    #disposed = false;

    constructor(camera: Camera3D, element: HTMLElement, target: Object3D | ArrayLike<number>, options: FollowControlsOptions3D = {}) {
        if (!camera || !element || typeof element.addEventListener !== 'function') throw new World3DError('WORLD3D_INPUT_INVALID', 'controls');
        this.element = element;
        this.follow = new FollowCamera3D(camera, target, options);
        this.rotateSpeed = options.rotateSpeed ?? 0.005; this.zoomSpeed = options.zoomSpeed ?? 0.1;
        const down = (event: PointerEvent): void => {
            if (!this.enabled) return;
            this.#pointers.set(event.pointerId, {x: event.clientX, y: event.clientY});
            this.element.setPointerCapture?.(event.pointerId);
            this.#pinch = 0;
        };
        const move = (event: PointerEvent): void => {
            const last = this.#pointers.get(event.pointerId);
            if (!last || !this.enabled) return;
            const dx = event.clientX - last.x, dy = event.clientY - last.y;
            last.x = event.clientX; last.y = event.clientY;
            if (this.#pointers.size === 1) { this.follow.yaw -= dx * this.rotateSpeed; this.follow.pitch += dy * this.rotateSpeed; return; }
            // Two fingers: the change in their spread zooms.
            const [a, b] = [...this.#pointers.values()], spread = Math.hypot(a!.x - b!.x, a!.y - b!.y);
            if (this.#pinch > 0 && spread > 0) this.follow.distance *= this.#pinch / spread;
            this.#pinch = spread;
        };
        const up = (event: PointerEvent): void => {
            if (this.forgetPointer(event.pointerId)) this.releaseCapture(event.pointerId);
        };
        const lost = (event: PointerEvent): void => {
            // A descendant losing its capture does not end a capture on this element.
            if (event.target === element) this.forgetPointer(event.pointerId);
        };
        const wheel = (event: WheelEvent): void => {
            if (!this.enabled) return;
            event.preventDefault();
            this.follow.distance *= 1 + Math.sign(event.deltaY) * this.zoomSpeed;
        };
        this.#listeners = [
            ['pointerdown', down as EventListener, undefined], ['pointermove', move as EventListener, undefined], ['pointerup', up as EventListener, undefined],
            ['pointercancel', up as EventListener, undefined], ['lostpointercapture', lost as EventListener, undefined],
            ['wheel', wheel as EventListener, {passive: false}],
        ];
        for (const [type, listener, listenerOptions] of this.#listeners) element.addEventListener(type, listener, listenerOptions);
        // Disable native gestures while attached without losing the host's inline style.
        this.#previousTouchAction = element.style.getPropertyValue('touch-action');
        this.#previousTouchActionPriority = element.style.getPropertyPriority('touch-action');
        if (this.#previousTouchAction !== 'none') element.style.setProperty('touch-action', 'none', this.#previousTouchActionPriority);
    }
    /** Place the camera; call once per frame after moving the target. */
    update(deltaSeconds = 0): void { if (!this.#disposed) this.follow.update(deltaSeconds); }
    dispose(): void {
        if (this.#disposed) return;
        this.#disposed = true;
        const element = this.element;
        for (const [type, listener, listenerOptions] of this.#listeners) element.removeEventListener(type, listener, listenerOptions);
        for (const id of this.#pointers.keys()) this.releaseCapture(id);
        this.#pointers.clear();
        this.#pinch = 0;
        const style = element.style;
        // Preserve any later inline style installed by the caller.
        if (this.#previousTouchAction !== 'none' && style.getPropertyValue('touch-action') === 'none'
            && style.getPropertyPriority('touch-action') === this.#previousTouchActionPriority) {
            style.setProperty('touch-action', this.#previousTouchAction, this.#previousTouchActionPriority);
        }
    }
    private forgetPointer(id: number): boolean {
        if (!this.#pointers.delete(id)) return false;
        this.#pinch = 0;
        return true;
    }
    private releaseCapture(id: number): void {
        if (this.element.hasPointerCapture?.(id)) this.element.releasePointerCapture(id);
    }
}

export function createFollowControls3D(camera: Camera3D, element: HTMLElement, target: Object3D | ArrayLike<number>, options: FollowControlsOptions3D = {}): FollowControls3D {
    return new FollowControls3D(camera, element, target, options);
}
