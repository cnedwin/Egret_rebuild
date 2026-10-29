// SPDX-License-Identifier: Apache-2.0
import type { Scope } from '@egret/runtime';
import type { Engine } from './Engine.js';
import type { Paragraph, ParagraphCache } from '@egret/runtime/paragraph';
import { requireTextFieldEngine } from './internal/textFieldFactoryState.js';
export { createParagraphCache } from '@egret/runtime/paragraph';
export type * from '@egret/runtime/paragraph';

/** Optional paragraph assembly authenticates Engine, Scope and exact cache profile. */
export function createParagraph(engine: Engine, scope: Scope, cache: ParagraphCache): Paragraph {
  return requireTextFieldEngine(engine).construct(scope, cache, 'paragraph') as Paragraph;
}
