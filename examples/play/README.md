# Play: three whole games

English | [简体中文](README.zh-CN.md)

Three games, each one file and one call to `play` from `@egret/engine/play`: a breakout, a platformer and a game of matching pairs. None has an image, a sound file or a font; shapes are drawn, sounds are made in code, and each plays by keyboard and by pointer. They are the three games of [llms.txt](../../llms.txt), the page an agent reads to write a game, and that page holds them as they are here.

## Run

```text
node tools/build.mjs
node tools/serve-canvas.mjs
```

Open `/examples/play/index.html` on the host and port the server prints. It runs the breakout; add `?game=platformer` or `?game=memory` for the others. A game fills the window.

## What to try

- Breakout: move the paddle with the arrows or by dragging. Where the ball lands on the paddle steers it. Lose three balls, or break every brick, and press the button to play again.
- Platformer: run with the arrows or by holding a side of the screen, jump with Space or by tapping the upper half. The level is wider than the stage and the view follows. The ground runs all the way to the goal, and each platform has a coin over it.
- Memory: tap two cards. A pair stays; two that differ turn back. The fewest moves is kept between visits.

## How it works

| Part | From |
| --- | --- |
| The canvas, the fit to the window and the loop | `play({ width, height, setup, update })` |
| Bricks, the paddle, platforms, coins | `game.rect` and `game.circle`, placed by their middle |
| Cards with round corners, drawn again when they turn | `game.sprite(g => …)` and `sprite.graphics.clear()` |
| Keys and the pointer | `game.keys.axis()`, `game.keys.pressed`, `game.pointer`, `game.onTap` |
| The ball against bricks, the hero against coins | `game.overlaps` and `game.hits` |
| Standing on a platform and stopping at a wall | `game.pushOut` |
| A level wider than the stage | `game.view.x` |
| A card's turn, and waiting for it | `game.tween(card).to({ scaleX: 0 }, 0.1).done` and `game.wait` |
| Sounds | `game.sfx.play('coin')` and the other effects made in code |
| A hit that is felt | `game.burst`, `game.shake`, `game.flash` |
| The score, the end and playing again | `game.text`, `game.button`, `game.restart` |
| The best score | `game.save` and `game.load` |

See the [guide to play](../../knowledge-base/en/docs/play.md).

## Check

```text
node examples/play/verify.mjs <absolute Playwright index.mjs> <new absolute output directory> [software]
```

It plays each game to its end with the keyboard and the mouse, reading the page from its pictures: nothing in a game is there for the check. In the breakout the paddle follows the pointer and the arrows, a brick breaks with a sound, the paddle is then kept away from the ball until three are lost, and the button brings every brick back. In the platformer the hero lands, jumps, runs by a held pointer and by a key to the goal, and the button puts it back at the start. In the memory game the check turns cards two at a time, remembers their colours, finds all eight pairs, and the button turns the sixteen face down again. Sounds are counted, not heard. It runs WebGL2 on software rendering; a phone, other browsers and WebGPU were not run.

To check a game of your own that is one page, see `tools/verify-game.mjs`. It plays blind; given a script, it plays the game as a person would, and [play-breakout.mjs](play-breakout.mjs) is one, taking the breakout to its end.
