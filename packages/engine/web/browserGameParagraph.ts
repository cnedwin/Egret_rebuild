// SPDX-License-Identifier: Apache-2.0
// A scope-owned, measured native paragraph. The existing Paragraph and cache own revision,
// cancellation, wrapping, ellipsis, image preparation and delivery.
import { createParagraph, createParagraphCache } from '@egret/engine/paragraph';
import type { Paragraph, ParagraphMetrics, ParagraphRequestInput, ParagraphTextAlign } from '@egret/engine/paragraph';
import type { Engine } from '@egret/engine';
import { EgretError } from '@egret/runtime';
import type { Scope } from '@egret/runtime';
import { createCanvasParagraphProvider } from './CanvasParagraphProvider.js';
import type { CanvasWorkSchedule } from './browserTextWork.js';
import { gameFontFamilies } from './browserGameFamilies.js';

/** Style and width for a wrapped native label. A single family is one literal name; use fontFamilies for a list. */
export interface BrowserGameParagraphLabelOptions {
  readonly text?: string;
  readonly width?: number;
  readonly fontFamily?: string;
  readonly fontFamilies?: readonly string[];
  readonly fontSize?: number;
  readonly lineHeight?: number | undefined;
  readonly color?: number;
  readonly locale?: string;
  readonly direction?: 'ltr' | 'rtl';
  readonly textAlign?: ParagraphTextAlign | undefined;
  /** Optional line cap; overflow ends with the paragraph provider's ellipsis. */
  readonly maxLines?: number | undefined;
}
/** The initial wrapping width is required; ownership defaults to the game's scope. */
export interface BrowserGameParagraphLabelCreateOptions extends BrowserGameParagraphLabelOptions {
  readonly width: number;
  readonly scope?: Scope;
}
export interface BrowserGameParagraphLabel {
  readonly display: Paragraph;
  text: string;
  /** Rejects when preparation fails or this request is superseded; read again after changing the text. */
  readonly ready: Promise<void>;
  /** Metrics of the last committed image, not an estimate of a pending request. */
  readonly metrics: ParagraphMetrics | undefined;
  readonly bounds: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
  set(options: BrowserGameParagraphLabelOptions): void;
  dispose(): void;
}

export function createGameParagraphs(engine: Engine, schedule?: CanvasWorkSchedule) {
  const provider = createCanvasParagraphProvider(schedule === undefined ? {} : { schedule });
  const cache = createParagraphCache(engine.assets, { provider });
  const emptyBounds = Object.freeze({ x: 0, y: 0, width: 0, height: 0 });
  return {
    create(
      scope: Scope,
      given: BrowserGameParagraphLabelOptions,
      density: number,
      onFailure: (cause: unknown) => void
    ): BrowserGameParagraphLabel {
      const display = createParagraph(engine, scope, cache);
      let request: ParagraphRequestInput = {
        text: '',
        width: 1,
        fontFamilies: ['sans-serif'],
        fontSize: 24,
        locale: 'en',
        direction: 'ltr',
        fillColor: 0xffffff,
        density
      };
      let ready = Promise.resolve();
      const set = (next: BrowserGameParagraphLabelOptions): void => {
        if (next === null || typeof next !== 'object') throw new EgretError('BROWSER_GAME_OPTIONS_INVALID');
        const families = gameFontFamilies(next, request.fontFamilies);
        const lineHeight = 'lineHeight' in next ? next.lineHeight : request.lineHeight;
        const textAlign = 'textAlign' in next ? next.textAlign : request.textAlign;
        const maxLines = 'maxLines' in next ? next.maxLines : request.maxLines;
        const proposed: ParagraphRequestInput = {
          text: next.text === undefined ? request.text : next.text,
          width: next.width === undefined ? request.width : next.width,
          fontFamilies: families,
          fontSize: next.fontSize === undefined ? request.fontSize : next.fontSize,
          locale: next.locale === undefined ? request.locale : next.locale,
          direction: next.direction === undefined ? request.direction : next.direction,
          fillColor: next.color === undefined ? request.fillColor : next.color,
          density,
          ...(lineHeight === undefined ? {} : { lineHeight }),
          ...(textAlign === undefined ? {} : { textAlign }),
          ...(maxLines === undefined ? {} : { maxLines })
        };
        // The public Paragraph snapshots and validates before superseding the old request.
        display.setRequest(proposed);
        request = proposed;
        const job = display.prepare().then(() => undefined);
        ready = job;
        void job.catch(cause => {
          if (
            ready === job &&
            !display.isDisposed &&
            !(cause instanceof EgretError && cause.code === 'PARAGRAPH_STALE')
          )
            onFailure(cause);
        });
      };
      try {
        set(given);
      } catch (cause) {
        display.dispose();
        throw cause;
      }
      return Object.freeze({
        display,
        get text() {
          return request.text;
        },
        set text(value: string) {
          if (request.text !== value) set({ text: value });
        },
        get ready() {
          return ready;
        },
        get metrics() {
          return display.getStatus().metrics;
        },
        get bounds() {
          const metric = display.getStatus().metrics;
          return metric === undefined
            ? emptyBounds
            : Object.freeze({ x: 0, y: 0, width: metric.width, height: metric.height });
        },
        set,
        dispose() {
          display.dispose();
        }
      });
    },
    dispose() {
      try {
        cache.dispose();
      } finally {
        provider.dispose();
      }
    }
  };
}
