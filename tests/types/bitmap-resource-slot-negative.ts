// SPDX-License-Identifier: Apache-2.0
// Unsuppressed compile-only cases; actual compiler tuples must be observed later.
import type {Engine, Scope, Bitmap, Texture, AssetRef, BitmapResourceSlot, BitmapResourceSlotState} from '@egret/engine';
// BITMAP_RESOURCE_SLOT_CASE no-free-factory
import {createBitmapResourceSlot} from '@egret/engine';
// BITMAP_RESOURCE_SLOT_CASE no-owner-factory-export
import {createBitmapResourceSlotOwner} from '@egret/engine';
// BITMAP_RESOURCE_SLOT_CASE no-registration-export
import {registerBitmapResourceTarget} from '@egret/engine';
// BITMAP_RESOURCE_SLOT_CASE no-bridge-type-export
import type {BitmapResourceSlotOperations} from '@egret/engine';
// BITMAP_RESOURCE_SLOT_CASE no-private-brand-export
import {bitmapResourceSlotBrand} from '@egret/engine';
declare const engine: Engine;
declare const scope: Scope;
declare const bitmap: Bitmap;
declare const slot: BitmapResourceSlot;
declare const textureRef: AssetRef<Texture>;
declare const stringRef: AssetRef<string>;
declare const unknownRef: AssetRef<unknown>;
// BITMAP_RESOURCE_SLOT_CASE required-arguments
engine.createBitmapResourceSlot();
// BITMAP_RESOURCE_SLOT_CASE required-target
engine.createBitmapResourceSlot(scope);
// BITMAP_RESOURCE_SLOT_CASE genuine-scope-type
engine.createBitmapResourceSlot({}, bitmap);
// BITMAP_RESOURCE_SLOT_CASE genuine-bitmap-type
engine.createBitmapResourceSlot(scope, {});
// BITMAP_RESOURCE_SLOT_CASE no-null-scope
engine.createBitmapResourceSlot(null, bitmap);
// BITMAP_RESOURCE_SLOT_CASE no-undefined-target
engine.createBitmapResourceSlot(scope, undefined);
// BITMAP_RESOURCE_SLOT_CASE no-third-factory-argument
engine.createBitmapResourceSlot(scope, bitmap, {});
// BITMAP_RESOURCE_SLOT_CASE required-reference
slot.replace();
// BITMAP_RESOURCE_SLOT_CASE invariant-string-reference
slot.replace(stringRef);
// BITMAP_RESOURCE_SLOT_CASE invariant-unknown-reference
slot.replace(unknownRef);
// BITMAP_RESOURCE_SLOT_CASE no-string-reference
slot.replace('texture');
// BITMAP_RESOURCE_SLOT_CASE no-null-reference
slot.replace(null);
// BITMAP_RESOURCE_SLOT_CASE no-incomplete-reference
slot.replace({});
// BITMAP_RESOURCE_SLOT_CASE no-replace-options
slot.replace(textureRef, {signal: undefined});
// BITMAP_RESOURCE_SLOT_CASE readonly-state
slot.state = 'ready';
// BITMAP_RESOURCE_SLOT_CASE exact-state-union
const invalidState: BitmapResourceSlotState = 'cancelled';
// BITMAP_RESOURCE_SLOT_CASE one-cancel-reason
slot.cancel(undefined, undefined);
// BITMAP_RESOURCE_SLOT_CASE no-dispose-argument
slot.dispose(undefined);
// BITMAP_RESOURCE_SLOT_CASE no-public-commit
slot.commit();
// BITMAP_RESOURCE_SLOT_CASE no-public-ready-promise
slot.ready;
// BITMAP_RESOURCE_SLOT_CASE no-owned-lease-port
slot.currentLease;
// BITMAP_RESOURCE_SLOT_CASE no-engine-registration-port
engine.registerBitmapResourceTarget(bitmap, {});
// BITMAP_RESOURCE_SLOT_CASE erased-handle
void BitmapResourceSlot;
// BITMAP_RESOURCE_SLOT_CASE erased-state
void BitmapResourceSlotState;
// BITMAP_RESOURCE_SLOT_CASE no-handle-constructor
new BitmapResourceSlot();
void [createBitmapResourceSlot, createBitmapResourceSlotOwner, registerBitmapResourceTarget, bitmapResourceSlotBrand, invalidState];
