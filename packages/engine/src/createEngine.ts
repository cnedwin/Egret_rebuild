import { EgretError } from "@egret/runtime";
import type { Engine, EngineOptions } from "./Engine.js";
import { startEngine } from './startEngine.js';
import { admitGameClockOptions } from './gameClock.js';

/** Reserve the surface before startup; failed startup uses the normal close path. */
export async function createEngine(options: EngineOptions): Promise<Engine> {
  const host=options.host;
  let renderer:((frame:import("@egret/contracts").RenderFrame2D)=>unknown)|undefined;
  try { const port=(host as unknown as {renderFrame?:unknown}).renderFrame; if(port!==undefined && typeof port!=="function") throw new EgretError("INVALID_RENDERER"); renderer=port as typeof renderer; } catch(cause) { throw new EgretError("INVALID_RENDERER",{cause}); }
  const diagnostic=options.onDiagnostic; const stableOptions:EngineOptions={host,...(diagnostic===undefined?{}:{onDiagnostic:diagnostic})};
  const timeoutMs = options.shutdownTimeoutMs ?? 1000;
  if (!Number.isFinite(timeoutMs) || !Number.isInteger(timeoutMs) || timeoutMs <= 0) throw new EgretError("INVALID_TIMEOUT");
  let clockValue: unknown;
  try { clockValue = options.clock; }
  catch (cause) { throw new EgretError('CLOCK_OPTIONS_INVALID', { cause }); }
  const clockOptions = admitGameClockOptions(clockValue);
  return startEngine(stableOptions, timeoutMs, { legacy: renderer, textured: undefined, profile: undefined }, clockOptions);
}


