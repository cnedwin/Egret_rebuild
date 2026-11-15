// Capture callback-free collection operations before any Host native callback.
// Claim uses only these operations and preallocated nodes/leases after detaching.
const NativeMap = Map, NativeSet = Set, NativeWeakMap = WeakMap, NativeWeakSet = WeakSet;
const mapGet = Function.prototype.call.bind(Map.prototype.get);
const mapSet = Function.prototype.call.bind(Map.prototype.set);
const mapHas = Function.prototype.call.bind(Map.prototype.has);
const mapDelete = Function.prototype.call.bind(Map.prototype.delete);
const setAdd = Function.prototype.call.bind(Set.prototype.add);
const setHas = Function.prototype.call.bind(Set.prototype.has);
const weakGet = Function.prototype.call.bind(WeakMap.prototype.get);
const weakSet = Function.prototype.call.bind(WeakMap.prototype.set);
const weakHas = Function.prototype.call.bind(WeakSet.prototype.has);
const weakAdd = Function.prototype.call.bind(WeakSet.prototype.add);
const MAX_IDLE_BYTES = 33554432;
const MAX_IDLE_ENTRIES = 4096;
// A captured resource may acquire exactly one allocation identity, even when two
// Hosts borrow one device. Native object identity alone is not an allocation ID.
const registeredResources = new NativeWeakSet();
/** Native proofs belong to the Host; confirmed outcomes alone change these charges. */
export function createRetentionLedger(session, diagnostics) {
    const indexes = new NativeMap();
    const nodes = new NativeWeakMap();
    const leaseNodes = new NativeWeakMap();
    const claims = new NativeWeakMap();
    const returns = new NativeWeakMap();
    const idle = { bytes: 0, count: 0, bytesKey: 'idleBytes', countKey: 'idleEntries' }, leased = { bytes: 0, count: 0, bytesKey: 'leasedBytes', countKey: 'leasedEntries' };
    const reserved = { bytes: 0, count: 0, bytesKey: 'reservedBytes', countKey: 'reservedEntries' }, detached = { bytes: 0, count: 0, bytesKey: 'detachedBytes', countKey: 'detachedEntries' };
    const unknown = { bytes: 0, count: 0, bytesKey: 'unknownBytes', countKey: 'unknownEntries' };
    let head, tail;
    let revision = {}, active = true;
    function requireActive() {
        if (!active)
            throw new TypeError('Inactive buffer pool');
    }
    function requireNode(handle) {
        const node = weakGet(nodes, handle);
        if (!node)
            throw new TypeError('Foreign buffer handle');
        return node;
    }
    function admit(input) {
        // Backend wrappers own the fresh plain-data snapshot and its finite
        // descriptor validation. Frozen is a misuse check, not an authority brand.
        const request = input.request, key = input.key;
        if (!Object.isFrozen(request))
            throw new TypeError('Mutable retention request');
        if (!Number.isSafeInteger(request.id) ||
            request.id < 0 ||
            !Number.isSafeInteger(request.byteLength) ||
            request.byteLength <= 0 ||
            request.byteLength % 4 !== 0 ||
            typeof key !== 'string' ||
            key.length === 0) {
            throw new TypeError('Invalid retention request');
        }
        return { request, key };
    }
    function charge(total, node, direction) {
        total.bytes += direction * node.handle.byteLength;
        total.count += direction;
        if (diagnostics) {
            const bytes = diagnostics.current[total.bytesKey] + direction * node.handle.byteLength, count = diagnostics.current[total.countKey] + direction;
            if (bytes > Number.MAX_SAFE_INTEGER || count > Number.MAX_SAFE_INTEGER)
                diagnostics.saturated = true;
            diagnostics.current[total.bytesKey] = Math.min(Number.MAX_SAFE_INTEGER, bytes);
            diagnostics.current[total.countKey] = Math.min(Number.MAX_SAFE_INTEGER, count);
            diagnostics.highWater[total.bytesKey] = Math.max(diagnostics.highWater[total.bytesKey], diagnostics.current[total.bytesKey]);
            diagnostics.highWater[total.countKey] = Math.max(diagnostics.highWater[total.countKey], diagnostics.current[total.countKey]);
            if (total === unknown && diagnostics.unknownNative) {
                const native = diagnostics.unknownNative, bytes = native.knownLogicalBytes + direction * node.handle.byteLength, objects = native.objects + direction;
                if (bytes > Number.MAX_SAFE_INTEGER || objects > Number.MAX_SAFE_INTEGER)
                    native.saturated = true;
                native.knownLogicalBytes = Math.min(Number.MAX_SAFE_INTEGER, bytes);
                native.objects = Math.min(Number.MAX_SAFE_INTEGER, objects);
                native.highKnownLogicalBytes = Math.max(native.highKnownLogicalBytes, native.knownLogicalBytes);
                native.highObjects = Math.max(native.highObjects, native.objects);
            }
        }
    }
    function leaseFor(request, node) {
        const lease = Object.freeze({
            requestId: request.id,
            handle: node.handle,
            offset: 0,
            size: request.byteLength
        });
        weakSet(leaseNodes, lease, node);
        return lease;
    }
    /** All links already exist before claim; unlinking publishes no new owner. */
    function unlink(node) {
        const bucket = node.bucket;
        if (node.keyPrevious)
            node.keyPrevious.keyNext = node.keyNext;
        else
            bucket.head = node.keyNext;
        if (node.keyNext)
            node.keyNext.keyPrevious = node.keyPrevious;
        else
            bucket.tail = node.keyPrevious;
        if (node.previous)
            node.previous.next = node.next;
        else
            head = node.next;
        if (node.next)
            node.next.previous = node.previous;
        else
            tail = node.previous;
        if (!bucket.head)
            mapDelete(bucket.sizes, bucket.key);
        node.bucket = undefined;
        node.keyPrevious = undefined;
        node.keyNext = undefined;
        node.previous = undefined;
        node.next = undefined;
        charge(idle, node, -1);
    }
    function append(node) {
        const sizes = indexes, key = node.key;
        let bucket = mapGet(sizes, key);
        if (!bucket) {
            bucket = { key, sizes, head: undefined, tail: undefined };
            // A failing metadata allocation leaves this node reservation-owned.
            mapSet(sizes, key, bucket);
        }
        node.bucket = bucket;
        node.keyPrevious = bucket.tail;
        node.keyNext = undefined;
        if (bucket.tail)
            bucket.tail.keyNext = node;
        else
            bucket.head = node;
        bucket.tail = node;
        node.previous = tail;
        node.next = undefined;
        if (tail)
            tail.next = node;
        else
            head = node;
        tail = node;
        charge(reserved, node, -1);
        charge(leased, node, -1);
        charge(idle, node, 1);
        node.state = 'idle';
        node.lease = undefined;
    }
    function detachNode(node) {
        if (node.state === 'idle')
            unlink(node);
        else if (node.state === 'reserved') {
            charge(reserved, node, -1);
            charge(leased, node, -1);
        }
        else if (node.state === 'leased')
            charge(leased, node, -1);
        else
            return;
        node.state = 'detached';
        node.lease = undefined;
        charge(detached, node, 1);
    }
    function returnState(plan) {
        const state = weakGet(returns, plan);
        if (!state || state.consumed)
            throw new TypeError('Foreign or consumed buffer return plan');
        return state;
    }
    return {
        assertActive: requireActive,
        plan(requests) {
            requireActive();
            const rows = [], matches = new NativeMap();
            const selected = [], leases = [], victims = [];
            const cursors = new NativeMap(), protectedNodes = new NativeSet();
            let incomingBytes = 0, incomingCount = 0, matchedBytes = 0;
            for (let i = 0; i < requests.length; i++) {
                const { request, key } = admit(requests[i]);
                if (request.id !== i)
                    throw new TypeError('Nonsequential buffer request');
                rows.push(request);
                if (request.byteLength <= MAX_IDLE_BYTES) {
                    // Saturating sums preserve pressure decisions for arbitrarily
                    // many admitted candidates without creating a new refusal.
                    incomingBytes = Math.min(MAX_IDLE_BYTES + 1, incomingBytes + request.byteLength);
                    incomingCount = Math.min(MAX_IDLE_ENTRIES + 1, incomingCount + 1);
                }
                const bucket = mapGet(indexes, key);
                if (!bucket)
                    continue;
                const node = mapHas(cursors, bucket) ? mapGet(cursors, bucket) : bucket.head;
                if (!node)
                    continue;
                mapSet(cursors, bucket, node.keyNext);
                setAdd(protectedNodes, node);
                selected.push(node);
                mapSet(matches, request.id, node.handle);
                leases.push(leaseFor(request, node));
                matchedBytes += node.handle.byteLength;
            }
            let remainingBytes = idle.bytes - matchedBytes, remainingCount = idle.count - selected.length;
            // Protect every exact hit before selecting one unmatched FIFO prefix.
            for (let node = head; node &&
                (remainingBytes + reserved.bytes + incomingBytes > MAX_IDLE_BYTES ||
                    remainingCount + reserved.count + incomingCount > MAX_IDLE_ENTRIES); node = node.next) {
                if (setHas(protectedNodes, node))
                    continue;
                victims.push(node);
                remainingBytes -= node.handle.byteLength;
                remainingCount--;
            }
            const publicLeases = Object.freeze(leases), publicVictims = Object.freeze(victims.map(node => node.handle));
            const plan = Object.freeze({
                session,
                revision,
                requests: Object.freeze(rows),
                matches,
                leases: publicLeases,
                victims: publicVictims
            });
            weakSet(claims, plan, {
                revision,
                nextRevision: {},
                matches: selected,
                victims,
                leases: publicLeases,
                consumed: false
            });
            return plan;
        },
        claim(plan) {
            requireActive();
            const state = weakGet(claims, plan);
            if (!state || state.consumed || state.revision !== revision)
                throw new TypeError('Foreign, stale or consumed buffer plan');
            // Host has already attached these exact leases and every victim to
            // persistent cleanup owners. No allocation follows the first unlink.
            state.consumed = true;
            revision = state.nextRevision;
            for (let i = 0; i < state.matches.length; i++) {
                const node = state.matches[i];
                unlink(node);
                node.state = 'leased';
                node.lease = state.leases[i];
                charge(leased, node, 1);
            }
            for (let i = 0; i < state.victims.length; i++)
                detachNode(state.victims[i]);
            return state.leases;
        },
        registerCreated(input, resource) {
            // Registration follows Host capture even if a native callback has
            // just invalidated reuse; it still records an owned cold allocation.
            const { request, key } = admit(input);
            if (weakHas(registeredResources, resource))
                throw new TypeError('Already registered buffer resource');
            const handle = Object.freeze({ ...request, identity: Object.freeze({}), session, resource });
            const node = {
                handle,
                key,
                state: 'leased',
                lease: undefined,
                bucket: undefined,
                keyPrevious: undefined,
                keyNext: undefined,
                previous: undefined,
                next: undefined
            };
            const lease = leaseFor(request, node), nextRevision = {};
            weakSet(nodes, handle, node);
            weakAdd(registeredResources, resource);
            node.lease = lease;
            charge(leased, node, 1);
            revision = nextRevision;
            return lease;
        },
        reserveReturns(leases) {
            const selected = [], retained = [], transient = [];
            const seen = new NativeSet();
            let bytes = idle.bytes + reserved.bytes, count = idle.count + reserved.count;
            for (let i = 0; i < leases.length; i++) {
                const lease = leases[i], node = weakGet(leaseNodes, lease);
                if (!node || node.state !== 'leased' || node.lease !== lease || setHas(seen, node)) {
                    throw new TypeError('Foreign, duplicate or inactive buffer lease');
                }
                setAdd(seen, node);
                if (active && bytes + node.handle.byteLength <= MAX_IDLE_BYTES && count < MAX_IDLE_ENTRIES) {
                    selected.push(node);
                    retained.push(node.handle);
                    bytes += node.handle.byteLength;
                    count++;
                }
                else
                    transient.push(node.handle);
            }
            const plan = Object.freeze({
                identity: Object.freeze({}),
                retained: Object.freeze(retained),
                transient: Object.freeze(transient)
            });
            const nextRevision = {};
            weakSet(returns, plan, { nodes: selected, consumed: false });
            // Reservations bound retention only: the leased allocation charge
            // remains until publication or detach, never counted twice as memory.
            for (let i = 0; i < selected.length; i++) {
                const node = selected[i];
                node.state = 'reserved';
                charge(reserved, node, 1);
            }
            revision = nextRevision;
            return plan;
        },
        publishReturns(plan) {
            requireActive();
            const state = returnState(plan), nextRevision = {};
            for (let i = 0; i < state.nodes.length; i++) {
                if (state.nodes[i].state !== 'reserved')
                    throw new TypeError('Detached return reservation');
            }
            // Keep the plan cancellable until every append succeeds. If an
            // allocation throws, cancellation also removes already-idle nodes.
            revision = nextRevision;
            for (let i = 0; i < state.nodes.length; i++)
                append(state.nodes[i]);
            state.consumed = true;
            return plan.retained;
        },
        cancelReturns(plan) {
            const state = returnState(plan), cleanup = [], nextRevision = {};
            for (let i = 0; i < state.nodes.length; i++) {
                const node = state.nodes[i];
                if (node.state === 'reserved' || node.state === 'idle' || node.state === 'detached')
                    cleanup.push(node.handle);
            }
            const result = Object.freeze(cleanup);
            state.consumed = true;
            revision = nextRevision;
            for (let i = 0; i < state.nodes.length; i++)
                detachNode(state.nodes[i]);
            return result;
        },
        detach(handle) {
            const node = requireNode(handle), nextRevision = {};
            detachNode(node);
            revision = nextRevision;
        },
        settled(handle, outcome) {
            const node = requireNode(handle);
            if (outcome !== 'destroyed' && outcome !== 'unknown' && outcome !== 'context-invalidated')
                throw new TypeError('Invalid retention settlement');
            if (node.state === 'unknown' || node.state === 'destroyed' || node.state === 'context-invalidated')
                throw new TypeError('Allocation settlement already reported');
            if (outcome === 'context-invalidated' && active)
                throw new TypeError('Active context allocation');
            const nextRevision = {};
            detachNode(node);
            charge(detached, node, -1);
            node.state = outcome;
            if (outcome === 'unknown') {
                charge(unknown, node, 1);
                active = false;
            }
            // Confirmed loss can invalidate a known owner. It never refunds a
            // prior unknown cleanup or turns invalidation into native deletion.
            revision = nextRevision;
        },
        invalidate() {
            active = false;
        },
        detachIdleForClose() {
            const cleanup = [];
            for (let node = head; node; node = node.next)
                cleanup.push(node.handle);
            const result = Object.freeze(cleanup), nextRevision = {};
            while (head)
                detachNode(head);
            revision = nextRevision;
            return result;
        },
        getStatus() {
            return Object.freeze({
                idleBytes: idle.bytes,
                idleEntries: idle.count,
                reservedBytes: reserved.bytes,
                reservedEntries: reserved.count,
                unknownBytes: unknown.bytes,
                unknownEntries: unknown.count
            });
        }
    };
}
//# sourceMappingURL=sharedRetentionLedger.js.map