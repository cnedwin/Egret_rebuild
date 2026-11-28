// SPDX-License-Identifier: Apache-2.0
// Actual browser acceptance of native World3D screen markers and pointer passthrough.
// The underlying canvas supplies the real CSS viewport; a genuine World3D camera
// and public projection place native overlay display objects. This is not a GPU timing test.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const [playwright, backendArg='webgl2'] = process.argv.slice(2);
if (!playwright || !path.isAbsolute(playwright) || !['webgl2','webgpu','both'].includes(backendArg))
  throw new Error('Usage: node tests/world3d-native-markers-browser.mjs <absolute Playwright index.mjs> [webgl2|webgpu|both]');
const root=fileURLToPath(new URL('..',import.meta.url));
const template=fs.readFileSync(path.join(root,'examples/world3d/overlay.html'),'utf8');
const imports=JSON.parse(template.match(/<script type="importmap">([\s\S]*?)<\/script>/)[1]);
const html='<!doctype html><html><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'+
  '<link rel="icon" href="data:,"><style>html,body{margin:0;height:100%;overflow:hidden}#place{position:fixed;left:13px;top:9px;right:17px;bottom:11px}canvas{width:100%;height:100%;display:block}</style>'+
  '<script type="importmap">'+JSON.stringify(imports)+'</script><div id="place"><canvas id="scene"></canvas></div>'+
  '<script type="module">'+String.raw`
import { Sprite, DisplayObjectContainer } from '@egret/engine';
import { createActionControl } from '@egret/engine/ui';
import { createPerspectiveCamera3D, Object3D, projectToViewport3D } from '@egret/engine/world3d';
import { createWorld3DOverlay, createOverlayScreenMarkers3D, createScreenMarkers3D } from '@egret/engine/webgl2/world3d';
const sceneCanvas=document.querySelector('#scene'), backend=new URLSearchParams(location.search).get('backend')??'webgl2';
const ctx=sceneCanvas.getContext('2d');ctx.fillStyle='#243653';ctx.fillRect(0,0,sceneCanvas.width,sceneCanvas.height);
const overlay=await createWorld3DOverlay(sceneCanvas,{backend,width:800,height:450,portrait:{width:400,height:800},fit:'expand',uiScale:{min:1,max:1.25}});
const game=overlay.game, originalOverlay=overlay, originalGame=game;
const camera=createPerspectiveCamera3D({fov:90,near:.1,far:100});
const box=(x,y,width,height)=>({x,y,width,height});
const paint=(x,y,w,h,color=0x55ff88)=>{
 const s=game.scope.use(new Sprite());s.graphics.beginFill(color).drawRect(x,y,w,h).endFill();
 s.touchEnabled=true;s.hitArea=box(x,y,w,h);return s;
};
let scenePresses=0,uiPresses=0;
sceneCanvas.addEventListener('pointerdown',()=>scenePresses++);
const button=paint(0,0,60,60,0xa75555);
game.stage.addChild(button);
const control=createActionControl({input:game.pointer,target:button,onActivate:()=>uiPresses++});
const layer=createOverlayScreenMarkers3D({overlay,sceneCanvas,camera});
const hero=new Object3D();hero.setPosition(0,0,-10);
const display=game.scope.use(new DisplayObjectContainer()),child=paint(-14,-7,28,14);
child.rotation=8;display.x=9;display.y=5;display.touchEnabled=true;display.addChild(child);
const center=layer.add(display,{target:hero});
const edge=layer.add(paint(-16,-9,32,18),{target:[50,0,-10],margin:{left:4,top:6,right:24,bottom:10},extent:{width:60,height:26},clampToEdge:true});
const behind=layer.add(paint(0,0,20,12),{target:[0,0,10],area:'screen',anchor:{x:.5,y:1},clampToEdge:true});
const lost=layer.add(paint(0,0,20,12),{target:[0,0,10]});
const pool=Array.from({length:44},()=>{const e=layer.add(paint(-8,-8,16,16),{target:[0,0,-10]});e.setVisible(false);return e;});
const arrange=()=>{
 const r=sceneCanvas.getBoundingClientRect();camera.aspect=r.width/r.height;camera.updateProjectionMatrix();
 layer.update();button.x=center.point.x-30;button.y=center.point.y-30;game.invalidate();
};
const off=game.onScreenChange(arrange);arrange();
const rectOf=display=>{
 const b=display.getBounds(),r=overlay.canvas.getBoundingClientRect(),s=game.screen;
 const corners=[display.localToGlobal(b.x,b.y),display.localToGlobal(b.x+b.width,b.y),
  display.localToGlobal(b.x,b.y+b.height),display.localToGlobal(b.x+b.width,b.y+b.height)];
 const xs=corners.map(p=>r.left+p.x*r.width/s.width),ys=corners.map(p=>r.top+p.y*r.height/s.height);
 return {x:Math.min(...xs),y:Math.min(...ys),width:Math.max(...xs)-Math.min(...xs),height:Math.max(...ys)-Math.min(...ys)};
};
const row=m=>({point:{...m.point},visible:m.visible,onEdge:m.onEdge,angle:m.angle,visual:rectOf(m.display)});
function read(){
 arrange();const s=game.screen,r=overlay.canvas.getBoundingClientRect(),v=sceneCanvas.getBoundingClientRect();
 const map=b=>({x:r.left+b.x*r.width/s.width,y:r.top+b.y*r.height/s.height,width:b.width*r.width/s.width,height:b.height*r.height/s.height});
 const expected=projectToViewport3D(camera,[hero.position[0],hero.position[1],hero.position[2]],v.width,v.height);
 return {same:overlay===originalOverlay&&game===originalGame,nativeCount:layer.markers.length,center:row(center),edge:row(edge),
  behind:row(behind),lost:row(lost),safe:map(s.safe),scene:{x:v.left,y:v.top,width:v.width,height:v.height},expected:{x:v.left+expected.x,y:v.top+expected.y},
  scenePresses,uiPresses,poolVisible:pool.filter(m=>m.visible).length,
  retainedTransform:display.x===9&&display.y===5&&child.touchEnabled,controls:(globalThis.markerReceipt?.controls??[]).map(c=>c.name)};
}
globalThis.markerWitness={
 read,hero(x,y,z){hero.setPosition(x,y,z);arrange();},
 pool(on){pool[0].retarget([-1,2,-10]);pool[0].setVisible(on);arrange();},
 manualDispose(){const d=pool[0].display;pool[0].dispose();return {detached:d.parent===undefined,live:!d.isDisposed,count:layer.markers.length};},
 async dispose(){off();control.dispose();await overlay.dispose();layer.update();return {count:layer.markers.length,removed:!overlay.canvas.isConnected};},
 legacy:typeof createScreenMarkers3D==='function'
};
`+'</script>';
const server=http.createServer((request,response)=>{
 const url=new URL(request.url,'http://localhost');
 if(url.pathname==='/'){response.writeHead(200,{'content-type':'text/html'});response.end(html);return;}
 const file=path.join(root,decodeURIComponent(url.pathname));
 try{
   if(path.relative(root,file).startsWith('..')||!fs.statSync(file).isFile())throw new Error('not found');
   response.writeHead(200,{'content-type':file.endsWith('.js')||file.endsWith('.mjs')?'text/javascript':file.endsWith('.json')?'application/json':'application/octet-stream'});
   response.end(fs.readFileSync(file));
 }catch{response.writeHead(404);response.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const {chromium}=await import(pathToFileURL(playwright).href);
const browser=await chromium.launch(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{});
const close=(a,b,epsilon=1)=>Math.abs(a-b)<=epsilon;
const inside=(a,b)=>a.x>=b.x-1&&a.y>=b.y-1&&a.x+a.width<=b.x+b.width+1&&a.y+a.height<=b.y+b.height+1;
const profiles=[
 {width:852,height:393,insets:{left:59,right:59,top:0,bottom:21}},
 {width:393,height:852,insets:{left:0,right:0,top:59,bottom:34}},
 {width:873,height:325,insets:{left:0,right:0,top:0,bottom:0}},
 {width:884,height:1104,insets:{left:0,right:0,top:24,bottom:20}},
];
const results=[];
try{
 for(const backend of backendArg==='both'?['webgl2','webgpu']:[backendArg]){
  const errors=[],context=await browser.newContext({viewport:{width:852,height:393},hasTouch:true});
  const page=await context.newPage();
  page.on('pageerror',error=>errors.push(String(error)));
  page.on('console',msg=>{if(msg.type()==='error')errors.push(msg.text());});
  await page.addInitScript(insets=>{
   const rec={count:0,controls:[]};window.markerReceipt=rec;
   window.__egretAgent={insets,controls(controls){rec.count++;rec.controls=controls;}};
  },profiles[0].insets);
  await page.goto('http://127.0.0.1:'+server.address().port+'/?backend='+backend);
  await page.waitForFunction(()=>!!window.markerWitness,undefined,{timeout:30000});
  const inspect=()=>page.evaluate(()=>markerWitness.read());
  for(const profile of profiles){
   await page.evaluate(insets=>{__egretAgent.insets=insets;},profile.insets);
   await page.setViewportSize({width:profile.width,height:profile.height});
   await page.waitForFunction(p=>markerWitness.read().scene.width===p.width-30&&markerWitness.read().scene.height===p.height-20,profile);
   const before=await page.evaluate(()=>markerReceipt.count);
   await page.waitForFunction(n=>markerReceipt.count>n,before,{timeout:5000});
   const state=await inspect();
   assert.ok(state.same&&state.retainedTransform&&state.nativeCount===48);
   assert.ok(state.center.visible&&close(state.center.visual.x+state.center.visual.width/2,state.expected.x));
   assert.ok(close(state.center.visual.y+state.center.visual.height/2,state.expected.y));
   assert.ok(state.edge.onEdge&&state.edge.visible&&inside(state.edge.visual,state.safe));
   assert.ok(state.behind.onEdge&&state.behind.visible&&inside(state.behind.visual,state.scene));
   assert.ok(!state.lost.visible&&state.poolVisible===0);
   assert.equal(state.controls.length,1,'interactive marker descendants are not reported as screen controls');
   // The marker at the camera centre overlays an actual native action.
   await page.touchscreen.tap(state.center.visual.x+state.center.visual.width/2,state.center.visual.y+state.center.visual.height/2);
   let next=await inspect();assert.equal(next.uiPresses,state.uiPresses+1);
   // The clamped native marker lies outside the action; its visible shape
   // must pass a real touch to the underlying scene instead of claiming it.
   await page.touchscreen.tap(next.edge.visual.x+next.edge.visual.width/2,next.edge.visual.y+next.edge.visual.height/2);
   next=await inspect();assert.equal(next.scenePresses,state.scenePresses+1);
   results.push({backend,viewport:[profile.width,profile.height],safe:state.safe,edge:state.edge.visual});
  }
  await page.evaluate(()=>markerWitness.hero(2,1,-10));
  const moved=await inspect();assert.ok(moved.center.visible&&close(moved.center.visual.x+moved.center.visual.width/2,moved.expected.x));
  await page.evaluate(()=>markerWitness.pool(true));assert.equal((await inspect()).poolVisible,1);
  await page.evaluate(()=>markerWitness.pool(false));assert.equal((await inspect()).poolVisible,0);
  assert.deepEqual(await page.evaluate(()=>markerWitness.manualDispose()),{detached:true,live:true,count:47});
  assert.equal(await page.evaluate(()=>markerWitness.legacy),true);
  assert.deepEqual(await page.evaluate(()=>markerWitness.dispose()),{count:0,removed:true});
  assert.deepEqual(errors,[]);
  await context.close();
 }
 console.log(JSON.stringify({result:'pass',profiles:results,scope:'actual browser overlay and camera; no hardware GPU timing claim'}));
}finally{await browser.close();server.close();}
