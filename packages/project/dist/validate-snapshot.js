import { identitySchedule, validateOrdered, validationDiagnostic } from "./validation-order.js";
import { prepareCanonical } from "./canonical.js";
import { pathCollisionKey } from "./paths.js";
import { makeDiagnostic } from "./diagnostics.js";
import { FORMAT_DEFINITIONS } from "./format-shape.generated.js";
export function validateSnapshot(value, context) {
    const ordered = validateOrdered(value, "ProjectSnapshot", context);
    if (!ordered.ok)
        return ordered;
    const snapshot = ordered.value;
    const original = value;
    const prefix = context.pointerPrefix;
    const failed = (diagnostic) => Object.freeze({ ok: false, diagnostics: Object.freeze([diagnostic]) });
    const duplicate = (pointer, reason) => validationDiagnostic("PROJECT_ID_DUPLICATE", prefix + pointer, "schema", { reason });
    const entities = new Map();
    const files = new Map();
    const entityLocations = new Map();
    const entitySchedule = identitySchedule(original.entities, true);
    const fileSchedule = identitySchedule(original.files, true);
    // Complete target indices are non-diagnostic. Integrity diagnostics below
    // execute only in the generated snapshot declaration order.
    for (const entry of entitySchedule) {
        const item = entry.value;
        entities.set(item.id, item);
        entityLocations.set(item.id, entry.index);
    }
    for (const entry of fileSchedule) {
        const item = entry.value;
        files.set(item.id, item);
    }
    for (const field of FORMAT_DEFINITIONS.ProjectSnapshot.properties) {
        if (field.name === "roots") {
            const seen = new Set();
            for (let index = 0; index < snapshot.roots.length; index++) {
                const id = snapshot.roots[index];
                if (seen.has(id))
                    return failed(duplicate(`/roots/${index}`, "roots"));
                seen.add(id);
            }
        }
        else if (field.name === "entities" || field.name === "files") {
            const schedule = field.name === "entities" ? entitySchedule : fileSchedule;
            const seen = new Set();
            for (const entry of schedule) {
                const id = entry.key;
                if (seen.has(id))
                    return failed(duplicate(`/${field.name}/${entry.index}/id`, field.name));
                seen.add(id);
            }
            if (field.name === "entities") {
                for (const entry of entitySchedule) {
                    const item = entry.value;
                    const slots = new Set();
                    for (let refIndex = 0; refIndex < item.references.length; refIndex++) {
                        const slot = item.references[refIndex].slot;
                        if (slots.has(slot))
                            return failed(duplicate(`/entities/${entry.index}/references/${refIndex}/slot`, "slots"));
                        slots.add(slot);
                    }
                }
            }
            else {
                const paths = new Set();
                for (const entry of fileSchedule) {
                    const item = entry.value;
                    const key = pathCollisionKey(item.path);
                    if (paths.has(key))
                        return failed(validationDiagnostic("PROJECT_PATH_COLLISION", prefix + `/files/${entry.index}/path`));
                    paths.add(key);
                }
            }
        }
        else if (field.name === "retiredEntityIds" || field.name === "retiredFileIds") {
            const schedule = identitySchedule(original[field.name], false);
            const seen = new Set();
            for (const entry of schedule) {
                const id = entry.value;
                if (seen.has(id))
                    return failed(duplicate(`/${field.name}/${entry.index}`, field.name));
                seen.add(id);
            }
            const active = field.name === "retiredEntityIds" ? entities : files;
            for (const entry of schedule) {
                if (active.has(entry.value))
                    return failed(validationDiagnostic("PROJECT_ID_REUSED", prefix + `/${field.name}/${entry.index}`));
            }
        }
    }
    for (let index = 0; index < snapshot.roots.length; index++) {
        if (!entities.has(snapshot.roots[index]))
            return failed(validationDiagnostic("PROJECT_REFERENCE_MISSING", prefix + `/roots/${index}`, "references"));
    }
    for (const entity of snapshot.entities) {
        const index = entityLocations.get(entity.id);
        for (let refIndex = 0; refIndex < entity.references.length; refIndex++) {
            const ref = entity.references[refIndex];
            const pointer = prefix + `/entities/${index}/references/${refIndex}`;
            if (ref.target === "entity") {
                const target = entities.get(ref.id);
                if (!target)
                    return failed(validationDiagnostic("PROJECT_REFERENCE_MISSING", pointer + "/id", "references"));
                if (target.kind !== ref.expectedKind)
                    return failed(validationDiagnostic("PROJECT_REFERENCE_TYPE_MISMATCH", pointer + "/expectedKind", "references"));
            }
            else {
                const target = files.get(ref.id);
                if (!target)
                    return failed(validationDiagnostic("PROJECT_REFERENCE_MISSING", pointer + "/id", "references"));
                if (target.role !== ref.expectedRole)
                    return failed(validationDiagnostic("PROJECT_REFERENCE_TYPE_MISMATCH", pointer + "/expectedRole", "references"));
            }
        }
    }
    if (snapshot.entities.length + snapshot.retiredEntityIds.length > context.limits.maxEntities)
        return failed(validationDiagnostic("PROJECT_LIMIT_EXCEEDED", prefix + "/entities"));
    if (snapshot.files.length + snapshot.retiredFileIds.length > context.limits.maxFiles)
        return failed(validationDiagnostic("PROJECT_LIMIT_EXCEEDED", prefix + "/files"));
    for (const entity of snapshot.entities) {
        if (entity.references.length > context.limits.maxReferencesPerEntity)
            return failed(validationDiagnostic("PROJECT_LIMIT_EXCEEDED", prefix + `/entities/${entityLocations.get(entity.id)}/references`));
    }
    const prepared = prepareCanonical(snapshot);
    if (prepared.utf8Bytes > context.limits.maxSnapshotUtf8Bytes)
        return failed(validationDiagnostic("PROJECT_LIMIT_EXCEEDED", prefix));
    const diagnostics = [];
    if (snapshot.entities.length)
        diagnostics.push(makeDiagnostic({
            code: "PROJECT_KIND_UNCHECKED",
            phase: "schema",
            severity: "warning",
            jsonPointer: prefix + "/entities",
            message: "Entity domain data was not checked.",
            details: { count: snapshot.entities.length }
        }));
    if (snapshot.files.length)
        diagnostics.push(makeDiagnostic({
            code: "PROJECT_CONTENT_UNVERIFIED",
            phase: "schema",
            severity: "warning",
            jsonPointer: prefix + "/files",
            message: "File content was not verified.",
            details: { count: snapshot.files.length }
        }));
    return Object.freeze({ ok: true, value: prepared, diagnostics: Object.freeze(diagnostics) });
}
//# sourceMappingURL=validate-snapshot.js.map