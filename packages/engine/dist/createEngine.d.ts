import type { Engine, EngineOptions } from './Engine.js';
/**
 * An Engine without a render port: it captures frames and does not render them.
 * Reserve the surface before startup; failed startup uses the normal close path.
 */
export declare function createEngine(options: EngineOptions): Promise<Engine>;
//# sourceMappingURL=createEngine.d.ts.map