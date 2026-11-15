import type { CapturedEngineFramePorts, Engine, EngineOptions } from './Engine.js';
import type { AdmittedGameClockOptions } from './gameClock.js';
/** Admission supplies stable internal options; both factories share one owner. */
export declare function startEngine(options: EngineOptions, timeoutMs: number, ports: CapturedEngineFramePorts, clockOptions: AdmittedGameClockOptions): Promise<Engine>;
//# sourceMappingURL=startEngine.d.ts.map