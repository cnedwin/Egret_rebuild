import type { Bitmap, Scope, SequenceClip } from '@egret/runtime';
import type { Engine } from '../Engine.js';
import type { SequenceControllerEnginePort } from '../internal/sequenceControllerFactoryState.js';
import type { SequenceController, SequenceControllerOptions } from './types.js';
/** Optional assembly only: authenticate the exact Engine, original controller and Bitmap. */
export declare function requireResetController(value: unknown, port: SequenceControllerEnginePort, bitmap: Bitmap): () => object;
/** Reserve the replacement pause revision before synchronous event delivery can reenter the slot. */
export declare function pauseSequenceForReplacement(value: SequenceController, port: SequenceControllerEnginePort, bitmap: Bitmap, revision: object): void;
export declare function requireSequencePreserveSource(value: SequenceController, port: SequenceControllerEnginePort, bitmap: Bitmap): {
    clip: SequenceClip;
    totalPlays: number | 'infinite';
    markers: readonly {
        readonly id: string;
        readonly timeSeconds: number;
        readonly markerIndex: number;
    }[];
};
/** Stage an event-free successor at the paused source position. The slot has checked both timelines. */
export declare function stageSequencePreserve(port: SequenceControllerEnginePort, from: SequenceController, fromBitmap: Bitmap, to: SequenceController, toBitmap: Bitmap, running: boolean): () => void;
/** Opt-in sequence controls share Engine ownership but never create a second timer. */
export declare function createSequenceController(engine: Engine, scope: Scope, bitmap: Bitmap, clip: SequenceClip, options: SequenceControllerOptions): SequenceController;
//# sourceMappingURL=sequenceController.d.ts.map