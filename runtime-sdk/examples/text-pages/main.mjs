// SPDX-License-Identifier: Apache-2.0
import { Bitmap, copyImageData2DPixels } from '@egret/engine';
import { installPlayerProject } from '@egret/android-player-project';

// Touch the scene to replace a sign. Two signs with equal text share their native texture.
installPlayerProject({
  width: 480, height: 240, clearColor: 0x111b29,
  async create({ engine, raster, state }) {
    const run = { size: 48, x: 8, y: 4, maxWidth: 176, color: '#ffffff', strokeWidth: 3 };
    const label = (text, strokeColor) => raster.acquireText(192, 80, [{ ...run, text, strokeColor }]);
    const [left, right] = await Promise.all([label('北门', '#00ff00'), label('北门', '#00ff00')]);
    const first = engine.stage.addChild(new Bitmap(left)), second = engine.stage.addChild(new Bitmap(right));
    first.x = 16;
    second.x = 250;
    first.y = second.y = 64;
    function report(lease) {
      const pixels = copyImageData2DPixels(lease.value.imageData);
      let green = 0, red = 0, white = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        if (pixels[i + 3] < 128) continue;
        if (pixels[i + 1] > 180 && pixels[i] < 70 && pixels[i + 2] < 70) green++;
        if (pixels[i] > 180 && pixels[i + 1] < 70 && pixels[i + 2] < 70) red++;
        if (Math.min(pixels[i], pixels[i + 1], pixels[i + 2]) > 230) white++;
      }
      state({ ...raster.textPageUsage(), green, red, white });
    }
    let displayed = right, changing = false, closed = false, north = true;
    report(right);
    return {
      async input(event) {
        if (event.type !== 'down' || changing || closed) return;
        changing = true;
        try {
          const next = await label(north ? '南门' : '北门', north ? '#ff0000' : '#00ff00');
          if (closed) { next.release(); return; }
          second.textureLease = next;
          displayed.release();
          displayed = next;
          north = !north;
          report(next);
        } catch (error) { if (!closed) state({ error: String(error) }); }
        finally { changing = false; }
      },
      close() {
        closed = true;
        first.dispose();
        second.dispose();
        left.release();
        displayed.release();
      },
      closedSnapshot: () => raster.textPageUsage()
    };
  }
});
