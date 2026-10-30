// SPDX-License-Identifier: Apache-2.0
import { EgretError } from '@egret/engine';
import { isAdmittedResourceManifest } from '@egret/contracts/resources';
import type { AdmittedResourceManifest, ResourceManifestEntry } from '@egret/contracts/resources';

export interface SpineCatalog {
  readonly entries: ReadonlyMap<string, ResourceManifestEntry>;
  readonly skeletons: ReadonlyMap<string, ResourceManifestEntry>;
  readonly selected: readonly ResourceManifestEntry[];
}
/** Select the existing admitted closure; this transient walk is not retained by groups. */
export function selectSpineDependencies(catalog:SpineCatalog,roots:readonly string[]):readonly string[]{
  const selected=new Set<string>();
  function visit(id:string):void{if(selected.has(id))return;selected.add(id);for(const dependency of catalog.entries.get(id)!.dependencies)visit(dependency);}
  for(const id of roots)visit(id);return [...selected];
}
export function spineFault(stage: string, id: string, cause?: unknown): EgretError {
  return new EgretError('SPINE_' + stage + '_FAILED', {cause:Object.freeze({assetId:id,stage,cause})});
}
function exact(value: unknown, names: readonly string[]): value is Record<string,unknown> {
  return value!==null && typeof value==='object' && !Array.isArray(value)
    && Object.keys(value).length===names.length && Object.keys(value).every(k=>names.includes(k));
}
/** Admit only the optional profile; unrelated game resources stay in the same manifest. */
export function admitSpineCatalog(manifest: AdmittedResourceManifest): SpineCatalog {
  if(!isAdmittedResourceManifest(manifest))throw spineFault('MANIFEST','');
  const entries=new Map(manifest.entries.map(e=>[e.id,e])),skeletons=new Map<string,ResourceManifestEntry>(),selected=new Map<string,ResourceManifestEntry>();
  for(const e of entries.values()) {
    if(e.resourceKind!=='spine')continue;
    // Binary needs a separately bounded parser boundary before product admission.
    if(e.importer.id!=='egret.spine-json'||e.importer.version!=='1.0.0'
      ||e.artifactFormatVersion!=='spine-json/4.3-1'||e.artifact.mediaType!=='application/json'||e.artifact.byteLength>4194304
      ||e.dependencies.length!==1||!exact(e.settings,['coreVersion'])||e.settings.coreVersion!=='4.3.13')throw spineFault('PROFILE',e.id);
    const atlas=entries.get(e.dependencies[0]!);
    if(!atlas||atlas.resourceKind!=='spine-atlas'||atlas.importer.id!=='egret.spine-atlas'||atlas.importer.version!=='1.0.0'
      ||atlas.artifactFormatVersion!=='spine-atlas/4.3-1'||atlas.artifact.mediaType!=='text/plain'||atlas.artifact.byteLength>262144
      ||atlas.dependencies.length<1||atlas.dependencies.length>16||!exact(atlas.settings,['coreVersion','pageNames'])||atlas.settings.coreVersion!=='4.3.13')throw spineFault('ATLAS_PROFILE',e.id);
    const names=atlas.settings.pageNames;
    if(!Array.isArray(names)||names.length!==atlas.dependencies.length||new Set(names).size!==names.length
      ||names.some(n=>typeof n!=='string'||!n.length||n.length>255||/[\p{Surrogate}\u0000-\u001f\u007f]/u.test(n)))throw spineFault('PAGE_BINDING',e.id);
    for(const id of atlas.dependencies){const image=entries.get(id);if(!image||image.resourceKind!=='image'||image.importer.id!=='egret.png'||image.importer.version!=='1.0.0'||image.artifactFormatVersion!=='png/1'||image.artifact.mediaType!=='image/png'||image.dependencies.length||image.artifact.byteLength>8388608)throw spineFault('PAGE_PROFILE',e.id);selected.set(id,image);}
    selected.set(atlas.id,atlas);selected.set(e.id,e);skeletons.set(e.id,e);
  }
  if(skeletons.size>128||selected.size>512)throw spineFault('CATALOG_LIMIT','');
  return {entries,skeletons,selected:Object.freeze([...selected.values()])};
}
