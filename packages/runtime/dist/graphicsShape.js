// SPDX-License-Identifier: Apache-2.0
// The shapes of a Graphics, as triangles. A node whose drawing is more than filled rectangles keeps one list of
// coloured triangles, in drawing order, and a path still being drawn. Capture reads them as one shared geometry.
import { createImageData2D, createSharedGeometry2D } from '@egret/contracts';
import { decodeSRGBByte } from './srgbBytes.js';
import { fillNonZero, gradientColor, outlineCrosses, refineForGradient } from './graphicsFill.js';
/** The most one node's shapes may hold: what one shared geometry takes. */
export const GRAPHICS_SHAPE_LIMITS = Object.freeze({
    maxVertices: 65536,
    maxIndices: 196608,
    maxLogicalBytes: 4980736,
    maxPathPoints: 8192,
    maxLineWidth: 1024,
    maxDashes: 16384,
    maxGradientStops: 16,
    maxFillTriangles: 16384,
    maxBatches: 16,
    maxRepeatPixels: 8192
});
/** The one white pixel every shape samples: its colour is the colour of its vertices. */
export const SHAPE_PAGE = createImageData2D({
    width: 1,
    height: 1,
    pixels: new Uint8Array([255, 255, 255, 255])
});
export const SHAPE_REGION = Object.freeze({
    packed: Object.freeze({ x: 0, y: 0, width: 1, height: 1 }),
    logicalWidth: 1,
    logicalHeight: 1,
    trimX: 0,
    trimY: 0,
    quarterTurn: 0
});
export function createShapeState() {
    return {
        positions: [],
        colors: [],
        uvs: [],
        indices: [],
        bitmap: undefined,
        done: [],
        path: undefined,
        resolved: undefined
    };
}
/** A copy that can be drawn on without changing the drawing it was made from. */
export function copyDrawing(from) {
    return {
        positions: from.positions.slice(),
        colors: from.colors.slice(),
        uvs: from.uvs.slice(),
        indices: from.indices.slice(),
        bitmap: from.bitmap,
        done: from.done.slice()
    };
}
/** Makes the batch being added to one over this image, or over the white pixel: the one it is, if it is, and otherwise a new one after it. */
function batchFor(target, bitmap) {
    const now = target.bitmap;
    if (now === bitmap ||
        (now !== undefined && bitmap !== undefined && now.lease === bitmap.lease && now.repeat === bitmap.repeat))
        return;
    if (target.indices.length !== 0) {
        target.done.push({
            positions: target.positions,
            colors: target.colors,
            uvs: target.uvs,
            indices: target.indices,
            bitmap: now
        });
        target.positions = [];
        target.colors = [];
        target.uvs = [];
        target.indices = [];
    }
    else {
        target.positions.length = 0;
        target.colors.length = 0;
        target.uvs.length = 0;
    }
    target.bitmap = bitmap;
}
function paint(target, points, color) {
    const first = target.positions.length / 2;
    const r = decodeSRGBByte(color.color >> 16), g = decodeSRGBByte(color.color >> 8), b = decodeSRGBByte(color.color);
    for (let i = 0; i < points.length; i += 2) {
        const x = points[i], y = points[i + 1], bitmap = color.bitmap;
        target.positions.push(x, y);
        // Over an image a vertex is white and says where in the image it is; over the white pixel it is the pixel's middle.
        if (bitmap !== undefined) {
            target.colors.push(1, 1, 1, 1);
            target.uvs.push(bitmap.a * x + bitmap.c * y + bitmap.tx, bitmap.b * x + bitmap.d * y + bitmap.ty);
            continue;
        }
        target.uvs.push(0.5, 0.5);
        if (color.gradient === undefined)
            target.colors.push(r, g, b, color.alpha);
        else
            gradientColor(color.gradient, points[i], points[i + 1], target.colors, target.colors.length);
    }
    return first;
}
/** Twice the signed area of a polygon given as x, y pairs. */
function area2(points) {
    let sum = 0;
    for (let i = 0, n = points.length; i < n; i += 2) {
        const j = (i + 2) % n;
        sum += points[i] * points[j + 1] - points[j] * points[i + 1];
    }
    return sum;
}
/** Drops a point equal to the one before it, and a last point equal to the first. */
function distinct(points, closed) {
    const out = [];
    for (let i = 0; i < points.length; i += 2) {
        const x = points[i], y = points[i + 1], n = out.length;
        if (n === 0 || out[n - 2] !== x || out[n - 1] !== y)
            out.push(x, y);
    }
    if (closed && out.length >= 4 && out[0] === out[out.length - 2] && out[1] === out[out.length - 1])
        out.length -= 2;
    return out;
}
/** A convex outline as a fan from its first corner. */
export function fillConvex(target, outline, color) {
    const points = distinct(outline, true), count = points.length / 2;
    if (count < 3 || area2(points) === 0)
        return;
    const first = paint(target, points, color);
    for (let i = 1; i + 1 < count; i++)
        target.indices.push(first, first + i, first + i + 1);
}
/** Any simple outline, by cutting ears. An outline that crosses itself is filled without a promise about where. */
export function fillPolygon(target, outline, color) {
    const points = distinct(outline, true), count = points.length / 2, area = area2(points);
    if (count < 3 || area === 0)
        return;
    const first = paint(target, points, color), sign = area > 0 ? 1 : -1;
    const ring = [];
    for (let i = 0; i < count; i++)
        ring.push(i);
    const cross = (a, b, c) => (points[2 * b] - points[2 * a]) * (points[2 * c + 1] - points[2 * a + 1]) -
        (points[2 * b + 1] - points[2 * a + 1]) * (points[2 * c] - points[2 * a]);
    const inside = (a, b, c, p) => sign * cross(a, b, p) >= 0 && sign * cross(b, c, p) >= 0 && sign * cross(c, a, p) >= 0;
    let guard = 2 * count * count;
    for (let at = 0; ring.length > 3 && guard-- > 0;) {
        const n = ring.length, a = ring[(at + n - 1) % n], b = ring[at % n], c = ring[(at + 1) % n];
        let ear = sign * cross(a, b, c) > 0;
        for (let k = 0; ear && k < n; k++) {
            const p = ring[k];
            if (p !== a && p !== b && p !== c && inside(a, b, c, p))
                ear = false;
        }
        if (ear) {
            target.indices.push(first + a, first + b, first + c);
            ring.splice(at % n, 1);
            at = at % ring.length;
        }
        else if (sign * cross(a, b, c) === 0) {
            ring.splice(at % n, 1);
            at = at % ring.length;
        }
        else
            at = (at + 1) % n;
    }
    // What no ear could be cut from is closed as a fan, so that a degenerate outline still ends.
    for (let i = 1; i + 1 < ring.length; i++)
        target.indices.push(first + ring[0], first + ring[i], first + ring[i + 1]);
}
/** Triangles given as x, y of each corner, added with one vertex for each different corner. */
function addTriangles(target, triangles, color, boundary) {
    const known = new Map(), one = [0, 0], corner = [0, 0, 0];
    let kept = 0;
    for (let i = 0; i < triangles.length; i += 6) {
        for (let k = 0; k < 3; k++) {
            const x = triangles[i + 2 * k], y = triangles[i + 2 * k + 1], key = x + ',' + y;
            let index = known.get(key);
            if (index === undefined) {
                one[0] = x;
                one[1] = y;
                index = paint(target, one, color);
                known.set(key, index);
            }
            corner[k] = index;
        }
        if (corner[0] !== corner[1] && corner[1] !== corner[2] && corner[2] !== corner[0]) {
            target.indices.push(corner[0], corner[1], corner[2]);
            if (boundary !== undefined)
                boundary[kept++] = boundary[i / 6];
        }
    }
    if (boundary !== undefined)
        boundary.length = kept;
}
/** Three side bits per original triangle. Coincident vertices share the same edge identity. */
function originalBoundary(target, firstIndex) {
    const { positions, indices } = target;
    const masks = new Array((indices.length - firstIndex) / 3).fill(0);
    const places = new Map(), sides = new Map();
    const same = (vertex) => {
        const key = positions[2 * vertex] + ',' + positions[2 * vertex + 1];
        const found = places.get(key);
        if (found !== undefined)
            return found;
        places.set(key, vertex);
        return vertex;
    };
    for (let at = firstIndex; at < indices.length; at += 3) {
        const corners = [same(indices[at]), same(indices[at + 1]), same(indices[at + 2])];
        if (corners[0] === corners[1] || corners[1] === corners[2] || corners[2] === corners[0])
            continue;
        for (let side = 0; side < 3; side++) {
            const a = corners[side], b = corners[(side + 1) % 3], key = a < b ? a + ':' + b : b + ':' + a;
            sides.set(key, sides.has(key) ? -1 : at - firstIndex + side);
        }
    }
    for (const side of sides.values())
        if (side >= 0) {
            const triangle = Math.floor(side / 3);
            masks[triangle] = masks[triangle] | (1 << (side % 3));
        }
    return masks;
}
/** The triangles added to a target since a mark, taken back out of it as x, y of each corner. */
function takeTriangles(target, vertices, indices) {
    const out = [];
    for (let i = indices; i < target.indices.length; i++) {
        const v = target.indices[i];
        out.push(target.positions[2 * v], target.positions[2 * v + 1]);
    }
    target.positions.length = 2 * vertices;
    target.colors.length = 4 * vertices;
    target.uvs.length = 2 * vertices;
    target.indices.length = indices;
    return out;
}
/**
 * What closed outlines cover, filled. One outline that does not cross itself is cut into ears; several, or one that
 * crosses itself, are filled by the non-zero rule, so an outline drawn the other way round inside another is a hole.
 * A gradient is given as the colours of the corners, with triangles cut until that is close enough.
 * False when the fill would take more triangles than one fill may.
 */
export function fillOutlines(target, outlines, convex, color, edge = true) {
    batchFor(target, color.bitmap);
    const vertices = target.positions.length / 2, indices = target.indices.length, max = GRAPHICS_SHAPE_LIMITS.maxFillTriangles;
    const closed = outlines.map(points => distinct(points, true)).filter(points => points.length >= 6);
    if (closed.length === 0)
        return true;
    if (closed.length === 1 && (convex || !outlineCrosses(closed[0])))
        (convex ? fillConvex : fillPolygon)(target, closed[0], color);
    else {
        const triangles = fillNonZero(closed, max);
        if (triangles === undefined)
            return false;
        addTriangles(target, triangles, color);
    }
    const bitmap = color.bitmap;
    const feather = edge && bitmap === undefined ? (color.feather ?? 0) : 0;
    let boundary;
    if (color.gradient !== undefined) {
        if (feather > 0)
            boundary = originalBoundary(target, indices);
        const refined = refineForGradient(takeTriangles(target, vertices, indices), color.gradient, max, boundary);
        addTriangles(target, refined, color, boundary);
    }
    // An image that repeats is drawn no farther than this many of its pixels from its start: beyond it a frame cannot place it exactly.
    if (bitmap !== undefined)
        for (let i = 2 * vertices; i < target.uvs.length; i += 2)
            if (Math.abs(target.uvs[i] * bitmap.width) > GRAPHICS_SHAPE_LIMITS.maxRepeatPixels ||
                Math.abs(target.uvs[i + 1] * bitmap.height) > GRAPHICS_SHAPE_LIMITS.maxRepeatPixels)
                return false;
    if (feather > 0)
        featherEdges(target, indices, feather, boundary);
    return true;
}
/**
 * A band around the triangles from `firstIndex` on, as wide as `width`, that fades from their colour at their edge to
 * nothing: what smooths an edge that would otherwise be a stair of pixels. An edge of theirs is a side that only one
 * of the triangles has; where two edges meet the band turns with them, no farther out than twice its width.
 */
function featherEdges(target, firstIndex, width, boundary) {
    const P = target.positions, I = target.indices, last = I.length;
    // Vertices at one place are one vertex here: the first of them.
    const places = new Map(), same = (v) => {
        const key = P[2 * v] + ',' + P[2 * v + 1], found = places.get(key);
        if (found !== undefined)
            return found;
        places.set(key, v);
        return v;
    };
    const sides = new Map();
    for (let i = firstIndex; i + 2 < last; i += 3) {
        const mask = boundary?.[(i - firstIndex) / 3] ?? 7;
        if (mask === 0)
            continue;
        const t = [same(I[i]), same(I[i + 1]), same(I[i + 2])];
        if (t[0] === t[1] || t[1] === t[2] || t[2] === t[0])
            continue;
        for (let k = 0; k < 3; k++) {
            if ((mask & (1 << k)) === 0)
                continue;
            const u = t[k], v = t[(k + 1) % 3], w = t[(k + 2) % 3], key = u < v ? u + ':' + v : v + ':' + u, seen = sides.get(key);
            if (seen !== undefined) {
                seen.times++;
                continue;
            }
            const dx = P[2 * v] - P[2 * u], dy = P[2 * v + 1] - P[2 * u + 1], length = Math.hypot(dx, dy);
            // The side's normal, pointing away from the triangle's third corner.
            let nx = dy / length, ny = -dx / length;
            if (nx * (P[2 * w] - P[2 * u]) + ny * (P[2 * w + 1] - P[2 * u + 1]) > 0) {
                nx = -nx;
                ny = -ny;
            }
            sides.set(key, { u, v, nx, ny, times: 1 });
        }
    }
    const sums = new Map();
    for (const side of sides.values()) {
        if (side.times !== 1)
            continue;
        for (const at of [side.u, side.v]) {
            const sum = sums.get(at);
            if (sum === undefined)
                sums.set(at, [side.nx, side.ny, side.nx, side.ny]);
            else {
                sum[0] += side.nx;
                sum[1] += side.ny;
            }
        }
    }
    const outer = new Map();
    for (const [at, sum] of sums) {
        let nx = sum[0], ny = sum[1];
        const length = Math.hypot(nx, ny);
        if (length < 1e-6) {
            nx = sum[2];
            ny = sum[3];
        }
        else {
            nx /= length;
            ny /= length;
        }
        const reach = width / Math.max(0.5, nx * sum[2] + ny * sum[3]);
        outer.set(at, P.length / 2);
        P.push(P[2 * at] + nx * reach, P[2 * at + 1] + ny * reach);
        target.colors.push(target.colors[4 * at], target.colors[4 * at + 1], target.colors[4 * at + 2], 0);
        target.uvs.push(0.5, 0.5);
    }
    for (const side of sides.values()) {
        if (side.times !== 1)
            continue;
        const u2 = outer.get(side.u), v2 = outer.get(side.v);
        I.push(side.u, side.v, v2, side.u, v2, u2);
    }
}
/** The pieces of a line that its dashes cover, each a line of its own; undefined when there are too many. */
function dashPieces(points, loop, dash) {
    const pattern = dash.length % 2 === 0 ? dash : [...dash, ...dash], count = points.length / 2, pieces = [];
    let entry = 0, left = pattern[0], piece = [points[0], points[1]];
    for (let i = 0; i + 1 < count || (loop && i < count); i++) {
        const ax = points[2 * i], ay = points[2 * i + 1], j = (i + 1) % count, bx = points[2 * j], by = points[2 * j + 1], length = Math.hypot(bx - ax, by - ay);
        let done = 0;
        while (length - done > left) {
            done += left;
            const x = ax + ((bx - ax) * done) / length, y = ay + ((by - ay) * done) / length;
            if (piece !== undefined) {
                piece.push(x, y);
                pieces.push(piece);
                piece = undefined;
                if (pieces.length > GRAPHICS_SHAPE_LIMITS.maxDashes)
                    return undefined;
            }
            else
                piece = [x, y];
            entry = (entry + 1) % pattern.length;
            left = pattern[entry];
        }
        left -= length - done;
        if (piece !== undefined)
            piece.push(bx, by);
    }
    if (piece !== undefined && piece.length >= 4)
        pieces.push(piece);
    return pieces;
}
/**
 * A line of a width along points. Two pieces meet at a corner in one point on its inside, so a translucent line is not
 * darker there; its outside is a mitre, cut to a bevel when longer than `miterLimit` half-widths, a bevel or an arc.
 * An open line ends flat, in a half square or in a half circle. False when its dashes are more than a line may have.
 */
export function strokeLine(target, line, closed, style) {
    const points = distinct(line, closed);
    if (points.length < 4 || style.width <= 0)
        return true;
    const loop = closed && points.length >= 6;
    if (style.dash === undefined) {
        strokeSolid(target, points, loop, style);
        return true;
    }
    const pieces = dashPieces(points, loop, style.dash);
    if (pieces === undefined)
        return false;
    for (const piece of pieces) {
        const part = distinct(piece, false);
        if (part.length >= 4)
            strokeSolid(target, part, false, style);
    }
    return true;
}
function strokeSolid(target, points, loop, style) {
    batchFor(target, undefined);
    const count = points.length / 2, half = style.width / 2, segments = loop ? count : count - 1, arc = curveSegments(half);
    const out = [], triangles = [];
    const add = (x, y) => {
        out.push(x, y);
        return out.length / 2 - 1;
    };
    // Each piece's unit direction and length; its normal is that direction turned a quarter.
    const dx = [], dy = [], lengths = [];
    for (let i = 0; i < segments; i++) {
        const j = (i + 1) % count, x = points[2 * j] - points[2 * i], y = points[2 * j + 1] - points[2 * i + 1], length = Math.hypot(x, y);
        dx.push(x / length);
        dy.push(y / length);
        lengths.push(length);
    }
    /** A fan about a centre from one direction to another, the short way round by `sweep` radians, between two vertices already there. */
    const fan = (hub, cx, cy, fromX, fromY, sweep, first, last) => {
        const steps = Math.max(1, Math.ceil((arc * Math.abs(sweep)) / (2 * Math.PI)));
        let before = first;
        for (let i = 1; i < steps; i++) {
            const angle = (sweep * i) / steps, cos = Math.cos(angle), sin = Math.sin(angle), now = add(cx + fromX * cos - fromY * sin, cy + fromX * sin + fromY * cos);
            triangles.push(hub, before, now);
            before = now;
        }
        triangles.push(hub, before, last);
    };
    // For each piece, the vertices on its normal's side and on the other, at its start and at its end.
    const startPlus = [], startMinus = [], endPlus = [], endMinus = [];
    for (let i = 0; i < count; i++) {
        const before = i > 0 ? i - 1 : loop ? segments - 1 : -1, after = i < segments ? i : loop ? 0 : -1, x = points[2 * i], y = points[2 * i + 1];
        if (before < 0 || after < 0) {
            // An end of an open line.
            const piece = before < 0 ? after : before, away = before < 0 ? -1 : 1, nx = -dy[piece] * half, ny = dx[piece] * half;
            const ex = style.caps === 'square' ? x + away * dx[piece] * half : x, ey = style.caps === 'square' ? y + away * dy[piece] * half : y;
            const plus = add(ex + nx, ey + ny), minus = add(ex - nx, ey - ny);
            if (before < 0) {
                startPlus[piece] = plus;
                startMinus[piece] = minus;
            }
            else {
                endPlus[piece] = plus;
                endMinus[piece] = minus;
            }
            if (style.caps === 'round')
                fan(add(x, y), x, y, nx, ny, away * -Math.PI, plus, minus);
            continue;
        }
        const ax = -dy[before], ay = dx[before], bx = -dy[after], by = dx[after], cross = dx[before] * dy[after] - dy[before] * dx[after], dot = dx[before] * dx[after] + dy[before] * dy[after];
        if (Math.abs(cross) < 1e-9 && dot > 0) {
            // Straight on: the two pieces share both vertices.
            endPlus[before] = startPlus[after] = add(x + ax * half, y + ay * half);
            endMinus[before] = startMinus[after] = add(x - ax * half, y - ay * half);
            continue;
        }
        if (Math.abs(cross) < 1e-9) {
            // Straight back: each piece ends square, and a round corner is a half circle about the point.
            const plus = (endPlus[before] = add(x + ax * half, y + ay * half)), minus = (endMinus[before] = add(x - ax * half, y - ay * half));
            startPlus[after] = minus;
            startMinus[after] = plus;
            if (style.joints === 'round')
                fan(add(x, y), x, y, ax * half, ay * half, -Math.PI, plus, minus);
            continue;
        }
        // The inside of the corner is on the normal's side when the line turns that way.
        const side = cross > 0 ? 1 : -1;
        let mx = ax + bx, my = ay + by;
        const length = Math.hypot(mx, my);
        mx /= length;
        my /= length;
        const ratio = 1 / (mx * ax + my * ay);
        // The inside point is kept on the pieces it joins, however sharp the corner.
        const reach = Math.min(ratio * half, Math.hypot(half, Math.min(lengths[before], lengths[after])));
        const inside = add(x + side * mx * reach, y + side * my * reach);
        const outA = add(x - side * ax * half, y - side * ay * half), outB = add(x - side * bx * half, y - side * by * half);
        if (side > 0) {
            endPlus[before] = inside;
            endMinus[before] = outA;
            startPlus[after] = inside;
            startMinus[after] = outB;
        }
        else {
            endMinus[before] = inside;
            endPlus[before] = outA;
            startMinus[after] = inside;
            startPlus[after] = outB;
        }
        if (style.joints === 'round')
            fan(inside, x, y, -side * ax * half, -side * ay * half, Math.atan2(cross, dot), outA, outB);
        else if (style.joints === 'miter' && ratio <= style.miterLimit) {
            const tip = add(x - side * mx * ratio * half, y - side * my * ratio * half);
            triangles.push(inside, outA, tip, inside, tip, outB);
        }
        else
            triangles.push(inside, outA, outB);
    }
    for (let i = 0; i < segments; i++)
        triangles.push(startPlus[i], startMinus[i], endMinus[i], startPlus[i], endMinus[i], endPlus[i]);
    const first = paint(target, out, style), from = target.indices.length;
    for (const index of triangles)
        target.indices.push(first + index);
    if (style.bitmap === undefined && style.feather !== undefined && style.feather > 0)
        featherEdges(target, from, style.feather);
}
/** How many straight pieces a curve of this radius is drawn with: each is within a quarter unit of the curve. */
export function curveSegments(radius) {
    if (!(radius > 0.25))
        return 8;
    // A multiple of four, so that a whole circle has a corner at each of its four extremes.
    return Math.max(8, Math.min(128, 4 * Math.ceil(Math.PI / Math.acos(1 - 0.25 / radius) / 4)));
}
/** The cosine and sine of a quarter-turn multiple are whole numbers here, so an extreme of a circle is where it is told. */
function unitAt(step, count) {
    const quarter = (4 * step) / count;
    if (Number.isInteger(quarter))
        return [[1, 0, -1, 0][((quarter % 4) + 4) % 4], [0, 1, 0, -1][((quarter % 4) + 4) % 4]];
    const angle = (2 * Math.PI * step) / count;
    return [Math.cos(angle), Math.sin(angle)];
}
/** An ellipse as an outline, starting at its right and going on through its bottom. */
export function ellipseOutline(cx, cy, rx, ry) {
    const count = curveSegments(Math.max(rx, ry)), out = [];
    for (let i = 0; i < count; i++) {
        const [cos, sin] = unitAt(i, count);
        out.push(cx + rx * cos, cy + ry * sin);
    }
    return out;
}
/** A rectangle whose corners are quarter ellipses of the two radii. */
export function roundRectOutline(x, y, width, height, rx, ry) {
    if (rx <= 0 || ry <= 0)
        return [x, y, x + width, y, x + width, y + height, x, y + height];
    const count = curveSegments(Math.max(rx, ry)) / 4, out = [];
    // Each corner is a quarter of the ellipse, from the top right round through the bottom to the top left.
    const corners = [
        [x + width - rx, y + ry, 3],
        [x + width - rx, y + height - ry, 0],
        [x + rx, y + height - ry, 1],
        [x + rx, y + ry, 2]
    ];
    for (const [cx, cy, quarter] of corners)
        for (let i = 0; i <= count; i++) {
            const [cos, sin] = unitAt(quarter * count + i, 4 * count);
            out.push(cx + rx * cos, cy + ry * sin);
        }
    return out;
}
/** The points of an arc after its first, which the caller has already placed. */
export function arcPoints(cx, cy, radius, start, end, anticlockwise) {
    let sweep = end - start;
    const turn = 2 * Math.PI;
    if (anticlockwise) {
        if (sweep > 0)
            sweep -= turn * Math.ceil(sweep / turn);
        if (sweep === 0 && end !== start)
            sweep = -turn;
    }
    else {
        if (sweep < 0)
            sweep += turn * Math.ceil(-sweep / turn);
        if (sweep === 0 && end !== start)
            sweep = turn;
    }
    if (Math.abs(end - start) >= turn)
        sweep = anticlockwise ? -turn : turn;
    const count = Math.max(1, Math.ceil((curveSegments(radius) * Math.abs(sweep)) / turn)), out = [];
    for (let i = 1; i <= count; i++) {
        const angle = start + (sweep * i) / count;
        out.push(cx + radius * Math.cos(angle), cy + radius * Math.sin(angle));
    }
    return out;
}
/** The points of a curve of two or three control points after its first, which is `from`. */
export function bezierPoints(from, controls, to) {
    const xs = [from[0], ...controls.filter((_, i) => i % 2 === 0), to[0]], ys = [from[1], ...controls.filter((_, i) => i % 2 === 1), to[1]];
    let length = 0;
    for (let i = 1; i < xs.length; i++)
        length += Math.hypot(xs[i] - xs[i - 1], ys[i] - ys[i - 1]);
    const count = Math.max(4, Math.min(96, Math.ceil(length / 6))), out = [];
    for (let step = 1; step <= count; step++) {
        const t = step / count, px = xs.slice(), py = ys.slice();
        for (let level = px.length - 1; level > 0; level--)
            for (let i = 0; i < level; i++) {
                px[i] = px[i] + (px[i + 1] - px[i]) * t;
                py[i] = py[i] + (py[i + 1] - py[i]) * t;
            }
        out.push(px[0], py[0]);
    }
    // The last point is the end itself, not a sum that comes close to it.
    out[out.length - 2] = to[0];
    out[out.length - 1] = to[1];
    return out;
}
/** A shape drawn at once: its fill under its line. False when it is more than a fill or a line may be. */
export function addOutline(target, outline, convex, fill, line) {
    // A fill under a line has its edge under the line, which smooths its own.
    return ((fill === undefined || fillOutlines(target, [outline], convex, fill, line === undefined)) &&
        (line === undefined || strokeLine(target, outline, true, line)));
}
/** The triangles of a path: its parts filled together as closed outlines, then each lined, closed only where its ends meet. */
export function addPath(target, path) {
    if (path.fill !== undefined && !fillOutlines(target, path.subpaths, false, path.fill, path.line === undefined))
        return false;
    if (path.line !== undefined)
        for (const points of path.subpaths) {
            const n = points.length;
            if (!strokeLine(target, points, n >= 6 && points[0] === points[n - 2] && points[1] === points[n - 1], path.line))
                return false;
        }
    return true;
}
/** Whether a drawing of this many vertices and indices is one a node may hold. */
export function shapeFits(vertices, indices) {
    return (vertices <= GRAPHICS_SHAPE_LIMITS.maxVertices &&
        indices <= GRAPHICS_SHAPE_LIMITS.maxIndices &&
        88 * vertices + 4 * indices <= GRAPHICS_SHAPE_LIMITS.maxLogicalBytes);
}
// Shapes drawn the same way, on any number of nodes, are one geometry: a frame admits 4,096 of them.
const shared = new Map(), leases = new WeakMap();
// What each shared drawing was made from, to tell a true match of its key from a chance one.
const sources = new WeakMap();
function sameNumbers(a, b) {
    if (a.length !== b.length)
        return false;
    for (let i = 0; i < a.length; i++)
        if (a[i] !== b[i])
            return false;
    return true;
}
function sameDrawing(made, batches) {
    if (made === undefined || made.length !== batches.length)
        return false;
    for (let i = 0; i < made.length; i++) {
        const a = made[i], b = batches[i];
        if (a.bitmap?.lease !== b.bitmap?.lease ||
            a.bitmap?.repeat !== b.bitmap?.repeat ||
            !sameNumbers(a.positions, b.positions) ||
            !sameNumbers(a.colors, b.colors) ||
            !sameNumbers(a.indices, b.indices) ||
            (b.bitmap !== undefined && !sameNumbers(a.uvs, b.uvs)))
            return false;
    }
    return true;
}
let nextLease = 1;
const leaseNumber = (lease) => {
    let n = leases.get(lease);
    if (n === undefined) {
        n = nextLease++;
        leases.set(lease, n);
    }
    return n;
};
/** Whether a drawing is one a node may hold: every batch within what one geometry takes, and no more batches than a node has. */
export function drawingFits(drawing) {
    if (drawing.done.length >= GRAPHICS_SHAPE_LIMITS.maxBatches)
        return false;
    return shapeFits(drawing.positions.length / 2, drawing.indices.length);
}
/** The geometries and bounds of a node's shapes, or undefined while they hold no triangle. */
export function resolveShape(shape) {
    if (shape.resolved !== undefined)
        return shape.resolved;
    let target = shape;
    if (shape.path !== undefined) {
        target = copyDrawing(shape);
        // A path still being drawn that has grown past what a node may hold is not drawn; Graphics refuses it when it is finished.
        if (!addPath(target, shape.path) || !drawingFits(target))
            target = shape;
    }
    const batches = [...target.done, target].filter(batch => batch.indices.length !== 0 && shapeFits(batch.positions.length / 2, batch.indices.length));
    if (batches.length === 0)
        return undefined;
    // Two drawings are the same when their numbers are. A key of all the numbers written out would be as long as the
    // drawing each time it changes; a short key is mixed from them instead, and a match is checked number by number.
    let h1 = 0x811c9dc5, h2 = 0x1b873593, count = 0;
    const mix = (value) => {
        // The value as two whole numbers that tell any two different doubles apart in practice: its integer and scaled fraction parts.
        const whole = Math.trunc(value), part = Math.round((value - whole) * 4294967296);
        h1 = Math.imul(h1 ^ (whole | 0), 0x01000193) ^ (part | 0);
        h2 = Math.imul(h2 + (part | 0), 0x85ebca6b) ^ (whole | 0) ^ (h2 >>> 15);
        count++;
    };
    for (const batch of batches) {
        for (const list of [batch.positions, batch.colors, batch.indices]) {
            mix(list.length);
            for (let i = 0; i < list.length; i++)
                mix(list[i]);
        }
        if (batch.bitmap !== undefined) {
            for (let i = 0; i < batch.uvs.length; i++)
                mix(batch.uvs[i]);
            mix(leaseNumber(batch.bitmap.lease));
            mix(batch.bitmap.repeat ? 1 : 2);
        }
    }
    const key = count + ':' + (h1 >>> 0) + ':' + (h2 >>> 0);
    let resolved = shared.get(key);
    // A key that matches a different drawing is not that drawing: it is made anew and takes the key.
    if (resolved !== undefined && !sameDrawing(sources.get(resolved), batches))
        resolved = undefined;
    if (resolved === undefined) {
        let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
        const parts = [];
        for (const { positions, colors, uvs, indices, bitmap } of batches) {
            const vertices = positions.length / 2;
            for (let i = 0; i < positions.length; i += 2) {
                const x = positions[i], y = positions[i + 1];
                if (x < left)
                    left = x;
                if (x > right)
                    right = x;
                if (y < top)
                    top = y;
                if (y > bottom)
                    bottom = y;
            }
            parts.push(Object.freeze({
                bitmap,
                geometry: createSharedGeometry2D({
                    positions: Float64Array.from(positions),
                    uvs: Float64Array.from(uvs),
                    lightColors: Float64Array.from(colors),
                    darkColors: new Float64Array(3 * vertices),
                    indices: vertices > 65535 ? Uint32Array.from(indices) : Uint16Array.from(indices)
                })
            }));
        }
        resolved = Object.freeze({
            parts: Object.freeze(parts),
            bounds: Object.freeze({ x: left, y: top, width: right - left, height: bottom - top })
        });
        if (shared.size >= 512)
            shared.clear();
        shared.set(key, resolved);
        sources.set(resolved, batches.map(batch => ({
            positions: batch.positions.slice(),
            colors: batch.colors.slice(),
            uvs: batch.bitmap === undefined ? [] : batch.uvs.slice(),
            indices: batch.indices.slice(),
            bitmap: batch.bitmap
        })));
    }
    return (shape.resolved = resolved);
}
//# sourceMappingURL=graphicsShape.js.map