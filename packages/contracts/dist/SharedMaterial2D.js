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
const owned = new WeakMap();
const missing = Symbol('egret.sharedMaterialMissingSlot');
function read(source, key) {
    try {
        return source[key];
    }
    catch (cause) {
        throw new TypeFault('Shared material descriptor read failed', { cause });
    }
}
function tupleBrand(value) {
    let array;
    try {
        array = isArray(value);
    }
    catch (cause) {
        throw new TypeFault('Shared material descriptor read failed', { cause });
    }
    if (!array)
        throw new TypeFault('Shared material color tuple must be an Array');
}
function readSlot(source, index) {
    try {
        return apply(own, source, [index]) ? source[index] : missing;
    }
    catch (cause) {
        throw new TypeFault('Shared material descriptor read failed', { cause });
    }
}
function put(target, index, value) {
    // Null-prototype descriptors exclude inherited get/set members, and defining
    // own elements bypasses any indexed setter on the Array prototype.
    const descriptor = { __proto__: null, value, writable: true, enumerable: true, configurable: true };
    defineProperty(target, index, descriptor);
}
function color(source, length) {
    const result = new Numbers(length);
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
function filter(value) {
    if (value !== 'nearest' && value !== 'linear')
        throw new TypeFault('Shared material option is unsupported');
    return value;
}
function address(value) {
    if (value !== 'clamp-to-edge' && value !== 'repeat' && value !== 'mirror-repeat') {
        throw new TypeFault('Shared material option is unsupported');
    }
    return value;
}
export function createSharedMaterial2D(input) {
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
    if (lightInput !== undefined)
        tupleBrand(lightInput);
    if (darkInput !== undefined)
        tupleBrand(darkInput);
    const lightLength = lightInput === undefined ? 4 : read(lightInput, 'length');
    const darkLength = darkInput === undefined ? 3 : read(darkInput, 'length');
    if (lightLength !== 4 || darkLength !== 3)
        throw new RangeFault('Shared material color tuple shape is invalid');
    const lightValues = new Numbers(4);
    const darkValues = new Numbers(3);
    let hole = false;
    for (let index = 0; index < 4; index++) {
        const value = lightInput === undefined ? 1 : readSlot(lightInput, index);
        if (value === missing)
            hole = true;
        put(lightValues, index, value);
    }
    for (let index = 0; index < 3; index++) {
        const value = darkInput === undefined ? 0 : readSlot(darkInput, index);
        if (value === missing)
            hole = true;
        put(darkValues, index, value);
    }
    // A hole is remembered until all successful own-slot reads finish. No
    // component validation or option failure can hide a later source exception.
    if (hole)
        throw new RangeFault('Shared material color tuple shape is invalid');
    const light = color(lightValues, 4);
    const dark = color(darkValues, 3);
    const blend = blendInput === undefined ? 'normal' : blendInput;
    if (blend !== 'normal' &&
        blend !== 'add-accumulate' &&
        blend !== 'add-preserve' &&
        blend !== 'multiply-factor' &&
        blend !== 'screen' &&
        blend !== 'erase')
        throw new TypeFault('Shared material option is unsupported');
    const samplingDomain = domainInput === undefined ? 'region' : domainInput;
    if (samplingDomain !== 'page' && samplingDomain !== 'region')
        throw new TypeFault('Shared material option is unsupported');
    const selectedFilter = filter(filterInput === undefined ? 'nearest' : filterInput);
    const addressU = address(addressUInput === undefined ? 'clamp-to-edge' : addressUInput);
    const addressV = address(addressVInput === undefined ? 'clamp-to-edge' : addressVInput);
    const regionIsolation = isolationInput === undefined ? 'bounded' : isolationInput;
    if (regionIsolation !== 'bounded' && regionIsolation !== 'strict')
        throw new TypeFault('Shared material option is unsupported');
    const mipLevel = mipInput === undefined ? 0 : mipInput;
    if (typeof mipLevel !== 'number' || !safeInteger(mipLevel) || mipLevel < 0) {
        throw new RangeFault('Shared material numeric range is invalid');
    }
    if (mipLevel !== 0)
        throw new TypeFault('Shared material option is unsupported');
    const minFilter = filter(minInput === undefined ? selectedFilter : minInput);
    const magFilter = filter(magInput === undefined ? selectedFilter : magInput);
    const maxAnisotropy = anisotropyInput === undefined ? 1 : anisotropyInput;
    if (typeof maxAnisotropy !== 'number' || !safeInteger(maxAnisotropy) || maxAnisotropy <= 0) {
        throw new RangeFault('Shared material numeric range is invalid');
    }
    if (maxAnisotropy !== 1)
        throw new TypeFault('Shared material option is unsupported');
    if (minFilter !== selectedFilter ||
        magFilter !== selectedFilter ||
        (samplingDomain === 'region' && (addressU !== 'clamp-to-edge' || addressV !== 'clamp-to-edge')) ||
        (samplingDomain === 'page' && regionIsolation !== 'bounded')) {
        throw new TypeFault('Shared material option is unsupported');
    }
    // Publication is callback-free. The contracts registry is the only brand
    // owner; runtime and rendering authenticate through the contracts root.
    const material = freeze({
        light,
        dark,
        blend,
        samplingDomain,
        filter: selectedFilter,
        addressU,
        addressV,
        regionIsolation,
        mipLevel: 0,
        minFilter,
        magFilter,
        maxAnisotropy: 1
    });
    apply(weakSet, owned, [material, true]);
    return material;
}
export function isSharedMaterial2D(value) {
    return typeof value === 'object' && value !== null && apply(weakHas, owned, [value]);
}
//# sourceMappingURL=SharedMaterial2D.js.map