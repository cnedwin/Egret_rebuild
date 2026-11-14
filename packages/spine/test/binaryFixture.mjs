// SPDX-License-Identifier: Apache-2.0
// Original programmatic data: the fixture skeleton written in Spine's binary export form, field by field in the order
// Core 4.3.13's reader takes them. Not an Editor export; it covers bones, slots, a default skin of region attachments and
// bone rotation timelines, which is what the fixtures use.
const BLEND = { normal: 0, additive: 1, multiply: 2, screen: 3 };
const CURVE = { linear: 0, stepped: 1 };

class Writer {
  constructor() { this.bytes = []; this.strings = []; }
  byte(v) { this.bytes.push(v & 255); }
  bool(v) { this.byte(v ? 1 : 0); }
  int32(v) { this.bytes.push((v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255); }
  float(v) { const view = new DataView(new ArrayBuffer(4)); view.setFloat32(0, v); this.bytes.push(...new Uint8Array(view.buffer)); }
  /** A positive variable-length integer: seven bits a byte, low bits first. */
  varint(v) { if (!Number.isSafeInteger(v) || v < 0 || v > 0x7fffffff) throw new RangeError('varint ' + v); do { let b = v & 0x7f; v >>>= 7; if (v) b |= 0x80; this.byte(b); } while (v); }
  /** Length plus one, then the characters; null is 0. ASCII only here. */
  string(s) { if (s === null || s === undefined) { this.varint(0); return; } if (/[^\x00-\x7f]/.test(s)) throw new RangeError('ASCII only'); this.varint(s.length + 1); for (const c of s) this.byte(c.charCodeAt(0)); }
  /** An index into the string table plus one; null is 0. */
  ref(s) { if (s === null || s === undefined) { this.varint(0); return; } let i = this.strings.indexOf(s); if (i < 0) throw new Error('string not in table: ' + s); this.varint(i + 1); }
}

/** Writes the fixture skeleton `json` (the shape of fixtures.source) as a binary skeleton. */
export function encodeSkeleton(json, { version = json.skeleton.spine, bezierCount = 0, corrupt } = {}) {
  const bones = json.bones, slots = json.slots, skin = json.skins?.find(s => s.name === 'default'), animations = Object.entries(json.animations ?? {});
  const boneIndex = name => { const i = bones.findIndex(b => b.name === name); if (i < 0) throw new Error('bone ' + name); return i; };
  const slotIndex = name => { const i = slots.findIndex(s => s.name === name); if (i < 0) throw new Error('slot ' + name); return i; };
  // The string table: every attachment name and slot attachment, once.
  const table = [];
  const keep = s => { if (s !== undefined && s !== null && !table.includes(s)) table.push(s); };
  for (const slot of slots) keep(slot.attachment);
  for (const [, attachments] of Object.entries(skin?.attachments ?? {})) for (const name of Object.keys(attachments)) keep(name);
  const w = new Writer(); w.strings = table;
  w.int32(0); w.int32(0);                       // no hash
  w.string(version);
  for (const v of [0, 0, 0, 0]) w.float(v);     // x, y, width, height
  w.float(100);                                 // reference scale
  w.bool(false);                                // no nonessential data
  w.varint(table.length); for (const s of table) w.string(s);
  w.varint(bones.length);
  bones.forEach((b, i) => {
    w.string(b.name);
    if (i > 0) w.varint(boneIndex(b.parent));
    for (const v of [b.rotation ?? 0, b.x ?? 0, b.y ?? 0, b.scaleX ?? 1, b.scaleY ?? 1, b.shearX ?? 0, b.shearY ?? 0]) w.float(v);
    w.byte(0);                                  // inherit: normal
    w.float(b.length ?? 0);
    w.bool(false);                              // not skin required
  });
  w.varint(slots.length);
  for (const s of slots) {
    w.string(s.name); w.varint(boneIndex(s.bone));
    w.int32(-1);                                // white, opaque
    w.int32(-1);                                // no dark colour
    w.ref(s.attachment ?? null);
    w.varint(BLEND[s.blend ?? 'normal']);
  }
  w.varint(0);                                  // no constraints
  const entries = Object.entries(skin?.attachments ?? {});
  w.varint(entries.length);                     // the default skin's slots
  for (const [slot, attachments] of entries) {
    w.varint(slotIndex(slot)); w.varint(Object.keys(attachments).length);
    for (const [name, a] of Object.entries(attachments)) {
      w.ref(name);
      w.byte(0);                                // a region attachment, named as its placeholder, path its name
      for (const v of [a.x ?? 0, a.y ?? 0, a.scaleX ?? 1, a.scaleY ?? 1, a.width, a.height]) w.float(v);
    }
  }
  w.varint(0);                                  // no other skins
  w.varint(0);                                  // no events
  w.varint(animations.length);
  for (const [name, animation] of animations) {
    w.string(name);
    const rotations = Object.entries(animation.bones ?? {}).filter(([, t]) => t.rotate);
    w.varint(rotations.length);                 // the number of timelines
    w.varint(0);                                // slot timelines
    w.varint(rotations.length);                 // bone timelines
    for (const [bone, timelines] of rotations) {
      w.varint(boneIndex(bone)); w.varint(1);
      const frames = timelines.rotate;
      w.byte(0); w.varint(frames.length); w.varint(bezierCount); // rotate, its frames, and how many Bézier curves it has (none here)
      // The first frame's time and value, then for each next frame its time, its value and the curve that leads to it.
      w.float(frames[0].time ?? 0); w.float(frames[0].value ?? 0);
      for (let i = 1; i < frames.length; i++) { w.float(frames[i].time ?? 0); w.float(frames[i].value ?? 0); w.byte(CURVE[frames[i - 1].curve ?? 'linear']); }
    }
    for (let k = 0; k < 6; k++) w.varint(0);    // IK, transform, path, physics, slider and attachment timelines
    w.varint(0);                                // no draw order keys
    w.varint(0);                                // no draw order folders
    w.varint(0);                                // no events
  }
  const bytes = Uint8Array.from(w.bytes);
  if (corrupt) corrupt(bytes);
  return bytes;
}
