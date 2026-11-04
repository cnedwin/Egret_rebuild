// SPDX-License-Identifier: Apache-2.0
import type { DisplayObject } from '@egret/engine';
export interface SpineDisplayOptions { readonly colorProfile: 'egret-shared-linear/1'; readonly maxCommands?: number; readonly maxVertices?: number; readonly maxIndices?: number; }
export interface SpineDisplayStatus { readonly colorProfile: 'egret-shared-linear/1'; readonly isDisposed: boolean; readonly revision: number; readonly commands: number; readonly vertices: number; readonly indices: number; }
export interface SpineDisplay {
  /** Placement/opacity/visibility/rectangular clipping use the existing display tree. Children are adapter-owned. */
  readonly node: DisplayObject;
  getStatus(): SpineDisplayStatus;
  dispose(): void;
}
