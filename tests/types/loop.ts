// SPDX-License-Identifier: Apache-2.0
// A strict consumer of the frame loop entry: what it may write, and four things it may not.
import {createBrowserFrameLoop} from '@egret/engine/web/loop';
import type {BrowserFrameLoop,BrowserFrameLoopOptions,BrowserFrameLoopSnapshot,BrowserFrameLoopState,FrameLoopEngine,FrameLoopHost} from '@egret/engine/web/loop';
import type {Engine,SharedFrameOptions2D} from '@egret/engine';
import {createSharedWebGL2Host} from '@egret/engine/webgl2';
declare const engine:Engine,canvas:HTMLCanvasElement;
const host=createSharedWebGL2Host({canvas,pixelRatio:1});
const frame:SharedFrameOptions2D={width:480,height:270,clearColor:0x1b1f2a,clearAlpha:1};
// The Engine and a shared Host are what the loop asks for, as they are.
const asEngine:FrameLoopEngine<SharedFrameOptions2D>=engine,asHost:FrameLoopHost=host;void asEngine;void asHost;
const options:BrowserFrameLoopOptions<SharedFrameOptions2D>={engine,host,frame,update(deltaSeconds:number){void deltaSeconds;},maxStepSeconds:0.05,maxPendingFrames:2,onError(error:unknown){void error;}};
const loop:BrowserFrameLoop=createBrowserFrameLoop(options);
const live:BrowserFrameLoop=createBrowserFrameLoop({engine,frame:()=>frame});void live;
loop.start();loop.stop();
const picture:BrowserFrameLoopSnapshot=loop.snapshot(),state:BrowserFrameLoopState=loop.state,drawn:number=picture.frames+picture.skipped+picture.steps;void state;void drawn;
loop.dispose();
// @ts-expect-error a loop needs the frame it draws
createBrowserFrameLoop({engine});
// @ts-expect-error the frame is what this Engine draws
createBrowserFrameLoop({engine,frame:{width:'wide'}});
// @ts-expect-error the state is read; a loop is moved by start and stop
loop.state='running';
// @ts-expect-error a snapshot is read, not written
picture.frames=0;
