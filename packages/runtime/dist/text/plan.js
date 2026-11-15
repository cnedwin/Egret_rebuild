import { createTextValueFailure, requireOwnedTextRasterRequest, takeTextValueFailure } from './request.js';
const apply = Reflect.apply;
const freeze = Object.freeze;
const TypeFault = TypeError;
const RangeFault = RangeError;
const finite = Number.isFinite;
const safeInteger = Number.isSafeInteger;
const isArray = Array.isArray;
const Lines = Array;
const abs = Math.abs;
const floor = Math.floor;
const ceil = Math.ceil;
const min = Math.min;
const max = Math.max;
const weakGet = WeakMap.prototype.get;
const weakSet = WeakMap.prototype.set;
const issuers = new WeakMap();
const plans = new WeakMap();
function invalid(invocation, message) {
    throw createTextValueFailure(invocation, 'TEXT_PLAN_INVALID', new TypeFault(message));
}
function limit(invocation, message) {
    throw createTextValueFailure(invocation, 'TEXT_REQUEST_LIMIT', new RangeFault(message));
}
function coordinate(value, invocation, label) {
    if (typeof value !== 'number' || !finite(value) || abs(value) > 1048576) {
        invalid(invocation, label + ' must be a finite bounded coordinate');
    }
    return value === 0 ? 0 : value;
}
function bounds(left, top, right, bottom, invocation) {
    const width = coordinate(right - left, invocation, 'Bounds width');
    const height = coordinate(bottom - top, invocation, 'Bounds height');
    return freeze({ x: left, y: top, width, height });
}
function issuerState(value) {
    const state = apply(weakGet, issuers, [value]);
    if (state === undefined)
        throw new TypeFault('Authentic private text plan issuer required');
    return state;
}
function lineFields(value, invocation) {
    if (typeof value !== 'object' || value === null)
        invalid(invocation, 'Text plan line must be a record');
    let advance, hasInk, inkLeft, inkTop;
    let inkRight, inkBottom;
    try {
        const line = value;
        advance = line.advance;
        hasInk = line.hasInk;
        inkLeft = line.inkLeft;
        inkTop = line.inkTop;
        inkRight = line.inkRight;
        inkBottom = line.inkBottom;
    }
    catch (cause) {
        throw createTextValueFailure(invocation, 'TEXT_PLAN_INVALID', cause);
    }
    return { advance, hasInk, inkLeft, inkTop, inkRight, inkBottom };
}
function createPlan(state, input) {
    const invocation = state.invocation;
    // These gates precede every descriptor read, including nested createPlan calls.
    if (state.closed)
        throw createTextValueFailure(invocation, 'TEXT_PLAN_SCOPE_CLOSED');
    if (state.issued !== undefined || state.creating) {
        throw createTextValueFailure(invocation, 'TEXT_PLAN_ALREADY_CREATED');
    }
    state.creating = true;
    try {
        if (typeof input !== 'object' || input === null)
            invalid(invocation, 'Text plan must be a record');
        let baselineValue, lineTable;
        try {
            baselineValue = input.baselineOffset;
            lineTable = input.lines;
        }
        catch (cause) {
            throw createTextValueFailure(invocation, 'TEXT_PLAN_INVALID', cause);
        }
        if (!isArray(lineTable))
            invalid(invocation, 'Text plan lines must be an array');
        let lineCount;
        try {
            lineCount = lineTable.length;
        }
        catch (cause) {
            throw createTextValueFailure(invocation, 'TEXT_PLAN_INVALID', cause);
        }
        const request = state.request;
        const count = request.sourceLines.length;
        if (lineCount !== count)
            invalid(invocation, 'Text plan line count must match the owned request');
        const baselineOffset = coordinate(baselineValue, invocation, 'Baseline offset');
        const lines = new Lines(count);
        let maxAdvance = 0;
        let hasAnyInk = false;
        let unionLeft = 0, unionTop = 0, unionRight = 0, unionBottom = 0;
        for (let i = 0; i < count; i++) {
            let row;
            try {
                row = lineTable[i];
            }
            catch (cause) {
                throw createTextValueFailure(invocation, 'TEXT_PLAN_INVALID', cause);
            }
            const fields = lineFields(row, invocation);
            const advance = coordinate(fields.advance, invocation, 'Line advance');
            if (advance < 0)
                invalid(invocation, 'Line advance must be nonnegative');
            if (typeof fields.hasInk !== 'boolean')
                invalid(invocation, 'Line hasInk must be boolean');
            const left = coordinate(fields.inkLeft, invocation, 'Line ink left');
            const top = coordinate(fields.inkTop, invocation, 'Line ink top');
            const right = coordinate(fields.inkRight, invocation, 'Line ink right');
            const bottom = coordinate(fields.inkBottom, invocation, 'Line ink bottom');
            if (fields.hasInk) {
                if (!(left < right && top < bottom))
                    invalid(invocation, 'Real ink must have positive signed extents');
            }
            else if (left !== 0 || top !== 0 || right !== 0 || bottom !== 0) {
                invalid(invocation, 'An inkless line must have zero ink coordinates');
            }
            const baselineDelta = coordinate(i * request.lineHeight, invocation, 'Line baseline delta');
            const baselineY = coordinate(baselineOffset + baselineDelta, invocation, 'Line baseline');
            let inkBounds;
            if (fields.hasInk) {
                const absoluteTop = coordinate(baselineY + top, invocation, 'Absolute ink top');
                const absoluteBottom = coordinate(baselineY + bottom, invocation, 'Absolute ink bottom');
                inkBounds = bounds(left, absoluteTop, right, absoluteBottom, invocation);
                if (hasAnyInk) {
                    unionLeft = min(unionLeft, left);
                    unionTop = min(unionTop, absoluteTop);
                    unionRight = max(unionRight, right);
                    unionBottom = max(unionBottom, absoluteBottom);
                }
                else {
                    unionLeft = left;
                    unionTop = absoluteTop;
                    unionRight = right;
                    unionBottom = absoluteBottom;
                    hasAnyInk = true;
                }
            }
            maxAdvance = max(maxAdvance, advance);
            lines[i] = freeze({ source: request.sourceLines[i], advance, baselineY, inkBounds });
        }
        const logicalHeight = coordinate(count * request.lineHeight, invocation, 'Logical height');
        const logicalBounds = bounds(0, 0, maxAdvance, logicalHeight, invocation);
        const inkBounds = hasAnyInk ? bounds(unionLeft, unionTop, unionRight, unionBottom, invocation) : undefined;
        const contentBounds = hasAnyInk
            ? bounds(min(0, unionLeft), min(0, unionTop), max(maxAdvance, unionRight), max(logicalHeight, unionBottom), invocation)
            : logicalBounds;
        let raster;
        if (hasAnyInk) {
            const density = request.density;
            // Keep the original union endpoints rather than reconstructing right/bottom from widths.
            const scaledLeft = coordinate(unionLeft * density, invocation, 'Scaled ink left');
            const scaledTop = coordinate(unionTop * density, invocation, 'Scaled ink top');
            const scaledRight = coordinate(unionRight * density, invocation, 'Scaled ink right');
            const scaledBottom = coordinate(unionBottom * density, invocation, 'Scaled ink bottom');
            const pixelLeft = coordinate(floor(scaledLeft) - 2, invocation, 'Raster left');
            const pixelTop = coordinate(floor(scaledTop) - 2, invocation, 'Raster top');
            const pixelRight = coordinate(ceil(scaledRight) + 2, invocation, 'Raster right');
            const pixelBottom = coordinate(ceil(scaledBottom) + 2, invocation, 'Raster bottom');
            const width = pixelRight - pixelLeft;
            const height = pixelBottom - pixelTop;
            if (!safeInteger(width) || !safeInteger(height) || width <= 0 || height <= 0 || width > 4096 || height > 4096)
                limit(invocation, 'Raster edge limit');
            const pixels = width * height;
            if (!safeInteger(pixels) || pixels > 1048576)
                limit(invocation, 'Raster pixel limit');
            const byteLength = 4 * pixels;
            if (!safeInteger(byteLength) || byteLength > 4194304)
                limit(invocation, 'Raster byte limit');
            const x = coordinate(pixelLeft / density, invocation, 'Raster x');
            const y = coordinate(pixelTop / density, invocation, 'Raster y');
            const logicalWidth = coordinate(width / density, invocation, 'Raster logical width');
            const rasterLogicalHeight = coordinate(height / density, invocation, 'Raster logical height');
            raster = freeze({
                pixelLeft,
                pixelTop,
                width,
                height,
                byteLength,
                density,
                x,
                y,
                logicalWidth,
                logicalHeight: rasterLogicalHeight
            });
        }
        const metrics = freeze({
            logicalBounds,
            inkBounds,
            contentBounds,
            lines: freeze(lines),
            raster
        });
        const plan = freeze({ request, metrics });
        if (state.closed)
            throw createTextValueFailure(invocation, 'TEXT_PLAN_SCOPE_CLOSED');
        apply(weakSet, plans, [plan, state]);
        state.issued = plan;
        return plan;
    }
    finally {
        state.creating = false;
    }
}
export function createTextRasterPlanIssuer(request, invocation) {
    const owned = requireOwnedTextRasterRequest(request, invocation);
    const state = { request: owned, invocation, closed: false, creating: false, issued: undefined };
    const issuer = freeze({ createPlan: (input) => createPlan(state, input) });
    apply(weakSet, issuers, [issuer, state]);
    return issuer;
}
/** Close only after measure settles; closing never erases its own terminal-cleanup plan. */
export function closeTextRasterPlanIssuer(issuer) {
    issuerState(issuer).closed = true;
}
export function readIssuedTextRasterPlan(issuer) {
    return issuerState(issuer).issued;
}
/** Exact private issuer/invocation/plan identities are checked before public plan fields. */
export function requireIssuedTextRasterPlan(issuer, value, invocation) {
    const state = issuerState(issuer);
    // Authenticate the invocation without consuming a note or reopening its closed failure scope.
    takeTextValueFailure(invocation, undefined);
    const owner = typeof value === 'object' && value !== null
        ? apply(weakGet, plans, [value])
        : undefined;
    if (state.invocation !== invocation || owner !== state || value !== state.issued) {
        invalid(invocation, 'The exact plan issued for this invocation is required');
    }
    return state.issued;
}
//# sourceMappingURL=plan.js.map