// SPDX-License-Identifier: Apache-2.0
import { EgretError } from '@egret/runtime';
import type { BitmapFont, BitmapGlyph } from './bitmapFontTypes.js';

const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const refuse = (detail: string): EgretError => new EgretError('BITMAP_FONT_INVALID', { cause: new TypeError(detail) });
const fonts = new WeakSet<object>();
/** Whether a value is a font this entry read. */
export const isBitmapFont = (value: unknown): value is BitmapFont => typeof value === 'object' && value !== null && fonts.has(value);

interface Draft {
  face: string; size: number | undefined; lineHeight: number | undefined; base: number | undefined;
  pages: Map<number, string>; glyphs: BitmapGlyph[]; kernings: [number, number, number][];
}
const draft = (): Draft => ({ face: '', size: undefined, lineHeight: undefined, base: undefined, pages: new Map(), glyphs: [], kernings: [] });

/** A whole number from the attribute of a line or an element. */
function whole(fields: Record<string, unknown>, key: string, where: string, fallback?: number): number {
  const raw = fields[key];
  if (raw === undefined && fallback !== undefined) return fallback;
  const value = typeof raw === 'string' && /^\s*-?\d+\s*$/.test(raw) ? Number(raw) : raw;
  if (!Number.isSafeInteger(value)) throw refuse(where + ': ' + key);
  return value as number;
}
interface Keys { readonly x: string; readonly y: string; readonly width: string; readonly height: string; readonly xOffset: string; readonly yOffset: string; readonly xAdvance: string }
function glyphOf(fields: Record<string, unknown>, where: string, keys: Keys): BitmapGlyph {
  const id = whole(fields, 'id', where), x = whole(fields, keys.x, where), y = whole(fields, keys.y, where), width = whole(fields, keys.width, where), height = whole(fields, keys.height, where);
  if (id < 0 || id > 0x10ffff || x < 0 || y < 0 || width < 0 || height < 0) throw refuse(where + ': a character out of range');
  return Object.freeze({ id, x, y, width, height, xOffset: whole(fields, keys.xOffset, where, 0), yOffset: whole(fields, keys.yOffset, where, 0), xAdvance: whole(fields, keys.xAdvance, where), page: whole(fields, 'page', where, 0) });
}
const BMFONT_KEYS: Keys = { x: 'x', y: 'y', width: 'width', height: 'height', xOffset: 'xoffset', yOffset: 'yoffset', xAdvance: 'xadvance' };
const PLAIN_KEYS: Keys = { x: 'x', y: 'y', width: 'width', height: 'height', xOffset: 'xOffset', yOffset: 'yOffset', xAdvance: 'xAdvance' };

/** Takes in one tag of the text or XML form: its attributes as strings. */
function take(into: Draft, tag: string, fields: Record<string, string>, where: string): void {
  if (tag === 'info') {
    into.face = fields['face'] ?? '';
    if (fields['size'] !== undefined) into.size = Math.abs(whole(fields, 'size', where));
  } else if (tag === 'common') {
    into.lineHeight = whole(fields, 'lineHeight', where); into.base = whole(fields, 'base', where);
  } else if (tag === 'page') {
    const id = whole(fields, 'id', where), file = fields['file'];
    if (file === undefined || into.pages.has(id)) throw refuse(where + ': page');
    into.pages.set(id, file);
  } else if (tag === 'char') into.glyphs.push(glyphOf(fields, where, BMFONT_KEYS));
  else if (tag === 'kerning') into.kernings.push([whole(fields, 'first', where), whole(fields, 'second', where), whole(fields, 'amount', where)]);
}

function readText(source: string): Draft {
  const into = draft();
  source.split(/\r\n|\r|\n/).forEach((line, index) => {
    const tag = /^\s*(\w+)/.exec(line)?.[1];
    if (tag === undefined) return;
    const fields: Record<string, string> = {};
    for (const match of line.matchAll(/(\w+)=("[^"]*"|\S*)/g)) fields[match[1]!] = match[2]!.startsWith('"') ? match[2]!.slice(1, -1) : match[2]!;
    take(into, tag, fields, 'line ' + (index + 1));
  });
  return into;
}

const ENTITIES: Record<string, string> = { quot: '"', amp: '&', lt: '<', gt: '>', apos: "'" };
function unescape(value: string): string {
  return value.replace(/&(#x[0-9a-fA-F]+|#\d+|\w+);/g, (all, name: string) => {
    if (name.startsWith('#')) {
      const code = name[1] === 'x' ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
      return code <= 0x10ffff ? String.fromCodePoint(code) : all;
    }
    return ENTITIES[name] ?? all;
  });
}
function readXml(source: string): Draft {
  const text = source.replace(/<!--[\s\S]*?-->/g, '');
  if (!/<font[\s>]/.test(text)) throw refuse('xml: no font element');
  const into = draft();
  let count = 0;
  for (const match of text.matchAll(/<(info|common|page|char|kerning)\b([^>]*)>/g)) {
    const fields: Record<string, string> = {};
    for (const attribute of match[2]!.matchAll(/(\w+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) fields[attribute[1]!] = unescape(attribute[2] ?? attribute[3]!);
    take(into, match[1]!, fields, match[1]! + ' element ' + ++count);
  }
  return into;
}

function readJson(value: Record<string, unknown>): Draft {
  const into = draft(), info = value['info'], common = value['common'], pages = value['pages'], chars = value['chars'], kernings = value['kernings'] ?? [];
  if (!record(common) || !Array.isArray(pages) || !Array.isArray(chars) || !Array.isArray(kernings) || (info !== undefined && !record(info))) throw refuse('json: common, pages and chars');
  if (record(info)) {
    if (info['face'] !== undefined && typeof info['face'] !== 'string') throw refuse('json: info.face');
    into.face = (info['face'] as string | undefined) ?? '';
    if (info['size'] !== undefined) into.size = Math.abs(whole(info, 'size', 'json info'));
  }
  into.lineHeight = whole(common, 'lineHeight', 'json common'); into.base = whole(common, 'base', 'json common');
  pages.forEach((file, index) => { if (typeof file !== 'string') throw refuse('json: page ' + index); into.pages.set(index, file); });
  chars.forEach((char, index) => { if (!record(char)) throw refuse('json: char ' + index); into.glyphs.push(glyphOf(char, 'json char ' + index, BMFONT_KEYS)); });
  kernings.forEach((pair, index) => {
    if (!record(pair)) throw refuse('json: kerning ' + index);
    const where = 'json kerning ' + index;
    into.kernings.push([whole(pair, 'first', where), whole(pair, 'second', where), whole(pair, 'amount', where)]);
  });
  return into;
}

/** Egret's own form, from its texture merger: one page, each character a frame named by the character. */
function readEgret(value: Record<string, unknown>): Draft {
  const into = draft(), file = value['file'], frames = value['frames'];
  if (typeof file !== 'string' || !record(frames)) throw refuse('egret: file and frames');
  into.pages.set(0, file);
  let tallest = 0;
  for (const [name, frame] of Object.entries(frames)) {
    if ([...name].length !== 1 || !record(frame)) throw refuse('egret: frame ' + JSON.stringify(name));
    const where = 'egret frame ' + JSON.stringify(name), width = whole(frame, 'w', where), height = whole(frame, 'h', where);
    // A trimmed frame keeps the size it had before it was trimmed: that is its advance, and the tallest is the height of a line.
    const sourceW = whole(frame, 'sourceW', where, width), sourceH = whole(frame, 'sourceH', where, height);
    into.glyphs.push(glyphOf({ id: name.codePointAt(0), x: frame['x'], y: frame['y'], width, height, xOffset: frame['offX'] ?? 0, yOffset: frame['offY'] ?? 0, xAdvance: sourceW }, where, PLAIN_KEYS));
    tallest = Math.max(tallest, sourceH);
  }
  into.lineHeight = tallest; into.base = tallest;
  return into;
}

function finish(into: Draft, format: BitmapFont['format']): BitmapFont {
  const { lineHeight, base } = into;
  if (lineHeight === undefined || base === undefined || lineHeight <= 0) throw refuse(format + ': the height of a line');
  if (into.pages.size === 0 || [...into.pages.keys()].some(id => id < 0 || id >= into.pages.size)) throw refuse(format + ': pages numbered from 0 without a gap');
  const pages = Object.freeze(Array.from({ length: into.pages.size }, (_, id) => into.pages.get(id)!));
  const byCode = new Map<number, BitmapGlyph>();
  for (const glyph of into.glyphs) {
    if (byCode.has(glyph.id)) throw refuse(format + ': character ' + glyph.id + ' twice');
    if (glyph.page < 0 || glyph.page >= pages.length) throw refuse(format + ': character ' + glyph.id + ' on no page');
    byCode.set(glyph.id, glyph);
  }
  const pairs = new Map<number, number>();
  for (const [first, second, amount] of into.kernings) {
    const key = first * 0x110000 + second;
    if (first < 0 || second < 0 || first > 0x10ffff || second > 0x10ffff || pairs.has(key)) throw refuse(format + ': kerning ' + first + ',' + second);
    pairs.set(key, amount);
  }
  const glyphs = Object.freeze([...byCode.values()].sort((a, b) => a.id - b.id));
  const font: BitmapFont = Object.freeze({
    face: into.face, size: into.size ?? lineHeight, lineHeight, base, pages, glyphs, format,
    glyph: (codePoint: number): BitmapGlyph | undefined => byCode.get(codePoint),
    kerning: (first: number, second: number): number => pairs.get(first * 0x110000 + second) ?? 0,
  });
  fonts.add(font);
  return font;
}

/**
 * Reads a bitmap font: the text, XML or JSON forms of BMFont (from AngelCode's generator, Hiero, Glyph Designer, Littera and the like),
 * or Egret's own JSON of frames. A string is read as XML when it starts with `<`, as JSON when it starts with `{`, and as text otherwise;
 * white space and a byte order mark before it are left out.
 */
export function parseBitmapFont(source: string | object): BitmapFont {
  if (typeof source === 'string') {
    const text = source.trimStart();
    if (text.startsWith('<')) return finish(readXml(text), 'xml');
    if (!text.startsWith('{')) return finish(readText(text), 'text');
    let value: unknown;
    try { value = JSON.parse(text); } catch (cause) { throw new EgretError('BITMAP_FONT_INVALID', { cause }); }
    return parseBitmapFont(value as object);
  }
  if (!record(source)) throw refuse('a string or an object');
  return 'frames' in source ? finish(readEgret(source), 'egret') : finish(readJson(source), 'json');
}
