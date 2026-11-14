// SPDX-License-Identifier: Apache-2.0
// The mixer against a test-owned backend that records what it is asked and tells ends when the
// test says so. What a real output makes of those requests is checked in a browser.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createEngine} from '@egret/engine';
import {createAudioMixer} from '@egret/engine/audio';
import {host} from './helpers.mjs';

const coded=code=>error=>error?.code===code;
const bytes=(n=4)=>new Uint8Array(n).fill(7);
/** A backend whose clock the test moves. Every request is kept in the order it was made. */
function fake(){
 const state={time:0,duration:2,channels:2,sampleRate:48000,fail:new Set(),log:[],buses:[],voices:[],sounds:[],decodes:[],hold:undefined,early:false,bad:undefined};
 const backend={
  get time(){if(state.fail.has('time'))throw new Error('time');return state.time;},
  async decode(view){
   state.decodes.push(view);
   if(state.hold)await state.hold;
   if(state.fail.has('decode'))throw new Error('decode');
   if(state.bad!==undefined)return state.bad;
   const sound={duration:state.duration,channels:state.channels,sampleRate:state.sampleRate,released:0,release(){this.released++;state.log.push('sound.release');if(state.fail.has('sound.release'))throw new Error('sound.release');}};
   state.sounds.push(sound);return sound;},
  createBus(parent){
   if(state.fail.has('bus')&&state.buses.length===state.failAt)throw new Error('bus');
   const bus={parent,gains:[],released:0,setGain(value,seconds){if(state.fail.has('bus.gain'))throw new Error('bus.gain');this.gains.push([value,seconds]);},release(){this.released++;state.log.push('bus.release');if(state.fail.has('bus.release'))throw new Error('bus.release');}};
   state.buses.push(bus);return bus;},
  start(request,ended){
   if(state.fail.has('start')){state.refused=ended;throw new Error('start');}
   if(state.early)ended();
   if(state.fail.has('voice'))return {};
   const voice={request,ended,calls:[],setGain(value,seconds){if(state.fail.has('gain'))throw new Error('gain');this.calls.push(['gain',value,seconds]);},setRate(value){if(state.fail.has('rate'))throw new Error('rate');this.calls.push(['rate',value]);},
    setPan(value){if(state.fail.has('pan'))throw new Error('pan');this.calls.push(['pan',value]);},stop(seconds){this.calls.push(['stop',seconds]);if(state.fail.has('stop'))throw new Error('stop');}};
   state.voices.push(voice);return voice;},
  suspend(){state.log.push('suspend');if(state.fail.has('suspend'))throw new Error('suspend');},
  resume(){state.log.push('resume');if(state.fail.has('resume'))throw new Error('resume');},
  close(){state.log.push('close');if(state.fail.has('close'))throw new Error('close');},
 };
 return {state,backend};
}
async function fixture(run,options={}){
 const {state,backend}=fake();
 Object.assign(state,options.state);
 const mixer=createAudioMixer({backend,...options.mixer});
 const sound=await mixer.decode(bytes());
 try{await run({state,backend,mixer,sound,raw:state.sounds[0],last:()=>state.voices.at(-1)});}finally{try{mixer.dispose();}catch{/* a case that makes cleanup fail has looked at it */}}
}

test('AM01 options are checked before the backend is asked for anything',()=>{
 const {state,backend}=fake();
 const bad=[null,undefined,[],7,{},{backend:null},{backend:{}},{backend:{...backend,close:1}},{backend,buses:[]},{backend,buses:'music'},{backend,buses:Array.from({length:17},(_,i)=>'b'+i)},
  {backend,buses:['a','a']},{backend,buses:['master']},{backend,buses:['']},{backend,buses:['x'.repeat(33)]},{backend,buses:[7]},{backend,buses:[null]},{backend,buses:[{name:'a',volume:2}]},{backend,buses:[{name:'a',volume:-0.1}]},
  {backend,buses:[{name:'a',muted:1}]},{backend,buses:[{name:'a',volume:'1'}]},{backend,volume:1.5},{backend,volume:-1},{backend,volume:NaN},{backend,muted:'no'},{backend,locked:0},{backend,maxVoices:0},{backend,maxVoices:257},{backend,maxVoices:1.5},
  {backend,maxSounds:0},{backend,maxSounds:4097},{backend,maxDecodedBytes:0},{backend,maxDecodedBytes:1.5}];
 for(const options of bad)assert.throws(()=>createAudioMixer(options),coded('AUDIO_OPTIONS_INVALID'),JSON.stringify(options));
 assert.equal(state.buses.length,0);
 // The edges that are allowed.
 for(const options of [{buses:['x'.repeat(32)]},{buses:Array.from({length:16},(_,i)=>'b'+i)},{volume:0},{volume:1},{maxVoices:1},{maxVoices:256},{maxSounds:1},{maxSounds:4096},{maxDecodedBytes:1},{buses:[{name:'a',volume:0},{name:'b',volume:1,muted:true}]}])
  createAudioMixer({backend,...options}).dispose();
});

test('AM02 the buses stand under one master, at the volumes given',()=>{
 const {state,backend}=fake();
 const mixer=createAudioMixer({backend,volume:0.8,buses:['music',{name:'effects',volume:0.5},{name:'voice',muted:true}]});
 assert.equal(state.buses.length,4);
 assert.equal(state.buses[0].parent,undefined);
 for(const bus of state.buses.slice(1))assert.equal(bus.parent,state.buses[0]);
 assert.deepEqual(state.buses.map(bus=>bus.gains),[[[0.8,0]],[[1,0]],[[0.5,0]],[[0,0]]]);
 assert.deepEqual(mixer.buses.map(bus=>[bus.name,bus.volume,bus.muted,bus.voices]),[['music',1,false,0],['effects',0.5,false,0],['voice',1,true,0]]);
 assert.deepEqual([mixer.master.name,mixer.master.volume,mixer.master.muted,mixer.master.voices],['master',0.8,false,0]);
 assert.equal(mixer.bus('voice'),mixer.buses[2]);
 assert.ok(Object.isFrozen(mixer)&&Object.isFrozen(mixer.buses)&&Object.isFrozen(mixer.master)&&Object.isFrozen(mixer.buses[0]));
 for(const name of ['master','nothing',undefined,7])assert.throws(()=>mixer.bus(name),coded('AUDIO_BUS_UNKNOWN'));
 assert.equal(mixer.state,'running');
 mixer.dispose();
 // Without a list there are the two a game starts with.
 const plain=createAudioMixer({backend});
 assert.deepEqual(plain.buses.map(bus=>bus.name),['music','effects']);
 plain.dispose();
});

test('AM03 a bus that cannot be made leaves nothing behind',()=>{
 for(const failAt of [0,2]){
  const {state,backend}=fake();
  state.fail.add('bus');state.failAt=failAt;
  assert.throws(()=>createAudioMixer({backend}),error=>error.code==='AUDIO_BACKEND_FAILED'&&error.cause.message==='bus');
  assert.deepEqual(state.buses.map(bus=>bus.released),Array(failAt).fill(1));
 }
 const {state,backend}=fake();
 state.fail.add('bus.gain');
 assert.throws(()=>createAudioMixer({backend}),coded('AUDIO_BACKEND_FAILED'));
 assert.deepEqual(state.buses.map(bus=>bus.released),[1]);
 const odd=fake();
 odd.backend.createBus=()=>({setGain(){}});
 assert.throws(()=>createAudioMixer({backend:odd.backend}),coded('AUDIO_BACKEND_FAILED'));
});

test('AM04 a volume moves over the fade given and a mute is at once',async()=>fixture(({state,mixer})=>{
 const [master,music]=state.buses,bus=mixer.bus('music');
 bus.setVolume(0.4,{fade:1.5});
 assert.deepEqual(music.gains.at(-1),[0.4,1.5]);
 assert.equal(bus.volume,0.4);
 bus.setMuted(true);
 assert.deepEqual(music.gains.at(-1),[0,0]);
 assert.deepEqual([bus.volume,bus.muted],[0.4,true]);
 // The volume of a muted bus is kept for when it is heard again.
 bus.setVolume(0.9);
 assert.deepEqual(music.gains.at(-1),[0,0]);
 bus.setMuted(false);
 assert.deepEqual(music.gains.at(-1),[0.9,0]);
 mixer.master.setVolume(0,{fade:60});
 assert.deepEqual(master.gains.at(-1),[0,60]);
 mixer.master.setVolume(1,{});
 assert.deepEqual(master.gains.at(-1),[1,0]);
 const before=music.gains.length;
 for(const [value,fade] of [[1.1],[-0.1],[NaN],['1'],[0.5,{fade:-1}],[0.5,{fade:61}],[0.5,{fade:'1'}],[0.5,7],[0.5,null],[0.5,[]]])assert.throws(()=>bus.setVolume(value,fade),coded('AUDIO_OPTIONS_INVALID'));
 for(const value of [0,1,'yes',undefined])assert.throws(()=>bus.setMuted(value),coded('AUDIO_OPTIONS_INVALID'));
 assert.equal(music.gains.length,before);
 assert.equal(bus.volume,0.9);
 state.fail.add('bus.gain');
 assert.throws(()=>bus.setVolume(0.1),error=>error.code==='AUDIO_BACKEND_FAILED'&&error.cause.message==='bus.gain');
 state.fail.clear();
}));

test('AM05 bytes are decoded into a sound that is counted against the budget',async()=>{
 const {state,backend}=fake();
 const mixer=createAudioMixer({backend,maxSounds:3,maxDecodedBytes:1536004});
 const view=bytes(6),sound=await mixer.decode(view);
 assert.equal(state.decodes[0],view);
 assert.deepEqual([sound.duration,sound.channels,sound.sampleRate,sound.decodedBytes,sound.state],[2,2,48000,768000,'ready']);
 assert.ok(Object.isFrozen(sound));
 const buffer=new ArrayBuffer(5);
 await mixer.decode(buffer);
 assert.ok(state.decodes[1] instanceof Uint8Array&&state.decodes[1].buffer===buffer&&state.decodes[1].byteLength===5);
 assert.deepEqual([mixer.snapshot().sounds,mixer.snapshot().decodedBytes],[2,1536000]);
 for(const value of [undefined,null,'abc',[1,2],new Uint8Array(0),new ArrayBuffer(0),new Float32Array(4),{byteLength:4}])await assert.rejects(mixer.decode(value),coded('AUDIO_BYTES_INVALID'));
 // A sound over the budget is given back to the backend.
 state.duration=0.001;
 await assert.rejects(mixer.decode(bytes()),coded('AUDIO_BUDGET'));
 assert.equal(state.sounds.at(-1).released,1);
 // A fraction of a sample counts as a sample, and what fits exactly fits.
 state.duration=1/96000;state.channels=1;
 const tiny=await mixer.decode(bytes());
 assert.equal(tiny.decodedBytes,4);
 assert.equal(mixer.snapshot().decodedBytes,1536004);
 await assert.rejects(mixer.decode(bytes()),coded('AUDIO_SOUND_LIMIT'));
 assert.equal(state.decodes.length,4);
 tiny.release();
 state.fail.add('decode');
 await assert.rejects(mixer.decode(bytes()),error=>error.code==='AUDIO_DECODE_FAILED'&&error.cause.message==='decode');
 state.fail.clear();
 // What failed to decode holds no place.
 (await mixer.decode(bytes())).release();
 mixer.dispose();
});

test('AM06 decodes that are still running hold their places, and one that returns to a closed mixer is given back',async()=>{
 const {state,backend}=fake();
 const mixer=createAudioMixer({backend,maxSounds:2});
 let release;state.hold=new Promise(resolve=>{release=resolve;});
 const first=mixer.decode(bytes()),second=mixer.decode(bytes());
 await assert.rejects(mixer.decode(bytes()),coded('AUDIO_SOUND_LIMIT'));
 mixer.dispose();
 release();
 await assert.rejects(first,coded('AUDIO_CLOSED'));
 await assert.rejects(second,coded('AUDIO_CLOSED'));
 assert.deepEqual(state.sounds.map(sound=>sound.released),[1,1]);
 await assert.rejects(mixer.decode(bytes()),coded('AUDIO_CLOSED'));
});

test('AM07 what the backend calls a sound is checked',async()=>{
 const {state,backend}=fake();
 const mixer=createAudioMixer({backend,maxDecodedBytes:Number.MAX_SAFE_INTEGER});
 let released=0;const good={duration:1,channels:1,sampleRate:8000,release(){released++;}};
 for(const bad of [null,7,{...good,release:undefined},{...good,duration:0},{...good,duration:-1},{...good,duration:NaN},{...good,duration:Infinity},{...good,duration:86401},{...good,channels:0},{...good,channels:33},{...good,channels:1.5},
  {...good,sampleRate:0},{...good,sampleRate:768001},{...good,sampleRate:'8000'}]){
  state.bad=bad;
  await assert.rejects(mixer.decode(bytes()),coded('AUDIO_BACKEND_FAILED'),JSON.stringify(bad));
 }
 // Whatever could be released was.
 assert.equal(released,11);
 state.bad={...good,duration:0,release(){throw new Error('kept');}};
 await assert.rejects(mixer.decode(bytes()),error=>error.code==='AUDIO_BACKEND_FAILED'&&error.cleanupErrors[0].message==='kept');
 for(const edge of [{...good,duration:86400},{...good,channels:32},{...good,sampleRate:1,duration:1},{...good,sampleRate:768000,duration:0.001}]){
  state.bad=edge;
  assert.equal((await mixer.decode(bytes())).state,'ready');
 }
 assert.equal(mixer.snapshot().sounds,4);
 mixer.dispose();
});

test('AM08 a voice is started as asked and says what it is',async()=>fixture(({state,mixer,sound,raw,last})=>{
 const voice=mixer.play(sound);
 assert.deepEqual(last().request,{sound:raw,bus:state.buses[2],offset:0,loop:false,rate:1,gain:1,pan:0,fadeIn:0});
 assert.ok(Object.isFrozen(last().request)&&Object.isFrozen(voice));
 assert.deepEqual([voice.id,voice.sound,voice.bus,voice.state,voice.endReason,voice.volume,voice.rate,voice.pan,voice.loop,voice.position],[1,sound,'effects','playing',undefined,1,1,0,false,0]);
 const other=mixer.play(sound,{bus:'music',volume:0.25,rate:2,pan:-0.5,loop:true,offset:0.5,fadeIn:3});
 assert.deepEqual(last().request,{sound:raw,bus:state.buses[1],offset:0.5,loop:true,rate:2,gain:0.25,pan:-0.5,fadeIn:3});
 assert.deepEqual([other.id,other.bus,other.volume,other.rate,other.pan,other.loop,other.position],[2,'music',0.25,2,-0.5,true,0.5]);
 assert.deepEqual([mixer.bus('effects').voices,mixer.bus('music').voices,mixer.master.voices,mixer.snapshot().voices,mixer.snapshot().started],[1,1,2,2,2]);
 assert.equal(mixer.music,undefined);
 // The edges that are allowed.
 for(const options of [{volume:0},{rate:0.25},{rate:4},{pan:-1},{pan:1},{offset:1.999},{fadeIn:60},{maxInstances:256},{whileSilent:'start'},{loop:undefined,bus:undefined}])assert.equal(mixer.play(sound,options).state,'playing');
 const before=state.voices.length;
 for(const options of [null,7,[],{bus:7},{volume:1.01},{volume:-0.01},{volume:'1'},{rate:0.24},{rate:4.01},{pan:-1.01},{pan:1.01},{loop:1},{offset:-0.1},{offset:2},{offset:2.5},{offset:NaN},{fadeIn:-1},{fadeIn:60.5},
  {maxInstances:0},{maxInstances:257},{maxInstances:1.5},{whileSilent:'wait'},{whileSilent:true}])assert.throws(()=>mixer.play(sound,options),coded('AUDIO_PLAY_OPTIONS'),JSON.stringify(options));
 assert.throws(()=>mixer.play(sound,{bus:'nothing'}),coded('AUDIO_BUS_UNKNOWN'));
 for(const value of [undefined,null,{},{...sound},'sound'])assert.throws(()=>mixer.play(value),coded('AUDIO_SOUND_INVALID'));
 assert.equal(state.voices.length,before);
 assert.equal(mixer.snapshot().voices,12);
}));

test('AM09 without the usual names the first bus takes what names none',async()=>fixture(({state,mixer,sound,last})=>{
 assert.equal(mixer.play(sound).bus,'ui');
 assert.equal(last().request.bus,state.buses[1]);
 assert.equal(mixer.playMusic(sound).bus,'ui');
},{mixer:{buses:['ui','voice']}}));

test('AM10 a sound of another mixer is not a sound of this one',async()=>fixture(async({mixer})=>{
 const other=createAudioMixer({backend:fake().backend});
 const foreign=await other.decode(bytes());
 assert.throws(()=>mixer.play(foreign),coded('AUDIO_SOUND_INVALID'));
 assert.throws(()=>mixer.playMusic(foreign),coded('AUDIO_SOUND_INVALID'));
 other.dispose();
}));

test('AM11 a voice that reaches its end is over, and says so to whoever waits',async()=>fixture(async({state,mixer,sound,last})=>{
 const voice=mixer.play(sound),waiting=voice.ended;
 assert.equal(voice.ended,waiting);
 state.time=5;
 last().ended();
 assert.deepEqual([voice.state,voice.endReason,voice.position],['ended','finished',2]);
 assert.equal(await waiting,'finished');
 assert.deepEqual(last().calls,[]);
 assert.deepEqual([mixer.snapshot().voices,mixer.bus('effects').voices,mixer.master.voices],[0,0,0]);
 // Asked after the end, the answer is the same; a second telling changes nothing.
 last().ended();
 assert.equal(await voice.ended,'finished');
 const late=mixer.play(sound);
 last().ended();
 assert.equal(await late.ended,'finished');
 assert.deepEqual(mixer.snapshot().dropped,{silent:0,limit:0,stolen:0});
}));

test('AM12 stopping at once does not wait for the backend',async()=>fixture(async({state,mixer,sound,last})=>{
 const voice=mixer.play(sound);
 state.time=0.75;
 voice.stop();
 assert.deepEqual([voice.state,voice.endReason,voice.position],['ended','stopped',0.75]);
 assert.deepEqual(last().calls,[['stop',0]]);
 assert.equal(await voice.ended,'stopped');
 // The backend tells the end of what was stopped; nothing is ended twice.
 last().ended();
 voice.stop();voice.stop({fade:1});voice.pause();voice.resume();voice.setVolume(0.5);voice.setRate(2);voice.setPan(1);
 assert.deepEqual(last().calls,[['stop',0]]);
 assert.deepEqual([voice.endReason,voice.volume,voice.rate,voice.pan,mixer.snapshot().voices],['stopped',1,1,0,0]);
 // What is asked of a voice is checked even when it is over.
 for(const bad of [()=>voice.setVolume(2),()=>voice.setRate(5),()=>voice.setPan(2),()=>voice.stop({fade:-1}),()=>voice.stop(3)])assert.throws(bad,coded('AUDIO_OPTIONS_INVALID'));
}));

test('AM13 stopping over a fade waits for the backend to tell the end',async()=>fixture(async({state,mixer,sound,last})=>{
 const voice=mixer.play(sound,{loop:true});
 voice.stop({fade:0.5});
 assert.deepEqual(last().calls,[['gain',0,0.5],['stop',0.5]]);
 assert.deepEqual([voice.state,voice.endReason,mixer.snapshot().voices],['stopping',undefined,1]);
 // A second fade, a pause and a new volume do not disturb the one that runs.
 voice.stop({fade:2});voice.pause();voice.setVolume(0.3,{fade:1});
 assert.deepEqual(last().calls.length,2);
 assert.deepEqual([voice.state,voice.volume],['stopping',0.3]);
 state.time=0.5;
 last().ended();
 assert.deepEqual([voice.state,voice.endReason],['ended','stopped']);
 assert.equal(await voice.ended,'stopped');
 // A fade can be cut short.
 const second=mixer.play(sound);
 second.stop({fade:1});second.stop();
 assert.deepEqual(last().calls,[['gain',0,1],['stop',1],['stop',0]]);
 assert.deepEqual([second.state,second.endReason],['ended','stopped']);
 // A backend that cannot fade is not waited for.
 const third=mixer.play(sound);
 state.fail.add('gain');
 assert.throws(()=>third.stop({fade:1}),error=>error.code==='AUDIO_BACKEND_FAILED'&&error.cause.message==='gain');
 assert.deepEqual([third.state,third.endReason],['ended','stopped']);
 assert.deepEqual(last().calls,[['stop',0]]);
 state.fail.clear();
}));

test('AM14 a pause keeps the place and a resume starts from it',async()=>fixture(async({state,mixer,sound,raw,last})=>{
 const voice=mixer.play(sound,{volume:0.5,rate:2,pan:0.25,bus:'music',fadeIn:1});
 const first=last();
 state.time=0.4;
 voice.pause();
 assert.deepEqual(first.calls,[['stop',0]]);
 assert.deepEqual([voice.state,voice.position,mixer.snapshot().voices],['paused',0.8,1]);
 state.time=9;
 assert.equal(voice.position,0.8);
 voice.pause();
 // The end of what was paused is not the end of the voice.
 first.ended();
 assert.equal(voice.state,'paused');
 // What is set while paused is what the voice resumes with.
 voice.setVolume(0.75,{fade:2});voice.setRate(1);voice.setPan(-1);
 assert.equal(first.calls.length,1);
 voice.resume();
 assert.notEqual(last(),first);
 assert.deepEqual(last().request,{sound:raw,bus:state.buses[1],offset:0.8,loop:false,rate:1,gain:0.75,pan:-1,fadeIn:0});
 assert.equal(voice.state,'playing');
 voice.resume();
 assert.equal(state.voices.length,2);
 state.time=9.5;
 assert.ok(Math.abs(voice.position-1.3)<1e-9);
 last().ended();
 assert.equal(await voice.ended,'finished');
 // A paused voice is stopped without a fade, whatever is asked.
 const second=mixer.play(sound);
 second.pause();second.stop({fade:3});
 assert.deepEqual([second.state,second.endReason,last().calls.length],['ended','stopped',1]);
}));

test('AM15 a pause at the end is the end, and a resume the backend refuses stays a pause',async()=>fixture(async({state,mixer,sound,last})=>{
 const voice=mixer.play(sound);
 state.time=2;
 voice.pause();
 assert.deepEqual([voice.state,voice.endReason,voice.position],['ended','finished',2]);
 assert.deepEqual(last().calls,[['stop',0]]);
 // A loop has no end to be at.
 const loop=mixer.play(sound,{loop:true});
 state.time=7;
 loop.pause();
 assert.deepEqual([loop.state,loop.position],['paused',1]);
 state.fail.add('start');
 assert.throws(()=>loop.resume(),coded('AUDIO_BACKEND_FAILED'));
 assert.deepEqual([loop.state,loop.position,mixer.snapshot().voices],['paused',1,1]);
 // What the backend refused has no end to tell.
 state.refused();
 assert.equal(loop.state,'paused');
 state.fail.clear();
 loop.resume();
 assert.equal(loop.state,'playing');
 // A backend that cannot stop has still lost the voice to the pause.
 state.fail.add('stop');
 assert.throws(()=>loop.pause(),coded('AUDIO_BACKEND_FAILED'));
 assert.equal(loop.state,'paused');
 state.fail.clear();
}));

test('AM16 the position follows the clock of the output at the rate of the voice',async()=>fixture(({state,mixer,sound,last})=>{
 state.time=10;
 const voice=mixer.play(sound,{offset:0.5,rate:0.5});
 assert.equal(voice.position,0.5);
 state.time=11;
 assert.equal(voice.position,1);
 voice.setRate(2);
 assert.deepEqual(last().calls,[['rate',2]]);
 assert.equal(voice.rate,2);
 state.time=11.25;
 assert.equal(voice.position,1.5);
 // It does not pass the end, and a clock that went back does not take it back.
 state.time=20;
 assert.equal(voice.position,2);
 state.time=11;
 assert.equal(voice.position,1);
 state.time=30;
 const loop=mixer.play(sound,{loop:true,offset:1.5});
 state.time=31;
 assert.equal(loop.position,0.5);
 loop.setRate(4);
 state.time=31.25;
 assert.equal(loop.position,1.5);
 // A backend that refuses a rate keeps the one it had.
 state.fail.add('rate');
 assert.throws(()=>loop.setRate(1),coded('AUDIO_BACKEND_FAILED'));
 assert.deepEqual([loop.rate,loop.position],[4,1.5]);
 state.fail.clear();
 state.fail.add('time');
 assert.throws(()=>loop.position,coded('AUDIO_BACKEND_FAILED'));
 state.fail.clear();
 for(const time of [-1,NaN,Infinity,'3']){
  state.time=time;
  assert.throws(()=>loop.position,coded('AUDIO_BACKEND_FAILED'));
 }
 state.time=40;
}));

test('AM17 a volume, a rate and a pan reach the voice that plays',async()=>fixture(({state,mixer,sound,last})=>{
 const voice=mixer.play(sound);
 voice.setVolume(0.2);voice.setVolume(0.6,{fade:4});voice.setPan(-0.75);voice.setRate(0.25);voice.setRate(4);voice.setPan(1);voice.setVolume(0);voice.setVolume(1);
 assert.deepEqual(last().calls,[['gain',0.2,0],['gain',0.6,4],['pan',-0.75],['rate',0.25],['rate',4],['pan',1],['gain',0,0],['gain',1,0]]);
 assert.deepEqual([voice.volume,voice.rate,voice.pan],[1,4,1]);
 for(const bad of [()=>voice.setVolume(1.5),()=>voice.setVolume(-1),()=>voice.setVolume('1'),()=>voice.setVolume(0.5,{fade:99}),()=>voice.setRate(0.2),()=>voice.setRate(4.5),()=>voice.setRate(NaN),()=>voice.setPan(-1.5),()=>voice.setPan(1.5),()=>voice.setPan('0')])
  assert.throws(bad,coded('AUDIO_OPTIONS_INVALID'));
 assert.equal(last().calls.length,8);
 state.fail.add('pan');
 assert.throws(()=>voice.setPan(0),coded('AUDIO_BACKEND_FAILED'));
 assert.equal(voice.pan,1);
 state.fail.clear();
 state.fail.add('gain');
 assert.throws(()=>voice.setVolume(0.5),coded('AUDIO_BACKEND_FAILED'));
 state.fail.clear();
}));

test('AM18 what is asked for while nothing can be heard is dropped unless it is told to wait',async()=>fixture(async({state,mixer,sound})=>{
 assert.equal(mixer.state,'locked');
 const lost=mixer.play(sound);
 assert.deepEqual([lost.state,lost.endReason,lost.id,lost.position],['ended','silent',1,0]);
 assert.equal(await lost.ended,'silent');
 assert.equal(state.voices.length,0);
 const kept=mixer.play(sound,{whileSilent:'start'});
 assert.deepEqual([kept.state,state.voices.length],['playing',1]);
 const music=mixer.playMusic(sound);
 assert.deepEqual([music.state,state.voices.length],['playing',2]);
 assert.deepEqual(mixer.snapshot().dropped,{silent:1,limit:0,stolen:0});
 assert.deepEqual([mixer.snapshot().started,mixer.snapshot().voices,mixer.bus('effects').voices],[2,2,1]);
 mixer.setLocked(false);
 assert.equal(mixer.play(sound).state,'playing');
 mixer.suspend();
 assert.equal(mixer.play(sound).endReason,'silent');
 assert.equal(mixer.play(sound,{whileSilent:'drop'}).endReason,'silent');
 mixer.resume();
 assert.equal(mixer.play(sound).state,'playing');
 assert.equal(mixer.snapshot().dropped.silent,3);
},{mixer:{locked:true}}));

test('AM19 when every place is taken the oldest voice that may go gives its place',async()=>fixture(async({state,mixer,sound})=>{
 const loop=mixer.play(sound,{loop:true}),music=mixer.playMusic(sound,{loop:false}),a=mixer.play(sound),b=mixer.play(sound);
 const c=mixer.play(sound);
 assert.deepEqual([a.state,a.endReason,b.state,c.state],['ended','stolen','playing','playing']);
 assert.deepEqual(state.voices[2].calls,[['stop',0]]);
 assert.equal(await a.ended,'stolen');
 assert.equal(mixer.snapshot().voices,4);
 const d=mixer.play(sound,{loop:true}),e=mixer.play(sound,{loop:true});
 assert.deepEqual([b.endReason,c.endReason,d.state,e.state],['stolen','stolen','playing','playing']);
 // Loops and the music hold their places: there is none for a newcomer.
 const before=state.voices.length;
 const f=mixer.play(sound);
 assert.deepEqual([f.state,f.endReason,state.voices.length],['ended','limit',before]);
 assert.equal(await f.ended,'limit');
 assert.deepEqual([loop.state,music.state,mixer.music,mixer.snapshot().voices],['playing','playing',music,4]);
 assert.deepEqual(mixer.snapshot().dropped,{silent:0,limit:1,stolen:3});
 // New music finds no place either, and the music there was stays.
 const other=mixer.playMusic(sound,{restart:true});
 assert.deepEqual([other.endReason,mixer.music,music.state],['limit',music,'playing']);
 // A voice that is fading out or paused still holds its place and can be taken.
 d.stop({fade:1});
 assert.equal(mixer.play(sound).endReason,'limit');
 e.stop();
 const g=mixer.play(sound);
 g.pause();
 const h=mixer.play(sound);
 assert.deepEqual([g.endReason,h.state],['stolen','playing']);
},{mixer:{maxVoices:4}}));

test('AM20 a sound can be kept to a number of voices of its own',async()=>fixture(async({state,mixer,sound})=>{
 state.duration=1;
 const second=await mixer.decode(bytes());
 const other=mixer.play(second),a=mixer.play(sound,{maxInstances:2}),b=mixer.play(sound,{maxInstances:2}),c=mixer.play(sound,{maxInstances:2});
 assert.deepEqual([other.state,a.endReason,b.state,c.state],['playing','stolen','playing','playing']);
 // A smaller number asked later makes room for itself.
 const d=mixer.play(sound,{maxInstances:1,loop:true});
 assert.deepEqual([b.endReason,c.endReason,d.state,other.state],['stolen','stolen','playing','playing']);
 // A loop of the same sound gives way to it.
 const e=mixer.play(sound,{maxInstances:1});
 assert.deepEqual([d.endReason,e.state],['stolen','playing']);
 assert.equal(mixer.snapshot().voices,2);
 // The music is not taken.
 e.stop();
 const music=mixer.playMusic(sound);
 const f=mixer.play(sound,{maxInstances:1});
 assert.deepEqual([f.endReason,music.state],['limit','playing']);
 const g=mixer.play(sound,{maxInstances:2}),h=mixer.play(sound,{maxInstances:2});
 assert.deepEqual([g.endReason,h.state,music.state],['stolen','playing','playing']);
 assert.deepEqual(mixer.snapshot().dropped,{silent:0,limit:1,stolen:5});
}));

test('AM21 both limits at once take two different voices',async()=>fixture(async({state,mixer,sound})=>{
 state.duration=1;
 const second=await mixer.decode(bytes());
 const a=mixer.play(second),b=mixer.play(sound),c=mixer.play(sound);
 // One place of its own sound and one of the mixer: the oldest of each.
 const d=mixer.play(sound,{maxInstances:2});
 assert.deepEqual([a.state,b.endReason,c.state,d.state,mixer.snapshot().voices],['playing','stolen','playing','playing',3]);
 const e=mixer.play(second,{maxInstances:1});
 assert.deepEqual([a.endReason,c.state,e.state,mixer.snapshot().voices],['stolen','playing','playing',3]);
 // Its own voices are loops the mixer would keep; the one it gives is enough.
 const f=mixer.play(second,{maxInstances:1,loop:true}),g=mixer.play(second,{maxInstances:1,loop:true});
 assert.deepEqual([e.endReason,f.endReason,g.state,mixer.snapshot().voices],['stolen','stolen','playing',3]);
},{mixer:{maxVoices:3}}));

test('AM22 there is one music, and the next one takes over across the fade',async()=>fixture(async({state,mixer,sound,raw})=>{
 state.duration=3;
 const second=await mixer.decode(bytes());
 const first=mixer.playMusic(sound,{fade:2,volume:0.5,offset:1});
 assert.deepEqual(state.voices[0].request,{sound:raw,bus:state.buses[1],offset:1,loop:true,rate:1,gain:0.5,pan:0,fadeIn:2});
 assert.deepEqual([mixer.music,mixer.snapshot().music,first.bus],[first,1,'music']);
 // Asking for the music that plays changes nothing but the volume asked for.
 assert.equal(mixer.playMusic(sound),first);
 assert.equal(mixer.playMusic(sound,{volume:0.8,fade:1.5}),first);
 assert.deepEqual(state.voices[0].calls,[['gain',0.8,1.5]]);
 assert.equal(state.voices.length,1);
 const next=mixer.playMusic(second,{fade:4,bus:'effects',loop:false});
 assert.deepEqual(state.voices[1].request,{sound:state.sounds[1],bus:state.buses[2],offset:0,loop:false,rate:1,gain:1,pan:0,fadeIn:4});
 assert.deepEqual(state.voices[0].calls.slice(1),[['gain',0,4],['stop',4]]);
 assert.deepEqual([first.state,mixer.music,mixer.snapshot().voices],['stopping',next,2]);
 state.voices[0].ended();
 assert.equal(first.endReason,'stopped');
 assert.equal(mixer.music,next);
 // Music that reaches its end leaves no music.
 state.voices[1].ended();
 assert.deepEqual([next.endReason,mixer.music,mixer.snapshot().music],['finished',undefined,undefined]);
 // The same sound again, from the start.
 const again=mixer.playMusic(sound),restarted=mixer.playMusic(sound,{restart:true});
 assert.notEqual(restarted,again);
 assert.deepEqual([again.endReason,mixer.music],['stopped',restarted]);
 assert.deepEqual(state.voices[2].calls,[['stop',0]]);
 // What music does not take: a rate, a pan, a number of voices.
 for(const options of [{bus:7},{volume:2},{fade:61},{loop:'yes'},{offset:5},{restart:1},null,7])assert.throws(()=>mixer.playMusic(second,options),coded('AUDIO_PLAY_OPTIONS'));
 assert.throws(()=>mixer.playMusic(second,{bus:'nothing'}),coded('AUDIO_BUS_UNKNOWN'));
 assert.throws(()=>mixer.playMusic(sound,{bus:'nothing'}),coded('AUDIO_BUS_UNKNOWN'));
 assert.equal(mixer.music,restarted);
 const odd=mixer.playMusic(second,{rate:3,pan:1,maxInstances:1,whileSilent:'drop',fadeIn:9});
 assert.deepEqual([odd.rate,odd.pan,state.voices.at(-1).request.fadeIn],[1,0,0]);
}));

test('AM23 the music can be stopped, and a stop of it leaves no music at once',async()=>fixture(async({state,mixer,sound})=>{
 mixer.stopMusic();mixer.stopMusic({fade:1});
 const music=mixer.playMusic(sound);
 mixer.stopMusic({fade:2});
 assert.deepEqual([music.state,mixer.music],['stopping',undefined]);
 assert.deepEqual(state.voices[0].calls,[['gain',0,2],['stop',2]]);
 // The music that fades out is not the music any more: the same sound starts anew.
 const next=mixer.playMusic(sound);
 assert.notEqual(next,music);
 assert.deepEqual([music.state,next.state,state.voices.length],['stopping','playing',2]);
 mixer.stopMusic();
 assert.deepEqual([next.endReason,mixer.music],['stopped',undefined]);
 // A voice of the music stopped by itself is no music either.
 const third=mixer.playMusic(sound);
 third.stop({fade:1});
 assert.equal(mixer.music,undefined);
 const fourth=mixer.playMusic(sound);
 fourth.pause();
 assert.equal(mixer.music,fourth);
 assert.equal(mixer.playMusic(sound),fourth);
 assert.equal(fourth.state,'paused');
 for(const bad of [7,null,{fade:-1},{fade:'1'}])assert.throws(()=>mixer.stopMusic(bad),coded('AUDIO_OPTIONS_INVALID'));
 assert.equal(mixer.music,fourth);
}));

test('AM24 every voice, or every voice of one bus, can be stopped together',async()=>fixture(async({state,mixer,sound})=>{
 const a=mixer.play(sound),b=mixer.play(sound,{bus:'music'}),c=mixer.play(sound),music=mixer.playMusic(sound);
 mixer.stopAll({bus:'effects',fade:1});
 assert.deepEqual([a.state,b.state,c.state,music.state],['stopping','playing','stopping','playing']);
 assert.throws(()=>mixer.stopAll({bus:'nothing'}),coded('AUDIO_BUS_UNKNOWN'));
 for(const bad of [7,null,{fade:99}])assert.throws(()=>mixer.stopAll(bad),coded('AUDIO_OPTIONS_INVALID'));
 mixer.stopAll();
 assert.deepEqual([a.endReason,b.endReason,c.endReason,music.endReason,mixer.music,mixer.snapshot().voices],['stopped','stopped','stopped','stopped',undefined,0]);
 // Every voice is stopped even when the backend fails for some.
 const d=mixer.play(sound),e=mixer.play(sound);
 state.fail.add('stop');
 assert.throws(()=>mixer.stopAll(),error=>error.code==='AUDIO_BACKEND_FAILED'&&error.cleanupErrors.length===1);
 state.fail.clear();
 assert.deepEqual([d.endReason,e.endReason,mixer.snapshot().voices],['stopped','stopped',0]);
 mixer.stopAll({fade:1,bus:'music'});
}));

test('AM25 silence is asked for by name, and every name has to let go',async()=>fixture(({state,mixer})=>{
 const seen=[];mixer.subscribe(value=>seen.push(value));
 mixer.suspend();
 assert.deepEqual([mixer.state,mixer.snapshot().suspendedBy,state.log],['suspended',['game'],['suspend']]);
 mixer.suspend();mixer.suspend('game');mixer.suspend('hidden');
 assert.deepEqual([mixer.snapshot().suspendedBy,state.log],[['game','hidden'],['suspend']]);
 mixer.resume('nobody');mixer.resume();
 assert.deepEqual([mixer.state,mixer.snapshot().suspendedBy,state.log],['suspended',['hidden'],['suspend']]);
 mixer.resume('hidden');mixer.resume('hidden');
 assert.deepEqual([mixer.state,mixer.snapshot().suspendedBy,state.log],['running',[],['suspend','resume']]);
 assert.deepEqual(seen,['suspended','running']);
 for(const bad of ['',7,null,'x'.repeat(33)]){
  assert.throws(()=>mixer.suspend(bad),coded('AUDIO_REASON_INVALID'));
  assert.throws(()=>mixer.resume(bad),coded('AUDIO_REASON_INVALID'));
 }
 mixer.suspend('x'.repeat(32));mixer.resume('x'.repeat(32));
 for(let i=0;i<8;i++)mixer.suspend('r'+i);
 assert.throws(()=>mixer.suspend('r8'),coded('AUDIO_REASON_LIMIT'));
 mixer.suspend('r3');
 for(let i=0;i<8;i++)mixer.resume('r'+i);
 assert.equal(mixer.state,'running');
 // A backend that refuses leaves the mixer as it was.
 state.fail.add('suspend');
 assert.throws(()=>mixer.suspend(),coded('AUDIO_BACKEND_FAILED'));
 assert.deepEqual([mixer.state,mixer.snapshot().suspendedBy],['running',[]]);
 state.fail.clear();
 mixer.suspend();
 state.fail.add('resume');
 assert.throws(()=>mixer.resume(),coded('AUDIO_BACKEND_FAILED'));
 assert.deepEqual([mixer.state,mixer.snapshot().suspendedBy],['suspended',['game']]);
 state.fail.clear();
 assert.ok(Object.isFrozen(mixer.snapshot())&&Object.isFrozen(mixer.snapshot().suspendedBy)&&Object.isFrozen(mixer.snapshot().buses)&&Object.isFrozen(mixer.snapshot().buses[0])&&Object.isFrozen(mixer.snapshot().master)&&Object.isFrozen(mixer.snapshot().dropped));
}));

test('AM26 the lock of the host comes before a silence asked for, and neither moves the backend for the other',async()=>fixture(({state,mixer})=>{
 const seen=[];const off=mixer.subscribe(value=>seen.push(value));
 assert.deepEqual([mixer.state,mixer.snapshot().locked],['locked',true]);
 mixer.suspend('hidden');
 assert.deepEqual([mixer.state,state.log],['locked',['suspend']]);
 mixer.setLocked(false);
 assert.equal(mixer.state,'suspended');
 mixer.setLocked(false);mixer.setLocked(true);mixer.resume('hidden');
 assert.deepEqual([mixer.state,state.log],['locked',['suspend','resume']]);
 mixer.setLocked(false);
 assert.deepEqual([mixer.state,mixer.snapshot().locked,state.log.length],['running',false,2]);
 assert.deepEqual(seen,['suspended','locked','running']);
 for(const bad of [0,1,'no',undefined])assert.throws(()=>mixer.setLocked(bad),coded('AUDIO_OPTIONS_INVALID'));
 off();off();
 mixer.setLocked(true);
 assert.equal(seen.length,3);
 for(const bad of [undefined,null,'x',{}])assert.throws(()=>mixer.subscribe(bad),coded('AUDIO_OPTIONS_INVALID'));
},{mixer:{locked:true}}));

test('AM27 every listener is told a change, and what one of them throws is told afterwards',async()=>fixture(({mixer})=>{
 const seen=[];let off;
 mixer.subscribe(value=>{seen.push('a:'+value);throw new Error('a');});
 mixer.subscribe(value=>{seen.push('b:'+value);off();});
 off=mixer.subscribe(value=>{seen.push('c:'+value);});
 mixer.subscribe(value=>{seen.push('d:'+value);throw new Error('d');});
 assert.throws(()=>mixer.suspend(),error=>error.code==='AUDIO_LISTENER_FAILED'&&error.cause.message==='a'&&error.cleanupErrors.length===1&&error.cleanupErrors[0].message==='d');
 // The one that was taken away by another was not told; the mixer changed all the same.
 assert.deepEqual(seen,['a:suspended','b:suspended','d:suspended']);
 assert.equal(mixer.state,'suspended');
 assert.throws(()=>mixer.setLocked(true),coded('AUDIO_LISTENER_FAILED'));
 assert.equal(mixer.state,'locked');
 assert.throws(()=>mixer.dispose(),error=>error.code==='AUDIO_CLEANUP_FAILED'&&error.cause.code==='AUDIO_LISTENER_FAILED');
 assert.equal(seen.at(-1),'d:closed');
 assert.equal(mixer.state,'closed');
}));

test('AM28 a released sound ends its voices and gives its samples back',async()=>fixture(async({state,mixer,sound,raw})=>{
 const a=mixer.play(sound),b=mixer.play(sound,{loop:true}),music=mixer.playMusic(sound);
 b.pause();
 sound.release();
 assert.deepEqual([a.endReason,b.endReason,music.endReason,mixer.music,sound.state,raw.released],['released','released','released',undefined,'released',1]);
 assert.deepEqual([state.voices[0].calls,state.voices[2].calls],[[['stop',0]],[['stop',0]]]);
 assert.deepEqual([mixer.snapshot().sounds,mixer.snapshot().decodedBytes,mixer.snapshot().voices],[0,0,0]);
 assert.equal(await a.ended,'released');
 sound.release();
 assert.equal(raw.released,1);
 assert.throws(()=>mixer.play(sound),coded('AUDIO_SOUND_RELEASED'));
 assert.throws(()=>mixer.playMusic(sound),coded('AUDIO_SOUND_RELEASED'));
 assert.deepEqual(mixer.snapshot().dropped,{silent:0,limit:0,stolen:0});
 // What fails is told once everything was let go.
 const second=await mixer.decode(bytes()),voice=mixer.play(second);
 state.fail.add('stop');state.fail.add('sound.release');
 assert.throws(()=>second.release(),error=>error.code==='AUDIO_BACKEND_FAILED'&&error.cause.code==='AUDIO_BACKEND_FAILED'&&error.cleanupErrors[0].message==='sound.release');
 state.fail.clear();
 assert.deepEqual([second.state,voice.endReason,mixer.snapshot().sounds,mixer.snapshot().decodedBytes],['released','released',0,0]);
}));

test('AM29 a disposed mixer has ended, released and closed everything, once',async()=>{
 const {state,backend}=fake();
 const mixer=createAudioMixer({backend});
 const sound=await mixer.decode(bytes()),other=await mixer.decode(bytes());
 const seen=[];mixer.subscribe(value=>seen.push(value));
 const a=mixer.play(sound),music=mixer.playMusic(other,{fade:1}),fading=mixer.play(sound);
 fading.stop({fade:5});
 state.log.length=0;
 mixer.dispose();
 assert.deepEqual([a.endReason,music.endReason,fading.endReason,mixer.music,sound.state,other.state,mixer.state],['closed','closed','closed',undefined,'released','released','closed']);
 assert.deepEqual(state.voices.map(voice=>voice.calls.at(-1)),[['stop',0],['stop',0],['stop',0]]);
 assert.deepEqual(state.log,['sound.release','sound.release','bus.release','bus.release','bus.release','close']);
 // The buses under the master go before it.
 assert.deepEqual(state.buses.map(bus=>bus.released),[1,1,1]);
 assert.deepEqual(seen,['closed']);
 assert.equal(await music.ended,'closed');
 assert.deepEqual([mixer.snapshot().state,mixer.snapshot().voices,mixer.snapshot().sounds,mixer.snapshot().decodedBytes],['closed',0,0,0]);
 mixer.dispose();
 assert.equal(state.log.length,6);
 // What starts something says the mixer is closed; what quietens is nothing to do.
 assert.throws(()=>mixer.play(sound),coded('AUDIO_CLOSED'));
 assert.throws(()=>mixer.playMusic(sound),coded('AUDIO_CLOSED'));
 assert.throws(()=>mixer.subscribe(()=>{}),coded('AUDIO_CLOSED'));
 mixer.suspend();mixer.resume();mixer.setLocked(true);mixer.stopAll();mixer.stopMusic();mixer.master.setVolume(0.5);mixer.bus('music').setMuted(true);sound.release();
 assert.deepEqual([mixer.state,mixer.master.volume,mixer.bus('music').muted,seen.length,state.log.length],['closed',1,false,1,6]);
 assert.equal(state.buses[0].gains.length,1);
});

test('AM30 a cleanup that fails in places still goes through all of it',async()=>{
 const {state,backend}=fake();
 const mixer=createAudioMixer({backend});
 const sound=await mixer.decode(bytes());
 mixer.play(sound);mixer.play(sound);
 for(const name of ['stop','sound.release','bus.release','close'])state.fail.add(name);
 assert.throws(()=>mixer.dispose(),error=>error.code==='AUDIO_CLEANUP_FAILED'&&error.cause.code==='AUDIO_BACKEND_FAILED'&&error.cleanupErrors.length===6);
 assert.deepEqual(state.log,['sound.release','bus.release','bus.release','bus.release','close']);
 assert.deepEqual([mixer.state,mixer.snapshot().voices,mixer.snapshot().sounds],['closed',0,0]);
 mixer.dispose();
});

test('AM31 a backend that cannot start a voice leaves none behind',async()=>fixture(async({state,mixer,sound})=>{
 state.fail.add('start');
 assert.throws(()=>mixer.play(sound),error=>error.code==='AUDIO_BACKEND_FAILED'&&error.cause.message==='start');
 assert.throws(()=>mixer.playMusic(sound),coded('AUDIO_BACKEND_FAILED'));
 state.fail.clear();
 state.fail.add('voice');
 assert.throws(()=>mixer.play(sound),coded('AUDIO_BACKEND_FAILED'));
 state.fail.clear();
 state.fail.add('time');
 assert.throws(()=>mixer.play(sound),coded('AUDIO_BACKEND_FAILED'));
 state.fail.clear();
 assert.deepEqual([mixer.snapshot().voices,mixer.snapshot().started,mixer.bus('effects').voices,mixer.music,state.voices.length],[0,0,0,undefined,0]);
 assert.deepEqual(mixer.snapshot().dropped,{silent:0,limit:0,stolen:0});
 // The music there was stays when the next one cannot start.
 const music=mixer.playMusic(sound);
 state.duration=1;
 const second=await mixer.decode(bytes());
 state.fail.add('start');
 assert.throws(()=>mixer.playMusic(second,{fade:1}),coded('AUDIO_BACKEND_FAILED'));
 state.fail.clear();
 assert.deepEqual([mixer.music,music.state,state.voices[0].calls],[music,'playing',[]]);
 // A voice that gave its place to one that could not start is gone all the same.
 const a=mixer.play(sound,{maxInstances:2});
 state.fail.add('start');
 assert.throws(()=>mixer.play(sound,{maxInstances:2}),coded('AUDIO_BACKEND_FAILED'));
 state.fail.clear();
 assert.deepEqual([a.endReason,mixer.snapshot().voices],['stolen',1]);
 // A voice that could not be silenced when it gave its place fails the one that took it.
 const b=mixer.play(sound,{maxInstances:2});
 state.fail.add('stop');
 assert.throws(()=>mixer.play(sound,{maxInstances:2}),coded('AUDIO_BACKEND_FAILED'));
 state.fail.clear();
 assert.deepEqual([b.endReason,mixer.snapshot().voices,mixer.bus('effects').voices,mixer.snapshot().started],['stolen',1,0,3]);
 // The one that took the place had started: it was silenced again.
 assert.deepEqual(state.voices.at(-1).calls,[['stop',0]]);
}));

test('AM32 a backend that tells the end before it returns has told it',async()=>fixture(async({state,mixer,sound})=>{
 state.early=true;
 const voice=mixer.play(sound);
 assert.deepEqual([voice.state,voice.endReason,mixer.snapshot().voices,mixer.snapshot().started],['ended','finished',0,1]);
 assert.deepEqual(state.voices[0].calls,[]);
 const music=mixer.playMusic(sound);
 assert.deepEqual([music.endReason,mixer.music],['finished',undefined]);
 state.early=false;
 const paused=mixer.play(sound,{loop:true});
 paused.pause();
 state.early=true;
 paused.resume();
 assert.deepEqual([paused.state,paused.endReason],['ended','finished']);
}));

test('AM33 a scope of an Engine owns a mixer and a sound through their own cleanup',async()=>{
 const h=host(),engine=await createEngine({host:h.adapter});
 const {state,backend}=fake();
 const game=engine.createScope(),scene=engine.createScope();
 const mixer=game.use(createAudioMixer({backend}));
 const sound=scene.use(await mixer.decode(bytes())),kept=await mixer.decode(bytes());
 const voice=mixer.play(sound),other=mixer.play(kept);
 scene.dispose();
 assert.deepEqual([sound.state,voice.endReason,kept.state,other.state,mixer.state],['released','released','ready','playing','running']);
 game.dispose();
 assert.deepEqual([mixer.state,kept.state,other.endReason,state.log.at(-1)],['closed','released','closed','close']);
 await engine.dispose();
});
