import type { AssetLease, Engine, Scope, Texture, AssetType } from '@egret/engine';
import type { AdmittedResourceManifest } from '@egret/contracts/resources';
import { createManifestAssetBinding } from '@egret/engine/resources';
import type { ManifestAssetBinding, ManifestBinding, ManifestAssetGroup, ManifestGroupOptions } from '@egret/engine/resources';

declare const engine: Engine;
declare const scope: Scope;
declare const manifest: AdmittedResourceManifest;
declare const textureType: AssetType<Texture>;
declare const textType: AssetType<string>;
const image: ManifestAssetBinding<Texture> = createManifestAssetBinding(manifest, 'e_image', textureType);
const text: ManifestAssetBinding<string> = createManifestAssetBinding(manifest, 'e_text', textType);
const bindings: readonly ManifestBinding[] = [image, text];
const options: ManifestGroupOptions = { priority: 'background' };
const group: ManifestAssetGroup = engine.createManifestGroup(scope, manifest, ['e_image', 'e_text'], bindings, options);
const done: Promise<void> = group.ready;
const imageLease: AssetLease<Texture> = group.get(image);
const textLease: AssetLease<string> = group.get(text);
void done; void imageLease; void textLease;
group.dispose();

// Content materialization is optional and preserves the borrowed typed values.
import { createContentLoader } from '@egret/engine/resources';
import type { ContentLoader, ContentGroup, ContentProviders } from '@egret/engine/resources';
import type { SequenceClip, SpriteSheet, AssetProvider } from '@egret/engine';
declare const textureProvider: AssetProvider<Texture>;
declare const metadataProvider: AssetProvider<string>;
const content: ContentLoader = createContentLoader(engine, manifest, bindings => {
  const binding: ManifestBinding | undefined = bindings[0]?.binding;
  void binding;
  const ports: ContentProviders = { textures: textureProvider, metadata: metadataProvider };
  return ports;
});
const materialized: ContentGroup = content.load(scope, ['e_sequence'], options);
const borrowedImage: AssetLease<Texture> = materialized.getImage('e_image');
const borrowedAtlas: SpriteSheet = materialized.getAtlas('e_atlas');
const immutableClip: SequenceClip = materialized.getSequence('e_sequence');
// Positive type constraints also require incompatible providers/leases to stay rejected.
type AssertFalse<T extends false> = T;
type TextureMetadataRejected = AssertFalse<AssetProvider<Texture> extends ContentProviders['metadata'] ? true : false>;
type ClipLeaseRejected = AssertFalse<SequenceClip extends AssetLease<Texture> ? true : false>;
void borrowedImage; void borrowedAtlas; void immutableClip;
