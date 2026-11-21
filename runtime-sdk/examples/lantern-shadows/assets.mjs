// SPDX-License-Identifier: Apache-2.0
import { admitResourceManifest } from '@egret/contracts/resources';
import {
  createAssetRef,
  createAssetType,
  createImageData2D,
  copyImageData2DPixels,
  createTexture,
  isTexture
} from '@egret/engine';
import { createSpineContentLoader } from '@egret/spine';

/** Load the same artwork, Spine rigs and Tiled maps as the pinned browser game. */
export async function loadLanternAssets({ engine, scope, assets, raster, publishPage, signal }) {
  if (!raster) throw new Error('The Lantern Shadows player requires an Android image decoder.');
  const readJson = async (path) => JSON.parse(await assets.readText(path, signal));
  const catalog = await readJson('assets/lantern-index.json');
  const manifest = admitResourceManifest(await readJson('assets/manifest.json'));
  if (!manifest.ok) throw new Error('The Lantern Shadows Spine resource manifest failed admission.');
  const images = new Map(catalog.images.map((image) => [image.source, image]));
  const handles = new WeakMap();

  async function imageOf(image, useSignal) {
    const [first, ...rest] = image.strips;
    if (rest.length === 0) return raster.loadPng(first.file, image.width, image.height, useSignal);
    // Large source pages keep one texture identity and their full resolution. Each
    // PNG decode uses bounded native scratch space before joining the original rows.
    const pixels = new Uint8Array(image.width * image.height * 4);
    let offset = 0;
    for (const strip of image.strips) {
      const part = await raster.loadPng(strip.file, image.width, strip.height, useSignal);
      const bytes = copyImageData2DPixels(part);
      pixels.set(bytes, offset);
      offset += bytes.length;
    }
    if (offset !== pixels.length) throw new Error('Incomplete packaged texture ' + image.source);
    return createImageData2D({ width: image.width, height: image.height, pixels });
  }

  async function textureFor(source, useSignal) {
    const image = images.get(source);
    if (!image) throw new Error('Unknown Lantern Shadows image: ' + source);
    const data = await imageOf(image, useSignal);
    if (useSignal.aborted) throw useSignal.reason;
    const texture = createTexture(data);
    try {
      handles.set(texture, publishPage(image.id, texture.imageData));
      return texture;
    } catch (error) {
      texture.dispose();
      throw error;
    }
  }
  function retire(texture) {
    try {
      handles.get(texture)?.release();
    } finally {
      handles.delete(texture);
      texture.dispose();
    }
  }

  const entries = new Map(manifest.value.entries.map((entry) => [entry.id, entry.artifact.path]));
  const loader = createSpineContentLoader(engine, scope, manifest.value, (bindings) => {
    const paths = new Map(bindings.map((item) => [item.binding.ref.id, entries.get(item.id)]));
    return {
      textures: { load: (ref, context) => textureFor(paths.get(ref.id), context.signal), dispose: retire },
      metadata: {
        load: (ref, context) => assets.readText('assets/' + paths.get(ref.id), context.signal),
        dispose() {}
      }
    };
  });
  const rigs = loader.load(
    scope,
    catalog.puppets.map((name) => 'e_' + name)
  );
  await rigs.ready;
  const type = createAssetType('lantern-scenery', isTexture);
  engine.assets.register(type, {
    load: (ref, context) => textureFor(ref.id, context.signal),
    dispose: retire
  });
  const art = {};
  for (const image of catalog.images) {
    if (image.picture)
      art[image.picture] = scope.use(
        await engine.assets.acquire(createAssetRef(type, image.source), { signal })
      );
  }
  const maps = {};
  for (const name of catalog.maps) maps[name] = await readJson('assets/levels/' + name + '.tmj');
  return { art, puppetOf: (name) => rigs.getSpine('e_' + name), maps };
}
