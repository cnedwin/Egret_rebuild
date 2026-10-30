import type { ParagraphRequestInput, ParagraphTextGeometry, ParagraphTextCaret, ParagraphTextHit, ParagraphTextSelection } from '@egret/engine/paragraph';
declare const request: ParagraphRequestInput;
declare const geometry: ParagraphTextGeometry;
const enabled: ParagraphRequestInput = { ...request, textGeometry: true };
const caret: ParagraphTextCaret | undefined = geometry.getCaret(1, 'upstream');
const hit: ParagraphTextHit | undefined = geometry.hitTest(10, 20);
const selection: readonly ParagraphTextSelection[] = geometry.getSelectionRects(0, 2);
void [enabled, caret, hit, selection];

import type { CanvasKitParagraphModule } from '@egret/engine/web/paragraph';
type NativeBuilder = NonNullable<ReturnType<CanvasKitParagraphModule['ParagraphBuilder']['MakeFromFontProvider']>>;
type NativeParagraph = NonNullable<ReturnType<NativeBuilder['build']>>;
type LegacyNativeLine = ReturnType<NativeParagraph['getLineMetrics']>[number];
// A host that does not opt in to text geometry keeps the previous minimal port.
const legacyNativeLine: LegacyNativeLine = {startIndex: 0, endIndex: 1, baseline: 15, ascent: 15, descent: 5, height: 20, width: 10};
void legacyNativeLine;
