import { EgretError } from '@egret/runtime';
import { constructEngine } from './Engine.js';
import type { CapturedEngineFramePorts, Engine, EngineOptions } from './Engine.js';
import { reserveSurface } from './surfaceOwnership.js';
import type { AdmittedGameClockOptions } from './gameClock.js';
import { markMouseInputEngineStarted } from './internal/mouseInputFactoryState.js';

/** Admission supplies stable internal options; both factories share one owner. */
export async function startEngine(options: EngineOptions, timeoutMs: number, ports: CapturedEngineFramePorts, clockOptions: AdmittedGameClockOptions): Promise<Engine> {
  const host = options.host;
  const surface = host.surface;
  const releaseSurface = reserveSurface(surface);
  const engine = constructEngine(options, timeoutMs, surface, releaseSurface, ports, clockOptions);
  try {
    await host.start?.();
    markMouseInputEngineStarted(engine);
    return engine;
  } catch (cause) {
    const cleanupErrors: unknown[] = [];
    try { await engine.dispose(); }
    catch (cleanupError) {
      if (cleanupError instanceof EgretError && cleanupError.code === 'ENGINE_CLOSE_FAILED') {
        cleanupErrors.push(cleanupError.cause, ...cleanupError.cleanupErrors);
      } else cleanupErrors.push(cleanupError);
    }
    throw new EgretError('ENGINE_START_FAILED', { cause, cleanupErrors });
  }
}
