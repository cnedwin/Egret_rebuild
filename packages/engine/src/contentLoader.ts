// SPDX-License-Identifier: Apache-2.0
import { isAdmittedResourceManifest } from '@egret/contracts/resources';
import type { AdmittedResourceManifest, ResourceManifestEntry } from '@egret/contracts/resources';
import { createAssetType, createSequenceClip, createSpriteSheet, isTexture, Scope, EgretError } from '@egret/runtime';
import type { AssetLease, AssetProvider, SequenceClip, SpriteSheet, Texture } from '@egret/runtime';
import type { Engine } from './Engine.js';
import type { ContentBinding, ContentGroup, ContentLoader, ContentProviderFactory, ContentProviders } from './contentTypes.js';
import type { ManifestAssetBinding, ManifestBinding, ManifestGroupOptions } from './manifestResourceTypes.js';
import { createManifestAssetBinding } from './manifestResourceState.js';
import { requireContentEngine } from './internal/contentFactoryState.js';
import { contentFault, parseAtlasArtifact, parseSequenceArtifact } from './contentArtifacts.js';
import type { AtlasArtifact } from './contentArtifacts.js';

const SCOPE_STATE = Object.getOwnPropertyDescriptor(Scope.prototype,'state')!.get!;
const SCOPE_USE = Scope.prototype.use;
const APPLY = Reflect.apply;
const FREEZE = Object.freeze;
function provider<T>(value: unknown): AssetProvider<T> {
  if (typeof value !== 'object' || value === null) throw new EgretError('CONTENT_PROVIDERS_INVALID');
  const load = Object.getOwnPropertyDescriptor(value,'load'), dispose = Object.getOwnPropertyDescriptor(value,'dispose');
  if (!load || !dispose || !Object.hasOwn(load,'value') || !Object.hasOwn(dispose,'value')
    || typeof load.value !== 'function' || typeof dispose.value !== 'function') throw new EgretError('CONTENT_PROVIDERS_INVALID');
  return FREEZE({
    load: (...args: Parameters<AssetProvider<T>['load']>): Promise<T> => APPLY(load.value,value,args) as Promise<T>,
    dispose: (asset: T): void => { APPLY(dispose.value,value,[asset]); },
  });
}
/** One manifest/source catalog, independent of global IDs and of other loaders. */
export function createContentLoader(engine: Engine, manifest: AdmittedResourceManifest, factory: ContentProviderFactory): ContentLoader {
  const owner = requireContentEngine(engine);
  if (!isAdmittedResourceManifest(manifest)) throw new EgretError('CONTENT_MANIFEST_INVALID');
  if (typeof factory !== 'function') throw new EgretError('CONTENT_PROVIDERS_INVALID');
  const entries = new Map<string,ResourceManifestEntry>(manifest.entries.map(e => [e.id,e]));
  const imageType = createAssetType<Texture>('egret.content.image',isTexture);
  const metadataType = createAssetType<string>('egret.content.metadata',v => typeof v === 'string');
  const bindings = new Map<string,ManifestBinding>();
  const descriptions: ContentBinding[] = [];
  for (const e of entries.values()) {
    const profile = e.resourceKind === 'image' ? ['egret.png','png/1','image/png',0] : e.resourceKind === 'atlas' ? ['egret.aseprite-atlas','egret.atlas/1','application/json',1] : e.resourceKind === 'sequence' ? ['egret.sequence','egret.sequence/1','application/json',1] : undefined;
    if (!profile || e.importer.id !== profile[0] || e.importer.version !== '1.0.0' || e.artifactFormatVersion !== profile[1] || e.artifact.mediaType !== profile[2] || e.dependencies.length !== profile[3]
      || e.artifact.byteLength > (e.resourceKind === 'image' ? 8388608 : 4194304)) throw contentFault('PROFILE',e.id);
    const dependency = entries.get(e.dependencies[0] ?? '');
    if (e.resourceKind === 'atlas' && dependency?.resourceKind !== 'image' || e.resourceKind === 'sequence' && dependency?.resourceKind !== 'atlas') throw contentFault('DEPENDENCY',e.id);
    if (e.resourceKind === 'sequence' && (e.source.id !== dependency!.source.id || e.source.sha256 !== dependency!.source.sha256 || e.source.byteLength !== dependency!.source.byteLength)) throw contentFault('SOURCE',e.id);
    const binding = e.resourceKind === 'image' ? createManifestAssetBinding(manifest,e.id,imageType) : createManifestAssetBinding(manifest,e.id,metadataType);
    bindings.set(e.id,binding); descriptions.push(FREEZE({id:e.id,kind:e.resourceKind as ContentBinding['kind'],binding}));
  }
  const ports: unknown = APPLY(factory,undefined,[FREEZE(descriptions)]);
  owner.assertOpen();
  if (ports === null || typeof ports !== 'object' || Reflect.ownKeys(ports).length !== 2) throw new EgretError('CONTENT_PROVIDERS_INVALID');
  const texturePort = Object.getOwnPropertyDescriptor(ports,'textures'), metadataPort = Object.getOwnPropertyDescriptor(ports,'metadata');
  if (!texturePort || !metadataPort || !Object.hasOwn(texturePort,'value') || !Object.hasOwn(metadataPort,'value')) throw new EgretError('CONTENT_PROVIDERS_INVALID');
  const providers: ContentProviders = {textures:provider<Texture>(texturePort.value),metadata:provider<string>(metadataPort.value)};
  owner.assertOpen();
  owner.register(imageType,providers.textures);
  owner.register(metadataType,providers.metadata);
  owner.assertOpen();
  let disposed = false;
  const groups = new Set<ContentGroup>();
  let disown = (): void => {};
  function assertOpen(): void { owner.assertOpen(); if (disposed) throw new EgretError('CONTENT_LOADER_DISPOSED'); }
  function assertScope(scope: unknown): asserts scope is Scope {
    assertOpen();
    if (!owner.isScope(scope)) throw new EgretError('CONTENT_SCOPE_INVALID');
    if (APPLY(SCOPE_STATE,scope,[]) !== 'open') throw new EgretError('SCOPE_CLOSED');
  }
  function dispose(): void {
    if (disposed) return;
    disposed = true; disown();
    for (const group of [...groups]) group.dispose();
    groups.clear();
  }
  const loader: ContentLoader = FREEZE({
    get isDisposed(): boolean { if (this !== loader) throw new EgretError('CONTENT_LOADER_INVALID'); return disposed; },
    dispose(): void { if (this !== loader) throw new EgretError('CONTENT_LOADER_INVALID'); dispose(); },
    load(scope: Scope, roots: readonly string[], options?: ManifestGroupOptions): ContentGroup {
      if (this !== loader) throw new EgretError('CONTENT_LOADER_INVALID');
      assertScope(scope);
      // Capture roots once; recheck lifetime after every caller-controlled read.
      if (!Array.isArray(roots)) throw new EgretError('CONTENT_ROOTS_INVALID');
      const count = roots.length; assertScope(scope);
      if (!Number.isInteger(count) || count < 0 || count > 128) throw new EgretError('CONTENT_ROOTS_INVALID');
      const selected = new Set<string>(), ordered: ResourceManifestEntry[] = [], captured: string[] = [];
      function visit(id: string): void {
        if (selected.has(id)) return;
        const entry = entries.get(id);
        if (!entry) throw contentFault('ROOT',id);
        if (selected.size === 128) throw new EgretError('CONTENT_GROUP_LIMIT');
        selected.add(id);
        for (const dependency of entry.dependencies) visit(dependency);
        ordered.push(entry);
      }
      for (let i=0;i<count;i++) {
        const descriptor = Object.getOwnPropertyDescriptor(roots,String(i)); assertScope(scope);
        if (!descriptor || !Object.hasOwn(descriptor,'value') || typeof descriptor.value !== 'string' || captured.includes(descriptor.value)) throw new EgretError('CONTENT_ROOTS_INVALID');
        captured.push(descriptor.value as string); visit(descriptor.value as string);
      }
      const raw = owner.group(scope,manifest,FREEZE(captured),ordered.map(e => bindings.get(e.id)!),options);
      const images = new Map<string,AssetLease<Texture>>(), sheets = new Map<string,SpriteSheet>(), clips = new Map<string,SequenceClip>();
      let state: 'pending' | 'ready' | 'failed' | 'disposed' = 'pending';
      let resolve!: () => void, reject!: (cause: unknown) => void;
      const ready = new Promise<void>((yes,no) => {resolve=yes;reject=no;}); void ready.catch(() => {});
      function retire(next: 'failed' | 'disposed',cause?: unknown): void {
        if (state === 'disposed' || state === 'failed') return;
        const pending = state === 'pending'; state = next;
        groups.delete(group);
        if (pending) reject(cause ?? new EgretError('CONTENT_GROUP_DISPOSED'));
        // Sheets borrow raw group leases; revoke the wrappers before releasing leases.
        for (const sheet of sheets.values()) sheet.dispose();
        sheets.clear(); images.clear(); clips.clear(); raw.dispose();
      }
      function read<T>(map: Map<string,T>,id: string): T {
        assertScope(scope);
        if (state !== 'ready') throw new EgretError('CONTENT_GROUP_NOT_READY');
        if (typeof id !== 'string' || !map.has(id)) throw new EgretError('CONTENT_RESOURCE_INVALID');
        return map.get(id)!;
      }
      const group: ContentGroup = FREEZE({
        get ready(): Promise<void> { if (this !== group) throw new EgretError('CONTENT_GROUP_INVALID'); return ready; },
        get isDisposed(): boolean { if (this !== group) throw new EgretError('CONTENT_GROUP_INVALID'); return state === 'disposed' || state === 'failed'; },
        getImage(id: string): AssetLease<Texture> { if (this !== group) throw new EgretError('CONTENT_GROUP_INVALID'); return read(images,id); },
        getAtlas(id: string): SpriteSheet { if (this !== group) throw new EgretError('CONTENT_GROUP_INVALID'); return read(sheets,id); },
        getSequence(id: string): SequenceClip { if (this !== group) throw new EgretError('CONTENT_GROUP_INVALID'); return read(clips,id); },
        dispose(): void { if (this !== group) throw new EgretError('CONTENT_GROUP_INVALID'); retire('disposed'); },
      });
      groups.add(group);
      try { APPLY(SCOPE_USE,scope,[group]); assertScope(scope); }
      catch (cause) { retire('disposed',cause); throw cause; }
      void raw.ready.then(() => {
        if (state !== 'pending') return;
        try {
          assertScope(scope);
          const atlases = new Map<string,AtlasArtifact>();
          for (const e of ordered) {
            if (e.resourceKind === 'image') {
              const lease = raw.get(bindings.get(e.id) as ManifestAssetBinding<Texture>), value = lease.value;
              if (value.width > 4096 || value.height > 4096 || value.width * value.height > 1048576) throw contentFault('IMAGE',e.id);
              images.set(e.id,lease);
            } else {
              const text = raw.get(bindings.get(e.id) as ManifestAssetBinding<string>).value;
              if (e.resourceKind === 'atlas') {
                const atlas = parseAtlasArtifact(text,e.id), page = images.get(e.dependencies[0]!)!;
                if (page.value.width !== atlas.width || page.value.height !== atlas.height) throw contentFault('DIMENSIONS',e.id);
                atlases.set(e.id,atlas); sheets.set(e.id,createSpriteSheet(page,atlas.frames,'trim-rotation-v1'));
              } else clips.set(e.id,createSequenceClip(parseSequenceArtifact(text,e.id,atlases.get(e.dependencies[0]!)!),'trim-rotation-v1'));
            }
          }
          assertScope(scope); state = 'ready'; resolve();
        } catch (cause) { retire('failed',cause); }
      },cause => retire('failed',contentFault('LOAD',captured.join(','),cause)));
      return group;
    },
  });
  disown = owner.own(dispose);
  return loader;
}
