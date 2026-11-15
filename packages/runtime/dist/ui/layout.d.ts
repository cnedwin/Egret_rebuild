import type { UiLayoutNode, UiLayoutTree, UiLayoutPlan, UiDirtyKind, UiSize } from './types.js';
/** Bounded capture reads each authored property once and retains no mutable child arrays. */
export declare function captureUiLayout(tree: UiLayoutNode, limits?: {
    readonly maxNodes?: number;
    readonly maxDepth?: number;
}): UiLayoutTree;
/** One postorder measure and preorder arrange. No convergence callbacks or live scene writes. */
export declare function planUiLayout(tree: UiLayoutTree, viewport: UiSize, density: number, previous?: UiLayoutPlan, dirty?: ReadonlyMap<string, UiDirtyKind>): UiLayoutPlan;
//# sourceMappingURL=layout.d.ts.map