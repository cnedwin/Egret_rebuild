// SPDX-License-Identifier: Apache-2.0
// Physical-device checks for the responsive example. Node built-ins only: adb + Chrome DevTools Protocol.
// Usage: node examples/mobile/verify-device.mjs <output-directory> [--port 9222] [--adb adb]
// The output directory must not exist. Every Android setting this touches is restored before exit.
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const args=process.argv.slice(2);
const output=args.find(value=>!value.startsWith('--'));
const flag=name=>{const index=args.indexOf('--'+name);return index<0?undefined:args[index+1];};
if(!output){console.error('usage: node examples/mobile/verify-device.mjs <output-directory> [--port 9222] [--adb adb]');process.exit(2);}
if(fs.existsSync(output)){console.error('output directory already exists: '+output);process.exit(2);}
const port=Number(flag('port')??9222), adb=flag('adb')??'adb';
const ORIGIN='http://127.0.0.1:4173';
const results=[],failures=[],notes=[];
const record=(name,ok,actual,expected)=>{results.push({name,ok,actual,expected});if(!ok)failures.push(name);};

const shell=(command)=>{const result=spawnSync(adb,['shell',command],{encoding:'utf8'});if(result.status!==0)throw new Error('ADB_FAILED: '+command);return (result.stdout??'').trim();};
const adbRaw=(list)=>{const result=spawnSync(adb,list,{encoding:'utf8'});return {ok:result.status===0,text:(result.stdout??'').trim()};};

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function targets(){return (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json());}
async function attach(match){
  for(let attempt=0;attempt<30;attempt+=1){
    const list=await targets();
    const candidates=list.filter(item=>item.type==='page'&&item.url.includes(match));
    for(const target of candidates){
      const socket=new WebSocket(target.webSocketDebuggerUrl);
      await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject;});
      let id=0;const pending=new Map();const errors=[];
      socket.onmessage=message=>{
        const payload=JSON.parse(message.data);
        if(payload.id&&pending.has(payload.id)){
          const entry=pending.get(payload.id);pending.delete(payload.id);
          if(payload.error)entry.reject(new Error(JSON.stringify(payload.error)));else entry.resolve(payload.result);
          return;
        }
        if(payload.method==='Runtime.exceptionThrown')errors.push(String(payload.params.exceptionDetails.exception?.description??payload.params.exceptionDetails.text).slice(0,160));
        if(payload.method==='Log.entryAdded'&&payload.params.entry.level==='error')errors.push(String(payload.params.entry.text).slice(0,160));
      };
      const send=(method,params={})=>new Promise((resolve,reject)=>{const next=++id;pending.set(next,{resolve,reject});socket.send(JSON.stringify({id:next,method,params}));});
      await send('Runtime.enable');await send('Log.enable');await send('Page.enable');
      const evaluate=async expression=>{
        const response=await send('Runtime.evaluate',{expression,returnByValue:true,timeout:60000});
        if(response.exceptionDetails)throw new Error('EVAL_FAILED: '+String(response.exceptionDetails.exception?.description??response.exceptionDetails.text).slice(0,160));
        return response.result.value;
      };
      const visible=await evaluate('document.visibilityState').then(value=>value==='visible').catch(()=>false);
      if(!visible){
        await send('Page.bringToFront').catch(()=>{});
        await sleep(250);
        const retried=await evaluate('document.visibilityState').then(value=>value==='visible').catch(()=>false);
        if(!retried){socket.close();continue;}
      }
      await send('Page.bringToFront').catch(()=>{});
      return {socket,send,evaluate,errors};
    }
    await sleep(500);
  }
  throw new Error('NO_VISIBLE_PAGE: '+match);
}

const status=evaluate=>evaluate(`(() => { const raw=document.getElementById('status').textContent; try { return JSON.stringify(JSON.parse(raw)); } catch { return '{"state":"unparsed"}'; } })()`).then(JSON.parse);
const geometry=evaluate=>evaluate(`(() => {
  const canvas=document.querySelector('canvas');
  const surface=document.getElementById('surface');
  if(!canvas)return JSON.stringify({canvas:null});
  const rect=canvas.getBoundingClientRect(),box=surface?surface.getBoundingClientRect():rect;
  return JSON.stringify({cssWidth:rect.width,cssHeight:rect.height,backingWidth:canvas.width,backingHeight:canvas.height,
    touchAction:getComputedStyle(canvas).touchAction,dpr:devicePixelRatio,
    surface:{x:box.x,y:box.y,width:box.width,height:box.height}});
})()`).then(JSON.parse);

// One tab only: Chrome on Android opens a new tab per VIEW intent, which would leave the
// DevTools target on a background document while touches land on the foreground one.
// Each scene reports its own counters; sum the numeric activity fields instead of assuming one shape.
const activity=app=>{
  let total=0;
  for(const [key,value] of Object.entries(app??{})){
    if(typeof value==='number'&&/(count|events|selections|contacts)$/i.test(key))total+=value;
  }
  if(Array.isArray(app?.events))total+=app.events.length;
  return total;
};
const selectedOf=app=>app?.selectedKey??app?.selectedId??null;

// A fresh VIEW intent gives the panel page a real navigation, which is what reliably admits
// synthetic touch on this build. Attach to the newest tab for that exact scene query.
async function openScene(scene){
  shell(`am start -a android.intent.action.VIEW -d "${ORIGIN}/examples/mobile/index.html?scene=${scene}" -p com.android.chrome`);
  await sleep(5500);
  return attach(`?scene=${scene}`);
}

async function openDevice(scene,page){
  await page.send('Page.navigate',{url:`${ORIGIN}/examples/mobile/index.html?scene=${scene}`});
  await page.send('Page.bringToFront').catch(()=>{});
  await sleep(6500);
  return page;
}

const density=Number((shell('wm density').match(/(\d+)/)??[])[1]??0);
const physicalDensity=Number((shell('wm density').match(/Physical density:\s*(\d+)/)??[])[1]??density);
const originalRotation=shell('settings get system user_rotation');
const originalAccelerometer=shell('settings get system accelerometer_rotation');

fs.mkdirSync(output,{recursive:true});
const restore=()=>{
  try{shell('wm density reset');}catch{}
  try{shell(`settings put system user_rotation ${originalRotation||0}`);}catch{}
  try{shell(`settings put system accelerometer_rotation ${originalAccelerometer||1}`);}catch{}
};

try{
  const devices=adbRaw(['devices']).text.split(/\r?\n/).filter(line=>/\tdevice$/.test(line));
  record('one connected device',devices.length===1,devices.length,1);
  if(devices.length!==1)throw new Error('DEVICE_COUNT: '+devices.length);
  record('host port forwarded to the device',adbRaw(['reverse','tcp:4173','tcp:4173']).ok,true,true);
  // A phone in a pocket is asleep; wake it and dismiss the keyguard before attaching.
  shell('input keyevent KEYCODE_WAKEUP');
  shell('input swipe 540 1800 540 700 120');
  await sleep(1200);
  shell(`am start -a android.intent.action.VIEW -d "${ORIGIN}/examples/mobile/index.html" -p com.android.chrome`);
  await sleep(3500);
  const page=await attach('/examples/mobile/');

  for(const scene of ['resources','pointers','ui','paragraph']){
    const {send,evaluate,errors}=await openDevice(scene,page);
    await evaluate(`(() => { const surface=document.getElementById('surface'); if(surface)surface.scrollIntoView({block:'center'}); window.scrollBy(0,0); return true; })()`);
    await sleep(500);
    const view=await status(evaluate);
    const box=await geometry(evaluate);
    record(`${scene}: ready`,view.state==='ready',view.state,'ready');
    const effective=Math.max(1,Math.min(2,box.dpr));
    record(`${scene}: effective density bounded`,Math.abs((view.viewport?.density??0)-effective)<1e-6,view.viewport?.density,effective);
    const expectedWidth=Math.ceil(box.cssWidth*effective-1e-6), expectedHeight=Math.ceil(box.cssHeight*effective-1e-6);
    record(`${scene}: backing follows CSS x density`,Math.abs(box.backingWidth-expectedWidth)<=1&&Math.abs(box.backingHeight-expectedHeight)<=1,
      `${box.backingWidth}x${box.backingHeight}`,`${expectedWidth}x${expectedHeight}`);
    record(`${scene}: canvas keeps page scrolling off`,box.touchAction==='none',box.touchAction,'none');
    record(`${scene}: no page errors`,errors.length===0,errors.slice(0,3),[]);

    const points=[0.25,0.5,0.75].map(fraction=>({x:Math.round(box.surface.x+box.surface.width*fraction),y:Math.round(box.surface.y+box.surface.height*0.55)}));
    const routed=activity(view.application);
    let seen=routed,attempts=0;
    while(seen<=routed&&attempts<3){
      attempts+=1;
      await sleep(700);
      for(const point of points){
        await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:point.x,y:point.y,id:2,radiusX:8,radiusY:8,force:1}]});
        await sleep(140);
        await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
        await sleep(350);
      }
      const probe=await status(evaluate);
      seen=activity(probe.application);
    }
    const after=await status(evaluate);
    const touchTypes=new Set((Array.isArray(after.application?.events)?after.application.events:[]).map(event=>event.pointerType).filter(Boolean));
    if(after.application?.lastPointerType)touchTypes.add(after.application.lastPointerType);
    record(`${scene}: synthetic touch reaches the engine`,seen>routed,{before:routed,after:seen,attempts,types:[...touchTypes]},{after:'>before'});
    fs.writeFileSync(path.join(output,`${scene}.json`),JSON.stringify({scene,view,geometry:box,errors},null,1));
  }

  // Focus transfer and keys on the Two contacts page (M3.3 keyboard channel).
  const KEYS={
    Tab:{key:'Tab',code:'Tab',windowsVirtualKeyCode:9,nativeVirtualKeyCode:9},
    ArrowRight:{key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39,nativeVirtualKeyCode:39},
    ArrowLeft:{key:'ArrowLeft',code:'ArrowLeft',windowsVirtualKeyCode:37,nativeVirtualKeyCode:37},
    Enter:{key:'Enter',code:'Enter',windowsVirtualKeyCode:13,nativeVirtualKeyCode:13},
    Space:{key:' ',code:'Space',windowsVirtualKeyCode:32,nativeVirtualKeyCode:32},
  };
  const pressKey=async(send,name)=>{
    const key=KEYS[name];
    await send('Input.dispatchKeyEvent',{type:'rawKeyDown',...key,text:name==='Tab'?undefined:name==='Enter'?'\r':' '});
    await sleep(80);
    await send('Input.dispatchKeyEvent',{type:'keyUp',...key});
    await sleep(400);
  };
  {
    const {send,evaluate,errors}=await openDevice('pointers',page);
    await evaluate(`(() => { const surface=document.getElementById('surface'); if(surface)surface.scrollIntoView({block:'center'}); return true; })()`);
    await sleep(400);
    const box=await geometry(evaluate);
    const tap=async fraction=>{
      const point={x:Math.round(box.surface.x+box.surface.width*fraction),y:Math.round(box.surface.y+box.surface.height*0.5)};
      await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...point,id:4,radiusX:8,radiusY:8,force:1}]});
      await sleep(140);
      await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
      await sleep(600);
    };
    const snapshot=async()=>(await status(evaluate)).application??{};

    await tap(0.25);
    const afterPointer=await snapshot();
    const focusedByPointer=afterPointer.keyboard?.focusedId??null;
    record('pointers: a pointer transfer focuses a logical target',Boolean(focusedByPointer),focusedByPointer,'non-null');

    await evaluate(`(() => { document.querySelector('canvas').focus({preventScroll:true}); return document.activeElement.tagName; })()`);
    await sleep(200);
    // Synthetic DevTools keys are not a reliable proxy for a physical keyboard on Android: the
    // channel sometimes reports KEYBOARD_INPUT_SAMPLE_INVALID and sometimes delivers a key late.
    // Focus movement and key delivery are therefore recorded, while only the pointer transfer above
    // is asserted.
    await pressKey(send,'ArrowRight');
    const afterTab=await snapshot();
    await pressKey(send,'Enter');
    const afterEnter=await snapshot();
    const activationsBefore=JSON.stringify(afterTab.activations??{});
    const activationsAfter=JSON.stringify(afterEnter.activations??{});
    const keyboardDiagnostics=(afterEnter.diagnostics??[]).map(entry=>entry.causeCode??entry.code).filter(Boolean);
    notes.push(`synthetic keys: focus ${focusedByPointer} -> ${afterTab.keyboard?.focusedId??null} -> ${afterEnter.keyboard?.focusedId??null}; activations ${activationsBefore} -> ${activationsAfter}; channel events ${(afterEnter.keyboardEvents??[]).length}; diagnostics ${JSON.stringify(keyboardDiagnostics)}. A physical keyboard is required for key acceptance.`);
    record('keyboard: no key stays held after release',(afterEnter.keyboard?.pressedKeys??[]).length===0,afterEnter.keyboard?.pressedKeys??[],[]);
    record('keyboard: no page errors',errors.length===0,errors.slice(0,3),[]);
    fs.writeFileSync(path.join(output,'keyboard.json'),JSON.stringify({afterPointer,afterTab,afterEnter,activationsBefore,activationsAfter,keyboardDiagnostics,errors},null,1));

    // Cancellation while two contacts are held. This page reports held contacts in `active`.
    const left={x:Math.round(box.surface.x+box.surface.width*0.25),y:Math.round(box.surface.y+box.surface.height*0.5)};
    const right={x:Math.round(box.surface.x+box.surface.width*0.75),y:Math.round(box.surface.y+box.surface.height*0.5)};
    await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...left,id:5,radiusX:8,radiusY:8,force:1},{...right,id:6,radiusX:8,radiusY:8,force:1}]});
    await sleep(400);
    const held=await snapshot();
    record('cancel: two contacts are held independently',(held.active??[]).length===2,(held.active??[]).length,{contacts:2});
    await send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
    await sleep(700);
    const cancelled=await snapshot();
    record('cancel: a browser cancel retires both contacts',(cancelled.active??[]).length===0,(cancelled.active??[]).length,{contacts:0});
    await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...left,id:7,radiusX:8,radiusY:8,force:1}]});
    await sleep(400);
    const retried=await snapshot();
    record('cancel: the surface accepts the next contact',(retried.active??[]).length===1,(retried.active??[]).length,{contacts:1});
    await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await sleep(400);
    record('cancel: releasing the replacement leaves nothing held',((await snapshot()).active??[]).length===0,((await snapshot()).active??[]).length,{contacts:0});
  }

  // A missing texture must surface a failed session, and restoring it must recover.
  {
    const {send,evaluate}=await openDevice('resources',page);
    await send('Network.enable');
    await send('Network.setBlockedURLs',{urls:['*.png']});
    await openDevice('resources',page);
    await sleep(1500);
    const blocked=await status(evaluate);
    record('failure: a blocked texture reports a failed session',blocked.state==='failed',{state:blocked.state,errors:blocked.errors},{state:'failed'});
    record('failure: the failed session names a reason',(blocked.errors??[]).length>0,blocked.errors??[],[{atLeast:1}]);
    await send('Network.setBlockedURLs',{urls:[]});
    await openDevice('resources',page);
    const recovered=await status(evaluate);
    record('failure: restoring the source recovers the session',recovered.state==='ready',recovered.state,'ready');
    fs.writeFileSync(path.join(output,'failure.json'),JSON.stringify({blocked,recovered},null,1));
  }

  // Rebuild on rotation and on a density change, with application state preserved.
  const {send,evaluate,errors}=await openScene('ui');
  await evaluate(`(() => { const surface=document.getElementById('surface'); if(surface)surface.scrollIntoView({block:'center'}); return true; })()`);
  // The panel binds its input a moment after the session reports ready; give it room.
  await sleep(3000);
  const initial=await status(evaluate);
  const box=await geometry(evaluate);
  const offsets=[0.55,0.45,0.35,0.6];
  let selected=await status(evaluate);
  for(let attempt=0;attempt<4&&!selectedOf(selected.application);attempt+=1){
    if(attempt)await sleep(1200);
    for(const offset of offsets){
      for(const fraction of [0.25,0.5,0.75]){
        const tap={x:Math.round(box.surface.x+box.surface.width*fraction),y:Math.round(box.surface.y+box.surface.height*offset)};
        await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:tap.x,y:tap.y,id:3,radiusX:8,radiusY:8,force:1}]});
        await sleep(140);
        await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
        await sleep(650);
        selected=await status(evaluate);
        if(selectedOf(selected.application))break;
      }
      if(selectedOf(selected.application))break;
    }
  }
  if(!selectedOf(selected.application)){
    // Touch is the path under test; a mouse tap afterwards only supplies a diagnostic comparison.
    const beforeFallback={hitCount:selected.application?.hitCount??null,pointerEvents:selected.application?.pointerEvents??null};
    const fallback={x:Math.round(box.surface.x+box.surface.width*0.5),y:Math.round(box.surface.y+box.surface.height*0.55)};
    await send('Input.dispatchMouseEvent',{type:'mousePressed',x:fallback.x,y:fallback.y,button:'left',clickCount:1});
    await sleep(120);
    await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:fallback.x,y:fallback.y,button:'left',clickCount:1});
    await sleep(700);
    const viaMouse=await status(evaluate);
    notes.push('ui selection: touch produced nothing '+JSON.stringify(beforeFallback)+'; a mouse tap then selected '+JSON.stringify(selectedOf(viaMouse.application)));
  }else{
    notes.push('ui selection path: touch');
  }
  record('ui: a touch tap on a row records a selection',Boolean(selectedOf(selected.application)),selectedOf(selected.application),'non-null');

  shell('settings put system accelerometer_rotation 0');
  shell('settings put system user_rotation 1');
  await sleep(4000);
  const landscape=await status(evaluate);
  record('rotation: session rebuilt',(landscape.revision??0)>(initial.revision??0),landscape.revision,`>${initial.revision}`);
  record('rotation: no rebuild errors',(landscape.errors??[]).length===0,landscape.errors??[],[]);
  record('rotation: selection preserved',selectedOf(landscape.application)===selectedOf(selected.application),selectedOf(landscape.application),selectedOf(selected.application));
  shell(`settings put system user_rotation ${originalRotation||0}`);
  await sleep(3500);

  shell('wm density 240');
  await sleep(4500);
  const densified=await status(evaluate);
  const densityGeometry=await geometry(evaluate);
  const expectedDensity=Math.max(1,Math.min(2,densityGeometry.dpr));
  record('density change: session rebuilt',(densified.revision??0)>(landscape.revision??0),densified.revision,`>${landscape.revision}`);
  record('density change: effective density follows DPR',Math.abs((densified.viewport?.density??0)-expectedDensity)<1e-6,densified.viewport?.density,expectedDensity);
  record('density change: no rebuild errors',(densified.errors??[]).length===0,densified.errors??[],[]);
  record('final: no page errors',errors.length===0,errors.slice(0,3),[]);
  fs.writeFileSync(path.join(output,'rebuild.json'),JSON.stringify({initial,selected,landscape,densified,densityGeometry,errors},null,1));
  page.socket.close();
}catch(error){
  record('run completed',false,String(error?.message??error),'no error');
}finally{
  restore();
}

notes.push('Physical Android, single device, synthetic touch through the browser input stack.');
notes.push('Native IME, pen, thermal/power and sustained performance remain outside this check.');
const summary={passed:results.filter(item=>item.ok).length,failed:failures.length,total:results.length,physicalDensity,results,notes};
fs.writeFileSync(path.join(output,'summary.json'),JSON.stringify(summary,null,1));
console.log(`device checks: ${summary.passed}/${summary.total} passed`);
for(const item of results.filter(entry=>!entry.ok))console.log(`FAIL ${item.name}: actual=${JSON.stringify(item.actual)} expected=${JSON.stringify(item.expected)}`);
process.exit(failures.length?1:0);
