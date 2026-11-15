// SPDX-License-Identifier: Apache-2.0
import { EgretError } from '@egret/runtime';
/** Wrap only caller operations, so a deliberately thrown EgretError remains the cause. */
function external(code, read) {
    try {
        return read();
    }
    catch (cause) {
        if (cause instanceof EgretError && cause.code === 'ANIMATION_REENTRANT')
            throw cause;
        throw new EgretError(code, { cause });
    }
}
function fields(value, allowed, code) {
    if (value === null || typeof value !== 'object')
        throw new EgretError(code);
    if (external(code, () => Array.isArray(value)))
        throw new EgretError(code);
    for (const key of external(code, () => Reflect.ownKeys(value))) {
        if (typeof key !== 'string' || !allowed.includes(key))
            throw new EgretError(code);
    }
    return value;
}
function own(input, key, code) {
    return external(code, () => (Object.hasOwn(input, key) ? input[key] : undefined));
}
export function admitRate(value) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 16)
        throw new EgretError('ANIMATION_RATE_INVALID');
    return value === 0 ? 0 : value;
}
/** Copy only bounded scalar descriptors, including one array-length observation. */
export function captureOptions(value, duration, durationKnown = true) {
    const code = 'ANIMATION_OPTIONS_INVALID';
    const input = fields(value, ['profile', 'rate', 'totalPlays', 'markers', 'onEvent'], code);
    const profile = own(input, 'profile', code), rawRate = own(input, 'rate', code);
    const rawPlays = own(input, 'totalPlays', code), rawMarkers = own(input, 'markers', code);
    const listener = own(input, 'onEvent', code);
    if (profile !== 'egret.sequence-control/1')
        throw new EgretError(code);
    let rate;
    try {
        rate = admitRate(rawRate === undefined ? 1 : rawRate);
    }
    catch {
        throw new EgretError(code);
    }
    const totalPlays = rawPlays === undefined ? 1 : rawPlays;
    if (totalPlays !== 'infinite' &&
        (typeof totalPlays !== 'number' || !Number.isInteger(totalPlays) || totalPlays < 1 || totalPlays > 1_000_000))
        throw new EgretError(code);
    if (typeof duration !== 'number' ||
        duration <= 0 ||
        !Number.isFinite(duration) ||
        duration > 2 ** 32 ||
        (durationKnown &&
            totalPlays !== 'infinite' &&
            (!Number.isFinite(duration * totalPlays) || duration * totalPlays <= 0 || duration * totalPlays > 2 ** 32)))
        throw new EgretError('ANIMATION_TIME_LIMIT');
    if (listener !== undefined && typeof listener !== 'function')
        throw new EgretError(code);
    const markers = [], ids = new Set();
    if (rawMarkers !== undefined) {
        if (!external(code, () => Array.isArray(rawMarkers)))
            throw new EgretError(code);
        const array = rawMarkers;
        const length = external(code, () => array.length);
        if (typeof length !== 'number' || !Number.isInteger(length) || length < 0 || length > 64)
            throw new EgretError(code);
        for (let index = 0; index < length; index++) {
            if (!external(code, () => Object.hasOwn(array, index)))
                throw new EgretError(code);
            const marker = fields(external(code, () => array[index]), ['id', 'timeSeconds'], code);
            const id = own(marker, 'id', code), time = own(marker, 'timeSeconds', code);
            if (typeof id !== 'string' ||
                !/^[A-Za-z][A-Za-z0-9_.-]{0,63}$/.test(id) ||
                ids.has(id) ||
                typeof time !== 'number' ||
                !Number.isFinite(time) ||
                time < 0 ||
                time > 2 ** 32 ||
                (durationKnown && time > duration))
                throw new EgretError(code);
            ids.add(id);
            markers.push(Object.freeze({ id, timeSeconds: time === 0 ? 0 : time, markerIndex: index }));
        }
    }
    markers.sort((a, b) => a.timeSeconds - b.timeSeconds || a.markerIndex - b.markerIndex);
    return Object.freeze({
        rate,
        totalPlays,
        markers: Object.freeze(markers),
        listener: listener
    });
}
export function captureSeek(value) {
    const code = 'ANIMATION_SEEK_INVALID';
    const input = fields(value, ['timeSeconds', 'replayEvents'], code);
    const time = own(input, 'timeSeconds', code), replay = own(input, 'replayEvents', code);
    if (typeof time !== 'number' ||
        !Number.isFinite(time) ||
        time < 0 ||
        (replay !== undefined && typeof replay !== 'boolean'))
        throw new EgretError(code);
    return Object.freeze({ kind: 'seek', time: time === 0 ? 0 : time, replay: replay ?? false });
}
//# sourceMappingURL=sequenceInput.js.map