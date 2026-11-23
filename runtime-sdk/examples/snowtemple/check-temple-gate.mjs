// SPDX-License-Identifier: Apache-2.0
// Run in a locally prepared --temple-gate project. Only control inputs can
// advance the chapter; positions, rewards and damage come from its rules.
import assert from 'node:assert/strict';
import { createEncounters } from './encounters.mjs';
import { HERO } from './original/rules/tune.mjs';

function until(run, predicate, limit) {
  for (let i = 0; i < limit && !predicate(); i++) run.advance();
  assert(predicate(), 'The expected chapter event did not occur');
}

function playStep(run, lessons) {
  if (run.phase !== 'choice') return run.advance();
  const frozen = run.tick;
  lessons.push(run.state().choice[0].id);
  run.advance();
  assert.equal(run.tick, frozen);
  return run.advance(0);
}

function verifyRest(run, events, priorCheckpoint) {
  const rest = events.find(event => event.type === 'rest');
  if (rest) {
    assert.equal(run.game.hero.hp, HERO.hp);
    assert.equal(run.game.hero.gourd, run.game.hero.maxGourd);
  }
  if (events.some(event => event.type === 'cine' && event.id === 'meet')) {
    assert.equal(run.game.checkpoint, 'rest');
  } else {
    assert.equal(run.game.checkpoint, rest?.id ?? priorCheckpoint);
  }
}

function clearYard(run) {
  const lessons = [];
  run.command(2);
  for (let i = 0; i < 5000 && run.game.stage !== 'gate'; i++) {
    assert.equal(run.game.bars.gate, true);
    assert.equal(run.game.boss.state, 'wait');
    const priorCheckpoint = run.game.checkpoint;
    const events = playStep(run, lessons);
    assert(events, 'Both parties must be defeated before the route ends');
    verifyRest(run, events, priorCheckpoint);
  }
  assert.equal(run.game.stage, 'gate');
  assert.deepEqual(run.state().choices.map(choice => choice.id), lessons);
  return lessons;
}

const run = createEncounters({ throughGate: true });
const lessons = clearYard(run);
const atGate = run.state();
const gate = atGate.milestones.gate;
assert.equal(atGate.result, null);
assert.equal(gate.tick, atGate.deaths.at(-1).tick);
assert.deepEqual(atGate.deaths.filter(death => death.party === 1).map(death => death.kind).sort(),
  ['blade', 'bow', 'bow', 'shield']);
assert.equal(gate.roster.length, 7);
assert(gate.roster.every(foe => foe.state === 'dead' && foe.hp === 0));
assert.deepEqual(gate.bars, { gate: false, court: false });
assert.equal(gate.checkpoint, run.game.checkpoint);
assert.equal(gate.hero.hp, run.game.hero.hp);
assert(gate.hero.hp > 0);
assert.equal(gate.boss.state, 'wait');
assert.deepEqual(gate.boons, lessons);

// Loot collected on the way to the gate depends on the actual fight. Preserve
// its effects in original event order, including simultaneous coin and salve.
const observedPickups = [];
const bag = { ...gate.bag };
for (let i = 0; i < 500 && run.game.stage === 'gate'; i++) {
  const hp = run.game.hero.hp, priorCheckpoint = run.game.checkpoint;
  const events = playStep(run, lessons);
  verifyRest(run, events, priorCheckpoint);
  for (const event of events.filter(event => event.type === 'pickup')) {
    bag[event.kind]++;
    observedPickups.push({ tick: run.tick, kind: event.kind, note: event.note,
      beforeHp: hp, endOfStepHp: run.game.hero.hp });
  }
  if (hp !== run.game.hero.hp) {
    assert(events.some(event => event.type === 'rest' || (event.type === 'pickup' && event.kind === 'salve')),
      'A change in health on the peaceful approach requires an original recovery event');
  }
}
const { meet } = run.state().milestones;
assert(meet);
assert.equal(meet.stage, 'boss');
assert(meet.beforeZ >= -21.6 && meet.hero.z < -21.6);
assert.deepEqual(meet.bars, { gate: false, court: true });
assert.equal(meet.checkpoint, 'rest');
assert.deepEqual([meet.duration, meet.cine, meet.boss.state, meet.boss.pause], [5.2, 5.2, 'roam', 1.2]);
assert.deepEqual(run.state().pickups, observedPickups);
assert.deepEqual(meet.bag, bag);
assert.equal(meet.hero.hp, run.game.hero.hp);
assert.deepEqual(meet.boons, lessons);
for (const [key, value] of Object.entries(gate.pages)) assert.equal(meet.pages[key], value);

while (run.game.cine > 0 && run.tick < meet.tick + 340) {
  assert.equal(run.game.boss.hp, meet.boss.hp);
  assert.deepEqual([run.game.hero.x, run.game.hero.z], [meet.hero.x, meet.hero.z]);
  run.advance();
}
assert.equal(run.game.cine, 0);
until(run, () => Boolean(run.state().milestones.firstBossHit), 180);
const { resumed, firstBossHit } = run.state().milestones;
assert(resumed.tick > meet.tick && firstBossHit.tick > resumed.tick);
assert.equal(resumed.hero.hp, meet.hero.hp);
assert.deepEqual(firstBossHit.boons, meet.boons);
assert.deepEqual(firstBossHit.bars, meet.bars);
assert.deepEqual([firstBossHit.hit.target, firstBossHit.hit.source], [meet.boss.id, 'cut']);
assert(firstBossHit.hit.amount > 0);
assert.equal(firstBossHit.hit.before, meet.boss.hp);
assert.equal(firstBossHit.hit.after, meet.boss.hp - firstBossHit.hit.amount);
assert.equal(firstBossHit.hit.observedEndOfStepHp, firstBossHit.boss.hp);
assert.equal(firstBossHit.boss.hp, firstBossHit.hit.after);
assert.equal(run.state().result, null);

// Opening the gate alone cannot trigger the meeting. Standing still leaves
// the player in the yard until a fresh advance input crosses the threshold.
run.reset();
assert.deepEqual(run.state().milestones, {});
clearYard(run);
run.command(1);
for (let i = 0; i < 200; i++) run.advance();
assert.equal(run.game.stage, 'gate');
assert.equal(run.game.boss.state, 'wait');
assert.equal(run.state().milestones.meet, undefined);
run.command(2);
for (let i = 0; i < 500 && run.game.stage !== 'boss'; i++) playStep(run, []);
assert.equal(run.game.stage, 'boss');
assert(run.state().milestones.meet.hero.z < -21.6);
console.log('Second party, gate, original meeting and resumed combat passed.');
