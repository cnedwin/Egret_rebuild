// SPDX-License-Identifier: Apache-2.0
// Unsuppressed misuse lanes; only actual compiler tuples can establish results.
import {planLinearLayout} from '@egret/engine/layout';
import type {LinearLayoutItem,LinearLayoutOptions,LinearLayoutPlacement,LinearLayoutPlan} from '@egret/engine/layout';
import {planLinearLayout as forbiddenRoot} from '@egret/engine';
declare const options:LinearLayoutOptions;
declare const plan:LinearLayoutPlan;
declare const placement:LinearLayoutPlacement;
declare const item:LinearLayoutItem;
// LINEAR_LAYOUT_CASE required-options
planLinearLayout();
// LINEAR_LAYOUT_CASE required-items
planLinearLayout({axis:'horizontal'});
// LINEAR_LAYOUT_CASE required-axis
planLinearLayout({items:[]});
// LINEAR_LAYOUT_CASE invalid-axis
planLinearLayout({axis:'diagonal',items:[]});
// LINEAR_LAYOUT_CASE invalid-alignment
planLinearLayout({...options,crossAlign:'stretch'});
// LINEAR_LAYOUT_CASE required-item-height
planLinearLayout({...options,items:[{width:1}]});
// LINEAR_LAYOUT_CASE numeric-width
planLinearLayout({...options,items:[{width:'8',height:6}]});
// LINEAR_LAYOUT_CASE numeric-height
planLinearLayout({...options,items:[{width:8,height:false}]});
// LINEAR_LAYOUT_CASE numeric-gap
planLinearLayout({...options,gap:'2'});
// LINEAR_LAYOUT_CASE numeric-padding
planLinearLayout({...options,padding:null});
// LINEAR_LAYOUT_CASE exact-optional-gap
const undefinedGap:LinearLayoutOptions={...options,gap:undefined};
// LINEAR_LAYOUT_CASE exact-optional-padding
const undefinedPadding:LinearLayoutOptions={...options,padding:undefined};
// LINEAR_LAYOUT_CASE exact-optional-alignment
const undefinedAlignment:LinearLayoutOptions={...options,crossAlign:undefined};
// LINEAR_LAYOUT_CASE readonly-plan
plan.width=1;
// LINEAR_LAYOUT_CASE readonly-placement
placement.x=1;
// LINEAR_LAYOUT_CASE readonly-array
plan.placements.push(placement);
// LINEAR_LAYOUT_CASE readonly-array-slot
plan.placements[0]=placement;
// LINEAR_LAYOUT_CASE readonly-options
options.axis='vertical';
// LINEAR_LAYOUT_CASE readonly-item
item.height=9;
// LINEAR_LAYOUT_CASE erased-item
void LinearLayoutItem;
// LINEAR_LAYOUT_CASE erased-options
void LinearLayoutOptions;
// LINEAR_LAYOUT_CASE erased-placement
void LinearLayoutPlacement;
// LINEAR_LAYOUT_CASE erased-plan
void LinearLayoutPlan;
void [forbiddenRoot,undefinedGap,undefinedPadding,undefinedAlignment];
