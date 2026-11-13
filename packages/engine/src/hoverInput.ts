// SPDX-License-Identifier: Apache-2.0
import {DisplayObject,DisplayObjectContainer,EgretError,Event,createEventType} from '@egret/runtime';
import type {MouseInputEnginePort} from './mouseInput.js';
import {requireMouseInputEngine} from './internal/mouseInputFactoryState.js';
import {captureUiInputDelivery} from './internal/uiFactoryState.js';
import type {HoverInput,HoverInputEvents,HoverInputOptions,HoverInputState,HoverLeaveReason,HoverNotification,HoverPoint,HoverSample,HoverState,WheelNotification,WheelPoint,WheelSample} from './hoverInputTypes.js';
export type {HoverInput,HoverInputEvents,HoverInputOptions,HoverInputState,HoverLeaveReason,HoverNotification,HoverPoint,HoverPointerType,HoverSample,HoverState,WheelNotification,WheelPoint,WheelSample,WheelUnit} from './hoverInputTypes.js';

const getter=(prototype:object,key:string): ((this:DisplayObject)=>unknown)=>Object.getOwnPropertyDescriptor(prototype,key)!.get!;
const parent=getter(DisplayObject.prototype,'parent'),visible=getter(DisplayObject.prototype,'visible');
const touch=getter(DisplayObject.prototype,'touchEnabled'),children=getter(DisplayObjectContainer.prototype,'touchChildren');
const reasons:readonly HoverLeaveReason[]=Object.freeze(['target','outside','contact','pointercancel','owner','viewport','blur','hidden','pagehide','suspended','dispose','error']);
interface Entry {point:HoverPoint;target:DisplayObject|undefined;}
const finite=(value:unknown):value is number=>typeof value==='number'&&Number.isFinite(value);
const count=(value:unknown):value is number=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=0;

/**
 * Hover and wheel routing over the display tree of a started Engine. It holds no contact: a press
 * belongs to the pointer input, and a pointer that presses stops hovering until it is released.
 */
export function createHoverInput(options:HoverInputOptions):HoverInput {
  if(options===null||typeof options!=='object'||Array.isArray(options))throw new EgretError('HOVER_INPUT_OPTIONS_INVALID');
  const engine=options.engine;
  let owner:MouseInputEnginePort|undefined=requireMouseInputEngine(engine);
  const deliver=captureUiInputDelivery(engine);
  let scope:ReturnType<MouseInputEnginePort['scope']>|undefined=owner.scope(options.scope);
  const width=options.width,height=options.height,maxNodes=options.maxNodes??4096,capacity=options.capacity??4;
  let onHover=options.onHover,onWheel=options.onWheel;
  if(!finite(width)||width<=0||!finite(height)||height<=0||!Number.isInteger(maxNodes)||maxNodes<1||maxNodes>65536
    ||!Number.isInteger(capacity)||capacity<1||capacity>16
    ||(onHover!==undefined&&typeof onHover!=='function')||(onWheel!==undefined&&typeof onWheel!=='function'))throw new EgretError('HOVER_INPUT_OPTIONS_INVALID');
  owner.assertReady();scope.assertOpen();
  let operations:MouseInputEnginePort['operations']|undefined=owner.operations;
  const events:HoverInputEvents=Object.freeze({
    enter:createEventType<HoverPoint>('egret.pointer.enter',{bubbles:true,cancelable:false}),
    move:createEventType<HoverPoint>('egret.pointer.hover',{bubbles:true,cancelable:false}),
    leave:createEventType<HoverPoint & {readonly reason:HoverLeaveReason}>('egret.pointer.leave',{bubbles:true,cancelable:false}),
    wheel:createEventType<WheelPoint>('egret.pointer.wheel',{bubbles:true,cancelable:true}),
  });
  const entries=new Map<number,Entry>();
  const closers=new Set<()=>void>();
  let input:HoverInput,state:HoverInputState='active',closed=false,releaseEngine:(()=>void)|undefined;
  let revision=0,sequence=0,observedTime=0,sampling=0,calls=0,failure:EgretError|undefined;

  const eligible=(target:DisplayObject):boolean=>{
    if(owner===undefined||scope===undefined||operations===undefined)return false;
    try{owner.assertReady();scope.assertOpen();}catch{return false;}
    if(!operations.isAttached(target,maxNodes)||Reflect.apply(touch,target,[])!==true)return false;
    let node:DisplayObject|undefined=target,visited=0;
    while(node!==undefined){
      if(++visited>maxNodes)throw new EgretError('HIT_TEST_TREE_LIMIT');
      if(Reflect.apply(visible,node,[])!==true)return false;
      if(node!==target&&Reflect.apply(children,node,[])!==true)return false;
      node=Reflect.apply(parent,node,[]) as DisplayObject|undefined;
    }
    return true;
  };
  function closeNative():void {
    if(closed)return;closed=true;
    releaseEngine?.();releaseEngine=undefined;scope?.remove(retire);
    const callbacks=[...closers];closers.clear();
    let first:unknown,failed=false;const cleanup:unknown[]=[];
    for(const callback of callbacks)try{callback();}catch(cause){if(!failed){first=cause;failed=true;}else cleanup.push(cause);}
    owner=undefined;scope=undefined;operations=undefined;onHover=undefined;onWheel=undefined;
    if(failed)throw new EgretError('HOVER_INPUT_CLEANUP_FAILED',{cause:first,cleanupErrors:cleanup});
  }
  /** Every public operation: the first failure of a callback is kept, and a closed input lets go of the Engine. */
  function invoke<T>(operation:()=>T):T {
    let value:T|undefined,first:unknown,failed=false;
    calls++;
    try{value=operation();}catch(cause){failed=true;first=cause;}finally{calls--;}
    if(calls===0){
      failure=undefined;
      if(state==='closed')try{closeNative();}catch(cause){
        if(failed)throw new EgretError('HOVER_INPUT_CALLBACK_FAILED',{cause:first,cleanupErrors:[cause]});
        throw cause;
      }
    }
    if(failed)throw first;
    return value as T;
  }
  function stamp<T extends object>(value:T):T & {readonly sequence:number;readonly viewportRevision:number} {
    if(!Number.isSafeInteger(sequence+1))throw new EgretError('HOVER_INPUT_EXHAUSTED');
    return Object.freeze({...value,sequence:++sequence,viewportRevision:revision});
  }
  /** One observation: the observer first, then the target path while the target can still be reached. */
  function publish(kind:HoverNotification['kind'],point:HoverPoint,target:DisplayObject,reason?:HoverLeaveReason):void {
    deliver(()=>{
      onHover?.(Object.freeze({kind,point,target,...(reason===undefined?{}:{reason})}));
      if(operations===undefined||!eligible(target))return;
      if(kind==='leave')operations.dispatch(target,Object.freeze(new Event(events.leave,Object.freeze({...point,reason:reason!}))),maxNodes);
      else operations.dispatch(target,Object.freeze(new Event(events[kind],point)),maxNodes);
    });
  }
  // A failed callback closes the input. What was hovered is told once, with every later failure kept apart.
  function fail(cause:unknown):never {
    if(failure!==undefined)throw failure;
    state='closed';
    const pending=[...entries.values()];entries.clear();
    const cleanupErrors:unknown[]=[];
    for(const entry of pending){
      if(entry.target===undefined)continue;
      try{publish('leave',stamp({...entry.point}) as HoverPoint,entry.target,'error');}catch(error){cleanupErrors.push(error);}
    }
    failure=new EgretError('HOVER_INPUT_CALLBACK_FAILED',{cause,cleanupErrors});
    throw failure;
  }
  function guarded<T>(action:()=>T):T {
    try{const value=action();if(failure!==undefined)throw failure;return value;}catch(cause){return fail(cause);}
  }
  function pick(x:number,y:number):DisplayObject|undefined {
    return guarded(()=>{
      owner!.assertReady();scope!.assertOpen();
      const target=operations!.pick(x,y,maxNodes);
      return target===undefined||!eligible(target)?undefined:target;
    });
  }
  /** Moves one pointer from what it was over to what it is over now. */
  function settle(id:number,entry:Entry,point:HoverPoint,next:DisplayObject|undefined,reason:HoverLeaveReason):void {
    const previous=entry.target;
    entry.point=point;
    if(previous===next){if(next!==undefined)guarded(()=>publish('move',point,next));return;}
    // Over nothing while the old target is told: a listener that ends this hover must not leave a target that was never entered.
    entry.target=undefined;
    if(previous!==undefined)guarded(()=>publish('leave',point,previous,reason));
    // A leave listener may have removed this pointer or closed the input.
    if(next===undefined||state!=='active'||entries.get(id)!==entry||entry.point!==point)return;
    entry.target=next;
    guarded(()=>publish('enter',point,next));
  }
  function drop(id:number,reason:HoverLeaveReason):boolean {
    const entry=entries.get(id);
    if(entry===undefined)return false;
    entries.delete(id);
    if(entry.target!==undefined){const target=entry.target;guarded(()=>publish('leave',stamp({...entry.point}) as HoverPoint,target,reason));}
    return true;
  }
  function dropAll(reason:HoverLeaveReason):void {for(const id of [...entries.keys()])if(state!=='closed'||reason==='dispose')drop(id,reason);}
  // A callback run by an operation may close the input behind a check made before it.
  function isClosed():boolean {return state==='closed';}
  function checkReason(reason:HoverLeaveReason):void {if(!reasons.includes(reason))throw new EgretError('HOVER_INPUT_REASON');}
  /** A sample may not arrive while another sample or wheel is being routed. */
  function exclusive<T>(action:()=>T):T {
    if(sampling!==0)throw new EgretError('HOVER_INPUT_REENTRANT');
    sampling++;
    try{return action();}finally{sampling--;}
  }
  function retire():void {
    invoke(()=>{
      if(state==='closed')return;
      state='closed';
      try{dropAll('dispose');}finally{entries.clear();}
    });
  }

  input=Object.freeze({
    get state(){return state;},events,width,height,
    get viewportRevision(){return revision;},
    get hovers():readonly HoverState[]{return Object.freeze([...entries.values()].map(entry=>Object.freeze({point:entry.point,target:entry.target})));},
    sample:(sample:HoverSample):DisplayObject|undefined=>invoke(()=>exclusive(()=>{
      let pointerId:unknown,pointerType:unknown,globalX:unknown,globalY:unknown,timestamp:unknown;
      try{if(sample===null||typeof sample!=='object')throw new EgretError('HOVER_INPUT_SAMPLE');({pointerId,pointerType,globalX,globalY,timestamp}=sample);}
      catch(cause){if(cause instanceof EgretError)throw cause;throw new EgretError('HOVER_INPUT_SAMPLE',{cause});}
      if(!count(pointerId)||(pointerType!=='mouse'&&pointerType!=='pen')||!finite(globalX)||!finite(globalY)||!finite(timestamp)||timestamp<0||timestamp<observedTime)throw new EgretError('HOVER_INPUT_SAMPLE');
      if(state!=='active')return undefined;
      let entry=entries.get(pointerId);
      if(entry!==undefined&&entry.point.pointerType!==pointerType)throw new EgretError('HOVER_INPUT_SAMPLE');
      if(entry===undefined&&entries.size>=capacity)throw new EgretError('HOVER_INPUT_CAPACITY');
      const next=pick(globalX,globalY);
      if(state!=='active')return undefined;
      const point=stamp({pointerId,pointerType,globalX,globalY,timestamp}) as HoverPoint;
      observedTime=timestamp;
      // The pick may have run a callback that removed this pointer; it then arrives afresh.
      entry=entries.get(pointerId);
      if(entry===undefined){entry={point,target:undefined};entries.set(pointerId,entry);}
      // What it was over may have left the stage since: that is the owner's doing, not the pointer's.
      const reason:HoverLeaveReason=entry.target!==undefined&&entry.target!==next&&!guarded(()=>eligible(entry!.target!))?'owner':'target';
      settle(pointerId,entry,point,next,reason);
      return state==='active'&&entries.get(pointerId)===entry?entry.target:undefined;
    })),
    leave:(pointerId:number,reason:HoverLeaveReason):boolean=>invoke(()=>{checkReason(reason);return state==='closed'?false:drop(pointerId,reason);}),
    leaveAll:(reason:HoverLeaveReason):void=>invoke(()=>{checkReason(reason);if(state!=='closed')dropAll(reason);}),
    wheel:(sample:WheelSample):boolean=>invoke(()=>exclusive(()=>{
      let globalX:unknown,globalY:unknown,deltaX:unknown,deltaY:unknown,deltaZ:unknown,unit:unknown,timestamp:unknown,zoom:unknown;
      try{if(sample===null||typeof sample!=='object')throw new EgretError('HOVER_INPUT_SAMPLE');({globalX,globalY,deltaX,deltaY,deltaZ,unit,timestamp,zoom}=sample);}
      catch(cause){if(cause instanceof EgretError)throw cause;throw new EgretError('HOVER_INPUT_SAMPLE',{cause});}
      if(!finite(globalX)||!finite(globalY)||!finite(deltaX)||!finite(deltaY)||(deltaZ!==undefined&&!finite(deltaZ))||(unit!=='pixel'&&unit!=='line'&&unit!=='page')
        ||!finite(timestamp)||timestamp<0||timestamp<observedTime||(zoom!==undefined&&typeof zoom!=='boolean'))throw new EgretError('HOVER_INPUT_SAMPLE');
      if(state!=='active')return false;
      const target=pick(globalX,globalY);
      if(state!=='active')return false;
      const point=stamp({globalX,globalY,deltaX,deltaY,...(deltaZ===undefined?{}:{deltaZ}),unit,timestamp,...(zoom===undefined?{}:{zoom})}) as WheelPoint;
      observedTime=timestamp;
      return guarded(()=>{
        let consumed=false;
        deliver(()=>{
          if(target!==undefined&&eligible(target))consumed=!operations!.dispatch(target,Object.freeze(new Event(events.wheel,point)),maxNodes);
          if(onWheel?.(Object.freeze({point,target,consumed}))===true)consumed=true;
        });
        return consumed;
      });
    })),
    sync:():void=>invoke(()=>exclusive(()=>{
      if(state!=='active')return;
      for(const [id,entry] of [...entries]){
        if(state!=='active')return;
        if(entries.get(id)!==entry)continue;
        const next=pick(entry.point.globalX,entry.point.globalY);
        if(state!=='active'||entries.get(id)!==entry||next===entry.target)continue;
        const reason:HoverLeaveReason=entry.target!==undefined&&!guarded(()=>eligible(entry.target!))?'owner':'target';
        settle(id,entry,stamp({pointerId:id,pointerType:entry.point.pointerType,globalX:entry.point.globalX,globalY:entry.point.globalY,timestamp:entry.point.timestamp}) as HoverPoint,next,reason);
      }
    })),
    setViewportRevision:(next:number):void=>invoke(()=>{
      if(!count(next)||next<=revision)throw new EgretError('HOVER_INPUT_VIEWPORT');
      if(state==='closed')return;
      // What was hovered is told under the old mapping; only later samples use the new one.
      dropAll('viewport');
      if(!isClosed())revision=next;
    }),
    setInteractive:(interactive:boolean):void=>invoke(()=>{
      if(typeof interactive!=='boolean')throw new EgretError('HOVER_INPUT_OPTIONS_INVALID');
      if(state==='closed')return;
      if(interactive)state='active';
      else{state='suspended';dropAll('suspended');}
    }),
    onClose:(listener:()=>void):(()=>void)=>{
      if(typeof listener!=='function')throw new EgretError('HOVER_INPUT_OPTIONS_INVALID');
      if(closed){listener();return ()=>{};}
      closers.add(listener);return ()=>{closers.delete(listener);};
    },
    dispose:retire,
  });
  try{
    releaseEngine=owner.onClose(retire);scope.add(retire);scope.use(input);
    owner.assertReady();scope.assertOpen();
    return input;
  }catch(cause){try{retire();}catch(cleanup){throw new EgretError('HOVER_INPUT_SETUP_FAILED',{cause,cleanupErrors:[cleanup]});}throw cause;}
}
