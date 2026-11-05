// SPDX-License-Identifier: Apache-2.0
import type {SequenceResetRequest,SequenceResetActive} from '@egret/engine/animation';
import {createSequenceResetSlot} from '@egret/engine';
declare const request:SequenceResetRequest;declare const active:SequenceResetActive;
const invalidPolicy:SequenceResetRequest={...request,policy:'preserve'};
const invalidRate:SequenceResetRequest={...request,playback:{profile:'egret.sequence-control/1',rate:'fast'}};
active.ownership='borrowed';
void createSequenceResetSlot;void invalidPolicy;void invalidRate;
