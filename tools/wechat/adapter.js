// SPDX-License-Identifier: Apache-2.0
// The page a browser game expects, made from what a WeChat mini game has. A mini game has `wx` and the ECMAScript
// built-ins, a screen canvas, timers and requestAnimationFrame, and nothing of a page: no window, no document, no
// fetch, no Image, no localStorage, no pointer events. This script, run first in game.js, puts on the game's global
// (GameGlobal) a small window and document whose canvases are wx canvases, whose pointer events come from wx touches,
// whose files are the package's files, whose storage is wx storage and whose sound is wx's Web Audio. The game's code
// is then run with these names bound to these objects, and to nothing else. It is plain ES2017, for every WeChat.
/* eslint-disable */
var installEgretWechatAdapter = function (G, page) {
  'use strict';
  var wx = G.wx;
  var ORIGIN = 'https://game.local/';
  var info = wx.getSystemInfoSync();
  var size = { width: info.windowWidth, height: info.windowHeight };
  var ratio = info.pixelRatio || 1;

  // ---- time -------------------------------------------------------------------------------------------------------
  // wx.getPerformance().now() counts microseconds; a page's performance.now() counts milliseconds.
  var clock =
    G.performance && typeof G.performance.now === 'function'
      ? G.performance
      : typeof wx.getPerformance === 'function'
        ? (function (p) {
            return { now: function () { return p.now() / 1000; } };
          })(wx.getPerformance())
        : { now: function () { return Date.now(); } };
  var performance = {
    now: function () { return clock.now(); },
    mark: function () {},
    measure: function () {},
    getEntriesByName: function () { return []; },
    timeOrigin: Date.now()
  };
  if (typeof G.queueMicrotask !== 'function')
    G.queueMicrotask = function (callback) { Promise.resolve().then(callback); };

  // ---- text ---------------------------------------------------------------------------------------------------------
  function TextEncoderShim() {}
  TextEncoderShim.prototype.encode = function (text) {
    text = String(text === undefined ? '' : text);
    var out = [];
    for (var i = 0; i < text.length; i++) {
      var c = text.codePointAt(i);
      if (c > 0xffff) i++;
      if (c < 0x80) out.push(c);
      else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
      else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
      else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    }
    return new Uint8Array(out);
  };
  TextEncoderShim.prototype.encoding = 'utf-8';
  function TextDecoderShim() {}
  TextDecoderShim.prototype.decode = function (input) {
    if (input === undefined) return '';
    var bytes = input instanceof Uint8Array ? input : ArrayBuffer.isView(input) ? new Uint8Array(input.buffer, input.byteOffset, input.byteLength) : new Uint8Array(input);
    var out = '', i = 0;
    if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) i = 3;
    while (i < bytes.length) {
      var b = bytes[i++], c;
      if (b < 0x80) c = b;
      else if (b < 0xe0) c = ((b & 31) << 6) | (bytes[i++] & 63);
      else if (b < 0xf0) c = ((b & 15) << 12) | ((bytes[i++] & 63) << 6) | (bytes[i++] & 63);
      else c = ((b & 7) << 18) | ((bytes[i++] & 63) << 12) | ((bytes[i++] & 63) << 6) | (bytes[i++] & 63);
      out += String.fromCodePoint(c);
    }
    return out;
  };
  TextDecoderShim.prototype.encoding = 'utf-8';
  var TextEncoder = typeof G.TextEncoder === 'function' ? G.TextEncoder : TextEncoderShim;
  var TextDecoder = typeof G.TextDecoder === 'function' ? G.TextDecoder : TextDecoderShim;

  // ---- addresses ----------------------------------------------------------------------------------------------------
  // Files of the package are named as if served from https://game.local/, so `new URL('../x.json', import.meta.url)`
  // works as on a page; fetch and images map that origin back to the package's paths.
  function SearchParams(init) {
    this._list = [];
    var text = typeof init === 'string' ? init.replace(/^\?/, '') : '';
    if (text)
      for (var part of text.split('&')) {
        if (!part) continue;
        var at = part.indexOf('=');
        var key = at < 0 ? part : part.slice(0, at), value = at < 0 ? '' : part.slice(at + 1);
        this._list.push([decodeURIComponent(key.replace(/\+/g, ' ')), decodeURIComponent(value.replace(/\+/g, ' '))]);
      }
    else if (init && typeof init === 'object')
      for (var k of Object.keys(init)) this._list.push([k, String(init[k])]);
  }
  SearchParams.prototype.get = function (key) {
    for (var e of this._list) if (e[0] === key) return e[1];
    return null;
  };
  SearchParams.prototype.getAll = function (key) { return this._list.filter(function (e) { return e[0] === key; }).map(function (e) { return e[1]; }); };
  SearchParams.prototype.has = function (key) { return this._list.some(function (e) { return e[0] === key; }); };
  SearchParams.prototype.set = function (key, value) { this.delete(key); this._list.push([key, String(value)]); };
  SearchParams.prototype.append = function (key, value) { this._list.push([key, String(value)]); };
  SearchParams.prototype.delete = function (key) { this._list = this._list.filter(function (e) { return e[0] !== key; }); };
  SearchParams.prototype.forEach = function (fn) { this._list.forEach(function (e) { fn(e[1], e[0]); }); };
  SearchParams.prototype.entries = function () { return this._list.map(function (e) { return [e[0], e[1]]; })[Symbol.iterator](); };
  SearchParams.prototype[Symbol.iterator] = SearchParams.prototype.entries;
  SearchParams.prototype.toString = function () {
    return this._list.map(function (e) { return encodeURIComponent(e[0]) + '=' + encodeURIComponent(e[1]); }).join('&');
  };
  function normalizePath(path) {
    var out = [];
    for (var part of path.split('/')) {
      if (part === '..') out.pop();
      else if (part !== '.') out.push(part);
    }
    return out.join('/');
  }
  function Address(href, base) {
    href = String(href);
    var m = /^([a-zA-Z][a-zA-Z0-9+.-]*:)(.*)$/.exec(href);
    if (!m) {
      if (base === undefined) throw new TypeError('Invalid URL: ' + href);
      var b = base instanceof Address ? base : new Address(base);
      var origin = b.protocol + '//' + b.host;
      if (href.startsWith('//')) href = b.protocol + href;
      else if (href.startsWith('/')) href = origin + href;
      else if (href.startsWith('?')) href = origin + b.pathname + href;
      else if (href.startsWith('#')) href = origin + b.pathname + b.search + href;
      else href = origin + b.pathname.replace(/[^/]*$/, '') + href;
      m = /^([a-zA-Z][a-zA-Z0-9+.-]*:)(.*)$/.exec(href);
    }
    this.protocol = m[1].toLowerCase();
    var rest = m[2], hash = '', search = '';
    var h = rest.indexOf('#');
    if (h >= 0) { hash = rest.slice(h); rest = rest.slice(0, h); }
    var q = rest.indexOf('?');
    if (q >= 0) { search = rest.slice(q); rest = rest.slice(0, q); }
    if (rest.startsWith('//')) {
      var slash = rest.indexOf('/', 2);
      this.host = slash < 0 ? rest.slice(2) : rest.slice(2, slash);
      rest = slash < 0 ? '/' : rest.slice(slash);
    } else this.host = '';
    this.hostname = this.host.replace(/:\d+$/, '');
    this.port = (/:(\d+)$/.exec(this.host) || [])[1] || '';
    this.pathname = this.host ? '/' + normalizePath(rest.replace(/^\//, '')) : rest;
    this.search = search === '?' ? '' : search;
    this.hash = hash === '#' ? '' : hash;
    this.origin = this.host ? this.protocol + '//' + this.host : 'null';
    this.searchParams = new SearchParams(this.search);
  }
  Object.defineProperty(Address.prototype, 'href', {
    get: function () { return (this.host ? this.protocol + '//' + this.host : this.protocol) + this.pathname + this.search + this.hash; }
  });
  Address.prototype.toString = function () { return this.href; };
  Address.prototype.toJSON = function () { return this.href; };
  Address.createObjectURL = function () { throw new Error('URL.createObjectURL is not available in a WeChat mini game'); };
  Address.revokeObjectURL = function () {};
  var URL = typeof G.URL === 'function' ? G.URL : Address;
  var URLSearchParams = typeof G.URLSearchParams === 'function' ? G.URLSearchParams : SearchParams;
  var launch = typeof wx.getLaunchOptionsSync === 'function' ? wx.getLaunchOptionsSync() : {};
  var location = new Address(ORIGIN + 'index.html' + (launch && launch.query && Object.keys(launch.query).length ? '?' + new SearchParams(launch.query).toString() : ''));
  location.reload = function () { if (typeof wx.restartMiniProgram === 'function') wx.restartMiniProgram({}); };
  location.assign = location.replace = function () {};
  /** The package path of an address, or undefined when it is not a file of the package. */
  // Files the export wrote in another format (a .webp as a .jpg, say) are found under their new names.
  var renamed = (page && page.renamed) || {};
  function packagePath(url) {
    var href = String(url instanceof Address || (url && url.href) ? url.href : url), path;
    if (href.startsWith(ORIGIN)) path = decodeURIComponent(href.slice(ORIGIN.length).replace(/[?#].*$/, ''));
    else if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(href)) path = normalizePath(href.replace(/^\.?\//, '').replace(/[?#].*$/, ''));
    else return undefined;
    return Object.prototype.hasOwnProperty.call(renamed, path) ? renamed[path] : path;
  }

  // ---- events -------------------------------------------------------------------------------------------------------
  // Classes as a page has them, with their properties as accessors on the prototypes: the engine's input reads
  // `Object.getOwnPropertyDescriptor(PointerEvent.prototype, 'pointerId').get` rather than trust an object's own fields.
  function accessors(Class, names, store) {
    for (var name of names)
      (function (name) {
        Object.defineProperty(Class.prototype, name, {
          get: function () { return this[store][name]; },
          set: function (v) { this[store][name] = v; },
          configurable: true,
          enumerable: true
        });
      })(name);
  }
  class EventTarget {
    constructor() { Object.defineProperty(this, '_listeners', { value: Object.create(null), writable: true }); }
    addEventListener(type, fn, options) {
      if (!fn) return;
      if (!this._listeners) Object.defineProperty(this, '_listeners', { value: Object.create(null), writable: true });
      var list = this._listeners[type] || (this._listeners[type] = []);
      var capture = options === true || !!(options && options.capture);
      for (var e of list) if (e.fn === fn && e.capture === capture) return;
      list.push({ fn: fn, capture: capture, once: !!(options && options.once) });
      var self = this;
      if (options && options.signal && typeof options.signal.addEventListener === 'function')
        options.signal.addEventListener('abort', function () { self.removeEventListener(type, fn, options); });
    }
    removeEventListener(type, fn, options) {
      var list = this._listeners && this._listeners[type];
      if (!list) return;
      var capture = options === true || !!(options && options.capture);
      for (var i = 0; i < list.length; i++) if (list[i].fn === fn && list[i].capture === capture) { list.splice(i, 1); return; }
    }
    dispatchEvent(event) {
      var state = event._state;
      if (!state.target) state.target = this;
      // From the window down to the target for listeners that capture, then the target, then up again.
      var path = [];
      for (var at = this; at; at = parentOf(at)) path.push(at);
      for (var i = path.length - 1; i > 0 && !state.stop; i--) fire(path[i], event, true);
      if (!state.stop) fire(this, event, false);
      if (state.bubbles) for (var j = 1; j < path.length && !state.stop; j++) fire(path[j], event, false);
      state.currentTarget = null;
      return !state.defaultPrevented;
    }
  }
  function parentOf(node) {
    if (node === window) return null;
    if (node === document) return window;
    return node._node ? node._node.parent : null;
  }
  function fire(target, event, capturing) {
    var state = event._state, list = target._listeners && target._listeners[state.type];
    state.currentTarget = target;
    if (list)
      for (var entry of list.slice()) {
        if (entry.capture !== capturing && target !== state.target) continue;
        if (entry.once) target.removeEventListener(state.type, entry.fn, entry);
        if (typeof entry.fn === 'function') entry.fn.call(target, event);
        else entry.fn.handleEvent(event);
        if (state.stopNow) return;
      }
    var handler = target['on' + state.type];
    if (!capturing && typeof handler === 'function') handler.call(target, event);
  }
  class Event {
    constructor(type, init) {
      var state = { type: String(type), bubbles: false, cancelable: false, composed: false, target: null, currentTarget: null, defaultPrevented: false, timeStamp: performance.now(), stop: false, stopNow: false, isTrusted: true };
      if (init) for (var k in init) state[k] = init[k];
      Object.defineProperty(this, '_state', { value: state });
    }
    preventDefault() { if (this._state.cancelable) this._state.defaultPrevented = true; }
    stopPropagation() { this._state.stop = true; }
    stopImmediatePropagation() { this._state.stop = true; this._state.stopNow = true; }
    composedPath() { var path = []; for (var at = this._state.target; at; at = parentOf(at)) path.push(at); return path; }
  }
  accessors(Event, ['type', 'bubbles', 'cancelable', 'composed', 'target', 'currentTarget', 'defaultPrevented', 'timeStamp', 'isTrusted', 'detail', 'error', 'message'], '_state');
  Object.defineProperty(Event.prototype, 'srcElement', { get: function () { return this._state.target; } });
  class UIEvent extends Event {}
  accessors(UIEvent, ['view', 'which'], '_state');
  class MouseEvent extends UIEvent {}
  accessors(MouseEvent, ['clientX', 'clientY', 'pageX', 'pageY', 'screenX', 'screenY', 'offsetX', 'offsetY', 'x', 'y', 'movementX', 'movementY', 'button', 'buttons', 'altKey', 'ctrlKey', 'metaKey', 'shiftKey', 'relatedTarget'], '_state');
  MouseEvent.prototype.getModifierState = function () { return false; };
  class PointerEvent extends MouseEvent {
    getCoalescedEvents() { return [this]; }
    getPredictedEvents() { return []; }
  }
  accessors(PointerEvent, ['pointerId', 'pointerType', 'isPrimary', 'pressure', 'tangentialPressure', 'width', 'height', 'tiltX', 'tiltY', 'twist', 'altitudeAngle', 'azimuthAngle'], '_state');
  class WheelEvent extends MouseEvent {}
  accessors(WheelEvent, ['deltaX', 'deltaY', 'deltaZ', 'deltaMode'], '_state');
  class KeyboardEvent extends UIEvent { getModifierState() { return false; } }
  accessors(KeyboardEvent, ['key', 'code', 'location', 'repeat', 'isComposing', 'altKey', 'ctrlKey', 'metaKey', 'shiftKey', 'keyCode', 'charCode'], '_state');
  class FocusEvent extends UIEvent {}
  accessors(FocusEvent, ['relatedTarget'], '_state');
  class TouchEvent extends UIEvent {}
  accessors(TouchEvent, ['touches', 'changedTouches', 'targetTouches'], '_state');
  class InputEvent extends UIEvent {}
  accessors(InputEvent, ['data', 'inputType', 'isComposing'], '_state');
  class CustomEvent extends Event {}
  class AbortSignal extends EventTarget {
    constructor() { super(); this.aborted = false; this.reason = undefined; }
    throwIfAborted() { if (this.aborted) throw this.reason; }
  }
  class AbortController {
    constructor() { this.signal = new AbortSignal(); }
    abort(reason) {
      if (this.signal.aborted) return;
      this.signal.aborted = true;
      this.signal.reason = reason === undefined ? new Error('aborted') : reason;
      this.signal.dispatchEvent(new Event('abort'));
    }
  }

  // ---- elements -----------------------------------------------------------------------------------------------------
  class DOMRectReadOnly {
    constructor(x, y, width, height) { Object.defineProperty(this, '_r', { value: { x: x || 0, y: y || 0, width: width || 0, height: height || 0 } }); }
    get x() { return this._r.x; }
    get y() { return this._r.y; }
    get width() { return this._r.width; }
    get height() { return this._r.height; }
    get left() { return Math.min(this._r.x, this._r.x + this._r.width); }
    get top() { return Math.min(this._r.y, this._r.y + this._r.height); }
    get right() { return Math.max(this._r.x, this._r.x + this._r.width); }
    get bottom() { return Math.max(this._r.y, this._r.y + this._r.height); }
    toJSON() { return { x: this.x, y: this.y, width: this.width, height: this.height, left: this.left, top: this.top, right: this.right, bottom: this.bottom }; }
  }
  class DOMRect extends DOMRectReadOnly {}
  function camel(name) { return String(name).replace(/-([a-z])/g, function (_, c) { return c.toUpperCase(); }); }
  // A style is a plain bag of properties; the methods read and write it by either spelling.
  class CSSStyleDeclaration {
    getPropertyValue(name) { var v = this[camel(name)]; return v === undefined || v === null ? '' : String(v); }
    getPropertyPriority() { return ''; }
    setProperty(name, value) { this[camel(name)] = value === null ? '' : String(value); }
    removeProperty(name) { var key = camel(name), v = this.getPropertyValue(name); delete this[key]; return v; }
    get cssText() { return ''; }
    // Each declaration of the text is set as its property, so a game that styles an element in one line reads the
    // values back.
    set cssText(v) {
      for (var part of String(v).split(';')) {
        var at = part.indexOf(':');
        if (at > 0) this.setProperty(part.slice(0, at).trim(), part.slice(at + 1).trim());
      }
    }
  }
  // What a mini game's screen computes to: no transform, no zoom, no padding or border; the canvas fills the screen.
  var COMPUTED = {
    display: 'block', visibility: 'visible', position: 'static', transform: 'none', rotate: 'none', scale: 'none',
    translate: 'none', perspective: 'none', zoom: '1', objectFit: 'fill', opacity: '1', pointerEvents: 'auto',
    touchAction: 'none', paddingTop: '0px', paddingRight: '0px', paddingBottom: '0px', paddingLeft: '0px',
    borderTopWidth: '0px', borderRightWidth: '0px', borderBottomWidth: '0px', borderLeftWidth: '0px',
    marginTop: '0px', marginRight: '0px', marginBottom: '0px', marginLeft: '0px', direction: 'ltr', writingMode: 'horizontal-tb',
    fontSize: '16px', fontFamily: 'sans-serif', lineHeight: 'normal', color: 'rgb(0, 0, 0)', boxSizing: 'content-box'
  };
  class ClassList {
    constructor() { this._set = []; }
    add() { for (var c of arguments) if (this._set.indexOf(c) < 0) this._set.push(c); }
    remove() { for (var c of arguments) { var i = this._set.indexOf(c); if (i >= 0) this._set.splice(i, 1); } }
    contains(c) { return this._set.indexOf(c) >= 0; }
    toggle(c, force) { var on = force === undefined ? !this.contains(c) : force; if (on) this.add(c); else this.remove(c); return on; }
    replace(a, b) { if (!this.contains(a)) return false; this.remove(a); this.add(b); return true; }
    get length() { return this._set.length; }
    item(i) { return this._set[i] || null; }
    toString() { return this._set.join(' '); }
  }
  class Node extends EventTarget {
    constructor(type, name) {
      super();
      Object.defineProperty(this, '_node', { value: { type: type, name: name, parent: null, children: [], text: '' } });
    }
    get nodeType() { return this._node.type; }
    get nodeName() { return this._node.name; }
    get parentNode() { return this._node.parent; }
    get parentElement() { var p = this._node.parent; return p && p._node.type === 1 ? p : null; }
    get childNodes() { return this._node.children.slice(); }
    get firstChild() { return this._node.children[0] || null; }
    get lastChild() { return this._node.children[this._node.children.length - 1] || null; }
    get nextSibling() { var p = this._node.parent; if (!p) return null; var list = p._node.children; return list[list.indexOf(this) + 1] || null; }
    get previousSibling() { var p = this._node.parent; if (!p) return null; var list = p._node.children; return list[list.indexOf(this) - 1] || null; }
    get ownerDocument() { return this === document ? null : document; }
    get isConnected() { for (var at = this; at; at = at._node.parent) if (at === document) return true; return false; }
    get textContent() { return this._node.text + this._node.children.map(function (n) { return n.textContent || ''; }).join(''); }
    set textContent(v) { for (var c of this._node.children.slice()) this.removeChild(c); this._node.text = v === null || v === undefined ? '' : String(v); }
    appendChild(child) {
      if (child._node.type === 11) { for (var c of child._node.children.slice()) this.appendChild(c); return child; }
      if (child._node.parent) child._node.parent.removeChild(child);
      child._node.parent = this;
      this._node.children.push(child);
      return child;
    }
    insertBefore(child, before) {
      if (!before) return this.appendChild(child);
      if (child._node.parent) child._node.parent.removeChild(child);
      child._node.parent = this;
      var i = this._node.children.indexOf(before);
      if (i < 0) this._node.children.push(child); else this._node.children.splice(i, 0, child);
      return child;
    }
    removeChild(child) { var i = this._node.children.indexOf(child); if (i >= 0) this._node.children.splice(i, 1); child._node.parent = null; return child; }
    replaceChild(next, old) { this.insertBefore(next, old); return this.removeChild(old); }
    contains(other) { for (var at = other; at; at = at._node.parent) if (at === this) return true; return false; }
    hasChildNodes() { return this._node.children.length > 0; }
    getRootNode() { var at = this; while (at._node.parent) at = at._node.parent; return at; }
  }
  class Text extends Node {
    constructor(text) { super(3, '#text'); this._node.text = String(text); }
    get data() { return this._node.text; }
    set data(v) { this._node.text = String(v); }
    remove() { if (this._node.parent) this._node.parent.removeChild(this); }
  }
  function matches(element, selector) {
    selector = selector.trim();
    if (selector.indexOf(',') >= 0) return selector.split(',').some(function (s) { return matches(element, s); });
    var last = selector.split(/\s+/).pop();
    var m = /^([a-zA-Z0-9-]*|\*)((?:[#.][\w-]+|\[[^\]]+\])*)$/.exec(last);
    if (!m) return false;
    if (m[1] && m[1] !== '*' && m[1].toLowerCase() !== element.localName) return false;
    for (var p of m[2].match(/[#.][\w-]+|\[[^\]]+\]/g) || []) {
      if (p[0] === '#' && element.id !== p.slice(1)) return false;
      if (p[0] === '.' && !element.classList.contains(p.slice(1))) return false;
      if (p[0] === '[') {
        var a = /^\[([\w-]+)(?:=["']?([^"'\]]*)["']?)?\]$/.exec(p);
        if (!a) return false;
        var have = element.getAttribute(a[1]);
        if (have === null) return false;
        if (a[2] !== undefined && have !== a[2]) return false;
      }
    }
    return true;
  }
  function walk(root, out, selector, one) {
    for (var child of root._node.children) {
      if (child._node.type !== 1) continue;
      if (matches(child, selector)) { out.push(child); if (one) return true; }
      if (walk(child, out, selector, one)) return true;
    }
    return false;
  }
  var datasetHandler = {
    get: function (el, key) { var v = el.getAttribute('data-' + String(key).replace(/[A-Z]/g, function (c) { return '-' + c.toLowerCase(); })); return v === null ? undefined : v; },
    set: function (el, key, value) { el.setAttribute('data-' + String(key).replace(/[A-Z]/g, function (c) { return '-' + c.toLowerCase(); }), value); return true; },
    deleteProperty: function (el, key) { el.removeAttribute('data-' + String(key).replace(/[A-Z]/g, function (c) { return '-' + c.toLowerCase(); })); return true; }
  };
  class Element extends Node {
    constructor(tag) {
      super(1, String(tag).toUpperCase());
      Object.defineProperty(this, '_element', { value: { local: String(tag).toLowerCase(), attributes: Object.create(null), classList: new ClassList(), html: '' } });
      Object.defineProperty(this, 'dataset', { value: new Proxy(this, datasetHandler), enumerable: true });
    }
    get tagName() { return this._node.name; }
    get localName() { return this._element.local; }
    get id() { return this.getAttribute('id') || ''; }
    set id(v) { this.setAttribute('id', v); }
    get className() { return this._element.classList.toString(); }
    set className(v) { this._element.classList._set = String(v).split(/\s+/).filter(Boolean); }
    get classList() { return this._element.classList; }
    get children() { return this._node.children.filter(function (n) { return n._node.type === 1; }); }
    get childElementCount() { return this.children.length; }
    get firstElementChild() { return this.children[0] || null; }
    get lastElementChild() { var c = this.children; return c[c.length - 1] || null; }
    get innerHTML() { return this._element.html; }
    set innerHTML(v) { this.textContent = ''; this._element.html = String(v); }
    get outerHTML() { return '<' + this.localName + '>' + this._element.html + '</' + this.localName + '>'; }
    get clientWidth() { return size.width; }
    get clientHeight() { return size.height; }
    get clientLeft() { return 0; }
    get clientTop() { return 0; }
    get scrollWidth() { return size.width; }
    get scrollHeight() { return size.height; }
    get scrollTop() { return 0; }
    set scrollTop(v) {}
    get scrollLeft() { return 0; }
    set scrollLeft(v) {}
    setAttribute(k, v) {
      k = String(k).toLowerCase();
      this._element.attributes[k] = String(v);
      if (k === 'class') this.className = v;
    }
    getAttribute(k) {
      k = String(k).toLowerCase();
      if (k === 'class') return this._element.classList._set.length ? this.className : k in this._element.attributes ? '' : null;
      return k in this._element.attributes ? this._element.attributes[k] : null;
    }
    hasAttribute(k) { return String(k).toLowerCase() in this._element.attributes; }
    removeAttribute(k) { k = String(k).toLowerCase(); delete this._element.attributes[k]; if (k === 'class') this._element.classList._set = []; }
    toggleAttribute(k, force) { var on = force === undefined ? !this.hasAttribute(k) : force; if (on) this.setAttribute(k, ''); else this.removeAttribute(k); return on; }
    getAttributeNames() { return Object.keys(this._element.attributes); }
    append() { for (var c of arguments) this.appendChild(typeof c === 'string' ? new Text(c) : c); }
    prepend() { var first = this.firstChild; for (var c of arguments) this.insertBefore(typeof c === 'string' ? new Text(c) : c, first); }
    before() { var p = this._node.parent; if (p) for (var c of arguments) p.insertBefore(typeof c === 'string' ? new Text(c) : c, this); }
    after() { var p = this._node.parent; if (!p) return; var next = this.nextSibling; for (var c of arguments) p.insertBefore(typeof c === 'string' ? new Text(c) : c, next); }
    replaceChildren() { for (var c of this._node.children.slice()) this.removeChild(c); this.append.apply(this, arguments); }
    replaceWith(other) { var p = this._node.parent; if (p) { p.insertBefore(other, this); p.removeChild(this); } }
    remove() { if (this._node.parent) this._node.parent.removeChild(this); }
    cloneNode() { var copy = document.createElement(this.localName); for (var k in this._element.attributes) copy.setAttribute(k, this._element.attributes[k]); return copy; }
    getBoundingClientRect() { return new DOMRect(0, 0, size.width, size.height); }
    getClientRects() { return [this.getBoundingClientRect()]; }
    querySelector(selector) { var out = []; walk(this, out, selector, true); return out[0] || null; }
    querySelectorAll(selector) { var out = []; walk(this, out, selector, false); return out; }
    getElementsByTagName(tag) { return this.querySelectorAll(tag); }
    getElementsByClassName(name) { return this.querySelectorAll('.' + name); }
    matches(selector) { return matches(this, selector); }
    closest(selector) { for (var at = this; at && at._node.type === 1; at = at._node.parent) if (matches(at, selector)) return at; return null; }
    setPointerCapture() {}
    releasePointerCapture() {}
    hasPointerCapture() { return false; }
    scrollIntoView() {}
    scrollTo() {}
    animate() { return { cancel: function () {}, finish: function () {}, finished: Promise.resolve(), onfinish: null }; }
    attachShadow() { return document.createElement('div'); }
    insertAdjacentElement(where, el) { if (where === 'beforeend') this.appendChild(el); else if (where === 'afterbegin') this.insertBefore(el, this.firstChild); return el; }
    insertAdjacentHTML() {}
  }
  class HTMLElement extends Element {
    constructor(tag) {
      super(tag);
      Object.defineProperty(this, '_html', { value: { style: new CSSStyleDeclaration(), hidden: false, tabIndex: -1, title: '', lang: '', dir: '' } });
    }
    get style() { return this._html.style; }
    set style(v) { if (typeof v === 'string') this._html.style = new CSSStyleDeclaration(); }
    get hidden() { return this._html.hidden; }
    set hidden(v) { this._html.hidden = !!v; }
    get tabIndex() { return this._html.tabIndex; }
    set tabIndex(v) { this._html.tabIndex = Number(v); }
    get title() { return this._html.title; }
    set title(v) { this._html.title = String(v); }
    get lang() { return this._html.lang; }
    set lang(v) { this._html.lang = String(v); }
    get dir() { return this._html.dir; }
    set dir(v) { this._html.dir = String(v); }
    get innerText() { return this.textContent; }
    set innerText(v) { this.textContent = v; }
    get offsetWidth() { return size.width; }
    get offsetHeight() { return size.height; }
    get offsetLeft() { return 0; }
    get offsetTop() { return 0; }
    get offsetParent() { return this._node.parent; }
    focus() {
      var old = document._document.active;
      if (old === this) return;
      document._document.active = this;
      if (old && old !== this && old.dispatchEvent) old.dispatchEvent(new FocusEvent('blur', { relatedTarget: this }));
      this.dispatchEvent(new FocusEvent('focus', { relatedTarget: old }));
      this.dispatchEvent(new FocusEvent('focusin', { bubbles: true, relatedTarget: old }));
    }
    blur() {
      if (document._document.active !== this) return;
      document._document.active = document.body;
      this.dispatchEvent(new FocusEvent('blur'));
      this.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    }
    click() { this.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); }
  }

  // ---- canvases -----------------------------------------------------------------------------------------------------
  // The first wx canvas is the screen; every other is off the screen. A page may make any number of canvases and
  // draw a WebGL picture on whichever it likes: the first that asks for WebGL is given the screen's context, and the
  // others draw with 2D on canvases of their own. Canvases and images handed to WebGL or to drawImage are unwrapped to
  // the wx objects they stand for, and each context answers for the canvas the game made.
  var screen = G.__egretScreenCanvas || wx.createCanvas();
  var stage = null;
  function unwrapArguments(fn) {
    return function () {
      var args = Array.prototype.slice.call(arguments);
      for (var i = 0; i < args.length; i++) if (args[i] && typeof args[i]._backing === 'function') args[i] = args[i]._backing();
      return fn.apply(this, args);
    };
  }
  class HTMLCanvasElement extends HTMLElement {
    constructor() {
      super('canvas');
      Object.defineProperty(this, '_canvas', { value: { width: 300, height: 150, wx: null } });
    }
    get width() { return this._canvas.wx ? this._canvas.wx.width : this._canvas.width; }
    set width(v) { this._canvas.width = v >>> 0; if (this._canvas.wx) this._canvas.wx.width = this._canvas.width; }
    get height() { return this._canvas.wx ? this._canvas.wx.height : this._canvas.height; }
    set height(v) { this._canvas.height = v >>> 0; if (this._canvas.wx) this._canvas.wx.height = this._canvas.height; }
    _backing() {
      var c = this._canvas;
      if (!c.wx) {
        c.wx = wx.createCanvas();
        c.wx.width = c.width;
        c.wx.height = c.height;
      }
      return c.wx;
    }
    getContext(type, attributes) {
      if (type === 'webgpu' || type === 'bitmaprenderer') return null;
      var c = this._canvas;
      if (type === 'webgl2' || type === 'webgl' || type === 'experimental-webgl') {
        if (stage && stage !== this) return null;
        if (!c.wx) {
          stage = this;
          c.wx = screen;
          screen.width = c.width;
          screen.height = c.height;
        }
        var gl = c.wx.getContext(type, attributes);
        if (gl && !gl.__egret) {
          Object.defineProperty(gl, '__egret', { value: true });
          withBackdrop(gl);
          for (var name of ['texImage2D', 'texSubImage2D', 'texImage3D', 'texSubImage3D']) if (typeof gl[name] === 'function') gl[name] = unwrapArguments(gl[name]);
          try { Object.defineProperty(gl, 'canvas', { value: this, configurable: true }); } catch (e) {}
        }
        return gl;
      }
      var context = this._backing().getContext(type, attributes);
      if (context && type === '2d' && !context.__egret) {
        Object.defineProperty(context, '__egret', { value: true });
        context.drawImage = unwrapArguments(context.drawImage);
        if (typeof context.getContextAttributes !== 'function') context.getContextAttributes = function () { return { alpha: true, colorSpace: 'srgb', desynchronized: false, willReadFrequently: true }; };
        if (typeof context.createPattern === 'function') context.createPattern = unwrapArguments(context.createPattern);
        try { Object.defineProperty(context, 'canvas', { value: this, configurable: true }); } catch (e) {}
      }
      return context;
    }
    toDataURL() { var b = this._backing(); return b.toDataURL.apply(b, arguments); }
    toBlob(callback) { callback(null); }
    transferControlToOffscreen() { throw new Error('OffscreenCanvas is not available in a WeChat mini game'); }
    captureStream() { throw new Error('captureStream is not available in a WeChat mini game'); }
  }

  // ---- what lies under the screen canvas ---------------------------------------------------------------------------
  // On a page, elements under a transparent canvas show through it: a game may paint its scenery as an element's CSS
  // background and let the canvas clear to nothing. A mini game has one canvas and nothing under it. The backgrounds
  // of the elements that come before the stage are painted here onto a canvas of their own, as CSS would lay them
  // over the window, and drawn under what the game drew into the screen at the end of each frame in which it drew
  // there, as a page composites them. Colours, linear gradients and pictures (url, position, size, cover, contain) are painted; other values of
  // background are left out and named once on the console.
  function splitTop(text, separator) {
    var out = [], depth = 0, from = 0;
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (ch === '(') depth++;
      else if (ch === ')') depth--;
      else if (depth === 0 && (separator === ' ' ? /\s/.test(ch) : ch === separator)) {
        if (i > from) out.push(text.slice(from, i).trim());
        from = i + 1;
      }
    }
    if (from < text.length && text.slice(from).trim()) out.push(text.slice(from).trim());
    return out.filter(Boolean);
  }
  var told = Object.create(null);
  function tell(what) { if (!told[what]) { told[what] = true; console.warn('[egret wechat] A page background is not painted in a mini game: ' + what); } }
  var pictures = Object.create(null), backdropVersion = 0;
  function pictureOf(address) {
    if (pictures[address]) return pictures[address];
    var entry = pictures[address] = { image: wx.createImage(), ready: false };
    entry.image.onload = function () { entry.ready = true; backdropVersion++; };
    entry.image.onerror = function () { tell('the picture ' + address + ' could not be loaded'); };
    var path = packagePath(new URL(address, location.href).href);
    entry.image.src = path === undefined ? address : path;
    return entry;
  }
  function length(value, whole, fallback) {
    if (value === undefined || value === 'auto') return fallback;
    if (/%$/.test(value)) return parseFloat(value) / 100 * whole;
    if (/px$/.test(value) || /^-?[\d.]+$/.test(value)) return parseFloat(value);
    return fallback;
  }
  function gradientPoints(direction, w, h) {
    var angle = 180;
    if (/deg$/.test(direction)) angle = parseFloat(direction);
    else if (/turn$/.test(direction)) angle = parseFloat(direction) * 360;
    else if (/^to /.test(direction)) {
      var to = direction.slice(3).split(/\s+/);
      var x = to.indexOf('right') >= 0 ? 1 : to.indexOf('left') >= 0 ? -1 : 0, y = to.indexOf('bottom') >= 0 ? 1 : to.indexOf('top') >= 0 ? -1 : 0;
      angle = (Math.atan2(x * h, -y * w) * 180) / Math.PI;
    }
    var r = (angle * Math.PI) / 180, dx = Math.sin(r), dy = -Math.cos(r);
    var half = (Math.abs(w * dx) + Math.abs(h * dy)) / 2;
    return [w / 2 - dx * half, h / 2 - dy * half, w / 2 + dx * half, h / 2 + dy * half];
  }
  function paintGradient(context, inner, w, h) {
    var parts = splitTop(inner, ','), direction = '180deg';
    if (/^(to |-?[\d.]+(deg|turn|rad))/.test(parts[0])) direction = parts.shift();
    var p = gradientPoints(direction, w, h), gradient = context.createLinearGradient(p[0], p[1], p[2], p[3]);
    var stops = parts.map(function (part) {
      var words = splitTop(part, ' ');
      return { colour: words[0], at: words[1] !== undefined ? parseFloat(words[1]) / 100 : undefined };
    });
    stops.forEach(function (stop, i) {
      if (stop.at === undefined) stop.at = stops.length === 1 ? 0 : i === 0 ? 0 : i === stops.length - 1 ? 1 : undefined;
    });
    for (var i = 1; i < stops.length - 1; i++)
      if (stops[i].at === undefined) {
        var j = i;
        while (stops[j].at === undefined) j++;
        for (var k = i; k < j; k++) stops[k].at = stops[i - 1].at + ((stops[j].at - stops[i - 1].at) * (k - i + 1)) / (j - i + 1);
      }
    var last = 0;
    for (var s of stops) {
      last = Math.max(last, Math.min(1, Math.max(0, s.at)));
      try { gradient.addColorStop(last, s.colour); } catch (e) { tell(s.colour); }
    }
    context.fillStyle = gradient;
    context.fillRect(0, 0, w, h);
  }
  function paintPicture(context, address, words, w, h) {
    var entry = pictureOf(address);
    if (!entry.ready) return;
    var iw = entry.image.width, ih = entry.image.height;
    if (!(iw > 0 && ih > 0)) return;
    var slash = words.indexOf('/'), position = (slash < 0 ? words : words.slice(0, slash)).filter(function (x) { return !/repeat|scroll|fixed|local|box$/.test(x); });
    var size = slash < 0 ? [] : words.slice(slash + 1).filter(function (x) { return !/repeat|scroll|fixed|local|box$/.test(x); });
    var dw = iw, dh = ih;
    if (size[0] === 'cover' || size[0] === 'contain') {
      var scale = size[0] === 'cover' ? Math.max(w / iw, h / ih) : Math.min(w / iw, h / ih);
      dw = iw * scale;
      dh = ih * scale;
    } else if (size.length) {
      dw = length(size[0], w, undefined);
      dh = length(size[1], h, undefined);
      if (dw === undefined && dh === undefined) { dw = iw; dh = ih; }
      else if (dw === undefined) dw = (dh * iw) / ih;
      else if (dh === undefined) dh = (dw * ih) / iw;
    }
    // Keywords name their axis; otherwise the first value is x and the second y, both centred unless given.
    var px = '50%', py = '50%', loose = [];
    for (var word of position) {
      if (word === 'left' || word === 'right') px = word === 'left' ? '0%' : '100%';
      else if (word === 'top' || word === 'bottom') py = word === 'top' ? '0%' : '100%';
      else if (word === 'center') loose.push('50%');
      else loose.push(word);
    }
    if (position.length && !position.some(function (x) { return /^(left|right)$/.test(x); }) && loose.length) px = loose.shift();
    if (position.length && !position.some(function (x) { return /^(top|bottom)$/.test(x); }) && loose.length) py = loose.shift();
    var x = /%$/.test(px) ? ((w - dw) * parseFloat(px)) / 100 : length(px, w, 0);
    var y = /%$/.test(py) ? ((h - dh) * parseFloat(py)) / 100 : length(py, h, 0);
    context.drawImage(entry.image, x, y, dw, dh);
  }
  function paintLayer(context, layer, w, h, last) {
    var words = splitTop(layer, ' '), painted = false;
    for (var i = 0; i < words.length; i++) {
      var word = words[i], call = /^([a-z-]+)\((.*)\)$/i.exec(word);
      if (call && call[1] === 'linear-gradient') { paintGradient(context, call[2], w, h); painted = true; }
      else if (call && call[1] === 'url') { paintPicture(context, call[2].trim().replace(/^["']|["']$/g, ''), words.slice(i + 1), w, h); return; }
      else if (call && /gradient$/.test(call[1])) { tell(call[1]); return; }
    }
    if (!painted && last) {
      var colour = words.filter(function (x) { return !/^(none|transparent|repeat|no-repeat|center|top|bottom|left|right|\/|cover|contain|scroll|fixed)$/.test(x) && !/^-?[\d.]+(px|%)?$/.test(x); }).pop();
      if (colour) { context.fillStyle = colour; context.fillRect(0, 0, w, h); }
    }
  }
  function backgroundOf(element) {
    var style = element.style;
    if (!style) return '';
    if (style.display === 'none' || style.visibility === 'hidden' || element.hidden) return '';
    var whole = style.background || '';
    if (!whole) {
      var parts = [];
      if (style.backgroundImage && style.backgroundImage !== 'none') parts.push(style.backgroundImage + ' ' + (style.backgroundPosition || '') + (style.backgroundSize ? ' / ' + style.backgroundSize : ''));
      if (style.backgroundColor) parts.push(style.backgroundColor);
      whole = parts.join(', ');
    }
    return whole;
  }
  // The backgrounds of the elements before the stage, ancestors first: those a page would show under it.
  function backdropLayers() {
    var out = [];
    (function visit(node) {
      if (node === stage) return true;
      if (node._node.type === 1) {
        var b = backgroundOf(node);
        if (b) out.push(b);
      }
      for (var child of node._node.children) if (child._node.type === 1 && visit(child)) return true;
      return false;
    })(document.documentElement);
    return out;
  }
  var backdrop = { key: '', canvas: null, texture: null, program: null, vao: null, buffer: null, uploaded: '', empty: true };
  function paintBackdrop(width, height) {
    var layers = backdropLayers(), key = layers.join('|') + '#' + width + 'x' + height + '#' + backdropVersion;
    if (key === backdrop.key) return;
    backdrop.key = key;
    backdrop.empty = layers.length === 0;
    if (backdrop.empty) return;
    if (!backdrop.canvas) backdrop.canvas = wx.createCanvas();
    backdrop.canvas.width = width;
    backdrop.canvas.height = height;
    var context = backdrop.canvas.getContext('2d');
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, width, height);
    context.setTransform(width / size.width, 0, 0, height / size.height, 0, 0);
    for (var layer of layers) {
      var each = splitTop(layer, ',');
      for (var i = each.length - 1; i >= 0; i--) paintLayer(context, each[i], size.width, size.height, i === each.length - 1);
    }
  }
  function drawBackdrop(gl, native) {
    var width = gl.drawingBufferWidth, height = gl.drawingBufferHeight;
    paintBackdrop(width, height);
    if (backdrop.empty) return;
    var saved = {
      program: gl.getParameter(gl.CURRENT_PROGRAM), vao: gl.getParameter(gl.VERTEX_ARRAY_BINDING),
      active: gl.getParameter(gl.ACTIVE_TEXTURE), buffer: gl.getParameter(gl.ARRAY_BUFFER_BINDING),
      unpack: gl.getParameter(gl.PIXEL_UNPACK_BUFFER_BINDING), viewport: gl.getParameter(gl.VIEWPORT),
      draw: gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING), scissor: gl.isEnabled(gl.SCISSOR_TEST),
      blendSource: gl.getParameter(gl.BLEND_SRC_RGB), blendTarget: gl.getParameter(gl.BLEND_DST_RGB),
      blendSourceAlpha: gl.getParameter(gl.BLEND_SRC_ALPHA), blendTargetAlpha: gl.getParameter(gl.BLEND_DST_ALPHA),
      equation: gl.getParameter(gl.BLEND_EQUATION_RGB), equationAlpha: gl.getParameter(gl.BLEND_EQUATION_ALPHA),
      blend: gl.isEnabled(gl.BLEND), depth: gl.isEnabled(gl.DEPTH_TEST), cull: gl.isEnabled(gl.CULL_FACE), stencil: gl.isEnabled(gl.STENCIL_TEST),
      mask: gl.getParameter(gl.COLOR_WRITEMASK), flip: gl.getParameter(gl.UNPACK_FLIP_Y_WEBGL),
      premultiply: gl.getParameter(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL), alignment: gl.getParameter(gl.UNPACK_ALIGNMENT)
    };
    gl.activeTexture(gl.TEXTURE0);
    saved.texture = gl.getParameter(gl.TEXTURE_BINDING_2D);
    saved.sampler = gl.getParameter(gl.SAMPLER_BINDING);
    if (!backdrop.program) {
      var vs = gl.createShader(gl.VERTEX_SHADER), fs = gl.createShader(gl.FRAGMENT_SHADER);
      gl.shaderSource(vs, '#version 300 es\nin vec2 p;out vec2 uv;void main(){uv=vec2(p.x*.5+.5,.5-p.y*.5);gl_Position=vec4(p,0.,1.);}');
      gl.shaderSource(fs, '#version 300 es\nprecision mediump float;uniform sampler2D t;in vec2 uv;out vec4 c;void main(){c=texture(t,uv);}');
      gl.compileShader(vs);
      gl.compileShader(fs);
      var program = gl.createProgram();
      gl.attachShader(program, vs);
      gl.attachShader(program, fs);
      gl.bindAttribLocation(program, 0, 'p');
      gl.linkProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      backdrop.program = program;
      backdrop.vao = gl.createVertexArray();
      backdrop.buffer = gl.createBuffer();
      gl.bindVertexArray(backdrop.vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, backdrop.buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      backdrop.texture = gl.createTexture();
    }
    gl.bindVertexArray(backdrop.vao);
    gl.bindTexture(gl.TEXTURE_2D, backdrop.texture);
    gl.bindSampler(0, null);
    if (backdrop.uploaded !== backdrop.key) {
      gl.bindBuffer(gl.PIXEL_UNPACK_BUFFER, null);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
      native.texImage2D.call(gl, gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, backdrop.canvas);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      backdrop.uploaded = backdrop.key;
    }
    gl.useProgram(backdrop.program);
    gl.uniform1i(gl.getUniformLocation(backdrop.program, 't'), 0);
    native.bindFramebuffer.call(gl, gl.DRAW_FRAMEBUFFER, null);
    gl.viewport(0, 0, width, height);
    // Under what is there: the screen holds premultiplied colour, so the backdrop goes in where it is clear.
    gl.enable(gl.BLEND);
    gl.blendEquation(gl.FUNC_ADD);
    gl.blendFunc(gl.ONE_MINUS_DST_ALPHA, gl.ONE);
    gl.disable(gl.SCISSOR_TEST);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.disable(gl.STENCIL_TEST);
    gl.colorMask(true, true, true, true);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    // Everything as the game left it.
    gl.useProgram(saved.program);
    gl.bindVertexArray(saved.vao);
    gl.bindTexture(gl.TEXTURE_2D, saved.texture);
    gl.bindSampler(0, saved.sampler);
    gl.activeTexture(saved.active);
    gl.bindBuffer(gl.ARRAY_BUFFER, saved.buffer);
    gl.bindBuffer(gl.PIXEL_UNPACK_BUFFER, saved.unpack);
    gl.viewport(saved.viewport[0], saved.viewport[1], saved.viewport[2], saved.viewport[3]);
    native.bindFramebuffer.call(gl, gl.DRAW_FRAMEBUFFER, saved.draw);
    gl.blendEquationSeparate(saved.equation, saved.equationAlpha);
    gl.blendFuncSeparate(saved.blendSource, saved.blendTarget, saved.blendSourceAlpha, saved.blendTargetAlpha);
    gl[saved.scissor ? 'enable' : 'disable'](gl.SCISSOR_TEST);
    gl[saved.blend ? 'enable' : 'disable'](gl.BLEND);
    gl[saved.depth ? 'enable' : 'disable'](gl.DEPTH_TEST);
    gl[saved.cull ? 'enable' : 'disable'](gl.CULL_FACE);
    gl[saved.stencil ? 'enable' : 'disable'](gl.STENCIL_TEST);
    gl.colorMask(saved.mask[0], saved.mask[1], saved.mask[2], saved.mask[3]);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, saved.flip);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, saved.premultiply);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, saved.alignment);
  }
  // Which framebuffer the game draws into is followed through its own calls, so finding whether a frame reached the
  // screen costs no query.
  var screenDrawn = false, screenGl = null, screenNative = null;
  function withBackdrop(gl) {
    if (typeof gl.createVertexArray !== 'function') return;
    var native = { texImage2D: gl.texImage2D, bindFramebuffer: gl.bindFramebuffer };
    var drawTarget = null;
    gl.bindFramebuffer = function (target, framebuffer) {
      native.bindFramebuffer.call(gl, target, framebuffer);
      if (target === gl.FRAMEBUFFER || target === gl.DRAW_FRAMEBUFFER) drawTarget = framebuffer;
    };
    for (var name of ['clear', 'clearBufferfv', 'drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced', 'drawRangeElements', 'blitFramebuffer'])
      (function (name) {
        var original = gl[name];
        if (typeof original !== 'function') return;
        gl[name] = function () {
          if (drawTarget === null) screenDrawn = true;
          return original.apply(gl, arguments);
        };
      })(name);
    screenGl = gl;
    screenNative = native;
  }
  // Called once the frame's callbacks have run, before WeChat shows the screen.
  function finishFrame() {
    if (!screenDrawn || !screenGl) return;
    screenDrawn = false;
    if (screenGl.isContextLost()) return;
    try { drawBackdrop(screenGl, screenNative); } catch (e) { tell(String((e && e.message) || e)); }
  }
  var nativeFrame = G.requestAnimationFrame, frameCallbacks = [], frameIds = 0, frameRequested = null;
  function requestFrame(callback) {
    var id = ++frameIds;
    frameCallbacks.push({ id: id, callback: callback });
    if (frameRequested === null)
      frameRequested = nativeFrame.call(G, function (time) {
        frameRequested = null;
        var due = frameCallbacks;
        frameCallbacks = [];
        for (var entry of due) {
          try { entry.callback(time); } catch (e) { setTimeout(function () { throw e; }, 0); }
        }
        finishFrame();
      });
    return id;
  }
  function cancelFrame(id) {
    frameCallbacks = frameCallbacks.filter(function (entry) { return entry.id !== id; });
  }

  // ---- images -------------------------------------------------------------------------------------------------------
  class HTMLImageElement extends HTMLElement {
    constructor(width, height) {
      super('img');
      var image = wx.createImage(), self = this;
      Object.defineProperty(this, '_image', { value: { wx: image, src: '', complete: false, waiting: [] } });
      this.crossOrigin = null;
      this.decoding = 'auto';
      this.loading = 'eager';
      if (width !== undefined) image.width = width;
      if (height !== undefined) image.height = height;
      image.onload = function () {
        self._image.complete = true;
        self.dispatchEvent(new Event('load'));
        for (var w of self._image.waiting.splice(0)) w[0]();
      };
      image.onerror = function (cause) {
        self._image.complete = true;
        var error = new Error('The image ' + self._image.src + ' could not be loaded' + (cause && cause.errMsg ? ': ' + cause.errMsg : ''));
        self.dispatchEvent(new Event('error', { error: error }));
        for (var w of self._image.waiting.splice(0)) w[1](error);
      };
    }
    get src() { return this._image.src; }
    set src(value) {
      this._image.src = String(value);
      this._image.complete = false;
      var path = packagePath(value);
      this._image.wx.src = path === undefined ? this._image.src : path;
    }
    get complete() { return this._image.complete; }
    get width() { return this._image.wx.width; }
    set width(v) { this._image.wx.width = v; }
    get height() { return this._image.wx.height; }
    set height(v) { this._image.wx.height = v; }
    get naturalWidth() { return this._image.wx.width; }
    get naturalHeight() { return this._image.wx.height; }
    _backing() { return this._image.wx; }
    decode() {
      var self = this;
      if (this._image.complete && this._image.wx.width > 0) return Promise.resolve();
      return new Promise(function (resolve, reject) { self._image.waiting.push([resolve, reject]); });
    }
  }
  var Image = function Image(width, height) { return new HTMLImageElement(width, height); };
  Image.prototype = HTMLImageElement.prototype;

  // ---- blobs and decoded pictures -----------------------------------------------------------------------------------
  // The engine decodes a PNG as a page does: bytes into a Blob, the Blob into an ImageBitmap, the bitmap drawn onto a
  // 2D canvas and read back. A mini game has no Blob or createImageBitmap; the bytes are written to a file of the
  // game's own and loaded as an image, or given as a data address where no file can be written.
  class Blob {
    constructor(parts, options) {
      var chunks = [], length = 0;
      for (var part of parts || []) {
        var bytes;
        if (typeof part === 'string') bytes = new TextEncoder().encode(part);
        else if (part instanceof ArrayBuffer) bytes = new Uint8Array(part.slice(0));
        else if (ArrayBuffer.isView(part)) bytes = new Uint8Array(part.buffer.slice(part.byteOffset, part.byteOffset + part.byteLength));
        else if (part && part._bytes) bytes = part._bytes;
        else bytes = new TextEncoder().encode(String(part));
        chunks.push(bytes);
        length += bytes.length;
      }
      var all = new Uint8Array(length), at = 0;
      for (var c of chunks) { all.set(c, at); at += c.length; }
      Object.defineProperty(this, '_bytes', { value: all });
      Object.defineProperty(this, '_type', { value: options && options.type ? String(options.type).toLowerCase() : '' });
    }
    get size() { return this._bytes.length; }
    get type() { return this._type; }
    arrayBuffer() { return Promise.resolve(this._bytes.slice().buffer); }
    text() { return Promise.resolve(new TextDecoder().decode(this._bytes)); }
    bytes() { return Promise.resolve(this._bytes.slice()); }
    slice(start, end, type) { return new Blob([this._bytes.slice(start, end)], { type: type }); }
  }
  var BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  function base64(bytes) {
    if (typeof wx.arrayBufferToBase64 === 'function') return wx.arrayBufferToBase64(bytes.slice().buffer);
    var out = '';
    for (var i = 0; i < bytes.length; i += 3) {
      var n = (bytes[i] << 16) | ((bytes[i + 1] || 0) << 8) | (bytes[i + 2] || 0);
      out += BASE64[(n >> 18) & 63] + BASE64[(n >> 12) & 63] + (i + 1 < bytes.length ? BASE64[(n >> 6) & 63] : '=') + (i + 2 < bytes.length ? BASE64[n & 63] : '=');
    }
    return out;
  }
  var pictureFiles = 0;
  function pictureSource(blob) {
    var folder = wx.env && wx.env.USER_DATA_PATH;
    var files = typeof wx.getFileSystemManager === 'function' ? wx.getFileSystemManager() : null;
    if (!folder || !files || typeof files.writeFile !== 'function')
      return Promise.resolve({ src: 'data:' + (blob.type || 'image/png') + ';base64,' + base64(blob._bytes) });
    // A few files are reused in turn, so a game that decodes many pictures leaves no more than these behind.
    var file = folder + '/egret-picture-' + (pictureFiles++ % 8) + (blob.type === 'image/jpeg' ? '.jpg' : '.png');
    return new Promise(function (resolve, reject) {
      files.writeFile({
        filePath: file,
        data: blob._bytes.slice().buffer,
        success: function () { resolve({ src: file }); },
        fail: function (r) { reject(new Error('The picture could not be written: ' + (r && r.errMsg))); }
      });
    });
  }
  class ImageBitmap {
    constructor(image) { Object.defineProperty(this, '_bitmap', { value: { image: image, closed: false } }); }
    get width() { return this._bitmap.closed ? 0 : this._bitmap.image.width; }
    get height() { return this._bitmap.closed ? 0 : this._bitmap.image.height; }
    close() { this._bitmap.closed = true; }
    _backing() { return this._bitmap.image; }
  }
  function createImageBitmap(source) {
    if (source instanceof ImageBitmap) return Promise.resolve(new ImageBitmap(source._backing()));
    if (source instanceof HTMLImageElement || source instanceof HTMLCanvasElement) return Promise.resolve(new ImageBitmap(source._backing()));
    if (!(source instanceof Blob)) return Promise.reject(new TypeError('createImageBitmap needs a Blob, an image or a canvas here'));
    return pictureSource(source).then(function (where) {
      return new Promise(function (resolve, reject) {
        var image = wx.createImage();
        image.onload = function () { resolve(new ImageBitmap(image)); };
        image.onerror = function (r) { reject(new DOMException('The picture could not be decoded' + (r && r.errMsg ? ': ' + r.errMsg : ''), 'InvalidStateError')); };
        image.src = where.src;
      });
    });
  }
  var DOMException = typeof G.DOMException === 'function' ? G.DOMException : class DOMException extends Error {
    constructor(message, name) { super(message); this.name = name || 'Error'; }
  };

  // ---- the document -------------------------------------------------------------------------------------------------
  class Document extends Node {
    constructor() {
      super(9, '#document');
      Object.defineProperty(this, '_document', { value: { active: null, visibility: 'visible' } });
    }
    get defaultView() { return window; }
    get visibilityState() { return this._document.visibility; }
    get hidden() { return this._document.visibility !== 'visible'; }
    get activeElement() { return this._document.active || this.body; }
    get documentElement() { return this._node.children[0] || null; }
    get head() { return this.documentElement ? this.documentElement.querySelector('head') : null; }
    get body() { return this.documentElement ? this.documentElement.querySelector('body') : null; }
    get readyState() { return 'complete'; }
    get fullscreenElement() { return null; }
    get pointerLockElement() { return null; }
    get scrollingElement() { return this.documentElement; }
    createElement(tag) {
      tag = String(tag).toLowerCase();
      if (tag === 'canvas') return new HTMLCanvasElement();
      if (tag === 'img') return new HTMLImageElement();
      return new HTMLElement(tag);
    }
    createElementNS(_, tag) { return this.createElement(tag); }
    createTextNode(text) { return new Text(text); }
    createDocumentFragment() { return new Node(11, '#document-fragment'); }
    createEvent() { return new Event(''); }
    getElementById(id) { return this.querySelector('#' + id); }
    querySelector(selector) { var out = []; walk(this, out, selector, true); return out[0] || null; }
    querySelectorAll(selector) { var out = []; walk(this, out, selector, false); return out; }
    getElementsByTagName(tag) { return this.querySelectorAll(tag); }
    getElementsByClassName(name) { return this.querySelectorAll('.' + name); }
    hasFocus() { return this._document.visibility === 'visible'; }
    elementFromPoint() { return stage || this.body; }
    execCommand() { return false; }
    exitFullscreen() { return Promise.resolve(); }
    exitPointerLock() {}
  }
  var document = new Document();
  document.fonts = { ready: Promise.resolve(), add: function () {}, delete: function () {}, load: function () { return Promise.resolve([]); }, check: function () { return true; }, status: 'loaded', addEventListener: function () {}, removeEventListener: function () {} };
  document.title = '';
  document.cookie = '';
  (function () {
    var html = document.createElement('html');
    document.appendChild(html);
    html.appendChild(document.createElement('head'));
    html.appendChild(document.createElement('body'));
  })();
  document._document.active = document.body;
  // The page's elements, as the game's index.html had them, so querySelector('#frame') finds one.
  (function build(parent, nodes) {
    for (var node of nodes || []) {
      var element = document.createElement(node.tag);
      if (node.id) element.id = node.id;
      if (node.className) element.className = node.className;
      if (node.text) element.textContent = node.text;
      parent.appendChild(element);
      build(element, node.children);
    }
  })(document.body, page && page.body);

  // ---- the window ---------------------------------------------------------------------------------------------------
  var window = G;
  Object.defineProperty(window, '_listeners', { value: Object.create(null), writable: true });
  window.addEventListener = EventTarget.prototype.addEventListener;
  window.removeEventListener = EventTarget.prototype.removeEventListener;
  window.dispatchEvent = EventTarget.prototype.dispatchEvent;
  Object.defineProperties(window, {
    innerWidth: { get: function () { return size.width; }, configurable: true },
    innerHeight: { get: function () { return size.height; }, configurable: true },
    outerWidth: { get: function () { return size.width; }, configurable: true },
    outerHeight: { get: function () { return size.height; }, configurable: true }
  });
  window.devicePixelRatio = ratio;
  window.screen = {
    width: info.screenWidth || size.width,
    height: info.screenHeight || size.height,
    availWidth: size.width,
    availHeight: size.height,
    orientation: { type: size.width > size.height ? 'landscape-primary' : 'portrait-primary', angle: 0, addEventListener: function () {}, removeEventListener: function () {}, lock: function () { return Promise.reject(new Error('not available')); } }
  };
  window.scrollX = window.scrollY = window.pageXOffset = window.pageYOffset = 0;
  window.scrollTo = window.scrollBy = function () {};
  window.focus = window.blur = function () {};
  window.open = function () { return null; };
  window.alert = function (message) { if (typeof wx.showModal === 'function') wx.showModal({ content: String(message), showCancel: false }); };
  window.confirm = function () { return false; };
  window.prompt = function () { return null; };
  window.history = { length: 1, state: null, pushState: function () {}, replaceState: function () {}, back: function () {}, go: function () {} };
  window.getComputedStyle = function (element) {
    var style = new CSSStyleDeclaration();
    for (var k in COMPUTED) style[k] = COMPUTED[k];
    // What the game set is kept, apart from what would move the screen's picture: WeChat draws the screen canvas
    // over the whole window, untransformed, whatever its style says.
    if (element && element.style)
      for (var j in element.style)
        if (typeof element.style[j] === 'string' && element.style[j] !== '' && !/^(transform|rotate|scale|translate|perspective|zoom|objectFit|padding|border|margin)/.test(j)) style[j] = element.style[j];
    style.width = size.width + 'px';
    style.height = size.height + 'px';
    style.display = element.hidden ? 'none' : style.display || 'block';
    // Padding of the page's safe-area insets is what WeChat says of the screen's safe area.
    var padding = element && element.style ? String(element.style.padding || '') : '';
    if (padding.indexOf('safe-area-inset') >= 0) {
      var now = wx.getSystemInfoSync(),
        safe = now.safeArea,
        across = now.windowWidth,
        down = now.windowHeight;
      var inset = function (value) { return Math.max(0, Number.isFinite(value) ? value : 0) + 'px'; };
      style.paddingTop = safe ? inset(safe.top) : '0px';
      style.paddingLeft = safe ? inset(safe.left) : '0px';
      style.paddingRight = safe ? inset(across - safe.right) : '0px';
      style.paddingBottom = safe ? inset(down - safe.bottom) : '0px';
    }
    return style;
  };
  var mediaMatches = {
    'pointer: coarse': true, 'pointer: fine': false, 'hover: none': true, 'hover: hover': false,
    'any-pointer: coarse': true, 'any-pointer: fine': false, 'prefers-reduced-motion: reduce': false,
    'prefers-color-scheme: dark': info.theme === 'dark', 'prefers-color-scheme: light': info.theme !== 'dark'
  };
  window.matchMedia = function (query) {
    var q = String(query).replace(/[()]/g, '').trim().toLowerCase(), matched = mediaMatches[q];
    if (matched === undefined && /orientation/.test(q)) matched = q.indexOf('portrait') >= 0 ? size.height >= size.width : size.width > size.height;
    return { matches: !!matched, media: String(query), onchange: null, addEventListener: function () {}, removeEventListener: function () {}, addListener: function () {}, removeListener: function () {} };
  };
  var observers = [];
  function ResizeObserver(callback) { this._callback = callback; this._targets = []; }
  ResizeObserver.prototype.observe = function (target) {
    this._targets.push(target);
    if (observers.indexOf(this) < 0) observers.push(this);
    var self = this;
    Promise.resolve().then(function () { self._notify([target]); });
  };
  ResizeObserver.prototype.unobserve = function (target) { this._targets = this._targets.filter(function (t) { return t !== target; }); };
  ResizeObserver.prototype.disconnect = function () { this._targets = []; var i = observers.indexOf(this); if (i >= 0) observers.splice(i, 1); };
  ResizeObserver.prototype._notify = function (targets) {
    var entries = targets.map(function (target) {
      var box = { inlineSize: size.width, blockSize: size.height };
      return { target: target, contentRect: target.getBoundingClientRect(), contentBoxSize: [box], borderBoxSize: [box], devicePixelContentBoxSize: [{ inlineSize: size.width * ratio, blockSize: size.height * ratio }] };
    });
    if (entries.length) this._callback(entries, this);
  };
  function Inert() {}
  Inert.prototype.observe = Inert.prototype.unobserve = Inert.prototype.disconnect = function () {};
  Inert.prototype.takeRecords = function () { return []; };
  if (typeof wx.onWindowResize === 'function')
    wx.onWindowResize(function (r) {
      size.width = r.windowWidth;
      size.height = r.windowHeight;
      window.dispatchEvent(new Event('resize'));
      for (var o of observers.slice()) o._notify(o._targets.slice());
    });

  // ---- the navigator ------------------------------------------------------------------------------------------------
  var language = String(info.language || 'zh_CN').replace('_', '-');
  if (language === 'zh') language = 'zh-CN';
  var navigator = {
    userAgent: 'Mozilla/5.0 (' + (info.platform || 'unknown') + ') WeChatMiniGame/' + (info.SDKVersion || ''),
    platform: info.platform || '',
    language: language,
    languages: [language],
    maxTouchPoints: 10,
    hardwareConcurrency: 4,
    onLine: true,
    cookieEnabled: false,
    vendor: 'Tencent',
    getGamepads: function () { return []; },
    vibrate: function () { if (typeof wx.vibrateShort === 'function') wx.vibrateShort({ type: 'medium' }); return true; },
    sendBeacon: function () { return false; },
    userActivation: { isActive: true, hasBeenActive: true }
  };

  // ---- storage ------------------------------------------------------------------------------------------------------
  // localStorage as wx storage, each key under a prefix so the game's keys cannot meet wx's own.
  var PREFIX = 'ls:';
  var localStorage = {
    getItem: function (key) {
      var keys = wx.getStorageInfoSync().keys;
      return keys.indexOf(PREFIX + key) < 0 ? null : String(wx.getStorageSync(PREFIX + key));
    },
    setItem: function (key, value) { wx.setStorageSync(PREFIX + key, String(value)); },
    removeItem: function (key) { wx.removeStorageSync(PREFIX + key); },
    clear: function () { for (var k of wx.getStorageInfoSync().keys) if (k.startsWith(PREFIX)) wx.removeStorageSync(k); },
    key: function (i) { var keys = wx.getStorageInfoSync().keys.filter(function (k) { return k.startsWith(PREFIX); }); return keys[i] === undefined ? null : keys[i].slice(PREFIX.length); }
  };
  Object.defineProperty(localStorage, 'length', { get: function () { return wx.getStorageInfoSync().keys.filter(function (k) { return k.startsWith(PREFIX); }).length; } });
  var sessionData = Object.create(null);
  var sessionStorage = {
    getItem: function (k) { return k in sessionData ? sessionData[k] : null; },
    setItem: function (k, v) { sessionData[k] = String(v); },
    removeItem: function (k) { delete sessionData[k]; },
    clear: function () { sessionData = Object.create(null); },
    key: function (i) { return Object.keys(sessionData)[i] || null; }
  };

  // ---- fetch --------------------------------------------------------------------------------------------------------
  // A file of the package is read from the package; any other address with wx.request.
  function Response(body, init) {
    this._body = body;
    this.status = (init && init.status) || 200;
    this.ok = this.status >= 200 && this.status < 300;
    this.statusText = (init && init.statusText) || '';
    this.url = (init && init.url) || '';
    this.headers = { get: function () { return null; }, has: function () { return false; } };
    this.bodyUsed = false;
  }
  Response.prototype.arrayBuffer = function () {
    this.bodyUsed = true;
    var b = this._body;
    return Promise.resolve(typeof b === 'string' ? new TextEncoder().encode(b).buffer : b);
  };
  Response.prototype.text = function () {
    this.bodyUsed = true;
    var b = this._body;
    return Promise.resolve(typeof b === 'string' ? b : new TextDecoder().decode(new Uint8Array(b)));
  };
  Response.prototype.json = function () { return this.text().then(JSON.parse); };
  // The body as a stream of one chunk, for code that reads a response as it comes (the engine's pictures are read so,
  // to stop at their limit); WeChat has no ReadableStream.
  Object.defineProperty(Response.prototype, 'body', {
    configurable: true,
    get: function () {
      var self = this, b = this._body, sent = false;
      if (b === null || b === undefined) return null;
      var reader = {
        read: function () {
          if (sent) return Promise.resolve({ done: true, value: undefined });
          sent = true;
          self.bodyUsed = true;
          return Promise.resolve({ done: false, value: typeof b === 'string' ? new TextEncoder().encode(b) : new Uint8Array(b) });
        },
        cancel: function () { sent = true; return Promise.resolve(); },
        releaseLock: function () {}
      };
      return { getReader: function () { return reader; }, cancel: reader.cancel, locked: false };
    }
  });
  Response.prototype.clone = function () { return new Response(this._body, this); };
  function fetch(input, init) {
    var url = typeof input === 'string' ? input : input.href || input.url || String(input);
    var path = packagePath(url);
    if (path !== undefined)
      return new Promise(function (resolve, reject) {
        wx.getFileSystemManager().readFile({
          filePath: path,
          success: function (r) { resolve(new Response(r.data, { status: 200, url: url })); },
          fail: function (r) { resolve(new Response(new ArrayBuffer(0), { status: 404, statusText: r && r.errMsg, url: url })); }
        });
      });
    return new Promise(function (resolve, reject) {
      wx.request({
        url: url,
        method: (init && init.method) || 'GET',
        data: init && init.body,
        header: init && init.headers,
        responseType: 'arraybuffer',
        success: function (r) { resolve(new Response(r.data, { status: r.statusCode, url: url })); },
        fail: function (r) { reject(new TypeError('fetch failed: ' + (r && r.errMsg))); }
      });
    });
  }

  // ---- sound --------------------------------------------------------------------------------------------------------
  // Web Audio from wx.createWebAudioContext; decodeAudioData also answers as a promise, as a page's does.
  var AudioContext;
  if (typeof wx.createWebAudioContext === 'function') {
    AudioContext = function () {
      var context = wx.createWebAudioContext();
      var decode = context.decodeAudioData;
      context.decodeAudioData = function (data, done, failed) {
        return new Promise(function (resolve, reject) {
          decode.call(context, data, function (buffer) { if (done) done(buffer); resolve(buffer); }, function (error) { if (failed) failed(error); reject(error || new Error('decodeAudioData failed')); });
        });
      };
      if (typeof context.resume !== 'function') context.resume = function () { return Promise.resolve(); };
      if (typeof context.suspend !== 'function') context.suspend = function () { return Promise.resolve(); };
      if (context.state === undefined) context.state = 'running';
      return context;
    };
  }

  // ---- touches, keys and the life of the game ------------------------------------------------------------------------
  var down = Object.create(null), primary = null;
  function pointer(type, touch, buttons) {
    var target = stage || document.body;
    var id = touch.identifier + 1;
    if (type === 'pointerdown' && primary === null) primary = id;
    var event = new PointerEvent(type, {
      bubbles: true, cancelable: true, composed: true,
      pointerId: id, pointerType: 'touch', isPrimary: primary === id,
      clientX: touch.clientX, clientY: touch.clientY, pageX: touch.clientX, pageY: touch.clientY,
      screenX: touch.clientX, screenY: touch.clientY, offsetX: touch.clientX, offsetY: touch.clientY,
      x: touch.clientX, y: touch.clientY, movementX: 0, movementY: 0,
      button: type === 'pointermove' ? -1 : 0, buttons: buttons, pressure: buttons ? 0.5 : 0,
      width: 1, height: 1, tiltX: 0, tiltY: 0, twist: 0, altKey: false, ctrlKey: false, metaKey: false, shiftKey: false,
      getCoalescedEvents: function () { return [this]; }, getPredictedEvents: function () { return []; }
    });
    event.target = target;
    target.dispatchEvent(event);
    if (type === 'pointerup' || type === 'pointercancel') {
      if (primary === id) primary = null;
      if (type === 'pointerup' && down[id] && Math.abs(down[id].x - touch.clientX) < 10 && Math.abs(down[id].y - touch.clientY) < 10) {
        var click = new MouseEvent('click', { bubbles: true, cancelable: true, clientX: touch.clientX, clientY: touch.clientY, button: 0 });
        click.target = target;
        target.dispatchEvent(click);
      }
      delete down[id];
    } else if (type === 'pointerdown') down[id] = { x: touch.clientX, y: touch.clientY };
  }
  function touches(type, buttons) {
    return function (r) { for (var t of r.changedTouches || r.touches || []) pointer(type, t, buttons); };
  }
  wx.onTouchStart(touches('pointerdown', 1));
  wx.onTouchMove(touches('pointermove', 1));
  wx.onTouchEnd(touches('pointerup', 0));
  wx.onTouchCancel(touches('pointercancel', 0));
  function key(type) {
    return function (r) {
      var event = new KeyboardEvent(type, { bubbles: true, cancelable: true, key: r.key, code: r.code, repeat: false, altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, isComposing: false });
      event.target = document.activeElement || stage || document.body;
      event.target.dispatchEvent(event);
    };
  }
  if (typeof wx.onKeyDown === 'function') wx.onKeyDown(key('keydown'));
  if (typeof wx.onKeyUp === 'function') wx.onKeyUp(key('keyup'));
  function visibility(visible) {
    return function () {
      document._document.visibility = visible ? 'visible' : 'hidden';
      document.dispatchEvent(new Event('visibilitychange'));
      window.dispatchEvent(new Event(visible ? 'focus' : 'blur'));
      window.dispatchEvent(new Event(visible ? 'pageshow' : 'pagehide'));
    };
  }
  if (typeof wx.onShow === 'function') wx.onShow(visibility(true));
  if (typeof wx.onHide === 'function') wx.onHide(visibility(false));
  if (typeof wx.onError === 'function')
    wx.onError(function (r) { window.dispatchEvent(new Event('error', { message: r && r.message, error: new Error(r && r.message) })); });

  // ---- what the game sees ---------------------------------------------------------------------------------------------
  var globals = {
    window: window, self: window, globalThis: window, document: document, navigator: navigator, location: location,
    localStorage: localStorage, sessionStorage: sessionStorage, fetch: fetch, Response: Response,
    performance: performance, URL: URL, URLSearchParams: URLSearchParams, TextEncoder: TextEncoder, TextDecoder: TextDecoder,
    Image: Image, HTMLImageElement: HTMLImageElement, HTMLCanvasElement: HTMLCanvasElement, HTMLElement: HTMLElement, Element: Element, Node: Node,
    Blob: Blob, ImageBitmap: ImageBitmap, createImageBitmap: createImageBitmap, DOMException: DOMException,
    Text: Text, Document: Document, HTMLDocument: Document, CSSStyleDeclaration: CSSStyleDeclaration, DOMRect: DOMRect, DOMRectReadOnly: DOMRectReadOnly,
    Event: Event, EventTarget: EventTarget, CustomEvent: CustomEvent, PointerEvent: PointerEvent, MouseEvent: MouseEvent,
    KeyboardEvent: KeyboardEvent, TouchEvent: TouchEvent, FocusEvent: FocusEvent, WheelEvent: WheelEvent, UIEvent: UIEvent, InputEvent: InputEvent,
    AbortController: AbortController, AbortSignal: AbortSignal,
    ResizeObserver: ResizeObserver, MutationObserver: Inert, IntersectionObserver: Inert,
    matchMedia: window.matchMedia, getComputedStyle: window.getComputedStyle, devicePixelRatio: ratio,
    addEventListener: function (t, f, o) { window.addEventListener(t, f, o); },
    removeEventListener: function (t, f, o) { window.removeEventListener(t, f, o); },
    dispatchEvent: function (e) { return window.dispatchEvent(e); },
    AudioContext: AudioContext, webkitAudioContext: AudioContext,
    requestAnimationFrame: requestFrame, cancelAnimationFrame: cancelFrame,
    setTimeout: G.setTimeout, clearTimeout: G.clearTimeout, setInterval: G.setInterval, clearInterval: G.clearInterval,
    queueMicrotask: G.queueMicrotask, console: G.console,
    structuredClone: typeof G.structuredClone === 'function' ? G.structuredClone : undefined,
    screen: window.screen, history: window.history, alert: window.alert, confirm: window.confirm, prompt: window.prompt, open: window.open
  };
  // Frames go through the adapter, which finishes each one: these replace what GameGlobal had.
  G.requestAnimationFrame = requestFrame;
  G.cancelAnimationFrame = cancelFrame;
  for (var name in globals) if (globals[name] !== undefined && !(name in window) && name !== 'globalThis') {
    try { window[name] = globals[name]; } catch (e) {}
  }
  return { globals: globals, screen: screen, document: document, ORIGIN: ORIGIN };
};
