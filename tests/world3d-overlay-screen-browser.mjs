// SPDX-License-Identifier: Apache-2.0
// A browser fixture for native overlay scaling and screen-tool receipts. It uses only public SDK entries;
// the page's collector is the same input that verify-screens supplies, not a fixture's invented geometry.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { controlFindings, SCREENS } from '../tools/verify-screens.mjs';

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
import { createActionControl, createMovementControl, createRangeControl, createScrollControl, createSelectionGroup } from '@egret/engine/ui';
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
const actions=new WeakMap(), folded=new URLSearchParams(location.search).has('folded');
scene.addEventListener('pointerdown',()=>sceneCount++);
function button(id,x,y,w,h,parent) {
  const face=new Sprite();face.touchEnabled=true;face.hitArea={x:0,y:0,width:w,height:h};
  // The painted shadow is deliberately larger than the real target.
  face.graphics.beginFill(0x18202a).drawRect(-3,-2,w+8,h+8).endFill();
  face.graphics.beginFill(0x55aa66).drawRect(0,0,w,h).endFill();
  face.x=x;face.y=y;game.stage.addChild(face);
  const control=createActionControl({input:game.pointer,target:face,onActivate:()=>widgetCount++});
  actions.set(face,control);
  semantics.add({id,role:'button',...(parent?{parent}:{}),describe:()=>({name:id,bounds:semanticBoundsOf(face),hidden:!face.visible}),onActivate:()=>{control.press();control.release();}});
  return face;
}
const main=button('Actual 50px target',0,30,50,50), tiny=button('Small outside notch',0,30,20,20);
tiny.visible=!folded;
const overlap=button('Overlapping target',0,0,50,50); overlap.visible=false;
const hidden=button('Hidden target',0,0,60,60); hidden.visible=false;
const blocker=new Sprite();blocker.touchEnabled=true;blocker.visible=false;blocker.alpha=0;
game.stage.addChild(blocker);
semantics.add({id:'dialog',role:'dialog',describe:()=>({
  name:'Dialog',bounds:{x:0,y:0,width:game.screen.width,height:game.screen.height},
  modal:true,hidden:!blocker.visible
})});
const modalButton=button('Modal action',0,0,80,70,'dialog');modalButton.visible=false;
// Additional folded-cover controls reproduce the game path: actual SDK range/action registrations,
// including a touch-only range whose semantic node has no activation/focus action, plus unnamed controls.
let fold;
if(folded){
  function nativeFace(w,h){
    const face=new Sprite();face.touchEnabled=true;face.hitArea={x:0,y:0,width:w,height:h};
    // A small painted mark does not reduce the real (often transparent) hit target.
    face.graphics.beginFill(0x77aacc).drawRect(4,4,w-8,8).endFill();
    game.stage.addChild(face);return face;
  }
  const compact=button('Compact 42.3px button',0,0,47,47),outside=button('Full-size outside safe',0,0,50,50);
  const steering=nativeFace(120,50),anonymousAction=nativeFace(47,55),anonymousRange=nativeFace(90,47);
  let anonymousActivations=0;
  const steerControl=createRangeControl({input:game.pointer,target:steering,length:120,min:0,max:100,step:1,value:0});
  // The steering slider is touchable even when the speech node does not offer a separate keyboard action.
  semantics.add({id:'fold-steering',role:'slider',describe:()=>({name:'Range-only steering',range:{min:0,max:100,now:steerControl.value},bounds:semanticBoundsOf(steering)})});
  createActionControl({input:game.pointer,target:anonymousAction,onActivate:()=>anonymousActivations++});
  const anonymousRangeControl=createRangeControl({input:game.pointer,target:anonymousRange,length:90,min:0,max:100,step:1,value:0});
  const disabledNamed=button('Disabled native action',0,0,62,52),disabledAnonymous=nativeFace(66,54);
  const disabledAnonControl=createActionControl({input:game.pointer,target:disabledAnonymous,onActivate:()=>anonymousActivations++});
  const movement=nativeFace(52,52),choiceA=nativeFace(58,50),choiceB=nativeFace(59,51),panel=nativeFace(40,40);
  createMovementControl({input:game.pointer,target:movement,radius:24});
  choiceA.name='Native choice A';choiceB.name='Native choice B';
  const choices=createSelectionGroup({input:game.pointer,items:[{key:'a',target:choiceA},{key:'b',target:choiceB,enabled:false}]});
  const scrollThumb=nativeFace(57,58),readOnlyCell=nativeFace(46,37),nativeCell=nativeFace(56,53);
  const scroll=createScrollControl({axis:'x',viewportLength:100,contentLength:300,thumb:{input:game.pointer,target:scrollThumb,trackLength:180,minimumLength:50}});
  let cellActivations=0;
  createActionControl({input:game.pointer,target:nativeCell,onActivate:()=>cellActivations++});
  const containerBounds=()=>({bounds:{x:0,y:0,width:game.screen.width,height:game.screen.height}});
  semantics.add({id:'fold-grid',role:'grid',describe:containerBounds});
  semantics.add({id:'fold-row',parent:'fold-grid',role:'row',describe:containerBounds});
  semantics.add({id:'fold-cell-read',parent:'fold-row',role:'gridcell',describe:()=>({name:'Read-only grid cell',bounds:semanticBoundsOf(readOnlyCell)})});
  semantics.add({id:'fold-cell-action',parent:'fold-row',role:'gridcell',describe:()=>({name:'Interactive grid cell',bounds:semanticBoundsOf(nativeCell)})});
  const setDisabledEnabled=enabled=>{actions.get(disabledNamed).setEnabled(enabled);disabledAnonControl.setEnabled(enabled);};
  setDisabledEnabled(false);
  fold={compact,outside,steering,anonymousAction,anonymousRange,disabledNamed,disabledAnonymous,setDisabledEnabled,
    movement,choiceA,choiceB,panel,setSelectionEnabled:enabled=>choices.setEnabled(enabled),
    scrollThumb,readOnlyCell,nativeCell,setScrollEnabled:enabled=>scroll.setEnabled(enabled),
    values:()=>({steering:steerControl.value,anonymousRange:anonymousRangeControl.value,anonymousActivations,choice:choices.selected,scroll:scroll.offset,cellActivations})};
}
function arrange() {
  main.x=game.screen.safe.x+15;main.y=game.screen.safe.y+18;
  tiny.x=game.screen.safe.x-23;tiny.y=main.y;
  overlap.x=main.x+29;overlap.y=main.y+19;
  blocker.hitArea={x:0,y:0,width:game.screen.width,height:game.screen.height};
  modalButton.x=main.x+90;modalButton.y=main.y+90;
  if(fold){
    const at=(face,x,y)=>{face.x=main.x+x;face.y=main.y+y;};
    at(fold.compact,80,0);at(fold.outside,-27,82);at(fold.steering,50,82);
    at(fold.anonymousAction,150,0);at(fold.anonymousRange,230,0);
    at(fold.disabledNamed,190,82);at(fold.disabledAnonymous,265,82);
    at(fold.movement,0,160);at(fold.choiceA,80,160);at(fold.choiceB,160,160);at(fold.panel,245,160);
    at(fold.scrollThumb,0,235);at(fold.readOnlyCell,80,235);at(fold.nativeCell,160,235);
  }
  semantics.publish();
}
arrange();
game.onScreenChange(()=>{projection.sync(game.frame);arrange();});
globalThis.witness={
  get:()=>({screen:game.screen,canvas:overlay.canvas.getBoundingClientRect().toJSON(),scene:scene.getBoundingClientRect().toJSON(),widgetCount,sceneCount,
    dpr:devicePixelRatio,...(fold?{fold:fold.values()}:{}),sameOverlay:game===overlay.game&&overlay.canvas===document.querySelector('.egret-world3d-overlay')}),
  overlap:()=>{overlap.visible=true;semantics.publish();},
  modal:visible=>{blocker.visible=visible;modalButton.visible=visible;semantics.publish();},
  clip:active=>{main.clipRect=active?{x:3,y:0,width:40,height:50}:undefined;semantics.publish();},
  enableFoldDisabled:enabled=>{fold.setDisabledEnabled(enabled);semantics.publish();},
  enableFoldSelection:enabled=>{fold.setSelectionEnabled(enabled);semantics.publish();},
  enableFoldScroll:enabled=>{fold.setScrollEnabled(enabled);semantics.publish();},
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
  await page.evaluate(()=>witness.overlap());told=await receipt(await page.evaluate(()=>screenReceipt.count));
  assert.ok(controlFindings(told.controls,told.screen.safe,true).some(x=>x.check==='apart'));
  await page.evaluate(()=>witness.modal(true));told=await receipt(await page.evaluate(()=>screenReceipt.count));
  assert.deepEqual(told.controls.map(c=>c.name),['Modal action'],'transparent full-stage pointer barrier and modal state hide the covered native buttons');
  await page.evaluate(()=>{witness.modal(false);witness.clip(true);});told=await receipt(await page.evaluate(()=>screenReceipt.count));
  const clipped=told.controls.find(c=>c.name==='Actual 50px target');
  assert.ok(clipped&&Math.abs(clipped.width-36)<.01,'explicit clip reduces the true interactive area');
  await page.evaluate(()=>witness.clip(false));told=await receipt(await page.evaluate(()=>screenReceipt.count));
  await page.evaluate(()=>{__egretAgent.insets={top:59,right:0,bottom:34,left:0};witness.stop();});
  await page.setViewportSize({width:393,height:852});
  await page.waitForFunction(()=>witness.get().screen.orientation==='portrait');
  told=await receipt(await page.evaluate(()=>screenReceipt.count));state=await page.evaluate(()=>witness.get());
  assert.equal(state.screen.scale,.9);assert.deepEqual([state.scene.width,state.scene.height],[393,852]);
  assert.ok(Math.abs(told.screen.safe.y-59)<1,'safe coordinates follow the actual reflow even without overlay draws');
  await page.evaluate(()=>witness.withoutSemantics());told=await receipt(await page.evaluate(()=>screenReceipt.count));
  assert.ok(told.controls.some(c=>c.name==='Native named target'),'native named target falls back after the real projection is disposed');
  await page.evaluate(()=>{globalThis.savedControls=__egretAgent.controls;__egretAgent.controls=()=>{throw Error('tool collector failed');};});
  await page.waitForTimeout(350);
  await page.evaluate(()=>{__egretAgent.controls=savedControls;});
  told=await receipt(await page.evaluate(()=>screenReceipt.count));
  await page.evaluate(()=>witness.disposeGame());
  const direct=await page.evaluate(()=>screenReceipt.count);
  await page.waitForTimeout(350);assert.equal(await page.evaluate(()=>screenReceipt.count),direct,'disposing the underlying game also stops reporting');
  await page.evaluate(()=>witness.dispose());
  const settled=await page.evaluate(()=>screenReceipt.count);
  await page.waitForTimeout(400);assert.equal(await page.evaluate(()=>screenReceipt.count),settled);
  assert.deepEqual(errors,[]);
  await page.close();

  // The real folded-cover profile is distinct from the old portrait/landscape tests. DPR and touch are from
  // the registered verifier profile; the native receipt is emitted by the overlay itself, not authored by this test.
  const profile=SCREENS['foldable-cover-wide'];
  assert.ok(profile,'the Fold7 cover landscape is a verifier profile');
  const foldPage=await browser.newPage({viewport:{width:profile.width,height:profile.height},
    hasTouch:profile.touch,isMobile:profile.touch,deviceScaleFactor:profile.scale});
  foldPage.on('pageerror',cause=>errors.push(String(cause)));
  await foldPage.addInitScript(insets=>{
    const receipt={count:0,controls:null,screen:null};globalThis.screenReceipt=receipt;
    globalThis.__egretAgent={insets,controls(controls,screen){receipt.count++;receipt.controls=controls;receipt.screen=screen;}};
  },profile.insets);
  await foldPage.goto('http://127.0.0.1:'+server.address().port+'/?folded=1');
  await foldPage.waitForFunction(()=>globalThis.witness!==undefined);
  const foldReceipt=async previous=>{
    await foldPage.waitForFunction(n=>screenReceipt.count>n,previous??0,{timeout:5000});
    return foldPage.evaluate(()=>screenReceipt);
  };
  const close=(a,b,tolerance=.05)=>Math.abs(a-b)<tolerance;
  const sized=(controls,w,h)=>controls.find(c=>close(c.width,w)&&close(c.height,h));
  function checkFold(receipt,width,height){
    const controls=receipt.controls, safe=receipt.screen.safe;
    assert.ok(close(safe.width,width,1)&&close(safe.height,height,1),'native safe rectangle follows the viewport');
    const main=controls.find(c=>c.name==='Actual 50px target'),compact=controls.find(c=>c.name==='Compact 42.3px button'),outside=controls.find(c=>c.name==='Full-size outside safe');
    const steering=controls.find(c=>c.name==='Range-only steering'),anonAction=sized(controls,42.3,49.5),anonRange=sized(controls,81,42.3);
    assert.ok(main&&close(main.width,45)&&close(main.height,45),'compliant native target');
    assert.ok(compact&&close(compact.width,42.3)&&close(compact.height,42.3),'actual compact control below 44 CSS px');
    assert.ok(outside&&close(outside.width,45)&&close(outside.height,45),'separate full-size target outside safe area');
    assert.ok(steering&&close(steering.width,108)&&close(steering.height,45),'touch-only range semantics names the native hit rectangle, not its small painted mark');
    assert.equal(anonAction?.name,'action control','unnamed native action reports even beside semantic controls');
    assert.equal(anonRange?.name,'range control','unnamed native range reports even beside semantic controls');
    assert.equal(sized(controls,46.8,46.8)?.name,'movement control','unnamed native movement reports');
    const scroll=sized(controls,51.3,52.2),cell=sized(controls,50.4,47.7);
    assert.equal(scroll?.name,'scroll control','unnamed pointer scroll thumb reports');
    assert.equal(cell?.name,'Interactive grid cell','structural role without action names a registered native target');
    assert.ok(!controls.some(c=>c.name==='Read-only grid cell'),'read-only structural role is not an actionable native target');
    assert.ok(controls.some(c=>c.name==='Native choice A'),'enabled native selection item reports');
    assert.ok(!controls.some(c=>['Native choice B','Disabled native action'].includes(c.name)),'disabled native controls and selection items do not report');
    assert.ok(!sized(controls,59.4,48.6),'disabled unnamed action does not report');
    assert.ok(!sized(controls,36,36),'anonymous pointer-only panel is not a registered control');
    const findings=controlFindings(controls,safe,true);
    assert.deepEqual(findings.map(x=>[x.check,x.control]).sort(),[
      ['inSafeArea','Full-size outside safe'],['touchTarget','Compact 42.3px button'],
      ['touchTarget','action control'],['touchTarget','range control']
    ].sort(),'real native geometry supplies the expected independent safe-area and touch-size findings, without false overlap');
    return {steering,anonAction,anonRange,scroll,cell,choice:controls.find(c=>c.name==='Native choice A')};
  }
  let foldTold=await foldReceipt(await foldPage.evaluate(()=>screenReceipt.count));
  let foldState=await foldPage.evaluate(()=>witness.get());
  assert.deepEqual([foldState.scene.width,foldState.scene.height],[profile.width,profile.height]);
  assert.ok(close(foldState.dpr,profile.scale)&&close(foldState.screen.scale,.9)&&foldState.sameOverlay);
  const native=checkFold(foldTold,profile.width,profile.height);
  const tap=async (c,share=.5)=>foldPage.touchscreen.tap(c.x+c.width*share,c.y+c.height/2);
  await tap(native.steering,.8);await tap(native.anonRange,.8);await tap(native.anonAction);await tap(native.choice);await tap(native.cell);
  // The pointer thumb is tested with real touch motion rather than changing its offset through the API.
  const touch=await foldPage.context().newCDPSession(foldPage),sx=native.scroll.x+native.scroll.width/2,sy=native.scroll.y+native.scroll.height/2;
  try{
    await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:sx,y:sy,id:0}]});
    for(let i=1;i<=4;i++)await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:sx+i*6,y:sy,id:0}]});
    await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  }finally{await touch.detach();}
  foldState=await foldPage.evaluate(()=>witness.get());
  assert.ok(foldState.fold.steering>60&&foldState.fold.anonymousRange>60,'both actual range targets receive touch');
  assert.equal(foldState.fold.anonymousActivations,1,'unnamed native action receives touch');
  assert.equal(foldState.fold.choice,'a','enabled native selection item receives touch');
  assert.equal(foldState.fold.cellActivations,1,'registered structural cell receives touch');
  assert.ok(foldState.fold.scroll>0,'the reported scroll thumb receives a real touch drag');
  await foldPage.evaluate(()=>witness.enableFoldDisabled(true));foldTold=await foldReceipt(await foldPage.evaluate(()=>screenReceipt.count));
  assert.ok(foldTold.controls.some(c=>c.name==='Disabled native action')&&sized(foldTold.controls,59.4,48.6),'native enabled state updates both named and unnamed reports');
  await foldPage.evaluate(()=>{witness.enableFoldDisabled(false);witness.enableFoldSelection(false);witness.enableFoldScroll(false);});foldTold=await foldReceipt(await foldPage.evaluate(()=>screenReceipt.count));
  assert.ok(!foldTold.controls.some(c=>['Disabled native action','Native choice A','Native choice B'].includes(c.name))&&!sized(foldTold.controls,59.4,48.6),'disabled action and selection-group states update native report');
  assert.ok(!sized(foldTold.controls,51.3,52.2),'disabled scroll thumb does not report');
  await foldPage.evaluate(()=>{witness.enableFoldSelection(true);witness.enableFoldScroll(true);witness.stop();});
  // Receipts keep following the same overlay after a real viewport resize, even without frame submissions.
  for(const [width,height] of [[profile.height,profile.width],[profile.width,profile.height]]){
    await foldPage.setViewportSize({width,height});
    await foldPage.waitForFunction(({width,height})=>witness.get().screen.orientation===(width>height?'landscape':'portrait'),{width,height});
    foldTold=await foldReceipt(await foldPage.evaluate(()=>screenReceipt.count));
    foldState=await foldPage.evaluate(()=>witness.get());
    assert.ok(foldState.sameOverlay&&close(foldState.dpr,profile.scale));
    assert.deepEqual([foldState.scene.width,foldState.scene.height],[width,height]);
    checkFold(foldTold,width,height);
  }
  await foldPage.evaluate(()=>witness.dispose());
  const foldSettled=await foldPage.evaluate(()=>screenReceipt.count);
  await foldPage.waitForTimeout(400);assert.equal(await foldPage.evaluate(()=>screenReceipt.count),foldSettled);
  assert.deepEqual(errors,[]);
  console.log('native overlay screen geometry, names, picking, notch, touch size, overlap, rotation and cleanup: pass; actual folded-cover profile and native registration controls: pass');
}finally{await browser.close();server.close();}
