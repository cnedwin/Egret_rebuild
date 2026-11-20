import type { HostAdapter } from './HostAdapter.js';
import type { ImageData2D } from './ImageData2D.js';
import type { Matrix2D, Rectangle2D, ClipRectangle2D } from './RenderFrame2D.js';
import type { TexturedGeometry2D } from './TexturedGeometry2D.js';
import type { SharedGeometry2D } from './SharedGeometry2D.js';
import type { SharedMaterial2D } from './SharedMaterial2D.js';
import type { TextureViewRegion2D } from './TextureViewRegion2D.js';

// This erased shape is not frame authority. Only the Engine registers a fully
// captured immutable value; no public constructor or symbol can do so.
/** The name of the shared 2D frame profile that hosts and the engine agree on. */
export const SHARED_FRAME_PROFILE_2D = 'egret.shared-frame2d/1';
/** The type of the shared frame profile name. */
export type SharedFrameProfile2D = typeof SHARED_FRAME_PROFILE_2D;
/** How a frame's output alpha is given: premultiplied, or opaque with alpha ignored. */
export type SharedOutputAlpha2D = 'premultiplied' | 'opaque';
/**
 * Where translucent draws mix with what is under them. `linear` mixes light as it is (the engine's default);
 * `srgb` mixes the stored colour codes, as a 2D canvas and Egret 5 do, so a faint white over a dark ground stays
 * faint. The colour of each draw is the same in both; only the mixing differs.
 */
export type SharedBlendSpace2D = 'linear' | 'srgb';

/** The size of a frame to capture, the color it is cleared to, and how its alpha is given. */
export interface SharedFrameOptions2D {
  readonly width: number;
  readonly height: number;
  readonly clearColor?: number;
  readonly clearAlpha?: number;
  readonly outputAlpha?: SharedOutputAlpha2D;
}

/** One image that a frame's commands sample from, with how its pixels are represented. */
export interface SharedPage2D {
  readonly source: ImageData2D;
  readonly sourceRepresentation: 'egret.srgb-straight-rgba8/1';
  readonly canonicalRepresentation: 'egret.alpha8-capped-srgb-pma8/1';
}

/** A region of a page, by the page's index in the frame. */
export interface SharedRegion2D extends TextureViewRegion2D {
  readonly pageIndex: number;
}

/** What every draw command carries: its order, its material, its matrix, its opacity and its clips. */
export interface SharedDrawState2D {
  readonly ordinal: number;
  readonly occurrenceId: number;
  readonly materialIndex: number;
  readonly matrix: Matrix2D;
  readonly opacity: number;
  readonly clips: readonly ClipRectangle2D[];
}

/** A draw command that fills a rectangle with one color. */
export interface SharedRectangleCommand2D extends SharedDrawState2D {
  readonly kind: 'rect';
  readonly rect: Rectangle2D;
  readonly fillColor: number;
  readonly fillAlpha: number;
}

/** A draw command that draws a region of a page. */
export interface SharedImageCommand2D extends SharedDrawState2D {
  readonly kind: 'image';
  readonly rect: Rectangle2D;
  readonly regionIndex: number;
}

/** A draw command that draws a textured or colored mesh. */
export interface SharedMeshCommand2D extends SharedDrawState2D {
  readonly kind: 'mesh';
  readonly regionIndex: number;
  readonly geometryIndex: number;
}

/** Frozen effect inputs captured with the same frame and image ownership. */
export interface SharedEffect2D {
  readonly blurRadius: number;
  /** Egret's twenty numbers, applied to colour as it is seen after the blur. */
  readonly colorMatrix?: readonly number[];
  /** A glow or a hard outline from the alpha of the group, in logical pixels. */
  readonly glow?: SharedGlow2D;
  readonly maskPageIndex: number | undefined;
  readonly maskRect: Rectangle2D | undefined;
  readonly matrix: Matrix2D;
  readonly clips: readonly ClipRectangle2D[];
}
/** A glow or outline drawn around what an effect layer holds. */
export interface SharedGlow2D {
  readonly kind: 'glow' | 'outline';
  readonly color: number;
  readonly alpha: number;
  /** How far it spreads: the blur of a glow, the width of an outline. */
  readonly spread: number;
  readonly strength: number;
  readonly inner: boolean;
  readonly knockout: boolean;
  readonly offsetX: number;
  readonly offsetY: number;
}
/** A command that ends or begins an effect layer: what came before is finished before what comes after is drawn. */
export interface SharedBarrierCommand2D {
  readonly effect?: SharedEffect2D;

  readonly kind: 'barrier';
  readonly ordinal: number;
  readonly occurrenceId: number;
  readonly boundaryId: number;
  readonly reason:
    | 'explicit-enter'
    | 'explicit-exit'
    | 'clip-enter'
    | 'clip-exit'
    | 'empty'
    | 'effect-enter'
    | 'effect-exit';
}

/** Any command of a shared frame. */
export type SharedRenderCommand2D =
  | SharedRectangleCommand2D
  | SharedImageCommand2D
  | SharedMeshCommand2D
  | SharedBarrierCommand2D;

declare const sharedRenderFrame2DBrand: unique symbol;
/** One captured frame: its size, clear color and color recipe, its commands in draw order, and the pages, regions, materials and geometries they use. */
export interface SharedRenderFrame2D {
  readonly [sharedRenderFrame2DBrand]: true;
  readonly profile: SharedFrameProfile2D;
  readonly colorRecipe: 'egret.linear-srgb-pma/1' | 'egret.srgb-pma/1';
  readonly targetRepresentation: 'egret.srgb-pma8-target/1' | 'egret.encoded-srgb-pma8-target/1';
  readonly outputRepresentation: 'egret.srgb-premultiplied-unorm8/1' | 'egret.srgb-opaque-unorm8/1';
  readonly frameId: number;
  readonly width: number;
  readonly height: number;
  readonly clearColor: number;
  readonly clearAlpha: number;
  readonly outputAlpha: SharedOutputAlpha2D;
  readonly commands: readonly SharedRenderCommand2D[];
  readonly pages: readonly SharedPage2D[];
  readonly regions: readonly SharedRegion2D[];
  readonly materials: readonly SharedMaterial2D[];
  readonly geometries: readonly (TexturedGeometry2D | SharedGeometry2D)[];
}

/** A host that draws shared frames of this profile. */
export interface SharedRenderHostAdapter extends HostAdapter {
  readonly sharedFrameProfile: SharedFrameProfile2D;
  /** The blend space the renderer was made for, `linear` when absent. An Engine's frames record it. */
  readonly sharedBlendSpace?: SharedBlendSpace2D;
  renderSharedFrame(frame: SharedRenderFrame2D): undefined;
}
