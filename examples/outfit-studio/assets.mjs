// SPDX-License-Identifier: Apache-2.0
import {admitResourceManifest} from '@egret/contracts/resources';
import {createAssetType, createSequenceClip, createSpriteSheet, isTexture} from '@egret/engine';
import {createManifestAssetBinding} from '@egret/engine/resources';
import {createManifestByteSource, createManifestFontContentLoader, createManifestTextureProvider} from '@egret/engine/web/resources';
import {createCanvasKitFontSetProvider} from '@egret/engine/web/paragraph';
import {createBrowserEditorFontProvider} from '@egret/engine/web/editing';
import {createManifestSpineContentLoader} from '@egret/spine/web';
import {palettes} from './project.mjs';

const utf8 = new TextDecoder('utf-8', {fatal:true});
const vendor = new URL('../paragraph-panel/vendor/', import.meta.url);

export async function fetchStudio(url, signal) {
  const response = await fetch(url, {signal,cache:'no-store',redirect:'error'});
  if (!response.ok) throw new Error(`Studio content HTTP ${response.status}`);
  return response;
}

function admit(data) {
  const result = admitResourceManifest(data);
  if (!result.ok) throw new Error(result.diagnostics[0].code);
  return result.value;
}

export function createStudioAssets(engine, scope, signal) {
  const libraries = new Map();
  let fontTransport, paragraphProvider, editorFonts, sequenceSource, sequenceTextures;

  function library(palette) {
    if (!palettes.includes(palette)) throw new Error('Unknown palette');
    if (!libraries.has(palette)) {
      const pending = (async () => {
        const base = new URL(`content/${palette}/`, import.meta.url);
        const manifest = admit(await (await fetchStudio(new URL('manifest.json', base), signal)).json());
        signal.throwIfAborted();
        const loader = createManifestSpineContentLoader(engine, scope, manifest, {baseUrl:base.href,deadlineMs:15000,networkRetries:0});
        return {base,manifest,loader};
      })().catch(error => {
        libraries.delete(palette);
        throw error;
      });
      libraries.set(palette, pending);
    }
    return libraries.get(palette);
  }

  async function fonts(configPath) {
    if (!/^work\/font-resources\/run-[A-Za-z0-9]{6}\/browser-config\.json$/.test(configPath)) throw new Error('Invalid font configuration');
    const url = new URL('/' + configPath, location.origin);
    const config = await (await fetchStudio(url, signal)).json();
    if (config.format !== 'egret.font-example/1' || !/^build\/generations\/[a-f0-9]{64}\/manifest\.json$/.test(config.manifestPath)) {
      throw new Error('Invalid font manifest path');
    }
    const base = new URL('./', url);
    const [manifest, metadata, canvasKit] = await Promise.all([
      (async () => {
        const bytes = await (await fetchStudio(new URL(config.manifestPath, base), signal)).arrayBuffer();
        const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)).toHex();
        if (digest !== config.manifestSha256) throw new Error('Font manifest identity changed');
        return admit(JSON.parse(utf8.decode(bytes)));
      })(),
      fetchStudio(new URL('manifest.json', vendor), signal).then(response => response.json()),
      globalThis.CanvasKitInit({locateFile:() => new URL('runtime/layout-r1/canvaskit.wasm', vendor).href})
    ]);
    signal.throwIfAborted();
    fontTransport = createManifestFontContentLoader(engine, manifest, {baseUrl:base.href,deadlineMs:30000});
    paragraphProvider = createCanvasKitFontSetProvider({canvasKit,buildIdentity:metadata.runtime.buildIdentity});
    editorFonts = createBrowserEditorFontProvider({engine,scope,paragraphProvider});
    const set = await editorFonts.load(scope, fontTransport.loader, config.initial);
    return {set,paragraphProvider};
  }

  async function sequence() {
    const {base,manifest} = await library('studio');
    signal.throwIfAborted();
    const image = createAssetType('studio-sequence-image', isTexture);
    const metadata = createAssetType('studio-sequence-metadata', value => value !== null && typeof value === 'object');
    const page = createManifestAssetBinding(manifest, 'e_sparks', image);
    const clip = createManifestAssetBinding(manifest, 'e_sequence', metadata);
    const bindings = [page,clip];
    sequenceSource = createManifestByteSource(manifest, bindings, {baseUrl:base.href,deadlineMs:15000,networkRetries:0});
    sequenceTextures = createManifestTextureProvider(sequenceSource);
    engine.assets.register(image, sequenceTextures);
    engine.assets.register(metadata, {
      async load(ref, context) { return JSON.parse(utf8.decode(await sequenceSource.readBytes(ref, context))); },
      dispose() {}
    });
    const group = engine.createManifestGroup(scope, manifest, ['e_sequence'], bindings);
    await group.ready;
    const sheet = scope.use(createSpriteSheet(group.get(page), [{name:'spark',x:0,y:0,width:1,height:1}]));
    return {sheet,clip:createSequenceClip(group.get(clip).value)};
  }

  async function spine(palette) {
    const {loader} = await library(palette);
    signal.throwIfAborted();
    const group = loader.load(scope, ['e_character']);
    await group.ready;
    return group.getSpine('e_character');
  }

  async function close() {
    const loaded = await Promise.allSettled(libraries.values());
    const failures = [];
    for (const service of [editorFonts, paragraphProvider, fontTransport, sequenceTextures, sequenceSource,
      ...loaded.filter(row => row.status === 'fulfilled').map(row => row.value.loader)]) {
      try { await service?.close(); }
      catch (error) { failures.push(error); }
    }
    if (failures.length) throw new AggregateError(failures, 'Studio resource cleanup failed');
  }

  return {fonts,sequence,spine,library,close,fontStatus:() => editorFonts?.getStatus()};
}
