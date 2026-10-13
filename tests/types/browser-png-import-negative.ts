// SPDX-License-Identifier: Apache-2.0
// Unsuppressed export exclusions with unique per-statement markers.
// At actual acceptance the new web/image route must exist and have built declarations.
// Every excluded route below already exists in the delivered baseline; no invented route.
// BIP_TYPE_CASE BIP1-I01: BrowserPngDecodeOptions is erased on the optional route.
import { BrowserPngDecodeOptions } from '@egret/engine/web/image';
// BIP_TYPE_CASE BIP1-I02: BrowserPngPorts is erased on the optional route.
import { BrowserPngPorts } from '@egret/engine/web/image';
// BIP_TYPE_CASE BIP1-I03: BrowserTextureProviderOptions is erased on the optional route.
import { BrowserTextureProviderOptions } from '@egret/engine/web/image';
// BIP_TYPE_CASE BIP1-I04: BrowserTextureProvider is erased on the optional route.
import { BrowserTextureProvider } from '@egret/engine/web/image';
// BIP_TYPE_CASE BIP1-I05: the @egret/engine entry has no browser image factory.
import { createBrowserTextureProvider as EngineImageFactory } from '@egret/engine';
// BIP_TYPE_CASE BIP1-I06: the @egret/engine entry has no BrowserPngDecodeOptions type.
import type { BrowserPngDecodeOptions as EngineBrowserPngDecodeOptions } from '@egret/engine';
// BIP_TYPE_CASE BIP1-I07: the @egret/engine entry has no BrowserPngPorts type.
import type { BrowserPngPorts as EngineBrowserPngPorts } from '@egret/engine';
// BIP_TYPE_CASE BIP1-I08: the @egret/engine entry has no BrowserTextureProviderOptions type.
import type { BrowserTextureProviderOptions as EngineBrowserTextureProviderOptions } from '@egret/engine';
// BIP_TYPE_CASE BIP1-I09: the @egret/engine entry has no BrowserTextureProvider type.
import type { BrowserTextureProvider as EngineBrowserTextureProvider } from '@egret/engine';
// BIP_TYPE_CASE BIP1-I10: the @egret/runtime entry has no browser image factory.
import { createBrowserTextureProvider as RuntimeImageFactory } from '@egret/runtime';
// BIP_TYPE_CASE BIP1-I11: the @egret/runtime entry has no BrowserPngDecodeOptions type.
import type { BrowserPngDecodeOptions as RuntimeBrowserPngDecodeOptions } from '@egret/runtime';
// BIP_TYPE_CASE BIP1-I12: the @egret/runtime entry has no BrowserPngPorts type.
import type { BrowserPngPorts as RuntimeBrowserPngPorts } from '@egret/runtime';
// BIP_TYPE_CASE BIP1-I13: the @egret/runtime entry has no BrowserTextureProviderOptions type.
import type { BrowserTextureProviderOptions as RuntimeBrowserTextureProviderOptions } from '@egret/runtime';
// BIP_TYPE_CASE BIP1-I14: the @egret/runtime entry has no BrowserTextureProvider type.
import type { BrowserTextureProvider as RuntimeBrowserTextureProvider } from '@egret/runtime';
// BIP_TYPE_CASE BIP1-I15: the @egret/contracts entry has no browser image factory.
import { createBrowserTextureProvider as ContractsImageFactory } from '@egret/contracts';
// BIP_TYPE_CASE BIP1-I16: the @egret/contracts entry has no BrowserPngDecodeOptions type.
import type { BrowserPngDecodeOptions as ContractsBrowserPngDecodeOptions } from '@egret/contracts';
// BIP_TYPE_CASE BIP1-I17: the @egret/contracts entry has no BrowserPngPorts type.
import type { BrowserPngPorts as ContractsBrowserPngPorts } from '@egret/contracts';
// BIP_TYPE_CASE BIP1-I18: the @egret/contracts entry has no BrowserTextureProviderOptions type.
import type { BrowserTextureProviderOptions as ContractsBrowserTextureProviderOptions } from '@egret/contracts';
// BIP_TYPE_CASE BIP1-I19: the @egret/contracts entry has no BrowserTextureProvider type.
import type { BrowserTextureProvider as ContractsBrowserTextureProvider } from '@egret/contracts';
// BIP_TYPE_CASE BIP1-I20: the @egret/engine/web entry has no browser image factory.
import { createBrowserTextureProvider as CanvasImageFactory } from '@egret/engine/web';
// BIP_TYPE_CASE BIP1-I21: the @egret/engine/web entry has no BrowserPngDecodeOptions type.
import type { BrowserPngDecodeOptions as CanvasBrowserPngDecodeOptions } from '@egret/engine/web';
// BIP_TYPE_CASE BIP1-I22: the @egret/engine/web entry has no BrowserPngPorts type.
import type { BrowserPngPorts as CanvasBrowserPngPorts } from '@egret/engine/web';
// BIP_TYPE_CASE BIP1-I23: the @egret/engine/web entry has no BrowserTextureProviderOptions type.
import type { BrowserTextureProviderOptions as CanvasBrowserTextureProviderOptions } from '@egret/engine/web';
// BIP_TYPE_CASE BIP1-I24: the @egret/engine/web entry has no BrowserTextureProvider type.
import type { BrowserTextureProvider as CanvasBrowserTextureProvider } from '@egret/engine/web';
// BIP_TYPE_CASE BIP1-I25: the @egret/engine/text entry has no browser image factory.
import { createBrowserTextureProvider as TextImageFactory } from '@egret/engine/text';
// BIP_TYPE_CASE BIP1-I26: the @egret/engine/text entry has no BrowserPngDecodeOptions type.
import type { BrowserPngDecodeOptions as TextBrowserPngDecodeOptions } from '@egret/engine/text';
// BIP_TYPE_CASE BIP1-I27: the @egret/engine/text entry has no BrowserPngPorts type.
import type { BrowserPngPorts as TextBrowserPngPorts } from '@egret/engine/text';
// BIP_TYPE_CASE BIP1-I28: the @egret/engine/text entry has no BrowserTextureProviderOptions type.
import type { BrowserTextureProviderOptions as TextBrowserTextureProviderOptions } from '@egret/engine/text';
// BIP_TYPE_CASE BIP1-I29: the @egret/engine/text entry has no BrowserTextureProvider type.
import type { BrowserTextureProvider as TextBrowserTextureProvider } from '@egret/engine/text';
// BIP_TYPE_CASE BIP1-I30: the @egret/engine/web/text entry has no browser image factory.
import { createBrowserTextureProvider as CanvasTextImageFactory } from '@egret/engine/web/text';
// BIP_TYPE_CASE BIP1-I31: the @egret/engine/web/text entry has no BrowserPngDecodeOptions type.
import type { BrowserPngDecodeOptions as CanvasTextBrowserPngDecodeOptions } from '@egret/engine/web/text';
// BIP_TYPE_CASE BIP1-I32: the @egret/engine/web/text entry has no BrowserPngPorts type.
import type { BrowserPngPorts as CanvasTextBrowserPngPorts } from '@egret/engine/web/text';
// BIP_TYPE_CASE BIP1-I33: the @egret/engine/web/text entry has no BrowserTextureProviderOptions type.
import type { BrowserTextureProviderOptions as CanvasTextBrowserTextureProviderOptions } from '@egret/engine/web/text';
// BIP_TYPE_CASE BIP1-I34: the @egret/engine/web/text entry has no BrowserTextureProvider type.
import type { BrowserTextureProvider as CanvasTextBrowserTextureProvider } from '@egret/engine/web/text';
// BIP_TYPE_CASE BIP1-I35: the @egret/engine/web/input entry has no browser image factory.
import { createBrowserTextureProvider as InputImageFactory } from '@egret/engine/web/input';
// BIP_TYPE_CASE BIP1-I36: the @egret/engine/web/input entry has no BrowserPngDecodeOptions type.
import type { BrowserPngDecodeOptions as InputBrowserPngDecodeOptions } from '@egret/engine/web/input';
// BIP_TYPE_CASE BIP1-I37: the @egret/engine/web/input entry has no BrowserPngPorts type.
import type { BrowserPngPorts as InputBrowserPngPorts } from '@egret/engine/web/input';
// BIP_TYPE_CASE BIP1-I38: the @egret/engine/web/input entry has no BrowserTextureProviderOptions type.
import type { BrowserTextureProviderOptions as InputBrowserTextureProviderOptions } from '@egret/engine/web/input';
// BIP_TYPE_CASE BIP1-I39: the @egret/engine/web/input entry has no BrowserTextureProvider type.
import type { BrowserTextureProvider as InputBrowserTextureProvider } from '@egret/engine/web/input';
// BIP_TYPE_CASE BIP1-I40: the @egret/engine/webgpu entry has no browser image factory.
import { createBrowserTextureProvider as WebGPUImageFactory } from '@egret/engine/webgpu';
// BIP_TYPE_CASE BIP1-I41: the @egret/engine/webgpu entry has no BrowserPngDecodeOptions type.
import type { BrowserPngDecodeOptions as WebGPUBrowserPngDecodeOptions } from '@egret/engine/webgpu';
// BIP_TYPE_CASE BIP1-I42: the @egret/engine/webgpu entry has no BrowserPngPorts type.
import type { BrowserPngPorts as WebGPUBrowserPngPorts } from '@egret/engine/webgpu';
// BIP_TYPE_CASE BIP1-I43: the @egret/engine/webgpu entry has no BrowserTextureProviderOptions type.
import type { BrowserTextureProviderOptions as WebGPUBrowserTextureProviderOptions } from '@egret/engine/webgpu';
// BIP_TYPE_CASE BIP1-I44: the @egret/engine/webgpu entry has no BrowserTextureProvider type.
import type { BrowserTextureProvider as WebGPUBrowserTextureProvider } from '@egret/engine/webgpu';
// BIP_TYPE_CASE BIP1-I45: the @egret/engine/scene3d entry has no browser image factory.
import { createBrowserTextureProvider as SceneImageFactory } from '@egret/engine/scene3d';
// BIP_TYPE_CASE BIP1-I46: the @egret/engine/scene3d entry has no BrowserPngDecodeOptions type.
import type { BrowserPngDecodeOptions as SceneBrowserPngDecodeOptions } from '@egret/engine/scene3d';
// BIP_TYPE_CASE BIP1-I47: the @egret/engine/scene3d entry has no BrowserPngPorts type.
import type { BrowserPngPorts as SceneBrowserPngPorts } from '@egret/engine/scene3d';
// BIP_TYPE_CASE BIP1-I48: the @egret/engine/scene3d entry has no BrowserTextureProviderOptions type.
import type { BrowserTextureProviderOptions as SceneBrowserTextureProviderOptions } from '@egret/engine/scene3d';
// BIP_TYPE_CASE BIP1-I49: the @egret/engine/scene3d entry has no BrowserTextureProvider type.
import type { BrowserTextureProvider as SceneBrowserTextureProvider } from '@egret/engine/scene3d';
// BIP_TYPE_CASE BIP1-I50: the @egret/engine/webgpu/scene3d entry has no browser image factory.
import { createBrowserTextureProvider as WebGPUSceneImageFactory } from '@egret/engine/webgpu/scene3d';
// BIP_TYPE_CASE BIP1-I51: the @egret/engine/webgpu/scene3d entry has no BrowserPngDecodeOptions type.
import type { BrowserPngDecodeOptions as WebGPUSceneBrowserPngDecodeOptions } from '@egret/engine/webgpu/scene3d';
// BIP_TYPE_CASE BIP1-I52: the @egret/engine/webgpu/scene3d entry has no BrowserPngPorts type.
import type { BrowserPngPorts as WebGPUSceneBrowserPngPorts } from '@egret/engine/webgpu/scene3d';
// BIP_TYPE_CASE BIP1-I53: the @egret/engine/webgpu/scene3d entry has no BrowserTextureProviderOptions type.
import type { BrowserTextureProviderOptions as WebGPUSceneBrowserTextureProviderOptions } from '@egret/engine/webgpu/scene3d';
// BIP_TYPE_CASE BIP1-I54: the @egret/engine/webgpu/scene3d entry has no BrowserTextureProvider type.
import type { BrowserTextureProvider as WebGPUSceneBrowserTextureProvider } from '@egret/engine/webgpu/scene3d';
