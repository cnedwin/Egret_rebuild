// SPDX-License-Identifier: Apache-2.0
// Browser-only bindings for the declarations admitted by the legacy Web 2D migration profile.
const added = 'addedToStage';
const tap = 'touchTap';

function refuse(code, message) {
  throw Object.assign(new Error(message), { code });
}

function projectStorage(view, supplied, projectId) {
  const prefix = 'egret7:legacy:' + projectId + ':';
  const storage = () => supplied ?? view?.localStorage;
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

function resourcesFor(game, view, plan, textures) {
  const declared = new Map();
  const groups = new Map();
  for (const item of plan?.resources ?? []) {
    if (declared.has(item.name) || !localPath(item.url) || !['image', 'json'].includes(item.type)) {
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

  const ready = new Map();
  const pending = new Map();
  // Fetch requires a browser AbortSignal. Keep it tied to the same scope as image leases.
  const controller = new view.AbortController();
  const cancel = () => controller.abort(game.scope.signal.reason);
  if (game.scope.signal.aborted) cancel();
  else game.scope.signal.addEventListener('abort', cancel, { once: true });
  let configured = false;

  async function read(item) {
    if (item.type === 'image') {
      const lease = await game.loadTexture(item.url);
      const resource = Object.freeze({ textureWidth: lease.value.width, textureHeight: lease.value.height });
      textures.set(resource, lease);
      return resource;
    }
    const response = await view.fetch(item.url, { signal: controller.signal });
    if (!response.ok)
      refuse('LEGACY_WEB_RESOURCE_READ_FAILED', 'Could not load ' + item.name + ' (HTTP ' + response.status + ').');
    return response.json();
  }

  function load(name) {
    if (!configured) refuse('LEGACY_WEB_CONFIG_REQUIRED', 'Load the admitted configuration first.');
    const item = declared.get(name);
    if (item === undefined) refuse('LEGACY_WEB_RESOURCE_UNKNOWN', 'Unknown resource: ' + name);
    if (ready.has(name)) return Promise.resolve(ready.get(name));
    if (!pending.has(name)) {
      const request = read(item)
        .then(value => {
          ready.set(name, value);
          return value;
        })
        .finally(() => pending.delete(name));
      pending.set(name, request);
    }
    return pending.get(name);
  }

  return Object.freeze({
    async loadConfig(url, root) {
      if (plan === undefined || url !== plan.configUrl || root !== plan.root) {
        refuse('LEGACY_WEB_CONFIG_UNSUPPORTED', 'Only the configuration admitted by migration can be loaded.');
      }
      configured = true;
    },
    getRes: name => ready.get(name) ?? null,
    async getResAsync(name, callback, receiver) {
      const value = await load(name);
      callback?.call(receiver, value, name);
      return value;
    },
    async loadGroup(name, _priority, reporter) {
      const keys = groups.get(name);
      if (keys === undefined) refuse('LEGACY_WEB_GROUP_UNKNOWN', 'Unknown resource group: ' + name);
      let completed = 0;
      for (const key of keys) {
        await load(key);
        completed++;
        reporter?.onProgress(completed, keys.length);
      }
    },
    isGroupLoaded(name) {
      return groups.get(name)?.every(key => ready.has(key)) ?? false;
    }
  });
}

function createBindings(sdk, game, options) {
  const view = options.canvas.ownerDocument.defaultView;
  const textures = new WeakMap();
  const staged = sdk.createEventType(added);
  const types = new Map([
    [added, staged],
    [tap, game.pointer.events.tap]
  ]);
  const opening = [];
  const labels = new WeakMap();
  let booting = true;
  let stage;

  function report(error) {
    if (typeof options.onError === 'function') options.onError(error);
    else if (typeof view?.reportError === 'function') view.reportError(error);
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

  function moveOnStage(node, previous) {
    const current = stageOf(node);
    if (current === previous) return;
    // Take the list before listeners run. A listener's new children dispatch through their own insertion.
    for (const child of subtree(node)) {
      if (stageOf(child) !== current) continue;
      if (current === null) labels.get(child)?.leave();
      else {
        labels.get(child)?.enter();
        child.dispatchEvent(new sdk.Event(staged, undefined));
      }
    }
  }

  const withEvents = Base =>
    class extends Base {
      #listeners = [];

      get stage() {
        return stageOf(this);
      }

      addEventListener(type, handler, receiver, capture = false, priority = 0) {
        const descriptor = types.get(type);
        if (descriptor === undefined || typeof handler !== 'function') {
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

        const remove = this.on(
          descriptor,
          event => {
            const currentTarget = event.currentTarget;
            let fields = {};
            if (type === tap) {
              const { globalX, globalY, session } = event.payload;
              const { x, y } = currentTarget.globalToLocal(globalX, globalY);
              fields = { stageX: globalX, stageY: globalY, localX: x, localY: y, touchPointID: session.pointerId };
            }
            try {
              const result = handler.call(receiver, {
                type,
                target: event.target,
                currentTarget,
                ...fields,
                stopPropagation: () => event.stopPropagation(),
                stopImmediatePropagation: () => event.stopImmediatePropagation(),
                preventDefault: () => event.preventDefault()
              });
              if (result && typeof result.then === 'function') observe(Promise.resolve(result));
            } catch (error) {
              if (booting) observe(Promise.reject(error));
              else report(error);
            }
          },
          { capture, priority }
        );
        this.#listeners.push({ type, handler, receiver, capture, remove });
      }

      removeEventListener(type, handler, receiver, capture = false) {
        const index = this.#listeners.findIndex(
          entry =>
            entry.type === type && entry.handler === handler && entry.receiver === receiver && entry.capture === capture
        );
        if (index >= 0) this.#listeners.splice(index, 1)[0].remove();
      }

      hasEventListener(type) {
        return this.#listeners.some(entry => entry.type === type);
      }
    };

  const withChildren = Base =>
    class extends withEvents(Base) {
      addChild(child) {
        const before = stageOf(child);
        const inserted = super.addChild(child);
        moveOnStage(inserted, before);
        return inserted;
      }

      addChildAt(child, index) {
        const before = stageOf(child);
        const inserted = super.addChildAt(child, index);
        moveOnStage(inserted, before);
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

  class Bitmap extends Container {
    #texture;
    #bitmap;
    #textureArea;

    constructor(texture) {
      super();
      if (texture !== undefined) this.texture = texture;
    }

    get texture() {
      return this.#texture;
    }

    set texture(value) {
      const lease = value == null ? undefined : textures.get(value);
      if (value != null && lease === undefined)
        refuse('LEGACY_WEB_TEXTURE_UNSUPPORTED', 'Bitmap needs an image acquired by the admitted RES configuration.');
      if (this.#bitmap === undefined && lease !== undefined) {
        this.#bitmap = new sdk.Bitmap(lease);
        super.addChild(this.#bitmap);
      } else if (this.#bitmap !== undefined) this.#bitmap.textureLease = lease;
      // The texture is drawn by a child, while the old Bitmap owns the click target.
      if (this.hitArea === this.#textureArea) {
        this.hitArea = lease ? { x: 0, y: 0, width: lease.value.width, height: lease.value.height } : undefined;
        this.#textureArea = this.hitArea;
      }
      this.#texture = value;
    }
  }

  class TextField extends Container {
    #label;
    #owner;
    #style = { text: '', fontSize: 30, color: 0xffffff, fontFamily: 'Arial', fontWeight: 400, italic: false };

    constructor() {
      super();
      labels.set(this, { enter: () => this.#enter(), leave: () => this.#leave() });
    }

    #enter() {
      if (this.#owner !== undefined) return;
      // Offstage legacy text stays attachable but releases both the prepared raster and pending work.
      const owner = game.engine.createScope();
      this.#owner = owner;
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
            this.addChild(label.display);
            label.set(this.#style);
            await label.ready;
          } catch (error) {
            if (this.#owner !== owner) return;
            this.#leave();
            throw error;
          }
        })
      );
    }

    #leave() {
      const owner = this.#owner;
      this.#owner = undefined;
      this.#label = undefined;
      owner?.dispose();
    }

    dispose() {
      this.#leave();
      super.dispose();
    }

    #change(key, value) {
      this.#style[key] = value;
      if (this.#label === undefined) return;
      const label = this.#label;
      label.set({ [key]: value });
      observe(
        label.ready.catch(error => {
          if (this.#label === label) throw error;
        })
      );
    }

    get text() {
      return this.#style.text;
    }

    set text(value) {
      this.#change('text', String(value));
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

  class Stage extends Container {
    get stageWidth() {
      return options.width;
    }

    get stageHeight() {
      return options.height;
    }
  }

  stage = game.scope.use(new Stage());
  stage.touchEnabled = true;
  stage.hitArea = { x: 0, y: 0, width: options.width, height: options.height };
  game.stage.addChild(stage);

  return {
    api: Object.freeze({
      egret: Object.freeze({
        DisplayObjectContainer: Container,
        Sprite,
        Shape: Sprite,
        Bitmap,
        TextField,
        Point: sdk.Point,
        Rectangle: sdk.Rectangle,
        Matrix: sdk.Matrix,
        Event: Object.freeze({ ADDED_TO_STAGE: added }),
        TouchEvent: Object.freeze({ TOUCH_TAP: tap }),
        localStorage: projectStorage(view, options.storage, options.projectId)
      }),
      RES: resourcesFor(game, view, options.resources, textures)
    }),
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
    const { api, mount } = createBindings(sdk, game, options);
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
