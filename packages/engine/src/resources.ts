// SPDX-License-Identifier: Apache-2.0
/** Optional metadata assembly; importing it creates no provider or CPU value. */
export { createManifestAssetBinding } from './manifestResourceState.js';
export { createContentLoader } from './contentLoader.js';
export type { ContentBinding, ContentProviders, ContentProviderFactory, ContentGroup, ContentLoader } from './contentTypes.js';
export type { ManifestBinding, ManifestAssetBinding, ManifestAssetGroup, ManifestGroupOptions } from './manifestResourceTypes.js';
