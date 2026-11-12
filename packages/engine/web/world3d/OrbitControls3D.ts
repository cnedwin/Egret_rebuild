// SPDX-License-Identifier: Apache-2.0
// Pointer-driven orbit, pan and zoom around a target point. Works with mouse,
// pen and touch (one finger orbits, two fingers pan and pinch) through
// Pointer Events. Call update() once per frame before rendering.
import type {Disposable} from '@egret/contracts';
import type {Camera3D} from '../../rendering/world3d/Camera3D.js';
import {World3DError} from '../../rendering/world3d/core3D.js';

export interface OrbitControlsOptions3D {
    readonly target?: readonly [number, number, number];
    readonly minDistance?: number;
    readonly maxDistance?: number;
    /** Polar angle limits in radians, measured from the +Y axis. */
    readonly minPolarAngle?: number;
    readonly maxPolarAngle?: number;
    readonly rotateSpeed?: number;
    readonly panSpeed?: number;
    readonly zoomSpeed?: number;
    /** Fraction of motion kept per 1/60 s; 0 disables inertia. */
    readonly damping?: number;
    readonly enablePan?: boolean;
    readonly enableZoom?: boolean;
    readonly enableRotate?: boolean;
    /** Radians per second of automatic rotation about the Y axis. */
    readonly autoRotateSpeed?: number;
}

const EPSILON = 1e-4;

export class OrbitControls3D implements Disposable {
    readonly camera: Camera3D;
    readonly element: HTMLElement;
    readonly target = new Float32Array(3);
    minDistance: number;
    maxDistance: number;
    minPolarAngle: number;
    maxPolarAngle: number;
    rotateSpeed: number;
    panSpeed: number;
    zoomSpeed: number;
    damping: number;
    enablePan: boolean;
    enableZoom: boolean;
    enableRotate: boolean;
    autoRotateSpeed: number;
    enabled = true;
    // Spherical position of the camera relative to the target.
    #radius = 1;
    #theta = 0;
    #phi = Math.PI / 2;
    // Pending motion, consumed (and decayed when damping) by update().
    #deltaTheta = 0;
    #deltaPhi = 0;
    #zoom = 1;
    readonly #pan = new Float32Array(3);
    readonly #pointers = new Map<number, {x: number; y: number}>();
    #pinch = 0;
    #disposed = false;
    readonly #listeners: [string, EventListener, AddEventListenerOptions | undefined][];

    constructor(camera: Camera3D, element: HTMLElement, options: OrbitControlsOptions3D = {}) {
        if (!camera || !element || typeof element.addEventListener !== 'function') throw new World3DError('WORLD3D_INPUT_INVALID', 'controls');
        this.camera = camera;
        this.element = element;
        if (options.target) this.target.set(options.target);
        this.minDistance = options.minDistance ?? 0.01;
        this.maxDistance = options.maxDistance ?? Infinity;
        this.minPolarAngle = options.minPolarAngle ?? 0;
        this.maxPolarAngle = options.maxPolarAngle ?? Math.PI;
        this.rotateSpeed = options.rotateSpeed ?? 1;
        this.panSpeed = options.panSpeed ?? 1;
        this.zoomSpeed = options.zoomSpeed ?? 1;
        this.damping = options.damping ?? 0.85;
        this.enablePan = options.enablePan ?? true;
        this.enableZoom = options.enableZoom ?? true;
        this.enableRotate = options.enableRotate ?? true;
        this.autoRotateSpeed = options.autoRotateSpeed ?? 0;
        this.syncFromCamera();
        this.#listeners = [
            ['pointerdown', this.onPointerDown as EventListener, undefined],
            ['pointermove', this.onPointerMove as EventListener, undefined],
            ['pointerup', this.onPointerUp as EventListener, undefined],
            ['pointercancel', this.onPointerUp as EventListener, undefined],
            ['wheel', this.onWheel as EventListener, {passive: false}],
            ['contextmenu', this.onContextMenu, undefined],
        ];
        for (const [type, listener, listenerOptions] of this.#listeners) element.addEventListener(type, listener, listenerOptions);
        // Stop the browser from scrolling or zooming the page during a drag.
        element.style.touchAction = 'none';
    }
    /** Recompute the orbit parameters after moving the camera or target directly. */
    syncFromCamera(): void {
        const p = this.camera.position, x = p[0]! - this.target[0]!, y = p[1]! - this.target[1]!, z = p[2]! - this.target[2]!;
        this.#radius = Math.max(Math.hypot(x, y, z), EPSILON);
        this.#theta = Math.atan2(x, z);
        this.#phi = Math.acos(Math.min(Math.max(y / this.#radius, -1), 1));
    }
    private readonly onContextMenu = (event: Event): void => { if (this.enabled) event.preventDefault(); };
    private readonly onPointerDown = (event: PointerEvent): void => {
        if (!this.enabled) return;
        this.element.setPointerCapture?.(event.pointerId);
        this.#pointers.set(event.pointerId, {x: event.clientX, y: event.clientY});
        this.#pinch = this.pinchDistance();
    };
    private readonly onPointerUp = (event: PointerEvent): void => {
        this.#pointers.delete(event.pointerId);
        this.element.releasePointerCapture?.(event.pointerId);
        this.#pinch = this.pinchDistance();
    };
    private pinchDistance(): number {
        if (this.#pointers.size !== 2) return 0;
        const [a, b] = [...this.#pointers.values()];
        return Math.hypot(a!.x - b!.x, a!.y - b!.y);
    }
    private readonly onPointerMove = (event: PointerEvent): void => {
        const previous = this.#pointers.get(event.pointerId);
        if (!this.enabled || !previous) return;
        const dx = event.clientX - previous.x, dy = event.clientY - previous.y;
        previous.x = event.clientX; previous.y = event.clientY;
        const height = Math.max(this.element.clientHeight, 1);
        if (this.#pointers.size === 2) {
            // Two contacts: each moves the view by half its motion, and their spacing zooms.
            if (this.enablePan) this.addPan(dx * 0.5, dy * 0.5, height);
            const distance = this.pinchDistance();
            if (this.enableZoom && this.#pinch > 0 && distance > 0) this.#zoom *= this.#pinch / distance;
            this.#pinch = distance;
            return;
        }
        const panning = event.pointerType === 'mouse' && (event.buttons & 2) !== 0 || event.shiftKey;
        if (panning) { if (this.enablePan) this.addPan(dx, dy, height); return; }
        if (!this.enableRotate) return;
        // A drag across the element height turns the view by half a revolution.
        this.#deltaTheta -= dx / height * Math.PI * this.rotateSpeed;
        this.#deltaPhi -= dy / height * Math.PI * this.rotateSpeed;
    };
    private addPan(dx: number, dy: number, height: number): void {
        const camera = this.camera, m = camera.matrixWorld;
        // World units per pixel at the target's depth.
        const span = camera.projectionKind === 'perspective'
            ? 2 * this.#radius * Math.tan(camera.fov * Math.PI / 360) / camera.zoom : camera.orthographicHeight / camera.zoom;
        const scale = span / height * this.panSpeed;
        for (let i = 0; i < 3; i++) this.#pan[i]! += (-dx * m[i]! + dy * m[4 + i]!) * scale;
    }
    private readonly onWheel = (event: WheelEvent): void => {
        if (!this.enabled || !this.enableZoom) return;
        event.preventDefault();
        const lines = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY;
        this.#zoom *= Math.pow(1.001, lines * this.zoomSpeed);
    };
    /** Apply pending input and place the camera. Returns true while the view is still moving. */
    update(deltaSeconds = 1 / 60): boolean {
        if (this.#disposed) return false;
        const dt = Math.min(Math.max(deltaSeconds, 0), 0.1);
        if (this.autoRotateSpeed !== 0 && this.#pointers.size === 0) this.#theta += this.autoRotateSpeed * dt;
        this.#theta += this.#deltaTheta;
        this.#phi = Math.min(Math.max(this.#phi + this.#deltaPhi, Math.max(this.minPolarAngle, EPSILON)), Math.min(this.maxPolarAngle, Math.PI - EPSILON));
        if (this.camera.projectionKind === 'orthographic') this.camera.zoom = Math.max(this.camera.zoom / this.#zoom, EPSILON);
        else this.#radius = Math.min(Math.max(this.#radius * this.#zoom, this.minDistance), this.maxDistance);
        for (let i = 0; i < 3; i++) this.target[i]! += this.#pan[i]!;
        const moving = Math.abs(this.#deltaTheta) + Math.abs(this.#deltaPhi) + Math.abs(this.#zoom - 1) + Math.hypot(this.#pan[0]!, this.#pan[1]!, this.#pan[2]!) > 1e-6;
        // Frame-rate independent decay of the remaining motion.
        const keep = this.damping > 0 ? Math.pow(Math.min(this.damping, 0.999), dt * 60) : 0;
        this.#deltaTheta *= keep; this.#deltaPhi *= keep;
        this.#zoom = 1 + (this.#zoom - 1) * keep;
        for (let i = 0; i < 3; i++) this.#pan[i]! *= keep;
        const sinPhi = Math.sin(this.#phi), r = this.#radius;
        this.camera.setPosition(this.target[0]! + r * sinPhi * Math.sin(this.#theta), this.target[1]! + r * Math.cos(this.#phi), this.target[2]! + r * sinPhi * Math.cos(this.#theta));
        this.camera.lookAt(this.target[0]!, this.target[1]!, this.target[2]!);
        return moving || this.autoRotateSpeed !== 0;
    }
    /** Detach every listener. Idempotent. */
    dispose(): void {
        if (this.#disposed) return;
        this.#disposed = true;
        for (const [type, listener, listenerOptions] of this.#listeners) this.element.removeEventListener(type, listener, listenerOptions);
        this.#pointers.clear();
    }
}

export function createOrbitControls3D(camera: Camera3D, element: HTMLElement, options: OrbitControlsOptions3D = {}): OrbitControls3D {
    return new OrbitControls3D(camera, element, options);
}
