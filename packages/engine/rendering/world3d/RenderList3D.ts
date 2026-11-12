// SPDX-License-Identifier: Apache-2.0
// Backend-neutral frame preparation: refresh transforms, cull against the
// camera frustum, gather lights and produce sorted draw items. Item records
// are pooled so a steady scene allocates nothing per frame. Two things keep
// large scenes cheap: when the same items are visible as in the frame before,
// their sorted order is kept instead of sorted again; and runs of plain meshes
// that share a geometry and a material are handed to the backend as one
// instanced draw.
import {worldRenderSphere3D} from './AnimationTexture3D.js';
import type {Camera3D} from './Camera3D.js';
import type {Geometry3D} from './Geometry3D.js';
import {Lod3D, ScreenLayer3D} from './helpers3D.js';
import {LIGHT3D_LIMITS, Light3D} from './Light3D.js';
import type {Material3D} from './Material3D.js';
import {frustumIntersectsSphere} from './math3D.js';
import {InstancedMesh3D, Mesh3D} from './Mesh3D.js';
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
    /** Drawn before blended items, and the mesh's render order: kept on the item so sorting need not look them up. */
    opaque?: boolean;
    order?: number;
    /** What else must match for meshes to share an instanced draw: layers, receiving shadows, being instanceable at all. */
    group?: number;
}
export interface RenderStats3D {
    visited: number;
    culled: number;
}

function compareOpaque(a: RenderItem3D, b: RenderItem3D): number {
    // Group by material, then geometry, to minimize state changes; draw near
    // objects first within a group so early depth rejection saves shading.
    return a.order! - b.order! || a.material.id - b.material.id || a.geometry.id - b.geometry.id || a.start - b.start || a.depth - b.depth;
}
function compareTransparent(a: RenderItem3D, b: RenderItem3D): number {
    return a.mesh.renderOrder - b.mesh.renderOrder || b.depth - a.depth || a.mesh.id - b.mesh.id;
}

interface Batch { mesh: InstancedMesh3D; geometry: Geometry3D; material: Material3D; role: number; frame: number; stamp: number }
function foldable(material: Material3D): boolean { return !material.billboard && !material.screenSpace && !material.wireframe; }

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
    /**
     * Runs of at least this many plain meshes with the same geometry and
     * material are drawn as one instanced draw; shadow casters are grouped the
     * same way. 0 draws every mesh on its own.
     */
    autoInstanceThreshold = 8;
    /** How many instanced draws automatic instancing made in the last build, and how many meshes they stand for. */
    readonly instancing = {batches: 0, meshes: 0};
    #pool: RenderItem3D[] = [];
    // Opaque items in sorted order, before runs are folded into instanced draws.
    readonly #sorted: RenderItem3D[] = [];
    #same = true;
    #lastUsed = -1;
    readonly #batches = new Map<number, Batch[]>();
    readonly #batchItems: RenderItem3D[] = [];
    #batchItemsUsed = 0;
    readonly #casters: Mesh3D[] = [];
    readonly #members: Mesh3D[] = [];
    readonly #kinds: number[] = [];
    readonly #sizes: number[] = [];
    readonly #casterGroups = new Map<number, Mesh3D[]>();
    #used = 0;
    #frame = 0;

    /** Monotonic frame id, used to update each skeleton once per frame. */
    get frame(): number { return this.#frame; }

    build(scene: Scene3D, camera: Camera3D): void {
        this.#override = scene.overrideMaterial && !scene.overrideMaterial.isDisposed ? scene.overrideMaterial : undefined;
        this.#frame++;
        this.#used = 0;
        this.#same = true;
        this.#batchItemsUsed = 0;
        this.instancing.batches = this.instancing.meshes = 0;
        this.opaque.length = this.transparent.length = this.shadowCasters.length = this.#casters.length = 0;
        this.directionalLights.length = this.pointLights.length = this.spotLights.length = 0;
        this.ambient.fill(0); this.hemisphereSky.fill(0); this.hemisphereGround.fill(0);
        this.stats.visited = this.stats.culled = 0;
        scene.updateWorldMatrices();
        camera.updateViewMatrices();
        this.visit(scene, camera);
        // The same items as last frame, in the same roles: last frame's order still groups them by material and geometry.
        if (!this.#same || this.#used !== this.#lastUsed) {
            const sorted = this.#sorted, pool = this.#pool;
            sorted.length = 0;
            for (let i = 0; i < this.#used; i++) if (pool[i]!.opaque) sorted.push(pool[i]!);
            sorted.sort(compareOpaque);
        }
        this.#lastUsed = this.#used;
        this.transparent.sort(compareTransparent);
        this.fold();
        this.groupCasters();
        if (this.#frame % 256 === 0) this.retire();
    }
    /** Copy the sorted opaque items out, replacing each long enough run of like meshes with one instanced item. */
    private fold(): void {
        const sorted = this.#sorted, out = this.opaque, least = this.autoInstanceThreshold;
        if (!(least > 1)) { for (let i = 0; i < sorted.length; i++) out.push(sorted[i]!); return; }
        const members = this.#members, kinds = this.#kinds, sizes = this.#sizes;
        for (let i = 0; i < sorted.length;) {
            // A span: neighbours in sorted order that draw the same range of the same geometry with the same material.
            const first = sorted[i]!;
            let end = i + 1;
            while (end < sorted.length) {
                const next = sorted[end]!;
                if (next.material !== first.material || next.geometry !== first.geometry || next.start !== first.start || next.count !== first.count || next.order !== first.order) break;
                end++;
            }
            if (end - i < least || !foldable(first.material)) { for (; i < end; i++) out.push(sorted[i]!); continue; }
            // Within a span, meshes fold together only when layers and shadow reception match and each can be instanced.
            let kindCount = 0;
            for (let k = i; k < end; k++) {
                const group = sorted[k]!.group!;
                let at = 0;
                while (at < kindCount && kinds[at] !== group) at++;
                if (at === kindCount) { kinds[kindCount] = group; sizes[kindCount] = 0; kindCount++; }
                sizes[at] = sizes[at]! + 1;
            }
            for (let kind = 0; kind < kindCount; kind++) {
                const group = kinds[kind]!;
                if (group < 8589934592 || sizes[kind]! < least) continue;
                members.length = 0;
                let lead: RenderItem3D | undefined;
                for (let k = i; k < end; k++) if (sorted[k]!.group === group) { members.push(sorted[k]!.mesh); lead ??= sorted[k]!; }
                const batch = this.batch(first.geometry, first.material, lead!.mesh.receiveShadow ? 1 : 0, members.length, (k) => members[k]!);
                // Layers travel with the stand-in: outlines and masks select meshes by them.
                batch.mesh.castShadow = false; batch.mesh.layers = lead!.mesh.layers;
                let item = this.#batchItems[this.#batchItemsUsed];
                if (!item) this.#batchItems[this.#batchItemsUsed] = item = {mesh: batch.mesh, geometry: first.geometry, material: first.material, start: first.start, count: first.count, depth: lead!.depth, opaque: true, order: first.order!, group};
                else { item.mesh = batch.mesh; item.geometry = first.geometry; item.material = first.material; item.start = first.start; item.count = first.count; item.depth = lead!.depth; item.order = first.order!; item.group = group; }
                this.#batchItemsUsed++;
                out.push(item);
                this.instancing.batches++; this.instancing.meshes += members.length;
                sizes[kind] = -1;
            }
            // What was not folded keeps its front-to-back order.
            for (let k = i; k < end; k++) {
                const group = sorted[k]!.group!;
                let at = 0;
                while (kinds[at] !== group) at++;
                if (sizes[at] !== -1) out.push(sorted[k]!);
            }
            i = end;
        }
    }
    /** Shadow casters that share a geometry and a material are drawn into the shadow maps as one instanced mesh. */
    private groupCasters(): void {
        const casters = this.#casters, out = this.shadowCasters, least = this.autoInstanceThreshold, groups = this.#casterGroups;
        if (!(least > 1)) { for (let i = 0; i < casters.length; i++) out.push(casters[i]!); return; }
        for (const list of groups.values()) list.length = 0;
        for (let i = 0; i < casters.length; i++) {
            const mesh = casters[i]!, material = mesh.material;
            if (Array.isArray(material) || !mesh.canInstance || !foldable(material) || material.id >= 4194304) { out.push(mesh); continue; }
            const key = mesh.geometry.id * 4194304 + material.id;
            let list = groups.get(key);
            if (!list) groups.set(key, list = []);
            list.push(mesh);
        }
        for (const list of groups.values()) {
            if (list.length === 0) continue;
            if (list.length < least) { for (let i = 0; i < list.length; i++) out.push(list[i]!); continue; }
            const batch = this.batch(list[0]!.geometry, list[0]!.material as Material3D, 2, list.length, (k) => list[k]!);
            batch.mesh.castShadow = true;
            out.push(batch.mesh);
        }
    }
    /** The instanced stand-in for a run of meshes, with their world matrices as its instances. */
    private batch(geometry: Geometry3D, material: Material3D, role: number, count: number, at: (index: number) => Mesh3D): Batch {
        const key = geometry.id * 4194304 + material.id % 4194304;
        let slots = this.#batches.get(key);
        if (!slots) this.#batches.set(key, slots = []);
        // One stand-in per role (receiving shadows or not, casting) and per run within a frame.
        let found: Batch | undefined;
        for (const slot of slots) if (slot.role === role && slot.frame !== this.#frame && slot.material === material && slot.geometry === geometry) { found = slot; break; }
        if (!found || found.mesh.capacity < count) {
            const capacity = Math.max(16, 2 ** Math.ceil(Math.log2(count)));
            const mesh = new InstancedMesh3D(geometry, material, capacity);
            mesh.name = 'auto-instances'; mesh.pickable = false; mesh.frustumCulled = false;
            if (found) { found.mesh = mesh; found.stamp = -1; } else slots.push(found = {mesh, geometry, material, role, frame: 0, stamp: -1});
        }
        found.frame = this.#frame;
        const mesh = found.mesh;
        mesh.receiveShadow = role === 1;
        // Rewrite the matrices only when a member changed or moved since they were last written.
        let stamp = count;
        for (let k = 0; k < count; k++) { const member = at(k); stamp = (Math.imul(stamp, 31) + member.id + Math.imul(member.worldVersion, 131)) | 0; }
        if (stamp !== found.stamp || mesh.count !== count) {
            const matrices = mesh.instanceMatrices;
            for (let k = 0; k < count; k++) matrices.set(at(k).matrixWorld, k * 16);
            mesh.count = count;
            mesh.instanceVersion++;
            found.stamp = stamp;
        }
        return found;
    }
    /** Forget stand-ins that have not been used for a while. */
    private retire(): void {
        for (const [key, slots] of this.#batches) {
            for (let i = slots.length - 1; i >= 0; i--) if (this.#frame - slots[i]!.frame > 256) slots.splice(i, 1);
            if (slots.length === 0) this.#batches.delete(key);
        }
        for (const [key, list] of this.#casterGroups) if (list.length === 0) this.#casterGroups.delete(key);
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
        // Meshes that build their geometry on demand (batches, camera-facing lines) do it here.
        mesh.beforeRender?.(camera);
        const geometry = mesh.geometry;
        if (geometry.isDisposed || geometry.drawCount === 0) return;
        this.stats.visited++;
        if (mesh.skeleton) mesh.skeleton.update(this.#frame);
        if (mesh instanceof ScreenLayer3D && mesh.autoUpdate) mesh.refreshSource();
        if (mesh.castShadow) this.#casters.push(mesh);
        if ((mesh.layers & camera.layerMask) === 0) return;
        const sphere = worldRenderSphere3D(mesh);
        if (mesh.frustumCulled && sphere && sphere[3]! >= 0 && !frustumIntersectsSphere(camera.frustum, sphere)) { this.stats.culled++; return; }
        // Use the batch origin when no posed bound is available.
        const sortOrigin = sphere ?? mesh.matrixWorld, offset = sphere ? 0 : 12;
        const view = camera.viewMatrix;
        const depth = -(view[2]! * sortOrigin[offset]! + view[6]! * sortOrigin[offset + 1]! + view[10]! * sortOrigin[offset + 2]! + view[14]!);
        const groups = geometry.groups;
        if (Array.isArray(mesh.material) && groups.length > 0) {
            for (let i = 0; i < groups.length; i++) {
                const group = groups[i]!;
                this.push(mesh, geometry, mesh.materialAt(group.materialIndex), group.start, group.count, depth);
            }
        } else this.push(mesh, geometry, mesh.materialAt(0), 0, geometry.drawCount, depth);
    }
    #override: Material3D | undefined;
    private push(mesh: Mesh3D, geometry: Geometry3D, own: Material3D, start: number, count: number, depth: number): void {
        // An invisible material still hides its mesh when the scene overrides materials.
        if (!own.visible) return;
        const material = this.#override ?? own;
        if (!material.visible || material.isDisposed || count <= 0) return;
        // A transmitting surface shows what was drawn before it, so it waits for the opaque pass like blended ones.
        const opaque = !(material.isTransparent || material.transmission > 0), order = mesh.renderOrder;
        // Layers are a 32-bit mask; the two flags ride above it.
        const group = (mesh.layers >>> 0) + (mesh.receiveShadow ? 4294967296 : 0) + (opaque && mesh.canInstance ? 8589934592 : 0);
        let item = this.#pool[this.#used];
        if (!item) { this.#pool[this.#used] = item = {mesh, geometry, material, start, count, depth, opaque, order, group}; this.#same = false; }
        else {
            if (item.mesh !== mesh || item.material !== material || item.geometry !== geometry || item.start !== start || item.count !== count || item.opaque !== opaque || item.order !== order || item.group !== group) this.#same = false;
            item.mesh = mesh; item.geometry = geometry; item.material = material; item.start = start; item.count = count; item.depth = depth; item.opaque = opaque; item.order = order; item.group = group;
        }
        this.#used++;
        if (!opaque) this.transparent.push(item);
    }
    /** Drop pooled references so retired scene content can be collected. */
    clear(): void {
        this.#pool = [];
        this.#used = 0;
        this.#lastUsed = -1;
        this.#sorted.length = this.#casters.length = this.#batchItems.length = 0;
        this.#batches.clear(); this.#casterGroups.clear();
        this.opaque.length = this.transparent.length = this.shadowCasters.length = 0;
        this.directionalLights.length = this.pointLights.length = this.spotLights.length = 0;
    }
}
