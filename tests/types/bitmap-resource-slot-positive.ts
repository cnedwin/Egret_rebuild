// SPDX-License-Identifier: Apache-2.0
import type {Engine, Scope, Bitmap, Texture, AssetRef, BitmapResourceSlot, BitmapResourceSlotState} from '@egret/engine';

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
type Expect<T extends true> = T;
type State = Expect<Equal<BitmapResourceSlotState, 'idle' | 'pending' | 'ready' | 'failed' | 'conflicted' | 'disposed'>>;
type Factory = Expect<Equal<Engine['createBitmapResourceSlot'], (scope: Scope, bitmap: Bitmap) => BitmapResourceSlot>>;
type Handle = Expect<Equal<BitmapResourceSlot, {
  readonly state: BitmapResourceSlotState;
  replace(ref: AssetRef<Texture>): Promise<void>;
  cancel(reason?: unknown): void;
  dispose(): void;
}>>;
type Keys = Expect<Equal<keyof BitmapResourceSlot, 'state' | 'replace' | 'cancel' | 'dispose'>>;
type Replace = Expect<Equal<BitmapResourceSlot['replace'], (ref: AssetRef<Texture>) => Promise<void>>>;
type Cancel = Expect<Equal<BitmapResourceSlot['cancel'], (reason?: unknown) => void>>;
type Dispose = Expect<Equal<BitmapResourceSlot['dispose'], () => void>>;

declare const engine: Engine;
declare const scope: Scope;
declare const bitmap: Bitmap;
declare const textureRef: AssetRef<Texture>;
const slot: BitmapResourceSlot = scope.use(engine.createBitmapResourceSlot(scope, bitmap));
const state: BitmapResourceSlotState = slot.state;
const replacement: Promise<void> = slot.replace(textureRef);
const allStates: readonly BitmapResourceSlotState[] = ['idle', 'pending', 'ready', 'failed', 'conflicted', 'disposed'];
const cancelled: void = slot.cancel();
slot.cancel(undefined);
slot.cancel(Symbol('authored cancellation reason'));
slot.cancel({reason: 'caller-owned value'});
const disposed: void = slot.dispose();
void [state, replacement, allStates, cancelled, disposed];
export type ExactBitmapResourceSlotContract = State | Factory | Handle | Keys | Replace | Cancel | Dispose;
