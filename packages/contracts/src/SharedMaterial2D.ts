// First-party Apache-2.0 implementation. Material values contain only owned
// CPU data; their identity grants no asset, frame or GPU authority.
declare const sharedMaterial2DBrand: unique symbol;

type Blend = 'normal' | 'add-accumulate' | 'add-preserve' | 'multiply-factor' | 'screen';
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

// All operations used after an external descriptor read are captured once.
// Indexed copying never consults caller iterators, species or inherited slots.
const Numbers = Array;
const isArray = Array.isArray;
const own = Object.prototype.hasOwnProperty;
const defineProperty = Object.defineProperty;
const freeze = Object.freeze;
const apply = Reflect.apply;
const finite = Number.isFinite;
const safeInteger = Number.isSafeInteger;
const fround = Math.fround;
const TypeFault = TypeError;
const RangeFault = RangeError;
const weakHas = WeakMap.prototype.has;
const weakSet = WeakMap.prototype.set;
const owned = new WeakMap<object, true>();
const missing = Symbol('egret.sharedMaterialMissingSlot');

function read(source: object, key: string): unknown {
    try { return (source as Record<string, unknown>)[key]; }
    catch (cause) { throw new TypeFault('Shared material descriptor read failed', { cause }); }
}
function tupleBrand(value: unknown): void {
    let array: boolean;
    try { array = isArray(value); }
    catch (cause) { throw new TypeFault('Shared material descriptor read failed', { cause }); }
    if (!array) throw new TypeFault('Shared material color tuple must be an Array');
}
function readSlot(source: object, index: number): unknown {
    try {
        return apply(own, source, [index]) ? (source as Record<number, unknown>)[index] : missing;
    } catch (cause) { throw new TypeFault('Shared material descriptor read failed', { cause }); }
}
function put(target: unknown[], index: number, value: unknown): void {
    // Null-prototype descriptors exclude inherited get/set members, and defining
    // own elements bypasses any indexed setter on the Array prototype.
    const descriptor = { __proto__: null, value, writable: true, enumerable: true, configurable: true };
    defineProperty(target, index, descriptor);
}
function color(source: readonly unknown[], length: number): readonly number[] {
    const result = new Numbers<number>(length);
    for (let index = 0; index < length; index++) {
        const value = source[index];
        if (typeof value !== 'number' || !finite(value) || value < 0 || value > 1) {
            throw new RangeFault('Shared material numeric range is invalid');
        }
        const rounded = fround(value);
        put(result, index, rounded === 0 ? 0 : rounded);
    }
    return freeze(result);
}
function filter(value: unknown): Filter {
    if (value !== 'nearest' && value !== 'linear') throw new TypeFault('Shared material option is unsupported');
    return value;
}
function address(value: unknown): Address {
    if (value !== 'clamp-to-edge' && value !== 'repeat' && value !== 'mirror-repeat') {
        throw new TypeFault('Shared material option is unsupported');
    }
    return value;
}

export function createSharedMaterial2D(input: SharedMaterialInput2D): SharedMaterial2D {
    if (typeof input !== 'object' || input === null || isArray(input)) {
        throw new TypeFault('Shared material descriptor must be a record');
    }
    // Complete the twelve top-level reads before examining either tuple.
    const lightInput = read(input, 'light');
    const darkInput = read(input, 'dark');
    const blendInput = read(input, 'blend');
    const domainInput = read(input, 'samplingDomain');
    const filterInput = read(input, 'filter');
    const addressUInput = read(input, 'addressU');
    const addressVInput = read(input, 'addressV');
    const isolationInput = read(input, 'regionIsolation');
    const mipInput = read(input, 'mipLevel');
    const minInput = read(input, 'minFilter');
    const magInput = read(input, 'magFilter');
    const anisotropyInput = read(input, 'maxAnisotropy');
    if (lightInput !== undefined) tupleBrand(lightInput);
    if (darkInput !== undefined) tupleBrand(darkInput);
    const lightLength = lightInput === undefined ? 4 : read(lightInput as object, 'length');
    const darkLength = darkInput === undefined ? 3 : read(darkInput as object, 'length');
    if (lightLength !== 4 || darkLength !== 3) throw new RangeFault('Shared material color tuple shape is invalid');
    const lightValues = new Numbers<unknown>(4);
    const darkValues = new Numbers<unknown>(3);
    let hole = false;
    for (let index = 0; index < 4; index++) {
        const value = lightInput === undefined ? 1 : readSlot(lightInput as object, index);
        if (value === missing) hole = true;
        put(lightValues, index, value);
    }
    for (let index = 0; index < 3; index++) {
        const value = darkInput === undefined ? 0 : readSlot(darkInput as object, index);
        if (value === missing) hole = true;
        put(darkValues, index, value);
    }
    // A hole is remembered until all successful own-slot reads finish. No
    // component validation or option failure can hide a later source exception.
    if (hole) throw new RangeFault('Shared material color tuple shape is invalid');
    const light = color(lightValues, 4) as SharedMaterial2D['light'];
    const dark = color(darkValues, 3) as SharedMaterial2D['dark'];
    const blend = blendInput === undefined ? 'normal' : blendInput;
    if (blend !== 'normal' && blend !== 'add-accumulate' && blend !== 'add-preserve' &&
        blend !== 'multiply-factor' && blend !== 'screen') throw new TypeFault('Shared material option is unsupported');
    const samplingDomain = domainInput === undefined ? 'region' : domainInput;
    if (samplingDomain !== 'page' && samplingDomain !== 'region') throw new TypeFault('Shared material option is unsupported');
    const selectedFilter = filter(filterInput === undefined ? 'nearest' : filterInput);
    const addressU = address(addressUInput === undefined ? 'clamp-to-edge' : addressUInput);
    const addressV = address(addressVInput === undefined ? 'clamp-to-edge' : addressVInput);
    const regionIsolation = isolationInput === undefined ? 'bounded' : isolationInput;
    if (regionIsolation !== 'bounded' && regionIsolation !== 'strict') throw new TypeFault('Shared material option is unsupported');
    const mipLevel = mipInput === undefined ? 0 : mipInput;
    if (typeof mipLevel !== 'number' || !safeInteger(mipLevel) || mipLevel < 0) {
        throw new RangeFault('Shared material numeric range is invalid');
    }
    if (mipLevel !== 0) throw new TypeFault('Shared material option is unsupported');
    const minFilter = filter(minInput === undefined ? selectedFilter : minInput);
    const magFilter = filter(magInput === undefined ? selectedFilter : magInput);
    const maxAnisotropy = anisotropyInput === undefined ? 1 : anisotropyInput;
    if (typeof maxAnisotropy !== 'number' || !safeInteger(maxAnisotropy) || maxAnisotropy <= 0) {
        throw new RangeFault('Shared material numeric range is invalid');
    }
    if (maxAnisotropy !== 1) throw new TypeFault('Shared material option is unsupported');
    if (minFilter !== selectedFilter || magFilter !== selectedFilter ||
        (samplingDomain === 'region' && (addressU !== 'clamp-to-edge' || addressV !== 'clamp-to-edge')) ||
        (samplingDomain === 'page' && regionIsolation !== 'bounded')) {
        throw new TypeFault('Shared material option is unsupported');
    }
    // Publication is callback-free. The contracts registry is the only brand
    // owner; runtime and rendering authenticate through the contracts root.
    const material = freeze({ light, dark, blend, samplingDomain, filter: selectedFilter,
        addressU, addressV, regionIsolation, mipLevel: 0, minFilter, magFilter, maxAnisotropy: 1 }) as SharedMaterial2D;
    apply(weakSet, owned, [material, true]);
    return material;
}

export function isSharedMaterial2D(value: unknown): value is SharedMaterial2D {
    return typeof value === 'object' && value !== null && apply(weakHas, owned, [value]);
}
