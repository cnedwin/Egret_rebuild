// SPDX-License-Identifier: Apache-2.0
import { createGame, quiet, step } from './original/rules/game.mjs';
import { BOONS } from './original/rules/boons.mjs';

const DT = 1 / 60;
const troops = game => game.foes.filter(foe => foe !== game.boss);
const stateOf = actor => ({ id: actor.id, kind: actor.kind, party: actor.party,
  x: actor.x, z: actor.z, hp: actor.hp, state: actor.state });

function nearest(game) {
  let target, best = Infinity;
  for (const foe of game.foes) {
    if (foe === game.boss || foe.state === 'dead') continue;
    const distance = Math.hypot(foe.x - game.hero.x, foe.z - game.hero.z);
    if (distance < best) { target = foe; best = distance; }
  }
  return target;
}

function continuity(game) {
  const h = game.hero;
  return { hero: { x: h.x, z: h.z, hp: h.hp, stamina: h.stamina, will: h.will, gourd: h.gourd },
    stage: game.stage, checkpoint: game.checkpoint, bars: { ...game.bars }, coins: game.coins,
    boons: [...game.boons], bag: { ...game.bag }, pages: { ...game.pages },
    drops: game.drops.map(d => ({ id: d.id, kind: d.kind })), roster: troops(game).map(stateOf) };
}

// One original chapter instance owns both parties, all drops and the transition
// timer. The controls only select inputs to step(); the roster is read-only here.
export function createEncounters() {
  let game, tick, round = 0, phase, intent, attackParty, result, damage, deaths, arrivals, pageChoice;
  function reset() {
    game = createGame(7);
    tick = 0; round++; phase = 'ready'; intent = 'stand'; attackParty = null;
    result = null; pageChoice = null; damage = []; deaths = []; arrivals = [];
  }
  reset();
  function command(button) {
    if (!['ready','fighting'].includes(phase)) return;
    phase = 'fighting';
    intent = ['single','stand','party'][button];
    attackParty = game.party;
  }
  function advance(pick = -1) {
    if (phase === 'choice' && !(Number.isInteger(pick) && game.choice?.options[pick])) return;
    if (!['fighting','choice','settling'].includes(phase)) return;
    const input = quiet(), h = game.hero, foe = nearest(game);
    if (phase === 'choice') input.pick = pick;
    else if (phase === 'fighting' && foe && intent !== 'stand') {
      const x = foe.x - h.x, z = foe.z - h.z, distance = Math.hypot(x, z) || 1;
      input.ax = x / distance; input.az = z / distance;
      if (distance > 2.55) { input.mx = input.ax * 0.64; input.mz = input.az * 0.64; }
      else { input.attack = true; if (intent === 'single') intent = 'stand'; }
    }
    const priorParty = game.party;
    const before = game.party === 0 && game.partyWait > 1.5 ? continuity(game) : null;
    const hp = new Map(game.foes.map(f => [f.id, f.hp]));
    hp.set('lin', h.hp);
    const events = step(game, input, DT);
    tick++;
    for (const event of events) {
      if (event.type === 'hurt' || event.type === 'hit') {
        const key = event.type === 'hurt' ? 'lin' : event.id;
        const start = hp.get(key), after = Math.max(0, start - event.amount);
        hp.set(key, after);
        damage.push({ tick, party: priorParty, type: event.type, target: key, amount: event.amount,
          before: start, after, observedEndOfStepHp: key === 'lin' ? h.hp : game.foes.find(f => f.id === key).hp, source: event.source ?? null });
      }
      if (event.type === 'death') deaths.push({ tick, id: event.id, kind: event.kind, party: priorParty });
      if (event.type === 'party') {
        arrivals.push({ tick, from: priorParty, to: game.party, before, after: continuity(game) });
        if (intent === 'party' && attackParty !== game.party) intent = 'stand';
      }
      if (event.type === 'choice') phase = 'choice';
      if (event.type === 'boon') { phase = 'fighting'; pageChoice = { tick, id: event.id, name: event.name }; }
      if (!result && (event.type === 'fall' || (event.type === 'stage' && event.stage === 'gate'))) {
        result = { tick, event: event.type, winner: event.type === 'fall' ? 'opponents' : 'lin' };
        phase = 'settling'; intent = 'stand';
      }
    }
    if (phase === 'settling' && tick - result.tick >= 45) phase = result.winner === 'lin' ? 'victory' : 'defeat';
    return events;
  }
  function state() {
    const message = result ? (result.winner === 'lin' ? 'Yard cleared' : 'Defeat') :
      phase === 'ready' ? 'Ready' : phase === 'choice' ? 'Choose a lesson' : game.party === 0 ? 'Party 1' : 'Party 2';
    return { round, phase, party: game.party, stage: game.stage, roster: troops(game).map(stateOf),
      damage: damage.slice(), deaths: deaths.slice(), arrivals: arrivals.slice(), result, pageChoice,
      choice: (game.choice?.options ?? []).map(id => ({ id, name: BOONS[id].name })),
      boons: [...game.boons], message };
  }
  return { reset, command, advance, state, target: () => nearest(game),
    get game() { return game; }, get tick() { return tick; }, get phase() { return phase; } };
}
