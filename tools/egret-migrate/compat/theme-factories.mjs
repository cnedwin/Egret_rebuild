// SPDX-License-Identifier: Apache-2.0
// Classic generated subclasses call Skin with Function.call before filling their fields.
function Skin() {}

class State {
  constructor(name, overrides) {
    this.name = name;
    this.overrides = overrides;
  }
}
class SetProperty {
  constructor(target, property, value) {
    this.target = target;
    this.property = property;
    this.value = value;
  }
}

function inherit(child, parent) {
  if (typeof parent !== 'function') throw new TypeError('Missing precompiled skin superclass.');
  Object.setPrototypeOf(child, parent);
  child.prototype = Object.create(parent.prototype, {
    constructor: { value: child, writable: true, configurable: true }
  });
}

function refuse(message, cause) {
  throw Object.assign(new Error(message, cause ? { cause } : undefined), { code: 'LEGACY_THEME_FACTORY' });
}

function stateRunner(skin, owner, states) {
  const byName = new Map();
  for (const state of states) {
    if (typeof state?.name !== 'string' || byName.has(state.name) || !Array.isArray(state.overrides))
      refuse('Malformed or duplicate precompiled skin state.');
    byName.set(
      state.name,
      state.overrides.map(op => {
        if (
          !(op instanceof SetProperty) ||
          typeof op.property !== 'string' ||
          ['__proto__', 'constructor', 'prototype'].includes(op.property)
        )
          refuse('Unsupported skin state override in ' + state.name);
        const node = op.target === '' ? owner : Object.hasOwn(skin, op.target) && skin[op.target];
        if (!node || !(op.property in node) || typeof node[op.property] === 'function')
          refuse('Unknown skin state target or property in ' + state.name);
        return [node, op.property, op.value];
      })
    );
  }
  let restore = [];
  return name => {
    const writes = byName.get(name);
    if (!writes) refuse('Unknown skin state: ' + name);
    const undo = [],
      nextRestore = [];
    function write(node, key, value) {
      const previous = node[key];
      undo.push([node, key, previous]);
      node[key] = value;
      return previous;
    }
    try {
      for (let index = restore.length - 1; index >= 0; index--) write(...restore[index]);
      for (const [node, key, value] of writes) nextRestore.push([node, key, write(node, key, value)]);
      restore = nextRestore;
    } catch (error) {
      for (const [node, key, previous] of undo.reverse()) {
        try {
          node[key] = previous;
        } catch {
          /* Preserve the first failing project setter. */
        }
      }
      throw error;
    }
  };
}

function hostControls(eui) {
  const controls = { ...eui, Skin, State, SetProperty };
  let active;
  for (const [name, Base] of Object.entries(eui)) {
    if (
      name === 'Skin' ||
      typeof Base !== 'function' ||
      !(Base === eui.Component || Base.prototype instanceof eui.Component || Base === eui.Label)
    )
      continue;
    controls[name] = new Proxy(Base, {
      construct(Type, args, newTarget) {
        const node = Reflect.construct(Type, args, newTarget);
        if (active && newTarget === controls[name]) active.push({ node, initial: new Set(Object.keys(node)), name });
        return node;
      }
    });
  }
  return {
    controls,
    construct(Type, validate) {
      const previous = active;
      const created = [];
      active = created;
      try {
        const skin = new Type();
        for (const { node, initial, name } of created) {
          for (const key of Object.keys(node)) {
            // Detect writes to missing EUI setters. Game-owned custom controls keep their own fields.
            if (!initial.has(key) && !(key in Object.getPrototypeOf(node)))
              refuse('Unsupported compiled EUI property: ' + name + '.' + key);
          }
        }
        return validate(skin);
      } catch (error) {
        for (const { node } of created.reverse()) if (!node.isDisposed) node.dispose();
        throw error;
      } finally {
        active = previous;
      }
    }
  };
}

/** Install a reviewed project provider in one EUI host. Both class names and original paths remain usable. */
export function registerLegacyThemeFactories(eui, manifest, { root = globalThis, egret, namespaces = {} } = {}) {
  if (
    manifest?.schemaVersion !== 1 ||
    !['gjs', 'registry'].includes(manifest.format) ||
    !Array.isArray(manifest.entries) ||
    !Object.hasOwn(root, manifest.global)
  )
    refuse('The reviewed theme factory script has not loaded.');
  const host = hostControls(eui);
  const environment = { ...namespaces, egret, __extends: inherit, eui: host.controls };
  const provider = manifest.format === 'gjs' ? root[manifest.global](environment) : root[manifest.global];
  if (typeof provider?.get !== 'function' || typeof provider.names !== 'function')
    refuse('The theme provider must implement get and names.');
  const available = new Set(provider.names()),
    factories = new Map(),
    types = new Map();
  for (const row of manifest.entries) {
    if (!available.has(row.className) || factories.has(row.path) || factories.has(row.className))
      refuse('Missing or duplicate precompiled skin: ' + row.className);
    const Type = provider.get(row.className);
    if (typeof Type !== 'function') refuse('Theme class is unavailable: ' + row.className);
    types.set(row.className, Type);
    const build = owner => {
      try {
        return host.construct(Type, skin => {
          const parts = skin.skinParts ?? [],
            children = skin.elementsContent ?? [],
            states = skin.states ?? [];
          if (
            ![parts, children, states].every(Array.isArray) ||
            new Set(parts).size !== parts.length ||
            !parts.every(key => typeof key === 'string' && Object.hasOwn(skin, key))
          )
            refuse('Invalid precompiled skin parts: ' + row.className);
          const apply = stateRunner(skin, owner, states);
          return {
            parts: parts.map(key => [key, skin[key]]),
            children,
            states: states.map(state => state.name),
            apply,
            skin
          };
        });
      } catch (error) {
        refuse('Could not construct ' + row.className + ': ' + String(error?.message ?? error), error);
      }
    };
    factories.set(row.path, build);
    factories.set(row.className, build);
  }
  eui.registerPrecompiledSkins(factories, manifest.skins, types);
}
