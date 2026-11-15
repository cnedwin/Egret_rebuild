import type { Scope } from '@egret/engine';
import type { SpineContentLoader } from './types.js';
import type { SpineDisplay } from './displayTypes.js';
import type { SpineInstance } from './instanceTypes.js';
export declare function registerResetLoader(loader: SpineContentLoader, authenticate: (scope: Scope) => void): void;
export declare function authenticateResetLoader(loader: SpineContentLoader, scope: Scope): void;
export declare function registerResetDisplay(display: SpineDisplay, instance: SpineInstance): void;
export declare function authenticateResetDisplay(display: SpineDisplay, instance: SpineInstance): void;
//# sourceMappingURL=resetAuthority.d.ts.map