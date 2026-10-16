// SPDX-License-Identifier: Apache-2.0
import { createCanvasHost } from '@egret/engine/web';
import { decodeAtlasPng } from './image.mjs';
import { createAtlasFrameSession } from './session.mjs';
const canvas=document.querySelector('#scene'),status=document.querySelector('#status');
const host=createCanvasHost({canvas,pixelRatio:1});
let session,source=0;
try {
  const {image}=await decodeAtlasPng();session=await createAtlasFrameSession({host,profile:'canvas-2d',image});
  const draw=()=>{host.renderFrame(session.capture());status.textContent=JSON.stringify(session.inspect(),null,2);};
  draw();
  document.querySelector('#start').onclick=()=>{for(const actor of Object.values(session.actors))if(actor.playback.state==='idle')actor.playback.start();draw();};
  document.querySelector('#step').onclick=()=>{source+=.0625;session.advanceTo(source);draw();};
  document.querySelector('#pause').onclick=()=>{const playback=session.actors.left.playback;if(playback.state==='running')playback.pause();else if(playback.state==='paused')playback.resume();draw();};
  document.querySelector('#close').onclick=async()=>{await session.retire();status.textContent='Original session retired. Reload to start again.';for(const button of document.querySelectorAll('button'))button.disabled=true;};
}catch(cause){status.textContent=String(cause?.stack??cause);if(session)await session.close();else await host.close();throw cause;}
addEventListener('pagehide',()=>{void session?.close();},{once:true});
