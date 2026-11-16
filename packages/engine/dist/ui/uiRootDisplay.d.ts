import type { DisplayObjectContainer } from '@egret/runtime';
import type { UiDisplayOperations, UiDisplayUpdate, UiHeightIndex, UiLayoutTree } from '@egret/runtime/ui';
import type { UiEnginePort } from '../internal/uiFactoryState.js';
import type { UiRowSnapshot } from './types.js';
import type { Binding, ScopePort, Shell, WindowState } from './uiRootModel.js';
interface DisplayDraft {
    updates: UiDisplayUpdate[];
    nextBindings: Map<string, Binding>;
    nextShells: Map<string, Shell>;
    freshShells: Shell[];
    fillScopes: ScopePort[];
    rows: UiRowSnapshot[];
    available: Shell[];
    childWrappers: DisplayObjectContainer[];
}
export declare function createUiRootDisplayDraft(pool: readonly Shell[], shells: ReadonlyMap<string, Shell>, finalKeys: readonly string[]): DisplayDraft;
interface DisplayPreparation {
    w: WindowState;
    finalKeys: readonly string[];
    view: UiHeightIndex | ReturnType<UiHeightIndex['stageHeights']> | undefined;
    shells: ReadonlyMap<string, Shell>;
    port: Pick<UiEnginePort, 'scope' | 'createScope'>;
    display: Pick<UiDisplayOperations, 'createWrapper'>;
    tree: UiLayoutTree;
    listWrapper: DisplayObjectContainer | undefined;
    listId: string | undefined;
    rootWrapper: DisplayObjectContainer;
    layerOrigin: Readonly<{
        x: number;
        y: number;
    }> | undefined;
    position: Readonly<{
        x: number;
        y: number;
    }>;
    size: Readonly<{
        width: number;
        height: number;
    }>;
    layerVisible: boolean;
    layerPointer: boolean;
}
/** Append detached display updates in the root transaction's original paint order. */
export declare function stageUiRootDisplay(draft: DisplayDraft, preparation: DisplayPreparation): void;
export {};
//# sourceMappingURL=uiRootDisplay.d.ts.map