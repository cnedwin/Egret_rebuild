// SPDX-License-Identifier: Apache-2.0
// Transform gizmo for editors and debug tools: handles drawn over an object
// that move, turn or resize it when dragged. This part knows nothing about
// input devices; it is driven with world-space rays (from a pointer, a VR
// controller or a test) and keeps a constant size on screen. The browser
// entry adds TransformControls3D, which feeds it pointer events.
import type {Camera3D} from './Camera3D.js';
import {World3DError} from './core3D.js';
import {createUnlitMaterial3D} from './Material3D.js';
import type {Material3D} from './Material3D.js';
import {mat4Decompose, mat4Invert, quatFromAxisAngle, quatMultiply, quatNormalize, vec3TransformMat4, vec3TransformQuat} from './math3D.js';
import {Mesh3D} from './Mesh3D.js';
import {Object3D} from './Object3D.js';
import {createBoxGeometry3D, createCylinderGeometry3D, createPlaneGeometry3D, createSphereGeometry3D, createTorusGeometry3D} from './primitives3D.js';

export type GizmoMode3D = 'translate' | 'rotate' | 'scale';
export type GizmoSpace3D = 'world' | 'local';
/** A single axis, a plane spanned by two axes, or 'xyz' for the center handle of the scale mode. */
export type GizmoHandle3D = 'x' | 'y' | 'z' | 'xy' | 'yz' | 'xz' | 'xyz';
export interface TransformGizmoOptions3D {
    readonly mode?: GizmoMode3D;
    readonly space?: GizmoSpace3D;
    /** Length of the handles as a share of the view height. Defaults to 0.18. */
    readonly size?: number;
}

type V3 = [number, number, number];
const AXES: readonly V3[] = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
const COLORS: readonly V3[] = [[0.9, 0.15, 0.2], [0.3, 0.8, 0.15], [0.15, 0.4, 0.95]];
const HIGHLIGHT: V3 = [1, 0.85, 0.1];
const PICK = 0.09, RING = 1, PLANE_FROM = 0.25, PLANE_TO = 0.5;
const dot = (a: ArrayLike<number>, b: ArrayLike<number>): number => a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!;
const cross = (a: ArrayLike<number>, b: ArrayLike<number>): V3 => [a[1]! * b[2]! - a[2]! * b[1]!, a[2]! * b[0]! - a[0]! * b[2]!, a[0]! * b[1]! - a[1]! * b[0]!];
const unit = (a: ArrayLike<number>): V3 => { const size = Math.hypot(a[0]!, a[1]!, a[2]!) || 1; return [a[0]! / size, a[1]! / size, a[2]! / size]; };
const snap = (value: number, step: number | undefined): number => step !== undefined && step > 0 ? Math.round(value / step) * step : value;

interface Drag {
    handle: GizmoHandle3D;
    /** World pose and local scale of the object when the drag began. */
    position: V3; quaternion: [number, number, number, number]; scale: V3;
    /** World directions of the handle axes when the drag began. */
    axes: [V3, V3, V3];
    /** Where the ray first met the handle: a distance along an axis, or a point on a plane. */
    along: number; point: V3; normal: V3; edgeOn: boolean; size: number;
}

export class TransformGizmo3D extends Object3D {
    readonly camera: Camera3D;
    mode: GizmoMode3D;
    space: GizmoSpace3D;
    size: number;
    /** Step sizes for dragging: world units, radians and scale factor. Undefined moves freely. */
    translationSnap: number | undefined;
    rotationSnap: number | undefined;
    scaleSnap: number | undefined;
    enabled = true;
    /** Called while a drag changes the attached object. */
    onChange: ((object: Object3D) => void) | undefined;
    /** Called when a drag starts (true) or ends (false), for example to pause camera controls. */
    onDraggingChanged: ((dragging: boolean) => void) | undefined;
    #object: Object3D | undefined;
    #drag: Drag | undefined;
    #hovered: GizmoHandle3D | undefined;
    #shownMode: GizmoMode3D | undefined;
    readonly #groups: Record<GizmoMode3D, Object3D> = {translate: new Object3D(), rotate: new Object3D(), scale: new Object3D()};
    readonly #materials = new Map<GizmoHandle3D, {material: Material3D; color: V3}[]>();

    constructor(camera: Camera3D, options: TransformGizmoOptions3D = {}) {
        super();
        if (!camera) throw new World3DError('WORLD3D_INPUT_INVALID', 'gizmo camera');
        this.camera = camera;
        this.mode = options.mode ?? 'translate'; this.space = options.space ?? 'world'; this.size = options.size ?? 0.18;
        this.name = 'TransformGizmo3D';
        this.visible = false;
        this.build();
        for (const group of Object.values(this.#groups)) this.addChild(group);
    }
    /** The object being edited. */
    get object(): Object3D | undefined { return this.#object; }
    get dragging(): boolean { return this.#drag !== undefined; }
    /** The handle under the last hover ray, or the one being dragged. */
    get activeHandle(): GizmoHandle3D | undefined { return this.#drag?.handle ?? this.#hovered; }
    attach(object: Object3D): this {
        if (!(object instanceof Object3D) || (object as Object3D) === this) throw new World3DError('WORLD3D_INPUT_INVALID', 'gizmo object');
        this.endDrag();
        this.#object = object;
        this.update();
        return this;
    }
    detach(): this { this.endDrag(); this.#object = undefined; this.visible = false; return this; }

    private handleMaterial(handle: GizmoHandle3D, color: V3, opacity = 1): Material3D {
        // Drawn last and without depth, so the handles stay visible through the object.
        const material = createUnlitMaterial3D({color, opacity, alphaMode: 'blend', depthTest: false, depthWrite: false, side: 'double', fog: false, toneMapped: false});
        let list = this.#materials.get(handle);
        if (!list) this.#materials.set(handle, list = []);
        list.push({material, color});
        return material;
    }
    private part(group: Object3D, geometry: ConstructorParameters<typeof Mesh3D>[0], material: Material3D, axis: number, offset: number): Mesh3D {
        const mesh = new Mesh3D(geometry, material);
        // Primitives point along +Y; turn them onto the wanted axis.
        if (axis === 0) quatFromAxisAngle(mesh.quaternion, [0, 0, 1], -Math.PI / 2); else if (axis === 2) quatFromAxisAngle(mesh.quaternion, [1, 0, 0], Math.PI / 2);
        mesh.position[axis] = offset;
        mesh.markTransformDirty();
        mesh.renderOrder = 100000; mesh.frustumCulled = false; mesh.castShadow = false; mesh.receiveShadow = false;
        group.addChild(mesh);
        return mesh;
    }
    private build(): void {
        const names = ['x', 'y', 'z'] as const, shaft = createCylinderGeometry3D({radiusTop: 0.012, radiusBottom: 0.012, height: 0.8, radialSegments: 8});
        const tip = createCylinderGeometry3D({radiusTop: 0, radiusBottom: 0.05, height: 0.2, radialSegments: 12}), knob = createBoxGeometry3D({width: 0.09, height: 0.09, depth: 0.09});
        const ring = createTorusGeometry3D({radius: RING, tube: 0.012, radialSegments: 6, tubularSegments: 64}), square = createPlaneGeometry3D({width: PLANE_TO - PLANE_FROM, height: PLANE_TO - PLANE_FROM});
        for (let i = 0; i < 3; i++) {
            const name = names[i]!, color = COLORS[i]!;
            this.part(this.#groups.translate, shaft, this.handleMaterial(name, color), i, 0.4);
            this.part(this.#groups.translate, tip, this.handleMaterial(name, color), i, 0.9);
            this.part(this.#groups.scale, shaft, this.handleMaterial(name, color), i, 0.4);
            this.part(this.#groups.scale, knob, this.handleMaterial(name, color), i, 0.85);
            // The torus lies around Z; stand it around the wanted axis.
            const circle = new Mesh3D(ring, this.handleMaterial(name, color));
            if (i === 0) quatFromAxisAngle(circle.quaternion, [0, 1, 0], Math.PI / 2); else if (i === 1) quatFromAxisAngle(circle.quaternion, [1, 0, 0], Math.PI / 2);
            circle.markTransformDirty();
            circle.renderOrder = 100000; circle.frustumCulled = false;
            this.#groups.rotate.addChild(circle);
            // Plane handles: a small square between two axes, colored like the axis it leaves out.
            const plane = (['yz', 'xz', 'xy'] as const)[i]!, middle = (PLANE_FROM + PLANE_TO) / 2;
            const tile = new Mesh3D(square, this.handleMaterial(plane, color, 0.5));
            if (i === 0) quatFromAxisAngle(tile.quaternion, [0, 1, 0], Math.PI / 2); else if (i === 1) quatFromAxisAngle(tile.quaternion, [1, 0, 0], Math.PI / 2);
            tile.position.set([i === 0 ? 0 : middle, i === 1 ? 0 : middle, i === 2 ? 0 : middle]);
            tile.markTransformDirty();
            tile.renderOrder = 100000; tile.frustumCulled = false;
            this.#groups.translate.addChild(tile);
        }
        const center = new Mesh3D(createSphereGeometry3D({radius: 0.07, widthSegments: 12, heightSegments: 8}), this.handleMaterial('xyz', [0.85, 0.85, 0.85]));
        center.renderOrder = 100000; center.frustumCulled = false;
        this.#groups.scale.addChild(center);
    }

    /** World scale that keeps the handles the same size on screen. */
    private screenScale(position: ArrayLike<number>): number {
        const camera = this.camera, m = camera.matrixWorld;
        if (camera.projectionKind === 'orthographic') return camera.orthographicHeight / camera.zoom * this.size;
        // Distance along the viewing direction, which is -Z of the camera.
        const depth = -((position[0]! - m[12]!) * m[8]! + (position[1]! - m[13]!) * m[9]! + (position[2]! - m[14]!) * m[10]!);
        return Math.max(depth, 1e-4) * 2 * Math.tan(camera.fov * Math.PI / 360) / camera.zoom * this.size;
    }
    /** World pose of the attached object. */
    private pose(): {position: V3; quaternion: [number, number, number, number]} {
        const object = this.#object!, t = [0, 0, 0], q = [0, 0, 0, 1], s = [1, 1, 1];
        object.updateWorldMatrix();
        mat4Decompose(object.matrixWorld, t, q, s);
        return {position: [t[0]!, t[1]!, t[2]!], quaternion: [q[0]!, q[1]!, q[2]!, q[3]!]};
    }
    /**
     * Place the handles on the attached object and size them for the camera.
     * Call once per frame before rendering, after moving the camera or object.
     */
    update(): void {
        const object = this.#object;
        if (!object || !this.enabled) { this.visible = false; return; }
        this.camera.updateWorldMatrix();
        const {position, quaternion} = this.pose(), local = this.space === 'local' || this.mode === 'scale';
        this.visible = true;
        this.position.set(position);
        // While turning in world space the rings stay put; in local space they follow the object.
        this.quaternion.set(local ? quaternion : [0, 0, 0, 1]);
        const scale = this.screenScale(position);
        this.scale.set([scale, scale, scale]);
        this.markTransformDirty();
        if (this.#shownMode !== this.mode) {
            this.#shownMode = this.mode;
            for (const mode of ['translate', 'rotate', 'scale'] as const) this.#groups[mode].visible = mode === this.mode;
        }
    }
    private highlight(handle: GizmoHandle3D | undefined): void {
        if (handle === this.#hovered) return;
        this.#hovered = handle;
        for (const [name, list] of this.#materials) for (const entry of list) entry.material.color.set(name === handle ? HIGHLIGHT : entry.color);
    }
    /** World directions of the three handle axes. */
    private axes(quaternion: ArrayLike<number>): [V3, V3, V3] {
        const local = this.space === 'local' || this.mode === 'scale';
        return AXES.map(axis => local ? unit(vec3TransformQuat([0, 0, 0], axis, quaternion)) : [axis[0], axis[1], axis[2]]) as [V3, V3, V3];
    }
    /** Handle met by a world-space ray, or undefined. Also sets the highlight. */
    hover(origin: ArrayLike<number>, direction: ArrayLike<number>): GizmoHandle3D | undefined {
        if (this.#drag) return this.#drag.handle;
        const handle = this.pick(origin, direction);
        this.highlight(handle);
        return handle;
    }
    private pick(origin: ArrayLike<number>, direction: ArrayLike<number>): GizmoHandle3D | undefined {
        if (!this.#object || !this.enabled) return undefined;
        const {position, quaternion} = this.pose(), size = this.screenScale(position), axes = this.axes(quaternion), d = unit(direction);
        const o: V3 = [origin[0]! - position[0], origin[1]! - position[1], origin[2]! - position[2]], names = ['x', 'y', 'z'] as const;
        let best: GizmoHandle3D | undefined, nearest = Infinity;
        const offer = (handle: GizmoHandle3D, distance: number): void => { if (distance >= 0 && distance < nearest) { nearest = distance; best = handle; } };
        if (this.mode === 'rotate') {
            for (let i = 0; i < 3; i++) {
                const n = axes[i]!, facing = dot(d, n);
                if (Math.abs(facing) < 1e-4) continue;
                const t = -dot(o, n) / facing;
                if (t < 0) continue;
                const radius = Math.hypot(o[0] + d[0] * t, o[1] + d[1] * t, o[2] + d[2] * t);
                if (Math.abs(radius - RING * size) < PICK * size) offer(names[i]!, t);
            }
            return best;
        }
        if (this.mode === 'scale' && this.raySphere(o, d, 0.12 * size) >= 0) return 'xyz';
        for (let i = 0; i < 3; i++) {
            // Closest approach between the ray and the handle segment from the center to its tip.
            const a = axes[i]!, b = dot(d, a), c = dot(d, o), e = dot(a, o), denominator = 1 - b * b;
            let s = Math.abs(denominator) < 1e-9 ? 0 : (b * c - e) / -denominator;
            s = Math.min(Math.max(s, 0.1 * size), size);
            const t = Math.max(s * b - c, 0);
            const gap = Math.hypot(o[0] + d[0] * t - a[0] * s, o[1] + d[1] * t - a[1] * s, o[2] + d[2] * t - a[2] * s);
            if (gap < PICK * size) offer(names[i]!, t);
        }
        if (this.mode === 'translate') {
            const planes = [['yz', 1, 2], ['xz', 0, 2], ['xy', 0, 1]] as const;
            for (let i = 0; i < 3; i++) {
                const n = axes[i]!, facing = dot(d, n);
                if (Math.abs(facing) < 1e-4) continue;
                const t = -dot(o, n) / facing;
                if (t < 0) continue;
                const hit: V3 = [o[0] + d[0] * t, o[1] + d[1] * t, o[2] + d[2] * t], [name, first, second] = planes[i]!;
                const u = dot(hit, axes[first]!) / size, v = dot(hit, axes[second]!) / size;
                if (u > PLANE_FROM && u < PLANE_TO && v > PLANE_FROM && v < PLANE_TO) offer(name, t - 1e-3 * size);
            }
        }
        return best;
    }
    private raySphere(o: V3, d: V3, radius: number): number {
        const b = dot(o, d), c = dot(o, o) - radius * radius, discriminant = b * b - c;
        return discriminant < 0 ? -1 : Math.max(-b - Math.sqrt(discriminant), 0);
    }
    /** Distance along the line (point, axis) at which it comes closest to a ray. */
    private alongAxis(origin: ArrayLike<number>, d: V3, point: V3, axis: V3): number {
        const o: V3 = [origin[0]! - point[0], origin[1]! - point[1], origin[2]! - point[2]], b = dot(d, axis), denominator = 1 - b * b;
        return Math.abs(denominator) < 1e-6 ? 0 : (dot(axis, o) - b * dot(d, o)) / denominator;
    }
    /** Point where a ray meets the plane through `point` with normal `normal`, or undefined when it runs alongside. */
    private onPlane(origin: ArrayLike<number>, d: V3, point: V3, normal: V3): V3 | undefined {
        const facing = dot(d, normal);
        if (Math.abs(facing) < 1e-5) return undefined;
        const t = ((point[0] - origin[0]!) * normal[0] + (point[1] - origin[1]!) * normal[1] + (point[2] - origin[2]!) * normal[2]) / facing;
        return [origin[0]! + d[0] * t, origin[1]! + d[1] * t, origin[2]! + d[2] * t];
    }
    /** Direction from the object toward the camera, used as a drag plane that always faces the viewer. */
    private towardCamera(): V3 {
        const m = this.camera.matrixWorld;
        return unit([m[8]!, m[9]!, m[10]!]);
    }
    /** Start dragging the handle under the ray. Returns false when the ray misses every handle. */
    beginDrag(origin: ArrayLike<number>, direction: ArrayLike<number>): boolean {
        if (this.#drag) this.endDrag();
        const handle = this.pick(origin, direction), object = this.#object;
        if (!handle || !object) return false;
        const {position, quaternion} = this.pose(), axes = this.axes(quaternion), d = unit(direction), size = this.screenScale(position), index = 'xyz'.indexOf(handle);
        const drag: Drag = {handle, position, quaternion, scale: [object.scale[0]!, object.scale[1]!, object.scale[2]!], axes, along: 0, point: [0, 0, 0], normal: [0, 0, 1], edgeOn: false, size};
        if (this.mode === 'rotate') {
            drag.normal = axes[index]!;
            // Seen edge-on, a ring's own plane cannot be hit reliably; drag across the view instead.
            drag.edgeOn = Math.abs(dot(d, drag.normal)) < 0.2;
            if (drag.edgeOn) drag.normal = this.towardCamera();
        } else if (handle.length === 1) drag.along = this.alongAxis(origin, d, position, axes[index]!);
        else drag.normal = handle === 'xyz' ? this.towardCamera() : axes[handle === 'yz' ? 0 : handle === 'xz' ? 1 : 2]!;
        if (this.mode === 'rotate' || handle.length > 1) {
            const point = this.onPlane(origin, d, position, drag.normal);
            if (!point) return false;
            drag.point = point;
        }
        this.#drag = drag;
        this.highlight(handle);
        this.onDraggingChanged?.(true);
        return true;
    }
    /** Continue a drag with the current ray, updating the attached object. */
    drag(origin: ArrayLike<number>, direction: ArrayLike<number>): void {
        const drag = this.#drag, object = this.#object;
        if (!drag || !object) return;
        const d = unit(direction), index = 'xyz'.indexOf(drag.handle);
        if (this.mode === 'translate') {
            let move: V3;
            if (drag.handle.length === 1) {
                const axis = drag.axes[index]!, amount = snap(this.alongAxis(origin, d, drag.position, axis) - drag.along, this.translationSnap);
                move = [axis[0] * amount, axis[1] * amount, axis[2] * amount];
            } else {
                const point = this.onPlane(origin, d, drag.position, drag.normal);
                if (!point) return;
                move = [0, 0, 0];
                // Split the movement over the two axes of the plane so each can snap.
                for (let i = 0; i < 3; i++) {
                    if (!drag.handle.includes('xyz'[i]!)) continue;
                    const axis = drag.axes[i]!, amount = snap((point[0] - drag.point[0]) * axis[0] + (point[1] - drag.point[1]) * axis[1] + (point[2] - drag.point[2]) * axis[2], this.translationSnap);
                    move[0] += axis[0] * amount; move[1] += axis[1] * amount; move[2] += axis[2] * amount;
                }
            }
            this.setWorldPosition(object, [drag.position[0] + move[0], drag.position[1] + move[1], drag.position[2] + move[2]]);
        } else if (this.mode === 'rotate') {
            const point = this.onPlane(origin, d, drag.position, drag.normal);
            if (!point) return;
            const axis = drag.axes[index]!;
            let angle: number;
            if (drag.edgeOn) {
                // Movement across the ring, as seen by the camera, turns it like a wheel pushed at its rim.
                const tangent = unit(cross(axis, drag.normal));
                angle = ((point[0] - drag.point[0]) * tangent[0] + (point[1] - drag.point[1]) * tangent[1] + (point[2] - drag.point[2]) * tangent[2]) / (RING * drag.size);
            } else {
                const from: V3 = [drag.point[0] - drag.position[0], drag.point[1] - drag.position[1], drag.point[2] - drag.position[2]];
                const to: V3 = [point[0] - drag.position[0], point[1] - drag.position[1], point[2] - drag.position[2]];
                angle = Math.atan2(dot(cross(from, to), axis), dot(from, to));
            }
            angle = snap(angle, this.rotationSnap);
            const turn = quatFromAxisAngle([0, 0, 0, 1], axis, angle), world = quatNormalize([0, 0, 0, 1], quatMultiply([0, 0, 0, 1], turn, drag.quaternion));
            this.setWorldQuaternion(object, world);
        } else {
            let factor: number;
            if (drag.handle === 'xyz') {
                const point = this.onPlane(origin, d, drag.position, drag.normal);
                if (!point) return;
                // Dragging up or to the right grows the object, down or left shrinks it.
                const m = this.camera.matrixWorld;
                factor = 1 + ((point[0] - drag.point[0]) * (m[0]! + m[4]!) + (point[1] - drag.point[1]) * (m[1]! + m[5]!) + (point[2] - drag.point[2]) * (m[2]! + m[6]!)) / drag.size;
            } else {
                const start = Math.abs(drag.along) < 1e-6 ? 1e-6 : drag.along;
                factor = this.alongAxis(origin, d, drag.position, drag.axes[index]!) / start;
            }
            factor = Math.max(snap(factor, this.scaleSnap), 1e-4);
            for (let i = 0; i < 3; i++) object.scale[i] = drag.handle === 'xyz' || i === index ? drag.scale[i]! * factor : drag.scale[i]!;
            object.markTransformDirty();
        }
        this.update();
        this.onChange?.(object);
    }
    /** Finish the current drag, keeping the object where it is. */
    endDrag(): void {
        if (!this.#drag) return;
        this.#drag = undefined;
        this.onDraggingChanged?.(false);
    }
    /** Abandon the current drag and put the object back where it started. */
    cancelDrag(): void {
        const drag = this.#drag, object = this.#object;
        if (!drag || !object) return;
        this.setWorldPosition(object, drag.position);
        this.setWorldQuaternion(object, drag.quaternion);
        object.scale.set(drag.scale);
        object.markTransformDirty();
        this.endDrag();
        this.update();
        this.onChange?.(object);
    }
    private setWorldPosition(object: Object3D, world: V3): void {
        const parent = object.parent;
        if (parent) {
            parent.updateWorldMatrix();
            const inverse = new Float32Array(16);
            if (!mat4Invert(inverse, parent.matrixWorld)) return;
            vec3TransformMat4(object.position, world, inverse);
        } else object.position.set(world);
        object.markTransformDirty();
    }
    private setWorldQuaternion(object: Object3D, world: ArrayLike<number>): void {
        const parent = object.parent;
        if (parent) {
            parent.updateWorldMatrix();
            const t = [0, 0, 0], q = [0, 0, 0, 1], s = [1, 1, 1];
            mat4Decompose(parent.matrixWorld, t, q, s);
            // The inverse of a unit quaternion is its conjugate.
            quatMultiply(object.quaternion, [-q[0]!, -q[1]!, -q[2]!, q[3]!], world);
        } else object.quaternion.set(world);
        quatNormalize(object.quaternion, object.quaternion);
        object.markTransformDirty();
    }
    /** Release the handle geometry and materials. */
    dispose(): void {
        this.endDrag();
        this.removeFromParent();
        const seen = new Set<unknown>();
        this.traverse(node => {
            if (node instanceof Mesh3D && !seen.has(node.geometry)) { seen.add(node.geometry); node.geometry.dispose(); }
            return true;
        });
        for (const list of this.#materials.values()) for (const entry of list) entry.material.dispose();
    }
}

export function createTransformGizmo3D(camera: Camera3D, options: TransformGizmoOptions3D = {}): TransformGizmo3D { return new TransformGizmo3D(camera, options); }
