import { EgretError } from "@egret/runtime";
import { constructEngine } from "./Engine.js";
import type { Engine, EngineOptions } from "./Engine.js";
import { reserveSurface } from "./surfaceOwnership.js";

/** Reserve the surface before startup; failed startup uses the normal close path. */
export async function createEngine(options: EngineOptions): Promise<Engine> {
  const timeoutMs = options.shutdownTimeoutMs ?? 1000;
  if (!Number.isFinite(timeoutMs) || !Number.isInteger(timeoutMs) || timeoutMs <= 0) throw new EgretError("INVALID_TIMEOUT");
  const releaseSurface = reserveSurface(options.host.surface);
  const engine = constructEngine(options, timeoutMs, releaseSurface);
  try {
    await options.host.start?.();
    return engine;
  } catch (cause) {
    const cleanupErrors: unknown[] = [];
    try { await engine.dispose(); }
    catch (cleanupError) {
      if (cleanupError instanceof EgretError && cleanupError.code === "ENGINE_CLOSE_FAILED") {
        cleanupErrors.push(cleanupError.cause, ...cleanupError.cleanupErrors);
      } else cleanupErrors.push(cleanupError);
    }
    throw new EgretError("ENGINE_START_FAILED", { cause, cleanupErrors });
  }
}
