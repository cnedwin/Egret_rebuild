// SPDX-License-Identifier: Apache-2.0
// Fonts borrow an ordinary indexed PNG asset. Labels own their meshes and detach
// before the font relinquishes its independent page lease.
export function validateClassicBitmapFont(source) {
  const frames = source?.frames;
  if (typeof source?.file !== 'string' || !frames || Array.isArray(frames) || typeof frames !== 'object')
    throw new TypeError('Expected a single-page Egret JSON bitmap font.');
  const entries = Object.entries(frames);
  if (!entries.length || entries.length > 4096) throw new RangeError('Expected 1 to 4096 font glyphs.');
  for (const [character, glyph] of entries) {
    if (
      [...character].length !== 1 ||
      !glyph ||
      typeof glyph !== 'object' ||
      !['x', 'y', 'w', 'h'].every(key => Number.isSafeInteger(glyph[key]) && glyph[key] >= 0) ||
      ['offX', 'offY', 'sourceW', 'sourceH'].some(key => key in glyph && !Number.isSafeInteger(glyph[key])) ||
      (glyph.xadvance && glyph.xadvance !== (glyph.sourceW ?? glyph.w))
    )
      throw new RangeError('Unsupported bitmap-font glyph metrics: ' + character);
  }
}
export function bitmapFontResources(sdk) {
  const fonts = new WeakMap();
  return {
    async load(source, imageUrl, openImage) {
      if (!sdk.parseBitmapFont || !sdk.createBitmapText)
        throw Object.assign(new Error('Build the browser engine with --with bitmapfont.'), {
          code: 'LEGACY_BITMAP_FONT_PROFILE_REQUIRED'
        });
      validateClassicBitmapFont(source);
      const font = sdk.parseBitmapFont(source);
      if (font.pages.length !== 1 || !source?.frames)
        throw new Error('The classic bitmap label expects a single Egret JSON font page.');
      const lease = await openImage(imageUrl);
      const value = Object.freeze({}),
        entry = { font, lease, listeners: new Set() };
      fonts.set(value, entry);
      return {
        value,
        dispose() {
          if (!fonts.delete(value)) return;
          try {
            for (const listener of entry.listeners) listener();
          } finally {
            entry.listeners.clear();
            lease.release();
          }
        }
      };
    },
    open(value, options, retire) {
      const entry = fonts.get(value);
      if (!entry) throw new Error('Expected a live font acquired through RES.');
      const text = sdk.createBitmapText({ ...options, font: entry.font, pages: [entry.lease], fallback: null });
      entry.listeners.add(retire);
      return {
        text,
        dispose() {
          entry.listeners.delete(retire);
          text.dispose();
        }
      };
    }
  };
}
export function bitmapLabelClass(Base, RES, fonts, observe, invalidate, layoutSize) {
  return class BitmapLabel extends Base {
    #text = '';
    #source;
    #mounted = false;
    #version = 0;
    #active;
    #align = 'left';
    #vertical = 'top';
    #lineSpacing = 0;
    #letterSpacing = 0;
    #width;
    #height;
    constructor(text = '') {
      super();
      this.#text = String(text);
      this.addEventListener('addedToStage', this.#enter, this);
      this.addEventListener('removedFromStage', this.#leave, this);
    }
    // Layout uses the advance box, including transparent trim, rather than the ink bounds of its mesh.
    get width() {
      return layoutSize(this, 'width', () => this.#active?.text.width ?? 0);
    }
    set width(value) {
      super.width = value;
    }
    get height() {
      return layoutSize(this, 'height', () => this.#active?.text.height ?? 0);
    }
    set height(value) {
      super.height = value;
    }
    #enter() {
      this.#mounted = true;
      this.#refresh();
    }
    #leave() {
      this.#mounted = false;
      this.#version++;
      this.#drop();
    }
    #drop() {
      this.#active?.dispose();
      this.#active = undefined;
    }
    get font() {
      return this.#source;
    }
    set font(source) {
      if (this.#source === source && this.#active) return;
      this.#source = source;
      this.#refresh();
    }
    #refresh() {
      const version = ++this.#version;
      this.#drop();
      if (!this.#mounted || !this.#source) return;
      const source = this.#source;
      const install = value => {
        if (this.#version !== version || !this.#mounted || this.isDisposed) return;
        if (value == null) throw new Error('Unknown bitmap font: ' + source);
        const active = fonts.open(
          value,
          {
            text: this.#text,
            align: this.#align,
            maxWidth: this.#width,
            lineSpacing: this.#lineSpacing,
            letterSpacing: this.#letterSpacing
          },
          () => {
            this.#version++;
            this.#drop();
          }
        );
        this.#active = active;
        this.addChild(active.text.display);
        this.#place();
        invalidate(this);
      };
      if (typeof source !== 'string') {
        install(source);
        return;
      }
      const ready = RES.getRes(source);
      if (ready) install(ready);
      else
        observe(
          RES.getResAsync(source).then(install, error => {
            if (this.#version === version) throw error;
          })
        );
    }
    #place() {
      const view = this.#active?.text;
      if (!view) return;
      const extra = Math.max(0, (this.#height ?? 0) - view.height);
      view.display.y = this.#vertical === 'middle' ? Math.round(extra / 2) : this.#vertical === 'bottom' ? extra : 0;
    }
    setBitmapBox(width, height) {
      if (width !== this.#width) {
        this.#width = width;
        if (this.#active) this.#active.text.maxWidth = width;
      }
      this.#height = height;
      this.#place();
    }
    get text() {
      return this.#text;
    }
    set text(value) {
      this.#text = String(value ?? '');
      if (this.#active) {
        this.#active.text.text = this.#text;
        this.#place();
        invalidate(this);
      }
    }
    get textAlign() {
      return this.#align;
    }
    set textAlign(value) {
      if (!['left', 'center', 'right'].includes(value)) throw new RangeError('Invalid bitmap text alignment.');
      this.#align = value;
      if (this.#active) this.#active.text.align = value;
    }
    get verticalAlign() {
      return this.#vertical;
    }
    set verticalAlign(value) {
      if (!['top', 'middle', 'bottom'].includes(value)) throw new RangeError('Invalid bitmap text alignment.');
      this.#vertical = value;
      this.#place();
    }
    get lineSpacing() {
      return this.#lineSpacing;
    }
    set lineSpacing(value) {
      if (!Number.isFinite(value)) throw new TypeError('Expected finite spacing.');
      this.#lineSpacing = value;
      if (this.#active) {
        this.#active.text.lineSpacing = value;
        this.#place();
      }
    }
    get letterSpacing() {
      return this.#letterSpacing;
    }
    set letterSpacing(value) {
      if (!Number.isFinite(value)) throw new TypeError('Expected finite spacing.');
      this.#letterSpacing = value;
      if (this.#active) this.#active.text.letterSpacing = value;
    }
    dispose() {
      this.#leave();
      super.dispose();
    }
  };
}
