// SPDX-License-Identifier: Apache-2.0
import { isAdmittedResourceManifest } from '@egret/contracts/resources';
import { createAssetRef, EgretError } from '@egret/runtime';
const APPLY = Reflect.apply;
const GET = WeakMap.prototype.get;
const SET = WeakMap.prototype.set;
const FREEZE = Object.freeze;
const bindingStates = new WeakMap();
const refStates = new WeakMap();
const typeTokens = new WeakMap();
let lastTypeToken = 0;
/** Authentication never reads a structural lookalike or proxy property. */
export function requireManifestBinding(value) {
    const state = APPLY(GET, bindingStates, [value]);
    if (state === undefined)
        throw new EgretError('MANIFEST_BINDING_INVALID');
    return state;
}
/** A matching ref ID alone cannot turn caller metadata into a verified source. */
export function requireManifestAssetRef(value) {
    const state = APPLY(GET, refStates, [value]);
    if (state === undefined)
        throw new EgretError('MANIFEST_BINDING_REF_INVALID');
    return state;
}
export function createManifestAssetBinding(manifest, assetId, type) {
    if (!isAdmittedResourceManifest(manifest))
        throw new EgretError('MANIFEST_BINDING_MANIFEST_INVALID');
    if (typeof assetId !== 'string')
        throw new EgretError('MANIFEST_BINDING_ASSET_INVALID');
    let entry;
    for (const candidate of manifest.entries) {
        if (candidate.id === assetId) {
            entry = candidate;
            break;
        }
    }
    if (entry === undefined)
        throw new EgretError('MANIFEST_BINDING_ASSET_INVALID');
    const known = APPLY(GET, typeTokens, [type]);
    const token = known ?? lastTypeToken + 1;
    if (!Number.isSafeInteger(token))
        throw new EgretError('MANIFEST_BINDING_ID_EXHAUSTED');
    // createAssetRef authenticates the type without reading its name/predicate.
    // Publish a new token only after that succeeds. No manager registration occurs.
    const ref = createAssetRef(type, 'egret.resource:' + entry.runtimeIdentity + ':type:' + token);
    if (known === undefined) {
        APPLY(SET, typeTokens, [type, token]);
        lastTypeToken = token;
    }
    const state = FREEZE({ manifest, entry, ref: ref });
    const binding = FREEZE({ ref });
    APPLY(SET, bindingStates, [binding, state]);
    APPLY(SET, refStates, [ref, state]);
    return binding;
}
//# sourceMappingURL=manifestResourceState.js.map