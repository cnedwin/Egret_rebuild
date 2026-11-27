// SPDX-License-Identifier: Apache-2.0
// A browser fixture for native overlay scaling and screen-tool receipts. It uses only public SDK entries;
// the page's collector is the same input that verify-screens supplies, not a fixture's invented geometry.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { controlFindings } from '../tools/verify-screens.mjs';

const [playwright] = process.argv.slice(2);
if (!playwright || !path.isAbsolute(playwright))
  throw new Error('Usage: node tests/world3d-overlay-screen-browser.mjs <absolute Playwright index.mjs>');
const root = fileURLToPath(new URL('..', import.meta.url));
const example = fs.readFileSync(path.join(root, 'examples/world3d/overlay.html'), 'utf8');
const imports = JSON.parse(example.match(/<script type="importmap">([\s\S]*?)<\/script>/)[1]);
imports.imports['@egret/engine/ui/semantics'] = '/packages/engine/dist/semantics.js';
imports.imports['@egret/engine/web/semantics'] = '/packages/engine/dist/web/semantics.js';
const html = '<!doctype html><html><meta name="viewport" content="width=device-width,initial-scale=1">' +
  '<link rel="icon" href="data:,"><style>html,body{margin:0;height:100%;overflow:hidden}#place{position:fixed;inset:0}canvas{width:100%;height:100%;display:block}</style>' +
  '<script type="importmap">' + JSON.stringify(imports) + '</script><div id="place"><canvas id="scene"></canvas></div>' +
  '<script type="module">' + String.raw`
import { Sprite } from '@egret/engine';
import { createActionControl } from '@egret/engine/ui';
import { createUiSemantics, semanticBoundsOf } from '@egret/engine/ui/semantics';
import { createBrowserSemantics } from '@egret/engine/web/semantics';
import { createWorld3DOverlay } from '@egret/engine/webgl2/world3d';
const scene = document.querySelector('#scene');
const ctx = scene.getContext('2d'); ctx.fillStyle='#334455';ctx.fillRect(0,0,scene.width,scene.height);
const overlay = await createWorld3DOverlay(scene, {
  width:1280,height:720,portrait:{width:720,height:1280},fit:'expand',uiScale:{min:0.9,max:1.25}
});
const game=overlay.game, semantics=createUiSemantics();
const projection=createBrowserSemantics({semantics,canvas:overlay.canvas,width:game.frame.width,height:game.frame.height});
let widgetCount=0, sceneCount=0;
scene.addEventListener('pointerdown',()=>sceneCount++);
function button(id,x,y,w,h,parent) {
  const face=new Sprite();face.touchEnabled=true;face.hitArea={x:0,y:0,width:w,height:h};
  // The painted shadow is deliberately larger than the real target.
  face.graphics.beginFill(0x18202a).drawRect(-3,-2,w+8,h+8).endFill();
  face.graphics.beginFill(0x55aa66).drawRect(0,0,w,h).endFill();
  face.x=x;face.y=y;game.stage.addChild(face);
  const control=createActionControl({input:game.pointer,target:face,onActivate:()=>widgetCount++});
  semantics.add({id,role:'button',...(parent?{parent}:{}),describe:()=>({name:id,bounds:semanticBoundsOf(face),hidden:!face.visible}),onActivate:()=>{control.press();control.release();}});
  return face;
}
const main=button('Actual 50px target',0,30,50,50), tiny=button('Small outside notch',0,30,20,20);
const overlap=button('Overlapping target',0,0,50,50); overlap.visible=false;
const hidden=button('Hidden target',0,0,60,60); hidden.visible=false;
const blocker=new Sprite();blocker.touchEnabled=true;blocker.visible=false;blocker.alpha=0;
game.stage.addChild(blocker);
semantics.add({id:'dialog',role:'dialog',describe:()=>({
  name:'Dialog',bounds:{x:0,y:0,width:game.screen.width,height:game.screen.height},
  modal:true,hidden:!blocker.visible
})});
const modalButton=button('Modal action',0,0,80,70,'dialog');modalButton.visible=false;
function arrange() {
  main.x=game.screen.safe.x+15;main.y=game.screen.safe.y+18;
  tiny.x=game.screen.safe.x-23;tiny.y=main.y;
  overlap.x=main.x+29;overlap.y=main.y+19;
  blocker.hitArea={x:0,y:0,width:game.screen.width,height:game.screen.height};
  modalButton.x=main.x+90;modalButton.y=main.y+90;semantics.publish();
}
arrange();
game.onScreenChange(()=>{projection.sync(game.frame);arrange();});
globalThis.witness={
  get:()=>({screen:game.screen,canvas:overlay.canvas.getBoundingClientRect().toJSON(),scene:scene.getBoundingClientRect().toJSON(),widgetCount,sceneCount}),
  overlap:()=>{overlap.visible=true;semantics.publish();},
  modal:visible=>{blocker.visible=visible;modalButton.visible=visible;semantics.publish();},
  clip:active=>{main.clipRect=active?{x:3,y:0,width:40,height:50}:undefined;semantics.publish();},
  withoutSemantics:()=>{projection.dispose();main.name='Native named target';},
  stop:()=>game.loop.stop(),
  disposeGame:()=>game.dispose(),
  dispose:async()=>{projection.dispose();semantics.dispose();await overlay.dispose();}
};
` + '</script>';
const server=http.createServer((request,response)=>{
  const url=new URL(request.url,'http://localhost');
  if(url.pathname==='/'){response.writeHead(200,{'content-type':'text/html'});response.end(html);return;}
  const file=path.join(root,decodeURIComponent(url.pathname));
  try{
    if(path.relative(root,file).startsWith('..')||!fs.statSync(file).isFile()) throw Error('not found');
    const source=fs.readFileSync(file);
    response.writeHead(200,{'content-type':file.endsWith('.js')||file.endsWith('.mjs')?'text/javascript':file.endsWith('.json')?'application/json':'application/octet-stream'});
    response.end(source);
  }catch{response.writeHead(404);response.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const { chromium }=await import(pathToFileURL(playwright).href), browser=await chromium.launch({args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const insets={top:0,right:59,bottom:21,left:59};
try{
  const page=await browser.newPage({viewport:{width:852,height:393},hasTouch:true});
  const errors=[];page.on('pageerror',cause=>errors.push(String(cause)));
  await page.addInitScript(insets=>{
    const receipt={count:0,controls:null,screen:null};globalThis.screenReceipt=receipt;
    globalThis.__egretAgent={insets,controls(controls,screen){receipt.count++;receipt.controls=controls;receipt.screen=screen;}};
  },insets);
  await page.goto('http://127.0.0.1:'+server.address().port+'/');
  await page.waitForFunction(()=>globalThis.witness!==undefined);
  let state=await page.evaluate(()=>witness.get());
  assert.equal(state.screen.scale,.9,'native overlay scale is independent of the scene');
  assert.deepEqual([state.scene.width,state.scene.height],[852,393]);
  const receipt=async previous=>{
    await page.waitForFunction(n=>screenReceipt.count>n,previous??0,{timeout:5000});
    return page.evaluate(()=>screenReceipt);
  };
  let told=await receipt(await page.evaluate(()=>screenReceipt.count));
  const target=told.controls.find(c=>c.name==='Actual 50px target');
  assert.ok(target,'native semantic projection names the reported target');
  assert.ok(Math.abs(target.width-45)<.01&&Math.abs(target.height-45)<.01,'the report uses hitArea, not painted shadow');
  assert.equal(told.controls.some(c=>c.name==='Hidden target'),false);
  const warnings=controlFindings(told.controls,told.screen.safe,true);
  assert.ok(warnings.some(x=>x.check==='inSafeArea'&&x.control==='Small outside notch'));
  assert.ok(warnings.some(x=>x.check==='touchTarget'&&x.control==='Small outside notch'));
  await page.touchscreen.tap(target.x+target.width/2,target.y+target.height/2);
  await page.touchscreen.tap(426,196);state=await page.evaluate(()=>witness.get());
  assert.equal(state.widgetCount,1);assert.equal(state.sceneCount,1);
  await page.evaluate(()=>witness.overlap());told=await receipt(told.count);
  assert.ok(controlFindings(told.controls,told.screen.safe,true).some(x=>x.check==='apart'));
  await page.evaluate(()=>witness.modal(true));told=await receipt(told.count);
  assert.deepEqual(told.controls.map(c=>c.name),['Modal action'],'transparent full-stage pointer barrier and modal state hide the covered native buttons');
  await page.evaluate(()=>{witness.modal(false);witness.clip(true);});told=await receipt(told.count);
  const clipped=told.controls.find(c=>c.name==='Actual 50px target');
  assert.ok(clipped&&Math.abs(clipped.width-36)<.01,'explicit clip reduces the true interactive area');
  await page.evaluate(()=>witness.clip(false));told=await receipt(told.count);
  await page.evaluate(()=>{__egretAgent.insets={top:59,right:0,bottom:34,left:0};witness.stop();});
  await page.setViewportSize({width:393,height:852});
  await page.waitForFunction(()=>witness.get().screen.orientation==='portrait');
  told=await receipt(await page.evaluate(()=>screenReceipt.count));state=await page.evaluate(()=>witness.get());
  assert.equal(state.screen.scale,.9);assert.deepEqual([state.scene.width,state.scene.height],[393,852]);
  assert.ok(Math.abs(told.screen.safe.y-59)<1,'safe coordinates follow the actual reflow even without overlay draws');
  await page.evaluate(()=>witness.withoutSemantics());told=await receipt(told.count);
  assert.ok(told.controls.some(c=>c.name==='Native named target'),'native named target falls back after the real projection is disposed');
  await page.evaluate(()=>{globalThis.savedControls=__egretAgent.controls;__egretAgent.controls=()=>{throw Error('tool collector failed');};});
  await page.waitForTimeout(350);
  await page.evaluate(()=>{__egretAgent.controls=savedControls;});
  told=await receipt(told.count);
  await page.evaluate(()=>witness.disposeGame());
  const direct=await page.evaluate(()=>screenReceipt.count);
  await page.waitForTimeout(350);assert.equal(await page.evaluate(()=>screenReceipt.count),direct,'disposing the underlying game also stops reporting');
  await page.evaluate(()=>witness.dispose());
  const settled=await page.evaluate(()=>screenReceipt.count);
  await page.waitForTimeout(400);assert.equal(await page.evaluate(()=>screenReceipt.count),settled);
  assert.deepEqual(errors,[]);
  console.log('native overlay screen geometry, names, picking, notch, touch size, overlap, rotation and cleanup: pass');
}finally{await browser.close();server.close();}
