// SPDX-License-Identifier: Apache-2.0
// Bounded EUI skin and layout behavior on the public Egret 7 display API.
export function createLegacyEui({
  sdk,
  Container,
  Bitmap,
  TextField,
  RES,
  theme,
  stageOf,
  observe,
  events,
  EventDispatcher,
  LegacyEvent,
  game,
  stageSize
}) {
  const states = new WeakMap();
  const skins = new Map();
  const customTypes = new Map();
  const customNames = new Map();
  const activeSkins = new Set();
  const liveNodes = new Set();
  function detachObservers(node) {
    const data = state(node);
    for (const record of data?.applied?.values() ?? []) {
      record.off?.();
      record.off = undefined;
    }
    if (node instanceof DataGroup) node.detachProvider();
    if (node instanceof Scroller) node.detachScroll();
    liveNodes.delete(node);
  }
  game.scope.use({
    dispose() {
      for (const node of liveNodes) detachObservers(node);
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

  function bind(chain, owner, write, restore) {
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
        const value = values.length === 1 ? values[0] : values.map(part => part ?? '').join('');
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

  function innerSize(node) {
    const data = state(node);
    const children = childrenOf(node).filter(child => state(child).properties.includeInLayout !== false);
    if (children.length === 0) return undefined;
    const layout = data.layout?.type;
    const p = data.layout?.properties ?? {};
    const gap = p.gap ?? (layout === 'VerticalLayout' || layout === 'HorizontalLayout' ? 6 : 0);
    if (layout === 'HorizontalLayout' || layout === 'VerticalLayout') {
      const width =
        layout === 'HorizontalLayout'
          ? children.reduce((sum, child) => sum + child.width, 0) + gap * (children.length - 1)
          : Math.max(...children.map(child => child.width));
      const height =
        layout === 'VerticalLayout'
          ? children.reduce((sum, child) => sum + child.height, 0) + gap * (children.length - 1)
          : Math.max(...children.map(child => child.height));
      return {
        width: Math.max(0, width + (p.paddingLeft ?? 0) + (p.paddingRight ?? 0)),
        height: Math.max(0, height + (p.paddingTop ?? 0) + (p.paddingBottom ?? 0))
      };
    }
    return {
      width: Math.max(0, ...children.map(child => child.x - child.anchorOffsetX + child.width)),
      height: Math.max(0, ...children.map(child => child.y - child.anchorOffsetY + child.height))
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

  function requestLayout(node) {
    if (node.isDisposed) return;
    let root = node;
    while (states.has(root.parent)) root = root.parent;
    const data = state(root);
    if (!data.initialized || data.arranging || data.rowUpdates) return;
    resolveSize(root, stageSize.width, stageSize.height);
    arrange(root);
  }

  const sized = Base =>
    class extends Base {
      constructor(...args) {
        super(...args);
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
        requestLayout(this);
      }
      get height() {
        return layoutSize(this, 'height', () => this.getBounds().height);
      }
      set height(value) {
        if (typeof value !== 'number') refused('EUI height must be numeric when set by code.');
        state(this).explicitheight = dimension(value, 0);
        state(this).arrangedheight = state(this).explicitheight;
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
        data.skin = value;
        if (!data.skinApplied) attachSkin(this, value);
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
      setLayoutBoundsPosition(x, y) {
        this.x = x;
        this.y = y;
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
      data.currentState = value;
      data.refreshState?.();
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
  class Group extends Component {}
  class UILayer extends Component {}
  class Skin extends Group {}

  class Rect extends Component {
    #paint = {
      fillColor: 0xffffff,
      fillAlpha: 1,
      strokeColor: 0,
      strokeAlpha: 1,
      strokeWeight: 0,
      ellipseWidth: 0,
      ellipseHeight: 0
    };
    #drawn;
    #shape = new sdk.Sprite();
    constructor(width, height, fillColor = 0xffffff) {
      super();
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
    #generation = 0;
    constructor(source) {
      super();
      if (source !== undefined) this.source = source;
    }
    get source() {
      return this.#source;
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
      if (this.texture == null || this.numChildren !== 1) return;
      const native = this.getChildAt(0);
      const width = this.width,
        height = this.height;
      if (native.width !== width) native.width = width;
      if (native.height !== height) native.height = height;
    }
  }

  class Label extends sized(TextField) {
    #textAlign = 'left';
    #verticalAlign = 'top';
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
      if (this.isDisposed || this.numChildren === 0) return;
      const visual = this.getChildAt(0);
      const bounds = visual.getBounds();
      const width = state(this).arrangedwidth ?? state(this).explicitwidth;
      const height = state(this).arrangedheight ?? state(this).explicitheight;
      visual.x = width === undefined ? 0 : alignment(this.#textAlign, this.width - bounds.width) - bounds.x;
      visual.y = height === undefined ? 0 : alignment(this.#verticalAlign, this.height - bounds.height) - bounds.y;
    }
    onLegacyTextReady() {
      requestLayout(this);
    }
  }

  class Button extends Component {
    #label = '';
    constructor() {
      super();
      this.touchEnabled = true;
      this.touchChildren = false;
    }
    get enabled() {
      return super.enabled;
    }
    set enabled(value) {
      super.enabled = value;
      this.touchChildren = false;
    }
    get label() {
      return this.#label;
    }
    set label(value) {
      this.#label = String(value);
      this.updateLabel();
    }
    updateState() {
      const name = this.enabled ? 'up' : 'disabled';
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
      if (state(this).initialized) this.dataChanged();
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
    #renderer = ItemRenderer;
    #skin;
    #rows = [];
    #reconciling = false;
    #refreshPending = false;
    #offWheel;
    #scrollV = 0;
    #scrollEnabled = false;
    get useVirtualLayout() {
      return false;
    }
    set useVirtualLayout(value) {
      if (value !== false) refused('Virtualized list layout needs an explicit migration.');
    }
    get scrollEnabled() {
      return this.#scrollEnabled;
    }
    set scrollEnabled(value) {
      this.#scrollEnabled = Boolean(value);
      requestLayout(this);
    }
    get scrollV() {
      return this.#scrollV;
    }
    set scrollV(value) {
      if (!Number.isFinite(value)) refused('Expected a finite vertical scroll offset.');
      this.#scrollV = Math.max(0, value);
      requestLayout(this);
    }
    updateScroll(width, height) {
      if (!this.#scrollEnabled || width <= 0 || height <= 0) {
        this.#offWheel?.();
        this.#offWheel = undefined;
        this.clipRect = undefined;
        return;
      }
      if (state(this).layout.type !== 'VerticalLayout') refused('Scrolling currently requires a vertical list layout.');
      const content = this.contentHeight;
      this.clipRect = { x: 0, y: 0, width, height };
      this.#scrollV = Math.min(this.#scrollV, Math.max(0, content - height));
      if (!stageOf(this)) return;
      if (!this.#offWheel && game?.hover?.events.wheel) {
        this.#offWheel = this.on(game.hover.events.wheel, event => {
          if (event.defaultPrevented || event.payload.zoom) return;
          const { deltaY, unit } = event.payload;
          const line = this.getElementAt(0)?.height || 40;
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
      return this.#rows.length;
    }
    getElementAt(index) {
      return this.#rows[index] ?? null;
    }
    getElementIndex(row) {
      return this.#rows.indexOf(row);
    }
    getVirtualElementAt(index) {
      return this.getElementAt(index);
    }
    #resetRows() {
      for (const row of this.#rows) {
        this.removeChild(row);
        row.dispose();
      }
      this.#rows = [];
      if (this.#watching) this.#updateRows();
    }
    attachProvider() {
      if (!stageOf(this) || !state(this).initialized || this.#watching) return;
      this.#watching = true;
      this.#provider?.addEventListener('collectionChange', this.#updateRows, this);
      this.#updateRows();
    }
    detachProvider() {
      this.#provider?.removeEventListener('collectionChange', this.#updateRows, this);
      this.#watching = false;
      this.#offWheel?.();
      this.#offWheel = undefined;
    }
    dispose() {
      this.detachProvider();
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
      const rows = this.#rows;
      const selected = this.getElementAt(this.selectedIndex);
      let aligned;
      if (event?.kind === 'add' || event?.kind === 'remove' || event?.kind === 'replace') {
        aligned = rows.slice();
        if (event.kind === 'add') aligned.splice(event.location, 0, ...event.items.map(() => undefined));
        if (event.kind === 'remove') aligned.splice(event.location, event.items.length);
      }
      // Keep the existing renderer for each occurrence, including duplicate items in the collection.
      const pool = new Map();
      for (const row of aligned ? [] : rows) {
        let bucket = pool.get(row.data);
        if (!bucket) pool.set(row.data, (bucket = []));
        bucket.push(row);
      }
      const next = source.map((item, index) => {
        const existing = aligned ? aligned[index] : pool.get(item)?.shift();
        const row = existing ?? new this.#renderer();
        if (!existing && this.#skin !== undefined) {
          if (typeof this.#skin === 'string') row.skinName = this.#skin;
          else state(row).inlineSkin = this.#skin;
        }
        row.itemIndex = index;
        row.data = item;
        if (event?.kind === 'update' && index === event.location) row.dataChanged();
        return row;
      });
      const retained = new Set(next);
      for (const row of rows)
        if (!retained.has(row)) {
          this.removeChild(row);
          row.dispose();
        }
      this.#rows = next;
      next.forEach((row, index) => {
        if (row.parent !== this || this.getChildAt(index) !== row) this.addChildAt(row, index);
      });
      this.rowsChanged?.(selected);
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
      this.#selected = this.getElementAt(this.#index)?.data;
      for (let index = 0; index < this.numElements; index++) this.getElementAt(index).selected = index === this.#index;
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
    rowsChanged(selected) {
      this.selectedIndex = this.#pendingIndex ?? this.getElementIndex(selected);
    }
  }
  class Scroller extends Component {
    #input = [];
    get viewport() {
      return childrenOf(this)[0];
    }
    set viewport(value) {
      if (value === this.viewport) return;
      if (value != null && !(value instanceof DataGroup)) refused('Expected a vertical list viewport.');
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
      const localY = contact => this.globalToLocal(contact.globalX, contact.globalY).y;
      this.#input.push(
        this.on(
          game.pointer.events.begin,
          event => {
            const viewport = this.viewport;
            if (drag || !viewport || viewport.contentHeight <= viewport.height) return;
            consumed = undefined;
            drag = {
              session: event.payload.session,
              viewport,
              y: localY(event.payload),
              offset: viewport.scrollV,
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
            const delta = drag.y - localY(contact);
            if (drag.moved || Math.abs(delta) >= 5) {
              drag.moved = true;
              consumed = drag.session;
              if (this.viewport) this.viewport.scrollV = drag.offset + delta;
            }
          } else if (kind === 'end' || kind === 'cancel') drag = undefined;
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
  const classes = {
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
      child.x = (width - child.width) / 2 + properties.horizontalCenter + child.anchorOffsetX;
    if (properties.top !== undefined) child.y = properties.top + child.anchorOffsetY;
    else if (properties.bottom !== undefined) child.y = height - properties.bottom - child.height + child.anchorOffsetY;
    else if (properties.verticalCenter !== undefined)
      child.y = (height - child.height) / 2 + properties.verticalCenter + child.anchorOffsetY;
  }

  function arrange(node) {
    const data = state(node);
    if (!data || data.arranging || node.isDisposed) return;
    data.arranging = true;
    try {
      // Seed fixed child dimensions before measuring an auto-sized group; resolve percentage/edge constraints after.
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
      if (node instanceof DataGroup) node.updateScroll(width, height);
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
      const totalWidth =
        included.reduce((value, child) => value + child.width, 0) + Math.max(0, included.length - 1) * gap;
      const totalHeight =
        included.reduce((value, child) => value + child.height, 0) + Math.max(0, included.length - 1) * gap;
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
            child.y = cursorY + child.anchorOffsetY;
            cursorY += child.height + gap;
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
      if (node instanceof Rect) node.redraw();
      if (node instanceof Image) node.resizeImage();
      if (node instanceof Label) node.alignText();
      if (node.touchEnabled) node.hitArea = width > 0 && height > 0 ? { x: 0, y: 0, width, height } : undefined;
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
      theme?.skins?.[name] ??
      theme?.skins?.['eui.' + name] ??
      (node instanceof Button ? theme?.skins?.['eui.Button'] : undefined)
    );
  }

  function attachSkin(node, name) {
    const data = state(node);
    if (data.skinApplied) return;
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
          if (id) node.partAdded?.(id, part);
        }
    } finally {
      data.pendingChildren = undefined;
      activeSkins.delete(skin);
    }
    data.skinApplied = true;
    node.dispatchEvent(new sdk.Event(events.complete, undefined));
  }

  function enter(node) {
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
          node.dataChanged();
        }
        requestLayout(node);
        const finished = node.childrenCreated?.();
        if (finished && typeof finished.then === 'function') return Promise.resolve(finished).then(complete);
        complete();
      };
      const created = node.createChildren?.();
      if (created && typeof created.then === 'function') observe(Promise.resolve(created).then(finishChildren));
      else {
        const finished = finishChildren();
        if (finished && typeof finished.then === 'function') observe(finished);
      }
    }
    if (data.owner) refreshProperties(node, data.owner, true);
    if (node instanceof DataGroup) node.attachProvider();
    if (node instanceof Scroller) node.attachScroll();
    if (node instanceof Image) node.loadSource();
    requestLayout(node);
  }

  function leave(node) {
    if (states.has(node)) detachObservers(node);
  }

  function registerCustomComponent(name, ctor) {
    if (
      !(typeof name === 'string' && /^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*$/.test(name)) ||
      typeof ctor !== 'function' ||
      !(ctor.prototype instanceof Component) ||
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
      Theme,
      ArrayCollection,
      registerCustomComponent,
      ItemTapEvent: Object.freeze({ ITEM_TAP: 'itemTap' }),
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
      UIEvent: Object.freeze({ COMPLETE: 'complete', CREATION_COMPLETE: 'creationComplete' })
    }),
    enter,
    leave
  };
}
