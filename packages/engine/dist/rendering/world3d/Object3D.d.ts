export type Object3DKind = 'object' | 'scene' | 'mesh' | 'camera' | 'light' | 'bone';
export declare const WORLD3D_LIMITS: Readonly<{
    readonly maxDepth: 256;
    readonly maxChildren: 65536;
    readonly maxNameLength: 256;
}>;
export declare class Object3D {
    #private;
    readonly id: number;
    readonly kind: Object3DKind;
    name: string;
    /** Local translation, unit rotation quaternion and scale. Call markTransformDirty() after writing directly. */
    readonly position: Float32Array<ArrayBuffer>;
    readonly quaternion: Float32Array<ArrayBuffer>;
    readonly scale: Float32Array<ArrayBuffer>;
    /** Local and world matrices; valid after updateWorldMatrix(). */
    readonly matrix: Float32Array;
    readonly matrixWorld: Float32Array;
    visible: boolean;
    /** Bit mask matched against the camera mask; an object renders when the masks intersect. */
    layers: number;
    /** Higher values draw later within the opaque or transparent pass. */
    renderOrder: number;
    castShadow: boolean;
    receiveShadow: boolean;
    frustumCulled: boolean;
    /** Free-form application data; never read by the engine. */
    userData: Record<string, unknown>;
    constructor(kind?: Object3DKind);
    get parent(): Object3D | undefined;
    get children(): readonly Object3D[];
    get numChildren(): number;
    /** Increases every time matrixWorld is recomputed; dependants compare it to skip work. */
    get worldVersion(): number;
    addChild<T extends Object3D>(child: T): T;
    addChildAt<T extends Object3D>(child: T, index: number): T;
    removeChild<T extends Object3D>(child: T): T;
    removeFromParent(): this;
    removeChildren(): void;
    getChildAt(index: number): Object3D | undefined;
    /** Depth-first search including this node. */
    getObjectByName(name: string): Object3D | undefined;
    /** Pre-order traversal. Returning false from the callback skips that subtree. */
    traverse(callback: (object: Object3D) => boolean | void): void;
    setPosition(x: number, y: number, z: number): this;
    setScale(x: number, y?: number, z?: number): this;
    setQuaternion(x: number, y: number, z: number, w: number): this;
    /** Intrinsic XYZ Euler angles in radians. */
    setRotation(x: number, y: number, z: number): this;
    /** Post-multiply a rotation about a local axis. */
    rotateOnAxis(axis: ArrayLike<number>, radians: number): this;
    /** Orient the negative Z axis (cameras, lights) toward a world-space point. */
    lookAt(x: number, y: number, z: number, up?: ArrayLike<number>): this;
    /** Replace the local transform from an affine matrix. */
    setMatrix(matrix: ArrayLike<number>): this;
    /** Required after writing position, quaternion or scale arrays directly. */
    markTransformDirty(): void;
    /**
     * Refresh matrixWorld for this node, resolving dirty ancestors first.
     * Returns true when the world matrix changed.
     */
    updateWorldMatrix(): boolean;
    /** Refresh this subtree top-down. Call once per frame on the scene root. */
    updateWorldMatrices(parentChanged?: boolean): void;
    private refresh;
    /** Subclass hook, invoked after matrixWorld was recomputed. */
    protected onWorldMatrixChanged(): void;
    /** World-space position; refreshes ancestors as needed. */
    getWorldPosition(out?: Float32Array | number[]): Float32Array | number[];
    localToWorld(out: Float32Array | number[], point: ArrayLike<number>): Float32Array | number[];
    worldToLocal(out: Float32Array | number[], point: ArrayLike<number>): Float32Array | number[];
    /**
     * Copy this node and its subtree. Geometries, materials and skeleton data
     * are shared by reference; subclasses override copyFrom for their state.
     */
    clone(recursive?: boolean): this;
    protected copyFrom(source: this): void;
}
export type Fog3D = {
    readonly kind: 'linear';
    readonly color: readonly [number, number, number];
    readonly near: number;
    readonly far: number;
} | {
    readonly kind: 'exponential';
    readonly color: readonly [number, number, number];
    readonly density: number;
};
/** Root of a renderable graph; owns environment-wide settings. Colors are linear RGB. */
export declare class Scene3D extends Object3D {
    /** Clear color, or a cube texture drawn as a skybox. `undefined` keeps the canvas transparent. */
    background: readonly [number, number, number] | import('./Texture3D.js').CubeTexture3D | undefined;
    backgroundIntensity: number;
    /** Cube texture used for image-based lighting on standard materials. */
    environment: import('./Texture3D.js').CubeTexture3D | undefined;
    environmentIntensity: number;
    fog: Fog3D | undefined;
    /** Draw every mesh with this material instead of its own, as for masks and depth-only views. */
    overrideMaterial: import('./Material3D.js').Material3D | undefined;
    /**
     * Up to four world-space planes as [nx, ny, nz, d]. Fragments on the
     * negative side (n . p + d < 0) are not drawn. Shadows are not clipped.
     */
    clippingPlanes: readonly (readonly [number, number, number, number])[];
    constructor();
}
//# sourceMappingURL=Object3D.d.ts.map