import { isTexturedGeometry2D, isSharedGeometry2D } from "@egret/contracts";
import type { TexturedGeometry2D, SharedGeometry2D, TextureRegion2D, TextureViewRegion2D } from "@egret/contracts";
import { isAssetLease, readAssetLeaseValue } from "./AssetLease.js";
import type { AssetLease } from "./AssetLease.js";
import { DisplayObject } from "./DisplayObject.js";
import { assertLive, isTerminated } from "./displayTreeState.js";
import { EgretError } from "./EgretError.js";
import { readMeshState, writeMeshState } from "./meshDisplayState.js";
import type { MeshCaptureState } from "./meshDisplayState.js";
import { commitBinding, engineOf } from "./ownership.js";
import type { EngineContext } from "./ownership.js";
import { isTexture, readTextureSnapshot } from "./Texture.js";
import type { Texture, TextureSnapshot2D } from "./Texture.js";

const mutations = new WeakSet<object>();
const identities = new WeakSet<object>();
const hasIdentity = identities.has.bind(identities);
const registerIdentity = identities.add.bind(identities);

/** Class identity survives clear/dispose; another textured leaf gains no Mesh methods. */
function assertMesh(value: unknown): void {
  if (!hasIdentity(value as object)) throw new EgretError("MESH_INVALID");
}

function contentState(lease: AssetLease<Texture>, geometry: TexturedGeometry2D | SharedGeometry2D, sourceRect: TextureRegion2D, viewRegion: TextureViewRegion2D | null): MeshCaptureState {
  return Object.freeze({ lease, geometry, sourceRect, viewRegion, regionOnly: false });
}

/** Entitlement and live Texture authority never use public resource getters. */
function readMeshTexture(lease: AssetLease<Texture>): TextureSnapshot2D {
  const value = readAssetLeaseValue(lease);
  if (!isTexture(value)) throw new EgretError("MESH_TEXTURE_INVALID");
  return readTextureSnapshot(value);
}

/** Identity, display lifetime and Engine lifetime precede the mutation guard. */
function beginMutation(node: Mesh2D<TexturedGeometry2D | SharedGeometry2D>): EngineContext {
  assertMesh(node);
  assertLive(node);
  const engine = engineOf(node)!;
  engine.assertOpen();
  if (mutations.has(node)) throw new EgretError("MESH_MUTATION_REENTRANT");
  mutations.add(node);
  return engine;
}

/** Reentry or terminal cleanup cannot resurrect a previously observed slot. */
function revalidateMutation(node: Mesh2D<TexturedGeometry2D | SharedGeometry2D>, engine: EngineContext, previous: MeshCaptureState | undefined): void {
  assertLive(node);
  engine.assertOpen();
  if (readMeshState(node) !== previous) throw new EgretError("MESH_MUTATION_REENTRANT");
}

/** A display leaf borrowing an exact lease and an immutable owned geometry. */
export class Mesh2D<G extends TexturedGeometry2D | SharedGeometry2D = TexturedGeometry2D> extends DisplayObject {
  public constructor(textureLease: AssetLease<Texture>, geometry: G) {
    super();
    // Geometry authentication outranks every lease identity or entitlement read.
    if (!isTexturedGeometry2D(geometry) && !isSharedGeometry2D(geometry)) throw new EgretError("MESH_GEOMETRY_INVALID");
    if (!isAssetLease(textureLease)) throw new EgretError("MESH_LEASE_INVALID");
    const snapshot = readMeshTexture(textureLease);
    const engine = engineOf(textureLease)!;
    engine.assertOpen();
    commitBinding([this], engine);
    writeMeshState(this, contentState(textureLease, geometry, snapshot.sourceRect, snapshot.viewRegion));
    registerIdentity(this);
  }

  /** Cached identity-only reads remain valid after clear or terminal disposal. */
  public get textureLease(): AssetLease<Texture> | undefined {
    assertMesh(this);
    return readMeshState(this)?.lease;
  }

  public get geometry(): G | undefined {
    assertMesh(this);
    return readMeshState(this)?.geometry as G | undefined;
  }

  public setContent(textureLease: AssetLease<Texture>, geometry: G): void {
    const engine = beginMutation(this);
    try {
      const previous = readMeshState(this);
      if (!isTexturedGeometry2D(geometry) && !isSharedGeometry2D(geometry)) throw new EgretError("MESH_GEOMETRY_INVALID");
      if (!isAssetLease(textureLease)) throw new EgretError("MESH_LEASE_INVALID");
      // Foreign Engine affinity wins even when that lease or Texture is retired.
      if (engineOf(textureLease) !== engine) throw new EgretError("ENGINE_MISMATCH");
      const snapshot = readMeshTexture(textureLease);
      revalidateMutation(this, engine, previous);
      // Publish all borrowed content together; no callbacks occur at commit.
      writeMeshState(this, contentState(textureLease, geometry, snapshot.sourceRect, snapshot.viewRegion));
    } finally {
      mutations.delete(this);
    }
  }

  /** Clearing drops only cached content; Engine affinity and caller borrows stay. */
  public clear(): void {
    beginMutation(this);
    try {
      writeMeshState(this, undefined);
    } finally {
      mutations.delete(this);
    }
  }

  /** Drop the slot before base cleanup; terminal callback reentry sees no content. */
  public override dispose(): void {
    assertMesh(this);
    if (isTerminated(this)) return;
    writeMeshState(this, undefined);
    super.dispose();
  }
}
