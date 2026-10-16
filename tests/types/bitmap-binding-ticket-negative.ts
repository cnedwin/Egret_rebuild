// SPDX-License-Identifier: Apache-2.0
// Unsuppressed named cases; compiler codes, columns and messages are not authored observations.
import * as root from '@egret/engine';
import type { Engine, Scope, Bitmap, Texture, AssetLease, BitmapBindingTicket } from '@egret/engine';

declare const engine: Engine;
declare const scope: Scope;
declare const bitmap: Bitmap;
declare const targets: readonly Bitmap[];
declare const ticket: BitmapBindingTicket;
declare const textureLease: AssetLease<Texture>;
declare const stringLease: AssetLease<string>;
declare const unknownLease: AssetLease<unknown>;
declare const members: readonly AssetLease<Texture>[];

// BITMAP_BINDING_TICKET_CASE no-free-factory
root.captureBitmapBindings(scope, targets);
// BITMAP_BINDING_TICKET_CASE no-capture-batch-value-export
root.captureBatch;
// BITMAP_BINDING_TICKET_CASE no-prepare-batch-value-export
root.prepareBatch;
// BITMAP_BINDING_TICKET_CASE no-commit-batch-value-export
root.commitBatch;
// BITMAP_BINDING_TICKET_CASE no-clear-batch-value-export
root.clearBatchIfCurrent;
// BITMAP_BINDING_TICKET_CASE erased-ticket-value
root.BitmapBindingTicket;
// BITMAP_BINDING_TICKET_CASE no-public-ticket-constructor
new root.BitmapBindingTicket();
// BITMAP_BINDING_TICKET_CASE required-scope-and-targets
engine.captureBitmapBindings();
// BITMAP_BINDING_TICKET_CASE required-targets
engine.captureBitmapBindings(scope);
// BITMAP_BINDING_TICKET_CASE genuine-scope-type
engine.captureBitmapBindings({}, targets);
// BITMAP_BINDING_TICKET_CASE array-target-shape
engine.captureBitmapBindings(scope, bitmap);
// BITMAP_BINDING_TICKET_CASE genuine-bitmap-element-type
engine.captureBitmapBindings(scope, [{}]);
// BITMAP_BINDING_TICKET_CASE no-null-target-array
engine.captureBitmapBindings(scope, null);
// BITMAP_BINDING_TICKET_CASE no-factory-options
engine.captureBitmapBindings(scope, targets, {});
// BITMAP_BINDING_TICKET_CASE required-member-array
ticket.prepare();
// BITMAP_BINDING_TICKET_CASE array-member-shape
ticket.prepare(textureLease);
// BITMAP_BINDING_TICKET_CASE texture-member-type
ticket.prepare([stringLease]);
// BITMAP_BINDING_TICKET_CASE unknown-member-type
ticket.prepare([unknownLease]);
// BITMAP_BINDING_TICKET_CASE no-null-member
ticket.prepare([null]);
// BITMAP_BINDING_TICKET_CASE no-prepare-options
ticket.prepare(members, {});
// BITMAP_BINDING_TICKET_CASE no-commit-argument
ticket.commit(undefined);
// BITMAP_BINDING_TICKET_CASE no-dispose-argument
ticket.dispose(undefined);
// BITMAP_BINDING_TICKET_CASE no-public-state
ticket.state;
// BITMAP_BINDING_TICKET_CASE no-public-opaque-plan
ticket.prepared;
// BITMAP_BINDING_TICKET_CASE no-public-lease-ownership
ticket.currentLeases;
// BITMAP_BINDING_TICKET_CASE no-public-options
ticket.options;
// BITMAP_BINDING_TICKET_CASE synchronous-commit-result
const asynchronousCommit: Promise<void> = ticket.commit();
