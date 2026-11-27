// SPDX-License-Identifier: Apache-2.0
const installed = new WeakMap();
const allowed = new Set(['egret', 'eui', 'RES', 'dragonBones']);

export function readProjectMethod(namespace, name) {
  return installed.get(namespace)?.get(name);
}

/** Legacy plugins may install their own methods during startup. Only reviewed slots
 * are writable, and their function values belong to the current game.
 */
export function installProjectMethods(bindings, scope, entries) {
  if (entries === undefined) return bindings;
  if (!Array.isArray(entries)) throw new TypeError('Expected a list of project methods.');
  const output = { ...bindings };
  const groups = new Map();
  for (const { namespace, name } of entries) {
    const original = bindings[namespace];
    if (
      !allowed.has(namespace) ||
      !original ||
      typeof name !== 'string' ||
      !/^[A-Za-z_$][\w$]*$/.test(name) ||
      ['__proto__', 'constructor', 'prototype'].includes(name) ||
      name in original
    )
      throw new TypeError('Invalid or existing project method: ' + namespace + '.' + name);
    let group = groups.get(namespace);
    if (!group) {
      group = {
        surface: Object.create(Object.getPrototypeOf(original), Object.getOwnPropertyDescriptors(original)),
        values: new Map()
      };
      groups.set(namespace, group);
      installed.set(group.surface, group.values);
    }
    if (group.values.has(name)) throw new TypeError('Duplicate project method: ' + name);
    group.values.set(name, undefined);
    Object.defineProperty(group.surface, name, {
      enumerable: true,
      get() {
        return group.values.get(name);
      },
      set(fn) {
        if (scope.signal.aborted) throw new Error('The game owning this method is closed.');
        if (typeof fn !== 'function' && fn !== undefined) throw new TypeError('Expected a project function: ' + name);
        group.values.set(name, fn);
      }
    });
  }
  for (const [namespace, group] of groups) output[namespace] = Object.freeze(group.surface);
  scope.signal.addEventListener(
    'abort',
    () => {
      for (const group of groups.values()) group.values.clear();
    },
    { once: true }
  );
  return Object.freeze(output);
}
