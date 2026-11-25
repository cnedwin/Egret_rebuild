// SPDX-License-Identifier: Apache-2.0
// The optional entry @egret/engine/ui/testing. A test, or an agent checking its own work, finds the controls of a
// drawn UI by what they are called and presses them through the semantic tree: the same actions a press, a key and
// assistive technology reach. Nothing is drawn or clicked by coordinates, so a check written this way runs in Node and
// says, when it fails, what the screen held instead.
import { EgretError } from '@egret/runtime';
import type { SemanticAction, SemanticRole, SemanticSnapshotNode, UiSemantics } from '../semanticTypes.js';
import type { UiScreenStack } from './screenStack.js';

/** What a tester reads and drives: a semantic tree, how time moves, and the screen stack if there is one. */
export interface UiTesterOptions {
  readonly semantics: UiSemantics;
  /**
   * Brings the tree up to date before each read: commit the UI and publish. `semantics.publish()` unless given; give
   * it when the tree is published by the game's own frame, so a read sees what the last change made.
   */
  readonly update?: () => void;
  /** Moves time on by `seconds`: `engine.advanceTime`, or a game's own step. `wait` refuses without it. */
  readonly advance?: (seconds: number) => void | Promise<void>;
  /** The screen stack, for `screen` and `back`. */
  readonly screens?: UiScreenStack;
}

/** The state of a found control, as its node says it. */
export interface UiTesterState {
  readonly role: SemanticRole;
  readonly name: string;
  readonly disabled: boolean;
  readonly focused: boolean;
  readonly checked: boolean | 'mixed' | undefined;
  readonly selected: boolean | undefined;
  readonly expanded: boolean | undefined;
  readonly value: string | undefined;
  /** For a slider, a spin button, a progress bar or a scroll bar: where it is in its range. */
  readonly now: number | undefined;
}

/** Finds controls by name and drives them through the semantic tree. */
export interface UiTester {
  /**
   * The node a query names. A query is a name (`'Buy'`), a role and a name (`'button:Buy'`), names of what it is in
   * before it (`'Shop / Buy'`, which need not be its direct parent), and `#n` for the n-th of several (`'option#2'`,
   * counting from 0). Refused with `UI_TESTER_NOT_FOUND`, or `UI_TESTER_AMBIGUOUS` when more than one match, with what
   * the screen holds in `cause`.
   */
  find(query: string): SemanticSnapshotNode;
  /** Whether a query names exactly one node. */
  exists(query: string): boolean;
  /** Every node a query names, in reading order. */
  findAll(query: string): readonly SemanticSnapshotNode[];
  /** Presses a control: its `activate` action. Refused with `UI_TESTER_REFUSED` when it is disabled, behind a dialog or has no press. */
  press(query: string): void;
  /** Gives a control the focus: its `focus` action, refused as `press` is. */
  focus(query: string): void;
  /** The name of a node: the words of a text, the label of a button. */
  text(query: string): string;
  /** The state of a node. */
  state(query: string): UiTesterState;
  /** Moves time on by `seconds` and brings the tree up to date. */
  wait(seconds: number): Promise<void>;
  /** The id of the screen in front of the screen stack, or undefined. */
  readonly screen: string | undefined;
  /** Presses the back key of the screen stack; whether something was done. */
  back(): Promise<boolean>;
  /** What the screen holds, one node a line, indented under what it is in: the text a failure shows. */
  outline(): string;
}

const ROLES = new Set<SemanticRole>([
  'group',
  'image',
  'text',
  'button',
  'checkbox',
  'switch',
  'radiogroup',
  'radio',
  'listbox',
  'option',
  'list',
  'listitem',
  'scrollbar',
  'slider',
  'spinbutton',
  'progressbar',
  'tablist',
  'tab',
  'tabpanel',
  'menu',
  'menuitem',
  'grid',
  'row',
  'gridcell',
  'columnheader',
  'tree',
  'treeitem',
  'heading',
  'dialog',
  'textbox',
  'status',
  'alert'
] as SemanticRole[]);

interface Part {
  readonly role: string | undefined;
  readonly name: string | undefined;
}
interface Query {
  readonly path: readonly Part[];
  readonly nth: number | undefined;
}

function parse(query: unknown): Query {
  if (typeof query !== 'string' || query.trim() === '' || query.length > 512)
    throw new EgretError('UI_TESTER_QUERY_INVALID', { cause: query });
  let text = query.trim(),
    nth: number | undefined;
  const counted = /#(\d{1,4})$/.exec(text);
  if (counted) {
    nth = Number(counted[1]);
    text = text.slice(0, counted.index).trim();
  }
  const path = text.split(/\s+\/\s+/).map((segment): Part => {
    const colon = segment.indexOf(':');
    const role = colon > 0 ? segment.slice(0, colon).trim() : undefined;
    if (role !== undefined && ROLES.has(role as SemanticRole)) {
      const name = segment.slice(colon + 1).trim();
      return { role, name: name === '' ? undefined : name };
    }
    // A bare role names every node of it: 'option#2'.
    if (ROLES.has(segment as SemanticRole)) return { role: segment, name: undefined };
    return { role: undefined, name: segment };
  });
  if (path.some(part => part.role === undefined && (part.name === undefined || part.name === '')))
    throw new EgretError('UI_TESTER_QUERY_INVALID', { cause: query });
  return { path, nth };
}

/** An error whose message ends with what the screen held, however long, since that is what a reader needs. */
function failure(code: string, details: string): EgretError {
  const error = new EgretError(code, { cause: details });
  error.message += ' ' + details;
  return error;
}

/** Makes a tester over a semantic tree. */
export function createUiTester(options: UiTesterOptions): UiTester {
  if (
    options === null ||
    typeof options !== 'object' ||
    options.semantics === null ||
    typeof options.semantics !== 'object' ||
    typeof options.semantics.perform !== 'function' ||
    (options.update !== undefined && typeof options.update !== 'function') ||
    (options.advance !== undefined && typeof options.advance !== 'function') ||
    (options.screens !== undefined && (options.screens === null || typeof options.screens.back !== 'function'))
  )
    throw new EgretError('UI_TESTER_OPTIONS_INVALID');
  const { semantics, screens } = options;
  const update = options.update ?? (() => void semantics.publish());

  const nodes = (): readonly SemanticSnapshotNode[] => {
    update();
    return semantics.snapshot.nodes;
  };
  function outlineOf(all: readonly SemanticSnapshotNode[]): string {
    const byId = new Map(all.map(node => [node.id, node]));
    const depth = (node: SemanticSnapshotNode): number => {
      let level = 0;
      for (let at = node.parent; at !== undefined && level < 64; at = byId.get(at)?.parent) level++;
      return level;
    };
    const lines = all.map(node => {
      const marks = [
        node.disabled ? 'disabled' : '',
        node.inert ? 'behind a dialog' : '',
        node.focused ? 'focused' : '',
        node.checked === undefined ? '' : node.checked === 'mixed' ? 'mixed' : node.checked ? 'checked' : 'unchecked',
        node.selected ? 'selected' : '',
        node.expanded === undefined ? '' : node.expanded ? 'expanded' : 'collapsed',
        node.value === undefined ? '' : 'value ' + JSON.stringify(node.value),
        node.range === undefined ? '' : 'at ' + node.range.now + ' of ' + node.range.min + '–' + node.range.max
      ].filter(Boolean);
      return (
        '  '.repeat(depth(node)) +
        node.role +
        (node.name === '' ? '' : ' ' + JSON.stringify(node.name)) +
        (marks.length > 0 ? ' [' + marks.join(', ') + ']' : '')
      );
    });
    return lines.length > 0 ? lines.join('\n') : '(nothing is published)';
  }
  const matches = (node: SemanticSnapshotNode, part: Part): boolean =>
    (part.role === undefined || node.role === part.role) && (part.name === undefined || node.name === part.name);
  function findAll(query: string): readonly SemanticSnapshotNode[] {
    const { path, nth } = parse(query),
      all = nodes(),
      byId = new Map(all.map(node => [node.id, node]));
    const last = path[path.length - 1]!;
    const found = all.filter(node => {
      if (!matches(node, last)) return false;
      // Each earlier part names something the node is in, in order from the outside.
      let wanted = path.length - 2;
      for (let at = node.parent; at !== undefined && wanted >= 0; at = byId.get(at)?.parent) {
        const holder = byId.get(at);
        if (holder !== undefined && matches(holder, path[wanted]!)) wanted--;
      }
      return wanted < 0;
    });
    if (nth === undefined) return found;
    return found[nth] === undefined ? [] : [found[nth]!];
  }
  function find(query: string): SemanticSnapshotNode {
    const found = findAll(query);
    if (found.length === 1) return found[0]!;
    const shown = outlineOf(semantics.snapshot.nodes);
    if (found.length === 0) throw failure('UI_TESTER_NOT_FOUND', query + ' is not on the screen. It holds:\n' + shown);
    throw failure(
      'UI_TESTER_AMBIGUOUS',
      query +
        ' names ' +
        found.length +
        ': ' +
        found.map(node => node.role + ' ' + JSON.stringify(node.name)).join(', ') +
        '. Add a role, what it is in, or #n. The screen holds:\n' +
        shown
    );
  }
  function act(query: string, action: SemanticAction): void {
    const node = find(query);
    const why = node.disabled
      ? 'it is disabled'
      : node.inert
        ? 'a dialog is over it'
        : !node.actions.includes(action)
          ? 'it has no ' + action + ' action'
          : undefined;
    if (why !== undefined || !semantics.perform(node.id, action))
      throw failure(
        'UI_TESTER_REFUSED',
        action +
          ' of ' +
          query +
          ' was refused: ' +
          (why ?? 'the tree refused it') +
          '. The screen holds:\n' +
          outlineOf(semantics.snapshot.nodes)
      );
  }
  const tester: UiTester = {
    find,
    findAll,
    exists: query => findAll(query).length === 1,
    press: query => act(query, 'activate'),
    focus: query => act(query, 'focus'),
    text: query => find(query).name,
    state(query) {
      const node = find(query);
      return Object.freeze({
        role: node.role,
        name: node.name,
        disabled: node.disabled,
        focused: node.focused,
        checked: node.checked,
        selected: node.selected,
        expanded: node.expanded,
        value: node.value,
        now: node.range?.now
      });
    },
    async wait(seconds) {
      if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds < 0 || options.advance === undefined)
        throw new EgretError('UI_TESTER_OPTIONS_INVALID', { cause: 'wait needs advance and seconds of 0 or more' });
      await options.advance(seconds);
      update();
    },
    get screen() {
      return screens?.snapshot().active;
    },
    async back() {
      if (screens === undefined) throw new EgretError('UI_TESTER_OPTIONS_INVALID', { cause: 'back needs screens' });
      const done = await screens.back();
      update();
      return done;
    },
    outline: () => outlineOf(nodes())
  };
  return Object.freeze(tester);
}
