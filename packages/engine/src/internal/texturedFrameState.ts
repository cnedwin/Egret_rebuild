import type { SharedRenderFrame2D } from '@egret/contracts';

const weakGet = WeakMap.prototype.get;
const weakSet = WeakMap.prototype.set;
const apply = Reflect.apply;

// Only the Engine registers a completed frame. The registry is not exported through the public SDK.
const completedSharedFrames = new WeakMap<object, SharedRenderFrame2D>();

export function registerSharedFrame(frame: SharedRenderFrame2D): void {
  apply(weakSet, completedSharedFrames, [frame, frame]);
}

export function readOwnedSharedFrame(value: unknown): SharedRenderFrame2D | undefined {
  return apply(weakGet, completedSharedFrames, [value]) as SharedRenderFrame2D | undefined;
}
