import type { SharedGeometry2D, SharedMaterial2D, SharedPage2D, SharedRegion2D, SharedRenderCommand2D, TexturedGeometry2D } from '@egret/contracts';
import type { Stage } from './Stage.js';
import type { DisplayObject } from './DisplayObject.js';
import type { DisplayObjectContainer } from './DisplayObjectContainer.js';
import type { BitmapCaptureView } from './bitmapDisplayState.js';
export interface CapturedSharedContent2D {
    readonly commands: readonly SharedRenderCommand2D[];
    readonly pages: readonly SharedPage2D[];
    readonly regions: readonly SharedRegion2D[];
    readonly materials: readonly SharedMaterial2D[];
    readonly geometries: readonly (TexturedGeometry2D | SharedGeometry2D)[];
}
/**
 * Iterative capture. All mutable owners stay inside this invocation, except what each node keeps of its own
 * derived records.
 */
export declare function collectSharedFrameContent(stage: Stage): CapturedSharedContent2D;
/** The same capture with nothing kept read or written: every record is derived anew. Never forwarded by a package root. */
export declare function collectFreshSharedFrameContent(stage: Stage): CapturedSharedContent2D;
/** Runtime-private fixed Bitmap assembly; never forwarded by a package root. */
export declare function collectPreparedSharedFrameContent(stage: Stage, view: BitmapCaptureView): CapturedSharedContent2D;
/** Private single-edge overlay; ordinary capture always uses the unchanged live readers. */
export declare function collectSubtreeSharedFrameContent(stage: Stage, target: DisplayObjectContainer, candidate: DisplayObject): CapturedSharedContent2D;
//# sourceMappingURL=sharedFrameCapture.d.ts.map