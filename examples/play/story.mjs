// SPDX-License-Identifier: Apache-2.0
// A short scene with a story from one call to play: a title menu, words that are read and answered, a bar of health
// and notices, and an ending that depends on the answers. Every part plays by keyboard and by pointer.
import { play } from '@egret/engine/play';

const W = 480,
  H = 300;
let hero, health, lanterns, trust, foes, running;

await play({
  width: W,
  height: H,
  background: 0x0f172a,
  async setup(game) {
    lanterns = 0;
    trust = 0;
    foes = [];
    running = false;
    // The yard: a ground, the hero and three lanterns to light.
    game.rect(W / 2, H - 20, W, 40, 0x1e293b);
    hero = game.rect(60, H - 52, 22, 24, 0x38bdf8);
    for (const x of [180, 300, 420]) {
      const lantern = game.circle(x, H - 70, 9, 0x475569);
      lantern.lit = false;
      foes.push(lantern);
    }
    health = game.bar({ x: 12, y: 12, width: 140, value: 4, max: 4, color: 0xef4444 });
    const choice = await game.menu(['Begin', 'Begin quietly'], { title: 'The Night Yard' });
    game.sfx.muted = choice === 1;
    const answer = await game.say('The lanterns of the yard went out at dusk. Will you light them again?', {
      who: 'Keeper',
      choices: ['I will.', 'Why should I?']
    });
    trust += answer === 0 ? 1 : 0;
    await game.say(answer === 0 ? 'Then go. Mind the cold; it bites.' : 'Because no one else will. Go.', {
      who: 'Keeper'
    });
    running = true;
  },
  update(seconds, game) {
    if (!running || game.asking) return;
    const { x } = game.keys.axis();
    const pull = game.pointer.down ? Math.sign(game.pointer.x - hero.x) : 0;
    hero.x = Math.max(12, Math.min(W - 12, hero.x + (x || pull) * 150 * seconds));
    for (const lantern of foes) {
      if (lantern.lit || Math.abs(lantern.x - hero.x) > 18) continue;
      lantern.lit = true;
      lantern.graphics.clear().beginFill(0xfacc15).drawCircle(0, 0, 9).endFill();
      game.burst(lantern.x, lantern.y, { color: 0xfacc15, count: 16 });
      game.sfx.play('coin');
      game.toast('Lantern ' + ++lanterns + ' of 3');
      // The cold takes a little health between lanterns.
      health.value -= 1;
      game.shake(3);
      if (lanterns === 3) finish(game);
    }
  }
});

async function finish(game) {
  running = false;
  game.sfx.play('win');
  const words =
    trust > 0
      ? 'The yard is bright again. The keeper bows: "I knew you would."'
      : 'The yard is bright again. The keeper says nothing, but smiles.';
  await game.say(words, { who: health.value > 0 ? 'Keeper' : 'Keeper, worried' });
  if ((await game.menu(['Play again'], { title: 'The End' })) === 0) game.restart();
}
