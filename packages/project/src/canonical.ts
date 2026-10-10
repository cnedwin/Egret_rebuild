import type { CanonicalInput, Prepared } from "./internal.js";
import { countNodes } from "./live-input.js";
import { utf8Length } from "./unicode.js";

// This private protocol consumes already validated/normalized structures. It
// does not infer project schemas or sort identity collections on callers' behalf.
export function canonicalize(value: CanonicalInput): string {
  const chunks: string[] = [], ancestors = new Set<object>();
  type Work = { value: unknown } | { text: string } | { exit: object };
  const stack: Work[] = [{ value }];
  while (stack.length) {
    const work = stack.pop()!;
    if ("text" in work) { chunks.push(work.text); continue; }
    if ("exit" in work) { ancestors.delete(work.exit); continue; }
    const item = work.value;
    if (item === null || typeof item === "string" || typeof item === "number" || typeof item === "boolean") {
      if (typeof item === "number" && !Number.isFinite(item)) throw new TypeError("Canonical numbers must be finite.");
      if (typeof item === "string" && !utf8Length(item).ok) throw new TypeError("Canonical strings must contain valid Unicode.");
      chunks.push(JSON.stringify(item)); continue;
    }
    if (typeof item !== "object") throw new TypeError("Canonical input must be checked JSON.");
    if (ancestors.has(item)) throw new TypeError("Canonical input contains a cycle.");
    const array = Array.isArray(item), prototype = Object.getPrototypeOf(item);
    if (array ? prototype !== Array.prototype : prototype !== null && prototype !== Object.prototype) throw new TypeError("Canonical input must have plain prototypes.");
    const ownKeys = Reflect.ownKeys(item);
    const keys: string[] = [];
    for (const key of ownKeys) {
      if (array && key === "length") continue;
      if (typeof key !== "string" || !utf8Length(key).ok) throw new TypeError("Canonical keys must be valid Unicode strings.");
      keys.push(key);
    }
    if (array) {
      const length = Object.getOwnPropertyDescriptor(item, "length");
      if (!length || !("value" in length) || length.value !== keys.length || keys.some((key, index) => key !== String(index))) throw new TypeError("Canonical arrays must be contiguous.");
    } else keys.sort(); // ECMAScript default sort compares UTF-16 code units.
    const values: unknown[] = [];
    for (const key of keys) {
      const descriptor = Object.getOwnPropertyDescriptor(item, key);
      if (!descriptor || !descriptor.enumerable || !("value" in descriptor)) throw new TypeError("Canonical input must contain data descriptors.");
      values.push(descriptor.value);
    }
    ancestors.add(item);
    stack.push({ exit: item }, { text: array ? "]" : "}" });
    for (let i = keys.length - 1; i >= 0; i--) {
      stack.push({ value: values[i] });
      if (!array) stack.push({ text: JSON.stringify(keys[i]) + ":" });
      if (i > 0) stack.push({ text: "," });
    }
    chunks.push(array ? "[" : "{");
  }
  return chunks.join("");
}

export function prepareCanonical<T extends CanonicalInput>(value: T): Prepared<T> {
  const canonical = canonicalize(value), bytes = utf8Length(canonical);
  if (!bytes.ok) throw new TypeError("Canonical bytes contain invalid Unicode.");
  return Object.freeze({ value, canonical, utf8Bytes: bytes.value, nodeCount: countNodes(value) });
}
