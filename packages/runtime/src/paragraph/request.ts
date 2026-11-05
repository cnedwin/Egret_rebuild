// SPDX-License-Identifier: Apache-2.0
import { EgretError } from '../EgretError.js';
import type { ParagraphRequestInput, ParagraphRequest, ParagraphRaster, ParagraphMetrics, ParagraphStyleRun } from './types.js';
import { isImageData2D } from '@egret/contracts';

function number(value: unknown, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) throw new EgretError('PARAGRAPH_REQUEST_INVALID');
  return value === 0 ? 0 : value;
}
function text(value: unknown, max: number, empty = false): string {
  if (typeof value !== 'string' || value.length > max || (!empty && !value.length)) throw new EgretError('PARAGRAPH_REQUEST_INVALID');
  return value;
}
function families(value: unknown): readonly string[] {
  if (!Array.isArray(value)) throw new EgretError('PARAGRAPH_REQUEST_INVALID');
  const count = value.length;
  if (!Number.isSafeInteger(count) || count < 1 || count > 16) throw new EgretError('PARAGRAPH_REQUEST_INVALID');
  const result: string[] = [];
  for (let index = 0; index < count; index++) result.push(text(value[index], 256));
  return Object.freeze(result);
}
function runs(value: unknown, source: string): readonly ParagraphStyleRun[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) throw new EgretError('PARAGRAPH_REQUEST_INVALID');
  const count = value.length;
  // Bound caller-controlled counts before allocating or reading any element.
  if (!Number.isSafeInteger(count) || count < 0 || count > 256) throw new EgretError('PARAGRAPH_REQUEST_INVALID');
  if (count === 0) return undefined;
  const result: ParagraphStyleRun[] = [];
  let previous = 0;
  const boundary = (offset: number): boolean => {
    const before = source.charCodeAt(offset - 1), after = source.charCodeAt(offset);
    return !(before >= 0xd800 && before <= 0xdbff && after >= 0xdc00 && after <= 0xdfff)
      && !(before === 13 && after === 10);
  };
  for (let index = 0; index < count; index++) {
    const row = value[index];
    if (row === null || typeof row !== 'object' || Array.isArray(row)) throw new EgretError('PARAGRAPH_REQUEST_INVALID');
    const start = number(row.start, previous, source.length), end = number(row.end, start, source.length);
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start === end || !boundary(start) || !boundary(end)) throw new EgretError('PARAGRAPH_REQUEST_INVALID');
    const familyInput = row.fontFamilies, sizeInput = row.fontSize, colorInput = row.fillColor;
    if (familyInput === undefined && sizeInput === undefined && colorInput === undefined) throw new EgretError('PARAGRAPH_REQUEST_INVALID');
    const fontFamilies = familyInput === undefined ? undefined : families(familyInput);
    const fontSize = sizeInput === undefined ? undefined : number(sizeInput, 1, 512);
    const fillColor = colorInput === undefined ? undefined : number(colorInput, 0, 0xffffff);
    if (fillColor !== undefined && !Number.isInteger(fillColor)) throw new EgretError('PARAGRAPH_REQUEST_INVALID');
    result.push(Object.freeze({start, end, ...(fontFamilies === undefined ? {} : {fontFamilies}),
      ...(fontSize === undefined ? {} : {fontSize}), ...(fillColor === undefined ? {} : {fillColor})}));
    previous = end;
  }
  return Object.freeze(result);
}
/** Snapshot caller values before queueing: later request/style mutations have no authority. */
export function snapshotParagraphRequest(input: ParagraphRequestInput): ParagraphRequest {
  if (input === null || typeof input !== 'object') throw new EgretError('PARAGRAPH_REQUEST_INVALID');
  const source = text(input.text, 8192, true), width = number(input.width, 0.25, 4096);
  const fontFamilies = families(input.fontFamilies);
  const fontSize = number(input.fontSize, 1, 512), lineHeightInput = input.lineHeight;
  const lineHeight = lineHeightInput === undefined ? undefined : number(lineHeightInput, 1, 1024);
  const locale = text(input.locale, 64), direction = input.direction;
  const authoredAlign = input.textAlign;
  if (authoredAlign !== undefined && !['left','right','center','start','end','justify'].includes(authoredAlign)) throw new EgretError('PARAGRAPH_REQUEST_INVALID');
  // Keep the original canonical request and cache key for an explicit left default.
  const textAlign = authoredAlign === 'left' ? undefined : authoredAlign;
  const geometryInput=input.textGeometry;
  if(geometryInput!==undefined&&typeof geometryInput!=='boolean')throw new EgretError('PARAGRAPH_REQUEST_INVALID');
  const textGeometry=geometryInput===true;
  const authoredMaxLines = input.maxLines;
  const maxLines = authoredMaxLines === undefined ? undefined : number(authoredMaxLines, 1, 8193);
  if (maxLines !== undefined && !Number.isSafeInteger(maxLines)) throw new EgretError('PARAGRAPH_REQUEST_INVALID');
  const fillColor = number(input.fillColor, 0, 0xffffff), density = number(input.density, 0.25, 4);
  if (!Number.isInteger(fillColor) || (direction !== 'ltr' && direction !== 'rtl') || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(source)) throw new EgretError('PARAGRAPH_REQUEST_INVALID');
  // Reject ill-formed UTF16 rather than silently changing public source offsets.
  for (let i = 0; i < source.length; i++) {
    const unit = source.charCodeAt(i);
    if (unit >= 0xd800 && unit <= 0xdbff) { const low = source.charCodeAt(++i); if (!(low >= 0xdc00 && low <= 0xdfff)) throw new EgretError('PARAGRAPH_REQUEST_INVALID'); }
    else if (unit >= 0xdc00 && unit <= 0xdfff) throw new EgretError('PARAGRAPH_REQUEST_INVALID');
  }
  const styled = runs(input.runs, source);
  const authoredFontSet=input.fontSet;
  const fontSet=authoredFontSet===undefined?undefined:text(authoredFontSet,256);
  return Object.freeze({...(fontSet===undefined?{}:{fontSet}),text: source, width, fontFamilies, fontSize, ...(lineHeight === undefined ? {} : {lineHeight}), locale, direction, fillColor, density, ...(textAlign === undefined ? {} : {textAlign}), ...(maxLines === undefined ? {} : {maxLines}), ...(textGeometry?{textGeometry:true}:{}), ...(styled === undefined ? {} : {runs: styled})});
}
/** Own public metrics; provider memory or mutable arrays never become committed UI state. */
export function snapshotParagraphRaster(value: ParagraphRaster, request: ParagraphRequest): ParagraphRaster {
  try {
    const metrics = value.metrics;
    const authored = metrics.lines, count = authored.length;
    if (metrics.width !== request.width || !Array.isArray(authored) || !Number.isSafeInteger(count) || count > 8193 || count < 0) throw new Error('Invalid paragraph layout');
    const height = number(metrics.height, 0, 1048576);
    const truncated = request.maxLines === undefined ? undefined : metrics.truncated;
    if (request.maxLines !== undefined && (count > request.maxLines || typeof truncated !== 'boolean' || (truncated && !request.text.length))) throw new Error('Invalid paragraph line-clamp result');
    let previous = 0, baseline = -1;
    const copied = [];
    for (let index = 0; index < count; index++) {
      const line = authored[index]!;
      const start = number(line.start, 0, request.text.length), end = number(line.end, start, request.text.length);
      if (!Number.isInteger(start) || !Number.isInteger(end) || start < previous) throw new Error('Invalid source range');
      previous = end;
      const y = number(line.baseline, 0, height + 1024);
      if (y < baseline) throw new Error('Invalid line order');
      baseline = y;
      copied.push(Object.freeze({start, end, baseline: y, ascent: number(line.ascent, 0, 1048576), descent: number(line.descent, 0, 1048576), height: number(line.height, 0, 1048576), width: number(line.width, 0, 1048576)}));
    }
    const lines = Object.freeze(copied);
    const owned: ParagraphMetrics = Object.freeze({width: request.width, height, lines, ...(truncated === undefined ? {} : {truncated})});
    const image = value.image;
    if (image !== undefined && !isImageData2D(image)) throw new Error('Invalid paragraph image');
    const offsetX = number(value.offsetX, -1048576, 1048576), offsetY = number(value.offsetY, -1048576, 1048576);
    return Object.freeze({metrics: owned, image, offsetX, offsetY, ...(request.textGeometry?{geometry:value.geometry}: {})});
  } catch (cause) { throw new EgretError('PARAGRAPH_PROVIDER_RESULT_INVALID', {cause}); }
}
