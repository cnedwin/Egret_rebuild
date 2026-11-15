import { EgretError } from '@egret/runtime';
import type { SequenceClipInput, SpriteSheetFrameInput } from '@egret/runtime';
export interface AtlasArtifact {
    readonly width: number;
    readonly height: number;
    readonly frames: readonly SpriteSheetFrameInput[];
    readonly sequenceInput: SequenceClipInput;
}
export declare function contentFault(stage: string, id: string, cause?: unknown): EgretError;
export declare function parseAtlasArtifact(text: string, id: string): AtlasArtifact;
export declare function parseSequenceArtifact(text: string, id: string, atlas: AtlasArtifact): SequenceClipInput;
//# sourceMappingURL=contentArtifacts.d.ts.map