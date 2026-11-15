import type { SpriteSheetFrameInput } from '@egret/runtime';
export interface ContentAtlasPageArtifact {
    readonly name: string;
    readonly width: number;
    readonly height: number;
    readonly frames: readonly SpriteSheetFrameInput[];
}
export interface ContentAtlasPagesArtifact {
    readonly pages: readonly ContentAtlasPageArtifact[];
}
/** Artifact pages bind by dependency ordinal, never by a path or ambient name. */
export declare function parseAtlasPagesArtifact(text: string, id: string, dependencyCount: number): ContentAtlasPagesArtifact;
//# sourceMappingURL=contentAtlasPages.d.ts.map