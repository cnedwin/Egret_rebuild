import { TEXTURED_FRAME_PROFILE_2D } from '@egret/contracts';
import type { TexturedFrameProfile2D } from '@egret/contracts';
import { EgretError } from '@egret/runtime';
import type { CapturedEngineFramePorts, Engine, EngineOptions } from './Engine.js';
import { startEngine } from './startEngine.js';
import { admitGameClockOptions } from './gameClock.js';

/** Exact negotiation completes all successful port reads before semantics. */
export async function createEngineForProfile(options: EngineOptions, profile: TexturedFrameProfile2D): Promise<Engine> {
  // Unsupported profiles never inspect options, allocate an Engine or reserve a surface.
  if (profile !== TEXTURED_FRAME_PROFILE_2D) throw new EgretError('ENGINE_RENDER_PROFILE_UNSUPPORTED');
  const host = options.host;
  let advertisement: unknown, textured: unknown, legacy: unknown;
  try {
    const source = host as unknown as { readonly texturedFrameProfile?: unknown; readonly renderTexturedFrame?: unknown; readonly renderFrame?: unknown };
    advertisement = source.texturedFrameProfile;
    textured = source.renderTexturedFrame;
    legacy = source.renderFrame;
  } catch (cause) {
    throw new EgretError('INVALID_RENDERER', { cause });
  }
  if (advertisement !== TEXTURED_FRAME_PROFILE_2D) throw new EgretError('ENGINE_RENDER_PROFILE_UNSUPPORTED');
  if (typeof textured !== 'function') throw new EgretError('INVALID_RENDERER');
  if (legacy !== undefined && typeof legacy !== 'function') throw new EgretError('INVALID_RENDERER');
  const diagnostic = options.onDiagnostic;
  const stableOptions: EngineOptions = { host, ...(diagnostic === undefined ? {} : { onDiagnostic: diagnostic }) };
  const timeoutMs = options.shutdownTimeoutMs ?? 1000;
  if (!Number.isFinite(timeoutMs) || !Number.isInteger(timeoutMs) || timeoutMs <= 0) throw new EgretError('INVALID_TIMEOUT');
  let clockValue: unknown;
  try { clockValue = options.clock; }
  catch (cause) { throw new EgretError('CLOCK_OPTIONS_INVALID', { cause }); }
  const clockOptions = admitGameClockOptions(clockValue);
  const ports: CapturedEngineFramePorts = {
    legacy: legacy as CapturedEngineFramePorts['legacy'],
    textured: textured as CapturedEngineFramePorts['textured'],
    profile,
  };
  return startEngine(stableOptions, timeoutMs, ports, clockOptions);
}
