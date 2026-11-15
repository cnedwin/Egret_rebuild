// SPDX-License-Identifier: Apache-2.0
// A starting point for a 2D game: one Engine, one stage, a frame loop, pointer and keyboard input, and a rule.
// Copy this folder, keep the import map of index.html, and replace what is between the two "Game" lines.
import { animate, Bitmap, DisplayObjectContainer, Sprite } from '@egret/engine';
import { createBrowserGame } from '@egret/engine/web/game';

// The stage is 480 by 270 units whatever the size of the canvas on the page.
const WIDTH = 480,
  HEIGHT = 270;
const canvas = document.querySelector('#scene'),
  status = document.querySelector('#status'),
  query = new URLSearchParams(location.search);
let failure, scoreLabel;

// 1. One call makes the game: a Host that draws (WebGPU where the browser gives an adapter, WebGL2 otherwise; `?backend=`
// chooses one), an Engine, a scope that owns what the game creates, pointer and keyboard input, and a frame loop. On each
// frame the display shows, the loop moves the Engine's clock, calls `update` and draws; it keeps a step short after the
// tab was hidden, and skips a frame while the Host has not finished the two it holds. `?stats` shows a panel of numbers.
// With ?fit=contain, cover or stretch the canvas fills its element that way. The element is given a size of its own
// here, 400 by 300, so that there is something to fill: a 16:9 stage does not fit it exactly.
if (query.has('fit')) {
  canvas.style.cssText = 'display:block;max-width:none';
  canvas.parentElement.style.cssText = 'width:400px;height:300px;overflow:hidden';
}
const game = await createBrowserGame({
  canvas,
  width: WIDTH,
  height: HEIGHT,
  clearColor: 0x1b1f2a,
  pixelRatio: 1.5,
  backend: query.get('backend') ?? 'auto',
  stats: query.has('stats'),
  fit: query.get('fit') ?? 'none',
  autoStart: false,
  update(seconds) {
    update(seconds);
    status.textContent = 'Coins / 金币 ' + score + ' / ' + PLACES.length + ' · ' + game.backend;
    if (scoreLabel !== undefined) scoreLabel.text = '金币 ' + score + ' / ' + PLACES.length;
  },
  // An error has a code, and often the error that caused it, which has one too.
  onError(cause) {
    failure = String(cause?.code ?? cause?.message ?? cause) + (cause?.cause?.code ? ' ← ' + cause.cause.code : '');
    status.textContent = 'Failed / 失败：' + failure;
  }
});
const { engine, scope } = game;

// ---- Game: state ---------------------------------------------------------------------------------------------
export const HERO = 0x4a7bd0,
  COIN = 0xf0c030,
  SPEED = 160,
  HERO_SIZE = 24,
  COIN_SIZE = 12;
const PLACES = [
  [80, 60],
  [400, 60],
  [240, 135],
  [80, 210],
  [400, 210]
];
const world = engine.stage.addChild(scope.use(new DisplayObjectContainer()));
const hero = world.addChild(scope.use(new Sprite()));
// A sprite's graphics are drawn around its own origin; x and y place that origin on the stage.
hero.graphics
  .beginFill(HERO)
  .drawRect(-HERO_SIZE / 2, -HERO_SIZE / 2, HERO_SIZE, HERO_SIZE)
  .endFill();
let coins = [],
  score = 0,
  target,
  keys = new Set();
function start() {
  for (const coin of coins) coin.sprite.dispose();
  coins = PLACES.map(([x, y]) => {
    const sprite = world.addChildAt(scope.use(new Sprite()), 0);
    sprite.graphics
      .beginFill(COIN)
      .drawRect(-COIN_SIZE / 2, -COIN_SIZE / 2, COIN_SIZE, COIN_SIZE)
      .endFill();
    sprite.x = x;
    sprite.y = y;
    return { sprite, x, y };
  });
  hero.x = 40;
  hero.y = 135;
  score = 0;
  target = undefined;
}

// ---- Game: input ---------------------------------------------------------------------------------------------
// `toStage` turns a place on the page into a place on the stage.
canvas.addEventListener('pointerdown', event => {
  target = game.toStage(event.clientX, event.clientY);
  canvas.focus();
});
const ARROWS = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
canvas.addEventListener('keydown', event => {
  if (ARROWS[event.code]) {
    keys.add(event.code);
    target = undefined;
    event.preventDefault();
  }
});
canvas.addEventListener('keyup', event => keys.delete(event.code));
canvas.addEventListener('blur', () => keys.clear());
document.querySelector('#reset').addEventListener('click', start);

// ---- Game: one step of `seconds` -----------------------------------------------------------------------------
function update(seconds) {
  let dx = 0,
    dy = 0;
  for (const code of keys) {
    dx += ARROWS[code][0];
    dy += ARROWS[code][1];
  }
  if (dx === 0 && dy === 0 && target !== undefined) {
    dx = target.x - hero.x;
    dy = target.y - hero.y;
  }
  const distance = Math.hypot(dx, dy),
    step = SPEED * seconds;
  if (distance > 0) {
    // Arrive exactly instead of stepping past a place that was tapped.
    const reach = target !== undefined && keys.size === 0 && distance <= step,
      scale = reach ? 1 : step / distance;
    hero.x = Math.min(WIDTH - HERO_SIZE / 2, Math.max(HERO_SIZE / 2, hero.x + dx * scale));
    hero.y = Math.min(HEIGHT - HERO_SIZE / 2, Math.max(HERO_SIZE / 2, hero.y + dy * scale));
    if (reach) target = undefined;
  }
  for (const coin of coins) {
    if (
      coin.taken ||
      Math.abs(coin.x - hero.x) > (HERO_SIZE + COIN_SIZE) / 2 ||
      Math.abs(coin.y - hero.y) > (HERO_SIZE + COIN_SIZE) / 2
    )
      continue;
    // A coin that is picked up grows and fades for a fifth of a second, then goes. `taken` keeps it from counting twice.
    coin.taken = true;
    score++;
    animate(engine, scope, coin.sprite)
      .to({ scaleX: 2, scaleY: 2, alpha: 0 }, 0.2, 'quadOut')
      .call(() => coin.sprite.dispose())
      .start();
  }
}
// ---- Game: end -----------------------------------------------------------------------------------------------

// With ?image=<address of a PNG> in the address, that image is loaded and shown in the corner, and counts the taps on
// it: one call loads it, and a bitmap that is touch enabled is hit on its rectangle without more being said.
let taps = 0;
if (query.has('image')) {
  const picture = engine.stage.addChild(scope.use(new Bitmap(await game.loadTexture(query.get('image')))));
  picture.x = WIDTH - 40;
  picture.y = 8;
  picture.touchEnabled = true;
  picture.on(game.pointer.events.tap, () => {
    taps++;
  });
}

// The score, as text on the stage. Setting `text` draws the new words when they are ready.
scoreLabel = await game.createLabel({ text: '金币 0 / ' + PLACES.length, fontSize: 14, color: 0xf0c030, locale: 'zh' });
scoreLabel.display.x = 8;
scoreLabel.display.y = 6;
engine.stage.addChild(scoreLabel.display);

// 2. Place everything, then start the loop.
start();
game.loop.start();

// What a check reads; a game does not need it.
globalThis.__egretStarterExample = {
  readSnapshot: () => ({
    backend: game.backend,
    label: scoreLabel?.text,
    labelShown: scoreLabel?.display.getStatus().committedRevision,
    stats: game.stats?.snapshot(),
    hero: { x: hero.x, y: hero.y },
    score,
    coins: coins.filter(c => !c.taken).map(c => [c.x, c.y]),
    taps,
    frames: game.loop.snapshot().frames,
    failure
  })
};
