// SPDX-License-Identifier: Apache-2.0
import type {Engine, Scope, DisplayObjectContainer, Bitmap} from '@egret/engine';
import type {ContentLoader} from '@egret/engine/resources';
import {createSequenceResetSlot} from '@egret/engine/animation';
import type {SequenceController, SequenceResetSlot, SequenceResetTicket, SequenceResetActive, SequenceResetRequest, SequenceResetState} from '@egret/engine/animation';
export function use(engine:Engine,scope:Scope,target:DisplayObjectContainer,bitmap:Bitmap,controller:SequenceController,loader:ContentLoader):SequenceResetActive{
 const slot:SequenceResetSlot=createSequenceResetSlot(engine,scope,target,{version:'v1',bitmap,controller});
 const request:SequenceResetRequest={policy:'reset',version:'v2',loader,imageId:'e_page',sequenceId:'e_sequence',playback:{profile:'egret.sequence-control/1',rate:2,totalPlays:3,onEvent:()=>undefined}};
 const ticket:SequenceResetTicket=slot.request(request);const state:SequenceResetState=ticket.state;void state;void ticket.ready;
 ticket.capture({width:64,height:32});const active=ticket.commit();active.controller.resume();return active;
}
