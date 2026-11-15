import type { CancellationSignal } from '@egret/contracts';
import { DisplayObject } from '../DisplayObject.js';
import { Scope } from '../Scope.js';
import type { EngineContext } from '../ownership.js';
import type { PreparedTextRaster, TextRasterRequestInput } from './types.js';
export interface TextFieldCachePort {
    readonly context: EngineContext;
    assertOpen(): void;
    adopt(input: TextRasterRequestInput, revalidate: () => void): TextRasterRequestInput;
    acquire(input: TextRasterRequestInput, signal: CancellationSignal): Promise<PreparedTextRaster>;
}
export declare function createTextFieldLeaf(scope: Scope, cache: TextFieldCachePort): DisplayObject;
//# sourceMappingURL=TextField.d.ts.map