const axes = ['width', 'height'];
const key = (id, axis) => `${id}:${axis}`;
const zeroWork = () => ({ sourceCloneNodes: 0, mutationLookupVisits: 0, validationNodes: 0, dependencyValidationNodes: 0, dependencyValidationEdges: 0, dirtyPropagationVisits: 0, dimensionEvaluations: 0, dimensionDependencyReads: 0, childPlacementEvaluations: 0, worldEvaluations: 0, worldWrites: 0, clipIntersections: 0, snapshotNodes: 0 });
const finite = n => typeof n === 'number' && Number.isFinite(n) && n >= 0;
// Deliberately bounded research domain; avoid a hidden full dimension solve during
// transaction validation. 128 DAG nodes, scalars <= 1e6, factor <= 8 and <= 4096
// glyphs give a conservative recurrence B(d) <= 128*B(d-1)+1e10 for d <= 128.
// Its value and the 128-node world-coordinate sum remain far below Number.MAX_VALUE.
const scalarMax = 1e6, nodeMax = 128, factorMax = 8, glyphMax = 4096;
const scalar = n => finite(n) && n <= scalarMax;

// Experimental vertical-flow model. Transaction validation is deliberately full-tree;
// dimension caches and dependency-driven invalidation are incremental.
export class NestedUI {
  constructor(tree) {
    this.tree = structuredClone(tree);
    this.work = zeroWork();
    const graph = this.validate(this.tree);
    Object.assign(this, graph);
    this.dimensions = new Map();
    this.local = new Map();
    this.rectangles = new Map();
    this.order = [];
    this.dirty = new Set(graph.dependencies.keys());
    this.arrange = new Set(this.index.keys());
    this.needsWorld = true;
    this.lastHitWork = { boundsChecks: 0 };
  }
  source() { return structuredClone(this.tree); }
  validate(tree) {
    const index = new Map(), parents = new Map(), seenObjects = new Set();
    const collect = (n, parent) => {
      this.work.validationNodes++;
      if (!n || typeof n !== 'object') throw new Error('Node must be an object');
      if (seenObjects.has(n)) throw new Error('Tree object cycle or duplicate object');
      seenObjects.add(n);
      if (typeof n.id !== 'string' || !n.id || n.id.includes(':')) throw new Error('Node ID must be nonempty and exclude colon');
      if (index.has(n.id)) throw new Error(`Duplicate node ID ${n.id}`);
      index.set(n.id, n); parents.set(n.id, parent);
      if (index.size > nodeMax) throw new Error('Node budget exceeded (max 128)');
      const allowed = new Set(['id', 'width', 'height', 'padding', 'gap', 'visible', 'clip', 'text', 'children']);
      for (const property of Object.keys(n)) if (!allowed.has(property)) throw new Error(`Unsupported property ${property}`);
      for (const p of ['padding', 'gap']) if (n[p] !== undefined && !scalar(n[p])) throw new Error(`Invalid ${p}: scalar budget exceeded`);
      for (const p of ['visible', 'clip']) if (n[p] !== undefined && typeof n[p] !== 'boolean') throw new Error(`Invalid ${p}`);
      if (n.children !== undefined && !Array.isArray(n.children)) throw new Error('children must be array');
      if (n.text) {
        if ((n.children ?? []).length) throw new Error('Text fixture must be a leaf');
        const t = n.text;
        if (!Array.isArray(t.glyphWidths))
          throw new Error('Invalid text glyph-width fixture');
        if (t.glyphWidths.length > glyphMax) throw new Error('Text glyph count budget exceeded');
        // Array.some/every skip holes. Require an own value at every index before
        // checking its scalar so sparse input cannot introduce undefined and NaN.
        for (let i = 0; i < t.glyphWidths.length; i++)
          if (!Object.hasOwn(t.glyphWidths, i) || !scalar(t.glyphWidths[i])) throw new Error('Invalid dense text glyph-width scalar budget');
        if (!scalar(t.wrapWidth) || t.wrapWidth === 0 || !scalar(t.lineHeight) || t.lineHeight === 0)
          throw new Error('Invalid text measurement scalar budget');
      }
      for (const child of n.children ?? []) collect(child, n.id);
    };
    collect(tree, null);
    const dependencies = new Map(), reverse = new Map();
    for (const [id, n] of index) for (const axis of axes) {
      const spec = n[axis] ?? 'content';
      let deps;
      if (typeof spec === 'number') {
        if (!scalar(spec)) throw new Error(`Invalid ${axis} scalar budget at ${id}`);
        deps = [];
      }
      else if (spec === 'content') deps = n.text ? [] : (n.children ?? []).filter(c => c.visible !== false).map(c => key(c.id, axis));
      else if (spec && typeof spec === 'object' && typeof spec.ref === 'string' && index.has(spec.ref) && finite(spec.factor ?? 1) && (spec.factor ?? 1) <= factorMax && Object.keys(spec).every(p => ['ref', 'factor'].includes(p))) deps = [key(spec.ref, axis)];
      else if (spec && typeof spec === 'object' && finite(spec.factor) && spec.factor > factorMax) throw new Error(`Reference factor budget exceeded at ${id}`);
      else throw new Error(`Invalid ${axis} size or missing reference at ${id}`);
      dependencies.set(key(id, axis), deps);
      for (const d of deps) {
        if (!reverse.has(d)) reverse.set(d, new Set());
        reverse.get(d).add(key(id, axis));
      }
    }
    const state = new Map();
    const visit = k => {
      if (state.get(k) === 1) throw new Error(`Dimension dependency cycle at ${k}`);
      if (state.get(k) === 2) return;
      this.work.dependencyValidationNodes++;
      state.set(k, 1);
      for (const d of dependencies.get(k)) { this.work.dependencyValidationEdges++; visit(d); }
      state.set(k, 2);
    };
    for (const k of dependencies.keys()) visit(k);
    return { index, parents, dependencies, reverse };
  }
  transact(edit) {
    // Build a candidate before touching the committed source/caches/dirty sets.
    const candidate = structuredClone(this.tree);
    this.work.sourceCloneNodes += this.index.size;
    const lookup = id => {
      let result;
      const walk = n => {
        this.work.mutationLookupVisits++;
        if (n.id === id) result = n;
        for (const c of n.children ?? []) if (!result) walk(c);
      };
      walk(candidate);
      if (!result) throw new Error(`Missing node ${id}`);
      return result;
    };
    const changed = edit(candidate, lookup);
    const graph = this.validate(candidate);
    const pending = [];
    for (const id of changed) for (const axis of axes) pending.push(key(id, axis));
    const visited = new Set();
    while (pending.length) {
      const k = pending.pop(); if (visited.has(k)) continue;
      visited.add(k); this.work.dirtyPropagationVisits++;
      if (graph.dependencies.has(k)) this.dirty.add(k);
      for (const r of this.reverse.get(k) ?? []) pending.push(r);
      for (const r of graph.reverse.get(k) ?? []) pending.push(r);
      const id = k.slice(0, k.lastIndexOf(':'));
      this.arrange.add(id);
      if (this.parents.get(id)) this.arrange.add(this.parents.get(id));
      if (graph.parents.get(id)) this.arrange.add(graph.parents.get(id));
    }
    this.tree = candidate; Object.assign(this, graph); this.needsWorld = true;
    for (const k of this.dimensions.keys()) if (!graph.dependencies.has(k)) this.dimensions.delete(k);
    for (const k of this.dirty) if (!graph.dependencies.has(k)) this.dirty.delete(k);
    for (const id of this.local.keys()) if (!graph.index.has(id)) this.local.delete(id);
    for (const id of this.rectangles.keys()) if (!graph.index.has(id)) this.rectangles.delete(id);
  }
  patch(id, fields) {
    this.transact((_tree, lookup) => {
      const n = lookup(id);
      if (Object.keys(fields).some(k => k === 'id' || k === 'children')) throw new Error('Use structure operations for ID and children');
      Object.assign(n, structuredClone(fields)); return [id];
    });
  }
  insert(parent, node, at = 0) {
    this.transact((_tree, lookup) => {
      const p = lookup(parent), children = p.children ?? [];
      if (!Number.isInteger(at) || at < 0 || at > children.length) throw new Error('Invalid insert index');
      p.children = children; children.splice(at, 0, structuredClone(node));
      const added = [];
      (function collect(n) { added.push(n.id); for (const c of n.children ?? []) collect(c); })(node);
      return [parent, ...added];
    });
  }
  remove(id) {
    this.transact((_tree, lookup) => {
      if (id === this.tree.id) throw new Error('Cannot remove root');
      const n = lookup(id), p = lookup(this.parents.get(id));
      p.children.splice(p.children.indexOf(n), 1);
      const removed = [];
      (function collect(c) { removed.push(c.id); for (const child of c.children ?? []) collect(child); })(n);
      return [p.id, ...removed];
    });
  }
  reparent(id, parent, at = 0) {
    this.transact((_tree, lookup) => {
      if (id === this.tree.id) throw new Error('Cannot reparent root');
      const n = lookup(id), target = lookup(parent);
      let ancestor = parent;
      while (ancestor !== null) {
        if (ancestor === id) throw new Error('Cannot reparent to self or descendant: tree cycle');
        ancestor = this.parents.get(ancestor);
      }
      const old = lookup(this.parents.get(id));
      old.children.splice(old.children.indexOf(n), 1);
      target.children ??= [];
      if (!Number.isInteger(at) || at < 0 || at > target.children.length) throw new Error('Invalid reparent index');
      target.children.splice(at, 0, n); return [id, old.id, target.id];
    });
  }
  invalidateAll() {
    for (const k of this.dependencies.keys()) this.dirty.add(k);
    for (const id of this.index.keys()) this.arrange.add(id);
    this.needsWorld = true;
  }
  measure(k) {
    if (!this.dirty.has(k) && this.dimensions.has(k)) return this.dimensions.get(k);
    const sep = k.lastIndexOf(':'), id = k.slice(0, sep), axis = k.slice(sep + 1), n = this.index.get(id), spec = n[axis] ?? 'content';
    this.work.dimensionEvaluations++;
    const dep = d => { this.work.dimensionDependencyReads++; return this.measure(d); };
    let value;
    if (typeof spec === 'number') value = spec;
    else if (typeof spec === 'object') value = dep(key(spec.ref, axis)) * (spec.factor ?? 1);
    else if (n.text) {
      // External measured advances are the input. This is greedy fixture wrapping,
      // without font discovery, Unicode shaping or line-breaking semantics.
      let line = 0, widest = 0, count = 1;
      for (const advance of n.text.glyphWidths) {
        if (line !== 0 && line + advance > n.text.wrapWidth) { widest = Math.max(widest, line); count++; line = 0; }
        line += advance;
      }
      value = (axis === 'width' ? Math.max(widest, line) : count * n.text.lineHeight) + 2 * (n.padding ?? 0);
    } else {
      const children = (n.children ?? []).filter(c => c.visible !== false);
      if (axis === 'width') {
        value = 0;
        for (const c of children) value = Math.max(value, dep(key(c.id, 'width')));
      } else {
        value = Math.max(0, children.length - 1) * (n.gap ?? 0);
        for (const c of children) value += dep(key(c.id, 'height'));
      }
      value += 2 * (n.padding ?? 0);
    }
    this.dimensions.set(k, value); this.dirty.delete(k); return value;
  }
  flush() {
    // Only dirty dimensions are evaluated; untouched cached branches are reused.
    for (const k of [...this.dirty]) this.measure(k);
    if (this.needsWorld) {
      const order = [];
      const place = (n, x, y, inheritedActive, inheritedClip) => {
        this.work.worldEvaluations++;
        const width = this.dimensions.get(key(n.id, 'width')), height = this.dimensions.get(key(n.id, 'height'));
        let clip = inheritedClip;
        if (n.clip) {
          if (clip === null) clip = { x, y, width, height };
          else {
            this.work.clipIntersections++;
            const left = Math.max(clip.x, x), top = Math.max(clip.y, y);
            clip = { x: left, y: top, width: Math.max(0, Math.min(clip.x + clip.width, x + width) - left), height: Math.max(0, Math.min(clip.y + clip.height, y + height) - top) };
          }
        }
        const rect = { id: n.id, parent: this.parents.get(n.id), x, y, width, height, active: inheritedActive && n.visible !== false, clip };
        const old = this.rectangles.get(n.id);
        if (!old || JSON.stringify(old) !== JSON.stringify(rect)) { this.rectangles.set(n.id, rect); this.work.worldWrites++; }
        order.push(n.id);
        const children = n.children ?? [];
        if (this.arrange.has(n.id)) {
          let cursor = n.padding ?? 0, visibleCount = 0;
          for (const c of children) {
            this.work.childPlacementEvaluations++;
            if (c.visible !== false && visibleCount++ > 0) cursor += n.gap ?? 0;
            this.local.set(c.id, { x: n.padding ?? 0, y: cursor });
            if (c.visible !== false) cursor += this.dimensions.get(key(c.id, 'height'));
          }
        }
        for (const c of children) {
          const local = this.local.get(c.id);
          place(c, x + local.x, y + local.y, rect.active, clip);
        }
      };
      place(this.tree, 0, 0, true, null);
      this.order = order; this.arrange.clear(); this.needsWorld = false;
    }
    this.work.snapshotNodes += this.order.length;
    const result = { nodes: this.order.map(id => structuredClone(this.rectangles.get(id))), work: { ...this.work } };
    this.work = zeroWork(); return result;
  }
  hit(x, y) {
    if (this.needsWorld || this.dirty.size) throw new Error('Flush pending changes before hit testing');
    if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error('Invalid hit coordinates');
    this.lastHitWork = { boundsChecks: 0 };
    for (let i = this.order.length - 1; i >= 0; i--) {
      this.lastHitWork.boundsChecks++;
      const r = this.rectangles.get(this.order[i]);
      if (!r.active || x < r.x || y < r.y || x >= r.x + r.width || y >= r.y + r.height) continue;
      const c = r.clip;
      if (c && (x < c.x || y < c.y || x >= c.x + c.width || y >= c.y + c.height)) continue;
      return r.id;
    }
    return null;
  }
}
