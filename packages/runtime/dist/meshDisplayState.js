import { recordVisualChange, VISUAL_CONTENT, VISUAL_BINDING } from "./displayVisualState.js";
// One authoritative content slot; resource classes remain type-only imports.
const states = new WeakMap();
const readPublishedState = states.get.bind(states);
/** Slot registration survives cleanup; it is not display-class identity. */
export function hasMeshState(value) {
    return states.has(value);
}
/** Cached content conveys no active lease entitlement or live Texture authority. */
export function readMeshState(node) {
    return states.get(node);
}
/** Authentic Mesh2D/NineSliceBitmap operations publish only privately admitted content. */
export function writeMeshState(node, value) {
    const changed = readPublishedState(node) !== value;
    states.set(node, value);
    // Mesh replacement, NineSlice resize and cleanup share this publication.
    if (changed)
        recordVisualChange(node, VISUAL_CONTENT | VISUAL_BINDING);
}
//# sourceMappingURL=meshDisplayState.js.map