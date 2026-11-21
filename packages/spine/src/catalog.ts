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
export function selectSpineDependencies(catalog: SpineCatalog, roots: readonly string[]): readonly string[] {
  const selected = new Set<string>();
  function visit(id: string): void {
    if (selected.has(id)) return;
    selected.add(id);
    for (const dependency of catalog.entries.get(id)!.dependencies) visit(dependency);
  }
  for (const id of roots) visit(id);
  return [...selected];
}
export function spineFault(stage: string, id: string, cause?: unknown): EgretError {
  return new EgretError('SPINE_' + stage + '_FAILED', { cause: Object.freeze({ assetId: id, stage, cause }) });
}
// A Unicode-mode range matches isolated surrogate code units but preserves valid
// supplementary characters without needing ICU property tables in the VM.
export function validSpineLabel(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 255 &&
    !/[\u0000-\u001f\u007f\ud800-\udfff]/u.test(value);
}
function exact(value: unknown, names: readonly string[]): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.keys(value).length === names.length &&
    Object.keys(value).every(k => names.includes(k))
  );
}
/**
 * The Spine options of an entry. A manifest written by hand carries them as its settings; one from the content build
 * carries them inside the build's recipe envelope, beside the producer that made the artifact. Anything else is
 * `undefined`, and refused.
 */
export function spineOptions(entry: ResourceManifestEntry): Record<string, unknown> | undefined {
  const settings = entry.settings;
  if (!exact(settings, ['recipeSchemaVersion', 'options', 'producer', 'outputFormatVersion', 'referenceFormatVersion']))
    return settings !== null && typeof settings === 'object' && !Array.isArray(settings)
      ? (settings as Record<string, unknown>)
      : undefined;
  return settings.recipeSchemaVersion === 1 &&
    settings.outputFormatVersion === entry.artifactFormatVersion &&
    settings.referenceFormatVersion === 'none' &&
    exact(settings.producer, ['nodeVersion', 'pngjsVersion', 'zlibVersion']) &&
    settings.options !== null &&
    typeof settings.options === 'object' &&
    !Array.isArray(settings.options)
    ? (settings.options as Record<string, unknown>)
    : undefined;
}
/** Admit only the optional profile; unrelated game resources stay in the same manifest. */
export function admitSpineCatalog(manifest: AdmittedResourceManifest): SpineCatalog {
  if (!isAdmittedResourceManifest(manifest)) throw spineFault('MANIFEST', '');
  const entries = new Map(manifest.entries.map(e => [e.id, e])),
    skeletons = new Map<string, ResourceManifestEntry>(),
    selected = new Map<string, ResourceManifestEntry>();
  for (const e of entries.values()) {
    if (e.resourceKind !== 'spine') continue;
    // JSON, or the binary export read through a bounded reader of Core's own: the same profile but for format and media type.
    const binary = e.importer.id === 'egret.spine-binary';
    if (
      (e.importer.id !== 'egret.spine-json' && !binary) ||
      e.importer.version !== '1.0.0' ||
      e.artifactFormatVersion !== (binary ? 'spine-binary/4.3-1' : 'spine-json/4.3-1') ||
      e.artifact.mediaType !== (binary ? 'application/octet-stream' : 'application/json') ||
      e.artifact.byteLength > 4194304 ||
      e.dependencies.length !== 1 ||
      !exact(spineOptions(e), ['coreVersion']) ||
      spineOptions(e)!.coreVersion !== '4.3.13'
    )
      throw spineFault('PROFILE', e.id);
    const atlas = entries.get(e.dependencies[0]!);
    if (
      !atlas ||
      atlas.resourceKind !== 'spine-atlas' ||
      atlas.importer.id !== 'egret.spine-atlas' ||
      atlas.importer.version !== '1.0.0' ||
      atlas.artifactFormatVersion !== 'spine-atlas/4.3-1' ||
      atlas.artifact.mediaType !== 'text/plain' ||
      atlas.artifact.byteLength > 262144 ||
      atlas.dependencies.length < 1 ||
      atlas.dependencies.length > 16 ||
      !exact(spineOptions(atlas), ['coreVersion', 'pageNames']) ||
      spineOptions(atlas)!.coreVersion !== '4.3.13'
    )
      throw spineFault('ATLAS_PROFILE', e.id);
    const names = spineOptions(atlas)!.pageNames;
    if (
      !Array.isArray(names) ||
      names.length !== atlas.dependencies.length ||
      new Set(names).size !== names.length ||
      names.some(n => !validSpineLabel(n))
    )
      throw spineFault('PAGE_BINDING', e.id);
    for (const id of atlas.dependencies) {
      const image = entries.get(id);
      if (
        !image ||
        image.resourceKind !== 'image' ||
        image.importer.id !== 'egret.png' ||
        image.importer.version !== '1.0.0' ||
        image.artifactFormatVersion !== 'png/1' ||
        image.artifact.mediaType !== 'image/png' ||
        image.dependencies.length ||
        image.artifact.byteLength > 8388608
      )
        throw spineFault('PAGE_PROFILE', e.id);
      selected.set(id, image);
    }
    selected.set(atlas.id, atlas);
    selected.set(e.id, e);
    skeletons.set(e.id, e);
  }
  if (skeletons.size > 128 || selected.size > 512) throw spineFault('CATALOG_LIMIT', '');
  return { entries, skeletons, selected: Object.freeze([...selected.values()]) };
}
