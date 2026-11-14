// SPDX-License-Identifier: Apache-2.0
import { EgretError } from '@egret/runtime';
import type { DisplayObject } from '@egret/runtime';
import type {
  SemanticAction, SemanticBounds, SemanticChecked, SemanticDescription, SemanticNode, SemanticNodeOptions, SemanticOrientation,
  SemanticPosition, SemanticRange, SemanticRole, SemanticSnapshot, SemanticSnapshotNode, SemanticsState, UiSemantics, UiSemanticsOptions,
} from './semanticTypes.js';

interface Rule {
  /** A leaf has no nodes inside it: assistive technology reads it as one thing. */
  readonly leaf: boolean;
  readonly named: boolean;
  /** The role its parent must have. */
  readonly inside?: SemanticRole;
  readonly fields: readonly string[];
}
const rules: Readonly<Record<SemanticRole, Rule>> = Object.freeze({
  group: { leaf: false, named: false, fields: ['disabled'] },
  image: { leaf: true, named: true, fields: [] },
  text: { leaf: true, named: true, fields: [] },
  button: { leaf: true, named: true, fields: ['disabled', 'expanded'] },
  checkbox: { leaf: true, named: true, fields: ['disabled', 'checked'] },
  switch: { leaf: true, named: true, fields: ['disabled', 'checked'] },
  radiogroup: { leaf: false, named: false, fields: ['disabled'] },
  radio: { leaf: true, named: true, inside: 'radiogroup', fields: ['disabled', 'checked', 'position'] },
  listbox: { leaf: false, named: false, fields: ['disabled'] },
  option: { leaf: true, named: true, inside: 'listbox', fields: ['disabled', 'selected', 'position'] },
  list: { leaf: false, named: false, fields: [] },
  listitem: { leaf: false, named: false, inside: 'list', fields: ['position'] },
  scrollbar: { leaf: true, named: true, fields: ['disabled', 'range', 'orientation', 'controls'] },
  slider: { leaf: true, named: true, fields: ['disabled', 'range', 'orientation'] },
  dialog: { leaf: false, named: true, fields: ['modal'] },
  textbox: { leaf: true, named: true, fields: ['disabled', 'value', 'multiline'] },
});
/** State that belongs to some roles only. A description that sets one its role does not have is refused. */
const particular = ['disabled', 'checked', 'selected', 'expanded', 'modal', 'multiline', 'range', 'orientation', 'controls', 'position', 'value'] as const;
const offers: Readonly<Record<string, readonly SemanticAction[]>> = Object.freeze({
  '': Object.freeze([]), a: Object.freeze(['activate']), f: Object.freeze(['focus']), af: Object.freeze(['activate', 'focus']),
} as Record<string, readonly SemanticAction[]>);

interface Entry {
  readonly id: string;
  readonly role: SemanticRole;
  readonly parent: Entry | undefined;
  readonly children: Entry[];
  readonly describe: () => SemanticDescription;
  readonly onActivate: (() => void) | undefined;
  readonly onFocus: (() => void) | undefined;
  readonly handle: SemanticNode;
  attached: boolean;
}
interface Draft { readonly entry: Entry; readonly order: number; readonly node: Omit<SemanticSnapshotNode, 'inert'>; }

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const flag = (value: unknown): value is boolean | undefined => value === undefined || typeof value === 'boolean';
const identifier = (value: unknown): value is string => typeof value === 'string' && value.length >= 1 && value.length <= 128 && !value.includes('\0');

function sameNode(a: SemanticSnapshotNode, b: SemanticSnapshotNode): boolean {
  return a.id === b.id && a.role === b.role && a.parent === b.parent && a.name === b.name && a.disabled === b.disabled && a.focused === b.focused
    && a.inert === b.inert && a.actions === b.actions && a.value === b.value && a.checked === b.checked && a.selected === b.selected
    && a.expanded === b.expanded && a.modal === b.modal && a.multiline === b.multiline && a.orientation === b.orientation && a.controls === b.controls
    && a.bounds.x === b.bounds.x && a.bounds.y === b.bounds.y && a.bounds.width === b.bounds.width && a.bounds.height === b.bounds.height
    && a.range?.now === b.range?.now && a.range?.min === b.range?.min && a.range?.max === b.range?.max
    && a.position?.index === b.position?.index && a.position?.size === b.position?.size;
}

/**
 * The rectangle on the stage that encloses a display object and what it holds, for the bounds of
 * a node. It is measured when it is called, so call it from `describe`.
 */
export function semanticBoundsOf(target: DisplayObject): SemanticBounds {
  const local = target.getBounds(), right = local.x + local.width, bottom = local.y + local.height;
  const corners = [target.localToGlobal(local.x, local.y), target.localToGlobal(right, local.y), target.localToGlobal(right, bottom), target.localToGlobal(local.x, bottom)];
  const xs = corners.map(point => point.x), ys = corners.map(point => point.y), x = Math.min(...xs), y = Math.min(...ys);
  return Object.freeze({ x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y });
}

/** A semantic tree for the controls an application draws. It reads them; it holds no state of theirs. */
export function createUiSemantics(options: UiSemanticsOptions = {}): UiSemantics {
  if (options === null || typeof options !== 'object' || Array.isArray(options)) throw new EgretError('UI_SEMANTICS_OPTIONS');
  const maxNodes = options.maxNodes ?? 256;
  if (!Number.isInteger(maxNodes) || maxNodes < 1 || maxNodes > 4096) throw new EgretError('UI_SEMANTICS_OPTIONS');
  const entries = new Map<string, Entry>(), roots: Entry[] = [];
  const listeners = new Set<(snapshot: SemanticSnapshot, previous: SemanticSnapshot) => void>(), closers = new Set<() => void>();
  let snapshot: SemanticSnapshot = Object.freeze({ revision: 0, layoutRevision: undefined, nodes: Object.freeze([]), focused: undefined });
  /** The entry each published node was read from: an id may since have been removed and used again. */
  let published = new Map<string, { readonly node: SemanticSnapshotNode; readonly entry: Entry }>();
  let state: SemanticsState = 'active', publishing = false, telling = false;

  function open(): void {
    if (state === 'closed') throw new EgretError('UI_SEMANTICS_CLOSED');
    if (publishing) throw new EgretError('UI_SEMANTICS_REENTRANT');
  }
  function detach(entry: Entry): void {
    entry.attached = false;
    entries.delete(entry.id);
    for (const child of entry.children.splice(0)) detach(child);
  }
  function add(node: SemanticNodeOptions): SemanticNode {
    open();
    if (node === null || typeof node !== 'object') throw new EgretError('UI_SEMANTICS_OPTIONS');
    const { id, role, parent: parentId, describe, onActivate, onFocus } = node;
    if (!identifier(id) || typeof role !== 'string' || !Object.hasOwn(rules, role) || typeof describe !== 'function'
      || (parentId !== undefined && !identifier(parentId)) || (onActivate !== undefined && typeof onActivate !== 'function')
      || (onFocus !== undefined && typeof onFocus !== 'function')) throw new EgretError('UI_SEMANTICS_OPTIONS');
    if (entries.has(id)) throw new EgretError('UI_SEMANTICS_DUPLICATE');
    const parent = parentId === undefined ? undefined : entries.get(parentId), rule = rules[role];
    // A leaf is read as one thing, and a radio, an option or a list item means nothing outside its container.
    if ((parentId !== undefined && parent === undefined) || (parent !== undefined && rules[parent.role].leaf)
      || (rule.inside !== undefined && parent?.role !== rule.inside)) throw new EgretError('UI_SEMANTICS_PARENT');
    if (entries.size >= maxNodes) throw new EgretError('UI_SEMANTICS_CAPACITY');
    const entry: Entry = {
      id, role, parent, children: [], describe, onActivate, onFocus, attached: true,
      handle: Object.freeze({
        id, role, parent: parentId,
        get attached(): boolean { return entry.attached; },
        remove(): void {
          if (!entry.attached) return;
          if (publishing) throw new EgretError('UI_SEMANTICS_REENTRANT');
          const siblings = entry.parent === undefined ? roots : entry.parent.children, index = siblings.indexOf(entry);
          if (index >= 0) siblings.splice(index, 1);
          detach(entry);
        },
      }),
    };
    entries.set(id, entry);
    (parent === undefined ? roots : parent.children).push(entry);
    return entry.handle;
  }

  /** One description, checked against its role. Undefined for a hidden node. */
  function read(entry: Entry): Draft | undefined {
    let described: SemanticDescription;
    try { described = entry.describe(); } catch (cause) { throw new EgretError('UI_SEMANTICS_DESCRIBE_FAILED', { cause }); }
    const refuse = (field: string): EgretError => new EgretError('UI_SEMANTICS_DESCRIPTION', { cause: new TypeError(entry.id + ': ' + field) });
    if (described === null || typeof described !== 'object' || Array.isArray(described)) throw refuse('description');
    const rule = rules[entry.role];
    const { bounds, name = '', hidden, focused, order = 0, disabled, checked, selected, expanded, modal, multiline, range, orientation, controls, position, value } = described;
    if (!flag(hidden)) throw refuse('hidden');
    if (hidden === true) return undefined;
    for (const field of particular) if (described[field] !== undefined && !rule.fields.includes(field)) throw refuse(field);
    if (bounds === null || typeof bounds !== 'object' || !finite(bounds.x) || !finite(bounds.y) || !finite(bounds.width) || !finite(bounds.height)
      || bounds.width < 0 || bounds.height < 0) throw refuse('bounds');
    if (typeof name !== 'string' || name.length > 1024 || (rule.named && !/\S/.test(name))) throw refuse('name');
    if (!flag(focused)) throw refuse('focused');
    if (!finite(order)) throw refuse('order');
    if (!flag(disabled)) throw refuse('disabled');
    if (!flag(expanded)) throw refuse('expanded');
    if (!flag(modal)) throw refuse('modal');
    if (!flag(multiline)) throw refuse('multiline');
    const checkable = rule.fields.includes('checked');
    if (checkable ? typeof checked !== 'boolean' && !(checked === 'mixed' && entry.role === 'checkbox') : checked !== undefined) throw refuse('checked');
    if (entry.role === 'option' ? typeof selected !== 'boolean' : selected !== undefined) throw refuse('selected');
    if (value !== undefined && (typeof value !== 'string' || value.length > 16384)) throw refuse('value');
    const ranged = entry.role === 'scrollbar' || entry.role === 'slider';
    if (ranged ? (range === null || typeof range !== 'object' || !finite(range.now) || !finite(range.min) || !finite(range.max)
      || range.min > range.now || range.now > range.max) : range !== undefined) throw refuse('range');
    if (orientation !== undefined && orientation !== 'horizontal' && orientation !== 'vertical') throw refuse('orientation');
    if (controls !== undefined && (!identifier(controls) || controls === entry.id)) throw refuse('controls');
    if (position !== undefined && (position === null || typeof position !== 'object' || !Number.isSafeInteger(position.index)
      || !Number.isSafeInteger(position.size) || position.index < 1 || position.index > position.size)) throw refuse('position');
    return {
      entry, order,
      node: {
        id: entry.id, role: entry.role, parent: entry.parent?.id, name,
        bounds: Object.freeze({ x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height }),
        disabled: disabled === true, focused: focused === true,
        actions: offers[(entry.onActivate === undefined ? '' : 'a') + (entry.onFocus === undefined ? '' : 'f')]!,
        value: entry.role === 'textbox' ? value ?? '' : undefined,
        checked: checked as SemanticChecked | undefined, selected, expanded,
        modal: entry.role === 'dialog' ? modal === true : undefined,
        multiline: entry.role === 'textbox' ? multiline === true : undefined,
        range: range === undefined ? undefined : Object.freeze({ now: range.now, min: range.min, max: range.max }) as SemanticRange,
        // A scroll bar stands beside what it scrolls; a slider lies along the line it is read in.
        orientation: ranged ? (orientation ?? (entry.role === 'scrollbar' ? 'vertical' : 'horizontal')) as SemanticOrientation : undefined,
        controls,
        position: position === undefined ? undefined : Object.freeze({ index: position.index, size: position.size }) as SemanticPosition,
      },
    };
  }
  function collect(siblings: readonly Entry[], into: Draft[]): void {
    const drafts: Draft[] = [];
    // A snapshot of the list: a description may not change the tree, and is refused if it tries.
    for (const entry of [...siblings]) { const draft = read(entry); if (draft !== undefined) drafts.push(draft); }
    // The sort is stable: nodes of equal order stay in the order they were added.
    drafts.sort((a, b) => a.order - b.order);
    for (const draft of drafts) { into.push(draft); collect(draft.entry.children, into); }
  }
  function publish(layoutRevision?: number): SemanticSnapshot {
    open();
    if (telling) throw new EgretError('UI_SEMANTICS_REENTRANT');
    if (layoutRevision !== undefined && (!Number.isSafeInteger(layoutRevision) || layoutRevision < 0
      || (snapshot.layoutRevision !== undefined && layoutRevision < snapshot.layoutRevision))) throw new EgretError('UI_SEMANTICS_REVISION');
    const drafts: Draft[] = [];
    publishing = true;
    try { collect(roots, drafts); } finally { publishing = false; }
    const present = new Map<string, Draft>(drafts.map(draft => [draft.entry.id, draft]));
    // The modal dialog read last is the one in front. It, what is inside it and what it is inside stay live.
    let modal: Draft | undefined;
    for (const draft of drafts) if (draft.node.modal === true) modal = draft;
    const live = new Set<Entry>();
    for (let entry = modal?.entry; entry !== undefined; entry = entry.parent) live.add(entry);
    const within = (entry: Entry): boolean => { for (let at: Entry | undefined = entry; at !== undefined; at = at.parent) if (at === modal!.entry) return true; return false; };
    const next = new Map<string, { readonly node: SemanticSnapshotNode; readonly entry: Entry }>(), nodes: SemanticSnapshotNode[] = [];
    let focused: string | undefined, changed = drafts.length !== snapshot.nodes.length || layoutRevision !== snapshot.layoutRevision;
    for (const [index, draft] of drafts.entries()) {
      const inert = modal !== undefined && !live.has(draft.entry) && !within(draft.entry);
      if (draft.node.controls !== undefined && !present.has(draft.node.controls)) throw new EgretError('UI_SEMANTICS_RELATION', { cause: new TypeError(draft.entry.id + ': controls') });
      if (draft.node.focused) {
        // One node holds the focus, and never one a modal dialog has made inert.
        if (focused !== undefined || inert) throw new EgretError('UI_SEMANTICS_FOCUS', { cause: new TypeError(draft.entry.id + ': focused') });
        focused = draft.entry.id;
      }
      const fresh: SemanticSnapshotNode = { ...draft.node, inert }, before = snapshot.nodes[index];
      const node = before !== undefined && sameNode(before, fresh) ? before : Object.freeze(fresh);
      if (node !== before) changed = true;
      nodes.push(node);
      next.set(node.id, { node, entry: draft.entry });
    }
    published = next;
    if (!changed) return snapshot;
    if (!Number.isSafeInteger(snapshot.revision + 1)) throw new EgretError('UI_SEMANTICS_EXHAUSTED');
    const previous = snapshot;
    snapshot = Object.freeze({ revision: previous.revision + 1, layoutRevision, nodes: Object.freeze(nodes), focused });
    // Published before anyone is told: a listener that fails does not undo it.
    let first: unknown, failed = false;
    const rest: unknown[] = [];
    telling = true;
    try {
      for (const listener of [...listeners]) {
        if (state === 'closed') break;
        if (listeners.has(listener)) try { listener(snapshot, previous); } catch (cause) { if (failed) rest.push(cause); else { failed = true; first = cause; } }
      }
    } finally { telling = false; }
    if (failed) throw new EgretError('UI_SEMANTICS_LISTENER_FAILED', { cause: first, cleanupErrors: rest });
    return snapshot;
  }
  function perform(id: string, action: SemanticAction): boolean {
    if (!identifier(id) || (action !== 'activate' && action !== 'focus')) throw new EgretError('UI_SEMANTICS_OPTIONS');
    if (state === 'closed') return false;
    if (publishing) throw new EgretError('UI_SEMANTICS_REENTRANT');
    const found = published.get(id);
    if (found === undefined || !found.entry.attached || found.node.disabled || found.node.inert) return false;
    const handler = action === 'activate' ? found.entry.onActivate : found.entry.onFocus;
    if (handler === undefined) return false;
    handler();
    return true;
  }
  function dispose(): void {
    if (state === 'closed') return;
    if (publishing) throw new EgretError('UI_SEMANTICS_REENTRANT');
    state = 'closed';
    for (const entry of roots.splice(0)) detach(entry);
    published = new Map();
    listeners.clear();
    const callbacks = [...closers];
    closers.clear();
    let first: unknown, failed = false;
    const rest: unknown[] = [];
    for (const callback of callbacks) try { callback(); } catch (cause) { if (failed) rest.push(cause); else { failed = true; first = cause; } }
    if (failed) throw new EgretError('UI_SEMANTICS_CLEANUP_FAILED', { cause: first, cleanupErrors: rest });
  }
  return Object.freeze({
    get state(): SemanticsState { return state; },
    get snapshot(): SemanticSnapshot { return snapshot; },
    get size(): number { return entries.size; },
    add, publish, perform,
    observe(listener: (snapshot: SemanticSnapshot, previous: SemanticSnapshot) => void): () => void {
      if (typeof listener !== 'function') throw new EgretError('UI_SEMANTICS_OPTIONS');
      if (state === 'closed') return () => {};
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    onClose(listener: () => void): () => void {
      if (typeof listener !== 'function') throw new EgretError('UI_SEMANTICS_OPTIONS');
      if (state === 'closed') { listener(); return () => {}; }
      closers.add(listener);
      return () => { closers.delete(listener); };
    },
    dispose,
  });
}
