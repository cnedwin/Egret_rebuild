// SPDX-License-Identifier: Apache-2.0
/** Inspect descriptors on trusted, non-Proxy host bindings without evaluating property getters. */
export function checkLegacyBindings(bindings, entries) {
  return entries.map(entry => {
    let value = bindings;
    let status = 'present';
    const path = [entry.namespace, ...entry.members];
    for (const [index, name] of path.entries()) {
      let object = value;
      let property;
      while (object != null) {
        property = Object.getOwnPropertyDescriptor(object, name);
        if (property) break;
        object = Object.getPrototypeOf(object);
      }
      if (!property) {
        status = 'requires-binding';
        break;
      }
      if (!('value' in property) && index < path.length - 1) {
        status = 'runtime-value';
        break;
      }
      value = property.value;
    }
    if (entry.dynamic && status === 'present') status = 'runtime-value';
    return { ...entry, status };
  });
}
