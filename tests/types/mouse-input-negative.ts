import {createMouseInput} from '@egret/engine/web/input';
import type {MouseInput,MouseInputOptions,MouseInputEvents,MouseInputPayload,MouseInputState,MouseInputCancelReason} from '@egret/engine/web/input';
import {Sprite} from '@egret/engine';
import type {Engine,Scope} from '@egret/engine';
declare const engine:Engine;
declare const scope:Scope;
declare const input:MouseInput;
declare const options:MouseInputOptions;
declare const payload:MouseInputPayload;
declare const events:MouseInputEvents;
// MOUSE_INPUT_CASE required-arguments
createMouseInput();
// MOUSE_INPUT_CASE required-scope
createMouseInput({engine,width:100,height:80});
// MOUSE_INPUT_CASE genuine-engine
createMouseInput({engine:{},scope,width:100,height:80});
// MOUSE_INPUT_CASE genuine-scope
createMouseInput({engine,scope:{},width:100,height:80});
// MOUSE_INPUT_CASE numeric-width
createMouseInput({engine,scope,width:'100',height:80});
// MOUSE_INPUT_CASE numeric-height
createMouseInput({engine,scope,width:100,height:'80'});
// MOUSE_INPUT_CASE numeric-budget
createMouseInput({engine,scope,width:100,height:80,maxNodes:'4096'});
// MOUSE_INPUT_CASE no-pointer-capture-option
createMouseInput({engine,scope,width:100,height:80,pointerCapture:true});
// MOUSE_INPUT_CASE no-touch-option
createMouseInput({engine,scope,width:100,height:80,touch:true});
// MOUSE_INPUT_CASE required-private-handle-brand
const forged:MouseInput={state:'idle',events,dispose(){}};
// MOUSE_INPUT_CASE readonly-state
input.state='closed';
// MOUSE_INPUT_CASE readonly-options
options.width=200;
// MOUSE_INPUT_CASE readonly-events
events.begin=events.end;
// MOUSE_INPUT_CASE readonly-payload
payload.globalX=1;
// MOUSE_INPUT_CASE exact-pointer-kind
const pointer:MouseInputPayload={pointerId:1,globalX:0,globalY:0,pointerType:'touch',button:0};
// MOUSE_INPUT_CASE exact-primary-button
const button:MouseInputPayload={pointerId:1,globalX:0,globalY:0,pointerType:'mouse',button:1};
// MOUSE_INPUT_CASE exact-state
const state:MouseInputState='dragging';
// MOUSE_INPUT_CASE exact-cancel-reason
const reason:MouseInputCancelReason='dispose';
// MOUSE_INPUT_CASE cancel-payload-invariant
new Sprite().on(input.events.cancel,(event:{payload:MouseInputPayload&{reason:'dispose'}})=>{void event;});
// MOUSE_INPUT_CASE no-async-typed-input-handler
new Sprite().on(input.events.begin,async()=>{});
// MOUSE_INPUT_CASE input-type-only
void MouseInput;
// MOUSE_INPUT_CASE options-type-only
void MouseInputOptions;
// MOUSE_INPUT_CASE events-type-only
void MouseInputEvents;
// MOUSE_INPUT_CASE payload-type-only
void MouseInputPayload;
// MOUSE_INPUT_CASE state-type-only
void MouseInputState;
// MOUSE_INPUT_CASE reason-type-only
void MouseInputCancelReason;
void forged;void pointer;void button;void state;void reason;
