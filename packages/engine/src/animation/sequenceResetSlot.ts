// SPDX-License-Identifier: Apache-2.0
import {Bitmap, DisplayObject, DisplayObjectContainer, EgretError} from '@egret/runtime';
import type {Scope} from '@egret/runtime';
import type {SharedFrameOptions2D, SharedRenderFrame2D} from '@egret/contracts';
import {Engine} from '../Engine.js';
import type {DisplaySubtreeTicket} from '../displaySubtreeTicket.js';
import type {ContentLoader} from '../contentTypes.js';
import {authenticateContentLoader} from '../internal/contentFactoryState.js';
import {requireSequenceControllerEngine} from '../internal/sequenceControllerFactoryState.js';
import type {SequenceScopePort} from '../internal/sequenceControllerFactoryState.js';
import {captureInput, coordinatorSize, mustQueue, assertNotCapturing} from './sequenceCoordinator.js';
import {captureOptions} from './sequenceInput.js';
import {createSequenceController, requireResetController} from './sequenceController.js';
import type {SequenceResetInitial, SequenceResetActive, SequenceResetRequest, SequenceResetSlot, SequenceResetTicket, SequenceResetState} from './sequenceResetTypes.js';

const apply=Reflect.apply, freeze=Object.freeze;
const prepare=Engine.prototype.prepareDisplaySubtree, capture=Engine.prototype.capturePreparedDisplaySharedFrame;
const count=Object.getOwnPropertyDescriptor(DisplayObjectContainer.prototype,'numChildren')!.get!;
const child=DisplayObjectContainer.prototype.getChildAt;
const parent=Object.getOwnPropertyDescriptor(DisplayObject.prototype,'parent')!.get!;
const claims=new WeakMap<object, object>();
function fault(code:string,cause?:unknown):EgretError{return new EgretError('SEQUENCE_RESET_'+code,{cause});}
function label(value:unknown,max=128):value is string{return typeof value==='string'&&value.length>0&&value.length<=max;}
function record(value:unknown,keys:readonly string[],check:()=>void):Record<string,unknown>{
  if(!value||typeof value!=='object'||Array.isArray(value))throw fault('OPTIONS_INVALID');
  const row:Record<string,unknown>=Object.create(null) as Record<string,unknown>;
  const names=Reflect.ownKeys(value);check();
  for(const key of names){if(typeof key!=='string'||!keys.includes(key))throw fault('OPTIONS_INVALID');const d=Object.getOwnPropertyDescriptor(value,key);check();if(!d||!Object.hasOwn(d,'value'))throw fault('OPTIONS_INVALID');row[key]=d.value;}
  return row;
}
/** One ordinary sole-child container; all candidates use existing content and clock ownership. */
export function createSequenceResetSlot(engine:Engine,scope:Scope,target:DisplayObjectContainer,initial:SequenceResetInitial):SequenceResetSlot{
  const port=requireSequenceControllerEngine(engine),owner=port.scope(scope);
  assertNotCapturing(port);if(mustQueue(port))throw fault('REENTRANT');
  const row=captureInput(port,()=>record(initial,['version','bitmap','controller'],owner.assertOpen));
  if(!label(row.version))throw fault('OPTIONS_INVALID');
  let active:SequenceResetActive=freeze({version:row.version,bitmap:row.bitmap as Bitmap,controller:row.controller as SequenceResetInitial['controller'],ownership:'borrowed'});
  requireResetController(active.controller,port,active.bitmap);
  function topology():void{
    if(apply(count,target,[])!==1||apply(child,target,[0])!==active.bitmap)throw fault('TARGET_CHANGED');
    // Bound ancestry proves attachment; the controller already authenticates Engine affinity.
    let node:DisplayObject|undefined=target;
    for(let depth=0;node!==engine.stage;depth++){if(!node||depth>=128)throw fault('TARGET_INVALID');node=apply(parent,node,[]) as DisplayObject|undefined;}
    if(target===engine.stage)throw fault('TARGET_INVALID');
  }
  topology();if(claims.has(target))throw fault('TARGET_CLAIMED');
  let disposed=false,busy=false,intent=0,activeScope:SequenceScopePort|undefined;
  let pending:{cancel:()=>void}|undefined;
  function open():void{if(disposed)throw fault('DISPOSED');owner.assertOpen();}
  function idle():void{open();assertNotCapturing(port);if(busy||mustQueue(port))throw fault('REENTRANT');}
  function cleanup(actions:readonly (()=>void)[]):unknown[]{const errors:unknown[]=[];for(const action of actions)try{action();}catch(cause){errors.push(cause);port.captureCleanup(cause);}return errors;}
  const slot:SequenceResetSlot=freeze({
    get isDisposed(){return disposed;},
    getActive(){open();return active;},
    dispose(){
      if(disposed)return;disposed=true;intent++;claims.delete(target);
      const candidate=pending,owned=activeScope;pending=undefined;activeScope=undefined;
      const errors=cleanup([()=>candidate?.cancel(),()=>owned?.dispose()]);
      if(errors.length)throw fault('CLEANUP_FAILED',errors);
    },
    request(request:SequenceResetRequest):SequenceResetTicket{
      idle();busy=true;let spare:SequenceScopePort|undefined;
      try{
        topology();requireResetController(active.controller,port,active.bitmap);
        const admitted=captureInput(port,()=>{
          const r=record(request,['policy','version','loader','imageId','sequenceId','playback'],open);
          if(r.policy!=='reset'||!label(r.version)||!label(r.imageId,512)||!label(r.sequenceId,512))throw fault('OPTIONS_INVALID');
          // Validate all caller-owned descriptors before replacing valid intent. Actual
          // clip-dependent duration/marker checks repeat after genuine group readiness.
          const playback=captureOptions(r.playback,2**32,false);open();
          return {r,playback};
        });
        const {r,playback}=admitted;
        if(coordinatorSize(port)>=256)throw new EgretError('ANIMATION_CONTROLLER_LIMIT');
        if(port.claims.size>=256)throw new EgretError('ANIMATION_LIMIT');
        spare=port.createScope();const owned=spare;
        authenticateContentLoader(r.loader,owned.scope,r.imageId as string,r.sequenceId as string);open();
        const id=++intent,prior=pending;
        let state:SequenceResetState='loading',next:SequenceResetActive|undefined,tree:DisplaySubtreeTicket|undefined;
        let paused:{controller:SequenceResetInitial['controller'];revision:()=>object;at:object;resume:boolean}|undefined;
        let resolve!:()=>void,reject!:(cause:unknown)=>void;
        const ready=new Promise<void>((yes,no)=>{resolve=yes;reject=no;});void ready.catch(()=>{});
        function current():void{open();if(id!==intent||state==='cancelled'||state==='failed'||state==='committed')throw fault('RETIRED');owned.assertOpen();}
        function restore():void{
          const old=paused;paused=undefined;
          // A caller command after our pause owns the next transition. Never overwrite it.
          if(old?.resume&&old.revision()===old.at&&old.controller.getStatus().state==='paused'){
            // The borrowed controller owns its lifetime; the slot Scope may be closing.
            try{old.controller.resume();}catch(cause){port.captureCleanup(cause);}
          }
        }
        function release():unknown[]{const captured=tree;tree=undefined;return cleanup([()=>captured?.dispose(),restore,()=>owned.dispose()]);}
        function cancel():void{
          if(state==='committed'||state==='cancelled'||state==='failed')return;
          state='cancelled';if(pending===demand)pending=undefined;
          reject(fault('CANCELLED'));const errors=release();if(errors.length)throw fault('CLEANUP_FAILED',errors);
        }
        function fail(cause:unknown):unknown{
          if(state==='cancelled'||state==='failed'||state==='committed')return cause;
          state='failed';if(pending===demand)pending=undefined;
          const errors=release(),failure=errors.length?fault('CLEANUP_FAILED',{cause,errors}):cause;
          reject(failure);return failure;
        }
        const demand={cancel};pending=demand;
        const ticket:SequenceResetTicket=freeze({
          get ready(){return ready;},get state(){return state;},
          capture(options:SharedFrameOptions2D):SharedRenderFrame2D{
            idle();current();if(state!=='ready'||!next)throw fault('NOT_READY');busy=true;
            try{
              topology();const revision=requireResetController(active.controller,port,active.bitmap);
              const running=active.controller.getStatus().state==='running';
              if(running)active.controller.pause();
              paused={controller:active.controller,revision,at:revision(),resume:running};current();
              tree=apply(prepare,engine,[owned.scope,target,next.bitmap]) as DisplaySubtreeTicket;
              const frame=apply(capture,engine,[tree,options]) as SharedRenderFrame2D;current();state='prepared';return frame;
            }catch(cause){throw fail(cause);}finally{busy=false;}
          },
          commit():SequenceResetActive{
            idle();current();if(state!=='prepared'||!tree||!next)throw fault('NOT_PREPARED');busy=true;
            try{
              topology();if(paused&&paused.revision()!==paused.at)throw fault('CONTROLLER_CHANGED');
              tree.commit();
              const previous=activeScope;active=next;activeScope=owned;state='committed';tree=undefined;pending=undefined;paused=undefined;
              // CPU publication is final. Reentrant retirement observes the published state.
              const errors=cleanup([()=>previous?.dispose()]);if(errors.length)throw fault('POSTCOMMIT_FAILED',errors);
              return active;
            }catch(cause){throw fail(cause);}finally{busy=false;}
          },
          dispose(){cancel();},
        });
        spare=undefined;
        try{
          prior?.cancel();current();
          const group=(r.loader as ContentLoader).load(owned.scope,[r.sequenceId as string]);current();
          void group.ready.then(()=>{
            try{
              current();
              const bitmap=new Bitmap(group.getImage(r.imageId as string));owned.use(bitmap);
              let visible=false;
              const controller=createSequenceController(engine,owned.scope,bitmap,group.getSequence(r.sequenceId as string),{
                profile:'egret.sequence-control/1',rate:0,totalPlays:playback.totalPlays,
                markers:[...playback.markers].sort((a,b)=>a.markerIndex-b.markerIndex).map(m=>({id:m.id,timeSeconds:m.timeSeconds})),
                onEvent:event=>visible?playback.listener?.(event):undefined,
              });
              controller.start();controller.setRate(playback.rate);current();
              next=freeze({version:r.version as string,bitmap,controller,ownership:'owned'});state='ready';
              // No candidate clock movement occurs while paused. Zero start markers are consumed silently.
              visible=true;resolve();
            }catch(cause){fail(cause);}
          },fail);
        }catch(cause){fail(cause);}
        return ticket;
      }finally{spare?.dispose();busy=false;}
    },
  });
  claims.set(target,slot);
  try{owner.use(slot);open();}catch(cause){slot.dispose();throw cause;}
  return slot;
}
