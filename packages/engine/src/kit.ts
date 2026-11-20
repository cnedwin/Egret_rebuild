// SPDX-License-Identifier: Apache-2.0
/** DOM-free parts a game builds on: named input actions, versioned saves, repeatable random numbers, sound cues, asset bundles and a table of words in each language. */
export { createInputActions, describeInputBinding } from './inputActions.js';
export type {
  InputActionDefinition,
  InputActionKind,
  InputActionMap,
  InputActions,
  InputBinding,
  InputBindingSlot,
  InputBindingsSave,
  InputVector
} from './inputActions.js';
export { createMemorySaveStorage, createSaveStore } from './saveStore.js';
export type { SaveProblem, SaveProblemKind, SaveStorage, SaveStore, SaveStoreOptions } from './saveStore.js';
export { createRandom, hashSeed } from './random.js';
export type { Random, RandomState } from './random.js';
export { createAudioCues, encodeWav } from './audioCues.js';
export type { AudioCueDefinition, AudioCuePlayOptions, AudioCues, AudioCuesOptions } from './audioCues.js';
export {
  ASSET_BUNDLE_HEADER_BYTES,
  assetBundleCheck,
  planAssetBundleRanges,
  readAssetBundleHeader,
  readAssetBundleIndex,
  sliceAssetBundle,
  writeAssetBundle
} from './assetBundle.js';
export type { AssetBundleEntry, AssetBundleIndex, AssetBundleInput } from './assetBundle.js';
export { QUALITY_TIERS, pickQualityFiles, pickQualityVariant, runHeadless } from './gameRun.js';
export type { HeadlessGame, HeadlessRunOptions, HeadlessRunResult, QualityTier } from './gameRun.js';
export { createTextTable, pickLanguage } from './textTable.js';
export type { TextTable, TextTableOptions, TextTableWords } from './textTable.js';
