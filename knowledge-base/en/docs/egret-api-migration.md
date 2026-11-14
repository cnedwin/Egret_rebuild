# From Egret 5 to this SDK: which call replaces which

English | [简体中文](../../Cns/docs/egret-api-migration.md)

A table for someone porting a game written for Egret Engine 5: the old call on the left, what to write now on the right, and what is not there. It is a map of the API, not a promise that a project converts by itself. The plan for whole-project conversion is in [legacy project migration](legacy-project-migration.md).

**How this page was made.** Each row on the right was checked against the sources and examples of this checkout. The left column is Egret 5's public API as its documentation gives it; no Egret 5 project was converted to make this page.

## What is different throughout

Five things change in every file. Knowing them saves most of the guessing.

1. **Nothing is global.** There is no `egret` object, no `RES`, no singleton stage. A game has an `Engine`, made by a call, and everything hangs from it: `engine.stage`, `engine.assets`, `engine.createTween`.
2. **Things are made by `create...` functions and ended by `dispose()`.** Display objects are still classes (`new Sprite()`), but inputs, tweens, text, sound and loaders are made by factories, and each has `dispose()`.
3. **A scope owns what you create.** `scope.use(new Sprite())` gives an object to a scope; `scope.dispose()` disposes all of it. This replaces removing listeners and children by hand when a screen closes.
4. **Events are typed values, not strings.** `sprite.on(pointer.events.begin, handler)` returns a function that removes the listener. There is no `addEventListener('touchTap', ...)`.
5. **Errors have codes and say what happened.** Every error is an `EgretError` with a `code`; the [error code reference](error-codes.md) lists them. A wrong value throws at the call that gave it.

## Starting up

| Egret 5 | Now | Notes |
| --- | --- | --- |
| `egret.runEgret({ ... })` and a `Main` document class | `await createBrowserGame({ canvas, width, height, update })` from `@egret/engine/web/game` | See [one call for a game in a page](browser-game.md) |
| `this.stage` | `game.stage`, or `engine.stage` | One stage for an Engine |
| `stage.stageWidth`, `stage.stageHeight` | The `width` and `height` you gave | The stage has a fixed size in its own units |
| `scaleMode`, `orientation` in `index.html` | CSS on the canvas | The page sizes the canvas; the stage is drawn into it whole |
| `egret.startTick(fn)`, `Event.ENTER_FRAME` | `update(seconds)` of `createBrowserGame` or of [the frame loop](frame-loop.md) | `seconds` is the time since the step before, at most 0.1 |
| `egret.Timer`, `egret.setTimeout` | Count seconds in `update`, or the page's own `setTimeout` | No timer class |
| `egret.getTimer()` | `performance.now()`, or sum the `seconds` of `update` | |
| `egret.log` | `console.log` | |

## Display objects

| Egret 5 | Now | Notes |
| --- | --- | --- |
| `egret.DisplayObjectContainer` | `DisplayObjectContainer` | `addChild`, `addChildAt`, `removeChild`, `removeChildren`, `getChildAt`, `getChildIndex`, `setChildIndex`, `numChildren` are there |
| `egret.Sprite`, `egret.Shape` | `Sprite` | There is no `Shape`. A `Sprite` has `graphics` and can hold children |
| `x`, `y`, `scaleX`, `scaleY`, `rotation`, `alpha`, `visible`, `anchorOffsetX`, `anchorOffsetY` | The same names | `rotation` is in degrees, as before |
| `width`, `height` | `getBounds()` to read. To size, set `scaleX` and `scaleY`, or draw at the size | No `width` or `height` setter |
| `skewX`, `skewY` | Not there | |
| `name`, `getChildByName` | Not there. Keep your own references or a `Map` | |
| `removeChildAt`, `swapChildren`, `contains` | `removeChild(getChildAt(i))`; `setChildIndex`; walk `parent` | |
| `mask = rectangle`, `scrollRect` | `clipRect = { x, y, width, height }` | A rectangle in the object's own units |
| `mask = displayObject` | Not there | Only rectangles clip |
| `blendMode` | `blendMode`: `'normal'`, `'add'`, `'multiply'`, `'screen'`, `'erase'` | See [blend modes](blend-modes.md) |
| `filters = [new egret.GlowFilter(...)]` | `renderEffect` | See [filters](filters.md) for which effects there are |
| `cacheAsBitmap` | Not there | |
| `touchEnabled`, `touchChildren` | The same names, with `hitArea` | Hit testing reads `hitArea`, not the drawing |
| `hitTestPoint` | `stage.hitTest(x, y)` | |
| `localToGlobal`, `globalToLocal` | The same names | They return `{ x, y }` |
| `egret.Point`, `egret.Rectangle`, `egret.Matrix` | Plain objects: `{ x, y }`, `{ x, y, width, height }` | No classes |

## Drawing

| Egret 5 | Now | Notes |
| --- | --- | --- |
| `graphics.beginFill`, `endFill`, `clear` | The same | |
| `drawRect`, `drawCircle`, `drawEllipse`, `drawRoundRect`, `drawArc` | The same | |
| `moveTo`, `lineTo`, `curveTo`, `cubicCurveTo` | The same | |
| `lineStyle(thickness, color, alpha, pixelHinting, scaleMode, caps, joints, miterLimit, lineDash)` | `lineStyle(thickness, color, alpha, { caps, joints, miterLimit, dash })` | The fourth argument is an object. Without it a line has flat ends and mitred corners. Where the old line had round ends or corners, pass `{ caps: 'round', joints: 'round' }` |
| `beginGradientFill(type, colors, alphas, ratios, matrix)` | The same call, or `beginLinearGradientFill` and `beginRadialGradientFill` | `matrix` is a plain `{ a, b, c, d, tx, ty }` |
| `lineGradientStyle`, `beginBitmapFill` | Not there | |

Edges are not smoothed, and a curve is drawn as straight pieces. See the [graphics guide](graphics.md).

## Images and resources

| Egret 5 | Now | Notes |
| --- | --- | --- |
| `new egret.Bitmap(texture)` | `new Bitmap(lease)` | A bitmap takes a lease on a texture, got from `engine.assets.acquire` |
| `RES.getRes('name')`, `RES.getResAsync` | `await engine.assets.acquire(ref, { signal: scope.signal })` | A ref names a type and a key: `createAssetRef(type, key)`. Give the lease to a scope with `scope.use` |
| `RES.loadConfig`, `RES.loadGroup`, group progress events | A content loader over a built manifest: `createContentLoader` from `@egret/engine/resources`, with `@egret/engine/web/resources` in a page | See [the content build](content-build-pipeline.md) and [resource groups](resource-acquisition-groups.md) |
| `default.res.json` | A manifest written by the content build | [Legacy RES declarations](legacy-res-declarations.md) describes the analyzer that reads an old one |
| Loading one image by URL | `createBrowserTextureProvider` from `@egret/engine/web/image` | |
| `egret.SpriteSheet`, a texture atlas | Atlases through the content loader; a bitmap shows a region | See [atlas frames](atlas-frame-layout-contract.md) |
| `bitmap.scale9Grid` | `NineSliceBitmap` | See [nine-slice bitmaps](nine-slice-bitmap-contract.md) |
| `bitmap.fillMode = REPEAT` | Not as a property of a bitmap | A `Mesh2D` with a shared material that repeats draws a tiled image |
| `RES.destroyRes` | `lease.dispose()`, or dispose the scope that holds it | A texture is released when its last lease is |

## Input

| Egret 5 | Now | Notes |
| --- | --- | --- |
| `egret.TouchEvent.TOUCH_BEGIN`, `TOUCH_MOVE`, `TOUCH_END` | `pointer.events.begin`, `.move`, `.end`, with `pointer` from `game.pointer` or `createBrowserPointerInput` | Mouse, touch and pen. See [pointer input](multi-pointer-input.md) |
| `TOUCH_RELEASE_OUTSIDE`, `TOUCH_CANCEL` | `pointer.events.cancel`, with its `reason` | |
| `TOUCH_TAP` | A begin and an end on the same object, or an action control of `@egret/engine/ui` | No tap event of its own |
| `event.stageX`, `event.stageY`, `event.localX` | `event.payload.globalX`, `event.payload.globalY`; `target.globalToLocal(x, y)` for the object's own units | |
| Mouse over, mouse wheel | `createBrowserHoverInput` from `@egret/engine/web/hover` | See [hover](pointer-hover.md) |
| Keyboard (`document.addEventListener('keydown')` in Egret projects) | `game.keyboard` or `createBrowserKeyboardInput` | See [keyboard input](keyboard-focus-input.md) |
| Gamepads | `createBrowserGamepadInput` from `@egret/engine/web/gamepad` | |

## Motion

| Egret 5 | Now | Notes |
| --- | --- | --- |
| `egret.Tween.get(obj).to({ x: 100 }, 500, egret.Ease.quadOut)` | `engine.createTween(scope, { from: obj.x, to: 100, durationSeconds: 0.5, easing: 'quadOut', onUpdate: v => { obj.x = v; } }).start()` | A tween moves one number, in seconds, and runs once `start()` is called; it also has `pause()`, `resume()` and `stop()`. Easings: `'linear'`, `'quadIn'`, `'quadOut'`, `'quadInOut'` |
| `.to(...).to(...)`, `.wait()`, `.call()` | Start the next tween from `onComplete` | No chain |
| `{ loop: true }` | Start it again from `onComplete` | |
| `egret.Tween.removeTweens(obj)` | `tween.dispose()`, or dispose its scope | |
| `egret.MovieClip` | A frame sequence: `createSequenceController` from `@egret/engine/animation` | See [sequence controls](sequence-controls.md). [Legacy MovieClip](legacy-movieclip-contract.md) describes reading old data |
| DragonBones | Not supported | Spine is: `@egret/spine`, JSON or binary. See [Spine support](spine-animation-support-and-acceptance.md) |
| Particles (`particle.GravityParticleSystem`) | `createParticleEmitter` from `@egret/engine/particles` | See [particles](particles.md) |

## Text

| Egret 5 | Now | Notes |
| --- | --- | --- |
| `new egret.TextField()`, `.text = ...` | `createTextField(engine, scope, cache)` from `@egret/engine/text`, then `field.setRequest({ ... })` and `await field.prepare()` | Text is rasterized before it is shown; `@egret/engine/web/text` gives the page's rasterizer |
| `textFlow`, mixed styles, wrapping | `createParagraph` from `@egret/engine/paragraph` | See [paragraphs](paragraph-layout-controls.md) |
| `egret.BitmapText` | `createBitmapText` from `@egret/engine/bitmapfont` | See [bitmap fonts](bitmap-font.md) |
| `type = egret.TextFieldType.INPUT` | `createBrowserTextInput` from `@egret/engine/web/text-input` | A platform text field over the stage |

## UI, sound and the rest

| Egret 5 | Now | Notes |
| --- | --- | --- |
| `eui.Button`, `eui.ToggleButton`, `eui.HSlider`, `eui.Scroller`, `eui.List` | Controls of `@egret/engine/ui`: `createActionControl`, `createToggleControl`, `createRangeControl`, `createScrollControl`, lists | See [UI controls](ui-controls.md). Controls give behaviour; you draw their look |
| EXML skins, `eui.Skin`, data binding | Not there | Build the tree in code |
| `eui.Group` with `HorizontalLayout`, `VerticalLayout` | `planLinearLayout` from `@egret/engine/layout` | |
| `eui.UILayer`, popups | `createUiLayerManager` | See [UI layers](ui-layers.md) |
| `egret.Sound`, `SoundChannel` | `createAudioMixer` from `@egret/engine/audio`, played by `createBrowserAudio` from `@egret/engine/web/audio` | See [audio](audio.md) |
| `egret.Video` | `createVideo` and `createBrowserVideo` | See [video](video.md) |
| `egret.HttpRequest`, `egret.ImageLoader` | The page's `fetch` | |
| `egret.ByteArray` | `ByteReader`, `ByteWriter` | |
| `egret.localStorage` | The page's `localStorage` | |
| `egret.WebSocket` | The page's `WebSocket` | |
| Tiled maps (`tiled.TMXTilemap`) | `importTiledMap` and `createTileMap` from `@egret/engine/tilemap` | See [tile maps](tilemap.md) |
| Physics (p2, Box2D bindings) | `createPhysicsWorld` from `@egret/engine/physics2d` | See [physics](physics-2d.md). Not the same solver |

## A screen, before and after

Egret 5:

```ts
class Menu extends egret.DisplayObjectContainer {
  constructor() {
    super();
    const button = new egret.Shape();
    button.graphics.beginFill(0x4a7bd0); button.graphics.drawRoundRect(0, 0, 160, 48, 16); button.graphics.endFill();
    button.touchEnabled = true;
    button.addEventListener(egret.TouchEvent.TOUCH_TAP, this.onStart, this);
    this.addChild(button);
    egret.Tween.get(button).to({ alpha: 0.5 }, 300);
  }
}
```

Now:

```js
function createMenu(game, onStart) {
  const scope = game.engine.createScope(), menu = scope.use(new DisplayObjectContainer());
  const button = menu.addChild(scope.use(new Sprite()));
  button.graphics.beginFill(0x4a7bd0).drawRoundRect(0, 0, 160, 48, 16).endFill();
  button.touchEnabled = true; button.hitArea = { x: 0, y: 0, width: 160, height: 48 };
  let pressed = false;
  button.on(game.pointer.events.begin, () => { pressed = true; });
  button.on(game.pointer.events.end, () => { if (pressed) onStart(); pressed = false; });
  button.on(game.pointer.events.cancel, () => { pressed = false; });
  game.engine.createTween(scope, { from: 1, to: 0.5, durationSeconds: 0.3, onUpdate: v => { button.alpha = v; } }).start();
  game.stage.addChild(menu);
  // Closing the screen: one call removes the button, its listeners and its tween.
  return () => scope.dispose();
}
```

The second is longer where the first leaned on globals, and shorter where the first needed cleanup: nothing in it has to be removed by hand.
