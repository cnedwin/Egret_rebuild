// SPDX-License-Identifier: Apache-2.0
// DOM/Node-free public declaration consumer for the exact binding-ticket contract.
import type { Engine, Scope, Bitmap, Texture, AssetLease, BitmapBindingTicket } from '@egret/engine';

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
type Expect<T extends true> = T;
type Factory = Expect<Equal<Engine['captureBitmapBindings'],
  (scope: Scope, targets: readonly Bitmap[]) => BitmapBindingTicket>>;
type Shape = Expect<Equal<BitmapBindingTicket, {
  prepare(members: readonly AssetLease<Texture>[]): void;
  commit(): void;
  dispose(): void;
}>>;
type Keys = Expect<Equal<keyof BitmapBindingTicket, 'prepare' | 'commit' | 'dispose'>>;
type Prepare = Expect<Equal<BitmapBindingTicket['prepare'], (members: readonly AssetLease<Texture>[]) => void>>;
type Commit = Expect<Equal<BitmapBindingTicket['commit'], () => void>>;
type Dispose = Expect<Equal<BitmapBindingTicket['dispose'], () => void>>;

declare const engine: Engine;
declare const scope: Scope;
declare const left: Bitmap;
declare const right: Bitmap;
declare const first: AssetLease<Texture>;
declare const second: AssetLease<Texture>;
declare const mutableTargets: Bitmap[];
declare const mutableMembers: AssetLease<Texture>[];
const targets: readonly Bitmap[] = [left, right] as const;
const members: readonly AssetLease<Texture>[] = [first, second] as const;
const ticket: BitmapBindingTicket = scope.use(engine.captureBitmapBindings(scope, targets));
const staged: void = ticket.prepare(members);
const committed: void = ticket.commit();
const disposed: void = ticket.dispose();

// These are separate compile-only consumers, not a runtime operation sequence.
const mutableTicket: BitmapBindingTicket = engine.captureBitmapBindings(scope, mutableTargets);
const mutableStaged: void = mutableTicket.prepare(mutableMembers);
const tupleTicket: BitmapBindingTicket = engine.captureBitmapBindings(scope, [left, right] as const);
const repeatedMemberStaged: void = tupleTicket.prepare([first, first] as const);
void [staged, committed, disposed, mutableStaged, repeatedMemberStaged];
export type ExactBitmapBindingTicketContract = Factory | Shape | Keys | Prepare | Commit | Dispose;
