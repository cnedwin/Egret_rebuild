/** Share the explicit runtime entry's factory and owned public type identities. */
export { createTextRasterCache } from '@egret/runtime/text';
export type * from '@egret/runtime/text';
import type { DisplayObject } from '@egret/runtime';
import type { TextRasterMetrics, TextRasterRequestInput } from '@egret/runtime/text';
export { createTextField } from './textField.js';

declare const textFieldBrand: unique symbol;
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
  getStatus(): TextFieldStatus;
  dispose(): void;
}
