// SPDX-License-Identifier: Apache-2.0
import { Scope, EgretError } from '@egret/runtime';
import type { DisplayObject, DisplayObjectContainer, EngineContext } from '@egret/runtime';

declare const displaySubtreeTicketBrand: unique symbol;
/** Borrows all nodes/resources; disposal only revokes this candidate publication. */
export interface DisplaySubtreeTicket {
  readonly [displaySubtreeTicketBrand]: true;
  commit(): void;
  dispose(): void;
}
type Operations = Parameters<NonNullable<EngineContext['registerPreparedDisplayOperations']>>[0];
interface Context { assertOpen():void; isEngineScope(scope:unknown):scope is Scope; isBusy():boolean; }
const use=Scope.prototype.use,state=Object.getOwnPropertyDescriptor(Scope.prototype,'state')!.get!;

/** One Engine's authentic handles close over its genuine Stage operations. */
export function createDisplaySubtreeTickets(context:Context,operations:Operations) {
  const handles=new WeakMap<object,{scope:Scope;token:object|undefined}>();
  function lifetime(scope:Scope):void{context.assertOpen();if(!context.isEngineScope(scope))throw new EgretError('DISPLAY_SUBTREE_SCOPE_INVALID');if(state.call(scope)!=='open')throw new EgretError('SCOPE_CLOSED');}
  function available(ticket:unknown){context.assertOpen();const row=handles.get(ticket as object);if(!row)throw new EgretError('DISPLAY_SUBTREE_TICKET_INVALID');lifetime(row.scope);if(!row.token)throw new EgretError('DISPLAY_SUBTREE_RETIRED');return row;}
  function idle():void{if(context.isBusy())throw new EgretError('DISPLAY_SUBTREE_REENTRANT');}
  return Object.freeze({
    prepare(scope:Scope,target:DisplayObjectContainer,candidate:DisplayObject):DisplaySubtreeTicket{
      lifetime(scope);idle();const token=operations.prepare(target,candidate),row={scope,token:token as object|undefined};
      const handle=Object.freeze({
        commit(this:unknown):void{if(this!==handle)throw new EgretError('DISPLAY_SUBTREE_TICKET_INVALID');const current=available(handle);idle();operations.commit(current.token!);current.token=undefined;},
        dispose(this:unknown):void{if(this!==handle)throw new EgretError('DISPLAY_SUBTREE_TICKET_INVALID');const token=row.token;row.token=undefined;if(token)operations.dispose(token);},
      }) as DisplaySubtreeTicket;
      handles.set(handle,row);try{use.call(scope,handle);}catch(cause){handle.dispose();throw cause;}return handle;
    },
    read(ticket:unknown){const row=available(ticket);return Object.freeze({validate(){const current=available(ticket);operations.validate(current.token!);},captureContent(){const current=available(ticket);return operations.capture(current.token!);}});},
  });
}
