// SPDX-License-Identifier: Apache-2.0
// Views of play: a screen described as data (./view.js), drawn with the game's own sprites and texts on its ui layer
// in a skin, and kept to the game's state by a table of bindings read every frame. Named parts reach code through
// `get`, tests and assistive technology through the semantic tree when the game gives one, and a screen stack through
// the handle a view is.
import { EgretError } from '@egret/runtime';
import type { DisplayObject } from '@egret/runtime';
import type { Sprite } from '@egret/engine';
import type { Paragraph, ParagraphCache } from '@egret/engine/paragraph';
import type { SemanticNode, UiSemantics } from '@egret/engine/ui/semantics';
import type { PlayGame, PlayText } from './BrowserPlay.js';
import { directViewActivation, viewTapActivation } from './playActivation.js';
import type { PlayViewActivation } from './playActivation.js';
import { TABLET_SHORT_SIDE, checkView, planView } from './view.js';
import { keyCap } from './viewParts.js';
import { planConfirmLayout, prepareConfirmCopy } from './playConfirm.js';
import type {
  ViewDescription,
  ViewPanel,
  ViewPart,
  ViewPlan,
  ViewPlannedPart,
  ViewRect,
  ViewSkin,
  ViewVariant
} from './view.js';
import { createPlayViewScrolls } from './playViewScroll.js';
import { clippedDisplayRect } from './screenClipGeometry.js';
import type { PlayScrollViewport, PlayViewScroll } from './playViewScroll.js';
import { createBrowserTextInput } from './BrowserTextInput.js';
import type { BrowserTextInput, BrowserTextInputRequest } from './BrowserTextInput.js';

/** How one named part follows the game's state. Each function is given the state and read every frame. */
export interface PlayViewBinding<S = unknown> {
  /** The words of a text, a button or a toggle. */
  readonly text?: (state: S) => string | number;
  /** Image address; undefined or empty clears the picture. The latest requested address alone may replace it. */
  readonly src?: (state: S) => string | undefined;
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
  /** A tab's current selected state. The game still owns selection and its visual style. */
  readonly selected?: (state: S) => boolean;
  /** Whether a button or a toggle cannot be used now: drawn grey, and a press does nothing. */
  readonly disabled?: (state: S) => boolean;
  readonly visible?: (state: S) => boolean;
  /** The current accessible name, independently of drawn text. Empty names fall back to the part default. */
  readonly label?: (state: S) => string;
  /** The colour of words, of a button, of a bar's fill or of a card. */
  readonly color?: (state: S) => number;
  /** What a press of a button, a toggle or a panel does. */
  readonly tap?: (state: S, activation: PlayViewActivation) => void;
  /** Answer only a direct pointer hit, without stopping ancestor handlers. */
  readonly tapTargetOnly?: boolean;
  /** For a panel with tap: keep the pointer action without keyboard, pad or semantic focus and activation. */
  readonly pointerOnly?: boolean;
  /** A red dot at the top right corner of a button, a toggle, a text or a panel: a count, or true for a dot alone. */
  readonly badge?: (state: S) => number | boolean;
}
/** A view to make: where its state comes from, its bindings, and who is told when its parts are made. */
export interface PlayViewOptions<S = unknown> {
  /** The state bindings read: an object, or a function that returns it. */
  readonly state?: S | (() => S);
  /** A binding for each named part that follows the state or answers a press. A name the view does not have is refused. */
  readonly bind?: { readonly [name: string]: PlayViewBinding<S> };
  /** Called after the parts are made, and again when the screen turns to the other set of parts. */
  readonly built?: (view: PlayView<S>) => void;
  /** An existing cache for width-wrapped labels and button descriptions. The caller owns the cache. */
  readonly paragraphCache?: ParagraphCache;
  /** Give this nonmodal view standard D-pad navigation and A activation. The top modal gets these automatically. */
  readonly gamepad?: boolean;
  /** The named control that a modal focuses on opening, if it can be revealed and focused. */
  readonly initialFocus?: string;
  /** Handle Escape or the pad's B on the top modal. Close the view here to restore its previous focus. */
  readonly dismiss?: (view: PlayView<S>) => void;
  /** Handle a fresh pad Start press on the top modal while the game is paused. */
  readonly resume?: (view: PlayView<S>) => void;
}
/** Native text input over the current clipped rectangle of a named view part. */
export type PlayViewEditOptions = Omit<BrowserTextInputRequest, 'x' | 'y' | 'width' | 'height'>;

/** A valued item in a native, scrollable selection dialog. */
export interface PlaySelectChoice<T extends string | number = string> {
  readonly value: T;
  readonly text: string;
  readonly disabled?: boolean;
}

/** The current selection, visible title, cancellation label and skin. */
export interface PlaySelectOptions<T extends string | number = string> {
  readonly value?: T;
  readonly title?: string;
  readonly cancel?: string;
  readonly skin?: Partial<ViewSkin>;
  /** Close the choice without selecting a value. */
  readonly signal?: AbortSignal;
}

/** A view on the screen. It is also a screen's handle: open one from a screen stack's `open` and it shows, hides and closes with the screen. */
export interface PlayView<S = unknown> {
  /** The sprite of a named part, to add to, tween or give gestures; another after the screen turns to other parts. */
  get(name: string): Sprite;
  /** The authored layout box in the game's design units; not moved by scrolling or display transforms. */
  rect(name: string): ViewRect;
  /** The transformed, clipped visible box in logical Stage units, or undefined when hidden or fully clipped. */
  visibleRect(name: string): ViewRect | undefined;
  /** Readiness of a named part’s current single-line text revision; undefined if it has no such text. */
  textReady(name: string): Promise<void> | undefined;
  /** Whether a named part, and every panel it is in, shows. */
  shows(name: string): boolean;
  /** The red dot a named part shows now: its count, true for a dot alone, or false for none. */
  badge(name: string): number | boolean;
  /** The position of a named scroll panel. The handle follows the name through a layout change. */
  scroll(name: string): PlayViewScroll;
  /** Which parts are used: `'tablet'` or `'tabletPortrait'` on a tablet, `'portrait'` upright, `'landscape'` for the root. */
  readonly variant: ViewVariant;
  readonly visible: boolean;
  /** The name of this view's currently actionable focused part, if any. */
  readonly focused: string | undefined;
  /** Focus a named part, revealing it within a scroll viewport if needed. Returns false if it cannot take focus. */
  focus(name: string): boolean;
  /** Edit an actionable part with the browser's native input and IME. */
  edit(name: string, options: PlayViewEditOptions): boolean;
  /** True while this view owns the active native text input. */
  readonly editing: boolean;
  /** Cancel the active edit if this view owns it. */
  cancelEdit(): void;
  /**
   * Replace the children of a named panel, using each direct child's name as its stable key.
   * Unchanged rows retain their sprites, text, resource borrows and focus; bindings are replaced for those children.
   * Pass both variants' common row descriptions here; their enclosing panel layouts can differ.
   * This materializes the rows, not a virtual list.
   */
  replaceChildren(
    name: string,
    children: readonly ViewPart[],
    bind?: Readonly<Record<string, PlayViewBinding<S>>>
  ): void;
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
  readonly scroll: PlayScrollViewport | undefined;
  readonly scrollParent: Made | undefined;
  readonly words: PlayText | undefined;
  paragraph: { readonly box: Sprite; readonly text: Paragraph; key: string | undefined } | undefined;
  image: Sprite | undefined;
  imageSrc?: string | undefined;
  imageRevision?: number;
  cancelImage?: (() => void) | undefined;
  rect: ViewRect;
  visible: boolean;
  disabled: boolean;
  checked: boolean;
  selected: boolean;
  value: number;
  color: number | undefined;
  text: string;
  semanticLabel: string | undefined;
  badge: number | boolean;
  dot: { readonly node: Sprite; readonly words: PlayText } | undefined;
  focusMark: Sprite | undefined;
}
interface Roll {
  from: number;
  to: number;
  shown: number;
  left: number;
}

// Keep declarative loads within BrowserGame's image budget across all views in this host.
const MAX_VIEW_IMAGE_LOADS = 4;

const KEYS_OF: Record<ViewPart['type'], readonly (keyof PlayViewBinding)[]> = {
  panel: ['label', 'disabled', 'visible', 'color', 'tap', 'tapTargetOnly', 'pointerOnly', 'badge'],
  text: ['label', 'text', 'pick', 'format', 'roll', 'visible', 'color', 'badge'],
  button: [
    'label',
    'text',
    'pick',
    'format',
    'roll',
    'disabled',
    'visible',
    'color',
    'tap',
    'tapTargetOnly',
    'badge',
    'selected'
  ],
  bar: ['label', 'value', 'visible', 'color'],
  toggle: ['label', 'text', 'checked', 'disabled', 'visible', 'tap', 'tapTargetOnly', 'badge'],
  space: ['visible'],
  image: ['label', 'visible', 'src']
};

/** A question to answer yes or no: the words of its two buttons, and a title over the question. */
export interface PlayConfirmOptions {
  /** `'OK'` unless given. */
  readonly yes?: string;
  /** `'Cancel'` unless given. */
  readonly no?: string;
  readonly title?: string;
  /** The same theme as a view: colours, text size and modal dim. */
  readonly skin?: Partial<ViewSkin>;
  /** Cancel button colour; retains its original slate unless given. */
  readonly noColor?: number;
}
/** One action a hint bar names: the key, the pad button and what a finger does for it. */
export interface PlayHint {
  /** What it does, as the player reads it: `'Jump'`. */
  readonly action: string;
  /** The key, as `game.keys` names it: `'space'`, `'escape'`, `'z'`. */
  readonly key?: string;
  /** The pad button, as `game.keys` names it without `pad:`: `'a'`, `'start'`. */
  readonly pad?: string;
  /** What a finger does, such as `'Tap'`; without it the hint is not shown on a touch screen. */
  readonly touch?: string;
}
/** A hint bar on the screen. */
export interface PlayHints {
  /** Names other actions. */
  set(list: readonly PlayHint[]): void;
  readonly visible: boolean;
  /** What it says now, one string a hint, such as `'Space Jump'`. */
  readonly shown: readonly string[];
  dispose(): void;
}
/** Loading to show: its words, and how many functions run at once. */
export interface PlayLoadingOptions {
  /** `'Loading'` unless given. */
  readonly label?: string;
  /** How many of the functions given run at once: 4 unless given. Promises given are already running. */
  readonly atOnce?: number;
}

/** Views of one play game: made by `game.view`, read every frame, placed again when the screen changes. */
export function createPlayViews(
  game: PlayGame,
  hooks: {
    readonly failed: (cause: unknown) => void;
    readonly semantics: () => UiSemantics | undefined;
    /** How much larger than the game's units a view is drawn: `game.uiScale`. 1 unless given. */
    readonly uiScale?: () => number;
  }
): {
  view<S>(description: ViewDescription, options?: PlayViewOptions<S>): PlayView<S>;
  confirm(message: string, options?: PlayConfirmOptions): Promise<boolean>;
  select<T extends string | number>(
    choices: readonly PlaySelectChoice<T>[],
    options?: PlaySelectOptions<T>
  ): Promise<T | undefined>;
  readonly editing: boolean;
  hints(list: readonly PlayHint[]): PlayHints;
  loading<T>(tasks: readonly (Promise<T> | (() => T | Promise<T>))[], options?: PlayLoadingOptions): Promise<T[]>;
  readonly asking: boolean;
  readonly modalActive: boolean;
  keyDown(event: KeyboardEvent, embedded: boolean): boolean;
  padButtons(pressed: ReadonlySet<string>, legacyAsking: boolean): ReadonlySet<string>;
  wheel(x: number, y: number, delta: number, mode: number): boolean;
  tick(seconds: number): void;
  arrange(): void;
  reset(): void;
} {
  const live = new Set<ViewRecord>();
  const scrollInput = createPlayViewScrolls(game);
  const makeScroll = scrollInput.create;
  let paragraphModule: Promise<typeof import('./playViewParagraph.js')> | undefined;
  let counter = 0;
  const waitingImages = new Set<() => Promise<void>>();
  let loadingImages = 0;

  function startWaitingImages(): void {
    for (const load of waitingImages) {
      if (loadingImages >= MAX_VIEW_IMAGE_LOADS) break;
      waitingImages.delete(load);
      loadingImages++;
      void load().finally(() => {
        loadingImages--;
        startWaitingImages();
      });
    }
  }

  function queueImage(load: () => Promise<void>): () => void {
    waitingImages.add(load);
    startWaitingImages();
    return () => {
      waitingImages.delete(load);
    };
  }

  interface ViewRecord {
    readonly view: PlayView;
    readonly initialFocus: string | undefined;
    modal(): boolean;
    padNavigation(): boolean;
    targets(): readonly string[];
    keeps(name: string): boolean;
    eligible(name: string): boolean;
    reveal(name: string): boolean;
    focusMark(name: string, visible: boolean): void;
    press(name: string, source: 'keyboard' | 'gamepad'): void;
    readonly dismiss: (() => void) | undefined;
    start(): void;
    tick(seconds: number): void;
    arrange(): void;
    end(): void;
  }
  interface Focus {
    readonly owner: ViewRecord;
    readonly name: string;
  }
  let focused: Focus | undefined, modalOwner: ViewRecord | undefined;
  let textEditor: BrowserTextInput | undefined;
  interface Editing {
    readonly owner: ViewRecord;
    readonly name: string;
    rect: ViewRect;
    width: number;
    height: number;
  }
  let editing: Editing | undefined;
  const selectionViews = new Set<PlayView>();
  const cancelSelections = new Set<() => void>();
  const beforeModal = new WeakMap<ViewRecord, Focus | undefined>();
  const topModal = (): ViewRecord | undefined => {
    let modal: ViewRecord | undefined;
    for (const view of live) if (view.modal()) modal = view;
    return modal;
  };
  const inView = (owner: ViewRecord, modal = topModal()): boolean => modal === undefined || modal === owner;
  const targets = (only?: ViewRecord): Focus[] => {
    const modal = topModal();
    return [...live]
      .filter(owner => inView(owner, modal) && (only === undefined || owner === only))
      .flatMap(owner => owner.targets().map(name => ({ owner, name })));
  };
  const eligible = (target: Focus | undefined): target is Focus =>
    target !== undefined && live.has(target.owner) && inView(target.owner) && target.owner.eligible(target.name);
  const focus = (next: Focus | undefined): void => {
    if (next?.owner === focused?.owner && next?.name === focused?.name) return;
    focused?.owner.focusMark(focused.name, false);
    focused = next;
    focused?.owner.focusMark(focused.name, true);
  };
  function cancelEdit(owner?: ViewRecord): void {
    if (editing !== undefined && (owner === undefined || editing.owner === owner)) textEditor?.cancel();
  }
  function syncEditing(): void {
    const current = editing;
    if (current === undefined || textEditor === undefined) return;
    if (!eligible({ owner: current.owner, name: current.name })) return cancelEdit();
    const rect = current.owner.view.visibleRect(current.name);
    if (rect === undefined || rect.width < 1 || rect.height < 1) return cancelEdit();
    const { width, height } = game.screen;
    if (width !== current.width || height !== current.height) {
      textEditor.resize(width, height);
      current.width = width;
      current.height = height;
    }
    if (
      rect.x !== current.rect.x ||
      rect.y !== current.rect.y ||
      rect.width !== current.rect.width ||
      rect.height !== current.rect.height
    ) {
      textEditor.move(rect);
      current.rect = rect;
    }
  }
  function startEdit(owner: ViewRecord, name: string, options: PlayViewEditOptions): boolean {
    if (!eligible({ owner, name })) return false;
    const rect = owner.view.visibleRect(name);
    if (rect === undefined || rect.width < 1 || rect.height < 1) return false;
    cancelEdit();
    // Native editing is only created when requested, with the browser's control,
    // selection, composition and key isolation rather than a second text editor.
    const { width, height } = game.screen;
    textEditor ??= createBrowserTextInput({
      canvas: game.canvas,
      logicalWidth: width,
      logicalHeight: height,
      zIndex: 30,
      onError: hooks.failed
    });
    focus({ owner, name });
    const current: Editing = { owner, name, rect, width, height };
    editing = current;
    try {
      textEditor.resize(width, height);
      textEditor.open({
        ...options,
        ...rect,
        onCommit(value) {
          if (editing === current) editing = undefined;
          options.onCommit?.(value);
        },
        onCancel() {
          if (editing === current) editing = undefined;
          options.onCancel?.();
        }
      });
    } catch (cause) {
      if (editing === current) editing = undefined;
      throw cause;
    }
    return true;
  }
  const syncModalFocus = (): void => {
    const modal = topModal();
    if (modal === modalOwner) return;
    const previous = modalOwner;
    modalOwner = modal;
    if (editing !== undefined && !inView(editing.owner, modal)) cancelEdit();
    if (modal !== undefined && !beforeModal.has(modal)) {
      beforeModal.set(modal, focused);
      const name = modal.initialFocus;
      focus(name !== undefined && modal.reveal(name) ? { owner: modal, name } : targets().find(eligible));
      return;
    }
    let restore = previous === undefined ? undefined : beforeModal.get(previous);
    if (previous !== undefined) beforeModal.delete(previous);
    // A covered dialog can be dismissed before the one covering it.
    while (restore !== undefined && !live.has(restore.owner)) {
      const saved = beforeModal.get(restore.owner);
      beforeModal.delete(restore.owner);
      restore = saved;
    }
    focus(eligible(restore) ? restore : targets().find(eligible));
  };
  const moveFocus = (step: number, wrap: boolean, only?: ViewRecord): boolean => {
    const choices = targets(only);
    const current = choices.findIndex(next => next.owner === focused?.owner && next.name === focused.name);
    const start = current < 0 ? (step > 0 ? 0 : choices.length - 1) : current + step;
    for (let offset = 0; offset < choices.length; offset++) {
      let index = start + offset * step;
      if (index < 0 || index >= choices.length) {
        if (!wrap) break;
        index = (index + choices.length) % choices.length;
      }
      const next = choices[index]!;
      if (next.owner.reveal(next.name)) {
        focus(next);
        return true;
      }
    }
    return false;
  };

  function view<S>(description: ViewDescription, options: PlayViewOptions<S> = {}): PlayView<S> {
    if (options === null || typeof options !== 'object')
      throw new EgretError('UI_VIEW_BINDING_INVALID', { cause: 'options' });
    const supplied = options.bind ?? {};
    if (supplied === null || typeof supplied !== 'object')
      throw new EgretError('UI_VIEW_BINDING_INVALID', { cause: 'bind' });
    let bind: Readonly<Record<string, PlayViewBinding<S>>> = Object.assign(Object.create(null), supplied);
    const validate = (description: ViewDescription, bind: Readonly<Record<string, PlayViewBinding<S>>>) => {
      const names = checkView(description);
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
              : key === 'pointerOnly' || key === 'tapTargetOnly'
                ? typeof value === 'boolean'
                : typeof value === 'function';
          if (!ok) throw new EgretError('UI_VIEW_BINDING_INVALID', { cause: name + ': ' + key });
        }
        if (binding.text !== undefined && binding.pick !== undefined)
          throw new EgretError('UI_VIEW_BINDING_INVALID', { cause: name + ': text or pick, not both' });
        if (binding.pointerOnly === true && binding.tap === undefined)
          throw new EgretError('UI_VIEW_BINDING_INVALID', { cause: name + ': pointerOnly needs tap' });
        if (binding.tapTargetOnly === true && binding.tap === undefined)
          throw new EgretError('UI_VIEW_BINDING_INVALID', { cause: name + ': tapTargetOnly needs tap' });
      }
      const checkRoles = (part: ViewPart): void => {
        const binding = part.name === undefined ? undefined : bind[part.name];
        if (part.type === 'button' && part.role !== 'tab' && binding?.selected !== undefined)
          throw new EgretError('UI_VIEW_BINDING_INVALID', { cause: part.name + ': selected needs a tab role' });
        if (part.type !== 'panel') return;
        if (part.role === 'button' && (binding?.tap === undefined || binding.pointerOnly === true))
          throw new EgretError('UI_VIEW_BINDING_INVALID', {
            cause: part.name + ': button role needs a non-pointerOnly tap'
          });
        if (part.role === 'tablist' && (binding?.tap !== undefined || binding?.disabled !== undefined))
          throw new EgretError('UI_VIEW_BINDING_INVALID', {
            cause: part.name + ': tablist is a container; bind tap and disabled on its tabs'
          });
        for (const child of part.children ?? []) checkRoles(child);
      };
      for (const parts of variantsOf(description)) checkRoles(parts);
      return names;
    };
    const names = validate(description, bind);
    const initialFocus = options.initialFocus;
    if (initialFocus !== undefined) {
      const type = typeof initialFocus === 'string' ? names.get(initialFocus) : undefined;
      const interactive =
        type === 'button' ||
        type === 'toggle' ||
        (type === 'panel' && bind[initialFocus]?.tap !== undefined && bind[initialFocus]?.pointerOnly !== true);
      if (description.modal !== true || !interactive)
        throw new EgretError('UI_VIEW_BINDING_INVALID', {
          cause: 'initialFocus names a focusable part on a modal view'
        });
    }
    if (options.built !== undefined && typeof options.built !== 'function')
      throw new EgretError('UI_VIEW_BINDING_INVALID', { cause: 'built' });
    const richStyle = (part: ViewPart) => (part.type === 'text' || part.type === 'button' ? part.paragraph : undefined);
    const usesParagraph = (part: ViewPart): boolean =>
      richStyle(part) !== undefined || (part.type === 'panel' && (part.children?.some(usesParagraph) ?? false));
    const paragraphCache = options.paragraphCache;
    if (paragraphCache === undefined && variantsOf(description).some(usesParagraph))
      throw new EgretError('UI_VIEW_BINDING_INVALID', { cause: 'paragraph parts need a paragraphCache' });
    if (options.gamepad !== undefined && typeof options.gamepad !== 'boolean')
      throw new EgretError('UI_VIEW_BINDING_INVALID', { cause: 'gamepad takes a boolean' });
    for (const key of ['dismiss', 'resume'] as const)
      if (options[key] !== undefined && (description.modal !== true || typeof options[key] !== 'function'))
        throw new EgretError('UI_VIEW_BINDING_INVALID', { cause: key + ' takes a callback on a modal view' });
    const invoke = (callback: ((view: PlayView<S>) => void) | undefined): void => {
      try {
        callback?.(api);
      } catch (cause) {
        hooks.failed(cause);
      }
    };
    const id = 'view' + ++counter;
    const state = (): S => (typeof options.state === 'function' ? (options.state as () => S)() : (options.state as S));
    const root = game.sprite(undefined, game.ui);
    let dim: Sprite | undefined;
    let plan: ViewPlan;
    let paragraphScope: ReturnType<PlayGame['engine']['createScope']> | undefined;
    let made: Made[] = [];
    let shown = true,
      active = true,
      ended = false;
    const rolls = new Map<string, Roll>();
    let readingBindings = false,
      replacingRows = false;
    const removals: (() => void)[] = [];
    const scrollHandles = new Map<string, PlayViewScroll>();
    let scrollItems: Made[] = [];

    // A view is drawn `uiScale` times larger than the game's units: its root is scaled, and it is planned in an area
    // that much smaller, so that it fills the same part of the screen. One with `uiScale: false` keeps the game's.
    const scaled = (area: ViewRect, by: number): ViewRect =>
      by === 1 ? area : { x: area.x / by, y: area.y / by, width: area.width / by, height: area.height / by };
    const frame = () => {
      const by = description.uiScale === false ? 1 : (hooks.uiScale?.() ?? 1);
      root.scaleX = root.scaleY = by;
      // A tablet's screen: its shorter side, in CSS pixels, at least TABLET_SHORT_SIDE.
      const plan = game.browser.screen,
        form: 'phone' | 'tablet' =
          Math.min(plan.width, plan.height) * plan.scale >= TABLET_SHORT_SIDE ? 'tablet' : 'phone';
      return { screen: scaled(game.screen, by), safe: scaled(game.safe, by), orientation: game.orientation, form };
    };
    const colourOf = (part: ViewPart, item: Made): number => {
      const skin = plan.skin;
      if (part.type === 'panel' && item.disabled && hasAction(item)) return skin.disabled;
      if (item.color !== undefined) return item.color;
      if (part.type === 'button') return item.disabled ? skin.disabled : (part.color ?? skin.button);
      if (part.type === 'bar') return part.color ?? skin.accent;
      if (part.type === 'panel') return part.color ?? skin.panel;
      if (part.type === 'text') return part.color ?? skin.text;
      return skin.text;
    };
    const borderWidth = ({ part, rect }: Made): number =>
      Math.min(part.border?.width ?? 0, rect.width / 2, rect.height / 2);
    const placeImage = (item: Made): void => {
      if (item.image === undefined) return;
      const { width, height } = item.rect;
      const border = borderWidth(item);
      const source = item.image.getBounds();
      // The cover fits inside the same edge used by the border paint.
      const scale =
        source.width > 0 && source.height > 0
          ? Math.min((width - border * 2) / source.width, (height - border * 2) / source.height)
          : 0;
      item.image.visible = scale > 0;
      item.image.x = width / 2;
      item.image.y = height / 2;
      item.image.scaleX = item.image.scaleY = scale;
    };
    const requestImage = (item: Made, address: string | undefined): void => {
      if (address !== undefined && typeof address !== 'string')
        throw new EgretError('UI_VIEW_BINDING_INVALID', {
          cause: item.part.name + ': src takes an address or undefined'
        });
      const src = address === '' ? undefined : address;
      if (item.imageRevision !== undefined && item.imageSrc === src) return;
      const revision = (item.imageRevision ?? 0) + 1;
      item.imageRevision = revision;
      item.imageSrc = src;
      item.cancelImage?.();
      item.cancelImage = undefined;
      if (src === undefined) {
        if (item.image !== undefined) game.remove(item.image);
        item.image = undefined;
        return;
      }
      const current = () => !ended && made.includes(item) && item.imageRevision === revision;
      item.cancelImage = queueImage(() =>
        game.image(src, { layer: item.node }).then(
          image => {
            if (!current()) {
              game.remove(image);
              return;
            }
            const previous = item.image;
            item.image = image;
            placeImage(item);
            if (previous !== undefined) game.remove(previous);
          },
          cause => {
            if (current()) hooks.failed(cause);
          }
        )
      );
    };
    const paintParagraph = (item: Made): void => {
      const { paragraph, part, rect } = item;
      if (part.type !== 'text' && part.type !== 'button') return;
      const style = part.paragraph;
      if (paragraph === undefined || style === undefined) return;
      const button = part.type === 'button';
      const at = button ? Math.min(8, rect.width / 2) : 0;
      const y = button ? Math.min(rect.height, Math.ceil((part.size ?? Math.round(plan.skin.size * 0.9)) + 12)) : 0;
      const width = rect.width - at * 2;
      const height = rect.height - y;
      paragraph.box.x = at;
      paragraph.box.y = y;
      paragraph.box.visible = width >= 1 && height > 0;
      if (!paragraph.box.visible) {
        paragraph.key = undefined;
        return;
      }
      paragraph.box.clipRect = { x: 0, y: 0, width, height };
      const text = button ? part.description! : item.text;
      const size = button ? Math.ceil((part.size ?? plan.skin.size) * 0.72) : (part.size ?? plan.skin.size);
      const color = button ? (part.textColor ?? plan.skin.buttonText) : colourOf(part, item);
      const density = style.density ?? 1;
      const key = JSON.stringify([text, size, color, width, density]);
      if (key === paragraph.key) return;
      paragraph.key = key;
      paragraph.text.setRequest({
        ...style,
        text,
        width,
        fontSize: size,
        direction: style.direction ?? 'ltr',
        locale: style.locale ?? 'en',
        textAlign: !button && part.type === 'text' ? (part.align ?? 'left') : 'center',
        fillColor: color,
        density
      });
      void paragraph.text.prepare().catch(cause => {
        if (
          !(cause instanceof EgretError && cause.code === 'PARAGRAPH_STALE') &&
          !ended &&
          !paragraph.text.isDisposed &&
          paragraph.key === key
        )
          hooks.failed(cause);
      });
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
      if (part.border !== undefined) {
        const { width, height } = rect;
        const edge = borderWidth(item);
        if (edge > 0) {
          g.beginFill(part.border.color)
            .drawRect(0, 0, width, edge)
            .drawRect(0, height - edge, width, edge)
            .drawRect(0, edge, edge, height - edge * 2)
            .drawRect(width - edge, edge, edge, height - edge * 2)
            .endFill();
        }
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
        words.y =
          part.type === 'button' && part.description !== undefined
            ? Math.min(rect.height / 2, (part.size ?? Math.round(skin.size * 0.9)) / 2 + 6)
            : rect.height / 2;
        if (part.type === 'toggle') words.alpha = item.disabled ? 0.5 : 1;
      }
      paintParagraph(item);
      placeImage(item);
      node.visible = item.visible;
      if (item.dot !== undefined) {
        const { node: dot, words: count } = item.dot;
        dot.visible = item.badge !== false;
        if (item.badge !== false) {
          const label = item.badge === true ? '' : item.badge > 99 ? '99+' : String(item.badge),
            h = label === '' ? 12 : 20,
            w = label === '' ? 12 : Math.max(20, label.length * 8 + 10);
          dot.x = rect.width - w / 2 - 2;
          dot.y = 2 - h / 4;
          dot.graphics
            .clear()
            .beginFill(0xef4444)
            .drawRoundRect(-w / 2, -h / 2, w, h, h)
            .endFill();
          count.text = label;
          count.x = 0;
          count.y = 0;
        }
      }
    };
    const nameOf = (item: Made): string | undefined => item.part.name;
    const bindingOf = (item: Made): PlayViewBinding<S> | undefined => {
      const name = nameOf(item);
      return name === undefined ? undefined : (bind[name] as PlayViewBinding<S> | undefined);
    };
    const hasAction = (item: Made): boolean =>
      item.part.type === 'button' ||
      item.part.type === 'toggle' ||
      (item.part.type === 'panel' && bindingOf(item)?.tap !== undefined);
    const pointerOnly = (item: Made): boolean => bindingOf(item)?.pointerOnly === true;
    const isShown = (): boolean => !ended && shown && visibleOnStage(root, game.browser.stage);
    const allowsInput = (): boolean => active && isShown() && inView(record);
    const hasInput = (item: Made): boolean =>
      active &&
      item.visible &&
      !item.disabled &&
      hasAction(item) &&
      visibleOnStage(item.node, game.browser.stage, true);
    const followsInput = (item: Made): boolean => allowsInput() && hasInput(item);
    // A leaf panel is one accessible control; its drawn children must not add duplicate or unreachable focus targets.
    const semanticsAllows = (item: Made): boolean => {
      const index = item.part.name === undefined ? made.indexOf(item) : plan.names.get(item.part.name)!;
      for (let at = index; at >= 0; at = plan.parts[at]!.parent) {
        const part = plan.parts[at]!.part;
        if (part.semantic === false || (at !== index && part.type === 'panel' && part.role === 'button')) return false;
      }
      return true;
    };
    const followsFocus = (item: Made): boolean => followsInput(item) && !pointerOnly(item) && semanticsAllows(item);
    const stageRect = (item: Made): ViewRect | undefined =>
      visibleRect(
        item.node,
        item.node.hitArea ?? { x: 0, y: 0, width: item.rect.width, height: item.rect.height },
        game.screen
      );
    const actionable = (item: Made): boolean => followsInput(item) && stageRect(item) !== undefined;
    const canFocus = (item: Made): boolean => actionable(item) && !pointerOnly(item) && semanticsAllows(item);
    const revealForTab = (item: Made): boolean => {
      if (!followsFocus(item)) return false;
      const offsets: { viewport: PlayScrollViewport; offset: number }[] = [];
      const box = item.node.hitArea ?? { x: 0, y: 0, width: item.rect.width, height: item.rect.height };
      for (let above = item.scrollParent; above !== undefined; above = above.scrollParent) {
        const viewport = above.scroll!;
        offsets.push({ viewport, offset: viewport.offset });
        viewport.reveal(item.node, box);
      }
      if (canFocus(item)) return true;
      // A candidate hidden by an unrelated clip cannot move the list during keyboard traversal.
      for (const { viewport, offset } of offsets) viewport.scrollTo(offset);
      return false;
    };
    const press = (item: Made, activation: PlayViewActivation): void => {
      if (!actionable(item) || (bindingOf(item)?.tapTargetOnly === true && !activation.isTarget)) return;
      const name = nameOf(item);
      if (name !== undefined && !pointerOnly(item) && semanticsAllows(item)) focus({ owner: record, name });
      const binding = bindingOf(item);
      try {
        binding?.tap?.(state(), activation);
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
    const syncScrollLayout = (): void => {
      if (scrollItems.length === 0) return;
      const sizes = new Map<Made, { y: number; padding: number; contentLength: number }>();
      const visible: boolean[] = [];
      for (const [index, item] of made.entries()) {
        const { parent, rect } = plan.parts[index]!;
        if (item.scroll !== undefined && item.part.type === 'panel')
          sizes.set(item, { y: rect.y, padding: item.part.padding ?? 0, contentLength: 0 });
        visible[index] = item.visible && (parent < 0 || visible[parent] === true);
        if (!visible[index] || item.scrollParent === undefined) continue;
        const viewport = sizes.get(item.scrollParent)!;
        // A nested viewport contributes its own bounds. Its children belong only to that viewport.
        const end = rect.y - viewport.y + rect.height + viewport.padding;
        viewport.contentLength = Math.max(viewport.contentLength, end);
      }
      for (const item of scrollItems)
        item.scroll!.layout(item.rect.width, item.rect.height, sizes.get(item)!.contentLength);
    };
    const disposeScrolls = (): void => {
      for (const item of scrollItems) item.scroll!.dispose();
      scrollItems = [];
    };
    // Each part is inside its panel; a scroll panel holds the parts in its moving content.
    const makeItem = (
      planned: ViewPlannedPart,
      offsets: ReadonlyMap<string, number> = new Map(),
      restoreRoll = true
    ): Made => {
      const { part } = planned;
      const container = planned.parent < 0 ? undefined : made[planned.parent]!;
      const parent = container?.scroll?.content ?? container?.node ?? root;
      const node = game.sprite(undefined, parent);
      // The part's name names its node, as a tool reading the controls of a game finds it.
      if (part.name !== undefined) node.name = part.name;
      const scroll =
        part.type === 'panel' && part.scroll === 'vertical'
          ? makeScroll(
              node,
              offsets.get(part.name ?? '') ?? 0,
              () => allowsInput() && visibleOnStage(node, game.browser.stage, true)
            )
          : undefined;
      const start =
        part.type === 'text' || part.type === 'button' || part.type === 'toggle' ? String(part.text ?? '') : '';
      const words =
        (part.type === 'text' && part.paragraph === undefined) || part.type === 'button' || part.type === 'toggle'
          ? game.text(start, {
              layer: node,
              size: part.size ?? (part.type === 'text' ? plan.skin.size : Math.round(plan.skin.size * 0.9)),
              align: part.type === 'button' ? 'center' : part.type === 'text' ? (part.align ?? 'left') : 'left',
              baseline: 'middle',
              ...(part.type === 'text' && part.bold !== undefined ? { bold: part.bold } : {}),
              ...(part.type === 'button' ? { bold: true } : {}),
              ...(part.fontFamily !== undefined ? { fontFamily: part.fontFamily } : {}),
              ...(part.fontWeight !== undefined ? { fontWeight: part.fontWeight } : {}),
              ...(part.italic !== undefined ? { italic: part.italic } : {})
            })
          : undefined;
      const previous = restoreRoll ? rolls.get(part.name ?? '') : undefined;
      const item: Made = {
        part,
        node,
        scroll,
        scrollParent: container?.scroll === undefined ? container?.scrollParent : container,
        words,
        paragraph: undefined,
        image: undefined,
        rect: relative(planned.rect, planned.parent < 0 ? undefined : plan.parts[planned.parent]!.rect),
        visible: part.visible ?? true,
        disabled: false,
        checked: part.type === 'toggle' ? (part.checked ?? false) : false,
        selected: part.type === 'button' && part.role === 'tab' ? (part.selected ?? false) : false,
        value: part.type === 'bar' ? (part.value ?? 1) : 0,
        color: undefined,
        text: previous !== undefined ? String(previous.shown) : start,
        semanticLabel: undefined,
        badge: false,
        dot: undefined,
        focusMark: undefined
      };
      if (richStyle(part) !== undefined) {
        paragraphScope ??= game.engine.createScope();
        const box = game.sprite(undefined, node);
        const owner = paragraphScope;
        paragraphModule ??= import('./playViewParagraph.js');
        void paragraphModule
          .then(({ createParagraph }) => {
            if (ended || !made.includes(item) || owner.state !== 'open') return;
            const text = createParagraph(game.engine, owner, paragraphCache!);
            box.addChild(text);
            item.paragraph = { box, text, key: undefined };
            paintParagraph(item);
          })
          .catch(cause => {
            if (!ended && made.includes(item)) hooks.failed(cause);
          });
      }
      if (part.type === 'image' && (part.name === undefined || bind[part.name]?.src === undefined))
        requestImage(item, part.src);
      if (part.name !== undefined && bind[part.name]?.badge !== undefined) {
        const dot = game.sprite(undefined, node);
        item.dot = {
          node: dot,
          words: game.text('', {
            layer: dot,
            size: 13,
            align: 'center',
            baseline: 'middle',
            bold: true,
            color: 0xffffff
          })
        };
      }
      node.x = item.rect.x;
      node.y = item.rect.y;
      const binding = part.name === undefined ? undefined : bind[part.name];
      if (part.type === 'button' || part.type === 'toggle' || (part.type === 'panel' && binding?.tap !== undefined))
        game.onTap(node, activation =>
          press(
            item,
            viewTapActivation(
              activation,
              nameOf(item),
              made.find(candidate => candidate.node === activation.target)?.part.name
            )
          )
        );
      return item;
    };
    const build = (offsets: ReadonlyMap<string, number> = new Map()): void => {
      plan = planView(description, frame());
      made = [];
      for (const planned of plan.parts) {
        const item = makeItem(planned, offsets);
        made.push(item);
        if (item.scroll !== undefined) scrollItems.push(item);
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
      syncScrollLayout();
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
      const screen = frame().screen;
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
      if (readingBindings)
        throw new EgretError('UI_VIEW_BINDING_INVALID', {
          cause: 'bindings cannot refresh the same view while being read'
        });
      readingBindings = true;
      try {
        let any = false;
        let scrollLayoutChanged = false;
        const now = state();
        for (const item of made) {
          const binding = bindingOf(item);
          if (binding === undefined) continue;
          const before = `${item.visible}|${item.disabled}|${item.checked}|${item.value}|${item.color}|${item.text}|${item.badge}`;
          if (binding.badge !== undefined) {
            const value = binding.badge(now);
            item.badge = value === true ? true : typeof value === 'number' && value >= 1 ? Math.floor(value) : false;
          }
          if (binding.visible !== undefined) {
            const visible = binding.visible(now) === true;
            if (item.visible !== visible) scrollLayoutChanged = true;
            item.visible = visible;
          }
          if (binding.disabled !== undefined) item.disabled = binding.disabled(now) === true;
          if (binding.checked !== undefined) item.checked = binding.checked(now) === true;
          // Selection describes the tab to assistive technology; its colour remains a separate binding.
          if (binding.selected !== undefined) item.selected = binding.selected(now) === true;
          if (binding.value !== undefined) {
            const value = binding.value(now);
            item.value = typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
          }
          if (binding.color !== undefined) {
            const value = binding.color(now);
            item.color = Number.isInteger(value) && value >= 0 && value <= 0xffffff ? value : undefined;
          }
          if (binding.label !== undefined) {
            const label = binding.label(now);
            item.semanticLabel =
              typeof label === 'string' && /\S/u.test(label)
                ? label
                    .slice(0, 1024)
                    .replace(/[\uD800-\uDBFF]$/u, '')
                    .trimEnd() || undefined
                : undefined;
          }
          if (binding.text !== undefined) item.text = String(binding.text(now));
          if (binding.src !== undefined) requestImage(item, binding.src(now));
          if (binding.pick !== undefined) {
            const target = binding.pick(now);
            const name = item.part.name!;
            let roll = rolls.get(name);
            if (typeof target === 'number' && Number.isFinite(target)) {
              if (roll === undefined) {
                roll = { from: target, to: target, shown: target, left: 0 };
                rolls.set(name, roll);
              } else if (roll.to !== target) {
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
          const after = `${item.visible}|${item.disabled}|${item.checked}|${item.value}|${item.color}|${item.text}|${item.badge}`;
          if (after !== before) {
            paint(item);
            any = true;
          }
        }
        if (scrollLayoutChanged) syncScrollLayout();
        return any;
      } finally {
        readingBindings = false;
      }
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
    const semanticNodes = new Map<string, SemanticNode>();
    let semanticRoot: SemanticNode | undefined;
    // Named parts in reading order, each inside its nearest named panel.
    const registerParts = (from = 0, to = plan.parts.length): void => {
      if (semantics === undefined) return;
      const first = plan;
      for (const planned of first.parts.slice(from, to)) {
        const name = planned.part.name;
        if (name === undefined || planned.part.type === 'space' || !semanticsAllows(made[planned.index]!)) continue;
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
            ? planned.part.type === 'panel'
              ? (planned.part.role ?? 'group')
              : 'group'
            : type === 'text'
              ? 'text'
              : type === 'button'
                ? planned.part.type === 'button'
                  ? (planned.part.role ?? 'button')
                  : 'button'
                : type === 'bar'
                  ? 'progressbar'
                  : type === 'image'
                    ? 'image'
                    : 'switch';
        const semantic = semantics.add({
          id: id + ':' + name,
          role,
          parent,
          describe: () => {
            const item = find(name);
            const label = item.semanticLabel ?? (item.part as { readonly label?: string }).label;
            const rect = stageRect(item),
              hidden =
                !isShown() ||
                !visibleOnStage(item.node, game.browser.stage) ||
                (role !== 'group' && role !== 'tablist' && rect === undefined),
              enabled = rect !== undefined && hasInput(item),
              base = {
                bounds: rect ?? EMPTY,
                hidden,
                focused:
                  enabled && !pointerOnly(item) && allowsInput() && focused?.owner === record && focused.name === name
              };
            if (role === 'group')
              return { ...base, name: label ?? name, disabled: hasAction(item) && !pointerOnly(item) && !enabled };
            if (role === 'tablist') return { ...base, name: label ?? name };
            if (role === 'image') {
              const imageLabel = item.part.type === 'image' ? item.part.label : undefined;
              const imageName = label ?? imageLabel;
              return { ...base, name: imageName ?? '', hidden: hidden || !imageName };
            }
            if (role === 'progressbar')
              return { ...base, name: label ?? name, range: { now: Math.round(item.value * 100), min: 0, max: 100 } };
            if (role === 'switch')
              return { ...base, name: label ?? item.text, checked: item.checked, disabled: !enabled };
            if (role === 'button' || role === 'tab') {
              const selected = role === 'tab' ? { selected: item.selected } : {};
              if (item.part.type === 'panel') return { ...base, name: label ?? name, disabled: !enabled };
              if (item.semanticLabel !== undefined)
                return { ...base, ...selected, name: item.semanticLabel, disabled: !enabled };
              const detail = item.part.type === 'button' ? item.part.description?.replace(/\s+/gu, ' ').trim() : '';
              // Preserve the title and keep its optional detail within the semantic name limit.
              const detailLimit = 1024 - item.text.length - 2;
              const suffix =
                detailLimit > 0
                  ? detail
                      ?.slice(0, detailLimit)
                      .replace(/[\uD800-\uDBFF]$/u, '')
                      .trimEnd()
                  : '';
              return { ...base, ...selected, name: suffix ? item.text + '. ' + suffix : item.text, disabled: !enabled };
            }
            // Optional noninteractive text has no semantic content while blank.
            // Retain an explicit accessible label, and keep interactive names strict.
            const textName = label ?? item.text;
            return { ...base, name: textName, hidden: hidden || !/\S/u.test(textName) };
          },
          ...(role === 'button' ||
          role === 'tab' ||
          role === 'switch' ||
          (role === 'group' && bind[name]?.tap !== undefined && bind[name]?.pointerOnly !== true)
            ? {
                onActivate: () => press(find(name), directViewActivation(name, 'semantic')),
                onFocus() {
                  if (canFocus(find(name))) focus({ owner: record, name });
                }
              }
            : {})
        });
        semanticNodes.set(name, semantic);
      }
    };
    const registerSemantics = (): void => {
      if (semantics === undefined) return;
      const top = semantics.add({
        id,
        role: description.modal === true ? 'dialog' : 'group',
        describe: () => ({
          ...(description.label !== undefined ? { name: description.label } : {}),
          bounds: stageRect(made[0]!) ?? EMPTY,
          hidden: !isShown(),
          ...(description.modal === true ? { modal: active } : {})
        })
      });
      semanticRoot = top;
      removals.push(() => {
        top.remove();
        semanticRoot = undefined;
        semanticNodes.clear();
      });
      registerParts();
    };
    const removeRowSemantics = (names: Set<string>): void => {
      for (const name of names) {
        semanticNodes.get(name)?.remove();
        semanticNodes.delete(name);
      }
    };
    const releaseItem = (item: Made): void => {
      item.cancelImage?.();
      item.imageRevision = (item.imageRevision ?? 0) + 1;
      item.paragraph?.text.dispose();
      for (const child of [item.words, item.dot?.words, item.image]) if (child !== undefined) game.remove(child);
    };
    const releaseContent = (): void => {
      for (const item of made) releaseItem(item);
      paragraphScope?.dispose();
      paragraphScope = undefined;
    };

    // Plans are pre-order; a root's descendants occupy one contiguous interval.
    const endOf = (p: ViewPlan, at: number): number => {
      let end = at + 1;
      while (end < p.parts.length && p.parts[end]!.parent >= at) end++;
      return end;
    };
    const rowNames = (children: readonly ViewPart[]): Set<string> => {
      const names = new Set<string>();
      const collect = (part: ViewPart): void => {
        if (part.name !== undefined) names.add(part.name);
        if (part.type === 'panel') for (const child of part.children ?? []) collect(child);
      };
      for (const child of children) {
        if (child?.name === undefined)
          throw new EgretError('UI_VIEW_BINDING_INVALID', { cause: 'collection rows need stable names' });
        collect(child);
      }
      return names;
    };
    const collectionPanel = (root: ViewPart, name: string): ViewPanel | undefined => {
      if (root.type !== 'panel') return undefined;
      if (root.name === name) return root;
      for (const child of root.children ?? []) {
        const result = collectionPanel(child, name);
        if (result !== undefined) return result;
      }
      return undefined;
    };
    const withChildren = (root: ViewPart, name: string, children: readonly ViewPart[]): ViewPart => {
      if (root.type !== 'panel') return root;
      if (root.name === name) return { ...root, children };
      const nested = root.children?.map(child => withChildren(child, name, children));
      return nested === undefined || nested.every((child, index) => child === root.children![index])
        ? root
        : { ...root, children: nested };
    };
    // Descriptions are data. Property order is not a reason to renew a retained node.
    const sameDescription = (a: unknown, b: unknown): boolean => {
      if (Object.is(a, b)) return true;
      if (
        a === null ||
        b === null ||
        typeof a !== 'object' ||
        typeof b !== 'object' ||
        Array.isArray(a) !== Array.isArray(b)
      )
        return false;
      const left = a as Record<string, unknown>,
        right = b as Record<string, unknown>;
      const keys = Object.keys(left);
      return (
        keys.length === Object.keys(right).length &&
        keys.every(key => Object.hasOwn(right, key) && sameDescription(left[key], right[key]))
      );
    };
    const compatible = (before: PlayViewBinding<S> | undefined, after: PlayViewBinding<S> | undefined): boolean => {
      const a = before ?? {},
        b = after ?? {};
      const keys = Object.keys(a) as (keyof PlayViewBinding<S>)[];
      return (
        keys.length === Object.keys(b).length &&
        keys.every(key => (typeof a[key] === 'function' ? typeof b[key] === 'function' : a[key] === b[key]))
      );
    };
    const layoutItems = (): void => {
      placeDim();
      made.forEach((item, index) => {
        const planned = plan.parts[index]!;
        item.rect = relative(planned.rect, planned.parent < 0 ? undefined : plan.parts[planned.parent]!.rect);
        item.node.x = item.rect.x;
        item.node.y = item.rect.y;
        paint(item);
        if (item.focusMark?.visible === true) setFocusOutline(item, plan.skin.accent);
      });
      syncScrollLayout();
    };
    // Membership changes are explicit rather than reallocating a collection descriptor every frame.
    const replaceRows = (
      name: string,
      children: readonly ViewPart[],
      replacement?: Readonly<Record<string, PlayViewBinding<S>>>
    ): void => {
      if (
        ended ||
        !Array.isArray(children) ||
        (replacement !== undefined && (replacement === null || typeof replacement !== 'object'))
      )
        throw new EgretError('UI_VIEW_BINDING_INVALID', {
          cause: 'replaceChildren needs a live named panel, rows and a binding table'
        });
      const original = collectionPanel(description.root, name);
      if (original === undefined)
        throw new EgretError('UI_VIEW_BINDING_INVALID', { cause: name + ': expected a named panel' });
      const oldNames = rowNames(original.children ?? []);
      for (const parts of variantsOf(description).slice(1)) {
        const other = collectionPanel(parts, name);
        const otherNames = other === undefined ? undefined : rowNames(other.children ?? []);
        if (
          otherNames === undefined ||
          otherNames.size !== oldNames.size ||
          [...oldNames].some(key => !otherNames.has(key))
        )
          throw new EgretError('UI_VIEW_VARIANT_MISMATCH', {
            cause: name + ': collection descendants must belong to the same panel in every variant'
          });
      }
      const nextDescription: ViewDescription = {
        ...description,
        root: withChildren(description.root, name, children),
        ...(description.portrait === undefined ? {} : { portrait: withChildren(description.portrait, name, children) }),
        ...(description.tablet === undefined ? {} : { tablet: withChildren(description.tablet, name, children) }),
        ...(description.tabletPortrait === undefined
          ? {}
          : { tabletPortrait: withChildren(description.tabletPortrait, name, children) })
      };
      // Validate shape, size, depth and globally unique names before traversing supplied rows.
      checkView(nextDescription);
      const newNames = rowNames(children),
        nextBind: Record<string, PlayViewBinding<S>> = Object.create(null);
      for (const [key, binding] of Object.entries(bind))
        if (!oldNames.has(key) || (replacement === undefined && newNames.has(key))) nextBind[key] = binding;
      if (replacement !== undefined)
        for (const [key, binding] of Object.entries(replacement)) {
          if (!newNames.has(key))
            throw new EgretError('UI_VIEW_BINDING_UNKNOWN', { cause: key + ' is outside the replacement rows' });
          nextBind[key] = binding;
        }
      validate(nextDescription, nextBind);
      if (paragraphCache === undefined && variantsOf(nextDescription).some(usesParagraph))
        throw new EgretError('UI_VIEW_BINDING_INVALID', { cause: 'paragraph parts need a paragraphCache' });
      const nextPlan = planView(nextDescription, frame());
      const oldPlan = plan,
        oldMade = made,
        oldBind = bind,
        oldDescription = description;
      const at = oldPlan.names.get(name)!,
        nextAt = nextPlan.names.get(name)!;
      if (nextAt !== at || nextPlan.variant !== oldPlan.variant)
        throw new EgretError('UI_VIEW_BINDING_INVALID', { cause: 'arrange the view before replacing rows' });
      const oldEnd = endOf(oldPlan, at),
        nextEnd = endOf(nextPlan, at);
      const reuse = new Map<number, Made>();
      for (let i = 0; i <= at; i++) reuse.set(i, oldMade[i]!);
      for (let i = nextEnd; i < nextPlan.parts.length; i++) reuse.set(i, oldMade[oldEnd + i - nextEnd]!);
      for (let i = at + 1; i < nextEnd; ) {
        const planned = nextPlan.parts[i]!,
          end = endOf(nextPlan, i);
        const old = oldPlan.names.get(planned.part.name!);
        if (
          old !== undefined &&
          oldPlan.parts[old]!.parent === at &&
          endOf(oldPlan, old) - old === end - i &&
          sameDescription(oldPlan.parts[old]!.part, planned.part)
        ) {
          let stable = true;
          for (let n = i; n < end; n++) {
            const key = nextPlan.parts[n]!.part.name;
            if (key !== undefined && !compatible(oldBind[key], nextBind[key])) stable = false;
          }
          if (stable) for (let n = i; n < end; n++) reuse.set(n, oldMade[old + n - i]!);
        }
        i = end;
      }
      const previousFocus = focused?.owner === record ? focused.name : undefined;
      const previousTargets = previousFocus === undefined ? [] : record.targets();
      const previousIndex = previousFocus === undefined ? -1 : previousTargets.indexOf(previousFocus);
      if (previousFocus !== undefined) focus(undefined);
      const created: Made[] = [];
      // Do not release the old resource graph until the new semantic tree is admitted.
      description = nextDescription;
      bind = nextBind;
      plan = nextPlan;
      made = [];
      let semanticsReplaced = false;
      try {
        for (const planned of plan.parts) {
          let item = reuse.get(planned.index);
          if (item === undefined) {
            // Rebuilt rows are new content, unlike the same named parts rebuilt by orientation.
            item = makeItem(planned, new Map(), false);
            created.push(item);
          }
          made.push(item);
        }
        // Keep the root and other parts mounted in the semantic tree. Replacing a row
        // in a covered view cannot change the reading order or priority of other dialogs.
        // built() can populate the collection before the outer view registers
        // semantics (also when switching portrait variant). That outer registration
        // will see this new plan; there is no attached subtree to replace yet.
        if (semanticRoot?.attached === true) {
          semanticsReplaced = true;
          removeRowSemantics(oldNames);
          registerParts(at + 1, nextEnd);
        }
      } catch (cause) {
        if (semanticsReplaced) removeRowSemantics(newNames);
        description = oldDescription;
        bind = oldBind;
        plan = oldPlan;
        made = oldMade;
        for (const item of created) {
          item.scroll?.dispose();
          releaseItem(item);
          game.remove(item.node);
        }
        if (semanticsReplaced) registerParts(at + 1, oldEnd);
        if (previousFocus !== undefined && record.reveal(previousFocus)) focus({ owner: record, name: previousFocus });
        throw cause;
      }
      const kept = new Set(made);
      for (const item of oldMade)
        if (!kept.has(item)) {
          item.scroll?.dispose();
          releaseItem(item);
          game.remove(item.node);
          const key = item.part.name;
          if (key !== undefined) {
            rolls.delete(key);
            if (!plan.names.has(key)) scrollHandles.delete(key);
          }
        }
      // Reordering retained row roots, rather than renewing their sprite identities,
      // also reorders pointer hit testing and the semantic registration above.
      const parent = made[at]!.scroll?.content ?? made[at]!.node;
      let position = 0;
      for (let i = at + 1; i < nextEnd; i = endOf(plan, i)) parent.setChildIndex(made[i]!.node, position++);
      scrollItems = made.filter(item => item.scroll !== undefined);
      // The structure is now committed. Establish its authored geometry and
      // recover focus even if an application binding throws while reading it.
      layoutItems();
      try {
        read(0);
      } catch (cause) {
        // Runtime bindings are not description validation. Reconcile any values
        // already assigned and keep the committed result arranged before reporting.
        layoutItems();
        throw cause;
      } finally {
        if (previousFocus !== undefined) {
          if (record.reveal(previousFocus)) focus({ owner: record, name: previousFocus });
          else {
            const choices = record.targets(),
              start = Math.min(previousIndex, choices.length - 1);
            const order = [...choices.slice(Math.max(0, start)), ...choices.slice(0, Math.max(0, start)).reverse()];
            const fallback = order.find(key => record.reveal(key));
            if (fallback !== undefined) focus({ owner: record, name: fallback });
          }
        }
      }
    };
    const replaceChildren: PlayView<S>['replaceChildren'] = (name, children, replacement) => {
      if (readingBindings || replacingRows)
        throw new EgretError('UI_VIEW_BINDING_INVALID', {
          cause: 'collection replacement cannot reenter the view from a binding or a replacement'
        });
      replacingRows = true;
      try {
        replaceRows(name, children, replacement);
      } finally {
        replacingRows = false;
      }
    };

    const api: PlayView<S> = {
      get: name => find(name).node,
      rect: name => {
        const item = find(name);
        return Object.freeze({ ...plan.parts[made.indexOf(item)]!.rect });
      },
      visibleRect: name => {
        const item = find(name);
        if (!isShown() || !visibleOnStage(item.node, game.browser.stage)) return undefined;
        const rect = stageRect(item);
        return rect === undefined ? undefined : Object.freeze({ ...rect });
      },
      textReady: name => (ended ? undefined : made[plan.names.get(name) ?? -1]?.words?.ready),
      shows: name => shown && !ended && visibleUp(find(name)),
      badge: name => find(name).badge,
      scroll(name) {
        const current = (): PlayScrollViewport => {
          const viewport = find(name).scroll;
          if (viewport === undefined)
            throw new EgretError('UI_VIEW_BINDING_INVALID', { cause: name + ': expected a scroll panel' });
          return viewport;
        };
        current();
        let handle = scrollHandles.get(name);
        if (handle === undefined) {
          handle = Object.freeze({
            get offset() {
              return current().offset;
            },
            get maximum() {
              return current().maximum;
            },
            scrollTo: (position: number) => current().scrollTo(position),
            scrollBy: (delta: number) => current().scrollBy(delta),
            page: (direction: -1 | 1) => current().page(direction)
          });
          scrollHandles.set(name, handle);
        }
        return handle;
      },
      get variant() {
        return plan.variant;
      },
      get visible() {
        return shown && !ended;
      },
      get focused() {
        return focused?.owner === record && eligible(focused) ? focused.name : undefined;
      },
      focus(name) {
        if (!live.has(record) || !allowsInput() || !revealForTab(find(name))) return false;
        focus({ owner: record, name });
        return true;
      },
      edit(name, request) {
        return startEdit(record, name, request);
      },
      get editing() {
        return editing?.owner === record;
      },
      cancelEdit() {
        cancelEdit(record);
      },
      replaceChildren,
      refresh,
      show() {
        if (ended) return;
        shown = true;
        root.visible = true;
        syncModalFocus();
      },
      hide() {
        shown = false;
        root.visible = false;
        cancelEdit(record);
        syncModalFocus();
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
        syncModalFocus();
      },
      deactivate() {
        active = false;
        root.touchChildren = false;
        cancelEdit(record);
        syncModalFocus();
      },
      close() {
        api.dispose();
      },
      dispose() {
        if (ended) return;
        record.end();
      }
    };
    const record: ViewRecord = {
      view: api,
      initialFocus,
      modal: () => description.modal === true && active && isShown(),
      padNavigation: () => options.gamepad === true && active && isShown(),
      targets: () => made.flatMap(item => (item.part.name !== undefined && followsFocus(item) ? [item.part.name] : [])),
      keeps: name => plan.names.has(name) && followsFocus(find(name)),
      eligible: name => plan.names.has(name) && canFocus(find(name)),
      reveal: name => plan.names.has(name) && revealForTab(find(name)),
      focusMark(name, visible) {
        if (!plan.names.has(name)) return;
        const item = find(name);
        if (item.node.isDisposed) return;
        if (item.focusMark === undefined) {
          if (!visible) return;
          item.focusMark = game.sprite(undefined, item.node);
          setFocusOutline(item, plan.skin.accent);
        }
        item.focusMark.visible = visible;
      },
      press: (name, source) => {
        if (plan.names.has(name)) press(find(name), directViewActivation(name, source));
      },
      dismiss: options.dismiss === undefined ? undefined : () => invoke(options.dismiss),
      start: () => invoke(options.resume),
      tick(seconds) {
        read(seconds);
      },
      arrange() {
        const next = planView(description, frame());
        if (next.variant !== plan.variant) {
          const offsets = new Map<string, number>();
          for (const item of scrollItems)
            if (item.part.name !== undefined) offsets.set(item.part.name, item.scroll!.offset);
          disposeScrolls();
          releaseContent();
          for (const item of made) game.remove(item.node);
          // A covered modal must keep its original semantic root order when its variant changes.
          // Its descendants may be reparented by the new description, so rebuild those alone.
          const retainedRoot = semanticRoot?.attached === true ? semanticRoot : undefined;
          try {
            if (retainedRoot !== undefined) {
              removeRowSemantics(new Set(semanticNodes.keys()));
              // A built callback can replace rows. Treat descendants as not yet registered, just as on the
              // initial build, without detaching the actual modal root or losing its order in the tree.
              semanticRoot = undefined;
            } else for (const remove of removals.splice(0)) remove();
            build(offsets);
            if (!ended) {
              if (retainedRoot?.attached === true) {
                semanticRoot = retainedRoot;
                registerParts();
              } else {
                for (const remove of removals.splice(0)) remove();
                registerSemantics();
              }
            }
          } catch (cause) {
            // Do not publish a root whose replacement descendants failed partway through construction.
            for (const remove of removals.splice(0)) remove();
            throw cause;
          }
          if (focused?.owner === record) record.focusMark(focused.name, eligible(focused));
          return;
        }
        plan = next;
        layoutItems();
      },
      end() {
        if (ended) return;
        ended = true;
        cancelEdit(record);
        live.delete(record);
        syncModalFocus();
        if (focused?.owner === record) focus(undefined);
        for (const remove of removals.splice(0)) remove();
        disposeScrolls();
        releaseContent();
        game.remove(root);
      }
    };
    build();
    if (!ended) {
      registerSemantics();
      live.add(record);
      syncModalFocus();
    }
    return api;
  }

  // Questions asked one at a time; each waits for the one before it to be answered.
  let asked: Promise<unknown> = Promise.resolve(),
    open:
      | { readonly answer: (yes: boolean) => void; readonly view: PlayView; readonly relayout: () => void }
      | undefined,
    // A question opened this frame does not take the key that opened it.
    openedAt = -1,
    frame = 0;
  let confirmMeasure: CanvasRenderingContext2D | undefined;
  const measureConfirm = (words: string, size: number, bold: boolean): number => {
    confirmMeasure ??= game.canvas.ownerDocument.createElement('canvas').getContext('2d') ?? undefined;
    if (confirmMeasure === undefined)
      throw new EgretError('UI_VIEW_BINDING_INVALID', { cause: 'confirm requires canvas text measurement' });
    // Match the normal PlayText rasterizer: one literal sans-serif family and weights 400/700.
    confirmMeasure.font = `normal ${bold ? 700 : 400} ${size}px "sans-serif"`;
    return confirmMeasure.measureText(words).width;
  };
  const confirm = (message: string, options: PlayConfirmOptions = {}): Promise<boolean> => {
    const copy = prepareConfirmCopy(message, options);
    const turn = asked.then(
      () =>
        new Promise<boolean>(resolve => {
          let view: PlayView | undefined,
            layoutKey = '';
          const answer = (yes: boolean): void => {
            if (open?.answer !== answer) return;
            open = undefined;
            view?.close();
            resolve(yes);
          };
          const relayout = (): void => {
            const scale = hooks.uiScale?.() ?? 1,
              width = game.safe.width / scale,
              height = game.safe.height / scale,
              cssScale = game.browser.screen.scale * scale,
              key = `${width}:${height}:${cssScale}`;
            if (key === layoutKey) return;
            const previous = view,
              focused = previous?.focused === 'no' ? 'no' : 'yes';
            // Retain the old modal until the replacement has been built; a failed reflow must not resolve the question.
            let offset: number | undefined;
            try {
              offset = previous?.scroll('confirmCopy').offset;
            } catch {
              /* An unscrolled question has no viewport. */
            }
            view = api(planConfirmLayout(copy, { width, height, cssScale }, measureConfirm), {
              initialFocus: focused,
              dismiss: () => answer(false),
              bind: {
                question: { label: () => copy.message },
                ...(copy.title === undefined ? {} : { confirmTitle: { label: () => copy.title! } }),
                no: { label: () => copy.no, tap: () => answer(false) },
                yes: { label: () => copy.yes, tap: () => answer(true) }
              }
            });
            layoutKey = key;
            open = { answer, view, relayout };
            if (offset !== undefined)
              try {
                view.scroll('confirmCopy').scrollTo(offset);
              } catch {
                /* The new size may no longer need scrolling. */
              }
            previous?.close();
          };
          relayout();
          openedAt = frame;
        })
    );
    // Even if a queued modal cannot be built, later valid confirmations still get a turn.
    asked = turn.then(
      () => undefined,
      () => undefined
    );
    return turn;
  };
  const select = <T extends string | number>(
    choices: readonly PlaySelectChoice<T>[],
    options: PlaySelectOptions<T> = {}
  ): Promise<T | undefined> => {
    if (!Array.isArray(choices) || choices.length > 1000)
      throw new EgretError('UI_VIEW_BINDING_INVALID', { cause: 'select takes at most 1000 choices' });
    const values = new Set<string | number>();
    for (const choice of choices) {
      if (
        !choice ||
        typeof choice !== 'object' ||
        !(typeof choice.value === 'string' || (typeof choice.value === 'number' && Number.isFinite(choice.value))) ||
        typeof choice.text !== 'string' ||
        !choice.text.trim() ||
        (choice.disabled !== undefined && typeof choice.disabled !== 'boolean') ||
        values.has(choice.value)
      )
        throw new EgretError('UI_VIEW_BINDING_INVALID', {
          cause: 'select choices need unique values, text and optional disabled'
        });
      values.add(choice.value);
    }
    if (options.signal?.aborted) return Promise.resolve(undefined);
    return new Promise<T | undefined>((resolve, reject) => {
      let shown: PlayView | undefined,
        finished = false;
      const finish = (value?: T): void => {
        if (finished) return;
        finished = true;
        cancelSelections.delete(cancel);
        options.signal?.removeEventListener('abort', cancel);
        if (shown !== undefined) {
          selectionViews.delete(shown);
          shown.close();
        }
        resolve(value);
      };
      const cancel = (): void => finish();
      const bind: Record<string, PlayViewBinding> = {};
      const firstEnabled = choices.findIndex(choice => !choice.disabled);
      const selectedIndex = choices.findIndex(choice => choice.value === options.value && !choice.disabled);
      const items: ViewPart[] = choices.map((choice, index) => {
        const name = 'choice' + index;
        const selected = choice.value === options.value;
        bind[name] = {
          label: () => choice.text,
          disabled: () => choice.disabled === true,
          tap: () => finish(choice.value)
        };
        return {
          type: 'button',
          name,
          text: (selected ? '✓ ' : '') + choice.text,
          width: 'fill',
          height: 52,
          ...(selected ? { color: options.skin?.accent ?? 0x38604f } : {})
        };
      });
      bind.cancel = { tap: cancel };
      const parts: ViewPart[] = [
        ...(options.title === undefined
          ? []
          : [
              {
                type: 'text' as const,
                name: 'title',
                text: options.title,
                width: 'fill' as const,
                height: 40,
                bold: true
              }
            ]),
        {
          type: 'panel',
          name: 'choices',
          layout: 'column',
          width: 'fill',
          height: 'fill',
          scroll: 'vertical',
          gap: 5,
          children: items
        },
        { type: 'button', name: 'cancel', text: options.cancel ?? 'Cancel', width: 'fill', height: 48 }
      ];
      try {
        shown = view(
          {
            modal: true,
            ...(options.title === undefined ? {} : { label: options.title }),
            ...(options.skin === undefined ? {} : { skin: options.skin }),
            root: {
              type: 'panel',
              layout: 'column',
              anchor: 'center',
              width: '92%',
              height: '90%',
              card: true,
              padding: 8,
              gap: 6,
              children: parts
            }
          },
          {
            initialFocus:
              selectedIndex >= 0 ? 'choice' + selectedIndex : firstEnabled >= 0 ? 'choice' + firstEnabled : 'cancel',
            bind,
            dismiss: cancel
          }
        );
        selectionViews.add(shown);
        cancelSelections.add(cancel);
        options.signal?.addEventListener('abort', cancel, { once: true });
      } catch (cause) {
        reject(cause);
      }
    });
  };
  const hints = (list: readonly PlayHint[]): PlayHints => {
    let current: readonly PlayHint[] = [],
      view: PlayView | undefined,
      device = '',
      shown: readonly string[] = [],
      ended = false;
    const check = (next: readonly PlayHint[]): readonly PlayHint[] => {
      if (!Array.isArray(next)) throw new EgretError('UI_VIEW_BINDING_INVALID', { cause: 'hints take a list' });
      for (const hint of next)
        if (
          hint === null ||
          typeof hint !== 'object' ||
          typeof hint.action !== 'string' ||
          (['key', 'pad', 'touch'] as const).some(key => hint[key] !== undefined && typeof hint[key] !== 'string')
        )
          throw new EgretError('UI_VIEW_BINDING_INVALID', { cause: 'a hint is { action, key, pad, touch }' });
      return Object.freeze([...next]);
    };
    const capOf = (hint: PlayHint, on: string): string | undefined =>
      on === 'gamepad'
        ? hint.pad === undefined
          ? undefined
          : keyCap(hint.pad, 'gamepad')
        : on === 'touch'
          ? hint.touch
          : hint.key === undefined
            ? undefined
            : keyCap(hint.key, 'keyboard');
    // A rough width of words, for the bar is laid out before they are drawn: wide characters take a whole size.
    const across = (words: string, size: number): number =>
      [...words].reduce((sum, character) => sum + ((character.codePointAt(0) ?? 0) >= 0x2e80 ? size : size * 0.56), 0);
    const draw = (): void => {
      view?.close();
      view = undefined;
      device = game.device;
      const shownHints = current.flatMap(hint => {
        const cap = capOf(hint, device);
        return cap === undefined || cap === '' ? [] : [{ hint, cap }];
      });
      shown = Object.freeze(shownHints.map(({ hint, cap }) => cap + ' ' + hint.action));
      if (ended || shownHints.length === 0) return;
      view = api({
        area: 'safe',
        root: {
          type: 'panel',
          anchor: 'bottom',
          y: 8,
          height: 36,
          layout: 'row',
          gap: 20,
          justify: 'center',
          children: shownHints.map(({ hint, cap }) => ({
            type: 'panel' as const,
            layout: 'row' as const,
            gap: 8,
            align: 'center' as const,
            width: Math.ceil(Math.max(30, across(cap, 16) + 18) + 8 + across(hint.action, 18)),
            children: [
              {
                type: 'panel' as const,
                color: 0x334155,
                alpha: 0.95,
                width: Math.ceil(Math.max(30, across(cap, 16) + 18)),
                height: 30,
                children: [
                  {
                    type: 'text' as const,
                    text: cap,
                    size: 16,
                    bold: true,
                    align: 'center' as const,
                    width: 'fill' as const,
                    height: 'fill' as const
                  }
                ]
              },
              { type: 'text' as const, text: hint.action, size: 18, width: 'fill' as const }
            ]
          }))
        }
      });
    };
    current = check(list);
    const record = {
      tick() {
        if (!ended && game.device !== device) draw();
      },
      end() {
        ended = true;
        hintBars.delete(record);
        view?.close();
        view = undefined;
      }
    };
    hintBars.add(record);
    draw();
    return {
      set(next) {
        current = check(next);
        draw();
      },
      get visible() {
        return view?.visible === true;
      },
      get shown() {
        return shown;
      },
      dispose: () => record.end()
    };
  };
  const hintBars = new Set<Pick<ViewRecord, 'tick' | 'end'>>();
  const loading = async <T>(
    tasks: readonly (Promise<T> | (() => T | Promise<T>))[],
    options: PlayLoadingOptions = {}
  ): Promise<T[]> => {
    if (!Array.isArray(tasks) || options === null || typeof options !== 'object')
      throw new EgretError('UI_VIEW_BINDING_INVALID', { cause: 'loading takes a list of promises or functions' });
    const atOnce = options.atOnce ?? 4;
    if (!Number.isInteger(atOnce) || atOnce < 1)
      throw new EgretError('UI_VIEW_BINDING_INVALID', { cause: 'loading: atOnce is a whole number above 0' });
    const total = tasks.length,
      label = options.label ?? 'Loading';
    const state = { done: 0 };
    const view = api(
      {
        label,
        modal: true,
        root: {
          type: 'panel',
          card: true,
          alpha: 1,
          anchor: 'center',
          width: 320,
          height: 96,
          padding: 18,
          layout: 'column',
          gap: 12,
          children: [
            { type: 'text', name: 'count', align: 'center' },
            { type: 'bar', name: 'progress', label, height: 12 }
          ]
        }
      },
      {
        state,
        bind: {
          count: { text: s => label + ' ' + s.done + ' / ' + total },
          progress: { value: s => (total === 0 ? 1 : s.done / total) }
        }
      }
    );
    const results: T[] = new Array(total);
    let next = 0;
    const worker = async (): Promise<void> => {
      while (next < total) {
        const index = next++,
          task = tasks[index]!;
        results[index] = await (typeof task === 'function' ? task() : task);
        state.done++;
      }
    };
    try {
      await Promise.all(Array.from({ length: Math.min(atOnce, Math.max(1, total)) }, worker));
      view.refresh();
      return results;
    } finally {
      view.close();
    }
  };
  const api = view;
  const noPadButtons: ReadonlySet<string> = new Set();
  const navigationPadButtons: ReadonlySet<string> = new Set(['up', 'down', 'left', 'right', 'a']);
  const modalPadButtons: ReadonlySet<string> = new Set([...navigationPadButtons, 'b']);
  const pausedModalPadButtons: ReadonlySet<string> = new Set([...modalPadButtons, 'start']);

  return {
    view,
    confirm,
    select,
    get editing() {
      return editing !== undefined;
    },
    hints,
    loading,
    get asking() {
      return open !== undefined || cancelSelections.size !== 0;
    },
    get modalActive() {
      return topModal() !== undefined;
    },
    wheel: scrollInput.wheel,
    keyDown(event, embedded) {
      if (event.altKey || event.ctrlKey || event.metaKey) return false;
      if (
        ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code) &&
        modalOwner !== undefined &&
        selectionViews.has(modalOwner.view)
      ) {
        if (!event.repeat) moveFocus(event.code === 'ArrowUp' || event.code === 'ArrowLeft' ? -1 : 1, true, modalOwner);
        return true;
      }
      if (event.code !== 'Escape' && event.code !== 'Tab' && event.code !== 'Enter' && event.code !== 'Space')
        return false;
      syncModalFocus();
      if (event.code === 'Escape') {
        if (modalOwner?.dismiss === undefined) return false;
        if (!event.repeat) modalOwner.dismiss();
        return true;
      }
      if (event.code !== 'Tab') {
        if (!eligible(focused)) return modalOwner !== undefined;
        if (!event.repeat) focused.owner.press(focused.name, 'keyboard');
        return true;
      }
      if (moveFocus(event.shiftKey ? -1 : 1, !embedded || modalOwner !== undefined)) return true;
      if (modalOwner !== undefined) return true;
      focus(undefined);
      return false;
    },
    padButtons(pressed, legacyAsking) {
      syncModalFocus();
      if (editing !== undefined) {
        if (pressed.has('b')) cancelEdit();
        return pausedModalPadButtons;
      }
      const modal = modalOwner;
      let owner = modal;
      if (owner === undefined && !legacyAsking) for (const record of live) if (record.padNavigation()) owner = record;
      if (owner === undefined) return noPadButtons;
      const claimed =
        modal === undefined ? navigationPadButtons : game.paused ? pausedModalPadButtons : modalPadButtons;
      // Keep this sample with its original owner even when a callback closes or replaces the view.
      if (modal !== undefined && pressed.has('b')) {
        modal.dismiss?.();
      } else if (claimed.has('start') && pressed.has('start')) {
        owner.start();
      } else {
        if (pressed.has('up') || pressed.has('left')) moveFocus(-1, true, owner);
        else if (pressed.has('down') || pressed.has('right')) moveFocus(1, true, owner);
        if (pressed.has('a')) {
          if (focused?.owner !== owner || !eligible(focused)) moveFocus(1, true, owner);
          if (focused?.owner === owner && eligible(focused)) owner.press(focused.name, 'gamepad');
        }
      }
      return claimed;
    },
    tick(seconds) {
      frame++;
      if (open !== undefined && topModal()?.view === open.view && frame > openedAt + 1) {
        const keys = game.keys;
        // Virtual touch buttons can also send these key names. Hardware decisions go through the active view above.
        if (keys.pressed('enter', 'space', 'pad:a')) open.answer(true);
        else if (keys.pressed('escape', 'pad:b')) open.answer(false);
      }
      for (const record of [...hintBars]) record.tick(seconds);
      for (const record of [...live]) {
        try {
          record.tick(seconds);
        } catch (cause) {
          hooks.failed(cause);
        }
      }
      syncModalFocus();
      syncEditing();
      if (focused !== undefined) {
        if (!focused.owner.keeps(focused.name)) focus(undefined);
        else focused.owner.focusMark(focused.name, eligible(focused));
      }
    },
    arrange() {
      if (open !== undefined)
        try {
          open.relayout();
        } catch (cause) {
          hooks.failed(cause);
        }
      for (const record of [...live]) {
        try {
          record.arrange();
        } catch (cause) {
          hooks.failed(cause);
        }
      }
      syncEditing();
    },
    reset() {
      // A restart has taken the sprites away; what is left is to forget the views and their semantics. A question
      // still open is answered no, so what awaits it goes on.
      open?.answer(false);
      for (const cancel of [...cancelSelections]) cancel();
      cancelEdit();
      textEditor?.dispose();
      textEditor = undefined;
      for (const record of [...hintBars]) record.end();
      for (const record of [...live]) record.end();
      live.clear();
    }
  };
}

const EMPTY: ViewRect = Object.freeze({ x: 0, y: 0, width: 0, height: 0 });

function setFocusOutline(item: Made, colour: number): void {
  const g = item.focusMark!.graphics,
    { x, y, width, height } = item.node.hitArea ?? EMPTY;
  g.clear();
  if (width > 4 && height > 4)
    g.lineStyle(2, colour)
      .drawRect(x + 1, y + 1, width - 2, height - 2)
      .lineStyle();
}

function visibleOnStage(node: DisplayObject, stage: DisplayObject, input = false): boolean {
  if (input && !node.touchEnabled) return false;
  for (let at: DisplayObject | undefined = node; at !== undefined; at = at.parent) {
    if (at.isDisposed || !at.visible) return false;
    if (at === stage) return true;
    if (input && at.parent?.touchChildren === false) return false;
  }
  return false;
}

const visibleRect = (node: DisplayObject, area: ViewRect, screen: ViewRect): ViewRect | undefined =>
  clippedDisplayRect(node, area, screen);

/** A rectangle measured from the corner of the one it is in. */
function relative(rect: ViewRect, parent: ViewRect | undefined): ViewRect {
  return parent === undefined
    ? rect
    : { x: rect.x - parent.x, y: rect.y - parent.y, width: rect.width, height: rect.height };
}

/** The parts of every variant a description has: `root` first, then portrait, tablet and tablet upright. */
function variantsOf(description: ViewDescription): ViewPart[] {
  return [description.root, description.portrait, description.tablet, description.tabletPortrait].filter(
    (parts): parts is ViewPart => parts !== undefined
  );
}
