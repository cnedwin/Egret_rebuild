// SPDX-License-Identifier: Apache-2.0
// Debug and authoring helpers: line geometries for grids, axes and bounds,
// plus distance-based level-of-detail switching.
import {World3DError, requireCount3D, requirePositive3D} from './core3D.js';
import {Attribute3D, Geometry3D} from './Geometry3D.js';
import {Material3D} from './Material3D.js';
import type {ColorInput3D} from './Material3D.js';
import {Mesh3D} from './Mesh3D.js';
import {createPlaneGeometry3D} from './primitives3D.js';
import {Texture3D} from './Texture3D.js';
import type {TextureSource3D} from './Texture3D.js';
import {Object3D} from './Object3D.js';

function lineGeometry(positions: number[], colors?: number[]): Geometry3D {
    const geometry = new Geometry3D();
    geometry.topology = 'lines';
    geometry.setAttribute('position', new Attribute3D(new Float32Array(positions), 3));
    if (colors) geometry.setAttribute('color', new Attribute3D(new Float32Array(colors), 3));
    return geometry;
}

/** Square grid of lines on the XZ plane, centered at the origin. */
export function createGridGeometry3D(size = 10, divisions = 10): Geometry3D {
    requirePositive3D(size, 'size');
    const count = requireCount3D(divisions, 'divisions', 4096);
    if (count < 1) throw new World3DError('WORLD3D_INPUT_INVALID', 'divisions');
    const half = size / 2, step = size / count, positions: number[] = [];
    for (let i = 0; i <= count; i++) {
        const k = -half + i * step;
        positions.push(-half, 0, k, half, 0, k, k, 0, -half, k, 0, half);
    }
    return lineGeometry(positions);
}
/** Three colored segments from the origin along +X (red), +Y (green) and +Z (blue). */
export function createAxesGeometry3D(length = 1): Geometry3D {
    requirePositive3D(length, 'length');
    return lineGeometry([0, 0, 0, length, 0, 0, 0, 0, 0, 0, length, 0, 0, 0, 0, 0, 0, length],
        [1, 0.05, 0.05, 1, 0.05, 0.05, 0.05, 1, 0.05, 0.05, 1, 0.05, 0.1, 0.25, 1, 0.1, 0.25, 1]);
}
/** The twelve edges of an axis-aligned box given as [minX, minY, minZ, maxX, maxY, maxZ]. */
export function createBoxEdgesGeometry3D(box: ArrayLike<number>): Geometry3D {
    if (!box || box.length !== 6) throw new World3DError('WORLD3D_INPUT_INVALID', 'box');
    const x0 = box[0]!, y0 = box[1]!, z0 = box[2]!, x1 = box[3]!, y1 = box[4]!, z1 = box[5]!;
    const corners = [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]];
    const edges = [0, 1, 1, 2, 2, 3, 3, 0, 4, 5, 5, 6, 6, 7, 7, 4, 0, 4, 1, 5, 2, 6, 3, 7], positions: number[] = [];
    for (const index of edges) positions.push(...corners[index]!);
    return lineGeometry(positions);
}
/** Unlit line or point material; pair it with a 'lines', 'line-strip' or 'points' geometry. */
export function createLineMaterial3D(color: ColorInput3D = 0xffffff, vertexColors = false): Material3D {
    const material = new Material3D('unlit', {color, vertexColors});
    material.fog = false;
    return material;
}
/** Ready-made grid node for editors and debug views. */
export function createGridHelper3D(size = 10, divisions = 10, color: ColorInput3D = 0x808080): Mesh3D {
    const mesh = new Mesh3D(createGridGeometry3D(size, divisions), createLineMaterial3D(color));
    mesh.castShadow = false;
    mesh.name = 'grid-helper';
    return mesh;
}
/** Ready-made axes node colored X red, Y green, Z blue. */
export function createAxesHelper3D(length = 1): Mesh3D {
    const mesh = new Mesh3D(createAxesGeometry3D(length), createLineMaterial3D(0xffffff, true));
    mesh.castShadow = false;
    mesh.name = 'axes-helper';
    return mesh;
}

/**
 * Shows exactly one child depending on the distance to the camera. Levels are
 * kept sorted by distance; the render list calls select() once per frame.
 */
export class Lod3D extends Object3D {
    readonly #levels: {object: Object3D; distance: number}[] = [];
    /** Index of the level shown by the last select(), or -1 before the first. */
    currentLevel = -1;
    constructor() {
        super('object');
    }
    get levels(): readonly {readonly object: Object3D; readonly distance: number}[] { return this.#levels; }
    /** Show `object` once the camera is at least `distance` world units away. */
    addLevel(object: Object3D, distance = 0): this {
        if (!(distance >= 0) || !Number.isFinite(distance)) throw new World3DError('WORLD3D_INPUT_INVALID', 'distance');
        requireCount3D(this.#levels.length + 1, 'levels', 32);
        this.addChild(object);
        this.#levels.push({object, distance});
        this.#levels.sort((a, b) => a.distance - b.distance);
        return this;
    }
    /** Pick the level for a camera at world position (x, y, z). */
    select(x: number, y: number, z: number): void {
        const levels = this.#levels;
        if (levels.length === 0) return;
        const m = this.matrixWorld, distance = Math.hypot(x - m[12]!, y - m[13]!, z - m[14]!);
        let chosen = 0;
        for (let i = 1; i < levels.length; i++) if (distance >= levels[i]!.distance) chosen = i;
        for (let i = 0; i < levels.length; i++) levels[i]!.object.visible = i === chosen;
        this.currentLevel = chosen;
    }
    override clone(): this {
        const copy = new Lod3D() as this;
        copy.copyFrom(this);
        for (const level of this.#levels) copy.addLevel(level.object.clone(true), level.distance);
        return copy;
    }
}

export interface ScreenLayerOptions3D {
    /** 'overlay' draws after the scene with blending; 'underlay' draws first and is covered by it. */
    readonly order?: 'overlay' | 'underlay';
    /** Multiplies the layer's alpha. */
    readonly opacity?: number;
    /** Re-upload the source every frame. Disable for layers that change rarely and call refreshSource() instead. */
    readonly autoUpdate?: boolean;
    /** Source rows start at the top, as canvases and images do. Defaults to true. */
    readonly topRowFirst?: boolean;
}
let layerGeometry: Geometry3D | undefined;
/**
 * Full-screen image drawn in the same pass as the 3D scene, typically the
 * canvas of a 2D stage. An overlay is composited above the scene and an
 * underlay beneath it, so interface, scene and backdrop share one surface.
 */
export class ScreenLayer3D extends Mesh3D {
    readonly texture: Texture3D;
    autoUpdate: boolean;
    constructor(source: TextureSource3D, options: ScreenLayerOptions3D = {}) {
        const overlay = (options.order ?? 'overlay') === 'overlay';
        const texture = new Texture3D(source, {mipmaps: false, wrapS: 'clamp', wrapT: 'clamp', flipY: options.topRowFirst ?? true});
        const material = new Material3D('unlit', {map: texture, alphaMode: overlay ? 'blend' : 'opaque', depthTest: false, depthWrite: false, opacity: options.opacity ?? 1});
        material.screenSpace = true;
        material.fog = false;
        material.toneMapped = false;
        super(layerGeometry ??= createPlaneGeometry3D({width: 2, height: 2}), material);
        this.texture = texture;
        this.autoUpdate = options.autoUpdate ?? true;
        this.name = overlay ? 'screen-overlay' : 'screen-underlay';
        this.castShadow = false;
        this.receiveShadow = false;
        this.frustumCulled = false;
        // Far outside the range applications use, so layers bracket the whole scene.
        this.renderOrder = overlay ? 1e6 : -1e6;
    }
    /** Schedule a new upload of the source pixels. */
    refreshSource(): void {
        if (!this.texture.isDisposed) this.texture.touch();
    }
    /** Release the layer's texture and material. The shared quad geometry stays alive. */
    dispose(): void {
        (this.material as Material3D).dispose();
        this.texture.dispose();
    }
    override clone(): this {
        throw new World3DError('WORLD3D_INPUT_INVALID', 'a screen layer cannot be cloned; create a new one from the same source');
    }
}
export function createScreenLayer3D(source: TextureSource3D, options: ScreenLayerOptions3D = {}): ScreenLayer3D {
    return new ScreenLayer3D(source, options);
}
