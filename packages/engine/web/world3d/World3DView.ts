// SPDX-License-Identifier: Apache-2.0
// Connects a world3d scene to an Egret Engine: the Engine clock advances
// animation and draws the frame, and the owning Scope retires the view. The
// 3D canvas is separate from the 2D stage surface, so a 2D host with a
// transparent background can be stacked above it for UI.
import type {Disposable} from '@egret/contracts';
import type {Scope} from '@egret/runtime';
import type {AnimationMixer3D} from '../../rendering/world3d/Animation3D.js';
import type {Camera3D} from '../../rendering/world3d/Camera3D.js';
import {World3DError} from '../../rendering/world3d/core3D.js';
import type {Scene3D} from '../../rendering/world3d/Object3D.js';
import {ParticleEmitter3D} from '../../rendering/world3d/Particles3D.js';
import type {OrbitControls3D} from './OrbitControls3D.js';
import type {Renderer3D} from './frame3D.js';

/** The part of an Engine this view needs: its explicit game clock. */
export interface World3DClockSource {
    readonly clock: {
        onTick(scope: Scope, handler: (tick: {readonly deltaSeconds: number; readonly elapsedSeconds: number}) => undefined): Disposable;
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

export class World3DView implements Disposable {
    readonly renderer: Renderer3D;
    scene: Scene3D;
    camera: Camera3D;
    readonly mixers: AnimationMixer3D[];
    controls: OrbitControls3D | undefined;
    /** Skip animation and drawing while true; the clock subscription stays active. */
    paused = false;
    readonly #subscription: Disposable;
    readonly #options: World3DViewOptions;
    #disposed = false;

    constructor(engine: World3DClockSource, scope: Scope, options: World3DViewOptions) {
        if (!engine || typeof engine.clock?.onTick !== 'function') throw new World3DError('WORLD3D_INPUT_INVALID', 'engine');
        if (!options?.renderer || !options.scene || !options.camera) throw new World3DError('WORLD3D_INPUT_INVALID', 'view options');
        this.#options = options;
        this.renderer = options.renderer;
        this.scene = options.scene;
        this.camera = options.camera;
        this.mixers = [...(options.mixers ?? [])];
        this.controls = options.controls;
        // The Scope owns this view: closing the Scope ends ticking before the Engine closes.
        this.#subscription = engine.clock.onTick(scope, tick => { this.tick(tick.deltaSeconds, tick.elapsedSeconds); return undefined; });
        scope.use(this);
    }
    get isDisposed(): boolean { return this.#disposed; }
    /** Advance and draw one frame. Normally driven by the Engine clock. */
    tick(deltaSeconds: number, elapsedSeconds: number): void {
        if (this.#disposed || this.paused) return;
        const options = this.#options;
        try {
            if (options.autoResize ?? true) {
                const ratio = Math.min(typeof devicePixelRatio === 'number' ? devicePixelRatio : 1, options.maxPixelRatio ?? 2);
                this.renderer.resizeToDisplaySize(ratio);
                const canvas = this.renderer.canvas;
                if (canvas.height > 0) this.camera.aspect = canvas.width / canvas.height;
            }
            options.onUpdate?.(deltaSeconds, elapsedSeconds);
            for (const mixer of this.mixers) mixer.update(deltaSeconds);
            this.controls?.update(deltaSeconds);
            if (options.updateParticles ?? true) {
                this.scene.traverse(object => { if (object instanceof ParticleEmitter3D && object.visible) object.update(deltaSeconds); });
            }
            this.renderer.render(this.scene, this.camera);
        } catch (cause) {
            if (!options.onError) throw cause;
            options.onError(cause);
        }
    }
    /** Stop ticking. The renderer, scene and controls stay owned by their creator. */
    dispose(): void {
        if (this.#disposed) return;
        this.#disposed = true;
        this.#subscription.dispose();
    }
}

export function createWorld3DView(engine: World3DClockSource, scope: Scope, options: World3DViewOptions): World3DView {
    return new World3DView(engine, scope, options);
}
