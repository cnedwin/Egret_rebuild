import type { DisplayObject, Scope } from '@egret/runtime';
export interface TextFieldEnginePort {
    assertOpen(): void;
    isEngineScope(value: unknown): value is Scope;
    registerCache(cache: object, construct: (scope: Scope) => DisplayObject, kind?: 'explicit-lines' | 'paragraph'): void;
    construct(scope: Scope, cache: object, kind?: 'explicit-lines' | 'paragraph'): DisplayObject;
}
/** Only Engine assembly can install the closed-over instance/cache authority. */
export declare function registerTextFieldEngine(engine: object, assertOpen: () => void, isEngineScope: (value: unknown) => value is Scope): TextFieldEnginePort;
export declare function requireTextFieldEngine(engine: unknown): TextFieldEnginePort;
//# sourceMappingURL=textFieldFactoryState.d.ts.map