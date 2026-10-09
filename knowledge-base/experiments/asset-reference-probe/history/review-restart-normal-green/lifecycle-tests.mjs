import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createReferenceChain } from './reference-chain.mjs';
import { installDemo } from './demo-controller.mjs';
const assetUrl='./assets/RiggedSimple/RiggedSimple.gltf';
const assert=(condition,message)=>{if(!condition)throw new Error(message);};
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(condition,message){for(let i=0;i<200;i++){if(condition())return;await delay(10);}throw new Error(message);}
function observeCanvas(canvas){
  const add=canvas.addEventListener,remove=canvas.removeEventListener,get=canvas.getContext,liveListeners=new Map();let allocations=0;
  canvas.addEventListener=function(name,listener,...rest){if(name.startsWith('webgl')){if(!liveListeners.has(name))liveListeners.set(name,new Set());liveListeners.get(name).add(listener);}return add.call(this,name,listener,...rest);};
  canvas.removeEventListener=function(name,listener,...rest){liveListeners.get(name)?.delete(listener);return remove.call(this,name,listener,...rest);};
  canvas.getContext=function(type,...args){if(type==='webgl2')allocations++;return get.call(this,type,...args);};
  return {listeners:()=>[...liveListeners.values()].reduce((n,set)=>n+set.size,0),allocations:()=>allocations,context:()=>get.call(canvas,'webgl2'),restore:()=>{for(const [name,listeners] of liveListeners)for(const listener of listeners)remove.call(canvas,name,listener);canvas.addEventListener=add;canvas.removeEventListener=remove;canvas.getContext=get;}};
}
async function initializationFailure(kind){
  const canvas=document.createElement('canvas');canvas.width=640;canvas.height=400;const observation=observeCanvas(canvas);
  const originalParse=GLTFLoader.prototype.parseAsync,originalMeasure=CanvasRenderingContext2D.prototype.measureText;
  let parsed=false,geometryDisposes=0,materialDisposes=0,uiStarted=false;
  const live={shader:new Set(),program:new Set(),vao:new Set(),texture:new Set()},created={shader:0,program:0,vao:0,texture:0};const restores=[];
  GLTFLoader.prototype.parseAsync=async function(...args){const actual=await originalParse.apply(this,args);parsed=true;const gs=new Set(),ms=new Set();actual.scene.traverse(o=>{if(o.geometry)gs.add(o.geometry);if(o.material)ms.add(o.material);});for(const g of gs)g.addEventListener('dispose',()=>geometryDisposes++);for(const m of ms)m.addEventListener('dispose',()=>materialDisposes++);return actual;};
  const gl=canvas.getContext('webgl2',{alpha:true,premultipliedAlpha:true,antialias:false,preserveDrawingBuffer:true});
  for(const [name,createName,deleteName] of [['shader','createShader','deleteShader'],['program','createProgram','deleteProgram'],['vao','createVertexArray','deleteVertexArray'],['texture','createTexture','deleteTexture']]){
    const create=gl[createName],remove=gl[deleteName];
    gl[createName]=function(...args){if(name==='shader')uiStarted=true;const object=create.apply(this,args);if(uiStarted){live[name].add(object);created[name]++;}return object;};
    gl[deleteName]=function(object){live[name].delete(object);return remove.call(this,object);};
    restores.push(()=>{gl[createName]=create;gl[deleteName]=remove;});
  }
  const shaderParameter=gl.getShaderParameter,shaderLog=gl.getShaderInfoLog;
  if(kind==='shader'){gl.getShaderParameter=function(shader,pname){if(uiStarted&&pname===gl.COMPILE_STATUS)return false;return shaderParameter.call(this,shader,pname);};gl.getShaderInfoLog=()=> 'Controlled initial UI shader failure';}
  if(kind==='text')CanvasRenderingContext2D.prototype.measureText=function(){throw new Error('Controlled initial Canvas text failure');};
  try{
    let message,chain;try{chain=await createReferenceChain(canvas,{assetUrl});}catch(error){message=error.message;}finally{chain?.dispose();}
    const expected=kind==='shader'?'Controlled initial UI shader failure':'Controlled initial Canvas text failure';
    assert(message===expected,`Original initialization error not preserved: ${message}`);
    const remaining=Object.fromEntries(Object.entries(live).map(([name,set])=>[name,set.size]));
    const actual={message,realParsed:parsed,geometryDisposes,materialDisposes,contextListeners:observation.listeners(),createdUI:created,remainingUI:remaining,glError:gl.getError()};
    assert(parsed&&geometryDisposes===1&&materialDisposes===1,`Parsed bundle leaked on initialization failure: ${JSON.stringify(actual)}`);
    assert(actual.contextListeners===0,'Renderer context listeners retained on failed initialization');assert(Object.values(remaining).every(n=>n===0),`Partial UI allocations leaked: ${JSON.stringify(remaining)}`);assert(actual.glError===0,'Failed initializer cleanup produced GL error');return actual;
  }finally{GLTFLoader.prototype.parseAsync=originalParse;CanvasRenderingContext2D.prototype.measureText=originalMeasure;gl.getShaderParameter=shaderParameter;gl.getShaderInfoLog=shaderLog;for(const restore of restores)restore();observation.restore();gl.getExtension('WEBGL_lose_context')?.loseContext();}
}
async function demoFixture(mode){
  const canvas=document.createElement('canvas');canvas.width=640;canvas.height=400;const button=document.createElement('button');button.textContent='查看动画示例';document.querySelector('#test-canvases').append(canvas,button);
  const observation=observeCanvas(canvas),originalParse=GLTFLoader.prototype.parseAsync,originalRAF=requestAnimationFrame,originalCancel=cancelAnimationFrame,originalMeasure=CanvasRenderingContext2D.prototype.measureText;
  const scheduled=new Set();let peakRAF=0,parseCalls=0,releaseGate;const gate=new Promise(resolve=>releaseGate=resolve);const unhandled=[];
  const onRejection=e=>{unhandled.push(e.reason?.message||String(e.reason));};window.addEventListener('unhandledrejection',onRejection);
  window.requestAnimationFrame=function(callback){let id;id=originalRAF.call(window,time=>{scheduled.delete(id);callback(time);});scheduled.add(id);peakRAF=Math.max(peakRAF,scheduled.size);return id;};
  window.cancelAnimationFrame=function(id){scheduled.delete(id);return originalCancel.call(window,id);};
  GLTFLoader.prototype.parseAsync=async function(...args){const actual=await originalParse.apply(this,args);parseCalls++;await gate;return actual;};
  const controller=installDemo(canvas,button,{assetUrl});
  try{
    button.click();
    if(mode==='double')button.dispatchEvent(new MouseEvent('click',{bubbles:true}));
    await until(()=>parseCalls>=1,'Real delayed parse did not start');await delay(30);
    if(mode==='pagehide')window.dispatchEvent(new Event('pagehide'));
    if(mode==='failure')CanvasRenderingContext2D.prototype.measureText=function(){throw new Error('Controlled demo text initialization failure');};
    releaseGate();await delay(150);
    const activeListeners=observation.listeners(),allocations=observation.allocations(),activeRAF=scheduled.size;
    const startupButtonText=button.textContent,startupButtonDisabled=button.disabled,reportedError=controller.diagnostics?.lastError;
    controller.stop();await delay(40);
    const actual={realParseCalls:parseCalls,webglAllocations:allocations,activeContextListeners:activeListeners,activeRAF,peakRAF,postStopRAF:scheduled.size,postStopListeners:observation.listeners(),unhandledErrors:unhandled.slice(),startupButtonText,startupButtonDisabled,reportedError,buttonDisabled:button.disabled,buttonText:button.textContent};
    if(mode==='double'){
      assert(parseCalls===1&&allocations===1&&activeRAF===1&&peakRAF===1,`Duplicate demo start created owners/loops: ${JSON.stringify(actual)}`);assert(actual.postStopRAF===0&&actual.postStopListeners===0,'Demo stop retained frame loop/owner');
      button.click();await until(()=>parseCalls===2&&scheduled.size===1,'Stopped demo did not restart');await delay(60);
      actual.restart={realParseCalls:parseCalls,webglAllocations:observation.allocations(),activeRAF:scheduled.size,peakRAF,glError:observation.context().getError()};
      controller.stop();await delay(40);actual.restart.postStopRAF=scheduled.size;actual.restart.postStopListeners=observation.listeners();
      assert(actual.restart.realParseCalls===2&&actual.restart.webglAllocations===2&&actual.restart.activeRAF===1&&actual.restart.peakRAF===1&&actual.restart.glError===0&&actual.restart.postStopRAF===0&&actual.restart.postStopListeners===0,`Demo stop/restart did not cleanly reuse context: ${JSON.stringify(actual.restart)}`);
    }
    if(mode==='pagehide'){assert(allocations===0&&activeListeners===0&&activeRAF===0&&actual.postStopRAF===0,`pagehide accepted stale pending owner: ${JSON.stringify(actual)}`);}
    if(mode==='failure'){assert(allocations===1&&activeListeners===0&&activeRAF===0,'Failed demo startup retained renderer/loop');assert(unhandled.length===0&&!startupButtonDisabled&&startupButtonText==='重试动画示例'&&reportedError==='Controlled demo text initialization failure','Demo initialization rejection/button state was not handled');}
    assert(unhandled.length===0,'Demo caused unhandled rejection');return actual;
  }finally{releaseGate();controller.dispose();for(const id of [...scheduled])originalCancel.call(window,id);window.requestAnimationFrame=originalRAF;window.cancelAnimationFrame=originalCancel;GLTFLoader.prototype.parseAsync=originalParse;CanvasRenderingContext2D.prototype.measureText=originalMeasure;window.removeEventListener('unhandledrejection',onRejection);observation.restore();canvas.getContext('webgl2')?.getExtension('WEBGL_lose_context')?.loseContext();canvas.remove();button.remove();}
}
export async function runLifecycleTests(){
  const results=[];
  async function test(id,input,expected,breakCaught,fn){try{results.push({id,input,expected,breakCaught,status:'passed',actual:await fn()});}catch(error){results.push({id,input,expected,breakCaught,status:'failed',actual:{error:error.message}});}}
  await test('init-failed-shader-cleanup','Actual parsed glTF and renderer, controlled first UI shader rejection','Original error, parsed geometry/material disposed once, renderer listeners removed, failed shader deleted','Missing adapter transaction or failed-shader rollback',()=>initializationFailure('shader'));
  await test('init-failed-text-cleanup','Actual parsed glTF/renderer/UI allocations, controlled native measureText rejection','Original error, parsed geometry/material disposed once, zero renderer listeners/partial UI allocations','Missing rollback after UI resources allocated',()=>initializationFailure('text'));
  await test('demo-double-pending-start','Actual production button twice during delayed real parse, then stop and restart on same canvas','One initial parse/owner/RAF; stop clears; explicit restart one owner/RAF, GL error 0','Missing pending/RAF owner or reused-context unpack handoff',()=>demoFixture('double'));
  await test('demo-pagehide-pending-start','Actual button starts delayed real parse; actual window pagehide before result','No late WebGL owner or RAF after pending start invalidated','Missing signal/generation invalidation on pagehide',()=>demoFixture('pagehide'));
  await test('demo-start-failure-state','Actual production handler; native Canvas initial text error after delayed real parse','No unhandled rejection, no retained renderer/RAF, enabled retry button','Missing handler catch/button restoration',()=>demoFixture('failure'));
  return results;
}
