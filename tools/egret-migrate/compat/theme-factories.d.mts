// SPDX-License-Identifier: Apache-2.0
export interface LegacyThemeManifest {
  readonly schemaVersion: 1;
  readonly format: 'gjs' | 'registry';
  readonly global: string;
  readonly entries: readonly {readonly path: string; readonly className: string}[];
  readonly skins: Readonly<Record<string, string>>;
}
export interface LegacySkinBuild {
  readonly parts: readonly (readonly [string, object])[];
  readonly children: readonly object[];
  readonly states: readonly string[];
  readonly skin: object;
  apply(state: string): void;
}
export interface LegacyThemeHost {
  registerPrecompiledSkins(
    factories: Map<string, (owner: object) => LegacySkinBuild>,
    defaults: Readonly<Record<string, string>>,
    types: Map<string, new () => object>
  ): void;
}
/** Register after the reviewed classic script and its custom component dependencies have loaded. */
export function registerLegacyThemeFactories(
  eui: LegacyThemeHost,
  manifest: LegacyThemeManifest,
  options?: {readonly root?: object; readonly egret?: object; readonly namespaces?: Readonly<Record<string, object>>}
): void;
