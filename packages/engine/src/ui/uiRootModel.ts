// SPDX-License-Identifier: Apache-2.0
import { EgretError } from '@egret/runtime';
import type { DisplayObjectContainer } from '@egret/runtime';
import { captureUiLayout } from '@egret/runtime/ui';
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
  heights: Map<
    string,
    {
      key: string;
      height: number;
      contentVersion: number;
    }
  >;
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
const freeze = Object.freeze;
const sourceMarker = freeze({});
// Layout caches retain numeric descriptors, never historical data source snapshots.
export function withoutSources(tree: UiLayoutTree): UiLayoutTree {
  function copy(node: UiLayoutNode): UiLayoutNode {
    const result = freeze({
      ...node,
      ...(node.kind === 'virtualList'
        ? {
            source: sourceMarker
          }
        : {}),
      ...(node.children === undefined
        ? {}
        : {
            children: freeze(node.children.map(copy))
          })
    });
    return result;
  }
  const root = copy(tree.root);
  return captureUiLayout(root);
}
export function preparationError(cause: unknown, cleanupErrors: unknown[]): EgretError {
  if (cause instanceof EgretError && cleanupErrors.length === 0) return cause;
  return new EgretError(cause instanceof EgretError ? cause.code : 'UI_PREPARE_FAILED', { cause, cleanupErrors });
}
export function fail(code: string): never {
  throw new EgretError(code);
}
export function next(value: number): number {
  if (value >= Number.MAX_SAFE_INTEGER) fail('UI_REVISION_EXHAUSTED');
  return value + 1;
}
export function number(value: number, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) fail('UI_VALUE_INVALID');
  return value === 0 ? 0 : value;
}
export function viewport(
  value: Readonly<{
    width: number;
    height: number;
  }>
) {
  return freeze({
    width: number(value.width, Number.MIN_VALUE, 16384),
    height: number(value.height, Number.MIN_VALUE, 16384)
  });
}
export function origin(
  value: Readonly<{
    x: number;
    y: number;
  }>,
  size: Readonly<{
    width: number;
    height: number;
  }>
) {
  const x = number(value.x, -1048576, 1048576),
    y = number(value.y, -1048576, 1048576);
  if (Math.abs(x + size.width) > 1048576 || Math.abs(y + size.height) > 1048576) fail('UI_VALUE_INVALID');
  return freeze({
    x,
    y
  });
}
