import { EgretError } from '@egret/runtime';
import { constructEngine } from './Engine.js';
import { reserveSurface } from './surfaceOwnership.js';
import { markMouseInputEngineStarted } from './internal/mouseInputFactoryState.js';
/** Admission supplies stable internal options; both factories share one owner. */
export async function startEngine(options, timeoutMs, ports, clockOptions) {
    const host = options.host;
    const surface = host.surface;
    const releaseSurface = reserveSurface(surface);
    const engine = constructEngine(options, timeoutMs, surface, releaseSurface, ports, clockOptions);
    try {
        await host.start?.();
        markMouseInputEngineStarted(engine);
        return engine;
    }
    catch (cause) {
        const cleanupErrors = [];
        try {
            await engine.dispose();
        }
        catch (cleanupError) {
            if (cleanupError instanceof EgretError && cleanupError.code === 'ENGINE_CLOSE_FAILED') {
                cleanupErrors.push(cleanupError.cause, ...cleanupError.cleanupErrors);
            }
            else
                cleanupErrors.push(cleanupError);
        }
        throw new EgretError('ENGINE_START_FAILED', { cause, cleanupErrors });
    }
}
//# sourceMappingURL=startEngine.js.map