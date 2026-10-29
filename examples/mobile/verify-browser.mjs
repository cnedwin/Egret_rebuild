// SPDX-License-Identifier: Apache-2.0
// Bounded desktop-browser emulation, separate from physical-phone qualification.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {createExampleServer} from '../../tools/serve-example.mjs';
import {samePhysicalPath,ownerRelativePath} from '../../tools/lib/file-identity.mjs';
const [playwrightRoot,output,...extra]=process.argv.slice(2);
if(!playwrightRoot||!output||extra.length)throw Error('Usage: node examples/mobile/verify-browser.mjs <playwright-root> <new-output-directory>');
assert.equal(JSON.parse(fs.readFileSync(path.resolve(playwrightRoot,'package.json'),'utf8')).version,'1.62.1');
const {chromium}=await import(pathToFileURL(path.resolve(playwrightRoot,'index.mjs')));
const root=path.resolve(import.meta.dirname,'../..'),out=path.resolve(output),run='browser';
// Resolve the existing parent before containment checks, including Windows case and junction aliases.
const parent=fs.realpathSync(path.dirname(out)),physicalOutput=path.join(parent,path.basename(out));
let contained=samePhysicalPath(root,physicalOutput);
try{ownerRelativePath(root,physicalOutput);contained=true;}catch(error){if(!(error instanceof RangeError))throw error;}
if(contained)throw Error('Evidence output must be outside the repository');
fs.mkdirSync(physicalOutput);
if(!samePhysicalPath(out,fs.realpathSync(out)))throw Error('Evidence output has another physical owner');
const sources=new Map(),sha=b=>createHash('sha256').update(b).digest('hex');
const checks=[],failures=[],contexts=[];let browser;
const server=createExampleServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port;
function check(name,actual,...expected){assert.deepEqual(actual,expected.length?expected[0]:true,name);checks.push(name);}
async function settle(page,width=page.viewportSize().width,density){
 await page.waitForFunction(({width,density})=>{
  const s=globalThis.__egretMobileRead(),c=document.querySelector('canvas'),rect=c.getBoundingClientRect();
  return innerWidth===width&&(density===undefined||devicePixelRatio===density)&&s.state==='ready'&&s.viewport.width===Math.min(960,Math.floor(document.querySelector('#surface').getBoundingClientRect().width))&&s.viewport.density===Math.max(1,Math.min(2,devicePixelRatio))&&Math.abs(rect.width-s.viewport.width)<0.1&&c.width===Math.ceil(s.viewport.width*s.viewport.density)&&c.height===Math.ceil(s.viewport.height*s.viewport.density);
 },{width,density});
}
const read=page=>page.evaluate(async()=>{const m=await import('/examples/mobile/main.mjs');await m.whenIdle();return m.readSnapshot();});
const load=async(page,scene,backend)=>{
 await page.goto(origin+'/examples/mobile/index.html?scene='+scene+'&backend='+backend);
 await page.evaluate(async()=>{globalThis.__egretMobileRead=(await import('/examples/mobile/main.mjs')).readSnapshot;});
 await page.waitForFunction(()=>['ready','failed'].includes(globalThis.__egretMobileRead().state),undefined,{timeout:90000});
 const state=await read(page);check(scene+': ready',state.state,'ready');return state;
};
async function geometry(page,label,state,targetWidth=page.viewportSize().width){
 await settle(page,targetWidth);
 // Read the owner, CSS rect, density and backing in the same browser turn.
 const observation=await page.evaluate(async()=>{
  const m=await import('/examples/mobile/main.mjs');await m.whenIdle();
  const c=document.querySelector('canvas'),rect=c.getBoundingClientRect();
  return {snapshot:m.readSnapshot(),dpr:devicePixelRatio,innerWidth,box:{x:rect.x,y:rect.y,width:rect.width,height:rect.height},dimensions:{width:c.width,height:c.height,cssWidth:rect.width,cssHeight:rect.height,touchAction:getComputedStyle(c).touchAction,overflow:document.documentElement.scrollWidth>innerWidth},pageTouchAction:getComputedStyle(document.body).touchAction};
 });
 Object.assign(state,observation.snapshot);
 const {box,dimensions,dpr}=observation;
 check(label+': requested viewport',observation.innerWidth,targetWidth);
 check(label+': expected logical width',state.viewport.width,Math.min(960,targetWidth-32));
 check(label+': no horizontal overflow',dimensions.overflow,false);
 check(label+': effective DPR',state.viewport.density,Math.max(1,Math.min(2,dpr)));
 check(label+': backing width',dimensions.width,Math.ceil(state.viewport.width*state.viewport.density));
 check(label+': backing height',dimensions.height,Math.ceil(state.viewport.height*state.viewport.density));
 check(label+': CSS width ('+dimensions.cssWidth+' / '+state.viewport.width+')',Math.abs(dimensions.cssWidth-state.viewport.width)<0.1);
 check(label+': CSS height',Math.abs(dimensions.cssHeight-state.viewport.height)<0.1);
 check(label+': canvas-only touch policy',dimensions.touchAction,'none');
 check(label+': page can scroll',observation.pageTouchAction,'auto');
 return box;
}

async function verifyKeyboard(page,context,label,mobile){
 await page.locator('canvas').focus();
 await page.keyboard.press('Tab');let state=await read(page);
 check(label+': first logical keyboard target',state.application.keyboard.focusedId,'left');
 check(label+': keyboard focus-visible',state.application.keyboard.focusVisible,true);
 await page.keyboard.press('Tab');state=await read(page);
 check(label+': next logical keyboard target',state.application.keyboard.focusedId,'right');
 await page.keyboard.press('ArrowLeft');state=await read(page);
 check(label+': routed arrow navigation',state.application.keyboard.focusedId,'left');
 check(label+': arrow target recorded',state.application.keyboardEvents.some(e=>e.code==='ArrowLeft'&&e.targetId==='right'));
 const gold=await page.locator('canvas').evaluate((canvas,region)=>{
  const rect=canvas.getBoundingClientRect(),x=Math.floor((region.x-2)*canvas.width/rect.width),y=Math.floor((region.y+12)*canvas.height/rect.height);
  return [...canvas.getContext('2d').getImageData(x,y,1,1).data];
 },state.application.regions[0]);
 check(label+': genuine rendered logical focus border',gold,[255,209,102,255]);
 const before=state.application.activations.left,scroll=await page.evaluate(()=>scrollY);
 await page.keyboard.down('Space');await page.keyboard.down('Space');state=await read(page);
 check(label+': held/repeat activates once',state.application.activations.left,before+1);
 check(label+': held physical code',state.application.keyboard.pressedKeys,['Space']);
 check(label+': prevented Space does not scroll',await page.evaluate(()=>scrollY),scroll);
 await page.keyboard.up('Space');state=await read(page);check(label+': keyup releases hold',state.application.keyboard.pressedKeys,[]);
 await page.keyboard.down('Enter');state=await read(page);check(label+': Enter accepted',state.application.keyboard.pressedKeys,['Enter']);
 const activated=state.application.activations.left,cancels=state.application.keyboardCancels;
 await page.locator('[data-action="pointer-toggle"]').click();state=await read(page);
 check(label+': suspend keyboard with pointer',state.application.keyboard.state,'suspended');
 check(label+': suspend cancels held keys',state.application.keyboard.pressedKeys,[]);
 check(label+': cancel notification delivered',state.application.keyboardCancels>cancels);
 await page.keyboard.up('Enter');await page.locator('[data-action="pointer-toggle"]').click();state=await read(page);
 check(label+': stale native keyup does not activate',state.application.activations.left,activated);
 check(label+': native listeners resume',state.application.keyboard.state,'active');
 await page.locator('canvas').focus();await page.keyboard.press('Tab');await page.keyboard.press('Shift+Tab');state=await read(page);
 check(label+': reverse traversal can leave canvas',state.application.keyboard.focusedId,undefined);
 check(label+': native Tab boundary respected',await page.locator('canvas').evaluate(c=>document.activeElement===c),false);
 await page.evaluate(()=>{const editor=document.createElement('input');editor.id='keyboard-native-editor';editor.setAttribute('aria-label','Authored native editor fixture');document.querySelector('#controls').append(editor);});
 const beforeEditor=JSON.stringify(state.application.activations);
 await page.locator('#keyboard-native-editor').focus();await page.keyboard.type('fixture');await page.keyboard.press('Space');
 state=await read(page);check(label+': unrelated editor receives native text',await page.locator('#keyboard-native-editor').inputValue(),'fixture ');
 check(label+': unrelated editor never activates game',JSON.stringify(state.application.activations),beforeEditor);
 await page.locator('#keyboard-native-editor').evaluate(e=>e.remove());
 await page.locator('canvas').scrollIntoViewIfNeeded();const box=await page.locator('canvas').boundingBox(),right=state.application.regions[1];
 if(mobile)await page.touchscreen.tap(box.x+right.x+24,box.y+right.y+24);else await page.mouse.click(box.x+right.x+24,box.y+right.y+24);
 state=await read(page);check(label+': pointer transfers logical focus',state.application.keyboard.focusedId,'right');
 check(label+': pointer hides keyboard focus indicator',state.application.keyboard.focusVisible,false);
 check(label+': keyboard example has no diagnostic',state.application.diagnostics,[]);
 if(!mobile)await verifyKeyboardLab(page,label);
}
async function verifyKeyboardLab(page,label){
 try{
 await page.evaluate(async()=>{
  const {createEngine,Sprite}=await import('@egret/engine'),{createCanvasHost}=await import('@egret/engine/web'),{createBrowserKeyboardInput}=await import('@egret/engine/web/keyboard');
  const canvas=document.createElement('canvas');canvas.id='keyboard-lab';canvas.width=200;canvas.height=80;canvas.style.width='200px';canvas.style.height='80px';
  const editor=document.createElement('input');editor.id='keyboard-lab-editor';document.querySelector('#controls').append(canvas,editor);
  const diagnostics=[],engine=await createEngine({host:createCanvasHost({canvas}),onDiagnostic:d=>diagnostics.push({code:d.code,cause:d.cause?.code??null})}),scope=engine.createScope();
  const target=scope.use(new Sprite());target.graphics.beginFill(0x087e8b).drawRect(0,0,180,60).endFill();engine.stage.addChild(target);
  const input=createBrowserKeyboardInput({engine,scope});input.registerTarget({id:'lab',target});
  const events=[],nativeResults=[];let lab;
  const observeNative=event=>{if(event.target===canvas)nativeResults.push({code:event.code,prevented:event.defaultPrevented});};
  window.addEventListener('keydown',observeNative);
  engine.stage.on(input.events.keyDown,event=>{events.push({kind:'down',code:event.payload.code});if(event.payload.code==='Tab'||event.payload.code==='Enter')event.preventDefault();if(event.payload.code==='KeyE'){event.preventDefault();editor.focus();}if(event.payload.code==='Space'){event.preventDefault();if(lab.action==='suspend')input.setInteractive(false);if(lab.action==='dispose')input.dispose();}},{signal:scope.signal});
  engine.stage.on(input.events.cancel,event=>events.push({kind:'cancel',code:event.payload.code,reason:event.payload.reason}),{signal:scope.signal});
  engine.renderFrame({width:200,height:80,clearColor:0x172033,clearAlpha:1});
  let duplicate;try{createBrowserKeyboardInput({engine,scope});}catch(error){duplicate=error.code;}
  lab=globalThis.__egretKeyboardLab={input,engine,scope,canvas,editor,target,events,diagnostics,duplicate,nativeResults,observeNative,action:null};
  input.focus('lab',{visible:true});canvas.focus();
 });
 const lab=()=>page.evaluate(()=>{const l=globalThis.__egretKeyboardLab;return {snapshot:l.input.getSnapshot(),events:l.events.slice(),diagnostics:l.diagnostics.slice(),active:document.activeElement?.id,duplicate:l.duplicate,tabindex:l.canvas.getAttribute('tabindex'),nativeResults:l.nativeResults.slice()};});
 let state=await lab();check(label+': duplicate native bridge refused',state.duplicate,'KEYBOARD_INPUT_IN_USE');
 await page.keyboard.press('Tab');state=await lab();check(label+': prevented Tab remains caller-owned',state.snapshot.focusedId,'lab');check(label+': prevented Tab keeps native focus',state.active,'keyboard-lab');
 await page.keyboard.press('e');state=await lab();check(label+': key handler native-editor handoff',state.active,'keyboard-lab-editor');
 check(label+': native blur cancels handed-off keys',state.snapshot.pressedKeys,[]);
 check(label+': native handoff clears logical focus',state.snapshot.focusedId,undefined);
 check(label+': nested native blur is not a host failure',state.diagnostics,[]);
 await page.evaluate(()=>{const l=globalThis.__egretKeyboardLab;l.canvas.focus();l.input.focus('lab');l.canvas.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyQ',key:'Process',isComposing:true,bubbles:true}));});
 state=await lab();check(label+': synthetic composing exclusion only',state.events.some(e=>e.code==='KeyQ'),false);
 check(label+': composing probe creates no held state',state.snapshot.pressedKeys,[]);
 await page.evaluate(()=>{globalThis.__egretKeyboardLab.action='suspend';});
 await page.keyboard.down('Space');state=await lab();check(label+': prevent plus suspend reaches original DOM',state.nativeResults.at(-1),{code:'Space',prevented:true});check(label+': handler suspended keyboard',state.snapshot.state,'suspended');await page.keyboard.up('Space');
 await page.evaluate(()=>{const l=globalThis.__egretKeyboardLab;l.input.setInteractive(true);l.input.focus('lab');l.canvas.focus();l.action='dispose';});
 await page.keyboard.down('Space');state=await lab();check(label+': prevent plus dispose reaches original DOM',state.nativeResults.at(-1),{code:'Space',prevented:true});check(label+': handler disposed keyboard',state.snapshot.state,'closed');check(label+': first bridge tabindex restored',state.tabindex,null);await page.keyboard.up('Space');
 await page.evaluate(async()=>{const l=globalThis.__egretKeyboardLab,{createBrowserKeyboardInput}=await import('@egret/engine/web/keyboard');l.input=createBrowserKeyboardInput({engine:l.engine,scope:l.scope});l.input.registerTarget({id:'lab',target:l.target});l.engine.stage.on(l.input.events.keyDown,e=>{e.preventDefault();l.events.push({kind:'down',code:e.payload.code});},{signal:l.scope.signal});l.input.focus('lab');l.canvas.focus();l.canvas.setAttribute('tabindex','7');});
 await page.keyboard.down('Enter');state=await lab();check(label+': lab genuine held key',state.snapshot.pressedKeys,['Enter']);
 await page.evaluate(()=>globalThis.__egretKeyboardLab.scope.dispose());state=await lab();check(label+': Scope close retires keyboard',state.snapshot.state,'closed');
 check(label+': Scope close drains keys',state.snapshot.pressedKeys,[]);check(label+': external tabindex change preserved',state.tabindex,'7');
 const count=state.events.length;await page.keyboard.up('Enter');state=await lab();check(label+': closed owner ignores native tail',state.events.length,count);
 }finally{await page.evaluate(async()=>{const l=globalThis.__egretKeyboardLab;if(!l)return;try{await l.engine.dispose();}finally{window.removeEventListener('keydown',l.observeNative);l.canvas.remove();l.editor.remove();delete globalThis.__egretKeyboardLab;}});}
}

async function runCase(scene,mobile,backend='webgl2'){
 const label=scene+'/'+backend+'/'+(mobile?'touch-dpr3':'mouse-dpr1');
 const context=await browser.newContext({viewport:{width:mobile?390:1280,height:mobile?844:1000},deviceScaleFactor:mobile?3:1,isMobile:mobile,hasTouch:mobile});
 const page=await context.newPage(),errors=[];
 await page.route('**/*',async route=>{
  const url=new URL(route.request().url());assert.equal(url.origin,origin);
  const response=await route.fetch();
  if(response.status()===200){
   const relative=decodeURIComponent(url.pathname).slice(1),body=await response.body(),identity={bytes:body.length,sha256:sha(body)};
   if(sources.has(relative))assert.deepEqual(sources.get(relative),identity,'Source changed during collection: '+relative);
   else sources.set(relative,identity);
  }
  await route.fulfill({response});
 });page.on('pageerror',error=>errors.push(String(error)));
 try{
  let state=await load(page,scene,backend);
  if(scene==='ui'||scene==='paragraph'){
   const link=page.locator('#backend a').filter({hasText:backend==='webgpu'?'WebGPU':'WebGL2'});
   check(label+': selectable backend link',new URL(await link.getAttribute('href'),origin).searchParams.get('backend'),backend);
   await link.click();await page.evaluate(async()=>{globalThis.__egretMobileRead=(await import('/examples/mobile/main.mjs')).readSnapshot;});await settle(page);state=await read(page);check(label+': backend link starts',state.application.backend,backend);
  }await page.locator('canvas').scrollIntoViewIfNeeded();
  let box=await geometry(page,label,state);
  const tap=async(x,y)=>mobile?page.touchscreen.tap(box.x+x,box.y+y):page.mouse.click(box.x+x,box.y+y);
  if(scene==='resources'){
   await tap(state.viewport.width*136/192,state.viewport.height*72/128);
   await page.waitForFunction(()=> globalThis.__egretMobileRead().application.selectedId==='pilot-right');
   state=await read(page);check(label+': right selection',state.application.selectedId,'pilot-right');
   const before=state.application.selectionCount;
   await page.mouse.move(box.x+state.viewport.width*56/192,box.y+state.viewport.height*72/128);await page.mouse.down();
   await page.mouse.move(box.x+5,box.y+5);await page.mouse.up();
   state=await read(page);check(label+': outside release is not tap',state.application.selectionCount,before);
   await page.locator('[data-resource-control="step"]').click();
   state=await read(page);check(label+': sequence control advances',state.application.seconds>0);
  }else if(scene==='pointers'){
   const regions=state.application.regions;
   const left={x:box.x+regions[0].x+20,y:box.y+regions[0].y+20};
   const right={x:box.x+regions[1].x+20,y:box.y+regions[1].y+20};
   if(mobile){
    const cdp=await context.newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:1,...left},{id:2,...right}]});
    state=await read(page);check(label+': two independent contacts',state.application.active.length,2);
    check(label+': both targets retained',state.application.active.map(c=>c.region).sort(),['left','right']);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{id:1,x:box.x+box.width+12,y:left.y},{id:2,...right}]});
    state=await read(page);check(label+': capture outside surface',state.application.active.length,2);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    state=await read(page);check(label+': both contacts ended',state.application.active.length,0);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:3,...left}]});
    await page.evaluate(()=>scrollBy(0,20));
    state=await read(page);check(label+': scroll cancels',state.application.active.length,0);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await cdp.detach();
   }else{
    await page.mouse.move(left.x,left.y);await page.mouse.down();state=await read(page);
    check(label+': legacy mouse still usable',state.application.active[0].pointerType,'mouse');await page.mouse.up();
   }
   await page.locator('[data-action="pointer-toggle"]').click();state=await read(page);check(label+': suspend',state.application.inputState,'suspended');
   await page.locator('[data-action="pointer-toggle"]').click();
   await verifyKeyboard(page,context,label,mobile);state=await read(page);
  }else{
   check(label+': real reflow',state.application.columns,mobile?1:2);
   const list=state.application.listBounds;
   await tap(list.x+40,list.y+24);
   await page.waitForFunction(()=>globalThis.__egretMobileRead().application.selectionCount>0);
   state=await read(page);check(label+': genuine row selected',state.application.selectionCount>0);
   check(label+': pointer kind',state.application.events.some(e=>e.pointerType===(mobile?'touch':'mouse')));
   const prior=state.application.scrollOffset;
   await page.getByRole('button',{name:'↓ Next / 向下',exact:true}).click();
   await page.waitForFunction((prior)=>globalThis.__egretMobileRead().application.scrollOffset>prior,prior);
   state=await read(page);check(label+': public UI scrolling',state.application.scrollOffset>prior);
   // Module-specific committed row hit details are retained in the raw receipt.
   if(scene==='ui')check(label+': bounded text preparation',state.application.pendingTextPreparations,0);
   const pixels=await page.evaluate(async()=>{const r=await(await import('/examples/mobile/main.mjs')).readback();if(!r)return null;const raw=Uint8Array.from(atob(r.base64),c=>c.charCodeAt(0));const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',raw));const colors=new Set();for(let i=0;i<raw.length;i+=4*97)colors.add(Array.from(raw.slice(i,i+4)).join(','));return {width:r.width,height:r.height,bytes:r.bytes,sha256:Array.from(digest,x=>x.toString(16).padStart(2,'0')).join(''),sampleColors:colors.size};});
   check(label+': actual GPU readback width',pixels.width,Math.ceil(state.viewport.width*state.viewport.density));
   check(label+': actual GPU readback height',pixels.height,Math.ceil(state.viewport.height*state.viewport.density));
   check(label+': RGBA bytes',pixels.bytes,pixels.width*pixels.height*4);
   check(label+': visible GPU content',pixels.sampleColors>2);
   contexts.push({label,initial:state,pixels});
  }
  if(mobile){
   const revision=state.revision;
   await page.setViewportSize({width:844,height:390});await page.waitForFunction((revision)=>globalThis.__egretMobileRead().revision>revision,revision);
   await settle(page);state=await read(page);await geometry(page,label+'/landscape',state);
   if(scene==='resources')check(label+': selected actor restored',state.application.selectedId,'pilot-right');
   if(scene==='pointers')check(label+': no stale contacts',state.application.active.length,0);
   if(scene==='ui'||scene==='paragraph'){
    check(label+': wide reflow',state.application.columns,2);
    const layouts=state.application.committedLayouts;check(label+': committed wide origins',layouts[0].origin.y===layouts[1].origin.y&&layouts[0].origin.x!==layouts[1].origin.x);
   }
   const wideArticle=scene==='paragraph'?state.application.preparations.find(p=>p.id==='article-copy'):null;
   await page.setViewportSize({width:320,height:844});await settle(page);state=await read(page);await geometry(page,label+'/small-phone',state);
   if(scene==='ui'||scene==='paragraph'){
    check(label+': narrow reflow',state.application.columns,1);
    const layouts=state.application.committedLayouts;check(label+': committed stacked origins',layouts[0].origin.x===layouts[1].origin.x&&layouts[1].origin.y>layouts[0].origin.y);
    check(label+': committed roots',layouts.every(r=>r.committedRevision>0&&r.origin.x+r.viewport.width<=state.viewport.width));
   }
   if(wideArticle){const narrow=state.application.preparations.find(p=>p.id==='article-copy');check(label+': paragraph width changes',narrow.width<wideArticle.width);check(label+': natural reflow metrics',narrow.lines>=wideArticle.lines&&narrow.height>=wideArticle.height&&(narrow.lines>wideArticle.lines||narrow.height>wideArticle.height));}
   await page.setViewportSize({width:390,height:844});await settle(page);state=await read(page);
   await page.locator('canvas').scrollIntoViewIfNeeded();await settle(page);
   const shotBefore=await read(page);
   await page.screenshot({path:path.join(out,scene+'-'+backend+'.png'),fullPage:false});
   await settle(page);const shotAfter=await read(page);
   check(label+': screenshot ready state',shotBefore.state,'ready');
   check(label+': screenshot stable owner',shotAfter.revision,shotBefore.revision);
  }
  if(mobile){
   const cdp=await context.newCDPSession(page),before=state.revision;
   await cdp.send('Emulation.setDeviceMetricsOverride',{width:391,height:844,deviceScaleFactor:1.25,mobile:true});
   await page.waitForFunction((before)=>globalThis.__egretMobileRead().revision>before,before);
   await page.waitForFunction(()=>devicePixelRatio===1.25&&globalThis.__egretMobileRead().viewport.density===1.25);
   await settle(page,391,1.25);state=await read(page);check(label+': viewport and DPR change without reload',state.viewport.density,1.25);await geometry(page,label+'/DPR-change',state,391);await cdp.detach();
  }
  contexts.push({label,final:state,errors});
  await page.evaluate(async()=>{await(await import('/examples/mobile/main.mjs')).close();});state=await read(page);
  check(label+': close settled',state.state,'closed');check(label+': no error',errors,[]);check(label+': lifecycle errors',state.errors,[]);
  if(scene==='resources'){check(label+': font cleanup',state.retired.fontCount,0);check(label+': resource cleanup',state.retired.pendingSources+state.retired.pendingTasks,0);check(label+': contacts cleanup',state.retired.contacts,0);check(label+': no cleanup failures',state.retired.cleanupFailures,0);}
  if(scene==='pointers'){check(label+': contact cleanup',state.retired.active.length,0);check(label+': keyboard cleanup',state.retired.keyboard.state,'closed');check(label+': no held keyboard state',state.retired.keyboard.pressedKeys,[]);check(label+': keyboard tabindex cleanup',await page.locator('canvas').getAttribute('tabindex'),null);}
  if(scene==='ui'||scene==='paragraph'){check(label+': input cleanup',state.retired.inputState,'closed');check(label+': text cache cleanup',state.retired.cache.closed);check(label+': no content errors',state.retired.errors,[]);check(label+': no cleanup failures',state.retired.cleanupFailureCount,0);}
  check(label+': canvas touch policy restored',await page.locator('canvas').evaluate(c=>c.style.touchAction),'');
 }catch(error){failures.push({label,error:String(error.stack??error),state:await read(page).catch(()=>null),errors});}
 finally{await context.close();}
}
try{
 browser=await chromium.launch({channel:'msedge',headless:true});
 const scenes=['resources','pointers','ui','paragraph'];
 for(const scene of scenes){await runCase(scene,false);await runCase(scene,true);if(['ui','paragraph'].includes(scene))await runCase(scene,true,'webgpu');}
}finally{
 const browserVersion=browser?.version();
 await browser?.close();await new Promise(resolve=>server.close(resolve));
 for(const [relative,identity] of sources){
  const physical=relative.startsWith('vendor/robust-predicates/')?path.join(root,'packages/engine/node_modules/robust-predicates',relative.slice('vendor/robust-predicates/'.length)):path.join(root,relative);
  const bytes=fs.readFileSync(physical);assert.deepEqual({bytes:bytes.length,sha256:sha(bytes)},identity,'Source changed after collection: '+relative);
 }
 const receipt={run,time:new Date().toISOString(),environment:{node:process.version,browser:browserVersion,playwright:'1.62.1',channel:'msedge',headless:true,extraFlags:[],physicalDevice:false},sources:Object.fromEntries(sources),checks,contexts,failures};
 fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify({run,checks:checks.length,failures:failures.map(f=>({label:f.label,error:f.error}))}));
 if(failures.length)process.exitCode=1;
}
