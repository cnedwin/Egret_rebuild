// SPDX-License-Identifier: Apache-2.0
import { play } from './egret2d.mjs';

const response = await fetch('./project.json');
if (!response.ok) throw new Error('Could not load the playtest project: HTTP ' + response.status);
const snapshot = await response.json();
const entityId = 'e_opening';
const entityIndex = snapshot.entities.findIndex(entity => entity.id === entityId);
const opening = snapshot.entities[entityIndex];
if (opening === undefined) throw new Error('The playtest project has no ' + entityId + ' entity');

const width = 360;
const height = 600;
const unlitColor = 0x354469;
let ready = false;
let session = 0;
let lit = false;
let color = unlitColor;
let diagnostic;
let light;

// A read-only display of the current round. The browser and verifier both act through normal player input.
globalThis.__agentPlaytest = Object.freeze({
  get ready() {
    return ready;
  },
  get revision() {
    return snapshot.revision;
  },
  get session() {
    return session;
  },
  get lit() {
    return lit;
  },
  get color() {
    return color;
  },
  get diagnostic() {
    return diagnostic;
  }
});

function beam(graphics, fill) {
  graphics.clear().beginFill(fill).drawCircle(0, 0, 34).endFill();
}

await play({
  width,
  height,
  fit: 'contain',
  backend: 'webgl2',
  background: 0x081521,
  setup(game) {
    ++session;
    lit = false;
    color = unlitColor;
    diagnostic = undefined;

    game.rect(180, 413, 300, 220, 0x122b3c);
    game.rect(180, 351, 30, 95, 0x5b657b);
    game.rect(180, 380, 78, 20, 0x798795);
    game.circle(180, 300, 55, 0x1c3048);
    const lamp = game.sprite(graphics => beam(graphics, color));
    lamp.x = 180;
    lamp.y = 300;
    game.text('Harbor Beacon', { x: 180, y: 80, size: 32, align: 'center', bold: true });
    game.text('Round ' + session, { x: 180, y: 132, size: 17, align: 'center', color: 0xaab8cb });
    const status = game.text('Tap the light to guide the boats', { x: 180, y: 208, size: 18, align: 'center' });

    light = () => {
      if (lit || diagnostic !== undefined) return;
      const value = opening.data.signalColor;
      const nextColor =
        typeof value === 'string' && /^#[\da-f]{6}$/i.test(value) ? Number.parseInt(value.slice(1), 16) : NaN;
      if (Number.isNaN(nextColor) || nextColor === unlitColor) {
        // The project format admits JSON data; the scene checks the value when the player tries to use it.
        diagnostic = Object.freeze({
          code: 'PLAYTEST_SIGNAL_COLOR_INVALID',
          message: 'Choose a six-digit #RRGGBB signalColor different from #354469.',
          details: Object.freeze({
            entityId,
            field: 'signalColor',
            path: '/entities/' + entityIndex + '/data/signalColor',
            revision: snapshot.revision,
            action: 'light-beacon'
          })
        });
        status.text = 'The beacon cannot light';
        return;
      }

      color = nextColor;
      beam(lamp.graphics, color);
      status.text = 'The boats can see the shore';
      lit = true;
      game.sfx.play('coin');
    };
    game.onTap(lamp, light);
    game.button('Restart', { x: 180, y: 490, width: 150, height: 50, color: 0x315571 }, () => game.restart());
  },
  update(_seconds, game) {
    if (game.keys.pressed('Enter', 'Space')) light();
  }
});

ready = true;
