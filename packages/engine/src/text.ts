/** Share the explicit runtime entry's factory and owned public type identities. */
export { createTextRasterCache } from '@egret/runtime/text';
export type * from '@egret/runtime/text';
import type { DisplayObject } from '@egret/runtime';
import type { TextRasterMetrics, TextRasterRequestInput } from '@egret/runtime/text';
export { createTextField } from './textField.js';

declare const textFieldBrand: unique symbol;
/** Where a text field is: unprepared, ready or disposed, its revisions and its metrics. */
export interface TextFieldStatus {
  readonly state: 'unprepared' | 'ready' | 'disposed';
  readonly desiredRevision: number;
  readonly committedRevision: number | undefined;
  readonly pending: boolean;
  readonly metrics: TextRasterMetrics | undefined;
}
/** Factory-produced noneditable leaf; the brand has no runtime value. */
export interface TextField extends DisplayObject {
  readonly [textFieldBrand]: true;
  setRequest(input: TextRasterRequestInput): void;
  prepare(): Promise<TextRasterMetrics>;
  /** Drop the raster and cancel pending preparation. The latest request can be prepared again. */
  releaseRaster(): void;
  getStatus(): TextFieldStatus;
  dispose(): void;
}
