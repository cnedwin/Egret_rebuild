// SPDX-License-Identifier: Apache-2.0
// Authoring and debug visuals that follow other objects: bounds, arrows,
// camera frusta, lights and skeletons. Each helper is a world-space line
// node; add it to the scene root and call update() after its subject moves.
import { Camera3D } from './Camera3D.js';
import { World3DError } from './core3D.js';
import { Attribute3D, Geometry3D } from './Geometry3D.js';
import { createLineMaterial3D } from './helpers3D.js';
import { Light3D } from './Light3D.js';
import { box3Empty, box3IsEmpty, box3Transform, box3Union, mat4Invert, vec3TransformMat4 } from './math3D.js';
import { Bone3D, Mesh3D } from './Mesh3D.js';
import { Object3D } from './Object3D.js';
const scratchBox = new Float32Array(6), scratchMatrix = new Float32Array(16), scratchPoint = new Float32Array(3);
/**
 * World-space bounds of an object and its descendants as
 * [minX, minY, minZ, maxX, maxY, maxZ]. Empty (min > max) when nothing has geometry.
 */
export function computeObjectBounds3D(object, out = new Float32Array(6)) {
    if (!(object instanceof Object3D))
        throw new World3DError('WORLD3D_INPUT_INVALID', 'object');
    object.updateWorldMatrices();
    box3Empty(out);
    object.traverse(node => {
        if (!(node instanceof Mesh3D) || node instanceof LineHelper3D)
            return;
        box3Transform(scratchBox, node.geometry.boundingBox, node.matrixWorld);
        box3Union(out, out, scratchBox);
    });
    return out;
}
/** Shared base: a line mesh whose vertices are rewritten by update(). */
export class LineHelper3D extends Mesh3D {
    positions;
    #attribute;
    constructor(segments, color, name) {
        const geometry = new Geometry3D(), positions = new Float32Array(segments * 6), attribute = new Attribute3D(positions, 3);
        geometry.topology = 'lines';
        geometry.setAttribute('position', attribute);
        super(geometry, createLineMaterial3D(color));
        this.positions = positions;
        this.#attribute = attribute;
        this.castShadow = false;
        this.receiveShadow = false;
        this.frustumCulled = false;
        this.name = name;
    }
    segment(index, a, b) {
        const p = this.positions, at = index * 6;
        p[at] = a[0];
        p[at + 1] = a[1];
        p[at + 2] = a[2];
        p[at + 3] = b[0];
        p[at + 4] = b[1];
        p[at + 5] = b[2];
    }
    commit() {
        this.#attribute.touch();
        this.geometry.invalidateBounds();
    }
    /** Release the helper's own geometry and material. */
    dispose() {
        this.geometry.dispose();
        this.material.dispose();
    }
}
const BOX_EDGES = [0, 1, 1, 3, 3, 2, 2, 0, 4, 5, 5, 7, 7, 6, 6, 4, 0, 4, 1, 5, 2, 6, 3, 7];
/** Wire box around an object's world bounds. */
export class BoxHelper3D extends LineHelper3D {
    target;
    #bounds = new Float32Array(6);
    constructor(target, color = 0xffff00) {
        super(12, color, 'box-helper');
        this.target = target;
        this.update();
    }
    update() {
        const b = computeObjectBounds3D(this.target, this.#bounds);
        if (box3IsEmpty(b)) {
            this.positions.fill(0);
            this.commit();
            return;
        }
        const corner = (i) => [b[i & 1 ? 3 : 0], b[i & 2 ? 4 : 1], b[i & 4 ? 5 : 2]];
        for (let i = 0; i < 12; i++)
            this.segment(i, corner(BOX_EDGES[i * 2]), corner(BOX_EDGES[i * 2 + 1]));
        this.commit();
    }
}
/** Arrow from `origin` along `direction`; change them and call update(). */
export class ArrowHelper3D extends LineHelper3D {
    origin = new Float32Array(3);
    direction = new Float32Array([0, 1, 0]);
    length;
    constructor(direction, origin = [0, 0, 0], length = 1, color = 0xffff00) {
        super(5, color, 'arrow-helper');
        this.direction.set([direction[0], direction[1], direction[2]]);
        this.origin.set([origin[0], origin[1], origin[2]]);
        this.length = length;
        this.update();
    }
    update() {
        const d = this.direction, size = Math.hypot(d[0], d[1], d[2]) || 1, x = d[0] / size, y = d[1] / size, z = d[2] / size, o = this.origin, length = this.length;
        const tip = [o[0] + x * length, o[1] + y * length, o[2] + z * length], head = length * 0.2, back = [tip[0] - x * head, tip[1] - y * head, tip[2] - z * head];
        // Two perpendiculars to the direction span the arrow head.
        const ux = Math.abs(y) < 0.99 ? -z : 0, uy = Math.abs(y) < 0.99 ? 0 : -z, uz = Math.abs(y) < 0.99 ? x : y, us = Math.hypot(ux, uy, uz) || 1;
        const u = [ux / us, uy / us, uz / us], v = [y * u[2] - z * u[1], z * u[0] - x * u[2], x * u[1] - y * u[0]], w = head * 0.4;
        this.segment(0, o, tip);
        [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1]
        ].forEach(([a, b], i) => this.segment(1 + i, tip, [
            back[0] + (u[0] * a + v[0] * b) * w,
            back[1] + (u[1] * a + v[1] * b) * w,
            back[2] + (u[2] * a + v[2] * b) * w
        ]));
        this.commit();
    }
}
/** Outline of a camera's view volume. */
export class CameraHelper3D extends LineHelper3D {
    camera;
    constructor(camera, color = 0xffaa00) {
        super(12, color, 'camera-helper');
        this.camera = camera;
        if (!(camera instanceof Camera3D))
            throw new World3DError('WORLD3D_INPUT_INVALID', 'camera');
        this.update();
    }
    update() {
        const camera = this.camera;
        camera.updateWorldMatrices();
        camera.updateViewMatrices();
        if (!mat4Invert(scratchMatrix, camera.viewProjectionMatrix))
            return;
        const corners = [];
        for (let i = 0; i < 8; i++) {
            scratchPoint[0] = i & 1 ? 1 : -1;
            scratchPoint[1] = i & 2 ? 1 : -1;
            scratchPoint[2] = i & 4 ? 1 : -1;
            vec3TransformMat4(scratchPoint, scratchPoint, scratchMatrix);
            corners.push([scratchPoint[0], scratchPoint[1], scratchPoint[2]]);
        }
        for (let i = 0; i < 12; i++)
            this.segment(i, corners[BOX_EDGES[i * 2]], corners[BOX_EDGES[i * 2 + 1]]);
        this.commit();
    }
}
const RING = 24;
/** Shows where a light is and where it points: a ray for directional, a cone for spot, a range sphere for point lights. */
export class LightHelper3D extends LineHelper3D {
    light;
    /** Drawn size for lights without a range. */
    size;
    constructor(light, size = 1, color) {
        super(RING * 3 + 8, color ?? [light.color[0], light.color[1], light.color[2]], 'light-helper');
        this.light = light;
        this.size = size;
        this.update();
    }
    update() {
        const light = this.light;
        light.updateWorldMatrices();
        const m = light.matrixWorld, o = [m[12], m[13], m[14]], axis = (c) => {
            const x = m[c * 4], y = m[c * 4 + 1], z = m[c * 4 + 2], s = Math.hypot(x, y, z) || 1;
            return [x / s, y / s, z / s];
        };
        const right = axis(0), up = axis(1), back = axis(2), forward = [-back[0], -back[1], -back[2]];
        const along = (a, b, c, x, y, z) => [
            o[0] + a[0] * x + b[0] * y + c[0] * z,
            o[1] + a[1] * x + b[1] * y + c[1] * z,
            o[2] + a[2] * x + b[2] * y + c[2] * z
        ];
        this.positions.fill(0);
        let next = 0;
        const ring = (a, b, c, radius, offset) => {
            for (let i = 0; i < RING; i++) {
                const t0 = (i / RING) * Math.PI * 2, t1 = ((i + 1) / RING) * Math.PI * 2;
                this.segment(next++, along(a, b, c, Math.cos(t0) * radius, Math.sin(t0) * radius, offset), along(a, b, c, Math.cos(t1) * radius, Math.sin(t1) * radius, offset));
            }
        };
        if (light.lightType === 'point') {
            const radius = light.range > 0 ? light.range : this.size * 0.25;
            ring(right, up, forward, radius, 0);
            ring(up, forward, right, radius, 0);
            ring(forward, right, up, radius, 0);
        }
        else if (light.lightType === 'spot') {
            const length = light.range > 0 ? light.range : this.size, radius = Math.tan(Math.min(light.angle, 1.5)) * length;
            ring(right, up, forward, radius, length);
            [
                [1, 0],
                [-1, 0],
                [0, 1],
                [0, -1]
            ].forEach(([x, y]) => this.segment(next++, o, along(right, up, forward, x * radius, y * radius, length)));
        }
        else {
            const half = this.size * 0.25;
            ring(right, up, forward, half, 0);
            this.segment(next++, o, along(right, up, forward, 0, 0, this.size));
            [
                [1, 0],
                [-1, 0],
                [0, 1],
                [0, -1]
            ].forEach(([x, y]) => this.segment(next++, along(right, up, forward, x * half, y * half, 0), along(right, up, forward, x * half, y * half, this.size * 0.6)));
        }
        this.commit();
    }
}
/** A line from every bone to its parent bone. */
export class SkeletonHelper3D extends LineHelper3D {
    root;
    bones;
    constructor(root, color = 0x00ffaa) {
        const bones = [];
        root.traverse(node => {
            if (node instanceof Bone3D && node.parent instanceof Bone3D)
                bones.push(node);
        });
        super(Math.max(bones.length, 1), color, 'skeleton-helper');
        this.root = root;
        this.bones = bones;
        // Bones sit inside the mesh; draw the lines on top.
        const material = this.material;
        material.depthTest = false;
        material.depthWrite = false;
        this.renderOrder = 1e5;
        this.update();
    }
    update() {
        this.root.updateWorldMatrices();
        this.bones.forEach((bone, i) => {
            const a = bone.matrixWorld, b = bone.parent.matrixWorld;
            this.segment(i, [a[12], a[13], a[14]], [b[12], b[13], b[14]]);
        });
        this.commit();
    }
}
export function createBoxHelper3D(target, color) {
    return new BoxHelper3D(target, color);
}
export function createArrowHelper3D(direction, origin, length, color) {
    return new ArrowHelper3D(direction, origin, length, color);
}
export function createCameraHelper3D(camera, color) {
    return new CameraHelper3D(camera, color);
}
export function createLightHelper3D(light, size, color) {
    return new LightHelper3D(light, size, color);
}
export function createSkeletonHelper3D(root, color) {
    return new SkeletonHelper3D(root, color);
}
//# sourceMappingURL=debug3D.js.map