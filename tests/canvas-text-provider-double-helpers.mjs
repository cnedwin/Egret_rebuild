// First-party Apache-2.0. These public-realm doubles are CPU boundary controls.
// Their literal RGBA bytes are neither a glyph reference nor native pixels.
import assert from 'node:assert/strict';
import { engineFixture, request, deferred, keep } from './text-raster-public-helpers.mjs';

export const METRICS = Object.freeze({ width: 8, actualBoundingBoxLeft: 1,
  actualBoundingBoxAscent: 4, actualBoundingBoxRight: 7, actualBoundingBoxDescent: 2 });
export const ZERO = Object.freeze({ width: 0, actualBoundingBoxLeft: 0,
  actualBoundingBoxAscent: 0, actualBoundingBoxRight: 0, actualBoundingBoxDescent: 0 });
export const STATE = Object.freeze({ font: '10px sans-serif', direction: 'inherit',
  textAlign: 'start', textBaseline: 'alphabetic', lang: 'inherit', fontKerning: 'auto',
  fontStretch: 'normal', fontVariantCaps: 'normal', letterSpacing: '0px', wordSpacing: '0px',
  textRendering: 'auto', fillStyle: '#000000', globalAlpha: 1,
  globalCompositeOperation: 'source-over', shadowColor: 'rgba(0, 0, 0, 0)',
  shadowBlur: 0, shadowOffsetX: 0, shadowOffsetY: 0, filter: 'none' });

export function realm(t, hooks = {}) {
  const events = [], canvases = [], checks = [], reads = [], fills = [], measurements = [];
  const owned = { events, canvases, checks, reads, fills, measurements };
  class NativeImageData {
    constructor(data, width, height) {
      this.data = data; this.width = width; this.height = height; this.colorSpace = 'srgb';
    }
  }
  class Context {
    constructor(canvas) { this.canvas = canvas; this.values = { ...STATE }; this.transform = [1, 0, 0, 1, 0, 0]; }
    getContextAttributes() {
      events.push(['attributes', this.canvas.id]);
      return hooks.attributes?.(this, owned) ?? { alpha: true, colorSpace: 'srgb', willReadFrequently: true };
    }
    measureText(text) {
      const call = { canvas: this.canvas, text, size: [this.canvas.width, this.canvas.height],
        state: { ...this.values }, transform: [...this.transform] };
      measurements.push(call); events.push(['measure', this.canvas.id, text]);
      return hooks.measure?.(text, call, owned) ?? (text.length ? { ...METRICS } : { ...ZERO });
    }
    fillText(...args) {
      const call = { canvas: this.canvas, args, state: { ...this.values }, transform: [...this.transform] };
      fills.push(call); events.push(['fill', this.canvas.id, ...args]);
      hooks.fill?.(call, owned);
    }
    getImageData(x, y, width, height) {
      const call = { canvas: this.canvas, x, y, width, height };
      reads.push(call); events.push(['readback', this.canvas.id, width, height]);
      const pixels = new Uint8ClampedArray(width * height * 4);
      for (let index = 0; index < pixels.length; index += 4) pixels.set([17, 83, 149, 255], index);
      call.pixels = pixels;
      return hooks.read?.(call, owned) ?? new NativeImageData(pixels, width, height);
    }
    setTransform(...args) {
      this.transform = args.length === 1
        ? [args[0].a, args[0].b, args[0].c, args[0].d, args[0].e, args[0].f] : args;
      events.push(['transform', this.canvas.id, ...this.transform]); hooks.transform?.(this, owned);
    }
    resetTransform() { this.setTransform(1, 0, 0, 1, 0, 0); }
    clearRect(...args) { events.push(['clear', this.canvas.id, ...args]); }
    save() { this.saved = { values: { ...this.values }, transform: [...this.transform] }; }
    restore() { if (this.saved) { this.values = this.saved.values; this.transform = this.saved.transform; } }
    reset() { this.values = { ...STATE }; this.transform = [1, 0, 0, 1, 0, 0]; }
  }
  for (const key of Object.keys(STATE)) Object.defineProperty(Context.prototype, key, {
    configurable: true,
    get() { return this.values[key]; },
    set(value) { events.push(['state', this.canvas.id, key, value]);
      hooks.state?.(this, key, value, owned); if (hooks.denyState !== key) this.values[key] = value; },
  });
  class Canvas {
    constructor() {
      this.id = canvases.length; this.ownerDocument = document; this.style = {}; this.lang = '';
      this.size = { width: 300, height: 150 }; this.context = new Context(this); canvases.push(this);
    }
    get width() { return this.size.width; }
    set width(value) { this.dimension('width', value); }
    get height() { return this.size.height; }
    set height(value) { this.dimension('height', value); }
    dimension(key, value) {
      events.push(['size', this.id, key, value]); hooks.dimension?.(this, key, value, owned);
      this.size[key] = value; this.context.reset();
    }
    getContext(kind, options) {
      events.push(['context', this.id, kind, options === undefined ? undefined : { ...options }]);
      if (kind !== '2d') return null;
      return hooks.context?.(this, options, owned) ?? this.context;
    }
    setAttribute(name, value) { this[name] = String(value); }
  }
  class Document {
    constructor() {
      this.defaultView = globalThis; this.documentElement = { lang: 'und' };
      this.fonts = { check(font, text) {
        checks.push([font, text]); events.push(['font-check', font, text]);
        return hooks.check?.(font, text, owned) ?? true;
      }, load() { throw new Error('WC1 must not load fonts'); },
      get ready() { throw new Error('WC1 must not wait for fonts'); },
      add() { throw new Error('WC1 must not add fonts'); },
      delete() { throw new Error('WC1 must not delete fonts'); },
      clear() { throw new Error('WC1 must not clear fonts'); },
      addEventListener() { throw new Error('WC1 must not observe fonts'); } };
    }
    createElement(name) {
      assert.equal(name, 'canvas'); events.push(['create', canvases.length]);
      hooks.create?.(owned); return new Canvas();
    }
  }
  const document = new Document();
  const values = { window: globalThis, document, Document, HTMLDocument: Document,
    HTMLCanvasElement: Canvas, CanvasRenderingContext2D: Context, ImageData: NativeImageData,
    FontFace: function() { throw new Error('WC1 must not construct fonts'); },
    fetch() { throw new Error('WC1 must not fetch'); },
    requestAnimationFrame() { throw new Error('WC1 must not schedule frames'); },
    cancelAnimationFrame() { throw new Error('WC1 must not own a frame loop'); } };
  const originals = new Map(Object.keys(values).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(values)) Object.defineProperty(globalThis, key,
    { value, configurable: true, writable: true });
  t.after(() => { for (const [key, descriptor] of originals) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key];
  } });
  return { ...owned, document, Canvas, Context };
}

export async function factory() {
  const module = await import('@egret/engine/web/text');
  assert.deepEqual(Object.keys(module), ['createCanvasTextRasterProvider']);
  return module.createCanvasTextRasterProvider;
}

// Only the published provider boundary is decorated. Every createPlan call
// invokes the actual cache context; the resource, request and issuer are real.
export function observedProvider(provider, hooks = {}) {
  const state = { requests: [], measureContexts: [], rasterContexts: [], inputs: [], plans: [],
    returnedPlans: [], images: [], released: [] };
  const wrapper = {
    identity: provider.identity, profile: provider.profile,
    async measure(value, context) {
      state.requests.push(value); state.measureContexts.push(context);
      const observed = Object.freeze({ ...context, createPlan(input) {
        state.inputs.push(input); const plan = context.createPlan(input); state.plans.push(plan); return plan;
      } });
      const plan = await Reflect.apply(provider.measure, provider, [value, observed]);
      state.returnedPlans.push(plan); hooks.measured?.(plan, state); return plan;
    },
    async rasterize(plan, context) {
      state.rasterContexts.push(context);
      if (hooks.beforeRaster) await hooks.beforeRaster(plan, context, state);
      const result = await Reflect.apply(provider.rasterize, provider, [plan, context]);
      state.images.push(result); hooks.rastered?.(result, state); return result;
    },
    release(plan) { state.released.push(plan); Reflect.apply(provider.release, provider, [plan]); },
  };
  return { wrapper, state };
}

export async function setup(t, provider, options = {}, hooks = {}) {
  const base = await engineFixture(t), observed = observedProvider(provider, hooks);
  // Capture final protocol callbacks only after fixture decoration. One manager owns one cache.
  hooks.decorate?.(observed.wrapper, observed.state);
  const text = await import('@egret/engine/text');
  const cache = text.createTextRasterCache(base.engine.assets,
    { ...options, provider: observed.wrapper, maxResidentEntries: 0 });
  t.after(() => cache.dispose());
  const scope = base.engine.createScope(), field = text.createTextField(base.engine, scope, cache);
  return { ...base, ...observed, cache, scope, field, text };
}
export const wcRequest = overrides => request({ fontSize: 20, ...overrides });
export function holdRaster() {
  const gate = deferred(), entered = deferred();
  return { gate, entered, hook: async () => { entered.resolve(); await gate.promise; } };
}
export async function enteredOrOutcome(hold, promise) {
  const observed = keep(promise);
  await Promise.race([hold.entered.promise, observed.observed.then(outcome => {
    throw new Error('work settled before the assigned public raster hold', { cause: outcome.error });
  })]);
  return observed;
}
