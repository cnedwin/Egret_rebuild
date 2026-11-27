// SPDX-License-Identifier: Apache-2.0
// A game fitted to the window with fit 'expand', a portrait size and a notch: what the window shows, the safe part,
// a turn of the window and a tap on a button placed at a safe edge. The window is turned by resizing the page.
import assert from 'node:assert/strict';

async function verifyContainScale(page) {
  const fixture = await page.evaluateHandle(async () => {
    const { play } = await import('@egret/engine/play');
    const parent = document.createElement('div');
    parent.style.cssText = 'width:400px;height:200px';
    document.body.append(parent);
    const arranged = [],
      notified = [];
    let button,
      taps = 0;
    const game = await play({
      parent,
      width: 200,
      height: 100,
      fit: 'contain',
      pixelRatio: 1,
      backend: 'webgl2',
      audio: false,
      setup(g) {
        button = g.button('Tap', { x: 100, y: 50, width: 44, height: 44 }, () => taps++);
      },
      arrange(g) {
        const scale = g.browser.screen.scale;
        button.scaleX = button.scaleY = 1 / scale;
        arranged.push({ scale, screen: { ...g.screen }, safe: { ...g.safe } });
      }
    });
    const remove = game.browser.onScreenChange(plan => notified.push(plan.scale));
    return {
      resize(width, height) {
        parent.style.width = width + 'px';
        parent.style.height = height + 'px';
      },
      read() {
        const box = game.canvas.getBoundingClientRect(),
          plan = game.browser.screen;
        return {
          arranged,
          notified,
          scale: plan.scale,
          canvas: [box.width, box.height],
          target: [(44 * button.scaleX * box.width) / plan.width, (44 * button.scaleY * box.height) / plan.height],
          point: { x: box.left + box.width / 2, y: box.top + box.height / 2 },
          taps
        };
      },
      async close() {
        remove();
        await game.dispose();
        parent.remove();
      }
    };
  });
  const frames = () =>
    page.evaluate(
      () => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(done))))
    );
  try {
    await frames();
    const initial = await fixture.evaluate(f => f.read());
    assert.deepEqual(initial.canvas, [400, 200]);
    assert.equal(initial.arranged.length, 1);
    assert.equal(initial.scale, 2);
    assert.deepEqual(initial.target, [44, 44]);
    for (const [width, height, scale] of [
      [180, 90, 0.9],
      [600, 300, 3]
    ]) {
      await fixture.evaluate((f, size) => f.resize(...size), [width, height]);
      await frames();
      const next = await fixture.evaluate(f => f.read());
      assert.equal(next.scale, scale);
      assert.deepEqual(next.canvas, [width, height]);
      assert.deepEqual(next.arranged.at(-1).screen, initial.arranged[0].screen);
      assert.deepEqual(next.arranged.at(-1).safe, initial.arranged[0].safe);
      assert.equal(next.arranged.at(-1).scale, scale, 'CSS-only scale change calls arrange');
      assert.ok(
        next.target.every(size => Math.abs(size - 44) < 0.01),
        '44 CSS px target survives'
      );
    }
    await fixture.evaluate(f => f.resize(600, 300));
    await frames();
    const final = await fixture.evaluate(f => f.read());
    assert.deepEqual(
      final.arranged.map(value => value.scale),
      [2, 0.9, 3]
    );
    assert.deepEqual(final.notified, [0.9, 3]);
    await page.mouse.click(final.point.x, final.point.y);
    await frames();
    assert.equal(await fixture.evaluate(f => f.read().taps), 1);
    return { scales: final.arranged.map(value => value.scale), notifications: final.notified, target: final.target };
  } finally {
    await fixture.evaluate(f => f.close());
    await fixture.dispose();
  }
}

// The stage scale modes of Egret 5, fixedWidth and fixedHeight, and pixel art at whole steps of device pixels, in a
// parent element that is resized: what the game sees of its design, the canvas's size and a tap at the design's middle.
async function verifyFixedFits(page, PNG) {
  const fixture = await page.evaluateHandle(async () => {
    const { play } = await import('@egret/engine/play');
    const made = [];
    async function make(fit, width, height, options = {}) {
      const parent = document.createElement('div');
      parent.style.cssText = 'width:' + width + 'px;height:' + height + 'px';
      document.body.append(parent);
      const log = { screens: [], taps: 0 };
      const game = await play({
        parent,
        width: options.design?.width ?? 400,
        height: options.design?.height ?? 300,
        fit,
        background: 0x000000,
        backend: 'webgl2',
        audio: false,
        ...(options.wholeScale ? { wholeScale: true } : { pixelRatio: 1 }),
        setup(g) {
          if (options.dot) g.rect(80, 45, 2, 2, 0xffffff);
          else g.button('Middle', { x: 200, y: 150, width: 80, height: 40 }, () => log.taps++);
        },
        arrange(g) {
          log.screens.push({ ...g.screen });
        }
      });
      made.push({ game, parent });
      return {
        resize(w, h) {
          parent.style.width = w + 'px';
          parent.style.height = h + 'px';
        },
        read() {
          const box = game.canvas.getBoundingClientRect(),
            screen = game.screen;
          return {
            screen: log.screens.at(-1),
            canvas: [box.width, box.height],
            backing: [game.canvas.width, game.canvas.height],
            rendering: game.canvas.style.imageRendering,
            // In the page's own coordinates, for a screenshot of the whole page.
            box: { x: box.left + scrollX, y: box.top + scrollY, width: box.width, height: box.height },
            middle: {
              x: box.left + ((200 - screen.x) / screen.width) * box.width,
              y: box.top + ((150 - screen.y) / screen.height) * box.height
            },
            taps: log.taps
          };
        }
      };
    }
    globalThis.__fixed = {
      width: await make('fixedWidth', 800, 800),
      height: await make('fixedHeight', 800, 800),
      pixels: await make('contain', 700, 400, { wholeScale: true, dot: true, design: { width: 160, height: 90 } })
    };
    return {
      async close() {
        for (const { game, parent } of made) {
          await game.dispose();
          parent.remove();
        }
        delete globalThis.__fixed;
      }
    };
  });
  const frames = () =>
    page.evaluate(
      () => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(done))))
    );
  const read = name => page.evaluate(which => globalThis.__fixed[which].read(), name);
  try {
    await frames();
    // fixedWidth: the design's 400 units across fill 800 CSS pixels; the square window shows 400 units down.
    let width = await read('width');
    assert.deepEqual(width.screen, { x: 0, y: -50, width: 400, height: 400 });
    assert.deepEqual(width.canvas, [800, 800]);
    // A wider window: the width stays, and less of the design shows from top to bottom.
    await page.evaluate(() => globalThis.__fixed.width.resize(1000, 600));
    await frames();
    width = await read('width');
    assert.deepEqual(width.screen, { x: 0, y: 30, width: 400, height: 240 });
    assert.deepEqual(width.canvas, [1000, 600]);
    await page.mouse.click(width.middle.x, width.middle.y);
    await frames();
    assert.equal((await read('width')).taps, 1, 'a tap at the middle of the design reaches its button');
    // fixedHeight: the design's 300 units down fill 800 CSS pixels; the square window shows 300 units across.
    const height = await read('height');
    assert.deepEqual(height.screen, { x: 50, y: 0, width: 300, height: 300 });
    assert.deepEqual(height.canvas, [800, 800]);
    // Pixel art: 160 × 90 in 700 × 400 CSS pixels at one device pixel to a CSS pixel is 4 whole pixels a unit, drawn
    // at a pixel a unit and enlarged without smoothing; the 2 × 2 dot is a sharp square of 8 × 8 pixels.
    const pixels = await read('pixels');
    assert.deepEqual(pixels.canvas, [640, 360]);
    assert.deepEqual(pixels.backing, [160, 90]);
    assert.equal(pixels.rendering, 'pixelated');
    const png = PNG.sync.read(await page.screenshot({ clip: pixels.box, fullPage: true }));
    let lit = 0,
      grey = 0;
    const xs = [],
      ys = [];
    for (let y = 0; y < png.height; y++)
      for (let x = 0; x < png.width; x++) {
        const value = png.data[(y * png.width + x) * 4];
        if (value > 250) {
          lit++;
          xs.push(x);
          ys.push(y);
        } else if (value > 5) grey++;
      }
    assert.equal(lit, 64, 'the dot is 8 × 8 device pixels');
    assert.equal(grey, 0, 'no pixel between black and white: nothing was smoothed');
    assert.deepEqual([Math.max(...xs) - Math.min(...xs) + 1, Math.max(...ys) - Math.min(...ys) + 1], [8, 8]);
    return {
      fixedWidth: [{ x: 0, y: -50, width: 400, height: 400 }, width.screen],
      fixedHeight: height.screen,
      wholeScale: { canvas: pixels.canvas, backing: pixels.backing, dot: [8, 8], smoothed: grey }
    };
  } finally {
    await fixture.evaluate(f => f.close());
    await fixture.dispose();
  }
}

// A score pinned to the safe part's top right corner and a bar to the bottom middle of the screen, in a window that
// grows wider, turns and gets a notch: each stays against its edges, and the score stays when its words grow.
async function verifyPins(page) {
  const fixture = await page.evaluateHandle(async () => {
    const { play } = await import('@egret/engine/play');
    const parent = document.createElement('div');
    parent.style.cssText = 'width:800px;height:600px';
    document.body.append(parent);
    let score, bar, pins;
    const game = await play({
      parent,
      width: 400,
      height: 300,
      portrait: { width: 300, height: 400 },
      fit: 'expand',
      insets: { top: 0, right: 40, bottom: 0, left: 0 },
      pixelRatio: 1,
      backend: 'webgl2',
      audio: false,
      setup(g) {
        score = g.rect(0, 0, 60, 20, 0xffffff, g.ui);
        bar = g.rect(0, 0, 100, 10, 0xffffff, g.ui);
        pins = [g.pin(score, { right: 8, top: 8 }), g.pin(bar, { bottom: 0, centerX: 0 }, { area: 'screen' })];
      }
    });
    const box = node => {
      const b = node.getBounds(),
        at = game.fromStage(...Object.values(node.localToGlobal(b.x, b.y)));
      return { x: Math.round(at.x), y: Math.round(at.y), width: b.width, height: b.height };
    };
    return {
      resize(width, height) {
        parent.style.width = width + 'px';
        parent.style.height = height + 'px';
      },
      grow() {
        score.scaleX = 2;
      },
      read: () => ({ score: box(score), bar: box(bar), safe: { ...game.safe }, screen: { ...game.screen } }),
      setPin: () => pins[0].set({ left: 0, top: 0 }),
      async close() {
        await game.dispose();
        parent.remove();
      }
    };
  });
  const frames = () =>
    page.evaluate(
      () => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(done))))
    );
  const right = now => Math.round(now.safe.x + now.safe.width);
  try {
    await frames();
    // 800 × 600 shows the 400 × 300 design at 2; the notch of 40 CSS pixels covers 20 units on the right.
    let now = await fixture.evaluate(f => f.read());
    assert.equal(now.score.x + now.score.width, right(now) - 8);
    assert.equal(now.score.y, Math.round(now.safe.y) + 8);
    assert.equal(now.bar.y + now.bar.height, now.screen.y + now.screen.height);
    assert.equal(now.bar.x, Math.round(now.screen.x + (now.screen.width - 100) / 2));
    const first = now;
    // Wider: the stage grows to the sides and both follow their edges.
    await fixture.evaluate(f => f.resize(1000, 600));
    await frames();
    now = await fixture.evaluate(f => f.read());
    assert.ok(now.screen.width > first.screen.width);
    assert.equal(now.score.x + now.score.width, right(now) - 8);
    assert.equal(now.bar.x, Math.round(now.screen.x + (now.screen.width - 100) / 2));
    // Turned: the portrait design, and still against the same edges.
    await fixture.evaluate(f => f.resize(600, 800));
    await frames();
    now = await fixture.evaluate(f => f.read());
    assert.equal(now.screen.width, 300);
    assert.equal(now.score.x + now.score.width, right(now) - 8);
    assert.equal(now.bar.y + now.bar.height, now.screen.y + now.screen.height);
    // The score's box grows: it is placed again at the next frame, still 8 units from the safe right edge.
    await fixture.evaluate(f => f.grow());
    await frames();
    const grown = await fixture.evaluate(f => f.read());
    // Its own box is still 60 wide; doubled across, it ends 8 units from the edge.
    assert.equal(grown.score.width, 60);
    assert.equal(grown.score.x + 120, right(grown) - 8);
    // set holds it elsewhere at once.
    await fixture.evaluate(f => f.setPin());
    now = await fixture.evaluate(f => f.read());
    assert.deepEqual([now.score.x, now.score.y], [Math.round(now.safe.x), Math.round(now.safe.y)]);
    return { score: grown.score, bar: now.bar, screen: now.screen };
  } finally {
    await fixture.evaluate(f => f.close());
    await fixture.dispose();
  }
}

// A 1280 × 720 game whose views keep between 0.75 and 1 CSS pixel a unit of theirs: on a large window the panel is
// drawn smaller than the game's scale would make it, on a small one larger; it stays centred and takes a click.
async function verifyUiScale(page) {
  // The window holds the whole element, so that all of it is safe.
  const before = page.viewportSize();
  await page.setViewportSize({ width: 1940, height: 1100 });
  const fixture = await page.evaluateHandle(async () => {
    const { play } = await import('@egret/engine/play');
    const parent = document.createElement('div');
    parent.style.cssText = 'width:1920px;height:1080px';
    document.body.append(parent);
    const state = { taps: 0, tiles: 0 };
    let view, board;
    const game = await play({
      parent,
      width: 1280,
      height: 720,
      fit: 'expand',
      uiScale: { min: 0.75, max: 1 },
      pixelRatio: 1,
      backend: 'webgl2',
      audio: false,
      setup(g) {
        view = g.show(
          {
            label: 'Panel',
            root: {
              type: 'panel',
              card: true,
              anchor: 'center',
              width: 400,
              height: 200,
              padding: 16,
              layout: 'column',
              children: [{ type: 'button', name: 'go', text: 'Go', height: 80 }]
            }
          },
          { state, bind: { go: { tap: s => s.taps++ } } }
        );
        // A tap area over a piece of the game's world keeps the game's scale, and so stays over the piece.
        board = g.show(
          {
            label: 'Board',
            uiScale: false,
            root: { type: 'button', name: 'tile', text: 'Tile', x: 40, y: 40, width: 120, height: 80 }
          },
          { state, bind: { tile: { tap: s => s.tiles++ } } }
        );
        g.rect(100, 80, 120, 80, 0x3366cc);
      }
    });
    return {
      resize(width, height) {
        parent.style.width = width + 'px';
        parent.style.height = height + 'px';
      },
      read() {
        const box = game.canvas.getBoundingClientRect(),
          plan = game.browser.screen,
          go = view.visibleRect('go'),
          tile = board.visibleRect('tile'),
          // Where the part at (40, 40) of the safe part is on the stage: there, at the game's scale.
          piece = game.toStage(game.safe.x + 40, game.safe.y + 40);
        // The button in the page's CSS pixels.
        const css = {
          x: box.left + go.x * plan.scale,
          y: box.top + go.y * plan.scale,
          width: go.width * plan.scale,
          height: go.height * plan.scale
        };
        const tileCss = {
          x: box.left + tile.x * plan.scale,
          y: box.top + tile.y * plan.scale,
          width: tile.width * plan.scale,
          height: tile.height * plan.scale
        };
        return {
          uiScale: game.uiScale,
          scale: plan.scale,
          css,
          taps: state.taps,
          middle: box.left + box.width / 2,
          tile,
          tileCss,
          tiles: state.tiles,
          piece
        };
      },
      async close() {
        await game.dispose();
        parent.remove();
      }
    };
  });
  const frames = () =>
    page.evaluate(
      () => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(done))))
    );
  try {
    await frames();
    // 1920 × 1080: the game at 1.5 pixels a unit; the views kept at 1, so drawn at 2 / 3 of the game's units.
    let now = await fixture.evaluate(f => f.read());
    assert.equal(now.scale, 1.5);
    assert.ok(Math.abs(now.uiScale - 1 / 1.5) < 1e-9);
    assert.ok(Math.abs(now.css.width - 368) < 1, 'the button is 368 of its units across at 1 pixel: ' + now.css.width);
    assert.ok(Math.abs(now.css.height - 80) < 1);
    assert.ok(Math.abs(now.css.x + now.css.width / 2 - now.middle) < 1, 'the panel stays centred');
    // The board's view keeps the game's scale: its tap area is 120 × 80 of the game's units, where the piece is.
    const over = r => [r.x, r.y, r.width, r.height].map(v => Math.round(v * 100) / 100);
    assert.deepEqual(over(now.tile), over({ x: now.piece.x, y: now.piece.y, width: 120, height: 80 }), 'over the piece');
    const large = now;
    // 640 × 360: the game at 0.5; the views kept at 0.75, drawn at 1.5 of the game's units.
    await fixture.evaluate(f => f.resize(640, 360));
    await frames();
    now = await fixture.evaluate(f => f.read());
    assert.equal(now.scale, 0.5);
    assert.ok(Math.abs(now.uiScale - 1.5) < 1e-9);
    assert.ok(Math.abs(now.css.height - 60) < 1, 'the button is 80 of its units at 0.75 pixel: ' + now.css.height);
    assert.deepEqual(over(now.tile), over({ x: now.piece.x, y: now.piece.y, width: 120, height: 80 }), 'still over it');
    assert.ok(Math.abs(now.tileCss.height - 40) < 1, 'the tap area is 80 units at the game\'s 0.5: ' + now.tileCss.height);
    await page.mouse.click(now.css.x + now.css.width / 2, now.css.y + now.css.height / 2);
    await frames();
    assert.equal((await fixture.evaluate(f => f.read())).taps, 1, 'a click on the larger button presses it');
    await page.mouse.click(now.tileCss.x + now.tileCss.width / 2, now.tileCss.y + now.tileCss.height / 2);
    await frames();
    assert.equal((await fixture.evaluate(f => f.read())).tiles, 1, 'a click on the piece presses its tap area');
    return {
      large: { uiScale: large.uiScale, button: large.css, tile: large.tileCss },
      small: { uiScale: now.uiScale, button: now.css, tile: now.tileCss }
    };
  } finally {
    await fixture.evaluate(f => f.close());
    await fixture.dispose();
    if (before) await page.setViewportSize(before);
  }
}

// One view with phone, portrait and tablet parts in a window resized from a phone's shape to a tablet's, held wide
// and upright: the parts follow the shorter side, and the view is built again for each.
async function verifyTabletParts(page) {
  const before = page.viewportSize();
  await page.setViewportSize({ width: 1100, height: 1100 });
  const fixture = await page.evaluateHandle(async () => {
    const { play } = await import('@egret/engine/play');
    const parent = document.createElement('div');
    parent.style.cssText = 'width:844px;height:390px';
    document.body.append(parent);
    const card = width => ({
      type: 'panel',
      name: 'card',
      card: true,
      anchor: 'center',
      width,
      height: 120,
      children: [{ type: 'text', name: 'words', text: 'Hello' }]
    });
    let view;
    const builds = [];
    const game = await play({
      parent,
      width: 800,
      height: 450,
      portrait: { width: 450, height: 800 },
      fit: 'expand',
      pixelRatio: 1,
      backend: 'webgl2',
      audio: false,
      setup(g) {
        view = g.show(
          { root: card(300), portrait: card('fill'), tablet: card(600) },
          { state: {}, built: v => builds.push(v.variant) }
        );
      }
    });
    return {
      resize(width, height) {
        parent.style.width = width + 'px';
        parent.style.height = height + 'px';
      },
      read: () => ({ variant: view.variant, width: view.rect('card').width, builds: [...builds] }),
      async close() {
        await game.dispose();
        parent.remove();
      }
    };
  });
  const frames = () =>
    page.evaluate(
      () => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(done))))
    );
  try {
    await frames();
    const seen = [];
    for (const [width, height, variant, cardWidth] of [
      [844, 390, 'landscape', 300],
      [1024, 768, 'tablet', 600],
      [768, 1024, 'portrait', 600],
      [390, 844, 'portrait', 450]
    ]) {
      await fixture.evaluate((f, size) => f.resize(...size), [width, height]);
      await frames();
      const now = await fixture.evaluate(f => f.read());
      assert.equal(now.variant, variant, width + ' x ' + height);
      assert.equal(now.width, cardWidth, width + ' x ' + height);
      seen.push([width + 'x' + height, now.variant]);
    }
    const { builds } = await fixture.evaluate(f => f.read());
    // Built once for each change of parts; turning a phone that keeps the portrait parts builds nothing again.
    assert.deepEqual(builds, ['landscape', 'tablet', 'portrait']);
    return seen;
  } finally {
    await fixture.evaluate(f => f.close());
    await fixture.dispose();
    if (before) await page.setViewportSize(before);
  }
}

// A play3d world held upright: two red boxes four units to each side of the middle. With the camera's angle kept from
// top to bottom (as before), an upright phone sees too little of the sides to show them; with keepWidthBelow 1 it sees
// as much of the sides as a square view, and both show. Turned sideways, the angle is the one the game set again.
async function verifyPortrait3D(page, PNG) {
  const before = page.viewportSize();
  await page.setViewportSize({ width: 900, height: 900 });
  const fixture = await page.evaluateHandle(async () => {
    const { play3d } = await import('@egret/engine/webgl2/world3d');
    const parent = document.createElement('div');
    parent.style.cssText = 'position:fixed;left:0;top:0;z-index:10;width:390px;height:844px';
    document.body.append(parent);
    let game;
    await play3d({
      parent,
      width: 390,
      height: 844,
      fit: 'expand',
      pixelRatio: 1,
      background: 0x101010,
      audio: false,
      setup(g) {
        game = g;
        g.look({ background: 0x101010, fog: 0 });
        for (const x of [-4, 4]) g.box(1, 1, 1, 0xff2020, { x, y: 0.5, z: 0 });
      }
    });
    return {
      resize(width, height) {
        parent.style.width = width + 'px';
        parent.style.height = height + 'px';
      },
      keep(value) {
        game.camera.keepWidthBelow = value;
      },
      read: () => ({ fov: game.camera.fov, drawn: game.camera.node.fov, aspect: game.camera.node.aspect }),
      async close() {
        await game.dispose();
        parent.remove();
      }
    };
  });
  const frames = () =>
    page.evaluate(
      () => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(done))))
    );
  // Red pixels in the left and the right third of the box the world is shown in.
  const reds = async (width, height) => {
    const png = PNG.sync.read(await page.screenshot({ clip: { x: 0, y: 0, width, height } }));
    let left = 0,
      right = 0;
    for (let y = 0; y < png.height; y++)
      for (let x = 0; x < png.width; x++) {
        const i = (y * png.width + x) * 4,
          [r, g, b] = [png.data[i], png.data[i + 1], png.data[i + 2]];
        if (!(r > 120 && r > 2 * g && r > 2 * b)) continue;
        if (x < png.width / 3) left++;
        else if (x >= (png.width * 2) / 3) right++;
      }
    return { left, right };
  };
  try {
    await frames();
    const upright = await fixture.evaluate(f => f.read());
    const narrow = await reds(390, 844);
    assert.equal(upright.fov, 55);
    assert.equal(upright.drawn, 55, 'the angle from top to bottom is kept unless asked');
    assert.ok(narrow.left === 0 && narrow.right === 0, 'upright, the sides are out of view: ' + JSON.stringify(narrow));
    await fixture.evaluate(f => f.keep(1));
    await frames();
    const kept = await fixture.evaluate(f => f.read());
    const wide = await reds(390, 844);
    const expected = (360 / Math.PI) * Math.atan(Math.tan((55 * Math.PI) / 360) / kept.aspect);
    assert.ok(kept.aspect < 0.5 && Math.abs(kept.drawn - expected) < 1e-6, JSON.stringify(kept));
    assert.equal(kept.fov, 55, 'the angle the game set is kept');
    assert.ok(wide.left > 20 && wide.right > 20, 'with the width kept, both boxes show: ' + JSON.stringify(wide));
    await fixture.evaluate(f => f.resize(844, 390));
    await frames();
    const sideways = await fixture.evaluate(f => f.read());
    assert.ok(
      sideways.aspect > 2 && sideways.drawn === 55,
      'sideways, the angle is the one set: ' + JSON.stringify(sideways)
    );
    return {
      uprightFov: upright.drawn,
      keptFov: Math.round(kept.drawn * 10) / 10,
      sidewaysFov: sideways.drawn,
      narrow,
      wide
    };
  } finally {
    await fixture.evaluate(f => f.close());
    await fixture.dispose();
    if (before) await page.setViewportSize(before);
  }
}

export async function verifyScreenFit(page, PNG) {
  const before = page.viewportSize();
  await page.setViewportSize({ width: 960, height: 540 });
  const containScale = await verifyContainScale(page);
  const fixedFits = PNG === undefined ? undefined : await verifyFixedFits(page, PNG);
  const pins = await verifyPins(page);
  const uiScale = await verifyUiScale(page);
  const tablet = await verifyTabletParts(page);
  const portrait3D = PNG === undefined ? undefined : await verifyPortrait3D(page, PNG);
  const fixture = await page.evaluateHandle(async () => {
    const { play } = await import('@egret/engine/play');
    const log = { arranged: [], taps: 0 };
    let button;
    const game = await play({
      width: 640,
      height: 360,
      portrait: { width: 360, height: 640 },
      fit: 'expand',
      // A notch on the left in landscape: 44 CSS pixels.
      insets: { top: 0, right: 0, bottom: 0, left: 44 },
      backend: 'webgl2',
      setup(g) {
        button = g.button('Menu', { x: 0, y: 0, width: 80, height: 40 }, () => log.taps++);
      },
      arrange(g) {
        // The button in the safe part's top right corner, whatever the window's shape.
        button.x = g.safe.x + g.safe.width - 50;
        button.y = g.safe.y + 30;
        log.arranged.push({
          orientation: g.orientation,
          width: g.width,
          height: g.height,
          screen: { ...g.screen },
          safe: { ...g.safe },
          button: { x: button.x, y: button.y }
        });
      }
    });
    const contain = await play({ width: 200, height: 100, backend: 'webgl2', parent: document.body });
    const plain = { width: contain.width, screen: { ...contain.screen }, safe: { ...contain.safe } };
    await contain.dispose();
    return {
      log,
      plain,
      // Where a point of the game is in the page, as the canvas is shown now.
      pageOf(x, y) {
        const box = game.canvas.getBoundingClientRect(),
          screen = game.screen;
        return {
          x: box.left + ((x - screen.x) / screen.width) * box.width,
          y: box.top + ((y - screen.y) / screen.height) * box.height
        };
      },
      canvas() {
        const box = game.canvas.getBoundingClientRect();
        return { width: box.width, height: box.height };
      },
      close: () => game.dispose()
    };
  });
  const frames = () => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  try {
    const plain = await fixture.evaluate(f => f.plain);
    // 'contain' is as it was: the window shows the design and all of it is safe.
    assert.deepEqual(plain.screen, { x: 0, y: 0, width: 200, height: 100 });
    assert.deepEqual(plain.safe, { x: 0, y: 0, width: 200, height: 100 });

    // Landscape, 960 × 540: the design fits at 1.5, so the window shows exactly it; the notch covers 44 / 1.5 units.
    let log = await fixture.evaluate(f => f.log.arranged);
    assert.equal(log.length, 1, 'arranged once after setup');
    let now = log.at(-1);
    assert.equal(now.orientation, 'landscape');
    assert.deepEqual(now.screen, { x: 0, y: 0, width: 640, height: 360 });
    assert.ok(Math.abs(now.safe.x - 44 / 1.5) < 0.01 && Math.abs(now.safe.width - (640 - 44 / 1.5)) < 0.01);
    assert.deepEqual(await fixture.evaluate(f => f.canvas()), { width: 960, height: 540 });

    // Wider, 1200 × 540: the same scale, and the window shows 800 units across, 80 each side of the design.
    await page.setViewportSize({ width: 1200, height: 540 });
    await frames();
    log = await fixture.evaluate(f => f.log.arranged);
    now = log.at(-1);
    assert.equal(now.width, 640);
    assert.deepEqual(now.screen, { x: -80, y: 0, width: 800, height: 360 });
    assert.ok(Math.abs(now.safe.x - (-80 + 44 / 1.5)) < 0.01, 'the safe part starts past the notch');

    // The phone turns: 540 × 960 is taller than wide, so the portrait design applies, at 1.5 again.
    await page.setViewportSize({ width: 540, height: 960 });
    await frames();
    log = await fixture.evaluate(f => f.log.arranged);
    now = log.at(-1);
    assert.equal(now.orientation, 'portrait');
    assert.equal(now.width, 360);
    assert.equal(now.height, 640);
    assert.deepEqual(now.screen, { x: 0, y: 0, width: 360, height: 640 });
    assert.deepEqual(await fixture.evaluate(f => f.canvas()), { width: 540, height: 960 });

    // A tap on the button where arrange put it, in the page's pixels, reaches it.
    const at = await fixture.evaluate((f, b) => f.pageOf(b.x, b.y), now.button);
    await page.mouse.click(at.x, at.y);
    await frames();
    assert.equal(await fixture.evaluate(f => f.log.taps), 1, 'the button at the safe edge takes the tap');
    return {
      containScale,
      fixedFits,
      pins,
      uiScale,
      tablet,
      portrait3D,
      arranged: log.length,
      orientations: [...new Set(log.map(entry => entry.orientation))],
      taps: 1
    };
  } finally {
    await fixture.evaluate(f => f.close());
    await fixture.dispose();
    if (before) await page.setViewportSize(before);
  }
}
