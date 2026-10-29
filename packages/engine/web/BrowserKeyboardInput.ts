// SPDX-License-Identifier: Apache-2.0
import {EgretError} from '@egret/runtime';
import {bindKeyboardSurface,createKeyboardInput} from '#egret-keyboard-input';
import type {KeyboardInput,KeyboardInputOptions,KeyboardSample,KeyboardCancelReason} from '#egret-keyboard-input';
const apply=Reflect.apply,owned=new WeakSet<object>();
type Operation=(...args:unknown[])=>unknown;
function getter(prototype:object|undefined,name:string):Operation {const value=prototype===undefined?undefined:Object.getOwnPropertyDescriptor(prototype,name)?.get;if(typeof value!=='function')throw new EgretError('KEYBOARD_INPUT_SURFACE_INVALID');return value;}
function method(prototype:object|undefined,name:string):Operation {const value=prototype===undefined?undefined:Object.getOwnPropertyDescriptor(prototype,name)?.value;if(typeof value!=='function')throw new EgretError('KEYBOARD_INPUT_SURFACE_INVALID');return value as Operation;}
interface Pair {readonly target:EventTarget;readonly type:string;readonly listener:EventListener;adding:boolean;removed:boolean;}
/** Canvas-local native keyboard bridge. Canvas focus remains application-owned. */
export function createBrowserKeyboardInput(options:KeyboardInputOptions):KeyboardInput {
 const input=createKeyboardInput(options),bridge=bindKeyboardSurface(input),surface=bridge.surface;
 const pairs:Pair[]=[];let closed=false,paused=false,busy=false,claimed=false;
 let removeClose=()=>{},removeInteractive=()=>{},restore=()=>{};
 let remove:Operation=()=>{},add:Operation=()=>{};
 function removePair(pair:Pair):void {if(pair.adding||pair.removed)return;pair.removed=true;apply(remove,pair.target,[pair.type,pair.listener,false]);}
 function detach():void {let failure:unknown,failed=false;for(const pair of pairs.slice().reverse())try{removePair(pair);}catch(cause){if(!failed){failed=true;failure=cause;}}if(failed)throw failure;}
 function cleanup():void {
  if(closed)return;closed=true;
  const failures:unknown[]=[];for(const action of [detach,restore,removeClose,removeInteractive])try{action();}catch(cause){failures.push(cause);}
  if(claimed&&!pairs.some(pair=>pair.adding)){owned.delete(surface);claimed=false;}
  for(const cause of failures)bridge.report(cause);
 }
 function fail(cause:unknown):void {try{input.dispose();}catch(secondary){bridge.report(secondary);}finally{cleanup();}bridge.report(cause);}
 try{
  removeClose=bridge.onClose(cleanup);
  const win=globalThis.window,document=globalThis.document;
  if(win===undefined||document===undefined)throw new EgretError('KEYBOARD_INPUT_SURFACE_INVALID');
  const canvasBrand=getter(globalThis.HTMLCanvasElement?.prototype,'width'),ownerDocument=getter(globalThis.Node?.prototype,'ownerDocument'),connected=getter(globalThis.Node?.prototype,'isConnected');
  const defaultView=getter(globalThis.Document?.prototype,'defaultView'),active=getter(globalThis.Document?.prototype,'activeElement'),visibility=getter(globalThis.Document?.prototype,'visibilityState');
  const target=getter(globalThis.Event?.prototype,'target'),type=getter(globalThis.Event?.prototype,'type'),prevent=method(globalThis.Event?.prototype,'preventDefault');
  const code=getter(globalThis.KeyboardEvent?.prototype,'code'),key=getter(globalThis.KeyboardEvent?.prototype,'key'),repeat=getter(globalThis.KeyboardEvent?.prototype,'repeat'),composing=getter(globalThis.KeyboardEvent?.prototype,'isComposing');
  const alt=getter(globalThis.KeyboardEvent?.prototype,'altKey'),ctrl=getter(globalThis.KeyboardEvent?.prototype,'ctrlKey'),meta=getter(globalThis.KeyboardEvent?.prototype,'metaKey'),shift=getter(globalThis.KeyboardEvent?.prototype,'shiftKey');
  const getAttribute=method(globalThis.Element?.prototype,'getAttribute'),setAttribute=method(globalThis.Element?.prototype,'setAttribute'),removeAttribute=method(globalThis.Element?.prototype,'removeAttribute');
  add=method(globalThis.EventTarget?.prototype,'addEventListener');remove=method(globalThis.EventTarget?.prototype,'removeEventListener');
  function authentic():void {apply(canvasBrand,surface,[]);if(apply(ownerDocument,surface,[])!==document||apply(defaultView,document,[])!==win||apply(connected,surface,[])!==true)throw new EgretError('KEYBOARD_INPUT_SURFACE_INVALID');}
  authentic();if(owned.has(surface))throw new EgretError('KEYBOARD_INPUT_IN_USE');owned.add(surface);claimed=true;
  if(apply(getAttribute,surface,['tabindex'])===null){
   // Restore only the exact value still owned by this bridge.
   restore=()=>{if(apply(getAttribute,surface,['tabindex'])==='0')apply(removeAttribute,surface,['tabindex']);};
   apply(setAttribute,surface,['tabindex','0']);
  }
  function cancel(reason:KeyboardCancelReason):void {input.cancel(reason);}
  function keyboard(event:Event,down:boolean):void {
   authentic();if(apply(active,document,[])!==surface||apply(target,event,[])!==surface||apply(visibility,document,[])!=='visible')return;
   const physical=apply(code,event,[]),logical=apply(key,event,[]);
   if(apply(composing,event,[])===true||logical==='Process'||logical==='Dead'||physical==='')return;
   const sample:KeyboardSample={code:physical as string,key:logical as string,repeat:apply(repeat,event,[]) as boolean,altKey:apply(alt,event,[]) as boolean,ctrlKey:apply(ctrl,event,[]) as boolean,metaKey:apply(meta,event,[]) as boolean,shiftKey:apply(shift,event,[]) as boolean};
   const prevented=down?input.keyDown(sample):input.keyUp(sample);
   // Prevention belongs to this original native event even if its genuine
   // handler synchronously suspended, closed, or handed focus to an editor.
   if(prevented)apply(prevent,event,[]);
   if(closed||paused)return;
   if(apply(active,document,[])!==surface)return;
   if(!prevented&&down&&logical==='Tab'&&!sample.altKey&&!sample.ctrlKey&&!sample.metaKey){
    const next=input.moveFocus(sample.shiftKey?'previous':'next');if(next!==undefined)apply(prevent,event,[]);
   }
  }
  function listen(eventTarget:EventTarget,eventType:string,action:(event:Event)=>void):void {
   const listener:EventListener=event=>{
    if(closed||paused)return;if(busy&&(eventType==='keydown'||eventType==='keyup')){fail(new EgretError('KEYBOARD_INPUT_REENTRANT'));return;}
    const wasBusy=busy;busy=true;try{if(apply(type,event,[])===eventType)action(event);}catch(cause){fail(cause);}finally{busy=wasBusy;}
   };
   pairs.push({target:eventTarget,type:eventType,listener,adding:false,removed:true});
  }
  function attach():void {
   authentic();for(const pair of pairs){if(closed||paused)break;if(!pair.removed)continue;pair.removed=false;pair.adding=true;try{apply(add,pair.target,[pair.type,pair.listener,false]);}finally{pair.adding=false;if(closed||paused)removePair(pair);}}
   if(closed&&claimed){owned.delete(surface);claimed=false;}
  }
  listen(surface as EventTarget,'keydown',event=>keyboard(event,true));listen(win,'keyup',event=>keyboard(event,false));
  listen(surface as EventTarget,'blur',()=>cancel('blur'));listen(win,'blur',()=>cancel('blur'));listen(win,'pagehide',()=>cancel('pagehide'));
  listen(document,'visibilitychange',()=>{if(apply(visibility,document,[])!=='visible')cancel('hidden');});
  removeInteractive=bridge.onInteractive(value=>{paused=!value;if(paused)detach();else attach();});
  attach();if(closed||input.getSnapshot().state==='closed')throw new EgretError('KEYBOARD_INPUT_CLOSED');return input;
 }catch(cause){cleanup();try{input.dispose();}catch(secondary){bridge.report(secondary);}throw cause;}
}
