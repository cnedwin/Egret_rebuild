// SPDX-License-Identifier: Apache-2.0
import type {ParagraphRequestInput, ParagraphStyleRun, ParagraphProviderCapabilities} from '@egret/engine/paragraph';
const runs: readonly ParagraphStyleRun[] = [{start:0,end:3,fontFamilies:['Noto Sans'],fontSize:32,fillColor:0xff0000}];
const request: ParagraphRequestInput = {text:'ABC',width:200,fontFamilies:['Noto Sans'],fontSize:20,locale:'en',direction:'ltr',fillColor:0xffffff,density:1,runs};
const capabilities: ParagraphProviderCapabilities = {styledRuns:true};
void request; void capabilities;
