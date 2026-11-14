// SPDX-License-Identifier: Apache-2.0
// The browser gamepad adapter against a test-owned stand-in for the page and its pads. It shows
// what the adapter reads and what it does with the events it is given. No pad was held.
import test from 'node:test';
import assert from 'node:assert/strict';
import {bindGamepadKeys} from '@egret/engine/input/gamepad';
import {createBrowserGamepadInput} from '@egret/engine/web/gamepad';
import {spawnSync} from 'node:child_process';

const coded=code=>error=>error?.code===code;
const settled=()=>new Promise(resolve=>setImmediate(resolve));
/** A pad as a browser gives it: buttons that are objects of the page, and axes it may give out of range. */
function device(index,held={},axes=[0,0,0,0],extra={}){
 const buttons=Array.from({length:17},(_,at)=>({pressed:(held[at]??0)>0,touched:(held[at]??0)>0,value:held[at]??0}));
 return {index,id:extra.id??'Pad '+index,mapping:extra.mapping??'standard',connected:extra.connected??true,buttons,axes,timestamp:0,...(extra.actuator===undefined?{}:{vibrationActuator:extra.actuator})};
}
function page(){
 const world={listeners:[],pads:[],asked:0,clock:1000,failRemove:false};
 class Target extends EventTarget {
  addEventListener(type,listener,o){world.listeners.push({target:this,type,listener,removed:false});super.addEventListener(type,listener,o);}
  removeEventListener(type,listener,o){
   if(world.failRemove)throw new Error('the page kept the listener');
   for(const pair of world.listeners)if(pair.target===this&&pair.type===type&&pair.listener===listener)pair.removed=true;
   super.removeEventListener(type,listener,o);}
 }
 const document=Object.assign(new Target(),{visibilityState:'visible'}),window=new Target();
 const navigator={getGamepads(){world.asked++;return world.pads;}};
 const live=(target,type)=>world.listeners.filter(pair=>pair.target===target&&pair.type===type&&!pair.removed);
 return {world,document,window,navigator,live,hide(){document.visibilityState='hidden';document.dispatchEvent(new Event('visibilitychange'));},show(){document.visibilityState='visible';document.dispatchEvent(new Event('visibilitychange'));}};
}
async function fixture(run,options={}){
 const p=page(),names=['navigator','document','window','performance','reportError'];
 const before=Object.fromEntries(names.map(name=>[name,Object.getOwnPropertyDescriptor(globalThis,name)]));
 const put=(name,value)=>Object.defineProperty(globalThis,name,{value,configurable:true,writable:true});
 put('navigator',p.navigator);put('document',p.document);put('window',p.window);put('performance',{now:()=>p.world.clock});
 const errors=[],buttons=[];
 try{
  const pads=options.create===false?undefined:createBrowserGamepadInput({onError:cause=>errors.push(cause),onButton:change=>buttons.push([change.pad,change.name,change.pressed,change.timestamp]),...options.input});
  try{await run({...p,pads,input:pads?.input,errors,buttons,put});}finally{try{pads?.dispose();}catch{/* a case that makes cleanup fail has looked at it */}}
 }finally{for(const name of names){if(before[name]===undefined)delete globalThis[name];else Object.defineProperty(globalThis,name,before[name]);}}
}

test('BG01 options are checked, and a page without pads to ask says so',async()=>fixture(({world,put,navigator})=>{
 for(const options of [null,7,[],{onError:1},{deadZone:2},{maxPads:0},{onButton:'x'}])assert.throws(()=>createBrowserGamepadInput(options),coded('GAMEPAD_OPTIONS_INVALID'),JSON.stringify(options));
 assert.equal(world.listeners.length,0);
 for(const host of [undefined,{},{getGamepads:1}]){put('navigator',host);assert.throws(()=>createBrowserGamepadInput(),coded('GAMEPAD_HOST_UNAVAILABLE'));}
 put('navigator',navigator);
 const pads=createBrowserGamepadInput();
 assert.ok(Object.isFrozen(pads));
 assert.deepEqual([pads.input.state,world.asked],['active',0]);
 pads.dispose();
},{create:false}));

test('BG02 a poll reads every pad of the page once and gives the input what they say',async()=>fixture(({world,pads,input,buttons})=>{
 // A browser keeps places: empty ones, and one for a pad that was taken away.
 world.pads=[null,device(1,{0:1,7:0.6},[0.5,-2,NaN,3]),undefined,device(3,{1:1},[0,0,0,0],{connected:false}),device(4,{},[0,0],{mapping:'',id:'Plain'})];
 pads.poll(16);
 assert.equal(world.asked,1);
 assert.deepEqual(input.pads.map(pad=>[pad.index,pad.id,pad.standard,pad.buttonCount,pad.axisCount]),[[1,'Pad 1',true,17,4],[4,'Plain',false,17,2]]);
 const pad=input.pad(1);
 assert.deepEqual([pad.pressed('a'),pad.value('r2'),pad.pressed('b')],[true,0.6,false]);
 // What a driver gives out of range is brought into it, and what is no number is the middle.
 assert.deepEqual([pad.axis(0),pad.axis(1),pad.axis(2),pad.axis(3)],[0.5,-1,0,1]);
 assert.deepEqual(buttons,[[1,'a',true,16],[1,'r2',true,16]]);
 // A value out of range from a driver is brought into range too.
 world.pads=[null,{...device(1),buttons:[{pressed:true,value:1.2},{pressed:false,value:-0.5}]}];
 pads.poll(17);
 assert.deepEqual([input.pad(1).value(0),input.pad(1).value(1),input.pad(1).buttonCount],[1,0,2]);
 // The pads may be a list of the page that is no array.
 world.pads={length:1,0:device(0,{0:1}),[Symbol.iterator]:function*(){yield this[0];}};
 pads.poll(18);
 assert.deepEqual(input.pads.map(p=>p.index),[0]);
}));

test('BG03 without a time the clock of the page is read, and time never goes back for the input',async()=>fixture(({world,pads,buttons})=>{
 world.pads=[device(0,{0:1})];
 pads.poll();
 assert.deepEqual(buttons.splice(0),[[0,'a',true,1000]]);
 world.clock=1016;world.pads=[device(0)];
 pads.poll();
 assert.deepEqual(buttons.splice(0),[[0,'a',false,1016]]);
 // A frame time behind the clock of the page, and a clock that stepped back.
 world.pads=[device(0,{0:1})];
 pads.poll(900);
 world.clock=950;world.pads=[device(0)];
 pads.poll();
 assert.deepEqual(buttons.splice(0),[[0,'a',true,1016],[0,'a',false,1016]]);
 world.pads=[device(0,{0:1})];
 pads.poll(2000);
 assert.deepEqual(buttons.splice(0),[[0,'a',true,2000]]);
 for(const time of [-1,NaN,Infinity,'5',null])assert.throws(()=>pads.poll(time),coded('GAMEPAD_SAMPLE'),String(time));
 pads.poll(0);
 assert.deepEqual(buttons,[]);
}));

test('BG04 buttons are let go when the page is hidden or the window loses the person, and a hidden page is not looked at',async()=>fixture(({world,document,window,pads,input,buttons,live,hide,show})=>{
 assert.deepEqual([live(document,'visibilitychange').length,live(window,'blur').length,live(window,'pagehide').length,world.listeners.length],[1,1,1,3]);
 world.pads=[device(0,{0:1,12:1})];
 pads.poll(1);
 buttons.length=0;
 hide();
 assert.deepEqual([buttons.splice(0),input.pads.length,input.pad(0).pressed('a')],[[[0,'a',false,1],[0,'up',false,1]],1,false]);
 const asked=world.asked;
 pads.poll(2);pads.poll(3);
 assert.deepEqual([world.asked,buttons],[asked,[]]);
 // Shown again: what is still held is a press again at the next look.
 show();
 assert.deepEqual(buttons,[]);
 pads.poll(4);
 assert.deepEqual(buttons.splice(0),[[0,'a',true,4],[0,'up',true,4]]);
 window.dispatchEvent(new Event('blur'));
 assert.deepEqual(buttons.splice(0),[[0,'a',false,4],[0,'up',false,4]]);
 // Without the window the page is still looked at: a pad needs no focus of the keyboard.
 pads.poll(5);
 assert.equal(buttons.splice(0).length,2);
 window.dispatchEvent(new Event('pagehide'));
 assert.equal(buttons.splice(0).length,2);
}));

test('BG05 a pad that can be shaken is shaken, and the adapter says whether it asked',async()=>fixture(async({world,pads,hide,show,errors})=>{
 const played=[];let answer=()=>Promise.resolve('complete');
 const actuator={playEffect(type,parameters){played.push([type,parameters]);return answer();}};
 world.pads=[null,device(1,{},[0,0,0,0],{actuator}),device(2),device(3,{},[0,0,0,0],{actuator:null}),device(4,{},[0,0,0,0],{actuator:{}}),device(5,{},[0,0,0,0],{actuator,connected:false})];
 assert.equal(pads.rumble(1),true);
 assert.deepEqual(played.splice(0),[['dual-rumble',{startDelay:0,duration:200,weakMagnitude:0.5,strongMagnitude:0.5}]]);
 assert.equal(pads.rumble(1,{duration:5000,weak:0,strong:1}),true);
 assert.deepEqual(played.splice(0),[['dual-rumble',{startDelay:0,duration:5000,weakMagnitude:0,strongMagnitude:1}]]);
 // No such pad, a pad without a motor, one taken away.
 for(const index of [0,2,3,4,5,31])assert.equal(pads.rumble(index),false,String(index));
 assert.deepEqual(played,[]);
 for(const [index,options] of [[-1],[32],[1.5],['1'],[1,null],[1,7],[1,{duration:-1}],[1,{duration:5001}],[1,{weak:1.1}],[1,{strong:-0.1}],[1,{weak:'1'}]])assert.throws(()=>pads.rumble(index,options),coded('GAMEPAD_OPTIONS_INVALID'),JSON.stringify([index,options]));
 // A pad that refuses, later or at once, is told of.
 answer=()=>Promise.reject(new Error('refused'));
 assert.equal(pads.rumble(1),true);
 await settled();
 answer=()=>{throw new Error('broken');};
 assert.equal(pads.rumble(1),false);
 assert.deepEqual(errors.map(error=>error.message),['refused','broken']);
 // An older browser answers nothing.
 answer=()=>undefined;
 assert.equal(pads.rumble(1),true);
 hide();
 assert.equal(pads.rumble(1),false);
 show();
 assert.equal(pads.rumble(1),true);
 assert.equal(played.length,4);
}));

test('BG06 disposing unties the page and closes the input, from either side',async()=>{
 await fixture(({world,pads,input,buttons})=>{
  world.pads=[device(0,{0:1},[0,0,0,0],{actuator:{playEffect(){throw new Error('never');}}})];
  pads.poll(1);
  buttons.length=0;
  pads.dispose();
  assert.deepEqual([buttons,input.state,world.listeners.every(pair=>pair.removed)],[[[0,'a',false,1]],'closed',true]);
  const asked=world.asked;
  pads.poll(2);pads.dispose();
  assert.deepEqual([world.asked,pads.rumble(0)],[asked,false]);
 });
 // The input disposed by itself, as a scope would: the next poll asks nothing.
 await fixture(({world,document,pads,input,hide})=>{
  world.pads=[device(0)];
  input.dispose();
  pads.poll(1);
  hide();
  assert.equal(world.asked,0);
  pads.dispose();
  assert.ok(world.listeners.every(pair=>pair.removed));
 });
});

test('BG07 what fails where nothing can be returned is told to the game, or to the page',async()=>{
 await fixture(({world,window,pads,errors,hide})=>{
  world.pads=[device(0,{0:1})];
  pads.poll(1);
  hide();
  assert.deepEqual([errors.length,errors[0].code,errors[0].cause.message],[1,'GAMEPAD_LISTENER_FAILED','listener']);
  world.failRemove=true;
  pads.dispose();
  assert.deepEqual(errors.slice(1).map(error=>error.message),Array(3).fill('the page kept the listener'));
  // Kept by the page, the listeners reach nobody.
  window.dispatchEvent(new Event('blur'));
  assert.equal(errors.length,4);
 },{input:{onButton:change=>{if(!change.pressed)throw new Error('listener');}}});
 await fixture(({world,window,put})=>{
  const reported=[];put('reportError',cause=>reported.push(cause));
  const pads=createBrowserGamepadInput({onButton:change=>{if(!change.pressed)throw new Error('listener');}});
  world.pads=[device(0,{0:1})];
  pads.poll(1);
  window.dispatchEvent(new Event('blur'));
  assert.deepEqual(reported.map(error=>error.code),['GAMEPAD_LISTENER_FAILED']);
  // With nobody to tell, nothing is thrown either.
  delete globalThis.reportError;
  pads.poll(2);
  window.dispatchEvent(new Event('blur'));
  pads.dispose();
 },{create:false});
});

test('BG08 a page without a document or a window still has pads to ask',async()=>fixture(({world})=>{
 delete globalThis.document;delete globalThis.window;
 const buttons=[],pads=createBrowserGamepadInput({onButton:change=>buttons.push(change.name)});
 assert.equal(world.listeners.length,0);
 world.pads=[device(0,{0:1})];
 pads.poll(1);
 assert.deepEqual([buttons,pads.rumble(0)],[['a'],false]);
 pads.dispose();
},{create:false}));

test('BG09 the pads of the page drive the keys, and let them go when the window loses the person',async()=>fixture(({world,window,pads,input})=>{
 const log=[],keyboard={keyDown(sample){log.push('down:'+sample.key+(sample.repeat?':repeat':''));return true;},keyUp(sample){log.push('up:'+sample.key);return false;},moveFocus(direction){log.push('focus:'+direction);return undefined;}};
 const keys=bindGamepadKeys({gamepad:input,keyboard});
 world.pads=[device(0,{13:1})];
 pads.poll(100);pads.poll(499);pads.poll(500);
 assert.deepEqual(log.splice(0),['down:ArrowDown','down:ArrowDown:repeat']);
 world.pads=[device(0,{0:1},[0,0.2,0,0])];
 pads.poll(516);
 assert.deepEqual(log.splice(0),['up:ArrowDown','down:Enter']);
 window.dispatchEvent(new Event('blur'));
 assert.deepEqual([log.splice(0),keys.held],[['up:Enter'],[]]);
 keys.dispose();
}));

test('BG10 a strict consumer compiles against both entries, and nine misuses are refused',()=>{
 const result=spawnSync(process.execPath,['node_modules/typescript/bin/tsc','--project','tests/types/gamepad.json','--pretty','false'],{cwd:new URL('..',import.meta.url),encoding:'utf8'});
 assert.equal(result.status,0,result.stdout+result.stderr);
});

test('BG11 each entry exports its factories and nothing else, and no other entry has them',async()=>{
 assert.deepEqual(Object.keys(await import('@egret/engine/input/gamepad')).sort(),['bindGamepadKeys','createGamepadInput']);
 assert.deepEqual(Object.keys(await import('@egret/engine/web/gamepad')),['createBrowserGamepadInput']);
 for(const entry of ['@egret/engine','@egret/engine/input','@egret/engine/web/input','@egret/engine/web/keyboard','@egret/engine/web/pointer','@egret/engine/input/hover','@egret/engine/ui','@egret/engine/audio','@egret/runtime','@egret/runtime/input']){
  const values=await import(entry);
  for(const name of ['createGamepadInput','bindGamepadKeys','createBrowserGamepadInput'])assert.equal(name in values,false,entry+' has '+name);
 }
});
