// SPDX-License-Identifier: Apache-2.0
import type { Rectangle2D } from '@egret/contracts';
import type { Scope as EngineScope } from '@egret/runtime';
import type { Engine } from '../Engine.js';
import type { PointerInput } from '../pointerInputTypes.js';
import type { KeyboardInput } from '../keyboardInputTypes.js';
import type { UiRoot } from './types.js';

export type UiLayerTarget = Readonly<{ kind: 'leaf'; id: string }> | Readonly<{ kind: 'row'; listId: string; key: string }>;
export interface UiLayerAnchor {
    readonly root: UiRoot;
    readonly target: UiLayerTarget;
    readonly placement?: 'below' | 'above';
    /** Which edges meet across the anchor: its start and the overlay's (the default), their centres, or their ends. */
    readonly align?: 'start' | 'center' | 'end';
    readonly gap?: number;
}
export interface UiLayerManagerOptions {
    readonly engine: Engine;
    readonly scope: EngineScope;
    readonly input: PointerInput;
    readonly keyboard?: KeyboardInput;
    readonly viewport: Rectangle2D;
    readonly maxLayers?: number;
    readonly editorPolicy?: 'commit' | 'cancel';
    /** Request the caller's existing UI publication/capture path, never a second loop. */
    readonly onInvalidate?: () => void;
}
export interface UiLayerOptions {
    readonly id: string;
    readonly root: UiRoot;
    readonly kind: 'base' | 'popup' | 'modal';
    readonly anchor?: UiLayerAnchor;
    readonly initialFocus?: Readonly<{ listId: string; key: string }>;
    readonly closeOnEscape?: boolean;
    readonly closeOnOutside?: boolean;
    readonly backdropColor?: number;
    readonly backdropAlpha?: number;
}
export interface UiLayerRegistration { readonly id: string; dispose(): void; }
export interface UiLayerCommitResult {
    readonly kind: 'committed' | 'unchanged' | 'pending' | 'closed';
    readonly revision: number;
    readonly postCommitErrors: readonly unknown[];
}
export interface UiLayerSnapshot {
    readonly state: 'open' | 'closed';
    readonly committedRevision: number;
    readonly desiredRevision: number;
    readonly viewport: Rectangle2D;
    readonly openStack: readonly string[];
    readonly desiredStack: readonly string[];
    readonly layers: readonly Readonly<{ id: string; kind: UiLayerOptions['kind']; visible: boolean; pointerEnabled: boolean; keyboardEnabled: boolean; origin: Readonly<{ x: number; y: number }> }>[];
    readonly counters: Readonly<{ registered: number; open: number; backdrops: number }>;
}
/** Stage intents, publish participating roots, then sync before editor placement/capture. */
export interface UiLayerManager {
    register(options: UiLayerOptions): UiLayerRegistration;
    open(id: string): void;
    close(id: string): void;
    setViewport(viewport: Rectangle2D): void;
    sync(): UiLayerCommitResult;
    snapshot(): UiLayerSnapshot;
    dispose(): void;
}
