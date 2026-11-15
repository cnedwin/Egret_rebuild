// SPDX-License-Identifier: Apache-2.0
// Filling for Graphics beyond one simple outline: the non-zero rule over any number of outlines, so that holes and
// outlines that cross themselves are filled as a canvas fills them, and gradients, which are given as vertex colours.
import { decodeSRGBByte } from './srgbBytes.js';
/**
 * The linear-light value of an sRGB value from 0 to 255 that need not be whole: between the two bytes it lies between,
 * read from the written table. A power here would differ in its last bit from one engine of JavaScript to another.
 */
function toLinear(value) {
    const low = Math.floor(value);
    if (low >= 255)
        return decodeSRGBByte(255);
    if (low < 0)
        return decodeSRGBByte(0);
    const from = decodeSRGBByte(low);
    return from + (decodeSRGBByte(low + 1) - from) * (value - low);
}
/** The linear-light red, green and blue and the alpha of a gradient at a point. Stops are mixed as sRGB values, as a canvas mixes them. */
export function gradientColor(gradient, x, y, out, at = 0) {
    const u = gradient.a * x + gradient.c * y + gradient.tx;
    let t = gradient.radial ? Math.hypot(u, gradient.b * x + gradient.d * y + gradient.ty) : u;
    const stops = gradient.stops, last = stops.length - 1;
    if (!(t > 0))
        t = 0;
    else if (t > 1)
        t = 1;
    let i = 0;
    while (i < last && stops[i + 1].offset <= t)
        i++;
    const from = stops[i];
    let color = from.color, alpha = from.alpha, r = (color >> 16) & 255, g = (color >> 8) & 255, b = color & 255;
    if (i < last && t > from.offset) {
        const to = stops[i + 1], f = (t - from.offset) / (to.offset - from.offset);
        color = to.color;
        r += (((color >> 16) & 255) - r) * f;
        g += (((color >> 8) & 255) - g) * f;
        b += ((color & 255) - b) * f;
        alpha += (to.alpha - alpha) * f;
    }
    out[at] = toLinear(r);
    out[at + 1] = toLinear(g);
    out[at + 2] = toLinear(b);
    out[at + 3] = alpha;
}
/** Whether an outline, taken as closed, has two sides that cross. */
export function outlineCrosses(points) {
    const count = points.length / 2;
    for (let i = 0; i < count; i++) {
        const ax = points[2 * i], ay = points[2 * i + 1], bx = points[2 * ((i + 1) % count)], by = points[2 * ((i + 1) % count) + 1];
        const left = Math.min(ax, bx), right = Math.max(ax, bx), top = Math.min(ay, by), bottom = Math.max(ay, by);
        for (let j = i + 2; j < count; j++) {
            if (i === 0 && j === count - 1)
                continue;
            const cx = points[2 * j], cy = points[2 * j + 1], dx = points[2 * ((j + 1) % count)], dy = points[2 * ((j + 1) % count) + 1];
            if (Math.max(cx, dx) < left || Math.min(cx, dx) > right || Math.max(cy, dy) < top || Math.min(cy, dy) > bottom)
                continue;
            const d1 = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax), d2 = (bx - ax) * (dy - ay) - (by - ay) * (dx - ax);
            const d3 = (dx - cx) * (ay - cy) - (dy - cy) * (ax - cx), d4 = (dx - cx) * (by - cy) - (dy - cy) * (bx - cx);
            if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0)))
                return true;
            // A corner that lies on another side, or sides that run along each other, is left to the non-zero fill too.
            if (d1 === 0 || d2 === 0 || d3 === 0 || d4 === 0)
                return true;
        }
    }
    return false;
}
/**
 * The triangles of what closed outlines cover by the non-zero rule, as x, y of each corner, three corners to a
 * triangle; undefined when there would be more than `maxTriangles`. The plane is cut into bands at every corner and
 * crossing; in a band no two sides cross, so what is inside lies between pairs of sides. Triangles that meet along a
 * band's edge share every corner on it, so no seam opens between bands under any transform.
 */
export function fillNonZero(outlines, maxTriangles) {
    const x0 = [], y0 = [], x1 = [], y1 = [], turn = [];
    for (const points of outlines) {
        const count = points.length / 2;
        if (count < 3)
            continue;
        for (let i = 0; i < count; i++) {
            const ax = points[2 * i], ay = points[2 * i + 1], j = (i + 1) % count, bx = points[2 * j], by = points[2 * j + 1];
            if (ay === by)
                continue;
            if (ay < by) {
                x0.push(ax);
                y0.push(ay);
                x1.push(bx);
                y1.push(by);
                turn.push(1);
            }
            else {
                x0.push(bx);
                y0.push(by);
                x1.push(ax);
                y1.push(ay);
                turn.push(-1);
            }
        }
    }
    const edges = x0.length;
    if (edges === 0)
        return [];
    const order = [];
    for (let i = 0; i < edges; i++)
        order.push(i);
    order.sort((p, q) => y0[p] - y0[q]);
    const levels = new Set();
    for (let i = 0; i < edges; i++) {
        levels.add(y0[i]);
        levels.add(y1[i]);
    }
    for (let p = 0; p < edges; p++) {
        const i = order[p], bottom = y1[i], si = (x1[i] - x0[i]) / (bottom - y0[i]), li = Math.min(x0[i], x1[i]), ri = Math.max(x0[i], x1[i]);
        for (let q = p + 1; q < edges; q++) {
            const j = order[q];
            if (y0[j] >= bottom)
                break;
            if (Math.max(x0[j], x1[j]) < li || Math.min(x0[j], x1[j]) > ri)
                continue;
            const sj = (x1[j] - x0[j]) / (y1[j] - y0[j]);
            if (si === sj)
                continue;
            const y = (x0[j] - x0[i] + y0[i] * si - y0[j] * sj) / (si - sj);
            if (y > y0[j] && y < bottom && y < y1[j])
                levels.add(y);
        }
    }
    // Levels closer than stored coordinates can tell apart are one level, and every side ends on a level, so that no
    // band is thinner than a stored coordinate can say.
    let reach = 1;
    for (let i = 0; i < edges; i++)
        reach = Math.max(reach, Math.abs(y0[i]), Math.abs(y1[i]), Math.abs(x0[i]), Math.abs(x1[i]));
    const ys = [];
    for (const y of [...levels].sort((p, q) => p - q))
        if (ys.length === 0 || y - ys[ys.length - 1] > reach * 1e-6)
            ys.push(y);
    const level = (y) => {
        let low = 0, high = ys.length - 1;
        while (low < high) {
            const middle = (low + high + 1) >> 1;
            if (ys[middle] <= y)
                low = middle;
            else
                high = middle - 1;
        }
        return ys[low];
    };
    for (let i = 0; i < edges; i++) {
        y0[i] = level(y0[i]);
        y1[i] = level(y1[i]);
    }
    const bands = ys.length - 1;
    const at = (edge, y) => y === y0[edge]
        ? x0[edge]
        : y === y1[edge]
            ? x1[edge]
            : x0[edge] + ((y - y0[edge]) * (x1[edge] - x0[edge])) / (y1[edge] - y0[edge]);
    // For each band, the spans inside it: left and right at its top, then left and right at its bottom.
    const spans = [], corners = [];
    for (let k = 0; k <= bands; k++)
        corners.push([]);
    let active = [], next = 0, total = 0;
    for (let k = 0; k < bands; k++) {
        const top = ys[k], bottom = ys[k + 1];
        active = active.filter(edge => y1[edge] > top);
        while (next < edges && y0[order[next]] <= top) {
            if (y1[order[next]] > top)
                active.push(order[next]);
            next++;
        }
        const here = active
            .map(edge => {
            const xt = at(edge, top), xb = at(edge, bottom);
            return { edge, xt, xb, middle: (xt + xb) / 2 };
        })
            .sort((p, q) => p.middle - q.middle || p.xb - q.xb);
        const band = [];
        let winding = 0, left = here[0];
        for (const side of here) {
            const before = winding;
            winding += turn[side.edge];
            if (before === 0 && winding !== 0)
                left = side;
            else if (before !== 0 && winding === 0 && (left.xt !== side.xt || left.xb !== side.xb)) {
                band.push(left.xt, side.xt, left.xb, side.xb);
                corners[k].push(left.xt, side.xt);
                corners[k + 1].push(left.xb, side.xb);
            }
        }
        spans.push(band);
        total += band.length / 2;
    }
    if (total > 2 * maxTriangles)
        return undefined;
    for (const line of corners)
        line.sort((p, q) => p - q);
    const out = [], topRow = [], bottomRow = [];
    const row = (line, from, to, into) => {
        into.length = 0;
        into.push(from);
        for (const x of line)
            if (x > from && x < to && x !== into[into.length - 1])
                into.push(x);
        if (to !== from)
            into.push(to);
    };
    for (let k = 0; k < bands; k++) {
        const band = spans[k], top = ys[k], bottom = ys[k + 1];
        for (let s = 0; s < band.length; s += 4) {
            row(corners[k], band[s], band[s + 1], topRow);
            row(corners[k + 1], band[s + 2], band[s + 3], bottomRow);
            // The two rows are joined like a zip, always from the row whose next corner comes first.
            for (let i = 0, j = 0; i + 1 < topRow.length || j + 1 < bottomRow.length;) {
                if (i + 1 < topRow.length && (j + 1 === bottomRow.length || topRow[i + 1] <= bottomRow[j + 1])) {
                    out.push(topRow[i], top, topRow[i + 1], top, bottomRow[j], bottom);
                    i++;
                }
                else {
                    out.push(topRow[i], top, bottomRow[j + 1], bottom, bottomRow[j], bottom);
                    j++;
                }
            }
            if (out.length > 6 * maxTriangles)
                return undefined;
        }
    }
    return out;
}
/** How far a colour may be from its gradient, in a measure close to what an eye tells apart: two parts in 255. */
const TOLERANCE = 2 / 255;
/**
 * Cuts triangles until the colours of their corners, mixed across each side, stay within the tolerance of the gradient.
 * A side's test depends on its endpoints. The triangle budget can still stop adjacent subdivisions at different depths.
 * When supplied, boundary masks are replaced in the output order. Only the children of an original boundary inherit it.
 */
export function refineForGradient(triangles, gradient, maxTriangles, boundary) {
    const ca = [0, 0, 0, 0], cb = [0, 0, 0, 0], cm = [0, 0, 0, 0];
    const cut = (ax, ay, bx, by) => {
        if (ax > bx || (ax === bx && ay > by)) {
            const x = ax, y = ay;
            ax = bx;
            ay = by;
            bx = x;
            by = y;
        }
        const dx = bx - ax, dy = by - ay;
        if (dx * dx + dy * dy < 0.25)
            return false;
        gradientColor(gradient, ax, ay, ca);
        gradientColor(gradient, bx, by, cb);
        for (let step = 1; step < 4; step++) {
            const f = step / 4;
            gradientColor(gradient, ax + dx * f, ay + dy * f, cm);
            for (let i = 0; i < 3; i++)
                if (Math.abs(Math.sqrt(cm[i]) - Math.sqrt(ca[i] + (cb[i] - ca[i]) * f)) > TOLERANCE)
                    return true;
            if (Math.abs(cm[3] - (ca[3] + (cb[3] - ca[3]) * f)) > TOLERANCE)
                return true;
        }
        return false;
    };
    const stack = triangles.slice(), out = [];
    const boundaries = boundary?.slice();
    if (boundary !== undefined)
        boundary.length = 0;
    let count = triangles.length / 6;
    while (stack.length !== 0) {
        const p = stack.splice(stack.length - 6, 6);
        const mask = boundaries?.pop() ?? 0;
        const flags = count < maxTriangles
            ? [cut(p[0], p[1], p[2], p[3]), cut(p[2], p[3], p[4], p[5]), cut(p[4], p[5], p[0], p[1])]
            : [false, false, false];
        const cuts = (flags[0] ? 1 : 0) + (flags[1] ? 1 : 0) + (flags[2] ? 1 : 0);
        if (cuts === 0) {
            out.push(...p);
            boundary?.push(mask);
            continue;
        }
        // Turned so that with one cut it is the first side, and with two the uncut side is the last.
        const turnBy = cuts === 3 ? 0 : cuts === 1 ? flags.indexOf(true) : (flags.indexOf(false) + 1) % 3;
        const ax = p[2 * turnBy], ay = p[2 * turnBy + 1], bx = p[2 * ((turnBy + 1) % 3)], by = p[2 * ((turnBy + 1) % 3) + 1], cx = p[2 * ((turnBy + 2) % 3)], cy = p[2 * ((turnBy + 2) % 3) + 1];
        const abx = (ax + bx) / 2, aby = (ay + by) / 2, bcx = (bx + cx) / 2, bcy = (by + cy) / 2, cax = (cx + ax) / 2, cay = (cy + ay) / 2;
        // Rotate the three bits with the corners. New interior sides never carry a boundary bit.
        const turned = (mask >>> turnBy) | ((mask << (3 - turnBy)) & 7);
        const ab = turned & 1, bc = turned & 2, ca = turned & 4;
        if (cuts === 1) {
            stack.push(ax, ay, abx, aby, cx, cy, abx, aby, bx, by, cx, cy);
            boundaries?.push(ab | ca, ab | bc);
        }
        else if (cuts === 2) {
            stack.push(abx, aby, bx, by, bcx, bcy, ax, ay, abx, aby, bcx, bcy, ax, ay, bcx, bcy, cx, cy);
            boundaries?.push(ab | bc, ab, bc | ca);
        }
        else {
            stack.push(ax, ay, abx, aby, cax, cay, abx, aby, bx, by, bcx, bcy, cax, cay, bcx, bcy, cx, cy, abx, aby, bcx, bcy, cax, cay);
            boundaries?.push(ab | ca, ab | bc, bc | ca, 0);
        }
        count += cuts;
    }
    return out;
}
//# sourceMappingURL=graphicsFill.js.map