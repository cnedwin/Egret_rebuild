// SPDX-License-Identifier: Apache-2.0
// Backend-neutral frame preparation: refresh transforms, cull against the
// camera frustum, gather lights and produce sorted draw items. Item records
// are pooled so a steady scene allocates nothing per frame.
import type {Camera3D} from './Camera3D.js';
import type {Geometry3D} from './Geometry3D.js';
import {Lod3D, ScreenLayer3D} from './helpers3D.js';
import {LIGHT3D_LIMITS, Light3D} from './Light3D.js';
import type {Material3D} from './Material3D.js';
import {frustumIntersectsSphere} from './math3D.js';
import {Mesh3D} from './Mesh3D.js';
import type {Object3D, Scene3D} from './Object3D.js';

export interface RenderItem3D {
    mesh: Mesh3D;
    geometry: Geometry3D;
    material: Material3D;
    /** First index (or vertex) and count of the range to draw. */
    start: number;
    count: number;
    /** View-space distance along the camera axis; larger is farther. */
    depth: number;
}
export interface RenderStats3D {
    visited: number;
    culled: number;
}

function compareOpaque(a: RenderItem3D, b: RenderItem3D): number {
    // Group by material, then geometry, to minimize state changes; draw near
    // objects first within a group so early depth rejection saves shading.
    return a.mesh.renderOrder - b.mesh.renderOrder || a.material.id - b.material.id || a.geometry.id - b.geometry.id || a.depth - b.depth;
}
function compareTransparent(a: RenderItem3D, b: RenderItem3D): number {
    return a.mesh.renderOrder - b.mesh.renderOrder || b.depth - a.depth || a.mesh.id - b.mesh.id;
}

export class RenderList3D {
    readonly opaque: RenderItem3D[] = [];
    readonly transparent: RenderItem3D[] = [];
    /** Visible-to-light meshes; shadow passes cull these against each light volume. */
    readonly shadowCasters: Mesh3D[] = [];
    readonly directionalLights: Light3D[] = [];
    readonly pointLights: Light3D[] = [];
    readonly spotLights: Light3D[] = [];
    /** Summed ambient radiance, plus hemisphere sky and ground radiance. */
    readonly ambient = new Float32Array(3);
    readonly hemisphereSky = new Float32Array(3);
    readonly hemisphereGround = new Float32Array(3);
    readonly stats: RenderStats3D = {visited: 0, culled: 0};
    #pool: RenderItem3D[] = [];
    #used = 0;
    #frame = 0;

    /** Monotonic frame id, used to update each skeleton once per frame. */
    get frame(): number { return this.#frame; }

    build(scene: Scene3D, camera: Camera3D): void {
        this.#frame++;
        this.#used = 0;
        this.opaque.length = this.transparent.length = this.shadowCasters.length = 0;
        this.directionalLights.length = this.pointLights.length = this.spotLights.length = 0;
        this.ambient.fill(0); this.hemisphereSky.fill(0); this.hemisphereGround.fill(0);
        this.stats.visited = this.stats.culled = 0;
        scene.updateWorldMatrices();
        camera.updateViewMatrices();
        this.visit(scene, camera);
        this.opaque.sort(compareOpaque);
        this.transparent.sort(compareTransparent);
    }
    private visit(object: Object3D, camera: Camera3D): void {
        if (!object.visible) return;
        if (object instanceof Lod3D) {
            const eye = camera.matrixWorld;
            object.select(eye[12]!, eye[13]!, eye[14]!);
        }
        if (object.kind === 'mesh') this.addMesh(object as Mesh3D, camera);
        else if (object.kind === 'light') this.addLight(object as Light3D);
        const children = object.children;
        for (let i = 0; i < children.length; i++) this.visit(children[i]!, camera);
    }
    private addLight(light: Light3D): void {
        const intensity = light.intensity;
        if (!(intensity > 0)) return;
        const color = light.color;
        switch (light.lightType) {
            case 'ambient':
                for (let i = 0; i < 3; i++) this.ambient[i]! += color[i]! * intensity;
                break;
            case 'hemisphere':
                for (let i = 0; i < 3; i++) { this.hemisphereSky[i]! += color[i]! * intensity; this.hemisphereGround[i]! += light.groundColor[i]! * intensity; }
                break;
            case 'directional':
                if (this.directionalLights.length < LIGHT3D_LIMITS.maxDirectional) this.directionalLights.push(light);
                break;
            case 'point':
                if (this.pointLights.length < LIGHT3D_LIMITS.maxPoint) this.pointLights.push(light);
                break;
            case 'spot':
                if (this.spotLights.length < LIGHT3D_LIMITS.maxSpot) this.spotLights.push(light);
                break;
        }
    }
    private addMesh(mesh: Mesh3D, camera: Camera3D): void {
        const geometry = mesh.geometry;
        if (geometry.isDisposed || geometry.drawCount === 0) return;
        this.stats.visited++;
        if (mesh.skeleton) mesh.skeleton.update(this.#frame);
        if (mesh instanceof ScreenLayer3D && mesh.autoUpdate) mesh.refreshSource();
        if (mesh.castShadow) this.shadowCasters.push(mesh);
        if ((mesh.layers & camera.layerMask) === 0) return;
        const sphere = mesh.worldBoundingSphere;
        if (mesh.frustumCulled && sphere[3]! >= 0 && !frustumIntersectsSphere(camera.frustum, sphere)) { this.stats.culled++; return; }
        const view = camera.viewMatrix;
        const depth = -(view[2]! * sphere[0]! + view[6]! * sphere[1]! + view[10]! * sphere[2]! + view[14]!);
        const groups = geometry.groups;
        if (Array.isArray(mesh.material) && groups.length > 0) {
            for (let i = 0; i < groups.length; i++) {
                const group = groups[i]!;
                this.push(mesh, geometry, mesh.materialAt(group.materialIndex), group.start, group.count, depth);
            }
        } else this.push(mesh, geometry, mesh.materialAt(0), 0, geometry.drawCount, depth);
    }
    private push(mesh: Mesh3D, geometry: Geometry3D, material: Material3D, start: number, count: number, depth: number): void {
        if (!material.visible || material.isDisposed || count <= 0) return;
        let item = this.#pool[this.#used];
        if (!item) this.#pool[this.#used] = item = {mesh, geometry, material, start, count, depth};
        else { item.mesh = mesh; item.geometry = geometry; item.material = material; item.start = start; item.count = count; item.depth = depth; }
        this.#used++;
        (material.isTransparent ? this.transparent : this.opaque).push(item);
    }
    /** Drop pooled references so retired scene content can be collected. */
    clear(): void {
        this.#pool = [];
        this.#used = 0;
        this.opaque.length = this.transparent.length = this.shadowCasters.length = 0;
        this.directionalLights.length = this.pointLights.length = this.spotLights.length = 0;
    }
}
