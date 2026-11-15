import type { UiLayoutTree } from '@egret/runtime/ui';
export interface UiThemeTypography {
    readonly fontFamily: string;
    readonly fontSize: number;
    readonly lineHeight: number;
}
/** Skin names resolve through application-owned, typed asset references, never URLs. */
export interface UiThemeSkin {
    readonly default: string;
    readonly hover?: string;
    readonly pressed?: string;
    readonly disabled?: string;
    readonly focus?: string;
    readonly checked?: string;
    readonly selected?: string;
    readonly expanded?: string;
}
export interface UiThemeDescriptor {
    readonly id: string;
    readonly colors?: Readonly<Record<string, number>>;
    readonly spacing?: Readonly<Record<string, number>>;
    readonly typography?: Readonly<Record<string, UiThemeTypography>>;
    readonly skins?: Readonly<Record<string, UiThemeSkin>>;
}
declare const themeBrand: unique symbol;
/** Every factory result is a distinct immutable generation, including equal descriptors. */
export interface UiTheme {
    readonly [themeBrand]: true;
    readonly id: string;
    readonly colors: Readonly<Record<string, number>>;
    readonly spacing: Readonly<Record<string, number>>;
    readonly typography: Readonly<Record<string, UiThemeTypography>>;
    readonly skins: Readonly<Record<string, UiThemeSkin>>;
}
export interface UiThemeNode {
    readonly fill?: string;
    readonly padding?: string;
    readonly gap?: string;
}
export declare function createUiTheme(descriptor: UiThemeDescriptor): UiTheme;
/** The states of a control that a skin may have a name for. */
export type UiSkinStateName = Exclude<keyof UiThemeSkin, 'default'>;
export type UiSkinState = {
    readonly [Name in UiSkinStateName]?: boolean;
};
/**
 * The name a skin gives to the state of a control: of the states that hold, the first in `order`
 * that the skin has a name for, and `default` when it has none. The usual order is the one a player
 * reads a control in: unavailable, held, set, focused, pointed at. A state left out of `order` is
 * never chosen.
 */
export declare function selectUiSkin(skin: UiThemeSkin, state?: UiSkinState, order?: readonly UiSkinStateName[]): string;
export declare function requireUiTheme(value: UiTheme | undefined): void;
export declare function sameThemeMetrics(a: UiTheme | undefined, b: UiTheme | undefined): boolean;
export declare function captureThemeNode(value: unknown): UiThemeNode;
/** Resolve a captured numeric tree without callbacks or resource acquisition. */
export declare function applyUiTheme(tree: UiLayoutTree, bindings: ReadonlyMap<string, UiThemeNode>, theme: UiTheme | undefined): UiLayoutTree;
export {};
//# sourceMappingURL=theme.d.ts.map