// SPDX-License-Identifier: Apache-2.0
// The browser projection of the semantic tree against a test-owned stand-in for the page. It shows
// what the adapter writes and what it does with the events it is given. What a real browser and
// its accessibility tree make of that is checked separately.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createUiSemantics} from '@egret/engine/ui/semantics';
import {createBrowserSemantics} from '@egret/engine/web/semantics';
import {spawnSync} from 'node:child_process';

const plain={transform:'none',perspective:'none',translate:'none',rotate:'none',scale:'none',zoom:'normal'};
const coded=code=>error=>error?.code===code;
const box=(x=0,y=0,width=10,height=10)=>({x,y,width,height});
/** Elements are compared by identity: a stand-in element is a graph no report should have to print. */
const same=(actual,expected,message)=>assert.ok(actual.length===expected.length&&actual.every((value,index)=>value===expected[index]),message??'not the same elements, '+actual.length+' against '+expected.length);
/** A page with one canvas of 200 by 160 CSS pixels at (10, 20), inside a body. Every write is counted. */
function page(){
 const listeners=[],state={rect:{left:10,top:20,width:200,height:160},offset:{x:0,y:0},writes:0,focused:[],failInsert:false,failRemove:false,failCreate:false};
 class Target extends EventTarget {
  addEventListener(type,listener,options){listeners.push({target:this,type,listener,options,removed:false});super.addEventListener(type,listener,options);}
  removeEventListener(type,listener,options){
   if(state.failRemove)throw new Error('the page kept the listener');
   for(const pair of listeners)if(pair.target===this&&pair.type===type&&pair.listener===listener&&Boolean(pair.options?.capture)===Boolean(options?.capture))pair.removed=true;
   super.removeEventListener(type,listener,options);}
 }
 const document=Object.assign(new Target(),{nodeType:9,all:new Set()});
 class Element extends Target {
  constructor(tag){super();this.tagName=tag.toUpperCase();this.nodeType=1;this.attributes=new Map();this.children=[];this.parentNode=null;this.ownerDocument=document;this.css={};
   const element=this;let css='',text='';
   this.style={get cssText(){return css;},set cssText(value){state.writes++;css=value;}};
   Object.defineProperty(this,'textContent',{get:()=>text,set(value){state.writes++;text=value;if(element.children.length)throw new Error('text over children');}});
   document.all.add(this);}
  get id(){return this.attributes.get('id')??'';}
  set id(value){this.attributes.set('id',value);}
  get isConnected(){for(let at=this;at!==null;at=at.parentNode)if(at===document)return true;return false;}
  getAttribute(name){return this.attributes.get(name)??null;}
  setAttribute(name,value){state.writes++;this.attributes.set(name,String(value));}
  removeAttribute(name){state.writes++;this.attributes.delete(name);}
  insertBefore(child,before){
   if(state.failInsert)throw new Error('the page refused');
   state.writes++;child.remove();const index=before===null?this.children.length:this.children.indexOf(before);
   if(index<0)throw new Error('not a child');this.children.splice(index,0,child);child.parentNode=this;return child;}
  remove(){if(this.parentNode===null)return;const siblings=this.parentNode.children;siblings.splice(siblings.indexOf(this),1);this.parentNode=null;}
  after(node){this.parentNode.insertBefore(node,this.parentNode.children[this.parentNode.children.indexOf(this)+1]??null);}
  /** A fixed element lands where its style says, moved by whatever ancestor it is placed against. */
  getBoundingClientRect(){const read=name=>Number(new RegExp('(?:^|;)'+name+':(-?[\\d.]+)px').exec(this.style.cssText)?.[1]);
   return {left:read('left')+state.offset.x,top:read('top')+state.offset.y,width:read('width'),height:read('height')};}
  focus(options){state.focused.push([this.id||this.tagName,options]);}
 }
 document.createElement=tag=>{if(state.failCreate)throw new Error('the page made nothing');return new Element(tag);};
 document.getElementById=id=>[...document.all].find(element=>element.isConnected&&element.id===id)??null;
 const html=new Element('html'),body=new Element('body'),canvas=new Element('canvas');
 html.parentNode=document;html.children.push(body);body.parentNode=html;body.children.push(canvas);canvas.parentNode=body;
 canvas.getBoundingClientRect=()=>({...state.rect});
 const window=Object.assign(new Target(),{visualViewport:new Target(),getComputedStyle:node=>({getPropertyValue:name=>node.css[name]??plain[name]??''})});
 /** An event that reached the container from one of the elements inside it. */
 function emit(container,target,type){
  const event=new Event(type,{cancelable:true,bubbles:true});
  Object.defineProperty(event,'target',{value:target});
  container.dispatchEvent(event);
  return event;
 }
 return {document,body,canvas,window,state,listeners,emit,Element,live:()=>listeners.filter(pair=>!pair.removed)};
}
function fixture(run,options={}){
 const dom=page();
 options.prepare?.(dom);
 const saved=[globalThis.window,globalThis.document,globalThis.reportError];
 globalThis.window=options.window===null?undefined:dom.window;globalThis.document=options.document===null?undefined:dom.document;
 const semantics=createUiSemantics(),described={},failures=[],done=[];
 const add=(id,role,description={},extra={})=>{described[id]={bounds:box(),...description};return semantics.add({id,role,describe:()=>described[id],...extra});};
 const create=(extra={})=>createBrowserSemantics({semantics,canvas:dom.canvas,width:100,height:80,onError:cause=>failures.push(cause),...extra});
 const attributes=element=>Object.fromEntries([...element.attributes].filter(([name])=>name!=='id'&&name!=='style'));
 /** The projection as nested [tag, attributes, text, children] rows. */
 const outline=element=>element.children.map(child=>[child.tagName.toLowerCase(),attributes(child),child.textContent,outline(child)].filter((part,index)=>index<2||(index===2?part!=='':part.length>0)));
 try{return run({...dom,semantics,described,add,create,failures,done,attributes,outline});}
 finally{semantics.dispose();[globalThis.window,globalThis.document,globalThis.reportError]=saved;}
}

test('BS01 the canvas owns an invisible container with one element for each published node',()=>fixture(({canvas,body,semantics,add,create,outline})=>{
 add('panel','group',{name:'Settings',bounds:box(10,10,80,60)});
 add('title','text',{name:'Sound and music'},{parent:'panel'});
 add('sound','switch',{name:'Sound',checked:true},{parent:'panel',onActivate(){},onFocus(){}});
 add('size','radiogroup',{name:'Size'},{parent:'panel'});add('small','radio',{name:'Small',checked:false,position:{index:1,size:2}},{parent:'size'});
 add('portrait','image',{name:'Portrait'});add('close','button',{name:'Close'},{onActivate(){}});
 semantics.publish();
 const browser=create({label:'Outfit Studio'}),container=browser.container;
 assert.equal(browser.state,'active');assert.ok(Object.isFrozen(browser));
 same(body.children,[canvas,container],'the container follows the canvas');
 assert.match(container.id,/^egret-semantics-\d+$/);
 assert.deepEqual([canvas.getAttribute('role'),canvas.getAttribute('aria-label'),canvas.getAttribute('aria-owns'),canvas.getAttribute('aria-activedescendant')],['application','Outfit Studio',container.id,null]);
 assert.equal(container.style.cssText,'position:fixed;left:10px;top:20px;width:100px;height:80px;transform-origin:0 0;transform:scale(2,2);overflow:hidden;pointer-events:none;opacity:0;margin:0;padding:0;border:0');
 assert.deepEqual(outline(container),[
  ['div',{role:'group','aria-label':'Settings'},[
   ['div',{},'Sound and music'],
   ['button',{type:'button',role:'switch','aria-label':'Sound','aria-checked':'true',tabindex:'-1'}],
   ['div',{role:'radiogroup','aria-label':'Size'},[['button',{type:'button',role:'radio','aria-label':'Small','aria-checked':'false','aria-posinset':'1','aria-setsize':'2',tabindex:'-1'}]]]]],
  ['div',{role:'img','aria-label':'Portrait'}],
  ['button',{type:'button','aria-label':'Close',tabindex:'-1'}]]);
 const sound=browser.elementOf('sound');
 assert.equal(sound,container.children[0].children[1]);assert.match(sound.id,new RegExp('^'+container.id+'-\\d+$'));assert.equal(browser.elementOf('missing'),undefined);
 assert.equal(new Set(semantics.snapshot.nodes.map(node=>browser.elementOf(node.id).id)).size,7,'every element has its own id');
}));

test('BS02 every state is written as the attribute a reader looks for, and only what changed is written',()=>fixture(({semantics,described,add,create,attributes,state})=>{
 add('all','checkbox',{name:'All',checked:'mixed',disabled:true});add('list','listbox',{name:'Colours'});add('red','option',{name:'Red',selected:true,position:{index:3,size:9}},{parent:'list'});
 add('view','group',{name:'Messages'});add('bar','scrollbar',{name:'Scroll',range:{now:20,min:0,max:150},orientation:'horizontal',controls:'view'},{onFocus(){}});
 add('field','textbox',{name:'Name',value:'张三',multiline:true},{onActivate(){}});add('menu','button',{name:'More',expanded:true});add('ask','dialog',{name:'Rename',modal:false});
 add('team','listbox',{name:'Team',multiple:true});add('single','listbox',{name:'One'});
 add('actions','menu',{name:'Member'});add('send','menuitem',{name:'Send',position:{index:1,size:2}},{parent:'actions',onActivate(){},onFocus(){}});add('dismiss','menuitem',{name:'Dismiss',disabled:true},{parent:'actions',onFocus(){}});
 add('tabs','tablist',{name:'Sect'});add('one','tab',{name:'Members',selected:true,controls:'pane',position:{index:1,size:2}},{parent:'tabs',onActivate(){},onFocus(){}});add('two','tab',{name:'Stores',selected:false,disabled:true},{parent:'tabs',onFocus(){}});
 add('pane','tabpanel',{name:'Members'});add('work','progressbar',{name:'Training',range:{now:30,min:0,max:100}},{parent:'pane'});add('busy','progressbar',{name:'Loading'},{parent:'pane'});
 add('herbs','spinbutton',{name:'Herbs',range:{now:20,min:0,max:60}},{onFocus(){}});add('left','status',{});add('fault','alert',{name:'Not enough'});
 add('volume','slider',{name:'Volume',range:{now:60,min:0,max:100}},{onFocus(){}});add('zoom','slider',{name:'Zoom',range:{now:1,min:0.5,max:4},orientation:'vertical',disabled:true},{onFocus(){}});
 const browser=create();
 assert.equal(browser.container.children.length,0);
 semantics.publish();
 const read=id=>attributes(browser.elementOf(id));
 assert.deepEqual(read('all'),{type:'button',role:'checkbox','aria-label':'All','aria-disabled':'true','aria-checked':'mixed',tabindex:'-1'});
 assert.deepEqual(read('red'),{type:'button',role:'option','aria-label':'Red','aria-selected':'true','aria-posinset':'3','aria-setsize':'9',tabindex:'-1'});
 assert.deepEqual(read('bar'),{role:'scrollbar','aria-label':'Scroll','aria-valuenow':'20','aria-valuemin':'0','aria-valuemax':'150','aria-orientation':'horizontal',tabindex:'-1','aria-controls':browser.elementOf('view').id});
 // A list box in which several options may be selected says so; one with a single selection says nothing.
 assert.deepEqual([read('team'),read('single')],[{role:'listbox','aria-label':'Team','aria-multiselectable':'true'},{role:'listbox','aria-label':'One'}]);
 // A menu and its items: an item is a native button that carries its role.
 assert.deepEqual(read('actions'),{role:'menu','aria-label':'Member','aria-orientation':'vertical'});
 assert.deepEqual(read('send'),{type:'button',role:'menuitem','aria-label':'Send','aria-posinset':'1','aria-setsize':'2',tabindex:'-1'});
 assert.deepEqual(read('dismiss'),{type:'button',role:'menuitem','aria-label':'Dismiss','aria-disabled':'true',tabindex:'-1'});
 // A row of tabs: each tab is a native button that carries its role, and the one that is selected names its panel.
 assert.deepEqual(read('tabs'),{role:'tablist','aria-label':'Sect','aria-orientation':'horizontal'});
 assert.deepEqual(read('one'),{type:'button',role:'tab','aria-label':'Members','aria-selected':'true','aria-posinset':'1','aria-setsize':'2',tabindex:'-1','aria-controls':browser.elementOf('pane').id});
 assert.deepEqual(read('two'),{type:'button',role:'tab','aria-label':'Stores','aria-disabled':'true','aria-selected':'false',tabindex:'-1'});
 assert.deepEqual([read('pane'),browser.elementOf('work').parentNode===browser.elementOf('pane')],[{role:'tabpanel','aria-label':'Members'},true]);
 // A progress bar has its value, or none while the length of the work is not known.
 assert.deepEqual(read('work'),{role:'progressbar','aria-label':'Training','aria-valuenow':'30','aria-valuemin':'0','aria-valuemax':'100'});assert.deepEqual(read('busy'),{role:'progressbar','aria-label':'Loading'});
 // A slider is a plain element with its value and its ends. One that takes the focus can be pointed at, unless it is disabled.
 assert.deepEqual(read('volume'),{role:'slider','aria-label':'Volume','aria-valuenow':'60','aria-valuemin':'0','aria-valuemax':'100','aria-orientation':'horizontal',tabindex:'-1'});
 assert.deepEqual(read('zoom'),{role:'slider','aria-label':'Zoom','aria-disabled':'true','aria-valuenow':'1','aria-valuemin':'0.5','aria-valuemax':'4','aria-orientation':'vertical'});
 // A spin button has its value and its ends and no direction. A message is its text, and is there, empty, before the first one.
 assert.deepEqual(read('herbs'),{role:'spinbutton','aria-label':'Herbs','aria-valuenow':'20','aria-valuemin':'0','aria-valuemax':'60',tabindex:'-1'});
 assert.deepEqual([read('left'),browser.elementOf('left').textContent,browser.elementOf('left').tagName,read('fault'),browser.elementOf('fault').textContent],[{role:'status'},'','DIV',{role:'alert'},'Not enough']);
 assert.deepEqual(read('field'),{role:'textbox','aria-label':'Name','aria-multiline':'true'});assert.equal(browser.elementOf('field').textContent,'张三');
 assert.deepEqual(read('menu'),{type:'button','aria-label':'More','aria-expanded':'true',tabindex:'-1'});assert.deepEqual(read('ask'),{role:'dialog','aria-label':'Rename'});
 // One changed value is one write.
 const writes=()=>{const before=state.writes;semantics.publish();return state.writes-before;};
 assert.equal(writes(),0);
 described.bar.range={now:21,min:0,max:150};assert.equal(writes(),1);assert.equal(read('bar')['aria-valuenow'],'21');
 described.volume.range={now:65,min:0,max:100};assert.equal(writes(),1);assert.equal(read('volume')['aria-valuenow'],'65');
 // A message that changes is one write into the element that was already there, which is what makes a reader say it.
 const live=browser.elementOf('left');described.left.name='40 left';assert.equal(writes(),1);assert.deepEqual([browser.elementOf('left')===live,live.textContent,read('left')],[true,'40 left',{role:'status'}]);
 described.left.name='';assert.equal(writes(),1);assert.equal(live.textContent,'');described.herbs.range={now:21,min:0,max:60};assert.equal(writes(),1);assert.equal(read('herbs')['aria-valuenow'],'21');
 described.team.multiple=false;assert.equal(writes(),1);assert.deepEqual(read('team'),{role:'listbox','aria-label':'Team'});
 described.work.range={now:40,min:0,max:100};assert.equal(writes(),1);described.busy.range={now:1,min:0,max:4};assert.equal(writes(),3);described.busy.range=undefined;assert.equal(writes(),3);assert.deepEqual(read('busy'),{role:'progressbar','aria-label':'Loading'});
 described.one.selected=false;described.one.controls=undefined;described.two.selected=true;assert.equal(writes(),3);assert.deepEqual([read('one')['aria-selected'],read('one')['aria-controls'],read('two')['aria-selected']],['false',undefined,'true']);
 described.all.checked=false;described.all.disabled=false;assert.equal(writes(),2);assert.deepEqual(read('all'),{type:'button',role:'checkbox','aria-label':'All','aria-checked':'false',tabindex:'-1'});
 described.field.value='';described.field.multiline=false;described.menu.expanded=false;described.red.selected=false;described.red.position=undefined;described.bar.controls=undefined;
 semantics.publish();
 assert.equal(browser.elementOf('field').textContent,'');assert.deepEqual(read('field'),{role:'textbox','aria-label':'Name'});assert.equal(read('menu')['aria-expanded'],'false');
 assert.deepEqual(read('red'),{type:'button',role:'option','aria-label':'Red','aria-selected':'false',tabindex:'-1'});assert.equal('aria-controls' in read('bar'),false);
 described.ask.modal=true;semantics.publish();assert.deepEqual(read('ask'),{role:'dialog','aria-label':'Rename','aria-modal':'true'});assert.equal(read('red').inert,undefined);assert.equal(read('list').inert,'');
 // A focusable node that is disabled is not offered to a request for the focus.
 described.ask.modal=false;described.bar.disabled=true;semantics.publish();assert.equal('tabindex' in read('bar'),false);assert.equal(read('bar')['aria-disabled'],'true');
 described.view.name='';semantics.publish();assert.equal('aria-label' in read('view'),false);
}));

test('BS02b no element of the projection is a stop of the Tab key, whatever it can do',()=>fixture(({semantics,described,add,create,attributes})=>{
 // A native button is a stop of the page unless it says otherwise. One that is disabled, or that cannot be asked to take the focus, says so like any other.
 add('plain','button',{name:'Plain'});add('off','button',{name:'Off',disabled:true},{onActivate(){},onFocus(){}});add('on','button',{name:'On'},{onFocus(){}});
 add('menu','menu',{name:'Menu'});add('item','menuitem',{name:'Item',disabled:true},{parent:'menu'});add('box','checkbox',{name:'Box',checked:false});
 add('words','text',{name:'Words'});add('bar','slider',{name:'Bar',range:{now:0,min:0,max:1}});add('held','slider',{name:'Held',range:{now:0,min:0,max:1}},{onFocus(){}});
 const browser=create();semantics.publish();
 const stop=id=>attributes(browser.elementOf(id)).tabindex;
 assert.deepEqual(['plain','off','on','item','box'].map(id=>[browser.elementOf(id).tagName,stop(id)]),Array(5).fill(['BUTTON','-1']));
 // A plain element is no stop of the page by itself: it says so only where a request may give it the focus.
 assert.deepEqual(['menu','words','bar','held'].map(id=>[browser.elementOf(id).tagName,stop(id)]),[['DIV',undefined],['DIV',undefined],['DIV',undefined],['DIV','-1']]);
 // It stays so through every change of what the node can do.
 described.off.disabled=false;described.on.disabled=true;described.held.disabled=true;described.item.disabled=false;semantics.publish();
 assert.deepEqual(['plain','off','on','item','box','held'].map(stop),['-1','-1','-1','-1','-1',undefined]);
}));

test('BS03 bounds are logical inside the container, and one scale maps it onto the canvas',()=>fixture(({canvas,window,semantics,described,add,create,state,emit})=>{
 add('panel','group',{bounds:box(10,20,60,40)});add('inner','group',{bounds:box(15,30,40,20)},{parent:'panel'});add('ok','button',{name:'OK',bounds:box(20,35,30,10)},{parent:'inner'});
 semantics.publish();
 const browser=create(),style=id=>browser.elementOf(id).style.cssText;
 const at=(left,top,width,height)=>'position:absolute;box-sizing:border-box;margin:0;padding:0;border:0;left:'+left+'px;top:'+top+'px;width:'+width+'px;height:'+height+'px';
 assert.deepEqual([style('panel'),style('inner'),style('ok')],[at(10,20,60,40),at(5,10,40,20),at(5,5,30,10)]);
 // A parent that moves takes its children with it: only what moved against its parent is written again.
 described.panel.bounds=box(12,20,60,40);described.inner.bounds=box(17,30,40,20);described.ok.bounds=box(22,35,30,10);
 const before=state.writes;semantics.publish();
 assert.equal(state.writes-before,1);assert.deepEqual([style('panel'),style('inner'),style('ok')],[at(12,20,60,40),at(5,10,40,20),at(5,5,30,10)]);
 // The canvas is resized and scrolled by the page: the container follows and no element is written.
 state.rect={left:30,top:5,width:300,height:160};
 const resized=state.writes;window.dispatchEvent(new Event('resize'));
 assert.equal(state.writes-resized,1);assert.match(browser.container.style.cssText,/^position:fixed;left:30px;top:5px;width:100px;height:80px;transform-origin:0 0;transform:scale\(3,2\);/);
 for(const [target,type,left] of [[window,'scroll',31],[window,'orientationchange',32],[window.visualViewport,'resize',33],[window.visualViewport,'scroll',34]]){
  state.rect={...state.rect,left};target.dispatchEvent(new Event(type));assert.match(browser.container.style.cssText,new RegExp('left:'+left+'px;'),type);
 }
 // A change of layout that came with no event is picked up by sync, and by the next publication.
 state.rect={...state.rect,left:40};const idle=state.writes;window.dispatchEvent(new Event('focus'));assert.equal(state.writes,idle);
 browser.sync();assert.match(browser.container.style.cssText,/left:40px;/);const synced=state.writes;browser.sync();assert.equal(state.writes,synced);
 state.rect={...state.rect,top:9};described.ok.name='Fine';semantics.publish();assert.match(browser.container.style.cssText,/top:9px;/);
 // An ancestor the fixed container is placed against: where it landed is measured and corrected.
 state.offset={x:7,y:-3};state.rect={...state.rect,left:50};browser.sync();
 assert.match(browser.container.style.cssText,/^position:fixed;left:43px;top:12px;/);
 const landed=browser.container.getBoundingClientRect();assert.deepEqual([landed.left,landed.top],[50,9]);
 for(const [offset,expected] of [[{x:5,y:0},/^position:fixed;left:45px;top:9px;/],[{x:0,y:4},/^position:fixed;left:50px;top:5px;/],[{x:0,y:0},/^position:fixed;left:50px;top:9px;/]]){
  state.offset=offset;state.rect={...state.rect,width:state.rect.width+1};browser.sync();assert.match(browser.container.style.cssText,expected,JSON.stringify(offset));
 }
 assert.equal(canvas.getAttribute('aria-owns'),browser.container.id);
}));

test('BS03b a scroll anywhere in the page is heard, and a page without a visual viewport is served',()=>{
 fixture(({window,create,listeners,live})=>{
  create();
  assert.deepEqual(live().map(pair=>[pair.target===window?'window':pair.target===window.visualViewport?'viewport':'container',pair.type,pair.options.capture===true]),
   [['container','click',false],['container','focusin',false],['window','resize',false],['window','orientationchange',false],['window','scroll',true],['viewport','resize',false],['viewport','scroll',false]]);
  assert.equal(listeners.length,7);
 });
 for(const value of [undefined,null])fixture(({window,create,live,semantics,add,state})=>{
  const browser=create();assert.equal(live().length,5);
  add('a','button',{name:'A'});semantics.publish();state.rect={...state.rect,left:11};window.dispatchEvent(new Event('scroll'));
  assert.match(browser.container.style.cssText,/left:11px;/);browser.dispose();assert.equal(live().length,0);
 },{prepare:dom=>{dom.window.visualViewport=value;}});
});

test('BS04 the elements keep the reading order, and a node that is no longer published has no element',()=>fixture(({semantics,described,add,create,document})=>{
 add('list','list');const rows=['a','b','c'].map((id,index)=>add(id,'listitem',{order:index},{parent:'list'}));add('label','text',{name:'Row a'},{parent:'a'});add('after','button',{name:'After'});
 const browser=create();semantics.publish();
 const order=()=>browser.container.children.map(child=>[child.getAttribute('role')??child.tagName,child.children.map(row=>row.children.length)]);
 const elements=Object.fromEntries(['list','a','b','c','label','after'].map(id=>[id,browser.elementOf(id)]));
 same(elements.list.children,[elements.a,elements.b,elements.c]);assert.deepEqual(order(),[['list',[1,0,0]],['BUTTON',[]]]);
 described.a.order=5;semantics.publish();
 same(elements.list.children,[elements.b,elements.c,elements.a]);assert.equal(browser.elementOf('a'),elements.a,'a moved element is the same element');assert.equal(elements.label.parentNode,elements.a);
 described.b.hidden=true;semantics.publish();
 same(elements.list.children,[elements.c,elements.a]);assert.equal(browser.elementOf('b'),undefined);assert.equal(elements.b.parentNode,null);
 described.b.hidden=false;described.b.order=-1;semantics.publish();
 assert.deepEqual(elements.list.children.map(child=>child===elements.c||child===elements.a),[false,true,true]);assert.notEqual(browser.elementOf('b'),elements.b);
 // A row leaves and its id comes back as another kind of control: the element is made anew.
 rows[2].remove();add('c','button',{name:'C'});semantics.publish();
 assert.equal(browser.elementOf('c').tagName,'BUTTON');assert.equal(browser.elementOf('c').parentNode,browser.container);assert.equal(elements.c.parentNode,null);
 same(browser.container.children,[elements.list,elements.after,browser.elementOf('c')]);
 described.list.hidden=true;semantics.publish();
 same(browser.container.children,[elements.after,browser.elementOf('c')]);assert.equal(browser.elementOf('label'),undefined);
 assert.equal([...document.all].filter(element=>element.isConnected&&element.id.startsWith(browser.container.id+'-')).length,2);
}));

test('BS05 the canvas names the focused node as its active descendant',()=>fixture(({canvas,semantics,described,add,create})=>{
 add('a','button',{name:'A'});add('b','button',{name:'B',focused:true});
 semantics.publish();
 const browser=create();
 assert.equal(canvas.getAttribute('aria-activedescendant'),browser.elementOf('b').id);
 described.b.focused=false;described.a.focused=true;semantics.publish();assert.equal(canvas.getAttribute('aria-activedescendant'),browser.elementOf('a').id);
 described.a.focused=false;semantics.publish();assert.equal(canvas.getAttribute('aria-activedescendant'),null);
 // A value that is not this adapter's is not taken away.
 canvas.setAttribute('aria-activedescendant','their-own');semantics.publish();described.a.name='AA';semantics.publish();assert.equal(canvas.getAttribute('aria-activedescendant'),'their-own');
 described.a.focused=true;semantics.publish();assert.equal(canvas.getAttribute('aria-activedescendant'),browser.elementOf('a').id);
 described.a.hidden=true;semantics.publish();assert.equal(canvas.getAttribute('aria-activedescendant'),null);
}));

test('BS06 a click and a request for the focus reach the control, and the keyboard stays with the canvas',()=>fixture(({canvas,semantics,described,add,create,emit,state,failures,done})=>{
 add('panel','group');add('go','button',{name:'Go'},{parent:'panel',onActivate:()=>done.push('go'),onFocus:()=>done.push('focus go')});
 add('label','text',{name:'Label'},{parent:'panel'});add('quiet','button',{name:'Quiet'});
 const cause=new Error('activation failed');add('breaks','button',{name:'Breaks'},{onActivate(){throw cause;},onFocus(){throw cause;}});
 semantics.publish();
 const browser=create(),container=browser.container;
 const click=emit(container,browser.elementOf('go'),'click');
 assert.deepEqual(done,['go']);assert.equal(click.defaultPrevented,true);assert.deepEqual(state.focused,[]);
 emit(container,browser.elementOf('go'),'focusin');
 assert.deepEqual(done,['go','focus go']);assert.deepEqual(state.focused,[['CANVAS',{preventScroll:true}]]);
 // An element that performs nothing changes nothing, and neither does the container itself.
 assert.equal(emit(container,browser.elementOf('label'),'click').defaultPrevented,true);emit(container,browser.elementOf('quiet'),'click');
 assert.equal(emit(container,container,'click').defaultPrevented,false);emit(container,container,'focusin');
 assert.deepEqual(done,['go','focus go']);assert.equal(state.focused.length,1);
 emit(container,browser.elementOf('label'),'focusin');assert.equal(state.focused.length,2,'the focus goes back to the canvas whatever the node did with the request');
 // A control that fails is reported, and the others go on.
 emit(container,browser.elementOf('breaks'),'click');emit(container,browser.elementOf('breaks'),'focusin');
 assert.deepEqual(failures,[cause,cause]);assert.equal(browser.state,'active');assert.equal(state.focused.length,3);
 emit(container,browser.elementOf('go'),'click');assert.equal(done.length,3);
 // What is published decides: a disabled node refuses, and a removed one is no longer there.
 described.go.disabled=true;semantics.publish();emit(container,browser.elementOf('go'),'click');assert.equal(done.length,3);
 const stale=browser.elementOf('quiet');described.quiet.hidden=true;semantics.publish();emit(container,stale,'click');assert.equal(failures.length,2);
 // A canvas that cannot take the focus is left alone.
 canvas.focus=undefined;emit(container,browser.elementOf('label'),'focusin');assert.equal(browser.state,'active');assert.equal(failures.length,2);
}));

test('BS07 the outermost element outside a modal dialog is inert, and the page does the rest',()=>fixture(({semantics,described,add,create})=>{
 add('page','group');add('save','button',{name:'Save'},{parent:'page'});add('tools','group',{},{parent:'page'});add('cut','button',{name:'Cut'},{parent:'tools'});
 add('layer','group',{},{parent:'page'});add('ask','dialog',{name:'Rename',modal:true},{parent:'layer'});add('ok','button',{name:'OK'},{parent:'ask'});add('status','text',{name:'Ready'});
 semantics.publish();
 const browser=create(),inert=()=>semantics.snapshot.nodes.filter(node=>browser.elementOf(node.id).getAttribute('inert')==='').map(node=>node.id);
 assert.deepEqual(inert(),['save','tools','status'],'what is inside an inert element needs no attribute of its own');
 assert.equal(browser.elementOf('ask').getAttribute('aria-modal'),'true');
 described.ask.hidden=true;semantics.publish();assert.deepEqual(inert(),[]);
 described.ask.hidden=false;semantics.publish();assert.deepEqual(inert(),['save','tools','status']);
}));

test('BS08 a relation is written with the id of the element it names',()=>fixture(({semantics,described,add,create})=>{
 add('bar','scrollbar',{name:'Scroll',range:{now:0,min:0,max:1},controls:'view'});const view=add('view','group',{name:'Messages'});
 semantics.publish();
 const browser=create(),first=browser.elementOf('view').id;
 assert.equal(browser.elementOf('bar').getAttribute('aria-controls'),first,'the named element may come later in the tree');
 view.remove();add('view','list');semantics.publish();
 assert.notEqual(browser.elementOf('view').id,first);assert.equal(browser.elementOf('bar').getAttribute('aria-controls'),browser.elementOf('view').id);
}));

test('BS09 what the application set on its canvas is left as it was',()=>fixture(({canvas,semantics,add,create})=>{
 canvas.setAttribute('role','group');canvas.setAttribute('aria-label','Their name');canvas.setAttribute('aria-owns','their-list');
 add('a','button',{name:'A',focused:true});semantics.publish();
 const browser=create({label:'Ours'}),id=browser.container.id;
 assert.deepEqual([canvas.getAttribute('role'),canvas.getAttribute('aria-label'),canvas.getAttribute('aria-owns')],['group','Their name','their-list '+id]);
 browser.dispose();
 assert.deepEqual([canvas.getAttribute('role'),canvas.getAttribute('aria-label'),canvas.getAttribute('aria-owns'),canvas.getAttribute('aria-activedescendant')],['group','Their name','their-list',null]);
 // Set by the adapter and then changed by the application: it is theirs now.
 const second=create({label:'Ours'});
 canvas.setAttribute('aria-owns','their-list other');canvas.removeAttribute('role');canvas.setAttribute('role','region');
 second.dispose();
 assert.deepEqual([canvas.getAttribute('role'),canvas.getAttribute('aria-owns')],['region','their-list other']);
}));

test('BS10 disposing takes the projection off the page and leaves the tree alone',()=>fixture(({canvas,body,semantics,described,add,create,live,state,emit,done})=>{
 add('a','button',{name:'A',focused:true},{onActivate:()=>done.push('a')});semantics.publish();
 const browser=create({label:'Game'}),container=browser.container,element=browser.elementOf('a');
 assert.equal(live().length,7);
 browser.dispose();browser.dispose();
 assert.equal(browser.state,'closed');same(body.children,[canvas]);assert.equal(live().length,0);assert.equal(browser.elementOf('a'),undefined);
 assert.deepEqual(['role','aria-label','aria-owns','aria-activedescendant'].map(name=>canvas.getAttribute(name)),[null,null,null,null]);
 const before=state.writes;described.a.name='B';semantics.publish();browser.sync();emit(container,element,'click');
 assert.equal(state.writes,before);assert.deepEqual(done,[]);assert.equal(semantics.state,'active');
 // The canvas is free for another projection, and a tree that closes takes its projection with it.
 const second=create();assert.equal(second.container.id===container.id,false);assert.equal(second.elementOf('a').getAttribute('aria-label'),'B');
 semantics.dispose();
 assert.equal(second.state,'closed');same(body.children,[canvas]);assert.equal(live().length,0);assert.equal(canvas.getAttribute('aria-owns'),null);
}));

test('BS11 a page the projection cannot be laid over is refused before anything is written',()=>{
 const refuses=(code,options={})=>fixture(({canvas,body,state,create,live,semantics})=>{
  const before=state.writes,children=[...body.children];
  assert.throws(()=>create(options.extra?.({canvas,semantics})),coded(code));
  assert.equal(state.writes,before);same(body.children,children);assert.equal(live().length,0);
 },options);
 refuses('UI_SEMANTICS_SURFACE_INVALID',{window:null});
 refuses('UI_SEMANTICS_SURFACE_INVALID',{prepare:dom=>{dom.body.css.transform='matrix(1, 0, 0, 1, 0, 0)';}});
 refuses('UI_SEMANTICS_SURFACE_INVALID',{prepare:dom=>{dom.canvas.css.zoom='2';}});
 refuses('UI_SEMANTICS_SURFACE_INVALID',{prepare:dom=>{dom.canvas.remove();}});
 refuses('UI_SEMANTICS_SURFACE_INVALID',{prepare:dom=>{dom.canvas.ownerDocument={};}});
 refuses('UI_SEMANTICS_SURFACE_INVALID',{document:null});
 refuses('UI_SEMANTICS_SURFACE_INVALID',{prepare:dom=>{dom.window.getComputedStyle=undefined;}});
 for(const rect of [{width:0},{height:0},{width:-1},{left:Number.NaN},{top:Infinity},{width:Number.NaN},{height:-Infinity}])
  refuses('UI_SEMANTICS_SURFACE_INVALID',{prepare:dom=>{dom.state.rect={left:0,top:0,width:200,height:160,...rect};}});
 // Ancestors are elements all the way to the document, and there are not endlessly many of them.
 refuses('UI_SEMANTICS_SURFACE_INVALID',{prepare:dom=>{dom.body.nodeType=11;}});
 refuses('UI_SEMANTICS_SURFACE_INVALID',{prepare:dom=>{dom.document.children=[];dom.body.parentNode.parentNode=null;Object.defineProperty(dom.canvas,'isConnected',{value:true});}});
 const nested=depth=>dom=>{let holder=dom.body;for(let level=3;level<depth;level++){const next=new dom.Element('div');holder.insertBefore(next,null);holder=next;}holder.insertBefore(dom.canvas,null);};
 refuses('UI_SEMANTICS_SURFACE_INVALID',{prepare:nested(65)});
 fixture(({create})=>{assert.equal(create().state,'active');},{prepare:nested(64)});
 for(const extra of [()=>({canvas:null}),()=>({canvas:undefined}),()=>({semantics:null}),()=>({semantics:{}}),()=>({width:0}),()=>({height:0}),()=>({width:-1}),()=>({height:Infinity}),()=>({width:'100'}),()=>({semantics:'tree'}),
  ({semantics})=>({semantics:{state:'active',observe:semantics.observe}}),({semantics})=>({semantics:{state:'active',perform:semantics.perform}}),()=>({label:''}),()=>({label:'  '}),()=>({label:7}),
  ()=>({label:'a'.repeat(1025)}),()=>({onError:'report'})])refuses('UI_SEMANTICS_OPTIONS',{extra});
 for(const options of [null,[],'x'])assert.throws(()=>createBrowserSemantics(options),coded('UI_SEMANTICS_OPTIONS'));
 fixture(({canvas,create})=>{const browser=create({label:'a'.repeat(1024)});assert.equal(canvas.getAttribute('aria-label').length,1024);browser.dispose();});
 // A page that fails while the projection is being set up is left as it was found.
 fixture(({canvas,body,create,state,live})=>{
  state.failCreate=true;
  assert.throws(()=>create({label:'Game'}),error=>error.code==='UI_SEMANTICS_SURFACE_INVALID'&&error.cause?.message==='the page made nothing');
  same(body.children,[canvas]);assert.equal(live().length,0);assert.deepEqual([...canvas.attributes.keys()],[]);
  state.failCreate=false;assert.equal(create().state,'active','and the canvas is free');
 });
 fixture(({create,semantics})=>{semantics.dispose();assert.throws(()=>create(),coded('UI_SEMANTICS_CLOSED'));});
 fixture(({canvas,body,create,state})=>{
  const first=create(),before=state.writes;
  assert.throws(()=>create(),coded('UI_SEMANTICS_SURFACE_BUSY'));assert.equal(state.writes,before);assert.equal(first.state,'active');same(body.children,[canvas,first.container]);
  first.dispose();create().dispose();
 });
 // A second container never takes an id the page already uses.
 fixture(({create,document,body})=>{
  const probe=create(),number=Number(probe.container.id.split('-').at(-1));probe.dispose();
  const taken=document.createElement('div');taken.id='egret-semantics-'+(number+1);body.insertBefore(taken,null);
  assert.equal(create().container.id,'egret-semantics-'+(number+2));
 });
});

test('BS12 a page that fails stops the projection and is reported; the publication it failed in stands',()=>fixture(({canvas,body,semantics,described,add,create,state,failures,live})=>{
 add('a','button',{name:'A'});
 const browser=create();
 state.failInsert=true;
 assert.equal(semantics.publish().revision,1,'the tree is not failed by the page');
 assert.equal(failures.length,1);assert.equal(failures[0].message,'the page refused');assert.equal(browser.state,'closed');
 same(body.children,[canvas]);assert.equal(live().length,0);assert.equal(canvas.getAttribute('aria-owns'),null);
 described.a.name='B';assert.equal(semantics.publish().revision,2);assert.equal(failures.length,1);
 // Without a handler the failure goes to the page as an uncaught error. A canvas that left the page stops it too.
 state.failInsert=false;
 const reported=[];globalThis.reportError=cause=>reported.push(cause);
 const second=createBrowserSemantics({semantics,canvas,width:100,height:80});
 state.failInsert=true;add('b','button',{name:'B'});semantics.publish();
 assert.equal(reported.length,1);assert.equal(second.state,'closed');
 state.failInsert=false;
 // A canvas the page stops showing has its projection hidden, and shown again with it.
 const third=create();
 for(const rect of [{left:0,top:0,width:0,height:160},{left:0,top:0,width:200,height:0}]){
  state.rect=rect;third.sync();assert.equal(third.container.style.cssText,'display:none');
  state.rect={left:10,top:20,width:200,height:160};third.sync();assert.match(third.container.style.cssText,/^position:fixed;/);
 }
 state.rect={left:0,top:0,width:0,height:0};third.sync();
 assert.equal(third.container.style.cssText,'display:none');assert.equal(third.state,'active');
 const hidden=state.writes;third.sync();described.a.name='C';semantics.publish();assert.equal(third.container.style.cssText,'display:none');assert.equal(state.writes-hidden,1,'only the changed name is written while hidden');
 state.rect={left:10,top:20,width:200,height:160};third.sync();assert.match(third.container.style.cssText,/^position:fixed;left:10px;top:20px;/);
 // A rectangle that is not one stops it.
 state.rect={left:Number.NaN,top:0,width:10,height:10};
 assert.throws(()=>third.sync(),coded('UI_SEMANTICS_SURFACE_INVALID'));assert.equal(third.state,'closed');assert.equal(failures.length,2);same(body.children,[canvas]);
}));

test('BS12b a listener the page would not give back does nothing after the projection closed',()=>fixture(({canvas,window,create,state,failures,emit,semantics,add,done})=>{
 add('a','button',{name:'A'},{onActivate:()=>done.push('a')});semantics.publish();
 const browser=create(),container=browser.container,element=browser.elementOf('a');
 state.failRemove=true;browser.dispose();
 assert.equal(failures.length,7);assert.ok(failures.every(cause=>cause.message==='the page kept the listener'));assert.equal(browser.state,'closed');
 assert.equal(canvas.getAttribute('aria-owns'),null);assert.equal(container.parentNode,null);
 const before=state.writes;state.rect={...state.rect,left:99};
 window.dispatchEvent(new Event('resize'));window.dispatchEvent(new Event('scroll'));emit(container,element,'click');
 assert.equal(state.writes,before);assert.deepEqual(done,[]);assert.equal(failures.length,7);
}));

test('BS13 the entry has the one factory, and no other entry has it',async()=>{
 assert.deepEqual(Object.keys(await import('@egret/engine/web/semantics')),['createBrowserSemantics']);
 for(const entry of ['@egret/engine','@egret/engine/ui','@egret/engine/ui/semantics','@egret/engine/web/hover'])assert.equal('createBrowserSemantics' in await import(entry),false,entry);
});

test('BS14 a strict consumer compiles against both entries, and nine misuses are refused',()=>{
 const result=spawnSync(process.execPath,['node_modules/typescript/bin/tsc','--project','tests/types/semantics.json','--pretty','false'],{cwd:new URL('..',import.meta.url),encoding:'utf8'});
 assert.equal(result.status,0,result.stdout+result.stderr);
});
