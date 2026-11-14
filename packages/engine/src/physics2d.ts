// SPDX-License-Identifier: Apache-2.0
/** Optional 2D collision and simple physics: bodies without turning, queries, and character movement. */
export { createPhysicsWorld } from './physics2dWorld.js';
export type {
  PhysicsBody, PhysicsBodyKind, PhysicsBodyOptions, PhysicsContact, PhysicsMoveResult, PhysicsRayHit, PhysicsShape, PhysicsSnapshot, PhysicsTileColliders, PhysicsVector,
  PhysicsWorld, PhysicsWorldOptions,
} from './physics2dTypes.js';
