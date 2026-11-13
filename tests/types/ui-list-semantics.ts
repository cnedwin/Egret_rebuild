// SPDX-License-Identifier: Apache-2.0
// A strict consumer of the list semantics: the root of the UI entry is its source as it is, and six things it may not write.
import {createUiListSemantics,createUiSemantics} from '@egret/engine/ui/semantics';
import type {SemanticListRow,SemanticListSource,UiListSemantics,UiListSemanticsOptions} from '@egret/engine/ui/semantics';
import type {UiRoot} from '@egret/engine/ui';
declare const root:UiRoot;
const semantics=createUiSemantics();
// The managed root is a source without an adapter.
const source:SemanticListSource=root;void source;
const options:UiListSemanticsOptions={semantics,root,list:'players',id:'players',parent:'screen',role:'listbox',name:'Players',focusable:true,
 describeRow:(key:string,index:number):SemanticListRow=>({name:key+index,selected:index===0,disabled:false}),
 onActivateRow:(key:string)=>{void key;},onRowAdded:(key:string,id:string)=>{void key;void id;}};
const rows:UiListSemantics=createUiListSemantics(options);
const id:string=rows.id,row:string=rows.rowId('k1');void id;void row;
semantics.publish(rows.sync());
rows.dispose();
createUiListSemantics({semantics,root,list:'players'}).dispose();
// @ts-expect-error a list is named by its id in the tree of the root
createUiListSemantics({semantics,root});
// @ts-expect-error a root is read through its snapshot and its lists
createUiListSemantics({semantics,root:{id:'panel'},list:'players'});
// @ts-expect-error rows are list items or options
createUiListSemantics({semantics,root,list:'players',role:'grid'});
// @ts-expect-error a name is text
createUiListSemantics({semantics,root,list:'players',describeRow:()=>({name:7})});
// @ts-expect-error the id of the list is read-only
rows.id='other';
// @ts-expect-error the UI entry does not have the factory
import {createUiListSemantics as leaked} from '@egret/engine/ui';
void leaked;
