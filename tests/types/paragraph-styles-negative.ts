// SPDX-License-Identifier: Apache-2.0
import type {ParagraphStyleRun, ParagraphProviderCapabilities} from '@egret/engine/paragraph';
const missing: ParagraphStyleRun = {end:2,fillColor:0};
const color: ParagraphStyleRun = {start:0,end:2,fillColor:'red'};
const families: ParagraphStyleRun = {start:0,end:2,fontFamilies:[12]};
const caps: ParagraphProviderCapabilities = {styledRuns:'yes'};
declare const run: ParagraphStyleRun;
run.fontSize = 20;
void missing; void color; void families; void caps;
