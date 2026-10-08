// Throwaway architecture-contract model. Not production Egret code.
export class LayoutModel {
  constructor(regions = 8, children = 128) {
    this.regions = Array.from({ length: regions }, (_, r) => ({
      x: r * 80,
      items: Array.from({ length: children }, (_, i) => ({ w: 10 + i % 5, h: 4 + i % 7, y: 0 })),
      width: 0, height: 0,
    }));
    this.dirty = new Map(this.regions.map((_, r) => [r, new Set(this.regions[r].items.map((_, i) => i))]));
    this.flush();
  }
  update(region, child, patch) {
    Object.assign(this.regions[region].items[child], patch);
    if (!this.dirty.has(region)) this.dirty.set(region, new Set());
    this.dirty.get(region).add(child);
  }
  flush() {
    let propertyWrites = 0, aggregateReads = 0, placementWrites = 0;
    for (const [r, dirty] of this.dirty) {
      const region = this.regions[r];
      propertyWrites += dirty.size;
      region.width = Math.max(...region.items.map(item => item.w));
      region.height = region.items.reduce((sum, item) => sum + item.h, 0);
      aggregateReads += region.items.length; // Dirty parent still scans siblings in this model.
      let offset = 0;
      for (const item of region.items) { item.y = offset; offset += item.h; placementWrites++; }
    }
    const changedRegions = this.dirty.size;
    this.dirty.clear();
    return { changedRegions, propertyWrites, aggregateReads, placementWrites };
  }
  snapshot() {
    return this.regions.map(region => ({ x: region.x, width: region.width, height: region.height,
      children: region.items.map(item => ({ x: region.x, y: item.y, w: item.w, h: item.h })) }));
  }
}

export function adjacentBatches(commands) {
  const batches = [];
  for (const command of commands) {
    const key = JSON.stringify([command.texture, command.pipeline, command.clip]);
    if (!batches.length || batches[batches.length - 1].key !== key) batches.push({ key, commands: [] });
    batches[batches.length - 1].commands.push(command);
  }
  return batches;
}

export class Mirror {
  constructor() { this.epoch = 1; this.next = 1; this.objects = new Map(); this.generations = new Map(); this.events = []; this.needsSnapshot = false; }
  apply(packet) {
    if (packet.version !== 1) return { status: 'incompatible' };
    if (packet.epoch !== this.epoch) return { status: 'wrong_epoch' };
    if (this.needsSnapshot) return { status: 'snapshot_required' };
    if (packet.sequence < this.next) return { status: 'duplicate' };
    if (packet.sequence > this.next) { this.needsSnapshot = true; return { status: 'sequence_gap' }; }
    const objects = new Map([...this.objects].map(([id, data]) => [id, { ...data }]));
    const generations = new Map(this.generations);
    const events = this.events.slice();
    for (const c of packet.commands) {
      if (c.kind === 'event') { events.push(c.name); continue; }
      const current = objects.get(c.id);
      if (c.kind === 'create') {
        if (current || c.generation <= (generations.get(c.id) ?? 0)) return { status: 'invalid_generation' };
        objects.set(c.id, { generation: c.generation, value: c.value }); generations.set(c.id, c.generation);
      } else {
        if (!current || current.generation !== c.generation) return { status: 'invalid_generation' };
        if (c.kind === 'update') current.value = c.value;
        else if (c.kind === 'destroy') objects.delete(c.id);
        else return { status: 'unknown_command' };
      }
    }
    this.objects = objects; this.generations = generations; this.events = events; this.next++;
    return { status: 'applied' };
  }
  restore(snapshot) {
    if (snapshot.epoch <= this.epoch) throw new Error('Snapshot needs a new epoch');
    this.epoch = snapshot.epoch; this.next = snapshot.next;
    this.objects = new Map(snapshot.objects.map(item => [item.id, { generation: item.generation, value: item.value }]));
    this.generations = new Map(snapshot.generations);
    this.needsSnapshot = false;
    // Existing consumed events are not replayed by a graphics-state snapshot.
  }
}

export class BoundedQueue {
  constructor(capacity = 3) { this.capacity = capacity; this.items = []; }
  push(packet) { if (this.items.length >= this.capacity) return false; this.items.push(packet); return true; }
  pop() { return this.items.shift(); }
}

export class ResourceModel {
  constructor() { this.resources = new Map(); this.generation = new Map(); this.completedFrame = 0; }
  acquire(id, owner) {
    let r = this.resources.get(id);
    if (!r) {
      const generation = (this.generation.get(id) ?? 0) + 1;
      this.generation.set(id, generation);
      r = { generation, owners: new Set(), ready: false, resident: false, lastUse: 0 };
      this.resources.set(id, r);
    }
    r.owners.add(owner);
    return { id, generation: r.generation };
  }
  complete(handle) {
    const r = this.resources.get(handle.id);
    if (!r || r.generation !== handle.generation || r.owners.size === 0) return false;
    r.ready = true; r.resident = true; return true;
  }
  use(handle, frame) {
    const r = this.resources.get(handle.id);
    if (!r || r.generation !== handle.generation || !r.ready || !r.resident || r.owners.size === 0) throw new Error('Resource unavailable');
    r.lastUse = Math.max(r.lastUse, frame);
  }
  release(handle, owner) {
    const r = this.resources.get(handle.id);
    if (!r || r.generation !== handle.generation) return;
    r.owners.delete(owner); this.collect();
  }
  fence(frame) { this.completedFrame = Math.max(this.completedFrame, frame); this.collect(); }
  collect() {
    for (const [id, r] of this.resources) {
      if (r.owners.size === 0 && r.lastUse <= this.completedFrame) this.resources.delete(id);
    }
  }
  loseDevice() { for (const r of this.resources.values()) r.resident = false; }
  rebuild() { for (const r of this.resources.values()) if (r.owners.size && r.ready) r.resident = true; }
}
