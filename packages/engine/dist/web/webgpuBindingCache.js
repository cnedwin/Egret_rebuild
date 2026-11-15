const MAX_BINDINGS = 4096;
// Capture collection operations before any submission. Runtime prototype changes
// must not turn metadata lookup, unlinking or cleanup into external callbacks.
const NativeMap = Map, NativeSet = Set;
const mapGet = Function.prototype.call.bind(Map.prototype.get);
const mapSet = Function.prototype.call.bind(Map.prototype.set);
const mapDelete = Function.prototype.call.bind(Map.prototype.delete);
const mapClear = Function.prototype.call.bind(Map.prototype.clear);
const mapSize = Function.prototype.call.bind(Object.getOwnPropertyDescriptor(Map.prototype, 'size').get);
const setAdd = Function.prototype.call.bind(Set.prototype.add);
const setDelete = Function.prototype.call.bind(Set.prototype.delete);
const setSize = Function.prototype.call.bind(Object.getOwnPropertyDescriptor(Set.prototype, 'size').get);
const setForEach = Function.prototype.call.bind(Set.prototype.forEach);
/** The Host qualifies READY candidates and owns every resource and submission. */
export function createWebGPUBindingCache(session) {
    const absentTexture = {}, absentView = {}, absentSampler = {};
    const layouts = new NativeMap();
    const textures = new NativeMap();
    const buffers = new NativeMap();
    let active = true, count = 0;
    let oldest, newest;
    function pathFor(key) {
        if (key.session !== session || key.uniform.session !== session)
            return undefined;
        // Snapshot only native identities/scalars. A key or handle may also retain
        // record-owned data; neither object belongs in the searchable directory.
        return {
            layout: key.layout,
            texture: key.texture ?? absentTexture,
            view: key.view ?? absentView,
            sampler: key.sampler ?? absentSampler,
            uniform: key.uniform.identity,
            offset: key.offset,
            size: key.size
        };
    }
    function find(path) {
        const byTexture = mapGet(layouts, path.layout);
        const byView = byTexture && mapGet(byTexture, path.texture);
        const bySampler = byView && mapGet(byView, path.view);
        const byUniform = bySampler && mapGet(bySampler, path.sampler);
        const byOffset = byUniform && mapGet(byUniform, path.uniform);
        const bySize = byOffset && mapGet(byOffset, path.offset);
        return bySize && mapGet(bySize, path.size);
    }
    function unlink(entry) {
        if (entry.previous)
            entry.previous.next = entry.next;
        else
            oldest = entry.next;
        if (entry.next)
            entry.next.previous = entry.previous;
        else
            newest = entry.previous;
        entry.previous = undefined;
        entry.next = undefined;
    }
    function append(entry) {
        entry.previous = newest;
        if (newest)
            newest.next = entry;
        else
            oldest = entry;
        newest = entry;
    }
    function touch(entry) {
        if (entry === newest)
            return;
        unlink(entry);
        append(entry);
    }
    function addReverse(index, identity, entry) {
        let dependents = mapGet(index, identity);
        if (!dependents) {
            dependents = new NativeSet();
            mapSet(index, identity, dependents);
        }
        setAdd(dependents, entry);
    }
    function removeReverse(index, identity, entry) {
        const dependents = mapGet(index, identity);
        if (!dependents)
            return;
        setDelete(dependents, entry);
        if (setSize(dependents) === 0)
            mapDelete(index, identity);
    }
    function drop(entry) {
        const path = entry.path;
        const byTexture = mapGet(layouts, path.layout);
        const byView = mapGet(byTexture, path.texture);
        const bySampler = mapGet(byView, path.view);
        const byUniform = mapGet(bySampler, path.sampler);
        const byOffset = mapGet(byUniform, path.uniform);
        const bySize = mapGet(byOffset, path.offset);
        mapDelete(bySize, path.size);
        // Prune every empty branch so evicted identities cannot remain retained
        // by an otherwise empty index. Reverse sets follow the same rule.
        if (mapSize(bySize) === 0)
            mapDelete(byOffset, path.offset);
        if (mapSize(byOffset) === 0)
            mapDelete(byUniform, path.uniform);
        if (mapSize(byUniform) === 0)
            mapDelete(bySampler, path.sampler);
        if (mapSize(bySampler) === 0)
            mapDelete(byView, path.view);
        if (mapSize(byView) === 0)
            mapDelete(byTexture, path.texture);
        if (mapSize(byTexture) === 0)
            mapDelete(layouts, path.layout);
        if (path.texture !== absentTexture)
            removeReverse(textures, path.texture, entry);
        removeReverse(buffers, path.uniform, entry);
        unlink(entry);
        count--;
    }
    function insert(path, binding) {
        let byTexture = mapGet(layouts, path.layout);
        if (!byTexture) {
            byTexture = new NativeMap();
            mapSet(layouts, path.layout, byTexture);
        }
        let byView = mapGet(byTexture, path.texture);
        if (!byView) {
            byView = new NativeMap();
            mapSet(byTexture, path.texture, byView);
        }
        let bySampler = mapGet(byView, path.view);
        if (!bySampler) {
            bySampler = new NativeMap();
            mapSet(byView, path.view, bySampler);
        }
        let byUniform = mapGet(bySampler, path.sampler);
        if (!byUniform) {
            byUniform = new NativeMap();
            mapSet(bySampler, path.sampler, byUniform);
        }
        let byOffset = mapGet(byUniform, path.uniform);
        if (!byOffset) {
            byOffset = new NativeMap();
            mapSet(byUniform, path.uniform, byOffset);
        }
        let bySize = mapGet(byOffset, path.offset);
        if (!bySize) {
            bySize = new NativeMap();
            mapSet(byOffset, path.offset, bySize);
        }
        const entry = { path, binding, previous: undefined, next: undefined };
        mapSet(bySize, path.size, entry);
        if (path.texture !== absentTexture)
            addReverse(textures, path.texture, entry);
        addReverse(buffers, path.uniform, entry);
        append(entry);
        count++;
    }
    function invalidateDependents(index, identity) {
        const dependents = mapGet(index, identity);
        if (!dependents)
            return;
        // Captured iteration invokes only local drop, and safely advances while
        // drop deletes the current entry. No runtime iterator is consulted.
        setForEach(dependents, drop);
    }
    function clearEntries() {
        active = false;
        mapClear(layouts);
        mapClear(textures);
        mapClear(buffers);
        oldest = undefined;
        newest = undefined;
        count = 0;
    }
    return {
        lookup(key) {
            if (!active)
                return undefined;
            const path = pathFor(key), entry = path && find(path);
            if (!entry)
                return undefined;
            touch(entry);
            return entry.binding;
        },
        publish(candidates) {
            if (!active)
                return;
            try {
                for (const candidate of candidates) {
                    const path = pathFor(candidate.key);
                    if (!path)
                        continue;
                    const existing = find(path);
                    if (existing) {
                        touch(existing);
                        continue;
                    }
                    if (count === MAX_BINDINGS)
                        drop(oldest);
                    insert(path, candidate.binding);
                }
            }
            catch (cause) {
                // A failed insertion may have created only some index branches.
                // Drop all metadata without traversing a possibly partial LRU;
                // the Host still owns every referenced native resource.
                clearEntries();
                throw cause;
            }
        },
        invalidateTexture(identity) {
            invalidateDependents(textures, identity);
        },
        invalidateBuffer(identity) {
            invalidateDependents(buffers, identity);
        },
        invalidate() {
            active = false;
        },
        clear() {
            clearEntries();
        }
    };
}
//# sourceMappingURL=webgpuBindingCache.js.map