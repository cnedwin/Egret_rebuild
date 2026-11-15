import { World3DError } from '../../rendering/world3d/core3D.js';
import { ParticleEmitter3D } from '../../rendering/world3d/Particles3D.js';
export class World3DView {
    renderer;
    scene;
    camera;
    mixers;
    controls;
    /** Skip animation and drawing while true; the clock subscription stays active. */
    paused = false;
    #subscription;
    #options;
    #disposed = false;
    constructor(engine, scope, options) {
        if (!engine || typeof engine.clock?.onTick !== 'function')
            throw new World3DError('WORLD3D_INPUT_INVALID', 'engine');
        if (!options?.renderer || !options.scene || !options.camera)
            throw new World3DError('WORLD3D_INPUT_INVALID', 'view options');
        this.#options = options;
        this.renderer = options.renderer;
        this.scene = options.scene;
        this.camera = options.camera;
        this.mixers = [...(options.mixers ?? [])];
        this.controls = options.controls;
        // The Scope owns this view: closing the Scope ends ticking before the Engine closes.
        this.#subscription = engine.clock.onTick(scope, tick => {
            this.tick(tick.deltaSeconds, tick.elapsedSeconds);
            return undefined;
        });
        scope.use(this);
    }
    get isDisposed() {
        return this.#disposed;
    }
    /** Advance and draw one frame. Normally driven by the Engine clock. */
    tick(deltaSeconds, elapsedSeconds) {
        if (this.#disposed || this.paused)
            return;
        const options = this.#options;
        try {
            if (options.autoResize ?? true) {
                const ratio = Math.min(typeof devicePixelRatio === 'number' ? devicePixelRatio : 1, options.maxPixelRatio ?? 2);
                this.renderer.resizeToDisplaySize(ratio);
                const canvas = this.renderer.canvas;
                if (canvas.height > 0)
                    this.camera.aspect = canvas.width / canvas.height;
            }
            options.onUpdate?.(deltaSeconds, elapsedSeconds);
            for (const mixer of this.mixers)
                mixer.update(deltaSeconds);
            this.controls?.update(deltaSeconds);
            if (options.updateParticles ?? true) {
                this.scene.traverse(object => {
                    if (object instanceof ParticleEmitter3D && object.visible)
                        object.update(deltaSeconds);
                });
            }
            this.renderer.render(this.scene, this.camera);
        }
        catch (cause) {
            if (!options.onError)
                throw cause;
            options.onError(cause);
        }
    }
    /** Stop ticking. The renderer, scene and controls stay owned by their creator. */
    dispose() {
        if (this.#disposed)
            return;
        this.#disposed = true;
        this.#subscription.dispose();
    }
}
export function createWorld3DView(engine, scope, options) {
    return new World3DView(engine, scope, options);
}
//# sourceMappingURL=World3DView.js.map