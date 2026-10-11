import type { Rectangle2D, TextureRegion2D } from '@egret/contracts';
import type { AssetLease } from './AssetLease.js';
import type { Texture } from './Texture.js';
import { Scope } from './Scope.js';
import { EgretError } from './EgretError.js';

export interface TextFieldCommittedDisplay {
  readonly contentBounds: Rectangle2D;
  readonly raster: Rectangle2D | undefined;
  readonly lease: AssetLease<Texture> | undefined;
  readonly sourceRect: TextureRegion2D | undefined;
}
export interface TextFieldDisplayState {
  readonly scope: Scope;
  readonly committed: TextFieldCommittedDisplay | undefined;
}
const states = new WeakMap<object, TextFieldDisplayState>();
const APPLY = Reflect.apply;
const SCOPE_STATE = Object.getOwnPropertyDescriptor(Scope.prototype, 'state')!.get!;

/** Metadata only: default collectors never import the text cache or leaf class. */
export function hasTextFieldState(value: object): boolean { return states.has(value); }
export function readTextFieldState(value: object): TextFieldDisplayState | undefined { return states.get(value); }
export function writeTextFieldState(value: object, state: TextFieldDisplayState): void { states.set(value, state); }
/** A same-name own getter or writable shadow cannot reopen a closing Scope. */
export function assertTextFieldScope(scope: Scope): void {
  if (APPLY(SCOPE_STATE, scope, []) !== 'open') throw new EgretError('SCOPE_CLOSED');
}
