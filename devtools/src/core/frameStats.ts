// SPDX-License-Identifier: Apache-2.0
// Counts read from one captured shared 2D frame. The frame is an immutable
// record, so reading it needs no hook inside the engine and changes nothing.

/** The part of a captured shared frame this module reads. */
export interface SharedFrameLike {
    readonly frameId: number;
    readonly width: number;
    readonly height: number;
    readonly commands: readonly SharedCommandLike[];
    readonly pages: readonly unknown[];
    readonly regions: readonly unknown[];
    readonly materials: readonly unknown[];
    readonly geometries: readonly unknown[];
}

interface SharedCommandLike {
    readonly kind: string;
    readonly materialIndex?: number;
    readonly regionIndex?: number;
    readonly geometryIndex?: number;
    readonly clips?: unknown;
    readonly reason?: string;
}

/** Why two neighbouring draws could not share one run. */
export interface SharedFrameSwitches {
    readonly material: number;
    readonly page: number;
    readonly region: number;
    readonly clip: number;
    readonly barrier: number;
}

export interface SharedFrameStats {
    readonly frameId: number;
    readonly width: number;
    readonly height: number;
    readonly commands: number;
    readonly rects: number;
    readonly images: number;
    readonly meshes: number;
    readonly barriers: number;
    /** Barriers that enter a blur or mask effect; each needs an offscreen pass. */
    readonly effects: number;
    readonly triangles: number;
    readonly pages: number;
    readonly regions: number;
    readonly materials: number;
    readonly geometries: number;
    /** Page pixels at four bytes each. This is an estimate, not a GPU measurement. */
    readonly pageBytes: number;
    /**
     * Maximal runs of neighbouring draws with the same material, region and
     * clip list. An estimate of draw groups; the renderer reports its own count.
     */
    readonly runs: number;
    readonly switches: SharedFrameSwitches;
}

function count(value: unknown): number {
    return Array.isArray(value) ? value.length : 0;
}

function finite(value: unknown): number {
    return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

/** Read the counts of one captured frame. Unknown shapes count as zero. */
export function analyzeSharedFrame(frame: SharedFrameLike): SharedFrameStats {
    const commands: readonly SharedCommandLike[] = Array.isArray(frame.commands) ? frame.commands : [];
    const regions: readonly unknown[] = Array.isArray(frame.regions) ? frame.regions : [];
    const geometries: readonly unknown[] = Array.isArray(frame.geometries) ? frame.geometries : [];
    let rects = 0, images = 0, meshes = 0, barriers = 0, effects = 0, triangles = 0, runs = 0;
    let material = 0, page = 0, region = 0, clip = 0, barrier = 0;
    let open = false, afterBarrier = false;
    let lastMaterial = -1, lastRegion = -1, lastPage = -1;
    let lastClips: unknown;
    for (const command of commands) {
        const kind = command.kind;
        if (kind === 'barrier') {
            barriers++;
            if (command.reason === 'effect-enter') effects++;
            if (open) afterBarrier = true;
            continue;
        }
        let regionIndex = -1;
        if (kind === 'rect') { rects++; triangles += 2; }
        else if (kind === 'image') { images++; triangles += 2; regionIndex = finite(command.regionIndex); }
        else if (kind === 'mesh') {
            meshes++;
            regionIndex = finite(command.regionIndex);
            const geometry = geometries[finite(command.geometryIndex)] as { readonly triangleCount?: unknown } | undefined;
            triangles += finite(geometry?.triangleCount);
        } else continue;
        const pageIndex = regionIndex < 0 ? -1 : finite((regions[regionIndex] as { readonly pageIndex?: unknown } | undefined)?.pageIndex);
        const materialIndex = finite(command.materialIndex);
        const clips = command.clips;
        if (!open) { open = true; runs++; }
        else if (afterBarrier) { barrier++; runs++; }
        else {
            // One reason per break, most expensive first.
            if (materialIndex !== lastMaterial) { material++; runs++; }
            else if (pageIndex !== lastPage) { page++; runs++; }
            else if (regionIndex !== lastRegion) { region++; runs++; }
            else if (clips !== lastClips && (count(clips) > 0 || count(lastClips) > 0)) { clip++; runs++; }
        }
        afterBarrier = false;
        lastMaterial = materialIndex; lastRegion = regionIndex; lastPage = pageIndex; lastClips = clips;
    }
    let pageBytes = 0;
    if (Array.isArray(frame.pages)) {
        for (const entry of frame.pages as readonly { readonly source?: { readonly width?: unknown; readonly height?: unknown } }[]) {
            pageBytes += finite(entry?.source?.width) * finite(entry?.source?.height) * 4;
        }
    }
    return Object.freeze({
        frameId: finite(frame.frameId), width: finite(frame.width), height: finite(frame.height),
        commands: commands.length, rects, images, meshes, barriers, effects, triangles,
        pages: count(frame.pages), regions: regions.length, materials: count(frame.materials), geometries: geometries.length,
        pageBytes, runs,
        switches: Object.freeze({ material, page, region, clip, barrier }),
    });
}
