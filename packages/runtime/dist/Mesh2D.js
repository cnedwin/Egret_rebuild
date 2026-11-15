import { isTexturedGeometry2D, isSharedGeometry2D } from "@egret/contracts";
import { isAssetLease, readAssetLeaseValue } from "./AssetLease.js";
import { DisplayObject } from "./DisplayObject.js";
import { assertLive, isTerminated, terminateNode } from "./displayTreeState.js";
import { EgretError } from "./EgretError.js";
import { readMeshState, writeMeshState } from "./meshDisplayState.js";
import { claimOwner, commitBinding, engineOf } from "./ownership.js";
import { isTexture, readTextureSnapshot } from "./Texture.js";
const mutations = new WeakSet();
const identities = new WeakSet();
const hasIdentity = identities.has.bind(identities);
const registerIdentity = identities.add.bind(identities);
/** Class identity survives clear/dispose; another textured leaf gains no Mesh methods. */
function assertMesh(value) {
    if (!hasIdentity(value))
        throw new EgretError("MESH_INVALID");
}
function contentState(lease, geometry, sourceRect, viewRegion) {
    return Object.freeze({ lease, geometry, sourceRect, viewRegion, regionOnly: false });
}
/** Entitlement and live Texture authority never use public resource getters. */
function readMeshTexture(lease) {
    const value = readAssetLeaseValue(lease);
    if (!isTexture(value))
        throw new EgretError("MESH_TEXTURE_INVALID");
    return readTextureSnapshot(value);
}
/** Identity, display lifetime and Engine lifetime precede the mutation guard. */
function beginMutation(node) {
    assertMesh(node);
    assertLive(node);
    const engine = engineOf(node);
    engine.assertOpen();
    if (mutations.has(node))
        throw new EgretError("MESH_MUTATION_REENTRANT");
    mutations.add(node);
    return engine;
}
/** Reentry or terminal cleanup cannot resurrect a previously observed slot. */
function revalidateMutation(node, engine, previous) {
    assertLive(node);
    engine.assertOpen();
    if (readMeshState(node) !== previous)
        throw new EgretError("MESH_MUTATION_REENTRANT");
}
/** A display leaf borrowing an exact lease and an immutable owned geometry. */
export class Mesh2D extends DisplayObject {
    /** Opaque producer binding: scene traversal exposes neither its borrowed lease nor a content writer. */
    static createBinding(textureLease, geometry) {
        if (!isTexturedGeometry2D(geometry) && !isSharedGeometry2D(geometry))
            throw new EgretError("MESH_GEOMETRY_INVALID");
        if (!isAssetLease(textureLease))
            throw new EgretError("MESH_LEASE_INVALID");
        const initial = readMeshTexture(textureLease), engine = engineOf(textureLease);
        engine.assertOpen();
        let disposed = false, cleaned = false, finishListeners = () => { };
        const creation = {};
        class OpaqueMesh extends DisplayObject {
            constructor(token) {
                if (token !== creation)
                    throw new EgretError("MESH_BINDING_FACTORY_REQUIRED");
                super();
                const cleanup = this.clearListeners;
                finishListeners = () => {
                    Reflect.apply(cleanup, this, []);
                };
            }
            dispose() {
                dispose();
            }
        }
        const node = new OpaqueMesh(creation);
        function finish() {
            if (cleaned)
                return;
            cleaned = true;
            const cleanup = finishListeners;
            finishListeners = () => { };
            cleanup();
        }
        // Retire all resources before any external cancellation-listener cleanup can reenter an owner.
        function beginDispose() {
            if (!disposed) {
                disposed = true;
                writeMeshState(node, undefined);
                terminateNode(node);
            }
            return finish;
        }
        function dispose() {
            beginDispose()();
        }
        function live() {
            if (disposed)
                throw new EgretError("MESH_BINDING_DISPOSED");
            assertLive(node);
            engine.assertOpen();
        }
        commitBinding([node], engine);
        writeMeshState(node, contentState(textureLease, geometry, initial.sourceRect, initial.viewRegion));
        const binding = Object.freeze({
            node,
            dispose,
            beginDispose,
            prepare(lease, geometry) {
                live();
                if (!isTexturedGeometry2D(geometry) && !isSharedGeometry2D(geometry))
                    throw new EgretError("MESH_GEOMETRY_INVALID");
                if (!isAssetLease(lease))
                    throw new EgretError("MESH_LEASE_INVALID");
                if (engineOf(lease) !== engine)
                    throw new EgretError("ENGINE_MISMATCH");
                const snapshot = readMeshTexture(lease), previous = readMeshState(node);
                const next = contentState(lease, geometry, snapshot.sourceRect, snapshot.viewRegion);
                let settled = false;
                return Object.freeze({
                    abort() {
                        settled = true;
                    },
                    commit() {
                        live();
                        if (settled || readMeshState(node) !== previous)
                            throw new EgretError("MESH_BINDING_STALE");
                        // These identity/entitlement reads and publication invoke no caller code.
                        readMeshTexture(lease);
                        settled = true;
                        writeMeshState(node, next);
                    }
                });
            }
        });
        // A consumer Scope cannot adopt an adapter-owned child through display traversal.
        commitBinding([binding], engine);
        claimOwner(node, binding);
        Object.freeze(node);
        return binding;
    }
    constructor(textureLease, geometry) {
        super();
        // Geometry authentication outranks every lease identity or entitlement read.
        if (!isTexturedGeometry2D(geometry) && !isSharedGeometry2D(geometry))
            throw new EgretError("MESH_GEOMETRY_INVALID");
        if (!isAssetLease(textureLease))
            throw new EgretError("MESH_LEASE_INVALID");
        const snapshot = readMeshTexture(textureLease);
        const engine = engineOf(textureLease);
        engine.assertOpen();
        commitBinding([this], engine);
        writeMeshState(this, contentState(textureLease, geometry, snapshot.sourceRect, snapshot.viewRegion));
        registerIdentity(this);
    }
    /** Cached identity-only reads remain valid after clear or terminal disposal. */
    get textureLease() {
        assertMesh(this);
        return readMeshState(this)?.lease;
    }
    get geometry() {
        assertMesh(this);
        return readMeshState(this)?.geometry;
    }
    setContent(textureLease, geometry) {
        const engine = beginMutation(this);
        try {
            const previous = readMeshState(this);
            if (!isTexturedGeometry2D(geometry) && !isSharedGeometry2D(geometry))
                throw new EgretError("MESH_GEOMETRY_INVALID");
            if (!isAssetLease(textureLease))
                throw new EgretError("MESH_LEASE_INVALID");
            // Foreign Engine affinity wins even when that lease or Texture is retired.
            if (engineOf(textureLease) !== engine)
                throw new EgretError("ENGINE_MISMATCH");
            const snapshot = readMeshTexture(textureLease);
            revalidateMutation(this, engine, previous);
            // Publish all borrowed content together; no callbacks occur at commit.
            writeMeshState(this, contentState(textureLease, geometry, snapshot.sourceRect, snapshot.viewRegion));
        }
        finally {
            mutations.delete(this);
        }
    }
    /** Clearing drops only cached content; Engine affinity and caller borrows stay. */
    clear() {
        beginMutation(this);
        try {
            writeMeshState(this, undefined);
        }
        finally {
            mutations.delete(this);
        }
    }
    /** Drop the slot before base cleanup; terminal callback reentry sees no content. */
    dispose() {
        assertMesh(this);
        if (isTerminated(this))
            return;
        writeMeshState(this, undefined);
        super.dispose();
    }
}
//# sourceMappingURL=Mesh2D.js.map