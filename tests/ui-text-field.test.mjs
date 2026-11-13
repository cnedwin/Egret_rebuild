// SPDX-License-Identifier: Apache-2.0
// The state of a drawn text field on a genuine Engine, with a test-owned editor in place of the platform's.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createEngine,DisplayObjectContainer} from '@egret/engine';
import {createPointerInput} from '@egret/engine/input';
import {createTextFieldControl} from '@egret/engine/ui';
import {createUiSemantics} from '@egret/engine/ui/semantics';
import {spawnSync} from 'node:child_process';
import {host} from './helpers.mjs';

const coded=code=>error=>error?.code===code;
/** An editor that shows one field at a time, as the platform text input does: opening another cancels the one that is open. */
function editor(){
 const log=[];let open;
 const end=(name,...values)=>{const request=open;if(request===undefined)return;open=undefined;request[name](...values);};
 return {log,get request(){return open;},
  open(request){end('onCancel');log.push('open');open=request;},
  commit(){log.push('commit');end('onCommit',open?.typed??open?.value);},
  cancel(){log.push('cancel');end('onCancel');},
  setValue(value){log.push('set '+value);if(open)open.typed=value;},
  /** What the player does in the field. */
  type(value,composing=false){open.typed=value;open.onChange({value,composing});},
  enter(){end('onCommit',open.typed??open.value);},
  escape(){end('onCancel');}};
}
async function fixture(run){
 const engine=await createEngine({host:host().adapter}),scope=engine.createScope();
 const make=(x,y)=>{const node=scope.use(new DisplayObjectContainer());node.x=x;node.y=y;node.hitArea={x:0,y:0,width:80,height:20};node.touchEnabled=true;engine.stage.addChild(node);return node;};
 const input=createPointerInput({engine,scope,width:200,height:100}),name=make(10,10),note=make(10,50),platform=editor(),events=[];
 let clock=0;
 const down=(x,y)=>input.begin({pointerId:1,pointerType:'mouse',globalX:x,globalY:y,buttons:1,timestamp:++clock});
 const up=(contact,x,y)=>input.end(contact,{globalX:x,globalY:y,buttons:0,timestamp:++clock});
 const press=(x,y)=>up(down(x,y),x,y);
 const create=(extra={})=>createTextFieldControl({input,target:name,editor:platform,field:()=>({x:10,y:10,width:80,height:20,fontSize:14}),
  onChange:(value,previous)=>events.push(['change',value,previous]),onInput:change=>events.push(['input',change.value,change.composing]),
  onEditingChange:editing=>events.push(['editing',editing]),onPressChange:pressed=>events.push(['pressed',pressed]),...extra});
 try{await run({engine,scope,input,name,note,platform,events,down,up,press,create});}finally{input.dispose();await engine.dispose();}
}

test('TF01 a completed press opens the editor over the place the application names',async()=>fixture(({platform,events,down,up,create})=>{
 let asked=0;
 const field=create({value:'张三',maxLength:8,placeholder:'最多 8 个字',label:'Name',field:()=>({x:10+asked++,y:10,width:80,height:20,fontSize:14,color:0xf3e9d2})});
 assert.ok(Object.isFrozen(field));
 assert.deepEqual([field.value,field.draft,field.composing,field.editing,field.pressed,field.enabled],['张三','张三',false,false,false,true]);
 const contact=down(20,15);
 assert.equal(field.pressed,true);assert.equal(field.editing,false);assert.equal(asked,0,'nothing is opened by holding');
 up(contact,20,15);
 assert.equal(field.editing,true);assert.deepEqual(events,[['pressed',true],['pressed',false],['editing',true]]);assert.deepEqual(platform.log,['open']);
 assert.deepEqual([field.draft,field.composing],['张三',false]);
 const {onChange,onCommit,onCancel,...request}=platform.request;
 assert.deepEqual(request,{x:10,y:10,width:80,height:20,fontSize:14,color:0xf3e9d2,value:'张三',multiline:false,password:false,maxLength:8,placeholder:'最多 8 个字',label:'Name'});
 assert.equal([onChange,onCommit,onCancel].every(callback=>typeof callback==='function'),true);
 // A second press while the field is open opens nothing more.
 up(down(20,15),20,15);assert.deepEqual(platform.log,['open']);assert.equal(field.edit(),false);
 platform.escape();assert.equal(field.edit(),true);assert.equal(platform.request.x,11,'the place is asked each time an edit begins');
}));

test('TF02 what the player commits becomes the text, after the edit has ended',async()=>fixture(({platform,events,press,create})=>{
 const field=create({value:'old'});
 press(20,15);events.length=0;
 platform.type('zhang',true);
 assert.deepEqual([field.value,field.draft,field.composing,field.editing],['old','zhang',true,true]);
 platform.type('张',false);platform.type('张三');
 assert.deepEqual(events,[['input','zhang',true],['input','张',false],['input','张三',false]]);assert.equal(field.value,'old','the text is not the value until it is committed');
 platform.enter();
 assert.deepEqual([field.value,field.draft,field.composing,field.editing],['张三','张三',false,false]);
 assert.deepEqual(events.slice(3),[['editing',false],['change','张三','old']]);
 // The same text committed again is an edit that changed nothing.
 press(20,15);events.length=0;platform.enter();assert.deepEqual(events,[['editing',false]]);
}));

test('TF03 a cancelled edit leaves the text as it was',async()=>fixture(({platform,events,press,create})=>{
 const field=create({value:'old'});
 press(20,15);platform.type('new');events.length=0;
 platform.escape();
 assert.deepEqual([field.value,field.draft,field.editing],['old','old',false]);assert.deepEqual(events,[['editing',false]]);
}));

test('TF04 the control ends its own edit through the editor, and does not wait for one that does not answer',async()=>fixture(({platform,events,press,create})=>{
 const field=create({value:'old'});
 field.commit();field.cancel();assert.deepEqual(platform.log,[],'nothing is open');
 press(20,15);platform.type('kept');field.commit();
 assert.deepEqual(platform.log,['open','commit']);assert.deepEqual([field.value,field.editing],['kept',false]);
 press(20,15);platform.type('dropped');field.cancel();
 assert.deepEqual(platform.log.slice(2),['open','cancel']);assert.deepEqual([field.value,field.draft,field.editing],['kept','kept',false]);
 // An editor that takes the request and never calls back.
 const silent={open(request){this.request=request;},commit(){},cancel(){},setValue(){}},quiet=create({editor:silent,value:'a'});
 events.length=0;
 assert.equal(quiet.edit(),true);silent.request.onChange({value:'b',composing:false});quiet.commit();
 assert.deepEqual([quiet.value,quiet.editing],['b',false]);
 quiet.edit();silent.request.onChange({value:'c',composing:false});quiet.cancel();assert.deepEqual([quiet.value,quiet.draft,quiet.editing],['b','b',false]);
 assert.deepEqual(events,[['editing',true],['input','b',false],['editing',false],['change','b','a'],['editing',true],['input','c',false],['editing',false]]);
 // What an ended session says afterwards is not heard.
 const stale=silent.request;stale.onChange({value:'late',composing:true});stale.onCommit('late');stale.onCancel();
 assert.deepEqual([quiet.value,quiet.draft,quiet.composing,quiet.editing],['b','b',false,false]);assert.equal(events.length,7);
}));

test('TF05 two fields share one editor: opening the second ends the first',async()=>fixture(({platform,events,note,press,create})=>{
 const first=create({value:'one'}),seen=[];
 const second=create({target:note,value:'two',multiline:true,field:()=>({x:10,y:50,width:80,height:20}),onChange:(value,previous)=>seen.push(['change',value,previous]),onEditingChange:editing=>seen.push(['editing',editing]),onInput:undefined,onPressChange:undefined});
 press(20,15);platform.type('one!');
 press(20,55);
 assert.deepEqual([first.editing,first.value,first.draft,second.editing],[false,'one','one',true]);assert.equal(platform.request.multiline,true);
 assert.deepEqual(events.filter(row=>row[0]==='editing'),[['editing',true],['editing',false]]);
 platform.type('two\nlines');platform.enter();
 assert.deepEqual(seen,[['editing',true],['editing',false],['change','two\nlines','two']]);assert.equal(first.value,'one');
}));

test('TF06 the most characters are counted as a reader counts them',async()=>fixture(({platform,press,create})=>{
 const field=create({value:'一二三四五六',maxLength:4});
 assert.equal(field.value,'一二三四');
 field.setValue('😀😀😀😀😀');assert.equal(field.value,'😀😀😀😀');assert.equal(field.value.length,8,'a pair of surrogates is one character and is never split');
 field.setValue('a😀b');assert.equal(field.value,'a😀b');
 press(20,15);assert.equal(platform.request.maxLength,4);
 platform.type('张三李四王五');platform.enter();assert.equal(field.value,'张三李四');
 const free=create({value:'x'.repeat(5000)});assert.equal(free.value.length,5000);assert.equal('maxLength' in (free.edit(),platform.request),false);
}));

test('TF07 setting the text is not an edit, and replaces the text of an open field',async()=>fixture(({platform,events,press,create})=>{
 const field=create({value:'a'});
 field.setValue('b');field.setValue('b');
 assert.deepEqual(events,[['change','b','a']]);assert.deepEqual([field.value,field.draft,field.editing],['b','b',false]);assert.deepEqual(platform.log,[]);
 press(20,15);platform.type('typed');events.length=0;
 field.setValue('given');
 assert.deepEqual(platform.log,['open','set given']);assert.deepEqual([field.value,field.draft,field.editing],['given','given',true]);assert.deepEqual(events,[['change','given','b']]);
 platform.escape();assert.equal(field.value,'given','a cancelled edit goes back to the text that was set');
 for(const value of [undefined,null,7,{}])assert.throws(()=>field.setValue(value),coded('UI_CONTROL_OPTIONS'));
}));

test('TF08 a disabled field opens nothing, and disabling one that is open cancels its edit',async()=>fixture(({platform,events,press,create})=>{
 const field=create({value:'a'});
 field.setEnabled(false);
 press(20,15);assert.equal(field.edit(),false);field.press();field.release();
 assert.deepEqual(platform.log,[]);assert.deepEqual([field.enabled,field.editing,field.pressed],[false,false,false]);
 field.setEnabled(true);press(20,15);platform.type('typed');events.length=0;
 field.setEnabled(false);
 assert.deepEqual(platform.log,['open','cancel']);assert.deepEqual([field.value,field.editing,field.enabled],['a',false,false]);assert.deepEqual(events,[['editing',false]]);
 field.setEnabled(true);assert.equal(field.edit(),true);
 for(const value of [undefined,1,'true'])assert.throws(()=>field.setEnabled(value),coded('UI_CONTROL_OPTIONS'));
}));

test('TF09 a disposed field cancels its edit and answers nothing more',async()=>fixture(({platform,events,press,create})=>{
 const field=create({value:'a'});
 press(20,15);platform.type('typed');events.length=0;
 field.dispose();field.dispose();
 assert.deepEqual(platform.log,['open','cancel']);assert.deepEqual(events,[['editing',false]]);assert.deepEqual([field.value,field.draft,field.editing],['a','a',false]);
 for(const action of [()=>field.edit(),()=>field.commit(),()=>field.cancel(),()=>field.setValue('b')])assert.throws(action,coded('UI_CONTROL_CLOSED'));
 press(20,15);assert.deepEqual(platform.log,['open','cancel']);assert.equal(events.length,1);
 // A field disposed while nothing is open tells nobody.
 const idle=create();events.length=0;idle.dispose();assert.deepEqual(events,[]);
}));

test('TF10 an editor that refuses leaves the field as it was before the press',async()=>fixture(({events,create})=>{
 const cause=new Error('no field');let fail=true;
 const field=create({value:'a',editor:{open(){if(fail)throw cause;},commit(){},cancel(){},setValue(){}}});
 assert.throws(()=>field.edit(),error=>error===cause);
 assert.deepEqual([field.editing,field.value,field.draft],[false,'a','a']);assert.deepEqual(events,[]);
 fail=false;assert.equal(field.edit(),true);
 // A place that is not a rectangle is refused before the editor is asked.
 let rectangle;
 const placed=create({field:()=>rectangle});
 for(rectangle of [undefined,null,{x:0,y:0,width:0,height:10},{x:0,y:0,width:10,height:0},{x:0,y:0,width:-1,height:10},{x:0,y:0,width:10,height:-1},{x:Number.NaN,y:0,width:10,height:10},{x:0,y:Infinity,width:10,height:10},{x:0,y:0,width:'10',height:10},{x:0,y:0,width:10}]){
  assert.throws(()=>placed.edit(),coded('UI_CONTROL_OPTIONS'));assert.equal(placed.editing,false);
 }
 // An editor that refused after it had been typed into leaves no draft behind.
 const late=create({value:'a',editor:{open(request){request.onChange({value:'typed',composing:true});throw cause;},commit(){},cancel(){},setValue(){}}});
 assert.throws(()=>late.edit(),error=>error===cause);assert.deepEqual([late.editing,late.value],[false,'a']);
}));

test('TF11 an editor that ends the edit before it returns began nothing',async()=>fixture(({events,create})=>{
 for(const answer of ['onCancel','onCommit']){
  events.length=0;
  const field=create({value:'a',editor:{open(request){request[answer]('b');},commit(){},cancel(){},setValue(){}}});
  assert.equal(field.edit(),false);assert.equal(field.editing,false);
  assert.deepEqual(events,answer==='onCommit'?[['change','b','a']]:[],'no edit was reported as begun, so none is reported as ended');
 }
 // The same after an ordinary edit has come and gone.
 let immediate=false,request;
 events.length=0;
 const field=create({editor:{open(next){request=next;if(immediate)next.onCancel();},commit(){},cancel(){},setValue(){}}});
 field.edit();request.onCancel();immediate=true;assert.equal(field.edit(),false);
 assert.deepEqual(events,[['editing',true],['editing',false]]);
}));

test('TF12 options that are not sound are refused',async()=>fixture(({input,name,platform,create})=>{
 const field=()=>({x:0,y:0,width:10,height:10}),sound={input,target:name,editor:platform,field};
 for(const options of [null,undefined,[],'x',7])assert.throws(()=>createTextFieldControl(options),coded('UI_CONTROL_OPTIONS'),String(options));
 for(const options of [{...sound,editor:null},{...sound,editor:{}},{...sound,editor:{...platform,open:undefined}},{...sound,editor:{...platform,commit:1}},{...sound,editor:{...platform,cancel:'x'}},
  {...sound,editor:{...platform,setValue:undefined}},{...sound,field:{}},{...sound,field:undefined},{...sound,value:7},{...sound,multiline:1},{...sound,password:'yes'},{...sound,password:true,multiline:true},
  {...sound,maxLength:0},{...sound,maxLength:1.5},{...sound,maxLength:'8'},{...sound,placeholder:7},{...sound,label:{}},{...sound,onChange:1},{...sound,onInput:'x'},{...sound,onEditingChange:{}},{...sound,onPressChange:1},
  {...sound,target:undefined},{...sound,input:undefined}])assert.throws(()=>createTextFieldControl(options),error=>error?.code==='UI_CONTROL_OPTIONS'||error instanceof TypeError,JSON.stringify(Object.keys(options??{})));
 for(const options of [{...sound,editor:null},{...sound,field:{}},{...sound,password:true,multiline:true},{...sound,maxLength:0},{...sound,onChange:1}])assert.throws(()=>createTextFieldControl(options),coded('UI_CONTROL_OPTIONS'));
 const plain=create({password:true,maxLength:1,onChange:undefined,onInput:undefined,onEditingChange:undefined,onPressChange:undefined});
 plain.edit();const {onChange,onCommit,onCancel,...request}=platform.request;
 assert.deepEqual(request,{x:10,y:10,width:80,height:20,fontSize:14,value:'',multiline:false,password:true,maxLength:1},'what was not given is not passed');
 platform.type('ab');platform.enter();assert.equal(plain.value,'a');
}));

test('TF13 a key reaches the same path, and a cancelled press opens nothing',async()=>fixture(({input,platform,events,down,create})=>{
 const field=create();
 field.press();assert.equal(field.pressed,true);field.release();
 assert.equal(field.editing,true);assert.deepEqual(events,[['pressed',true],['pressed',false],['editing',true]]);
 platform.escape();
 const contact=down(20,15);input.cancel(contact,'pointercancel');
 assert.equal(field.editing,false);assert.deepEqual(platform.log,['open']);
}));

test('TF14 a listener that fails does not lose the text or leave the field editing',async()=>fixture(({platform,create})=>{
 const cause=new Error('listener failed');let fail=false;
 const seen=[],field=create({value:'a',onEditingChange(editing){if(fail&&!editing)throw cause;},onChange:(value,previous)=>seen.push([value,previous])});
 field.edit();platform.type('b');fail=true;
 assert.throws(()=>platform.enter(),error=>error===cause);
 assert.deepEqual([field.value,field.draft,field.editing],['b','b',false]);assert.deepEqual(seen,[['b','a']]);
 fail=false;field.edit();platform.type('c');fail=true;
 assert.throws(()=>field.setEnabled(false),error=>error===cause);assert.deepEqual([field.value,field.editing,field.enabled],['b',false,false]);
 fail=false;field.setEnabled(true);field.edit();fail=true;
 assert.throws(()=>field.dispose(),error=>error===cause);assert.equal(field.editing,false);assert.throws(()=>field.edit(),coded('UI_CONTROL_CLOSED'));
 // An editor that does not answer leaves the ending to the control, and the listener's failure still surfaces.
 const silent={open(){},commit(){},cancel(){},setValue(){}};
 for(const finish of ['commit','cancel']){
  fail=false;const quiet=create({editor:silent,onEditingChange(editing){if(fail&&!editing)throw cause;}});
  quiet.edit();fail=true;assert.throws(()=>quiet[finish](),error=>error===cause);assert.equal(quiet.editing,false);
 }
 // A held press is let go when the field is disposed, and a listener that fails then is not lost.
 let disposing=false;
 const held=create({onPressChange(pressed){if(disposing&&!pressed)throw cause;}});
 held.press();disposing=true;assert.throws(()=>held.dispose(),error=>error===cause);assert.throws(()=>held.edit(),coded('UI_CONTROL_CLOSED'));
}));

test('TF15 an editor that fails to end the edit is not trusted with its text',async()=>fixture(({events,create})=>{
 const cause=new Error('editor failed');let request;
 const broken={open(next){request=next;},commit(){throw cause;},cancel(){throw cause;},setValue(){}},field=create({value:'a',editor:broken});
 field.edit();request.onChange({value:'typed',composing:false});events.length=0;
 assert.throws(()=>field.commit(),error=>error===cause);
 assert.deepEqual([field.value,field.draft,field.editing],['a','a',false]);assert.deepEqual(events,[['editing',false]]);
 field.edit();assert.throws(()=>field.cancel(),error=>error===cause);assert.equal(field.editing,false);
 // What the editor reports is checked: a change that is no text is not taken, and a commit of none keeps what was typed.
 field.edit();
 for(const change of [null,undefined,'x',{value:7},{}])request.onChange(change);
 assert.equal(field.draft,'a');request.onChange({value:'typed',composing:'yes'});assert.deepEqual([field.draft,field.composing],['typed',false]);
 request.onCommit(undefined);assert.equal(field.value,'typed');
}));

test('TF16 the field is described as a textbox that is not announced twice while it is edited',async()=>fixture(({platform,create})=>{
 const field=create({value:'张三'}),semantics=createUiSemantics();
 semantics.add({id:'name',role:'textbox',describe:()=>({name:'Name',bounds:{x:10,y:10,width:80,height:20},value:field.value,hidden:field.editing,disabled:!field.enabled}),onActivate:()=>{field.edit();}});
 assert.equal(semantics.publish().nodes[0].value,'张三');
 assert.equal(semantics.perform('name','activate'),true);assert.equal(field.editing,true);
 assert.deepEqual(semantics.publish().nodes,[],'the open field is the editor\'s own element');
 platform.type('李四');platform.enter();
 assert.equal(semantics.publish().nodes[0].value,'李四');
 field.setEnabled(false);semantics.publish();assert.equal(semantics.perform('name','activate'),false);assert.equal(field.editing,false);
}));

test('TF17 a strict consumer compiles against the entry, with the platform text input as its editor, and seven misuses are refused',()=>{
 const result=spawnSync(process.execPath,['node_modules/typescript/bin/tsc','--project','tests/types/ui-text-field.json','--pretty','false'],{cwd:new URL('..',import.meta.url),encoding:'utf8'});
 assert.equal(result.status,0,result.stdout+result.stderr);
});
