// SPDX-License-Identifier: Apache-2.0
// First-party admission only. Official Core continues to own format semantics.
import { spineFault } from './catalog.js';

type RecordValue = Record<string, unknown>;
const MAX_CELLS = 2097152;

/** Refuse allocation-driving counts and non-progressing draw-order inputs before Core. */
export function readSpineJson(text: string, id: string, allowPrerelease: boolean): object {
  const fault = (stage: string): never => { throw spineFault('JSON_' + stage, id); };
  const record = (value: unknown): RecordValue => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return fault('SHAPE');
    return value as RecordValue;
  };
  const list = (value: unknown, max = 65536): unknown[] => {
    if (!Array.isArray(value) || value.length > max) return fault('LIMIT');
    return value;
  };
  const count = (value: unknown, max: number): number => {
    if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0 || value > max) return fault('LIMIT');
    return value;
  };
  let nodes = 0, cells = 0;
  function charge(amount: number): void {
    if (!Number.isSafeInteger(amount) || amount < 0 || cells + amount > MAX_CELLS) fault('LIMIT');
    cells += amount;
  }
  function visit(value: unknown, depth: number): void {
    if (++nodes > 262144 || depth > 64) fault('LIMIT');
    if (typeof value === 'number' && !Number.isFinite(value)) fault('SHAPE');
    if (Array.isArray(value)) { list(value); charge(value.length); }
    if (value && typeof value === 'object') for (const child of Object.values(value)) visit(child, depth + 1);
  }
  const decoded: unknown = JSON.parse(text); visit(decoded, 0);
  const root = record(decoded), header = record(root.skeleton), version = header.spine;
  if (typeof version !== 'string' || !/^4\.3\.\d+(?:-beta)?$/.test(version) || !allowPrerelease && version.endsWith('-beta')) throw spineFault('EXPORT_VERSION', id);
  const bones = list(root.bones ?? [], 1024), slots = list(root.slots ?? [], 2048), skins = list(root.skins ?? [], 128);
  function names(values: unknown[]): string[] {
    const result = values.map(value => record(value).name);
    if (result.some(name => typeof name !== 'string' || !name) || new Set(result).size !== result.length) return fault('SHAPE');
    return result as string[];
  }
  names(bones); const slotNames = names(slots);
  for (const constraint of list(root.constraints ?? [], 4096)) {
    const value = record(constraint); if (value.bones !== undefined) list(value.bones, bones.length);
  }
  let maxCoordinates = 8, sequences = 0, linked = 0;
  for (const skin of skins) {
    const value = record(skin);
    for (const key of ['bones', 'ik', 'transform', 'path', 'physics', 'slider']) if (value[key] !== undefined) list(value[key], 4096);
    for (const slot of Object.values(record(value.attachments ?? {}))) for (const raw of Object.values(record(slot))) {
      const attachment = record(raw), type = attachment.type ?? 'region', mesh = type === 'mesh' || type === 'linkedmesh';
      if (mesh && attachment.source != null && typeof attachment.source !== 'string') fault('SHAPE');
      const inherited = mesh && typeof attachment.source === 'string' && attachment.source.length > 0;
      let coordinates = 0;
      if (inherited) linked++;
      else if (mesh) coordinates = list(attachment.uvs).length;
      else if (['boundingbox', 'path', 'clipping'].includes(String(type))) coordinates = count(attachment.vertexCount, 32768) * 2;
      if (coordinates || mesh && !inherited || ['boundingbox', 'path', 'clipping'].includes(String(type))) {
        if (coordinates % 2) fault('SHAPE');
        const vertices = list(attachment.vertices), numeric = (v: unknown): boolean => typeof v === 'number' && Number.isFinite(v);
        if (!vertices.every(numeric)) fault('SHAPE');
        if (vertices.length !== coordinates) {
          let cursor = 0, groups = 0;
          while (cursor < vertices.length) {
            const weights = count(vertices[cursor++], bones.length);
            if (!weights || cursor + weights * 4 > vertices.length) fault('SHAPE');
            for (let i = 0; i < weights; i++, cursor += 4) count(vertices[cursor], Math.max(0, bones.length - 1));
            groups++;
          }
          if (groups * 2 !== coordinates) fault('SHAPE');
          charge(vertices.length * 2);
        }
        charge(coordinates * 2); maxCoordinates = Math.max(maxCoordinates, coordinates, vertices.length * 2);
      }
      if (mesh && !inherited) { list(attachment.triangles); list(attachment.uvs); }
      if (type === 'path') { list(attachment.lengths); if (count(attachment.vertexCount, 32768) % 3) fault('SHAPE'); charge(attachment.vertexCount as number); }
      if (type === 'region' || mesh) {
        const sequence = attachment.sequence == null ? undefined : record(attachment.sequence);
        const length = sequence ? count(sequence.count ?? 0, 4096) : 1;
        if (sequence) { count(sequence.digits ?? 0, 8); count(sequence.start ?? 1, 2147483647); count(sequence.setup ?? 0, Math.max(0, length - 1)); }
        sequences += length;
      }
    }
  }
  // The largest source also bounds linked-mesh UVs. Cross-slot timeline sharing
  // and every sequence's UV/offset storage are charged cumulatively.
  charge(sequences * (maxCoordinates * 2 + 32)); charge(linked * slots.length);
  function frames(value: unknown, kind = ''): unknown[] {
    const values = list(value); charge(values.length * 256);
    for (const raw of values) {
      const frame = record(raw);
      if (kind === 'deform') {
        charge(maxCoordinates * 2);
        if (frame.vertices !== undefined) { const vertices = list(frame.vertices); const offset = count(frame.offset ?? 0, maxCoordinates); if (offset + vertices.length > maxCoordinates) fault('SHAPE'); }
      }
    }
    return values;
  }
  function nested(value: unknown, levels: number): void {
    for (const [key, child] of Object.entries(record(value))) {
      if (levels === 1) frames(child, key); else nested(child, levels - 1);
    }
  }
  function drawOrder(value: unknown, domain: string[]): void {
    for (const raw of frames(value)) {
      const changes = record(raw).offsets;
      charge(domain.length * 2);
      if (changes === undefined) continue;
      const offsets = list(changes, domain.length), targets = new Set<number>(); let previous = -1;
      for (const rawOffset of offsets) {
        const offset = record(rawOffset), index = domain.indexOf(offset.slot as string), delta = offset.offset;
        if (index <= previous || typeof delta !== 'number' || !Number.isSafeInteger(delta)) fault('DRAW_ORDER');
        const target = index + (delta as number);
        if (target < 0 || target >= domain.length || targets.has(target)) fault('DRAW_ORDER');
        previous = index; targets.add(target);
      }
    }
  }
  const animations = record(root.animations ?? {});
  if (Object.keys(animations).length > 1024) fault('LIMIT');
  for (const raw of Object.values(animations)) {
    const animation = record(raw);
    for (const key of ['slots', 'bones', 'path', 'physics', 'slider']) if (animation[key] !== undefined) nested(animation[key], 2);
    for (const key of ['ik', 'transform']) if (animation[key] !== undefined) nested(animation[key], 1);
    if (animation.attachments !== undefined) nested(animation.attachments, 4);
    if (animation.events !== undefined) frames(animation.events);
    if (animation.drawOrder !== undefined) drawOrder(animation.drawOrder, slotNames);
    if (animation.drawOrderFolder !== undefined) for (const rawFolder of list(animation.drawOrderFolder)) {
      const folder = record(rawFolder), members = list(folder.slots ?? [], slots.length), domain: string[] = []; let previous = -1;
      for (const member of members) { const index = slotNames.indexOf(member as string); if (index <= previous) fault('DRAW_ORDER'); previous = index; domain.push(member as string); }
      charge(slots.length + members.length * 2); drawOrder(folder.keys ?? [], domain);
    }
  }
  return root;
}
