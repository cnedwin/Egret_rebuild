// SPDX-License-Identifier: Apache-2.0
const resourceTypes = Object.freeze({
  TYPE_IMAGE: 'image',
  TYPE_TEXT: 'text',
  TYPE_JSON: 'json',
  TYPE_BIN: 'bin',
  TYPE_SHEET: 'sheet',
  TYPE_FONT: 'font',
  TYPE_SOUND: 'sound',
  TYPE_XML: 'xml'
});

function inferType(url) {
  const extension = url.slice(url.lastIndexOf('.') + 1).toLowerCase();
  if (extension === 'json') return 'json';
  if (['png', 'jpeg', 'jpg', 'webp'].includes(extension)) return 'image';
  if (['txt', 'csv'].includes(extension)) return 'text';
  return 'bin';
}

/** Classic resource names, URL aliases and group membership share one owner and one cache. */
export function createResourceCatalog({
  declared,
  groups,
  sheets,
  frameOf,
  localPath,
  load,
  unload,
  onError,
  root,
  requireOpen,
  watch
}) {
  const urls = new Map();
  const loadedGroups = new Map();
  const temporary = new Set();
  let closed = false;
  for (const item of declared.values()) if (!urls.has(item.url)) urls.set(item.url, item.name);

  function keyOf(key) {
    if (closed) return undefined;
    const frame = frameOf(key);
    if (frame && sheets.get(frame[0])?.frames.some(row => row.name === frame[1])) return frame[0];
    return declared.has(key) ? key : urls.get(key);
  }
  function info(key) {
    const item = declared.get(keyOf(key));
    if (!item) return null;
    const prefix = root && item.url.startsWith(root) ? root : '';
    return {
      name: item.name,
      type: sheets.has(item.name) ? 'sheet' : item.type,
      root: prefix,
      url: item.url.slice(prefix.length)
    };
  }
  function members(name) {
    const keys = groups.get(name) ?? [];
    return [...new Set(keys.map(keyOf).filter(key => key !== undefined))];
  }
  function dependsOn(name, seen) {
    seen.add(name);
    const page = sheets.get(name)?.page;
    if (page) seen.add(page);
  }
  function release(key) {
    const released = unload(key);
    if (temporary.delete(key)) {
      urls.delete(declared.get(key).url);
      declared.delete(key);
      return true;
    }
    return released;
  }
  return {
    close() {
      closed = true;
      loadedGroups.clear();
      temporary.clear();
      urls.clear();
      declared.clear();
      groups.clear();
    },
    groupLoaded(name, captured) {
      // A replacement may finish before an earlier read. Release only names the group actually requested.
      const previous = loadedGroups.get(name) ?? [];
      const loaded = captured.map(keyOf).filter(key => key !== undefined);
      loadedGroups.set(name, [...new Set([...previous, ...loaded])]);
      return groups.get(name) === captured;
    },
    resolveName: keyOf,
    api: {
      ResourceItem: resourceTypes,
      hasRes(key) {
        return keyOf(key) !== undefined;
      },
      getResourceInfo: info,
      getGroupByName(name) {
        return members(name).map(info);
      },
      createGroup(name, keys, override = false) {
        requireOpen();
        if (
          typeof name !== 'string' ||
          !name ||
          !Array.isArray(keys) ||
          !keys.length ||
          keys.some(key => typeof key !== 'string') ||
          (groups.has(name) && !override)
        )
          return false;
        const expanded = keys.flatMap(key => groups.get(key) ?? [key]);
        groups.set(name, [...new Set(expanded)]);
        return true;
      },
      async getResByUrl(url, callback, receiver, type = '') {
        requireOpen();
        if (!localPath(url)) throw new TypeError('Expected a project-local resource URL.');
        const known = urls.get(url) ?? (declared.has(url) ? url : undefined);
        const key = known ?? url;
        if (known === undefined) {
          const kind = type || inferType(url);
          if (!['image', 'json', 'text', 'bin'].includes(kind))
            throw new TypeError('Unsupported URL resource type: ' + kind);
          temporary.add(key);
          declared.set(key, { name: key, url, type: kind });
          urls.set(url, key);
        }
        const generation = watch(key);
        let value;
        try {
          value = await load(key);
        } catch (error) {
          generation.check();
          onError(declared.get(key));
          generation.check();
          if (callback) {
            callback.call(receiver, null, url);
            throw null;
          }
          throw error;
        }
        generation.check();
        callback?.call(receiver, value, url);
        return value;
      },
      destroyRes(name, force = true) {
        if (!groups.has(name)) {
          const key = keyOf(name);
          return key !== undefined && release(key);
        }
        const group = loadedGroups.get(name);
        if (!group) return false;
        loadedGroups.delete(name);
        const keep = new Set();
        if (!force) for (const other of loadedGroups.values()) for (const key of other) dependsOn(key, keep);
        const drop = new Set();
        for (const key of group) dependsOn(key, drop);
        for (const key of drop) if (!keep.has(key)) release(key);
        return true;
      }
    }
  };
}
