// SPDX-License-Identifier: Apache-2.0
// A probe of what a game reaches for in a WeChat mini game, exported by tools/wechat/export-wechat.mjs and run by
// verify.mjs in the stand-in. Each part is a step the verification calls through GameGlobal.__probe, and each says
// what it saw: words drawn on the canvas, and what the game was given.
import { play } from '@egret/engine/play';
import { createParagraph, createParagraphCache } from '@egret/engine/paragraph';
import { chooseParagraphProvider } from '@egret/engine/web/paragraph';
import { createBrowserTextInput } from '@egret/engine/web/text-input';
import { createWechatTextInput } from '@egret/engine/web/wechat-text-input';
import { Sprite } from '@egret/engine';

const probe = (GameGlobal.__probe = { ready: false, steps: {} });

const game = await play({
  width: 720,
  height: 1280,
  // The design is 720 × 1280; a phone of another shape shows more of the stage around it.
  fit: 'expand',
  background: 0x000000,
  setup(g) {
    // The whole screen, as arrange finds it: drawn again whenever the screen changes.
    probe.backdrop = g.sprite();
    g.rect(360, 640, 720, 1280, 0x182838);
  },
  arrange(g) {
    probe.arranged = { screen: g.screen, width: g.width, height: g.height };
    const s = g.screen;
    probe.backdrop.graphics.clear();
    probe.backdrop.graphics.beginFill(0x101820).drawRect(s.x, s.y, s.width, s.height).endFill();
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

// The page's text field, which a mini game cannot show: what opening one does here.
probe.browserTextInput = () => {
  try {
    const field = createBrowserTextInput({ canvas: game.canvas, logicalWidth: 720, logicalHeight: 1280 });
    field.open({ x: 60, y: 1000, width: 600, height: 60 });
    const state = field.getSnapshot().state;
    field.dispose();
    return { state };
  } catch (error) {
    return { refused: error.code ?? String(error) };
  }
};

// Text input through WeChat's keyboard: sessions the verification types into, confirms, closes and cancels, with what
// each told the game kept here, and the words committed drawn in a label.
const typed = (probe.typed = []);
const input = createWechatTextInput({ onError: error => typed.push(['error', String(error)]) });
const shownWords = game.text('', { x: 360, y: 1100, size: 40, color: 0xffffff, align: 'center' });
probe.textInput = (options = {}) => {
  input.open({
    x: 60,
    y: 1000,
    width: 600,
    height: 60,
    value: options.value ?? '',
    ...(options.maxLength === undefined ? {} : { maxLength: options.maxLength }),
    ...(options.blur === undefined ? {} : { blur: options.blur }),
    onChange: change => typed.push(['change', change.value]),
    onCommit: value => {
      typed.push(['commit', value]);
      shownWords.text = value;
    },
    onCancel: () => typed.push(['cancel'])
  });
  return input.getSnapshot();
};
probe.textInputSnapshot = () => input.getSnapshot();
probe.cancelTextInput = () => {
  input.cancel();
  return input.getSnapshot();
};

// A marker at a place of the game, and where a tap there is told: in the game's units, on the stage, and where
// localToGlobal puts the marker.
probe.marker = () => {
  const marker = game.rect(360, 300, 40, 40, 0xffd060);
  probe.markerSprite = marker;
  const corner = marker.localToGlobal(0, 0);
  return {
    stage: game.toStage(360, 300),
    corner: { x: corner.x, y: corner.y },
    back: game.fromStage(corner.x, corner.y)
  };
};
probe.pointer = () => {
  const at = game.toStage(game.pointer.x, game.pointer.y);
  const marker = probe.markerSprite.localToGlobal(0, 0);
  return { game: { x: game.pointer.x, y: game.pointer.y }, stage: at, marker: { x: marker.x, y: marker.y } };
};
// Where the game is on the stage, and what the screen shows of it.
probe.screen = () => ({
  arranged: probe.arranged,
  width: game.width,
  height: game.height,
  screen: game.screen,
  safe: game.safe,
  stage: { width: game.browser.frame.width, height: game.browser.frame.height },
  canvas: { width: game.canvas.width, height: game.canvas.height }
});

// The pictures of the subpackage art/: not there until wx.loadSubpackage has downloaded them.
probe.subpackage = async () => {
  // The file is asked for before (a picture that failed is remembered as failed, so it is not drawn then).
  const before = await fetch('art/seal.png').then(
    response => (response.ok ? 'there' : 'refused: ' + response.status),
    error => 'refused: ' + String(error.message)
  );
  const progress = [];
  await new Promise((resolve, reject) => {
    const task = wx.loadSubpackage({
      name: 'art',
      success: resolve,
      fail: failure => reject(new Error(failure.errMsg))
    });
    task?.onProgressUpdate?.(update => progress.push(update.progress));
  });
  const after = await game.image('art/seal.png', { x: 660, y: 1200, width: 64, height: 64 }).then(
    () => 'loaded',
    error => {
      let text = 'refused:';
      for (let at = error; at; at = at.cause) text += ' ' + String(at.code ?? at.message);
      return text;
    }
  );
  return { before, progress, after };
};

probe.ready = true;
