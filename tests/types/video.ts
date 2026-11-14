// SPDX-License-Identifier: Apache-2.0
// A strict consumer of the video entries: what it may write, and five things it may not.
import {createVideo} from '@egret/engine/video';
import type {Video,VideoFrame,VideoOptions,VideoSnapshot,VideoSource,VideoSourceState,VideoState} from '@egret/engine/video';
import {createBrowserVideo} from '@egret/engine/web/video';
import type {BrowserVideo,BrowserVideoOptions} from '@egret/engine/web/video';
import type {AssetManager,Scope} from '@egret/engine';
declare const scope:Scope,assets:AssetManager,source:VideoSource,stream:MediaStream;
const options:VideoOptions={assets,source};
const video:Video=scope.use(createVideo(options));
const browserOptions:BrowserVideoOptions={assets,src:'intro.webm',loop:true,muted:true,volume:0.5,maxWidth:640,crossOrigin:'anonymous'};
const film:BrowserVideo=scope.use(createBrowserVideo(browserOptions));
const live:BrowserVideo=createBrowserVideo({assets,stream});
const element:HTMLVideoElement=film.element;void element;void live;
video.loop=true;video.muted=false;video.volume=0.5;video.seek(2);video.pause();
void video.play().then(()=>video.update()).then((shown:boolean)=>shown);
const stop:()=>void=video.onEnded(()=>{});stop();
const picture:VideoSnapshot=video.snapshot(),state:VideoState=picture.state,sourceState:VideoSourceState=source.state,frame:VideoFrame|undefined=source.readFrame();void state;void sourceState;void frame;
// @ts-expect-error a video needs its source
createVideo({assets});
// @ts-expect-error the time is read; a video is moved by seek
video.currentTime=3;
// @ts-expect-error the volume is a number
video.volume='loud';
// @ts-expect-error a browser video plays a file named by a string
createBrowserVideo({assets,src:7});
// @ts-expect-error a snapshot is read, not written
picture.frames=0;
