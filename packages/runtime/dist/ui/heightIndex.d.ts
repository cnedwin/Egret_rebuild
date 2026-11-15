import type { UiHeightRecord, UiHeightUpdate, UiHeightView, UiHeightJournal, UiRowRange, UiScrollAnchor } from './types.js';
declare abstract class HeightView implements UiHeightView {
    abstract readonly size: number;
    abstract readonly totalHeight: number;
    abstract readonly measuredCount: number;
    abstract keyAt(i: number): string;
    abstract versionAt(i: number): number;
    abstract heightAt(i: number): number;
    abstract indexOf(k: string): number;
    protected abstract cell(i: number): number;
    prefix(end: number): number;
    find(offset: number): number;
    clampScroll(scroll: number, viewport: number): number;
    range(scroll: number, viewport: number, overscan?: number): UiRowRange;
    anchor(scroll: number): UiScrollAnchor | undefined;
    preserveAnchor(anchor: UiScrollAnchor | undefined, old: UiHeightView, viewport: number): number;
}
/** O(n) structural rebuild; point candidates retain only sparse changed cells. */
export declare class UiHeightIndex extends HeightView {
    #private;
    constructor(records: readonly UiHeightRecord[], width: number, density: number, previous?: UiHeightIndex);
    get size(): number;
    get totalHeight(): number;
    get measuredCount(): number;
    /** Numeric typed-array bytes only; string, map and JS heap storage excluded. */
    get logicalBytes(): number;
    keyAt(i: number): string;
    versionAt(i: number): number;
    heightAt(i: number): number;
    indexOf(k: string): number;
    protected cell(i: number): number;
    stageHeights(updates: readonly UiHeightUpdate[]): UiHeightJournal;
}
export {};
//# sourceMappingURL=heightIndex.d.ts.map