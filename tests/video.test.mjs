// SPDX-License-Identifier: Apache-2.0
// Video as a display object: each new picture of a source leased as the texture of one Bitmap, driven by update.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as egret from '@egret/engine';
import {createVideo} from '@egret/engine/video';
import {host} from './helpers.mjs';

const coded=code=>error=>error?.code===code;
const picture=(width,height,value)=>egret.createImageData2D({width,height,pixels:new Uint8Array(width*height*4).fill(value)});
/** A source a test drives: it holds the next picture until it is read, and records what it was told. */
function fakeSource(){
 const told=[];let next;
 const source={state:'ready',width:4,height:2,duration:3,currentTime:0,loop:false,muted:true,volume:1,refuse:false,disposed:0,
  give(frame){next=frame;},
  readFrame(){const frame=next;next=undefined;return frame;},
  async play(){told.push('play');if(source.refuse)throw new Error('needs a press');source.state='playing';},
  pause(){told.push('pause');source.state='paused';},
  seek(t){told.push('seek '+t);source.currentTime=t;},
  dispose(){source.disposed++;}};
 return {source,told};
}
async function withVideo(run){
 const engine=await egret.createEngine({host:host().adapter});
 const {source,told}=fakeSource(),video=createVideo({assets:engine.assets,source});
 try{await run({engine,video,source,told});}finally{video.dispose();await engine.dispose();}
}
const settle=()=>new Promise(resolve=>setTimeout(resolve,0));

test('VI01 a video needs the Engine\'s assets and a source that can be driven',async()=>{
 const engine=await egret.createEngine({host:host().adapter});
 try{
  const {source}=fakeSource();
  for(const options of [null,7,{source},{assets:{},source},{assets:engine.assets},{assets:engine.assets,source:{}},{assets:engine.assets,source:{...source,readFrame:1}}])
   assert.throws(()=>createVideo(options),coded('VIDEO_OPTIONS_INVALID'),String(options));
  const video=createVideo({assets:engine.assets,source});
  assert.ok(Object.isFrozen(video));
  assert.deepEqual([video.state,video.width,video.height,video.duration,video.currentTime,video.display.numChildren],['ready',4,2,3,0,0]);
  video.dispose();
 }finally{await engine.dispose();}
});

test('VI02 each new picture becomes the texture of one Bitmap, and the one before is let go',async()=>withVideo(async({video,source})=>{
 assert.equal(await video.update(),false,'nothing yet');
 source.give({image:picture(4,2,10),time:0});
 assert.equal(await video.update(),true);
 const bitmap=video.display.getChildAt(0),first=bitmap.textureLease;
 assert.deepEqual([video.display.numChildren,bitmap.naturalWidth,bitmap.naturalHeight,egret.copyImageData2DPixels(first.value.imageData).at(0)],[1,4,2,10]);
 assert.equal(await video.update(),false,'the same picture is not made again');
 const firstTexture=first.value;
 source.give({image:picture(4,2,20),time:1/30});
 assert.equal(await video.update(),true);
 // The same Bitmap shows the new picture; the old lease is let go and its texture disposed once nothing holds it.
 assert.equal(video.display.getChildAt(0),bitmap);
 assert.notEqual(bitmap.textureLease,first);
 assert.equal(egret.copyImageData2DPixels(bitmap.textureLease.value.imageData).at(0),20);
 await settle();
 assert.equal(firstTexture.isDisposed,true);
 // A picture of another size is shown at its own size.
 source.give({image:picture(8,6,30),time:2/30});await video.update();
 assert.deepEqual([bitmap.naturalWidth,bitmap.naturalHeight],[8,6]);
 assert.deepEqual(video.snapshot(),{state:'ready',frames:3,skipped:0,currentTime:0,shownTime:2/30});
}));

test('VI03 while a picture is on its way to a texture, another update waits for the next one',async()=>withVideo(async({video,source})=>{
 source.give({image:picture(4,2,1),time:0});
 const first=video.update();
 source.give({image:picture(4,2,2),time:0.1});
 assert.equal(await video.update(),false);
 assert.equal(await first,true);
 assert.equal(video.snapshot().skipped,1);
 // The newer picture was left with the source, and the next update takes it.
 assert.equal(await video.update(),true);
 assert.equal(egret.copyImageData2DPixels(video.display.getChildAt(0).textureLease.value.imageData).at(0),2);
}));

test('VI04 play, pause, seek and the sound are passed to the source, checked first; a refused play says so',async()=>withVideo(async({video,source,told})=>{
 await video.play();video.pause();video.seek(1.5);video.seek(0);
 assert.deepEqual(told,['play','pause','seek 1.5','seek 0']);
 video.loop=true;video.muted=false;video.volume=0.25;
 assert.deepEqual([source.loop,source.muted,source.volume,video.loop,video.muted,video.volume],[true,false,0.25,true,false,0.25]);
 for(const bad of [()=>video.seek(-1),()=>video.seek(NaN),()=>{video.loop=1;},()=>{video.muted='no';},()=>{video.volume=1.5;},()=>{video.volume=-0.1;},()=>video.onEnded(7)])
  assert.throws(bad,coded('VIDEO_OPTIONS_INVALID'));
 source.refuse=true;
 await assert.rejects(video.play(),error=>error.code==='VIDEO_PLAY_REFUSED'&&error.cause.message==='needs a press');
}));

test('VI05 the end is told once each time the source comes to it, and again after it plays again',async()=>withVideo(async({video,source})=>{
 const heard=[];const stop=video.onEnded(()=>heard.push('end'));
 source.state='ended';
 await video.update();await video.update();
 source.give({image:picture(4,2,5),time:3});await video.update();
 assert.deepEqual(heard,['end']);
 await video.play();source.state='ended';await video.update();
 assert.deepEqual(heard,['end','end']);
 stop();source.state='playing';await video.update();source.state='ended';await video.update();
 assert.deepEqual(heard,['end','end']);
 // Listeners that throw are told of after the others.
 video.onEnded(()=>{throw new Error('one');});video.onEnded(()=>heard.push('after'));
 source.state='playing';await video.update();source.state='ended';
 await assert.rejects(video.update(),error=>error.code==='VIDEO_LISTENER_FAILED'&&error.cause.message==='one');
 assert.deepEqual(heard,['end','end','after']);
}));

test('VI06 a bad picture is refused; a disposed video lets go of everything and takes nothing more',async()=>{
 await withVideo(async({video,source})=>{
  source.give({image:{width:1,height:1,pixels:new Uint8Array(4)},time:0});
  await assert.rejects(video.update(),coded('VIDEO_FRAME_INVALID'));
  source.give({image:picture(1,1,0),time:NaN});
  await assert.rejects(video.update(),coded('VIDEO_FRAME_INVALID'));
  source.give(null);
  await assert.rejects(video.update(),coded('VIDEO_FRAME_INVALID'));
 });
 const engine=await egret.createEngine({host:host().adapter});
 const {source}=fakeSource(),video=createVideo({assets:engine.assets,source});
 source.give({image:picture(4,2,1),time:0});await video.update();
 const bitmap=video.display.getChildAt(0),texture=bitmap.textureLease.value,display=video.display;
 // A picture still on its way when the video is disposed is let go when it arrives.
 source.give({image:picture(4,2,2),time:1});const late=video.update();
 video.dispose();video.dispose();
 assert.equal(await late,false);
 await settle();
 assert.deepEqual([video.state,bitmap.isDisposed,display.isDisposed,source.disposed,texture.isDisposed],['closed',true,true,1,true]);
 for(const bad of [()=>video.update(),()=>video.play(),()=>video.pause(),()=>video.seek(0),()=>{video.loop=true;},()=>video.onEnded(()=>{})])
  await assert.rejects(async()=>bad(),coded('VIDEO_CLOSED'));
 assert.equal(video.snapshot().state,'closed');
 await engine.dispose();
});

test('VI07 a strict consumer compiles against both entries, and five misuses are refused; each entry has its factory alone',async()=>{
 const {spawnSync}=await import('node:child_process');
 const result=spawnSync(process.execPath,['node_modules/typescript/bin/tsc','--project','tests/types/video.json','--pretty','false'],{cwd:new URL('..',import.meta.url),encoding:'utf8'});
 assert.equal(result.status,0,result.stdout+result.stderr);
 assert.deepEqual(Object.keys(await import('@egret/engine/video')),['createVideo']);
 for(const entry of ['@egret/engine','@egret/engine/audio','@egret/runtime'])assert.equal('createVideo' in await import(entry),false,entry);
});
