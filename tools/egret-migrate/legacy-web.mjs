// SPDX-License-Identifier: Apache-2.0
// Shared display bindings for admitted legacy 2D projects and the browser host entry.
import { createClassicFilters } from './compat/filters.mjs';
import { createClassicEditor, browserClassicEditor, TextFieldInputType, TextFieldType } from './compat/text-input.mjs';
import { bitmapFontResources } from './compat/bitmap-label.mjs';
import { captureTextFlow, HtmlTextParser, layoutTextFlow, richTextEvent } from './compat/rich-text.mjs';
import { BlendMode, EventPhase, HorizontalAlign, VerticalAlign, legacyTouchEvent } from './compat/display-options.mjs';
import { createLegacyMovieClips, createPagedBitmap } from './compat/movieclip.mjs';
import { browserAtlasRaster } from './compat/text-atlas.mjs';
import { classicImageLoader } from './compat/image-loader.mjs';
import { createLegacyTextures } from './compat/legacy-textures.mjs';
import { createFrameEvents } from './compat/frame-events.mjs';
import { installProjectMethods, readProjectMethod } from './compat/project-methods.mjs';
import { extendProjectBindings } from './compat/project-bindings.mjs';
import { browserClassicMusic, classicSoundResource } from './compat/sound.mjs';
import { createResourceReads } from './compat/resource-reads.mjs';
import { createResourceCatalog } from './compat/resource-catalog.mjs';
import { ByteArray, Endian } from './compat/protocol.mjs';
import { browserEnvironment, createHashDomain, legacyHost, stagePolicy } from './compat/host-environment.mjs';
import { createLegacyGameServices } from './compat/game-services.mjs';
import { browserTransport, createLegacyTransport } from './compat/transport.mjs';
import { createLegacyEui } from './legacy-eui.mjs';
import { createLegacyBones } from './legacy-bones.mjs';
const added = 'addedToStage';
const removed = 'removedFromStage';
const tap = 'touchTap';

function refuse(code, message) {
  throw Object.assign(new Error(message), { code });
}

function projectStorage(storage, projectId) {
  const prefix = 'egret7:legacy:' + projectId + ':';
  return Object.freeze({
    getItem(key) {
      try {
        return storage()?.getItem(prefix + String(key)) ?? null;
      } catch {
        return null;
      }
    },
    setItem(key, value) {
      try {
        const target = storage();
        if (target === undefined) return false;
        target.setItem(prefix + String(key), String(value));
        return true;
      } catch {
        return false;
      }
    },
    removeItem(key) {
      try {
        storage()?.removeItem(prefix + String(key));
      } catch {
        // The old storage interface cannot remove a key when the host denies access.
      }
    }
  });
}

function localPath(value) {
  return (
    typeof value === 'string' &&
    !/[:\\?#%\u0000-\u001f]/.test(value) &&
    value.split('/').every(part => part !== '' && part !== '.' && part !== '..')
  );
}

function resourcesFor(
  sdk,
  game,
  readAsset,
  plan,
  textures,
  textureTypes,
  bitmapFonts,
  sheetPlans,
  moviePages,
  EventDispatcher,
  LegacyEvent,
  observe,
  callLater,
  ports,
  reportError
) {
  const dispatcher = new EventDispatcher();
  const ResourceEvent = Object.freeze({
    CONFIG_COMPLETE: 'configComplete',
    GROUP_COMPLETE: 'groupComplete',
    GROUP_PROGRESS: 'groupProgress',
    GROUP_LOAD_ERROR: 'groupLoadError',
    ITEM_LOAD_ERROR: 'itemLoadError'
  });
  const emit = (type, fields = {}) => {
    if (game.scope.signal.aborted) return;
    const event = Object.assign(new LegacyEvent(type), fields);
    dispatcher.dispatchEvent(event);
  };
  const declared = new Map();
  const groups = new Map();
  const sheets = new Map(sheetPlans.map(item => [item.name, item]));
  const paged = new Map(moviePages.map(page => [page.texture, page]));
  const aliases = new Map(sheetPlans.flatMap(item => item.subkeys.map(key => [key, item.name])));
  const frameOf = name => {
    if (aliases.has(name)) return [aliases.get(name), name];
    if (declared.has(name) || typeof name !== 'string') return undefined;
    const dot = name.indexOf('.');
    if (dot > 0 && sheets.has(name.slice(0, dot))) return [name.slice(0, dot), name.slice(dot + 1)];
    return undefined;
  };
  for (const item of plan?.resources ?? []) {
    if (
      declared.has(item.name) ||
      !localPath(item.url) ||
      !['image', 'json', 'text', 'bin', 'font', 'sound'].includes(item.type)
    ) {
      refuse('LEGACY_WEB_RESOURCE_UNSUPPORTED', 'Resource declaration is outside the migration profile.');
    }
    declared.set(item.name, item);
  }
  for (const group of plan?.groups ?? []) {
    if (groups.has(group.name) || !group.keys.every(key => declared.has(key))) {
      refuse('LEGACY_WEB_RESOURCE_UNSUPPORTED', 'Resource group contains an unknown declaration.');
    }
    groups.set(group.name, group.keys);
  }

  const reads = createResourceReads(game.scope.signal);
  const releases = new WeakMap();
  const ready = new Map();
  const pending = new Map();
  const generations = new Map();
  function watch(key) {
    let identity = generations.get(key);
    if (!identity) {
      identity = {};
      generations.set(key, identity);
    }
    const active = () => !game.scope.signal.aborted && generations.get(key) === identity;
    return {
      active,
      check() {
        requireOpen();
        if (!active()) refuse('LEGACY_RESOURCE_RETIRED', 'The requested resource was released.');
      }
    };
  }
  let configured = false;

  async function read(item, generation) {
    const leaf = open => reads.read(item.name, generation, open);
    const sheetPlan = sheets.get(item.name);
    if (sheetPlan) {
      const page = await load(sheetPlan.page);
      generation.check();
      const lease = textures.get(page);
      const frames = sheetPlan.frames.map(frame => ({
        name: frame.name,
        x: frame.x,
        y: frame.y,
        width: frame.width,
        height: frame.height,
        layout: {
          sourceWidth: frame.sourceWidth,
          sourceHeight: frame.sourceHeight,
          trimX: frame.offsetX,
          trimY: frame.offsetY,
          packedRotation: 0
        }
      }));
      const sheet = game.scope.use(sdk.createSpriteSheet(lease, frames, 'trim-rotation-v1'));
      const values = new Map(
        sheetPlan.frames.map(frame => {
          const value = textureTypes.adopt(lease, { sheet, name: frame.name, page: lease, frame });
          return [frame.name, value];
        })
      );
      const resource = Object.freeze({ getTexture: name => values.get(name) ?? null });
      releases.set(resource, () => {
        for (const value of values.values()) textureTypes.retire(value, false);
        sheet.dispose();
      });
      return resource;
    }
    if (paged.has(item.name)) {
      const { width, height, tiles } = paged.get(item.name);
      if (
        ![width, height].every(n => Number.isSafeInteger(n) && n > 0 && n <= 8192) ||
        !Array.isArray(tiles) ||
        !tiles.length ||
        tiles.length > 64
      )
        refuse('LEGACY_WEB_RESOURCE_UNSUPPORTED', 'Invalid paged texture.');
      const acquired = [];
      try {
        for (const tile of tiles) {
          if (
            !localPath(tile.url) ||
            ![tile.x, tile.y, tile.left, tile.top, tile.width, tile.height].every(Number.isSafeInteger) ||
            tile.x < 0 ||
            tile.y < 0 ||
            tile.width < 1 ||
            tile.height < 1 ||
            tile.x + tile.width > width ||
            tile.y + tile.height > height ||
            ![0, 1].includes(tile.left) ||
            ![0, 1].includes(tile.top)
          )
            refuse('LEGACY_WEB_RESOURCE_UNSUPPORTED', 'Invalid atlas tile rectangle.');
          const lease = await leaf(() => game.loadTexture(tile.url));
          acquired.push({ ...tile, lease });
          if (tile.left + tile.width > lease.value.width || tile.top + tile.height > lease.value.height)
            refuse('LEGACY_WEB_RESOURCE_UNSUPPORTED', 'Atlas tile exceeds its decoded image.');
        }
        const texture = Object.freeze({ textureWidth: width, textureHeight: height });
        textures.set(texture, { width, height, tiles: acquired });
        releases.set(texture, () => {
          textures.delete(texture);
          for (const tile of acquired) tile.lease.release();
        });
        return texture;
      } catch (error) {
        for (const tile of acquired) tile.lease.release();
        throw error;
      }
    }
    if (item.type === 'image') {
      const lease = await leaf(() => game.loadTexture(item.url));
      const resource = textureTypes.adopt(lease);
      releases.set(resource, () => {
        textureTypes.retire(resource, true);
        lease.release();
      });
      return resource;
    }
    if (item.type === 'sound') {
      if (!ports.loadSound) refuse('LEGACY_SOUND_UNAVAILABLE', 'Install the soundtrack provider for this host.');
      const output = await leaf(() => ports.loadSound(item.url));
      const resource = classicSoundResource(output, EventDispatcher, game.scope, reportError);
      releases.set(resource, resource.close);
      return resource;
    }
    if (item.type === 'font') {
      const data = await leaf(() => readAsset(item));
      generation.check();
      if (typeof data?.file !== 'string' || !localPath(data.file) || !data.file.toLowerCase().endsWith('.png'))
        refuse('LEGACY_BITMAP_FONT_INVALID', 'Expected a local PNG font page.');
      const pageUrl = item.url.slice(0, item.url.lastIndexOf('/') + 1) + data.file;
      const resource = await bitmapFonts.load(data, pageUrl, url => leaf(() => game.loadTexture(url)));
      releases.set(resource.value, resource.dispose);
      return resource.value;
    }
    return leaf(() => readAsset(item));
  }

  function requireOpen() {
    if (game.scope.signal.aborted) throw game.scope.signal.reason ?? new Error('Legacy resource owner closed');
  }
  function load(name, directUrl = false) {
    requireOpen();
    if (!configured && !directUrl) refuse('LEGACY_WEB_CONFIG_REQUIRED', 'Load the admitted configuration first.');
    const frame = frameOf(name);
    if (frame)
      return load(frame[0]).then(sheet => {
        const value = sheet.getTexture(frame[1]);
        if (value === null) refuse('LEGACY_WEB_RESOURCE_UNKNOWN', 'Unknown sheet frame: ' + name);
        return value;
      });
    name = catalog.resolveName(name) ?? name;
    const item = declared.get(name);
    if (item === undefined) refuse('LEGACY_WEB_RESOURCE_UNKNOWN', 'Unknown resource: ' + name);
    if (ready.has(name)) return Promise.resolve(ready.get(name));
    if (!pending.has(name)) {
      const generation = watch(name);
      const request = read(item, generation)
        .then(value => {
          if (pending.get(name) !== request || game.scope.signal.aborted) {
            releases.get(value)?.();
            throw new Error('Legacy resource was released during loading: ' + name);
          }
          ready.set(name, value);
          return value;
        })
        .catch(error => {
          generation.check();
          throw error;
        })
        .finally(() => {
          if (pending.get(name) === request) pending.delete(name);
        });
      pending.set(name, request);
    }
    return pending.get(name);
  }

  function unload(name) {
    generations.delete(name);
    reads.retire(name);
    const loading = pending.delete(name);
    if (!ready.has(name)) return loading;
    const value = ready.get(name);
    ready.delete(name);
    releases.get(value)?.();
    return true;
  }
  const catalog = createResourceCatalog({
    declared,
    groups,
    sheets,
    frameOf,
    localPath,
    load: key => load(key, true),
    unload,
    root: plan?.root,
    requireOpen,
    watch,
    onError: resItem => emit(ResourceEvent.ITEM_LOAD_ERROR, { groupName: '', resItem })
  });
  game.scope.signal.addEventListener(
    'abort',
    () => {
      pending.clear();
      generations.clear();
      for (const key of ready.keys()) unload(key);
      catalog.close();
    },
    { once: true }
  );
  return Object.freeze({
    ...catalog.api,
    profile() {
      requireOpen();
      const snapshot = Object.freeze({
        declared: declared.size,
        groups: groups.size,
        ...catalog.counts(),
        ready: ready.size,
        pending: pending.size,
        reads: reads.snapshot(),
        host: Object.freeze(ports.resourceUsage?.() ?? {})
      });
      ports.environment?.logger?.log?.('RES.profile ' + JSON.stringify(snapshot));
      return snapshot;
    },
    setMaxLoadingThread: reads.setLimit,
    ResourceEvent,
    addEventListener: dispatcher.addEventListener.bind(dispatcher),
    removeEventListener: dispatcher.removeEventListener.bind(dispatcher),
    loadConfig(url, root) {
      if (game.scope.signal.aborted) return Promise.reject(game.scope.signal.reason);
      if (plan === undefined || url !== plan.configUrl || root !== plan.root) {
        return Promise.reject(
          Object.assign(new Error('Only the configuration admitted by migration can be loaded.'), {
            code: 'LEGACY_WEB_CONFIG_UNSUPPORTED'
          })
        );
      }
      configured = true;
      const task = Promise.resolve().then(() => emit(ResourceEvent.CONFIG_COMPLETE));
      if (dispatcher.hasEventListener(ResourceEvent.CONFIG_COMPLETE)) observe(task);
      return task;
    },
    getRes(name) {
      const frame = frameOf(name);
      return frame
        ? (ready.get(frame[0])?.getTexture(frame[1]) ?? null)
        : (ready.get(catalog.resolveName(name)) ?? null);
    },
    async getResAsync(name, callback, receiver) {
      requireOpen();
      const key = catalog.resolveName(name);
      if (key === undefined) {
        callback?.call(receiver, null, name);
        refuse('LEGACY_WEB_RESOURCE_UNKNOWN', 'Unknown resource: ' + name);
      }
      const cached = ready.has(key);
      const generation = watch(key);
      let value;
      try {
        value = await load(name);
      } catch (error) {
        requireOpen();
        generation.check();
        emit(ResourceEvent.ITEM_LOAD_ERROR, { groupName: '', resItem: declared.get(key) });
        generation.check();
        if (callback) {
          callback.call(receiver, null, name);
          throw null;
        }
        throw error;
      }
      requireOpen();
      generation.check();
      if (callback && cached && value)
        callLater(() => {
          if (generation.active()) callback.call(receiver, value, name);
        });
      else callback?.call(receiver, value, name);
      return value;
    },
    loadGroup(name, _priority, reporter) {
      let reportedFailure;
      let handled = false;
      const notifyFailure = (error, completed, total) => {
        reportedFailure = error;
        handled = dispatcher.hasEventListener(ResourceEvent.GROUP_LOAD_ERROR);
        emit(ResourceEvent.GROUP_LOAD_ERROR, { groupName: name, itemsLoaded: completed, itemsTotal: total });
      };
      const run = async () => {
        requireOpen();
        const keys = groups.get(name);
        if (keys === undefined) {
          const error = Object.assign(new Error('Unknown resource group: ' + name), {
            code: 'LEGACY_WEB_GROUP_UNKNOWN'
          });
          notifyFailure(error, 0, 0);
          throw error;
        }
        let completed = 0;
        const results = await Promise.allSettled(
          keys.map(async key => {
            try {
              await load(key);
            } catch (error) {
              requireOpen();
              if (error?.code === 'LEGACY_RESOURCE_RETIRED') throw error;
              if (groups.get(name) !== keys)
                refuse('LEGACY_RESOURCE_RETIRED', 'The resource group was replaced while it was loading.');
              emit(ResourceEvent.ITEM_LOAD_ERROR, {
                groupName: name,
                resItem: declared.get(key),
                itemsLoaded: completed,
                itemsTotal: keys.length
              });
              throw error;
            }
            requireOpen();
            completed++;
            if (groups.get(name) !== keys) return;
            emit(ResourceEvent.GROUP_PROGRESS, { groupName: name, itemsLoaded: completed, itemsTotal: keys.length });
            requireOpen();
            reporter?.onProgress(completed, keys.length);
          })
        );
        requireOpen();
        const failed = results.find(result => result.status === 'rejected');
        if (failed) {
          if (failed.reason?.code !== 'LEGACY_RESOURCE_RETIRED') notifyFailure(failed.reason, completed, keys.length);
          throw failed.reason;
        }
        if (!catalog.groupLoaded(name, keys))
          refuse('LEGACY_RESOURCE_RETIRED', 'The resource group was replaced while it was loading.');
        emit(ResourceEvent.GROUP_COMPLETE, { groupName: name, itemsLoaded: completed, itemsTotal: keys.length });
      };
      // Event-based projects do not return the loading promise from their startup hooks.
      const handlesFailure = dispatcher.hasEventListener(ResourceEvent.GROUP_LOAD_ERROR);
      const task = Promise.resolve().then(run);
      if (handlesFailure)
        observe(
          task.catch(error => {
            if (!handled || error !== reportedFailure) throw error;
          })
        );
      else if (dispatcher.hasEventListener(ResourceEvent.GROUP_COMPLETE)) observe(task);
      return task;
    },
    isGroupLoaded(name) {
      return groups.get(name)?.every(key => ready.has(catalog.resolveName(key))) ?? false;
    }
  });
}

/** Shared display, RES, EUI and event bindings. Host ports own I/O and native lifecycle events. */
export function createLegacyBindings(sdk, game, options, ports) {
  const identity = createHashDomain();
  const classicFilters = createClassicFilters(game.scope.signal, ports.sharedEffects === true, identity.HashObject);
  const frameEvents = createFrameEvents(
    game,
    () => stage,
    error => report(error)
  );
  const textures = new WeakMap();
  const bitmapFonts = bitmapFontResources(sdk);
  const atlasFields = new WeakMap();
  const textureTypes = createLegacyTextures(
    sdk,
    game,
    textures,
    identity.HashObject,
    ports,
    observe,
    node => atlasFields.get(node)?.(),
    node => node?.constructor === Container
  );
  const staged = sdk.createEventType(added);
  const unstaged = sdk.createEventType(removed);
  const complete = sdk.createEventType('complete');
  const creationComplete = sdk.createEventType('creationComplete');
  const change = sdk.createEventType('change');
  const changing = sdk.createEventType('changing', { cancelable: true });
  const itemTap = sdk.createEventType('itemTap');
  const collectionChange = sdk.createEventType('collectionChange');
  const propertyChange = sdk.createEventType('propertyChange');
  const types = new Map([
    [added, staged],
    [removed, unstaged],
    ['complete', complete],
    ['creationComplete', creationComplete],
    ['change', change],
    ['changing', changing],
    ['itemTap', itemTap],
    ['collectionChange', collectionChange],
    ['propertyChange', propertyChange],
    [tap, game.pointer.events.tap]
  ]);
  const pointerTypes = new Set([tap]);
  for (const [legacy, kind] of [
    ['touchBegin', 'begin'],
    ['touchMove', 'move'],
    ['touchEnd', 'end'],
    ['touchCancel', 'cancel']
  ]) {
    if (game.pointer.events[kind] !== undefined) types.set(legacy, game.pointer.events[kind]);
    pointerTypes.add(legacy);
  }
  const manualTypes = new Map();
  const activeLegacy = new WeakMap();
  const targets = new WeakMap();
  const prevented = new WeakSet();
  const nativeEvents = new WeakMap();

  function eventType(type, bubbles, cancelable, scripted = false) {
    if (typeof type !== 'string' || !type || type.length > 256)
      refuse('LEGACY_WEB_EVENT_UNSUPPORTED', 'Invalid legacy event name.');
    const fixed = types.get(type);
    if (!scripted && fixed && fixed.bubbles === bubbles && fixed.cancelable === cancelable) return fixed;
    let variants = manualTypes.get(type);
    if (!variants) {
      if (manualTypes.size >= 1024) refuse('LEGACY_WEB_EVENT_UNSUPPORTED', 'Too many custom event names.');
      manualTypes.set(type, (variants = new Map()));
    }
    const key = Number(scripted) * 4 + Number(bubbles) * 2 + Number(cancelable);
    if (!variants.has(key)) variants.set(key, sdk.createEventType(type, { bubbles, cancelable }));
    return variants.get(key);
  }

  function descriptors(type) {
    if (pointerTypes.has(type))
      return [
        ...(types.has(type) ? [types.get(type)] : []),
        eventType(type, false, false, true),
        eventType(type, false, true, true),
        eventType(type, true, false, true),
        eventType(type, true, true, true)
      ];
    if (type === added || type === removed) return [types.get(type)];
    return [
      eventType(type, false, false),
      eventType(type, false, true),
      eventType(type, true, false),
      eventType(type, true, true)
    ];
  }

  class LegacyEvent {
    get hashCode() {
      return this.$hashCode;
    }
    constructor(type, bubbles = false, cancelable = false, data = undefined) {
      identity.stamp(this);
      this.type = type;
      this.bubbles = Boolean(bubbles);
      this.cancelable = Boolean(cancelable);
      this.data = data;
    }
    get target() {
      return activeLegacy.get(this)?.target ?? targets.get(this);
    }
    get currentTarget() {
      return activeLegacy.get(this)?.currentTarget ?? null;
    }
    get eventPhase() {
      const phase = activeLegacy.get(this)?.eventPhase;
      return phase === 'capturing'
        ? EventPhase.CAPTURING_PHASE
        : phase === 'bubbling'
          ? EventPhase.BUBBLING_PHASE
          : EventPhase.AT_TARGET;
    }
    stopPropagation() {
      activeLegacy.get(this)?.stopPropagation();
    }
    stopImmediatePropagation() {
      activeLegacy.get(this)?.stopImmediatePropagation();
    }
    preventDefault() {
      if (this.cancelable) prevented.add(this);
      activeLegacy.get(this)?.preventDefault();
    }
    isDefaultPrevented() {
      return prevented.has(this) || Boolean(activeLegacy.get(this)?.defaultPrevented);
    }
  }
  Object.assign(LegacyEvent, {
    ADDED_TO_STAGE: added,
    REMOVED_FROM_STAGE: removed,
    COMPLETE: 'complete',
    SOUND_COMPLETE: 'soundComplete',
    LOOP_COMPLETE: 'loopComplete',
    ENTER_FRAME: 'enterFrame',
    ACTIVATE: 'activate',
    DEACTIVATE: 'deactivate',
    CONNECT: 'connect',
    CLOSE: 'close',
    CHANGE: 'change',
    FOCUS_IN: 'focusIn',
    FOCUS_OUT: 'focusOut',
    CHANGING: 'changing',
    RESIZE: 'resize'
  });
  const TouchEvent = legacyTouchEvent(LegacyEvent);
  const TextEvent = richTextEvent(LegacyEvent);
  class FocusEvent extends LegacyEvent {}
  const editor = createClassicEditor(
    game.scope.signal,
    ports.openEditor,
    (field, type) => {
      field.dispatchEvent(type === 'change' ? new LegacyEvent(type, true) : new FocusEvent(type, true));
    },
    report
  );
  const opening = [];
  const labels = new WeakMap();
  let booting = true;
  let stage;
  let ui;

  function report(error) {
    if (typeof options.onError === 'function') options.onError(error);
    else if (ports.reportError) ports.reportError(error);
    else throw error;
  }

  function observe(task) {
    if (booting) {
      opening.push(task);
      // Startup awaits each callback. Observe it now so an early rejection cannot escape the host.
      void task.catch(() => {});
    } else void task.catch(report);
  }

  function stageOf(node) {
    for (let at = node; at !== undefined && at !== null; at = at.parent)
      if (at === stage && stage.parent === game.stage) return stage;
    return null;
  }

  function subtree(node) {
    const pending = [node];
    const nodes = [];
    while (pending.length > 0) {
      const current = pending.pop();
      nodes.push(current);
      if (current instanceof sdk.DisplayObjectContainer)
        for (let child = current.numChildren - 1; child >= 0; child--) pending.push(current.getChildAt(child));
    }
    return nodes;
  }

  function moveOnStage(node, previous, previousViewportOwner) {
    // Native insertion changes the parent atomically without calling the old Scroller's removeChild().
    if (previousViewportOwner && node.parent !== previousViewportOwner) node.scrollEnabled = false;
    const current = stageOf(node);
    if (current === previous) return;
    if (current !== null) ui?.beginMount();
    try {
      // Take the list before listeners run. A listener's new children dispatch through their own insertion.
      for (const child of subtree(node)) {
        if (child.isDisposed || stageOf(child) !== current) continue;
        if (current === null) {
          ui?.leave?.(child);
          labels.get(child)?.leave();
          if (!child.isDisposed && stageOf(child) === null) child.dispatchEvent(new sdk.Event(unstaged, undefined));
        } else {
          ui?.enter(child);
          labels.get(child)?.enter();
          if (!child.isDisposed && stageOf(child) === current) child.dispatchEvent(new sdk.Event(staged, undefined));
        }
      }
    } finally {
      if (current !== null) ui?.endMount();
    }
  }

  const withEvents = Base =>
    class extends Base {
      constructor(...args) {
        super(...args);
        identity.stamp(this);
      }
      get hashCode() {
        return this.$hashCode;
      }
      #listeners = [];

      get stage() {
        return stageOf(this);
      }

      addEventListener(type, handler, receiver, capture = false, priority = 0) {
        const eventDescriptors = descriptors(type);
        if (eventDescriptors.length === 0 || typeof handler !== 'function') {
          refuse('LEGACY_WEB_EVENT_UNSUPPORTED', 'Unsupported legacy listener: ' + type);
        }
        if (
          this.#listeners.some(
            entry =>
              entry.type === type &&
              entry.handler === handler &&
              entry.receiver === receiver &&
              entry.capture === capture
          )
        )
          return;

        const removers = eventDescriptors.map(descriptor =>
          this.on(
            descriptor,
            event => {
              let adapted = event.payload instanceof LegacyEvent ? event.payload : nativeEvents.get(event);
              if (!adapted) {
                if (pointerTypes.has(type)) {
                  const contact = event.payload;
                  adapted = new TouchEvent(
                    type,
                    descriptor.bubbles,
                    descriptor.cancelable,
                    contact.globalX,
                    contact.globalY,
                    contact.session.pointerId
                  );
                  adapted.touchDown = type === 'touchBegin' || type === 'touchMove';
                } else adapted = new LegacyEvent(type, descriptor.bubbles, descriptor.cancelable, event.payload);
                // EUI's typed events expose these fields directly as well as the payload.
                for (const key of [
                  'item',
                  'itemIndex',
                  'itemRenderer',
                  'kind',
                  'location',
                  'oldLocation',
                  'items',
                  'oldItems',
                  'property'
                ])
                  if (event.payload && Object.hasOwn(event.payload, key)) adapted[key] = event.payload[key];
                nativeEvents.set(event, adapted);
              }
              const wasActive = activeLegacy.has(adapted);
              activeLegacy.set(adapted, event);
              targets.set(adapted, event.target);
              try {
                const result = ui ? ui.callGame(handler, receiver, adapted) : handler.call(receiver, adapted);
                if (result && typeof result.then === 'function') observe(Promise.resolve(result));
              } catch (error) {
                if (booting) observe(Promise.reject(error));
                else report(error);
              } finally {
                if (!wasActive) activeLegacy.delete(adapted);
              }
            },
            { capture, priority }
          )
        );
        const remove = () => {
          for (const off of removers) off();
        };
        this.#listeners.push({ type, handler, receiver, capture, remove });
        if (type === LegacyEvent.ENTER_FRAME && Base !== sdk.EventDispatcher) frameEvents.track(this);
      }

      removeEventListener(type, handler, receiver, capture = false) {
        const index = this.#listeners.findIndex(
          entry =>
            entry.type === type && entry.handler === handler && entry.receiver === receiver && entry.capture === capture
        );
        if (index >= 0) this.#listeners.splice(index, 1)[0].remove();
        if (type === LegacyEvent.ENTER_FRAME && Base !== sdk.EventDispatcher && !this.hasEventListener(type))
          frameEvents.untrack(this);
      }

      hasEventListener(type) {
        return this.#listeners.some(entry => entry.type === type);
      }

      dispatchEventWith(type, bubbles = false, data) {
        return this.dispatchEvent(new LegacyEvent(type, bubbles, false, data));
      }

      dispatchEvent(event) {
        if (!(event instanceof LegacyEvent)) return super.dispatchEvent(event);
        if (
          (pointerTypes.has(event.type) && !(event instanceof TouchEvent)) ||
          event.type === added ||
          event.type === removed ||
          activeLegacy.has(event)
        )
          refuse(
            'LEGACY_WEB_EVENT_UNSUPPORTED',
            'Unsupported manual engine event or recursive dispatch: ' + event.type
          );
        const descriptor = eventType(event.type, event.bubbles, event.cancelable, pointerTypes.has(event.type));
        const native = new sdk.Event(descriptor, event);
        // Egret lets a caller reuse an event and inspect its cancellation after the dispatch.
        activeLegacy.set(event, native);
        targets.set(event, this);
        try {
          return super.dispatchEvent(native) && !prevented.has(event);
        } finally {
          activeLegacy.delete(event);
        }
      }
    };

  const withChildren = Base =>
    class extends withEvents(Base) {
      get filters() {
        return classicFilters.read(this);
      }
      set filters(value) {
        classicFilters.apply(this, value);
      }
      dispose() {
        classicFilters.release(this);
        super.dispose();
      }
      addChild(child) {
        const before = stageOf(child);
        const owner = ui?.viewportOwner(child);
        const inserted = super.addChild(child);
        moveOnStage(inserted, before, owner);
        return inserted;
      }

      addChildAt(child, index) {
        const before = stageOf(child);
        const owner = ui?.viewportOwner(child);
        const inserted = super.addChildAt(child, index);
        moveOnStage(inserted, before, owner);
        return inserted;
      }

      removeChild(child) {
        const before = stageOf(child);
        const removed = super.removeChild(child);
        moveOnStage(removed, before);
        return removed;
      }

      removeChildren() {
        const before = stageOf(this);
        const removed = before === null ? [] : Array.from({ length: this.numChildren }, (_, i) => this.getChildAt(i));
        super.removeChildren();
        for (const child of removed) moveOnStage(child, before);
      }

      removeChildAt(index) {
        return this.removeChild(this.getChildAt(index));
      }
    };

  const Container = withChildren(sdk.DisplayObjectContainer);
  const Sprite = withChildren(sdk.Sprite);
  const EventDispatcher = withEvents(sdk.EventDispatcher);

  class Bitmap extends Container {
    #texture;
    #stopWatching;
    #sourceEntry;
    #bitmap;
    #panel;
    #panelKey;
    #textureArea;
    #sheet;
    #paged;
    #width;
    #height;

    constructor(texture) {
      super();
      if (texture !== undefined) this.texture = texture;
    }

    // Egret 5 sizes a bitmap's content inside its own coordinate system. Scaling the event target
    // itself would turn a drop on a stretched board into a position in the original texture.
    get width() {
      return this.#width ?? this.#texture?.textureWidth ?? 0;
    }
    set width(value) {
      if (value >= 0 || Number.isNaN(value)) {
        this.#width = Number.isNaN(value) ? undefined : value;
        this.#resize();
      }
    }
    get height() {
      return this.#height ?? this.#texture?.textureHeight ?? 0;
    }
    set height(value) {
      if (value >= 0 || Number.isNaN(value)) {
        this.#height = Number.isNaN(value) ? undefined : value;
        this.#resize();
      }
    }
    #resize() {
      if (this.#bitmap && this.#texture?.textureWidth > 0 && this.#texture?.textureHeight > 0) {
        this.#bitmap.scaleX = this.width / this.#texture.textureWidth;
        this.#bitmap.scaleY = this.height / this.#texture.textureHeight;
      }
      if (this.hitArea === this.#textureArea) {
        this.hitArea =
          this.width > 0 && this.height > 0 ? { x: 0, y: 0, width: this.width, height: this.height } : undefined;
        this.#textureArea = this.hitArea;
      }
    }
    get texture() {
      return this.#texture;
    }

    // An EUI grid stretches the center even when fillMode is clip. If either pair of
    // fixed borders cannot fit, the legacy player scales the whole source instead.
    drawLegacyImage(width, height, grid, fillMode) {
      const bitmap = this.#bitmap;
      if (!bitmap || !this.#texture || !textures.has(this.#texture)) return;
      const entry = textures.get(this.#texture);
      const { textureWidth, textureHeight } = this.#texture;
      const frame = entry.frame;
      const sourceWidth = frame?.width ?? textureWidth;
      const sourceHeight = frame?.height ?? textureHeight;
      const offsetX = frame?.offsetX ?? 0;
      const offsetY = frame?.offsetY ?? 0;
      const targetWidth = width - (textureWidth - sourceWidth);
      const targetHeight = height - (textureHeight - sourceHeight);
      if (grid && entry.tiles)
        refuse('LEGACY_WEB_TEXTURE_UNSUPPORTED', 'Nine-slice scaling of a repaged atlas is unsupported.');
      if (grid) {
        const left = Math.min(sourceWidth - 1, grid.x - offsetX);
        const top = Math.min(sourceHeight - 1, grid.y - offsetY);
        const right = sourceWidth - left - (grid.width || 1);
        const bottom = sourceHeight - top - (grid.height || 1);
        if (Math.min(left, top, right, bottom) < 0)
          refuse('LEGACY_WEB_TEXTURE_UNSUPPORTED', 'The nine-slice center must be inside the stored image.');
        if (targetWidth > 0 && targetHeight > 0 && left + right <= targetWidth && top + bottom <= targetHeight) {
          const key = [left, top, right, bottom].join(',');
          if (key !== this.#panelKey) {
            this.#panel?.dispose();
            this.#panel = undefined;
            this.#panelKey = key;
          }
          const insets = { left, top, right, bottom };
          if (!frame) {
            if (!this.#panel) this.#panel = new sdk.NineSliceBitmap(entry, { width, height, insets });
            else if (this.#panel.targetWidth !== width || this.#panel.targetHeight !== height)
              this.#panel.resize(width, height);
          } else if (!this.#panel || this.#panel.width !== targetWidth || this.#panel.height !== targetHeight) {
            const source = sdk.createNineSliceGeometry2D({
              sourceWidth,
              sourceHeight,
              targetWidth,
              targetHeight,
              insets
            });
            // A packed frame borrows its existing page. Its local UVs refer only to that frame's pixels.
            const geometry = sdk.createTexturedGeometry2D({
              positions: Float64Array.from(source.positions),
              uvs: Float64Array.from(source.uvs, (v, i) =>
                i % 2
                  ? (frame.y + v * sourceHeight) / entry.page.value.height
                  : (frame.x + v * sourceWidth) / entry.page.value.width
              ),
              lightColors: Float64Array.from(source.lightColors),
              indices: Uint16Array.from(source.indices)
            });
            if (this.#panel) this.#panel.setContent(entry.page, geometry);
            else this.#panel = new sdk.Mesh2D(entry.page, geometry);
          }
          if (!this.#panel.parent) {
            this.#panel.touchEnabled = false;
            this.#panel.x = offsetX;
            this.#panel.y = offsetY;
            super.addChild(this.#panel);
          }
          bitmap.visible = false;
          return;
        }
      }
      this.#panel?.dispose();
      this.#panel = this.#panelKey = undefined;
      bitmap.visible = true;
      const clip = !grid && fillMode === 'clip';
      if (clip) {
        bitmap.scaleX = bitmap.scaleY = 1;
        const w = Math.min(width, textureWidth),
          h = Math.min(height, textureHeight);
        if (w === 0 || h === 0) bitmap.visible = false;
        else if (bitmap.clipRect?.width !== w || bitmap.clipRect?.height !== h)
          bitmap.clipRect = { x: 0, y: 0, width: w, height: h };
      } else {
        bitmap.clipRect = undefined;
        bitmap.scaleX = width / textureWidth;
        bitmap.scaleY = height / textureHeight;
      }
    }

    set texture(value) {
      const lease = value == null ? undefined : textures.get(value);
      if (value != null && lease === undefined && !textureTypes.has(value))
        refuse('LEGACY_WEB_TEXTURE_UNSUPPORTED', 'Bitmap needs an image acquired by the admitted RES configuration.');
      if (value !== this.#texture) {
        this.#stopWatching?.();
        this.#stopWatching = textureTypes.watch(value, () => {
          if (!this.isDisposed) this.texture = value;
        });
      }
      if (value !== this.#texture || lease !== this.#sourceEntry) {
        this.#panel?.dispose();
        this.#panel = this.#panelKey = undefined;
      }
      if (this.#sheet || lease?.sheet || this.#paged || lease?.tiles || !lease) {
        if (this.#bitmap) this.#bitmap.dispose();
        this.#bitmap = undefined;
      }
      if (this.#bitmap === undefined && lease !== undefined) {
        if (lease.tiles) {
          const composite = createPagedBitmap(sdk, lease);
          composite.apply({ x: 0, y: 0, width: lease.width, height: lease.height });
          this.#bitmap = composite.display;
        } else this.#bitmap = lease.sheet ? lease.sheet.createBitmap(lease.name) : new sdk.Bitmap(lease);
        this.#bitmap.touchEnabled = false;
        super.addChild(this.#bitmap);
      } else if (this.#bitmap !== undefined) this.#bitmap.textureLease = lease;
      this.#sheet = lease?.sheet;
      this.#paged = Boolean(lease?.tiles);
      this.#texture = value;
      this.#sourceEntry = lease;
      this.#resize();
    }
    dispose() {
      this.#stopWatching?.();
      super.dispose();
    }
  }

  class TextField extends Container {
    static default_fontFamily = 'Arial';
    #editing = false;
    #type = 'dynamic';
    #inputArea;
    inputType = TextFieldInputType.TEXT;
    maxChars = 0;
    restrict = null;
    multiline = false;
    get type() {
      return this.#type;
    }
    set type(value) {
      if (!Object.values(TextFieldType).includes(value)) throw new TypeError('Invalid text field type');
      if (value === this.#type) return;
      this.#type = value;
      if (value === 'input') {
        this.touchEnabled = true;
        this.addEventListener(tap, this.setFocus, this);
      } else {
        this.removeEventListener(tap, this.setFocus, this);
        editor.detach(this);
      }
      this.updateLegacyInputArea();
    }
    updateLegacyInputArea() {
      if (this.hitArea !== undefined && this.hitArea !== this.#inputArea) return;
      this.hitArea =
        this.#type === 'input' ? { x: 0, y: 0, width: this.width || 100, height: this.height || 30 } : undefined;
      // The display tree owns and freezes a copy of the supplied rectangle.
      this.#inputArea = this.hitArea;
    }
    setFocus() {
      editor.focus(this);
    }
    setLegacyEditing(value) {
      this.#editing = value;
      if (value) this.#leave();
      else if (!this.isDisposed && stageOf(this)) this.#enter();
    }
    #label;
    #owner;
    #rasterActive = true;
    #flow;
    #listensForLinks = false;
    #drawnFlow;
    #flowHitArea;
    #flowOptions;
    #flowOwner;
    #revision = 0;
    #width;
    #height;
    #textAlign = 'left';

    // Legacy TextField dimensions are layout bounds, including before its first raster exists.
    get width() {
      return this.#width ?? super.width;
    }
    set width(value) {
      const next = this.#dimension(value);
      if (this.#width === next) return;
      this.#width = next;
      if (this.#type === 'input') this.updateLegacyInputArea();
      if (this.#flow) this.#refreshFlow();
      else this.#positionLabel();
    }
    get height() {
      return this.#height ?? super.height;
    }
    get legacyRasterBoxHeight() {
      return this.#height;
    }
    set height(value) {
      const next = this.#dimension(value);
      if (this.#height === next) return;
      this.#height = next;
      if (this.#type === 'input') this.updateLegacyInputArea();
      if (this.#flow) this.#refreshFlow();
    }
    #dimension(value) {
      if (Number.isNaN(value)) return undefined;
      if (!Number.isFinite(value) || value < 0) throw new RangeError('Invalid legacy text box size');
      return value;
    }
    get textAlign() {
      return this.#textAlign;
    }
    set textAlign(value) {
      if (!['left', 'center', 'right'].includes(value))
        refuse('LEGACY_WEB_TEXT_UNSUPPORTED', 'Unsupported text alignment');
      if (this.#textAlign === value) return;
      this.#textAlign = value;
      if (this.#flow) this.#refreshFlow();
      else this.#positionLabel();
    }
    #positionLabel() {
      if (!this.#label) return;
      const display = this.#label.display;
      const bounds = display.getBounds();
      const remaining = this.#width === undefined ? 0 : this.#width - bounds.width;
      display.x =
        (this.#textAlign === 'center' ? remaining / 2 : this.#textAlign === 'right' ? remaining : 0) - bounds.x;
    }
    onLegacyTextReady() {
      this.#positionLabel();
    }
    #style = {
      text: '',
      fontSize: 30,
      color: 0xffffff,
      fontFamily: TextField.default_fontFamily,
      fontWeight: 400,
      italic: false,
      strokeWidth: 0,
      strokeColor: 0
    };

    constructor() {
      super();
      atlasFields.set(this, () => this.#atlasLayout());
      labels.set(this, {
        enter: () => this.#enter(),
        leave: () => {
          editor.detach(this);
          this.#leave();
        }
      });
    }

    #atlasLayout() {
      if (this.#type === 'input' || this.background || this.border || this.displayAsPassword || this.scrollV > 1)
        refuse(
          'LEGACY_TEXT_ATLAS_UNSUPPORTED',
          'An atlas accepts static text without password masking, scrolling, background or border.'
        );
      return layoutTextFlow(
        this.#flow ?? [{ text: this.#style.text }],
        this.#style,
        {
          width: this.#width,
          height: this.#height,
          align: this.#textAlign,
          verticalAlign: this.verticalAlign,
          lineSpacing: this.lineSpacing,
          ...this.#flowOptions
        },
        ports
      );
    }
    getBounds(options) {
      if (
        options === undefined &&
        this.#type !== 'input' &&
        this.#style.text &&
        !this.#label &&
        !this.#flowOwner &&
        !stageOf(this) &&
        typeof ports.measureLine === 'function' &&
        !this.isDisposed
      ) {
        const plan = this.#atlasLayout();
        return { x: 0, y: 0, width: plan.width, height: plan.height };
      }
      return super.getBounds(options);
    }
    #listenForLinks(enabled) {
      if (enabled === this.#listensForLinks) return;
      this.#listensForLinks = enabled;
      if (enabled) this.addEventListener(tap, this.#activateLink, this);
      else this.removeEventListener(tap, this.#activateLink, this);
    }

    #activateLink(event) {
      const plan = this.#drawnFlow;
      if (!plan || !this.touchEnabled) return;
      const { x, y } = this.globalToLocal(event.stageX, event.stageY);
      if (x < 0 || y < 0 || x >= plan.width || y >= plan.height) return;
      const hit = plan.fragments.find(
        part => x >= part.x && x < part.x + part.width && y >= part.lineTop && y < part.lineTop + part.lineHeight
      );
      if (hit?.href) TextEvent.dispatchTextEvent(this, TextEvent.LINK, hit.href.slice('event:'.length));
    }

    get hasLegacyTextFlow() {
      return this.#flow !== undefined;
    }

    setLegacyFlowBox(width, height, align, verticalAlign, lineSpacing) {
      const next = { width, height, align, verticalAlign, lineSpacing };
      if (JSON.stringify(this.#flowOptions) === JSON.stringify(next)) return;
      this.#flowOptions = next;
      if (this.#flow) this.#refreshFlow();
    }

    #refreshFlow() {
      if (!this.#flow || !this.#owner) return;
      const owner = this.#owner;
      const revision = ++this.#revision;
      this.#drawnFlow = undefined;
      this.#flowOwner?.dispose();
      this.#flowOwner = undefined;
      observe(
        Promise.resolve().then(async () => {
          if (this.#owner !== owner || revision !== this.#revision) return;
          const scope = game.engine.createScope();
          this.#flowOwner = scope;
          try {
            const plan = layoutTextFlow(
              this.#flow,
              this.#style,
              {
                width: this.#width,
                height: this.#height,
                align: this.#textAlign,
                ...this.#flowOptions
              },
              ports
            );
            const display = scope.use(new sdk.Sprite());
            display.touchEnabled = false;
            display.touchChildren = false;
            if (
              this.#flowOptions?.width !== undefined ||
              this.#flowOptions?.height !== undefined ||
              this.#width !== undefined ||
              this.#height !== undefined
            )
              display.clipRect = { x: 0, y: 0, width: plan.width, height: plan.height };
            for (const part of plan.fragments) {
              if (this.#flowOwner !== scope) return;
              const label = await game.createLabel({ ...part.style, text: part.text, scope });
              if (this.#flowOwner !== scope) {
                label.dispose();
                return;
              }
              label.set({ ...part.style, text: part.text });
              await label.ready;
              if (this.#flowOwner !== scope) return;
              label.display.x = part.x;
              label.display.y = part.y;
              display.addChild(label.display);
              if (part.underline && part.width > 0)
                display.graphics
                  .beginFill(part.style.color)
                  .drawRect(part.x, part.y + part.style.fontSize - 1, part.width, 1)
                  .endFill();
            }
            if (this.#flowOwner === scope) {
              this.addChildAt(display, 0);
              this.#drawnFlow = plan;
              if (this.hitArea === undefined || this.hitArea === this.#flowHitArea) {
                this.hitArea = { x: 0, y: 0, width: plan.width, height: plan.height };
                this.#flowHitArea = this.hitArea;
              }
            }
          } catch (error) {
            if (this.#flowOwner !== scope) return;
            this.#flowOwner = undefined;
            scope.dispose();
            throw error;
          }
        })
      );
    }

    get textFlow() {
      return this.#flow ? captureTextFlow(this.#flow) : [{ text: this.#style.text }];
    }

    set textFlow(rows) {
      const captured = captureTextFlow(rows);
      this.#leave();
      this.#flow = captured;
      this.#listenForLinks(captured.some(row => row.style?.href !== undefined));
      this.#style.text = captured.map(row => row.text).join('');
      if (stageOf(this)) this.#enter();
    }

    #enter() {
      if (this.#editing || !this.#rasterActive || this.#owner !== undefined || game.scope.signal.aborted) return;
      // Offstage legacy text stays attachable but releases both the prepared raster and pending work.
      const owner = game.engine.createScope();
      this.#owner = owner;
      if (this.#flow) {
        this.#refreshFlow();
        return;
      }
      observe(
        Promise.resolve().then(async () => {
          if (this.#owner !== owner) return;
          try {
            const label = await game.createLabel({ ...this.#style, scope: owner });
            if (this.#owner !== owner) {
              label.dispose();
              return;
            }
            this.#label = label;
            this.addChildAt(label.display, 0);
            label.set(this.#style);
            await label.ready;
            if (this.#owner === owner) this.onLegacyTextReady?.();
          } catch (error) {
            if (this.#owner !== owner) return;
            this.#leave();
            throw error;
          }
        })
      );
    }

    #leave(clearHitArea = true) {
      const owner = this.#owner;
      this.#owner = undefined;
      this.#revision++;
      if (clearHitArea && this.#flowHitArea && !this.isDisposed && this.hitArea === this.#flowHitArea)
        this.hitArea = undefined;
      this.#flowHitArea = undefined;
      this.#drawnFlow = undefined;
      this.#flowOwner?.dispose();
      this.#flowOwner = undefined;
      this.#label = undefined;
      owner?.dispose();
    }

    setLegacyRasterActive(active) {
      if (this.#rasterActive === active || this.isDisposed) return;
      this.#rasterActive = active;
      if (!active) this.#leave();
      else if (stageOf(this)) this.#enter();
    }

    get legacyTextDisplay() {
      return this.#label?.display;
    }

    dispose() {
      editor.detach(this);
      this.#leave(false);
      super.dispose();
    }

    #change(key, value) {
      this.#style[key] = value;
      if (this.#flow) {
        this.#refreshFlow();
        return;
      }
      if (this.#label === undefined) return;
      const label = this.#label;
      label.set({ [key]: value });
      observe(
        label.ready.then(
          () => {
            if (this.#label === label) this.onLegacyTextReady?.();
          },
          error => {
            if (this.#label === label) throw error;
          }
        )
      );
    }

    get text() {
      return this.#style.text;
    }

    set text(value) {
      if (this.#flow) {
        this.#leave();
        this.#flow = undefined;
        this.#listenForLinks(false);
        this.#style.text = String(value);
        if (stageOf(this)) this.#enter();
      } else this.#change('text', String(value));
    }

    get size() {
      return this.#style.fontSize;
    }

    set size(value) {
      this.#change('fontSize', value);
    }

    get textColor() {
      return this.#style.color;
    }

    set textColor(value) {
      this.#change('color', value);
    }

    get stroke() {
      return this.#style.strokeWidth;
    }

    set stroke(value) {
      if (!Number.isFinite(value) || value < 0 || value > 512) throw new RangeError('Invalid text outline radius');
      this.#change('strokeWidth', value);
    }

    get strokeColor() {
      return this.#style.strokeColor;
    }

    set strokeColor(value) {
      if (!Number.isInteger(value) || value < 0 || value > 0xffffff) throw new RangeError('Invalid text outline color');
      this.#change('strokeColor', value);
    }

    get fontFamily() {
      return this.#style.fontFamily;
    }

    set fontFamily(value) {
      this.#change('fontFamily', value);
    }

    get bold() {
      return this.#style.fontWeight === 700;
    }

    set bold(value) {
      this.#change('fontWeight', value ? 700 : 400);
    }

    get italic() {
      return this.#style.italic;
    }

    set italic(value) {
      this.#change('italic', value);
    }
  }

  // The stage is as large as the screen plan makes it: the design with showAll, noBorder and exactFit, and as Egret 5
  // sized it with the fixed modes, where it changes with the window and tells of it with Event.RESIZE.
  const stageWidth = () => game.screen?.width ?? options.width;
  const stageHeight = () => game.screen?.height ?? options.height;
  class Stage extends Container {
    get scaleMode() {
      return stagePolicy(game.scope, ports.environment, 'scaleMode');
    }
    set scaleMode(value) {
      stagePolicy(game.scope, ports.environment, 'scaleMode', value);
    }
    get orientation() {
      return stagePolicy(game.scope, ports.environment, 'orientation');
    }
    set orientation(value) {
      stagePolicy(game.scope, ports.environment, 'orientation', value);
    }
    get stageWidth() {
      return stageWidth();
    }

    get stageHeight() {
      return stageHeight();
    }
  }

  stage = game.scope.use(new Stage());
  stage.touchEnabled = true;
  stage.hitArea = { x: 0, y: 0, width: stageWidth(), height: stageHeight() };
  game.stage.addChild(stage);
  // Egret 5 hit-tests each move/end. Dragging a piece releases on the square or piece under the finger.
  if (game.pointer.events.begin) {
    stage.on(game.pointer.events.begin, event => game.pointer.releaseCapture(event.payload.session), { capture: true });
  }

  const RES = resourcesFor(
    sdk,
    game,
    ports.readAsset ?? ports.readJson,
    options.resources,
    textures,
    textureTypes,
    bitmapFonts,
    options.sheets ?? [],
    options.moviePages ?? [],
    EventDispatcher,
    LegacyEvent,
    observe,
    listener => gameServices.callLater(listener, undefined),
    ports,
    report
  );
  if (options.theme)
    ui = createLegacyEui({
      sdk,
      Container,
      Bitmap,
      TextField,
      RES,
      bitmapFonts,
      EventDispatcher,
      LegacyEvent,
      game,
      callLater: callback => gameServices.callLater(callback, undefined),
      measureLine: ports.measureLine,
      graphemes: ports.graphemes,
      theme: options.theme,
      stageOf,
      observe,
      events: { complete, creationComplete, change, changing, itemTap, collectionChange, propertyChange },
      stageSize: {
        get width() {
          return stageWidth();
        },
        get height() {
          return stageHeight();
        }
      }
    });
  // A new stage size: the stage's hit area, the layout of every EUI root against it, then Event.RESIZE, as in Egret 5.
  let lastSize = stageWidth() + 'x' + stageHeight();
  const stopScreen = game.onScreenChange?.(() => {
    const size = stageWidth() + 'x' + stageHeight();
    if (size === lastSize || stage.isDisposed) return;
    lastSize = size;
    stage.hitArea = { x: 0, y: 0, width: stageWidth(), height: stageHeight() };
    ui?.resize();
    try {
      stage.dispatchEventWith(LegacyEvent.RESIZE);
    } catch (error) {
      report(error);
    }
  });
  if (stopScreen) game.scope.signal.addEventListener('abort', stopScreen, { once: true });
  const dragonBones = options.nativeBones
    ? createLegacyBones({ sdk, game, Container, getTexture: value => textures.get(value) })
    : undefined;

  const ticks = new Map();
  const startTick = (callback, receiver) => {
    if (typeof callback !== 'function') throw new TypeError('Expected a tick callback');
    let byReceiver = ticks.get(callback);
    if (byReceiver?.has(receiver)) return;
    if (!byReceiver) ticks.set(callback, (byReceiver = new Map()));
    byReceiver.set(
      receiver,
      game.engine.clock.onTick(game.scope, tick => {
        callback.call(receiver, tick.elapsedSeconds * 1000);
      })
    );
  };
  const stopTick = (callback, receiver) => {
    const byReceiver = ticks.get(callback);
    byReceiver?.get(receiver)?.dispose();
    byReceiver?.delete(receiver);
    if (!byReceiver?.size) ticks.delete(callback);
  };
  const ticker = Object.freeze({ pause: () => game.engine.clock.pause(), resume: () => game.engine.clock.resume() });
  const { lifecycle } = frameEvents;
  const unsubscribeVisibility = ports.onVisibility?.(hidden => frameEvents.setActive(!hidden));
  game.scope.signal.addEventListener(
    'abort',
    () => {
      unsubscribeVisibility?.();
      ticks.clear();
    },
    { once: true }
  );

  const gameServices = createLegacyGameServices(
    game,
    name => {
      const registered = ui?.resolveDefinition(name);
      if (registered !== undefined) return registered;
      const parts = name.split('.');
      let current = Object.hasOwn(api, parts[0]) ? api : globalThis;
      for (const part of parts) {
        if (current == null) return undefined;
        current = Object.getOwnPropertyDescriptor(current, part)?.value ?? readProjectMethod(current, part);
      }
      return current;
    },
    ports.now,
    { Event: LegacyEvent, EventDispatcher }
  );
  let api = Object.freeze({
    egret: Object.freeze({
      ...gameServices,
      ...legacyHost(game.scope, stage, ports.environment, identity),
      ...textureTypes.types,
      ImageLoader: classicImageLoader(EventDispatcher, game, textureTypes.ownImage, observe, ports.checkImageOrigin),
      ...createLegacyTransport({
        EventDispatcher,
        LegacyEvent,
        signal: game.scope.signal,
        port: ports.transport,
        channel: ports.channel,
        report
      }),
      DisplayObjectContainer: Container,
      Sprite,
      Shape: Sprite,
      Bitmap,
      TextField,
      HtmlTextParser,
      TextEvent,
      FocusEvent,
      TextFieldType,
      TextFieldInputType,
      ...classicFilters.types,
      ...createLegacyMovieClips({ sdk, game, Container, LegacyEvent, textures }),
      ByteArray,
      Endian,
      Point: sdk.Point,
      Rectangle: sdk.Rectangle,
      Matrix: sdk.Matrix,
      Event: LegacyEvent,
      EventDispatcher,
      startTick,
      stopTick,
      ticker,
      lifecycle,
      TouchEvent,
      EventPhase,
      HorizontalAlign,
      VerticalAlign,
      BlendMode,
      localStorage: projectStorage(ports.storage, options.projectId)
    }),
    RES,
    eui: ui?.eui,
    dragonBones
  });
  api = extendProjectBindings(api, game.scope, options.provideBindings);
  api = installProjectMethods(api, game.scope, options.projectMethods);
  return {
    api,
    async mount(root) {
      if (!(root instanceof Container) && !(root instanceof Sprite)) {
        refuse('LEGACY_WEB_ENTRY_UNSUPPORTED', 'The legacy entry must create a supported display container.');
      }
      try {
        stage.addChild(root);
        for (let index = 0; index < opening.length; index++) await opening[index];
      } finally {
        opening.length = 0;
        booting = false;
      }
    }
  };
}

/** Start the newly generated page on the public Egret browser game. The original runtime is not loaded. */
export async function launchLegacyWeb(sdk, options) {
  if (typeof options.projectId !== 'string' || !/^p_[A-Za-z0-9_-]{1,126}$/.test(options.projectId)) {
    refuse('LEGACY_WEB_PROJECT_INVALID', 'A portable project ID is required.');
  }
  const game = await sdk.createBrowserGame({
    canvas: options.canvas,
    width: options.width,
    height: options.height,
    fit: options.fit ?? 'contain',
    backend: 'webgl2',
    blendSpace: 'srgb',
    effects: true,
    onError: options.onError,
    autoStart: false
  });
  try {
    const doc = options.canvas.ownerDocument,
      view = doc.defaultView;
    const controller = new view.AbortController();
    const cancel = () => controller.abort(game.scope.signal.reason);
    if (game.scope.signal.aborted) cancel();
    else game.scope.signal.addEventListener('abort', cancel, { once: true });
    let measureContext, segmenter;
    const { api, mount } = createLegacyBindings(sdk, game, options, {
      sharedEffects: true,
      loadSound: browserClassicMusic(view, controller.signal),
      resourceUsage() {
        const labels = game.getLabelStatus();
        return { drawingLabels: labels.drawing, queuedLabels: labels.queued, atlasPages: labels.atlasPages };
      },
      openEditor: browserClassicEditor(sdk, options.canvas, game),
      environment: browserEnvironment(view, game.backend, options.fit ?? 'contain'),
      checkImageOrigin(url, mode) {
        const destination = new URL(url, doc.baseURI);
        if (!['http:', 'https:'].includes(destination.protocol) || destination.username || destination.password)
          throw new Error('ImageLoader accepts HTTP(S) image URLs without credentials.');
        if (destination.origin !== view.location.origin && mode !== 'anonymous')
          throw new Error('Set ImageLoader.crossOrigin to anonymous for a CORS-enabled image origin.');
      },
      atlasRaster: (width, height, runs) => browserAtlasRaster(doc, game, width, height, runs),
      imageSource(source) {
        const copy = doc.createElement('canvas');
        copy.width = source.naturalWidth ?? source.width;
        copy.height = source.naturalHeight ?? source.height;
        const context = copy.getContext('2d');
        if (!context) throw new Error('Could not capture the legacy image.');
        context.drawImage(source, 0, 0);
        return game.textureFromCanvas(copy);
      },
      async pngBytes({ data, width, height }) {
        const bytes = Uint8Array.from(view.atob(data), c => c.charCodeAt(0));
        const blob = new view.Blob([bytes], { type: 'image/png' });
        const url = view.URL.createObjectURL(blob);
        try {
          const image = new view.Image();
          image.src = url;
          await image.decode();
          if (image.naturalWidth !== width || image.naturalHeight !== height)
            throw new Error('Unexpected decoded PNG dimensions.');
          return await this.imageSource(image);
        } finally {
          view.URL.revokeObjectURL(url);
        }
      },
      transport: view ? browserTransport(view) : undefined,
      channel: options.externalChannel,
      storage: () => options.storage ?? view?.localStorage,
      reportError: view?.reportError?.bind(view),
      async readAsset(item) {
        const response = await view.fetch(item.url, { signal: controller.signal });
        if (!response.ok)
          refuse('LEGACY_WEB_RESOURCE_READ_FAILED', 'Could not load ' + item.name + ' (HTTP ' + response.status + ').');
        if (item.type === 'bin') return response.arrayBuffer();
        if (item.type === 'text') return response.text();
        return response.json();
      },
      measureLine(words, font) {
        measureContext ??= doc.createElement?.('canvas').getContext('2d');
        if (!measureContext) return undefined;
        measureContext.font = font;
        return measureContext.measureText(words).width;
      },
      *graphemes(text) {
        segmenter ??= new Intl.Segmenter(undefined, { granularity: 'grapheme' });
        for (const part of segmenter.segment(text)) yield part.segment;
      },
      onVisibility(listener) {
        const visibility = () => listener(doc.hidden);
        doc.addEventListener?.('visibilitychange', visibility);
        return () => doc.removeEventListener?.('visibilitychange', visibility);
      }
    });
    await mount(await options.createMain(api));
    game.loop.start();
    return game;
  } catch (cause) {
    try {
      await game.dispose();
    } catch (cleanup) {
      throw new AggregateError([cause, cleanup], 'Legacy game startup and cleanup failed.');
    }
    throw cause;
  }
}
