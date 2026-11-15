import { requireTextFieldEngine } from './internal/textFieldFactoryState.js';
export { createParagraphCache } from '@egret/runtime/paragraph';
/** Optional paragraph assembly authenticates Engine, Scope and exact cache profile. */
export function createParagraph(engine, scope, cache) {
    return requireTextFieldEngine(engine).construct(scope, cache, 'paragraph');
}
//# sourceMappingURL=paragraph.js.map