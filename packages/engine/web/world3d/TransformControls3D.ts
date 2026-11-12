// SPDX-License-Identifier: Apache-2.0
// Pointer input for the transform gizmo: hovering highlights a handle and
// dragging it moves, turns or resizes the attached object. Works with mouse,
// pen and touch through Pointer Events. Add `controls.gizmo` to the scene and
// call update() once per frame before rendering.
import type {Disposable} from '@egret/contracts';
import type {Camera3D} from '../../rendering/world3d/Camera3D.js';
import {World3DError} from '../../rendering/world3d/core3D.js';
import {TransformGizmo3D} from '../../rendering/world3d/Gizmo3D.js';
import type {GizmoMode3D, GizmoSpace3D, TransformGizmoOptions3D} from '../../rendering/world3d/Gizmo3D.js';
import type {Object3D} from '../../rendering/world3d/Object3D.js';

export class TransformControls3D implements Disposable {
    readonly camera: Camera3D;
    readonly element: HTMLElement;
    /** The handles; add this to the scene that holds the edited object. */
    readonly gizmo: TransformGizmo3D;
    readonly #origin = new Float32Array(3);
    readonly #direction = new Float32Array(3);
    readonly #listeners: [string, EventListener][];
    #pointer = -1;
    #disposed = false;

    /**
     * Create these before orbit or fly controls on the same element: a press
     * that lands on a handle is then kept from reaching them.
     */
    constructor(camera: Camera3D, element: HTMLElement, options: TransformGizmoOptions3D = {}) {
        if (!camera || !element || typeof element.addEventListener !== 'function') throw new World3DError('WORLD3D_INPUT_INVALID', 'controls');
        this.camera = camera; this.element = element;
        this.gizmo = new TransformGizmo3D(camera, options);
        const down = (event: PointerEvent): void => {
            if (this.#pointer >= 0 || event.button > 0 || !this.ray(event) || !this.gizmo.beginDrag(this.#origin, this.#direction)) return;
            this.#pointer = event.pointerId;
            this.element.setPointerCapture?.(event.pointerId);
            event.stopImmediatePropagation();
            event.preventDefault();
        };
        const move = (event: PointerEvent): void => {
            if (!this.ray(event)) return;
            if (this.#pointer === event.pointerId) { this.gizmo.drag(this.#origin, this.#direction); event.stopImmediatePropagation(); }
            else if (this.#pointer < 0) this.gizmo.hover(this.#origin, this.#direction);
        };
        const up = (event: PointerEvent): void => {
            if (this.#pointer !== event.pointerId) return;
            this.#pointer = -1;
            this.element.releasePointerCapture?.(event.pointerId);
            if (event.type === 'pointercancel') this.gizmo.cancelDrag(); else this.gizmo.endDrag();
            event.stopImmediatePropagation();
        };
        this.#listeners = [['pointerdown', down as EventListener], ['pointermove', move as EventListener], ['pointerup', up as EventListener], ['pointercancel', up as EventListener]];
        for (const [type, listener] of this.#listeners) element.addEventListener(type, listener);
    }
    get mode(): GizmoMode3D { return this.gizmo.mode; }
    set mode(value: GizmoMode3D) { this.gizmo.mode = value; }
    get space(): GizmoSpace3D { return this.gizmo.space; }
    set space(value: GizmoSpace3D) { this.gizmo.space = value; }
    get enabled(): boolean { return this.gizmo.enabled; }
    set enabled(value: boolean) { this.gizmo.enabled = value; }
    get dragging(): boolean { return this.gizmo.dragging; }
    get object(): Object3D | undefined { return this.gizmo.object; }
    attach(object: Object3D): this { this.gizmo.attach(object); return this; }
    detach(): this { this.gizmo.detach(); return this; }
    /** Turn a pointer position into a world-space ray; false when the element has no size. */
    private ray(event: PointerEvent): boolean {
        if (this.#disposed || !this.gizmo.enabled || !this.gizmo.object) return false;
        const box = this.element.getBoundingClientRect();
        if (!(box.width > 0) || !(box.height > 0)) return false;
        this.camera.updateWorldMatrix();
        this.camera.updateViewMatrices();
        this.camera.screenPointToRay((event.clientX - box.left) / box.width * 2 - 1, 1 - (event.clientY - box.top) / box.height * 2, this.#origin, this.#direction);
        return true;
    }
    /** Keep the handles on the object and at a steady size; call once per frame. */
    update(): void { if (!this.#disposed) this.gizmo.update(); }
    dispose(): void {
        if (this.#disposed) return;
        this.#disposed = true;
        for (const [type, listener] of this.#listeners) this.element.removeEventListener(type, listener);
        this.gizmo.dispose();
    }
}

export function createTransformControls3D(camera: Camera3D, element: HTMLElement, options: TransformGizmoOptions3D = {}): TransformControls3D {
    return new TransformControls3D(camera, element, options);
}
