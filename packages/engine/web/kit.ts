// SPDX-License-Identifier: Apache-2.0
/** Browser parts a game builds on: pictures as textures. Importing the entry performs no browser work. */
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
