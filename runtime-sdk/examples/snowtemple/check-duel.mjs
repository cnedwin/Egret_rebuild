// SPDX-License-Identifier: Apache-2.0
// Run from the locally prepared --duel project. This exercises the pinned
// game rules without requiring a GLES context or redistributing game assets.
import assert from 'node:assert/strict';
import { createGame, quiet, step } from './original/rules/game.mjs';
import { createDuel } from './duel.mjs';

const duel = createDuel();
function play(gesture, round) {
  const game = createGame(7);
  const foe = game.foes.find(actor => actor.party === 0 && actor.kind === 'blade');
  game.foes = [foe, game.boss];
  const hero = game.hero;
  hero.x = foe.x;
  hero.z = foe.z + 6;
  duel.reset();
  assert.deepEqual(duel.state(0), { round, phase: 'ready', result: null, events: [], message: 'Ready' });
  assert.equal(duel.running(), false);
  duel.press(true, 1);
  if (gesture === 'tap') duel.release(1, false);
  if (gesture === 'cancel') duel.release(1, true);
  let tick = 0;
  while (duel.running() && tick < 3000) {
    const input = quiet(), heroHp = hero.hp, enemyHp = foe.hp;
    duel.command(input, hero, foe);
    duel.observe(++tick, step(game, input, 1 / 60), hero, foe, heroHp, enemyHp);
  }
  assert.equal(duel.running(), false, 'encounter did not finish');
  const result = duel.state(tick);
  for (const blow of result.events) assert.equal(blow.after, Math.max(0, blow.before - blow.amount));
  assert.equal(tick, result.result.tick + 45);
  duel.press(true, 1);
  assert.equal(duel.running(), false, 'terminal round accepted another attack');
  return { tick, hero: hero.hp, foe: foe.hp, ...result };
}
const victory = play('hold', 1);
assert.deepEqual([victory.phase, victory.result.event, victory.hero, victory.foe], ['victory', 'death', 120, 0]);
assert.deepEqual(victory.events.map(e => [e.tick, e.after]), [[101,71],[128,56],[162,30],[197,17],[224,2],[258,0]]);
const defeat = play('tap', 2);
assert.deepEqual([defeat.phase, defeat.result.event, defeat.hero, defeat.foe], ['defeat', 'fall', 0, 71]);
assert.deepEqual(defeat.events[1], { tick: 177, type: 'hurt', attacker: 'blade', target: 'lin', amount: 11, before: 120, after: 109 });
assert.equal(defeat.events.filter(e => e.type === 'hurt').length, 11);
assert.equal(defeat.result.tick, 2036);
const cancel = play('cancel', 3);
assert.equal(cancel.phase, 'defeat');
assert.equal(cancel.events.some(e => e.type === 'hit'), false);
assert.deepEqual(play('hold', 4).events, victory.events);
console.log('Continuous duel passed: win, retaliation and defeat, cancelled thrust, clean restart.');
