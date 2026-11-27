// SPDX-License-Identifier: Apache-2.0
/** Mount project-owned namespace additions against the current game scope before classic scripts execute. */
export function extendProjectBindings(base, scope, provider) {
  if (provider === undefined) return base;
  if (typeof provider !== 'function') throw new TypeError('Expected a project binding provider.');
  const additions = provider(base, scope);
  if (
    additions === null ||
    typeof additions !== 'object' ||
    ![null, Object.prototype].includes(Object.getPrototypeOf(additions))
  )
    throw new TypeError('Project bindings must be returned synchronously.');
  const output = { ...base };
  for (const [namespace, group] of Object.entries(Object.getOwnPropertyDescriptors(additions))) {
    if (
      !['egret', 'eui', 'RES', 'dragonBones'].includes(namespace) ||
      !base[namespace] ||
      !('value' in group) ||
      !group.value ||
      typeof group.value !== 'object'
    )
      throw new TypeError('Unknown or unavailable classic namespace: ' + namespace);
    const original = base[namespace];
    const surface = Object.create(Object.getPrototypeOf(original), Object.getOwnPropertyDescriptors(original));
    for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(group.value))) {
      if (
        !/^[A-Za-z_$][\w$]*$/.test(key) ||
        key in original ||
        ['prototype', 'constructor', '__proto__'].includes(key) ||
        !('value' in descriptor)
      )
        throw new TypeError('Conflicting or invalid project binding: ' + namespace + '.' + key);
      Object.defineProperty(surface, key, descriptor);
    }
    output[namespace] = Object.freeze(surface);
  }
  return Object.freeze(output);
}
