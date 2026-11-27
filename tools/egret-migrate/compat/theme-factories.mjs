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

class AddItems {
  constructor(target, parent, position, relativeTo) {
    Object.assign(this, { target, parent, position, relativeTo });
  }
}

const bindingPlans = new WeakMap();
const safeKey = value =>
  typeof value === 'string' &&
  /^[A-Za-z_$][\w$]*$/.test(value) &&
  !['__proto__', 'constructor', 'prototype'].includes(value);

// An emitted constructor runs before its skin has a host. Let EUI attach the observers with the view.
const Binding = Object.freeze({
  $bindProperties(skin, templates, indices, target, property) {
    if (
      !(skin instanceof Skin) ||
      !Array.isArray(templates) ||
      !templates.length ||
      !Array.isArray(indices) ||
      !safeKey(property) ||
      !target ||
      !(property in target) ||
      typeof target[property] === 'function'
    )
      refuse('Invalid generated skin binding.');
    const dynamic = new Set(indices);
    if (dynamic.size !== indices.length || !indices.every(i => Number.isInteger(i) && i >= 0 && i < templates.length))
      refuse('Invalid generated skin binding indices.');
    const chain = templates.map((term, i) => {
      if (!dynamic.has(i)) {
        if (term !== null && !['string', 'number', 'boolean'].includes(typeof term))
          refuse('Unsupported binding literal.');
        return { literal: term };
      }
      const path = typeof term === 'string' ? term.split('.') : [];
      if (path.length < 2 || path[0] !== 'hostComponent' || !path.every(safeKey))
        refuse('Expected a property path starting at hostComponent.');
      return { path };
    });
    let plans = bindingPlans.get(skin);
    if (!plans) bindingPlans.set(skin, (plans = []));
    plans.push({ target, property, chain });
  }
});

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

function write(target, key, value) {
  return undo => {
    undo.push(write(target, key, target[key]));
    target[key] = value;
  };
}

// Inverses are recorded before calling game setters or stage listeners which may throw.
function place(target, parent, index) {
  return undo => {
    const oldParent = target.parent;
    undo.push(place(target, oldParent, oldParent ? oldParent.getChildIndex(target) : 0));
    if (oldParent) oldParent.removeChild(target);
    if (parent) parent.addChildAt(target, Math.min(index, parent.numChildren));
  };
}

function stateRunner(skin, owner, states) {
  const byName = new Map(),
    participants = new Set();
  const part = key => typeof key === 'string' && Object.hasOwn(skin, key) && skin[key];
  for (const state of states) {
    if (typeof state?.name !== 'string' || byName.has(state.name) || !Array.isArray(state.overrides))
      refuse('Malformed or duplicate precompiled skin state.');
    const actions = state.overrides.map(op => {
      if (op instanceof SetProperty) {
        const target = op.target === '' ? owner : part(op.target);
        if (!target || !safeKey(op.property) || !(op.property in target) || typeof target[op.property] === 'function')
          refuse('Unknown skin state target or property in ' + state.name);
        return write(target, op.property, op.value);
      }
      if (!(op instanceof AddItems)) refuse('Unsupported skin state override in ' + state.name);
      const target = part(op.target),
        container = op.parent === '' ? owner : part(op.parent);
      const anchor = op.position >= 2 ? part(op.relativeTo) : undefined;
      if (
        !target ||
        target === container ||
        typeof target.dispose !== 'function' ||
        typeof container?.addChildAt !== 'function' ||
        ![0, 1, 2, 3].includes(op.position) ||
        (op.position >= 2 && (!anchor || anchor === target))
      )
        refuse('Invalid skin state child in ' + state.name);
      participants.add(target);
      return undo => {
        let index = op.position === 0 ? 0 : container.numChildren;
        if (anchor) {
          index = anchor.parent === container ? container.getChildIndex(anchor) : -1;
          if (index < 0) index = op.position === 2 ? container.numChildren : 0;
          else if (op.position === 3) index++;
        }
        const remove = [];
        try {
          place(target, container, index)(remove);
        } catch (error) {
          undo.push(...remove);
          throw error;
        }
        // A screen can deliberately move a skin part. Leaving the state must respect its new parent.
        undo.push(actions => {
          if (target.parent === container) remove[0](actions);
        });
      };
    });
    byName.set(state.name, actions);
  }
  let restore = [];
  return {
    participants,
    clear() {
      for (const op of restore.splice(0).reverse()) op([]);
    },
    apply(name) {
      const actions = byName.get(name);
      if (!actions) refuse('Unknown skin state: ' + name);
      const prior = [],
        next = [];
      try {
        for (const op of restore.slice().reverse()) op(prior);
        for (const op of actions) op(next);
        restore = next;
      } catch (error) {
        for (const op of [...next.reverse(), ...prior.reverse()]) {
          try {
            op([]);
          } catch {
            /* Preserve the first failing project callback. */
          }
        }
        throw error;
      }
    }
  };
}

function hostControls(eui) {
  const controls = { ...eui, Skin, State, SetProperty, AddItems, Binding };
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
          const { apply, clear, participants } = stateRunner(skin, owner, states);
          return {
            parts: parts.map(key => [key, skin[key]]),
            children,
            owned: [...new Set([...children, ...participants])],
            bindings: bindingPlans.get(skin) ?? [],
            states: states.map(state => state.name),
            apply,
            clear,
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
