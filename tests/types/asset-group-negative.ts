import type { AssetGroup, AssetGroupOptions, AssetGroupState, AssetRef, Engine, Scope } from '@egret/engine';
declare const engine: Engine;
declare const scope: Scope;
declare const numberRef: AssetRef<number>;
declare const stringRef: AssetRef<string>;
declare const numberGroup: AssetGroup<number>;
// ASSET_GROUP_CASE required-private-brand
const fabricated: AssetGroup<number> = { state: 'pending', ready: Promise.resolve([]), dispose() {} };
// ASSET_GROUP_CASE homogeneous-invariant-input
engine.createAssetGroup(scope, [numberRef, stringRef]);
// ASSET_GROUP_CASE invariant-group-result
const incompatible: AssetGroup<string> = numberGroup;
// ASSET_GROUP_CASE required-arguments
engine.createAssetGroup();
// ASSET_GROUP_CASE required-refs
engine.createAssetGroup(scope);
// ASSET_GROUP_CASE genuine-scope-type
engine.createAssetGroup({}, [numberRef]);
// ASSET_GROUP_CASE ref-type
engine.createAssetGroup(scope, [1]);
// ASSET_GROUP_CASE array-type
engine.createAssetGroup(scope, new Set([numberRef]));
// ASSET_GROUP_CASE numeric-concurrency
engine.createAssetGroup(scope, [numberRef], { concurrency: '4' });
// ASSET_GROUP_CASE options-shape
engine.createAssetGroup(scope, [numberRef], 4);
// ASSET_GROUP_CASE readonly-state
numberGroup.state = 'ready';
// ASSET_GROUP_CASE readonly-members
numberGroup.ready.then(members => members.push());
// ASSET_GROUP_CASE group-type-only
void AssetGroup;
// ASSET_GROUP_CASE state-type-only
void AssetGroupState;
// ASSET_GROUP_CASE options-type-only
void AssetGroupOptions;
void fabricated; void incompatible;
