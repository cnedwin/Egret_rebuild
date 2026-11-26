// SPDX-License-Identifier: Apache-2.0
// Offline conversion to the migration module's own region-skeleton format. No DragonBones runtime is required.
// Format semantics reference: DragonBonesJS ObjectDataParser, Transform and Slot (MIT), not copied implementation.
// https://github.com/DragonBones/DragonBonesJS/tree/master/DragonBones/src/dragonBones

const MAX_BONES = 256;
const MAX_SLOTS = 256;
const MAX_KEYS = 65536;
const MAX_DURATION = 36000;

function failure(path, reason) {
  throw Object.assign(new Error(path + ': ' + reason), {
    code: 'MIGRATE_DRAGONBONES_UNSUPPORTED',
    details: { path, reason }
  });
}

function record(value, path, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) failure(path, 'expected an object');
  if (keys)
    for (const key of Object.keys(value)) if (!keys.includes(key)) failure(path + '.' + key, 'unsupported field');
  return value;
}

function list(value, path, limit) {
  if (!Array.isArray(value) || value.length > limit) failure(path, 'expected a bounded array');
  return value;
}

function name(value, path) {
  if (typeof value !== 'string' || !value || value.length > 255 || /[\u0000-\u001f]/.test(value))
    failure(path, 'expected a nonempty name with no control characters');
  return value;
}

function number(value, path, min = -1000000, max = 1000000) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max)
    failure(path, 'expected a finite number within the admitted range');
  return value;
}

function integer(value, path, min, max) {
  if (!Number.isInteger(number(value, path, min, max))) failure(path, 'expected an integer');
  return value;
}

function empty(value, path) {
  if (value !== undefined && (!Array.isArray(value) || value.length > 0))
    failure(path, 'feature is outside the region profile');
}

function indexByName(values, path) {
  const result = new Map();
  for (const value of values) {
    if (result.has(value.name)) failure(path, 'duplicate name ' + value.name);
    result.set(value.name, value);
  }
  return result;
}

function transform(raw, path) {
  const value = record(raw ?? {}, path, ['x', 'y', 'rotate', 'skew', 'skX', 'skY', 'scX', 'scY']);
  const modern = value.rotate !== undefined || value.skew !== undefined;
  if (modern && (value.skX !== undefined || value.skY !== undefined)) failure(path, 'mixed angle conventions');
  const rotation = number((modern ? value.rotate : value.skY) ?? 0, path + '.rotation');
  const skew = modern ? number(value.skew ?? 0, path + '.skew') : number(value.skX ?? 0, path + '.skX') - rotation;
  return [
    number(value.x ?? 0, path + '.x'),
    number(value.y ?? 0, path + '.y'),
    rotation,
    skew,
    number(value.scX ?? 1, path + '.scX', -100, 100),
    number(value.scY ?? 1, path + '.scY', -100, 100)
  ];
}

function colorAlpha(raw, path) {
  const value = record(raw ?? {}, path, ['aM', 'rM', 'gM', 'bM', 'aO', 'rO', 'gO', 'bO']);
  for (const key of ['rM', 'gM', 'bM']) if ((value[key] ?? 100) !== 100) failure(path, 'RGB tint is unsupported');
  for (const key of ['aO', 'rO', 'gO', 'bO']) if ((value[key] ?? 0) !== 0) failure(path, 'color offset is unsupported');
  return number(value.aM ?? 100, path + '.aM', 0, 100) / 100;
}

function convertAtlas(raw) {
  const path = 'atlas';
  const atlas = record(raw, path, ['name', 'width', 'height', 'imagePath', 'scale', 'SubTexture']);
  if ((atlas.scale ?? 1) !== 1) failure(path + '.scale', 'only pixel-scale atlases are admitted');
  const width = integer(atlas.width, path + '.width', 1, 8192);
  const height = integer(atlas.height, path + '.height', 1, 8192);
  const regions = list(atlas.SubTexture, path + '.SubTexture', 2048).map((raw, i) => {
    const key = path + '.SubTexture[' + i + ']';
    const region = record(raw, key, [
      'name',
      'x',
      'y',
      'width',
      'height',
      'frameX',
      'frameY',
      'frameWidth',
      'frameHeight',
      'rotated'
    ]);
    if (region.rotated !== undefined && region.rotated !== false)
      failure(key, 'rotated atlas regions require an Agent conversion');
    const x = integer(region.x, key + '.x', 0, width - 1);
    const y = integer(region.y, key + '.y', 0, height - 1);
    const w = integer(region.width, key + '.width', 1, width - x);
    const h = integer(region.height, key + '.height', 1, height - y);
    const frameWidth = integer(region.frameWidth ?? w, key + '.frameWidth', w, 8192);
    const frameHeight = integer(region.frameHeight ?? h, key + '.frameHeight', h, 8192);
    return {
      name: name(region.name, key + '.name'),
      rect: { x, y, width: w, height: h },
      frameWidth,
      frameHeight,
      frameX: integer(region.frameX ?? 0, key + '.frameX', w - frameWidth, 0),
      frameY: integer(region.frameY ?? 0, key + '.frameY', h - frameHeight, 0)
    };
  });
  indexByName(regions, path + '.SubTexture');
  return { name: name(atlas.name, path + '.name'), width, height, regions };
}

function convertBones(raw, path) {
  const bones = list(raw, path, MAX_BONES).map((raw, i) => {
    const key = path + '[' + i + ']';
    const bone = record(raw, key, [
      'name',
      'parent',
      'type',
      'length',
      'transform',
      'alpha',
      'inheritTranslation',
      'inheritRotation',
      'inheritScale',
      'inheritReflection'
    ]);
    if (![undefined, 0, 'bone', 'Bone'].includes(bone.type)) failure(key + '.type', 'expected a rigid bone');
    for (const field of ['inheritTranslation', 'inheritRotation', 'inheritScale', 'inheritReflection'])
      if (bone[field] !== undefined && bone[field] !== true) failure(key + '.' + field, 'nonstandard inheritance');
    return {
      name: name(bone.name, key + '.name'),
      parentName: bone.parent === undefined || bone.parent === '' ? null : name(bone.parent, key + '.parent'),
      bind: transform(bone.transform, key + '.transform'),
      alpha: number(bone.alpha ?? 1, key + '.alpha', 0, 1)
    };
  });
  if (!bones.length) failure(path, 'an armature needs bones');
  const byName = indexByName(bones, path);
  const sorted = [];
  const indices = new Map();
  const active = new Set();
  function add(bone) {
    if (indices.has(bone.name)) return;
    if (active.has(bone.name)) failure(path, 'cyclic bone ancestry');
    active.add(bone.name);
    if (bone.parentName !== null) {
      const parent = byName.get(bone.parentName);
      if (!parent) failure(path, 'missing parent ' + bone.parentName);
      add(parent);
    }
    indices.set(bone.name, sorted.length);
    const { parentName, ...value } = bone;
    sorted.push({ ...value, parent: parentName === null ? -1 : indices.get(parentName) });
    active.delete(bone.name);
  }
  for (const bone of bones) add(bone);
  return { bones: sorted, indices };
}

function convertSlots(armature, path, indices, regions) {
  const skins = list(armature.skin, path + '.skin', 1);
  if (skins.length !== 1) failure(path + '.skin', 'expected one default skin');
  const skin = record(skins[0], path + '.skin[0]', ['name', 'slot']);
  if (![undefined, '', 'default'].includes(skin.name)) failure(path + '.skin[0]', 'unsupported named skin');
  const skinSlots = list(skin.slot, path + '.skin[0].slot', MAX_SLOTS).map((value, i) => {
    const slot = record(value, path + '.skin[0].slot[' + i + ']', ['name', 'display']);
    return { name: name(slot.name, path + '.skin.slot.name'), display: slot.display };
  });
  const displays = indexByName(skinSlots, path + '.skin.slot');
  const slots = list(armature.slot, path + '.slot', MAX_SLOTS).map((raw, i) => {
    const key = path + '.slot[' + i + ']';
    const slot = record(raw, key, [
      'name',
      'parent',
      'displayIndex',
      'color',
      'blendMode',
      'alpha',
      'zIndex',
      'z',
      'actions'
    ]);
    empty(slot.actions, key + '.actions');
    // Older 5.0 exports may repeat the authored slot order as static zero-based z values.
    if (
      ![undefined, 0, 'normal'].includes(slot.blendMode) ||
      (slot.zIndex ?? 0) !== 0 ||
      (slot.z !== undefined && slot.z !== i)
    )
      failure(key, 'nonstandard blending or sort order');
    const slotName = name(slot.name, key + '.name');
    const bone = indices.get(slot.parent);
    if (bone === undefined) failure(key, 'unknown parent bone');
    const attachments = list(displays.get(slotName)?.display ?? [], key + '.attachments', 128).map((raw, d) => {
      if (raw === null) return null;
      const displayPath = key + '.attachments[' + d + ']';
      const display = record(raw, displayPath, ['name', 'path', 'type', 'transform', 'pivot']);
      if (![undefined, 0, 'image'].includes(display.type))
        failure(displayPath, 'only image-region attachments are admitted');
      const region = regions.get(display.path || display.name);
      if (!region) failure(displayPath, 'missing atlas region');
      const pivot = record(display.pivot ?? {}, displayPath + '.pivot', ['x', 'y']);
      const defaultPivot = display.pivot === undefined ? 0.5 : 0;
      return {
        name: name(display.name, displayPath + '.name'),
        rect: region.rect,
        bind: transform(display.transform, displayPath + '.transform'),
        anchor: [
          number(pivot.x ?? defaultPivot, displayPath + '.pivot.x', -10, 10) * region.frameWidth + region.frameX,
          number(pivot.y ?? defaultPivot, displayPath + '.pivot.y', -10, 10) * region.frameHeight + region.frameY
        ]
      };
    });
    displays.delete(slotName);
    return {
      name: slotName,
      bone,
      alpha: number(slot.alpha ?? 1, key + '.alpha', 0, 1),
      colorAlpha: colorAlpha(slot.color, key + '.color'),
      displayIndex: integer(
        slot.displayIndex ?? (attachments.length ? 0 : -1),
        key + '.displayIndex',
        -1,
        attachments.length - 1
      ),
      attachments
    };
  });
  if (displays.size) failure(path + '.skin.slot', 'skin refers to an unknown slot');
  indexByName(slots, path + '.slot');
  return slots;
}

function interpolation(raw, path) {
  if (raw.curve !== undefined) failure(path + '.curve', 'Bezier easing requires Agent conversion');
  if ((raw.tweenRotate !== undefined && raw.tweenRotate !== 0) || (raw.clockwise !== undefined && raw.clockwise !== 0))
    failure(path, 'explicit extra rotations are unsupported');
  const easing = raw.tweenEasing ?? -2;
  if (easing === 0) return 'linear';
  if (easing === -2) return 'step';
  failure(path + '.tweenEasing', 'only linear and stepped keys are admitted');
}

function timeline(raw, path, duration, budget, keys, valueOf, stepped = false) {
  let start = 0;
  const frames = list(raw, path, Math.min(duration + 1, MAX_KEYS));
  if (!frames.length) failure(path, 'empty timeline');
  budget.count += frames.length;
  if (budget.count > MAX_KEYS) failure(path, 'skeleton keyframe budget exceeded');
  return frames.map((raw, i) => {
    const key = path + '[' + i + ']';
    const frame = record(raw, key, ['duration', 'tweenEasing', 'curve', 'tweenRotate', 'clockwise', ...keys]);
    if (start > duration) failure(key, 'key lies after the clip');
    const mode = interpolation(frame, key);
    const result = { frame: start, mode: stepped ? 'step' : mode, value: valueOf(frame, key) };
    const remaining = duration - start;
    const last = i === frames.length - 1;
    const count = integer(frame.duration ?? 1, key + '.duration', last ? 0 : 1, MAX_DURATION);
    // The final key covers the balance of the clip regardless of its declared length in a 5.x export.
    if (!last && count > remaining) failure(key, 'key lies after the clip');
    start += last ? remaining : count;
    return result;
  });
}

function clipOf(raw, path, indices, slots, budget) {
  const clip = record(raw, path, [
    'name',
    'duration',
    'playTimes',
    'bone',
    'slot',
    'frame',
    'zOrder',
    'ffd',
    'ik',
    'deform',
    'scale',
    'fadeInTime'
  ]);
  for (const key of ['frame', 'ffd', 'ik', 'deform']) empty(clip[key], path + '.' + key);
  if (clip.zOrder !== undefined && JSON.stringify(clip.zOrder) !== JSON.stringify({ frame: [] }))
    failure(path + '.zOrder', 'animated slot order is unsupported');
  if ((clip.scale ?? 1) !== 1 || (clip.fadeInTime ?? 0) !== 0)
    failure(path, 'clip time scaling or automatic fade is unsupported');
  const duration = integer(clip.duration, path + '.duration', 1, MAX_DURATION);
  const boneTracks = [];
  const usedBones = new Set();
  for (const raw of list(clip.bone ?? [], path + '.bone', MAX_BONES)) {
    const track = record(raw, path + '.bone', [
      'name',
      'frame',
      'translateFrame',
      'rotateFrame',
      'scaleFrame',
      'scale',
      'offset'
    ]);
    const bone = indices.get(track.name);
    if (bone === undefined || usedBones.has(bone)) failure(path + '.bone', 'unknown or duplicate bone track');
    usedBones.add(bone);
    const key = path + '.bone.' + track.name;
    if ((track.scale ?? 1) !== 1 || (track.offset ?? 0) !== 0) failure(key, 'nonstandard timeline timing');
    const result = { bone };
    if (track.frame !== undefined) {
      if (track.translateFrame !== undefined || track.rotateFrame !== undefined || track.scaleFrame !== undefined)
        failure(key, 'mixed combined and separate transform timelines');
      result.all = timeline(track.frame, key + '.frame', duration, budget, ['transform'], (value, k) =>
        transform(value.transform, k)
      );
    }
    if (track.translateFrame !== undefined)
      result.translate = timeline(
        track.translateFrame,
        key + '.translateFrame',
        duration,
        budget,
        ['x', 'y'],
        (value, k) => [number(value.x ?? 0, k + '.x'), number(value.y ?? 0, k + '.y')]
      );
    if (track.rotateFrame !== undefined)
      result.rotate = timeline(
        track.rotateFrame,
        key + '.rotateFrame',
        duration,
        budget,
        ['rotate', 'skew'],
        (value, k) => [number(value.rotate ?? 0, k + '.rotate'), number(value.skew ?? 0, k + '.skew')]
      );
    if (track.scaleFrame !== undefined)
      result.scale = timeline(track.scaleFrame, key + '.scaleFrame', duration, budget, ['x', 'y'], (value, k) => [
        number(value.x ?? 1, k + '.x', -100, 100),
        number(value.y ?? 1, k + '.y', -100, 100)
      ]);
    if (Object.keys(result).length === 1) failure(key, 'missing transform keys');
    boneTracks.push(result);
  }
  const slotTracks = [];
  const usedSlots = new Set();
  for (const raw of list(clip.slot ?? [], path + '.slot', MAX_SLOTS)) {
    const track = record(raw, path + '.slot', ['name', 'frame', 'displayFrame', 'colorFrame', 'scale', 'offset']);
    const slot = slots.findIndex(slot => slot.name === track.name);
    if (slot < 0 || usedSlots.has(slot)) failure(path + '.slot', 'unknown or duplicate slot track');
    usedSlots.add(slot);
    const key = path + '.slot.' + track.name;
    if ((track.scale ?? 1) !== 1 || (track.offset ?? 0) !== 0) failure(key, 'nonstandard timeline timing');
    const index = (value, k) => [
      integer(value.value ?? value.displayIndex ?? 0, k + '.displayIndex', -1, slots[slot].attachments.length - 1)
    ];
    const alpha = (value, k) => [colorAlpha(value.value ?? value.color, k + '.color')];
    const result = { slot };
    if (track.frame !== undefined) {
      if (track.displayFrame !== undefined || track.colorFrame !== undefined) failure(key, 'mixed slot timelines');
      result.display = timeline(track.frame, key + '.frame', duration, budget, ['displayIndex', 'color'], index, true);
      result.alpha = timeline(track.frame, key + '.frame', duration, budget, ['displayIndex', 'color'], alpha);
    }
    if (track.displayFrame !== undefined)
      result.display = timeline(
        track.displayFrame,
        key + '.displayFrame',
        duration,
        budget,
        ['value', 'displayIndex'],
        index,
        true
      );
    if (track.colorFrame !== undefined)
      result.alpha = timeline(track.colorFrame, key + '.colorFrame', duration, budget, ['value', 'color'], alpha);
    if (Object.keys(result).length === 1) failure(key, 'missing slot keys');
    slotTracks.push(result);
  }
  return {
    name: name(clip.name, path + '.name'),
    duration,
    playTimes: integer(clip.playTimes ?? 1, path + '.playTimes', 0, 10000),
    boneTracks,
    slotTracks
  };
}

/** Convert bounded DragonBones 5.x JSON + one nonrotated atlas to editable Egret 7 region-skeleton data. */
export function convertDragonBones(skeleton, textureAtlas) {
  const raw = record(skeleton, 'skeleton', [
    'name',
    'version',
    'compatibleVersion',
    'frameRate',
    'armature',
    'isGlobal'
  ]);
  if (!/^5\.[0-9]+(?:\.[0-9]+)?$/.test(raw.version ?? '') || ![undefined, false, 0].includes(raw.isGlobal))
    failure('skeleton.version', 'expected a local-transform DragonBones 5.x export');
  if (raw.compatibleVersion !== undefined && !/^5\.[0-9]+(?:\.[0-9]+)?$/.test(raw.compatibleVersion))
    failure('skeleton.compatibleVersion', 'unsupported compatible version');
  const atlas = convertAtlas(textureAtlas);
  const regions = indexByName(atlas.regions, 'atlas.regions');
  const budget = { count: 0 };
  const armatures = list(raw.armature, 'skeleton.armature', 32).map((value, i) => {
    const path = 'skeleton.armature[' + i + ']';
    const armature = record(value, path, [
      'name',
      'type',
      'frameRate',
      'aabb',
      'bone',
      'slot',
      'skin',
      'animation',
      'ik',
      'path',
      'defaultActions',
      'actions',
      'scale'
    ]);
    if (![undefined, 0, 'Armature', 'armature'].includes(armature.type) || (armature.scale ?? 1) !== 1)
      failure(path, 'expected an ordinary armature at unit scale');
    for (const field of ['ik', 'path', 'actions']) empty(armature[field], path + '.' + field);
    const { bones, indices } = convertBones(armature.bone, path + '.bone');
    const slots = convertSlots(armature, path, indices, regions);
    const clips = list(armature.animation ?? [], path + '.animation', 128).map((value, i) =>
      clipOf(value, path + '.animation[' + i + ']', indices, slots, budget)
    );
    const byClip = indexByName(clips, path + '.animation');
    let defaultClip = null;
    if (armature.defaultActions !== undefined) {
      const actions = list(armature.defaultActions, path + '.defaultActions', 1);
      if (actions.length) {
        const action = record(actions[0], path + '.defaultActions[0]', ['gotoAndPlay']);
        defaultClip = name(action.gotoAndPlay, path + '.defaultActions[0].gotoAndPlay');
        if (!byClip.has(defaultClip)) failure(path + '.defaultActions', 'unknown default clip');
      }
    }
    return {
      name: name(armature.name, path + '.name'),
      frameRate: integer(armature.frameRate ?? raw.frameRate ?? 24, path + '.frameRate', 1, 240),
      bones,
      slots,
      clips,
      defaultClip
    };
  });
  if (!armatures.length) failure('skeleton.armature', 'missing armature');
  indexByName(armatures, 'skeleton.armature');
  const descriptor = {
    schema: 'egret.migrate-bones/1',
    schemaVersion: 1,
    name: name(raw.name, 'skeleton.name'),
    sourceVersion: raw.version,
    atlas,
    armatures
  };
  if (JSON.stringify(descriptor).length > 8388608) failure('skeleton', 'native descriptor exceeds byte budget');
  return descriptor;
}
