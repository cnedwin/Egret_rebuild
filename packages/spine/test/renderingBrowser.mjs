// SPDX-License-Identifier: Apache-2.0
// Real browser SDK composition. Expected pixels are authored separately by the collector.
import {createEngineForProfile,Sprite} from '@egret/engine';
import {createSharedWebGPUHost} from '@egret/engine/webgpu';
import {createSharedWebGL2Host} from '@egret/engine/webgl2';
import {admitResourceManifest} from '@egret/contracts/resources';
import {createManifestSpineContentLoader} from '@egret/spine/web';
import {createSpineInstance,createSpineDisplay} from '@egret/spine';
const PROFILE='egret.shared-frame2d/1';
export async function runCase(backend,def){
 const canvas=document.createElement('canvas');canvas.width=32;canvas.height=32;canvas.style.width='32px';canvas.style.height='32px';document.body.append(canvas);
 const diagnostics=[],options={canvas,pixelRatio:def.ratio??1,outputAlpha:'premultiplied',enableReadback:true,onDiagnostic:d=>diagnostics.push({code:d.code,severity:d.severity})};
 let device,host,engine,loader,group,view,player;const report={name:def.name,backend,diagnostics};
 try{
  if(backend==='webgpu'){const adapter=await navigator.gpu?.requestAdapter();if(!adapter)throw Error('WebGPU adapter unavailable');device=await adapter.requestDevice();host=createSharedWebGPUHost({...options,device:{kind:'borrow',device}});}else host=createSharedWebGL2Host(options);
  engine=await createEngineForProfile({host,onDiagnostic:d=>diagnostics.push({code:d.code,severity:d.severity})},PROFILE);
  const manifest=(await (await fetch('/'+def.name+'/manifest.json')).json()),admitted=admitResourceManifest(manifest);if(!admitted.ok)throw Error('Manifest refused');
  loader=createManifestSpineContentLoader(engine,engine.createScope(),admitted.value,{baseUrl:new URL('/'+def.name+'/',location.href).href});group=loader.load(engine.createScope(),['e_json']);await group.ready;
  if(!def.transparent){const background=new Sprite();background.graphics.beginFill(0x204060).drawRect(0,0,32,32);engine.stage.addChild(background);}
  player=createSpineInstance(group.getSpine('e_json'),engine.createScope());view=createSpineDisplay(player,engine.createScope(),{colorProfile:'egret-shared-linear/1'});view.node.x=12;view.node.y=12;if(def.flip)view.node.scaleX=-1;if(def.rectClip)view.node.clipRect={x:-4,y:-4,width:4,height:8};engine.stage.addChild(view.node);
  if(def.skins){player.setSkins(def.skins);player.advance({tickId:1,elapsedSeconds:0,deltaSeconds:0});report.selection=player.getSnapshot().skins;}
  if(def.swap){player.setAnimation(0,'swap');player.advance({tickId:1,elapsedSeconds:0,deltaSeconds:0});}
  const overlay=new Sprite();overlay.graphics.beginFill(0x00ff00).drawRect(0,0,2,2);engine.stage.addChild(overlay);
  const frameOptions={width:32,height:32,outputAlpha:'premultiplied',clearColor:0,clearAlpha:0};
  async function draw(retained){const ticket=host.requestReadback();const frame=retained??engine.renderSharedFrame(frameOptions);if(retained)host.renderSharedFrame(retained);const pixels=await ticket;await host.whenIdle();return {frame,pixels:{width:pixels.width,height:pixels.height,alphaMode:pixels.alphaMode,bytes:Array.from(pixels.bytes)}};}
  const initial=await draw();report.initial=initial.pixels;report.shape={commands:initial.frame.commands.map(c=>c.kind),pages:initial.frame.pages.length,geometries:initial.frame.geometries.length};report.display=view.getStatus();
  if(def.replay){if(def.outfitReplay){player.setSkin('default');player.advance({tickId:2,elapsedSeconds:0,deltaSeconds:0});report.changedSelection=player.getSnapshot().skins;}else {player.setAnimation(0,'move');player.advance({tickId:2,elapsedSeconds:.06,deltaSeconds:.06});}report.moved=(await draw()).pixels;group.dispose();report.retired={view:view.getStatus().isDisposed,player:player.isDisposed,loader:loader.getStatus()};report.replayed=(await draw(initial.frame)).pixels;}
  group.dispose();await loader.close();report.logical=loader.getStatus();await engine.dispose();report.host=host.getSharedStatus();report.closed=true;
 }finally{if(loader)await loader.close();if(engine)await engine.dispose();else if(host)await host.close();device?.destroy();canvas.remove();}
 return report;
}
