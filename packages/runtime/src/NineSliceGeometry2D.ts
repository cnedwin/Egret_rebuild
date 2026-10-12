import { createTexturedGeometry2D } from "@egret/contracts";
import type { TexturedGeometry2D } from "@egret/contracts";

/** Border widths in the same units as the unrotated source crop. */
export interface NineSliceInsets2D {
    readonly left: number;
    readonly top: number;
    readonly right: number;
    readonly bottom: number;
}

export interface NineSliceGeometry2DOptions {
    readonly sourceWidth: number;
    readonly sourceHeight: number;
    readonly targetWidth: number;
    readonly targetHeight: number;
    readonly insets: NineSliceInsets2D;
}

// Capture admission, error and payload intrinsics before descriptor callbacks.
// The factory owns geometry only; the caller supplies crop/texture agreement.
const isArray = Array.isArray;
const finite = Number.isFinite;
const TypeFault = TypeError;
const RangeFault = RangeError;
const Floats = Float64Array;
const Indices = Uint16Array;

function object(value: unknown): object {
    if (typeof value !== "object" || value === null || isArray(value)) {
        throw new TypeFault("Nine-slice descriptor must be a non-array object");
    }
    return value;
}

function read(source: object, key: string): unknown {
    try { return (source as Record<string, unknown>)[key]; }
    catch (cause) { throw new TypeFault("Nine-slice descriptor read failed", { cause }); }
}

function number(value: unknown): number {
    if (typeof value !== "number") throw new TypeFault("Nine-slice values must be primitive numbers");
    return value === 0 ? 0 : value;
}

function range(value: number, dimension: boolean): void {
    if (!finite(value) || (dimension ? value <= 0 : value < 0)) {
        throw new RangeFault("Nine-slice numeric range is invalid");
    }
}

function axis(source: number, target: number, leading: number, trailing: number): {
    cuts: readonly [number, number, number, number];
    uvs: readonly [number, number, number, number];
} {
    const borders = leading + trailing;
    if (!finite(borders) || borders >= source || borders > target) {
        throw new RangeFault("Nine-slice borders must leave a source center and fit the target");
    }
    // Equality with the computed border sum intentionally removes the center.
    // Subtracting the trailing edge in that case can create a phantom interval.
    const far = target === borders ? leading : target - trailing;
    const nearUv = leading / source;
    const farUv = (source - trailing) / source;
    // Computed Float64 cuts are authoritative. Positive intervals must survive;
    // GPU Float32 conversion and raster capacity remain renderer obligations.
    if (!finite(far) || !finite(nearUv) || !finite(farUv) ||
        far < leading || far > target || nearUv < 0 || farUv > 1 || nearUv >= farUv ||
        (trailing > 0 && (far === target || farUv === 1)) ||
        (leading > 0 && nearUv === 0) ||
        (target > borders && far === leading)) {
        throw new RangeFault("Nine-slice precision collapsed a positive interval");
    }
    return { cuts: [0, leading, far, target], uvs: [0, nearUv, farUv, 1] };
}

/** Create an owned immutable stretch grid for an existing Mesh2D texture lease. */
export function createNineSliceGeometry2D(options: NineSliceGeometry2DOptions): TexturedGeometry2D {
    const descriptor = object(options);
    // Successful outer reads precede inset admission and its ordered reads.
    // Local staging isolates descriptor reentry without retaining caller data.
    const sourceWidthInput = read(descriptor, "sourceWidth");
    const sourceHeightInput = read(descriptor, "sourceHeight");
    const targetWidthInput = read(descriptor, "targetWidth");
    const targetHeightInput = read(descriptor, "targetHeight");
    const insetDescriptor = object(read(descriptor, "insets"));
    const leftInput = read(insetDescriptor, "left");
    const topInput = read(insetDescriptor, "top");
    const rightInput = read(insetDescriptor, "right");
    const bottomInput = read(insetDescriptor, "bottom");
    // Complete all eight primitive checks before examining any numeric range.
    const sourceWidth = number(sourceWidthInput);
    const sourceHeight = number(sourceHeightInput);
    const targetWidth = number(targetWidthInput);
    const targetHeight = number(targetHeightInput);
    const left = number(leftInput);
    const top = number(topInput);
    const right = number(rightInput);
    const bottom = number(bottomInput);
    range(sourceWidth, true); range(sourceHeight, true);
    range(targetWidth, true); range(targetHeight, true);
    range(left, false); range(top, false); range(right, false); range(bottom, false);
    const x = axis(sourceWidth, targetWidth, left, right);
    const y = axis(sourceHeight, targetHeight, top, bottom);
    // Allocation begins after scalar and precision admission. Native allocation
    // faults escape unchanged; no asset or display-tree mutation has occurred.
    const positions = new Floats(32);
    const uvs = new Floats(32);
    const lightColors = new Floats(64);
    const indices = new Indices(54);
    for (let row = 0; row < 4; row++) {
        for (let column = 0; column < 4; column++) {
            const vertex = 4 * row + column;
            positions[2 * vertex] = x.cuts[column]!;
            positions[2 * vertex + 1] = y.cuts[row]!;
            uvs[2 * vertex] = x.uvs[column]!;
            uvs[2 * vertex + 1] = y.uvs[row]!;
            for (let component = 0; component < 4; component++) lightColors[4 * vertex + component] = 1;
        }
    }
    for (let row = 0; row < 3; row++) {
        for (let column = 0; column < 3; column++) {
            const vertex = 4 * row + column, index = 6 * (3 * row + column);
            indices[index] = vertex; indices[index + 1] = vertex + 1; indices[index + 2] = vertex + 4;
            indices[index + 3] = vertex + 1; indices[index + 4] = vertex + 5; indices[index + 5] = vertex + 4;
        }
    }
    // The original contracts factory owns the authentic frozen number arrays.
    // Intentional zero-width cells retain the canonical 16/54 grid topology.
    return createTexturedGeometry2D({ positions, uvs, lightColors, indices });
}
