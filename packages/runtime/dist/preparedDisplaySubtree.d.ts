import type { Stage } from './Stage.js';
import type { EngineContext } from './ownership.js';
type Operations = Parameters<NonNullable<EngineContext['registerPreparedDisplayOperations']>>[0];
/** Genuine Stage assembly only. All tree overlays and publication tokens remain private. */
export declare function createPreparedDisplayOperations(stage: Stage): Operations;
export {};
//# sourceMappingURL=preparedDisplaySubtree.d.ts.map