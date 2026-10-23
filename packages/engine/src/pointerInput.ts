// SPDX-License-Identifier: Apache-2.0
import {DisplayObject,DisplayObjectContainer,EgretError,Event,createEventType} from '@egret/runtime';
import {createPointerRouter} from '@egret/runtime/input';
import type {PointerRouter,PointerContact,PointerSession,PointerSample,PointerUpdate,PointerCancelReason} from '@egret/runtime/input';
import type {MouseInputEnginePort} from './mouseInput.js';
import type {Diagnostic} from '@egret/contracts';
import {requireMouseInputEngine} from './internal/mouseInputFactoryState.js';
import {captureUiInputDelivery,registerUiPointerInput} from './internal/uiFactoryState.js';
import type {PointerInput,PointerInputOptions,PointerInputEvents} from './pointerInputTypes.js';
export type {PointerInput,PointerInputOptions,PointerInputEvents,PointerNotification,PointerCancelReason,PointerContact,PointerEventKind,PointerSample,PointerSession,PointerType,PointerUpdate,PointerRouterState} from './pointerInputTypes.js';

const getter=(prototype:object,key:string): ((this:DisplayObject)=>unknown)=>Object.getOwnPropertyDescriptor(prototype,key)!.get!;
const parent=getter(DisplayObject.prototype,'parent'),visible=getter(DisplayObject.prototype,'visible');
const touch=getter(DisplayObject.prototype,'touchEnabled'),children=getter(DisplayObjectContainer.prototype,'touchChildren');
interface SurfaceBinding {readonly surface:object;report(cause:unknown):void;onClose(callback:()=>void):()=>void;}
const bindings=new WeakMap<object,SurfaceBinding>();
// Keep browser-only references in a separate closure, released with its binding.
function surfaceBinding(surface:object,report:(diagnostic:Diagnostic)=>void,onClose:SurfaceBinding['onClose']):SurfaceBinding {
  return Object.freeze({surface,onClose,report:(cause:unknown)=>report({code:'POINTER_INPUT_HOST_FAILED',phase:'engine',severity:'error',cause})});
}

/** Private browser assembly authority; never exported by the optional public entry. */
export function bindPointerSurface(input:PointerInput):SurfaceBinding {
  const binding=bindings.get(input);
  if(binding===undefined||input.state==='closed')throw new EgretError('POINTER_INPUT_CLOSED');
  return binding;
}

export function createPointerInput(options:PointerInputOptions):PointerInput {
  if(options===null||typeof options!=='object'||Array.isArray(options))throw new EgretError('POINTER_INPUT_OPTIONS_INVALID');
  const engine=options.engine;
  let owner:MouseInputEnginePort|undefined=requireMouseInputEngine(engine);
  const deliver=captureUiInputDelivery(engine);
  let scope:ReturnType<MouseInputEnginePort['scope']>|undefined=owner.scope(options.scope);
  const width=options.width,height=options.height,maxNodes=options.maxNodes??4096;
  let observer=options.onContact;
  if(!Number.isFinite(width)||width<=0||!Number.isFinite(height)||height<=0||!Number.isInteger(maxNodes)||maxNodes<1||maxNodes>65536
    ||(observer!==undefined&&typeof observer!=='function'))throw new EgretError('POINTER_INPUT_OPTIONS_INVALID');
  owner.assertReady();scope.assertOpen();
  let operations:MouseInputEnginePort['operations']|undefined=owner.operations;
  const events:PointerInputEvents=Object.freeze({
    begin:createEventType<PointerContact>('egret.pointer.begin',{bubbles:true,cancelable:true}),
    move:createEventType<PointerContact>('egret.pointer.move',{bubbles:true,cancelable:true}),
    end:createEventType<PointerContact>('egret.pointer.end',{bubbles:true,cancelable:true}),
    cancel:createEventType<PointerContact & {readonly reason:PointerCancelReason}>('egret.pointer.cancel',{bubbles:true,cancelable:false}),
  });
  const closers=new Set<()=>void>();
  const activeEvents=new Map<PointerSession,Event<PointerContact>>();
  let router:PointerRouter<DisplayObject>,input:PointerInput,closed=false;
  let releaseEngine:(()=>void)|undefined;
  let calls=0;
  const eligible=(target:DisplayObject):boolean=>{
    if(owner===undefined||scope===undefined||operations===undefined)return false;
    try{owner.assertReady();scope.assertOpen();}catch{return false;}
    if(!operations.isAttached(target,maxNodes)||Reflect.apply(touch,target,[])!==true)return false;
    let node:DisplayObject|undefined=target,count=0;
    while(node!==undefined){
      if(++count>maxNodes)throw new EgretError('HIT_TEST_TREE_LIMIT');
      if(Reflect.apply(visible,node,[])!==true)return false;
      if(node!==target&&Reflect.apply(children,node,[])!==true)return false;
      node=Reflect.apply(parent,node,[]) as DisplayObject|undefined;
    }
    return true;
  };
  function closeNative():void {
    if(closed)return;closed=true;
    releaseEngine?.();releaseEngine=undefined;scope?.remove(retire);
    bindings.delete(input);
    const callbacks=[...closers];closers.clear();
    let first:unknown,failed=false;const cleanup:unknown[]=[];
    for(const callback of callbacks)try{callback();}catch(cause){if(!failed){first=cause;failed=true;}else cleanup.push(cause);}
    owner=undefined;scope=undefined;operations=undefined;observer=undefined;
    if(failed)throw new EgretError('POINTER_INPUT_CLEANUP_FAILED',{cause:first,cleanupErrors:cleanup});
  }
  function invoke<T>(operation:()=>T):T {
    let value:T|undefined,first:unknown,failed=false;
    calls++;
    try{value=operation();}catch(cause){failed=true;first=cause;}finally{calls--;}
    if(calls===0&&router.state==='closed')try{closeNative();}catch(cause){
      if(failed)throw new EgretError('POINTER_INPUT_CALLBACK_FAILED',{cause:first,cleanupErrors:[cause]});
      throw cause;
    }
    if(failed)throw first;
    return value as T;
  }
  function retire():void {invoke(()=>router.dispose());}
  router=createPointerRouter<DisplayObject>({
    ...(options.capacity===undefined?{}:{capacity:options.capacity}),
    pick:(x,y)=>{owner!.assertReady();scope!.assertOpen();return operations!.pick(x,y,maxNodes);},eligible,
    dispatch:(kind,contact,target,reason)=>deliver(()=>{
      // Termination during capture/target callbacks must stop the older route.
      if(kind==='cancel')activeEvents.get(contact.session)?.stopImmediatePropagation();
      // Observer receives terminal cleanup even when its display target no longer exists.
      const notification=Object.freeze({kind,contact,target,...(reason===undefined?{}:{reason})});
      observer?.(notification);
      if(target===undefined||!eligible(target))return;
      // A callback may synchronously cancel or close the session before target delivery.
      if((kind==='begin'||kind==='move')&&!router.contacts.some(value=>value.session===contact.session))return;
      if(kind==='cancel')operations!.dispatch(target,Object.freeze(new Event(events.cancel,Object.freeze({...contact,reason:reason!}))),maxNodes);
      else {
        const event=Object.freeze(new Event(events[kind],contact));
        if(kind==='begin'||kind==='move')activeEvents.set(contact.session,event);
        try{operations!.dispatch(target,event,maxNodes);}
        finally{if(activeEvents.get(contact.session)===event)activeEvents.delete(contact.session);}
      }
    }),
  });
  input=Object.freeze({
    get state(){return router.state;},get contacts(){return router.contacts;},get viewportRevision(){return router.viewportRevision;},events,
    begin:(sample:PointerSample)=>invoke(()=>router.begin(sample)),
    move:(session:PointerSession,sample:PointerUpdate)=>invoke(()=>router.move(session,sample)),
    end:(session:PointerSession,sample:PointerUpdate)=>invoke(()=>router.end(session,sample)),
    cancel:(session:PointerSession,reason:PointerCancelReason)=>invoke(()=>router.cancel(session,reason)),
    cancelAll:(reason:PointerCancelReason)=>invoke(()=>router.cancelAll(reason)),
    capture:(session:PointerSession,target:DisplayObject)=>invoke(()=>router.capture(session,target)),
    releaseCapture:(session:PointerSession)=>invoke(()=>router.releaseCapture(session)),
    sync:()=>invoke(()=>router.sync()),setViewportRevision:(revision:number)=>invoke(()=>router.setViewportRevision(revision)),
    setInteractive:(value:boolean)=>invoke(()=>router.setInteractive(value)),dispose:retire,
  });
  registerUiPointerInput(input,engine,Object.freeze({events,state:()=>router.state,activeContacts:()=>router.contacts.length,sync:input.sync}));
  try{
    releaseEngine=owner.onClose(retire);scope.add(retire);scope.use(input);
    bindings.set(input,surfaceBinding(owner.surface,owner.report,
      (callback:()=>void):(()=>void)=>{if(closed){callback();return ()=>{};}closers.add(callback);return ()=>{closers.delete(callback);};}));
    owner.assertReady();scope.assertOpen();
    return input;
  }catch(cause){try{retire();}catch(cleanup){throw new EgretError('POINTER_INPUT_SETUP_FAILED',{cause,cleanupErrors:[cleanup]});}throw cause;}
}
