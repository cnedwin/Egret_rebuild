import { SHARED_FRAME_PROFILE_2D } from '@egret/contracts';
import { EgretError } from '@egret/runtime';
import { startEngine } from './startEngine.js';
import { admitGameClockOptions } from './gameClock.js';
/** Exact negotiation completes all successful port reads before semantics. */
export async function createEngineForProfile(options, profile) {
    // Unsupported profiles never inspect options, allocate an Engine or reserve a surface.
    if (profile !== SHARED_FRAME_PROFILE_2D)
        throw new EgretError('ENGINE_RENDER_PROFILE_UNSUPPORTED');
    const host = options.host;
    let advertisement, shared;
    try {
        const source = host;
        advertisement = source.sharedFrameProfile;
        shared = source.renderSharedFrame;
    }
    catch (cause) {
        throw new EgretError('INVALID_RENDERER', { cause });
    }
    if (advertisement !== SHARED_FRAME_PROFILE_2D)
        throw new EgretError('ENGINE_RENDER_PROFILE_UNSUPPORTED');
    if (typeof shared !== 'function')
        throw new EgretError('INVALID_RENDERER');
    const diagnostic = options.onDiagnostic;
    const stableOptions = { host, ...(diagnostic === undefined ? {} : { onDiagnostic: diagnostic }) };
    const timeoutMs = options.shutdownTimeoutMs ?? 1000;
    if (!Number.isFinite(timeoutMs) || !Number.isInteger(timeoutMs) || timeoutMs <= 0)
        throw new EgretError('INVALID_TIMEOUT');
    let clockValue;
    try {
        clockValue = options.clock;
    }
    catch (cause) {
        throw new EgretError('CLOCK_OPTIONS_INVALID', { cause });
    }
    const clockOptions = admitGameClockOptions(clockValue);
    return startEngine(stableOptions, timeoutMs, {
        shared: shared,
        sharedProfile: profile
    }, clockOptions);
}
//# sourceMappingURL=createEngineForProfile.js.map