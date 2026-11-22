// SPDX-License-Identifier: Apache-2.0
import { WIDTH, HEIGHT, DT, createActorStage, paletteHash, poseLinChong } from './actors.mjs';
import { createGame, quiet, step } from './original/rules/game.mjs';
import { HERO } from './original/rules/tune.mjs';
import { createFigure, heroPose, pose } from './original/figures.mjs';
import { BONES } from './original/rig.mjs';
import { bodyParts } from './original/body.mjs';
import { equipment } from './original/equipment.mjs';

export { WIDTH, HEIGHT };
export const CHECKPOINTS = ['idle', 'walk', 'thrust'];

export function createHeroScene(asset, gearBytes) {
  const { scene, camera } = createActorStage();
  const parts = bodyParts(asset.scene, BONES), gear = {}, contacts = new Set();
  let figure, game, tick, travel, pending, checkpoint, attack, paused = false;
  let diagnosticsTick = -1, diagnosticsHash, poseSequence = 0;
  function close() {
    contacts.clear();
    figure?.dispose();
    for (const geometry of Object.values(gear)) geometry.dispose();
    scene.removeChildren();
  }
  function frameHero() {
    const { x, z } = game.hero;
    camera.setPosition(x + 3.7, 1.67, z - 3.6).lookAt(x, 1.02, z);
  }
  function reset() {
    figure?.dispose();
    game = createGame(7);
    figure = createFigure('hero', gear, 'low', parts);
    figure.metal.emissive.set([0.45, 0.75, 1]);
    scene.addChild(figure.root);
    const h = game.hero;
    figure.root.setPosition(h.x, 0, h.z);
    figure.root.setRotation(0, h.face, 0);
    pose(figure, heroPose(h, HERO, 0, 0, 0, figure.gait, 0)[0], 1, 1e3);
    tick = travel = pending = 0;
    diagnosticsTick = -1;
    checkpoint = null;
    attack = false;
    contacts.clear();
    frameHero();
  }
  function advance(walk, thrust) {
    const h = game.hero, x = h.x, z = h.z, command = quiet();
    command.mz = walk ? -0.38 : 0;
    command.attack = thrust;
    step(game, command, DT);
    tick++;
    travel += Math.hypot(h.x - x, h.z - z);
    poseLinChong(figure, game, travel);
    frameHero();
  }
  function hold(name) {
    if (!CHECKPOINTS.includes(name)) throw new RangeError('Unknown pose checkpoint');
    reset();
    for (let i = 0; i < 30; i++) advance(false, false);
    if (name !== 'idle') for (let i = 0; i < 24; i++) advance(true, false);
    if (name === 'thrust') for (let i = 0; i < 10; i++) advance(false, i === 0);
    checkpoint = name;
  }
  function input({ type, id, x, y }) {
    if (paused) return;
    if (type === 'up' || type === 'cancel') {
      contacts.delete(id);
      return;
    }
    if (type !== 'down') return;
    if (y >= 0 && y < 54 && x >= 0 && x < WIDTH) {
      hold(CHECKPOINTS[Math.floor(3 * x / WIDTH)]);
    } else if (y >= 350 && y <= HEIGHT && x >= 0 && x < WIDTH) {
      checkpoint = null;
      if (x < WIDTH / 2) contacts.add(id);
      else attack = true;
    }
  }
  function update(dt) {
    if (paused || checkpoint) return;
    pending += Math.min(0.1, Math.max(0, dt));
    while (pending >= DT) {
      advance(contacts.size > 0, attack);
      attack = false;
      pending -= DT;
    }
  }
  function state() {
    const h = game.hero;
    const skeleton = figure.root.children.find(node => node.skeleton).skeleton;
    if (diagnosticsTick !== tick) {
      diagnosticsHash = paletteHash(figure, poseSequence++);
      diagnosticsTick = tick;
    }
    return { mode: checkpoint ? 'checkpoint' : 'live', checkpoint, tick, paused,
      action: h.state === 'cut' ? 'thrust' : h.moving ? 'walk' : 'idle',
      hero: { x: h.x, z: h.z, face: h.face, state: h.state, t: h.t },
      joints: skeleton.bones.length, paletteHash: diagnosticsHash };
  }
  try {
    for (const name of ['spear', 'spearEdge']) gear[name] = equipment(name, gearBytes[name]);
    reset();
    return { scene, camera, hold, input, update, state, close,
      pause() { paused = true; pending = 0; attack = false; contacts.clear(); },
      resume() { paused = false; pending = 0; }
    };
  } catch (error) {
    close();
    throw error;
  }
}
