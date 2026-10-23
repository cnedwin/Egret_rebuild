// SPDX-License-Identifier: Apache-2.0
import {CancellationController,EgretError,Scope} from '@egret/runtime';
import type {Stage} from '@egret/runtime';
import type {CancellationSignal,Diagnostic,ScopeValue} from '@egret/contracts';
import type {createUiDisplayOperations,UiDisplayOperations} from '@egret/runtime/ui';
import type {PointerInputEvents,PointerRouterState} from '../pointerInputTypes.js';

export interface UiScopePort {
  readonly scope:Scope;
  readonly signal:CancellationSignal;
  assertOpen():void;
  use(value:ScopeValue):void;
  dispose():void;
  add(listener:()=>void):void;
  remove(listener:()=>void):void;
}
export interface UiInputPort {
  readonly events:PointerInputEvents;
  state():PointerRouterState;
  activeContacts():number;
  sync():void;
}
export interface UiEnginePort {
  assertOpen():void;
  assertIdle():void;
  isEngineScope(value:unknown):value is Scope;
  createScope():Scope;
  scope(value:unknown):UiScopePort;
  display(factory:typeof createUiDisplayOperations):UiDisplayOperations;
  requireInput(value:unknown):UiInputPort;
  onClose(callback:()=>void):()=>void;
}
interface UiAssembly {
  readonly stage:Stage;
  assertOpen():void;
  isFrameBusy():boolean;
  createScope():Scope;
  report(diagnostic:Diagnostic):void;
  captureCleanup(cause:unknown):void;
}
export interface UiEngineOwner {
  registerScope(scope:Scope):void;
  deliver<T>(callback:()=>T):T;
  close():void;
}
interface Identity {readonly token:object;readonly port:UiEnginePort;readonly deliver:UiEngineOwner['deliver'];}
const engines=new WeakMap<object,Identity>();
const inputs=new WeakMap<object,{readonly token:object;readonly port:UiInputPort}>();
const apply=Reflect.apply;
const state=Object.getOwnPropertyDescriptor(Scope.prototype,'state')!.get!;
const use=Scope.prototype.use,dispose=Scope.prototype.dispose;

/** Eager assembly captures authority; optional UI logic and numerical modules stay lazy. */
export function registerUiEngine(engine:object,assembly:UiAssembly):UiEngineOwner {
  const token={};const scopes=new WeakMap<Scope,CancellationSignal>();
  const closers=new Set<()=>void>();let closed=false;
  const delivery={depth:0};
  // This function retains only a tiny counter, never a closed Engine or Stage.
  const deliver=<T>(callback:()=>T):T=>{delivery.depth++;try{return callback();}finally{delivery.depth--;}};
  const signalPrototype=Object.getPrototypeOf(new CancellationController().signal) as object;
  const aborted=Object.getOwnPropertyDescriptor(signalPrototype,'aborted')!.get!;
  const add=Object.getOwnPropertyDescriptor(signalPrototype,'addEventListener')!.value as CancellationSignal['addEventListener'];
  const remove=Object.getOwnPropertyDescriptor(signalPrototype,'removeEventListener')!.value as CancellationSignal['removeEventListener'];
  const port:UiEnginePort=Object.freeze({
    assertOpen:assembly.assertOpen,
    assertIdle():void {assembly.assertOpen();if(assembly.isFrameBusy()||delivery.depth!==0)throw new EgretError('UI_BUSY');},
    isEngineScope(value:unknown):value is Scope {return scopes.has(value as Scope);},
    createScope:assembly.createScope,
    scope(value:unknown):UiScopePort {
      assembly.assertOpen();const signal=scopes.get(value as Scope);
      if(signal===undefined)throw new EgretError('UI_SCOPE_INVALID');
      const scope=value as Scope;
      const assertOpen=():void=>{assembly.assertOpen();if(apply(state,scope,[])!=='open'||apply(aborted,signal,[])===true)throw new EgretError('SCOPE_CLOSED');};
      assertOpen();return Object.freeze({scope,signal,assertOpen,
        use(value:ScopeValue):void {apply(use,scope,[value]);},
        dispose():void {apply(dispose,scope,[]);},
        add(listener:()=>void):void {apply(add,signal,['abort',listener,Object.freeze({once:true})]);},
        remove(listener:()=>void):void {apply(remove,signal,['abort',listener]);},
      });
    },
    display(factory:typeof createUiDisplayOperations):UiDisplayOperations {
      assembly.assertOpen();return factory(assembly.stage);
    },
    requireInput(value:unknown):UiInputPort {
      assembly.assertOpen();const identity=inputs.get(value as object);
      if(identity===undefined||identity.token!==token)throw new EgretError('UI_INPUT_INVALID');
      return identity.port;
    },
    onClose(callback:()=>void):()=>void {assembly.assertOpen();closers.add(callback);return()=>{closers.delete(callback);};},
  });
  engines.set(engine,{token,port,deliver});
  return Object.freeze({
    registerScope(scope:Scope):void {scopes.set(scope,scope.signal);},
    deliver,
    close():void {
      if(closed)return;closed=true;const callbacks=[...closers];closers.clear();
      for(const callback of callbacks)try{callback();}catch(cause){
        assembly.captureCleanup(cause);assembly.report({code:'UI_CLEANUP_FAILED',phase:'engine',severity:'error',cause});
      }
    },
  });
}

/** Genuine Engine and PointerInput facades are admitted by identity, never shape. */
export function requireUiEngine(engine:unknown):UiEnginePort {
  const identity=engines.get(engine as object);if(identity===undefined)throw new EgretError('UI_ENGINE_INVALID');
  identity.port.assertOpen();return identity.port;
}
export function captureUiInputDelivery(engine:object):UiEngineOwner['deliver'] {
  const identity=engines.get(engine);if(identity===undefined)throw new EgretError('UI_ENGINE_INVALID');return identity.deliver;
}
export function registerUiPointerInput(input:object,engine:object,port:UiInputPort):void {
  const identity=engines.get(engine);if(identity===undefined)throw new EgretError('UI_ENGINE_INVALID');
  inputs.set(input,{token:identity.token,port});
}
