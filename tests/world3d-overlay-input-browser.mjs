// SPDX-License-Identifier: Apache-2.0
// Real browser pointer routing over a native World3D overlay. Public SDK entries only.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const [playwright,backend='webgl2']=process.argv.slice(2);
if(!playwright || !path.isAbsolute(playwright) || !['webgl2','webgpu'].includes(backend))
  throw Error('Usage: node tests/world3d-overlay-input-browser.mjs <Playwright index.mjs> [webgl2|webgpu]');
const root=fileURLToPath(new URL('..',import.meta.url));
const example=fs.readFileSync(path.join(root,'examples/world3d/overlay.html'),'utf8');
const imports=JSON.parse(example.match(/<script type="importmap">([\s\S]*?)<\/script>/)[1]);
const html='<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,"><style>html,body{margin:0;overflow:hidden}#place{position:fixed;inset:0}canvas{display:block;width:100%;height:100%}</style><script type="importmap">'+JSON.stringify(imports)+'</script><div id="place"><canvas id="scene"></canvas></div><script type="module">'+String.raw`
import { Sprite } from '@egret/engine';
import { createMovementControl, createActionControl } from '@egret/engine/ui';
import { createWorld3DOverlay } from '@egret/engine/webgl2/world3d';
const scene=document.querySelector('#scene');scene.getContext('2d').fillRect(0,0,100,100);
const source=[],forwarded=[],locked=[],sceneTouches=[];let capture=false,captured=false,armLock=false;
scene.addEventListener('click',()=>{if(armLock){armLock=false;void scene.requestPointerLock();}});
scene.addEventListener('pointermove',e=>{if(document.pointerLockElement===scene&&e.isTrusted)locked.push({dx:e.movementX,dy:e.movementY,buttons:e.buttons});if(e.pointerType==='touch')sceneTouches.push(e.pointerId)});
window.addEventListener('pointermove',e=>{
  if(e.target.className==='egret-world3d-overlay'&&e.buttons)
    source.push({x:e.clientX,y:e.clientY,dx:e.movementX,dy:e.movementY,buttons:e.buttons,trusted:e.isTrusted});
},true);
scene.addEventListener('pointerdown',e=>{if(capture){scene.setPointerCapture(e.pointerId);captured=scene.hasPointerCapture(e.pointerId);}});
scene.addEventListener('pointermove',e=>{
  if(e.buttons)forwarded.push({x:e.clientX,y:e.clientY,dx:e.movementX,dy:e.movementY,buttons:e.buttons,trusted:e.isTrusted});
});
const overlay=await createWorld3DOverlay(scene,{width:640,height:360,fit:'expand',backend:new URLSearchParams(location.search).get('backend'),hover:true});
const button=new Sprite();button.graphics.beginFill(0x44aa44).drawRect(0,0,100,80).endFill();button.hitArea={x:0,y:0,width:100,height:80};button.touchEnabled=true;overlay.game.stage.addChild(button);
const control=(x,y,w,h)=>{const s=new Sprite();s.graphics.beginFill(0x3377aa).drawRect(0,0,w,h).endFill();s.x=x;s.y=y;s.hitArea={x:0,y:0,width:w,height:h};s.touchEnabled=true;overlay.game.stage.addChild(s);return s};
const stick=control(20,190,100,100),actionFace=control(520,260,70,70);
const movement=createMovementControl({input:overlay.game.pointer,target:stick,radius:50,deadZone:0,center:{x:50,y:50}});
const action=createActionControl({input:overlay.game.pointer,target:actionFace,activation:'tap',tapTolerance:12});
const hovers=()=>overlay.game.hover?.hovers.map(h=>h.target===button)??null;
window.fixture={source,forwarded,locked,sceneTouches,hovers,backend:overlay.game.backend,enabled:!!overlay.game.hover,setCapture:on=>capture=on,captured:()=>captured,armLock:()=>armLock=true,lockState:()=>document.pointerLockElement===scene,unlock:()=>document.exitPointerLock(),controls:()=>({active:movement.active,value:movement.value,pressed:action.pressed,activations:action.activationCount,sceneTouches:sceneTouches.length}),dispose:()=>overlay.dispose(),point:()=>{const b=overlay.canvas.getBoundingClientRect();return {x:b.left+35*b.width/overlay.game.screen.width,y:b.top+35*b.height/overlay.game.screen.height}}};
`+'</script>';
const mime={'.mjs':'text/javascript','.js':'text/javascript','.json':'application/json','.html':'text/html'};
const server=http.createServer((req,res)=>{
  try{const u=new URL(req.url,'http://localhost');if(u.pathname==='/'){res.writeHead(200,{'Content-Type':'text/html'});res.end(html);return;}const file=path.resolve(root,'.'+decodeURIComponent(u.pathname));if(!file.startsWith(path.resolve(root)+path.sep))throw Error('outside root');const data=fs.readFileSync(file);res.writeHead(200,{'Content-Type':mime[path.extname(file)]??'application/octet-stream'});res.end(data);}
  catch{if(!res.headersSent)res.writeHead(404);res.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const {chromium}=await import(pathToFileURL(playwright).href);
const hardware=process.env.EGRET_BROWSER_HARDWARE==='1';
const browser=await chromium.launch({args:[...(hardware?['--enable-gpu','--use-angle=d3d11']:['--use-angle=swiftshader','--enable-unsafe-swiftshader']),'--ignore-gpu-blocklist','--enable-unsafe-webgpu']});
try{
  const context=await browser.newContext({viewport:{width:640,height:360},hasTouch:true});
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>{errors.push(String(e));console.error(e)});page.on('response',r=>{if(r.status()>=400)console.error(r.status(),r.url())});
  await page.goto('http://127.0.0.1:'+server.address().port+'/?backend='+backend);
  await page.waitForFunction(()=>window.fixture,undefined,{timeout:30000});
  await page.mouse.move(350,200);await page.mouse.down();await page.mouse.move(380,215);await page.mouse.up();
  const motion=await page.evaluate(()=>({source:fixture.source,forwarded:fixture.forwarded,enabled:fixture.enabled}));
  await page.evaluate(()=>fixture.setCapture(true));
  await page.mouse.move(350,200);await page.mouse.down();await page.mouse.move(370,220);await page.mouse.up();
  const captured=await page.evaluate(()=>{fixture.setCapture(false);return {captured:fixture.captured(),sceneMoves:fixture.forwarded.length}});
  const point=await page.evaluate(()=>fixture.point());await page.mouse.move(point.x,point.y);
  await page.mouse.down();await page.mouse.move(point.x+10,point.y+10);await page.mouse.up();
  const afterUiDrag=await page.evaluate(()=>fixture.forwarded.length);
  await page.mouse.move(point.x,point.y);
  const entered=await page.evaluate(()=>fixture.hovers());await page.mouse.move(300,200);
  const exited=await page.evaluate(()=>fixture.hovers());
  await page.evaluate(()=>fixture.armLock());await page.mouse.click(300,150);
  await page.waitForFunction(()=>fixture.lockState(),undefined,{timeout:8000});
  await page.mouse.down({button:'left'});await page.mouse.down({button:'right'});
  await page.mouse.move(320,170);await page.mouse.up({button:'right'});await page.mouse.up({button:'left'});
  const lockedMotion=await page.evaluate(()=>fixture.locked.slice());
  await page.evaluate(()=>fixture.unlock());await page.waitForFunction(()=>!fixture.lockState());
  const cdp=await context.newCDPSession(page);
  const touch=(type,touchPoints)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints});
  const fingers=[{id:11,x:60,y:240},{id:12,x:350,y:180},{id:13,x:550,y:285}];
  await touch('touchStart',[fingers[0]]);await touch('touchStart',fingers.slice(0,2));await touch('touchStart',fingers);
  const held=await page.evaluate(()=>fixture.controls());
  await touch('touchMove',[{id:11,x:210,y:180},{id:12,x:400,y:190},fingers[2]]);
  const dragged=await page.evaluate(()=>fixture.controls());await touch('touchCancel',[]);
  const canceled=await page.evaluate(()=>fixture.controls());await cdp.detach();
  await page.touchscreen.tap(550,285);const tapped=await page.evaluate(()=>fixture.controls());
  await page.setViewportSize({width:360,height:640});await page.waitForTimeout(100);
  const rotated=await page.evaluate(()=>fixture.point());await page.mouse.move(rotated.x,rotated.y);
  const rotatedEntered=await page.evaluate(()=>fixture.hovers());
  await page.touchscreen.tap(250,400);
  const touchHover=await page.evaluate(()=>fixture.hovers());
  const result={backend,actualBackend:await page.evaluate(()=>fixture.backend),hardware,motion,captured,afterUiDrag,entered,exited,lockedMotion,held,dragged,canceled,tapped,rotatedEntered,touchHover,errors};
  console.log(JSON.stringify(result,null,2));
  assert.ok(motion.source.some(e=>e.dx!==0||e.dy!==0),'actual trusted source movement');
  assert.deepEqual(motion.forwarded.map(({x,y,dx,dy,buttons})=>({x,y,dx,dy,buttons})),motion.source.map(({x,y,dx,dy,buttons})=>({x,y,dx,dy,buttons})));
  assert.ok(motion.source.every(e=>e.trusted)&&motion.forwarded.every(e=>!e.trusted),'forwarding is a DOM copy, not forged trust');
  assert.equal(result.actualBackend,backend);
  assert.ok(captured.captured,'scene obtained real native capture');
  assert.equal(afterUiDrag,captured.sceneMoves,'released scene capture cannot steal next UI drag');
  assert.equal(motion.enabled,true,'native hover forwarded option');assert.deepEqual(entered,[true]);
  assert.ok(!exited.includes(true),'empty space leaves old native hover');
  assert.ok(lockedMotion.some(e=>e.buttons===3&&(e.dx||e.dy)),'locked raw movement and button chord');
  assert.ok(held.active&&held.pressed&&dragged.active&&dragged.pressed&&dragged.sceneTouches>held.sceneTouches,'three simultaneous touches retain independent native ownership');
  assert.ok(!canceled.active&&!canceled.pressed&&canceled.activations===0&&!canceled.value.x&&!canceled.value.y,'cancel releases all without activation');
  assert.equal(tapped.activations,1,'native tap activates after cancellation');
  assert.deepEqual(rotatedEntered,[true]);assert.ok(!touchHover?.includes(false),'touch did not create a hover for an empty spot');
  assert.deepEqual(errors,[]);await page.evaluate(()=>fixture.dispose());await context.close();
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
