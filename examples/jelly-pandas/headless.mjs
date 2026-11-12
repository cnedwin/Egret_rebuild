// SPDX-License-Identifier: Apache-2.0
// Play a whole run without a page: every panda is steered by the same simple
// rules the friends use in the game. Prints one line per minute and the
// result, and fails on any error or a value that is not a number.
//
//   node examples/jelly-pandas/headless.mjs [party size 1-4] [seed] [minutes]
import { CHARMS, TOYS } from './data.mjs';
import { createGame } from './sim.mjs';

const size = Math.min(4, Math.max(1, Number(process.argv[2] ?? 4))), seed = Number(process.argv[3] ?? 7), minutes = Number(process.argv[4] ?? 17);
const game = createGame({ seed, party: Array.from({ length: size }, (_, index) => ({ skin: (index + seed) % 8, human: false })) });
const input = { moveX: 0, moveZ: 0, jump: false, slam: false, roll: false };
const started = performance.now(), seen = new Set(), bosses = [];
let steps = 0, slowest = 0, lastDamage = 0, bossWas;
while (game.state === 'play' && game.t < minutes * 60) {
  const before = performance.now();
  game.update(1 / 60, input);
  steps++; slowest = Math.max(slowest, performance.now() - before);
  for (const event of game.events) seen.add(event.type);
  game.events.length = 0;
  for (const panda of game.pandas) if (!Number.isFinite(panda.x + panda.y + panda.z + panda.hp)) throw new Error(`panda ${panda.index} left the numbers at ${game.t.toFixed(1)} s`);
  if (game.boss && !bossWas) bosses.push(`${game.boss.def.key} arrives ${Math.round(game.t)} s with ${Math.round(game.boss.maxHp)}`);
  if (!game.boss && bossWas) bosses.push(`${bossWas.def.key} falls ${Math.round(game.t)} s`);
  bossWas = game.boss;
  if (steps % 3600 === 0) {
    const first = game.pandas[0], damage = (game.damageDealt - lastDamage) / 60;
    lastDamage = game.damageDealt;
    console.log(`${String(Math.round(game.t / 60)).padStart(2)} min  level ${game.level}  squashed ${game.kills}  alive ${game.aliveCount}  damage/s ${Math.round(damage)}  health ${game.pandas.map((panda) => (panda.down ? 'down' : Math.round(panda.hp))).join(' ')}`
      + `  toys ${first.toys.map((toy) => TOYS[toy.id].key + toy.level + (toy.evo ? '*' : '')).join(' ')}  charms ${[...first.charms].map(([id, level]) => CHARMS[id].key + level).join(' ')}`);
  }
}
console.log(`result: ${game.state} after ${(game.t / 60).toFixed(2)} min, level ${game.level}, ${game.kills} squashed`);
console.log(`bosses: ${bosses.join('; ') || 'none reached'}`);
console.log(`step time: ${((performance.now() - started) / steps).toFixed(3)} ms average, ${slowest.toFixed(1)} ms slowest; ${seen.size} kinds of event`);
