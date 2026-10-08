// Finite architecture-contract model. No real decoding, GPU, allocator, or threads.
export class AsyncResourceModel {
  constructor() {
    this.resources = new Map(); this.generations = new Map();
    this.nextLease = 1; this.nextTask = 1; this.deviceEpoch = 1; this.deviceLost = false;
    this.completedFrame = 0;
  }
  acquire(id, owner) {
    if (typeof id !== 'string' || !id.length || typeof owner !== 'string' || !owner.length) throw new Error('Invalid resource or owner');
    let r = this.resources.get(id);
    if (!r) {
      const generation = (this.generations.get(id) ?? 0) + 1; this.generations.set(id, generation);
      r = { generation, leases: new Map(), cpuState: 'empty', cpuData: null, decodeTask: null,
        gpuState: 'empty', uploadTask: null, residentEpoch: null, lastUse: 0, error: null };
      this.resources.set(id, r);
    }
    const lease = Object.freeze({ id, owner, resourceGeneration: r.generation, leaseId: this.nextLease++ });
    r.leases.set(lease.leaseId, lease); return lease;
  }
  active(lease) {
    const r = lease && this.resources.get(lease.id), issued = r?.leases.get(lease.leaseId);
    return r && issued && r.generation === lease.resourceGeneration && issued.owner === lease.owner ? r : null;
  }
  requireActive(lease) { const r = this.active(lease); if (!r) throw new Error('Inactive lease'); return r; }
  decodeStart(lease) {
    const r = this.requireActive(lease);
    if (r.cpuState === 'decoded') return null;
    if (r.decodeTask) return r.decodeTask;
    r.cpuState = 'decoding'; if (r.error?.stage === 'decode') r.error = null;
    r.decodeTask = Object.freeze({ id: lease.id, resourceGeneration: r.generation, taskId: this.nextTask++, stage: 'decode' });
    return r.decodeTask;
  }
  matchingTask(token, stage) {
    const r = token && this.resources.get(token.id), task = stage === 'decode' ? r?.decodeTask : r?.uploadTask;
    return r && r.leases.size && task && token.stage === stage && token.resourceGeneration === r.generation &&
      token.taskId === task.taskId && (stage === 'decode' || (!this.deviceLost && token.deviceEpoch === this.deviceEpoch)) ? r : null;
  }
  validateResult(result, stage) {
    if (!result || typeof result.ok !== 'boolean' ||
        (result.ok && stage === 'decode' && (result.data === undefined || result.data === null)) ||
        (!result.ok && (typeof result.code !== 'string' || !result.code.length))) throw new Error('Invalid task result');
  }
  completeDecode(token, result) {
    const r = this.matchingTask(token, 'decode'); if (!r) return false;
    this.validateResult(result, 'decode'); r.decodeTask = null;
    if (result.ok) { r.cpuState = 'decoded'; r.cpuData = result.data; r.error = null; }
    else { r.cpuState = 'decode_failed'; r.cpuData = null;
      r.error = { stage: 'decode', code: result.code, taskId: token.taskId, resourceGeneration: r.generation }; }
    return true;
  }
  uploadStart(lease) {
    const r = this.requireActive(lease);
    if (this.deviceLost) throw new Error('Device unavailable');
    if (r.cpuState !== 'decoded') throw new Error('CPU data unavailable');
    if (r.gpuState === 'resident' && r.residentEpoch === this.deviceEpoch) return null;
    if (r.uploadTask) return r.uploadTask;
    r.gpuState = 'uploading'; r.residentEpoch = null; if (r.error?.stage === 'upload') r.error = null;
    r.uploadTask = Object.freeze({ id: lease.id, resourceGeneration: r.generation, taskId: this.nextTask++,
      stage: 'upload', deviceEpoch: this.deviceEpoch });
    return r.uploadTask;
  }
  completeUpload(token, result) {
    const r = this.matchingTask(token, 'upload'); if (!r) return false;
    this.validateResult(result, 'upload'); r.uploadTask = null;
    if (result.ok) { r.gpuState = 'resident'; r.residentEpoch = this.deviceEpoch; r.error = null; }
    else { r.gpuState = 'upload_failed'; r.residentEpoch = null;
      r.error = { stage: 'upload', code: result.code, taskId: token.taskId,
        resourceGeneration: r.generation, deviceEpoch: token.deviceEpoch }; }
    return true;
  }
  use(lease, frame) {
    const r = this.requireActive(lease);
    if (!Number.isSafeInteger(frame) || frame < 1 || frame <= this.completedFrame) throw new Error('Invalid or already completed frame');
    if (this.deviceLost || r.gpuState !== 'resident' || r.residentEpoch !== this.deviceEpoch) throw new Error('GPU resource unavailable');
    r.lastUse = Math.max(r.lastUse, frame); return true;
  }
  release(lease) {
    const r = this.active(lease); if (!r) return false;
    r.leases.delete(lease.leaseId);
    if (!r.leases.size) {
      // Shared tasks belong to the resource, and survive a single lease release.
      // Only the final lease invalidates tasks, independently of a pending fence.
      if (r.decodeTask) { r.decodeTask = null; r.cpuState = 'empty'; }
      if (r.uploadTask) { r.uploadTask = null; r.gpuState = 'empty'; }
    }
    this.collect(); return true;
  }
  cancel(lease) { return this.release(lease); }
  fence(frame, epoch) {
    if (!Number.isSafeInteger(frame) || frame < 0 || !Number.isSafeInteger(epoch) || epoch < 1) throw new Error('Invalid fence');
    if (epoch !== this.deviceEpoch || this.deviceLost) return false;
    this.completedFrame = Math.max(this.completedFrame, frame); this.collect(); return true;
  }
  collect() {
    for (const [id, r] of this.resources) if (!r.leases.size && r.lastUse <= this.completedFrame) this.resources.delete(id);
  }
  loseDevice() {
    this.deviceEpoch++; this.deviceLost = true; this.completedFrame = 0;
    for (const r of this.resources.values()) {
      r.gpuState = 'lost'; r.uploadTask = null; r.residentEpoch = null; r.lastUse = 0;
      // Loss invalidates GPU allocations and their old in-flight uses in this
      // model. CPU decode task identity and decoded data deliberately survive.
    }
    this.collect();
  }
  restoreDevice() {
    this.deviceLost = false;
    // Recovery only opens submission. Each resource needs uploadStart followed
    // by current-epoch completeUpload; there is no synchronous rebuild success.
  }
  snapshot(id) {
    const r = this.resources.get(id); if (!r) return null;
    const owners = new Map(); for (const lease of r.leases.values()) owners.set(lease.owner, (owners.get(lease.owner) ?? 0) + 1);
    return { resourceGeneration: r.generation, leaseCount: r.leases.size, ownerLeaseCounts: Object.fromEntries(owners),
      cpuState: r.cpuState, cpuData: r.cpuData, gpuState: r.gpuState,
      resident: !this.deviceLost && r.gpuState === 'resident' && r.residentEpoch === this.deviceEpoch,
      decodeTaskId: r.decodeTask?.taskId ?? null, uploadTaskId: r.uploadTask?.taskId ?? null,
      deviceEpoch: this.deviceEpoch, deviceLost: this.deviceLost, residentEpoch: r.residentEpoch,
      lastUse: r.lastUse, completedFrame: this.completedFrame, error: r.error ? { ...r.error } : null };
  }
}
