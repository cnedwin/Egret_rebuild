import { EgretError } from "@egret/runtime";
import { constructEngine } from "./Engine.js";
import type { Engine, EngineOptions } from "./Engine.js";
import { reserveSurface } from "./surfaceOwnership.js";

/** Reserve the surface before startup; failed startup uses the normal close path. */
export async function createEngine(options: EngineOptions): Promise<Engine> {
  const host=options.host;
  let renderer:((frame:import("@egret/contracts").RenderFrame2D)=>unknown)|undefined;
  try { const port=(host as unknown as {renderFrame?:unknown}).renderFrame; if(port!==undefined && typeof port!=="function") throw new EgretError("INVALID_RENDERER"); renderer=port as typeof renderer; } catch(cause) { throw new EgretError("INVALID_RENDERER",{cause}); }
  const diagnostic=options.onDiagnostic; const stableOptions:EngineOptions={host,...(diagnostic===undefined?{}:{onDiagnostic:diagnostic})};
  const timeoutMs = options.shutdownTimeoutMs ?? 1000;
  if (!Number.isFinite(timeoutMs) || !Number.isInteger(timeoutMs) || timeoutMs <= 0) throw new EgretError("INVALID_TIMEOUT");
  const releaseSurface = reserveSurface(host.surface);
  const engine = constructEngine(stableOptions, timeoutMs, releaseSurface, renderer);
  try {
    await host.start?.();
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


