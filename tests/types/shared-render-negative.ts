// SPDX-License-Identifier: Apache-2.0
// Strict public consumers; negative statements intentionally retain real compiler errors.
import * as engineFacade from '@egret/engine';
import {
  Mesh2D, createEngineForProfile,
  type Engine, type AssetLease, type Texture,
  type TexturedGeometry2D, type SharedGeometry2D, type SharedGeometryInput2D,
  type SharedMaterial2D, type SharedRenderFrame2D, type SharedRenderHostAdapter,
  type SharedFrameOptions2D, type SharedFrameProfile2D,
  type TexturedRenderFrame2D, type RenderFrame2D, type RenderHostAdapter,
} from '@egret/engine';

export function rejectSharedAsDefaultMesh(lease: AssetLease<Texture>, shared: SharedGeometry2D): void {
  // SHARED_TYPE_CASE ST-N01: an inferred new mesh cannot silently widen old Mesh2D.
  const legacy: Mesh2D = new Mesh2D(lease, shared);
  void legacy;
}

export function rejectSharedReplacement(legacy: Mesh2D, lease: AssetLease<Texture>, shared: SharedGeometry2D): void {
  // SHARED_TYPE_CASE ST-N02: default Mesh2D keeps the old replacement parameter.
  legacy.setContent(lease, shared);
}

export function rejectLegacyReplacement(mesh: Mesh2D<SharedGeometry2D>, lease: AssetLease<Texture>, legacy: TexturedGeometry2D): void {
  // SHARED_TYPE_CASE ST-N03: explicit new G cannot be replaced with the old brand.
  mesh.setContent(lease, legacy);
}

export function rejectRequiredLegacyGetter(mesh: Mesh2D): void {
  // SHARED_TYPE_CASE ST-N04: cleared or disposed slots retain undefined in the type.
  const required: TexturedGeometry2D = mesh.geometry;
  void required;
}

export function rejectRequiredSharedGetter(mesh: Mesh2D<SharedGeometry2D>): void {
  // SHARED_TYPE_CASE ST-N05: new G does not remove the empty slot state.
  const required: SharedGeometry2D = mesh.geometry;
  void required;
}

export function rejectGeometryBrandAlias(shared: SharedGeometry2D): void {
  // SHARED_TYPE_CASE ST-N06: new geometry is not the old nominal geometry type.
  const legacy: TexturedGeometry2D = shared;
  void legacy;
}

export function rejectStructuralSharedGeometry(): void {
  // SHARED_TYPE_CASE ST-N07: matching fields cannot supply the erased factory brand.
  const fake: SharedGeometry2D = {
    vertexCount: 0, indexCount: 0, triangleCount: 0, logicalByteLength: 0,
    positions: [], uvs: [], lightColors: [], darkColors: [], indices: [],
  };
  void fake;
}

export function rejectMutableDarkPayload(shared: SharedGeometry2D): void {
  // SHARED_TYPE_CASE ST-N08: shared owned values are readonly.
  shared.darkColors[0] = 0;
}

export function rejectWrongInputArray(input: SharedGeometryInput2D): void {
  // SHARED_TYPE_CASE ST-N09: geometry positions are typed arrays, not arbitrary arrays.
  const bad: SharedGeometryInput2D = { ...input, positions: [0, 0, 1, 0, 0, 1] };
  void bad;
}

export function rejectEngineGeometryGuard(value: unknown): void {
  // SHARED_TYPE_CASE ST-N10: the root engine facade does not export the assembly guard.
  engineFacade.isSharedGeometry2D(value);
}

export function rejectEngineMaterialGuard(value: unknown): void {
  // SHARED_TYPE_CASE ST-N11: the contracts guard is not a second public Engine API.
  engineFacade.isSharedMaterial2D(value);
}

export function rejectLegacyAsSharedFrame(frame: RenderFrame2D): void {
  // SHARED_TYPE_CASE ST-N12: a historical frame is not a shared completed frame.
  const shared: SharedRenderFrame2D = frame;
  void shared;
}

export function rejectTexturedAsSharedFrame(frame: TexturedRenderFrame2D): void {
  // SHARED_TYPE_CASE ST-N13: a textured completed frame has a different protocol/brand.
  const shared: SharedRenderFrame2D = frame;
  void shared;
}

export function rejectSharedOnLegacyPort(host: RenderHostAdapter, frame: SharedRenderFrame2D): void {
  // SHARED_TYPE_CASE ST-N14: a shared barrier/opacity union is not a historical command union.
  host.renderFrame(frame);
}

export function rejectLegacyOnSharedPort(host: SharedRenderHostAdapter, frame: RenderFrame2D): void {
  // SHARED_TYPE_CASE ST-N15: shared port requires the actual shared type.
  host.renderSharedFrame(frame);
}

export function rejectAsyncSharedPort(): void {
  // SHARED_TYPE_CASE ST-N16: the shared protocol is synchronous and returns undefined.
  const asyncPort: SharedRenderHostAdapter['renderSharedFrame'] = async (_frame: SharedRenderFrame2D) => undefined;
  void asyncPort;
}

export function rejectVoidSharedPort(): void {
  // SHARED_TYPE_CASE ST-N17: a general void return does not promise exact undefined.
  const voidPort: SharedRenderHostAdapter['renderSharedFrame'] = (_frame: SharedRenderFrame2D): void => {};
  void voidPort;
}

export function rejectUnknownProfile(host: SharedRenderHostAdapter): void {
  // SHARED_TYPE_CASE ST-N18: the profile parameter is a declared literal protocol.
  createEngineForProfile({ host }, 'egret.shared-frame2d/2');
}

export function rejectWrongProfileLiteral(): void {
  // SHARED_TYPE_CASE ST-N19: profile declarations cannot be arbitrary strings.
  const profile: SharedFrameProfile2D = 'egret.textured-frame2d/1';
  void profile;
}

export function rejectInvalidOutputAlpha(): void {
  // SHARED_TYPE_CASE ST-N20: output alpha policies are the two selected values.
  const options: SharedFrameOptions2D = { width: 8, height: 8, outputAlpha: 'straight' };
  void options;
}

export function rejectPresentUndefinedOption(): void {
  // SHARED_TYPE_CASE ST-N21: exactOptionalPropertyTypes preserves absence versus explicit undefined.
  const options: SharedFrameOptions2D = { width: 8, height: 8, outputAlpha: undefined };
  void options;
}

export function rejectMissingFrameHeight(engine: Engine): void {
  // SHARED_TYPE_CASE ST-N22: capture requires both logical dimensions.
  engine.captureSharedFrame({ width: 8 });
}

export function rejectMutableCompletedCommands(frame: SharedRenderFrame2D): void {
  // SHARED_TYPE_CASE ST-N23: completed command arrays cannot be changed.
  frame.commands.length = 0;
}

export function rejectMutableMaterialTuple(material: SharedMaterial2D): void {
  // SHARED_TYPE_CASE ST-N24: a material's owned coefficient tuple cannot be changed.
  material.light[3] = .5;
}
