// SPDX-License-Identifier: Apache-2.0
import type { ParagraphRequestInput, ParagraphMetrics, ParagraphProviderCapabilities } from '@egret/engine/paragraph';
declare const input: ParagraphRequestInput;
const badAlign: ParagraphRequestInput = {...input, textAlign: 'middle'};
const badCap: ParagraphRequestInput = {...input, maxLines: '2'};
const badOverflow: ParagraphMetrics = {width: 1, height: 1, lines: [], truncated: 'yes'};
const badCapability: ParagraphProviderCapabilities = {textAlign: 'true'};
void badAlign; void badCap; void badOverflow; void badCapability;
