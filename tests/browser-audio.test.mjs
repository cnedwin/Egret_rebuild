// SPDX-License-Identifier: Apache-2.0
// The Web Audio adapter against a test-owned stand-in for the page and its output. It shows what
// the adapter builds and what it does with the events it is given. What a real browser makes of
// that, and what is heard, is checked separately.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createBrowserAudio} from '@egret/engine/web/audio';
import {spawnSync} from 'node:child_process';

const coded=code=>error=>error?.code===code;
const settled=()=>new Promise(resolve=>setImmediate(resolve));
const gestures=['pointerdown','pointerup','touchend','keydown','click'];
/** A page with an output whose state the test moves. Every listener and every node is kept. */
function page(options={}){
 const world={listeners:[],contexts:[],calls:[],decoded:[],allow:options.allow??true,state:options.state??'suspended',failRemove:false,failDecode:false,callbacks:false,rejectSuspend:false,rejectResume:false,failStop:false};
 class Target extends EventTarget {
  addEventListener(type,listener,o){world.listeners.push({target:this,type,listener,options:o,removed:false});super.addEventListener(type,listener,o);}
  removeEventListener(type,listener,o){
   if(world.failRemove)throw new Error('the page kept the listener');
   for(const pair of world.listeners)if(pair.target===this&&pair.type===type&&pair.listener===listener&&Boolean(pair.options?.capture)===Boolean(o?.capture))pair.removed=true;
   super.removeEventListener(type,listener,o);}
 }
 class Param {
  constructor(value){this.value=value;this.events=[];}
  cancelScheduledValues(time){this.events.push(['cancel',time]);}
  setValueAtTime(value,time){this.events.push(['set',value,time]);}
  linearRampToValueAtTime(value,time){this.events.push(['ramp',value,time]);}
 }
 class Node {
  constructor(kind){this.kind=kind;this.to=[];this.disconnects=0;}
  connect(target,output,input){this.to.push(output===undefined?target:[target,output,input]);return target;}
  disconnect(){this.to.length=0;this.disconnects++;}
 }
 const build=context=>({
  createGain(){const node=new Node('gain');node.gain=new Param(1);context.nodes.push(node);return node;},
  createBufferSource(){
   const node=new Node('source');
   Object.assign(node,{playbackRate:new Param(1),loop:false,buffer:null,onended:null,starts:[],stops:[],start(when,offset){node.starts.push([when,offset]);},stop(when){if(world.failStop)throw new Error('stop');node.stops.push(when);}});
   context.nodes.push(node);return node;},
  createChannelSplitter(count){const node=new Node('splitter');node.count=count;context.nodes.push(node);return node;},
  createChannelMerger(count){const node=new Node('merger');node.count=count;context.nodes.push(node);return node;},
  createBuffer(numberOfChannels,length,sampleRate){return {numberOfChannels,length,sampleRate,duration:length/sampleRate};},
  decodeAudioData(buffer,resolve,reject){
   world.decoded.push(buffer);
   const result={numberOfChannels:2,sampleRate:44100,duration:buffer.byteLength/10};
   if(world.callbacks){queueMicrotask(()=>world.failDecode?reject(new Error('decode')):resolve(result));return undefined;}
   return world.failDecode?Promise.reject(new Error('decode')):Promise.resolve(result);},
 });
 class Context extends Target {
  constructor(){super();this.state=world.state;this.currentTime=0;this.sampleRate=48000;this.destination=new Node('destination');this.nodes=[];Object.assign(this,build(this));world.contexts.push(this);}
  move(state){if(this.state===state)return;this.state=state;this.dispatchEvent(new Event('statechange'));}
  resume(){world.calls.push('resume');if(world.rejectResume)return Promise.reject(new Error('resume'));return world.allow?Promise.resolve().then(()=>this.move('running')):new Promise(()=>{});}
  suspend(){world.calls.push('suspend');if(world.rejectSuspend)return Promise.reject(new Error('suspend'));return Promise.resolve().then(()=>this.move('suspended'));}
  close(){world.calls.push('close');this.state='closed';return world.rejectClose?Promise.reject(new Error('close')):Promise.resolve();}
 }
 /** An output that renders ahead of time: it is no output of the page and cannot be suspended by it. */
 class Offline {constructor(){this.state='suspended';this.currentTime=0;this.sampleRate=48000;this.destination=new Node('destination');this.nodes=[];Object.assign(this,build(this));}}
 const document=Object.assign(new Target(),{visibilityState:options.hidden?'hidden':'visible'});
 const live=(target,type)=>world.listeners.filter(pair=>pair.target===target&&pair.type===type&&!pair.removed);
 const fire=(target,type)=>target.dispatchEvent(new Event(type));
 return {world,document,Context,Offline,live,fire,hide(){document.visibilityState='hidden';fire(document,'visibilitychange');},show(){document.visibilityState='visible';fire(document,'visibilitychange');}};
}
async function fixture(run,options={}){
 const p=page(options.page);
 const before={AudioContext:globalThis.AudioContext,document:globalThis.document,reportError:globalThis.reportError};
 globalThis.AudioContext=p.Context;globalThis.document=p.document;
 const errors=[];
 try{
  const audio=options.create===false?undefined:createBrowserAudio({onError:cause=>errors.push(cause),...options.audio});
  try{await run({...p,audio,mixer:audio?.mixer,context:audio?.context,errors});}finally{try{audio?.dispose();}catch{/* a case that makes cleanup fail has looked at it */}}
 }finally{Object.assign(globalThis,before);for(const key of Object.keys(before))if(before[key]===undefined)delete globalThis[key];}
}

test('BA01 options are checked before an output is made',async()=>fixture(({world,Context})=>{
 for(const options of [null,7,[],{context:null},{context:7},{pauseWhenHidden:1},{onError:1},{unlockTarget:null},{unlockTarget:{}},{unlockTarget:7}])assert.throws(()=>createBrowserAudio(options),coded('AUDIO_OPTIONS_INVALID'),JSON.stringify(options));
 assert.equal(world.contexts.length,0);
 // What the mixer refuses closes the output made for it.
 assert.throws(()=>createBrowserAudio({buses:[]}),coded('AUDIO_OPTIONS_INVALID'));
 assert.deepEqual([world.contexts.length,world.calls],[1,['close']]);
 delete globalThis.AudioContext;
 assert.throws(()=>createBrowserAudio(),coded('AUDIO_HOST_UNAVAILABLE'));
 assert.throws(()=>createBrowserAudio({}),coded('AUDIO_HOST_UNAVAILABLE'));
 globalThis.AudioContext=Context;
},{create:false}));

test('BA02 the buses are gains on the way to the output of the page',async()=>fixture(({world,audio,mixer,context})=>{
 assert.equal(world.contexts.length,1);
 assert.equal(context,world.contexts[0]);
 const [master,music,effects,voice]=context.nodes;
 assert.equal(context.nodes.length,4);
 assert.deepEqual(master.to,[context.destination]);
 for(const node of [music,effects,voice])assert.deepEqual(node.to,[master]);
 assert.equal(audio.output,master);
 // Where a gain starts is set, not moved to.
 assert.deepEqual([master.gain.value,music.gain.value,effects.gain.value,voice.gain.value],[0.5,1,0.25,0]);
 for(const node of context.nodes)assert.deepEqual(node.gain.events,[]);
 assert.deepEqual(mixer.buses.map(bus=>bus.name),['music','effects','voice']);
 assert.ok(Object.isFrozen(audio));
},{audio:{volume:0.5,buses:['music',{name:'effects',volume:0.25},{name:'voice',muted:true}]}}));

test('BA03 a page that may not sound yet is locked until the person touches it',async()=>fixture(async({world,document,audio,mixer,context,live,fire,errors})=>{
 assert.equal(mixer.state,'locked');
 for(const type of gestures){
  const pairs=live(document,type);
  assert.equal(pairs.length,1,type);
  assert.deepEqual(pairs[0].options,{capture:true,passive:true});
 }
 assert.equal(live(context,'statechange').length,1);
 assert.equal(live(document,'visibilitychange').length,1);
 // Nothing asked the output to start before the person did.
 assert.deepEqual(world.calls,[]);
 const seen=[];mixer.subscribe(state=>seen.push(state));
 fire(document,'pointerup');
 // A silent sample was started inside the touch, straight to the output.
 const source=context.nodes.at(-1);
 assert.deepEqual([source.kind,source.buffer,source.to,source.starts],['source',{numberOfChannels:1,length:1,sampleRate:48000,duration:1/48000},[context.destination],[[0,undefined]]]);
 assert.deepEqual(world.calls,['resume']);
 assert.equal(mixer.state,'locked');
 await settled();
 assert.deepEqual([mixer.state,context.state,seen],['running','running',['running']]);
 for(const type of gestures)assert.equal(live(document,type).length,0,type);
 // Later touches are nobody's business.
 fire(document,'pointerup');fire(document,'keydown');
 assert.deepEqual(world.calls,['resume']);
 assert.deepEqual(errors,[]);
}));

test('BA04 a touch that the page does not count leaves it locked and listening',async()=>fixture(async({world,document,mixer,context,live,fire})=>{
 fire(document,'pointerdown');fire(document,'keydown');
 await settled();
 assert.deepEqual([mixer.state,world.calls],['locked',['resume','resume']]);
 assert.equal(live(document,'click').length,1);
 // One silent buffer serves every touch.
 const sources=context.nodes.filter(node=>node.kind==='source');
 assert.equal(sources.length,2);
 assert.equal(sources[0].buffer,sources[1].buffer);
 world.allow=true;
 fire(document,'click');
 await settled();
 assert.equal(mixer.state,'running');
},{page:{allow:false}}));

test('BA05 an output that runs from the start is not locked, and one the page starts by itself unlocks',async()=>{
 await fixture(({document,mixer,live})=>{
  assert.equal(mixer.state,'running');
  for(const type of gestures)assert.equal(live(document,type).length,0);
 },{page:{state:'running'}});
 await fixture(({world,document,mixer,context,live})=>{
  assert.equal(mixer.state,'locked');
  context.move('running');
  assert.equal(mixer.state,'running');
  for(const type of gestures)assert.equal(live(document,type).length,0);
  assert.deepEqual(world.calls,[]);
 });
});

test('BA06 the touch is listened for where the game says',async()=>fixture(async({world,document,live,fire})=>{
 const target=new EventTarget(),seen=[];
 const add=target.addEventListener.bind(target);
 target.addEventListener=(type,listener,o)=>{seen.push(type);add(type,listener,o);};
 const audio=createBrowserAudio({unlockTarget:target});
 assert.deepEqual(seen,gestures);
 for(const type of gestures)assert.equal(live(document,type).length,0);
 fire(document,'click');
 assert.deepEqual(world.calls,[]);
 fire(target,'click');
 await settled();
 assert.equal(audio.mixer.state,'running');
 // It was untied from the same place.
 fire(target,'click');
 assert.deepEqual(world.calls,['resume']);
 audio.dispose();
},{create:false}));

test('BA07 bytes are decoded from a copy, in either form a browser answers',async()=>fixture(async({world,mixer})=>{
 const bytes=new Uint8Array([1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20]).subarray(5,15);
 const sound=await mixer.decode(bytes);
 assert.deepEqual([sound.duration,sound.channels,sound.sampleRate],[1,2,44100]);
 assert.ok(world.decoded[0] instanceof ArrayBuffer&&world.decoded[0]!==bytes.buffer);
 assert.deepEqual([...new Uint8Array(world.decoded[0])],[6,7,8,9,10,11,12,13,14,15]);
 assert.deepEqual([...bytes],[6,7,8,9,10,11,12,13,14,15]);
 world.callbacks=true;
 assert.equal((await mixer.decode(new Uint8Array(30))).duration,3);
 world.failDecode=true;
 await assert.rejects(mixer.decode(bytes),error=>error.code==='AUDIO_DECODE_FAILED'&&error.cause.message==='decode');
 world.callbacks=false;
 await assert.rejects(mixer.decode(bytes),error=>error.code==='AUDIO_DECODE_FAILED'&&error.cause.message==='decode');
 assert.equal(mixer.snapshot().sounds,2);
},{page:{state:'running'}}));

test('BA08 a voice is a source through a gain into its bus',async()=>fixture(async({world,mixer,context})=>{
 const sound=await mixer.decode(new Uint8Array(20));
 context.currentTime=3;
 const voice=mixer.play(sound,{volume:0.5,rate:1.5,offset:0.25,loop:true});
 const [source,gain]=context.nodes.slice(-2);
 assert.deepEqual([source.kind,gain.kind,context.nodes.length],['source','gain',5]);
 assert.deepEqual([source.to,gain.to],[[gain],[context.nodes[2]]]);
 assert.deepEqual([source.buffer,source.loop,source.playbackRate.value,source.starts],[{numberOfChannels:2,sampleRate:44100,duration:2},true,1.5,[[0,0.25]]]);
 assert.deepEqual([gain.gain.value,gain.gain.events],[0.5,[]]);
 assert.equal(voice.position,0.25);
 context.currentTime=4;
 assert.equal(voice.position,1.75);
 voice.setRate(0.5);
 assert.equal(source.playbackRate.value,0.5);
 // A fade in is a line from nothing.
 mixer.play(sound,{bus:'music',volume:0.8,fadeIn:2});
 const rising=context.nodes.at(-1);
 assert.deepEqual([rising.to,rising.gain.events],[[context.nodes[1]],[['set',0,4],['ramp',0.8,6]]]);
},{page:{state:'running'}}));

test('BA09 a voice out of the middle has its two sides weighed, from the first time it leaves the middle',async()=>fixture(async({mixer,context})=>{
 const sound=await mixer.decode(new Uint8Array(20)),bus=context.nodes[2];
 mixer.play(sound,{pan:-0.5});
 const [source,gain,splitter,merger,left,right]=context.nodes.slice(-6);
 assert.deepEqual([source.kind,gain.kind,splitter.kind,merger.kind,left.kind,right.kind,splitter.count,merger.count],['source','gain','splitter','merger','gain','gain',2,2]);
 assert.deepEqual([source.to,gain.to,splitter.to,left.to,right.to,merger.to],[[gain],[splitter],[[left,0,undefined],[right,1,undefined]],[[merger,0,0]],[[merger,0,1]],[bus]]);
 // One channel is on both sides before the sides are weighed.
 assert.deepEqual([gain.channelCount,gain.channelCountMode,gain.channelInterpretation],[2,'explicit','speakers']);
 assert.deepEqual([left.gain.value,right.gain.value],[1,0.5]);
 const voice=mixer.play(sound);
 const count=context.nodes.length,plain=context.nodes.at(-1);
 voice.setPan(0);
 assert.deepEqual([context.nodes.length,plain.to,plain.channelCount],[count,[bus],undefined]);
 voice.setPan(1);
 const [,added,one,other]=context.nodes.slice(-4);
 assert.deepEqual([context.nodes.length,plain.to.length,added.to,one.gain.value,other.gain.value],[count+4,1,[bus],0,1]);
 // Back in the middle the sound is as it was, through the nodes it has.
 voice.setPan(0);
 assert.deepEqual([context.nodes.length,one.gain.value,other.gain.value],[count+4,1,1]);
 voice.setPan(-1);
 assert.deepEqual([one.gain.value,other.gain.value],[1,0]);
 voice.setPan(0.25);
 assert.deepEqual([one.gain.value,other.gain.value],[0.75,1]);
},{page:{state:'running'}}));

test('BA10 a volume moves in a line from where it is, never in a step',async()=>fixture(async({mixer,context})=>{
 const sound=await mixer.decode(new Uint8Array(20));
 context.currentTime=10;
 const voice=mixer.play(sound,{volume:0.25}),gain=context.nodes.at(-1).gain;
 voice.setVolume(0.75,{fade:4});
 assert.deepEqual(gain.events,[['cancel',10],['set',0.25,10],['ramp',0.75,14]]);
 // Half way up, the next movement starts from half way.
 context.currentTime=12;
 voice.setVolume(0,{fade:1});
 assert.deepEqual(gain.events.slice(3),[['cancel',12],['set',0.5,12],['ramp',0,13]]);
 // After the line it starts from its end; a change at once is a line too short to be heard as a click.
 context.currentTime=20;
 voice.setVolume(0.5);
 assert.deepEqual(gain.events.slice(6),[['cancel',20],['set',0,20],['ramp',0.5,20.005]]);
 // The same for a bus, and for a fade in that is cut short.
 const music=context.nodes[1].gain;
 mixer.bus('music').setVolume(0,{fade:2});
 context.currentTime=20.5;
 mixer.bus('music').setMuted(true);
 assert.deepEqual(music.events,[['cancel',20],['set',1,20],['ramp',0,22],['cancel',20.5],['set',0.75,20.5],['ramp',0,20.505]]);
 context.currentTime=30;
 const rising=mixer.play(sound,{fadeIn:10}),line=context.nodes.at(-1).gain;
 context.currentTime=32.5;
 rising.setVolume(0.5,{fade:0.5});
 assert.deepEqual(line.events.slice(2),[['cancel',32.5],['set',0.25,32.5],['ramp',0.5,33]]);
 // Before a line has begun the gain is where it starts.
 context.currentTime=40;
 const late=mixer.play(sound,{fadeIn:10}),held=context.nodes.at(-1).gain;
 context.currentTime=39;
 late.setVolume(1,{fade:1});
 assert.deepEqual(held.events.slice(2),[['cancel',39],['set',0,39],['ramp',1,40]]);
},{page:{state:'running'}}));

test('BA11 a stop is a time on the clock of the output, and the end unties the voice',async()=>fixture(async({world,mixer,context,errors})=>{
 const sound=await mixer.decode(new Uint8Array(20));
 context.currentTime=5;
 const voice=mixer.play(sound,{pan:0.5});
 const [source,gain,...sides]=context.nodes.slice(-6);
 voice.stop({fade:2});
 assert.deepEqual([source.stops,gain.gain.events],[[7],[['cancel',5],['set',1,5],['ramp',0,7]]]);
 assert.equal(voice.state,'stopping');
 source.onended();
 assert.deepEqual([voice.state,voice.endReason,source.onended,source.disconnects,gain.disconnects,sides.map(node=>node.disconnects)],['ended','stopped',null,1,2,[1,1,1,1]]);
 // At once is at once, and a source that ended by itself is not stopped again.
 const second=mixer.play(sound),other=context.nodes.at(-2);
 second.stop();
 assert.deepEqual(other.stops,[0]);
 const third=mixer.play(sound),last=context.nodes.at(-2),ending=last.onended;
 ending();ending();
 assert.deepEqual([third.endReason,last.stops,last.disconnects],['finished',[],1]);
 // A browser that refuses to untie a node is told of, and the voice ends all the same.
 const fourth=mixer.play(sound),tied=context.nodes.at(-2);
 tied.disconnect=()=>{throw new Error('tied');};
 tied.onended();
 assert.deepEqual([fourth.endReason,errors.map(error=>error.message)],['finished',['tied']]);
 world.failStop=true;
 const fifth=mixer.play(sound);
 assert.throws(()=>fifth.stop(),error=>error.code==='AUDIO_BACKEND_FAILED'&&error.cause.message==='stop');
 world.failStop=false;
},{page:{state:'running'}}));

test('BA12 a hidden page is silent and a shown one sounds again, without a lock in between',async()=>fixture(async({world,mixer,context,hide,show,errors})=>{
 const seen=[];mixer.subscribe(state=>seen.push(state));
 hide();
 assert.deepEqual([mixer.state,mixer.snapshot().suspendedBy,world.calls],['suspended',['hidden'],['suspend']]);
 await settled();
 assert.equal(context.state,'suspended');
 hide();
 show();
 assert.deepEqual([mixer.state,world.calls],['running',['suspend','resume']]);
 await settled();
 assert.deepEqual([context.state,mixer.state,seen],['running','running',['suspended','running']]);
 // The game asked for silence too: showing the page does not undo that.
 mixer.suspend();
 await settled();
 hide();show();
 await settled();
 assert.deepEqual([mixer.state,context.state,world.calls],['suspended','suspended',['suspend','resume','suspend']]);
 mixer.resume();
 await settled();
 assert.deepEqual([mixer.state,context.state],['running','running']);
 assert.deepEqual(errors,[]);
},{page:{state:'running'}}));

test('BA13 a page hidden from the start is silent from the start, and a game can keep sounding while hidden',async()=>{
 await fixture(({world,mixer,show})=>{
  assert.deepEqual([mixer.state,mixer.snapshot().suspendedBy,world.calls],['suspended',['hidden'],['suspend']]);
  show();
  assert.equal(mixer.state,'running');
 },{page:{state:'running',hidden:true}});
 await fixture(({world,document,mixer,live,hide})=>{
  assert.equal(live(document,'visibilitychange').length,0);
  hide();
  assert.deepEqual([mixer.state,world.calls],['running',[]]);
 },{page:{state:'running'},audio:{pauseWhenHidden:false}});
 await fixture(({mixer})=>{
  assert.equal(mixer.state,'running');
 },{page:{state:'running',hidden:true},audio:{pauseWhenHidden:false}});
});

test('BA14 a touch while the game wants silence unlocks without sounding',async()=>fixture(async({world,document,mixer,context,live,fire})=>{
 mixer.suspend();
 assert.deepEqual([mixer.state,world.calls],['locked',[]]);
 fire(document,'touchend');
 await settled();
 // The output ran for the touch and was put back to sleep; the lock is gone for good.
 assert.deepEqual([world.calls,context.state,mixer.state,mixer.snapshot().locked],[['resume','suspend'],'suspended','suspended',false]);
 assert.equal(live(document,'touchend').length,0);
 mixer.resume();
 await settled();
 assert.deepEqual([mixer.state,context.state,world.calls],['running','running',['resume','suspend','resume']]);
}));

test('BA15 an output the system took away locks the mixer until it is back',async()=>fixture(async({world,document,mixer,context,live,fire})=>{
 const seen=[];mixer.subscribe(state=>seen.push(state));
 context.move('interrupted');
 assert.equal(mixer.state,'locked');
 assert.equal(live(document,'pointerup').length,1);
 context.move('running');
 assert.equal(mixer.state,'running');
 assert.equal(live(document,'pointerup').length,0);
 // Taken away while the game wanted silence anyway: nothing to tell, and nothing to listen for.
 mixer.suspend();
 await settled();
 context.move('interrupted');
 assert.deepEqual([mixer.state,mixer.snapshot().locked,live(document,'pointerup').length],['suspended',false,0]);
 // The game wants sound again and the system has not given the output back.
 world.allow=false;
 mixer.resume();
 await settled();
 assert.deepEqual([mixer.state,mixer.snapshot().locked],['running',false]);
 context.move('suspended');
 assert.deepEqual([mixer.state,live(document,'pointerup').length],['locked',1]);
 world.allow=true;
 fire(document,'pointerup');
 await settled();
 assert.deepEqual([mixer.state,seen],['running',['locked','running','suspended','running','locked','running']]);
},{page:{state:'running'}}));

test('BA16 disposing unties the page and closes the output that was made',async()=>fixture(async({world,document,audio,mixer,context,fire,hide})=>{
 const sound=await mixer.decode(new Uint8Array(20));
 mixer.play(sound,{whileSilent:'start'});
 audio.dispose();
 assert.equal(mixer.state,'closed');
 assert.ok(world.listeners.length>=7&&world.listeners.every(pair=>pair.removed));
 assert.deepEqual(world.calls,['close']);
 for(const node of context.nodes.slice(0,3))assert.equal(node.disconnects,1);
 assert.deepEqual(context.nodes[3].stops,[0]);
 // What the page still says reaches nobody.
 fire(document,'click');hide();context.move('running');
 await settled();
 assert.deepEqual([world.calls,mixer.state],[['close'],'closed']);
 audio.dispose();mixer.dispose();
 assert.deepEqual(world.calls,['close']);
}));

test('BA17 an output the page made is used as it is and left open',async()=>fixture(async({world,document,Context,live,fire})=>{
 const context=new Context();
 const audio=createBrowserAudio({context});
 assert.equal(audio.context,context);
 assert.deepEqual([world.contexts.length,audio.mixer.state],[1,'locked']);
 fire(document,'click');
 await settled();
 assert.equal(audio.mixer.state,'running');
 audio.dispose();
 assert.deepEqual(world.calls,['resume']);
 assert.equal(live(context,'statechange').length,0);
 assert.throws(()=>createBrowserAudio({context,buses:[]}),coded('AUDIO_OPTIONS_INVALID'));
 assert.deepEqual(world.calls,['resume']);
},{create:false}));

test('BA18 an output that renders ahead of time is never locked, suspended or listened to',async()=>fixture(async({world,Offline,hide})=>{
 const context=new Offline();
 const audio=createBrowserAudio({context});
 assert.equal(audio.mixer.state,'running');
 assert.equal(world.listeners.length,0);
 const sound=await audio.mixer.decode(new Uint8Array(20));
 assert.equal(audio.mixer.play(sound).state,'playing');
 audio.mixer.suspend();
 assert.equal(audio.mixer.state,'suspended');
 audio.mixer.resume();
 hide();
 assert.equal(audio.mixer.state,'running');
 audio.dispose();
 assert.deepEqual(world.calls,[]);
 // Without an output of the page at all, one that is given still works.
 delete globalThis.AudioContext;delete globalThis.document;
 const bare=createBrowserAudio({context:new Offline()});
 assert.equal(bare.mixer.state,'running');
 bare.dispose();
},{create:false}));

test('BA19 a page without a document still sounds; it has nothing to listen to for a touch',async()=>fixture(async({world,Context})=>{
 delete globalThis.document;
 const audio=createBrowserAudio();
 assert.deepEqual([audio.mixer.state,world.listeners.map(pair=>pair.type)],['locked',['statechange']]);
 world.contexts[0].move('running');
 assert.equal(audio.mixer.state,'running');
 world.contexts[0].move('suspended');
 assert.equal(audio.mixer.state,'locked');
 audio.dispose();
},{create:false}));

test('BA20 what fails where nothing can be returned is told to the game, or to the page',async()=>{
 await fixture(async({world,document,mixer,context,live,fire,hide,show,errors})=>{
  world.rejectSuspend=true;
  hide();
  await settled();
  assert.deepEqual(errors.map(error=>error.message),['suspend']);
  // The output still runs: there is nothing to ask of it when the page is shown.
  show();
  world.rejectSuspend=false;
  hide();
  await settled();
  world.rejectResume=true;
  show();
  await settled();
  assert.deepEqual([errors.map(error=>error.message),world.calls],[['suspend','resume'],['suspend','suspend','resume']]);
  // An output that refused to start is locked, and the next touch asks it again.
  assert.deepEqual([mixer.state,live(document,'click').length],['locked',1]);
  world.rejectResume=false;
  fire(document,'click');
  await settled();
  assert.equal(mixer.state,'running');
  // A listener of the game that throws is told of too, and the mixer has changed all the same.
  mixer.subscribe(()=>{throw new Error('listener');});
  hide();
  assert.deepEqual([errors.at(-1).code,errors.at(-1).cause.message,mixer.state],['AUDIO_LISTENER_FAILED','listener','suspended']);
  context.move('suspended');
  assert.equal(errors.length,3);
  show();
  assert.equal(errors.length,4);
  await settled();
 },{page:{state:'running'}});
 await fixture(async({world,document,Context,fire})=>{
  const reported=[];globalThis.reportError=cause=>reported.push(cause);
  const audio=createBrowserAudio();
  world.rejectResume=true;
  fire(document,'click');
  await settled();
  assert.deepEqual(reported.map(error=>error.message),['resume']);
  world.failRemove=true;world.rejectClose=true;
  audio.dispose();
  await settled();
  assert.equal(audio.mixer.state,'closed');
  assert.deepEqual(reported.map(error=>error.message),['resume',...Array(7).fill('the page kept the listener'),'close']);
  // With nobody to tell, nothing is thrown either.
  delete globalThis.reportError;
  world.failRemove=false;world.rejectClose=false;
  const quiet=createBrowserAudio();
  fire(document,'click');
  await settled();
  quiet.dispose();
 },{create:false});
});

test('BA21 a touch that cannot make its silent sample is told of and keeps listening',async()=>fixture(async({world,document,mixer,context,live,fire,errors})=>{
 const make=context.createBufferSource;
 context.createBufferSource=()=>{throw new Error('no source');};
 fire(document,'click');
 await settled();
 assert.deepEqual([errors.map(error=>error.message),mixer.state,live(document,'click').length],[['no source'],'locked',1]);
 context.createBufferSource=make;
 fire(document,'click');
 await settled();
 assert.equal(mixer.state,'running');
}));

test('BA22 what the page says after the mixer is disposed moves nothing',async()=>{
 // The output answers a touch after the game is gone.
 await fixture(async({world,document,audio,mixer,context,fire})=>{
  mixer.suspend();
  fire(document,'click');
  audio.dispose();
  await settled();
  assert.deepEqual([world.calls,mixer.state],[['resume','close'],'closed']);
 });
 // A page that kept the listeners still reaches nobody through them.
 await fixture(async({world,document,audio,context,fire,hide})=>{
  world.failRemove=true;
  audio.dispose();
  const nodes=context.nodes.length;
  fire(document,'click');hide();context.move('running');
  await settled();
  assert.deepEqual([world.calls,context.nodes.length,audio.mixer.state],[['close'],nodes,'closed']);
 });
});

test('BA23 a strict consumer compiles against both entries, and ten misuses are refused',()=>{
 const result=spawnSync(process.execPath,['node_modules/typescript/bin/tsc','--project','tests/types/audio.json','--pretty','false'],{cwd:new URL('..',import.meta.url),encoding:'utf8'});
 assert.equal(result.status,0,result.stdout+result.stderr);
});

test('BA24 each entry exports its factory and nothing else, and no other entry has either',async()=>{
 assert.deepEqual(Object.keys(await import('@egret/engine/audio')),['createAudioMixer']);
 assert.deepEqual(Object.keys(await import('@egret/engine/web/audio')),['createBrowserAudio']);
 for(const entry of ['@egret/engine','@egret/engine/input','@egret/engine/web/input','@egret/engine/webgl2','@egret/engine/webgpu','@egret/engine/ui','@egret/engine/resources','@egret/engine/web/resources','@egret/runtime']){
  const values=await import(entry);
  for(const name of ['createAudioMixer','createBrowserAudio'])assert.equal(name in values,false,entry+' has '+name);
 }
});
