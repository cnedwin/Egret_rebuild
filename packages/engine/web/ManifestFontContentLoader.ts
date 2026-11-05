// SPDX-License-Identifier: Apache-2.0
import type {Engine} from '@egret/engine';
import {createFontContentLoader} from '@egret/engine/resources';
import type {FontContentLoader} from '@egret/engine/resources';
import type {AdmittedResourceManifest} from '@egret/contracts/resources';
import {createManifestByteSource} from './ManifestByteSource.js';
import type {ManifestByteSource,ManifestByteSourceOptions} from './ManifestByteSource.js';

export interface ManifestFontContentLoader {
    readonly loader:FontContentLoader;
    readonly source:ManifestByteSource;
    close():Promise<void>;
}
/** Fonts share the authenticated byte transport and the Engine's existing resource manager. */
export function createManifestFontContentLoader(engine:Engine,manifest:AdmittedResourceManifest,options:Omit<ManifestByteSourceOptions,'profile'>):ManifestFontContentLoader {
    let source!:ManifestByteSource;
    const loader=createFontContentLoader(engine,manifest,bindings=>{
        source=createManifestByteSource(manifest,bindings.map(row=>row.binding),{...options,profile:'font-sfnt/1'});
        return {load:(ref,context)=>source.readBytes(ref,context),dispose:()=>{}};
    });
    let closing:Promise<void>|undefined;
    return Object.freeze({loader,source,close(){
        if(!closing){closing=(async()=>{try{loader.dispose();}finally{await source.close();}})();void closing.catch(()=>{});}
        return closing;
    }});
}
