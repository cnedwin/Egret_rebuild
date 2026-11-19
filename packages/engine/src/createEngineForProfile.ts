import { SHARED_FRAME_PROFILE_2D } from '@egret/contracts';
import type { SharedFrameProfile2D } from '@egret/contracts';
import { EgretError } from '@egret/runtime';
import type { CapturedEngineFramePorts, Engine, EngineOptions } from './Engine.js';
import { startEngine } from './startEngine.js';
import { admitGameClockOptions } from './gameClock.js';

/** Exact negotiation completes all successful port reads before semantics. */
export async function createEngineForProfile(options: EngineOptions, profile: SharedFrameProfile2D): Promise<Engine> {
  // Unsupported profiles never inspect options, allocate an Engine or reserve a surface.
  if (profile !== SHARED_FRAME_PROFILE_2D) throw new EgretError('ENGINE_RENDER_PROFILE_UNSUPPORTED');
  const host = options.host;
  let advertisement: unknown, shared: unknown, space: unknown;
  try {
    const source = host as unknown as {
      readonly sharedFrameProfile?: unknown;
      readonly renderSharedFrame?: unknown;
      readonly sharedBlendSpace?: unknown;
    };
    advertisement = source.sharedFrameProfile;
    shared = source.renderSharedFrame;
    space = source.sharedBlendSpace;
  } catch (cause) {
    throw new EgretError('INVALID_RENDERER', { cause });
  }
  if (advertisement !== SHARED_FRAME_PROFILE_2D) throw new EgretError('ENGINE_RENDER_PROFILE_UNSUPPORTED');
  if (typeof shared !== 'function') throw new EgretError('INVALID_RENDERER');
  // The space the renderer mixes in; its frames record it. Linear light unless the renderer says otherwise.
  if (space !== undefined && space !== 'linear' && space !== 'srgb') throw new EgretError('INVALID_RENDERER');
  const diagnostic = options.onDiagnostic;
  const stableOptions: EngineOptions = { host, ...(diagnostic === undefined ? {} : { onDiagnostic: diagnostic }) };
  const timeoutMs = options.shutdownTimeoutMs ?? 1000;
  if (!Number.isFinite(timeoutMs) || !Number.isInteger(timeoutMs) || timeoutMs <= 0)
    throw new EgretError('INVALID_TIMEOUT');
  let clockValue: unknown;
  try {
    clockValue = options.clock;
  } catch (cause) {
    throw new EgretError('CLOCK_OPTIONS_INVALID', { cause });
  }
  const clockOptions = admitGameClockOptions(clockValue);
  // The Engine reads the renderer's blend space beside the declared ports.
  const ports: CapturedEngineFramePorts = Object.assign(
    { shared: shared as CapturedEngineFramePorts['shared'], sharedProfile: profile },
    { sharedBlendSpace: space === 'srgb' ? 'srgb' : 'linear' }
  );
  return startEngine(stableOptions, timeoutMs, ports, clockOptions);
}
