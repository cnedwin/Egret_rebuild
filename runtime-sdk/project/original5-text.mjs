// SPDX-License-Identifier: Apache-2.0
import { Bitmap } from '@egret/engine';

const rgb = value => '#' + Number(value).toString(16).padStart(6, '0');
const available = value => Number.isFinite(value) && value >= 0;

export function original5TextLayout(field, fixedWidth, fixedHeight, firstLine = 1) {
  // The customer's own 5.x line breaker measures words and selects all break positions.
  const lines = field.$getLinesArr2();
  const textWidth = lines.reduce((w, line) => Math.max(w, line.width), 0);
  const spacing = field.lineSpacing;
  const textHeight = Math.max(0, lines.reduce((h, line) => h + line.height, 0) +
    Math.max(0, lines.length - 1) * spacing);
  const width = available(fixedWidth) ? fixedWidth : textWidth;
  const height = available(fixedHeight) ? fixedHeight : textHeight;
  const spare = Math.max(0, height - textHeight);
  let top = field.verticalAlign === 'middle' ? spare / 2 : field.verticalAlign === 'bottom' ? spare : 0;
  const runs = [];
  for (const line of lines.slice(Math.max(0, firstLine - 1))) {
    if (top >= height) break;
    const left = Math.max(0, width - line.width);
    let x = field.textAlign === 'center' ? left / 2 : field.textAlign === 'right' ? left : 0;
    for (const item of line.elements) {
      const style = item.style ?? {};
      if (style.underline || style.href) throw new Error('Original 5 native rich text link/underline is unsupported');
      const size = style.size ?? field.size;
      if (item.text && item.width > 0) runs.push({
        text:item.text, size, fontFamily:style.fontFamily || field.fontFamily || 'sans-serif',
        weight:(style.bold ?? field.bold) ? 700 : 400, italic:!!(style.italic ?? field.italic),
        color:rgb(style.textColor ?? field.textColor), strokeWidth:style.stroke ?? field.stroke,
        strokeColor:rgb(style.strokeColor ?? field.strokeColor), x, y:top + (line.height - size) / 2,
        maxWidth:Math.ceil(item.width)
      });
      x += item.width;
    }
    top += line.height + spacing;
  }
  return {textWidth,textHeight,width,height,runs};
}

/** Attach real 5.x TextFields to the native host's measured, leased text pages. */
export function installOriginal5Text(egret, services, display) {
  const {raster} = services;
  const {api} = display;
  const original = api.NativeDisplayObject;
  const proto = egret.TextField.prototype;
  const dirty = new Set(), resident = new Set(), ready = new Map(), retiring = new Set();
  const ids = new Map();
  const forgotten = new FinalizationRegistry(id => ids.delete(id));
  let closed = false, failure;
  egret.sys.measureText = (text,fontFamily,size,bold,italic) =>
    raster.measureText([{text,fontFamily,size,weight:bold ? 700 : 400,italic:!!italic}])[0];

  function layout(node) {
    return original5TextLayout(node.field, node.fieldWidth, node.fieldHeight, node.firstLine);
  }
  function change(node) {
    if (!closed) { node.revision++; dirty.add(node); }
  }
  function drop(node) {
    dirty.delete(node);
    resident.delete(node);
    node.revision++;
    if (node.picture) {
      node.content.removeChild(node.picture);
      node.picture.dispose();
      node.picture = undefined;
    }
    // A returned frame can still be crossing the V8/Java bridge. The next
    // synchronous capture starts only after its page snapshot has been taken.
    if (node.textLease) retiring.add(node.textLease);
    node.textLease = undefined;
    ready.get(node)?.lease.release();
    ready.delete(node);
  }
  async function paint(node) {
    const revision = node.revision;
    if (!node.field?.stage) { drop(node); return; }
    const {width,height,runs} = layout(node);
    // The field paints its box before its child glyph bitmap, even when the string is empty.
    const {background, backgroundColor, border, borderColor} = node.field;
    if (background || border || node.decorated) {
      const graphics = node.content.graphics;
      graphics.clear();
      node.decorated = !!(background || border);
      if (width > 0 && height > 0) {
        if (background) graphics.beginFill(backgroundColor).drawRect(0, 0, width, height).endFill();
        if (border) {
          const dx = Math.min(1, width), dy = Math.min(1, height);
          graphics.beginFill(borderColor).drawRect(0, 0, width, dy);
          if (height > dy) graphics.drawRect(0, height - dy, width, dy);
          if (height > 2 * dy) {
            graphics.drawRect(0, dy, dx, height - 2 * dy);
            if (width > dx) graphics.drawRect(width - dx, dy, dx, height - 2 * dy);
          }
          graphics.endFill();
        }
      }
    }
    if (!runs.length || width <= 0 || height <= 0) { drop(node); return; }
    const lease = await raster.acquireText(Math.ceil(width),Math.ceil(height),runs);
    if (closed || revision !== node.revision || !node.field.stage) { lease.release(); return; }
    ready.get(node)?.lease.release();
    ready.set(node,{revision,lease});
  }
  function commit(node, {revision,lease}) {
    if (revision !== node.revision || !node.field.stage) { lease.release(); return; }
    try {
      if (node.picture) node.picture.textureLease = lease;
      else node.picture = node.content.addChild(new Bitmap(lease));
    } catch (error) { lease.release(); throw error; }
    node.textLease?.release();
    node.textLease = lease;
    resident.add(node);
  }
  class DisplayWithText extends original {
    constructor(kind) {
      super(kind === 7 ? 0 : kind);
      if (kind === 7) {
        this.revision = 0;
        ids.set(this.id,new WeakRef(this));
        forgotten.register(this,this.id);
      }
    }
    setTextFieldWidth(value) { this.fieldWidth = value; change(this); }
    setTextFieldHeight(value) { this.fieldHeight = value; change(this); }
    setScrollV(value) { this.firstLine = Math.max(1, Math.trunc(value)); change(this); }
    setType(value) {
      if (value !== 'dynamic' && value !== 'input') throw new Error('Unsupported original 5 text field type');
    }
    setBorder() { change(this); }
    setBackground() { change(this); }
    setBorderColor() { change(this); }
    setBackgroundColor() { change(this); }
    static disposeTextData(field) { if (field.$nativeDisplayObject) drop(field.$nativeDisplayObject); }
  }
  // The JS field retains the actual values. A mutation only invalidates the native copy.
  for (const method of ['setFontFamily','setFontSize','setBold','setItalic','setTextAlign','setVerticalAlign',
    'setLineSpacing','setTextColor','setWordWrap','setText','setTextFlow','setStroke','setStrokeColor',
    'setMultiline','setMaxChars','setInputType','setIsTyping']) {
    Object.defineProperty(DisplayWithText.prototype,method,{value() { change(this); }});
  }
  api.NativeDisplayObject = DisplayWithText;
  for (const [method,key] of Object.entries({
    nrGetTextFieldWidth:'width',nrGetTextFieldHeight:'height',nrGetTextWidth:'textWidth',nrGetTextHeight:'textHeight'
  })) {
    api[method] = id => {
      const node = ids.get(id)?.deref();
      if (!node?.field || closed) throw new Error('Unknown original 5 native text field');
      return layout(node)[key];
    };
  }
  const factory = proto.createNativeDisplayObject;
  proto.createNativeDisplayObject = function () {
    factory.call(this);
    this.$nativeDisplayObject.field = this;
  };
  const didAdd = proto.$onAddToStage, didRemove = proto.$onRemoveFromStage;
  proto.$onAddToStage = function (...args) {
    const value = didAdd.apply(this,args);
    change(this.$nativeDisplayObject);
    return value;
  };
  proto.$onRemoveFromStage = function (...args) {
    try { return didRemove.apply(this,args); } finally { drop(this.$nativeDisplayObject); }
  };
  return {
    flush() {
      if (failure) throw failure;
      // Commit page changes and command capture in one JS turn. A promise
      // continuation may finish between returning command bytes and JNI copying them.
      for (const lease of retiring) { retiring.delete(lease); lease.release(); }
      for (const [node, candidate] of ready) {
        ready.delete(node);
        commit(node, candidate);
      }
      for (const node of dirty) {
        dirty.delete(node);
        const revision = node.revision;
        void paint(node).catch(error => {
          if (!closed && revision === node.revision) failure ??= error;
        });
      }
    },
    close() {
      if (closed) return;
      closed = true;
      for (const node of resident) drop(node);
      for (const candidate of ready.values()) candidate.lease.release();
      ready.clear();
      for (const lease of retiring) lease.release();
      retiring.clear();
      dirty.clear();
      ids.clear();
      proto.$onAddToStage = didAdd;
      proto.$onRemoveFromStage = didRemove;
      proto.createNativeDisplayObject = factory;
    }
  };
}
