// SPDX-License-Identifier: Apache-2.0
// A probe of what a game reaches for in a WeChat mini game, exported by tools/wechat/export-wechat.mjs and run by
// verify.mjs in the stand-in. Each part is a step the verification calls through GameGlobal.__probe, and each says
// what it saw: words drawn on the canvas, and what the game was given.
import { play } from '@egret/engine/play';
import { createParagraph, createParagraphCache } from '@egret/engine/paragraph';
import { chooseParagraphProvider } from '@egret/engine/web/paragraph';
import { Sprite } from '@egret/engine';

const probe = (GameGlobal.__probe = { ready: false, steps: {} });

const game = await play({
  width: 720,
  height: 1280,
  background: 0x101820,
  setup(g) {
    g.rect(360, 640, 720, 1280, 0x182838);
  }
});

// Words drawn by the engine's labels: a title and a few lines, white on the dark field.
probe.labels = async () => {
  const lines = ['洗冤笔录 Inquest', '第一案 · 河边', 'A label in a mini game'];
  const made = lines.map((words, i) =>
    game.text(words, { x: 360, y: 200 + i * 80, size: 40, color: 0xffffff, align: 'center' })
  );
  await new Promise(resolve => setTimeout(resolve, 600));
  return { made: made.length, texts: made.map(text => text.text) };
};

// A paragraph with no WebAssembly: the provider the device is given, its lines drawn, and a word found by a hit.
probe.paragraph = async () => {
  const choice = await chooseParagraphProvider({
    // Never called here: a mini game has no WebAssembly global, so CanvasKit is not chosen.
    loadCanvasKit: async () => {
      throw new Error('CanvasKit was loaded in a mini game');
    }
  });
  const text = '洗冤笔录·第一案：河边发现一具男尸，衣着整齐，袖口未湿。The ferryman saw a lantern at midnight.';
  const cache = createParagraphCache(game.engine.assets, { provider: choice.provider });
  const paragraph = createParagraph(game.engine, game.scope, cache);
  paragraph.setRequest({
    text,
    width: 600,
    fontFamilies: ['sans-serif'],
    fontSize: 36,
    lineHeight: 54,
    locale: 'zh',
    direction: 'ltr',
    fillColor: 0xffffff,
    density: 2,
    textGeometry: true,
    runs: [{ start: text.indexOf('ferryman'), end: text.indexOf('ferryman') + 8, fillColor: 0xffffff }]
  });
  const metrics = await paragraph.prepare();
  const holder = game.scope.use(new Sprite());
  holder.x = 60;
  holder.y = 760;
  holder.addChild(paragraph);
  game.ui.addChild(holder);
  const geometry = paragraph.getStatus().geometry;
  const word = text.indexOf('lantern');
  const box = geometry.clusters.find(cluster => cluster.start === word + 2);
  // A caret hit: a point in the first half of a letter finds the place before it.
  const hit = geometry.hitTest(box.left + (box.right - box.left) / 4, (box.top + box.bottom) / 2);
  const rects = geometry.getSelectionRects(word, word + 'lantern'.length);
  await new Promise(resolve => setTimeout(resolve, 600));
  return {
    backend: choice.backend,
    reason: choice.reason,
    lines: metrics.lines.map(line => text.slice(line.start, line.end)),
    height: metrics.height,
    // Where the paragraph sits on the 720 × 1280 stage, for the verification to find it on the screen.
    at: { x: holder.x, y: holder.y, width: 600, height: metrics.height },
    word: {
      start: word,
      hit: hit.offset,
      expected: word + 2,
      rects: rects.map(r => [r.left, r.top, r.right, r.bottom])
    }
  };
};

probe.ready = true;
