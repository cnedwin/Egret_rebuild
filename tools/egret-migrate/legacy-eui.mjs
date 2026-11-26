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
  stageSize
}) {
  const states = new WeakMap();
  const skins = new Map();
  const activeSkins = new Set();
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
    const gap = p.gap ?? 0;
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
    if (!data.initialized || data.arranging) return;
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
        data.skin = value;
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
      invalidateDisplayList() {
        requestLayout(this);
      }
    };

  class Component extends sized(Container) {
    #enabled = true;
    // Legacy subclasses regularly call the base hooks even when they have no base work.
    createChildren() {}
    childrenCreated() {}
    get enabled() {
      return this.#enabled;
    }
    set enabled(value) {
      this.#enabled = Boolean(value);
      this.touchEnabled = this.#enabled;
      this.touchChildren = this.#enabled;
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
    updateLabel() {
      if (this.labelDisplay) {
        if (!(this.labelDisplay instanceof Label)) refused('Button labelDisplay must be an EUI Label.');
        this.labelDisplay.text = this.#label;
      } else if (state(this).initialized && this.#label) refused('A labeled Button needs a labelDisplay skin part.');
    }
  }

  const classes = { Skin, Group, Component, UILayer, Rect, Image, Label, Button };
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

  function setProperties(node, properties) {
    const data = state(node);
    data.properties = { ...properties };
    // EUI dimensions are layout units, unlike the engine width/height scaling setters.
    for (const [key, value] of Object.entries(properties)) {
      if (layoutKeys.has(key)) continue;
      if (!(key in node)) refused('Unsupported EUI property ' + key + ' on ' + node.constructor.name + '.');
      node[key] = value;
    }
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

  function construct(descriptor, owner) {
    const Type = Object.hasOwn(classes, descriptor.type) ? classes[descriptor.type] : undefined;
    if (!Type || Type === Skin || Type === UILayer) refused('Unsupported EUI element ' + descriptor.type + '.');
    const node = new Type();
    const data = state(node);
    setProperties(node, descriptor.properties);
    data.layout = descriptor.layout;
    const id = descriptor.properties.id;
    if (id) skinPart(owner, id, node);
    for (const child of descriptor.children) node.addChild(construct(child, owner));
    return node;
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
      const gap = p.gap ?? 0;
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
      let cursorY = top + alignment(p.verticalAlign, innerHeight - totalHeight);

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
    const name = node.constructor.name;
    return (
      theme?.skins?.[name] ??
      theme?.skins?.['eui.' + name] ??
      (node instanceof Button ? theme?.skins?.['eui.Button'] : undefined)
    );
  }

  function enter(node) {
    const data = state(node);
    if (!data) return;
    if (!data.initialized) {
      data.initialized = true;
      function attachSkin(name) {
        const skin = skins.get(name);
        if (!skin) refused('Unknown EXML skin ' + name + '.');
        if (activeSkins.has(skin)) refused('Recursive EXML skin reference: ' + name + '.');
        activeSkins.add(skin);
        data.skin = name;
        data.skinProperties = skin.properties;
        data.layout ??= skin.layout;
        // Parts are created before attachment, so every named sibling exists for lifecycle callbacks.
        try {
          const parts = skin.children.map(descriptor => construct(descriptor, node));
          data.pendingChildren = parts;
          requestLayout(node);
          for (const child of parts) node.addChild(child);
        } finally {
          data.pendingChildren = undefined;
          activeSkins.delete(skin);
        }
      }
      const initial = selectedSkin(node);
      if (initial !== undefined) attachSkin(initial);
      else data.acceptInitialSkin = true;
      const complete = () => {
        if (!node.isDisposed) node.dispatchEvent(new sdk.Event(events.creationComplete, undefined));
      };
      const finishChildren = () => {
        if (node.isDisposed) return;
        data.acceptInitialSkin = false;
        if (initial === undefined && data.skin !== undefined) attachSkin(data.skin);
        if (node instanceof Button) node.updateLabel();
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
    if (node instanceof Image) node.loadSource();
    requestLayout(node);
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
      UIEvent: Object.freeze({ COMPLETE: 'complete', CREATION_COMPLETE: 'creationComplete' })
    }),
    enter
  };
}
