// SPDX-License-Identifier: Apache-2.0
// Independently authored runtime admission of the finite first-party producer schemas.
import { EgretError } from '@egret/runtime';
export function contentFault(stage, id, cause) {
    return new EgretError('CONTENT_' + stage + '_FAILED', { cause: Object.freeze({ assetId: id, stage, cause }) });
}
function invalid(id) {
    throw contentFault('ARTIFACT', id);
}
function object(value, keys, id) {
    if (value === null || typeof value !== 'object' || Array.isArray(value))
        invalid(id);
    const found = Object.keys(value);
    if (found.length !== keys.length || found.some(key => !keys.includes(key)))
        invalid(id);
    return value;
}
function integer(value, min, max) {
    return (typeof value === 'number' && Number.isSafeInteger(value) && !Object.is(value, -0) && value >= min && value <= max);
}
function canonical(value) {
    if (value === null || typeof value !== 'object')
        return JSON.stringify(value);
    if (Array.isArray(value))
        return '[' + value.map(canonical).join(',') + ']';
    const record = value;
    return ('{' +
        Object.keys(record)
            .sort()
            .map(key => JSON.stringify(key) + ':' + canonical(record[key]))
            .join(',') +
        '}');
}
function parse(text, id) {
    if (typeof text !== 'string' || text.length > 4194304 || /\p{Surrogate}/u.test(text))
        invalid(id);
    let bytes = 0;
    for (const char of text) {
        const code = char.codePointAt(0);
        bytes += code < 128 ? 1 : code < 2048 ? 2 : code < 65536 ? 3 : 4;
    }
    if (bytes > 4194304)
        invalid(id);
    try {
        return JSON.parse(text);
    }
    catch (cause) {
        throw contentFault('JSON', id, cause);
    }
}
function frame(value, width, height, sequence, id) {
    const f = object(value, sequence
        ? ['x', 'y', 'width', 'height', 'durationSeconds', 'layout']
        : ['name', 'x', 'y', 'width', 'height', 'layout'], id);
    if (!integer(f.x, 0, width) ||
        !integer(f.y, 0, height) ||
        !integer(f.width, 1, width) ||
        !integer(f.height, 1, height) ||
        f.x + f.width > width ||
        f.y + f.height > height)
        invalid(id);
    const layout = object(f.layout, ['sourceWidth', 'sourceHeight', 'trimX', 'trimY', 'packedRotation'], id);
    if (!integer(layout.sourceWidth, 1, 65535) ||
        !integer(layout.sourceHeight, 1, 65535) ||
        !integer(layout.trimX, 0, 65535) ||
        !integer(layout.trimY, 0, 65535) ||
        layout.trimX + f.width > layout.sourceWidth ||
        layout.trimY + f.height > layout.sourceHeight ||
        layout.packedRotation !== 0)
        invalid(id);
    Object.freeze(layout);
    return Object.freeze(f);
}
function sequence(value, id) {
    const input = object(value, ['atlasWidth', 'atlasHeight', 'frames'], id);
    if (!integer(input.atlasWidth, 1, 4096) ||
        !integer(input.atlasHeight, 1, 4096) ||
        input.atlasWidth * input.atlasHeight > 4194304 ||
        !Array.isArray(input.frames) ||
        input.frames.length < 1 ||
        input.frames.length > 1024)
        invalid(id);
    let total = 0;
    const frames = input.frames.map(value => {
        const f = frame(value, input.atlasWidth, input.atlasHeight, true, id), duration = f.durationSeconds;
        if (typeof duration !== 'number' || !Number.isFinite(duration))
            invalid(id);
        const ms = Math.round(duration * 1000), next = total + duration;
        if (!integer(ms, 1, 65535) || duration !== ms / 1000 || !Number.isFinite(next) || next <= total)
            invalid(id);
        total = next;
        return f;
    });
    return Object.freeze({
        atlasWidth: input.atlasWidth,
        atlasHeight: input.atlasHeight,
        frames: Object.freeze(frames)
    });
}
export function parseAtlasArtifact(text, id) {
    const value = object(parse(text, id), ['format', 'pageDependency', 'width', 'height', 'frames', 'sequenceInput'], id);
    if (value.format !== 'egret.atlas/1' ||
        value.pageDependency !== 0 ||
        !integer(value.width, 1, 4096) ||
        !integer(value.height, 1, 4096) ||
        value.width * value.height > 4194304 ||
        !Array.isArray(value.frames) ||
        value.frames.length < 1 ||
        value.frames.length > 1024)
        invalid(id);
    const input = sequence(value.sequenceInput, id);
    if (input.atlasWidth !== value.width ||
        input.atlasHeight !== value.height ||
        input.frames.length !== value.frames.length)
        invalid(id);
    const names = new Set();
    let units = 0;
    const frames = value.frames.map((v, index) => {
        const f = frame(v, value.width, value.height, false, id), other = input.frames[index];
        if (typeof f.name !== 'string' || !f.name || f.name.length > 128 || names.has(f.name))
            invalid(id);
        names.add(f.name);
        units += f.name.length;
        if (units > 32768 ||
            ['x', 'y', 'width', 'height'].some(key => f[key] !== other[key]) ||
            canonical(f.layout) !== canonical(other.layout))
            invalid(id);
        const first = value.frames[0].layout;
        const layout = f.layout;
        if (layout.sourceWidth !== first.sourceWidth || layout.sourceHeight !== first.sourceHeight)
            invalid(id);
        return f;
    });
    // Reject duplicate keys, noncanonical numeric aliases and unknown producer bytes.
    if (canonical(value) !== text)
        invalid(id);
    return Object.freeze({
        width: value.width,
        height: value.height,
        frames: Object.freeze(frames),
        sequenceInput: input
    });
}
export function parseSequenceArtifact(text, id, atlas) {
    const value = object(parse(text, id), ['format', 'atlasDependency', 'sequenceInput'], id);
    if (value.format !== 'egret.sequence/1' || value.atlasDependency !== 0)
        invalid(id);
    const input = sequence(value.sequenceInput, id);
    if (canonical(value) !== text || canonical(input) !== canonical(atlas.sequenceInput))
        invalid(id);
    return input;
}
//# sourceMappingURL=contentArtifacts.js.map