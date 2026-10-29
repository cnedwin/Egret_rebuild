// SPDX-License-Identifier: Apache-2.0
import type { Paragraph, ParagraphRequestInput, ParagraphMetrics, ParagraphTextAlign, ParagraphProviderCapabilities } from '@egret/engine/paragraph';
import type { CanvasKitParagraphProvider } from '@egret/engine/web/paragraph';
const alignments: readonly ParagraphTextAlign[] = ['left', 'right', 'center', 'start', 'end', 'justify'];
const input: ParagraphRequestInput = {text: 'Game title', width: 120, fontFamilies: ['Noto Sans'], fontSize: 20, locale: 'en', direction: 'ltr', fillColor: 0xffffff, density: 1, maxLines: 2};
const caps: ParagraphProviderCapabilities = {textAlign: true, maxLines: true};
declare const node: Paragraph;
declare const native: CanvasKitParagraphProvider;
for (const textAlign of alignments) node.setRequest({...input, textAlign});
const prepared: Promise<ParagraphMetrics> = node.prepare();
prepared.then(metrics => {const overflow: boolean | undefined = metrics.truncated; void overflow;});
const declared: ParagraphProviderCapabilities | undefined = native.capabilities;
void caps; void declared;
