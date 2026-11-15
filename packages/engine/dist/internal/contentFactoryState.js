// SPDX-License-Identifier: Apache-2.0
import { EgretError } from '@egret/runtime';
const engines = new WeakMap();
/** Only genuine Engine construction installs captured manager and Scope authority. */
export function registerContentEngine(engine, operations) {
    engines.set(engine, Object.freeze(operations));
}
export function requireContentEngine(engine) {
    const value = engines.get(engine);
    if (value === undefined)
        throw new EgretError('CONTENT_ENGINE_INVALID');
    value.assertOpen();
    return value;
}
/** Private loader identity and catalog relationship; no structural loader grants authority. */
const contentLoaders = new WeakMap();
export function registerContentLoader(loader, authenticate) {
    contentLoaders.set(loader, authenticate);
}
export function authenticateContentLoader(loader, scope, imageId, sequenceId) {
    const authenticate = contentLoaders.get(loader);
    if (!authenticate)
        throw new EgretError('SEQUENCE_RESET_LOADER_INVALID');
    authenticate(scope, imageId, sequenceId);
}
/** Retain only the authored frame boundaries of genuine ContentLoader clips. */
const sequenceTimelines = new WeakMap();
export function registerSequenceTimeline(clip, frames) {
    let end = 0;
    sequenceTimelines.set(clip, Object.freeze(frames.map(frame => (end += frame.durationSeconds))));
}
export function hasSequenceTimeline(clip) {
    return sequenceTimelines.has(clip);
}
export function hasMatchingSequenceTimeline(source, candidate) {
    const first = sequenceTimelines.get(source), second = sequenceTimelines.get(candidate);
    return (first !== undefined &&
        second !== undefined &&
        first.length === second.length &&
        first.every((end, index) => end === second[index]));
}
//# sourceMappingURL=contentFactoryState.js.map