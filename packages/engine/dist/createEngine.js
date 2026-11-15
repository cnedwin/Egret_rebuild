import { EgretError } from '@egret/runtime';
import { startEngine } from './startEngine.js';
import { admitGameClockOptions } from './gameClock.js';
/**
 * An Engine without a render port: it captures frames and does not render them.
 * Reserve the surface before startup; failed startup uses the normal close path.
 */
export async function createEngine(options) {
    const host = options.host;
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
    return startEngine(stableOptions, timeoutMs, { shared: undefined, sharedProfile: undefined }, clockOptions);
}
//# sourceMappingURL=createEngine.js.map