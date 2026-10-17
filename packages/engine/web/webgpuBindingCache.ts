import type { BufferHandle } from './webgpuBufferPool.js';

export interface DrawBindingKey {
    readonly session: object;
    readonly layout: GPUBindGroupLayout;
    readonly texture: object | undefined;
    readonly view: GPUTextureView | undefined;
    readonly sampler: GPUSampler | undefined;
    readonly uniform: BufferHandle;
    readonly offset: 0;
    readonly size: 16 | 64;
}
export interface DrawBindingCandidate {
    readonly key: DrawBindingKey;
    readonly binding: GPUBindGroup;
}
export interface WebGPUBindingCache {
    lookup(key: DrawBindingKey): GPUBindGroup | undefined;
    publish(candidates: readonly DrawBindingCandidate[]): void;
    invalidateTexture(identity: object): void;
    invalidateBuffer(identity: object): void;
    invalidate(): void;
    clear(): void;
}

interface BindingPath {
    readonly layout: GPUBindGroupLayout;
    readonly texture: object;
    readonly view: object;
    readonly sampler: object;
    readonly uniform: object;
    readonly offset: number;
    readonly size: number;
}
interface BindingEntry {
    readonly path: BindingPath;
    readonly binding: GPUBindGroup;
    previous: BindingEntry | undefined;
    next: BindingEntry | undefined;
}
type Sizes = Map<number, BindingEntry>;
type Offsets = Map<number, Sizes>;
type Uniforms = Map<object, Offsets>;
type Samplers = Map<object, Uniforms>;
type Views = Map<object, Samplers>;
type Textures = Map<object, Views>;

const MAX_BINDINGS = 4096;

// Capture collection operations before any submission. Runtime prototype changes
// must not turn metadata lookup, unlinking or cleanup into external callbacks.
const NativeMap = Map, NativeSet = Set;
const mapGet = Function.prototype.call.bind(Map.prototype.get) as <K, V>(map: Map<K, V>, key: K) => V | undefined;
const mapSet = Function.prototype.call.bind(Map.prototype.set) as <K, V>(map: Map<K, V>, key: K, value: V) => void;
const mapDelete = Function.prototype.call.bind(Map.prototype.delete) as <K, V>(map: Map<K, V>, key: K) => void;
const mapClear = Function.prototype.call.bind(Map.prototype.clear) as <K, V>(map: Map<K, V>) => void;
const mapSize = Function.prototype.call.bind(Object.getOwnPropertyDescriptor(Map.prototype, 'size')!.get!) as <K, V>(map: Map<K, V>) => number;
const setAdd = Function.prototype.call.bind(Set.prototype.add) as <T>(set: Set<T>, value: T) => void;
const setDelete = Function.prototype.call.bind(Set.prototype.delete) as <T>(set: Set<T>, value: T) => void;
const setSize = Function.prototype.call.bind(Object.getOwnPropertyDescriptor(Set.prototype, 'size')!.get!) as <T>(set: Set<T>) => number;
const setForEach = Function.prototype.call.bind(Set.prototype.forEach) as <T>(set: Set<T>, callback: (value: T) => void) => void;

/** The Host qualifies READY candidates and owns every resource and submission. */
export function createWebGPUBindingCache(session: object): WebGPUBindingCache {
    const absentTexture = {}, absentView = {}, absentSampler = {};
    const layouts = new NativeMap<GPUBindGroupLayout, Textures>();
    const textures = new NativeMap<object, Set<BindingEntry>>();
    const buffers = new NativeMap<object, Set<BindingEntry>>();
    let active = true, count = 0;
    let oldest: BindingEntry | undefined, newest: BindingEntry | undefined;

    function pathFor(key: DrawBindingKey): BindingPath | undefined {
        if (key.session !== session || key.uniform.session !== session) return undefined;
        // Snapshot only native identities/scalars. A key or handle may also retain
        // record-owned data; neither object belongs in the searchable directory.
        return { layout: key.layout, texture: key.texture ?? absentTexture,
            view: key.view ?? absentView, sampler: key.sampler ?? absentSampler,
            uniform: key.uniform.identity, offset: key.offset, size: key.size };
    }
    function find(path: BindingPath): BindingEntry | undefined {
        const byTexture = mapGet(layouts, path.layout);
        const byView = byTexture && mapGet(byTexture, path.texture);
        const bySampler = byView && mapGet(byView, path.view);
        const byUniform = bySampler && mapGet(bySampler, path.sampler);
        const byOffset = byUniform && mapGet(byUniform, path.uniform);
        const bySize = byOffset && mapGet(byOffset, path.offset);
        return bySize && mapGet(bySize, path.size);
    }
    function unlink(entry: BindingEntry): void {
        if (entry.previous) entry.previous.next = entry.next;
        else oldest = entry.next;
        if (entry.next) entry.next.previous = entry.previous;
        else newest = entry.previous;
        entry.previous = undefined; entry.next = undefined;
    }
    function append(entry: BindingEntry): void {
        entry.previous = newest;
        if (newest) newest.next = entry;
        else oldest = entry;
        newest = entry;
    }
    function touch(entry: BindingEntry): void {
        if (entry === newest) return;
        unlink(entry); append(entry);
    }
    function addReverse(index: Map<object, Set<BindingEntry>>, identity: object, entry: BindingEntry): void {
        let dependents = mapGet(index, identity);
        if (!dependents) { dependents = new NativeSet(); mapSet(index, identity, dependents); }
        setAdd(dependents, entry);
    }
    function removeReverse(index: Map<object, Set<BindingEntry>>, identity: object, entry: BindingEntry): void {
        const dependents = mapGet(index, identity);
        if (!dependents) return;
        setDelete(dependents, entry);
        if (setSize(dependents) === 0) mapDelete(index, identity);
    }
    function drop(entry: BindingEntry): void {
        const path = entry.path;
        const byTexture = mapGet(layouts, path.layout)!;
        const byView = mapGet(byTexture, path.texture)!;
        const bySampler = mapGet(byView, path.view)!;
        const byUniform = mapGet(bySampler, path.sampler)!;
        const byOffset = mapGet(byUniform, path.uniform)!;
        const bySize = mapGet(byOffset, path.offset)!;
        mapDelete(bySize, path.size);
        // Prune every empty branch so evicted identities cannot remain retained
        // by an otherwise empty index. Reverse sets follow the same rule.
        if (mapSize(bySize) === 0) mapDelete(byOffset, path.offset);
        if (mapSize(byOffset) === 0) mapDelete(byUniform, path.uniform);
        if (mapSize(byUniform) === 0) mapDelete(bySampler, path.sampler);
        if (mapSize(bySampler) === 0) mapDelete(byView, path.view);
        if (mapSize(byView) === 0) mapDelete(byTexture, path.texture);
        if (mapSize(byTexture) === 0) mapDelete(layouts, path.layout);
        if (path.texture !== absentTexture) removeReverse(textures, path.texture, entry);
        removeReverse(buffers, path.uniform, entry);
        unlink(entry); count--;
    }
    function insert(path: BindingPath, binding: GPUBindGroup): void {
        let byTexture = mapGet(layouts, path.layout);
        if (!byTexture) { byTexture = new NativeMap(); mapSet(layouts, path.layout, byTexture); }
        let byView = mapGet(byTexture, path.texture);
        if (!byView) { byView = new NativeMap(); mapSet(byTexture, path.texture, byView); }
        let bySampler = mapGet(byView, path.view);
        if (!bySampler) { bySampler = new NativeMap(); mapSet(byView, path.view, bySampler); }
        let byUniform = mapGet(bySampler, path.sampler);
        if (!byUniform) { byUniform = new NativeMap(); mapSet(bySampler, path.sampler, byUniform); }
        let byOffset = mapGet(byUniform, path.uniform);
        if (!byOffset) { byOffset = new NativeMap(); mapSet(byUniform, path.uniform, byOffset); }
        let bySize = mapGet(byOffset, path.offset);
        if (!bySize) { bySize = new NativeMap(); mapSet(byOffset, path.offset, bySize); }
        const entry: BindingEntry = { path, binding, previous: undefined, next: undefined };
        mapSet(bySize, path.size, entry);
        if (path.texture !== absentTexture) addReverse(textures, path.texture, entry);
        addReverse(buffers, path.uniform, entry);
        append(entry); count++;
    }
    function invalidateDependents(index: Map<object, Set<BindingEntry>>, identity: object): void {
        const dependents = mapGet(index, identity);
        if (!dependents) return;
        // Captured iteration invokes only local drop, and safely advances while
        // drop deletes the current entry. No runtime iterator is consulted.
        setForEach(dependents, drop);
    }
    function clearEntries(): void {
        active = false;
        mapClear(layouts); mapClear(textures); mapClear(buffers);
        oldest = undefined; newest = undefined; count = 0;
    }
    return {
        lookup(key) {
            if (!active) return undefined;
            const path = pathFor(key), entry = path && find(path);
            if (!entry) return undefined;
            touch(entry); return entry.binding;
        },
        publish(candidates) {
            if (!active) return;
            try {
                for (const candidate of candidates) {
                    const path = pathFor(candidate.key);
                    if (!path) continue;
                    const existing = find(path);
                    if (existing) { touch(existing); continue; }
                    if (count === MAX_BINDINGS) drop(oldest!);
                    insert(path, candidate.binding);
                }
            } catch (cause) {
                // A failed insertion may have created only some index branches.
                // Drop all metadata without traversing a possibly partial LRU;
                // the Host still owns every referenced native resource.
                clearEntries(); throw cause;
            }
        },
        invalidateTexture(identity) { invalidateDependents(textures, identity); },
        invalidateBuffer(identity) { invalidateDependents(buffers, identity); },
        invalidate() { active = false; },
        clear() { clearEntries(); },
    };
}
