// SPDX-License-Identifier: Apache-2.0
// An original fixed-ratio menu in a positively scaled browser container.
import { play } from '@egret/engine/play';
import { createUiSemantics } from '@egret/engine/ui/semantics';
import { createBrowserSemantics } from '@egret/engine/web/semantics';

const container = document.createElement('main');
container.style.cssText =
  'width:min(640px,80vw);height:min(470px,75vh);margin:24px auto;transform:scale(1.05);transform-origin:top center';
document.body.append(container);
const semantics = createUiSemantics();
const state = { count: 0 };
const game = await play({
  parent: container,
  width: 640,
  height: 360,
  fit: 'contain',
  pixelRatio: 0.75,
  audio: false,
  background: 0x202e3d,
  semantics,
  setup(game) {
    game.show(
      {
        label: 'Workshop plan',
        root: {
          type: 'panel',
          anchor: 'center',
          width: 320,
          height: 176,
          card: true,
          padding: 18,
          gap: 12,
          layout: 'column',
          children: [
            { type: 'text', name: 'title', text: 'Workshop plan', align: 'center' },
            { type: 'button', name: 'build', text: 'Place workshop', width: 'fill' },
            { type: 'text', name: 'count', text: '', align: 'center' }
          ]
        }
      },
      {
        state,
        bind: {
          build: {
            tap: state => {
              state.count++;
            }
          },
          count: { text: state => 'Placed: ' + state.count }
        }
      }
    );
  }
});
const projection = createBrowserSemantics({
  semantics,
  canvas: game.canvas,
  width: 640,
  height: 360,
  label: 'Workshop plan'
});
window.addEventListener(
  'pagehide',
  () => {
    projection.dispose();
    semantics.dispose();
    void game.dispose();
  },
  { once: true }
);
