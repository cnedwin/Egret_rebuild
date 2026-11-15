import type { Scope } from '@egret/runtime';
import type { Engine } from './Engine.js';
import type { Paragraph, ParagraphCache } from '@egret/runtime/paragraph';
export { createParagraphCache } from '@egret/runtime/paragraph';
export type * from '@egret/runtime/paragraph';
/** Optional paragraph assembly authenticates Engine, Scope and exact cache profile. */
export declare function createParagraph(engine: Engine, scope: Scope, cache: ParagraphCache): Paragraph;
//# sourceMappingURL=paragraph.d.ts.map