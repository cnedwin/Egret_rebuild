// SPDX-License-Identifier: Apache-2.0
// The rows of a managed virtual list as nodes of the semantic tree, on a genuine Engine and a genuine UI root.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createEngine,DisplayObjectContainer} from '@egret/engine';
import {createKeyboardInput,createPointerInput} from '@egret/engine/input';
import {createUiLayerManager,createUiRoot} from '@egret/engine/ui';
import {createUiListSemantics,createUiSemantics,semanticBoxOf} from '@egret/engine/ui/semantics';
import {spawnSync} from 'node:child_process';
import {host} from './helpers.mjs';

const coded=code=>error=>error?.code===code;
const ids=snapshot=>snapshot.nodes.map(node=>node.id);
const named=(snapshot,id)=>snapshot.nodes.find(node=>node.id===id);
/** A column with a title above a list of 60 units: three rows of 20 show. The root stands at (30, 40) on the stage. */
async function fixture(run,{count=50000,keyboard=true,maxNodes}={}){
 const engine=await createEngine({host:host().adapter}),scope=engine.createScope(),input=keyboard?createKeyboardInput({engine,scope}):undefined;
 const source={revision:0,records:Array.from({length:count},(_,index)=>({key:'k'+index,contentVersion:0,estimatedHeight:20,value:index})),
  bind(context){return {content:context.scope.use(new DisplayObjectContainer()),measuredHeight:20};},unbind(){}};
 const root=createUiRoot({engine,scope,id:'panel',viewport:{width:120,height:100},density:1,
  tree:{id:'column',kind:'column',explicitWidth:120,padding:10,gap:5,children:[{id:'title',kind:'leaf',explicitWidth:100,explicitHeight:15},{id:'list',kind:'virtualList',source,explicitWidth:100,explicitHeight:60}]},
  ...(input?{keyboard:{input,idPrefix:'panel'}}:{}),limits:{overscan:0,residentCap:20}});
 root.setOrigin({x:30,y:40});
 const list=root.list('list'),semantics=createUiSemantics(maxNodes===undefined?{}:{maxNodes});
 const commit=async()=>{for(let round=0;round<8;round++){const token=await root.prepare();if(token.status!=='pending')return root.commit(token);}throw Error('Unstable fixture');};
 const scroll=async offset=>{list.setScrollOffset(offset);return commit();};
 try{await commit();await run({engine,scope,input,source,root,list,semantics,commit,scroll});}finally{await engine.dispose();}
}

test('LS01 the list and the rows that show are published with their places on the stage and their positions in the whole set',async()=>fixture(async({root,semantics})=>{
 const rows=createUiListSemantics({semantics,root,list:'list',name:'Players',describeRow:(key,index)=>({name:'Player '+(index+1)})});
 assert.ok(Object.isFrozen(rows));assert.equal(rows.id,'panel/list');assert.equal(rows.rowId('k7'),'panel/list/k7');
 assert.equal(semantics.size,1,'the list is a node before any row is');
 const revision=rows.sync();
 assert.equal(revision,root.snapshot().committedRevision);assert.equal(semantics.size,4);
 const snapshot=semantics.publish(revision);
 assert.equal(snapshot.layoutRevision,revision);
 assert.deepEqual(ids(snapshot),['panel/list','panel/list/k0','panel/list/k1','panel/list/k2']);
 // The root stands at (30, 40); the list is 10 in and 30 down in it, under the title.
 assert.deepEqual(snapshot.nodes.map(node=>[node.role,node.parent,node.name,node.bounds,node.position]),[
  ['list',undefined,'Players',{x:40,y:70,width:100,height:60},undefined],
  ['listitem','panel/list','Player 1',{x:40,y:70,width:100,height:20},{index:1,size:50000}],
  ['listitem','panel/list','Player 2',{x:40,y:90,width:100,height:20},{index:2,size:50000}],
  ['listitem','panel/list','Player 3',{x:40,y:110,width:100,height:20},{index:3,size:50000}]]);
 assert.deepEqual(snapshot.nodes.map(node=>node.actions),[[],[],[],[]]);assert.equal(snapshot.focused,undefined);
 // Nothing changed: the same publication, and the same nodes.
 assert.equal(rows.sync(),revision);assert.equal(semantics.publish(revision),snapshot);
}));

test('LS02 rows come and go with the commits, and a row that shows in part is cut to the list',async()=>fixture(async({semantics,root,scroll,commit})=>{
 const rows=createUiListSemantics({semantics,root,list:'list',describeRow:key=>({name:key})});
 let before=semantics.publish(rows.sync());
 await scroll(30);
 // The commit alone changes nothing in the tree: the rows are brought to it by the synchronization.
 assert.equal(semantics.publish(before.layoutRevision),before);
 let snapshot=semantics.publish(rows.sync());
 assert.deepEqual(ids(snapshot),['panel/list','panel/list/k1','panel/list/k2','panel/list/k3','panel/list/k4']);
 assert.deepEqual(snapshot.nodes.slice(1).map(node=>[node.bounds.y,node.bounds.height,node.position.index]),[[70,10,2],[80,20,3],[100,20,4],[120,10,5]]);
 assert.equal(semantics.size,5);
 assert.equal(named(snapshot,'panel/list/k2').name,'k2');
 await scroll(40000*20);snapshot=semantics.publish(rows.sync());
 assert.deepEqual(ids(snapshot),['panel/list','panel/list/k40000','panel/list/k40001','panel/list/k40002']);
 assert.deepEqual(named(snapshot,'panel/list/k40001').position,{index:40002,size:50000});assert.equal(semantics.size,4);
 // The root moves on the stage: the places follow at the next synchronization.
 root.setOrigin({x:0,y:0});await commit();
 snapshot=semantics.publish(rows.sync());
 assert.deepEqual([snapshot.nodes[0].bounds,snapshot.nodes[1].bounds],[{x:10,y:30,width:100,height:60},{x:10,y:30,width:100,height:20}]);
}));

test('LS03 the row that holds the focus is the focused node, a row can be asked to take it, and no node is focused once it has left',async()=>fixture(async({semantics,root,list,scroll})=>{
 const rows=createUiListSemantics({semantics,root,list:'list',focusable:true});
 let snapshot=semantics.publish(rows.sync());
 assert.deepEqual(snapshot.nodes.map(node=>node.actions),[[],['focus'],['focus'],['focus']]);
 list.focus('k1',{visible:true});snapshot=semantics.publish(rows.sync());
 assert.equal(snapshot.focused,'panel/list/k1');assert.equal(named(snapshot,'panel/list/k1').focused,true);
 assert.equal(semantics.perform('panel/list/k2','focus'),true);
 assert.deepEqual(list.getFocus(),{key:'k2',focusVisible:true});
 snapshot=semantics.publish(rows.sync());assert.equal(snapshot.focused,'panel/list/k2');
 // The focused row scrolls away: what assistive technology is pointed at is always a node that exists.
 await scroll(2000);snapshot=semantics.publish(rows.sync());
 assert.equal(snapshot.focused,undefined);assert.equal(ids(snapshot).includes('panel/list/k2'),false);
 assert.equal(semantics.perform('panel/list/k2','focus'),false,'a row that does not show cannot be asked');
}));

test('LS04 a listbox publishes options with their selection, and an activation reaches the row',async()=>fixture(async({semantics,root})=>{
 const chosen=[];let selected='k1';
 const rows=createUiListSemantics({semantics,root,list:'list',role:'listbox',name:'Servers',
  describeRow:(key,index)=>({name:'Server '+index,selected:key===selected,disabled:key==='k2'}),onActivateRow:key=>{chosen.push(key);selected=key;}});
 let snapshot=semantics.publish(rows.sync());
 assert.deepEqual(snapshot.nodes.map(node=>[node.role,node.selected,node.disabled,node.actions]),[['listbox',undefined,false,[]],['option',false,false,['activate']],['option',true,false,['activate']],['option',false,true,['activate']]]);
 assert.equal(semantics.perform('panel/list/k0','activate'),true);assert.deepEqual(chosen,['k0']);
 assert.equal(semantics.perform('panel/list/k2','activate'),false,'a disabled row refuses');assert.deepEqual(chosen,['k0']);
 snapshot=semantics.publish(rows.sync());
 assert.deepEqual(snapshot.nodes.slice(1).map(node=>node.selected),[true,false,false]);
 assert.deepEqual(named(snapshot,'panel/list/k1').position,{index:2,size:50000});
}));

test('LS05 nodes inside a row are added when the row is, and go with it',async()=>fixture(async({semantics,root,scroll})=>{
 const added=[];
 const rows=createUiListSemantics({semantics,root,list:'list',onRowAdded(key,id){added.push(key);
  semantics.add({id:id+'/join',role:'button',parent:id,onActivate(){},describe:()=>({name:'Join '+key,bounds:named(semantics.snapshot,id)?.bounds??{x:0,y:0,width:1,height:1}})});}});
 let snapshot=semantics.publish(rows.sync());
 assert.deepEqual(added,['k0','k1','k2']);
 assert.deepEqual(ids(snapshot),['panel/list','panel/list/k0','panel/list/k0/join','panel/list/k1','panel/list/k1/join','panel/list/k2','panel/list/k2/join']);
 assert.equal(named(snapshot,'panel/list/k0').name,'','a list item may leave its name to what is inside it');
 await scroll(40);snapshot=semantics.publish(rows.sync());
 assert.deepEqual(added,['k0','k1','k2','k3','k4'],'a row that stayed is not added again');
 assert.deepEqual(ids(snapshot),['panel/list','panel/list/k2','panel/list/k2/join','panel/list/k3','panel/list/k3/join','panel/list/k4','panel/list/k4/join']);
 assert.equal(semantics.size,7);
 // Back at the top the first rows are rows again, and are told again.
 await scroll(0);semantics.publish(rows.sync());
 assert.deepEqual(added,['k0','k1','k2','k3','k4','k0','k1']);
}));

test('LS06 the list takes an id, a parent and a name of the application, and several lists share a tree',async()=>fixture(async({semantics,root})=>{
 semantics.add({id:'screen',role:'group',describe:()=>({bounds:{x:0,y:0,width:200,height:200}})});
 const rows=createUiListSemantics({semantics,root,list:'list',id:'players',parent:'screen',name:'Players'});
 const other=createUiListSemantics({semantics,root,list:'list',id:'mirror',describeRow:key=>({name:key})});
 assert.equal(rows.rowId('k1'),'players/k1');
 rows.sync();other.sync();
 const snapshot=semantics.publish();
 assert.deepEqual(ids(snapshot),['screen','players','players/k0','players/k1','players/k2','mirror','mirror/k0','mirror/k1','mirror/k2']);
 assert.deepEqual([named(snapshot,'players').parent,named(snapshot,'players').name,named(snapshot,'mirror').name],['screen','Players','']);
 // An id that is taken is refused by the tree, and nothing of the list is left in it.
 assert.throws(()=>createUiListSemantics({semantics,root,list:'list',id:'players'}),coded('UI_SEMANTICS_DUPLICATE'));assert.equal(semantics.size,9);
}));

test('LS07 when the tree has no room for a new row none of the new rows is added, and what stays is true of the commit',async()=>fixture(async({semantics,root,scroll})=>{
 const told=[];
 const rows=createUiListSemantics({semantics,root,list:'list',describeRow:key=>({name:key}),onRowAdded:key=>told.push(key)});
 semantics.publish(rows.sync());assert.equal(semantics.size,4);
 // Four rows show in part or whole after this scroll; the tree holds four nodes, the list among them.
 await scroll(30);
 assert.throws(()=>rows.sync(),coded('UI_SEMANTICS_CAPACITY'));
 assert.equal(semantics.size,3,'the row that left is gone, and the row that was added before the refusal was taken back');assert.deepEqual(told,['k0','k1','k2']);
 let snapshot=semantics.publish(root.snapshot().committedRevision);
 assert.deepEqual(snapshot.nodes.slice(1).map(node=>[node.id,node.bounds.y,node.bounds.height]),[['panel/list/k1',70,10],['panel/list/k2',80,20]],'the rows that stayed are where the commit put them');
 // The rows that left go before the new ones come, so a whole page of new rows needs no room beside the old.
 await scroll(100);
 snapshot=semantics.publish(rows.sync());
 assert.deepEqual(ids(snapshot),['panel/list','panel/list/k5','panel/list/k6','panel/list/k7']);assert.equal(semantics.size,4);
 assert.deepEqual(told,['k0','k1','k2','k5','k6','k7']);
},{maxNodes:4}));

test('LS08 a description that fails or is not sound publishes nothing, and the publication before it stays',async()=>fixture(async({semantics,root})=>{
 let mode='good';const failure=new Error('no name');
 const rows=createUiListSemantics({semantics,root,list:'list',role:'listbox',describeRow:key=>{if(mode==='throw'&&key==='k1')throw failure;return mode==='nameless'?{}:mode==='checked'?{name:key,checked:true}:{name:key};}});
 const before=semantics.publish(rows.sync());
 mode='throw';assert.throws(()=>semantics.publish(before.layoutRevision),error=>error?.code==='UI_SEMANTICS_DESCRIBE_FAILED'&&error.cause===failure);
 mode='nameless';assert.throws(()=>semantics.publish(before.layoutRevision),coded('UI_SEMANTICS_DESCRIPTION'));
 mode='checked';assert.throws(()=>semantics.publish(before.layoutRevision),coded('UI_SEMANTICS_DESCRIPTION'));
 assert.equal(semantics.snapshot,before);
 mode='good';assert.equal(semantics.publish(before.layoutRevision),before);
 assert.deepEqual(before.nodes.slice(1).map(node=>node.selected),[false,false,false],'an option that does not say is not selected');
}));

test('LS09 disposing removes the list and its rows, and it is not synchronized again',async()=>fixture(async({semantics,root})=>{
 const rows=createUiListSemantics({semantics,root,list:'list',onRowAdded(key,id){semantics.add({id:id+'/text',role:'text',parent:id,describe:()=>({name:key,bounds:{x:0,y:0,width:1,height:1}})});}});
 semantics.add({id:'other',role:'button',describe:()=>({name:'Other',bounds:{x:0,y:0,width:1,height:1}})});
 semantics.publish(rows.sync());assert.equal(semantics.size,8);
 rows.dispose();rows.dispose();
 assert.equal(semantics.size,1);assert.deepEqual(ids(semantics.publish()),['other']);
 assert.throws(()=>rows.sync(),coded('UI_SEMANTICS_CLOSED'));
 assert.equal(rows.rowId('k1'),'panel/list/k1','an id is still a name');
 // The id is free again.
 createUiListSemantics({semantics,root,list:'list'}).sync();assert.equal(semantics.size,5);
}));

test('LS10 a root without a keyboard has rows and no focus, and a list that is not laid out has no place',async()=>{
 await fixture(async({semantics,root})=>{
  const rows=createUiListSemantics({semantics,root,list:'list',focusable:true});
  const snapshot=semantics.publish(rows.sync());
  assert.equal(snapshot.focused,undefined);assert.equal(snapshot.nodes.length,4);
  // The request reaches the root, which has no keyboard: the refusal is the root's own.
  assert.throws(()=>semantics.perform('panel/list/k1','focus'),error=>error?.code==='UI_KEYBOARD_UNAVAILABLE'||error?.cause?.code==='UI_KEYBOARD_UNAVAILABLE');
 },{keyboard:false});
 // A source of the application's own: the list is not among the boxes, and its rows have no part that shows.
 const semantics=createUiSemantics();
 const rowsOf=[{key:'a',index:0,visible:true,box:{x:0,y:0,width:10,height:10}},{key:'b',index:1,visible:false,box:{x:0,y:10,width:10,height:10}}];
 const source={id:'own',snapshot:()=>({committedRevision:7,origin:{x:5,y:6},boxes:[]}),list:()=>({snapshot:()=>({rows:rowsOf,counters:{recordCount:2}}),getFocus:()=>({key:undefined}),focus(){}})};
 const rows=createUiListSemantics({semantics,root:source,list:'list'});
 assert.equal(rows.sync(),7);
 const snapshot=semantics.publish(7);
 assert.deepEqual(snapshot.nodes.map(node=>[node.id,node.bounds]),[['own/list',{x:5,y:6,width:0,height:0}],['own/list/a',{x:5,y:6,width:0,height:0}]]);
 assert.deepEqual(snapshot.nodes[1].position,{index:1,size:2});
});

test('LS11 what is not a tree, a root, a list or a description is refused, and nothing is added',async()=>fixture(async({semantics,root})=>{
 const good={semantics,root,list:'list'};
 for(const bad of [undefined,null,7,{...good,semantics:undefined},{...good,semantics:null},{...good,semantics:{}},{...good,root:undefined},{...good,root:null},{...good,root:{id:'r',snapshot(){}}},{...good,root:{id:'r',list(){}}},
  {...good,list:undefined},{...good,list:''},{...good,list:7},{...good,list:'a\0b'},{...good,list:'l'.repeat(129)},{...good,role:'grid'},{...good,role:'listitem'},{...good,name:7},{...good,parent:7},{...good,id:''},{...good,id:7},{...good,id:'i'.repeat(129)},
  {...good,describeRow:'name'},{...good,onActivateRow:7},{...good,onRowAdded:{}},{...good,focusable:'yes'},{...good,focusable:null},
  // An option is read as one thing, so a listbox says what each row is called.
  {...good,role:'listbox'}])
  assert.throws(()=>createUiListSemantics(bad),coded('UI_SEMANTICS_OPTIONS'),JSON.stringify(bad,(name,value)=>name==='semantics'||name==='root'?typeof value:value));
 assert.equal(semantics.size,0);
 // A parent the tree does not have is the tree's refusal.
 assert.throws(()=>createUiListSemantics({...good,parent:'missing'}),coded('UI_SEMANTICS_PARENT'));assert.equal(semantics.size,0);
 // A key that makes an id too long for the tree is refused when its row is added, and the rows stay as they were.
 const long={id:'r'.repeat(100),snapshot:()=>({committedRevision:1,origin:{x:0,y:0},boxes:[]}),
  list:()=>({snapshot:()=>({rows:[{key:'short',index:0,visible:true,box:{x:0,y:0,width:1,height:1}},{key:'k'.repeat(40),index:1,visible:true,box:{x:0,y:1,width:1,height:1}}],counters:{recordCount:2}}),getFocus:()=>({key:undefined}),focus(){}})};
 const rows=createUiListSemantics({semantics,root:long,list:'list'});
 assert.throws(()=>rows.sync(),coded('UI_SEMANTICS_OPTIONS'));assert.equal(semantics.size,1,'the row before it was taken back');
 // The shortest and the longest names the tree takes are taken here too.
 const edge=createUiSemantics(),shortest=createUiListSemantics({semantics:edge,root:long,list:'l',id:'i'}),longest=createUiListSemantics({semantics:edge,root:long,list:'l'.repeat(128),id:'i'.repeat(128)});
 assert.deepEqual([shortest.id,longest.id.length,edge.size],['i',128,2]);
 assert.deepEqual(Object.keys(await import('@egret/engine/ui/semantics')).sort(),['createUiListSemantics','createUiSemantics','semanticBoundsOf','semanticBoxOf']);
 assert.equal('createUiListSemantics' in await import('@egret/engine'),false);assert.equal('createUiListSemantics' in await import('@egret/engine/ui'),false);
}));

test('LS13 a box the root laid out is measured on the stage, as of the last commit',async()=>fixture(async({root,commit})=>{
 assert.deepEqual(semanticBoxOf(root,'title'),{x:40,y:50,width:100,height:15});
 assert.deepEqual(semanticBoxOf(root,'list'),{x:40,y:70,width:100,height:60});
 assert.deepEqual(semanticBoxOf(root,'column'),{x:30,y:40,width:120,height:100});
 assert.ok(Object.isFrozen(semanticBoxOf(root,'title')));
 // The root moves: nothing changes before the commit, and the box follows with it.
 root.setOrigin({x:0,y:5});assert.equal(semanticBoxOf(root,'title').x,40);
 await commit();assert.deepEqual(semanticBoxOf(root,'title'),{x:10,y:15,width:100,height:15});
 // A box the root does not have has no size, at the origin of the root.
 assert.deepEqual(semanticBoxOf(root,'missing'),{x:0,y:5,width:0,height:0});
 assert.deepEqual(semanticBoxOf({snapshot:()=>({committedRevision:1,origin:{x:3,y:4},boxes:[{id:'a',x:1,y:2,width:5,height:6}]})},'a'),{x:4,y:6,width:5,height:6});
 for(const [source,id] of [[undefined,'title'],[null,'title'],[{},'title'],[root,undefined],[root,''],[root,7],[root,'a\0b'],[root,'i'.repeat(129)]])assert.throws(()=>semanticBoxOf(source,id),coded('UI_SEMANTICS_OPTIONS'));
 assert.deepEqual(semanticBoxOf({snapshot:()=>({committedRevision:1,origin:{x:0,y:0},boxes:[{id:'i'.repeat(128),x:0,y:0,width:1,height:1}]})},'i'.repeat(128)).width,1);
}));

test('LS14 a layer of the layer manager is a dialog that is hidden while it is closed, and a modal one makes the rest inert',async()=>{
 const engine=await createEngine({host:host().adapter}),scope=engine.createScope(),input=createPointerInput({engine,scope,width:400,height:300}),keyboard=createKeyboardInput({engine,scope});
 try{
  const panel=async(id,width,height,origin)=>{
   const source={revision:1,records:['k0','k1'].map(key=>({key,contentVersion:1,estimatedHeight:40,value:key})),bind(context){return {content:context.scope.use(new DisplayObjectContainer()),measuredHeight:40};},unbind(){}};
   const root=createUiRoot({engine,scope,id,origin,viewport:{width,height},density:1,input,keyboard:{input:keyboard,idPrefix:id},tree:{id:'rows',kind:'virtualList',source,explicitWidth:width,explicitHeight:height}});
   const publish=async()=>{for(let round=0;round<12;round++){const token=await root.prepare();if(token.status!=='pending')return root.commit(token);}throw Error('Unstable fixture');};
   await publish();return root;
  };
  const base=await panel('base',200,80,{x:10,y:10}),details=await panel('details',160,80,{x:0,y:0});
  const layers=createUiLayerManager({engine,scope,input,keyboard,viewport:{x:0,y:0,width:400,height:300}});
  layers.register({id:'base',root:base,kind:'base'});layers.register({id:'details',root:details,kind:'modal',initialFocus:{listId:'rows',key:'k0'}});layers.sync();
  const semantics=createUiSemantics(),layer=id=>layers.snapshot().layers.find(found=>found.id===id);
  const rows=createUiListSemantics({semantics,root:base,list:'rows',describeRow:key=>({name:key})});
  semantics.add({id:'details',role:'dialog',describe:()=>({name:'Details',modal:layer('details').kind==='modal',hidden:!layer('details').visible,bounds:semanticBoxOf(details,'rows')})});
  const inside=createUiListSemantics({semantics,root:details,list:'rows',id:'details/rows',parent:'details',focusable:true,describeRow:key=>({name:'Detail '+key})});
  const publish=()=>{rows.sync();inside.sync();return semantics.publish(layers.snapshot().committedRevision);};
  let snapshot=publish();
  assert.deepEqual(ids(snapshot),['base/rows','base/rows/k0','base/rows/k1'],'a closed layer and what is inside it are not published');
  assert.deepEqual(snapshot.nodes.map(node=>node.inert),[false,false,false]);
  // Open: the manager centres the layer in its viewport, and the tree says the rest cannot be reached.
  base.list('rows').focus('k1');layers.open('details');layers.sync();snapshot=publish();
  assert.deepEqual(ids(snapshot),['base/rows','base/rows/k0','base/rows/k1','details','details/rows','details/rows/k0','details/rows/k1']);
  assert.deepEqual(snapshot.nodes.map(node=>node.inert),[true,true,true,false,false,false,false]);
  assert.deepEqual([named(snapshot,'details').modal,named(snapshot,'details').bounds],[true,{x:120,y:110,width:160,height:80}]);
  assert.equal(snapshot.focused,'details/rows/k0','the focus the manager moved is the focused node');
  assert.equal(semantics.perform('base/rows/k0','focus'),false,'an inert row is not asked');
  assert.equal(semantics.perform('details/rows/k1','focus'),true);assert.equal(publish().focused,'details/rows/k1');
  // Closed again: the dialog is gone, the rows of the base answer, and the focus is back where it was.
  layers.close('details');layers.sync();snapshot=publish();
  assert.deepEqual(ids(snapshot),['base/rows','base/rows/k0','base/rows/k1']);assert.deepEqual(snapshot.nodes.map(node=>node.inert),[false,false,false]);
  assert.equal(snapshot.focused,'base/rows/k1');
 }finally{await engine.dispose();}
});

test('LS12 a strict consumer compiles against the entry with the root of the UI entry, and the misuses it must not write are refused',()=>{
 const result=spawnSync(process.execPath,['node_modules/typescript/bin/tsc','--project','tests/types/ui-list-semantics.json','--pretty','false'],{cwd:new URL('..',import.meta.url),encoding:'utf8'});
 assert.equal(result.status,0,result.stdout+result.stderr);
});
