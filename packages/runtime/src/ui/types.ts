// SPDX-License-Identifier: Apache-2.0
/** Numeric implementation contracts; Engine owns display and source admission. */
export type UiDirtyKind = 'measure' | 'arrange' | 'paint' | 'interaction' | 'semantic';
export interface UiSize { readonly width:number; readonly height:number }
export interface UiMeasureInput { readonly availableWidth:number; readonly availableHeight:number; readonly density:number }
export interface UiMeasurement extends UiSize { readonly dependencyRevision:number }
export interface UiFill { readonly color:number; readonly alpha?:number }
export interface UiLayoutNode {
 readonly id:string; readonly kind:'leaf'|'row'|'column'|'virtualList';
 readonly explicitWidth?:number; readonly explicitHeight?:number;
 readonly minWidth?:number; readonly minHeight?:number; readonly maxWidth?:number; readonly maxHeight?:number;
 readonly padding?:number; readonly gap?:number; readonly crossAlign?:'start'|'center'|'end'|'stretch';
 readonly children?:readonly UiLayoutNode[]; readonly measure?:(input:UiMeasureInput)=>UiMeasurement;
 readonly fill?:UiFill; readonly source?:unknown; readonly initialScrollOffset?:number;
}
export interface UiLayoutTree { readonly root:UiLayoutNode; readonly nodes:ReadonlyMap<string,UiLayoutNode> }
export interface UiLayoutBox extends UiSize {
 readonly id:string; readonly parentId:string|undefined; readonly order:number; readonly x:number; readonly y:number;
 readonly innerX:number; readonly innerY:number; readonly innerWidth:number; readonly innerHeight:number;
 readonly clip:boolean; readonly dependencyRevision:number;
}
export interface UiLayoutPlan { readonly boxes:readonly UiLayoutBox[]; readonly measurementCalls:number; readonly reusedMeasurements:number }
export interface UiHeightRecord { readonly key:string; readonly contentVersion:number; readonly estimatedHeight:number }
export interface UiHeightUpdate { readonly key:string; readonly contentVersion:number; readonly height:number }
export interface UiScrollAnchor { readonly key:string; readonly offset:number }
export interface UiRowRange { readonly start:number; readonly end:number; readonly visibleStart:number; readonly visibleEnd:number }
export interface UiHeightView {
 readonly size:number; readonly totalHeight:number; readonly measuredCount:number;
 keyAt(index:number):string; versionAt(index:number):number; heightAt(index:number):number; indexOf(key:string):number;
 prefix(end:number):number; find(offset:number):number; range(scroll:number,viewport:number,overscan?:number):UiRowRange;
 anchor(scroll:number):UiScrollAnchor|undefined; clampScroll(scroll:number,viewport:number):number;
 preserveAnchor(anchor:UiScrollAnchor|undefined,old:UiHeightView,viewport:number):number;
}
export interface UiHeightJournal extends UiHeightView { readonly cellWork:number; readonly changedCount:number; apply():void }
