import type { HostAdapter } from './HostAdapter.js';
import type { ImageData2D, TextureRegion2D } from './ImageData2D.js';
import type { ClipRectangle2D, Matrix2D, RenderCommand2D } from './RenderFrame2D.js';
import type { TexturedGeometry2D } from './TexturedGeometry2D.js';

/** Explicit opt-in protocol; the legacy rect/image union remains independent. */
export const TEXTURED_FRAME_PROFILE_2D: 'egret.textured-frame2d/1' = 'egret.textured-frame2d/1';
export type TexturedFrameProfile2D = typeof TEXTURED_FRAME_PROFILE_2D;

export interface TexturedMeshCommand2D {
  readonly kind: 'mesh';
  readonly matrix: Matrix2D;
  readonly alpha: number;
  readonly clips: readonly ClipRectangle2D[];
  readonly imageIndex: number;
  readonly sourceRect: TextureRegion2D;
  readonly geometryIndex: number;
}

export type TexturedRenderCommand2D = RenderCommand2D | TexturedMeshCommand2D;

// The Engine's private completed-frame registry supplies runtime authority.
// This erased brand cannot be manufactured through a public constructor/symbol.
declare const texturedRenderFrame2DBrand: unique symbol;
export interface TexturedRenderFrame2D {
  readonly [texturedRenderFrame2DBrand]: true;
  readonly profile: TexturedFrameProfile2D;
  readonly frameId: number;
  readonly width: number;
  readonly height: number;
  readonly clearColor: number;
  readonly clearAlpha: number;
  readonly commands: readonly TexturedRenderCommand2D[];
  readonly images: readonly ImageData2D[];
  readonly geometries: readonly TexturedGeometry2D[];
}

export interface TexturedRenderHostAdapter extends HostAdapter {
  readonly texturedFrameProfile: TexturedFrameProfile2D;
  renderTexturedFrame(frame: TexturedRenderFrame2D): undefined;
}
