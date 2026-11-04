// SPDX-License-Identifier: Apache-2.0
// One optional CPU RESET slot; Host staging and presentation remain caller-owned.
import { Engine, Scope, DisplayObject, DisplayObjectContainer, EgretError } from '@egret/engine';
import type { DisplaySubtreeTicket, SharedFrameOptions2D } from '@egret/engine';
import type { SpineResetInitial, SpineResetRequest, SpineResetSlot, SpineResetActive, SpineResetTicket, SpineResetState } from './resetTypes.js';
import type { SpineContentGroup, SpineContentLoader } from './types.js';
import { createSpineInstance } from './instance.js';
import { createSpineDisplay } from './display.js';
import { requireSpineRender } from './renderAuthority.js';
import { authenticateResetDisplay, authenticateResetLoader } from './resetAuthority.js';

const apply=Reflect.apply,freeze=Object.freeze,createScope=Engine.prototype.createScope;
const prepare=Engine.prototype.prepareDisplaySubtree,capture=Engine.prototype.capturePreparedDisplaySharedFrame;
const use=Scope.prototype.use,close=Scope.prototype.dispose;
const scopeState=Object.getOwnPropertyDescriptor(Scope.prototype,'state')!.get!;
const count=Object.getOwnPropertyDescriptor(DisplayObjectContainer.prototype,'numChildren')!.get!;
const child=DisplayObjectContainer.prototype.getChildAt,parent=Object.getOwnPropertyDescriptor(DisplayObject.prototype,'parent')!.get!;
const claims=new WeakMap<object,SpineResetSlot>();
function fault(code:string,cause?:unknown):EgretError{return new EgretError('SPINE_RESET_'+code,{cause});}
function label(value:unknown,max=128):value is string{return typeof value==='string'&&value.length>0&&value.length<=max;}
function record(value:unknown,keys:readonly string[],check:()=>void):Record<string,unknown>{
  if(!value||typeof value!=='object')throw fault('OPTIONS_INVALID');
  const result:Record<string,unknown>=Object.create(null) as Record<string,unknown>;
  const names=Reflect.ownKeys(value);check();
  for(const key of names){if(typeof key!=='string'||!keys.includes(key))throw fault('OPTIONS_INVALID');const row=Object.getOwnPropertyDescriptor(value,key);check();if(!row||!Object.hasOwn(row,'value'))throw fault('OPTIONS_INVALID');result[key]=row.value;}
  return result;
}
/** Borrow an existing sole-child display; replacement groups/players are slot-owned. */
export function createSpineResetSlot(engine:Engine,scope:Scope,target:DisplayObjectContainer,initial:SpineResetInitial):SpineResetSlot{
  // The original Engine factory authenticates engine without any structural facade.
  const validation=apply(createScope,engine,[]) as Scope;
  let initialValue:SpineResetActive;
  try{
    const row=record(initial,['version','instance','display'],()=>{if(apply(scopeState,scope,[])!=='open')throw fault('SCOPE_CLOSED');});
    if(!label(row.version))throw fault('OPTIONS_INVALID');
    const value=row as unknown as SpineResetInitial;
    authenticateResetDisplay(value.display,value.instance);
    const port=requireSpineRender(value.instance);port.asset.authenticate(scope,false);port.asset.authenticate(validation,false);
    if(target===engine.stage||apply(count,target,[])!==1||apply(child,target,[0])!==value.display.node)throw fault('TARGET_INVALID');
    let ancestor:DisplayObject|undefined=target;
    for(let depth=0;ancestor!==engine.stage;depth++){if(!ancestor||depth>=128)throw fault('TARGET_INVALID');ancestor=apply(parent,ancestor,[]) as DisplayObject|undefined;}
    if(claims.has(target))throw fault('TARGET_CLAIMED');
    initialValue=freeze({version:value.version,instance:value.instance,display:value.display,ownership:'borrowed'});
  }finally{apply(close,validation,[]);}
  let disposed=false,busy=false,intent=0,active=initialValue,activeScope:Scope|undefined;
  let pending:{cancel:()=>void}|undefined;
  function open():void{if(disposed||apply(scopeState,scope,[])!=='open')throw fault('DISPOSED');}
  function idle():void{open();if(busy)throw fault('REENTRANT');}
  function intact():void{
    open();authenticateResetDisplay(active.display,active.instance);
    if(apply(count,target,[])!==1||apply(child,target,[0])!==active.display.node)throw fault('TARGET_CHANGED');
  }
  const slot:SpineResetSlot=freeze({
    get isDisposed(){return disposed;},
    getActive(){open();return active;},
    dispose(){
      if(disposed)return;disposed=true;intent++;claims.delete(target);
      const owned=activeScope;activeScope=undefined;const prior=pending;pending=undefined;
      try{prior?.cancel();}finally{if(owned)apply(close,owned,[]);}
    },
    request(request:SpineResetRequest):SpineResetTicket{
      idle();busy=true;
      let candidateScope:Scope|undefined;
      try{
        intact();
        const row=record(request,['policy','version','loader','assetId','animation','skins','loop','plays','onEvent'],open);
        if(row.policy!=='reset'||!label(row.version)||!label(row.assetId,512)||!label(row.animation,1024)
            ||row.loop!==undefined&&typeof row.loop!=='boolean'
            ||row.plays!==undefined&&(!Number.isSafeInteger(row.plays)||(row.plays as number)<1||(row.plays as number)>1024||row.loop!==undefined)
            ||row.onEvent!==undefined&&typeof row.onEvent!=='function')throw fault('OPTIONS_INVALID');
        let skins:readonly string[]|undefined;
        if(row.skins!==undefined){
          if(!Array.isArray(row.skins))throw fault('OPTIONS_INVALID');
          const length=Object.getOwnPropertyDescriptor(row.skins,'length');open();const size:unknown=length?.value;
          if(!length||!Object.hasOwn(length,'value')||!Number.isSafeInteger(size)||(size as number)<1||(size as number)>32)throw fault('OPTIONS_INVALID');
          const names:string[]=[];
          for(let i=0;i<(size as number);i++){const item=Object.getOwnPropertyDescriptor(row.skins,String(i));open();if(!item||!Object.hasOwn(item,'value')||!label(item.value,1024)||names.includes(item.value))throw fault('OPTIONS_INVALID');names.push(item.value);}
          skins=freeze(names);
        }
        candidateScope=apply(createScope,engine,[]) as Scope;
        const owned=candidateScope;
        authenticateResetLoader(row.loader as SpineContentLoader,owned);open();
        // Admission is complete before superseding the previous accepted intent.
        const id=++intent,prior=pending;
        let state:SpineResetState='loading',group:SpineContentGroup|undefined,next:SpineResetActive|undefined,tree:DisplaySubtreeTicket|undefined;
        let resolve!:()=>void,reject!:(cause:unknown)=>void;
        const ready=new Promise<void>((yes,no)=>{resolve=yes;reject=no;});void ready.catch(()=>{});
        function current():void{open();if(id!==intent||state==='cancelled'||state==='failed'||state==='committed')throw fault('RETIRED');}
        function cancel():void{
          if(state==='committed'||state==='cancelled'||state==='failed')return;
          state='cancelled';tree?.dispose();tree=undefined;reject(fault('CANCELLED'));
          if(pending===demand)pending=undefined;apply(close,owned,[]);
        }
        const demand={cancel};pending=demand;
        const ticket:SpineResetTicket=freeze({
          get ready(){return ready;},get state(){return state;},
          capture(options:SharedFrameOptions2D){
            idle();current();intact();if(!next||state!=='ready')throw fault('NOT_READY');
            busy=true;
            try{
              tree?.dispose();tree=undefined;state='ready';
              tree=apply(prepare,engine,[owned,target,next.display.node]) as DisplaySubtreeTicket;
              const frame=apply(capture,engine,[tree,options]);current();state='prepared';return frame;
            }catch(cause){throw fail(cause);}
            finally{busy=false;}
          },
          commit(){
            idle();current();intact();if(state!=='prepared'||!tree||!next)throw fault('NOT_PREPARED');
            busy=true;
            try{
              tree.commit();
              // Nothing externally callable occurs between tree publication and active/state publication.
              const previous=activeScope;active=next;activeScope=owned;state='committed';tree=undefined;pending=undefined;
              try{if(previous)apply(close,previous,[]);}catch(cause){throw fault('POSTCOMMIT_FAILED',cause);}
              return active;
            }finally{busy=false;}
          },
          dispose(){cancel();},
        });
        candidateScope=undefined;
        try{prior?.cancel();current();}catch(cause){throw fail(cause);}
        try{
          group=(row.loader as SpineContentLoader).load(owned,[row.assetId as string]);
          void group.ready.then(()=>{
            try{
              current();const asset=group!.getSpine(row.assetId as string);
              const instance=createSpineInstance(asset,owned,row.onEvent===undefined?undefined:{onEvent:row.onEvent as NonNullable<SpineResetRequest['onEvent']>});
              if(skins)instance.setSkins(skins);
              instance.setAnimation(0,row.animation as string,{...(row.loop===undefined?{}:{loop:row.loop as boolean}),...(row.plays===undefined?{}:{plays:row.plays as number})});
              requireSpineRender(instance).initializeReset();
              const display=createSpineDisplay(instance,owned,{colorProfile:'egret-shared-linear/1'});
              current();next=freeze({version:row.version as string,instance,display,ownership:'owned'});state='ready';resolve();
            }catch(cause){fail(cause);}
          },fail);
        }catch(cause){fail(cause);}
        function fail(cause:unknown):unknown{
          if(state==='cancelled'||state==='failed'||state==='committed')return cause;
          state='failed';const errors:unknown[]=[];
          try{tree?.dispose();}catch(error){errors.push(error);}tree=undefined;if(pending===demand)pending=undefined;
          try{apply(close,owned,[]);}catch(error){errors.push(error);}
          const failure=errors.length?new EgretError('SPINE_RESET_CLEANUP_FAILED',{cause,cleanupErrors:errors}):cause;
          // This handler also terminates the asynchronous group chain; cleanup cannot
          // create an unobserved rejected derivative after ready has settled.
          reject(failure);return failure;
        }
        return ticket;
      }finally{if(candidateScope)apply(close,candidateScope,[]);busy=false;}
    },
  });
  claims.set(target,slot);
  try{apply(use,scope,[slot]);open();}catch(cause){slot.dispose();throw cause;}
  return slot;
}
