import { EgretError } from "./EgretError.js";
const types = new WeakSet();
const references = new WeakSet();
function validIdentity(value) {
    return typeof value === "string" && value.trim().length !== 0;
}
export function createAssetType(name, is) {
    if (!validIdentity(name) || typeof is !== "function")
        throw new EgretError("ASSET_TYPE_INVALID");
    const type = Object.freeze({ name, is });
    types.add(type);
    return type;
}
/** Keep the caller's valid ID byte-for-byte; whitespace is not normalization. */
export function createAssetRef(type, id) {
    assertAssetType(type);
    if (!validIdentity(id))
        throw new EgretError("ASSET_REF_INVALID");
    const ref = Object.freeze({ type, id });
    references.add(ref);
    return ref;
}
export function assertAssetType(type) {
    if (typeof type !== "object" || type === null || !types.has(type))
        throw new EgretError("ASSET_TYPE_INVALID");
}
/** Authentication checks happen before reading any structural lookalike getter. */
export function assertAssetRef(ref) {
    if (typeof ref !== "object" || ref === null || !references.has(ref))
        throw new EgretError("ASSET_REF_INVALID");
}
//# sourceMappingURL=AssetRef.js.map