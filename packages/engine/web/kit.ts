// SPDX-License-Identifier: Apache-2.0
/** Browser parts a game builds on: pictures as textures, input from the page and touch controls, browser storage for saves (local storage and IndexedDB), and asset bundles over HTTP with a cache. Importing the entry performs no browser work. */
export {
  createBrowserImageTextureProvider,
  decodeBrowserImage,
  fitBrowserImageSize,
  sniffBrowserImageFormat,
  textureFromCanvas
} from './BrowserImageTextures.js';
export type {
  BrowserDecodedImage,
  BrowserImageCanvas,
  BrowserImageContext,
  BrowserImageFormat,
  BrowserImageOptions,
  BrowserImagePorts,
  BrowserImageSource,
  BrowserImageTextureProviderOptions
} from './BrowserImageTextures.js';
export {
  bindBrowserInputActions,
  browserSaveStorage,
  createTouchButton,
  createTouchStick
} from './BrowserInputActions.js';
export type {
  BrowserInputActions,
  BrowserInputActionsOptions,
  TouchControl,
  TouchStickOptions
} from './BrowserInputActions.js';
export { openBrowserAssetBundle } from './BrowserAssetBundle.js';
export type { BrowserAssetBundle, BrowserAssetBundleOptions } from './BrowserAssetBundle.js';
export { openBrowserBundleCache, openIndexedDBSaveStorage } from './BrowserStorage.js';
export type { BundleCache, IndexedDBSaveStorage, IndexedDBSaveStorageOptions } from './BrowserStorage.js';
