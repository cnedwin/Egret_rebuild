import type { HostAdapter } from "./HostAdapter.js";
import type { ImageData2D, TextureRegion2D } from "./ImageData2D.js";

/** Immutable logical-coordinate protocol shared by CPU capture and render hosts. */
export interface Matrix2D {
  readonly a: number;
  readonly b: number;
  readonly c: number;
  readonly d: number;
  readonly tx: number;
  readonly ty: number;
}

export interface Rectangle2D {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface ClipRectangle2D {
  readonly matrix: Matrix2D;
  readonly rect: Rectangle2D;
}

export interface RectangleCommand2D {
  readonly kind: "rect";
  readonly matrix: Matrix2D;
  readonly rect: Rectangle2D;
  readonly color: number;
  readonly alpha: number;
  readonly clips: readonly ClipRectangle2D[];
}

export interface ImageCommand2D {
  readonly kind: "image";
  readonly matrix: Matrix2D;
  readonly rect: Rectangle2D;
  readonly alpha: number;
  readonly clips: readonly ClipRectangle2D[];
  readonly imageIndex: number;
  readonly sourceRect: TextureRegion2D;
}

export type RenderCommand2D = RectangleCommand2D | ImageCommand2D;

export interface FrameOptions2D {
  readonly width: number;
  readonly height: number;
  readonly clearColor?: number;
  readonly clearAlpha?: number;
}

export interface RenderFrame2D {
  readonly frameId: number;
  readonly width: number;
  readonly height: number;
  readonly clearColor: number;
  readonly clearAlpha: number;
  readonly commands: readonly RenderCommand2D[];
  readonly images?: readonly ImageData2D[];
}

export interface RenderHostAdapter extends HostAdapter {
  renderFrame(frame: RenderFrame2D): undefined;
}
