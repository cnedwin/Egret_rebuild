import type { CancellationSignal } from '@egret/contracts';
import { DisplayObjectContainer } from '../DisplayObjectContainer.js';
import { Scope } from '../Scope.js';
import type { EngineContext } from '../ownership.js';
import type { ParagraphRequestInput, PreparedParagraph } from './types.js';
export interface ParagraphCachePort {
    readonly context: EngineContext;
    assertOpen(): void;
    generation(): number;
    acquire(request: ParagraphRequestInput, signal: CancellationSignal): Promise<PreparedParagraph>;
}
export declare function createParagraphNode(scope: Scope, cache: ParagraphCachePort): DisplayObjectContainer;
//# sourceMappingURL=Paragraph.d.ts.map