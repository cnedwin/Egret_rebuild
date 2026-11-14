// SPDX-License-Identifier: Apache-2.0
// A strict consumer of the two semantics entries: what it may write, and nine things it may not.
import {createUiSemantics,semanticBoundsOf} from '@egret/engine/ui/semantics';
import type {SemanticAction,SemanticBounds,SemanticChecked,SemanticDescription,SemanticNode,SemanticNodeOptions,SemanticOrientation,SemanticPosition,SemanticRange,SemanticRole,SemanticSnapshot,SemanticSnapshotNode,SemanticsState,UiSemantics,UiSemanticsOptions} from '@egret/engine/ui/semantics';
import {createBrowserSemantics} from '@egret/engine/web/semantics';
import type {BrowserSemantics,BrowserSemanticsOptions} from '@egret/engine/web/semantics';
import type {DisplayObject} from '@egret/engine';
import type {ToggleControl} from '@egret/engine/ui';
declare const canvas:HTMLCanvasElement,target:DisplayObject,toggle:ToggleControl;
const limits:UiSemanticsOptions={maxNodes:64};
const semantics:UiSemantics=createUiSemantics(limits),plain:UiSemantics=createUiSemantics();void plain;
const bounds:SemanticBounds=semanticBoundsOf(target);
const range:SemanticRange={now:1,min:0,max:2},position:SemanticPosition={index:1,size:3},orientation:SemanticOrientation='horizontal',mixed:SemanticChecked='mixed';
const description:SemanticDescription={bounds,name:'Sound',value:'',hidden:false,disabled:!toggle.enabled,focused:false,checked:toggle.checked,selected:false,expanded:false,modal:false,multiline:false,range,orientation,controls:'view',position,order:1};
void description;void mixed;
const role:SemanticRole='switch';
const options:SemanticNodeOptions={id:'sound',role,parent:'panel',describe:()=>({bounds:semanticBoundsOf(target),name:'Sound',checked:toggle.checked}),onActivate:()=>toggle.toggle(),onFocus:()=>{}};
const node:SemanticNode=semantics.add(options);
// Tabs with the panel of the one that is selected, and work that is under way.
const tabRoles:readonly SemanticRole[]=['tablist','tab','tabpanel','progressbar','menu','menuitem','spinbutton','status','alert','grid','row','gridcell','columnheader','tree','treeitem','heading'];void tabRoles;
semantics.add({id:'tab',role:'tab',parent:'tabs',describe:()=>({bounds:semanticBoundsOf(target),name:'Members',selected:true,controls:'pane',position:{index:1,size:3}})});
semantics.add({id:'work',role:'progressbar',describe:()=>({bounds:semanticBoundsOf(target),name:'Training',range:{now:30,min:0,max:100}})});
const identity:readonly [string,SemanticRole,string|undefined,boolean]=[node.id,node.role,node.parent,node.attached];void identity;
const snapshot:SemanticSnapshot=semantics.publish(3),again:SemanticSnapshot=semantics.publish(),current:SemanticSnapshot=semantics.snapshot;void again;void current;
const first:SemanticSnapshotNode|undefined=snapshot.nodes[0];
if(first!==undefined){
 const actions:readonly SemanticAction[]=first.actions,checked:SemanticChecked|undefined=first.checked,inert:boolean=first.inert,x:number=first.bounds.x,now:number|undefined=first.range?.now;
 void actions;void checked;void inert;void x;void now;
}
const revision:number=snapshot.revision,layout:number|undefined=snapshot.layoutRevision,focused:string|undefined=snapshot.focused;void revision;void layout;void focused;
const action:SemanticAction='activate',performed:boolean=semantics.perform('sound',action);void performed;
const stop:()=>void=semantics.observe((next:SemanticSnapshot,previous:SemanticSnapshot)=>{void next.revision;void previous.revision;});stop();
const removeCloser:()=>void=semantics.onClose(()=>{});removeCloser();
const state:SemanticsState=semantics.state,size:number=semantics.size;void state;void size;
const page:BrowserSemanticsOptions={semantics,canvas,width:480,height:300,label:'Game',onError:(cause:unknown)=>{void cause;}};
const browser:BrowserSemantics=createBrowserSemantics(page);
const container:HTMLElement=browser.container,element:HTMLElement|undefined=browser.elementOf('sound'),projected:'active'|'closed'=browser.state;void container;void element;void projected;
browser.sync();browser.dispose();node.remove();semantics.dispose();
// @ts-expect-error a role is one the tree knows
semantics.add({id:'a',role:'toolbar',describe:()=>({bounds})});
// @ts-expect-error a node says how it is read
semantics.add({id:'a',role:'button'});
// @ts-expect-error a description has its bounds
semantics.add({id:'a',role:'button',describe:()=>({name:'A'})});
// @ts-expect-error only a checkbox state may be mixed, and it is spelled so
semantics.add({id:'a',role:'checkbox',describe:()=>({bounds,checked:'partly'})});
// @ts-expect-error an action is one of two
semantics.perform('sound','press');
// @ts-expect-error a published node is read-only
snapshot.nodes[0]!.name='Other';
// @ts-expect-error a snapshot is read-only
snapshot.nodes.push(first!);
// @ts-expect-error the projection needs its canvas and the logical size
createBrowserSemantics({semantics});
// @ts-expect-error the root entry does not have the tree
import {createUiSemantics as leaked} from '@egret/engine';
void leaked;
