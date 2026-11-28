// SPDX-License-Identifier: Apache-2.0
// Public Play input ownership; controlled Pointer Lock host events, real embedded keyboard events.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { once } from 'node:events';
import { pathToFileURL } from 'node:url';
import { createExampleServer } from '../../tools/serve-example.mjs';

const [playwrightFile, output, executablePath] = process.argv.slice(2);
if (![playwrightFile, output, executablePath].every(file => file && path.isAbsolute(file))) {
  throw new Error('Usage: node examples/play/verify-input-ownership.mjs <absolute Playwright index.mjs> <new output directory> <absolute Chromium executable>');
}
const { chromium } = await import(pathToFileURL(playwrightFile).href);
const imports = JSON.parse(fs.readFileSync(new URL('index.html', import.meta.url),'utf8').match(/<script type="importmap">([\s\S]*?)<\/script>/u)[1]).imports;
const html = '<!doctype html><meta charset="utf-8"><link rel="icon" href="data:,"><script type="importmap">'+JSON.stringify({imports})+'</script><body><div id="holder" style="width:400px;height:220px"></div><button id="outside">Outside</button></body>';
fs.mkdirSync(output);
const report={runner:'play-input-ownership',controlledLockHost:true,cases:[]};
const server=createExampleServer();
let browser;
try {
  server.listen(0,'127.0.0.1'); await once(server,'listening');
  const origin='http://127.0.0.1:'+server.address().port;
  browser=await chromium.launch({executablePath,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-proxy-server']});
  report.browser=browser.version();
  const page=await browser.newPage({viewport:{width:680,height:420}});
  const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.route('**/play-input-fixture.html',r=>r.fulfill({contentType:'text/html',body:html}));
  await page.goto(origin+'/play-input-fixture.html');
  await page.evaluate(async()=>{
    const {play}=await import('@egret/engine/play');
    let active=false;const edges=[];
    const g=await play({parent:document.querySelector('#holder'),width:400,height:220,backend:'webgl2',audio:false,
      update(){if(g?.keys.pressed('Tab'))edges.push('Tab');}});
    window.fixture={g,edges,setActive:v=>active=v,when:()=>active};
  });
  // This case is deliberately independent of the shortcut feature so older builds fail for their own missing contract.
  try {
    const result=await page.evaluate(async()=>{
      const {g}=window.fixture;
      let locked=null,requested,resolveNative,rejectNative,exits=0,legacy=false;
      Object.defineProperty(document,'pointerLockElement',{configurable:true,get:()=>locked});
      document.exitPointerLock=()=>{exits++;locked=null;document.dispatchEvent(new Event('pointerlockchange'));};
      g.canvas.requestPointerLock=options=>{
        requested=options;
        if(legacy)return undefined;
        return new Promise((resolve,reject)=>{resolveNative=resolve;rejectNative=reject;});
      };
      const grant=()=>{locked=g.canvas;document.dispatchEvent(new Event('pointerlockchange'));resolveNative?.();};
      const denied=()=>rejectNative(new Error('controlled refusal'));
      const result={};
      const lock=g.pointer.lock({unadjustedMovement:true});
      if(typeof lock?.then!=='function')return {missing:'lock result'};
      result.pending=g.pointer.lockPending;result.options=requested;
      grant();result.acquired=(await lock).status;result.locked=g.pointer.locked;
      const mask=(type,buttons)=>window.dispatchEvent(new MouseEvent(type,{buttons}));
      mask('mousedown',1);mask('mousedown',3);
      result.chord=[g.pointer.buttons,g.pointer.pressedButtons,g.pointer.releasedButtons];
      mask('mouseup',2);result.release=[g.pointer.buttons,g.pointer.releasedButtons];
      window.dispatchEvent(new PointerEvent('pointermove',{pointerType:'mouse',pointerId:5,buttons:2,movementX:7,movementY:-3}));
      result.relative=[g.pointer.dx,g.pointer.dy];
      g.pointer.unlock();result.cleared=[g.pointer.buttons,g.pointer.pressedButtons,g.pointer.releasedButtons,g.pointer.locked];
      const controller=new AbortController();
      const canceled=g.pointer.lock({signal:controller.signal});controller.abort();result.canceled=(await canceled).status;
      result.canceledPending=g.pointer.lockPending;grant();result.lateUnlocked=!g.pointer.locked;
      const rejected=g.pointer.lock();denied();result.denied=(await rejected).status;
      legacy=true;const old=g.pointer.lock();grant();result.legacy=(await old).status;g.pointer.unlock();
      legacy=false;
      const canceledByUnlock=g.pointer.lock();g.pointer.unlock();result.unlockCanceled=(await canceledByUnlock).status;
      result.unlockPending=g.pointer.lockPending;grant();result.unlockLateReleased=!g.pointer.locked;
      const requestLock=g.canvas.requestPointerLock;g.canvas.requestPointerLock=undefined;
      result.unavailable=(await g.pointer.lock()).status;g.canvas.requestPointerLock=requestLock;
      result.exits=exits;
      delete document.pointerLockElement;delete document.exitPointerLock;delete g.canvas.requestPointerLock;
      return result;
    });
    assert(!result.missing,result.missing);
    assert.equal(result.pending,true);assert.deepEqual(result.options,{unadjustedMovement:true});
    assert.equal(result.acquired,'locked');assert.equal(result.locked,true);
    assert.deepEqual(result.chord,[3,3,0]);assert.deepEqual(result.release,[2,1]);
    assert.deepEqual(result.relative,[7,-3]);assert.deepEqual(result.cleared,[0,0,0,false]);
    assert.equal(result.canceled,'canceled');assert.equal(result.canceledPending,false);assert.equal(result.lateUnlocked,true);
    assert.equal(result.denied,'denied');assert.equal(result.legacy,'locked');
    assert.equal(result.unlockCanceled,'canceled');assert.equal(result.unlockPending,false);assert.equal(result.unlockLateReleased,true);
    assert.equal(result.unavailable,'unavailable');
    report.cases.push({id:'lock-and-chord',passed:true,result});
  } catch(error){report.cases.push({id:'lock-and-chord',passed:false,error:String(error)});}
  try {
    const available=await page.evaluate(()=>{
      const f=window.fixture;
      if(typeof f.g.keys.claim!=='function')return false;
      f.release=f.g.keys.claim('Tab',f.when);
      f.setActive(true);f.g.canvas.focus();
      return true;
    });
    assert(available,'native scoped shortcut API');
    await page.keyboard.press('Tab');
    await page.waitForFunction(()=>window.fixture.edges.length===1);
    assert.equal(await page.evaluate(()=>document.activeElement===window.fixture.g.canvas),true);
    await page.evaluate(()=>{
      const f=window.fixture;
      f.view=f.g.show({modal:true,root:{type:'panel',width:240,height:120,layout:'column',children:[{type:'button',name:'first',text:'First',height:40},{type:'button',name:'second',text:'Second',height:40}]}},{initialFocus:'first',bind:{first:{tap:()=>{}},second:{tap:()=>{}}}});
      f.g.canvas.focus();
    });
    await page.keyboard.press('Tab');
    await page.waitForFunction(()=>window.fixture.view.focused==='second');
    assert.equal(await page.evaluate(()=>window.fixture.edges.length),1,'modal keeps Tab');
    await page.evaluate(()=>{const f=window.fixture;f.view.close();f.setActive(false);f.g.canvas.focus();});
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(()=>document.activeElement?.id),'outside');
    const after=await page.evaluate(()=>{const f=window.fixture;f.release();f.setActive(true);f.g.canvas.focus();return f.edges.length;});
    await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement?.id),'outside');
    assert.equal(after,1);
    report.cases.push({id:'scoped-tab',passed:true});
  }catch(error){report.cases.push({id:'scoped-tab',passed:false,error:String(error)});}
  try {
    const result=await page.evaluate(async()=>{
      const {g}=window.fixture;let locked=null,exits=0;
      Object.defineProperty(document,'pointerLockElement',{configurable:true,get:()=>locked});
      document.exitPointerLock=()=>{exits++;locked=null;document.dispatchEvent(new Event('pointerlockchange'));};
      g.canvas.requestPointerLock=()=>undefined; // legacy host reports only a later event
      const request=g.pointer.lock();
      await g.dispose();
      const status=(await request).status,pending=g.pointer.lockPending;
      locked=g.canvas;document.dispatchEvent(new Event('pointerlockchange'));
      const lateUnlocked=!g.pointer.locked;
      delete document.pointerLockElement;delete document.exitPointerLock;delete g.canvas.requestPointerLock;
      return {status,pending,lateUnlocked,exits};
    });
    assert.deepEqual(result,{status:'canceled',pending:false,lateUnlocked:true,exits:1});
    report.cases.push({id:'dispose-late-grant',passed:true,result});
  }catch(error){report.cases.push({id:'dispose-late-grant',passed:false,error:String(error)});}
  report.errors=errors;
  assert.deepEqual(errors,[]);
  assert(report.cases.every(c=>c.passed),JSON.stringify(report.cases));
}finally{
  fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
  await browser?.close();await new Promise(resolve=>server.close(resolve));
}
