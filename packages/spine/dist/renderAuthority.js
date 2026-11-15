// SPDX-License-Identifier: Apache-2.0
import { EgretError } from '@egret/engine';
const ports = new WeakMap();
/** Private genuine-instance capability; copied snapshots never authorize rendering. */
export function registerSpineRender(instance, port) {
    ports.set(instance, port);
}
export function requireSpineRender(instance) {
    const port = ports.get(instance);
    if (!port)
        throw new EgretError('SPINE_DISPLAY_INSTANCE_INVALID');
    return port;
}
//# sourceMappingURL=renderAuthority.js.map