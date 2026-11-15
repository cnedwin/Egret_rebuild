// SPDX-License-Identifier: Apache-2.0
// Official Core owns format semantics; this adapter owns admission and copied metadata.
import * as Core from '@esotericsoftware/spine-core';
import { AssetLease, Texture } from '@egret/engine';
import { spineFault } from './catalog.js';
import { readSpineJson } from './jsonAdmission.js';
import { readSpineBinary } from './binaryAdmission.js';
const APPLY = Reflect.apply;
const LEASE_VALUE = Object.getOwnPropertyDescriptor(AssetLease.prototype, 'value').get;
const WIDTH = Object.getOwnPropertyDescriptor(Texture.prototype, 'width').get;
const HEIGHT = Object.getOwnPropertyDescriptor(Texture.prototype, 'height').get;
const IMAGE = Object.getOwnPropertyDescriptor(Texture.prototype, 'imageData').get;
const RECT = Object.getOwnPropertyDescriptor(Texture.prototype, 'sourceRect').get;
const VIEW = Object.getOwnPropertyDescriptor(Texture.prototype, 'viewRegion').get;
function integer(v, min, max) {
    return Number.isSafeInteger(v) && v >= min && v <= max;
}
function label(v) {
    return typeof v === 'string' && v.length > 0 && v.length <= 255 && !/[\p{Surrogate}\u0000-\u001f\u007f]/u.test(v);
}
/** Dimension-only Core texture: no native renderer or ownership of the borrowed lease. */
class PageTexture extends Core.Texture {
    constructor(width, height) {
        super(Object.freeze({ width, height }));
    }
    setFilters(_min, _mag) { }
    setWraps(_u, _v) { }
    dispose() { }
}
export function parseSpineSetup(id, source, atlasText, pageNames, imageIds, leases, allowPrerelease) {
    const binary = source instanceof Uint8Array;
    if (typeof atlasText !== 'string' ||
        atlasText.length > 262144 ||
        (binary ? source.byteLength > 4194304 : typeof source !== 'string' || source.length > 2097152))
        throw spineFault('SOURCE_LIMIT', id);
    const decoded = binary ? undefined : readSpineJson(source, id, allowPrerelease);
    const atlas = new Core.TextureAtlas(atlasText);
    try {
        if (atlas.pages.length !== pageNames.length || atlas.regions.length > 8192)
            throw spineFault('PAGE_BINDING', id);
        const pages = [];
        for (let i = 0; i < atlas.pages.length; i++) {
            const page = atlas.pages[i], lease = leases[i], texture = APPLY(LEASE_VALUE, lease, []), width = APPLY(WIDTH, texture, []), height = APPLY(HEIGHT, texture, []);
            const image = APPLY(IMAGE, texture, []), rect = APPLY(RECT, texture, []);
            if (APPLY(VIEW, texture, []) !== null ||
                rect.x !== 0 ||
                rect.y !== 0 ||
                image.width !== width ||
                image.height !== height)
                throw spineFault('PAGE_TEXTURE', id);
            if (page.name !== pageNames[i] ||
                !integer(width, 1, 4096) ||
                !integer(height, 1, 4096) ||
                width * height > 4194304 ||
                page.width !== width ||
                page.height !== height)
                throw spineFault('PAGE_DIMENSIONS', id);
            // PMA transport needs its own qualified normalization/color profile.
            if (page.pma)
                throw spineFault('PAGE_ALPHA_PROFILE', id);
            page.setTexture(new PageTexture(width, height));
            pages.push(Object.freeze({ name: page.name, imageId: imageIds[i], width, height, sourcePremultiplied: false }));
        }
        const loader = new Core.AtlasAttachmentLoader(atlas), data = binary ? readSpineBinary(loader, source, id) : new Core.SkeletonJson(loader).readSkeletonData(decoded);
        const exportVersion = data.version;
        if (typeof exportVersion !== 'string' ||
            !/^4\.3\.\d+(?:-beta)?$/.test(exportVersion) ||
            (!allowPrerelease && exportVersion.endsWith('-beta')))
            throw spineFault('EXPORT_VERSION', id);
        if (data.bones.length > 1024 ||
            data.slots.length > 2048 ||
            data.skins.length > 128 ||
            data.animations.length > 1024)
            throw spineFault('SETUP_LIMIT', id);
        const skins = data.skins.map(s => s.name), animations = data.animations.map(a => ({ name: a.name, duration: a.duration }));
        if (skins.some(n => !label(n)) ||
            animations.some(a => !label(a.name) || !Number.isFinite(a.duration) || a.duration < 0 || a.duration > 86400))
            throw spineFault('SETUP', id);
        const info = Object.freeze({
            coreVersion: '4.3.13',
            exportVersion,
            format: binary ? 'binary' : 'json',
            prerelease: exportVersion.endsWith('-beta'),
            boneCount: data.bones.length,
            slotCount: data.slots.length,
            skins: Object.freeze(skins),
            animations: Object.freeze(animations.map(a => Object.freeze(a))),
            pages: Object.freeze(pages)
        });
        return { data, atlas, info };
    }
    catch (cause) {
        atlas.dispose();
        throw spineFault('PARSE', id, cause);
    }
}
//# sourceMappingURL=parse.js.map