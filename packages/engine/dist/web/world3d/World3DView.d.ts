import type { Disposable } from '@egret/contracts';
import type { Scope } from '@egret/runtime';
import type { AnimationMixer3D } from '../../rendering/world3d/Animation3D.js';
import type { Camera3D } from '../../rendering/world3d/Camera3D.js';
import type { Scene3D } from '../../rendering/world3d/Object3D.js';
import type { OrbitControls3D } from './OrbitControls3D.js';
import type { Renderer3D } from './frame3D.js';
/** The part of an Engine this view needs: its explicit game clock. */
export interface World3DClockSource {
    readonly clock: {
        onTick(scope: Scope, handler: (tick: {
            readonly deltaSeconds: number;
            readonly elapsedSeconds: number;
        }) => undefined): Disposable;
    };
}
export interface World3DViewOptions {
    readonly renderer: Renderer3D;
    readonly scene: Scene3D;
    readonly camera: Camera3D;
    readonly mixers?: readonly AnimationMixer3D[];
    readonly controls?: OrbitControls3D;
    /** Called every tick before animation and rendering. */
    readonly onUpdate?: (deltaSeconds: number, elapsedSeconds: number) => void;
    /** Keep the drawing buffer and camera aspect matched to the canvas CSS size. Defaults to true. */
    readonly autoResize?: boolean;
    /** Upper bound for the device pixel ratio used by autoResize. Defaults to 2. */
    readonly maxPixelRatio?: number;
    /** Step particle emitters found in the scene. Defaults to true. */
    readonly updateParticles?: boolean;
    /** Receives failures thrown while updating or drawing; the view keeps ticking. */
    readonly onError?: (cause: unknown) => void;
}
export declare class World3DView implements Disposable {
    #private;
    readonly renderer: Renderer3D;
    scene: Scene3D;
    camera: Camera3D;
    readonly mixers: AnimationMixer3D[];
    controls: OrbitControls3D | undefined;
    /** Skip animation and drawing while true; the clock subscription stays active. */
    paused: boolean;
    constructor(engine: World3DClockSource, scope: Scope, options: World3DViewOptions);
    get isDisposed(): boolean;
    /** Advance and draw one frame. Normally driven by the Engine clock. */
    tick(deltaSeconds: number, elapsedSeconds: number): void;
    /** Stop ticking. The renderer, scene and controls stay owned by their creator. */
    dispose(): void;
}
export declare function createWorld3DView(engine: World3DClockSource, scope: Scope, options: World3DViewOptions): World3DView;
//# sourceMappingURL=World3DView.d.ts.map