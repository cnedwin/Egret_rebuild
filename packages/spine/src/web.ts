// SPDX-License-Identifier: Apache-2.0
import type { Engine, Scope } from '@egret/engine';
import type { ManifestGroupOptions } from '@egret/engine/resources';
import type { AdmittedResourceManifest } from '@egret/contracts/resources';
import { createManifestByteSource, createManifestTextureProvider } from '@egret/engine/web/resources';
import type { ManifestByteSourceOptions, ManifestByteSourceStatus, ManifestTextureProviderStatus } from '@egret/engine/web/resources';
import { createSpineContentLoader } from './loader.js';
import type { SpineContentLoader, SpineContentOptions } from './types.js';
export interface ManifestSpineContentLoader extends SpineContentLoader {
  getTransportStatus():Readonly<{source:ManifestByteSourceStatus;provider:ManifestTextureProviderStatus}>;
}
/** The existing transport owns integrity, strict UTF-8, native PNG decode and cancellation. */
export function createManifestSpineContentLoader(engine:Engine,ownerScope:Scope,manifest:AdmittedResourceManifest,sourceOptions:ManifestByteSourceOptions,options?:SpineContentOptions):ManifestSpineContentLoader {
  let source:ReturnType<typeof createManifestByteSource>|undefined,textures:ReturnType<typeof createManifestTextureProvider>|undefined;
  let core:SpineContentLoader;
  try{core=createSpineContentLoader(engine,ownerScope,manifest,bindings=>{
    source=createManifestByteSource(manifest,bindings.map(b=>b.binding),sourceOptions);textures=createManifestTextureProvider(source);const bytes=source;
    return {textures,metadata:{async load(ref,context){const value=await bytes.readBytes(ref,context);if(value.byteLength>4194304)throw Error('SPINE_METADATA_LIMIT');return new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(value);},dispose(){}}};
  },options);}catch(cause){void textures?.close().catch(()=>{});void source?.close().catch(()=>{});throw cause;}
  const byteSource=source!,png=textures!;let closing:Promise<void>|undefined;
  const facade:ManifestSpineContentLoader=Object.freeze({get isDisposed(){if(this!==facade)throw Error('SPINE_LOADER_RECEIVER');return core.isDisposed;},load(scope:Scope,roots:readonly string[],groupOptions?:ManifestGroupOptions){if(this!==facade)throw Error('SPINE_LOADER_RECEIVER');return core.load(scope,roots,groupOptions);},getStatus(){if(this!==facade)throw Error('SPINE_LOADER_RECEIVER');return core.getStatus();},getTransportStatus(){if(this!==facade)throw Error('SPINE_LOADER_RECEIVER');return Object.freeze({source:byteSource.getStatus(),provider:png.getStatus()});},dispose(){if(this!==facade)throw Error('SPINE_LOADER_RECEIVER');core.dispose();},close(){if(this!==facade)throw Error('SPINE_LOADER_RECEIVER');if(!closing){core.dispose();closing=Promise.all([png.close(),byteSource.close(),core.close()]).then(()=>{});}return closing;}});
  return facade;
}
