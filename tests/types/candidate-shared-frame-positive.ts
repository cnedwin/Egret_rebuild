// SPDX-License-Identifier: Apache-2.0
// Strict DOM/Node-free public consumers; compile-only, not a runtime sequence.
import type { Engine, Scope, Bitmap, BitmapBindingTicket, AssetLease, Texture,
  SharedFrameOptions2D, SharedRenderFrame2D, SharedRenderHostAdapter } from '@egret/engine';
import type { SharedRenderFrame2D as ContractFrame } from '@egret/contracts';

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2)
  ? (<T>() => T extends B ? 1 : 2) extends (<T>() => T extends A ? 1 : 2) ? true : false : false;
type Expect<T extends true> = T;
export type ExactCapture = Expect<Equal<Engine['capturePreparedSharedFrame'],
  (ticket: BitmapBindingTicket, options: SharedFrameOptions2D) => SharedRenderFrame2D>>;
export type OneFrameAuthority = Expect<Equal<SharedRenderFrame2D, ContractFrame>>;
export type UnchangedTicket = Expect<Equal<keyof BitmapBindingTicket, 'prepare' | 'commit' | 'dispose'>>;
export type UnchangedOptions = Expect<Equal<keyof SharedFrameOptions2D,
  'width' | 'height' | 'clearColor' | 'clearAlpha' | 'outputAlpha'>>;
declare const engine: Engine;
declare const scope: Scope;
declare const targets: readonly Bitmap[];
declare const members: readonly AssetLease<Texture>[];
declare const host: SharedRenderHostAdapter;
const ticket: BitmapBindingTicket = engine.captureBitmapBindings(scope, targets);
const prepared: void = ticket.prepare(members);
const options: SharedFrameOptions2D = { width: 64, height: 48, outputAlpha: 'opaque', clearAlpha: 1 };
const frame: SharedRenderFrame2D = engine.capturePreparedSharedFrame(ticket, options);
const shared: ContractFrame = frame;
const submitted: undefined = host.renderSharedFrame(frame);
const committed: void = ticket.commit();
const disposed: void = ticket.dispose();
void [prepared, shared, submitted, committed, disposed];
