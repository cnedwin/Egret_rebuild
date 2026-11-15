import { sha256Utf8, utf8ByteLength } from './sha256.js';
const MAX_BYTES = 4194304;
const admitted = new WeakMap();
class Refusal extends Error {
    code;
    pointer;
    constructor(code, pointer) {
        super(code);
        this.code = code;
        this.pointer = pointer;
    }
}
function fail(code, pointer) {
    throw new Refusal(code, pointer);
}
const escape = (text) => text.replaceAll('~', '~0').replaceAll('/', '~1');
function success(value) {
    return Object.freeze({ ok: true, value, diagnostics: Object.freeze([]) });
}
function rejection(error) {
    const known = error instanceof Refusal
        ? error
        : new Refusal(error instanceof RangeError ? 'RESOURCE_LIMIT_EXCEEDED' : 'RESOURCE_INPUT_INVALID', '');
    const diagnostic = Object.freeze({
        code: known.code,
        pointer: known.pointer,
        message: known.code.replaceAll('_', ' ') + '.'
    });
    return Object.freeze({ ok: false, diagnostics: Object.freeze([diagnostic]) });
}
// A complete descriptor-only copy precedes semantic work. Accessors never run,
// aliases are copied, and only the active ancestor chain is a JSON cycle.
function capture(input) {
    let bytes = 0;
    const ancestors = new Set();
    const charge = (amount, pointer) => {
        bytes += amount;
        if (bytes > MAX_BYTES)
            fail('RESOURCE_LIMIT_EXCEEDED', pointer);
    };
    function copy(value, pointer, depth) {
        if (depth > 32)
            fail('RESOURCE_LIMIT_EXCEEDED', pointer);
        if (value === null || typeof value === 'boolean' || typeof value === 'string' || typeof value === 'number') {
            if (typeof value === 'number' && !Number.isFinite(value))
                fail('RESOURCE_INPUT_INVALID', pointer);
            if (typeof value === 'string') {
                if (value.length > MAX_BYTES)
                    fail('RESOURCE_LIMIT_EXCEEDED', pointer);
                utf8ByteLength(value);
            }
            charge(utf8ByteLength(JSON.stringify(value)), pointer);
            return value;
        }
        if (typeof value !== 'object' || ancestors.has(value))
            fail('RESOURCE_INPUT_INVALID', pointer);
        const array = Array.isArray(value), prototype = Object.getPrototypeOf(value);
        if (array ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null)
            fail('RESOURCE_INPUT_INVALID', pointer);
        const keys = Reflect.ownKeys(value);
        let length = 0;
        if (array) {
            const descriptor = Object.getOwnPropertyDescriptor(value, 'length');
            if (!descriptor || !('value' in descriptor) || !Number.isSafeInteger(descriptor.value) || descriptor.value < 0)
                fail('RESOURCE_INPUT_INVALID', pointer);
            length = descriptor.value;
            if (keys.length !== length + 1)
                fail('RESOURCE_INPUT_INVALID', pointer);
        }
        const out = array
            ? []
            : Object.create(null);
        charge(2, pointer);
        ancestors.add(value);
        let index = 0;
        for (const key of keys) {
            if (array && key === 'length')
                continue;
            if (typeof key !== 'string' || (array && key !== String(index)))
                fail('RESOURCE_INPUT_INVALID', pointer);
            // Refuse raw oversized keys before diagnostic escaping can expand them.
            if (key.length > MAX_BYTES)
                fail('RESOURCE_LIMIT_EXCEEDED', pointer);
            const child = pointer + '/' + escape(key), descriptor = Object.getOwnPropertyDescriptor(value, key);
            if (!descriptor || !descriptor.enumerable || !('value' in descriptor))
                fail('RESOURCE_INPUT_INVALID', child);
            if (index++)
                charge(1, pointer);
            if (!array) {
                utf8ByteLength(key);
                charge(utf8ByteLength(JSON.stringify(key)) + 1, child);
            }
            const copied = copy(descriptor.value, child, depth + 1);
            if (Array.isArray(out))
                out.push(copied);
            else
                out[key] = copied;
        }
        ancestors.delete(value);
        return Object.freeze(out);
    }
    return copy(input, '', 1);
}
// JSON.stringify cannot serialize sorted integer-looking object keys. Emit each
// key explicitly after UTF-16 code-unit sorting; never normalize authored Unicode.
function canonical(value) {
    if (value === null || typeof value === 'string' || typeof value === 'boolean' || typeof value === 'number')
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
function record(value, pointer) {
    if (value === null || typeof value !== 'object' || Array.isArray(value))
        fail('RESOURCE_INPUT_INVALID', pointer);
    return value;
}
function exact(value, keys, pointer) {
    const result = record(value, pointer), actual = Object.keys(result);
    if (actual.length !== keys.length || actual.some(key => !keys.includes(key)))
        fail('RESOURCE_INPUT_INVALID', pointer);
    return result;
}
function text(value, pointer, maximum = 128) {
    if (typeof value !== 'string' ||
        value.length === 0 ||
        utf8ByteLength(value) > maximum ||
        /[\u0000-\u001f\u007f]/u.test(value))
        fail('RESOURCE_INPUT_INVALID', pointer);
    return value;
}
function identity(value, prefix, pointer) {
    const result = text(value, pointer);
    if (!new RegExp('^' + prefix + '_[A-Za-z0-9][A-Za-z0-9_-]*$', 'u').test(result))
        fail('RESOURCE_INPUT_INVALID', pointer);
    return result;
}
function array(value, pointer) {
    if (!Array.isArray(value))
        fail('RESOURCE_INPUT_INVALID', pointer);
    return value;
}
function digest(value, pointer) {
    if (typeof value !== 'string' || !/^[0-9a-f]{64}$/u.test(value))
        fail('RESOURCE_INPUT_INVALID', pointer);
    return value;
}
function portablePath(value, pointer) {
    const result = text(value, pointer, 1024);
    if (/[\\\u0000-\u001f\u007f:*?"<>|%#]/u.test(result) ||
        result
            .split('/')
            .some(part => !part ||
            part === '.' ||
            part === '..' ||
            /[ .]$/u.test(part) ||
            /^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/iu.test(part)))
        fail('RESOURCE_PATH_INVALID', pointer);
    return result;
}
function file(value, role, pointer) {
    const item = exact(value, ['id', 'path', 'role', 'mediaType', 'sha256', 'byteLength'], pointer);
    identity(item.id, 'f', pointer + '/id');
    portablePath(item.path, pointer + '/path');
    if (item.role !== role)
        fail('RESOURCE_FILE_MISMATCH', pointer + '/role');
    const mediaType = text(item.mediaType, pointer + '/mediaType');
    if (/[^\u0021-\u007e]/u.test(mediaType))
        fail('RESOURCE_INPUT_INVALID', pointer + '/mediaType');
    digest(item.sha256, pointer + '/sha256');
    if (typeof item.byteLength !== 'number' ||
        !Number.isSafeInteger(item.byteLength) ||
        item.byteLength < 0 ||
        Object.is(item.byteLength, -0))
        fail('RESOURCE_INPUT_INVALID', pointer + '/byteLength');
    return item;
}
function prepare(input, claimed, sourceOnly = false) {
    const raw = exact(capture(input), ['format', 'projectId', 'targetProfile', 'versions', 'entries'], '');
    if (raw.format !==
        (sourceOnly ? 'egret.resource-build-plan/1' : claimed ? 'egret.resource-manifest/1' : 'egret.resource-build/1'))
        fail('RESOURCE_FORMAT_UNSUPPORTED', '/format');
    const projectId = identity(raw.projectId, 'p', '/projectId'), targetProfile = text(raw.targetProfile, '/targetProfile');
    const versionData = exact(raw.versions, ['engineVersion', 'resourceFormatVersion', 'toolProtocolVersion'], '/versions');
    text(versionData.engineVersion, '/versions/engineVersion');
    text(versionData.resourceFormatVersion, '/versions/resourceFormatVersion');
    if (versionData.toolProtocolVersion !== '1.0')
        fail('RESOURCE_FORMAT_UNSUPPORTED', '/versions/toolProtocolVersion');
    const versions = versionData, entries = array(raw.entries, '/entries');
    if (entries.length > 4096)
        fail('RESOURCE_LIMIT_EXCEEDED', '/entries');
    const selected = new Map();
    const fileRecords = new Map(), pathOwners = new Map();
    let edges = 0;
    const baseKeys = [
        'id',
        'resourceKind',
        'source',
        'artifact',
        'importer',
        'settings',
        'artifactFormatVersion',
        'targetProfile',
        'dependencies',
        'provenance'
    ];
    for (let index = 0; index < entries.length; index++) {
        const pointer = '/entries/' + index, item = exact(entries[index], sourceOnly
            ? baseKeys.filter(key => key !== 'artifact')
            : claimed
                ? [...baseKeys, 'buildKey', 'runtimeIdentity']
                : baseKeys, pointer);
        const id = identity(item.id, 'e', pointer + '/id');
        if (selected.has(id))
            fail('RESOURCE_ID_DUPLICATE', pointer + '/id');
        text(item.resourceKind, pointer + '/resourceKind');
        text(item.artifactFormatVersion, pointer + '/artifactFormatVersion');
        if (text(item.targetProfile, pointer + '/targetProfile') !== targetProfile)
            fail('RESOURCE_DEPENDENCY_INVALID', pointer + '/targetProfile');
        const importer = exact(item.importer, ['id', 'version'], pointer + '/importer');
        text(importer.id, pointer + '/importer/id');
        text(importer.version, pointer + '/importer/version');
        const settings = record(item.settings, pointer + '/settings');
        record(item.provenance, pointer + '/provenance');
        if (utf8ByteLength(canonical(settings)) > 65536)
            fail('RESOURCE_LIMIT_EXCEEDED', pointer + '/settings');
        const dependencies = array(item.dependencies, pointer + '/dependencies'), seen = new Set();
        edges += dependencies.length;
        if (edges > 8192)
            fail('RESOURCE_LIMIT_EXCEEDED', pointer + '/dependencies');
        for (let dependency = 0; dependency < dependencies.length; dependency++) {
            const name = identity(dependencies[dependency], 'e', pointer + '/dependencies/' + dependency);
            if (seen.has(name))
                fail('RESOURCE_DEPENDENCY_INVALID', pointer + '/dependencies/' + dependency);
            seen.add(name);
        }
        const files = sourceOnly
            ? [['source', 'source']]
            : [
                ['source', 'source'],
                ['artifact', 'asset']
            ];
        for (const [name, role] of files) {
            const current = file(item[name], role, pointer + '/' + name), encoded = canonical(current), old = fileRecords.get(current.id);
            if (old !== undefined && old !== encoded)
                fail('RESOURCE_FILE_MISMATCH', pointer + '/' + name);
            fileRecords.set(current.id, encoded);
            const pathKey = current.path.normalize('NFC').toLowerCase(), owner = pathOwners.get(pathKey);
            if (owner !== undefined && owner !== current.id)
                fail('RESOURCE_FILE_MISMATCH', pointer + '/' + name + '/path');
            pathOwners.set(pathKey, current.id);
        }
        if (claimed) {
            digest(item.buildKey, pointer + '/buildKey');
            digest(item.runtimeIdentity, pointer + '/runtimeIdentity');
        }
        const entry = Object.freeze({
            id: item.id,
            resourceKind: item.resourceKind,
            source: item.source,
            ...(sourceOnly ? {} : { artifact: item.artifact }),
            importer: item.importer,
            settings: item.settings,
            artifactFormatVersion: item.artifactFormatVersion,
            targetProfile: item.targetProfile,
            dependencies: item.dependencies,
            provenance: item.provenance
        });
        selected.set(id, claimed ? { entry, pointer, claimed: item } : { entry, pointer });
    }
    for (const { entry, pointer } of selected.values())
        for (const dependency of entry.dependencies)
            if (!selected.has(dependency))
                fail('RESOURCE_DEPENDENCY_INVALID', pointer + '/dependencies');
    const heights = new Map(), active = new Set(), order = [];
    function visit(id, depth) {
        const node = selected.get(id);
        if (depth > 32)
            fail('RESOURCE_LIMIT_EXCEEDED', node.pointer + '/dependencies');
        const prior = heights.get(id);
        if (prior !== undefined)
            return prior;
        if (active.has(id))
            fail('RESOURCE_DEPENDENCY_INVALID', node.pointer + '/dependencies');
        active.add(id);
        let height = 1;
        for (const dependency of node.entry.dependencies)
            height = Math.max(height, 1 + visit(dependency, depth + 1));
        // A memoized shallow visit must not hide a deeper incoming path in a DAG.
        if (height > 32)
            fail('RESOURCE_LIMIT_EXCEEDED', node.pointer + '/dependencies');
        heights.set(id, height);
        active.delete(id);
        order.push(id);
        return height;
    }
    const ids = [...selected.keys()].sort();
    for (const id of ids)
        visit(id, 1);
    return { projectId, targetProfile, versions, selected, ids, order };
}
// The pre-artifact and final-manifest paths share this exact projection and hash.
// File binding and artifact identity remain outside the intrinsic build key.
function buildIdentity(entry, targetProfile, versions, completed) {
    const dependencies = entry.dependencies.map(dependency => ({
        id: dependency,
        buildKey: completed.get(dependency).buildKey
    }));
    const build = canonical({
        format: 'egret.resource-build-key/1',
        resourceKind: entry.resourceKind,
        importer: entry.importer,
        settings: entry.settings,
        artifactFormatVersion: entry.artifactFormatVersion,
        targetProfile,
        versions,
        source: { sha256: entry.source.sha256, byteLength: entry.source.byteLength },
        dependencies,
        provenance: entry.provenance
    });
    return { build, buildKey: sha256Utf8(build) };
}
function evaluate(input, claimed) {
    const { projectId, targetProfile, versions, selected, ids, order } = prepare(input, claimed);
    const completed = new Map(), inputs = new Map();
    for (const id of order) {
        const node = selected.get(id), entry = node.entry;
        const { build, buildKey } = buildIdentity(entry, targetProfile, versions, completed);
        const runtime = canonical({
            format: 'egret.resource-identity/1',
            projectId,
            id,
            buildKey,
            artifact: {
                sha256: entry.artifact.sha256,
                byteLength: entry.artifact.byteLength,
                mediaType: entry.artifact.mediaType
            },
            artifactFormatVersion: entry.artifactFormatVersion,
            targetProfile
        });
        const runtimeIdentity = sha256Utf8(runtime);
        if (node.claimed && (node.claimed.buildKey !== buildKey || node.claimed.runtimeIdentity !== runtimeIdentity))
            fail('RESOURCE_KEY_MISMATCH', node.pointer);
        completed.set(id, Object.freeze({ ...entry, buildKey, runtimeIdentity }));
        inputs.set(id, Object.freeze({ build, runtime }));
    }
    const manifest = Object.freeze({
        format: 'egret.resource-manifest/1',
        projectId,
        targetProfile,
        versions,
        entries: Object.freeze(ids.map(id => completed.get(id)))
    });
    const encoded = canonical(manifest);
    if (utf8ByteLength(encoded) > MAX_BYTES)
        fail('RESOURCE_LIMIT_EXCEEDED', '');
    admitted.set(manifest, Object.freeze({ text: encoded, inputs }));
    return manifest;
}
// Plans validate source metadata only; they confer no final manifest admission.
export function validateResourceBuildPlanDescription(input) {
    try {
        const { projectId, targetProfile, versions, selected, ids } = prepare(input, false, true);
        const result = Object.freeze({
            format: 'egret.resource-build-plan/1',
            projectId,
            targetProfile,
            versions,
            entries: Object.freeze(ids.map(id => selected.get(id).entry))
        });
        return success(result);
    }
    catch (error) {
        return rejection(error);
    }
}
export function evaluateResourceBuildKeys(description) {
    try {
        const { projectId, targetProfile, versions, selected, ids, order } = prepare(description, false, true);
        const completed = new Map();
        for (const id of order) {
            const entry = selected.get(id).entry, { buildKey } = buildIdentity(entry, targetProfile, versions, completed);
            completed.set(id, Object.freeze({ ...entry, buildKey }));
        }
        const result = Object.freeze({
            format: 'egret.resource-build-keys/1',
            projectId,
            targetProfile,
            versions,
            entries: Object.freeze(ids.map(id => completed.get(id)))
        });
        if (utf8ByteLength(canonical(result)) > MAX_BYTES)
            fail('RESOURCE_LIMIT_EXCEEDED', '');
        return success(result);
    }
    catch (error) {
        return rejection(error);
    }
}
// Description admission shares every schema/graph rule while deliberately doing
// no hashing. Project tools can describe declared metadata without a build claim.
export function validateResourceBuildDescription(input) {
    try {
        const { projectId, targetProfile, versions, selected, ids } = prepare(input, false);
        const result = Object.freeze({
            format: 'egret.resource-build/1',
            projectId,
            targetProfile,
            versions,
            entries: Object.freeze(ids.map(id => selected.get(id).entry))
        });
        return success(result);
    }
    catch (error) {
        return rejection(error);
    }
}
export function buildResourceManifest(description) {
    try {
        return success(evaluate(description, false));
    }
    catch (error) {
        return rejection(error);
    }
}
export function admitResourceManifest(value) {
    try {
        return success(evaluate(value, true));
    }
    catch (error) {
        return rejection(error);
    }
}
export function isAdmittedResourceManifest(value) {
    return value !== null && typeof value === 'object' && admitted.has(value);
}
export function serializeResourceManifest(manifest) {
    if (!isAdmittedResourceManifest(manifest))
        return rejection(new Refusal('RESOURCE_INPUT_INVALID', ''));
    return success(admitted.get(manifest).text);
}
export function getResourceManifestIdentityInputs(manifest, id) {
    if (!isAdmittedResourceManifest(manifest))
        throw new TypeError('A genuine admitted manifest is required.');
    const result = admitted.get(manifest).inputs.get(id);
    if (result === undefined)
        throw new RangeError('Resource ID is absent from this manifest.');
    return result;
}
//# sourceMappingURL=manifestAdmission.js.map