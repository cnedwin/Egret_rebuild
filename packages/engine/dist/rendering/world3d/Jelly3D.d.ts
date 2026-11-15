import { type CustomShader3D } from './Material3D.js';
import { Mesh3D } from './Mesh3D.js';
import type { Object3D } from './Object3D.js';
import type { RigidBody3D } from './Physics3D.js';
export interface JellyOptions3D {
    /** How many times per second the shape swings back and forth after a knock. Defaults to 3.5. */
    readonly stiffness?: number;
    /** 0 swings forever, 1 settles without overshoot. Defaults to 0.22. */
    readonly damping?: number;
    /** Most the shape may flatten or lengthen, as a share of its size. Defaults to 0.4. */
    readonly squash?: number;
    /** How strongly a change of speed deforms the shape: flattening per metre per second. Defaults to 0.05. */
    readonly sensitivity?: number;
    /** How far the top trails behind a sudden move, in seconds of the speed change. Defaults to 0.035; 0 turns it off. */
    readonly wobble?: number;
    /** Height of the object in world units, measured along `up` from its base. Defaults to twice the bounding radius. */
    readonly height?: number;
    /** Offset from the target's origin to the point the shape is squashed about, as a share of the height below the origin. Defaults to 0.5: the base. */
    readonly base?: number;
    /** Direction that counts as up. Defaults to +Y. */
    readonly up?: readonly [number, number, number];
    /** A slow breathing motion while idle: its size as a share of the height. Defaults to 0. */
    readonly idle?: number;
    /** Breaths per second of the idle motion. Defaults to 0.8. */
    readonly idleRate?: number;
    /** Body whose speed drives the jelly. Without one, the speed is taken from how the target moves. */
    readonly body?: RigidBody3D;
}
/** The vertex hook a jelly drives. Its parameters start as "no change". */
export declare function createJellyShader3D(): CustomShader3D;
/**
 * Makes everything drawn under `target` behave like jelly. Each mesh gets its
 * own copy of its material carrying the jelly's vertex hook, so other objects
 * that shared the material are not affected; a material that already has a
 * shader hook is left as it is. Call update() once per frame.
 */
export declare class Jelly3D {
    #private;
    readonly target: Object3D;
    readonly shader: CustomShader3D;
    stiffness: number;
    damping: number;
    squash: number;
    sensitivity: number;
    wobble: number;
    height: number;
    base: number;
    idle: number;
    idleRate: number;
    body: RigidBody3D | undefined;
    /** Meshes whose material now carries the hook. */
    readonly meshes: Mesh3D[];
    constructor(target: Object3D, options?: JellyOptions3D);
    /** How flat the shape is along its squash line right now: positive when pressed, negative when stretched. */
    get amount(): number;
    /** The line the shape is squashed along, as a unit direction. */
    get axis(): ArrayLike<number>;
    /** How far the top currently trails, in world units. */
    get lag(): ArrayLike<number>;
    /**
     * Knock the jelly: `direction` is the way the blow travels, `strength` the
     * change of speed it stands for in metres per second.
     */
    impact(direction: ArrayLike<number>, strength: number): void;
    private kick;
    /** Advance the springs and hand the new shape to the shader. */
    update(deltaSeconds: number): void;
    /** Bring the shape back to rest at once. */
    reset(): void;
    private write;
    /** Where the shader puts a world-space point, for tests and for attaching things to the surface. */
    deform(out: Float32Array | Float64Array | number[], x: number, y: number, z: number): typeof out;
}
export declare function createJelly3D(target: Object3D, options?: JellyOptions3D): Jelly3D;
//# sourceMappingURL=Jelly3D.d.ts.map