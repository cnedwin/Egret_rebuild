/**
 * Bodies that never move, kept in a hierarchy of boxes so that a moving body, a ray or a
 * sweep only looks at the ones nearby. It is rebuilt when a static body is added, removed or moved.
 */
export class StaticTree {
    bodies = [];
    #boxes = new Float64Array(0);
    /** Two numbers per node: an inner node holds its children; a leaf holds -(first body + 1) and a count. */
    #links = new Int32Array(0);
    #count = 0;
    #dirty = false;
    #stack = new Int32Array(64);
    #busy = false;
    add(body) {
        this.bodies.push(body);
        this.#dirty = true;
    }
    remove(body) {
        const at = this.bodies.indexOf(body);
        if (at >= 0) {
            this.bodies.splice(at, 1);
            this.#dirty = true;
        }
    }
    touch() {
        this.#dirty = true;
    }
    build() {
        this.#dirty = false;
        this.#count = 0;
        const bodies = this.bodies, most = Math.max(2 * bodies.length, 1);
        if (this.#links.length < most * 2) {
            this.#boxes = new Float64Array(most * 6);
            this.#links = new Int32Array(most * 2);
        }
        if (bodies.length > 0)
            this.split(0, bodies.length);
    }
    split(first, end) {
        const bodies = this.bodies, node = this.#count++, box = this.#boxes, at = node * 6;
        let lx = Infinity, ly = Infinity, lz = Infinity, hx = -Infinity, hy = -Infinity, hz = -Infinity;
        let cx0 = Infinity, cy0 = Infinity, cz0 = Infinity, cx1 = -Infinity, cy1 = -Infinity, cz1 = -Infinity;
        for (let i = first; i < end; i++) {
            const b = bodies[i].aabb, cx = b[0] + b[3], cy = b[1] + b[4], cz = b[2] + b[5];
            lx = Math.min(lx, b[0]);
            ly = Math.min(ly, b[1]);
            lz = Math.min(lz, b[2]);
            hx = Math.max(hx, b[3]);
            hy = Math.max(hy, b[4]);
            hz = Math.max(hz, b[5]);
            cx0 = Math.min(cx0, cx);
            cy0 = Math.min(cy0, cy);
            cz0 = Math.min(cz0, cz);
            cx1 = Math.max(cx1, cx);
            cy1 = Math.max(cy1, cy);
            cz1 = Math.max(cz1, cz);
        }
        box[at] = lx;
        box[at + 1] = ly;
        box[at + 2] = lz;
        box[at + 3] = hx;
        box[at + 4] = hy;
        box[at + 5] = hz;
        const count = end - first, sx = cx1 - cx0, sy = cy1 - cy0, sz = cz1 - cz0, axis = sx >= sy && sx >= sz ? 0 : sy >= sz ? 1 : 2;
        // A handful of bodies, or bodies stacked at one place, stay together in a leaf.
        if (count <= 4 || !(Math.max(sx, sy, sz) > 0)) {
            this.#links[node * 2] = -(first + 1);
            this.#links[node * 2 + 1] = count;
            return node;
        }
        const part = bodies
            .slice(first, end)
            .sort((a, b) => a.aabb[axis] + a.aabb[axis + 3] - b.aabb[axis] - b.aabb[axis + 3]);
        for (let i = 0; i < count; i++)
            bodies[first + i] = part[i];
        const middle = first + (count >> 1);
        const left = this.split(first, middle), right = this.split(middle, end);
        this.#links[node * 2] = left;
        this.#links[node * 2 + 1] = right;
        return node;
    }
    /** Call `visit` for every static body whose bounds meet the box. */
    query(lx, ly, lz, hx, hy, hz, visit) {
        if (this.#dirty)
            this.build();
        if (this.#count === 0)
            return;
        const box = this.#boxes, links = this.#links, bodies = this.bodies, shared = !this.#busy;
        // A visitor may ask again while this walk is under way; it then gets a list of its own.
        let stack = shared ? this.#stack : new Int32Array(64), top = 0;
        if (shared)
            this.#busy = true;
        stack[top++] = 0;
        try {
            while (top > 0) {
                const node = stack[--top], at = node * 6;
                if (box[at] > hx ||
                    box[at + 3] < lx ||
                    box[at + 1] > hy ||
                    box[at + 4] < ly ||
                    box[at + 2] > hz ||
                    box[at + 5] < lz)
                    continue;
                const link = links[node * 2];
                if (link < 0) {
                    for (let i = -link - 1, end = i + links[node * 2 + 1]; i < end; i++) {
                        const b = bodies[i].aabb;
                        if (b[0] > hx || b[3] < lx || b[1] > hy || b[4] < ly || b[2] > hz || b[5] < lz)
                            continue;
                        visit(bodies[i]);
                    }
                    continue;
                }
                if (top + 2 > stack.length) {
                    const grown = new Int32Array(stack.length * 2);
                    grown.set(stack);
                    stack = grown;
                }
                stack[top++] = link;
                stack[top++] = links[node * 2 + 1];
            }
        }
        finally {
            if (shared)
                this.#busy = false;
        }
    }
    /** Call `visit` for static bodies whose bounds the ray crosses within the distance `visit` returns. */
    ray(o, d, limit, visit) {
        if (this.#dirty)
            this.build();
        if (this.#count === 0)
            return;
        const box = this.#boxes, links = this.#links, bodies = this.bodies, stack = [0];
        const reaches = (b, at) => {
            let near = 0, far = limit;
            for (let i = 0; i < 3; i++) {
                const low = b[at + i], high = b[at + i + 3], from = o[i], way = d[i];
                if (Math.abs(way) < 1e-12) {
                    if (from < low || from > high)
                        return false;
                    continue;
                }
                let t1 = (low - from) / way, t2 = (high - from) / way;
                if (t1 > t2) {
                    const swap = t1;
                    t1 = t2;
                    t2 = swap;
                }
                if (t1 > near)
                    near = t1;
                if (t2 < far)
                    far = t2;
                if (near > far)
                    return false;
            }
            return true;
        };
        while (stack.length > 0) {
            const node = stack.pop();
            if (!reaches(box, node * 6))
                continue;
            const link = links[node * 2];
            if (link < 0) {
                for (let i = -link - 1, end = i + links[node * 2 + 1]; i < end; i++)
                    if (reaches(bodies[i].aabb, 0))
                        limit = visit(bodies[i], limit);
            }
            else
                stack.push(link, links[node * 2 + 1]);
        }
    }
}
/**
 * Distance along a unit ray to a body, or -1. Writes the surface normal at the hit.
 * The caller supplies the existing mesh-normal scratch, also reused by compound parts.
 */
export function rayShape(body, o, d, limit, normal, meshNormal) {
    const shape = body.shape, p = body.position, r = body.rotation;
    if (shape.type === 'compound') {
        let best = -1, bx = 0, by = 0, bz = 0;
        for (const part of body.parts) {
            const distance = rayShape(part, o, d, best < 0 ? limit : best, normal, meshNormal);
            if (distance < 0 || (best >= 0 && distance >= best))
                continue;
            best = distance;
            bx = normal[0];
            by = normal[1];
            bz = normal[2];
        }
        normal[0] = bx;
        normal[1] = by;
        normal[2] = bz;
        return best;
    }
    const raySphere = (cx, cy, cz, radius) => {
        const mx = o[0] - cx, my = o[1] - cy, mz = o[2] - cz, b = mx * d[0] + my * d[1] + mz * d[2], c = mx * mx + my * my + mz * mz - radius * radius;
        if (c > 0 && b > 0)
            return -1;
        const discriminant = b * b - c;
        if (discriminant < 0)
            return -1;
        const t = Math.max(-b - Math.sqrt(discriminant), 0);
        normal[0] = (mx + d[0] * t) / radius;
        normal[1] = (my + d[1] * t) / radius;
        normal[2] = (mz + d[2] * t) / radius;
        return t;
    };
    if (shape.type === 'sphere')
        return raySphere(p[0], p[1], p[2], shape.radius);
    if (shape.type === 'plane') {
        const nx = r[1], ny = r[4], nz = r[7], denominator = d[0] * nx + d[1] * ny + d[2] * nz;
        if (denominator >= -1e-9)
            return -1;
        const t = ((p[0] - o[0]) * nx + (p[1] - o[1]) * ny + (p[2] - o[2]) * nz) / denominator;
        if (t < 0)
            return -1;
        normal[0] = nx;
        normal[1] = ny;
        normal[2] = nz;
        return t;
    }
    // Work in the body's local frame for boxes and capsules.
    const dx = o[0] - p[0], dy = o[1] - p[1], dz = o[2] - p[2];
    const lo = [
        r[0] * dx + r[3] * dy + r[6] * dz,
        r[1] * dx + r[4] * dy + r[7] * dz,
        r[2] * dx + r[5] * dy + r[8] * dz
    ];
    const ld = [
        r[0] * d[0] + r[3] * d[1] + r[6] * d[2],
        r[1] * d[0] + r[4] * d[1] + r[7] * d[2],
        r[2] * d[0] + r[5] * d[1] + r[8] * d[2]
    ];
    let t = -1, lx = 0, ly = 0, lz = 0;
    if (shape.type === 'convex') {
        t = shape.hull.raycast(lo[0], lo[1], lo[2], ld[0], ld[1], ld[2], limit, meshNormal);
        if (t < 0)
            return -1;
        lx = meshNormal[0];
        ly = meshNormal[1];
        lz = meshNormal[2];
    }
    else if (shape.type === 'mesh') {
        t = shape.mesh.raycast(lo[0], lo[1], lo[2], ld[0], ld[1], ld[2], limit, meshNormal);
        if (t < 0)
            return -1;
        lx = meshNormal[0];
        ly = meshNormal[1];
        lz = meshNormal[2];
    }
    else if (shape.type === 'box') {
        let near = 0, far = limit, axis = -1, sign = 0;
        for (let i = 0; i < 3; i++) {
            const h = shape.halfExtents[i];
            if (Math.abs(ld[i]) < 1e-12) {
                if (Math.abs(lo[i]) > h)
                    return -1;
                continue;
            }
            let t1 = (-h - lo[i]) / ld[i], t2 = (h - lo[i]) / ld[i], s = -1;
            if (t1 > t2) {
                const swap = t1;
                t1 = t2;
                t2 = swap;
                s = 1;
            }
            if (t1 > near) {
                near = t1;
                axis = i;
                sign = s;
            }
            far = Math.min(far, t2);
            if (near > far)
                return -1;
        }
        if (axis < 0)
            return -1; // Origin inside the box.
        t = near;
        lx = axis === 0 ? sign : 0;
        ly = axis === 1 ? sign : 0;
        lz = axis === 2 ? sign : 0;
    }
    else {
        const capsule = shape, radius = capsule.radius, h = capsule.halfHeight;
        // Side: an infinite cylinder around local Y, clipped to the segment.
        const a = ld[0] * ld[0] + ld[2] * ld[2], b = lo[0] * ld[0] + lo[2] * ld[2], c = lo[0] * lo[0] + lo[2] * lo[2] - radius * radius;
        if (a > 1e-12) {
            const discriminant = b * b - a * c;
            if (discriminant >= 0) {
                const hit = (-b - Math.sqrt(discriminant)) / a, y = lo[1] + ld[1] * hit;
                if (hit >= 0 && Math.abs(y) <= h) {
                    t = hit;
                    lx = (lo[0] + ld[0] * hit) / radius;
                    ly = 0;
                    lz = (lo[2] + ld[2] * hit) / radius;
                }
            }
        }
        if (t < 0) {
            // Caps: the nearer of the two end spheres, tested in world space.
            let bestCap = -1, bx = 0, by = 0, bz = 0;
            for (const side of [-h, h]) {
                const hit = raySphere(p[0] + r[1] * side, p[1] + r[4] * side, p[2] + r[7] * side, radius);
                if (hit >= 0 && (bestCap < 0 || hit < bestCap)) {
                    bestCap = hit;
                    bx = normal[0];
                    by = normal[1];
                    bz = normal[2];
                }
            }
            normal[0] = bx;
            normal[1] = by;
            normal[2] = bz;
            return bestCap;
        }
    }
    normal[0] = r[0] * lx + r[1] * ly + r[2] * lz;
    normal[1] = r[3] * lx + r[4] * ly + r[5] * lz;
    normal[2] = r[6] * lx + r[7] * ly + r[8] * lz;
    return t;
}
//# sourceMappingURL=PhysicsQueries3D.js.map