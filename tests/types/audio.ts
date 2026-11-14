// SPDX-License-Identifier: Apache-2.0
// A strict consumer of the two sound entries: what it may write, and eleven things it may not.
import {createAudioMixer} from '@egret/engine/audio';
import type {AudioBackend,AudioBackendBus,AudioBackendSound,AudioBackendStart,AudioBackendVoice,AudioBus,AudioBusOptions,AudioBusSnapshot,AudioEndReason,AudioFade,AudioMixer,AudioMixerOptions,AudioMixerSnapshot,AudioMixerState,AudioMusicOptions,AudioPlayOptions,AudioSound,AudioVoice,AudioVoiceState} from '@egret/engine/audio';
import {createBrowserAudio} from '@egret/engine/web/audio';
import type {BrowserAudio,BrowserAudioOptions} from '@egret/engine/web/audio';
import type {Scope} from '@egret/engine';
declare const scope:Scope,bytes:Uint8Array,buffer:ArrayBuffer,context:OfflineAudioContext;
// A host of its own writes the five things a backend is.
const held:AudioBackendSound={duration:1,channels:2,sampleRate:48000,release(){}};
const gain:AudioBackendBus={setGain(value:number,seconds:number){void value;void seconds;},release(){}};
const sounding:AudioBackendVoice={setGain(){},setRate(){},setPan(){},stop(seconds:number){void seconds;}};
const reading:AudioBackendVoice={...sounding,position:()=>0};void reading;
const file:AudioBackendSound={...held,streamed:true};
const backend:AudioBackend={time:0,decode:async()=>held,createBus:(parent:AudioBackendBus|undefined)=>{void parent;return gain;},
 openStream:async(url:string)=>{void url;return file;},
 start:(request:AudioBackendStart,ended:()=>void)=>{const offset:number=request.offset,loop:boolean=request.loop;void offset;void loop;void ended;return sounding;},suspend(){},resume(){},close(){}};
const named:AudioBusOptions={name:'voice',volume:0.5,muted:false};
const options:AudioMixerOptions={backend,buses:['music','effects',named],volume:1,muted:false,locked:true,maxVoices:16,maxSounds:64,maxDecodedBytes:1<<26};
const mixer:AudioMixer=scope.use(createAudioMixer(options));
const state:AudioMixerState=mixer.state,master:AudioBus=mixer.master,all:readonly AudioBus[]=mixer.buses,bus:AudioBus=mixer.bus('music');void state;void master;void all;
const fade:AudioFade={fade:0.5};
bus.setVolume(0.5,fade);bus.setMuted(true);
const level:number=bus.volume,quiet:boolean=bus.muted,count:number=bus.voices;void level;void quiet;void count;
async function play():Promise<void>{
 const sound:AudioSound=scope.use(await mixer.decode(bytes)),other:AudioSound=await mixer.decode(buffer);
 const ready:'ready'|'released'=sound.state,size:number=sound.decodedBytes;void ready;void size;
 const long:AudioSound=scope.use(await mixer.stream('music/long.ogg')),read:boolean=long.streamed;void read;
 mixer.playMusic(long,{fade:2});
 const once:AudioPlayOptions={bus:'effects',volume:0.5,rate:1.5,pan:-1,loop:false,offset:0.1,fadeIn:0.2,maxInstances:2,whileSilent:'start'};
 const voice:AudioVoice=mixer.play(sound,once);
 const playing:AudioVoiceState=voice.state,reason:AudioEndReason|undefined=voice.endReason,place:number=voice.position;void playing;void reason;void place;
 voice.setVolume(0.2,fade);voice.setRate(2);voice.setPan(1);voice.pause();voice.resume();voice.stop(fade);
 const over:AudioEndReason=await voice.ended;void over;
 const tune:AudioMusicOptions={bus:'music',volume:0.8,fade:1,loop:true,offset:0,restart:false};
 const music:AudioVoice=mixer.playMusic(other,tune),now:AudioVoice|undefined=mixer.music;void music;void now;
 mixer.stopMusic(fade);mixer.stopAll({bus:'effects',fade:0.1});mixer.stopAll();
 other.release();
}
void play;
mixer.suspend();mixer.suspend('menu');mixer.resume('menu');mixer.resume();mixer.setLocked(false);
const off:()=>void=mixer.subscribe((next:AudioMixerState)=>{void next;});off();
const picture:AudioMixerSnapshot=mixer.snapshot(),row:AudioBusSnapshot=picture.buses[0]!,by:readonly string[]=picture.suspendedBy,stolen:number=picture.dropped.stolen;void row;void by;void stolen;
const page:BrowserAudioOptions={buses:['music','effects'],volume:0.8,pauseWhenHidden:true,unlockTarget:document,onError:(cause:unknown)=>{void cause;},maxVoices:24};
const audio:BrowserAudio=scope.use(createBrowserAudio(page)),same:AudioMixer=audio.mixer,output:AudioNode=audio.output,made:BaseAudioContext=audio.context;void same;void output;void made;
createBrowserAudio({context}).dispose();createBrowserAudio().dispose();
// @ts-expect-error a mixer needs a backend
createAudioMixer({});
// @ts-expect-error the page brings its own backend
createBrowserAudio({backend});
// @ts-expect-error whether the page is locked is for the page to say
createBrowserAudio({locked:true});
// @ts-expect-error a volume is a number
bus.setVolume('loud');
// @ts-expect-error what happens in silence is one of two things
mixer.play(held as unknown as AudioSound,{whileSilent:'wait'});
// @ts-expect-error music has no rate of its own
mixer.playMusic(held as unknown as AudioSound,{rate:2});
// @ts-expect-error a state is read, not written
mixer.state='running';
// @ts-expect-error a snapshot is read, not written
picture.voices=0;
// @ts-expect-error a reason of an end is one of the named ones
const wrong:AudioEndReason='bored';void wrong;
// @ts-expect-error the page gives no way to fetch a file
audio.load('music.ogg');
// @ts-expect-error a stream is opened by where it is, not by its bytes
void mixer.stream(bytes);
