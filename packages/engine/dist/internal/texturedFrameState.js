const weakGet = WeakMap.prototype.get;
const weakSet = WeakMap.prototype.set;
const apply = Reflect.apply;
// Only the Engine registers a completed frame. The registry is not exported through the public SDK.
const completedSharedFrames = new WeakMap();
export function registerSharedFrame(frame) {
    apply(weakSet, completedSharedFrames, [frame, frame]);
}
export function readOwnedSharedFrame(value) {
    return apply(weakGet, completedSharedFrames, [value]);
}
//# sourceMappingURL=texturedFrameState.js.map