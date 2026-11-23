// SPDX-License-Identifier: Apache-2.0
// Run in a locally prepared --encounters project to exercise the same public
// control intents against the pinned original chapter rules.
import assert from 'node:assert/strict';
import { createEncounters } from './encounters.mjs';

const run = createEncounters();
const initial = run.state();
function until(test, limit) {
  for (let i = 0; i < limit; i++) { if (test()) return; run.advance(); }
  assert(test(), 'Expected chapter event did not arrive within the simulation window');
}
assert.deepEqual(initial.roster.map(f => f.kind), ['blade','blade','bow']);
run.command(2);
until(() => run.phase === 'choice', 2000);
assert.equal(run.tick, 1060);
assert.equal(run.game.hero.hp, 104);
assert.equal(run.state().deaths.length,3);
assert.equal(run.state().choice[0].id,'parryBreath');
run.advance();
assert.equal(run.tick,1060,'waiting for a real page choice preserves simulation time');
run.advance(0);
run.command(0); // queue one thrust in the gap between the two parties
until(() => run.game.party === 1, 200);
const {before,after,tick} = run.state().arrivals[0];
assert.equal(tick,1124);
assert.deepEqual(before.hero,after.hero);
for(const key of ['stage','checkpoint','boons','bag','bars','pages','coins','drops']) assert.deepEqual(after[key],before[key]);
assert.deepEqual(after.roster.filter(f=>f.party===1).map(f=>[f.kind,f.x,f.z]),
  [['shield',-1.5,-3.5],['blade',2.4,-4.2],['bow',-6.8,1.2],['bow',7,2.6]]);
assert(after.roster.filter(f=>f.party===0).every(f=>f.state==='dead'));
assert.deepEqual(run.game.boons,['parryBreath']);
until(() => run.phase === 'defeat', 3000);
const result=run.state();
assert.equal(result.result.tick,2408);assert.equal(run.tick,2453);
const second=result.damage.filter(e=>e.party===1);
assert.deepEqual([second[0].tick,second[0].target,second[0].before,second[0].after],[1132,19,58,45]);
assert.deepEqual([second[1].tick,second[1].target,second[1].before,second[1].after],[1272,'lin',104,92]);
assert.equal(run.game.hero.hp,0);assert.equal(result.roster.find(f=>f.id===19).hp,45);
run.reset();assert.deepEqual(run.state(),{...initial,round:2});assert.equal(run.tick,0);
run.command(2);until(()=>run.state().damage.length>0,1000);
assert.deepEqual(run.state().damage[0],result.damage[0]);
console.log('Original chapter progression passed: both parties, carried state, second engagement, defeat and restart.');
