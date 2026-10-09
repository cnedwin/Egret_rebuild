import { EgretError } from "./EgretError.js";

declare const ASSET_VALUE: unique symbol;

/** Factory identity prevents equal names from aliasing; the phantom is invariant. */
export interface AssetType<T> {
  readonly name: string;
  readonly is: (value: unknown) => value is T;
  readonly [ASSET_VALUE]?: (value: T) => T;
}

/** A stable manager-local identity paired with its invariant value descriptor. */
export interface AssetRef<T> {
  readonly type: AssetType<T>;
  readonly id: string;
}

const types = new WeakSet<object>();
const references = new WeakSet<object>();

function validIdentity(value: unknown): value is string {
  return typeof value === "string" && value.trim().length !== 0;
}

export function createAssetType<T>(name: string, is: (value: unknown) => value is T): AssetType<T> {
  if (!validIdentity(name) || typeof is !== "function") throw new EgretError("ASSET_TYPE_INVALID");
  const type: AssetType<T> = Object.freeze({ name, is });
  types.add(type);
  return type;
}

/** Keep the caller's valid ID byte-for-byte; whitespace is not normalization. */
export function createAssetRef<T>(type: AssetType<T>, id: string): AssetRef<T> {
  assertAssetType(type);
  if (!validIdentity(id)) throw new EgretError("ASSET_REF_INVALID");
  const ref = Object.freeze({ type, id });
  references.add(ref);
  return ref;
}

export function assertAssetType(type: unknown): asserts type is AssetType<never> {
  if (typeof type !== "object" || type === null || !types.has(type)) throw new EgretError("ASSET_TYPE_INVALID");
}

/** Authentication checks happen before reading any structural lookalike getter. */
export function assertAssetRef(ref: unknown): asserts ref is AssetRef<never> {
  if (typeof ref !== "object" || ref === null || !references.has(ref)) throw new EgretError("ASSET_REF_INVALID");
}
