import type { ParagraphRequestInput, ParagraphTextGeometry } from '@egret/engine/paragraph';
declare const geometry: ParagraphTextGeometry;
declare const request: ParagraphRequestInput;
geometry.getCaret('1');
geometry.getCaret(1, 'left');
geometry.clusters[0]!.left = 2;
const bad: ParagraphRequestInput = { ...request, textGeometry: 'yes' };
void bad;
