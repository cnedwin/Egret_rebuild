// SPDX-License-Identifier: Apache-2.0
// Unsuppressed negative consumers. Freeze real diagnostics only after the route is built.
import { createBrowserTextureProvider } from '@egret/engine/web/image';
import type {
  BrowserPngDecodeOptions, BrowserPngPorts,
  BrowserTextureProviderOptions, BrowserTextureProvider,
} from '@egret/engine/web/image';
import type { AssetLoadContext, AssetProvider, AssetRef, Scope, Texture } from '@egret/engine';

declare const provider: BrowserTextureProvider;
declare const options: BrowserTextureProviderOptions;
declare const ports: BrowserPngPorts;
declare const decodeOptions: BrowserPngDecodeOptions;
declare const context: AssetLoadContext;
declare const textureRef: AssetRef<Texture>;
declare const numberRef: AssetRef<number>;
declare const texture: Texture;
declare const scope: Scope;
declare const readBytes: BrowserTextureProviderOptions['readBytes'];
declare const decode: BrowserPngPorts['decode'];
declare const createCanvas: BrowserPngPorts['createCanvas'];
declare const unknownDecode: (blob: Blob, options: BrowserPngDecodeOptions) => Promise<unknown>;

// BIP_TYPE_CASE BIP1-N01: the required reader is absent.
createBrowserTextureProvider({});
// BIP_TYPE_CASE BIP1-N02: a synchronous byte value is not the promised source signature.
createBrowserTextureProvider({ readBytes: () => new Uint8Array(new ArrayBuffer(8)) });
// BIP_TYPE_CASE BIP1-N03: wrong promised scalar return.
createBrowserTextureProvider({ readBytes: () => Promise.resolve('png') });
// BIP_TYPE_CASE BIP1-N04: shared backing is not the specified ArrayBuffer source type.
createBrowserTextureProvider({ readBytes: () => Promise.resolve(new Uint8Array(new SharedArrayBuffer(8))) });
// BIP_TYPE_CASE BIP1-N05: clamped bytes are not the input Uint8Array signature.
createBrowserTextureProvider({ readBytes: () => Promise.resolve(new Uint8ClampedArray(new ArrayBuffer(8))) });
// BIP_TYPE_CASE BIP1-N06: the reader cannot substitute an invariant number ref.
createBrowserTextureProvider({ readBytes: (_ref: AssetRef<number>, _context: AssetLoadContext) => Promise.resolve(new Uint8Array(new ArrayBuffer(8))) });
// BIP_TYPE_CASE BIP1-N07: required options are nonnull.
createBrowserTextureProvider(null);
// BIP_TYPE_CASE BIP1-N08: the required callback is nonnull.
createBrowserTextureProvider({ readBytes: null });
// BIP_TYPE_CASE BIP1-N09: supplied ports are nonnull.
createBrowserTextureProvider({ readBytes, ports: null });
// BIP_TYPE_CASE BIP1-N10: exact optional ports cannot be supplied as undefined.
createBrowserTextureProvider({ readBytes, ports: undefined });
// BIP_TYPE_CASE BIP1-N11: supplied ports need both functions.
createBrowserTextureProvider({ readBytes, ports: { decode } });
// BIP_TYPE_CASE BIP1-N12: decode cannot return void.
createBrowserTextureProvider({ readBytes, ports: { decode: () => undefined, createCanvas } });
// BIP_TYPE_CASE BIP1-N13: unknown decode output cannot supply the ImageBitmap contract.
createBrowserTextureProvider({ readBytes, ports: { decode: unknownDecode, createCanvas } });
// BIP_TYPE_CASE BIP1-N14: the surface function must return a Canvas element.
createBrowserTextureProvider({ readBytes, ports: { decode, createCanvas: () => ({ width: 1, height: 1 }) } });
// BIP_TYPE_CASE BIP1-N15: orientation has the exact admitted literal.
const wrongOrientation: BrowserPngDecodeOptions = { ...decodeOptions, imageOrientation: 'flipY' };
// BIP_TYPE_CASE BIP1-N16: premultiplication has the exact admitted literal.
const wrongPremultiplication: BrowserPngDecodeOptions = { ...decodeOptions, premultiplyAlpha: 'premultiply' };
// BIP_TYPE_CASE BIP1-N17: conversion has the exact admitted literal.
const wrongConversion: BrowserPngDecodeOptions = { ...decodeOptions, colorSpaceConversion: 'default' };
// BIP_TYPE_CASE BIP1-N18: provider profile is readonly.
provider.profile = 'png-rgb-rgba8-browser-normalized-v1';
// BIP_TYPE_CASE BIP1-N19: provider closure state is readonly.
provider.isClosed = false;
// BIP_TYPE_CASE BIP1-N20: options callback is readonly.
options.readBytes = readBytes;
// BIP_TYPE_CASE BIP1-N21: options ports slot is readonly.
options.ports = ports;
// BIP_TYPE_CASE BIP1-N22: captured decode port is readonly.
ports.decode = decode;
// BIP_TYPE_CASE BIP1-N23: captured Canvas port is readonly.
ports.createCanvas = createCanvas;
// BIP_TYPE_CASE BIP1-N24: decode-option field is readonly.
decodeOptions.imageOrientation = 'from-image';
// BIP_TYPE_CASE BIP1-N25: disposal requires a Texture value.
provider.dispose({});
// BIP_TYPE_CASE BIP1-N26: close produces Promise<void>, not synchronous void.
const synchronousClose: void = provider.close();
// BIP_TYPE_CASE BIP1-N27: a value-parameter disposer is not Scope's no-argument Disposable.
scope.use(provider);
// BIP_TYPE_CASE BIP1-N28: load requires the invariant Texture ref.
provider.load(numberRef, context);
// BIP_TYPE_CASE BIP1-N29: load requires its context argument.
provider.load(textureRef);
// BIP_TYPE_CASE BIP1-N30: the Texture provider is not a provider of number values.
const numberProvider: AssetProvider<number> = provider;
// BIP_TYPE_CASE BIP1-N31: close accepts no value argument.
provider.close(texture);
// BIP_TYPE_CASE BIP1-N32: disposal is synchronous void, not a promised completion.
const asynchronousDispose: Promise<void> = provider.dispose(texture);
