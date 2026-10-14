// SPDX-License-Identifier: Apache-2.0
// Preserve emitted public Egret type identities; expose no Core or lease ownership.
import type { AssetRef, DisplayObjectContainer, Scope, Texture } from '@egret/engine';
import type { SpineImportInput } from '@egret/project/spine';
export interface F2CoreCreateOptions { readonly input: SpineImportInput; readonly pageRef: AssetRef<Texture>; }
export interface F2CoreResources { readonly isDisposed: boolean; createInstance(instanceScope: Scope, animationName: string): F2CoreInstance; dispose(): void; }
export type F2CoreInstanceState = 'live' | 'failed' | 'disposed';
export interface F2CoreInstance { readonly display: DisplayObjectContainer | undefined; readonly state: F2CoreInstanceState; readonly sampleTimeSeconds: number; sampleAt(seconds: number): void; dispose(): void; }
