// Root records actual unsuppressed compiler diagnostics before freezing tuples.
import type { AssetLease, Engine, Scope, Texture, AssetType } from '@egret/engine';
import type { AdmittedResourceManifest } from '@egret/contracts/resources';
import type { ManifestAssetBinding, ManifestBinding, ManifestAssetGroup } from '@egret/engine/resources';

declare const engine: Engine;
declare const scope: Scope;
declare const manifest: AdmittedResourceManifest;
declare const textureType: AssetType<Texture>;
declare const group: ManifestAssetGroup;
declare const image: ManifestAssetBinding<Texture>;
declare const text: ManifestAssetBinding<string>;
const wrongBinding: ManifestAssetBinding<string> = image;
const widenedBinding: ManifestAssetBinding<unknown> = image;
const forged: ManifestBinding = {};
const wrongLease: AssetLease<Texture> = group.get(text);
const wrongReady: Promise<readonly AssetLease<Texture>[]> = group.ready;
engine.createManifestGroup(scope, manifest, ['e_image'], [image], { priority: 'urgent' });
engine.createManifestGroup(scope, manifest, ['e_image'], [image], { concurrency: 16 });
engine.createManifestGroup(scope, manifest, ['e_image'], [image.ref]);
group.get(image.ref);
group.ready = Promise.resolve();
const counterfeitTyped: ManifestAssetBinding<Texture> = { ref: image.ref };
void wrongBinding; void widenedBinding; void forged; void wrongLease; void wrongReady; void counterfeitTyped; void textureType;
