// RED fixture: the former graphics-only design cannot promise event recovery.
export class LegacyGraphicsMirror {
  constructor() { this.epoch = 1; this.next = 1; this.effects = []; }
  receive(packet) {
    if (packet.epoch !== this.epoch || packet.sequence !== this.next) return false;
    this.effects.push(...packet.events);
    this.next++;
    return true;
  }
  restore(snapshot) { this.epoch = snapshot.epoch; this.next = snapshot.next; }
}

// Research model only: synchronous in-memory side effect and consumption commit.
// Graphics epoch is deliberately absent from the reliable event identity.
export class ReliableEventProbe {
  constructor({ capacity = 3, producerSession = 'p1', streamId = 'audio', consumerSession = 'c1' } = {}) {
    if (!Number.isSafeInteger(capacity) || capacity < 1) throw new RangeError('capacity must be a positive safe integer');
    for (const id of [producerSession, streamId, consumerSession]) {
      if (typeof id !== 'string' || !/^[A-Za-z0-9_-]+$/.test(id)) throw new TypeError('identity must be an unambiguous nonempty token');
    }
    Object.assign(this, { capacity, producerSession, streamId, consumerSession });
    this.sequence = 0; this.outbox = []; this.effects = []; this.watermark = 0; this.graphicsEpoch = 1;
    this.sent = new Set(); this.confirmed = 0;
  }
  append(effect) {
    if (typeof effect !== 'string' || !effect.length) throw new TypeError('effect must be a nonempty string');
    if (this.outbox.length >= this.capacity) return null;
    const event = { version: 1, producerSession: this.producerSession, streamId: this.streamId,
      consumerSession: this.consumerSession, sequence: ++this.sequence,
      eventID: `${this.producerSession}/${this.streamId}/${this.sequence}`, effect };
    this.outbox.push(event); return structuredClone(event);
  }
  pending() {
    for (const event of this.outbox) this.sent.add(event.sequence);
    return structuredClone(this.outbox);
  }
  sameIdentity(envelope) {
    return envelope && envelope.version === 1 && envelope.producerSession === this.producerSession
      && envelope.streamId === this.streamId && envelope.consumerSession === this.consumerSession;
  }
  id(sequence) { return `${this.producerSession}/${this.streamId}/${sequence}`; }
  ack() {
    return { version: 1, producerSession: this.producerSession, streamId: this.streamId,
      consumerSession: this.consumerSession, watermark: this.watermark, eventID: this.id(this.watermark) };
  }
  receive(event) {
    if (!this.sameIdentity(event) || !Number.isSafeInteger(event.sequence) || event.sequence < 1
      || event.eventID !== this.id(event.sequence) || typeof event.effect !== 'string' || !event.effect.length) {
      return { status: 'invalid' };
    }
    if (event.sequence <= this.watermark) return { status: 'duplicate', ack: this.ack() };
    if (event.sequence !== this.watermark + 1) return { status: 'gap', expected: this.watermark + 1 };
    this.effects.push(event.effect);
    this.watermark = event.sequence;
    return { status: 'consumed', ack: this.ack() };
  }
  acknowledge(ack) {
    if (!this.sameIdentity(ack) || !Number.isSafeInteger(ack.watermark) || ack.watermark < 1
      || ack.watermark > this.sequence || ack.eventID !== this.id(ack.watermark)) return false;
    if (ack.watermark <= this.confirmed) return true;
    // Cumulative confirmation may only retire events actually handed to transport.
    for (let sequence = this.confirmed + 1; sequence <= ack.watermark; sequence++) {
      if (!this.sent.has(sequence)) return false;
    }
    this.outbox = this.outbox.filter(event => event.sequence > ack.watermark);
    for (const sequence of this.sent) if (sequence <= ack.watermark) this.sent.delete(sequence);
    this.confirmed = ack.watermark;
    return true;
  }
  restoreGraphics(epoch) { this.graphicsEpoch = epoch; }
}
