// SPDX-License-Identifier: Apache-2.0
// Intentional unsuppressed compiler errors; Root records actual tuples later.
import type { Engine, BitmapBindingTicket, SharedRenderFrame2D, SharedFrameOptions2D,
  Bitmap, AssetLease, Texture } from '@egret/engine';
declare const engine: Engine;
declare const ticket: BitmapBindingTicket;
declare const options: SharedFrameOptions2D;
declare const frame: SharedRenderFrame2D;
declare const overrides: ReadonlyMap<Bitmap, AssetLease<Texture>>;
// CANDIDATE_CASE required-ticket-and-options
engine.capturePreparedSharedFrame();
// CANDIDATE_CASE required-options
engine.capturePreparedSharedFrame(ticket);
// CANDIDATE_CASE no-null-ticket
engine.capturePreparedSharedFrame(null, options);
// CANDIDATE_CASE no-arbitrary-override-map
engine.capturePreparedSharedFrame(overrides, options);
// CANDIDATE_CASE no-extra-public-view-argument
engine.capturePreparedSharedFrame(ticket, options, overrides);
// CANDIDATE_CASE no-reversed-parameters
engine.capturePreparedSharedFrame(options, ticket);
// CANDIDATE_CASE no-null-options
engine.capturePreparedSharedFrame(ticket, null);
// CANDIDATE_CASE exact-options-no-map
engine.capturePreparedSharedFrame(ticket, { width: 8, height: 8, overrides });
// CANDIDATE_CASE synchronous-frame-result
const promise: Promise<SharedRenderFrame2D> = engine.capturePreparedSharedFrame(ticket, options);
// CANDIDATE_CASE no-promise-ready
engine.capturePreparedSharedFrame(ticket, options).ready;
// CANDIDATE_CASE immutable-frame-id
frame.frameId = 10;
// CANDIDATE_CASE immutable-command-table
frame.commands.push(frame.commands[0]!);
// CANDIDATE_CASE no-ticket-candidate-map
ticket.candidateBindings;
// CANDIDATE_CASE unchanged-ticket-commit-arity
ticket.commit(frame);
void promise;
