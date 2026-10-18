import type { HostAdapter } from './HostAdapter.js';
import type { ImageData2D } from './ImageData2D.js';
import type { Matrix2D, Rectangle2D, ClipRectangle2D } from './RenderFrame2D.js';
import type { TexturedGeometry2D } from './TexturedGeometry2D.js';
import type { SharedGeometry2D } from './SharedGeometry2D.js';
import type { SharedMaterial2D } from './SharedMaterial2D.js';
import type { TextureViewRegion2D } from './TextureViewRegion2D.js';

// This erased shape is not frame authority. Only the Engine registers a fully
// captured immutable value; no public constructor or symbol can do so.
export const SHARED_FRAME_PROFILE_2D = 'egret.shared-frame2d/1';
export type SharedFrameProfile2D = typeof SHARED_FRAME_PROFILE_2D;
export type SharedOutputAlpha2D = 'premultiplied' | 'opaque';

export interface SharedFrameOptions2D {
  readonly width: number;
  readonly height: number;
  readonly clearColor?: number;
  readonly clearAlpha?: number;
  readonly outputAlpha?: SharedOutputAlpha2D;
}

export interface SharedPage2D {
  readonly source: ImageData2D;
  readonly sourceRepresentation: 'egret.srgb-straight-rgba8/1';
  readonly canonicalRepresentation: 'egret.alpha8-capped-srgb-pma8/1';
}

export interface SharedRegion2D extends TextureViewRegion2D {
  readonly pageIndex: number;
}

export interface SharedDrawState2D {
  readonly ordinal: number;
  readonly occurrenceId: number;
  readonly materialIndex: number;
  readonly matrix: Matrix2D;
  readonly opacity: number;
  readonly clips: readonly ClipRectangle2D[];
}

export interface SharedRectangleCommand2D extends SharedDrawState2D {
  readonly kind: 'rect';
  readonly rect: Rectangle2D;
  readonly fillColor: number;
  readonly fillAlpha: number;
}

export interface SharedImageCommand2D extends SharedDrawState2D {
  readonly kind: 'image';
  readonly rect: Rectangle2D;
  readonly regionIndex: number;
}

export interface SharedMeshCommand2D extends SharedDrawState2D {
  readonly kind: 'mesh';
  readonly regionIndex: number;
  readonly geometryIndex: number;
}

export interface SharedBarrierCommand2D {
  readonly kind: 'barrier';
  readonly ordinal: number;
  readonly occurrenceId: number;
  readonly boundaryId: number;
  readonly reason: 'explicit-enter' | 'explicit-exit' | 'clip-enter' | 'clip-exit' | 'empty';
}

export type SharedRenderCommand2D = SharedRectangleCommand2D | SharedImageCommand2D
  | SharedMeshCommand2D | SharedBarrierCommand2D;

declare const sharedRenderFrame2DBrand: unique symbol;
export interface SharedRenderFrame2D {
  readonly [sharedRenderFrame2DBrand]: true;
  readonly profile: SharedFrameProfile2D;
  readonly colorRecipe: 'egret.linear-srgb-pma/1';
  readonly targetRepresentation: 'egret.srgb-pma8-target/1';
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

export interface SharedRenderHostAdapter extends HostAdapter {
  readonly sharedFrameProfile: SharedFrameProfile2D;
  renderSharedFrame(frame: SharedRenderFrame2D): undefined;
}
