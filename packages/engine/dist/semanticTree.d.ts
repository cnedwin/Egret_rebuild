import type { DisplayObject } from '@egret/runtime';
import type { SemanticBounds, UiSemantics, UiSemanticsOptions } from './semanticTypes.js';
/**
 * The rectangle on the stage that encloses a display object and what it holds, for the bounds of
 * a node. It is measured when it is called, so call it from `describe`.
 */
export declare function semanticBoundsOf(target: DisplayObject): SemanticBounds;
/** A semantic tree for the controls an application draws. It reads them; it holds no state of theirs. */
export declare function createUiSemantics(options?: UiSemanticsOptions): UiSemantics;
//# sourceMappingURL=semanticTree.d.ts.map