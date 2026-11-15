// SPDX-License-Identifier: Apache-2.0
import { EgretError } from '@egret/runtime';
export function createSequenceTargetClaims() {
    const targets = new WeakMap();
    let size = 0;
    return Object.freeze({
        get size() {
            return size;
        },
        has(target) {
            return targets.has(target);
        },
        acquire(target, token) {
            // Admission is callback-free; refusal never replaces a previous claimant.
            if (size >= 256)
                throw new EgretError('ANIMATION_LIMIT');
            if (targets.has(target))
                throw new EgretError('ANIMATION_TARGET_BUSY');
            targets.set(target, token);
            size++;
        },
        release(target, token) {
            // A historical handle cannot retire a newer claimant of the same Bitmap.
            if (targets.get(target) !== token)
                return;
            targets.delete(target);
            size--;
        }
    });
}
//# sourceMappingURL=sequenceTargetClaims.js.map