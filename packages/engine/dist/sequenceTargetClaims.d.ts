import type { Bitmap } from '@egret/runtime';
/** Private Engine-owned claims shared by the original and optional playback profiles. */
export interface SequenceTargetClaims {
    readonly size: number;
    has(target: Bitmap): boolean;
    acquire(target: Bitmap, token: object): void;
    release(target: Bitmap, token: object): void;
}
export declare function createSequenceTargetClaims(): SequenceTargetClaims;
//# sourceMappingURL=sequenceTargetClaims.d.ts.map