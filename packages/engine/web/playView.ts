// SPDX-License-Identifier: Apache-2.0
// Views of play: a screen described as data (./view.js), drawn with the game's own sprites and texts on its ui layer
// in a skin, and kept to the game's state by a table of bindings read every frame. Named parts reach code through
// `get`, tests and assistive technology through the semantic tree when the game gives one, and a screen stack through
// the handle a view is.
import { EgretError } from '@egret/runtime';
import type { Sprite } from '@egret/engine';
import type { UiSemantics } from '@egret/engine/ui/semantics';
import type { PlayGame, PlayText } from './BrowserPlay.js';
import { checkView, planView } from './view.js';
import type { ViewDescription, ViewPart, ViewPlan, ViewRect } from './view.js';

/** How one named part follows the game's state. Each function is given the state and read every frame. */
export interface PlayViewBinding<S = unknown> {
  /** The words of a text, a button or a toggle. */
  readonly text?: (state: S) => string | number;
  /**
   * A number shown in words: `pick` reads it, `format` writes it (whole numbers unless given), and with `roll`, in
   * seconds, the words count up or down to a new number instead of jumping.
   */
  readonly pick?: (state: S) => number;
  readonly format?: (value: number) => string;
  readonly roll?: number;
  /** How full a bar is, 0 to 1. */
  readonly value?: (state: S) => number;
  /** Whether a toggle is on. */
  readonly checked?: (state: S) => boolean;
  /** Whether a button or a toggle cannot be used now: drawn grey, and a press does nothing. */
  readonly disabled?: (state: S) => boolean;
  readonly visible?: (state: S) => boolean;
  /** The colour of words, of a button, of a bar's fill or of a card. */
  readonly color?: (state: S) => number;
  /** What a press of a button, a toggle or a panel does. */
  readonly tap?: (state: S) => void;
}
/** A view to make: where its state comes from, its bindings, and who is told when its parts are made. */
export interface PlayViewOptions<S = unknown> {
  /** The state bindings read: an object, or a function that returns it. */
  readonly state?: S | (() => S);
  /** A binding for each named part that follows the state or answers a press. A name the view does not have is refused. */
  readonly bind?: { readonly [name: string]: PlayViewBinding<S> };
  /** Called after the parts are made, and again when the screen turns to the other set of parts. */
  readonly built?: (view: PlayView) => void;
}
/** A view on the screen. It is also a screen's handle: open one from a screen stack's `open` and it shows, hides and closes with the screen. */
export interface PlayView {
  /** The sprite of a named part, to add to, tween or give gestures; another after the screen turns to other parts. */
  get(name: string): Sprite;
  /** Where a named part is now, in the game's units. */
  rect(name: string): ViewRect;
  /** Whether a named part, and every panel it is in, shows. */
  shows(name: string): boolean;
  /** Which parts are used: `'portrait'` while the screen is taller than wide and the view has portrait parts. */
  readonly variant: 'landscape' | 'portrait';
  readonly visible: boolean;
  /** Reads the bindings now, rather than at the end of the frame. */
  refresh(): void;
  show(): void;
  hide(): void;
  cover(): void;
  reveal(): void;
  /** Whether presses reach it: a screen stack takes them away from what is not in front. */
  activate(): void;
  deactivate(): void;
  close(): void;
  dispose(): void;
}

interface Made {
  readonly part: ViewPart;
  readonly node: Sprite;
  readonly words: PlayText | undefined;
  rect: ViewRect;
  visible: boolean;
  disabled: boolean;
  checked: boolean;
  value: number;
  color: number | undefined;
  text: string;
}
interface Roll {
  from: number;
  to: number;
  shown: number;
  left: number;
}

const KEYS_OF: Record<ViewPart['type'], readonly (keyof PlayViewBinding)[]> = {
  panel: ['visible', 'color', 'tap'],
  text: ['text', 'pick', 'format', 'roll', 'visible', 'color'],
  button: ['text', 'pick', 'format', 'roll', 'disabled', 'visible', 'color', 'tap'],
  bar: ['value', 'visible', 'color'],
  toggle: ['text', 'checked', 'disabled', 'visible', 'tap'],
  space: ['visible']
};

/** Views of one play game: made by `game.view`, read every frame, placed again when the screen changes. */
export function createPlayViews(
  game: PlayGame,
  hooks: { readonly failed: (cause: unknown) => void; readonly semantics: () => UiSemantics | undefined }
): {
  view<S>(description: ViewDescription, options?: PlayViewOptions<S>): PlayView;
  tick(seconds: number): void;
  arrange(): void;
  reset(): void;
} {
  const live = new Set<ViewRecord>();
  let counter = 0;

  interface ViewRecord {
    readonly view: PlayView;
    tick(seconds: number): void;
    arrange(): void;
    end(): void;
  }

  function view<S>(description: ViewDescription, options: PlayViewOptions<S> = {}): PlayView {
    const names = checkView(description);
    if (options === null || typeof options !== 'object')
      throw new EgretError('UI_VIEW_BINDING_INVALID', { cause: 'options' });
    const bind = options.bind ?? {};
    if (bind === null || typeof bind !== 'object') throw new EgretError('UI_VIEW_BINDING_INVALID', { cause: 'bind' });
    for (const [name, binding] of Object.entries(bind)) {
      const type = names.get(name);
      if (type === undefined)
        throw new EgretError('UI_VIEW_BINDING_UNKNOWN', {
          cause: name + ' is not a name of the view; it has ' + ([...names.keys()].join(', ') || 'no names')
        });
      if (binding === null || typeof binding !== 'object')
        throw new EgretError('UI_VIEW_BINDING_INVALID', { cause: name + ': a binding is an object' });
      for (const [key, value] of Object.entries(binding)) {
        if (!KEYS_OF[type].includes(key as keyof PlayViewBinding))
          throw new EgretError('UI_VIEW_BINDING_INVALID', {
            cause: name + ' is a ' + type + ', which binds ' + KEYS_OF[type].join(', ') + ', not ' + key
          });
        const ok =
          key === 'roll'
            ? typeof value === 'number' && Number.isFinite(value) && value >= 0
            : typeof value === 'function';
        if (!ok) throw new EgretError('UI_VIEW_BINDING_INVALID', { cause: name + ': ' + key });
      }
      if (binding.text !== undefined && binding.pick !== undefined)
        throw new EgretError('UI_VIEW_BINDING_INVALID', { cause: name + ': text or pick, not both' });
    }
    if (options.built !== undefined && typeof options.built !== 'function')
      throw new EgretError('UI_VIEW_BINDING_INVALID', { cause: 'built' });
    const id = 'view' + ++counter;
    const state = (): S => (typeof options.state === 'function' ? (options.state as () => S)() : (options.state as S));
    const root = game.sprite(undefined, game.ui);
    let dim: Sprite | undefined;
    let plan: ViewPlan;
    let made: Made[] = [];
    let shown = true,
      active = true,
      ended = false;
    const rolls = new Map<string, Roll>();
    const removals: (() => void)[] = [];

    const frame = () => ({ screen: game.screen, safe: game.safe, orientation: game.orientation });
    const colourOf = (part: ViewPart, item: Made): number => {
      const skin = plan.skin;
      if (item.color !== undefined) return item.color;
      if (part.type === 'button') return item.disabled ? skin.disabled : (part.color ?? skin.button);
      if (part.type === 'bar') return part.color ?? skin.accent;
      if (part.type === 'panel') return part.color ?? skin.panel;
      if (part.type === 'text') return part.color ?? skin.text;
      return skin.text;
    };
    // Draws one part at its size; called when it is made, placed again or changed.
    const paint = (item: Made): void => {
      const { part, node, rect } = item,
        skin = plan.skin,
        g = node.graphics,
        r = skin.radius;
      g.clear();
      node.hitArea = { x: 0, y: 0, width: rect.width, height: rect.height };
      if (part.type === 'panel' && (part.card === true || part.color !== undefined || item.color !== undefined))
        g.beginFill(colourOf(part, item), part.alpha ?? skin.panelAlpha)
          .drawRoundRect(0, 0, rect.width, rect.height, r * 2)
          .endFill();
      if (part.type === 'button')
        g.beginFill(colourOf(part, item))
          .drawRoundRect(0, 0, rect.width, rect.height, r * 2)
          .endFill();
      if (part.type === 'bar') {
        g.beginFill(skin.track)
          .drawRoundRect(0, 0, rect.width, rect.height, Math.min(r * 2, rect.height))
          .endFill();
        const fill = Math.max(0, Math.min(1, item.value)) * rect.width;
        if (fill > 0)
          g.beginFill(colourOf(part, item))
            .drawRoundRect(0, 0, fill, rect.height, Math.min(r * 2, rect.height, fill))
            .endFill();
      }
      if (part.type === 'toggle') {
        const h = Math.min(rect.height * 0.7, 30),
          w = h * 1.8,
          x = rect.width - w,
          y = (rect.height - h) / 2;
        g.beginFill(item.disabled ? skin.disabled : item.checked ? skin.accent : skin.track)
          .drawRoundRect(x, y, w, h, h)
          .endFill()
          .beginFill(0xffffff)
          .drawCircle(item.checked ? x + w - h / 2 : x + h / 2, y + h / 2, h / 2 - 3)
          .endFill();
      }
      const words = item.words;
      if (words !== undefined) {
        words.text = item.text;
        if (part.type === 'button') {
          words.x = rect.width / 2;
          words.color = part.textColor ?? skin.buttonText;
        } else if (part.type === 'text') {
          words.x = part.align === 'center' ? rect.width / 2 : part.align === 'right' ? rect.width : 0;
          words.color = colourOf(part, item);
        } else words.x = 0;
        words.y = rect.height / 2;
        if (part.type === 'toggle') words.alpha = item.disabled ? 0.5 : 1;
      }
      node.visible = item.visible;
    };
    const nameOf = (item: Made): string | undefined => item.part.name;
    const bindingOf = (item: Made): PlayViewBinding<S> | undefined => {
      const name = nameOf(item);
      return name === undefined ? undefined : (bind[name] as PlayViewBinding<S> | undefined);
    };
    const press = (item: Made): void => {
      if (ended || !shown || !active || !item.visible || item.disabled || !visibleUp(item)) return;
      const binding = bindingOf(item);
      try {
        binding?.tap?.(state());
      } catch (cause) {
        hooks.failed(cause);
      }
      refresh();
    };
    const visibleUp = (item: Made): boolean => {
      for (let at: number = made.indexOf(item); at >= 0; at = plan.parts[at]!.parent)
        if (!made[at]!.visible) return false;
      return true;
    };
    // Makes the sprites of a plan: one for each part, inside the sprite of its panel.
    const build = (): void => {
      plan = planView(description, frame());
      made = [];
      for (const planned of plan.parts) {
        const { part } = planned;
        const parent = planned.parent < 0 ? root : made[planned.parent]!.node;
        const node = game.sprite(undefined, parent);
        const start =
          part.type === 'text' || part.type === 'button' || part.type === 'toggle' ? String(part.text ?? '') : '';
        const words =
          part.type === 'text' || part.type === 'button' || part.type === 'toggle'
            ? game.text(start, {
                layer: node,
                size: part.size ?? (part.type === 'text' ? plan.skin.size : Math.round(plan.skin.size * 0.9)),
                align: part.type === 'button' ? 'center' : part.type === 'text' ? (part.align ?? 'left') : 'left',
                baseline: 'middle',
                ...(part.type === 'text' && part.bold !== undefined ? { bold: part.bold } : {}),
                ...(part.type === 'button' ? { bold: true } : {})
              })
            : undefined;
        const previous = rolls.get(part.name ?? '');
        const item: Made = {
          part,
          node,
          words,
          rect: relative(planned.rect, planned.parent < 0 ? undefined : plan.parts[planned.parent]!.rect),
          visible: part.visible ?? true,
          disabled: false,
          checked: part.type === 'toggle' ? (part.checked ?? false) : false,
          value: part.type === 'bar' ? (part.value ?? 1) : 0,
          color: undefined,
          text: previous !== undefined ? String(previous.shown) : start
        };
        node.x = item.rect.x;
        node.y = item.rect.y;
        made.push(item);
        const binding = part.name === undefined ? undefined : bind[part.name];
        if (part.type === 'button' || part.type === 'toggle' || (part.type === 'panel' && binding?.tap !== undefined))
          game.onTap(node, () => press(item));
      }
      if (description.modal === true && dim === undefined) {
        // Behind the parts and over all else: presses that miss the view end here.
        dim = game.sprite(undefined, root);
        root.setChildIndex(dim, 0);
        game.onTap(dim, () => {});
      }
      placeDim();
      read(0);
      for (const item of made) paint(item);
      if (options.built !== undefined) {
        try {
          options.built(api);
        } catch (cause) {
          hooks.failed(cause);
        }
      }
    };
    const placeDim = (): void => {
      if (dim === undefined) return;
      const screen = game.screen;
      dim.graphics
        .clear()
        .beginFill(0x000000, plan.skin.dim)
        .drawRect(screen.x, screen.y, screen.width, screen.height)
        .endFill();
      dim.hitArea = { x: screen.x, y: screen.y, width: screen.width, height: screen.height };
    };
    // Reads every binding; repaints only what changed.
    const read = (seconds: number): boolean => {
      if (ended) return false;
      let any = false;
      const now = state();
      for (const item of made) {
        const binding = bindingOf(item);
        if (binding === undefined) continue;
        const before = `${item.visible}|${item.disabled}|${item.checked}|${item.value}|${item.color}|${item.text}`;
        if (binding.visible !== undefined) item.visible = binding.visible(now) === true;
        if (binding.disabled !== undefined) item.disabled = binding.disabled(now) === true;
        if (binding.checked !== undefined) item.checked = binding.checked(now) === true;
        if (binding.value !== undefined) {
          const value = binding.value(now);
          item.value = typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
        }
        if (binding.color !== undefined) {
          const value = binding.color(now);
          item.color = Number.isInteger(value) && value >= 0 && value <= 0xffffff ? value : undefined;
        }
        if (binding.text !== undefined) item.text = String(binding.text(now));
        if (binding.pick !== undefined) {
          const target = binding.pick(now);
          const name = item.part.name!;
          let roll = rolls.get(name);
          if (typeof target === 'number' && Number.isFinite(target)) {
            if (roll === undefined) rolls.set(name, (roll = { from: target, to: target, shown: target, left: 0 }));
            else if (roll.to !== target) {
              roll.from = roll.shown;
              roll.to = target;
              roll.left = binding.roll ?? 0;
            }
            if (roll.left > 0 && seconds > 0) {
              roll.left = Math.max(0, roll.left - seconds);
              const t = 1 - roll.left / (binding.roll ?? 1);
              const eased = 1 - (1 - t) * (1 - t);
              roll.shown = roll.left === 0 ? roll.to : roll.from + (roll.to - roll.from) * eased;
            } else if (roll.left <= 0) roll.shown = roll.to;
            const whole = roll.left > 0 ? Math.round(roll.shown) : roll.shown;
            item.text = binding.format !== undefined ? String(binding.format(whole)) : String(Math.round(whole));
          }
        }
        const after = `${item.visible}|${item.disabled}|${item.checked}|${item.value}|${item.color}|${item.text}`;
        if (after !== before) {
          paint(item);
          any = true;
        }
      }
      return any;
    };
    const refresh = (): void => {
      try {
        read(0);
      } catch (cause) {
        hooks.failed(cause);
      }
    };
    const find = (name: string): Made => {
      const index = typeof name === 'string' ? plan.names.get(name) : undefined;
      if (index === undefined)
        throw new EgretError('UI_VIEW_NAME_UNKNOWN', {
          cause:
            String(name) + ' is not a name of the view; it has ' + ([...plan.names.keys()].join(', ') || 'no names')
        });
      return made[index]!;
    };
    // Semantics: the view as a group, or a dialog when modal, and each named part as what it is.
    const semantics = hooks.semantics();
    const stageRect = (item: Made): ViewRect => {
      let x = 0,
        y = 0;
      for (let at = made.indexOf(item); at >= 0; at = plan.parts[at]!.parent) {
        x += made[at]!.rect.x;
        y += made[at]!.rect.y;
      }
      const screen = game.screen;
      return { x: x - screen.x, y: y - screen.y, width: item.rect.width, height: item.rect.height };
    };
    const registerSemantics = (): void => {
      if (semantics === undefined) return;
      const top = semantics.add({
        id,
        role: description.modal === true ? 'dialog' : 'group',
        describe: () => ({
          ...(description.label !== undefined ? { name: description.label } : {}),
          bounds: stageRect(made[0]!),
          hidden: !shown || ended,
          ...(description.modal === true ? { modal: true } : {})
        })
      });
      removals.push(() => top.remove());
      // Named parts in the order of the first tree; each inside its nearest named panel.
      const first = planView(description, frame());
      for (const planned of first.parts) {
        const name = planned.part.name;
        if (name === undefined || planned.part.type === 'space') continue;
        let parent = id;
        for (let at = planned.parent; at >= 0; at = first.parts[at]!.parent) {
          const above = first.parts[at]!.part;
          if (above.name !== undefined) {
            parent = id + ':' + above.name;
            break;
          }
        }
        const type = planned.part.type;
        const role =
          type === 'panel'
            ? 'group'
            : type === 'text'
              ? 'text'
              : type === 'button'
                ? 'button'
                : type === 'bar'
                  ? 'progressbar'
                  : 'switch';
        const label = (planned.part as { readonly label?: string }).label;
        semantics.add({
          id: id + ':' + name,
          role,
          parent,
          describe: () => {
            const item = find(name);
            const hidden = !shown || ended || !visibleUp(item);
            const base = { bounds: stageRect(item), hidden };
            if (role === 'group') return { ...base, name: label ?? name };
            if (role === 'progressbar')
              return { ...base, name: label ?? name, range: { now: Math.round(item.value * 100), min: 0, max: 100 } };
            if (role === 'switch') return { ...base, name: item.text, checked: item.checked, disabled: item.disabled };
            if (role === 'button') return { ...base, name: item.text, disabled: item.disabled };
            return { ...base, name: item.text };
          },
          ...(role === 'button' || role === 'switch' || (role === 'group' && bind[name]?.tap !== undefined)
            ? { onActivate: () => press(find(name)) }
            : {})
        });
      }
    };

    const api: PlayView = {
      get: name => find(name).node,
      rect: name => {
        const item = find(name);
        return Object.freeze({ ...plan.parts[made.indexOf(item)]!.rect });
      },
      shows: name => shown && !ended && visibleUp(find(name)),
      get variant() {
        return plan.variant;
      },
      get visible() {
        return shown && !ended;
      },
      refresh,
      show() {
        if (ended) return;
        shown = true;
        root.visible = true;
      },
      hide() {
        shown = false;
        root.visible = false;
      },
      cover() {
        api.hide();
      },
      reveal() {
        api.show();
      },
      activate() {
        active = true;
        root.touchChildren = true;
      },
      deactivate() {
        active = false;
        root.touchChildren = false;
      },
      close() {
        api.dispose();
      },
      dispose() {
        if (ended) return;
        ended = true;
        record.end();
      }
    };
    const record: ViewRecord = {
      view: api,
      tick(seconds) {
        read(seconds);
      },
      arrange() {
        const next = planView(description, frame());
        if (next.variant !== plan.variant) {
          for (const item of made) if (item.words !== undefined) game.remove(item.words);
          for (const item of made) game.remove(item.node);
          build();
          return;
        }
        plan = next;
        placeDim();
        made.forEach((item, index) => {
          const planned = plan.parts[index]!;
          item.rect = relative(planned.rect, planned.parent < 0 ? undefined : plan.parts[planned.parent]!.rect);
          item.node.x = item.rect.x;
          item.node.y = item.rect.y;
          paint(item);
        });
      },
      end() {
        live.delete(record);
        for (const remove of removals.splice(0)) remove();
        for (const item of made) if (item.words !== undefined) game.remove(item.words);
        game.remove(root);
      }
    };
    build();
    registerSemantics();
    live.add(record);
    return api;
  }

  return {
    view,
    tick(seconds) {
      for (const record of [...live]) {
        try {
          record.tick(seconds);
        } catch (cause) {
          hooks.failed(cause);
        }
      }
    },
    arrange() {
      for (const record of [...live]) {
        try {
          record.arrange();
        } catch (cause) {
          hooks.failed(cause);
        }
      }
    },
    reset() {
      // A restart has taken the sprites away; what is left is to forget the views and their semantics.
      for (const record of [...live]) record.end();
      live.clear();
    }
  };
}

/** A rectangle measured from the corner of the one it is in. */
function relative(rect: ViewRect, parent: ViewRect | undefined): ViewRect {
  return parent === undefined
    ? rect
    : { x: rect.x - parent.x, y: rect.y - parent.y, width: rect.width, height: rect.height };
}
