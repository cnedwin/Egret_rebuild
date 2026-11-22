// SPDX-License-Identifier: Apache-2.0
// Input and presentation for one continuous duel. The game's original step()
// owns movement, AI, damage and death; it runs even when all fingers lift.
export const duelControls = [
  ['Restart', 384, 26, 150], ['Hold to approach', 192, 398, 205], ['Tap / hold thrust', 576, 398, 195]
];
export const duelMessages = ['Ready', 'Fight', 'Spear hit', 'Lin wounded', 'Victory', 'Defeat'];

export function createDuel() {
  const walking = new Set(), striking = new Set();
  let round = 0, phase, pendingStrike, result, lastDamage, blows;
  function releaseAll() {
    walking.clear();
    striking.clear();
    pendingStrike = false;
  }
  function reset() {
    releaseAll();
    round++;
    phase = 'ready';
    result = lastDamage = null;
    blows = [];
  }
  function press(strike, id) {
    if (phase === 'ready') phase = 'fighting';
    if (phase !== 'fighting') return;
    if (strike) { striking.add(id); pendingStrike = true; }
    else walking.add(id);
  }
  function release(id, cancelled) {
    if (striking.delete(id) && cancelled && !striking.size) pendingStrike = false;
    walking.delete(id);
  }
  function command(input, hero, foe) {
    if (phase !== 'fighting') return;
    const x = foe.x - hero.x, z = foe.z - hero.z, distance = Math.hypot(x, z);
    const dx = x / (distance || 1), dz = z / (distance || 1);
    input.ax = dx;
    input.az = dz;
    // A tap queues one thrust on reaching spear range. Holding repeats it
    // through the same attack input and recovery windows as the original game.
    const wantsStrike = pendingStrike || striking.size > 0;
    if (distance > 2.55 && (walking.size || wantsStrike)) {
      input.mx = dx * 0.64;
      input.mz = dz * 0.64;
    } else if (wantsStrike && distance <= 2.55) {
      input.attack = true;
      pendingStrike = false;
    }
  }
  function observe(tick, events, hero, foe, heroBefore, foeBefore) {
    if (phase === 'fighting') {
      for (const event of events) {
        const spear = event.type === 'hit' && event.source === 'cut' && event.id === foe.id;
        if (spear || event.type === 'hurt') {
          lastDamage = {
            tick, type: event.type, attacker: spear ? 'lin' : 'blade', target: spear ? 'blade' : 'lin',
            amount: event.amount, before: spear ? foeBefore : heroBefore, after: spear ? foe.hp : hero.hp
          };
          blows.push(lastDamage);
        }
        if (event.type === 'fall' || (event.type === 'death' && event.id === foe.id)) {
          result = { tick, event: event.type, winner: event.type === 'fall' ? 'blade' : 'lin' };
          phase = 'settling';
          releaseAll();
        }
      }
    }
    // Allow the real fall pose to settle. The next chapter wave / checkpoint
    // revival belongs to a different encounter.
    if (phase === 'settling' && tick - result.tick >= 45)
      phase = result.winner === 'lin' ? 'victory' : 'defeat';
  }
  function state(tick) {
    const message = result ? (result.winner === 'lin' ? 'Victory' : 'Defeat')
      : phase === 'ready' ? 'Ready'
      : lastDamage && tick - lastDamage.tick < 30 ? (lastDamage.target === 'lin' ? 'Lin wounded' : 'Spear hit') : 'Fight';
    return { round, phase, result, events: blows.slice(), message };
  }
  return { reset, press, release, releaseAll, command, observe, state,
    running: () => phase === 'fighting' || phase === 'settling' };
}
