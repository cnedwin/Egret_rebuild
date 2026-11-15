import { FORMAT_DEFINITIONS } from "./format-shape.generated.js";
export function resolveFormatNode(node) {
    if (!node.ref)
        return node;
    return resolveFormatNode(FORMAT_DEFINITIONS[node.ref]);
}
export function matchesNodeType(value, node) {
    const resolved = resolveFormatNode(node);
    if (resolved.oneOf)
        return resolved.oneOf.some(branch => matchesNodeType(value, branch));
    if (resolved.type === "null")
        return value === null;
    if (resolved.type === "array")
        return Array.isArray(value);
    if (resolved.type === "object")
        return value !== null && typeof value === "object" && !Array.isArray(value);
    return typeof value === resolved.type;
}
// This probe inspects only the selected node, never its declared descendants.
export function inspectShapeNode(value, node, _jsonPointer) {
    if (value === undefined)
        return { ok: false, reason: "missing" };
    const resolved = resolveFormatNode(node);
    if (!matchesNodeType(value, resolved))
        return { ok: false, reason: resolved.oneOf ? "union" : "type" };
    if (resolved.const !== undefined && value !== resolved.const)
        return { ok: false, reason: "const" };
    if (resolved.enum && !resolved.enum.some(item => item === value))
        return { ok: false, reason: "enum" };
    if (resolved.additionalProperties === false && value !== null && typeof value === "object") {
        const allowed = new Set(resolved.properties?.map(property => property.name));
        if (Object.keys(value).some(key => !allowed.has(key)))
            return { ok: false, reason: "unknown-field" };
    }
    return { ok: true };
}
//# sourceMappingURL=shape.js.map