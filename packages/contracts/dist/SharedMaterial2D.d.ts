declare const sharedMaterial2DBrand: unique symbol;
type Blend = 'normal' | 'add-accumulate' | 'add-preserve' | 'multiply-factor' | 'screen' | 'erase';
type Domain = 'page' | 'region';
type Filter = 'nearest' | 'linear';
type Address = 'clamp-to-edge' | 'repeat' | 'mirror-repeat';
type Isolation = 'bounded' | 'strict';
export interface SharedMaterialInput2D {
    readonly light?: readonly number[] | undefined;
    readonly dark?: readonly number[] | undefined;
    readonly blend?: Blend | undefined;
    readonly samplingDomain?: Domain | undefined;
    readonly filter?: Filter | undefined;
    readonly addressU?: Address | undefined;
    readonly addressV?: Address | undefined;
    readonly regionIsolation?: Isolation | undefined;
    readonly mipLevel?: number | undefined;
    readonly minFilter?: Filter | undefined;
    readonly magFilter?: Filter | undefined;
    readonly maxAnisotropy?: number | undefined;
}
export interface SharedMaterial2D {
    readonly [sharedMaterial2DBrand]: true;
    readonly light: readonly [number, number, number, number];
    readonly dark: readonly [number, number, number];
    readonly blend: Blend;
    readonly samplingDomain: Domain;
    readonly filter: Filter;
    readonly addressU: Address;
    readonly addressV: Address;
    readonly regionIsolation: Isolation;
    readonly mipLevel: 0;
    readonly minFilter: Filter;
    readonly magFilter: Filter;
    readonly maxAnisotropy: 1;
}
export declare function createSharedMaterial2D(input: SharedMaterialInput2D): SharedMaterial2D;
export declare function isSharedMaterial2D(value: unknown): value is SharedMaterial2D;
export {};
//# sourceMappingURL=SharedMaterial2D.d.ts.map