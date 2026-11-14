// SPDX-License-Identifier: Apache-2.0
// The usual keys of drawn controls on a genuine Engine: the keyboard input delivers, the binding calls the control.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createEngine,DisplayObjectContainer,EgretError} from '@egret/engine';
import {createKeyboardInput,createPointerInput} from '@egret/engine/input';
import {createActionControl,createControlKeys,createMovementControl,createScrollControl,createSelectionGroup,createTextFieldControl,createToggleControl} from '@egret/engine/ui';
import {spawnSync} from 'node:child_process';
import {host} from './helpers.mjs';

const coded=code=>error=>error?.code===code;
const key=(code,extra={})=>({code,key:code,...extra});
async function fixture(run){
 const engine=await createEngine({host:host().adapter}),scope=engine.createScope();
 const make=(parent=engine.stage)=>{const node=scope.use(new DisplayObjectContainer());node.hitArea={x:0,y:0,width:40,height:20};node.touchEnabled=true;parent.addChild(node);return node;};
 const pointer=createPointerInput({engine,scope,width:200,height:100}),keyboard=createKeyboardInput({engine,scope});
 const a=make(),b=make(),log=[];
 keyboard.registerTarget({id:'a',target:a});keyboard.registerTarget({id:'b',target:b});keyboard.focus('a');
 /** Whether the key was taken, as the page asks before it scrolls. */
 const down=(code,extra)=>keyboard.keyDown(key(code,extra)),up=(code,extra)=>keyboard.keyUp(key(code,extra));
 const tap=(code,extra)=>[down(code,extra),up(code,extra)];
 const owned=[];
 const keys=options=>{const binding=createControlKeys({keyboard,target:a,...options});owned.push(binding);return binding;};
 try{await run({engine,scope,pointer,keyboard,a,b,make,log,down,up,tap,keys});}
 finally{for(const binding of owned)binding.dispose();keyboard.dispose();pointer.dispose();await engine.dispose();}
}

test('CK01 Space or Enter, released, activates an action; the hold is reported and nothing happens before the release',async()=>fixture(({pointer,a,log,down,up,keys})=>{
 const action=createActionControl({input:pointer,target:a,onActivate:()=>log.push('activate'),onPressChange:pressed=>log.push('control '+pressed)});
 const binding=keys({kind:'action',control:action,onPressChange:pressed=>log.push('keys '+pressed)});
 assert.ok(Object.isFrozen(binding));assert.equal(binding.pressed,false);
 assert.equal(down('Space'),true,'the key is taken so that the page does not scroll');
 assert.equal(binding.pressed,true);assert.equal(action.activationCount,0);assert.deepEqual(log,['keys true']);
 assert.equal(down('Space',{repeat:true}),true,'the repeats of the held key are taken with it');assert.equal(action.activationCount,0);
 assert.equal(up('Space'),true);
 assert.equal(binding.pressed,false);assert.equal(action.activationCount,1);
 assert.deepEqual(log,['keys true','keys false','control true','control false','activate']);
 for(const code of ['Enter','NumpadEnter']){assert.deepEqual([down(code),up(code)],[true,true]);}
 assert.equal(action.activationCount,3);
 // Any other key is not the control's.
 assert.deepEqual([down('KeyA'),up('KeyA'),down('ArrowDown'),up('ArrowDown'),down('Escape'),up('Escape')],[false,false,false,false,false,false]);
 assert.equal(action.activationCount,3);
}));

test('CK02 a hold that loses the focus, or the page, activates nothing',async()=>fixture(({pointer,keyboard,a,log,down,up,keys})=>{
 const action=createActionControl({input:pointer,target:a,onActivate:()=>log.push('activate')});
 const binding=keys({kind:'action',control:action,onPressChange:pressed=>log.push(pressed)});
 down('Space');keyboard.focus('b');
 assert.equal(binding.pressed,false);assert.deepEqual(log,[true,false]);
 assert.equal(up('Space'),false,'the release belongs to nobody');assert.equal(action.activationCount,0);
 keyboard.focus('a');down('Enter');keyboard.cancel('blur');
 assert.equal(binding.pressed,false);assert.equal(action.activationCount,0);assert.deepEqual(log,[true,false,true,false]);
 // The next whole press works as ever.
 keyboard.focus('a');down('Space');up('Space');assert.equal(action.activationCount,1);
}));

test('CK03 one key activates at a time, a shortcut is not an activation, and a disabled control takes no key',async()=>fixture(({pointer,a,down,up,keys})=>{
 const action=createActionControl({input:pointer,target:a});
 const binding=keys({kind:'action',control:action});
 down('Space');
 assert.equal(down('Enter'),false,'a second key while one is held is not armed');
 assert.equal(up('Enter'),false);assert.equal(action.activationCount,0);
 up('Space');assert.equal(action.activationCount,1);
 for(const modifier of ['altKey','ctrlKey','metaKey']){
  assert.equal(down('Enter',{[modifier]:true}),false,modifier);assert.equal(binding.pressed,false);assert.equal(up('Enter',{[modifier]:true}),false);
 }
 assert.equal(action.activationCount,1);
 assert.deepEqual([down('Space',{shiftKey:true}),up('Space',{shiftKey:true})],[true,true]);assert.equal(action.activationCount,2,'Shift is no shortcut');
 action.setEnabled(false);
 assert.deepEqual([down('Space'),binding.pressed,up('Space')],[false,false,false]);assert.equal(action.activationCount,2);
 // Disabled while the key is down: the release ends the hold and activates nothing.
 action.setEnabled(true);down('Space');action.setEnabled(false);
 assert.equal(up('Space'),true);assert.equal(binding.pressed,false);assert.equal(action.activationCount,2);
}));

test('CK04 a toggle flips once for each whole press of a key',async()=>fixture(({pointer,a,log,down,up,tap,keys})=>{
 const toggle=createToggleControl({input:pointer,target:a,onChange:checked=>log.push(checked)});
 keys({kind:'toggle',control:toggle});
 down('Space');down('Space',{repeat:true});down('Space',{repeat:true});
 assert.equal(toggle.checked,false,'a held key does not flip it over and over');
 up('Space');assert.equal(toggle.checked,true);
 assert.deepEqual(tap('Enter'),[true,true]);assert.equal(toggle.checked,false);assert.deepEqual(log,[true,false]);
 toggle.setEnabled(false);assert.deepEqual(tap('Space'),[false,false]);assert.equal(toggle.checked,false);
}));

test('CK05 a text field opens when the key is released, and the keys of an open field are not the binding\'s',async()=>fixture(({pointer,keyboard,a,log,down,up,keys})=>{
 let request;
 const editor={open(next){request=next;log.push('open');},commit(){const r=request;request=undefined;r?.onCommit(r.value);},cancel(){const r=request;request=undefined;r?.onCancel();},setValue(){}};
 const field=createTextFieldControl({input:pointer,target:a,editor,field:()=>({x:0,y:0,width:40,height:20}),value:'张三'});
 const binding=keys({kind:'textField',control:field});
 assert.equal(down('Enter'),true);assert.equal(field.editing,false,'the key that opens the field is not typed into it');assert.deepEqual(log,[]);
 assert.equal(up('Enter'),true);assert.equal(field.editing,true);assert.deepEqual(log,['open']);
 // The platform field has the keys now: the channel is told the canvas lost them.
 keyboard.cancel('blur');assert.equal(binding.pressed,false);
 request.onCommit('李四');assert.equal(field.value,'李四');
 keyboard.focus('a');down('Space');up('Space');assert.deepEqual(log,['open','open']);
 // A press of the key while the field is open opens nothing more.
 down('Enter');up('Enter');assert.deepEqual(log,['open','open']);
}));

test('CK06 arrow keys move a selection, Home and End go to its ends, and a held key repeats',async()=>fixture(({pointer,make,a,log,down,up,keys})=>{
 const items=['one','two','three','four'].map(name=>({key:name,target:make(a)}));
 const group=createSelectionGroup({input:pointer,items,selected:'one',wrap:false,onChange:selected=>log.push(selected)});
 const binding=keys({kind:'selection',control:group});
 assert.equal(down('ArrowRight'),true);assert.equal(group.selected,'two');assert.equal(binding.pressed,false,'nothing waits for a release');
 assert.equal(down('ArrowRight',{repeat:true}),true);assert.equal(group.selected,'three');
 assert.equal(up('ArrowRight'),false,'the release of a movement key is nobody\'s');
 down('ArrowDown');up('ArrowDown');assert.equal(group.selected,'four');
 // At an end that does not wrap the key is still the group's: the page does not scroll under it.
 assert.equal(down('ArrowDown',{repeat:true}),false,'a repeat of a key that was not held by the focus is not delivered');
 assert.equal(down('ArrowRight'),true);up('ArrowRight');assert.equal(group.selected,'four');
 down('ArrowLeft');up('ArrowLeft');down('ArrowUp');up('ArrowUp');assert.equal(group.selected,'two');
 down('End');up('End');assert.equal(group.selected,'four');down('Home');up('Home');assert.equal(group.selected,'one');
 assert.deepEqual(log,['two','three','four','three','two','four','one']);
 assert.deepEqual([down('Space'),up('Space'),down('PageDown'),up('PageDown'),down('KeyD'),up('KeyD')],[false,false,false,false,false,false]);
 assert.equal(down('ArrowRight',{ctrlKey:true}),false);up('ArrowRight',{ctrlKey:true});assert.equal(group.selected,'one');
 group.setEnabled(false);assert.equal(down('ArrowRight'),false);up('ArrowRight');assert.equal(group.selected,'one');
}));

test('CK07 an orientation keeps the arrows across it for whatever is outside',async()=>fixture(({pointer,make,a,down,up,keys})=>{
 const group=(selected)=>createSelectionGroup({input:pointer,items:['one','two','three'].map(name=>({key:name,target:make(a)})),selected});
 const row=group('two'),column=group('two');
 const first=keys({kind:'selection',control:row,orientation:'horizontal'});
 assert.deepEqual([down('ArrowDown'),up('ArrowDown'),down('ArrowUp'),up('ArrowUp')],[false,false,false,false]);assert.equal(row.selected,'two');
 down('ArrowRight');up('ArrowRight');assert.equal(row.selected,'three');down('ArrowLeft');up('ArrowLeft');assert.equal(row.selected,'two');
 down('Home');up('Home');assert.equal(row.selected,'one');
 first.dispose();
 keys({kind:'selection',control:column,orientation:'vertical'});
 assert.deepEqual([down('ArrowRight'),up('ArrowRight'),down('ArrowLeft'),up('ArrowLeft')],[false,false,false,false]);assert.equal(column.selected,'two');
 down('ArrowDown');up('ArrowDown');assert.equal(column.selected,'three');down('ArrowUp');up('ArrowUp');assert.equal(column.selected,'two');
 down('End');up('End');assert.equal(column.selected,'three');
}));

test('CK08 a scroll takes the keys of its axis, and leaves a key that moved nothing',async()=>fixture(({a,down,up,keys})=>{
 const vertical=createScrollControl({viewportLength:100,contentLength:400});
 const binding=keys({kind:'scroll',control:vertical});
 assert.equal(down('ArrowUp'),false,'at the start the key goes on to whatever is outside');up('ArrowUp');
 assert.equal(down('ArrowDown'),true);assert.equal(vertical.offset,40);
 assert.equal(down('ArrowDown',{repeat:true}),true);assert.equal(vertical.offset,80);up('ArrowDown');
 down('PageDown');up('PageDown');assert.equal(vertical.offset,140);
 down('PageUp');up('PageUp');assert.equal(vertical.offset,80);
 down('ArrowUp');up('ArrowUp');assert.equal(vertical.offset,40);
 assert.equal(down('End'),true);up('End');assert.equal(vertical.offset,300);
 assert.deepEqual([down('End'),up('End'),down('ArrowDown'),up('ArrowDown'),down('PageDown'),up('PageDown')],[false,false,false,false,false,false]);
 assert.equal(down('Home'),true);up('Home');assert.equal(vertical.offset,0);assert.equal(down('Home'),false);up('Home');
 assert.deepEqual([down('ArrowRight'),up('ArrowRight'),down('ArrowLeft'),up('ArrowLeft'),down('Space'),up('Space')],[false,false,false,false,false,false]);assert.equal(vertical.offset,0);
 assert.equal(down('PageDown',{altKey:true}),false);up('PageDown',{altKey:true});assert.equal(vertical.offset,0);
 vertical.setEnabled(false);assert.equal(down('ArrowDown'),false);up('ArrowDown');assert.equal(vertical.offset,0);
 binding.dispose();
 const horizontal=createScrollControl({axis:'x',viewportLength:100,contentLength:400});
 keys({kind:'scroll',control:horizontal});
 assert.deepEqual([down('ArrowDown'),up('ArrowDown'),down('ArrowUp'),up('ArrowUp')],[false,false,false,false]);assert.equal(horizontal.offset,0);
 assert.equal(down('ArrowRight'),true);up('ArrowRight');assert.equal(horizontal.offset,40);
 assert.equal(down('ArrowLeft'),true);up('ArrowLeft');assert.equal(horizontal.offset,0);
 down('PageDown');up('PageDown');assert.equal(horizontal.offset,60);
}));

test('CK09 a key taken below is left alone above: a viewport inside another, and a button inside a viewport',async()=>fixture(({pointer,keyboard,make,a,down,up})=>{
 const inner=make(a),button=make(inner);
 keyboard.registerTarget({id:'inner',target:inner});keyboard.registerTarget({id:'button',target:button});
 const outside=createScrollControl({viewportLength:100,contentLength:400}),inside=createScrollControl({viewportLength:50,contentLength:90});
 const selection=createSelectionGroup({input:pointer,items:[{key:'x',target:make(button)},{key:'y',target:make(button)}],selected:'x'});
 const bindings=[createControlKeys({keyboard,target:a,kind:'scroll',control:outside}),createControlKeys({keyboard,target:inner,kind:'scroll',control:inside}),
  createControlKeys({keyboard,target:button,kind:'selection',control:selection,orientation:'vertical'})];
 keyboard.focus('inner');
 assert.equal(down('ArrowDown'),true);up('ArrowDown');assert.deepEqual([inside.offset,outside.offset],[40,0],'the inner viewport moves first');
 assert.equal(down('ArrowDown'),true);up('ArrowDown');assert.deepEqual([inside.offset,outside.offset],[40,40],'at its end the key goes on to the outer one');
 // The arrows of the group are the group's, also where it does not move; the viewports see them taken.
 keyboard.focus('button');
 down('ArrowDown');up('ArrowDown');assert.equal(selection.selected,'y');assert.deepEqual([inside.offset,outside.offset],[40,40]);
 // Page Down is not the group's and rises to the viewports.
 down('PageDown');up('PageDown');assert.deepEqual([inside.offset,outside.offset],[40,100]);
 for(const binding of bindings)binding.dispose();
}));

test('CK10 the keys that are down steer a movement, and opposite keys cancel each other',async()=>fixture(({pointer,keyboard,a,log,down,up,keys})=>{
 const movement=createMovementControl({input:pointer,target:a,radius:40,onMovement:value=>log.push([value.x,value.y])});
 const binding=keys({kind:'movement',control:movement,onPressChange:pressed=>log.push(pressed)});
 assert.equal(down('ArrowRight'),true);assert.deepEqual(movement.value,{x:1,y:0});assert.equal(binding.pressed,true);
 assert.equal(down('ArrowRight',{repeat:true}),true);
 assert.equal(down('KeyS'),true);
 const diagonal=Math.SQRT1_2;
 assert.ok(Math.abs(movement.value.x-diagonal)<1e-12&&Math.abs(movement.value.y-diagonal)<1e-12,'a diagonal is no faster');
 assert.equal(down('KeyA'),true);assert.deepEqual(movement.value,{x:0,y:1},'left and right together are neither');
 assert.equal(up('ArrowRight'),true);assert.ok(movement.value.x<0&&movement.value.y>0);
 up('KeyA');assert.deepEqual(movement.value,{x:0,y:1});assert.equal(binding.pressed,true);
 up('KeyS');assert.deepEqual(movement.value,{x:0,y:0});assert.equal(binding.pressed,false);
 down('KeyW');assert.deepEqual(movement.value,{x:0,y:-1});down('ArrowUp');assert.deepEqual(movement.value,{x:0,y:-1},'the same way twice is once');
 // Losing the focus lets go of every key.
 keyboard.focus('b');assert.deepEqual(movement.value,{x:0,y:0});assert.equal(binding.pressed,false);
 assert.equal(log.filter(entry=>typeof entry==='boolean').join(),'true,false,true,false');
 keyboard.focus('a');
 assert.equal(down('KeyD',{ctrlKey:true}),false);up('KeyD',{ctrlKey:true});assert.deepEqual(movement.value,{x:0,y:0});
 assert.equal(down('ArrowLeft',{shiftKey:true}),true);assert.deepEqual(movement.value,{x:-1,y:0});up('ArrowLeft',{shiftKey:true});
 assert.deepEqual([down('Space'),up('Space'),down('Home'),up('Home')],[false,false,false,false]);
 movement.setEnabled(false);assert.equal(down('ArrowLeft'),false);up('ArrowLeft');assert.equal(binding.pressed,false);
}));

test('CK11 a movement binds the arrows, the letters, or both',async()=>fixture(({pointer,a,down,up,keys})=>{
 const movement=createMovementControl({input:pointer,target:a,radius:40});
 const arrows=keys({kind:'movement',control:movement,keys:'arrows'});
 assert.deepEqual([down('KeyD'),up('KeyD')],[false,false]);assert.deepEqual(movement.value,{x:0,y:0});
 for(const [code,x,y] of [['ArrowLeft',-1,0],['ArrowRight',1,0],['ArrowUp',0,-1],['ArrowDown',0,1]]){down(code);assert.deepEqual(movement.value,{x,y},code);up(code);}
 arrows.dispose();
 keys({kind:'movement',control:movement,keys:'wasd'});
 assert.deepEqual([down('ArrowRight'),up('ArrowRight')],[false,false]);assert.deepEqual(movement.value,{x:0,y:0});
 for(const [code,x,y] of [['KeyA',-1,0],['KeyD',1,0],['KeyW',0,-1],['KeyS',0,1]]){down(code);assert.deepEqual(movement.value,{x,y},code);up(code);}
}));

test('CK12 disposing ends a hold without an activation, stops a movement, and listens no more',async()=>fixture(({pointer,keyboard,a,log,down,up})=>{
 const action=createActionControl({input:pointer,target:a}),movement=createMovementControl({input:pointer,target:a,radius:40});
 const first=createControlKeys({keyboard,target:a,kind:'action',control:action,onPressChange:pressed=>log.push('action '+pressed)});
 const second=createControlKeys({keyboard,target:a,kind:'movement',control:movement,onPressChange:pressed=>log.push('movement '+pressed)});
 down('Space');down('KeyD');assert.deepEqual(movement.value,{x:1,y:0});
 first.dispose();second.dispose();first.dispose();second.dispose();
 assert.deepEqual([first.pressed,second.pressed],[false,false]);assert.deepEqual(movement.value,{x:0,y:0});
 assert.deepEqual(log,['action true','movement true','action false','movement false']);
 assert.deepEqual([up('Space'),up('KeyD'),down('Enter'),up('Enter'),down('KeyA'),up('KeyA')],[false,false,false,false,false,false]);
 assert.equal(action.activationCount,0);assert.deepEqual(movement.value,{x:0,y:0});
 // A binding outlives its control quietly: the control that is closed has no direction to end.
 const third=createControlKeys({keyboard,target:a,kind:'movement',control:movement});
 down('KeyW');movement.dispose();third.dispose();
 // A binding with nothing held tells nobody anything when it goes.
 const quiet=createControlKeys({keyboard,target:a,kind:'action',control:action,onPressChange:()=>log.push('quiet')});
 quiet.dispose();assert.equal(log.includes('quiet'),false);
}));

test('CK13 a listener that fails does not leave a key held, and a failure of the control is the caller\'s to see',async()=>fixture(({pointer,keyboard,a,down})=>{
 const failure=new Error('paint failed'),movement=createMovementControl({input:pointer,target:a,radius:40});
 let fail=false;
 const binding=createControlKeys({keyboard,target:a,kind:'movement',control:movement,onPressChange:pressed=>{if(fail&&!pressed)throw failure;}});
 down('KeyD');fail=true;
 assert.throws(()=>binding.dispose(),error=>error===failure);
 assert.equal(binding.pressed,false);assert.deepEqual(movement.value,{x:0,y:0});binding.dispose();
 // A control that fails for another reason than being closed is reported by the disposal that met it.
 const broken=new Error('no direction');let refuse=false;
 const other=createControlKeys({keyboard,target:a,kind:'movement',control:{enabled:true,setDirection(){if(refuse)throw broken;}}});
 keyboard.focus('a');down('KeyA');refuse=true;
 assert.throws(()=>other.dispose(),error=>error===broken);assert.equal(other.pressed,false);
 // Only being closed is the quiet reason: another refusal of the engine is reported as any failure is.
 const refusal=new EgretError('UI_CONTROL_DIRECTION');refuse=false;
 const third=createControlKeys({keyboard,target:a,kind:'movement',control:{enabled:true,setDirection(){if(refuse)throw refusal;}}});
 down('KeyW');refuse=true;
 assert.throws(()=>third.dispose(),error=>error===refusal);
}));

test('CK13b a key that is not held by the binding ends nothing in it, and a binding disposed by an earlier listener of the same key does not take it',async()=>fixture(({pointer,keyboard,a,log,down,up})=>{
 const calls=[],control={enabled:true,setDirection(x,y){calls.push([x,y]);}};
 const steering=createControlKeys({keyboard,target:a,kind:'movement',control,keys:'wasd'});
 // Space is held by the focus and is not the binding's: when the focus goes, only the direction ends.
 down('KeyD');down('Space');keyboard.focus('b');
 assert.deepEqual(calls,[[1,0],[0,0]]);
 keyboard.focus('a');down('KeyW');assert.deepEqual([up('Space'),up('KeyW')],[false,true]);assert.deepEqual(calls,[[1,0],[0,0],[0,-1],[0,0]]);
 steering.dispose();
 // The listener that was added first runs first, and removes the binding while the key is being delivered.
 let later;
 const remove=a.on(keyboard.events.keyDown,()=>later.dispose());
 const action=createActionControl({input:pointer,target:a});
 later=createControlKeys({keyboard,target:a,kind:'action',control:action,onPressChange:pressed=>log.push(pressed)});
 assert.equal(down('Space'),false,'a binding that is gone takes no key');
 assert.equal(later.pressed,false);assert.deepEqual(log,[]);
 assert.equal(up('Space'),false);assert.equal(action.activationCount,0);
 remove();
 // A target that fails to let go of a listener is reported once, and the binding is inert all the same.
 const stuck=new Error('still listening'),sticky={on(type,listener){a.on(type,listener);return()=>{throw stuck;};}};
 const kept=createControlKeys({keyboard,target:sticky,kind:'action',control:action,onPressChange:pressed=>log.push(pressed)});
 assert.throws(()=>kept.dispose(),error=>error===stuck);kept.dispose();
 assert.deepEqual([down('Space'),kept.pressed,up('Space')],[false,false,false]);assert.deepEqual(log,[]);assert.equal(action.activationCount,0);
}));

test('CK14 what is not a keyboard, a target, a kind or its control is refused before anything is listened to',async()=>fixture(async({pointer,keyboard,a})=>{
 const action=createActionControl({input:pointer,target:a}),scroll=createScrollControl({viewportLength:10,contentLength:20});
 const group=createSelectionGroup({input:pointer,items:[{key:'k',target:a}]}),movement=createMovementControl({input:pointer,target:a,radius:10});
 const good={keyboard,target:a,kind:'action',control:action};
 const listened=[];const spy={on(type,listener){listened.push(type);return a.on(type,listener);}};
 for(const bad of [undefined,null,7,'keys',{...good,keyboard:undefined},{...good,keyboard:null},{...good,keyboard:{}},{...good,keyboard:{events:null}},
  {...good,keyboard:{events:{...keyboard.events,keyDown:undefined}}},{...good,keyboard:{events:{...keyboard.events,keyUp:null}}},{...good,keyboard:{events:{...keyboard.events,cancel:'cancel'}}},
  {...good,target:undefined},{...good,target:null},{...good,target:{}},{...good,kind:undefined},{...good,kind:'button'},{...good,kind:'toString'},{...good,kind:7},
  {...good,control:undefined},{...good,control:null},{...good,control:{enabled:true,press(){}}},{...good,control:{enabled:true,release(){}}},{...good,onPressChange:'paint'},
  {...good,kind:'toggle'},{...good,kind:'textField'},{...good,kind:'selection'},{...good,kind:'scroll'},{...good,kind:'movement'},{...good,kind:'range'},
  {...good,kind:'selection',control:group,orientation:'diagonal'},{...good,kind:'movement',control:movement,keys:'numpad'},{...good,kind:'movement',control:movement,onPressChange:7},
  {...good,kind:'scroll',control:{enabled:true,axis:'z',line(){},page(){},toStart(){},toEnd(){}}},
  {...good,kind:'scroll',control:{enabled:true,axis:'y',line(){},page(){},toStart(){}}},
  {...good,kind:'selection',control:{enabled:true,next(){},previous(){},first(){}}},
  {...good,kind:'range',control:{enabled:true,stepBy(){},toMin(){}}},{...good,kind:'range',control:{enabled:true,stepBy(){},toMin(){},toMax(){}},page:0},
  {...good,kind:'range',control:{enabled:true,stepBy(){},toMin(){},toMax(){}},orientation:'diagonal'}])
  assert.throws(()=>createControlKeys(bad===null||typeof bad!=='object'?bad:{...bad,target:bad.target===a?spy:bad.target}),coded('UI_CONTROL_OPTIONS'),JSON.stringify(bad,(name,value)=>typeof value==='object'&&value!==null&&name!==''&&name!=='control'?'[object]':value));
 assert.deepEqual(listened,[],'a refused binding listens to nothing');
 // Every kind binds to the control made for it, and to anything else with the same methods.
 for(const options of [good,{...good,kind:'toggle',control:{enabled:true,toggle(){}}},{...good,kind:'textField',control:{enabled:true,edit(){return true;}}},
  {...good,kind:'selection',control:group},{...good,kind:'scroll',control:scroll},{...good,kind:'movement',control:movement},
  // The callback of a press is not read where nothing is held.
  {...good,kind:'selection',control:group,onPressChange:7},{...good,kind:'scroll',control:scroll,onPressChange:7},
  {...good,kind:'range',control:{enabled:true,stepBy(){return true;},toMin(){return true;},toMax(){return true;}},onPressChange:7}])createControlKeys(options).dispose();
 assert.deepEqual(Object.keys(await import('@egret/engine/ui')).includes('createControlKeys'),true);
 assert.equal('createControlKeys' in await import('@egret/engine'),false,'the default entry does not carry the bindings');
}));

test('CK15 a strict consumer compiles against the entry, and the misuses it must not write are refused',()=>{
 const result=spawnSync(process.execPath,['node_modules/typescript/bin/tsc','--project','tests/types/ui-control-keys.json','--pretty','false'],{cwd:new URL('..',import.meta.url),encoding:'utf8'});
 assert.equal(result.status,0,result.stdout+result.stderr);
});
