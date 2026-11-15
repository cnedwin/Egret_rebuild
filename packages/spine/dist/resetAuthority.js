// SPDX-License-Identifier: Apache-2.0
import { EgretError } from '@egret/engine';
const loaders = new WeakMap();
const displays = new WeakMap();
export function registerResetLoader(loader, authenticate) {
    loaders.set(loader, authenticate);
}
export function authenticateResetLoader(loader, scope) {
    const authenticate = loaders.get(loader);
    if (!authenticate)
        throw new EgretError('SPINE_RESET_LOADER_INVALID');
    authenticate(scope);
}
export function registerResetDisplay(display, instance) {
    displays.set(display, instance);
}
export function authenticateResetDisplay(display, instance) {
    if (displays.get(display) !== instance ||
        !instance ||
        !display ||
        display.getStatus().isDisposed ||
        instance.isDisposed)
        throw new EgretError('SPINE_RESET_INITIAL_INVALID');
}
//# sourceMappingURL=resetAuthority.js.map