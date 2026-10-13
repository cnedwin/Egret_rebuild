// SPDX-License-Identifier: Apache-2.0
// Every route below already exists; missing-module setup is not an intended refusal.

// SS_TYPE_CASE SS1-I01: the facade is erased, not a root runtime constructor.
import { SpriteSheet } from '@egret/engine';
// SS_TYPE_CASE SS1-I02: the frame descriptor is erased.
import { SpriteSheetFrameInput } from '@egret/engine';
// SS_TYPE_CASE SS1-I03: runtime also erases the canonical facade type.
import { SpriteSheet as RuntimeSpriteSheet } from '@egret/runtime';
// SS_TYPE_CASE SS1-I04: runtime also erases the canonical frame type.
import { SpriteSheetFrameInput as RuntimeSpriteSheetFrameInput } from '@egret/runtime';
// SS_TYPE_CASE SS1-I05: Bitmap transaction authority stays private to its module.
import { spriteSheetBitmapOperations } from '@egret/engine';
// SS_TYPE_CASE SS1-I06: the runtime barrel does not leak that authority.
import { spriteSheetBitmapOperations as RuntimeBitmapOperations } from '@egret/runtime';
// SS_TYPE_CASE SS1-I07: contracts own no new sheet factory.
import { createSpriteSheet as ContractsFactory } from '@egret/contracts';
// SS_TYPE_CASE SS1-I08: contracts own no sheet facade type.
import type { SpriteSheet as ContractsSheet } from '@egret/contracts';
// SS_TYPE_CASE SS1-I09: project root gains no renderer factory.
import { createSpriteSheet as ProjectFactory } from '@egret/project';
// SS_TYPE_CASE SS1-I10: project root gains no renderer frame descriptor.
import type { SpriteSheetFrameInput as ProjectFrame } from '@egret/project';
// SS_TYPE_CASE SS1-I11: explicit text entry gains no image-sheet facade.
import { createSpriteSheet as TextFactory } from '@egret/engine/text';
// SS_TYPE_CASE SS1-I12: runtime text entry gains no image-sheet facade.
import type { SpriteSheet as RuntimeTextSheet } from '@egret/runtime/text';
// SS_TYPE_CASE SS1-I13: scene entry gains no 2D named-table factory.
import { createSpriteSheet as SceneFactory } from '@egret/engine/scene3d';
// SS_TYPE_CASE SS1-I14: existing opt-in Spine planning entry gains no sheet type.
import type { SpriteSheet as SpineSheet } from '@egret/project/spine';
