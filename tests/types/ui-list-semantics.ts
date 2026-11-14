// SPDX-License-Identifier: Apache-2.0
// A strict consumer of the list semantics: the root of the UI entry is its source as it is, and seven things it may not write.
import {createUiListSemantics,createUiSemantics,semanticBoxOf} from '@egret/engine/ui/semantics';
import type {SemanticBounds,SemanticListRow,SemanticListSource,UiListSemantics,UiListSemanticsOptions} from '@egret/engine/ui/semantics';
import type {UiRoot} from '@egret/engine/ui';
declare const root:UiRoot;
const semantics=createUiSemantics();
// The managed root is a source without an adapter.
const source:SemanticListSource=root;void source;
const options:UiListSemanticsOptions={semantics,root,list:'players',id:'players',parent:'screen',role:'listbox',name:'Players',focusable:true,multiple:true,hidden:():boolean=>false,
 describeRow:(key:string,index:number):SemanticListRow=>({name:key+index,selected:index===0,disabled:false}),
 onActivateRow:(key:string)=>{void key;},onRowAdded:(key:string,id:string)=>{void key;void id;}};
const rows:UiListSemantics=createUiListSemantics(options);
const id:string=rows.id,row:string=rows.rowId('k1');void id;void row;
semantics.publish(rows.sync());
rows.dispose();
createUiListSemantics({semantics,root,list:'players'}).dispose();
// The rows of the list as the rows of a grid, under a row of headers the application publishes. A cell is measured from its row.
const table:UiListSemantics=createUiListSemantics({semantics,root,list:'players',role:'grid',columns:4,rowOffset:1,multiple:true,describeRow:(key:string):SemanticListRow=>({selected:key==='k1'})});
const part:SemanticBounds|undefined=table.rowBounds('k1');void part;table.dispose();
// A box of the root is measured for a node of the application's own.
const title:SemanticBounds=semanticBoxOf(root,'title');void title;
// @ts-expect-error a box is named by its id
semanticBoxOf(root);
// @ts-expect-error a list is named by its id in the tree of the root
createUiListSemantics({semantics,root});
// @ts-expect-error a root is read through its snapshot and its lists
createUiListSemantics({semantics,root:{id:'panel'},list:'players'});
// @ts-expect-error rows are list items, options, menu items or rows of a grid
createUiListSemantics({semantics,root,list:'players',role:'tree'});
// @ts-expect-error a name is text
createUiListSemantics({semantics,root,list:'players',describeRow:()=>({name:7})});
// @ts-expect-error the id of the list is read-only
rows.id='other';
// @ts-expect-error the UI entry does not have the factory
import {createUiListSemantics as leaked} from '@egret/engine/ui';
void leaked;
