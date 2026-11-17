// SPDX-License-Identifier: Apache-2.0
// Named game actions over keys, mouse buttons, gamepad buttons and sticks, and
// on-screen controls. A game asks "is Jump pressed", "was Fire just pressed",
// "which way does Move point" and never which key that is; the player can
// rebind, and the bindings can be saved and loaded. This core takes no browser
// events: the browser kit entry feeds it from the page, and tests feed it
// directly.
import { EgretError } from '@egret/runtime';

/**
 * One physical control, written as a short string:
 * `Key:KeyW` (a `KeyboardEvent.code`), `Mouse:0` (a button number), `Pad:a` or `Pad:7` (a standard gamepad button
 * name or number), `Pad:leftStick` / `Pad:rightStick` (a stick, for vector actions), `Pad:leftStickX+` (one half of a
 * stick axis, for buttons and axes), and `Touch:<name>` for an on-screen control.
 */
export type InputBinding = string;

export type InputActionKind = 'button' | 'axis' | 'vector';

/** An action and the controls that drive it. */
export interface InputActionDefinition {
  /** `button` (the default) is pressed or not; `axis` runs from -1 to 1; `vector` is a direction of length up to 1. */
  readonly kind?: InputActionKind;
  /** For a button: any of these presses it. */
  readonly bindings?: readonly InputBinding[];
  /** For an axis: controls that push it negative and positive. */
  readonly negative?: readonly InputBinding[];
  readonly positive?: readonly InputBinding[];
  /** For a vector: controls for each direction, and sticks or touch sticks that give the whole vector. */
  readonly up?: readonly InputBinding[];
  readonly down?: readonly InputBinding[];
  readonly left?: readonly InputBinding[];
  readonly right?: readonly InputBinding[];
  readonly sticks?: readonly InputBinding[];
  /** Analog input below this is taken as nothing. Defaults to 0.2. */
  readonly deadZone?: number;
}

export type InputActionMap = Readonly<Record<string, InputActionDefinition>>;

/** A slot of an action that a binding can be put in: `bindings`, `negative`, `positive`, `up`, ... */
export type InputBindingSlot = 'bindings' | 'negative' | 'positive' | 'up' | 'down' | 'left' | 'right' | 'sticks';

export interface InputVector {
  readonly x: number;
  readonly y: number;
}

export interface InputActions {
  /** The names of the actions, in the order they were defined. */
  readonly names: readonly string[];
  /** A control was pressed, or moved to `value` (0 to 1). Unknown controls are ignored. */
  press(binding: InputBinding, value?: number): void;
  release(binding: InputBinding): void;
  /** A stick or touch stick points at x, y (each -1 to 1, y down). */
  setStick(binding: InputBinding, x: number, y: number): void;
  /** Lets every control go, as when the page loses focus. */
  releaseAll(): void;
  /** True while a button action is held. */
  pressed(action: string): boolean;
  /** True on the frame a button action went down, or up. */
  justPressed(action: string): boolean;
  justReleased(action: string): boolean;
  /** An axis action from -1 to 1, or a button action as 0 or 1. */
  value(action: string): number;
  /** A vector action, of length at most 1; y is down. */
  vector(action: string): InputVector;
  /** Ends the frame: the "just" states are cleared. Call once a frame after the game read its input. */
  endFrame(): void;
  /** The controls of one slot of an action. */
  bindingsOf(action: string, slot?: InputBindingSlot): readonly InputBinding[];
  /** Puts `binding` at `index` of a slot (appending when `index` is the slot's length) and takes it off any other action. */
  rebind(
    action: string,
    binding: InputBinding,
    options?: { readonly slot?: InputBindingSlot; readonly index?: number }
  ): void;
  /** Back to the bindings the map was made with. */
  resetBindings(): void;
  /** The bindings that differ from the map, as plain data to save. */
  saveBindings(): InputBindingsSave;
  /** Applies saved bindings; unknown actions and malformed entries are skipped. */
  loadBindings(saved: unknown): void;
  /** Told after each press or release that changed an action, with the action's name. */
  subscribe(listener: (action: string, pressed: boolean) => void): () => void;
  /** The control last pressed, for a "press a key" rebinding screen; undefined after `endFrame` until another. */
  readonly lastPressed: InputBinding | undefined;
}

export interface InputBindingsSave {
  readonly version: 1;
  readonly actions: Readonly<Record<string, Partial<Record<InputBindingSlot, readonly InputBinding[]>>>>;
}

const SLOTS: readonly InputBindingSlot[] = [
  'bindings',
  'negative',
  'positive',
  'up',
  'down',
  'left',
  'right',
  'sticks'
];
const PATTERN = /^(Key|Mouse|Pad|Touch):[A-Za-z0-9_+\-]{1,40}$/;
const MAX_ACTIONS = 256;
const MAX_BINDINGS = 16;

const invalid = (detail: string): never => {
  throw new EgretError('INPUT_ACTIONS_INVALID', { cause: new TypeError(detail) });
};

interface Action {
  readonly name: string;
  readonly kind: InputActionKind;
  readonly deadZone: number;
  slots: Record<InputBindingSlot, InputBinding[]>;
  down: boolean;
  wentDown: boolean;
  wentUp: boolean;
}

const clamp = (value: number, low: number, high: number): number => (value < low ? low : value > high ? high : value);

function checkBinding(binding: unknown): InputBinding {
  if (typeof binding !== 'string' || !PATTERN.test(binding)) invalid('binding ' + String(binding));
  return binding as InputBinding;
}

function slotsOf(definition: InputActionDefinition, kind: InputActionKind): Record<InputBindingSlot, InputBinding[]> {
  const slots = Object.fromEntries(SLOTS.map(slot => [slot, [] as InputBinding[]])) as Record<
    InputBindingSlot,
    InputBinding[]
  >;
  const allowed: readonly InputBindingSlot[] =
    kind === 'button'
      ? ['bindings']
      : kind === 'axis'
        ? ['negative', 'positive']
        : ['up', 'down', 'left', 'right', 'sticks'];
  for (const slot of SLOTS) {
    const list = (definition as Record<string, unknown>)[slot];
    if (list === undefined) continue;
    if (!allowed.includes(slot)) invalid(`${slot} on a ${kind} action`);
    if (!Array.isArray(list) || list.length > MAX_BINDINGS) invalid(slot);
    slots[slot] = (list as unknown[]).map(checkBinding);
  }
  return slots;
}

/** Makes the actions of `map`. */
export function createInputActions(map: InputActionMap): InputActions {
  if (typeof map !== 'object' || map === null) invalid('map');
  const names = Object.keys(map);
  if (names.length === 0 || names.length > MAX_ACTIONS) invalid('action count');
  const actions = new Map<string, Action>();
  const defaults = new Map<string, Record<InputBindingSlot, InputBinding[]>>();
  for (const name of names) {
    if (!/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(name)) invalid('action name ' + name);
    const definition = map[name]!;
    if (typeof definition !== 'object' || definition === null) invalid('action ' + name);
    const kind = definition.kind ?? 'button';
    if (kind !== 'button' && kind !== 'axis' && kind !== 'vector') invalid('kind of ' + name);
    const deadZone = definition.deadZone ?? 0.2;
    if (!(deadZone >= 0 && deadZone < 1)) invalid('deadZone of ' + name);
    const slots = slotsOf(definition, kind);
    defaults.set(name, structuredCloneSlots(slots));
    actions.set(name, { name, kind, deadZone, slots, down: false, wentDown: false, wentUp: false });
  }

  // What each control is doing now: a press value, or a stick's x and y.
  const values = new Map<InputBinding, number>();
  const sticks = new Map<InputBinding, { x: number; y: number }>();
  const listeners = new Set<(action: string, pressed: boolean) => void>();
  let lastPressed: InputBinding | undefined;

  const action = (name: string): Action => actions.get(name) ?? invalid('unknown action ' + name);
  const level = (binding: InputBinding): number => {
    const direct = values.get(binding);
    if (direct !== undefined) return direct;
    // Half of a stick axis: Pad:leftStickX+ reads the x of Pad:leftStick.
    const half = /^(.*)([XY])([+-])$/.exec(binding);
    if (half) {
      const stick = sticks.get(half[1]!);
      if (stick) {
        const v = half[2] === 'X' ? stick.x : stick.y;
        return half[3] === '+' ? Math.max(0, v) : Math.max(0, -v);
      }
    }
    return 0;
  };
  const strongest = (list: readonly InputBinding[]): number => {
    let best = 0;
    for (const binding of list) best = Math.max(best, level(binding));
    return best;
  };
  const buttonLevel = (a: Action): number => {
    switch (a.kind) {
      case 'button':
        return strongest(a.slots.bindings);
      case 'axis':
        return Math.abs(axisOf(a));
      default: {
        const v = vectorOf(a);
        return Math.hypot(v.x, v.y);
      }
    }
  };
  const axisOf = (a: Action): number => {
    const raw = strongest(a.slots.positive) - strongest(a.slots.negative);
    return Math.abs(raw) <= a.deadZone ? 0 : clamp(raw, -1, 1);
  };
  const vectorOf = (a: Action): InputVector => {
    let x = strongest(a.slots.right) - strongest(a.slots.left),
      y = strongest(a.slots.down) - strongest(a.slots.up);
    for (const binding of a.slots.sticks) {
      const stick = sticks.get(binding);
      if (stick && Math.hypot(stick.x, stick.y) > Math.hypot(x, y)) {
        x = stick.x;
        y = stick.y;
      }
    }
    const length = Math.hypot(x, y);
    if (length <= a.deadZone) return { x: 0, y: 0 };
    // The dead zone is taken out and the rest stretched to reach 1, so small pushes start from zero.
    const scaled = Math.min(1, (length - a.deadZone) / (1 - a.deadZone));
    return { x: (x / length) * scaled, y: (y / length) * scaled };
  };
  const refresh = (): void => {
    for (const a of actions.values()) {
      const down = buttonLevel(a) > (a.kind === 'button' ? 0.5 : 0);
      if (down === a.down) continue;
      a.down = down;
      if (down) a.wentDown = true;
      else a.wentUp = true;
      for (const listener of [...listeners]) listener(a.name, down);
    }
  };

  const api: InputActions = {
    names: Object.freeze([...names]),
    press(binding, value = 1) {
      checkBinding(binding);
      if (!(value >= 0 && value <= 1)) invalid('press value');
      if (value === 0) values.delete(binding);
      else {
        if (!values.has(binding)) lastPressed = binding;
        values.set(binding, value);
      }
      refresh();
    },
    release(binding) {
      checkBinding(binding);
      values.delete(binding);
      refresh();
    },
    setStick(binding, x, y) {
      checkBinding(binding);
      if (!Number.isFinite(x) || !Number.isFinite(y)) invalid('stick value');
      const length = Math.hypot(x, y);
      if (length > 1) {
        x /= length;
        y /= length;
      }
      if (x === 0 && y === 0) sticks.delete(binding);
      else sticks.set(binding, { x, y });
      refresh();
    },
    releaseAll() {
      values.clear();
      sticks.clear();
      refresh();
    },
    pressed: name => action(name).down,
    justPressed: name => action(name).wentDown,
    justReleased: name => action(name).wentUp,
    value(name) {
      const a = action(name);
      if (a.kind === 'axis') return axisOf(a);
      if (a.kind === 'button') return a.down ? 1 : 0;
      return Math.hypot(vectorOf(a).x, vectorOf(a).y);
    },
    vector(name) {
      const a = action(name);
      if (a.kind === 'vector') return vectorOf(a);
      if (a.kind === 'axis') return { x: axisOf(a), y: 0 };
      return { x: a.down ? 1 : 0, y: 0 };
    },
    endFrame() {
      for (const a of actions.values()) a.wentDown = a.wentUp = false;
      lastPressed = undefined;
    },
    bindingsOf(name, slot) {
      const a = action(name);
      return Object.freeze([...a.slots[slot ?? defaultSlot(a.kind)]]);
    },
    rebind(name, binding, options = {}) {
      const a = action(name);
      checkBinding(binding);
      const slot = options.slot ?? defaultSlot(a.kind);
      if (!SLOTS.includes(slot) || !slotsOf({ [slot]: [binding] } as InputActionDefinition, a.kind)) invalid('slot');
      const list = a.slots[slot];
      const index = options.index ?? 0;
      if (!Number.isSafeInteger(index) || index < 0 || index > list.length || index >= MAX_BINDINGS) invalid('index');
      // A control does one thing: it is taken off wherever else it was.
      for (const other of actions.values())
        for (const s of SLOTS) {
          const at = other.slots[s].indexOf(binding);
          if (at >= 0 && !(other === a && s === slot && at === index)) other.slots[s].splice(at, 1);
        }
      if (index < list.length) list[index] = binding;
      else list.push(binding);
      refresh();
    },
    resetBindings() {
      for (const [name, slots] of defaults) action(name).slots = structuredCloneSlots(slots);
      refresh();
    },
    saveBindings() {
      const saved: Record<string, Partial<Record<InputBindingSlot, InputBinding[]>>> = {};
      for (const [name, slots] of defaults) {
        const now = action(name).slots;
        for (const slot of SLOTS)
          if (now[slot].join('\n') !== slots[slot].join('\n')) (saved[name] ??= {})[slot] = [...now[slot]];
      }
      return { version: 1, actions: saved };
    },
    loadBindings(saved) {
      const data = saved as { version?: unknown; actions?: unknown } | null;
      if (!data || data.version !== 1 || typeof data.actions !== 'object' || data.actions === null) return;
      for (const [name, slots] of Object.entries(data.actions as Record<string, unknown>)) {
        const a = actions.get(name);
        if (!a || typeof slots !== 'object' || slots === null) continue;
        for (const [slot, list] of Object.entries(slots as Record<string, unknown>)) {
          if (!SLOTS.includes(slot as InputBindingSlot) || !Array.isArray(list) || list.length > MAX_BINDINGS) continue;
          if (!list.every(b => typeof b === 'string' && PATTERN.test(b))) continue;
          try {
            slotsOf({ [slot]: list } as InputActionDefinition, a.kind);
          } catch {
            continue;
          }
          a.slots[slot as InputBindingSlot] = [...(list as string[])];
        }
      }
      refresh();
    },
    subscribe(listener) {
      if (typeof listener !== 'function') invalid('listener');
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    get lastPressed() {
      return lastPressed;
    }
  };
  return Object.freeze(api);
}

function defaultSlot(kind: InputActionKind): InputBindingSlot {
  return kind === 'button' ? 'bindings' : kind === 'axis' ? 'positive' : 'sticks';
}

function structuredCloneSlots(
  slots: Record<InputBindingSlot, InputBinding[]>
): Record<InputBindingSlot, InputBinding[]> {
  return Object.fromEntries(SLOTS.map(slot => [slot, [...slots[slot]]])) as Record<InputBindingSlot, InputBinding[]>;
}

/** A readable name for a binding, for settings screens: `Key:KeyW` is `W`, `Mouse:0` is `Left button`. */
export function describeInputBinding(binding: InputBinding): string {
  checkBinding(binding);
  const [device, control] = binding.split(':') as [string, string];
  if (device === 'Key') {
    if (/^Key[A-Z]$/.test(control)) return control.slice(3);
    if (/^Digit[0-9]$/.test(control)) return control.slice(5);
    const named: Record<string, string> = {
      Space: 'Space',
      Enter: 'Enter',
      Escape: 'Esc',
      ShiftLeft: 'Shift',
      ShiftRight: 'Right Shift',
      ControlLeft: 'Ctrl',
      ControlRight: 'Right Ctrl',
      AltLeft: 'Alt',
      AltRight: 'Right Alt',
      ArrowUp: '↑',
      ArrowDown: '↓',
      ArrowLeft: '←',
      ArrowRight: '→',
      Tab: 'Tab',
      Backspace: 'Backspace'
    };
    return named[control] ?? control;
  }
  if (device === 'Mouse')
    return ['Left button', 'Middle button', 'Right button'][Number(control)] ?? `Mouse ${control}`;
  if (device === 'Pad') return `Pad ${control}`;
  return control;
}
