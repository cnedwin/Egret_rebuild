// SPDX-License-Identifier: Apache-2.0
// A night of snow from one call to play3d: a lantern made of a post, a roof and a glowing light grouped into one
// thing, carried by the keys to three stone shrines. A shrine reached glows and gives a lamp of its own; all three
// end the night, and it starts again. It shows game.group, glow, game.lamp and game.weather.
import { play3d } from '@egret/engine/webgl2/world3d';

const SPEED = 5;
let lantern, shrines, lit, label, done;

await play3d({
  width: 960,
  height: 540,
  setup(game) {
    game.look('night');
    game.weather('snow');
    game.ground(30, 0xdde6f0);
    // Three parts placed about the lantern's own place, then grouped: they move, turn and are tested as one.
    const post = game.cylinder(0.08, 1.4, 0x3a2a1e, { y: 0.7 });
    const roof = game.cone(0.35, 0.3, 0x5a2a1e, { y: 1.75 });
    const light = game.sphere(0.2, 0xffc46b, { y: 1.45 });
    light.glow = 3;
    lantern = game.group([post, roof, light]);
    lantern.lamp = game.lamp(0xffb347, { y: 1.6 }, { intensity: 6, range: 7 });
    shrines = [];
    for (const [x, z] of [
      [5, -3],
      [-5, -4],
      [0, -9]
    ]) {
      const stone = game.box(1, 1.2, 1, 0x6b7280, { x, y: 0.6, z });
      const top = game.box(0.6, 0.3, 0.6, 0x9ca3af, { x, y: 1.35, z });
      shrines.push({ stone, top, lit: false });
    }
    lit = 0;
    done = false;
    game.follow(lantern, { y: 5, z: 8 });
    label = game.text('Shrines 0/3', { x: 16, y: 12, size: 28 });
  },
  update(dt, game) {
    if (done) return;
    const move = game.keys.axis();
    lantern.x += move.x * SPEED * dt;
    lantern.z += move.y * SPEED * dt;
    // It sways as it is carried; its lamp goes with it.
    lantern.rotationZ = -move.x * 8;
    lantern.lamp.x = lantern.x;
    lantern.lamp.z = lantern.z;
    for (const shrine of shrines) {
      if (shrine.lit || !game.near(lantern, shrine.stone, 1.8)) continue;
      shrine.lit = true;
      shrine.top.color = 0xffd27a;
      shrine.top.glow = 2;
      game.lamp(0xffc46b, { x: shrine.stone.x, y: 2, z: shrine.stone.z }, { intensity: 5, range: 6 });
      lit++;
      label.text = `Shrines ${lit}/3`;
      game.sfx.play('coin');
      game.burst(shrine.stone.x, 1.6, shrine.stone.z, { color: 0xffd27a, count: 16 });
    }
    if (lit === 3) {
      done = true;
      game.sfx.play('win');
      game.button('Play again', { x: 480, y: 300 }, () => game.restart());
    }
  }
});
