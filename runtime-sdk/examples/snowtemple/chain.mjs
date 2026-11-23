// SPDX-License-Identifier: Apache-2.0
import { Mesh3D, createBoxGeometry3D, createStandardMaterial3D } from '@egret/engine/world3d';
import { createFigure, foePose, pose } from './original/figures.mjs';
import { BONES, YARD_BONES } from './original/rig.mjs';
import { BOONS } from './original/rules/boons.mjs';
import { bodyParts } from './original/body.mjs';
import { equipment } from './original/equipment.mjs';
import { WIDTH, HEIGHT, DT, createActorStage, paletteHash, poseLinChong, poseRate } from './actors.mjs';
import { createEncounters } from './encounters.mjs';

export const controls = [
  ['Restart', 384, 26, 150], ['Single thrust', 192, 398, 180],
  ['Stand', 384, 398, 140], ['Fight party', 576, 398, 180]
];
const messages = ['Ready', 'Party 1', 'Choose a lesson', 'Party 2', 'Defeat', 'Yard cleared'];
const kinds = ['hero', 'blade', 'bow', 'shield'];
const weapons = ['spear', 'spearEdge', 'sabre', 'sabreEdge', 'short', 'shortEdge', 'rattan', 'longbow'];
const troop = (game, foe) => foe !== game.boss;

export async function openScene({ glb, bytes }, temple) {
  const parts = {}, gear = {}, figures = new Map(), arrows = new Map();
  const run = createEncounters({ throughGate: Boolean(temple) }), { scene, camera } = createActorStage();
  const arrow = createBoxGeometry3D({ width: 0.045, height: 0.045, depth: 0.85 });
  const arrowMaterial = createStandardMaterial3D({ color: 0xf1d7a5 });
  const floor = createBoxGeometry3D({ width: 38, height: 0.06, depth: temple ? 92 : 62 });
  const floorMaterial = createStandardMaterial3D({ color: 0x647480, roughness: 1 });
  scene.addChild(new Mesh3D(floor, floorMaterial)).setPosition(0, -0.045, temple ? 0 : 13);
  const gateway = temple?.createGateway(scene);
  const visibleFoe = (game, foe) => troop(game, foe) || (temple && ['gate', 'boss', 'done'].includes(game.stage));
  const travels = new Map();
  let pending = 0, paused = false, poseSequence = 0, sampledTick = -1, heroHash;
  const heroKey = 'lin';
  // Keep each figure and its skeleton until the round ends. Every actor of a
  // given role shares its loaded geometry and textures while posing separately.
  function bind(key, actor, kind) {
    if (figures.has(key)) return figures.get(key);
    const figure = createFigure(kind, gear, 'low', parts[kind]);
    if (kind === 'hero') figure.metal.emissive.set([0.45, 0.75, 1]);
    figures.set(key, figure);
    travels.set(key, { x: actor.x, z: actor.z, distance: 0 });
    scene.addChild(figure.root);
    return figure;
  }
  function travel(key, actor) {
    const track = travels.get(key);
    track.distance += Math.hypot(actor.x - track.x, actor.z - track.z);
    track.x = actor.x; track.z = actor.z;
    return track.distance;
  }
  function clearRound() {
    for (const figure of figures.values()) figure.dispose();
    for (const mesh of arrows.values()) mesh.removeFromParent();
    arrows.clear(); figures.clear(); travels.clear();
    sampledTick = -1; pending = 0;
  }
  function close() {
    clearRound(); scene.removeChildren();
    for (const geometry of Object.values(gear)) geometry.dispose();
    gateway?.close();
    floor.dispose(); floorMaterial.dispose(); arrow.dispose(); arrowMaterial.dispose();
  }
  function updateView(events = []) {
    const g = run.game, h = g.hero;
    poseLinChong(bind(heroKey, h, 'hero'), g, travel(heroKey, h), true);
    gateway?.update(g.bars);
    for (const f of g.foes) {
      if (!visibleFoe(g, f)) continue;
      const figure = bind(f.id, f, f.kind);
      const [target, rate] = foePose(f, g.time, travel(f.id, f), figure.gait, DT);
      figure.root.setPosition(f.x, 0, f.z).setRotation(0, f.face, 0);
      pose(figure, target, poseRate(f, rate, true), DT);
      if (events.some(e => e.type === 'hit' && e.id === f.id)) figure.flash = 1;
      figure.flash = Math.max(0, figure.flash - DT * 7);
      const [r, green, b] = figure.look.fill;
      figure.tintBody(r + figure.flash, green + figure.flash * 0.9, b + figure.flash * 0.8);
    }
    for (const shot of g.shots) {
      if (!arrows.has(shot.id)) arrows.set(shot.id, scene.addChild(new Mesh3D(arrow, arrowMaterial)));
      arrows.get(shot.id).setPosition(shot.x, 1.15, shot.z).setRotation(0, shot.face, 0);
    }
    for (const [id, mesh] of arrows) {
      if (!g.shots.some(shot => shot.id === id)) { mesh.removeFromParent(); arrows.delete(id); }
    }
    // Keep an opponent entering from either side visible. On the long approach
    // the camera follows Lin Chong instead of making both parties tiny.
    if (temple?.frameMeet(camera, g)) return;
    const active = g.foes.filter(f => visibleFoe(g, f) && f.state !== 'dead' && Math.hypot(f.x - h.x, f.z - h.z) <= 20);
    let minX=h.x,maxX=h.x,minZ=h.z,maxZ=h.z;
    for(const f of active){minX=Math.min(minX,f.x);maxX=Math.max(maxX,f.x);minZ=Math.min(minZ,f.z);maxZ=Math.max(maxZ,f.z);}
    const x=(minX+maxX)/2,z=(minZ+maxZ)/2,span=Math.max(6,(maxX-minX)*1.05,(maxZ-minZ)*1.7);
    camera.setPosition(x + span * 0.40, span * 0.85 + 1.2, z + span * 1.25).lookAt(x, 0.75, z);
  }
  function next(pick) { const events = run.advance(pick); if (events) updateView(events); }
  function update(dt) {
    if (paused || !['fighting','settling'].includes(run.phase)) return;
    pending += Math.max(0, Math.min(0.1,dt));
    while (pending >= DT && ['fighting','settling'].includes(run.phase)) { next(); pending -= DT; }
    if (!['fighting','settling'].includes(run.phase)) pending = 0;
  }
  function input({ type, x, y }) {
    if (paused || type !== 'down' || x < 0 || x >= WIDTH || y < 0 || y >= HEIGHT) return;
    if (Math.abs(x-384) <= 75 && Math.abs(y-26) <= 18) { clearRound(); run.reset(); updateView(); return; }
    const button = controls.slice(1).findIndex(([,cx,cy,width]) => Math.abs(cx-x) <= width/2 && Math.abs(cy-y) <= 18);
    if (button < 0) return;
    if (run.phase === 'choice') next(button); else run.command(button);
  }
  function state() {
    const g = run.game, h = g.hero, foes = g.foes.filter(f => troop(g, f));
    const foe = (temple && g.stage === 'boss' ? g.boss : run.target()) ?? foes[foes.length - 1];
    const encounter = run.state();
    const caption = temple?.caption(g, encounter);
    if (caption) encounter.message = caption;
    if (sampledTick !== run.tick) { heroHash=paletteHash(figures.get(heroKey),poseSequence++);sampledTick=run.tick; }
    return { mode:temple ? 'temple-gate' : 'encounters', tick:run.tick, paused,
      hero:{x:h.x,z:h.z,hp:h.hp,state:h.state,paletteHash:heroHash,stamina:h.stamina,will:h.will,gourd:h.gourd},
      enemy:{id:foe.id,kind:foe.kind,x:foe.x,z:foe.z,hp:foe.hp,state:foe.state},
      encounter };
  }
  try {
    for (const [i,kind] of (temple ? [...kinds, 'lu'] : kinds).entries()) {
      const model = await glb(kind + '-low.glb',200+i*8);
      parts[kind] = bodyParts(model.scene, kind === 'hero' || kind === 'lu' ? BONES : YARD_BONES);
    }
    for (const name of (temple ? [...weapons, 'glaive', 'glaiveEdge'] : weapons)) gear[name] = equipment(name,await bytes(name+'.bin'));
    camera.far = 100;
    camera.updateProjectionMatrix();
    updateView();
    return { scene, camera, input, update, state, close, messages:temple ? [...messages, ...temple.messages] : messages, choiceLabels:Object.values(BOONS).map(b=>b.name),
      pause(){paused=true;pending=0;}, resume(){paused=false;pending=0;} };
  } catch(error) { close(); throw error; }
}
