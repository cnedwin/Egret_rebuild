// SPDX-License-Identifier: Apache-2.0
// Native region-skeleton playback. The offline migrator owns conversion from the old export.
const identity = [1, 0, 0, 1, 0, 0];
const neutral = [0, 0, 0, 0, 1, 1];
const radians = Math.PI / 180;

function refuse(message) {
  throw Object.assign(new Error(message), { code: 'LEGACY_BONES_UNSUPPORTED' });
}

function validateDescriptor(source) {
  if (source?.schema !== 'egret.migrate-bones/1' || source.schemaVersion !== 1)
    refuse('Supply a converted native bone descriptor, not raw DragonBones data.');
  // RES metadata is editable. Copy it so a game cannot subsequently mutate a registered skeleton.
  let data;
  try {
    const text = JSON.stringify(source);
    if (text.length > 8388608) refuse('Bone descriptor exceeds its size limit.');
    data = JSON.parse(text);
  } catch (cause) {
    if (cause?.code === 'LEGACY_BONES_UNSUPPORTED') throw cause;
    refuse('Invalid native bone descriptor.');
  }
  const finite = (value, min, max) => Number.isFinite(value) && value >= min && value <= max;
  const whole = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;
  const array = (value, max) => Array.isArray(value) && value.length <= max;
  const vector = (value, size) =>
    array(value, size) && value.length === size && value.every(n => finite(n, -2000000, 2000000));
  const named = value => typeof value?.name === 'string' && value.name.length > 0 && value.name.length <= 255;
  const unique = values => values.every(named) && new Set(values.map(value => value.name)).size === values.length;
  const atlas = data.atlas;
  if (
    !named(data) ||
    !named(atlas) ||
    !whole(atlas.width, 1, 8192) ||
    !whole(atlas.height, 1, 8192) ||
    !array(atlas.regions, 2048) ||
    !unique(atlas.regions) ||
    !array(data.armatures, 32) ||
    data.armatures.length === 0 ||
    !unique(data.armatures)
  )
    refuse('Invalid native bone header.');
  const rectValid = rect =>
    rect &&
    whole(rect.x, 0, atlas.width - 1) &&
    whole(rect.y, 0, atlas.height - 1) &&
    whole(rect.width, 1, atlas.width - rect.x) &&
    whole(rect.height, 1, atlas.height - rect.y);
  const regionKeys = new Set(atlas.regions.map(region => JSON.stringify(region.rect)));
  if (atlas.regions.some(region => !rectValid(region.rect))) refuse('Invalid native atlas rectangle.');
  let budget = 0;
  function keysValid(keys, duration, width, checkValue) {
    if (!array(keys, 65536) || keys.length === 0 || keys[0]?.frame !== 0) return false;
    budget += keys.length;
    return (
      budget <= 65536 &&
      keys.every(
        (key, index) =>
          whole(key?.frame, 0, duration) &&
          (!index || keys[index - 1].frame < key.frame) &&
          ['linear', 'step'].includes(key.mode) &&
          vector(key.value, width) &&
          (!checkValue || checkValue(key))
      )
    );
  }
  for (const armature of data.armatures) {
    const { bones, slots, clips } = armature;
    if (
      !whole(armature.frameRate, 1, 240) ||
      !array(bones, 256) ||
      !bones.length ||
      !unique(bones) ||
      !array(slots, 256) ||
      !unique(slots) ||
      !array(clips, 128) ||
      !unique(clips)
    )
      refuse('Invalid native armature header.');
    for (const [index, bone] of bones.entries()) {
      if (!whole(bone.parent, -1, index - 1) || !vector(bone.bind, 6) || !finite(bone.alpha, 0, 1))
        refuse('Invalid native bone hierarchy.');
    }
    for (const slot of slots) {
      if (
        !whole(slot.bone, 0, bones.length - 1) ||
        !array(slot.attachments, 128) ||
        !whole(slot.displayIndex, -1, slot.attachments.length - 1) ||
        !finite(slot.alpha, 0, 1) ||
        !finite(slot.colorAlpha, 0, 1) ||
        slot.attachments.some(
          attachment =>
            attachment !== null &&
            (!named(attachment) ||
              !rectValid(attachment.rect) ||
              !regionKeys.has(JSON.stringify(attachment.rect)) ||
              !vector(attachment.anchor, 2) ||
              !vector(attachment.bind, 6))
        )
      )
        refuse('Invalid native attachment.');
    }
    if (armature.defaultClip !== null && !clips.some(clip => clip.name === armature.defaultClip))
      refuse('Unknown default native clip.');
    for (const clip of clips) {
      if (
        !whole(clip.duration, 1, 36000) ||
        !whole(clip.playTimes, 0, 10000) ||
        !array(clip.boneTracks, bones.length) ||
        !array(clip.slotTracks, slots.length) ||
        new Set(clip.boneTracks.map(track => track?.bone)).size !== clip.boneTracks.length ||
        new Set(clip.slotTracks.map(track => track?.slot)).size !== clip.slotTracks.length
      )
        refuse('Invalid native clip header.');
      for (const track of clip.boneTracks) {
        if (
          !whole(track?.bone, 0, bones.length - 1) ||
          !(track.all || track.translate || track.rotate || track.scale) ||
          (track.all && (track.translate || track.rotate || track.scale)) ||
          (track.all && !keysValid(track.all, clip.duration, 6)) ||
          (track.translate && !keysValid(track.translate, clip.duration, 2)) ||
          (track.rotate && !keysValid(track.rotate, clip.duration, 2)) ||
          (track.scale && !keysValid(track.scale, clip.duration, 2))
        )
          refuse('Invalid native bone track.');
      }
      for (const track of clip.slotTracks) {
        if (
          !whole(track?.slot, 0, slots.length - 1) ||
          !(track.display || track.alpha) ||
          (track.display &&
            !keysValid(
              track.display,
              clip.duration,
              1,
              key => key.mode === 'step' && whole(key.value[0], -1, slots[track.slot].attachments.length - 1)
            )) ||
          (track.alpha && !keysValid(track.alpha, clip.duration, 1, key => finite(key.value[0], 0, 1)))
        )
          refuse('Invalid native slot track.');
      }
    }
  }
  return data;
}

function matrix(value) {
  const [x, y, rotation, skew, sx, sy] = value;
  const r = rotation * radians;
  const q = (rotation + skew) * radians;
  return [Math.cos(r) * sx, Math.sin(r) * sx, -Math.sin(q) * sy, Math.cos(q) * sy, x, y];
}

function multiply(outer, inner) {
  const [a, b, c, d, x, y] = outer;
  const [e, f, g, h, u, v] = inner;
  const result = [a * e + c * f, b * e + d * f, a * g + c * h, b * g + d * h, a * u + c * v + x, b * u + d * v + y];
  if (!result.every(Number.isFinite)) refuse('Native bone transform overflow.');
  return result;
}

/** A display object's two independently rotatable axes preserve affine shear and reflection. */
function decompose(value) {
  const [a, b, c, d, x, y] = value;
  const rotation = Math.atan2(b, a) / radians;
  const skew = Math.atan2(-c, d) / radians - rotation;
  const result = [x, y, rotation, skew, Math.hypot(a, b), Math.hypot(c, d)];
  if (!result.every(Number.isFinite)) refuse('Native bone transform overflow.');
  return result;
}

function shortestAngle(change) {
  return (((change % 360) + 540) % 360) - 180;
}

function sample(keys, at, duration, wrap, angle = -1) {
  let low = 0;
  let high = keys.length;
  while (low + 1 < high) {
    const mid = (low + high) >>> 1;
    if (keys[mid].frame <= at) low = mid;
    else high = mid;
  }
  const start = keys[low];
  if (start.mode === 'step' || at === start.frame) return start.value;
  const next = keys[low + 1] ?? (wrap && start.frame < duration ? { frame: duration, value: keys[0].value } : null);
  if (!next) return start.value;
  const fraction = (at - start.frame) / (next.frame - start.frame);
  return start.value.map((value, index) => {
    const difference = next.value[index] - value;
    return value + fraction * (index === angle ? shortestAngle(difference) : difference);
  });
}

function pose(armature, clip, frame, wrap) {
  const offsets = Array.from({ length: armature.bones.length }, () => neutral);
  const selected = armature.slots.map(slot => slot.displayIndex);
  const colors = armature.slots.map(slot => slot.colorAlpha);
  if (clip) {
    const { duration } = clip;
    for (const track of clip.boneTracks) {
      if (track.all) offsets[track.bone] = sample(track.all, frame, duration, wrap, 2);
      else
        offsets[track.bone] = [
          ...(track.translate ? sample(track.translate, frame, duration, wrap) : [0, 0]),
          ...(track.rotate ? sample(track.rotate, frame, duration, wrap, 0) : [0, 0]),
          ...(track.scale ? sample(track.scale, frame, duration, wrap) : [1, 1])
        ];
    }
    for (const track of clip.slotTracks) {
      if (track.display) selected[track.slot] = sample(track.display, frame, duration, wrap)[0];
      if (track.alpha) colors[track.slot] = sample(track.alpha, frame, duration, wrap)[0];
    }
  }
  const world = [];
  const opacity = [];
  for (const [index, bone] of armature.bones.entries()) {
    const value = bone.bind.map((bind, i) => (i < 4 ? bind + offsets[index][i] : bind * offsets[index][i]));
    world.push(multiply(bone.parent < 0 ? identity : world[bone.parent], matrix(value)));
    opacity.push(bone.alpha * (bone.parent < 0 ? 1 : opacity[bone.parent]));
  }
  return armature.slots.map((slot, index) => {
    const attachment = slot.attachments[selected[index]];
    if (!attachment) return null;
    return {
      attachment,
      transform: decompose(multiply(world[slot.bone], matrix(attachment.bind))),
      alpha: opacity[slot.bone] * slot.alpha * colors[index]
    };
  });
}

function onStage(node, stage) {
  for (let parent = node.parent; parent != null; parent = parent.parent) if (parent === stage) return true;
  return false;
}

/**
 * Per-game factory namespace for old constructions. Only converted neutral data is accepted.
 * The game owns its leases; each display owns only a native clock subscription and its own bitmap subtree.
 */
export function createLegacyBones({ sdk, game, getTexture, Container = sdk.DisplayObjectContainer }) {
  const leaseFor = getTexture;
  class ArmatureDisplay extends Container {
    #clockScope;
    #bitmaps = [];
    #clip;
    #elapsed = 0;
    #plays = 1;
    #playing = false;
    #completed = false;
    #speed = 1;

    constructor(armature, lease) {
      super();
      this.name = armature.name;
      this.touchChildren = false;
      this.#clockScope = game.engine.createScope();
      try {
        // One native bitmap per ordered slot, no new texture or frame raster allocations.
        for (const slot of armature.slots) {
          const bitmap = new sdk.Bitmap(lease);
          bitmap.name = slot.name;
          bitmap.touchEnabled = false;
          this.#bitmaps.push({ bitmap, attachment: undefined });
          this.addChild(bitmap);
        }
        const display = this;
        const clockFrameRate = armature.frameRate;
        const animation = Object.freeze({
          play(clipName, playTimes = -1) {
            if (display.isDisposed) refuse('Armature display is disposed.');
            const chosen = clipName || display.#clip?.name || armature.defaultClip || armature.clips[0]?.name;
            const clip = armature.clips.find(item => item.name === chosen);
            if (!clip) refuse('Unknown native animation: ' + String(chosen));
            if (!Number.isInteger(playTimes) || playTimes < -1 || playTimes > 10000)
              refuse('Invalid native play count.');
            display.#clip = clip;
            display.#elapsed = 0;
            display.#plays = playTimes < 0 ? clip.playTimes : playTimes;
            display.#playing = true;
            display.#completed = false;
            display.#publish(armature);
            return animation;
          },
          stop(clipName) {
            if (!clipName || clipName === display.#clip?.name) display.#playing = false;
          },
          reset() {
            if (display.isDisposed) refuse('Armature display is disposed.');
            display.#clip = undefined;
            display.#elapsed = 0;
            display.#playing = display.#completed = false;
            display.#publish(armature);
          },
          hasAnimation: name => armature.clips.some(clip => clip.name === name),
          get animationNames() {
            return armature.clips.map(clip => clip.name);
          },
          get lastAnimationName() {
            return display.#clip?.name ?? '';
          },
          get name() {
            return display.#clip?.name ?? '';
          },
          get isPlaying() {
            return display.#playing;
          },
          get isCompleted() {
            return display.#completed;
          },
          get totalTime() {
            return (display.#clip?.duration ?? 0) / clockFrameRate;
          },
          get currentTime() {
            const duration = display.#clip?.duration;
            return duration ? (display.#completed ? duration : display.#elapsed % duration) / clockFrameRate : 0;
          },
          get timeScale() {
            return display.#speed;
          },
          set timeScale(value) {
            if (!Number.isFinite(value) || value < 0 || value > 16) refuse('Invalid native animation rate.');
            display.#speed = value;
          }
        });
        Object.defineProperty(this, 'animation', { value: animation, enumerable: true });
        Object.defineProperty(this, 'armature', { value: Object.freeze({ animation, display: this }) });
        this.#publish(armature);
        if (armature.defaultClip) animation.play(armature.defaultClip);
        game.engine.clock.onTick(this.#clockScope, tick => {
          if (!this.#playing || !onStage(this, game.stage) || this.#speed === 0 || tick.deltaSeconds === 0) return;
          const next = this.#elapsed + tick.deltaSeconds * clockFrameRate * this.#speed;
          if (this.#plays > 0 && next >= this.#clip.duration * this.#plays - 1e-9) {
            this.#completed = true;
            this.#playing = false;
            this.#elapsed = this.#clip.duration * this.#plays;
          } else this.#elapsed = next;
          this.#publish(armature);
        });
      } catch (cause) {
        this.dispose();
        throw cause;
      }
    }

    #publish(armature) {
      const duration = this.#clip?.duration ?? 1;
      const frame = this.#completed ? duration : this.#elapsed % duration;
      const wrap = !this.#completed && (this.#plays === 0 || this.#elapsed < duration * (this.#plays - 1));
      // Compute every pose before touching the live tree.
      const next = pose(armature, this.#clip, frame, wrap);
      for (const [index, value] of next.entries()) {
        const state = this.#bitmaps[index];
        const bitmap = state.bitmap;
        if (!value) {
          bitmap.visible = false;
          continue;
        }
        if (state.attachment !== value.attachment) {
          bitmap.sourceRect = value.attachment.rect;
          [bitmap.anchorOffsetX, bitmap.anchorOffsetY] = value.attachment.anchor;
          state.attachment = value.attachment;
        }
        [bitmap.x, bitmap.y, bitmap.rotation, bitmap.skewX, bitmap.scaleX, bitmap.scaleY] = value.transform;
        bitmap.alpha = value.alpha;
        bitmap.visible = true;
      }
    }

    getArmature() {
      return this.armature;
    }

    dispose() {
      if (this.isDisposed) return;
      this.#playing = false;
      this.#clockScope?.dispose();
      super.dispose();
    }
  }

  class EgretFactory {
    #data = new Map();
    #atlases = new Map();

    static get factory() {
      return sharedFactory;
    }

    parseDragonBonesData(source, name) {
      const data = validateDescriptor(source);
      const key = name ?? data.name;
      if (typeof key !== 'string' || !key) refuse('Invalid skeleton alias.');
      const old = this.#data.get(key);
      if (old && JSON.stringify(old) !== JSON.stringify(data))
        refuse('Skeleton alias already refers to different content.');
      if (!old) this.#data.set(key, data);
      return Object.freeze({ name: key, armatureNames: Object.freeze(data.armatures.map(armature => armature.name)) });
    }

    parseTextureAtlasData(source, texture, name) {
      const { atlas } = validateDescriptor(source);
      const key = name ?? atlas.name;
      const lease = leaseFor(texture);
      if (
        typeof key !== 'string' ||
        !key ||
        !lease ||
        lease.value.width !== atlas.width ||
        lease.value.height !== atlas.height
      )
        refuse('Native atlas requires the matching admitted page texture.');
      const prior = this.#atlases.get(key);
      if (prior && (prior.lease !== lease || JSON.stringify(prior.atlas) !== JSON.stringify(atlas)))
        refuse('Atlas alias already refers to different content.');
      if (!prior) this.#atlases.set(key, { atlas, lease });
      return Object.freeze({ name: key });
    }

    buildArmatureDisplay(armatureName, dataName, skinName, atlasName) {
      if (skinName && skinName !== 'default') refuse('Only the converted default skin is supported.');
      const data = dataName ? [this.#data.get(dataName)] : [...this.#data.values()];
      const found = data.filter(value => value?.armatures.some(armature => armature.name === armatureName));
      if (found.length !== 1) refuse('Unknown or ambiguous migrated armature: ' + String(armatureName));
      const selected = found[0];
      const atlas = this.#atlases.get(
        atlasName || (dataName && this.#atlases.has(dataName) ? dataName : selected.atlas.name)
      );
      if (!atlas || JSON.stringify(atlas.atlas) !== JSON.stringify(selected.atlas))
        refuse("Register this armature's matching native atlas before building a display.");
      return new ArmatureDisplay(
        selected.armatures.find(armature => armature.name === armatureName),
        atlas.lease
      );
    }
  }

  const sharedFactory = new EgretFactory();
  return Object.freeze({ EgretFactory });
}
