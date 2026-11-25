// SPDX-License-Identifier: Apache-2.0
// Original UI parts, using the same optional paragraph backend and identified fonts as the paragraph-panel example.
import assert from 'node:assert/strict';
import { PNG } from 'pngjs';

export async function verifyViewRich(page) {
  const vendor = new URL('/examples/paragraph-panel/vendor/', page.url()).href;
  const manifest = await (await page.request.get(vendor + 'manifest.json')).json();
  await page.addScriptTag({ url: vendor + manifest.runtime.glue });
  const fixture = await page.evaluateHandle(
    async ({ vendor, manifest }) => {
      const { play } = await import('@egret/engine/play');
      const { createUiSemantics } = await import('@egret/engine/ui/semantics');
      const { createParagraphCache } = await import('@egret/engine/paragraph');
      const { createCanvasKitParagraphProvider } = await import('@egret/engine/web/paragraph');
      const canvasKit = await globalThis.CanvasKitInit({ locateFile: () => vendor + manifest.runtime.wasm });
      const fonts = await Promise.all(
        manifest.fonts
          .filter(font => font.family !== 'Noto Sans Arabic')
          .map(async font => {
            const response = await fetch(vendor + font.path);
            if (!response.ok) throw Error('EXAMPLE_FONT_HTTP');
            const data = new Uint8Array(await response.arrayBuffer());
            const identity = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', data)), byte =>
              byte.toString(16).padStart(2, '0')
            ).join('');
            if (identity !== font.identity) throw Error('EXAMPLE_FONT_IDENTITY');
            return { family: font.family, identity, data };
          })
      );
      const provider = createCanvasKitParagraphProvider({
        canvasKit,
        fonts,
        buildIdentity: manifest.runtime.buildIdentity
      });
      const paragraph = { fontFamilies: fonts.map(font => font.family), locale: 'zh-CN', lineHeight: 24, maxLines: 4 };
      const source = document.createElement('canvas');
      source.width = 12;
      source.height = 8;
      const paint = source.getContext('2d');
      paint.fillStyle = '#cc7a53';
      paint.fillRect(0, 0, 12, 8);
      const cover = source.toDataURL('image/webp');
      if (!cover.startsWith('data:image/webp;')) throw Error('EXAMPLE_WEBP_UNAVAILABLE');
      document.body.style.margin = '0';
      const parent = document.createElement('div');
      parent.style.cssText = 'width:480px;height:320px';
      document.body.append(parent);
      const errors = [];
      const semantics = createUiSemantics();
      let cache,
        view,
        activated = 0;
      const game = await play({
        parent,
        width: 480,
        height: 320,
        fit: 'contain',
        backend: 'webgl2',
        audio: false,
        semantics,
        onError(error) {
          errors.push(error.code ?? error.message);
        },
        setup(game) {
          cache = createParagraphCache(game.engine.assets, { provider });
          view = game.show(
            {
              label: 'Workshop',
              root: {
                type: 'panel',
                x: 20,
                y: 20,
                width: 360,
                height: 260,
                color: 0x142033,
                children: [
                  {
                    type: 'text',
                    name: 'copy',
                    x: 10,
                    y: 10,
                    width: 104,
                    height: 84,
                    size: 16,
                    text: 'Build 工坊\n运入两箱木材。',
                    paragraph,
                    border: { color: 0xf9c950, width: 2 }
                  },
                  {
                    type: 'button',
                    name: 'build',
                    x: 10,
                    y: 110,
                    width: 184,
                    height: 110,
                    text: 'Build workshop',
                    description: '先准备两箱木材。\nPlace two crates before building.',
                    paragraph,
                    size: 22,
                    border: { color: 0x56caff, width: 2 }
                  },
                  {
                    type: 'image',
                    name: 'cover',
                    x: 230,
                    y: 25,
                    width: 60,
                    height: 78,
                    src: cover,
                    label: 'Workshop cover',
                    border: { color: 0x9acd70, width: 2 }
                  }
                ]
              }
            },
            { paragraphCache: cache, bind: { build: { tap: () => activated++ } } }
          );
        }
      });
      const part = (name, index) => {
        const item = view.get(name);
        const box = item.numChildren > index ? item.getChildAt(index) : undefined;
        return box?.numChildren > 0 ? box.getChildAt(0) : undefined;
      };
      const summarize = status =>
        status?.metrics
          ? {
              height: status.metrics.height,
              width: status.metrics.width,
              ranges: status.metrics.lines.map(({ start, end }) => [start, end]),
              baselines: status.metrics.lines.map(line => line.baseline),
              lineWidths: status.metrics.lines.map(line => line.width)
            }
          : undefined;
      return {
        read() {
          const bounds = view.get('cover').numChildren ? view.get('cover').getChildAt(0).getBounds() : undefined;
          const button = semantics.snapshot.nodes.find(node => node.role === 'button');
          return {
            copy: summarize(part('copy', 0)?.getStatus()),
            body: summarize(part('build', 1)?.getStatus()),
            image: bounds ? [bounds.width, bounds.height, view.get('cover').getChildAt(0).scaleX] : undefined,
            activated,
            buttonName: button?.name,
            errors: [...errors]
          };
        },
        async close() {
          view.close();
          const callerLeases = cache.getStatus().callerLeases;
          cache.dispose();
          provider.dispose();
          await game.dispose();
          semantics.dispose();
          parent.remove();
          return callerLeases;
        }
      };
    },
    { vendor, manifest }
  );
  try {
    await page.waitForFunction(handle => {
      const { copy, body, image, buttonName, errors } = handle.read();
      return errors.length > 0 || (copy && body && image && buttonName);
    }, fixture);
    const result = await fixture.evaluate(handle => handle.read());
    assert.deepEqual(result.errors, []);
    assert.equal(result.copy.width, 104);
    assert.equal(result.body.width, 168);
    assert.ok(result.copy.ranges.length >= 2 && result.body.ranges.length >= 2, 'both text parts wrap');
    assert.ok(result.copy.ranges[0][1] > 'Build '.length, 'first line includes Chinese and Latin text');
    assert.ok(result.copy.baselines[1] - result.copy.baselines[0] >= 23.9, 'authored line height');
    assert.ok(result.body.baselines[1] - result.body.baselines[0] >= 23.9, 'authored detail line height');
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const shot = PNG.sync.read(await page.screenshot());
    const pixel = (x, y) => [...shot.data.subarray((shot.width * y + x) * 4, (shot.width * y + x) * 4 + 3)];
    result.border = pixel(30, 50);
    result.coverBorder = pixel(251, 84);
    result.cover = pixel(280, 84);
    assert.deepEqual(result.border, [249, 201, 80]);
    assert.deepEqual(result.coverBorder, [154, 205, 112], 'the image does not cover its own border');
    assert.deepEqual(result.image, [12, 8, 56 / 12]);
    assert.equal(result.buttonName, 'Build workshop. 先准备两箱木材。 Place two crates before building.');
    assert.ok(
      result.cover[0] > 180 && result.cover[1] > 105 && result.cover[2] < 100,
      'decoded WebP paints in its box'
    );
    await page.mouse.click(118, 170);
    await page.waitForFunction(handle => handle.read().activated === 1, fixture);
    result.activated = 1;
    result.leasesAfterClose = await fixture.evaluate(handle => handle.close());
    assert.equal(result.leasesAfterClose, 0);
    return result;
  } finally {
    await fixture.dispose();
  }
}
