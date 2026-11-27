// SPDX-License-Identifier: Apache-2.0
// A non-DOM reader for the legacy text vocabulary. Unknown styles never silently lose their meaning.
const maximumRuns = 256;
const maximumText = 16384;
const properties = new Set([
  'textColor',
  'size',
  'fontFamily',
  'bold',
  'italic',
  'underline',
  'stroke',
  'strokeColor',
  'href'
]);
function reject(message) {
  throw Object.assign(new Error(message), { code: 'LEGACY_RICH_TEXT_UNSUPPORTED' });
}
function decode(text) {
  const entities = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" };
  return text.replace(/&(lt|gt|amp|quot|apos);/g, (_, key) => entities[key]);
}
function checkedStyle(style) {
  const result = {};
  for (const [key, value] of Object.entries(style ?? {})) {
    if (!properties.has(key)) reject('Unsupported text style: ' + key);
    if (key === 'textColor' || key === 'strokeColor') {
      if (!Number.isInteger(value) || value < 0 || value > 0xffffff) reject('Expected a 24-bit color.');
    } else if (key === 'size' || key === 'stroke') {
      if (!Number.isFinite(value) || value < (key === 'size' ? 1 : 0) || value > 512)
        reject('Invalid text size or outline.');
    } else if (key === 'fontFamily') {
      if (typeof value !== 'string' || !value.trim() || value.length > 128) reject('Invalid font family.');
    } else if (key === 'href') {
      if (typeof value !== 'string' || !value.startsWith('event:'))
        reject('Only event: links have a shared host contract.');
    } else if (typeof value !== 'boolean') reject('Expected a boolean for ' + key);
    result[key] = value;
  }
  return result;
}
export function captureTextFlow(rows) {
  if (!Array.isArray(rows) || rows.length > maximumRuns) reject('Expected at most 256 text runs.');
  let length = 0;
  return rows.map(row => {
    const text = row?.text;
    if (typeof text !== 'string' || (length += text.length) > maximumText) reject('Invalid text run or total length.');
    const style = row.style;
    return style == null ? { text } : { text, style: checkedStyle(style) };
  });
}
const aliases = Object.freeze({
  color: 'textColor',
  textcolor: 'textColor',
  strokecolor: 'strokeColor',
  stroke: 'stroke',
  size: 'size',
  fontfamily: 'fontFamily',
  b: 'bold',
  bold: 'bold',
  i: 'italic',
  italic: 'italic',
  u: 'underline',
  href: 'href'
});
function attribute(key, value) {
  if (key === 'textColor' || key === 'strokeColor') {
    if (/^#[\da-f]{1,6}$/i.test(value)) return parseInt(value.slice(1), 16);
    if (/^(?:0x[\da-f]{1,6}|\d+)$/i.test(value)) return Number(value);
    reject('Invalid HTML text color.');
  }
  if (key === 'stroke' || key === 'size') return /^\d+$/.test(value) ? Number(value) : NaN;
  if (['bold', 'italic', 'underline'].includes(key)) {
    if (value !== 'true' && value !== 'false') reject('Invalid HTML boolean.');
    return value === 'true';
  }
  return decode(value);
}
export class HtmlTextParser {
  parse(html) {
    if (typeof html !== 'string' || html.length > 65536) reject('Invalid marked-up text or length.');
    const rows = [],
      stack = [];
    let offset = 0;
    while (offset < html.length) {
      const open = html.indexOf('<', offset);
      const end = open < 0 ? html.length : open;
      if (end > offset) {
        if (rows.length === maximumRuns) reject('Too many text runs.');
        const text = decode(html.slice(offset, end));
        rows.push(stack.length ? { text, style: { ...stack[stack.length - 1].style } } : { text });
      }
      if (open < 0) break;
      const close = html.indexOf('>', open + 1);
      if (close < 0) reject('Unterminated text tag.');
      const match = /^(\/?)(font|a|b|i|u)(?:\s+([\s\S]*?))?\s*$/.exec(html.slice(open + 1, close));
      if (!match) reject('Unsupported HTML text tag.');
      const [, ending, name, attributes = ''] = match;
      if (ending) {
        if (attributes || stack.pop()?.name !== name) reject('Mismatched text tags.');
      } else {
        if (stack.length >= 32) reject('Text tags exceed nesting limit.');
        const style = { ...stack[stack.length - 1]?.style };
        if (['b', 'i', 'u'].includes(name)) style[aliases[name]] = true;
        let tail = attributes.trim();
        while (tail) {
          const pair = /^([a-z]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'<>]+))(?=\s|$)/i.exec(tail);
          if (!pair || !Object.hasOwn(aliases, pair[1].toLowerCase())) reject('Unsupported HTML text attribute.');
          const key = aliases[pair[1].toLowerCase()];
          style[key] = attribute(key, pair[2] ?? pair[3] ?? pair[4]);
          tail = tail.slice(pair[0].length).trimStart();
        }
        stack.push({ name, style: checkedStyle(style) });
      }
      offset = close + 1;
    }
    if (stack.length) reject('Unclosed text tag.');
    return captureTextFlow(rows);
  }
  parser(html) {
    return this.parse(html);
  }
}
export function richTextEvent(Event) {
  return class TextEvent extends Event {
    static LINK = 'link';
    constructor(type, bubbles = false, cancelable = false, text = '') {
      super(type, bubbles, cancelable);
      this.text = text;
    }
    static dispatchTextEvent(target, type, text) {
      return target.dispatchEvent(new this(type, false, false, text));
    }
  };
}
function runStyle(base, style = {}) {
  return {
    color: style.textColor ?? base.color,
    fontFamily: style.fontFamily ?? base.fontFamily,
    fontSize: style.size ?? base.fontSize,
    fontWeight: style.bold === undefined ? base.fontWeight : style.bold ? 700 : 400,
    italic: style.italic ?? base.italic,
    strokeWidth: style.stroke ?? base.strokeWidth,
    strokeColor: style.strokeColor ?? base.strokeColor
  };
}
// Shape each same-style substring with the host's existing font and glyph measurements.
// The same committed rectangles position the rasters and resolve links.
export function layoutTextFlow(rows, base, box, ports) {
  const lines = [];
  let fragments = [],
    width = 0,
    height = 0,
    count = 0;
  const finish = () => {
    lines.push({ fragments, width, height: height || base.fontSize });
    fragments = [];
    width = 0;
    height = 0;
  };
  for (const row of rows) {
    const style = runStyle(base, row.style);
    const font = (style.italic ? 'italic ' : '') + style.fontWeight + ' ' + style.fontSize + 'px ' + style.fontFamily;
    const metric = {
      size: style.fontSize,
      weight: style.fontWeight,
      italic: style.italic,
      fontFamily: style.fontFamily
    };
    const measure = text => {
      const advance = ports.measureLine(text, font, metric);
      if (!Number.isFinite(advance) || advance < 0) reject('The host must provide real glyph measurements.');
      return advance;
    };
    const pieces = row.text.split(/\r\n|[\r\n]/);
    for (let i = 0; i < pieces.length; i++) {
      if (i) finish();
      let word = pieces[i];
      while (word) {
        const available = (box.width ?? Infinity) - width;
        let segment = word,
          advance = measure(word);
        if (advance > available) {
          const clusters = Array.from(ports.graphemes(word));
          let lo = 0,
            hi = clusters.length;
          while (lo < hi) {
            const mid = Math.ceil((lo + hi) / 2);
            if (measure(clusters.slice(0, mid).join('')) <= available) lo = mid;
            else hi = mid - 1;
          }
          if (lo === 0 && fragments.length) {
            finish();
            continue;
          }
          segment = clusters.slice(0, Math.max(1, lo)).join('');
          if (!segment) reject('Host could not segment text.');
          advance = measure(segment);
        }
        if (++count > maximumRuns) reject('Wrapped text exceeds 256 drawable fragments.');
        fragments.push({
          text: segment,
          style,
          x: width,
          width: advance,
          href: row.style?.href,
          underline: !!row.style?.underline
        });
        width += advance;
        height = Math.max(height, style.fontSize);
        word = word.slice(segment.length);
        if (word) finish();
      }
    }
  }
  finish();
  const spacing = box.lineSpacing ?? 0;
  const contentHeight = lines.reduce((sum, line) => sum + line.height, 0) + spacing * (lines.length - 1);
  const extraHeight = Math.max(0, (box.height ?? contentHeight) - contentHeight);
  let top = box.verticalAlign === 'bottom' ? extraHeight : box.verticalAlign === 'middle' ? extraHeight / 2 : 0,
    maximumWidth = 0;
  const output = [];
  for (const line of lines) {
    const extra = box.width === undefined ? 0 : box.width - line.width;
    const left = box.align === 'center' ? extra / 2 : box.align === 'right' ? extra : 0;
    if (box.height === undefined || top < box.height)
      for (const fragment of line.fragments) {
        output.push({
          ...fragment,
          x: fragment.x + left,
          y: top + (line.height - fragment.style.fontSize) / 2,
          lineTop: top,
          lineHeight: line.height
        });
      }
    top += line.height + spacing;
    maximumWidth = Math.max(maximumWidth, line.width);
  }
  return { fragments: output, width: box.width ?? maximumWidth, height: box.height ?? contentHeight };
}
