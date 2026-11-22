// SPDX-License-Identifier: Apache-2.0
import { createGame, quiet, step } from './original/rules/game.mjs';
import { HERO } from './original/rules/tune.mjs';
import { createFigure, heroPose, foePose, pose } from './original/figures.mjs';
import { BONES, YARD_BONES } from './original/rig.mjs';
import { bodyParts } from './original/body.mjs';
import { equipment } from './original/equipment.mjs';
import { WIDTH, HEIGHT, DT, createActorStage, paletteHash, poseLinChong, poseRate } from './actors.mjs';

import { createDuel, duelControls, duelMessages } from './duel.mjs';

export { duelControls };
export function openDuel(assets) { return openScene(assets, createDuel()); }

export const controls = [
  ['Restart', 384, 26, 150], ['Hold to approach', 192, 398, 205], ['Thrust', 576, 398, 160]
];
const names = ['spear', 'spearEdge', 'sabre', 'sabreEdge'];

export async function openScene({ glb, bytes }, duel) {
  const lin = await glb('hero-low.glb', 200);
  const blade = await glb('blade-low.glb', 204);
  const linParts = bodyParts(lin.scene, BONES), bladeParts = bodyParts(blade.scene, YARD_BONES);
  const { scene, camera } = createActorStage();
  const gear = {}, walking = new Set();
  let game, enemy, heroFigure, enemyFigure, phase, tick, hitCount, lastHit;
  let heroTravel, enemyTravel, pending, attack, suspended = false;
  let poseSequence = 0, sampledTick = -1, heroHash, enemyHash;
  function close() {
    walking.clear();
    duel?.releaseAll();
    heroFigure?.dispose();
    enemyFigure?.dispose();
    for (const item of Object.values(gear)) item.dispose();
    scene.removeChildren();
  }
  function distance() { return Math.hypot(enemy.x - game.hero.x, enemy.z - game.hero.z); }
  function frameBoth() {
    const x = (game.hero.x + enemy.x) / 2, z = (game.hero.z + enemy.z) / 2;
    const radius = Math.max(5.2, distance() * 1.45);
    camera.setPosition(x - radius, 2.1, z - radius * 0.24).lookAt(x, 1.02, z);
  }
  function reset() {
    heroFigure?.dispose();
    enemyFigure?.dispose();
    game = createGame(7);
    // The first swordsman retains his authored position, AI, health and moves.
    // Other party members are outside this two-character encounter.
    enemy = game.foes.find(foe => foe.party === 0 && foe.kind === 'blade');
    game.foes = [enemy, game.boss];
    const h = game.hero;
    h.x = enemy.x;
    h.z = enemy.z + 6;
    heroFigure = createFigure('hero', gear, 'low', linParts);
    enemyFigure = createFigure('blade', gear, 'low', bladeParts);
    heroFigure.metal.emissive.set([0.45, 0.75, 1]);
    scene.addChild(heroFigure.root);
    scene.addChild(enemyFigure.root);
    heroFigure.root.setPosition(h.x, 0, h.z).setRotation(0, h.face, 0);
    enemyFigure.root.setPosition(enemy.x, 0, enemy.z).setRotation(0, enemy.face, 0);
    pose(heroFigure, heroPose(h, HERO, 0, 0, 0, heroFigure.gait, 0)[0], 1, 1e3);
    pose(enemyFigure, foePose(enemy, 0, 0, enemyFigure.gait, 0)[0], 1, 1e3);
    tick = heroTravel = enemyTravel = pending = hitCount = 0;
    lastHit = null;
    attack = false;
    sampledTick = -1;
    phase = 'ready';
    duel?.reset();
    walking.clear();
    frameBoth();
  }
  function poseEnemy(hit) {
    const [target, rate] = foePose(enemy, game.time, enemyTravel, enemyFigure.gait, DT);
    const jitter = enemy.shake > 0 ? Math.sin(game.time * 90) * enemy.shake * 0.25 : 0;
    enemyFigure.root.setPosition(enemy.x + jitter, 0, enemy.z).setRotation(0, enemy.face, 0);
    pose(enemyFigure, target, poseRate(enemy, rate, !!duel), DT);
    const threat = enemy.state === 'windup' ? 0.4 + 3 * enemy.t / enemy.move.windup : enemy.state === 'strike' ? 3.5 : 0;
    enemyFigure.glow += (threat - enemyFigure.glow) * Math.min(1, DT * 12);
    enemyFigure.metal.emissiveIntensity = enemyFigure.glow;
    if (hit) enemyFigure.flash = 1;
    enemyFigure.flash = Math.max(0, enemyFigure.flash - DT * 7);
    const [red, green, blue] = enemyFigure.look.fill;
    enemyFigure.tintBody(red + enemyFigure.flash, green + enemyFigure.flash * 0.9, blue + enemyFigure.flash * 0.8);
  }
  function advance() {
    const h = game.hero, hx = h.x, hz = h.z, ex = enemy.x, ez = enemy.z;
    const before = enemy.hp, heroBefore = h.hp, input = quiet(), range = distance() || 1;
    const dx = (ex - hx) / range, dz = (ez - hz) / range;
    if (duel) duel.command(input, h, enemy);
    else if (phase === 'approach') {
      input.mx = dx * 0.64;
      input.mz = dz * 0.64;
    } else {
      input.ax = dx;
      input.az = dz;
      input.attack = attack;
    }
    attack = false;
    const events = step(game, input, DT);
    tick++;
    heroTravel += Math.hypot(h.x - hx, h.z - hz);
    enemyTravel += Math.hypot(enemy.x - ex, enemy.z - ez);
    const hit = events.find(e => e.type === 'hit' && e.id === enemy.id && e.source === 'cut');
    poseLinChong(heroFigure, game, heroTravel, !!duel);
    poseEnemy(hit);
    frameBoth();
    if (hit) {
      hitCount++;
      lastHit = { tick, target: hit.id, source: hit.source, amount: hit.amount, before, after: enemy.hp, cut: h.cut };
      phase = 'hit';
    }
    if (duel) { duel.observe(tick, events, h, enemy, heroBefore, before); return; }
    if (h.state === 'dead' || enemy.state === 'dead') phase = 'finished';
    else if (phase === 'approach' && distance() <= 2.55) phase = 'in-range';
    else if (phase === 'attacking' && h.state === 'free') phase = 'ready';
  }
  function running() { return duel ? duel.running() : phase === 'attacking' || (phase === 'approach' && walking.size > 0); }
  function update(dt) {
    if (suspended || !running()) return;
    pending += Math.min(0.1, Math.max(0, dt));
    while (pending >= DT && running()) { advance(); pending -= DT; }
    if (!running()) pending = 0;
  }
  function input({ type, x, y, id }) {
    if (suspended) return;
    if (type === 'up' || type === 'cancel') { walking.delete(id); duel?.release(id, type === 'cancel'); return; }
    if (type !== 'down' || x < 0 || x >= WIDTH || y < 0 || y >= HEIGHT) return;
    if (y < 54 && Math.abs(x - WIDTH / 2) < 90) { reset(); return; }
    if (y < 350) return;
    if (duel) { duel.press(x >= WIDTH / 2, id); return; }
    if (phase === 'finished') return;
    if (x < WIDTH / 2) {
      if (phase === 'ready' || phase === 'approach') { walking.add(id); phase = 'approach'; }
    } else {
      walking.clear();
      attack = true;
      phase = 'attacking';
    }
  }
  function state() {
    if (sampledTick !== tick) {
      heroHash = paletteHash(heroFigure, poseSequence);
      enemyHash = paletteHash(enemyFigure, poseSequence++);
      sampledTick = tick;
    }
    const h = game.hero;
    const fallen = duel && (h.state === 'dead' ? heroFigure : enemy.state === 'dead' ? enemyFigure : null);
    // Observe the posed joint, not the target or the HP counter: hit freeze
    // can leave a defeated actor standing even when the rules report death.
    const fall = fallen ? { actor: fallen === heroFigure ? 'lin' : 'blade', hipPitch: fallen.angles.hips[0] } : null;
    const actor = (a, hash, joints) => ({ x: a.x, z: a.z, hp: a.hp, state: a.state, t: a.t, face: a.face, joints, paletteHash: hash });
    return { mode: duel ? 'duel' : 'yard', tick, paused: suspended, hero: actor(h, heroHash, BONES.length),
      enemy: { ...actor(enemy, enemyHash, YARD_BONES.length), id: enemy.id, kind: enemy.kind },
      encounter: { phase, distance: distance(), heroTravel, enemyTravel, hitCount, lastHit, ...(duel ? { ...duel.state(tick), fall } : {}) } };
  }
  try {
    for (const name of names) gear[name] = equipment(name, await bytes(name + '.bin'));
    reset();
    return { scene, camera, input, update, state, close, messages: duel ? duelMessages : undefined,
      pause() { suspended = true; pending = 0; walking.clear(); duel?.releaseAll(); attack = false; },
      resume() { suspended = false; pending = 0; }
    };
  } catch (error) {
    close();
    throw error;
  }
}
