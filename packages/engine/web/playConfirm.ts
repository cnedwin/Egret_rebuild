// SPDX-License-Identifier: Apache-2.0
// Internal confirm layout. The browser supplies the same font measurement as its text rasterizer.
import { EgretError } from '@egret/runtime';
import { checkView, DEFAULT_VIEW_SKIN } from './view.js';
import type { ViewDescription, ViewPart, ViewSkin } from './view.js';

interface ConfirmSpace {
  readonly width: number;
  readonly height: number;
  readonly cssScale: number;
}
export interface ConfirmCopy {
  readonly message: string;
  readonly title?: string;
  readonly yes: string;
  readonly no: string;
  readonly skin?: Partial<ViewSkin>;
  readonly noColor: number;
}
type Measure = (words: string, size: number, bold: boolean) => number;

const invalid = (cause: unknown) => new EgretError('UI_VIEW_BINDING_INVALID', { cause });
/** Snapshot all copy and theme fields at the point confirm is called, before it takes a turn in the queue. */
export function prepareConfirmCopy(message: unknown, options: unknown): ConfirmCopy {
  if (typeof message !== 'string' || options === null || typeof options !== 'object')
    throw invalid('confirm takes words and { yes, no, title, skin, noColor }');
  const actual = options as Record<string, unknown>;
  const words = (key: 'yes' | 'no' | 'title'): string | undefined => {
    const value = actual[key];
    if (value !== undefined && (typeof value !== 'string' || value.length > 8192))
      throw invalid('confirm: ' + key + ' is words of at most 8192 code units');
    return value;
  };
  if (message.length > 8192) throw invalid('confirm: question is at most 8192 code units');
  const yes = words('yes') ?? 'OK',
    no = words('no') ?? 'Cancel',
    title = words('title');
  let skin: Partial<ViewSkin> | undefined;
  const rawSkin = actual.skin;
  if (rawSkin !== undefined) {
    if (rawSkin === null || typeof rawSkin !== 'object' || Array.isArray(rawSkin))
      throw invalid('confirm: skin is a view skin');
    skin = Object.freeze({ ...rawSkin });
    try {
      checkView({ root: { type: 'space' }, skin });
    } catch (cause) {
      throw invalid(cause);
    }
    if (skin.size !== undefined && (skin.size < 1 || skin.size > 512)) throw invalid('confirm: skin size is 1 to 512');
  }
  const rawColor = actual.noColor,
    noColor = rawColor === undefined ? 0x475569 : rawColor;
  if (typeof noColor !== 'number' || !Number.isSafeInteger(noColor) || noColor < 0 || noColor > 0xffffff)
    throw invalid('confirm: noColor is an RGB colour');
  return Object.freeze({
    message,
    yes,
    no,
    noColor,
    ...(title === undefined ? {} : { title }),
    ...(skin === undefined ? {} : { skin })
  });
}

// Prefer spaces and CJK break opportunities; if a word alone exceeds the width, split its graphemes.
function wrapped(words: string, width: number, size: number, bold: boolean, measure: Measure): string[] {
  const lines: string[] = [];
  const take = (word: string): number => measure(word, size, bold);
  const maxWidth = Math.max(1, width);
  for (const paragraph of words.split(/\r\n?|\n/u)) {
    const pieces =
      paragraph.match(
        /[\u2e80-\u9fff\uac00-\ud7af\uf900-\ufaff\uff00-\uffef]|\s+|[^\s\u2e80-\u9fff\uac00-\ud7af\uf900-\ufaff\uff00-\uffef]+/gu
      ) ?? [];
    let line = '';
    const finish = (): void => {
      lines.push(line.trimEnd());
      line = '';
    };
    for (const piece of pieces) {
      if (/^\s+$/u.test(piece)) {
        if (line && take(line + piece) <= maxWidth) line += piece;
        else if (line) finish();
        continue;
      }
      if (take(line + piece) <= maxWidth) {
        line += piece;
        continue;
      }
      if (line) finish();
      if (take(piece) <= maxWidth) {
        line = piece;
        continue;
      }
      const letters =
        typeof Intl.Segmenter === 'function'
          ? Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(piece), item => item.segment)
          : [...piece];
      for (const letter of letters) {
        if (line && take(line + letter) > maxWidth) finish();
        line += letter;
      }
    }
    finish();
  }
  return lines;
}
const textHeight = (lines: number, size: number): number =>
  Math.ceil(size * 1.4 + Math.max(0, lines - 1) * size * 1.25);

function clipLabel(rows: string[], height: number, width: number, size: number, measure: Measure): string {
  // A physically tiny safe area cannot show an arbitrarily long button and the other action together.
  // Keep the original accessible label and abbreviate only when both complete layouts cannot fit.
  if (height < size * 1.25 || width < measure('…', size, true)) return '';
  const count = Math.max(1, Math.floor((height - 12) / (size * 1.25)));
  if (rows.length <= count) return rows.join('\n');
  const shown = rows.slice(0, count);
  let last = shown[count - 1]!;
  while (last && measure(last + '…', size, true) > width) last = [...last].slice(0, -1).join('');
  shown[count - 1] = last + '…';
  return shown.join('\n');
}

/** A confirm uses view-local safe space; only the touch minimum is converted from CSS pixels. */
export function planConfirmLayout(copy: ConfirmCopy, screen: ConfirmSpace, measure: Measure): ViewDescription {
  const { width: availableWidth, height: availableHeight, cssScale } = screen;
  const width = Math.min(440, Math.max(0, availableWidth - Math.min(32, availableWidth * 0.12)));
  const maximumHeight = Math.max(0, availableHeight - Math.min(24, availableHeight * 0.1));
  const padding = Math.min(20, Math.floor(width / 10), Math.floor(maximumHeight / 10));
  const innerWidth = Math.max(0, width - padding * 2),
    innerLimit = Math.max(0, maximumHeight - padding * 2),
    gap = Math.min(14, Math.floor(innerLimit / 12)),
    buttonGap = Math.min(12, Math.floor(innerWidth / 10), Math.floor(innerLimit / 12));
  const size = Math.min(copy.skin?.size ?? DEFAULT_VIEW_SKIN.size, Math.max(1, innerWidth / 2)),
    titleSize = Math.min(512, Math.round((size * 26) / 24)),
    buttonSize = Math.max(1, Math.round(size * 0.9));
  const messageLines = innerWidth <= 1 ? [''] : wrapped(copy.message, innerWidth - 2, size, false, measure);
  const titleLines =
    copy.title === undefined
      ? []
      : innerWidth <= 1
        ? ['']
        : wrapped(copy.title, innerWidth - 2, titleSize, true, measure);
  const buttons = [copy.no, copy.yes];
  const sideWidth = (innerWidth - buttonGap) / 2;
  const sideLines = buttons.map(words => wrapped(words, sideWidth - 16, buttonSize, true, measure));
  const tallLines = buttons.map(words => wrapped(words, innerWidth - 16, buttonSize, true, measure));
  const target = Math.max(48, Math.ceil(44 / Math.max(Number.EPSILON, cssScale))),
    buttonHeight = (rows: string[]) => Math.max(target, textHeight(rows.length, buttonSize) + 12);
  const sideHeight = Math.max(...sideLines.map(buttonHeight)),
    tallHeights = tallLines.map(buttonHeight),
    tallTotal = tallHeights[0]! + tallHeights[1]! + buttonGap;
  const bodyMinimum = Math.min(innerLimit / 3, textHeight(1, size));
  const actionLimit = Math.max(0, innerLimit - gap * 2 - bodyMinimum);
  const stacked = (sideWidth * cssScale < 44 || sideLines.some(rows => rows.length > 1)) && tallTotal <= actionLimit;
  const realRows = stacked ? tallLines : sideLines;
  const actionHeight = Math.min(actionLimit, stacked ? tallTotal : sideHeight);
  const buttonHeights = stacked ? tallHeights : [actionHeight, actionHeight];
  const buttonWidth = stacked ? innerWidth : sideWidth;
  const actions: ViewPart = {
    type: 'panel',
    layout: stacked ? 'column' : 'row',
    gap: buttonGap,
    height: actionHeight,
    children: (['no', 'yes'] as const).map((name, index) => ({
      type: 'button',
      name,
      text: clipLabel(realRows[index]!, buttonHeights[index]!, buttonWidth - 16, buttonSize, measure),
      width: 'fill',
      height: buttonHeights[index]!,
      size: buttonSize,
      ...(name === 'no' ? { color: copy.noColor } : {})
    }))
  };

  const body: ViewPart[] = [];
  let y = 0;
  // Each single-line text texture has a source-line and raster-size limit. Keep long questions in bounded chunks.
  function append(lines: string[], font: number, bold: boolean, name: string): void {
    const chunkSize = Math.max(1, Math.min(16, Math.floor(1024 / (font * 1.25))));
    for (let at = 0; at < lines.length; at += chunkSize) {
      const chunk = lines.slice(at, at + chunkSize),
        height = textHeight(chunk.length, font);
      body.push({
        type: 'text',
        ...(at === 0 ? { name } : { semantic: false }),
        text: chunk.join('\n'),
        x: 0,
        y,
        width: innerWidth,
        height,
        size: font,
        align: 'center',
        ...(bold ? { bold: true } : {})
      });
      y += height;
    }
  }
  if (titleLines.length) {
    append(titleLines, titleSize, true, 'confirmTitle');
    y += gap;
  }
  append(messageLines, size, false, 'question');
  const bodyHeight = Math.min(y, Math.max(0, innerLimit - actionHeight - gap * 2));
  const height = Math.min(
    maximumHeight,
    Math.max(copy.title === undefined ? 168 : 212, padding * 2 + bodyHeight + actionHeight + gap * 2)
  );
  const copyPanel: ViewPart = {
    type: 'panel',
    layout: 'free',
    height: bodyHeight,
    ...(bodyHeight < y ? { name: 'confirmCopy', scroll: 'vertical' } : {}),
    children: body
  };
  return {
    label: copy.title ?? copy.message,
    modal: true,
    ...(copy.skin === undefined ? {} : { skin: copy.skin }),
    root: {
      type: 'panel',
      card: true,
      alpha: copy.skin?.panelAlpha ?? 1,
      anchor: 'center',
      width,
      height,
      padding,
      layout: 'column',
      gap,
      children: [copyPanel, { type: 'space', height: 'fill' }, actions]
    }
  };
}
