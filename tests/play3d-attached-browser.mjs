// SPDX-License-Identifier: Apache-2.0
// Actual browser, built public entries, preconfigured renderer. Counts are logical clock/render observations.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const [playwright, backend = 'webgl2'] = process.argv.slice(2);
if (!playwright || !path.isAbsolute(playwright) || !['webgl2', 'webgpu'].includes(backend))
  throw new Error('Usage: node tests/play3d-attached-browser.mjs <absolute Playwright index.mjs> [webgl2|webgpu]');
const root = fileURLToPath(new URL('..', import.meta.url));
const imports = JSON.parse(fs.readFileSync(path.join(root, 'examples/play/index.html'), 'utf8').match(/<script type="importmap">([\s\S]*?)<\/script>/)[1]);
imports.imports['@egret/engine/world3d'] = '/packages/engine/dist/rendering/world3d/index.js';
imports.imports['@egret/engine/webgpu/world3d'] = '/packages/engine/dist/web/world3d/webgpu.js';
const html = '<!doctype html><meta charset="utf-8"><link rel="icon" href="data:,">' +
  '<style>html,body{margin:0}#holder{position:relative;width:192px;height:144px;overflow:hidden}#scene{position:absolute;inset:0;width:100%;height:100%}</style>' +
  '<script type="importmap">' + JSON.stringify(imports) + '</script><div id="holder"><canvas id="scene"></canvas></div>' +
  '<script type="module">' + String.raw`
import * as gl from '@egret/engine/webgl2/world3d';
import * as gpu from '@egret/engine/webgpu/world3d';
import { Bitmap } from '@egret/engine';
import { Scene3D, Mesh3D, createBoxGeometry3D, createPerspectiveCamera3D, createStandardMaterial3D, createHemisphereLight3D } from '@egret/engine/world3d';
const require=(ok,why)=>{if(!ok)throw Error(why);};
const frames=async(n=5)=>{for(let i=0;i<n;i++)await new Promise(resolve=>requestAnimationFrame(resolve));};
const gate=()=>{let release;const promise=new Promise(resolve=>release=resolve);return{promise,release};};
const outcome=p=>p.then(value=>({value}),error=>({error}));
const backend='${backend}',api=backend==='webgl2'?gl:gpu;
async function run(){
  require(gl.play3dAttached===gpu.play3dAttached,'same public companion');
  const holder=document.querySelector('#holder'),canvas=document.querySelector('#scene');
  const renderer=await (backend==='webgl2'?api.createWebGL2Renderer3D:api.createWebGPURenderer3D)({canvas,antialias:false,shadows:false,toneMapping:'reinhard',exposure:.83});
  const identity=backend==='webgl2'?(()=>{const context=canvas.getContext('webgl2'),extension=context.getExtension('WEBGL_debug_renderer_info');return context.getParameter(extension?.UNMASKED_RENDERER_WEBGL??context.RENDERER);})():(()=>{const info=renderer.device.adapterInfo;return info?{vendor:info.vendor,architecture:info.architecture,device:info.device,description:info.description}:null;})();
  renderer.setSize(192,144,1);
  renderer.postProcess.enabled=false;
  const geometry=createBoxGeometry3D({width:1,height:1,depth:1}),material=createStandardMaterial3D({color:0x36c49b}),scene=new Scene3D();
  scene.addChild(new Mesh3D(geometry,material));
  scene.addChild(createHemisphereLight3D({color:0xffffff,groundColor:0x445566,intensity:1.5}));
  scene.background=[.04,.08,.12];
  const camera=createPerspectiveCamera3D({fov:44,aspect:4/3,near:.2,far:37});camera.setPosition(0,1,4);camera.lookAt(0,0,0);
  const original={fov:camera.fov,aspect:camera.aspect,background:[...scene.background],position:[...camera.position],children:scene.children.length,exposure:renderer.exposure,toneMapping:renderer.toneMapping,shadows:renderer.shadowsEnabled,post:renderer.postProcess.enabled};
  const order=[];let game,session,firstView,phase='initial',ticks=0,updates=0,worldCalls=0,framesObserved=0,entered=gate(),release=gate();
  const rejection=new Error('controlled asset refusal'),arrangeRejection=new Error('controlled arrange refusal');
  const worldOptions={renderer,scene,camera,autoResize:false,onUpdate(){worldCalls++;},onFrameTiming(s){if(s.outcome==='rendered')framesObserved++;}};
  const playTimings=[];
  const options={parent:holder,width:192,height:144,backend,audio:false,renderMode:'on-demand',
    onFrameTiming(sample){playTimings.push(sample);if(playTimings.length===1)throw Error('observer failure is observational');},
    setup(p){order.push('setup:'+phase);if(game===undefined){game=p;p.engine.clock.onTick(p.scope,()=>{ticks++;return undefined;});}else require(game===p,'setup game identity changed');p.rect(12,12,16,16,0xff8030);},
    async world(p){order.push('world:'+phase);require(p===game,'factory borrowed other Play instance');if(phase==='held'||phase==='close'){entered.release();await release.promise;}if(phase==='failure')throw rejection;if(phase==='no-view')return undefined;return worldOptions;},
    arrange(p){require(p===game,'arrange game identity changed');if(phase==='arrange-failure')throw arrangeRejection;},
    update(dt,p){require(p===game,'update game identity changed');updates++;}
  };
  try{
    session=await api.play3dAttached(options);firstView=session.view;
    require(session.game===game&&firstView.renderer===renderer&&firstView.scene===scene&&firstView.camera===camera,'exact borrowed object identity');
    require(order.join(',')==='setup:initial,world:initial','normal setup precedes world factory');
    require(holder.querySelectorAll('canvas').length===2,'one existing 3D and one native 2D canvas');
    await frames();
    const count=()=>({clock:ticks,world:worldCalls,renderer:renderer.info.frame,timing:framesObserved,updates,playTiming:playTimings.length});
    const first=count();await frames(12);const second=count();
    const difference=Object.fromEntries(Object.keys(first).map(k=>[k,second[k]-first[k]]));
    require(difference.clock>3&&difference.clock===difference.world&&difference.clock===difference.renderer&&difference.clock===difference.timing,'one world render for every Play Engine clock tick');
    require(difference.playTiming===difference.updates,'one Play timing sample per active update callback');
    require(playTimings.length>=12&&playTimings.every((s,i)=>Object.isFrozen(s)&&Number.isFinite(s.rafTimestampMs)&&s.callbackEndMs>=s.callbackStartMs&&s.updateMs>=0&&s.renderMs>=0&&(i===0||s.id===playTimings[i-1].id+1)),'Play observer did not receive one immutable, ordered sample per actual active loop callback');
    require(playTimings.some(s=>s.outcome==='submitted')&&playTimings.some(s=>s.outcome==='retained')&&!playTimings.some(s=>s.outcome==='rendered'),'Play must distinguish submission from retained UI');
    const overStart=playTimings.length,pictures=[];
    for(let i=0;i<70;i++){
      const pixels=new Uint8Array(8*8*4).fill(255);pixels[0]=i;
      const picture=game.scope.use(new Bitmap(await game.browser.textureFromPixels(8,8,pixels)));
      picture.x=5+(i%10)*12;picture.y=35+Math.floor(i/10)*12;game.ui.addChild(picture);pictures.push(picture);
      if(i%8===7)await frames(2);
    }
    await frames(8);require(playTimings.slice(overStart).some(s=>s.outcome==='refused'),'actual image-budget refusal must not be labeled submitted');
    const recovering=playTimings.length;for(const picture of pictures.slice(40))game.remove(picture);
    await frames(10);require(playTimings.slice(recovering).some(s=>s.outcome==='submitted')&&game.browser.loop.state==='running','recoverable refusal must return to actual submission');
    for(const picture of pictures.slice(0,40))game.remove(picture);await frames();
    require(camera.fov===original.fov&&camera.aspect===original.aspect&&camera.position.every((v,i)=>v===original.position[i])&&scene.children.length===original.children&&scene.background.every((v,i)=>v===original.background[i])&&renderer.exposure===original.exposure&&renderer.toneMapping===original.toneMapping&&renderer.shadowsEnabled===original.shadows&&renderer.postProcess.enabled===original.post,'caller camera, lights, renderer quality or scene changed');
    const duplicate=await outcome(api.play3dAttached({parent:holder,width:192,height:144,backend,audio:false,world:()=>worldOptions}));
    require(duplicate.error?.code==='PLAY_OPTIONS_INVALID'&&holder.querySelectorAll('canvas').length===2&&!firstView.isDisposed,'second live attach either succeeded or damaged original');
    phase='held';const restarting=game.restart();await entered.promise;
    const held=count();await frames();require(session.view===undefined&&firstView.isDisposed&&renderer.info.frame===held.renderer&&worldCalls===held.world,'old view still drew during deferred restart');
    release.release();await restarting;await frames();require(session.view!==firstView&&session.view.renderer===renderer&&renderer.info.frame>held.renderer,'borrowed renderer not reattached after restart');
    phase='failure';const priorView=session.view;const failed=await outcome(game.restart());const afterFailure=count();await frames();
    require(failed.error===rejection&&session.view===undefined&&priorView.isDisposed&&renderer.info.frame===afterFailure.renderer&&worldCalls===afterFailure.world,'failed factory left a running world');
    phase='retry';await game.restart();await frames();require(session.view?.renderer===renderer&&renderer.info.frame>afterFailure.renderer,'retry failed');
    phase='arrange-failure';const badArrange=await outcome(game.restart()),beforeArrangeRetry=count();await frames();
    require(badArrange.error===arrangeRejection&&session.view===undefined&&renderer.info.frame===beforeArrangeRetry.renderer,'failed arrange left an active borrowed view');
    phase='retry';await game.restart();await frames();
    for(let i=0;i<8;i++){const retired=session.view;await game.restart();require(retired.isDisposed&&session.view?.renderer===renderer&&session.view!==retired,'repeated restart retained a live prior subscription');}
    const repeated=count();await frames();const repeatDiff=count();require(repeatDiff.clock-repeated.clock===repeatDiff.renderer-repeated.renderer&&repeatDiff.world-repeated.world===repeatDiff.renderer-repeated.renderer,'repeated restart duplicated subscriptions');
    phase='no-view';await game.restart();const flat=count();await frames();require(session.view===undefined&&renderer.info.frame===flat.renderer&&updates>flat.updates&&game.canvas.isConnected,'undefined factory did not retain only Play UI');
    phase='retry';await game.restart();await frames();require(session.view?.renderer===renderer,'retry from UI-only run failed');
    phase='close';entered=gate();release=gate();const pending=outcome(game.restart());await entered.promise;await game.dispose();const closed=await pending;release.release();await frames();
    require(closed.error?.code==='SCOPE_CLOSED'&&session.view===undefined&&holder.querySelectorAll('canvas').length===1&&canvas.isConnected,'closing during load did not retire only owned interface/view');
    const beforeManual=renderer.info.frame;require(renderer.render(scene,camera)&&renderer.info.frame===beforeManual+1,'borrowed renderer was disposed');
    const initialFailure=await outcome(api.play3dAttached({parent:holder,width:192,height:144,backend,audio:false,world:async()=>{throw rejection;}}));
    require(initialFailure.error===rejection&&holder.querySelectorAll('canvas').length===1&&canvas.isConnected,'initial failure leaked a canvas or damaged borrowed canvas');
    const finalCount=renderer.info.frame;await frames();require(renderer.info.frame===finalCount,'hidden world loop remained after disposal/failure');
    return{backend,identity,difference,order,playTiming:{samples:playTimings.length,outcomes:[...new Set(playTimings.map(s=>s.outcome))]},duplicateRefused:true,exactIdentity:true,configurationPreserved:original,heldRestartNoFrames:true,failedRestartNoFrames:true,arrangeFailureNoFrames:true,repeatedRestarts:8,uiOnlyRetry:true,borrowedAliveAfterClose:true,lateCloseRefused:true,initialFailureNoCanvasLeak:true};
  }finally{release.release();await session?.game.dispose();renderer.dispose();geometry.dispose();material.dispose();}
}
window.receipt=await run().then(value=>({ok:true,value}),error=>({ok:false,error:String(error),stack:error.stack}));
` + '</script>';
const mime={'.mjs':'text/javascript','.js':'text/javascript','.json':'application/json','.wasm':'application/wasm'};
const server=http.createServer((req,res)=>{try {const u=new URL(req.url,'http://localhost');if(u.pathname==='/'){res.setHeader('Content-Type','text/html');res.end(html);return;}const file=path.resolve(root,'.'+decodeURIComponent(u.pathname));if(!file.startsWith(path.resolve(root)+path.sep))throw Error('outside root');res.setHeader('Content-Type',mime[path.extname(file)]??'application/octet-stream');res.end(fs.readFileSync(file));}catch {if(!res.headersSent)res.writeHead(404);res.end();}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;
try {
  const {chromium}=await import(pathToFileURL(playwright).href),hardware=process.env.EGRET_BROWSER_HARDWARE==='1';
  browser=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:[...(hardware?['--enable-gpu','--use-angle=d3d11']:['--use-angle=swiftshader','--enable-unsafe-swiftshader']),'--ignore-gpu-blocklist']});
  const page=await browser.newPage({viewport:{width:320,height:240},deviceScaleFactor:1}),errors=[];
  page.on('pageerror',error=>errors.push(String(error)));
  await page.goto('http://127.0.0.1:'+server.address().port+'/');
  await page.waitForFunction(()=>window.receipt,undefined,{timeout:90000});
  const receipt=await page.evaluate(()=>window.receipt);
  console.log(JSON.stringify({hardware,receipt,errors}));
  assert.ok(receipt.ok,receipt.stack??receipt.error);assert.deepEqual(errors,[]);
  if(hardware&&backend==='webgl2')assert.ok(!/swiftshader|software/i.test(receipt.value.identity),'Hardware WebGL2 may not silently fall back');
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
