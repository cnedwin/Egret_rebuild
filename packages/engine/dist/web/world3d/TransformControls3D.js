import { World3DError } from '../../rendering/world3d/core3D.js';
import { TransformGizmo3D } from '../../rendering/world3d/Gizmo3D.js';
export class TransformControls3D {
    camera;
    element;
    /** The handles; add this to the scene that holds the edited object. */
    gizmo;
    #origin = new Float32Array(3);
    #direction = new Float32Array(3);
    #listeners;
    #pointer = -1;
    #disposed = false;
    /**
     * Create these before orbit or fly controls on the same element: a press
     * that lands on a handle is then kept from reaching them.
     */
    constructor(camera, element, options = {}) {
        if (!camera || !element || typeof element.addEventListener !== 'function')
            throw new World3DError('WORLD3D_INPUT_INVALID', 'controls');
        this.camera = camera;
        this.element = element;
        this.gizmo = new TransformGizmo3D(camera, options);
        const down = (event) => {
            if (this.#pointer >= 0 ||
                event.button > 0 ||
                !this.ray(event) ||
                !this.gizmo.beginDrag(this.#origin, this.#direction))
                return;
            this.#pointer = event.pointerId;
            this.element.setPointerCapture?.(event.pointerId);
            event.stopImmediatePropagation();
            event.preventDefault();
        };
        const move = (event) => {
            if (!this.ray(event))
                return;
            if (this.#pointer === event.pointerId) {
                this.gizmo.drag(this.#origin, this.#direction);
                event.stopImmediatePropagation();
            }
            else if (this.#pointer < 0)
                this.gizmo.hover(this.#origin, this.#direction);
        };
        const up = (event) => {
            if (this.#pointer !== event.pointerId)
                return;
            this.#pointer = -1;
            this.element.releasePointerCapture?.(event.pointerId);
            if (event.type === 'pointercancel')
                this.gizmo.cancelDrag();
            else
                this.gizmo.endDrag();
            event.stopImmediatePropagation();
        };
        this.#listeners = [
            ['pointerdown', down],
            ['pointermove', move],
            ['pointerup', up],
            ['pointercancel', up]
        ];
        for (const [type, listener] of this.#listeners)
            element.addEventListener(type, listener);
    }
    get mode() {
        return this.gizmo.mode;
    }
    set mode(value) {
        this.gizmo.mode = value;
    }
    get space() {
        return this.gizmo.space;
    }
    set space(value) {
        this.gizmo.space = value;
    }
    get enabled() {
        return this.gizmo.enabled;
    }
    set enabled(value) {
        this.gizmo.enabled = value;
    }
    get dragging() {
        return this.gizmo.dragging;
    }
    get object() {
        return this.gizmo.object;
    }
    attach(object) {
        this.gizmo.attach(object);
        return this;
    }
    detach() {
        this.gizmo.detach();
        return this;
    }
    /** Turn a pointer position into a world-space ray; false when the element has no size. */
    ray(event) {
        if (this.#disposed || !this.gizmo.enabled || !this.gizmo.object)
            return false;
        const box = this.element.getBoundingClientRect();
        if (!(box.width > 0) || !(box.height > 0))
            return false;
        this.camera.updateWorldMatrix();
        this.camera.updateViewMatrices();
        this.camera.screenPointToRay(((event.clientX - box.left) / box.width) * 2 - 1, 1 - ((event.clientY - box.top) / box.height) * 2, this.#origin, this.#direction);
        return true;
    }
    /** Keep the handles on the object and at a steady size; call once per frame. */
    update() {
        if (!this.#disposed)
            this.gizmo.update();
    }
    dispose() {
        if (this.#disposed)
            return;
        this.#disposed = true;
        for (const [type, listener] of this.#listeners)
            this.element.removeEventListener(type, listener);
        this.gizmo.dispose();
    }
}
export function createTransformControls3D(camera, element, options = {}) {
    return new TransformControls3D(camera, element, options);
}
//# sourceMappingURL=TransformControls3D.js.map