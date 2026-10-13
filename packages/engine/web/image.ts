// SPDX-License-Identifier: Apache-2.0
/** Explicit browser image adapter; cold import performs no browser resource work. */
export { createBrowserTextureProvider } from './BrowserTextureProvider.js';
export type {
    BrowserPngDecodeOptions, BrowserPngPorts, BrowserTextureProviderOptions,
    BrowserTextureProvider,
} from './BrowserTextureProvider.js';
