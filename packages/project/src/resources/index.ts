// SPDX-License-Identifier: Apache-2.0
export { describeResourceBuild, parseResourceManifest, serializeResourceManifest } from './manifest.js';
export { describeContentRecipes, bindContentArtifacts, createContentAdoption } from './content.js';
export type { ContentProducer, ContentOutputFile, ContentOutput, ContentBoundOutput, ContentArtifactBinding, ContentAdoptionOptions } from './content.js';
export type { ResourceBuildPlanDescription } from '@egret/contracts/resources';
export type { ResourceBuildDescription, ResourceBuildEntry, ResourceManifestEntry, AdmittedResourceManifest } from '@egret/contracts/resources';
