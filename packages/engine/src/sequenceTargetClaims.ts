// SPDX-License-Identifier: Apache-2.0
import {EgretError} from '@egret/runtime';
import type {Bitmap} from '@egret/runtime';

/** Private Engine-owned claims shared by the original and optional playback profiles. */
export interface SequenceTargetClaims {
  readonly size: number;
  has(target: Bitmap): boolean;
  acquire(target: Bitmap, token: object): void;
  release(target: Bitmap, token: object): void;
}

export function createSequenceTargetClaims(): SequenceTargetClaims {
  const targets = new WeakMap<Bitmap, object>();
  let size = 0;
  return Object.freeze({
    get size(): number { return size; },
    has(target: Bitmap): boolean { return targets.has(target); },
    acquire(target: Bitmap, token: object): void {
      // Admission is callback-free; refusal never replaces a previous claimant.
      if (size >= 256) throw new EgretError('ANIMATION_LIMIT');
      if (targets.has(target)) throw new EgretError('ANIMATION_TARGET_BUSY');
      targets.set(target, token);
      size++;
    },
    release(target: Bitmap, token: object): void {
      // A historical handle cannot retire a newer claimant of the same Bitmap.
      if (targets.get(target) !== token) return;
      targets.delete(target);
      size--;
    },
  });
}
