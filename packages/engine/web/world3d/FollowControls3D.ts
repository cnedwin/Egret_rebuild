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
            if (!this.#pointers.delete(event.pointerId)) return;
            this.element.releasePointerCapture?.(event.pointerId);
            this.#pinch = 0;
        };
        const wheel = (event: WheelEvent): void => {
            if (!this.enabled) return;
            event.preventDefault();
            this.follow.distance *= 1 + Math.sign(event.deltaY) * this.zoomSpeed;
        };
        this.#listeners = [
            ['pointerdown', down as EventListener, undefined], ['pointermove', move as EventListener, undefined], ['pointerup', up as EventListener, undefined],
            ['pointercancel', up as EventListener, undefined], ['wheel', wheel as EventListener, {passive: false}],
        ];
        for (const [type, listener, listenerOptions] of this.#listeners) element.addEventListener(type, listener, listenerOptions);
        // Stop the browser from scrolling or zooming the page during a drag.
        element.style.touchAction = 'none';
    }
    /** Place the camera; call once per frame after moving the target. */
    update(deltaSeconds = 0): void { if (!this.#disposed) this.follow.update(deltaSeconds); }
    dispose(): void {
        if (this.#disposed) return;
        this.#disposed = true;
        for (const [type, listener, listenerOptions] of this.#listeners) this.element.removeEventListener(type, listener, listenerOptions);
        this.#pointers.clear();
    }
}

export function createFollowControls3D(camera: Camera3D, element: HTMLElement, target: Object3D | ArrayLike<number>, options: FollowControlsOptions3D = {}): FollowControls3D {
    return new FollowControls3D(camera, element, target, options);
}
