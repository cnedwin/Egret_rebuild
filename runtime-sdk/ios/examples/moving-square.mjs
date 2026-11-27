// SPDX-License-Identifier: Apache-2.0
import {createEngine, Sprite} from '@egret/engine';

// A customer entry with its own aspect ratio and no atlas assets.
export async function openGame(host) {
  const engine = await createEngine({host});
  const scope = engine.createScope();
  const square = scope.use(new Sprite());
  engine.stage.addChild(square);
  square.graphics.beginFill(0xfa913c).drawRect(0,0,16,16).endFill();
  return {
    width: 160,
    height: 120,
    pages: [],
    capture(tick) {
      square.x = tick % 144;
      square.y = 40;
      return engine.captureSharedFrame({width:160,height:120,clearColor:0x121826,clearAlpha:1,outputAlpha:'opaque'});
    },
    async close() {
      try { scope.dispose(); } finally { await engine.dispose(); }
    }
  };
}
