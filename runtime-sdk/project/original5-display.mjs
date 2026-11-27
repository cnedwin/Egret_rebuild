// SPDX-License-Identifier: Apache-2.0
import {Bitmap, Mesh2D, Sprite} from '@egret/engine';
// The 5.x Graphics port needs the exact same local triangle coverage as the 7.x Stage.
import {containsOwnPaint} from '../../packages/runtime/dist/displayHitTest.js';
import {original5NineSlice} from './original5-nine-slice.mjs';
import {original4BitmapData} from './original5-bitmap-abi4.mjs';
import {createOriginal5Images} from './original5-images.mjs';

function unsupported(name) {
  throw Object.assign(new Error('Unsupported Egret 5 native operation: ' + name), {code: 'ORIGINAL5_NATIVE_UNSUPPORTED'});
}

function rectangle(x, y, width, height) {
  return {x, y, width, height};
}

export function createOriginal5Display(services, nativeAbi = 5) {
  if (nativeAbi !== 4 && nativeAbi !== 5) throw new TypeError('Unsupported original 5.x display ABI');
  const images = createOriginal5Images(services);
  const objects = new Map();
  const cleanup = new FinalizationRegistry(id => objects.delete(id));
  const dropConsumer = new FinalizationRegistry(({set, ref}) => set.delete(ref));
  const filterConsumers = new WeakMap();
  const filterCleanup = new FinalizationRegistry(({consumers, ref}) => consumers.delete(ref));
  let nextFilterId = 0;
  let nextId = 0;
  let stage;
  let closed = false;
  let undoGraphics, originalEngine;

  function object(id) {
    const value = objects.get(id)?.deref();
    if (!value || closed) throw new Error('Unknown Egret 5 display ID ' + id);
    return value;
  }

  class NativeBitmapData {
    constructor() {
      this.consumers = new Set();
      this.binding = undefined;
      this.source = undefined;
    }
    $init() {}
    assign(source) {
      if (source === this.source) return;
      const next = source ? images.hold(source) : undefined;
      const old = this.binding;
      this.binding = next;
      this.source = source;
      try {
        for (const ref of this.consumers) {
          const bitmap = ref.deref();
          if (bitmap) bitmap.syncBitmap();
          else this.consumers.delete(ref);
        }
      } finally { old?.release(); }
    }
  }

  const abi4 = nativeAbi === 4 ? original4BitmapData(NativeBitmapData) : null;

  class NativeDisplayObject {
    constructor(kind) {
      if (![0, 1, 8, 9, 13].includes(kind)) unsupported('display type ' + kind);
      if (closed || (kind === 13 && stage)) throw new Error('Egret 5 stage lifetime');
      this.id = ++nextId;
      this.frame = new Sprite();
      this.content = this.frame.addChild(new Sprite());
      this.children = [];
      this.parent = undefined;
      this.bitmap = undefined;
      this.texture = undefined;
      this.consumerRef = new WeakRef(this);
      this.width = NaN;
      this.height = NaN;
      objects.set(this.id, new WeakRef(this));
      cleanup.register(this, this.id);
      if (kind === 13) {
        stage = this;
        services.engine.stage.addChild(this.frame);
      }
    }

    addChildAt(childId, index) {
      const child = object(childId);
      if (child.parent) child.parent.removeChild(childId);
      this.content.addChildAt(child.frame, index);
      this.children.splice(index, 0, child);
      child.parent = this;
    }
    removeChild(childId) {
      const child = object(childId), index = this.children.indexOf(child);
      if (index < 0) throw new Error('Egret 5 display parent mismatch');
      this.content.removeChild(child.frame);
      this.children.splice(index, 1);
      child.parent = undefined;
    }
    swapChild(first, second) {
      if (first === second) return;
      const a = Math.min(first, second), b = Math.max(first, second);
      const left = this.children[a], right = this.children[b];
      if (!left || !right) throw new RangeError('Egret 5 child index');
      this.removeChild(right.id);
      this.removeChild(left.id);
      this.addChildAt(right.id, a);
      this.addChildAt(left.id, b);
    }
    setX(value) { this.frame.x = value; }
    setY(value) { this.frame.y = value; }
    setScaleX(value) { this.frame.scaleX = value; }
    setScaleY(value) { this.frame.scaleY = value; }
    setRotation(value) { this.frame.rotation = value; }
    setSkewX(value) { this.frame.skewX = value - this.frame.rotation; }
    setSkewY(value) { this.frame.skewY = value; }
    setAnchorOffsetX(value) { this.frame.anchorOffsetX = value; }
    setAnchorOffsetY(value) { this.frame.anchorOffsetY = value; }
    setVisible(value) { this.frame.visible = value; }
    setAlpha(value) { this.frame.alpha = value; }

    setMatrix(a, b, c, d, tx, ty) {
      const angleX = Math.atan2(b, a) * 180 / Math.PI;
      const angleY = Math.atan2(-c, d) * 180 / Math.PI;
      this.frame.x = tx;
      this.frame.y = ty;
      this.frame.scaleX = Math.hypot(a, b);
      this.frame.scaleY = Math.hypot(c, d);
      this.frame.rotation = angleX;
      this.frame.skewX = angleY - angleX;
      this.frame.skewY = 0;
    }

    setScrollRect(x, y, width, height) {
      this.frame.clipRect = x || y || width || height ? rectangle(0, 0, width, height) : undefined;
      this.content.x = -x;
      this.content.y = -y;
    }
    setMaskRect(x, y, width, height) {
      this.maskRect = x || y || width || height ? rectangle(x, y, width, height) : undefined;
      this.content.mask = this.maskNode ?? this.maskRect;
    }
    setMask(id) {
      // The original setter updates these two slots separately, including setMask(-1)
      // immediately after installing a rectangle.
      this.maskNode = id === -1 ? undefined : object(id).frame;
      this.content.mask = this.maskNode ?? this.maskRect;
    }
    setBlendMode(value) {
      const blend = ['normal', 'add', 'erase'][value];
      if (!blend) unsupported('blend ' + value);
      this.frame.blendMode = blend;
    }
    setTint(color) { if (color !== 0xffffff) unsupported('tint'); }
    setCacheAsBitmap(value) { if (value) unsupported('cacheAsBitmap'); }
    setChildrenSortMode(value) { if (value) unsupported('sorted children'); }
    setSortableChildren(value) { if (value) unsupported('sorted children'); }
    setZIndex(value) { if (value) unsupported('zIndex'); }
    setFilters(values) {
      const filter = values?.[0];
      if (values != null && (!Array.isArray(values) || values.length > 1)) unsupported('filter chain');
      if (values?.length && (!filterConsumers.has(filter) || filter?.type !== 'colorTransform' ||
          !services.capabilities?.subtreeEffects)) unsupported('filter ' + filter?.type);
      // Assign before changing subscriptions: a rejected value leaves the current effect intact.
      this.frame.renderEffect = filter ? {colorMatrix: filter.matrix} : undefined;
      if (filter === this.boundFilter) return;
      if (this.boundFilter) {
        filterConsumers.get(this.boundFilter).delete(this.consumerRef);
        filterCleanup.unregister(this);
      }
      this.boundFilter = filter;
      if (filter) {
        const consumers = filterConsumers.get(filter);
        consumers.add(this.consumerRef);
        filterCleanup.register(this, {consumers, ref: this.consumerRef}, this);
      }
    }
    setScale9Grid(x, y, width, height) {
      this.grid = width === -1 && height === -1 ? undefined : rectangle(x, y, width, height);
      this.syncBitmap();
    }
    setBitmapFillMode(value) { if (value !== 'scale') unsupported('bitmap fill ' + value); }
    setWidth(value) { this.width = value; this.syncBitmap(); }
    setHeight(value) { this.height = value; this.syncBitmap(); }

    setTexture(texture) {
      const old = this.boundData;
      const holder = texture?.$bitmapData;
      const data = abi4 ? abi4.dataOf(holder) : holder?.$nativeBitmapData;
      if (texture?.$rotated) unsupported('rotated atlas');
      if (texture && !(data instanceof NativeBitmapData)) throw new Error('Expected original 5 BitmapData');
      if (data !== old) {
        old?.consumers.delete(this.consumerRef);
        dropConsumer.unregister(this.consumerRef);
        if (data) {
          data.consumers.add(this.consumerRef);
          dropConsumer.register(this, {set: data.consumers, ref: this.consumerRef}, this.consumerRef);
        }
      }
      this.boundData = data;
      this.texture = texture;
      this.syncBitmap();
    }
    syncBitmap() {
      const t = this.texture;
      const lease = this.boundData?.binding?.lease;
      if (!lease || !t.$bitmapWidth || !t.$bitmapHeight) {
        this.dropBitmap();
        return;
      }
      if (this.grid) {
        const geometry = original5NineSlice(originalEngine, t, this.grid, this.width, this.height, lease);
        if (this.bitmap instanceof Mesh2D) this.bitmap.setContent(lease, geometry);
        else {
          const next = new Mesh2D(lease, geometry);
          this.dropBitmap();
          this.bitmap = this.content.addChild(next);
        }
        return;
      }
      if (this.bitmap instanceof Mesh2D) this.dropBitmap();
      if (!this.bitmap) this.bitmap = this.content.addChild(new Bitmap(lease));
      else if (this.bitmap.textureLease !== lease) this.bitmap.textureLease = lease;
      this.bitmap.sourceRect = rectangle(t.$bitmapX, t.$bitmapY, t.$bitmapWidth, t.$bitmapHeight);
      // Egret 5 stores the packed crop in pixels. Its global texture scale also applies
      // to the draw offset, even when an EUI layout supplies an explicit width/height.
      const sx = t.$getScaleBitmapWidth() / t.$bitmapWidth * (Number.isFinite(this.width) ? this.width / t.$textureWidth : 1);
      const sy = t.$getScaleBitmapHeight() / t.$bitmapHeight * (Number.isFinite(this.height) ? this.height / t.$textureHeight : 1);
      this.bitmap.x = t.$offsetX * sx;
      this.bitmap.y = t.$offsetY * sy;
      this.bitmap.scaleX = sx;
      this.bitmap.scaleY = sy;
    }

    dropBitmap() {
      if (!this.bitmap) return;
      this.content.removeChild(this.bitmap);
      this.bitmap.dispose();
      this.bitmap = undefined;
    }

    setBeginFill(color, alpha) { this.content.graphics.beginFill(color, alpha); }
    setDrawRect(x, y, w, h) { this.content.graphics.drawRect(x, y, w, h); }
    setDrawRoundRect(x, y, w, h, ew, eh) { this.content.graphics.drawRoundRect(x, y, w, h, ew, eh || ew); }
    setDrawCircle(x, y, r) { this.content.graphics.drawCircle(x, y, r); }
    setDrawEllipse(x, y, w, h) { this.content.graphics.drawEllipse(x, y, w, h); }
    setMoveTo(x, y) { this.content.graphics.moveTo(x, y); }
    setLineTo(x, y) { this.content.graphics.lineTo(x, y); }
    setCurveTo(cx, cy, x, y) { this.content.graphics.curveTo(cx, cy, x, y); }
    setCubicCurveTo(...points) { this.content.graphics.cubicCurveTo(...points); }
    setDrawArc(...arc) { this.content.graphics.drawArc(...arc); }
    setLineStyle(width, color, alpha, pixelHinting, scaleMode, caps, joints, miterLimit) {
      // EUI Rect also passes pixelHinting for the hidden stroke around its fill.
      if (width > 0 && alpha !== 0 && (pixelHinting || (scaleMode && scaleMode !== 'normal'))) {
        unsupported('nonstandard stroke scaling');
      }
      this.content.graphics.lineStyle(width > 0 ? width : undefined, color, alpha, {
        caps: caps || 'round',
        joints: joints || 'round',
        miterLimit
      });
    }
    setEndFill() { this.content.graphics.endFill(); }
    setGraphicsClear() { this.content.graphics.clear(); }

    // The base constructor runs before the concrete type and uniforms are assigned.
    // Projects often construct filters at module load without putting them on a display.
    static createFilter(filter) {
      if (filterConsumers.has(filter)) throw new Error('Original filter already registered');
      filter.$id = ++nextFilterId;
      filterConsumers.set(filter, new Set());
    }
    static setDataToFilter(filter) {
      if (closed) return;
      const consumers = filterConsumers.get(filter);
      if (!consumers) throw new Error('Unknown original filter');
      for (const ref of consumers) {
        const node = ref.deref();
        if (node) node.setFilters([filter]);
        else consumers.delete(ref);
      }
    }
    // A color transform has zero padding. Other filter kinds are rejected on attachment.
    static setFilterPadding() {}
    static setSourceToNativeBitmapData(data, value) { data.assign(value); }
    static disposeNativeBitmapData(data) { data.assign(undefined); }
    // Egret 5 invokes this on stage detachment to retire a backend cache. The shared
    // tree has no such cache here. The authored shape survives detach/reattach.
    static disposeGraphicData() {}
  }

  for (const name of ['setBeginGradientFill', 'setDataToMesh', 'setBitmapDataToMesh', 'setDataToBitmapNode']) {
    NativeDisplayObject.prototype[name] = () => unsupported(name);
  }

  function point(id, name, x, y) {
    const result = object(id).content[name](x, y);
    return result.x + ',' + result.y;
  }

  if (abi4) {
    // ABI 4 passes the original Texture object despite the historical method name.
    NativeDisplayObject.prototype.setBitmapData = NativeDisplayObject.prototype.setTexture;
    NativeDisplayObject.disposeBitmapData = data => abi4.dispose(data);
    // A packed Texture only describes an atlas region; BitmapData owns the native page.
    NativeDisplayObject.disposeTexture = () => {};
  }

  const api = {
    nrABIVersion: nativeAbi, nrMinEgretVersion: nativeAbi === 4 ? '5.3.1' : '5.3.5', NativeDisplayObject, NativeBitmapData,
    nrLocalToGlobal: (id, x, y) => point(id, 'localToGlobal', x, y),
    nrGlobalToLocal: (id, x, y) => point(id, 'globalToLocal', x, y),
    // The player captures the bound tree after the original ticker has advanced the game.
    updateNativeRender() {}, nrRender() {}, nrResize() {}, nrSetCanvasScaleFactor() {}
  };

  function installGraphics(egret) {
    const proto = egret.Graphics.prototype;
    const previous = proto.$hitTest;
    // The original Stage recurses in original display order and checks masks and visibility.
    // Only the browser's three-pixel canvas readback is replaced by the shared filled geometry.
    function hit(stageX, stageY) {
      const target = this.$targetDisplay;
      const native = target?.$nativeDisplayObject;
      if (!native || closed) return null;
      const point = native.content.globalToLocal(stageX, stageY);
      return containsOwnPaint(native.content, point) ? target : null;
    }
    if (undoGraphics) throw new Error('Original 5 Graphics already installed');
    abi4?.install(egret);
    originalEngine = egret;
    proto.$hitTest = hit;
    undoGraphics = () => { if (proto.$hitTest === hit) proto.$hitTest = previous; };
  }

  function close() {
    if (closed) return;
    closed = true;
    undoGraphics?.();
    abi4?.close();
    originalEngine = undefined;
    stage?.frame.dispose();
    stage = undefined;
    objects.clear();
    images.close();
  }
  return {api, installGraphics, imageSource: images.imageSource, releaseImageSource: images.releaseImageSource, close};
}
