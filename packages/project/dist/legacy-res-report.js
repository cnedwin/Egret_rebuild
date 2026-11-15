import { readLegacyResourceJSON } from "./legacy-res-json.js";
import { utf8Length } from "./unicode.js";
import { isPortablePath, pathCollisionKey } from "./paths.js";
function diagnostic(code, jsonPointer = "", source = "text", severity = "error") {
    return Object.freeze({
        code,
        source,
        severity,
        jsonPointer,
        message: code === "LEGACY_RES_INTERNAL_FAILED"
            ? "Resource declaration analysis failed internally."
            : severity === "warning"
                ? "Declaration is outside this structural profile."
                : "Resource declaration input is invalid or exceeds this profile."
    });
}
function publish(status, resourceRoot, originalText, resources, groups, diagnostics) {
    // No caller graph or parser record escapes; even each failure's empty arrays
    // and acceptance object are freshly owned. Recovery assumes this is possible.
    return Object.freeze({
        reportVersion: "0.1",
        scope: "legacy-res-declarations",
        profile: "legacy-res-comma-declarations-0.1",
        status,
        resourceRoot,
        originalText,
        resources: Object.freeze(resources),
        groups: Object.freeze(groups),
        diagnostics: Object.freeze(diagnostics),
        acceptance: Object.freeze({
            fileExistence: "unverified",
            decoding: "unverified",
            execution: "unverified",
            migration: "unverified"
        })
    });
}
function failure(code, at = "", source = "text") {
    return publish("invalid", null, null, [], [], [diagnostic(code, at, source)]);
}
function isRecord(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}
function unknownKey(record, allowed, prefix) {
    const key = Object.keys(record)
        .filter(key => !allowed.includes(key))
        .sort()[0];
    return key === undefined ? undefined : prefix + "/" + key.replaceAll("~", "~0").replaceAll("/", "~1");
}
export function analyzeLegacyResourceManifest(text, resourceRoot) {
    try {
        // Primitive checks precede every Unicode scan and never inspect caller objects.
        if (typeof text !== "string")
            return failure("LEGACY_RES_INPUT_INVALID");
        if (typeof resourceRoot !== "string")
            return failure("LEGACY_RES_INPUT_INVALID", "", "resourceRoot");
        if (text.length > 1048576)
            return failure("LEGACY_RES_LIMIT_EXCEEDED");
        const textBytes = utf8Length(text);
        if (!textBytes.ok)
            return failure("LEGACY_RES_INPUT_INVALID");
        if (textBytes.value > 1048576)
            return failure("LEGACY_RES_LIMIT_EXCEEDED");
        if (resourceRoot.length > 4096)
            return failure("LEGACY_RES_LIMIT_EXCEEDED", "", "resourceRoot");
        const rootBytes = utf8Length(resourceRoot);
        if (!rootBytes.ok)
            return failure("LEGACY_RES_INPUT_INVALID", "", "resourceRoot");
        if (rootBytes.value > 4096)
            return failure("LEGACY_RES_LIMIT_EXCEEDED", "", "resourceRoot");
        const parsed = readLegacyResourceJSON(text);
        if (parsed.status !== "ok")
            return publish(parsed.status, null, null, [], [], [Object.freeze({ ...parsed.diagnostic })]);
        if (!resourceRoot || !isPortablePath(resourceRoot))
            return failure("LEGACY_RES_PATH_INVALID", "", "resourceRoot");
        const root = parsed.value;
        if (!isRecord(root))
            return failure("LEGACY_RES_INPUT_INVALID");
        if (!Object.hasOwn(root, "resources") || !Array.isArray(root.resources))
            return failure("LEGACY_RES_INPUT_INVALID", "/resources");
        if (!Object.hasOwn(root, "groups") || !Array.isArray(root.groups))
            return failure("LEGACY_RES_INPUT_INVALID", "/groups");
        if (root.resources.length > 4096)
            return failure("LEGACY_RES_LIMIT_EXCEEDED", "/resources");
        if (root.groups.length > 1024)
            return failure("LEGACY_RES_LIMIT_EXCEEDED", "/groups");
        // Validate the admitted private graph without allocating normalized records.
        for (let i = 0; i < root.resources.length; i++) {
            const record = root.resources[i];
            const base = `/resources/${i}`;
            if (!isRecord(record))
                return failure("LEGACY_RES_INPUT_INVALID", base);
            for (const field of ["name", "type", "url", "subkeys", "scale9grid"]) {
                const present = Object.hasOwn(record, field);
                if ((field === "subkeys" || field === "scale9grid") && !present)
                    continue;
                if (!present || typeof record[field] !== "string" || (field === "name" && record[field] === "")) {
                    return failure("LEGACY_RES_INPUT_INVALID", base + "/" + field);
                }
            }
        }
        for (let i = 0; i < root.groups.length; i++) {
            const record = root.groups[i];
            const base = `/groups/${i}`;
            if (!isRecord(record))
                return failure("LEGACY_RES_INPUT_INVALID", base);
            for (const field of ["name", "keys"]) {
                if (!Object.hasOwn(record, field) ||
                    typeof record[field] !== "string" ||
                    (field === "name" && record[field] === "")) {
                    return failure("LEGACY_RES_INPUT_INVALID", base + "/" + field);
                }
            }
        }
        // These casts reflect the complete preceding shape checks; the graph stays private.
        const inputs = root.resources;
        const groupInputs = root.groups;
        const names = new Set();
        for (let i = 0; i < inputs.length; i++) {
            const name = inputs[i].name;
            if (names.has(name))
                return failure("LEGACY_RES_NAME_DUPLICATE", `/resources/${i}/name`);
            names.add(name);
        }
        const groupNames = new Set();
        for (let i = 0; i < groupInputs.length; i++) {
            const name = groupInputs[i].name;
            if (groupNames.has(name))
                return failure("LEGACY_RES_NAME_DUPLICATE", `/groups/${i}/name`);
            groupNames.add(name);
        }
        const projectPaths = [];
        const paths = new Map();
        for (let i = 0; i < inputs.length; i++) {
            const url = inputs[i].url;
            const at = `/resources/${i}/url`;
            // Terminating URL branches are intentionally conservative declarations,
            // not loading support, a URL parser, decoding or filesystem resolution.
            if (url.startsWith("//")) {
                projectPaths.push(null);
                continue;
            }
            if (url === "" || url.startsWith("/") || url.includes("\\") || /^[A-Za-z]:[/\\]/u.test(url)) {
                return failure("LEGACY_RES_PATH_INVALID", at);
            }
            if (/^[A-Za-z][A-Za-z0-9+.-]*:/u.test(url) || /[?#%]/u.test(url)) {
                projectPaths.push(null);
                continue;
            }
            const joined = resourceRoot + "/" + url;
            if (!isPortablePath(joined))
                return failure("LEGACY_RES_PATH_INVALID", at);
            const key = pathCollisionKey(joined);
            const previous = paths.get(key);
            if (previous !== undefined && previous !== joined)
                return failure("LEGACY_RES_PATH_COLLISION", at);
            paths.set(key, joined);
            projectPaths.push(joined);
        }
        // Count commas in already admitted strings BEFORE split, substrings or key
        // records. The native parser graph's earlier allocation is a separate bound.
        let totalKeys = 0;
        for (let i = 0; i < groupInputs.length; i++) {
            const keys = groupInputs[i].keys;
            if (keys !== "") {
                totalKeys++;
                for (let j = 0; j < keys.length; j++)
                    if (keys.charCodeAt(j) === 44)
                        totalKeys++;
            }
            if (totalKeys > 16384)
                return failure("LEGACY_RES_LIMIT_EXCEEDED", `/groups/${i}/keys`);
        }
        let unknown = unknownKey(root, ["resources", "groups"], "");
        for (let i = 0; unknown === undefined && i < inputs.length; i++) {
            unknown = unknownKey(root.resources[i], ["name", "type", "url", "subkeys", "scale9grid"], `/resources/${i}`);
        }
        for (let i = 0; unknown === undefined && i < groupInputs.length; i++) {
            unknown = unknownKey(root.groups[i], ["name", "keys"], `/groups/${i}`);
        }
        if (unknown !== undefined)
            return publish("unsupported", resourceRoot, text, [], [], [diagnostic("LEGACY_RES_SCHEMA_UNSUPPORTED", unknown, "text", "warning")]);
        // Validate all warnings before allocating/publishing declaration records.
        // A 257th warning is an invalid empty report, never a truncated inventory.
        const warnings = [];
        const warning = (code, at) => {
            if (warnings.length === 256)
                return failure("LEGACY_RES_LIMIT_EXCEEDED", at);
            warnings.push(diagnostic(code, at, "text", "warning"));
            return undefined;
        };
        const unsupported = [];
        for (let i = 0; i < inputs.length; i++) {
            const input = inputs[i];
            const fields = [
                [input.type !== "image" && input.type !== "json", "LEGACY_RES_TYPE_UNSUPPORTED", "type"],
                [projectPaths[i] === null, "LEGACY_RES_URL_UNSUPPORTED", "url"],
                [Object.hasOwn(input, "subkeys"), "LEGACY_RES_SUBKEYS_UNSUPPORTED", "subkeys"],
                [Object.hasOwn(input, "scale9grid"), "LEGACY_RES_SCALE9GRID_UNSUPPORTED", "scale9grid"]
            ];
            let ownUnsupported = false;
            for (const [outside, code, field] of fields)
                if (outside) {
                    ownUnsupported = true;
                    const failed = warning(code, `/resources/${i}/${field}`);
                    if (failed !== undefined)
                        return failed;
                }
            unsupported.push(ownUnsupported);
        }
        const tokens = [];
        for (let i = 0; i < groupInputs.length; i++) {
            const keys = groupInputs[i].keys;
            const declared = keys === "" ? [] : keys.split(",");
            tokens.push(declared);
            for (const key of declared)
                if (!names.has(key)) {
                    const failed = warning("LEGACY_RES_REFERENCE_UNRESOLVED", `/groups/${i}/keys`);
                    if (failed !== undefined)
                        return failed;
                }
        }
        const resources = inputs.map((input, i) => Object.freeze({
            name: input.name,
            type: input.type,
            url: input.url,
            projectPath: projectPaths[i],
            structuralStatus: unsupported[i] ? "unsupported" : "recognized",
            ...(Object.hasOwn(input, "subkeys") ? { subkeys: input.subkeys } : {}),
            ...(Object.hasOwn(input, "scale9grid") ? { scale9grid: input.scale9grid } : {})
        }));
        const groups = groupInputs.map((input, i) => Object.freeze({
            name: input.name,
            keys: input.keys,
            declaredKeys: Object.freeze(tokens[i].map((key) => Object.freeze({ key, relation: names.has(key) ? "resource" : "unresolved" })))
        }));
        return publish(warnings.length === 0 ? "recognized" : "unsupported", resourceRoot, text, resources, groups, warnings);
    }
    catch {
        // Recover only if a new failure record remains constructible. Neither OOM
        // recovery nor arbitrary poisoned intrinsics are a universal guarantee.
        return publish("incomplete", null, null, [], [], [diagnostic("LEGACY_RES_INTERNAL_FAILED")]);
    }
}
//# sourceMappingURL=legacy-res-report.js.map