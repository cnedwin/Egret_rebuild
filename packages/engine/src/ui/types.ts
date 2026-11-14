// SPDX-License-Identifier: Apache-2.0
import type { UiTheme, UiThemeNode } from './theme.js';
import type { CancellationSignal } from '@egret/contracts';
import type { DisplayObject, DisplayObjectContainer, Event, Scope } from '@egret/runtime';
import type { UiLayoutNode, UiDirtyKind, UiLayoutBox } from '@egret/runtime/ui';
import type { Engine } from '../Engine.js';
import type { KeyboardInput, KeyboardFocusOptions } from '../keyboardInputTypes.js';
import type { PointerInput, PointerContact, PointerCancelReason } from '../pointerInputTypes.js';
type LayoutDimensions = Omit<UiLayoutNode, 'kind' | 'children' | 'source' | 'initialScrollOffset' | 'measure' | 'fill'> & { readonly theme?: UiThemeNode };
export type LayoutNode = (LayoutDimensions & {
    readonly kind: 'leaf';
    readonly fill?: NonNullable<UiLayoutNode['fill']>;
} & ({
    readonly measure?: NonNullable<UiLayoutNode['measure']>;
    readonly content?: never;
} | {
    readonly measure?: never;
    readonly content: UiLeafContent;
})) | (LayoutDimensions & {
    readonly kind: 'row' | 'column';
    readonly children: readonly LayoutNode[];
}) | (LayoutDimensions & {
    readonly kind: 'virtualList';
    readonly source: VirtualDataSource<unknown>;
    readonly initialScrollOffset?: number;
});
export type UiInvalidationKind = UiDirtyKind;
export interface UiLimits {
    readonly overscan?: number;
    readonly residentCap?: number;
    readonly retainedCap?: number;
}
export interface VirtualRecord<T> {
    readonly key: string;
    readonly contentVersion: number;
    readonly estimatedHeight: number;
    readonly value: T;
}
export interface VirtualDataSource<T> {
    readonly revision: number;
    readonly records: readonly VirtualRecord<T>[];
    bind(context: RowBindContext<T>): RowBinding | Promise<RowBinding>;
    unbind(info: RowUnbindInfo): void;
}
export interface RowBindContext<T> {
    readonly theme: UiTheme | undefined;
    readonly key: string;
    readonly index: number;
    readonly value: T;
    readonly contentVersion: number;
    readonly bindingGeneration: number;
    readonly width: number;
    readonly density: number;
    readonly scope: Scope;
    readonly signal: CancellationSignal;
    /**
     * The display object of the row: what a press on the row and a pointer over it reach once the
     * row is committed, and the `target` of its pointer notifications. A control of the application
     * may listen on it. It belongs to the root: add nothing to it, and do not move or dispose it.
     */
    readonly target: DisplayObject;
}
/** Detached content is prepared at the leaf's available inner width. */
export interface UiLeafPrepareContext {
    readonly theme: UiTheme | undefined;
    readonly scope: Scope;
    readonly width: number;
    readonly density: number;
    readonly signal: CancellationSignal;
}
export interface UiLeafContent {
    readonly revision: number;
    prepare(context: UiLeafPrepareContext): RowBinding | Promise<RowBinding>;
}
export interface RowBinding {
    readonly content: DisplayObjectContainer;
    readonly measuredHeight: number;
}
export interface RowUnbindInfo {
    readonly key: string;
    readonly bindingGeneration: number;
    readonly contentVersion: number;
    readonly reason: 'recycle' | 'replace' | 'delete' | 'cancel' | 'dispose' | 'error';
}
export interface RowRetention {
    release(): void;
}
export type UiRowPointerNotification = Readonly<{
    kind: 'begin' | 'move' | 'end';
    listId: string;
    key: string;
    index: number;
    bindingGeneration: number;
    contentVersion: number;
    layoutRevision: number;
    target: DisplayObject;
    event: Event<PointerContact>;
}> | Readonly<{
    kind: 'cancel';
    listId: string;
    key: string;
    index: number;
    bindingGeneration: number;
    contentVersion: number;
    layoutRevision: number;
    target: DisplayObject;
    event: Event<PointerContact & {
        readonly reason: PointerCancelReason;
    }>;
}>;
/** Explicit namespace prevents independently authored panels from sharing focus IDs. */
export interface UiKeyboardOptions {
    readonly input: KeyboardInput;
    readonly idPrefix: string;
    /**
     * Makes the rows of a list one stop of the keyboard, of this index among the stops of the
     * channel (0 to 32,767). Tab enters the list at the row that last held the focus, or at the first
     * that shows, and the application moves the focus among the rows. Without it every row that
     * shows is a stop of its own.
     */
    readonly tabStop?: number;
}
export interface UiRootOptions {
    readonly theme?: UiTheme;
    readonly engine: Engine;
    readonly scope: Scope;
    readonly id: string;
    readonly viewport: Readonly<{
        width: number;
        height: number;
    }>;
    readonly origin?: Readonly<{
        x: number;
        y: number;
    }>;
    readonly density: number;
    readonly tree: LayoutNode;
    readonly input?: PointerInput;
    readonly keyboard?: UiKeyboardOptions;
    readonly onRowPointer?: (notification: UiRowPointerNotification) => void;
    readonly limits?: UiLimits;
}
declare const preparationBrand: unique symbol;
export interface UiPreparation {
    readonly [preparationBrand]: true;
    readonly status: 'ready' | 'pending' | 'unchanged';
    readonly desiredRevision: number;
    readonly baseCommittedRevision: number;
}
export interface UiCommitResult {
    readonly kind: 'unchanged' | 'committed' | 'stale' | 'closed';
    readonly revision: number;
    readonly postCommitErrors: readonly unknown[];
}
export interface UiRowSnapshot {
    readonly key: string;
    readonly index: number;
    readonly bindingGeneration: number;
    readonly contentVersion: number;
    readonly box: Readonly<{
        x: number;
        y: number;
        width: number;
        height: number;
    }>;
    readonly visible: boolean;
}
export interface UiCounters {
    /** Cumulative planner calls, including detached constraint discovery. */
    readonly layoutPasses: number;
    readonly recordCount: number;
    readonly heightIndexEntries: number;
    readonly heightIndexBytes: number;
    readonly measuredRecordCount: number;
    readonly liveShells: number;
    readonly visibleRows: number;
    readonly overscanOnlyRows: number;
    readonly retainedOnlyRows: number;
    readonly freeShells: number;
    readonly activeBindings: number;
    readonly stagedBindings: number;
    readonly unsettledBindCalls: number;
    readonly measurementCalls: number;
    readonly reusedMeasurements: number;
    readonly bindTotal: number;
    readonly unbindTotal: number; /** Undefined: custom binding resource ownership is not introspected. */
    readonly resourceDemands: number | undefined;
    readonly resourceLeases: number | undefined;
}
export interface VirtualListSnapshot {
    readonly id: string;
    readonly rows: readonly UiRowSnapshot[];
    readonly scrollOffset: number;
    readonly scrollExtent: number;
    readonly anchor: Readonly<{
        key: string;
        offset: number;
    }> | undefined;
    readonly counters: UiCounters;
}
export interface UiSnapshot extends VirtualListSnapshot {
    readonly theme: UiTheme | undefined;
    readonly rootId: string;
    readonly committedRevision: number;
    /** Present only when a UI layer manager publishes root placement/interaction. */
    readonly layerRevision?: number;
    readonly desiredRevision: number;
    readonly origin: Readonly<{
        x: number;
        y: number;
    }>;
    readonly viewport: Readonly<{
        width: number;
        height: number;
    }>;
    readonly density: number;
    readonly boxes: readonly UiLayoutBox[];
}
/** Alignment within the list's authored viewport; tall rows can remain clipped. */
export interface VirtualListRevealOptions {
    readonly align?: 'nearest' | 'start' | 'center' | 'end';
}
export interface VirtualListHandle<T> {
    /** Stage key-directed scrolling. Undefined cancels an uncommitted reveal. */
    reveal(key: string | undefined, options?: VirtualListRevealOptions): void;
    setSource(source: VirtualDataSource<T>): void;
    setScrollOffset(offset: number): void;
    updateHeights(updates: readonly {
        readonly key: string;
        readonly height: number;
        readonly contentVersion: number;
    }[]): void;
    retain(key: string, reason: 'focus' | 'composition'): RowRetention;
    focus(key: string | undefined, options?: KeyboardFocusOptions): void;
    getFocus(): Readonly<{ key: string | undefined; focusVisible: boolean }>;
    snapshot(): VirtualListSnapshot;
}
export interface UiRoot {
    readonly id: string;
    readonly state: 'open' | 'closed';
    setViewport(viewport: Readonly<{
        width: number;
        height: number;
    }>, density: number): void;
    setOrigin(origin: Readonly<{
        x: number;
        y: number;
    }>): void;
    setTree(tree: LayoutNode): void;
    /** Stage a generation; restore snapshot().theme to cancel a pending theme switch. */
    setTheme(theme: UiTheme | undefined): void;
    setInput(input: PointerInput | undefined): void;
    list<T>(id: string): VirtualListHandle<T>;
    invalidate(id: string, kind: UiInvalidationKind): void;
    prepare(): Promise<UiPreparation>;
    commit(preparation: UiPreparation): UiCommitResult;
    snapshot(): UiSnapshot;
    dispose(): void;
}
