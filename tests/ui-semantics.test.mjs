// SPDX-License-Identifier: Apache-2.0
// The semantic tree of a drawn UI: what is published, what is refused, and what an action reaches.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createEngine,DisplayObjectContainer} from '@egret/engine';
import {createPointerInput} from '@egret/engine/input';
import {createToggleControl,createSelectionGroup,createScrollControl} from '@egret/engine/ui';
import {createUiSemantics,semanticBoundsOf} from '@egret/engine/ui/semantics';
import {egret,PROFILE,frames,fixture as atlas} from './atlas-frame-fixture.mjs';
import {host} from './helpers.mjs';

const coded=code=>error=>error?.code===code;
const about=(code,text)=>error=>error?.code===code&&error.cause instanceof TypeError&&error.cause.message===text;
const box=(x=0,y=0,width=10,height=10)=>({x,y,width,height});
const ids=snapshot=>snapshot.nodes.map(node=>node.id);
/** A tree whose descriptions are plain objects a test changes between publications. */
function tree(options){
 const semantics=createUiSemantics(options),state={},calls=[];
 const add=(id,role,description={},extra={})=>{state[id]={bounds:box(),...description};
  return semantics.add({id,role,describe:()=>{calls.push(id);return state[id];},...extra});};
 return {semantics,state,calls,add};
}

test('SM01 a publication is one frozen snapshot, a parent before what is inside it',()=>{
 const {semantics,add}=tree();
 assert.equal(semantics.state,'active');assert.equal(semantics.size,0);assert.ok(Object.isFrozen(semantics));
 assert.deepEqual(semantics.snapshot,{revision:0,layoutRevision:undefined,nodes:[],focused:undefined});assert.ok(Object.isFrozen(semantics.snapshot)&&Object.isFrozen(semantics.snapshot.nodes));
 const panel=add('panel','group',{name:'Settings',bounds:box(10,20,200,100)});
 add('title','text',{name:'Sound and music'},{parent:'panel'});
 add('sound','checkbox',{name:'Sound',checked:true,bounds:box(20,40,80,24)},{parent:'panel',onActivate(){},onFocus(){}});
 add('close','button',{name:'Close'},{onActivate(){}});
 assert.deepEqual([panel.id,panel.role,panel.parent,panel.attached],['panel','group',undefined,true]);assert.ok(Object.isFrozen(panel));
 assert.equal(semantics.size,4);assert.equal(semantics.snapshot.revision,0,'nothing is published by adding');
 const snapshot=semantics.publish();
 assert.equal(snapshot,semantics.snapshot);assert.equal(snapshot.revision,1);assert.deepEqual(ids(snapshot),['panel','title','sound','close']);
 assert.ok(Object.isFrozen(snapshot)&&Object.isFrozen(snapshot.nodes)&&snapshot.nodes.every(node=>Object.isFrozen(node)&&Object.isFrozen(node.bounds)&&Object.isFrozen(node.actions)));
 assert.deepEqual(snapshot.nodes[2],{id:'sound',role:'checkbox',parent:'panel',name:'Sound',bounds:box(20,40,80,24),disabled:false,focused:false,inert:false,actions:['activate','focus'],
  value:undefined,checked:true,selected:undefined,expanded:undefined,modal:undefined,multiline:undefined,multiple:undefined,range:undefined,orientation:undefined,controls:undefined,position:undefined});
 assert.deepEqual(snapshot.nodes.map(node=>node.actions),[[],[],['activate','focus'],['activate']]);
 assert.deepEqual([snapshot.nodes[0].name,snapshot.nodes[1].name,snapshot.nodes[1].parent],['Settings','Sound and music','panel']);
});

test('SM02 reading order is the order given and then the order of addition; a hidden node takes what is inside it',()=>{
 const {semantics,state,calls,add}=tree();
 add('list','list');
 for(const [id,index] of [['c',3],['a',1],['b',2]])add(id,'listitem',{order:index,position:{index,size:50000}},{parent:'list'});
 add('label','text',{name:'Row'},{parent:'a'});add('late','text',{name:'After'});add('early','text',{name:'Before',order:-1});
 for(const id of ['x','y','z'])add(id,'text',{name:id,order:7});
 assert.deepEqual(ids(semantics.publish()),['early','list','a','label','b','c','late','x','y','z']);
 for(const id of ['x','y','z'])state[id].hidden=true;
 assert.deepEqual(semantics.snapshot.nodes[2].position,{index:1,size:50000});assert.ok(Object.isFrozen(semantics.snapshot.nodes[2].position));
 state.a.hidden=true;calls.length=0;
 assert.deepEqual(ids(semantics.publish()),['early','list','b','c','late']);
 assert.equal(calls.includes('label'),false,'what is inside a hidden node is not asked');
 state.a.hidden=false;state.a.order=9;
 assert.deepEqual(ids(semantics.publish()),['early','list','b','c','a','label','late']);
 state.list.hidden=true;assert.deepEqual(ids(semantics.publish()),['early','late']);
});

test('SM03 each publication reads the controls again, and an equal one changes nothing',()=>{
 const {semantics,state,calls,add}=tree(),seen=[];
 add('sound','switch',{name:'Sound',checked:false});add('music','switch',{name:'Music',checked:true});
 semantics.observe((snapshot,previous)=>seen.push([snapshot.revision,previous.revision]));
 const first=semantics.publish();
 calls.length=0;
 assert.equal(semantics.publish(),first,'an equal publication is the same snapshot');assert.deepEqual(calls,['sound','music']);assert.deepEqual(seen,[[1,0]]);
 state.sound.checked=true;
 const second=semantics.publish();
 assert.equal(second.revision,2);assert.equal(second.nodes[0].checked,true);assert.notEqual(second.nodes[0],first.nodes[0]);
 assert.equal(second.nodes[1],first.nodes[1],'a node nothing changed in is the same object');assert.deepEqual(seen,[[1,0],[2,1]]);
 assert.equal(first.nodes[0].checked,false,'a snapshot already published does not change');
 // Every field that is published is compared.
 for(const change of [{name:'Sounds'},{bounds:box(1)},{bounds:box(0,1)},{bounds:box(0,0,11)},{bounds:box(0,0,10,11)},{disabled:true},{focused:true},{checked:false}]){
  const before=semantics.snapshot;Object.assign(state.sound,change);
  assert.equal(semantics.publish().revision,before.revision+1,JSON.stringify(change));assert.equal(semantics.publish().revision,before.revision+1);
 }
 // A control may have no extent, as a collapsed panel has.
 state.sound.bounds=box(3,4,0,0);assert.deepEqual(semantics.publish().nodes[0].bounds,box(3,4,0,0));state.sound.bounds=box();semantics.publish();
 // A description is copied: changing the object it returned changes nothing until it is published.
 const kept=semantics.snapshot.nodes[0].bounds;state.sound.bounds.x=99;assert.equal(kept.x,0);assert.equal(semantics.publish().nodes[0].bounds.x,99);
});

test('SM04 a node is refused where its role means nothing',()=>{
 const {semantics,add}=tree({maxNodes:8});
 add('group','radiogroup');add('box','listbox');add('list','list');add('button','button',{name:'Go'});
 for(const [id,role,parent] of [['r','radio',undefined],['r','radio','box'],['o','option',undefined],['o','option','group'],['i','listitem','box'],['i','listitem',undefined],
  ['x','text','button'],['x','text','missing'],['x','group','button']])
  assert.throws(()=>semantics.add({id,role,parent,describe:()=>({bounds:box()})}),coded('UI_SEMANTICS_PARENT'),role+' in '+parent);
 assert.throws(()=>semantics.add({id:'group',role:'group',describe:()=>({bounds:box()})}),coded('UI_SEMANTICS_DUPLICATE'));
 const describe=()=>({bounds:box()});
 for(const options of [null,[],'x',{id:'',role:'group',describe},{id:'a'.repeat(129),role:'group',describe},{id:'a\0',role:'group',describe},{id:1,role:'group',describe},
  {id:'a',role:'grid',describe},{id:'a',role:'toString',describe},{id:'a',role:'group'},{id:'a',role:'group',describe,parent:''},{id:'a',role:'group',describe,onActivate:1},{id:'a',role:'group',describe,onFocus:'x'}])
  assert.throws(()=>semantics.add(options),coded('UI_SEMANTICS_OPTIONS'));
 assert.equal(semantics.size,4);
 for(const [id,role,parent] of [['r','radio','group'],['o','option','box'],['i','listitem','list'],['t','text','i']])semantics.add({id,role,parent,describe});
 assert.equal(semantics.size,8);
 assert.throws(()=>semantics.add({id:'more',role:'group',describe}),coded('UI_SEMANTICS_CAPACITY'));
 for(const options of [null,[],{maxNodes:0},{maxNodes:4097},{maxNodes:1.5},{maxNodes:'8'}])assert.throws(()=>createUiSemantics(options),coded('UI_SEMANTICS_OPTIONS'));
 assert.equal(createUiSemantics({maxNodes:4096}).size,0);
 const one=createUiSemantics({maxNodes:1});one.add({id:'a'.repeat(128),role:'group',describe});
 assert.throws(()=>one.add({id:'b',role:'group',describe}),coded('UI_SEMANTICS_CAPACITY'));assert.equal(one.publish().nodes[0].id.length,128);
});

test('SM04b every role holds nodes or is read as one thing, and is named where a reader needs a name',()=>{
 const holds=['group','radiogroup','listbox','list','listitem','tablist','tabpanel','menu','dialog'],unnamed=['group','radiogroup','listbox','list','listitem','tablist','menu'];
 const inside={radio:'radiogroup',option:'listbox',listitem:'list',tab:'tablist',menuitem:'menu'},needs={checkbox:{checked:false},switch:{checked:false},radio:{checked:false},option:{selected:false},tab:{selected:false},scrollbar:{range:{now:0,min:0,max:0}},slider:{range:{now:0,min:0,max:0}}};
 const roles=['group','image','text','button','checkbox','switch','radiogroup','radio','listbox','option','list','listitem','scrollbar','slider','progressbar','tablist','tab','tabpanel','menu','menuitem','dialog','textbox'];
 for(const role of roles){
  const {semantics,state,add}=tree();
  if(inside[role])add('holder',inside[role]);
  add('node',role,{name:'Named',...needs[role]},{parent:inside[role]?'holder':undefined});
  const child=()=>semantics.add({id:'child',role:'text',parent:'node',describe:()=>({bounds:box(),name:'Inside'})});
  if(holds.includes(role))assert.equal(child().attached,true,role);else assert.throws(child,coded('UI_SEMANTICS_PARENT'),role);
  assert.equal(semantics.publish().nodes.find(node=>node.id==='node').name,'Named',role);
  state.node.name=undefined;
  if(unnamed.includes(role))assert.equal(semantics.publish().nodes.find(node=>node.id==='node').name,'',role);
  else assert.throws(()=>semantics.publish(),about('UI_SEMANTICS_DESCRIPTION','node: name'),role);
 }
});

test('SM05 a description that cannot be published is refused whole, and names the node and the field',()=>{
 const {semantics,state,add}=tree();
 add('ok','button',{name:'OK'});add('other','text',{name:'Other'});
 const before=semantics.publish();
 const bad=[[{bounds:undefined},'bounds'],[{bounds:null},'bounds'],[{bounds:{x:0,y:0,width:-1,height:1}},'bounds'],[{bounds:{x:0,y:0,width:1,height:-1}},'bounds'],
  [{bounds:{x:Number.NaN,y:0,width:1,height:1}},'bounds'],[{bounds:{x:0,y:Infinity,width:1,height:1}},'bounds'],[{bounds:{x:0,y:0,width:'1',height:1}},'bounds'],[{bounds:{x:0,y:0,width:1}},'bounds'],
  [{name:''},'name'],[{name:'  \n'},'name'],[{name:7},'name'],[{name:'a'.repeat(1025)},'name'],[{hidden:1},'hidden'],[{focused:'yes'},'focused'],[{order:Number.NaN},'order'],[{order:'1'},'order'],
  [{disabled:0},'disabled'],[{expanded:'true'},'expanded'],[{checked:true},'checked'],[{selected:false},'selected'],[{modal:true},'modal'],[{multiline:false},'multiline'],
  [{range:{now:0,min:0,max:1}},'range'],[{orientation:'vertical'},'orientation'],[{controls:'other'},'controls'],[{position:{index:1,size:1}},'position'],[{value:'x'},'value']];
 for(const [change,field] of bad){
  const saved={...state.ok};Object.assign(state.ok,change);
  assert.throws(()=>semantics.publish(),about('UI_SEMANTICS_DESCRIPTION','ok: '+field),JSON.stringify(change));
  assert.equal(semantics.snapshot,before);state.ok=saved;
 }
 for(const value of [null,undefined,7,'x',[]]){state.ok=value;assert.throws(()=>semantics.publish(),about('UI_SEMANTICS_DESCRIPTION','ok: description'));}
 state.ok={bounds:box(),name:'OK'};
 const cause=new Error('control is gone');
 const failing=semantics.add({id:'fails',role:'group',describe(){throw cause;}});
 assert.throws(()=>semantics.publish(),error=>error.code==='UI_SEMANTICS_DESCRIBE_FAILED'&&error.cause===cause);
 assert.equal(semantics.snapshot,before);failing.remove();
 assert.equal(semantics.publish(),before,'and the tree publishes again once the description is whole');
 assert.equal(semantics.publish().nodes[0].name.length,2);state.ok.name='a'.repeat(1024);assert.equal(semantics.publish().nodes[0].name.length,1024);
});

test('SM06 the state a role has is required, defaulted or refused by that role',()=>{
 const {semantics,state,add}=tree();
 add('box','checkbox',{name:'All',checked:'mixed'});add('switch','switch',{name:'On',checked:false});
 add('group','radiogroup',{name:'Size',disabled:true});add('radio','radio',{name:'Small',checked:true,position:{index:1,size:3}},{parent:'group'});
 add('list','listbox');add('option','option',{name:'First',selected:true},{parent:'list'});
 add('view','group');add('bar','scrollbar',{name:'Scroll',range:{now:20,min:0,max:150},controls:'view'});
 add('field','textbox',{name:'Name'});add('dialog','dialog',{name:'Rename'});add('menu','button',{name:'More',expanded:false});
 const node=id=>semantics.publish().nodes.find(found=>found.id===id);
 assert.equal(node('box').checked,'mixed');assert.equal(node('group').disabled,true);assert.deepEqual(node('radio').position,{index:1,size:3});assert.equal(node('option').selected,true);
 assert.deepEqual([node('bar').range,node('bar').orientation,node('bar').controls],[{now:20,min:0,max:150},'vertical','view']);assert.ok(Object.isFrozen(node('bar').range));
 assert.deepEqual([node('field').value,node('field').multiline,node('dialog').modal,node('menu').expanded],['',false,false,false]);
 state.bar.orientation='horizontal';state.field.value='张三';state.field.multiline=true;state.menu.expanded=true;
 assert.deepEqual([node('bar').orientation,node('field').value,node('field').multiline,node('menu').expanded],['horizontal','张三',true,true]);
 const refused=(id,change,field)=>{const saved={...state[id]};Object.assign(state[id],change);assert.throws(()=>semantics.publish(),about('UI_SEMANTICS_DESCRIPTION',id+': '+field),id+' '+JSON.stringify(change));state[id]=saved;};
 for(const checked of [undefined,'mixed','true',1])for(const id of ['switch','radio'])refused(id,{checked},'checked');
 for(const checked of [undefined,'some',null])refused('box',{checked},'checked');
 for(const selected of [undefined,'true',1])refused('option',{selected},'selected');
 for(const range of [undefined,null,{now:1,min:2,max:3},{now:4,min:2,max:3},{now:Number.NaN,min:0,max:1},{now:0,min:0},{now:0,min:-Infinity,max:1}])refused('bar',{range},'range');
 for(const orientation of ['diagonal',1])refused('bar',{orientation},'orientation');
 for(const controls of ['','bar',7])refused('bar',{controls},'controls');
 for(const position of [null,{index:0,size:3},{index:4,size:3},{index:1.5,size:3},{index:1},{index:1,size:'3'}])refused('radio',{position},'position');
 for(const value of [7,'a'.repeat(16385)])refused('field',{value},'value');
 // A scrollbar at either end of its range, and one with nothing to scroll.
 for(const range of [{now:0,min:0,max:150},{now:150,min:0,max:150},{now:0,min:0,max:0}]){state.bar.range=range;assert.deepEqual(node('bar').range,range);}
 assert.equal(node('field').value,'张三');state.field.value='a'.repeat(16384);assert.equal(node('field').value.length,16384);
});

test('SM06b tabs are selected one by one and name their panel; a progress bar is somewhere in its work or of unknown length',()=>{
 const {semantics,state,add}=tree();
 add('tabs','tablist',{name:'Sect'});add('members','tab',{name:'Members',selected:true,controls:'panel',position:{index:1,size:2}},{parent:'tabs'});add('stores','tab',{name:'Stores',selected:false,disabled:true},{parent:'tabs'});
 add('panel','tabpanel',{name:'Members'});add('work','progressbar',{name:'Training',range:{now:30,min:0,max:100}},{parent:'panel'});add('busy','progressbar',{name:'Loading'},{parent:'panel'});
 const node=id=>semantics.publish().nodes.find(found=>found.id===id);
 assert.deepEqual([node('tabs').orientation,node('tabs').disabled,node('members').selected,node('members').controls,node('members').position,node('members').orientation],['horizontal',false,true,'panel',{index:1,size:2},undefined]);
 assert.deepEqual([node('stores').selected,node('stores').disabled,node('stores').controls,node('panel').parent,node('work').parent],[false,true,undefined,undefined,'panel']);
 assert.deepEqual([node('work').range,node('work').orientation,node('busy').range,node('busy').orientation],[{now:30,min:0,max:100},undefined,undefined,undefined]);
 state.tabs.orientation='vertical';assert.equal(node('tabs').orientation,'vertical');
 const refused=(id,change,field)=>{const saved={...state[id]};Object.assign(state[id],change);assert.throws(()=>semantics.publish(),about('UI_SEMANTICS_DESCRIPTION',id+': '+field),id+' '+JSON.stringify(change));state[id]=saved;};
 for(const selected of [undefined,'true',1])refused('members',{selected},'selected');
 for(const [id,change,field] of [['tabs',{orientation:'diagonal'},'orientation'],['tabs',{selected:true},'selected'],['tabs',{range:{now:0,min:0,max:1}},'range'],['members',{checked:true},'checked'],['members',{controls:'members'},'controls'],['members',{orientation:'vertical'},'orientation'],
  ['members',{position:{index:3,size:2}},'position'],['panel',{disabled:true},'disabled'],['panel',{selected:true},'selected'],['panel',{name:' '},'name'],['work',{range:{now:101,min:0,max:100}},'range'],['work',{range:null},'range'],['work',{range:{now:1,min:0}},'range'],
  ['work',{orientation:'horizontal'},'orientation'],['work',{disabled:true},'disabled'],['work',{controls:'panel'},'controls'],['busy',{name:''},'name']])refused(id,change,field);
 // The panel a tab names is published with it, and a tab is a tab of a row of tabs.
 state.panel.hidden=true;assert.throws(()=>semantics.publish(),about('UI_SEMANTICS_RELATION','members: controls'));state.panel.hidden=false;
 assert.throws(()=>semantics.add({id:'loose',role:'tab',describe:()=>({bounds:box(),name:'Loose',selected:false})}),coded('UI_SEMANTICS_PARENT'));
 assert.throws(()=>semantics.add({id:'loose',role:'tab',parent:'panel',describe:()=>({bounds:box(),name:'Loose',selected:false})}),coded('UI_SEMANTICS_PARENT'));
 // A tab is activated and takes the focus; a progress bar only reports.
 const seen=[];semantics.add({id:'log',role:'tab',parent:'tabs',onActivate:()=>seen.push('log'),onFocus:()=>seen.push('focus'),describe:()=>({bounds:box(),name:'Log',selected:false})});
 assert.deepEqual(node('log').actions,['activate','focus']);assert.equal(semantics.perform('log','activate'),true);assert.equal(semantics.perform('log','focus'),true);assert.deepEqual(seen,['log','focus']);
 assert.deepEqual(node('work').actions,[]);
});

test('SM06c a list box says whether several of its options may be selected, and nothing else does',()=>{
 const {semantics,state,add}=tree();
 add('team','listbox',{name:'Team',multiple:true});add('a','option',{name:'A',selected:true},{parent:'team'});add('b','option',{name:'B',selected:true},{parent:'team'});
 add('one','listbox',{name:'One'});add('c','option',{name:'C',selected:false},{parent:'one'});add('rows','list');add('panel','group');
 const node=id=>semantics.publish().nodes.find(found=>found.id===id);
 assert.deepEqual([node('team').multiple,node('one').multiple,node('a').multiple,node('rows').multiple,node('a').selected,node('b').selected],[true,false,undefined,undefined,true,true]);
 const first=semantics.snapshot.revision;state.team.multiple=false;assert.equal(node('team').multiple,false);assert.equal(semantics.snapshot.revision,first+1,'a change of it is a change of the tree');
 const refused=(id,change,field)=>{const saved={...state[id]};Object.assign(state[id],change);assert.throws(()=>semantics.publish(),about('UI_SEMANTICS_DESCRIPTION',id+': '+field),id+' '+JSON.stringify(change));state[id]=saved;};
 for(const multiple of ['true',1,null])refused('team',{multiple},'multiple');
 for(const id of ['a','rows','panel'])for(const multiple of [true,false])refused(id,{multiple},'multiple');
});

test('SM06d a menu lists its items downward, and an item is named, placed, activated or disabled',()=>{
 const {semantics,state,add}=tree();
 add('menu','menu',{name:'Member'});add('send','menuitem',{name:'Send',position:{index:1,size:2}},{parent:'menu'});add('dismiss','menuitem',{name:'Dismiss',disabled:true},{parent:'menu'});
 const node=id=>semantics.publish().nodes.find(found=>found.id===id);
 assert.deepEqual([node('menu').orientation,node('menu').disabled,node('send').position,node('send').disabled,node('dismiss').disabled,node('send').orientation],['vertical',false,{index:1,size:2},false,true,undefined]);
 state.menu.orientation='horizontal';assert.equal(node('menu').orientation,'horizontal');
 const refused=(id,change,field)=>{const saved={...state[id]};Object.assign(state[id],change);assert.throws(()=>semantics.publish(),about('UI_SEMANTICS_DESCRIPTION',id+': '+field),id+' '+JSON.stringify(change));state[id]=saved;};
 for(const [id,change,field] of [['menu',{orientation:'diagonal'},'orientation'],['menu',{selected:true},'selected'],['menu',{multiple:true},'multiple'],['send',{selected:true},'selected'],['send',{checked:true},'checked'],['send',{expanded:true},'expanded'],
  ['send',{name:' '},'name'],['send',{position:{index:3,size:2}},'position'],['send',{orientation:'vertical'},'orientation']])refused(id,change,field);
 assert.throws(()=>semantics.add({id:'loose',role:'menuitem',describe:()=>({bounds:box(),name:'Loose'})}),coded('UI_SEMANTICS_PARENT'));
 const seen=[];semantics.add({id:'promote',role:'menuitem',parent:'menu',onActivate:()=>seen.push('promote'),onFocus:()=>seen.push('focus'),describe:()=>({bounds:box(),name:'Promote'})});
 assert.deepEqual(node('promote').actions,['activate','focus']);assert.equal(semantics.perform('promote','activate'),true);assert.deepEqual(seen,['promote']);
 semantics.add({id:'gone',role:'menuitem',parent:'menu',onActivate:()=>seen.push('gone'),describe:()=>({bounds:box(),name:'Gone',disabled:true})});semantics.publish();
 assert.equal(semantics.perform('gone','activate'),false,'a disabled item refuses');assert.deepEqual(seen,['promote']);
});

test('SM07 one node holds the focus',()=>{
 const {semantics,state,add}=tree();
 add('a','button',{name:'A'});add('b','button',{name:'B',focused:true});add('c','button',{name:'C'});
 assert.equal(semantics.publish().focused,'b');assert.deepEqual(semantics.snapshot.nodes.map(node=>node.focused),[false,true,false]);
 state.c.focused=true;
 assert.throws(()=>semantics.publish(),about('UI_SEMANTICS_FOCUS','c: focused'));assert.equal(semantics.snapshot.focused,'b');
 state.b.hidden=true;assert.equal(semantics.publish().focused,'c','a hidden node holds nothing');
 state.c.focused=false;assert.equal(semantics.publish().focused,undefined);
 state.b.hidden=false;state.b.disabled=true;assert.equal(semantics.publish().focused,'b');
});

test('SM08 the modal dialog published last makes everything outside it inert',()=>{
 const {semantics,state,add}=tree(),done=[];
 add('page','group');add('save','button',{name:'Save'},{parent:'page',onActivate:()=>done.push('save'),onFocus:()=>done.push('focus save')});
 add('layer','group',{},{parent:'page'});add('first','dialog',{name:'Details',modal:true},{parent:'layer'});add('rename','button',{name:'Rename'},{parent:'first',onActivate:()=>done.push('rename')});
 add('second','dialog',{name:'Rename',modal:true,hidden:true});add('ok','button',{name:'OK'},{parent:'second',onActivate:()=>done.push('ok')});
 add('status','text',{name:'Ready'});
 const inert=()=>Object.fromEntries(semantics.publish().nodes.map(node=>[node.id,node.inert]));
 assert.deepEqual(inert(),{page:false,save:true,layer:false,first:false,rename:false,status:true});
 assert.equal(semantics.perform('save','activate'),false);assert.equal(semantics.perform('save','focus'),false);assert.equal(semantics.perform('rename','activate'),true);
 state.second.hidden=false;
 assert.deepEqual(inert(),{page:true,save:true,layer:true,first:true,rename:true,second:false,ok:false,status:true});
 assert.equal(semantics.perform('rename','activate'),false);assert.equal(semantics.perform('ok','activate'),true);
 state.rename.focused=true;assert.throws(()=>semantics.publish(),about('UI_SEMANTICS_FOCUS','rename: focused'));
 state.rename.focused=false;state.ok.focused=true;assert.equal(semantics.publish().focused,'ok');
 state.second.modal=false;assert.throws(()=>semantics.publish(),about('UI_SEMANTICS_FOCUS','ok: focused'),'the dialog in front is now the first one');
 state.ok.focused=false;assert.deepEqual(inert(),{page:false,save:true,layer:false,first:false,rename:false,second:true,ok:true,status:true},'a dialog that is not modal holds nothing back, and is behind one that is');
 state.first.modal=false;assert.equal(Object.values(inert()).some(Boolean),false);
 assert.equal(semantics.perform('save','activate'),true);assert.deepEqual(done,['rename','ok','save']);
});

test('SM09 a relation names a node that is published with it',()=>{
 const {semantics,state,add}=tree();
 add('view','group');add('bar','scrollbar',{name:'Scroll',range:{now:0,min:0,max:1},controls:'view'});
 assert.equal(semantics.publish().nodes[1].controls,'view');
 state.view.hidden=true;assert.throws(()=>semantics.publish(),about('UI_SEMANTICS_RELATION','bar: controls'));assert.equal(semantics.snapshot.revision,1);
 state.view.hidden=false;state.bar.controls='nothing';assert.throws(()=>semantics.publish(),about('UI_SEMANTICS_RELATION','bar: controls'));
 state.bar.controls=undefined;assert.equal(semantics.publish().nodes[1].controls,undefined);
});

test('SM10 an action reaches the control the node was published from, and no other',()=>{
 const {semantics,state,add}=tree(),done=[];
 const first=add('go','button',{name:'Go'},{onActivate:()=>done.push('go'),onFocus:()=>done.push('focus go')});
 add('label','text',{name:'Label'});add('quiet','button',{name:'Quiet'});add('only','button',{name:'Only'},{onFocus:()=>done.push('focus only')});
 assert.equal(semantics.perform('go','activate'),false,'nothing is published yet');
 semantics.publish();
 assert.equal(semantics.perform('go','activate'),true);assert.equal(semantics.perform('go','focus'),true);assert.deepEqual(done,['go','focus go']);
 for(const [id,action] of [['missing','activate'],['label','activate'],['label','focus'],['quiet','activate'],['quiet','focus'],['only','activate']])assert.equal(semantics.perform(id,action),false,id+' '+action);
 assert.equal(semantics.perform('only','focus'),true);
 for(const [id,action] of [['go','press'],['go',undefined],['',' activate'],[7,'activate'],['a\0','focus']])assert.throws(()=>semantics.perform(id,action),coded('UI_SEMANTICS_OPTIONS'));
 state.go.disabled=true;assert.equal(semantics.perform('go','activate'),true,'what is published is what is performed');
 semantics.publish();assert.equal(semantics.perform('go','activate'),false);assert.equal(semantics.perform('go','focus'),false);
 state.go.disabled=false;semantics.publish();
 // The id is used again by another control: the old publication does not reach it.
 first.remove();assert.equal(semantics.perform('go','activate'),false);
 add('go','button',{name:'Go again'},{onActivate:()=>done.push('again')});assert.equal(semantics.perform('go','activate'),false);
 semantics.publish();assert.equal(semantics.perform('go','activate'),true);assert.equal(done.at(-1),'again');
 const cause=new Error('activation failed');add('breaks','button',{name:'Breaks'},{onActivate(){throw cause;}});semantics.publish();
 assert.throws(()=>semantics.perform('breaks','activate'),error=>error===cause);assert.equal(semantics.state,'active');assert.equal(semantics.perform('go','activate'),true);
});

test('SM11 removing a node removes what is inside it',()=>{
 const {semantics,add}=tree();
 const list=add('list','list'),row=add('row','listitem',{},{parent:'list'}),label=add('label','text',{name:'One'},{parent:'row'}),other=add('other','text',{name:'Other'});
 semantics.publish();
 row.remove();
 assert.deepEqual([list.attached,row.attached,label.attached,other.attached],[true,false,false,true]);assert.equal(semantics.size,2);
 row.remove();label.remove();assert.equal(semantics.size,2);
 assert.deepEqual(ids(semantics.snapshot),['list','row','label','other'],'the publication stands until the next one');
 assert.deepEqual(ids(semantics.publish()),['list','other']);
 const again=add('row','listitem',{},{parent:'list'});add('label','text',{name:'Two'},{parent:'row'});
 assert.deepEqual(ids(semantics.publish()),['list','row','label','other']);assert.equal(semantics.snapshot.nodes[2].name,'Two');
 list.remove();assert.equal(again.attached,false);assert.equal(semantics.size,1);
 assert.throws(()=>add('late','listitem',{},{parent:'list'}),coded('UI_SEMANTICS_PARENT'));
 assert.deepEqual(ids(semantics.publish()),['other']);
});

test('SM12 a listener is told of each publication that differs, and its failure does not undo one',()=>{
 const {semantics,state,add}=tree(),seen=[];
 add('a','button',{name:'A'});
 const stop=semantics.observe(snapshot=>seen.push('first '+snapshot.revision));
 const first=new Error('one'),second=new Error('two');
 let fail=false;
 semantics.observe(()=>{if(fail)throw first;});semantics.observe(snapshot=>{seen.push('third '+snapshot.revision);if(fail)throw second;});
 semantics.publish();assert.deepEqual(seen,['first 1','third 1']);
 fail=true;state.a.name='B';
 assert.throws(()=>semantics.publish(),error=>error.code==='UI_SEMANTICS_LISTENER_FAILED'&&error.cause===first&&error.cleanupErrors.length===1&&error.cleanupErrors[0]===second);
 assert.equal(semantics.snapshot.revision,2);assert.equal(semantics.snapshot.nodes[0].name,'B');assert.deepEqual(seen,['first 1','third 1','first 2','third 2']);
 fail=false;stop();stop();state.a.name='C';semantics.publish();assert.deepEqual(seen.slice(4),['third 3']);
 // A listener may change the tree for the next publication. It may not publish from inside one.
 let inside;
 const once=semantics.observe(()=>{once();add('added','text',{name:'Added'});try{semantics.publish();}catch(error){inside=error.code;}});
 state.a.name='D';assert.deepEqual(ids(semantics.publish()),['a']);assert.equal(inside,'UI_SEMANTICS_REENTRANT');
 assert.deepEqual(ids(semantics.publish()),['a','added']);
 for(const value of [undefined,null,'x',{}])assert.throws(()=>semantics.observe(value),coded('UI_SEMANTICS_OPTIONS'));
});

test('SM13 a description may read; it may not change the tree it is read into',()=>{
 const semantics=createUiSemantics(),refused=[];
 let attempt;
 const node=semantics.add({id:'a',role:'button',onActivate(){},describe(){try{attempt?.();}catch(error){refused.push(error.code);}return {bounds:box(),name:'A'};}});
 semantics.add({id:'b',role:'text',describe:()=>({bounds:box(),name:'B'})});
 semantics.publish();
 for(const action of [()=>semantics.add({id:'c',role:'text',describe:()=>({bounds:box(),name:'C'})}),()=>node.remove(),()=>semantics.publish(),()=>semantics.perform('a','activate'),()=>semantics.dispose()]){
  attempt=action;semantics.publish();
 }
 assert.deepEqual(refused,Array(5).fill('UI_SEMANTICS_REENTRANT'));
 attempt=undefined;assert.equal(semantics.state,'active');assert.equal(semantics.size,2);assert.equal(node.attached,true);assert.deepEqual(ids(semantics.publish()),['a','b']);
});

test('SM14 the layout revision the bounds belong to is published with them',()=>{
 const {semantics,add}=tree();
 add('a','button',{name:'A'});
 const first=semantics.publish(4);
 assert.equal(first.layoutRevision,4);assert.equal(semantics.publish(4),first);
 assert.deepEqual([semantics.publish(5).revision,semantics.snapshot.layoutRevision],[2,5]);
 assert.equal(semantics.snapshot.nodes[0],first.nodes[0],'a new layout that moved nothing keeps the nodes');
 for(const value of [4,-1,1.5,'6',Number.NaN])assert.throws(()=>semantics.publish(value),coded('UI_SEMANTICS_REVISION'),String(value));
 assert.equal(semantics.snapshot.revision,2);
 assert.deepEqual([semantics.publish().revision,semantics.snapshot.layoutRevision],[3,undefined]);assert.equal(semantics.publish(0).layoutRevision,0);
});

test('SM15 a disposed tree lets go of every node and tells whoever projects it',()=>{
 const {semantics,add}=tree(),told=[];
 const node=add('a','button',{name:'A'},{onActivate:()=>told.push('activated')});
 semantics.publish();
 const first=new Error('one'),second=new Error('two');
 semantics.onClose(()=>told.push('closed'));semantics.onClose(()=>{throw first;});semantics.onClose(()=>{told.push('after');throw second;});
 const removed=semantics.onClose(()=>told.push('never'));removed();
 semantics.observe(()=>told.push('published'));
 assert.throws(()=>semantics.dispose(),error=>error.code==='UI_SEMANTICS_CLEANUP_FAILED'&&error.cause===first&&error.cleanupErrors[0]===second);
 assert.deepEqual(told,['closed','after']);assert.equal(semantics.state,'closed');assert.equal(semantics.size,0);assert.equal(node.attached,false);
 semantics.dispose();node.remove();
 assert.equal(semantics.perform('a','activate'),false);assert.equal(semantics.snapshot.revision,1);
 assert.throws(()=>semantics.publish(),coded('UI_SEMANTICS_CLOSED'));assert.throws(()=>add('b','button',{name:'B'}),coded('UI_SEMANTICS_CLOSED'));
 semantics.observe(()=>told.push('late'))();
 let now=false;semantics.onClose(()=>{now=true;})();assert.equal(now,true,'a closer added afterwards is told at once');
 assert.throws(()=>semantics.onClose(1),coded('UI_SEMANTICS_OPTIONS'));assert.deepEqual(told,['closed','after']);
});

test('SM16 the bounds of a node can be measured from what is drawn',async()=>{
 const f=await atlas();
 try{
  const bitmap=egret.createSpriteSheet(f.lease,frames(),PROFILE).createBitmap('A'),holder=f.scope.use(new egret.DisplayObjectContainer());
  f.engine.stage.addChild(holder);holder.addChild(bitmap);
  assert.deepEqual(semanticBoundsOf(bitmap),{x:0,y:0,width:4,height:5});assert.ok(Object.isFrozen(semanticBoundsOf(bitmap)));
  holder.x=30;holder.y=20;holder.scaleX=2;holder.scaleY=3;bitmap.x=1;bitmap.y=2;
  assert.deepEqual(semanticBoundsOf(bitmap),{x:32,y:26,width:8,height:15});
  assert.deepEqual(semanticBoundsOf(holder),{x:32,y:26,width:8,height:15},'a container is as large as what it holds');
  // A quarter turn: the enclosing rectangle is what a reader's cursor is drawn around.
  holder.scaleX=holder.scaleY=1;bitmap.x=bitmap.y=0;holder.rotation=90;
  const turned=semanticBoundsOf(bitmap);
  for(const [name,value] of [['x',25],['y',20],['width',5],['height',4]])assert.ok(Math.abs(turned[name]-value)<1e-9,name+' '+turned[name]);
  const semantics=createUiSemantics();
  semantics.add({id:'picture',role:'image',describe:()=>({name:'Portrait',bounds:semanticBoundsOf(bitmap)})});
  holder.rotation=0;assert.deepEqual(semantics.publish().nodes[0].bounds,{x:30,y:20,width:4,height:5});
  holder.x=40;assert.deepEqual(semantics.publish().nodes[0].bounds,{x:40,y:20,width:4,height:5});
 }finally{await f.close();}
});

test('SM17 the tree describes the controls that are drawn, and activates them the way a press does',async()=>{
 const engine=await createEngine({host:host().adapter}),scope=engine.createScope();
 try{
  const make=(x,y,width=40,height=20)=>{const node=scope.use(new DisplayObjectContainer());node.x=x;node.y=y;node.hitArea={x:0,y:0,width,height};node.touchEnabled=true;engine.stage.addChild(node);return node;};
  const input=createPointerInput({engine,scope,width:200,height:100}),changes=[];
  const soundTarget=make(0,0),toggle=createToggleControl({input,target:soundTarget,onChange:checked=>changes.push('sound '+checked)});
  const sizes=['small','medium','large'].map((key,index)=>({key,target:make(50*index,30)})),group=createSelectionGroup({input,items:sizes,selected:'small',onChange:selected=>changes.push('size '+selected)});
  const scroll=createScrollControl({viewportLength:100,contentLength:400});
  const semantics=createUiSemantics(),area=node=>({x:node.x,y:node.y,width:node.hitArea.width,height:node.hitArea.height});
  semantics.add({id:'sound',role:'switch',describe:()=>({name:'Sound',bounds:area(soundTarget),checked:toggle.checked,disabled:!toggle.enabled}),onActivate:()=>toggle.toggle()});
  semantics.add({id:'size',role:'radiogroup',describe:()=>({name:'Size',bounds:box(0,30,150,20),disabled:!group.enabled})});
  for(const [index,item] of sizes.entries())semantics.add({id:'size-'+item.key,role:'radio',parent:'size',onActivate:()=>{group.select(item.key);},
   describe:()=>({name:item.key,bounds:area(item.target),checked:group.selected===item.key,disabled:!group.isItemEnabled(item.key),position:{index:index+1,size:sizes.length}})});
  semantics.add({id:'view',role:'group',describe:()=>({name:'Messages',bounds:box(0,60,190,40)})});
  semantics.add({id:'bar',role:'scrollbar',describe:()=>({name:'Messages scroll',bounds:box(190,60,10,40),range:{now:scroll.offset,min:0,max:scroll.maximum},controls:'view'})});
  const read=()=>Object.fromEntries(semantics.publish().nodes.map(node=>[node.id,node.checked??node.range?.now]));
  assert.deepEqual(read(),{sound:false,size:undefined,'size-small':true,'size-medium':false,'size-large':false,view:undefined,bar:0});
  // A request of assistive technology and a press of the pointer end in the same state and the same report.
  assert.equal(semantics.perform('sound','activate'),true);assert.equal(semantics.perform('size-large','activate'),true);
  let clock=0;
  const press=(x,y)=>{const contact=input.begin({pointerId:1,pointerType:'mouse',globalX:x,globalY:y,buttons:1,timestamp:++clock});input.end(contact,{globalX:x,globalY:y,buttons:0,timestamp:++clock});};
  press(60,35);scroll.scrollTo(120);
  assert.deepEqual(changes,['sound true','size large','size medium']);
  assert.deepEqual(read(),{sound:true,size:undefined,'size-small':false,'size-medium':true,'size-large':false,view:undefined,bar:120});
  press(5,5);assert.equal(read().sound,false);
  // A disabled control is published as disabled, and then refuses the request as it refuses the press.
  toggle.setEnabled(false);group.setItemEnabled('large',false);semantics.publish();
  assert.equal(semantics.perform('sound','activate'),false);assert.equal(semantics.perform('size-large','activate'),false);assert.equal(semantics.perform('size-small','activate'),true);
  assert.deepEqual(changes.slice(3),['sound false','size small']);
  toggle.dispose();group.dispose();scroll.dispose();input.dispose();semantics.dispose();
 }finally{await engine.dispose();}
});

test('SM18 the entry has the tree, its measure and the list helper, and the root entry has none of them',async()=>{
 assert.deepEqual(Object.keys(await import('@egret/engine/ui/semantics')).sort(),['createUiListSemantics','createUiSemantics','semanticBoundsOf','semanticBoxOf']);
 const root=await import('@egret/engine'),ui=await import('@egret/engine/ui');
 for(const name of ['createUiSemantics','semanticBoundsOf','createUiListSemantics','semanticBoxOf','createBrowserSemantics'])assert.equal(name in root||name in ui,false,name);
});
