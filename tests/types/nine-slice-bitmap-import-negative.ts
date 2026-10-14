// SPDX-License-Identifier: Apache-2.0
// All non-owner routes below already exist; no missing subpath is the oracle.
// NLB_TYPE_CASE NLB-I01: Engine options remain a type-only binding.
import { NineSliceBitmapOptions as EngineOptionsValue } from '@egret/engine';
// NLB_TYPE_CASE NLB-I02: Runtime options remain a type-only binding.
import { NineSliceBitmapOptions as RuntimeOptionsValue } from '@egret/runtime';
// NLB_TYPE_CASE NLB-I03: the dependency-free contracts entry owns no display leaf.
import { NineSliceBitmap as ContractLeaf } from '@egret/contracts';
// NLB_TYPE_CASE NLB-I04: the Canvas entry owns no leaf value.
import { NineSliceBitmap as CanvasLeaf } from '@egret/engine/web';
// NLB_TYPE_CASE NLB-I05: the opt-in WebGPU entry owns no leaf value.
import { NineSliceBitmap as WebGPULeaf } from '@egret/engine/webgpu';
// NLB_TYPE_CASE NLB-I06: the existing scene facade gains no UI leaf.
import { NineSliceBitmap as SceneLeaf } from '@egret/engine/scene3d';
// NLB_TYPE_CASE NLB-I07: the explicit Engine text entry gains no panel leaf.
import { NineSliceBitmap as EngineTextLeaf } from '@egret/engine/text';
// NLB_TYPE_CASE NLB-I08: the explicit runtime text entry gains no panel leaf.
import { NineSliceBitmap as RuntimeTextLeaf } from '@egret/runtime/text';
