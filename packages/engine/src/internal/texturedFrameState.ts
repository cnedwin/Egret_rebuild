import type { TexturedRenderFrame2D, SharedRenderFrame2D } from '@egret/contracts';

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

// Shared completion has its own exact protocol identity within the existing
// Engine-private bridge. Neither registry is exported through the public SDK.
const completedSharedFrames = new WeakMap<object, SharedRenderFrame2D>();

export function registerSharedFrame(frame: SharedRenderFrame2D): void {
  apply(weakSet, completedSharedFrames, [frame, frame]);
}

export function readOwnedSharedFrame(value: unknown): SharedRenderFrame2D | undefined {
  return apply(weakGet, completedSharedFrames, [value]) as SharedRenderFrame2D | undefined;
}
