// SPDX-License-Identifier: Apache-2.0
// Intentional rejected consumers. Actual unsuppressed diagnostics are collected later.
import { createSpriteSheet } from '@egret/engine';
import type { AssetLease, Engine, SpriteSheet, SpriteSheetFrameInput, Texture, TextureRegion2D } from '@egret/engine';

declare const lease: AssetLease<Texture>;
declare const unknownLease: AssetLease<unknown>;
declare const numberLease: AssetLease<number>;
declare const sheet: SpriteSheet;
declare const engine: Engine;
declare const region: TextureRegion2D;
declare const frame: SpriteSheetFrameInput;
declare const readonlyFrames: readonly SpriteSheetFrameInput[];

// SS_TYPE_CASE SS1-N01: invariant unknown entitlement cannot become a texture lease.
createSpriteSheet(unknownLease, readonlyFrames);
// SS_TYPE_CASE SS1-N02: a genuine different asset type cannot supply a texture.
createSpriteSheet(numberLease, readonlyFrames);
// SS_TYPE_CASE SS1-N03: Texture is not a lease.
createSpriteSheet(lease.value, readonlyFrames);
// SS_TYPE_CASE SS1-N04: required lease is not nullable.
createSpriteSheet(null, readonlyFrames);
// SS_TYPE_CASE SS1-N05: required frames cannot be omitted.
createSpriteSheet(lease);
// SS_TYPE_CASE SS1-N06: named rectangles require numeric coordinates.
createSpriteSheet(lease, [{ name: 'red', x: '0', y: 0, width: 2, height: 2 }]);
// SS_TYPE_CASE SS1-N07: exact names are primitive strings.
createSpriteSheet(lease, [{ name: 7, x: 0, y: 0, width: 2, height: 2 }]);
// SS_TYPE_CASE SS1-N08: all five known fields are required.
createSpriteSheet(lease, [{ name: 'red', x: 0, y: 0, width: 2 }]);
// SS_TYPE_CASE SS1-N09: the table is a readonly array, not a string.
createSpriteSheet(lease, 'red');
// SS_TYPE_CASE SS1-N10: no optional undefined frame table is declared.
createSpriteSheet(lease, undefined);
// SS_TYPE_CASE SS1-N11: no provider/options argument is declared.
createSpriteSheet(lease, readonlyFrames, {});
// SS_TYPE_CASE SS1-N12: no runtime constructor is supplied for the erased facade.
new SpriteSheet();
// SS_TYPE_CASE SS1-N13: metadata arrays cannot be mutated through the public type.
sheet.names.push('extra');
// SS_TYPE_CASE SS1-N14: metadata identity is readonly.
sheet.names = [];
// SS_TYPE_CASE SS1-N15: canonical source regions are readonly.
region.width = 3;
// SS_TYPE_CASE SS1-N16: frame descriptors admit readonly input.
frame.name = 'changed';
// SS_TYPE_CASE SS1-N17: the factory does not become an Engine method.
engine.createSpriteSheet(lease, readonlyFrames);
// SS_TYPE_CASE SS1-N18: lookup does not coerce numeric keys.
sheet.getRegion(1);
// SS_TYPE_CASE SS1-N19: Bitmap creation requires an exact string name.
sheet.createBitmap();
// SS_TYPE_CASE SS1-N20: facade dimensions cannot be changed.
sheet.atlasWidth = 7;
// SS_TYPE_CASE SS1-N21: default roots do not admit browser ambient APIs.
document.createElement('canvas');
// SS_TYPE_CASE SS1-N22: types[] does not admit Node ambient APIs.
process.exitCode = 0;
