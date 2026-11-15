import type { DisplayObject } from '../DisplayObject.js';
/** Only runtime UI construction installs a captured per-wrapper terminal path. */
export declare function registerManagedWrapper(node: DisplayObject, authority: object, dispose: () => void): void;
export declare function isManagedWrapper(node: object): boolean;
export declare function managedBy(node: object, authority: object): boolean;
export declare function managedTerminal(node: object): boolean;
export declare function assertManagedMutable(node: object | undefined): void;
export declare function assertManagedEdgeMutable(parent: DisplayObject, child: DisplayObject): void;
export declare function assertManagedChildrenMutable(parent: DisplayObject): void;
/** Revoke this exact value before callbacks; never unlock another managed value. */
export declare function cleanupManagedWrapper(value: object): boolean;
//# sourceMappingURL=managedState.d.ts.map