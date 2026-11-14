// SPDX-License-Identifier: Apache-2.0
// Pads as a stream of samples the test writes, and the keys they drive on a recording keyboard
// and on the genuine keyboard input of an Engine. No device is read here.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createEngine,DisplayObjectContainer} from '@egret/engine';
import {createKeyboardInput} from '@egret/engine/input';
import {createGamepadInput,bindGamepadKeys} from '@egret/engine/input/gamepad';
import {host} from './helpers.mjs';

const coded=code=>error=>error?.code===code;
const NAMES=['a','b','x','y','l1','r1','l2','r2','select','start','l3','r3','up','down','left','right','home'];
/** One pad in the standard layout: buttons held by name or number with how far, and the four axes. */
function pad(index=0,held={},axes=[0,0,0,0],extra={}){
 const buttons=Array.from({length:extra.count??17},()=>({pressed:false,value:0}));
 for(const [name,value] of Object.entries(held)){const at=NAMES.includes(name)?NAMES.indexOf(name):Number(name);buttons[at]={pressed:value>0,value};}
 return {index,id:extra.id??'Pad '+index,mapping:extra.mapping??'standard',buttons,axes};
}
function fixture(options={}){
 const buttons=[],connections=[],order=[];
 const input=createGamepadInput({onButton:change=>{buttons.push(change);order.push('option');},onConnection:change=>{connections.push(change);},...options});
 const said=()=>buttons.splice(0).map(change=>[change.pad,change.name??change.index,change.pressed,change.value,change.timestamp]);
 return {input,buttons,connections,order,said};
}
/** A keyboard that records what it is asked and takes the keys the test names. */
function recorder(taken=[]){
 const log=[],state={taken:new Set(taken),fail:undefined};
 return {log,state,keyboard:{
  keyDown(sample){if(state.fail==='down')throw new Error('down');log.push(['down',sample.key,sample.code,sample.repeat]);return state.taken.has(sample.key);},
  keyUp(sample){if(state.fail==='up')throw new Error('up');log.push(['up',sample.key,sample.code]);return false;},
  moveFocus(direction,wrap){log.push(['focus',direction,wrap]);return undefined;}}};
}

test('GP01 options are checked',()=>{
 for(const options of [null,7,[],{deadZone:-0.1},{deadZone:0.91},{deadZone:'0.1'},{maxPads:0},{maxPads:9},{maxPads:1.5},{onButton:1},{onConnection:'x'}])assert.throws(()=>createGamepadInput(options),coded('GAMEPAD_OPTIONS_INVALID'),JSON.stringify(options));
 for(const options of [undefined,{},{deadZone:0},{deadZone:0.9},{maxPads:1},{maxPads:8}]){const input=createGamepadInput(options);assert.equal(input.state,'active');assert.deepEqual(input.pads,[]);input.dispose();}
});

test('GP02 a pad among the samples is connected, and one that is no longer there is taken away',()=>{
 const {input,connections}=fixture();
 input.sample([null,pad(1),undefined],10);
 assert.deepEqual(connections,[{pad:1,id:'Pad 1',connected:true,standard:true,timestamp:10}]);
 assert.ok(Object.isFrozen(connections[0])&&Object.isFrozen(input.pads)&&Object.isFrozen(input.pads[0])&&Object.isFrozen(input));
 const first=input.pad(1);
 assert.deepEqual([input.pads.length,input.pads[0]===first,first.index,first.id,first.standard,first.buttonCount,first.axisCount,input.pad(0)],[1,true,1,'Pad 1',true,17,4,undefined]);
 // By index, whatever order the host names them in.
 input.sample([pad(3),pad(1),pad(0)],20);
 assert.deepEqual([input.pads.map(p=>p.index),connections.slice(1).map(c=>[c.pad,c.connected])],[[0,1,3],[[0,true],[3,true]]]);
 assert.equal(input.pad(1),first);
 input.sample([pad(3)],30);
 assert.deepEqual([input.pads.map(p=>p.index),connections.slice(3).map(c=>[c.pad,c.connected,c.timestamp])],[[3],[[0,false,30],[1,false,30]]]);
 // Another pad in the same place is another pad, and so is the same pad arranged differently.
 input.sample([pad(3,{},[0,0,0,0],{id:'Other'})],40);
 assert.deepEqual(connections.slice(5).map(c=>[c.id,c.connected]),[['Pad 3',false],['Other',true]]);
 input.sample([pad(3,{},[0,0,0,0],{id:'Other',mapping:''})],50);
 assert.deepEqual([connections.slice(7).map(c=>[c.id,c.connected,c.standard]),input.pad(3).standard],[[['Other',false,true],['Other',true,false]],false]);
 input.sample([],60);
 assert.deepEqual(input.pads,[]);
 input.dispose();
});

test('GP03 a press and a letting go are told once each, in the order of pads and buttons',()=>{
 const {input,buttons,order,said}=fixture();
 const seen=[];const off=input.subscribe(change=>{seen.push(change);order.push('listener');});
 input.sample([pad(0)],1);
 assert.deepEqual(said(),[]);
 input.sample([pad(0,{a:1})],2);
 assert.deepEqual([buttons[0],seen[0]===buttons[0],order,Object.isFrozen(buttons[0])],[{pad:0,index:0,name:'a',pressed:true,value:1,timestamp:2},true,['option','listener'],true]);
 said();
 input.sample([pad(0,{a:1})],3);input.sample([pad(0,{a:1})],3);
 assert.deepEqual(said(),[]);
 // A trigger says how far it is pulled; pulled further while held is no new press.
 input.sample([pad(0,{a:1,r2:0.4}),pad(2,{up:1,b:1})],4);
 assert.deepEqual(said(),[[0,'r2',true,0.4,4],[2,'b',true,1,4],[2,'up',true,1,4]]);
 input.sample([pad(0,{r2:0.9}),pad(2,{up:1})],5);
 assert.deepEqual(said(),[[0,'a',false,0,5],[2,'b',false,0,5]]);
 assert.equal(input.pad(0).value('r2'),0.9);
 off();off();
 const count=seen.length;
 input.sample([pad(0),pad(2)],6);
 assert.deepEqual([said(),seen.length],[[[0,'r2',false,0,6],[2,'up',false,0,6]],count]);
 for(const bad of [undefined,null,'x'])assert.throws(()=>input.subscribe(bad),coded('GAMEPAD_OPTIONS_INVALID'));
 input.dispose();
});

test('GP04 a pad says what is held, by name where the layout is the standard one and by number anywhere',()=>{
 const {input,said}=fixture();
 input.sample([pad(0,{a:1,l2:0.25,home:1}),pad(1,{0:1,5:0.5,19:1},[0.5,-0.5],{mapping:'',count:20})],1);
 const standard=input.pad(0),plain=input.pad(1);
 assert.deepEqual([standard.pressed('a'),standard.pressed(0),standard.pressed('b'),standard.value('l2'),standard.value(6),standard.pressed('home'),standard.pressed(16),standard.value('x')],[true,true,false,0.25,0.25,true,true,0]);
 // A pad that is not in the standard layout has numbers only: a name finds nothing on it.
 assert.deepEqual([plain.pressed('a'),plain.value('r1'),plain.pressed(0),plain.value(5),plain.pressed(19),plain.buttonCount,plain.axisCount],[false,0,true,0.5,true,20,2]);
 assert.deepEqual(said().filter(change=>change[0]===1),[[1,0,true,1,1],[1,5,true,0.5,1],[1,19,true,1,1]]);
 // A button the pad does not have is not held; a name or a number that is none is refused.
 assert.deepEqual([standard.pressed(17),standard.pressed(63),standard.value(40),plain.pressed(63)],[false,false,0,false]);
 for(const bad of ['c','A','',-1,64,1.5,NaN,undefined,null]){
  assert.throws(()=>standard.pressed(bad),coded('GAMEPAD_BUTTON_UNKNOWN'),String(bad));
  assert.throws(()=>plain.value(bad),coded('GAMEPAD_BUTTON_UNKNOWN'),String(bad));
 }
 input.dispose();
});

test('GP05 a stick is nothing inside its dead zone and reaches 1 outside it',()=>{
 const {input}=fixture();
 input.sample([pad(0,{},[0.1,-0.1,0.575,0])],1);
 const p=input.pad(0);
 assert.deepEqual(p.stick('left'),{x:0,y:0});
 assert.equal(p.stick('left'),p.stick('left'));
 const right=p.stick('right');
 assert.ok(Math.abs(right.x-0.5)<1e-12&&right.y===0&&Object.isFrozen(right));
 assert.deepEqual([p.axis(0),p.axis(1),p.axis(2),p.axis(3),p.axis(4),p.axis(15)],[0.1,-0.1,0.575,0,0,0]);
 // On the edge of the dead zone it is still nothing; pushed into a corner it is no longer than 1.
 input.sample([pad(0,{},[0.15,0,1,1])],2);
 assert.deepEqual(p.stick('left'),{x:0,y:0});
 const corner=p.stick('right');
 assert.ok(Math.abs(Math.hypot(corner.x,corner.y)-1)<1e-12&&Math.abs(corner.x-corner.y)<1e-12);
 input.sample([pad(0,{},[0,-1,-0.5,0])],3);
 assert.deepEqual(p.stick('left'),{x:0,y:-1});
 assert.ok(Math.abs(p.stick('right').x+0.35/0.85)<1e-12);
 for(const bad of ['middle','',undefined,0])assert.throws(()=>p.stick(bad),coded('GAMEPAD_STICK_UNKNOWN'));
 for(const bad of [-1,16,1.5,'0'])assert.throws(()=>p.axis(bad),coded('GAMEPAD_AXIS_UNKNOWN'));
 // A pad that is not in the standard layout has axes, and no sticks to name.
 input.sample([pad(0,{},[1,1,1,1],{mapping:''})],4);
 assert.deepEqual([input.pad(0).stick('left'),input.pad(0).axis(0)],[{x:0,y:0},1]);
 input.dispose();
 // Without a dead zone the stick is what the axes say.
 const exact=createGamepadInput({deadZone:0});
 exact.sample([pad(0,{},[0.01,0,0,-0.25])],1);
 assert.deepEqual([exact.pad(0).stick('left'),exact.pad(0).stick('right')],[{x:0.01,y:0},{x:0,y:-0.25}]);
 exact.dispose();
});

test('GP06 a look that is not what it should be changes nothing',()=>{
 const {input,buttons,connections}=fixture();
 input.sample([pad(0,{a:1})],100);
 buttons.length=0;connections.length=0;
 const good=pad(0,{b:1});
 const bad=[[{...good,index:-1}],[{...good,index:32}],[{...good,index:1.5}],[{...good,id:7}],[{...good,mapping:null}],[{...good,buttons:null}],[{...good,buttons:Array(65).fill({pressed:false,value:0})}],[{...good,axes:'x'}],[{...good,axes:Array(17).fill(0)}],
  [{...good,buttons:[{pressed:1,value:1}]}],[{...good,buttons:[{pressed:true,value:1.5}]}],[{...good,buttons:[{pressed:true,value:-0.1}]}],[{...good,buttons:[null]}],[{...good,buttons:[true]}],[{...good,axes:[1.01]}],[{...good,axes:[-1.01]}],[{...good,axes:[NaN]}],[{...good,axes:['0']}],
  [7],['pad'],[pad(1),{...good,index:1}],Array(33).fill(null)];
 for(const samples of bad)assert.throws(()=>input.sample(samples,101),coded('GAMEPAD_SAMPLE'),JSON.stringify(samples).slice(0,80));
 for(const samples of [null,undefined,'x',{}])assert.throws(()=>input.sample(samples,101),coded('GAMEPAD_SAMPLE'));
 // Time does not go back.
 for(const time of [99.9,-1,NaN,Infinity,'101',undefined])assert.throws(()=>input.sample([good],time),coded('GAMEPAD_SAMPLE'),String(time));
 assert.deepEqual([buttons,connections,input.pad(0).pressed('a'),input.pads.length],[[],[],true,1]);
 // The edges that are allowed: the same time again, thirty-two places, a pad with nothing on it.
 input.sample([...Array(31).fill(null),{index:31,id:'',mapping:'',buttons:[],axes:[]}],100);
 assert.deepEqual([input.pads.map(p=>p.index),input.pad(31).buttonCount,input.pad(31).pressed(0),input.pad(31).axis(0)],[[31],0,false,0]);
 input.sample([{...good,buttons:Array(64).fill({pressed:true,value:1}),axes:Array(16).fill(-1)}],100);
 assert.deepEqual([input.pad(0).pressed(63),input.pad(0).axis(15)],[true,-1]);
 input.dispose();
});

test('GP07 a pad that is taken away lets its buttons go first, and is gone when that is told',()=>{
 const seen=[];let input;
 ({input}=fixture({onButton:change=>seen.push(['button',change.name,change.pressed,change.value,input.pad(1)!==undefined]),onConnection:change=>seen.push(['pad',change.connected,input.pad(1)!==undefined,input.pads.length])}));
 input.sample([pad(1,{a:1,r2:0.7},[1,0,0,0])],1);
 seen.length=0;
 input.sample([],2);
 assert.deepEqual(seen,[['button','a',false,0,true],['button','r2',false,0,true],['pad',false,false,0]]);
 input.dispose();
});

test('GP08 every button can be let go at once while the pads stay',()=>{
 const {input,said,connections}=fixture();
 input.sample([pad(0,{a:1,x:1},[0.9,0,0,0]),pad(1,{start:1})],5);
 said();
 const samples=[];input.onSample(time=>samples.push(time));
 input.release();
 assert.deepEqual(said(),[[0,'a',false,0,5],[0,'x',false,0,5],[1,'start',false,0,5]]);
 assert.deepEqual([input.pads.length,input.pad(0).pressed('a'),input.pad(0).stick('left'),input.pad(0).buttonCount,connections.length,samples],[2,false,{x:0,y:0},17,2,[]]);
 input.release();
 assert.deepEqual(said(),[]);
 // What is still held at the next look is a press again.
 input.sample([pad(0,{a:1}),pad(1)],6);
 assert.deepEqual(said(),[[0,'a',true,1,6]]);
 input.dispose();
});

test('GP09 pads beyond the number followed are left out until a place is free',()=>{
 const {input,connections,said}=fixture({maxPads:2});
 input.sample([pad(0),pad(1),pad(2,{a:1}),pad(3)],1);
 assert.deepEqual([input.pads.map(p=>p.index),connections.length,said()],[[0,1],2,[]]);
 input.sample([pad(1),pad(2,{a:1}),pad(3)],2);
 assert.deepEqual([input.pads.map(p=>p.index),connections.slice(2).map(c=>[c.pad,c.connected]),said()],[[1,2],[[0,false],[2,true]],[[2,'a',true,1,2]]]);
 input.dispose();
});

test('GP10 every listener is told, and what one of them throws is told when the look is over',()=>{
 const seen=[];
 const {input}=fixture({onButton:change=>{seen.push('option:'+change.name);throw new Error('option');},onConnection:()=>{seen.push('pad');throw new Error('pad');}});
 input.subscribe(change=>{seen.push('first:'+change.name);});
 input.subscribe(()=>{throw new Error('second');});
 input.onSample(()=>{seen.push('sample');throw new Error('sample');});
 input.onSample(()=>{seen.push('sample again');});
 assert.throws(()=>input.sample([pad(0,{a:1,b:1})],1),error=>error.code==='GAMEPAD_LISTENER_FAILED'&&error.cause.message==='pad'&&error.cleanupErrors.map(e=>e.message).join()==='option,second,option,second,sample');
 assert.deepEqual(seen,['pad','option:a','first:a','option:b','first:b','sample','sample again']);
 assert.deepEqual([input.pad(0).pressed('a'),input.pad(0).pressed('b'),input.state],[true,true,'active']);
 assert.throws(()=>input.release(),error=>error.code==='GAMEPAD_LISTENER_FAILED'&&error.cleanupErrors.length===3);
 assert.equal(input.pad(0).pressed('a'),false);
 // Nothing is held: disposing has nothing to tell and nothing fails.
 const quiet=createGamepadInput({onButton:()=>{throw new Error('never');}});
 quiet.sample([pad(0)],1);quiet.dispose();
 assert.throws(()=>input.sample([pad(0,{a:1})],2),coded('GAMEPAD_LISTENER_FAILED'));
 assert.throws(()=>input.dispose(),error=>error.code==='GAMEPAD_LISTENER_FAILED'&&error.cleanupErrors.length===1);
 assert.equal(input.state,'closed');
 for(const bad of [undefined,7])assert.throws(()=>createGamepadInput().onSample(bad),coded('GAMEPAD_OPTIONS_INVALID'));
});

test('GP11 a listener may read the pads but not give the next look, and may dispose the input',()=>{
 const seen=[];let input,mode='sample';
 ({input}=fixture({onButton:change=>{
  seen.push([change.name,change.pressed,input.pad(0)?.pressed('a')]);
  if(mode==='sample')input.sample([pad(0)],9);else if(mode==='release')input.release();else if(mode==='dispose'){mode='read';input.dispose();seen.push(input.state);}
 }}));
 assert.throws(()=>input.sample([pad(0,{a:1})],1),error=>error.code==='GAMEPAD_LISTENER_FAILED'&&error.cause.code==='GAMEPAD_REENTRANT');
 mode='release';
 assert.throws(()=>input.sample([pad(0,{a:1,b:1})],2),error=>error.cause.code==='GAMEPAD_REENTRANT');
 assert.deepEqual(seen,[['a',true,true],['b',true,true]]);
 // Asked to dispose while it tells a press: the look is finished, then everything is let go and the input is closed.
 seen.length=0;mode='dispose';
 const later=[];input.onSample(time=>later.push(time));
 input.sample([pad(0,{a:1,b:1,x:1})],3);
 assert.deepEqual(seen,[['x',true,true],'active',['a',false,false],['b',false,false],['x',false,false]]);
 assert.deepEqual([later,input.state,input.pads],[[3],'closed',[]]);
});

test('GP12 a disposed input has let everything go and takes no more looks',()=>{
 const {input,said,connections}=fixture();
 const samples=[];input.onSample(time=>samples.push(time));
 input.sample([pad(0,{a:1}),pad(1,{b:1})],7);
 said();
 input.dispose();
 assert.deepEqual([said(),input.state,input.pads,input.pad(0),connections.length,samples],[[[0,'a',false,0,7],[1,'b',false,0,7]],'closed',[],undefined,2,[7]]);
 input.dispose();input.release();input.sample([pad(0,{a:1})],8);
 assert.deepEqual([said(),input.pads,samples],[[],[],[7]]);
 // A look given to a closed input is still checked.
 assert.throws(()=>input.sample('x',9),coded('GAMEPAD_SAMPLE'));
 assert.throws(()=>input.subscribe(()=>{}),coded('GAMEPAD_CLOSED'));
 assert.throws(()=>input.onSample(()=>{}),coded('GAMEPAD_CLOSED'));
});

test('GP13 each look is told when it has been taken in',()=>{
 const {input}=fixture();
 const seen=[];const off=input.onSample(time=>seen.push([time,input.pad(0)?.pressed('a')]));
 input.sample([],1);input.sample([pad(0,{a:1})],2.5);
 off();off();
 input.sample([pad(0)],3);
 assert.deepEqual(seen,[[1,undefined],[2.5,true]]);
 input.dispose();
});

test('GK01 options of the keys are checked',()=>{
 const gamepad=createGamepadInput(),{keyboard}=recorder();
 const good={gamepad,keyboard};
 for(const options of [null,7,[],{},{gamepad},{keyboard},{gamepad:{},keyboard},{gamepad,keyboard:{}},{gamepad,keyboard:{...keyboard,moveFocus:1}},{...good,pad:-1},{...good,pad:32},{...good,pad:1.5},{...good,map:7},{...good,map:[]},{...good,stick:'middle'},{...good,stick:true},
  {...good,wrap:1},{...good,threshold:0.09},{...good,threshold:1.1},{...good,repeatDelay:49},{...good,repeatDelay:5001},{...good,repeatInterval:19},{...good,repeatInterval:5001},
  {...good,map:{a:7}},{...good,map:{a:{}}},{...good,map:{a:{key:''}}},{...good,map:{a:{key:'x'.repeat(33)}}},{...good,map:{a:{key:'Enter',code:7}}},{...good,map:{a:{key:'Enter',otherwise:'up'}}},{...good,map:{a:{focus:'up'}}},{...good,map:{a:[]}}])
  assert.throws(()=>bindGamepadKeys(options),coded('GAMEPAD_OPTIONS_INVALID'),JSON.stringify(options)?.slice(0,90));
 assert.throws(()=>bindGamepadKeys({...good,map:{c:{key:'Enter'}}}),coded('GAMEPAD_BUTTON_UNKNOWN'));
 for(const options of [{pad:0},{pad:31},{stick:false},{stick:'right'},{wrap:false},{threshold:0.1},{threshold:1},{repeatDelay:50},{repeatDelay:5000},{repeatInterval:20},{repeatInterval:5000},{map:{a:null,x:{key:'x',code:'KeyX',otherwise:'next'},y:{focus:'previous'},b:undefined}}]){
  const keys=bindGamepadKeys({...good,...options});
  assert.deepEqual(keys.held,[]);
  assert.ok(Object.isFrozen(keys)&&Object.isFrozen(keys.held));
  keys.dispose();keys.dispose();
 }
 gamepad.dispose();
 assert.throws(()=>bindGamepadKeys(good),coded('GAMEPAD_CLOSED'));
});

test('GK02 a direction is an arrow key, and an arrow nobody took moves the focus',()=>{
 const gamepad=createGamepadInput(),{keyboard,log,state}=recorder(['ArrowLeft','ArrowRight','Enter']);
 const keys=bindGamepadKeys({gamepad,keyboard});
 gamepad.sample([pad(0,{down:1})],1);
 assert.deepEqual(log.splice(0),[['down','ArrowDown','ArrowDown',false],['focus','next',true]]);
 assert.deepEqual(keys.held,['ArrowDown']);
 gamepad.sample([pad(0)],2);
 assert.deepEqual([log.splice(0),keys.held],[[['up','ArrowDown','ArrowDown']],[]]);
 gamepad.sample([pad(0,{up:1})],3);gamepad.sample([pad(0)],4);
 assert.deepEqual(log.splice(0),[['down','ArrowUp','ArrowUp',false],['focus','previous',true],['up','ArrowUp','ArrowUp']]);
 // An arrow a control took stays inside the control.
 gamepad.sample([pad(0,{right:1})],5);gamepad.sample([pad(0,{left:1})],6);gamepad.sample([pad(0)],7);
 assert.deepEqual(log.splice(0),[['down','ArrowRight','ArrowRight',false],['up','ArrowRight','ArrowRight'],['down','ArrowLeft','ArrowLeft',false],['up','ArrowLeft','ArrowLeft']]);
 state.taken.clear();
 gamepad.sample([pad(0,{left:1})],8);gamepad.sample([pad(0,{right:1})],9);gamepad.sample([pad(0)],10);
 assert.deepEqual(log.splice(0).filter(row=>row[0]==='focus'),[['focus','previous',true],['focus','next',true]]);
 // The lower face button is Enter, the right one Escape; the shoulders move the focus and are no key.
 gamepad.sample([pad(0,{a:1})],11);gamepad.sample([pad(0,{b:1})],12);gamepad.sample([pad(0,{l1:1})],13);gamepad.sample([pad(0,{r1:1})],14);
 assert.deepEqual([log.splice(0),keys.held],[[['down','Enter','Enter',false],['up','Enter','Enter'],['down','Escape','Escape',false],['up','Escape','Escape'],['focus','previous',true],['focus','next',true]],[]]);
 // The other buttons are the game's.
 gamepad.sample([pad(0,{x:1,y:1,l2:1,r2:1,select:1,start:1,l3:1,r3:1,home:1})],15);
 assert.deepEqual(log,[]);
 keys.dispose();gamepad.dispose();
});

test('GK03 a direction that is held repeats, at most once a look; Enter does not',()=>{
 const gamepad=createGamepadInput(),{keyboard,log}=recorder(['ArrowDown']);
 const keys=bindGamepadKeys({gamepad,keyboard});
 const held=pad(0,{down:1,a:1,r1:1});
 gamepad.sample([held],1000);
 assert.deepEqual(log.splice(0),[['down','Enter','Enter',false],['focus','next',true],['down','ArrowDown','ArrowDown',false]]);
 gamepad.sample([held],1399);
 assert.deepEqual(log.splice(0),[]);
 gamepad.sample([held],1400);
 assert.deepEqual(log.splice(0),[['focus','next',true],['down','ArrowDown','ArrowDown',true]]);
 gamepad.sample([held],1499);
 assert.deepEqual(log.splice(0),[]);
 gamepad.sample([held],1500);
 assert.equal(log.splice(0).length,2);
 // A look that comes late repeats once, and the next repeat is counted from it.
 gamepad.sample([held],2400);
 assert.equal(log.splice(0).length,2);
 gamepad.sample([held],2499);
 assert.deepEqual(log.splice(0),[]);
 gamepad.sample([held],2500);
 assert.equal(log.splice(0).length,2);
 gamepad.sample([pad(0)],2600);
 assert.deepEqual(log.splice(0),[['up','Enter','Enter'],['up','ArrowDown','ArrowDown']]);
 // Pressed again, the wait starts again.
 gamepad.sample([pad(0,{down:1})],2700);gamepad.sample([pad(0,{down:1})],3099);
 assert.equal(log.splice(0).length,1);
 keys.dispose();
 log.length=0;
 const quick=bindGamepadKeys({gamepad,keyboard,repeatDelay:50,repeatInterval:20});
 gamepad.sample([pad(0,{down:1})],4000);gamepad.sample([pad(0,{down:1})],4050);gamepad.sample([pad(0,{down:1})],4069);gamepad.sample([pad(0,{down:1})],4070);
 assert.deepEqual(log.splice(0).map(row=>row[3]),[false,true,true]);
 quick.dispose();gamepad.dispose();
});

test('GK04 the left stick is the four directions too, one at a time, and lets go late',()=>{
 const gamepad=createGamepadInput({deadZone:0}),{keyboard,log}=recorder(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight']);
 const keys=bindGamepadKeys({gamepad,keyboard});
 const push=(x,y,time,held={})=>{gamepad.sample([pad(0,held,[x,y,0,0])],time);return log.splice(0).map(row=>row[0]+':'+row[1]);};
 assert.deepEqual(push(0,-0.49,1),[]);
 assert.deepEqual(push(0,-0.5,2),['down:ArrowUp']);
 // Held until it falls well below where it started to count.
 assert.deepEqual(push(0,-0.36,3),[]);
 assert.deepEqual(push(0,-0.34,4),['up:ArrowUp']);
 // The side it leans to most; it does not turn while it still points where it pointed.
 assert.deepEqual(push(0.8,0.6,5),['down:ArrowRight']);
 assert.deepEqual(push(0.6,0.9,6),[]);
 assert.deepEqual(push(0.3,0.9,7),['up:ArrowRight','down:ArrowDown']);
 assert.deepEqual(push(-0.9,0.2,8),['up:ArrowDown','down:ArrowLeft']);
 assert.deepEqual(push(0,0,9),['up:ArrowLeft']);
 // The stick and the cross together are one key.
 assert.deepEqual(push(-1,0,10,{left:1}),['down:ArrowLeft']);
 assert.deepEqual(push(0,0,11,{left:1}),[]);
 assert.deepEqual(push(-1,0,12),[]);
 assert.deepEqual([keys.held,push(0,0,13)],[['ArrowLeft'],['up:ArrowLeft']]);
 // The right stick is the game's unless it is asked for; with no stick there is the cross alone.
 gamepad.sample([pad(0,{},[0,0,1,0])],14);
 assert.deepEqual(log,[]);
 keys.dispose();
 const right=bindGamepadKeys({gamepad,keyboard,stick:'right',threshold:1});
 gamepad.sample([pad(0,{},[1,0,0.99,0])],15);gamepad.sample([pad(0,{},[1,0,1,0])],16);gamepad.sample([pad(0,{},[1,0,0.71,0])],17);gamepad.sample([pad(0,{},[1,0,0.69,0])],18);
 assert.deepEqual(log.splice(0).map(row=>row[0]+':'+row[1]),['down:ArrowRight','up:ArrowRight']);
 right.dispose();
 const none=bindGamepadKeys({gamepad,keyboard,stick:false});
 gamepad.sample([pad(0,{},[1,1,1,1])],19);gamepad.sample([pad(0,{up:1},[1,1,1,1])],20);
 assert.deepEqual(log.splice(0).map(row=>row[1]),['ArrowUp']);
 none.dispose();gamepad.dispose();
});

test('GK05 every pad drives the keys unless one is named, and a key held on two pads is one key',()=>{
 const gamepad=createGamepadInput(),{keyboard,log}=recorder(['Enter']);
 const keys=bindGamepadKeys({gamepad,keyboard});
 gamepad.sample([pad(0,{a:1}),pad(1)],1);gamepad.sample([pad(0,{a:1}),pad(1,{a:1})],2);gamepad.sample([pad(0),pad(1,{a:1})],3);
 assert.deepEqual([log.splice(0),keys.held],[[['down','Enter','Enter',false]],['Enter']]);
 gamepad.sample([pad(0),pad(1)],4);
 assert.deepEqual([log.splice(0),keys.held],[[['up','Enter','Enter']],[]]);
 keys.dispose();
 const second=bindGamepadKeys({gamepad,keyboard,pad:1});
 gamepad.sample([pad(0,{a:1},[0,1,0,0]),pad(1)],5);
 assert.deepEqual(log,[]);
 gamepad.sample([pad(0,{a:1}),pad(1,{b:1})],6);
 assert.deepEqual(log.splice(0),[['down','Escape','Escape',false]]);
 second.dispose();
 assert.deepEqual(log.splice(0),[['up','Escape','Escape']]);
 gamepad.dispose();
});

test('GK06 a button can be given another action, or none',()=>{
 const gamepad=createGamepadInput(),{keyboard,log}=recorder();
 const keys=bindGamepadKeys({gamepad,keyboard,wrap:false,map:{a:{key:' ',code:'Space'},b:null,x:{key:'x',otherwise:'next'},up:{focus:'previous'},start:{key:'Enter'}}});
 gamepad.sample([pad(0,{a:1,b:1,x:1,up:1,start:1,down:1})],1);
 assert.deepEqual(log.splice(0),[['down',' ','Space',false],['down','x','x',false],['focus','next',false],['down','Enter','Enter',false],['focus','previous',false],['down','ArrowDown','ArrowDown',false],['focus','next',false]]);
 // A direction given a move of the focus alone still repeats; a key that is no direction does not.
 gamepad.sample([pad(0,{a:1,x:1,up:1,start:1})],500);
 assert.deepEqual(log.splice(0),[['up','ArrowDown','ArrowDown'],['focus','previous',false]]);
 gamepad.sample([pad(0)],501);
 assert.deepEqual(log.splice(0),[['up',' ','Space'],['up','x','x'],['up','Enter','Enter']]);
 keys.dispose();gamepad.dispose();
});

test('GK07 what is held is let go when the pads are, when a pad is taken away, and when the keys are unbound',()=>{
 const gamepad=createGamepadInput(),{keyboard,log}=recorder();
 const keys=bindGamepadKeys({gamepad,keyboard});
 gamepad.sample([pad(0,{a:1},[0,1,0,0])],1);
 log.length=0;
 gamepad.release();
 assert.deepEqual([log.splice(0),keys.held],[[['up','Enter','Enter'],['up','ArrowDown','ArrowDown']],[]]);
 gamepad.sample([pad(0,{a:1}),pad(1,{b:1})],2);
 log.length=0;
 gamepad.sample([pad(0,{a:1})],3);
 assert.deepEqual(log.splice(0),[['up','Escape','Escape']]);
 keys.dispose();
 assert.deepEqual([log.splice(0),keys.held],[[['up','Enter','Enter']],[]]);
 gamepad.sample([pad(0)],4);gamepad.sample([pad(0,{a:1})],5);
 assert.deepEqual(log,[]);
 // A disposed input lets go for the keys bound to it.
 const again=bindGamepadKeys({gamepad,keyboard});
 gamepad.sample([pad(0,{a:1,b:1})],6);
 log.length=0;
 gamepad.dispose();
 assert.deepEqual([log.splice(0),again.held],[[['up','Enter','Enter'],['up','Escape','Escape']],[]]);
 again.dispose();
});

test('GK08 a keyboard that fails is told of by the look that asked it',()=>{
 const gamepad=createGamepadInput(),{keyboard,state}=recorder();
 const keys=bindGamepadKeys({gamepad,keyboard});
 state.fail='down';
 assert.throws(()=>gamepad.sample([pad(0,{a:1})],1),error=>error.code==='GAMEPAD_LISTENER_FAILED'&&error.cause.message==='down');
 // The key counts as held: it is let go like any other.
 assert.deepEqual(keys.held,['Enter']);
 state.fail='up';
 assert.throws(()=>keys.dispose(),error=>error.code==='GAMEPAD_LISTENER_FAILED'&&error.cause.message==='up');
 assert.deepEqual(keys.held,[]);
 gamepad.dispose();
});

test('GK09 a pad walks the focus of a genuine keyboard input and presses what is focused',async()=>{
 const engine=await createEngine({host:host().adapter}),scope=engine.createScope();
 const nodes=['a','b','c'].map(()=>engine.stage.addChild(scope.use(new DisplayObjectContainer())));
 const changes=[],keyboard=createKeyboardInput({engine,scope,onFocusChange:change=>changes.push(change.focusedId)});
 nodes.forEach((target,index)=>keyboard.registerTarget({id:'abc'[index],target}));
 const seen=[];
 for(const [index,node] of nodes.entries())for(const kind of ['keyDown','keyUp'])node.on(keyboard.events[kind],event=>{seen.push('abc'[index]+':'+kind+':'+event.payload.key+(event.payload.repeat?':repeat':''));if(index===1&&event.payload.key==='ArrowDown')event.preventDefault();});
 const gamepad=scope.use(createGamepadInput()),keys=bindGamepadKeys({gamepad,keyboard});
 let time=0;const tap=held=>{gamepad.sample([pad(0,held)],++time);gamepad.sample([pad(0)],++time);};
 tap({down:1});
 assert.deepEqual([changes,keyboard.getSnapshot().focusVisible],[['a'],true]);
 tap({down:1});
 assert.deepEqual(changes,['a','b']);
 // The second stop takes the arrow: the focus stays, and the key reached it.
 tap({down:1});
 assert.deepEqual([changes,seen.filter(row=>row.startsWith('b:keyDown'))],[['a','b'],['b:keyDown:ArrowDown']]);
 tap({r1:1});tap({r1:1});
 assert.deepEqual(changes,['a','b','c','a']);
 tap({up:1});
 assert.deepEqual(changes,['a','b','c','a','c']);
 seen.length=0;
 tap({a:1});
 assert.deepEqual(seen,['c:keyDown:Enter','c:keyUp:Enter']);
 // Held, the arrow reaches the stop that takes it as a repeat.
 keyboard.focus('b');
 seen.length=0;
 gamepad.sample([pad(0,{down:1})],1000);gamepad.sample([pad(0,{down:1})],1400);
 assert.deepEqual([seen,keys.held,keyboard.getSnapshot().pressedKeys],[['b:keyDown:ArrowDown','b:keyDown:ArrowDown:repeat'],['ArrowDown'],['ArrowDown']]);
 // The scope lets go for the pad, and the keyboard hears of it.
 scope.dispose();
 assert.deepEqual([gamepad.state,keys.held],['closed',[]]);
 await engine.dispose();
});

test('GK10 the edges of what the keys take: half a gamepad, a key of 32 characters, a stick pushed along a diagonal and held at the edge',()=>{
 const gamepad=createGamepadInput({deadZone:0}),{keyboard,log}=recorder(['ArrowRight','ArrowDown','ArrowUp','ArrowLeft']);
 for(const half of [{subscribe:gamepad.subscribe},{onSample:gamepad.onSample},{subscribe:()=>()=>{},onSample:1}])assert.throws(()=>bindGamepadKeys({gamepad:half,keyboard}),coded('GAMEPAD_OPTIONS_INVALID'));
 for(const half of [{keyDown:keyboard.keyDown},{keyDown:keyboard.keyDown,keyUp:keyboard.keyUp},{keyUp:keyboard.keyUp,moveFocus:keyboard.moveFocus}])assert.throws(()=>bindGamepadKeys({gamepad,keyboard:half}),coded('GAMEPAD_OPTIONS_INVALID'));
 bindGamepadKeys({gamepad,keyboard,map:{x:{key:'k'.repeat(32)}}}).dispose();
 const keys=bindGamepadKeys({gamepad,keyboard});
 const push=(x,y,time)=>{gamepad.sample([pad(0,{},[x,y,0,0])],time);return log.splice(0).map(row=>row[0]+':'+row[1]);};
 // Along a diagonal the side wins over up and down; exactly at nothing on one axis, the sign decides.
 assert.deepEqual(push(0.6,0.6,1),['down:ArrowRight']);push(0,0,2);
 assert.deepEqual(push(-0.6,-0.6,3),['down:ArrowLeft']);push(0,0,4);
 assert.deepEqual(push(0,0.6,5),['down:ArrowDown']);push(0,0,6);
 // Held at exactly seven tenths of the threshold it still points; just below it lets go.
 assert.deepEqual(push(0.5,0,7),['down:ArrowRight']);
 assert.deepEqual(push(0.35,0,8),[]);
 assert.deepEqual(push(0.3499,0,9),['up:ArrowRight']);
 keys.dispose();gamepad.dispose();
});
