import { EgretError } from '@egret/runtime';
import type { DisplayObjectContainer } from '@egret/runtime';
import type { UiHeightIndex, UiLayoutTree, UiLayoutNode, UiLayoutPlan, UiLayoutBox } from '@egret/runtime/ui';
import type { UiScopePort } from '../internal/uiFactoryState.js';
import type { CapturedLeafContent } from './leafContent.js';
import type { UiRowSnapshot, UiSnapshot, RowUnbindInfo } from './types.js';
import type { UiTheme } from './theme.js';
import type { CapturedSource } from './virtualList.js';
export type ScopePort = UiScopePort;
export interface Binding {
    theme: UiTheme | undefined;
    key: string;
    version: number;
    generation: number;
    width: number;
    density: number;
    source: Pick<CapturedSource, 'identity' | 'bind' | 'unbind'> | undefined;
    scope: ScopePort;
    wrapper: DisplayObjectContainer;
    content?: DisplayObjectContainer;
    height?: number;
    entered: boolean;
    terminal: boolean;
    subscriptions: (() => void)[];
}
export interface LeafBinding {
    theme: UiTheme | undefined;
    readonly id: string;
    readonly width: number;
    readonly density: number;
    readonly scope: ScopePort;
    readonly wrapper: DisplayObjectContainer;
    source: CapturedLeafContent | undefined;
    content?: DisplayObjectContainer;
    height?: number;
    measure?: NonNullable<UiLayoutNode['measure']>;
    terminal: boolean;
}
export interface Shell {
    scope: ScopePort;
    wrapper: DisplayObjectContainer;
}
export interface WindowState {
    theme: UiTheme | undefined;
    paintOnly: boolean;
    cleanupErrors: unknown[];
    revision: number;
    source: CapturedSource | undefined;
    index: UiHeightIndex | undefined;
    plan: UiLayoutPlan | undefined;
    box: UiLayoutBox | undefined;
    width: number;
    height: number;
    scroll: number;
    round: number;
    heights: Map<string, {
        key: string;
        height: number;
        contentVersion: number;
    }>;
    bindings: Map<string, Binding>;
    leafBindings: Map<string, LeafBinding>;
}
export interface Candidate {
    nextPool: Shell[];
    discardedShells: Shell[];
    retiring: readonly {
        binding: Binding;
        reason: RowUnbindInfo['reason'];
    }[];
    oldFills: ScopePort[];
    retiringLeaves: readonly LeafBinding[];
    preparedWindow: WindowState;
    rows: readonly UiRowSnapshot[];
    bindings: Map<string, Binding>;
    shells: Map<string, Shell>;
    freshShells: Shell[];
    fillScopes: ScopePort[];
    displayToken: object;
    indexJournal: ReturnType<UiHeightIndex['stageHeights']> | undefined;
    snapshot: UiSnapshot;
    inputGeneration: number;
    layerGeneration: number;
}
export interface TokenState {
    used: boolean;
    retired?: boolean;
    candidate?: Candidate;
}
export declare function withoutSources(tree: UiLayoutTree): UiLayoutTree;
export declare function preparationError(cause: unknown, cleanupErrors: unknown[]): EgretError;
export declare function fail(code: string): never;
export declare function next(value: number): number;
export declare function number(value: number, min: number, max: number): number;
export declare function viewport(value: Readonly<{
    width: number;
    height: number;
}>): Readonly<{
    width: number;
    height: number;
}>;
export declare function origin(value: Readonly<{
    x: number;
    y: number;
}>, size: Readonly<{
    width: number;
    height: number;
}>): Readonly<{
    x: number;
    y: number;
}>;
//# sourceMappingURL=uiRootModel.d.ts.map