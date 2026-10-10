import type { TexturedRenderFrame2D } from '@egret/contracts';

const completedFrames = new WeakMap<object, TexturedRenderFrame2D>();
const weakGet = WeakMap.prototype.get;
const weakSet = WeakMap.prototype.set;
const apply = Reflect.apply;

/** Engine-only commit after every owned table, command and record is frozen. */
export function registerTexturedFrame(frame: TexturedRenderFrame2D): void {
  apply(weakSet, completedFrames, [frame, frame]);
}

/** Identity lookup reads no caller field and grants no resource/GPU authority. */
export function readOwnedTexturedFrame(value: unknown): TexturedRenderFrame2D | undefined {
  return apply(weakGet, completedFrames, [value]) as TexturedRenderFrame2D | undefined;
}
