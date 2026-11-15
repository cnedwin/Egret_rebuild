import { canonicalize } from "./canonical.js";
function records(before, after) {
    const previous = new Map(before.map(record => [record.id, record]));
    const current = new Map(after.map(record => [record.id, record]));
    const added = [], changed = [], removed = [];
    for (const record of after) {
        const old = previous.get(record.id);
        if (!old)
            added.push(record.id);
        else if (canonicalize(old) !== canonicalize(record))
            changed.push(record.id);
    }
    for (const record of before)
        if (!current.has(record.id))
            removed.push(record.id);
    return {
        added: Object.freeze(added.sort()),
        changed: Object.freeze(changed.sort()),
        removed: Object.freeze(removed.sort())
    };
}
// Compare complete canonical records and metadata, preserving ordered roots.
// Diff ID arrays use UTF-16 sorting; revision and retirement knowledge alone
// do not count as authored-content changes.
export function diffSnapshots(before, after) {
    const entities = records(before.entities, after.entities), files = records(before.files, after.files);
    return Object.freeze({
        addedEntityIds: entities.added,
        changedEntityIds: entities.changed,
        removedEntityIds: entities.removed,
        addedFileIds: files.added,
        changedFileIds: files.changed,
        removedFileIds: files.removed,
        metadataChanged: before.name !== after.name || canonicalize({ ...before.versions }) !== canonicalize({ ...after.versions }),
        rootsChanged: before.roots.length !== after.roots.length || before.roots.some((id, index) => id !== after.roots[index])
    });
}
//# sourceMappingURL=diff.js.map