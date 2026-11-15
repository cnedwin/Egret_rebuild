import { DisplayObjectContainer } from '@egret/runtime';
import type { Scope } from '@egret/runtime';
import { Engine } from '../Engine.js';
import type { SequenceResetInitial, SequenceResetSlot } from './sequenceResetTypes.js';
/** One ordinary sole-child container; all candidates use existing content and clock ownership. */
export declare function createSequenceResetSlot(engine: Engine, scope: Scope, target: DisplayObjectContainer, initial: SequenceResetInitial): SequenceResetSlot;
//# sourceMappingURL=sequenceResetSlot.d.ts.map