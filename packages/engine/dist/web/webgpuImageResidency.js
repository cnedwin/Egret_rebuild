/** Accumulates demand into the submission's existing maps without taking ownership of any native resources. */
export function collectWebGPUImageDemand(projectionPlan, draws, shared, directory, enabled, epoch, hits, candidates) {
    const buckets = new Map();
    let bytes = 0;
    for (const draw of draws) {
        if (draw.kind === 'rect' ||
            draw.packed.vertexCount === 0 ||
            hits.has(draw.viewIndex) ||
            candidates.has(draw.viewIndex))
            continue;
        const view = projectionPlan.views[draw.viewIndex], region = view.region;
        const cropKey = (shared ? 'shared:egret.alpha8-capped-srgb-pma8/1:rgba8unorm-srgb:' : '') +
            `${region.x},${region.y},${region.width},${region.height}`;
        let bucket = directory.get(view.image) ?? buckets.get(view.image);
        if (!bucket) {
            bucket = new Map();
            buckets.set(view.image, bucket);
        }
        const entry = bucket.get(cropKey);
        if (enabled && entry?.epoch === epoch && entry.state === 'ready')
            hits.set(draw.viewIndex, entry);
        else {
            candidates.set(draw.viewIndex, {
                image: view.image,
                viewIndex: draw.viewIndex,
                transferred: false,
                entry: {
                    format: shared ? 'rgba8unorm-srgb' : 'rgba8unorm',
                    identity: {},
                    epoch,
                    bucket,
                    cropKey,
                    bytes: view.byteLength,
                    resource: undefined,
                    view: undefined,
                    pinCount: 0,
                    previous: undefined,
                    next: undefined,
                    state: 'cold'
                }
            });
            bytes += view.byteLength;
        }
    }
    return bytes;
}
/** Reads the ready list in eviction order. The Host retains all mutation and retirement authority. */
export function selectWebGPUImageVictims(oldest, epoch, available, count, maxReadyBytes, bytes, candidateCount, hits) {
    const protectedHits = new Set(hits.values()), victims = [];
    for (let entry = oldest; entry; entry = entry.next) {
        if (available + bytes <= maxReadyBytes && count + candidateCount <= 256)
            break;
        if (entry.epoch !== epoch || entry.state !== 'ready' || entry.pinCount !== 0 || protectedHits.has(entry))
            continue;
        victims.push(entry);
        available -= entry.bytes;
        count--;
    }
    return victims;
}
//# sourceMappingURL=webgpuImageResidency.js.map