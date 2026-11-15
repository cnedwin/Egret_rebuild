import type { UiThemeNode } from './theme.js';
import type { UiLayoutNode, UiLayoutTree } from '@egret/runtime/ui';
import type { LayoutNode, UiLeafContent } from './types.js';
export interface CapturedLeafContent {
    readonly identity: UiLeafContent;
    readonly revision: number;
    readonly prepare: UiLeafContent['prepare'];
}
export interface CapturedUiTree {
    readonly themes: ReadonlyMap<string, UiThemeNode>;
    readonly tree: UiLayoutTree;
    readonly contents: ReadonlyMap<string, CapturedLeafContent>;
}
/** Content authority remains in Engine; the runtime tree contains numbers and callbacks only. */
export declare function captureUiTree(input: LayoutNode): CapturedUiTree;
/** Constraint discovery never invokes an authored measure or publishes provisional geometry. */
export declare function leafConstraintTree(tree: UiLayoutTree, contents: ReadonlyMap<string, CapturedLeafContent>, widths: Map<string, number>): UiLayoutTree;
/** The callback captures only frozen numeric metrics, never a Scope, source or display node. */
export declare function fixedLeafMeasurement(width: number, height: number, revision: number): NonNullable<UiLayoutNode['measure']>;
export declare function leafMeasuredTree(tree: UiLayoutTree, measures: ReadonlyMap<string, NonNullable<UiLayoutNode['measure']>>): UiLayoutTree;
//# sourceMappingURL=leafContent.d.ts.map