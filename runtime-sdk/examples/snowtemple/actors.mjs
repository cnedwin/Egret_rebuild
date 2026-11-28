// SPDX-License-Identifier: Apache-2.0
import { Scene3D, createAmbientLight3D, createDirectionalLight3D, createPerspectiveCamera3D } from '@egret/engine/world3d';
import { HERO } from './original/rules/tune.mjs';
import { heroPose, pose } from './original/figures.mjs';

export const WIDTH = 768, HEIGHT = 432, DT = 1 / 60;

export function createActorStage({ defaultLights = true } = {}) {
  const scene = new Scene3D();
  scene.background = [0.043, 0.062, 0.082];
  const camera = createPerspectiveCamera3D({ fov: 32, near: 0.1, far: 24 });
  camera.aspect = WIDTH / HEIGHT;
  scene.addChild(camera);
  if (!defaultLights) return { scene, camera };
  scene.addChild(createAmbientLight3D({ intensity: 0.45 }));
  const sun = scene.addChild(createDirectionalLight3D({ color: 0xffe8cd, intensity: 2.1 }));
  sun.setPosition(3, 5, -4).lookAt(0, 0, 0);
  return { scene, camera };
}

// The rules do not decrement hit freeze after death. A continuous duel
// still advances the authored fall with the speed from heroPose or foePose.
export function poseRate(actor, rate, showFall) {
  return actor.freeze > 0 && !(showFall && actor.state === 'dead') ? 0 : rate;
}

export function poseLinChong(figure, game, travel, showFall = false) {
  const h = game.hero;
  const [target, rate] = heroPose(h, HERO, game.time, travel, game.deadFor, figure.gait, DT);
  figure.root.setPosition(h.x, 0, h.z);
  figure.root.setRotation(0, h.face, 0);
  pose(figure, target, poseRate(h, rate, showFall), DT);
  figure.glow += ((h.state === 'cut' ? 3.2 : 0.25) - figure.glow) * Math.min(1, DT * 14);
  figure.metal.emissiveIntensity = figure.glow;
  figure.tintBody(...figure.look.fill);
}

export function paletteHash(figure, frame) {
  const skeleton = figure.root.children.find(node => node.skeleton).skeleton;
  figure.root.updateWorldMatrices(true);
  // Rendering uses nonnegative frame IDs. Observe the finished pose without
  // skipping any update in the renderer's own frame counter.
  skeleton.update(-2 - frame);
  let hash = 2166136261;
  for (const value of skeleton.boneMatrices) hash = Math.imul(hash ^ Math.round(value * 10000), 16777619);
  return (hash >>> 0).toString(16).padStart(8, '0');
}
