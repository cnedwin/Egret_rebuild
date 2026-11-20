// SPDX-License-Identifier: Apache-2.0
import type { Rectangle2D } from '@egret/contracts';
import type { Scope as EngineScope } from '@egret/runtime';
import type { Engine } from '../Engine.js';
import type { PointerInput } from '../pointerInputTypes.js';
import type { KeyboardInput } from '../keyboardInputTypes.js';
import type { UiRoot } from './types.js';

/** What a layer is anchored to: a leaf of the tree, or a row of a list. */
export type UiLayerTarget =
  | Readonly<{ kind: 'leaf'; id: string }>
  | Readonly<{ kind: 'row'; listId: string; key: string }>;
/** Where a layer is placed beside its target: on which side, how aligned, and how far from it. */
export interface UiLayerAnchor {
  readonly root: UiRoot;
  readonly target: UiLayerTarget;
  readonly placement?: 'below' | 'above';
  /** Which edges meet across the anchor: its start and the overlay's (the default), their centres, or their ends. */
  readonly align?: 'start' | 'center' | 'end';
  readonly gap?: number;
}
/** A layer manager to make: its engine, scope and input, its viewport and limits. */
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
/** A layer to open: its id and root, its kind and anchor, where focus goes, how it closes, and its backdrop. */
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
/** An open layer; dispose of it to close it. */
export interface UiLayerRegistration {
  readonly id: string;
  dispose(): void;
}
/** What committing the layers did, and any errors after the commit. */
export interface UiLayerCommitResult {
  readonly kind: 'committed' | 'unchanged' | 'pending' | 'closed';
  readonly revision: number;
  readonly postCommitErrors: readonly unknown[];
}
/** The layers as they are now: committed and desired stacks, each layer, and counters. */
export interface UiLayerSnapshot {
  readonly state: 'open' | 'closed';
  readonly committedRevision: number;
  readonly desiredRevision: number;
  readonly viewport: Rectangle2D;
  readonly openStack: readonly string[];
  readonly desiredStack: readonly string[];
  readonly layers: readonly Readonly<{
    id: string;
    kind: UiLayerOptions['kind'];
    visible: boolean;
    pointerEnabled: boolean;
    keyboardEnabled: boolean;
    origin: Readonly<{ x: number; y: number }>;
  }>[];
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
