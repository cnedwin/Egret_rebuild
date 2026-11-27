// SPDX-License-Identifier: Apache-2.0
import { bitmapLabelClass } from './compat/bitmap-label.mjs';
import { Direction, progressClass, tabWidths } from './compat/skin-controls.mjs';
import {
  HorizontalLayout,
  VerticalLayout,
  TileLayout,
  ScrollPolicy,
  checkScrollPolicy,
  layoutFromDescriptor,
  bindLayout,
  releaseLayout
} from './compat/layout.mjs';
// Bounded EUI skin and layout behavior on the public Egret 7 display API.
export function createLegacyEui({
  sdk,
  Container,
  Bitmap,
  TextField,
  RES,
  bitmapFonts,
  theme,
  stageOf,
  observe,
  events,
  EventDispatcher,
  LegacyEvent,
  game,
  measureLine,
  callLater,
  graphemes,
  stageSize
}) {
  const states = new WeakMap();
  const skins = new Map();
  const compiledSkins = new Map(),
    compiledDefaults = new Map(),
    compiledTypes = new Map();
  const customTypes = new Map();
  const customNames = new Map();
  const activeSkins = new Set();
  const liveNodes = new Set();
  const clippedText = new WeakSet();
  const viewportLabels = new Set();
  let viewportScope;
  function detachObservers(node) {
    const data = state(node);
    data?.stopCompiledBindings?.();
    for (const record of data?.applied?.values() ?? []) {
      record.off?.();
      record.off = undefined;
    }
    if (node instanceof Group) node.detachWheel();
    if (node instanceof DataGroup) node.detachProvider();
    if (node instanceof Scroller) node.detachScroll();
    if (node instanceof Button) node.endPress();
    liveNodes.delete(node);
  }
  game.scope.use({
    dispose() {
      for (const node of liveNodes) detachObservers(node);
      viewportLabels.clear();
      viewportScope?.dispose();
    }
  });
  for (const skin of theme?.exmls ?? []) {
    if (skin.className) skins.set(skin.className, skin.root);
    skins.set(skin.sourcePath, skin.root);
  }
  let themeLoaded = false;

  function refused(message) {
    throw Object.assign(new Error(message), { code: 'LEGACY_EUI_UNSUPPORTED' });
  }

  function dimension(value, parent) {
    if (typeof value === 'string' && /^(?:\d+(?:\.\d+)?|\.\d+)%$/.test(value))
      return Math.round((parent * Math.min(Number.parseFloat(value), 100)) / 100);
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) refused('Invalid EUI layout dimension.');
    return value;
  }

  const state = node => states.get(node);
  // A plain legacy model can expose fields without an EventDispatcher. Share one observer per field
  // and restore the original descriptor, with its latest value, after the final subscriber leaves.
  const observed = new WeakMap();
  function watchField(source, key, notify) {
    let fields = observed.get(source);
    if (!fields) observed.set(source, (fields = new Map()));
    let entry = fields.get(key);
    if (!entry) {
      const callbacks = new Set();
      const signal = () => {
        for (const callback of [...callbacks]) callback();
      };
      const own = Object.getOwnPropertyDescriptor(source, key);
      let proto = Object.getPrototypeOf(source);
      let inherited;
      while (!own && proto && !inherited) {
        inherited = Object.getOwnPropertyDescriptor(proto, key);
        proto = Object.getPrototypeOf(proto);
      }
      const descriptor = own ?? inherited;
      const accessor = descriptor && !Object.hasOwn(descriptor, 'value');
      let value = source[key];
      let written = false;
      let unwrap;
      if (
        (own ? own.configurable : Object.isExtensible(source)) &&
        (accessor ? descriptor.get && descriptor.set : descriptor?.writable !== false)
      ) {
        const get = accessor
          ? function () {
              return descriptor.get.call(this);
            }
          : () => value;
        const set = function (next) {
          const previous = get.call(this);
          if (accessor) descriptor.set.call(this, next);
          else {
            written = true;
            value = next;
          }
          if (!Object.is(previous, get.call(this))) signal();
        };
        Object.defineProperty(source, key, {
          configurable: true,
          enumerable: descriptor?.enumerable ?? true,
          get,
          set
        });
        unwrap = () => {
          if (Object.getOwnPropertyDescriptor(source, key)?.get !== get) return;
          if (own) Object.defineProperty(source, key, accessor ? own : { ...own, value });
          else if (!accessor && written)
            Object.defineProperty(source, key, { value, configurable: true, writable: true, enumerable: true });
          else delete source[key];
        };
      }
      const change = event => {
        if (event.property === key) signal();
      };
      const acceptsEvents =
        typeof source.addEventListener === 'function' && typeof source.removeEventListener === 'function';
      if (acceptsEvents) source.addEventListener('propertyChange', change, source);
      fields.set(
        key,
        (entry = {
          callbacks,
          close() {
            unwrap?.();
            if (acceptsEvents) source.removeEventListener('propertyChange', change, source);
          }
        })
      );
    }
    entry.callbacks.add(notify);
    return () => {
      entry.callbacks.delete(notify);
      if (entry.callbacks.size === 0 && fields.get(key) === entry) {
        entry.close();
        fields.delete(key);
      }
    };
  }

  function bind(chain, owner, write, restore, combine) {
    let subscriptions = [];
    let previous = Symbol();
    let reading = false;
    function release() {
      for (const off of subscriptions) off();
      subscriptions = [];
    }
    function read() {
      if (reading) return;
      reading = true;
      try {
        release();
        const values = chain.map(term => {
          if ('literal' in term) return term.literal;
          let value = owner;
          for (const key of term.path[0] === 'hostComponent' ? term.path.slice(1) : term.path) {
            if (value === null || value === undefined) return undefined;
            if (typeof value === 'object' || typeof value === 'function')
              subscriptions.push(watchField(value, key, read));
            value = value[key];
          }
          return value;
        });
        const value = combine
          ? combine(values)
          : values.length === 1
            ? values[0]
            : values.map(part => part ?? '').join('');
        if (!Object.is(value, previous)) {
          previous = value;
          write(restore ? restore.value : value);
          restore = undefined;
        }
      } finally {
        reading = false;
      }
    }
    try {
      read();
    } catch (error) {
      release();
      throw error;
    }
    return release;
  }

  function compiledObservers(owner, plans) {
    const active = [];
    function stop() {
      for (const off of active.splice(0)) off();
    }
    function start() {
      if (active.length) return;
      try {
        for (const { chain, target, property } of plans) {
          active.push(
            bind(
              chain,
              owner,
              value => {
                target[property] = value;
              },
              undefined,
              values => values.map(value => value ?? null).reduce((result, part) => result + part)
            )
          );
        }
      } catch (error) {
        stop();
        throw error;
      }
    }
    return { start, stop };
  }

  function childrenOf(node) {
    const data = state(node);
    return (
      data.pendingChildren ??
      Array.from({ length: node.numChildren }, (_, index) => node.getChildAt(index)).filter(child => states.has(child))
    );
  }

  function clamp(node, axis, value) {
    const data = state(node);
    const key = axis === 'width' ? 'Width' : 'Height';
    const minimum = data['min' + key] ?? data.properties['min' + key] ?? data.skinProperties['min' + key] ?? 0;
    const maximum = data['max' + key] ?? data.properties['max' + key] ?? data.skinProperties['max' + key] ?? Infinity;
    if (minimum > maximum) refused('Conflicting EUI minimum and maximum dimensions.');
    return Math.min(maximum, Math.max(minimum, value));
  }

  function tileGrid(children, availableWidth, properties, availableHeight) {
    const width = Math.max(0, ...children.map(child => child.width));
    const height = Math.max(0, ...children.map(child => child.height));
    const gapX = properties.horizontalGap ?? 6;
    const gapY = properties.verticalGap ?? 6;
    const stepX = width + gapX || 1;
    const stepY = height + gapY || 1;
    let preferred;
    if (properties.requestedColumnCount > 0) preferred = properties.requestedColumnCount;
    else if (availableWidth !== undefined) preferred = Math.floor((availableWidth + gapX) / stepX);
    else if (availableHeight !== undefined) {
      const rows = Math.max(1, Math.floor((availableHeight + gapY) / stepY));
      preferred = Math.ceil(children.length / rows);
    } else preferred = Math.round(Math.sqrt((children.length * stepY) / stepX));
    const columns = Math.max(1, Math.min(children.length, preferred));
    return {
      columns,
      stepX: width + gapX,
      stepY: height + gapY,
      width: columns * (width + gapX) - gapX,
      height: Math.ceil(children.length / columns) * (height + gapY) - gapY
    };
  }

  function innerSize(node) {
    const data = state(node);
    const children = childrenOf(node).filter(child => state(child).properties.includeInLayout !== false);
    if (children.length === 0 && !data.virtualRows) return undefined;
    const layout = data.layout?.type;
    const p = data.layout?.properties ?? {};
    const gap = p.gap ?? (layout === 'VerticalLayout' || layout === 'HorizontalLayout' ? 6 : 0);
    if (layout === 'TileLayout') {
      const padX = (p.paddingLeft ?? 0) + (p.paddingRight ?? 0);
      const padY = (p.paddingTop ?? 0) + (p.paddingBottom ?? 0);
      function available(axis, padding) {
        const size =
          data['arranged' + axis] ?? data['explicit' + axis] ?? data.properties[axis] ?? data.skinProperties[axis];
        return typeof size === 'number' ? Math.max(0, size - padding) : undefined;
      }
      const grid = tileGrid(children, available('width', padX), p, available('height', padY));
      return { width: grid.width + padX, height: grid.height + padY };
    }
    if (layout === 'HorizontalLayout' || layout === 'VerticalLayout') {
      const width =
        layout === 'HorizontalLayout'
          ? children.reduce((sum, child) => sum + child.width, 0) + gap * (children.length - 1)
          : Math.max(0, ...children.map(child => child.width));
      const height =
        layout === 'VerticalLayout'
          ? (data.virtualRows?.extent ??
            children.reduce((sum, child) => sum + child.height, 0) + gap * (children.length - 1))
          : Math.max(...children.map(child => child.height));
      return {
        width: Math.max(0, width + (p.paddingLeft ?? 0) + (p.paddingRight ?? 0)),
        height: Math.max(0, height + (p.paddingTop ?? 0) + (p.paddingBottom ?? 0))
      };
    }
    // Percentage-sized bitmap skin parts still supply their texture's intrinsic size
    // while the containing component is being measured without an explicit size.
    function measured(child, axis) {
      const props = state(child).properties;
      if (
        child instanceof Image &&
        (typeof props[axis] === 'string' || props[axis === 'width' ? 'percentWidth' : 'percentHeight'] !== undefined)
      )
        return (axis === 'width' ? child.texture?.textureWidth : child.texture?.textureHeight) ?? 0;
      return child[axis];
    }
    return {
      width: Math.max(0, ...children.map(child => child.x - child.anchorOffsetX + measured(child, 'width'))),
      height: Math.max(0, ...children.map(child => child.y - child.anchorOffsetY + measured(child, 'height')))
    };
  }

  function layoutSize(node, axis, fallback) {
    const data = state(node);
    const declared = data.properties[axis] ?? data.skinProperties[axis];
    return clamp(
      node,
      axis,
      data['arranged' + axis] ??
        data['explicit' + axis] ??
        (typeof declared === 'number' ? declared : undefined) ??
        innerSize(node)?.[axis] ??
        fallback()
    );
  }

  let mounting = 0;
  const dirtyRoots = new Set();
  function flushLayout() {
    for (const root of dirtyRoots) {
      dirtyRoots.delete(root);
      if (!root.isDisposed) {
        resolveSize(root, stageSize.width, stageSize.height);
        arrange(root);
      }
    }
  }

  // Coalesce internal invalidations during a synchronous subtree mount. Game callbacks
  // still see current geometry and keep immediate read-after-write behavior.
  function callGame(callback, receiver, ...args) {
    if (!mounting) return callback.apply(receiver, args);
    const depth = mounting;
    mounting = 0;
    try {
      flushLayout();
      return callback.apply(receiver, args);
    } finally {
      mounting = depth;
    }
  }

  function requestLayout(node) {
    if (node.isDisposed) return;
    let root = node;
    while (states.has(root.parent)) root = root.parent;
    const data = state(root);
    if (!data.initialized || data.arranging || data.rowUpdates) return;
    dirtyRoots.add(root);
    if (!mounting) flushLayout();
  }

  const sized = Base =>
    class extends Base {
      constructor(...args) {
        super(...args);
        // In EUI, skinned components and their parts participate in hit testing by default.
        this.touchEnabled = true;
        states.set(this, {
          initialized: false,
          properties: {},
          skinProperties: {},
          arrangedwidth: undefined,
          arrangedheight: undefined
        });
      }
      get width() {
        return layoutSize(this, 'width', () => this.getBounds().width);
      }
      set width(value) {
        if (typeof value !== 'number') refused('EUI width must be numeric when set by code.');
        state(this).explicitwidth = dimension(value, 0);
        state(this).arrangedwidth = state(this).explicitwidth;
        if (this.type === 'input') this.updateLegacyInputArea?.();
        requestLayout(this);
      }
      get height() {
        return layoutSize(this, 'height', () => this.getBounds().height);
      }
      set height(value) {
        if (typeof value !== 'number') refused('EUI height must be numeric when set by code.');
        state(this).explicitheight = dimension(value, 0);
        state(this).arrangedheight = state(this).explicitheight;
        if (this.type === 'input') this.updateLegacyInputArea?.();
        requestLayout(this);
      }
      get minWidth() {
        return state(this).minWidth ?? state(this).properties.minWidth ?? state(this).skinProperties.minWidth ?? 0;
      }
      set minWidth(value) {
        state(this).minWidth = dimension(value, 0);
        requestLayout(this);
      }
      get minHeight() {
        return state(this).minHeight ?? state(this).properties.minHeight ?? state(this).skinProperties.minHeight ?? 0;
      }
      set minHeight(value) {
        state(this).minHeight = dimension(value, 0);
        requestLayout(this);
      }
      get maxWidth() {
        return (
          state(this).maxWidth ?? state(this).properties.maxWidth ?? state(this).skinProperties.maxWidth ?? Infinity
        );
      }
      set maxWidth(value) {
        state(this).maxWidth = dimension(value, 0);
        requestLayout(this);
      }
      get maxHeight() {
        return (
          state(this).maxHeight ?? state(this).properties.maxHeight ?? state(this).skinProperties.maxHeight ?? Infinity
        );
      }
      set maxHeight(value) {
        state(this).maxHeight = dimension(value, 0);
        requestLayout(this);
      }
      get skinName() {
        return state(this).skin;
      }
      set skinName(value) {
        const data = state(this);
        if (typeof value !== 'string' || !value) refused('Expected an admitted skin class or path.');
        if (data.initialized && data.skin !== value && !(data.acceptInitialSkin && data.skin === undefined))
          refused('Changing a live skin requires an explicit migration.');
        if (data.skinApplied && data.skin !== value)
          refused('Replacing an applied EUI skin requires an explicit migration.');
        const previous = data.skin;
        data.skin = value;
        try {
          if (!data.skinApplied) attachSkin(this, value);
        } catch (error) {
          data.skin = previous;
          throw error;
        }
      }
      addChild(child) {
        const node = super.addChild(child);
        if (states.has(child)) requestLayout(this);
        return node;
      }
      addChildAt(child, index) {
        const node = super.addChildAt(child, index);
        if (states.has(child)) requestLayout(this);
        return node;
      }
      removeChild(child) {
        const node = super.removeChild(child);
        if (states.has(child)) requestLayout(this);
        return node;
      }
      removeChildren() {
        super.removeChildren();
        requestLayout(this);
      }
      setLayoutBoundsSize(width, height) {
        this.width = width;
        this.height = height;
      }
      #pendingMove;
      #queueMove(x, y) {
        if (this.#pendingMove || !stageOf(this) || !this.hasEventListener('move')) return;
        const origin = (this.#pendingMove = { x, y });
        callLater(() => {
          if (this.#pendingMove !== origin) return;
          this.#pendingMove = undefined;
          if (!this.isDisposed && stageOf(this) && (this.x !== x || this.y !== y)) this.dispatchEventWith('move');
        });
      }
      get x() {
        return super.x;
      }
      set x(value) {
        const old = super.x;
        super.x = value;
        if (old !== value) this.#queueMove(old, super.y);
      }
      get y() {
        return super.y;
      }
      set y(value) {
        const old = super.y;
        super.y = value;
        if (old !== value) this.#queueMove(super.x, old);
      }
      setLayoutBoundsPosition(x, y) {
        const changed = x !== this.x || y !== this.y;
        super.x = x;
        super.y = y;
        this.#pendingMove = undefined;
        if (changed && this.hasEventListener('move')) this.dispatchEventWith('move');
      }
      dispose() {
        detachObservers(this);
        for (const child of state(this)?.skinParts ?? []) if (!child.parent && !child.isDisposed) child.dispose();
        super.dispose();
      }
      invalidateDisplayList() {
        requestLayout(this);
      }
    };

  class Component extends sized(Container) {
    #enabled = true;
    get elementsContent() {
      return Array.from({ length: this.numChildren }, (_, i) => this.getChildAt(i));
    }
    set elementsContent(children) {
      if (
        !Array.isArray(children) ||
        new Set(children).size !== children.length ||
        children.some(child => !states.has(child))
      )
        refused('Expected an ordered list of EUI children.');
      this.removeChildren();
      for (const child of children) this.addChild(child);
    }
    // Legacy subclasses regularly call the base hooks even when they have no base work.
    createChildren() {}
    childrenCreated() {}
    partAdded(_name, _part) {}
    partRemoved(_name, _part) {}
    get currentState() {
      return state(this).currentState ?? '';
    }
    set currentState(value) {
      const data = state(this);
      if (data.currentState === value) return;
      if (typeof value !== 'string' || (data.skinStates?.length && !data.skinStates.includes(value)))
        refused('Unknown EUI skin state: ' + value);
      const previous = data.currentState;
      data.currentState = value;
      try {
        data.refreshState?.();
      } catch (error) {
        data.currentState = previous;
        throw error;
      }
    }
    get enabled() {
      return this.#enabled;
    }
    set enabled(value) {
      this.#enabled = Boolean(value);
      this.touchEnabled = this.#enabled;
      this.touchChildren = this.#enabled;
      if (this instanceof Button) this.updateState();
      requestLayout(this);
    }
  }
  class Group extends Component {
    get layout() {
      const data = state(this);
      if (!data.layoutObject && data.layout) {
        const object = layoutFromDescriptor(data.layout);
        if (object) {
          data.layout = bindLayout(object, this, () => requestLayout(this));
          data.layoutObject = object;
        }
      }
      return data.layoutObject ?? null;
    }
    set layout(value) {
      const data = state(this);
      if (value && data.layoutObject === value) return;
      const next =
        value == null ? { type: 'BasicLayout', properties: {} } : bindLayout(value, this, () => requestLayout(this));
      releaseLayout(data.layoutObject, this);
      data.layoutObject = value;
      data.layout = next;
      requestLayout(this);
    }
    dispose() {
      releaseLayout(state(this).layoutObject, this);
      super.dispose();
    }
    #offWheel;
    #scrollH = 0;
    get scrollH() {
      return this.#scrollH;
    }
    set scrollH(value) {
      if (!Number.isFinite(value)) refused('Expected a finite horizontal scroll offset.');
      this.#scrollH = this instanceof DataGroup ? Math.max(0, value) : value;
      requestLayout(this);
    }
    get anchorOffsetX() {
      return super.anchorOffsetX - (state(this)?.viewportOffsetX ?? 0);
    }
    set anchorOffsetX(value) {
      super.anchorOffsetX = value + (state(this)?.viewportOffsetX ?? 0);
    }
    #scrollV = 0;
    #scrollEnabled = false;
    get scrollEnabled() {
      return this.#scrollEnabled;
    }
    set scrollEnabled(value) {
      this.#scrollEnabled = Boolean(value);
      if (!this.#scrollEnabled) this.updateScroll(0, 0);
      requestLayout(this);
    }
    get scrollV() {
      return this.#scrollV;
    }
    set scrollV(value) {
      if (!Number.isFinite(value)) refused('Expected a finite vertical scroll offset.');
      this.#scrollV = this instanceof DataGroup ? Math.max(0, value) : value;
      requestLayout(this);
    }
    // Translate and clip the plain viewport as a whole, keeping authored map positions readable.
    get anchorOffsetY() {
      return super.anchorOffsetY - (state(this)?.viewportOffset ?? 0);
    }
    set anchorOffsetY(value) {
      super.anchorOffsetY = value + (state(this)?.viewportOffset ?? 0);
    }
    detachWheel() {
      this.#offWheel?.();
      this.#offWheel = undefined;
    }
    updateScroll(width, height) {
      const data = state(this);
      const active = this.#scrollEnabled && width > 0 && height > 0;
      const dataGroup = this instanceof DataGroup;
      if (active && dataGroup) {
        this.#scrollH = Math.min(this.#scrollH, Math.max(0, this.contentWidth - width));
        this.#scrollV = Math.min(this.#scrollV, Math.max(0, this.contentHeight - height));
      }
      const offsetX = active ? this.#scrollH : 0;
      if ((data.viewportOffsetX ?? 0) !== offsetX) {
        super.anchorOffsetX = this.anchorOffsetX + offsetX;
        data.viewportOffsetX = offsetX;
      }
      const offset = active && !(dataGroup && data.layout.type === 'VerticalLayout') ? this.#scrollV : 0;
      if ((data.viewportOffset ?? 0) !== offset) {
        super.anchorOffsetY = this.anchorOffsetY + offset;
        data.viewportOffset = offset;
      }
      if (!active) {
        this.detachWheel();
        if (data.scrollClip) {
          this.clipRect = undefined;
          data.scrollClip = false;
        }
        return;
      }
      this.clipRect = { x: offsetX, y: offset, width, height };
      data.scrollClip = true;
      if (!stageOf(this)) return;
      if (!this.#offWheel && game?.hover?.events.wheel) {
        this.#offWheel = this.on(game.hover.events.wheel, event => {
          if (event.defaultPrevented || event.payload.zoom) return;
          const { deltaX = 0, deltaY, unit } = event.payload;
          const owner = this.parent instanceof Scroller ? this.parent : undefined;
          let changed = false;
          if (deltaX && owner?.scrollPolicyH !== ScrollPolicy.OFF) {
            const step = unit === 'line' ? 40 : unit === 'page' ? this.width : 1;
            const h = Math.max(0, Math.min(this.contentWidth - this.width, this.#scrollH + deltaX * step));
            if (h !== this.#scrollH) {
              this.scrollH = h;
              changed = true;
            }
          }
          if (changed) event.preventDefault();
          if (owner?.scrollPolicyV === ScrollPolicy.OFF) return;
          const line = this instanceof DataGroup ? this.scrollLineHeight : 40;
          const next = Math.max(
            0,
            Math.min(
              this.contentHeight - this.height,
              this.#scrollV + deltaY * (unit === 'line' ? line : unit === 'page' ? this.height : 1)
            )
          );
          if (next !== this.#scrollV) {
            this.scrollV = next;
            event.preventDefault();
          }
        });
      }
    }
    get contentHeight() {
      return innerSize(this)?.height ?? 0;
    }
    get contentWidth() {
      return innerSize(this)?.width ?? 0;
    }
  }
  class UILayer extends Component {}
  class Skin extends Group {}

  class Rect extends Component {
    #paint = {
      fillColor: 0,
      fillAlpha: 1,
      strokeColor: 0x444444,
      strokeAlpha: 1,
      strokeWeight: 0,
      ellipseWidth: 0,
      ellipseHeight: 0
    };
    #drawn;
    #shape = new sdk.Sprite();
    constructor(width, height, fillColor = 0) {
      super();
      // A skinned legacy Rect remains the pointer target even when its text or fill is hit.
      this.touchChildren = false;
      if (width !== undefined) this.width = width;
      if (height !== undefined) this.height = height;
      this.fillColor = fillColor;
      this.addChild(this.#shape);
    }
    #set(key, value) {
      this.#paint[key] = value;
      requestLayout(this);
    }
    get fillColor() {
      return this.#paint.fillColor;
    }
    set fillColor(value) {
      this.#set('fillColor', value);
    }
    get fillAlpha() {
      return this.#paint.fillAlpha;
    }
    set fillAlpha(value) {
      this.#set('fillAlpha', value);
    }
    get strokeColor() {
      return this.#paint.strokeColor;
    }
    set strokeColor(value) {
      this.#set('strokeColor', value);
    }
    get strokeAlpha() {
      return this.#paint.strokeAlpha;
    }
    set strokeAlpha(value) {
      this.#set('strokeAlpha', value);
    }
    get strokeWeight() {
      return this.#paint.strokeWeight;
    }
    set strokeWeight(value) {
      this.#set('strokeWeight', value);
    }
    get ellipseWidth() {
      return this.#paint.ellipseWidth;
    }
    set ellipseWidth(value) {
      this.#set('ellipseWidth', value);
    }
    get ellipseHeight() {
      return this.#paint.ellipseHeight;
    }
    set ellipseHeight(value) {
      this.#set('ellipseHeight', value);
    }
    redraw() {
      const width = this.width,
        height = this.height;
      const { fillColor, fillAlpha, strokeColor, strokeAlpha, strokeWeight, ellipseWidth, ellipseHeight } = this.#paint;
      const signature = JSON.stringify([width, height, ...Object.values(this.#paint)]);
      if (signature === this.#drawn) return;
      const g = this.#shape.graphics;
      g.clear();
      if (width > 0 && height > 0) {
        if (strokeWeight > 0) g.lineStyle(strokeWeight, strokeColor, strokeAlpha);
        g.beginFill(fillColor, fillAlpha);
        if (ellipseWidth > 0 || ellipseHeight > 0)
          g.drawRoundRect(0, 0, width, height, ellipseWidth, ellipseHeight || ellipseWidth);
        else g.drawRect(0, 0, width, height);
        g.endFill();
      }
      this.#drawn = signature;
    }
  }

  class Image extends sized(Bitmap) {
    #source;
    #fillMode = 'scale';
    #grid;
    #generation = 0;
    constructor(source) {
      super();
      if (source !== undefined) this.source = source;
    }
    get source() {
      return this.#source;
    }
    get fillMode() {
      return this.#fillMode;
    }
    set fillMode(value) {
      if (value !== 'scale' && value !== 'clip') refused('Unsupported image fill mode.');
      this.#fillMode = value;
      this.resizeImage();
    }
    get scale9Grid() {
      return this.#grid;
    }
    set scale9Grid(value) {
      if (value != null && ['x', 'y', 'width', 'height'].some(k => !Number.isFinite(value[k]) || value[k] < 0))
        refused('Invalid nine-slice rectangle.');
      this.#grid = value == null ? undefined : { x: value.x, y: value.y, width: value.width, height: value.height };
      this.resizeImage();
    }
    set source(value) {
      this.#source = value;
      ++this.#generation;
      if (stageOf(this)) this.loadSource();
    }
    get width() {
      return layoutSize(this, 'width', () => this.texture?.textureWidth ?? 0);
    }
    set width(value) {
      super.width = value;
    }
    get height() {
      return layoutSize(this, 'height', () => this.texture?.textureHeight ?? 0);
    }
    set height(value) {
      super.height = value;
    }
    loadSource() {
      const generation = this.#generation;
      const source = this.#source;
      const apply = value => {
        if (generation !== this.#generation || this.isDisposed || !stageOf(this)) return;
        this.texture = value;
        requestLayout(this);
      };
      if (source == null || source === '') {
        apply(null);
        return;
      }
      if (typeof source !== 'string') {
        apply(source);
        return;
      }
      const value = RES.getRes(source);
      if (value != null) apply(value);
      else observe(RES.getResAsync(source).then(apply));
    }
    resizeImage() {
      if (this.texture) this.drawLegacyImage(this.width, this.height, this.#grid, this.#fillMode);
    }
  }

  class Label extends sized(TextField) {
    #textAlign = 'left';
    #lineSpacing = 0;
    get lineSpacing() {
      return this.#lineSpacing;
    }
    set lineSpacing(value) {
      if (!Number.isFinite(value)) refused('Expected finite EUI line spacing.');
      this.#lineSpacing = value;
      this.alignText();
    }
    #verticalAlign = 'top';
    // In Egret 5 this flag selects input-field behavior. Read-only labels use their layout width.
    multiline = false;
    #words = '';
    #rows = [];
    #totalLines = 1;
    get legacyRasterLineCount() {
      return this.#rows.length + 1;
    }
    #format;
    #active = true;
    get text() {
      return this.#words;
    }
    set text(value) {
      this.#words = String(value);
      if (this.hasLegacyTextFlow) {
        super.text = this.#words;
        this.#format = undefined;
      }
      this.alignText();
    }
    get textFlow() {
      return super.textFlow;
    }
    set textFlow(value) {
      super.textFlow = value;
      this.#words = super.text;
      while (this.#rows.length) this.#rows.pop().dispose();
      this.alignText();
    }
    setLegacyRasterActive(active) {
      this.#active = active;
      super.setLegacyRasterActive(active);
      for (const row of this.#rows) row.setLegacyRasterActive(active);
    }
    get textAlign() {
      return this.#textAlign;
    }
    set textAlign(value) {
      if (!['left', 'center', 'right'].includes(value)) refused('Unsupported EUI text alignment.');
      this.#textAlign = value;
      this.alignText();
    }
    get verticalAlign() {
      return this.#verticalAlign;
    }
    set verticalAlign(value) {
      if (!['top', 'middle', 'bottom'].includes(value)) refused('Unsupported EUI vertical text alignment.');
      this.#verticalAlign = value;
      this.alignText();
    }
    alignText() {
      if (this.isDisposed) return;
      const width = state(this).arrangedwidth ?? state(this).explicitwidth;
      const height = state(this).arrangedheight ?? state(this).explicitheight;
      if (this.hasLegacyTextFlow) {
        this.setLegacyFlowBox(width, height, this.#textAlign, this.#verticalAlign, this.#lineSpacing);
        return;
      }
      const font = (this.italic ? 'italic ' : '') + (this.bold ? 'bold ' : '') + this.size + 'px ' + this.fontFamily;
      const style = {
        size: this.size,
        weight: this.bold ? 700 : 400,
        italic: this.italic,
        fontFamily: this.fontFamily
      };
      const step = this.size + this.#lineSpacing;
      const key = JSON.stringify([
        this.#words,
        width,
        height,
        font,
        this.textColor,
        this.stroke,
        this.strokeColor,
        step
      ]);
      if (key !== this.#format) {
        this.#format = key;
        const rows = [];
        for (const line of this.#words.split(/\r\n|[\r\n]/)) {
          if (width === undefined || !(measureLine(line, font, style) > width)) {
            rows.push(line);
            continue;
          }
          let row = '';
          // Egret's default static text wraps at characters. Measure whole candidates
          // with the browser font so proportional glyphs and grapheme clusters survive.
          for (const segment of graphemes(line)) {
            if (row && measureLine(row + segment, font, style) > width) {
              rows.push(row);
              row = '';
            }
            row += segment;
          }
          rows.push(row);
        }
        this.#totalLines = rows.length;
        // The first row is always drawn. Each following row starts only if its
        // midpoint fits the explicit box; hidden rows do not acquire raster slots.
        if (height !== undefined && rows.length > 1) {
          if (this.size / 2 + step > height) rows.length = 1;
          else if (step > 0) rows.length = Math.min(rows.length, 1 + Math.floor((height - this.size / 2) / step));
        }
        if (super.text !== rows[0]) super.text = rows[0];
        while (this.#rows.length > rows.length - 1) this.#rows.pop().dispose();
        for (let i = 1; i < rows.length; i++) {
          let row = this.#rows[i - 1];
          if (!row) {
            row = new TextField();
            row.setLegacyRasterActive(this.#active);
            row.touchEnabled = false;
            row.onLegacyTextReady = () => requestLayout(this);
            this.#rows.push(row);
            this.addChild(row);
          }
          if (row.size !== this.size) row.size = this.size;
          if (row.textColor !== this.textColor) row.textColor = this.textColor;
          if (row.stroke !== this.stroke) row.stroke = this.stroke;
          if (row.strokeColor !== this.strokeColor) row.strokeColor = this.strokeColor;
          if (row.fontFamily !== this.fontFamily) row.fontFamily = this.fontFamily;
          if (row.bold !== this.bold) row.bold = this.bold;
          if (row.italic !== this.italic) row.italic = this.italic;
          if (row.text !== rows[i]) row.text = rows[i];
        }
      }
      const visual = this.legacyTextDisplay;
      if (!visual) return;
      const blockHeight =
        this.#totalLines === 1 ? visual.getBounds().height : this.size + (this.#totalLines - 1) * step;
      const top = height === undefined ? 0 : alignment(this.#verticalAlign, Math.max(0, height - blockHeight));
      for (const [i, line] of [visual, ...this.#rows].entries()) {
        const b = line.getBounds();
        line.x = width === undefined ? 0 : alignment(this.#textAlign, width - b.width) - b.x;
        line.y = top + i * step - (height === undefined ? 0 : b.y);
      }
    }
    onLegacyTextReady() {
      requestLayout(this);
    }
  }

  class Button extends Component {
    #label = '';
    #stopTracking;
    constructor() {
      super();
      this.touchEnabled = true;
      this.touchChildren = false;
      if (game.pointer.events.begin && game.pointer.observe) {
        this.on(game.pointer.events.begin, event => {
          if (!this.enabled || this.#stopTracking || !state(this).skinStates?.includes('down')) return;
          const session = event.payload.session;
          this.#stopTracking = game.pointer.observe(({ kind, contact }) => {
            if (contact.session === session && (kind === 'end' || kind === 'cancel')) this.endPress();
          });
          this.updateState();
        });
      }
    }
    endPress() {
      if (!this.#stopTracking) return;
      this.#stopTracking();
      this.#stopTracking = undefined;
      this.updateState();
    }
    get enabled() {
      return super.enabled;
    }
    set enabled(value) {
      super.enabled = value;
      this.touchChildren = false;
      if (!this.enabled) this.endPress();
    }
    get label() {
      return this.#label;
    }
    set label(value) {
      this.#label = String(value);
      this.updateLabel();
    }
    updateState() {
      const name = !this.enabled ? 'disabled' : this.#stopTracking ? 'down' : 'up';
      if (state(this).skinStates?.includes(name)) this.currentState = name;
    }
    updateLabel() {
      if (this.labelDisplay) {
        if (!(this.labelDisplay instanceof Label)) refused('Button labelDisplay must be an EUI Label.');
        this.labelDisplay.text = this.#label;
      } else if (state(this).initialized && this.#label) refused('A labeled Button needs a labelDisplay skin part.');
    }
  }

  class ArrayCollection extends EventDispatcher {
    #source;
    constructor(source = []) {
      super();
      this.source = source;
    }
    get source() {
      return this.#source;
    }
    set source(value) {
      if (!Array.isArray(value)) refused('ArrayCollection requires an array.');
      this.#source = value;
      this.#notify('reset', -1);
    }
    get length() {
      return this.#source.length;
    }
    getItemAt(index) {
      return this.#source[index];
    }
    getItemIndex(item) {
      return this.#source.indexOf(item);
    }
    #index(index, end = false) {
      if (!Number.isInteger(index) || index < 0 || index >= this.length + Number(end))
        throw new RangeError('ArrayCollection index out of range.');
    }
    #notify(kind, location, items = [], oldItems = []) {
      this.dispatchEvent(new sdk.Event(events.collectionChange, { kind, location, oldLocation: -1, items, oldItems }));
    }
    addItem(item) {
      this.addItemAt(item, this.length);
    }
    addItemAt(item, index) {
      this.#index(index, true);
      this.#source.splice(index, 0, item);
      this.#notify('add', index, [item]);
    }
    removeItemAt(index) {
      this.#index(index);
      const [old] = this.#source.splice(index, 1);
      this.#notify('remove', index, [old]);
      return old;
    }
    replaceItemAt(item, index) {
      this.#index(index);
      const old = this.#source[index];
      this.#source[index] = item;
      this.#notify('replace', index, [item], [old]);
      return old;
    }
    itemUpdated(item) {
      const index = this.getItemIndex(item);
      if (index >= 0) this.#notify('update', index, [item]);
    }
    removeAll() {
      if (this.#source.length) {
        const removed = this.#source;
        this.#source = [];
        this.#notify('remove', 0, removed);
      }
    }
    refresh() {
      this.#notify('refresh', -1);
    }
  }
  class ItemRenderer extends Component {
    #data;
    #selected = false;
    itemIndex = -1;
    constructor() {
      super();
      this.touchEnabled = true;
    }
    get data() {
      return this.#data;
    }
    set data(value) {
      if (Object.is(value, this.#data)) return;
      this.#data = value;
      if (state(this).initialized && this.dataChanged !== ItemRenderer.prototype.dataChanged)
        callGame(this.dataChanged, this);
    }
    dataChanged() {}
    get selected() {
      return this.#selected;
    }
    set selected(value) {
      this.#selected = Boolean(value);
      const name = this.#selected ? 'upAndSelected' : 'up';
      if (state(this).skinStates?.includes(name)) this.currentState = name;
    }
  }
  class DataGroup extends Group {
    #provider;
    #watching = false;
    #needsInitialWindow = false;
    #renderer = ItemRenderer;
    #skin;
    #rows = new Map();
    #count = 0;
    #virtual = true;
    #rowHeight;
    #generation = 0;
    #sample;
    #first = 0;
    #end = 0;
    #requested = new Set();
    #reconciling = false;
    #refreshPending = false;
    get scrollLineHeight() {
      return this.#rowHeight || this.getElementAt(0)?.height || 40;
    }
    get useVirtualLayout() {
      return this.#virtual;
    }
    set useVirtualLayout(value) {
      this.#virtual = Boolean(value);
      requestLayout(this);
    }
    constructor() {
      super();
      state(this).layout = { type: 'VerticalLayout', properties: { gap: 0 } };
    }
    get dataProvider() {
      return this.#provider;
    }
    set dataProvider(value) {
      if (value != null && !(value instanceof ArrayCollection)) refused('An EUI list requires an ArrayCollection.');
      if (value === this.#provider) return;
      this.detachProvider();
      this.#provider = value;
      this.attachProvider();
    }
    get itemRenderer() {
      return this.#renderer;
    }
    set itemRenderer(value) {
      const ctor =
        value === 'eui.ItemRenderer' ? ItemRenderer : typeof value === 'string' ? customTypes.get(value) : value;
      if (ctor !== ItemRenderer && !(ctor?.prototype instanceof ItemRenderer))
        refused('Expected an admitted ItemRenderer.');
      if (ctor !== this.#renderer) {
        this.#renderer = ctor;
        this.#resetRows();
      }
    }
    get itemRendererSkinName() {
      return this.#skin;
    }
    set itemRendererSkinName(value) {
      if (value !== this.#skin) {
        this.#skin = value;
        this.#resetRows();
      }
    }
    get numElements() {
      return this.#count;
    }
    getElementAt(index) {
      return this.#rows.get(index) ?? null;
    }
    getElementIndex(row) {
      return row && this.#rows.get(row.itemIndex) === row ? row.itemIndex : -1;
    }
    getVirtualElementAt(index) {
      if (!Number.isInteger(index) || index < 0 || index >= this.#count) return null;
      if (!this.#rows.has(index) && this.#watching) {
        this.#requested.add(index);
        this.#updateRows();
      }
      return this.getElementAt(index);
    }
    #newRow() {
      const row = new this.#renderer();
      state(row).generation = this.#generation;
      if (typeof this.#skin === 'string') row.skinName = this.#skin;
      else if (this.#skin !== undefined) state(row).inlineSkin = this.#skin;
      return row;
    }
    #resetRows() {
      this.#sample?.dispose();
      this.#sample = undefined;
      this.#rowHeight = undefined;
      this.#requested.clear();
      this.#generation++;
      if (this.#watching) this.#updateRows();
      else {
        for (const row of this.#rows.values()) {
          this.removeChild(row);
          row.dispose();
        }
        this.#rows.clear();
        this.#count = 0;
      }
    }
    #window() {
      const count = this.#provider?.length ?? 0;
      const s = state(this);
      const viewport = this.parent instanceof Scroller ? state(this.parent) : this.scrollEnabled ? s : undefined;
      const height =
        viewport?.arrangedheight ??
        viewport?.explicitheight ??
        viewport?.properties.height ??
        viewport?.skinProperties.height;
      const p = s.layout.properties;
      const gap = p.gap ?? 6;
      if (
        this.#virtual &&
        count &&
        typeof height === 'number' &&
        height > 0 &&
        s.layout.type === 'VerticalLayout' &&
        gap >= 0
      ) {
        if (this.#rowHeight === undefined) {
          // A project renderer can select its EXML skin in its constructor. Use this same instance for real data.
          const first = this.#rows.values().next().value;
          const row = first && state(first).generation === this.#generation ? first : (this.#sample ??= this.#newRow());
          const skin = state(row).inlineSkin ?? selectedSkin(row);
          const declared = (typeof skin === 'string' ? skins.get(skin) : skin)?.properties.height;
          this.#rowHeight = typeof declared === 'number' && declared > 0 ? declared : 0;
        }
        if (this.#rowHeight > 0) {
          const step = this.#rowHeight + gap;
          const extent = count * step - gap;
          const top = p.paddingTop ?? 0;
          const padding = top + (p.paddingBottom ?? 0);
          const origin = top + alignment(p.verticalAlign, Math.max(0, height - padding) - extent);
          const scroll = Math.min(this.scrollV, Math.max(0, padding + extent - height));
          const first = Math.min(count, Math.max(0, Math.floor((scroll - origin + gap) / step)));
          const end = Math.min(count, Math.max(first, Math.ceil((scroll + height - origin) / step)));
          return { first, end, geometry: { step, extent } };
        }
      }
      return { first: 0, end: count, geometry: undefined };
    }
    syncWindow() {
      if (!this.#watching || this.#reconciling) return;
      if (this.#needsInitialWindow) {
        this.#needsInitialWindow = false;
        this.#updateRows();
        return;
      }
      if (state(this).virtualRows && [...this.#rows.values()].some(row => row.height !== this.#rowHeight))
        this.#rowHeight = 0;
      const window = this.#window();
      if (
        window.first !== this.#first ||
        window.end !== this.#end ||
        window.geometry?.step !== state(this).virtualRows?.step ||
        window.geometry?.extent !== state(this).virtualRows?.extent
      ) {
        this.#requested.clear();
        this.#updateRows();
      }
    }
    get realizedRows() {
      return this.#rows.values();
    }
    attachProvider() {
      if (!stageOf(this) || !state(this).initialized || this.#watching) return;
      this.#watching = true;
      this.#provider?.addEventListener('collectionChange', this.#updateRows, this);
      // The parent's percentage and edge constraints resolve during layout. Realizing
      // before that pass could construct every row and immediately throw most away.
      if (mounting && this.#virtual && this.parent instanceof Scroller) {
        this.#needsInitialWindow = true;
        requestLayout(this);
      } else this.#updateRows();
    }
    detachProvider() {
      this.#provider?.removeEventListener('collectionChange', this.#updateRows, this);
      this.#requested.clear();
      this.#needsInitialWindow = false;
      this.#watching = false;
    }
    dispose() {
      this.detachProvider();
      this.#sample?.dispose();
      this.#sample = undefined;
      super.dispose();
    }
    #updateRows(event) {
      if (this.#reconciling) {
        this.#refreshPending = true;
        return;
      }
      let root = this;
      while (states.has(root.parent)) root = root.parent;
      const layout = state(root);
      layout.rowUpdates = (layout.rowUpdates ?? 0) + 1;
      this.#reconciling = true;
      try {
        this.#reconcileRows(event);
        while (this.#refreshPending) {
          this.#refreshPending = false;
          this.#reconcileRows();
        }
      } finally {
        layout.rowUpdates--;
        this.#reconciling = false;
      }
      requestLayout(this);
    }
    #reconcileRows(event) {
      const source = this.#provider?.source ?? [];
      const oldRows = this.#rows;
      const selected = this.getElementAt(this.selectedIndex);
      const { first, end, geometry } = this.#window();
      this.#first = first;
      this.#end = end;
      this.#count = source.length;
      state(this).virtualRows = geometry;
      if (event) this.#requested.clear();
      const indexes = Array.from({ length: end - first }, (_, offset) => first + offset);
      for (const index of this.#requested)
        if (index < source.length && (index < first || index >= end)) indexes.push(index);
      if (indexes.length > end - first) indexes.sort((a, b) => a - b);

      // Reserve the matching renderers before recycling any row for a different collection index.
      const next = new Map(indexes.map(index => [index, undefined]));
      const positional = event && ['add', 'remove', 'replace', 'update'].includes(event.kind);
      const unused = new Set([...oldRows.values()].filter(row => state(row).generation === this.#generation));
      const byData = new Map();
      for (const row of positional ? [] : [...unused].reverse()) {
        let bucket = byData.get(row.data);
        if (!bucket) byData.set(row.data, (bucket = []));
        bucket.push(row);
      }
      for (const index of indexes) {
        let prior = index;
        if (event?.kind === 'add' && index >= event.location)
          prior = index < event.location + event.items.length ? -1 : index - event.items.length;
        else if (event?.kind === 'remove' && index >= event.location) prior += event.items.length;
        let row;
        if (positional) row = oldRows.get(prior);
        else if (Object.is(oldRows.get(index)?.data, source[index]) && unused.has(oldRows.get(index)))
          row = oldRows.get(index);
        else {
          const pool = byData.get(source[index]);
          while (pool?.length && !unused.has(pool.at(-1))) pool.pop();
          row = pool?.pop();
        }
        if (unused.has(row)) {
          next.set(index, row);
          unused.delete(row);
        }
      }
      for (const index of indexes) {
        let row = next.get(index);
        if (!row) {
          row = this.#sample ?? (geometry ? unused.values().next().value : undefined) ?? this.#newRow();
          this.#sample = undefined;
          unused.delete(row);
          next.set(index, row);
        }
        row.itemIndex = index;
        row.data = source[index];
        if (
          event?.kind === 'update' &&
          index === event.location &&
          row.dataChanged !== ItemRenderer.prototype.dataChanged
        )
          callGame(row.dataChanged, row);
      }
      const retained = new Set(next.values());
      for (const row of oldRows.values())
        if (!retained.has(row)) {
          this.removeChild(row);
          row.dispose();
        }
      // Notify child lifecycle handlers only after the full index mapping is available.
      this.#rows = next;
      indexes.forEach((index, slot) => {
        const row = next.get(index);
        if (row.parent !== this || this.getChildAt(slot) !== row) this.addChildAt(row, slot);
      });
      if (this.#sample) {
        this.#sample.dispose();
        this.#sample = undefined;
      }
      if (geometry && [...next.values()].some(row => row.height !== this.#rowHeight)) {
        // A custom renderer overrode its skin's literal height. Resume measuring every row.
        this.#rowHeight = 0;
        this.#refreshPending = true;
      }
      this.rowsChanged?.(event, selected);
    }
  }
  class List extends DataGroup {
    #index = -1;
    #pendingIndex;
    #selected;
    #required = false;
    constructor() {
      super();
      this.touchEnabled = true;
      this.addEventListener('touchTap', this.#tap, this);
    }
    #tap(event) {
      let row = event.target;
      while (row && row.parent !== this) row = row.parent;
      const index = this.getElementIndex(row);
      if (index < 0 || row.enabled === false) return;
      if (index !== this.#index && this.dispatchEvent(new sdk.Event(events.changing, undefined))) {
        this.selectedIndex = index;
        this.dispatchEvent(new sdk.Event(events.change, undefined));
      }
      this.dispatchEvent(new sdk.Event(events.itemTap, { item: row.data, itemIndex: index, itemRenderer: row }));
    }
    get selectedIndex() {
      return this.#index;
    }
    set selectedIndex(value) {
      if (!Number.isInteger(value)) refused('List selection requires an integer index.');
      this.#pendingIndex = this.numElements || value < 0 ? undefined : value;
      this.#index = this.numElements ? Math.max(this.#required ? 0 : -1, Math.min(this.numElements - 1, value)) : -1;
      this.#selected = this.dataProvider?.getItemAt(this.#index);
      for (const row of this.realizedRows) row.selected = row.itemIndex === this.#index;
    }
    get selectedItem() {
      return this.#selected;
    }
    set selectedItem(value) {
      this.selectedIndex = this.dataProvider?.getItemIndex(value) ?? -1;
    }
    get requireSelection() {
      return this.#required;
    }
    set requireSelection(value) {
      this.#required = Boolean(value);
      this.selectedIndex = this.#index;
    }
    rowsChanged(event, previousRow) {
      let index = this.#index;
      if (this.#pendingIndex !== undefined) index = this.#pendingIndex;
      else if (index >= 0) {
        if (event?.kind === 'add' && index >= event.location) index += event.items.length;
        else if (event?.kind === 'remove' && index >= event.location)
          index = index < event.location + event.items.length ? -1 : index - event.items.length;
        else if (event?.kind !== 'replace' && !Object.is(this.dataProvider?.getItemAt(index), this.#selected)) {
          index = previousRow && Object.is(previousRow.data, this.#selected) ? this.getElementIndex(previousRow) : -1;
          if (index < 0) index = this.dataProvider?.getItemIndex(this.#selected) ?? -1;
        }
      }
      this.selectedIndex = index;
    }
  }
  class TabBar extends List {
    constructor() {
      super();
      this.requireSelection = true;
      this.useVirtualLayout = false;
      const row = new HorizontalLayout();
      row.gap = 0;
      row.horizontalAlign = 'justify';
      row.verticalAlign = 'contentJustify';
      this.layout = row;
    }
  }
  const ProgressBar = progressClass(Component, game);
  const BitmapLabel = bitmapLabelClass(sized(Container), RES, bitmapFonts, observe, requestLayout, layoutSize);
  class Scroller extends Component {
    #input = [];
    #policyH = ScrollPolicy.AUTO;
    #policyV = ScrollPolicy.AUTO;
    get scrollPolicyH() {
      return this.#policyH;
    }
    set scrollPolicyH(value) {
      this.#policyH = checkScrollPolicy(value);
    }
    get scrollPolicyV() {
      return this.#policyV;
    }
    set scrollPolicyV(value) {
      this.#policyV = checkScrollPolicy(value);
    }
    get viewport() {
      return childrenOf(this)[0];
    }
    set viewport(value) {
      if (value === this.viewport) return;
      if (value != null && !(value instanceof Group)) refused('Expected a Group viewport.');
      if (this.viewport) this.removeChild(this.viewport);
      if (value) this.addChild(value);
    }
    removeChild(child) {
      const viewport = child === this.viewport;
      const removed = super.removeChild(child);
      if (viewport) child.scrollEnabled = false;
      return removed;
    }
    removeChildren() {
      const viewport = this.viewport;
      super.removeChildren();
      if (viewport) viewport.scrollEnabled = false;
    }
    attachScroll() {
      if (this.#input.length || !game.pointer.events.begin || !game.pointer.observe) return;
      let drag;
      let consumed;
      const point = contact => this.globalToLocal(contact.globalX, contact.globalY);
      const axes = viewport => ({
        x:
          this.#policyH !== ScrollPolicy.OFF &&
          (this.#policyH === ScrollPolicy.ON || viewport.contentWidth > viewport.width),
        y:
          this.#policyV !== ScrollPolicy.OFF &&
          (this.#policyV === ScrollPolicy.ON || viewport.contentHeight > viewport.height)
      });
      this.#input.push(
        this.on(
          game.pointer.events.begin,
          event => {
            const viewport = this.viewport;
            if (drag || !viewport) return;
            const enabled = axes(viewport);
            if (!enabled.x && !enabled.y) return;
            consumed = undefined;
            drag = {
              session: event.payload.session,
              viewport,
              start: point(event.payload),
              left: viewport.scrollH,
              top: viewport.scrollV,
              moved: false
            };
          },
          { capture: true }
        )
      );
      this.#input.push(
        game.pointer.observe(({ kind, contact }) => {
          if (!drag || contact.session !== drag.session) return;
          if (drag.viewport !== this.viewport) {
            drag = undefined;
            return;
          }
          if (kind === 'move') {
            const active = axes(drag.viewport);
            const here = point(contact);
            const dx = active.x ? drag.start.x - here.x : 0;
            const dy = active.y ? drag.start.y - here.y : 0;
            if (!drag.moved && Math.max(Math.abs(dx), Math.abs(dy)) < 5) return;
            const current = drag;
            if (!current.moved) {
              current.moved = true;
              consumed = current.session;
              this.dispatchEventWith('changeStart');
            }
            if (current.viewport !== this.viewport || !this.stage) return;
            const view = current.viewport;
            const nextX = Math.max(0, Math.min(view.contentWidth - view.width, current.left + dx));
            const nextY = Math.max(0, Math.min(view.contentHeight - view.height, current.top + dy));
            if (active.x && nextX !== view.scrollH) view.scrollH = nextX;
            if (active.y && nextY !== view.scrollV) view.scrollV = nextY;
            this.dispatchEventWith('change');
          } else if (kind === 'end' || kind === 'cancel') {
            const moved = drag.moved;
            drag = undefined;
            if (moved) this.dispatchEventWith('changeEnd');
          }
        })
      );
      this.#input.push(
        this.on(
          game.pointer.events.tap,
          event => {
            if (consumed && event.payload.session === consumed) {
              event.stopImmediatePropagation();
              consumed = undefined;
            }
          },
          { capture: true }
        )
      );
    }
    detachScroll() {
      for (const off of this.#input) off();
      this.#input.length = 0;
    }
  }
  class EditableText extends sized(TextField) {
    prompt = '';
    constructor() {
      super();
      this.type = 'input';
    }
  }
  const classes = {
    EditableText,
    TabBar,
    ProgressBar,
    BitmapLabel,
    Skin,
    Group,
    Component,
    UILayer,
    Rect,
    Image,
    Label,
    Button,
    List,
    DataGroup,
    ItemRenderer,
    Scroller
  };
  const layoutKeys = new Set([
    'id',
    'width',
    'height',
    'minWidth',
    'maxWidth',
    'minHeight',
    'maxHeight',
    'left',
    'right',
    'top',
    'bottom',
    'horizontalCenter',
    'verticalCenter',
    'percentWidth',
    'percentHeight',
    'includeInLayout'
  ]);

  function refreshProperties(node, owner, active) {
    const data = state(node);
    const descriptor = data.descriptor;
    if (!descriptor) return;
    const overrides = descriptor.overrides?.[owner.currentState] ?? {};
    const values = { ...descriptor.properties, ...overrides };
    // Alignment constraints change the displayed position without assigning x/y through the skin.
    // Remember the pre-constraint position so removing the override also removes its layout effect.
    data.beforeConstraint ??= {};
    const restorePosition = {};
    for (const [axis, fields] of [
      ['x', ['left', 'right', 'horizontalCenter']],
      ['y', ['top', 'bottom', 'verticalCenter']]
    ]) {
      if (fields.some(key => Object.hasOwn(overrides, key))) {
        if (!Object.hasOwn(data.beforeConstraint, axis)) data.beforeConstraint[axis] = node[axis];
      } else if (Object.hasOwn(data.beforeConstraint, axis)) {
        restorePosition[axis] = data.beforeConstraint[axis];
        delete data.beforeConstraint[axis];
      }
    }
    const keys = new Set([...Object.keys(values), ...data.applied.keys()]);
    for (const key of keys) {
      const value = values[key];
      const overridden = Object.hasOwn(descriptor.overrides?.[owner.currentState] ?? {}, key);
      const binding = value?.binding;
      const previous = data.applied.get(key);
      if (
        previous &&
        previous.value === value &&
        previous.overridden === overridden &&
        (!binding || Boolean(previous.off) === active)
      )
        continue;
      previous?.off?.();
      if (!data.defaults.has(key) && !layoutKeys.has(key)) {
        if (
          !(key in node) ||
          (typeof node[key] === 'function' && !(key === 'itemRenderer' && node instanceof DataGroup))
        )
          refused('Unsupported EUI property ' + key + ' on ' + node.constructor.name + '.');
        data.defaults.set(key, node[key]);
      }
      const write = next => {
        if (next === undefined || next === null) delete data.properties[key];
        else data.properties[key] = next;
        if (!layoutKeys.has(key)) node[key] = next ?? data.defaults.get(key);
        if (data.initialized) requestLayout(node);
      };
      // EUI restores the value observed when the override took effect, even if the model changed in the meantime.
      const restore = previous?.overridden ? previous.restore : undefined;
      const record = {
        value,
        overridden,
        restore: overridden ? (restore ?? { value: layoutKeys.has(key) ? data.properties[key] : node[key] }) : undefined
      };
      data.applied.set(key, record);
      if (binding) {
        if (active) record.off = bind(binding, owner, write, overridden ? undefined : restore);
      } else write(!overridden && restore ? restore.value : value);
      if (value === undefined) data.applied.delete(key);
    }
    Object.assign(node, restorePosition);
  }

  function skinPart(owner, id, node) {
    const descriptor = Object.getOwnPropertyDescriptor(owner, id);
    // Only absent user-defined fields or existing empty writable own fields can receive parts.
    if (descriptor === undefined) {
      if (id in owner) refused('EXML skin part conflicts with an inherited member: ' + id);
      Object.defineProperty(owner, id, { value: node, enumerable: true, writable: true, configurable: true });
    } else {
      if (!Object.hasOwn(descriptor, 'value') || !descriptor.writable || descriptor.value != null)
        refused('EXML skin part already exists: ' + id);
      owner[id] = node;
    }
    if (node.name === '') node.name = id;
  }

  function construct(descriptor, owner, groups) {
    const Type = descriptor.type === 'Custom' ? customTypes.get(descriptor.className) : classes[descriptor.type];
    if (!Type || Type === Skin || Type === UILayer)
      refused('Unsupported EUI element ' + (descriptor.className ?? descriptor.type) + '.');
    const node = new Type();
    const data = state(node);
    if (!data) refused('Custom skin children must extend an admitted EUI component.');
    Object.assign(data, { descriptor, owner, applied: new Map(), defaults: new Map() });
    data.layout = descriptor.layout ?? data.layout;
    if (descriptor.inlineSkin) data.inlineSkin = descriptor.inlineSkin;
    if (descriptor.itemRendererSkin) node.itemRendererSkinName = descriptor.itemRendererSkin;
    const id = descriptor.properties.id;
    if (id) skinPart(owner, id, node);
    refreshProperties(node, owner, false);
    if (descriptor.children.length) {
      const children = descriptor.children.map(child => construct(child, owner, groups));
      groups.push({ parent: node, children });
    }
    return node;
  }

  function applyState(owner, groups) {
    for (const { parent, children } of groups) {
      const wanted = children.filter(child => {
        const { includeIn, excludeFrom } = state(child).descriptor;
        return (!includeIn || includeIn.includes(owner.currentState)) && !excludeFrom?.includes(owner.currentState);
      });
      for (const child of children) {
        if (!wanted.includes(child) && child.parent === parent) parent.removeChild(child);
        refreshProperties(child, owner, Boolean(stageOf(child)));
      }
      // Reuse the same skin part on re-entry and insert it before the next attached declaration.
      for (let index = 0; index < wanted.length; index++) {
        const child = wanted[index];
        if (child.parent === parent) continue;
        const next = wanted.slice(index + 1).find(part => part.parent === parent);
        parent.addChildAt(child, next ? parent.getChildIndex(next) : parent.numChildren);
      }
    }
    requestLayout(owner);
  }

  function resolveDimension(data, axis, parent, start, end, percent) {
    const properties = data.properties;
    if (properties[start] !== undefined && properties[end] !== undefined)
      return Math.max(0, parent - properties[start] - properties[end]);
    const relative = properties[percent] === undefined ? properties[axis] : properties[percent] + '%';
    if (typeof relative === 'string') return dimension(relative, parent);
    const explicit = data['explicit' + axis];
    if (explicit !== undefined) return explicit;
    const value =
      properties[axis] ?? (properties[percent] === undefined ? data.skinProperties[axis] : properties[percent] + '%');
    return value === undefined ? undefined : dimension(value, parent);
  }

  function resolveSize(node, parentWidth, parentHeight) {
    const data = state(node);
    data.arrangedwidth = resolveDimension(data, 'width', parentWidth, 'left', 'right', 'percentWidth');
    data.arrangedheight = resolveDimension(data, 'height', parentHeight, 'top', 'bottom', 'percentHeight');
    if (node instanceof UILayer) {
      data.arrangedwidth ??= stageSize.width;
      data.arrangedheight ??= stageSize.height;
    }
  }

  function alignment(value, available) {
    if (value === 'right' || value === 'bottom') return available;
    if (value === 'center' || value === 'middle') return available / 2;
    return 0;
  }

  function placeBasic(child, properties, width, height) {
    if (properties.left !== undefined) child.x = properties.left + child.anchorOffsetX;
    else if (properties.right !== undefined) child.x = width - properties.right - child.width + child.anchorOffsetX;
    else if (properties.horizontalCenter !== undefined)
      child.x = Math.round((width - child.width) / 2 + properties.horizontalCenter) + child.anchorOffsetX;
    if (properties.top !== undefined) child.y = properties.top + child.anchorOffsetY;
    else if (properties.bottom !== undefined) child.y = height - properties.bottom - child.height + child.anchorOffsetY;
    else if (properties.verticalCenter !== undefined)
      child.y = Math.round((height - child.height) / 2 + properties.verticalCenter) + child.anchorOffsetY;
  }

  function removeViewportLabel(label) {
    if (viewportLabels.delete(label) && !viewportLabels.size) {
      viewportScope?.dispose();
      viewportScope = undefined;
    }
  }

  function updateRaster(label) {
    if (label.isDisposed) {
      removeViewportLabel(label);
      return;
    }
    const height = state(label)?.arrangedheight ?? label.legacyRasterBoxHeight;
    const guard = label.size;
    // Leave a line of overhang on both edges. Intrinsic, multi-line or transformed text keeps its metrics.
    let bounded = height > 0 && guard > 0 && (label.legacyRasterLineCount ?? 1) === 1 && !/[\n\r]/.test(label.text);
    let top = -guard,
      bottom = height + guard,
      inViewport = false,
      outside = false;
    for (let at = label; at.parent; at = at.parent) {
      const parent = at.parent;
      if (at.scaleX !== 1 || at.scaleY !== 1 || at.rotation || at.skewX || at.skewY) bounded = false;
      const offset = at.y - at.anchorOffsetY - (state(at)?.viewportOffset ?? 0);
      top += offset;
      bottom += offset;
      if (!(parent instanceof Group) || parent instanceof DataGroup || !state(parent).scrollClip) continue;
      inViewport = true;
      const clip = parent.clipRect;
      if (bounded && (bottom <= clip.y || top >= clip.y + clip.height)) {
        outside = true;
        break;
      }
    }
    if (inViewport && stageOf(label)) {
      viewportLabels.add(label);
      if (!viewportScope) {
        viewportScope = game.engine.createScope();
        const watch = game.engine.watchDisplayRevision(viewportScope);
        let last = watch.revision;
        game.engine.clock.onTick(viewportScope, () => {
          // Programmatic moves and tweens can change visibility without invalidating EUI layout.
          if (last === watch.revision) return;
          for (const candidate of viewportLabels) updateRaster(candidate);
          last = watch.revision;
        });
      }
    } else removeViewportLabel(label);
    if (outside && !clippedText.has(label)) {
      clippedText.add(label);
      label.setLegacyRasterActive(false);
    } else if (!outside && clippedText.delete(label)) label.setLegacyRasterActive(true);
  }

  function projectUnmanagedText(node) {
    if (node instanceof TextField) updateRaster(node);
    else if (node instanceof sdk.DisplayObjectContainer)
      for (let i = 0; i < node.numChildren; i++) projectUnmanagedText(node.getChildAt(i));
  }

  function arrange(node) {
    const data = state(node);
    if (!data || data.arranging || node.isDisposed) return;
    data.arranging = true;
    try {
      // Seed fixed child dimensions before measuring an auto-sized group; resolve percentage/edge constraints after.
      if (node instanceof DataGroup) node.syncWindow();
      const children = childrenOf(node);
      const parentWidth = data.arrangedwidth ?? data.explicitwidth ?? 0;
      const parentHeight = data.arrangedheight ?? data.explicitheight ?? 0;
      for (const child of children) resolveSize(child, parentWidth, parentHeight);
      const width = node.width,
        height = node.height;
      const layout = data.layout?.type ?? 'BasicLayout';
      const p = data.layout?.properties ?? {};
      const left = p.paddingLeft ?? 0,
        top = p.paddingTop ?? 0;
      const innerWidth = Math.max(0, width - left - (p.paddingRight ?? 0));
      const innerHeight = Math.max(0, height - top - (p.paddingBottom ?? 0));
      const gap = p.gap ?? (layout === 'VerticalLayout' || layout === 'HorizontalLayout' ? 6 : 0);
      if (node instanceof Group) node.updateScroll(width, height);
      const included = children.filter(child => state(child).properties.includeInLayout !== false);
      if (layout === 'HorizontalLayout' || layout === 'VerticalLayout') {
        // Main-axis percentages divide remaining space in legacy EUI. Only fixed main-axis children are admitted.
        const horizontal = layout === 'HorizontalLayout';
        const axis = horizontal ? 'width' : 'height';
        const percent = horizontal ? 'percentWidth' : 'percentHeight';
        for (const child of included) {
          const properties = state(child).properties;
          if (
            typeof properties[axis] === 'string' ||
            properties[percent] !== undefined ||
            ['left', 'right', 'top', 'bottom', 'horizontalCenter', 'verticalCenter'].some(
              key => properties[key] !== undefined
            )
          )
            refused('Linear layout with relative main-axis sizing or edge constraints requires an explicit migration.');
        }
      }
      for (const child of children)
        resolveSize(
          child,
          layout === 'VerticalLayout' ? innerWidth : width,
          layout === 'HorizontalLayout' ? innerHeight : height
        );
      if (layout === 'HorizontalLayout' && included.length) {
        if (p.horizontalAlign === 'justify') {
          const preferred = included.map(child => child.width);
          const widths = tabWidths(preferred, Math.max(0, innerWidth - gap * (preferred.length - 1)));
          included.forEach((child, index) => {
            state(child).arrangedwidth = widths[index];
          });
        }
        if (p.verticalAlign === 'contentJustify') {
          const tallest = Math.max(innerHeight, ...included.map(child => child.height));
          for (const child of included) state(child).arrangedheight = tallest;
        }
      }
      const totalWidth =
        included.reduce((value, child) => value + child.width, 0) + Math.max(0, included.length - 1) * gap;
      const totalHeight =
        data.virtualRows?.extent ??
        included.reduce((value, child) => value + child.height, 0) + Math.max(0, included.length - 1) * gap;
      // Row-major tiles keep the largest admitted child as their cell, including across a short last row.
      const grid = layout === 'TileLayout' ? tileGrid(included, innerWidth, p) : undefined;
      let cellIndex = 0;
      let cursorX = left + alignment(p.horizontalAlign, innerWidth - totalWidth);
      let cursorY =
        top +
        alignment(p.verticalAlign, innerHeight - totalHeight) -
        (node instanceof DataGroup && node.scrollEnabled ? node.scrollV : 0);

      for (const child of children) {
        const properties = state(child).properties;
        if (properties.includeInLayout !== false) {
          if (layout === 'HorizontalLayout') {
            child.x = cursorX + child.anchorOffsetX;
            child.y = top + alignment(p.verticalAlign, innerHeight - child.height) + child.anchorOffsetY;
            cursorX += child.width + gap;
          } else if (layout === 'VerticalLayout') {
            child.x = left + alignment(p.horizontalAlign, innerWidth - child.width) + child.anchorOffsetX;
            child.y = cursorY + child.anchorOffsetY + (data.virtualRows ? child.itemIndex * data.virtualRows.step : 0);
            if (!data.virtualRows) cursorY += child.height + gap;
          } else if (grid) {
            child.x = left + (cellIndex % grid.columns) * grid.stepX + child.anchorOffsetX;
            child.y = top + Math.floor(cellIndex / grid.columns) * grid.stepY + child.anchorOffsetY;
            cellIndex++;
          } else if (layout === 'BasicLayout') placeBasic(child, properties, width, height);
          else refused('Unsupported EUI layout ' + layout + '.');
        }
        if (node instanceof Scroller && node.viewport === child) {
          state(child).arrangedwidth = width;
          state(child).arrangedheight = height;
          child.x = child.anchorOffsetX;
          child.y = child.anchorOffsetY;
          if (!child.scrollEnabled) child.scrollEnabled = true;
        }
        arrange(child);
      }
      if (node instanceof Label) node.alignText();
      if (node instanceof EditableText) node.updateLegacyInputArea();
      if (node instanceof TextField) updateRaster(node);
      else if (node.numChildren > children.length) {
        for (let i = 0; i < node.numChildren; i++) {
          const child = node.getChildAt(i);
          if (!states.has(child)) projectUnmanagedText(child);
        }
      }
      if (node instanceof BitmapLabel)
        node.setBitmapBox(data.arrangedwidth ?? data.explicitwidth, data.arrangedheight ?? data.explicitheight);
      if (node instanceof ProgressBar) node.refreshProgress();
      if (node instanceof Rect) node.redraw();
      if (node instanceof Image) node.resizeImage();
      if (node.touchEnabled && !(node instanceof EditableText))
        node.hitArea =
          width > 0 && height > 0
            ? { x: data.viewportOffsetX ?? 0, y: data.viewportOffset ?? 0, width, height }
            : undefined;
    } finally {
      data.arranging = false;
    }
  }

  function selectedSkin(node) {
    const data = state(node);
    if (data.skin !== undefined) return data.skin;
    if (!themeLoaded) return undefined;
    const name = customNames.get(node.constructor) ?? node.constructor.name;
    return (
      compiledDefaults.get(name) ??
      compiledDefaults.get('eui.' + name) ??
      theme?.skins?.[name] ??
      theme?.skins?.['eui.' + name] ??
      (node instanceof Button ? theme?.skins?.['eui.Button'] : undefined)
    );
  }

  function attachSkin(node, name) {
    const data = state(node);
    if (data.skinApplied) return;
    const build = compiledSkins.get(name);
    if (build) {
      if (activeSkins.has(build)) refused('Recursive precompiled skin: ' + name);
      activeSkins.add(build);
      let children = [],
        owned = [],
        stop,
        clear;
      const attachedParts = [];
      const before = {
        skin: data.skin,
        skinParts: data.skinParts,
        skinStates: data.skinStates,
        currentState: data.currentState,
        skinProperties: data.skinProperties,
        refreshState: data.refreshState,
        startCompiledBindings: data.startCompiledBindings,
        stopCompiledBindings: data.stopCompiledBindings
      };
      try {
        const value = build(node);
        children = value.children;
        owned = value.owned;
        clear = value.clear;
        if (owned.some(child => !states.has(child)))
          refused('Compiled skin requires an unavailable EUI control: ' + name);
        for (const [id, part] of value.parts) {
          const descriptor = Object.getOwnPropertyDescriptor(node, id);
          skinPart(node, id, part);
          attachedParts.push([id, descriptor]);
        }
        data.skinProperties = { ...before.skinProperties };
        for (const key of ['width', 'height', 'minWidth', 'minHeight', 'maxWidth', 'maxHeight']) {
          if (value.skin[key] !== undefined) data.skinProperties[key] = dimension(value.skin[key], 0);
        }
        data.skin = name;
        data.skinParts = owned;
        data.skinStates = value.states;
        data.currentState ||= value.states[0] ?? '';
        data.refreshState = () => {
          if (data.currentState) value.apply(data.currentState);
        };
        if (value.states.length && !value.states.includes(data.currentState))
          refused('Unknown initial EUI state: ' + data.currentState);
        // State-only siblings need the base children in place to resolve BEFORE and AFTER.
        for (const child of children) node.addChild(child);
        const observers = compiledObservers(node, value.bindings);
        stop = data.stopCompiledBindings = observers.stop;
        data.startCompiledBindings = observers.start;
        observers.start();
        if (!stageOf(node)) observers.stop();
        data.refreshState();
        for (const [id, part] of value.parts) callGame(node.partAdded, node, id, part);
        data.skinApplied = true;
      } catch (error) {
        stop?.();
        try {
          clear?.();
        } catch {
          /* Keep the original project callback error. */
        }
        // A failed factory may have temporarily filled a non-configurable game field.
        for (const [id, descriptor] of attachedParts.reverse()) {
          if (descriptor) Object.defineProperty(node, id, descriptor);
          else delete node[id];
        }
        for (const child of owned) if (states.has(child) && !child.isDisposed) child.dispose();
        Object.assign(data, before);
        throw error;
      } finally {
        activeSkins.delete(build);
      }
      node.dispatchEvent(new sdk.Event(events.complete, undefined));
      return;
    }
    const skin = typeof name === 'string' ? skins.get(name) : name;
    if (!skin) refused('Unknown EXML skin ' + name + '.');
    if (activeSkins.has(skin)) refused('Recursive EXML skin reference: ' + name + '.');
    activeSkins.add(skin);
    if (typeof name === 'string') data.skin = name;
    data.skinProperties = skin.properties;
    data.layout ??= skin.layout;
    // Parts are created before attachment, so every named sibling exists for lifecycle callbacks.
    try {
      data.skinStates = skin.states ?? [];
      if (data.currentState && data.skinStates.length && !data.skinStates.includes(data.currentState))
        refused('Unknown initial EUI state: ' + data.currentState);
      data.currentState ||= data.skinStates[0] ?? '';
      const groups = [];
      const parts = skin.children.map(descriptor => construct(descriptor, node, groups));
      groups.push({ parent: node, children: parts });
      data.skinParts = groups.flatMap(group => group.children);
      data.refreshState = () => applyState(node, groups);
      data.refreshState();
      for (const group of groups)
        for (const part of group.children) {
          const id = state(part).descriptor.properties.id;
          if (id && node.partAdded && node.partAdded !== Component.prototype.partAdded)
            callGame(node.partAdded, node, id, part);
        }
    } finally {
      data.pendingChildren = undefined;
      activeSkins.delete(skin);
    }
    data.skinApplied = true;
    node.dispatchEvent(new sdk.Event(events.complete, undefined));
  }

  function enter(node) {
    if (node instanceof TextField) updateRaster(node);
    const data = state(node);
    if (!data) return;
    liveNodes.add(node);
    if (!data.initialized) {
      data.initialized = true;
      const initial = data.inlineSkin ?? selectedSkin(node);
      if (initial !== undefined) attachSkin(node, initial);
      else data.acceptInitialSkin = true;
      const complete = () => {
        if (!node.isDisposed) node.dispatchEvent(new sdk.Event(events.creationComplete, undefined));
      };
      const finishChildren = () => {
        if (node.isDisposed) return;
        data.acceptInitialSkin = false;
        if (initial === undefined && data.skin !== undefined) attachSkin(node, data.skin);
        if (node instanceof Button) {
          node.updateState();
          node.updateLabel();
        }
        if (node instanceof ItemRenderer) {
          node.selected = node.selected;
          if (node.dataChanged !== ItemRenderer.prototype.dataChanged) callGame(node.dataChanged, node);
        }
        requestLayout(node);
        const finished =
          node.childrenCreated && node.childrenCreated !== Component.prototype.childrenCreated
            ? callGame(node.childrenCreated, node)
            : undefined;
        if (finished && typeof finished.then === 'function') return Promise.resolve(finished).then(complete);
        complete();
      };
      const created =
        node.createChildren && node.createChildren !== Component.prototype.createChildren
          ? callGame(node.createChildren, node)
          : undefined;
      if (created && typeof created.then === 'function') observe(Promise.resolve(created).then(finishChildren));
      else {
        const finished = finishChildren();
        if (finished && typeof finished.then === 'function') observe(finished);
      }
    }
    data.startCompiledBindings?.();
    if (data.owner) refreshProperties(node, data.owner, true);
    if (node instanceof DataGroup) node.attachProvider();
    if (node instanceof Scroller) node.attachScroll();
    if (node instanceof Image) node.loadSource();
    requestLayout(node);
  }

  function leave(node) {
    if (node instanceof TextField) {
      removeViewportLabel(node);
      if (clippedText.delete(node)) node.setLegacyRasterActive(true);
    }
    if (states.has(node)) detachObservers(node);
  }

  function registerCustomComponent(name, ctor) {
    if (
      !(typeof name === 'string' && /^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*$/.test(name)) ||
      typeof ctor !== 'function' ||
      !(ctor.prototype instanceof Component) ||
      compiledTypes.has(name) ||
      (customTypes.has(name) && customTypes.get(name) !== ctor)
    )
      refused('Invalid custom EUI component: ' + name);
    customTypes.set(name, ctor);
    customNames.set(ctor, name);
  }
  class Theme extends Container {
    constructor(url) {
      super();
      if (url !== theme?.themePath) refused('Theme must be admitted by the migration CLI.');
      themeLoaded = true;
      observe(Promise.resolve().then(() => this.dispatchEvent(new sdk.Event(events.complete, undefined))));
    }
  }

  return {
    eui: Object.freeze({
      ...classes,
      HorizontalLayout,
      VerticalLayout,
      TileLayout,
      ScrollPolicy,
      Direction,
      Theme,
      ArrayCollection,
      registerCustomComponent,
      registerPrecompiledSkins(entries, defaults, types = new Map()) {
        for (const [name, type] of types) {
          if (typeof type !== 'function' || compiledTypes.has(name) || customTypes.has(name))
            refused('Invalid or duplicate precompiled skin type: ' + name);
        }
        for (const key of entries.keys()) if (compiledSkins.has(key)) refused('Duplicate precompiled skin: ' + key);
        for (const [control, target] of Object.entries(defaults)) {
          if (compiledDefaults.has(control) && compiledDefaults.get(control) !== target)
            refused('Conflicting default skin for ' + control);
        }
        for (const [name, type] of types) compiledTypes.set(name, type);
        for (const [key, build] of entries) compiledSkins.set(key, build);
        for (const [control, target] of Object.entries(defaults))
          if (entries.has(target)) compiledDefaults.set(control, target);
      },
      ItemTapEvent: Object.freeze({ ITEM_TAP: 'itemTap', CHANGE: 'change', CHANGING: 'changing' }),
      CollectionEvent: Object.freeze({ COLLECTION_CHANGE: 'collectionChange' }),
      CollectionEventKind: Object.freeze({
        ADD: 'add',
        REMOVE: 'remove',
        REPLACE: 'replace',
        UPDATE: 'update',
        REFRESH: 'refresh',
        RESET: 'reset'
      }),
      PropertyEvent: Object.freeze({
        PROPERTY_CHANGE: 'propertyChange',
        dispatchPropertyEvent(target, type, property) {
          const event = new LegacyEvent(type);
          event.property = property;
          return target.dispatchEvent(event);
        }
      }),
      UIEvent: Object.freeze({
        MOVE: 'move',
        COMPLETE: 'complete',
        CREATION_COMPLETE: 'creationComplete',
        CHANGE: 'change',
        CHANGING: 'changing',
        CHANGE_START: 'changeStart',
        CHANGE_END: 'changeEnd'
      })
    }),
    resolveDefinition(name) {
      return customTypes.get(name) ?? compiledTypes.get(name);
    },
    beginMount() {
      mounting++;
    },
    // The stage changed size: every root is laid out again against it, as a UILayer follows the stage in Egret 5.
    resize() {
      for (const node of [...liveNodes]) if (!node.isDisposed && !states.has(node.parent)) requestLayout(node);
    },
    endMount() {
      if (--mounting === 0) flushLayout();
    },
    viewportOwner(child) {
      const parent = child?.parent;
      return parent instanceof Scroller && parent.viewport === child ? parent : undefined;
    },
    callGame,
    enter,
    leave
  };
}
