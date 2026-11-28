// SPDX-License-Identifier: Apache-2.0
import { Mesh3D, createBoxGeometry3D, createStandardMaterial3D } from '@egret/engine/world3d';
import { controls as yardControls, openScene as openYard } from './chain.mjs';
import { DIALOGUE } from './original/dialogue.mjs';
import { BARS } from './original/rules/arena.mjs';

export const controls = [...yardControls.slice(0, 3), ['Advance & fight', 576, 398, 180]];

const meetLines = [[0.08, 'lu-meet'], [3, 'lu-demand']];
const line = id => DIALOGUE[id].who + ' · ' + DIALOGUE[id].text;

function createGateway(scene) {
  const block = createBoxGeometry3D({ width: 1, height: 1, depth: 1 });
  const wood = createStandardMaterial3D({ color: 0x735444, roughness: 1 });
  const ember = createStandardMaterial3D({ color: 0xcf693e });
  function beam(material, from, to, z, height, y) {
    const mesh = scene.addChild(new Mesh3D(block, material));
    return mesh.setPosition((from + to) / 2, y, z).setScale(to - from, height, 0.35);
  }
  const { gate, court } = BARS;
  const left = beam(wood, gate.ax - 7, gate.ax, gate.az, 1.6, 0.8);
  const right = beam(wood, gate.bx, gate.bx + 7, gate.bz, 1.6, 0.8);
  const door = beam(wood, gate.ax, gate.bx, gate.az, 1.4, 0.7);
  const fire = beam(ember, court.ax, court.bx, court.az, 0.4, 0.2);
  return {
    update(bars) { door.visible = bars.gate; fire.visible = bars.court; },
    close() {
      for (const mesh of [left, right, door, fire]) mesh.removeFromParent();
      block.dispose();
      wood.dispose();
      ember.dispose();
    }
  };
}

function inMeet(game) {
  return game.stage === 'boss' && game.boss.phase === 1 && game.cine > 0;
}

function frameMeet(camera, game) {
  if (!inMeet(game)) return false;
  const { x, z } = game.boss;
  const t = Math.min(1, (1 - game.cine / 5.2) * 1.24);
  const travel = t * t * (3 - 2 * t);
  camera.setPosition(x + 4.5 - 2.1 * travel, 2.9 - 0.75 * travel, z + 7.7 - 3.4 * travel)
    .lookAt(x, 1.67, z + 0.15);
  return true;
}

function caption(game, encounter) {
  if (inMeet(game)) {
    const elapsed = 5.2 - game.cine;
    // A later cue replaces the earlier caption in the source game's HUD.
    for (let i = meetLines.length - 1; i >= 0; i--) {
      const [start, id] = meetLines[i];
      if (elapsed >= start && elapsed < start + DIALOGUE[id].seconds + 0.19) return line(id);
    }
  }
  const gate = encounter.milestones.gate;
  if (game.stage === 'gate' && gate && game.time - gate.time < DIALOGUE['lin-gate'].seconds + 0.19) return line('lin-gate');
}

export function openScene(services, createLighting) {
  return openYard(services, {
    createGateway, frameMeet, caption, createLighting,
    messages: ['Gate open', 'Meet Lu Qian', 'Lu Qian', 'Chapter cleared', ...['lin-gate', 'lu-meet', 'lu-demand'].map(line)]
  });
}
