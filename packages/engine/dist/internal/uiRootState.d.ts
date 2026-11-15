import type { DisplayObjectContainer } from '@egret/runtime';
import type { UiRoot, UiSnapshot, RowRetention } from '../ui/types.js';
import type { PointerInput } from '../pointerInputTypes.js';
import type { KeyboardInput } from '../keyboardInputTypes.js';
export type UiRootTarget = Readonly<{
    kind: 'leaf';
    id: string;
}> | Readonly<{
    kind: 'row';
    listId: string;
    key: string;
}>;
export interface UiRootContent {
    readonly content: DisplayObjectContainer;
    readonly visible: boolean;
    readonly bindingGeneration?: number;
    readonly contentVersion?: number;
}
export interface UiRootLayerPresentation {
    readonly x: number;
    readonly y: number;
    readonly visible: boolean;
    readonly pointerEnabled: boolean;
    readonly keyboardEnabled: boolean;
    readonly index?: number;
}
export interface UiRootLayerState {
    readonly snapshot: UiSnapshot;
    readonly ready: boolean;
    readonly mutable: boolean;
    readonly lifetimeOpen: boolean;
    readonly visible: boolean;
    readonly pointerEnabled: boolean;
    readonly keyboardEnabled: boolean;
    readonly input: PointerInput | undefined;
    readonly keyboard: KeyboardInput | undefined;
}
interface RootPort {
    readonly wrapper: DisplayObjectContainer;
    state(): 'open' | 'closed';
    snapshot(): UiSnapshot;
    lookup(target: UiRootTarget): UiRootContent | undefined;
    retain(listId: string, key: string): RowRetention;
    layerState(): UiRootLayerState;
    presentLayer(value: UiRootLayerPresentation): void;
    releaseLayer(visible: boolean): void;
    layerOwnership(active: boolean): void;
    anchor(target: UiRootTarget): Readonly<{
        x: number;
        y: number;
        width: number;
        height: number;
    }> | undefined;
}
export interface UiRootAccess extends RootPort {
    onClose(callback: () => void): () => void;
    onInteractionChange(callback: (active: boolean, policy: 'commit' | 'cancel') => void): () => void;
    notifyInteraction(policy: 'commit' | 'cancel'): readonly unknown[];
    claimLayer(owner: object, dismiss: () => boolean): () => void;
    editorInteractive(): boolean;
    requestDismiss(): boolean;
}
/** The genuine root installs all ports once; structural copies grant no authority. */
export declare function registerUiRoot(root: UiRoot, engine: object, port: RootPort): () => readonly unknown[];
export declare function requireUiRoot(root: unknown, engine: object): UiRootAccess;
export {};
//# sourceMappingURL=uiRootState.d.ts.map