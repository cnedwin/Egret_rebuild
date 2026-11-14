# 从白鹭 5 到本 SDK：哪个调用换成哪个

[English](../../en/docs/egret-api-migration.md) | 简体中文

给移植白鹭引擎 5 游戏的人看的对照表：左边是旧调用，右边是现在的写法，以及哪些没有提供。这是一份 API 对照，不是"工程可以自动转换"的承诺。整个工程的转换计划见[旧工程迁移](旧工程迁移.md)。

**本页是怎么写出来的。** 右边每一行都对照本仓库的源码和示例核对过。左边一列是白鹭 5 文档给出的公开 API；写这一页时没有实际转换过任何白鹭 5 工程。

## 处处都不同的地方

有五件事在每个文件里都变了。先知道它们，就不用到处猜。

1. **没有全局对象。** 没有 `egret` 对象，没有 `RES`，没有单例舞台。游戏有一个由调用创建的 `Engine`，一切都挂在它上面：`engine.stage`、`engine.assets`、`engine.createTween`。
2. **对象由 `create...` 函数创建，由 `dispose()` 结束。** 显示对象仍然是类（`new Sprite()`），但输入、缓动、文本、声音和加载器由工厂函数创建，并且各自有 `dispose()`。
3. **作用域拥有你创建的东西。** `scope.use(new Sprite())` 把对象交给作用域；`scope.dispose()` 把它们全部销毁。关闭一个界面时不再需要手工移除监听器和子对象。
4. **事件是有类型的值，不是字符串。** `sprite.on(pointer.events.begin, handler)` 返回一个用来移除监听器的函数。没有 `addEventListener('touchTap', ...)`。
5. **错误有错误码，并说明发生了什么。** 每个错误都是带 `code` 的 `EgretError`；[错误码对照表](error-codes.md)列出了它们。错误的值会在给出它的那次调用处抛出。

## 启动

| 白鹭 5 | 现在 | 说明 |
| --- | --- | --- |
| `egret.runEgret({ ... })` 和 `Main` 文档类 | `@egret/engine/web/game` 的 `await createBrowserGame({ canvas, width, height, update })` | 见[一次调用启动页面里的游戏](browser-game.md) |
| `this.stage` | `game.stage` 或 `engine.stage` | 一个 Engine 一个舞台 |
| `stage.stageWidth`、`stage.stageHeight` | 你给出的 `width` 和 `height` | 舞台大小固定，使用自己的单位 |
| `index.html` 里的 `scaleMode`、`orientation` | 画布上的 CSS | 画布大小由页面决定；舞台整个画进画布 |
| `egret.startTick(fn)`、`Event.ENTER_FRAME` | `createBrowserGame` 或[帧循环](frame-loop.md)的 `update(seconds)` | `seconds` 是距上一步的时间，最多 0.1 |
| `egret.Timer`、`egret.setTimeout` | 在 `update` 里累计秒数，或用页面自己的 `setTimeout` | 没有计时器类 |
| `egret.getTimer()` | `performance.now()`，或累加 `update` 的 `seconds` | |
| `egret.log` | `console.log` | |

## 显示对象

| 白鹭 5 | 现在 | 说明 |
| --- | --- | --- |
| `egret.DisplayObjectContainer` | `DisplayObjectContainer` | `addChild`、`addChildAt`、`removeChild`、`removeChildren`、`getChildAt`、`getChildIndex`、`setChildIndex`、`numChildren` 都有 |
| `egret.Sprite`、`egret.Shape` | `Sprite` | 没有 `Shape`。`Sprite` 有 `graphics`，也能放子对象 |
| `x`、`y`、`scaleX`、`scaleY`、`rotation`、`alpha`、`visible`、`anchorOffsetX`、`anchorOffsetY` | 名字相同 | `rotation` 仍然是角度 |
| `width`、`height` | 读取用 `getBounds()`。要改大小，设置 `scaleX` 和 `scaleY`，或直接按该大小绘制 | 没有 `width`、`height` 的 setter |
| `skewX`、`skewY` | 没有 | |
| `name`、`getChildByName` | 没有。自己保存引用，或用一个 `Map` | |
| `removeChildAt`、`swapChildren`、`contains` | `removeChild(getChildAt(i))`；`setChildIndex`；沿 `parent` 向上查 | |
| `mask = 矩形`、`scrollRect` | `clipRect = { x, y, width, height }` | 矩形使用对象自己的单位 |
| `mask = 显示对象` | 没有 | 只能用矩形裁剪 |
| `blendMode` | `blendMode`：`'normal'`、`'add'`、`'multiply'`、`'screen'`、`'erase'` | 见[混合模式](blend-modes.md) |
| `filters = [new egret.GlowFilter(...)]` | `renderEffect` | 有哪些效果见[滤镜](filters.md) |
| `cacheAsBitmap` | 没有 | |
| `touchEnabled`、`touchChildren` | 名字相同 | 开启 touch 的对象按它画出的内容命中：形状的三角形、矩形、位图的矩形。设置了 `hitArea` 时改用 `hitArea` |
| `hitTestPoint` | `stage.hitTest(x, y)` | |
| `localToGlobal`、`globalToLocal` | 名字相同 | 返回 `{ x, y }` |
| `egret.Point`、`egret.Rectangle`、`egret.Matrix` | 普通对象：`{ x, y }`、`{ x, y, width, height }` | 没有这些类 |

## 绘图

| 白鹭 5 | 现在 | 说明 |
| --- | --- | --- |
| `graphics.beginFill`、`endFill`、`clear` | 相同 | |
| `drawRect`、`drawCircle`、`drawEllipse`、`drawRoundRect`、`drawArc` | 相同 | |
| `moveTo`、`lineTo`、`curveTo`、`cubicCurveTo` | 相同 | |
| `lineStyle(thickness, color, alpha, pixelHinting, scaleMode, caps, joints, miterLimit, lineDash)` | `lineStyle(thickness, color, alpha, { caps, joints, miterLimit, dash })` | 第四个参数是一个对象。省略时线条是平头端点和尖角转角。旧线条是圆头或圆角的，请传 `{ caps: 'round', joints: 'round' }` |
| `beginGradientFill(type, colors, alphas, ratios, matrix)` | 同一个调用，或 `beginLinearGradientFill` 和 `beginRadialGradientFill` | `matrix` 是普通的 `{ a, b, c, d, tx, ty }` |
| `beginBitmapFill(bitmapData, matrix, repeat)` | `beginBitmapFill(lease, matrix, repeat)` | 接受一整张图片的纹理租约。`repeat` 为 false 时边缘像素向外延伸 |
| `lineGradientStyle` | 没有 | |

边缘没有抗锯齿，曲线由直线段组成。见[绘图指南](graphics.md)。

## 图片和资源

| 白鹭 5 | 现在 | 说明 |
| --- | --- | --- |
| `new egret.Bitmap(texture)` | `new Bitmap(lease)` | 位图持有一个纹理的租约，租约来自 `engine.assets.acquire` |
| `RES.getRes('name')`、`RES.getResAsync` | `await engine.assets.acquire(ref, { signal: scope.signal })` | ref 指明类型和键：`createAssetRef(type, key)`。用 `scope.use` 把租约交给作用域 |
| `RES.loadConfig`、`RES.loadGroup`、资源组进度事件 | 基于已构建清单的内容加载器：`@egret/engine/resources` 的 `createContentLoader`，在页面里配合 `@egret/engine/web/resources` | 见[内容构建](content-build-pipeline.md)和[资源组](资源批量获取.md) |
| `default.res.json` | 内容构建写出的清单 | [旧 RES 声明](legacy-res-declarations.md)介绍读取旧配置的分析器 |
| 按 URL 加载一张图片 | `@egret/engine/web/image` 的 `createBrowserTextureProvider` | |
| `egret.SpriteSheet`、纹理图集 | 通过内容加载器使用图集；位图显示其中一个区域 | 见[图集帧](atlas-frame-layout-contract.md) |
| `bitmap.scale9Grid` | `NineSliceBitmap` | 见[九宫格位图](九宫格位图契约.md) |
| `bitmap.fillMode = REPEAT` | 不是位图的属性 | 用 `Sprite` 的 `graphics.beginBitmapFill(lease)` 加一个 `drawRect` 可以画出平铺的图片 |
| `RES.destroyRes` | `lease.release()`，或销毁持有它的作用域 | 最后一个租约释放时纹理才释放 |

## 输入

| 白鹭 5 | 现在 | 说明 |
| --- | --- | --- |
| `egret.TouchEvent.TOUCH_BEGIN`、`TOUCH_MOVE`、`TOUCH_END` | `pointer.events.begin`、`.move`、`.end`，`pointer` 来自 `game.pointer` 或 `createBrowserPointerInput` | 鼠标、触摸和笔。见[指针输入](multi-pointer-input.md) |
| `TOUCH_RELEASE_OUTSIDE`、`TOUCH_CANCEL` | `pointer.events.cancel`，带 `reason` | |
| `TOUCH_TAP` | `pointer.events.tap` | 在接触开始时所在的对象上结束，且距开始位置不超过 12 个舞台单位 |
| `event.stageX`、`event.stageY`、`event.localX` | `event.payload.globalX`、`event.payload.globalY`；对象自己的单位用 `target.globalToLocal(x, y)` | |
| 鼠标悬停、滚轮 | `@egret/engine/web/hover` 的 `createBrowserHoverInput` | 见[悬停](pointer-hover.md) |
| 键盘（白鹭工程里的 `document.addEventListener('keydown')`） | `game.keyboard` 或 `createBrowserKeyboardInput` | 见[键盘输入](keyboard-focus-input.md) |
| 手柄 | `@egret/engine/web/gamepad` 的 `createBrowserGamepadInput` | |

## 动画

| 白鹭 5 | 现在 | 说明 |
| --- | --- | --- |
| `egret.Tween.get(obj).to({ x: 100 }, 500, egret.Ease.quadOut)` | `engine.createTween(scope, { from: obj.x, to: 100, durationSeconds: 0.5, easing: 'quadOut', onUpdate: v => { obj.x = v; } }).start()` | 一个缓动驱动一个数字，时间单位是秒，调用 `start()` 后才运行；另有 `pause()`、`resume()` 和 `stop()`。缓动函数：`'linear'`、`'quadIn'`、`'quadOut'`、`'quadInOut'` |
| `.to(...).to(...)`、`.wait()`、`.call()` | 在 `onComplete` 里启动下一个缓动 | 没有链式调用 |
| `{ loop: true }` | 在 `onComplete` 里再启动一次 | |
| `egret.Tween.removeTweens(obj)` | `tween.dispose()`，或销毁它的作用域 | |
| `egret.MovieClip` | 帧序列：`@egret/engine/animation` 的 `createSequenceController` | 见[序列控制](sequence-controls.md)。[旧 MovieClip](legacy-movieclip-contract.md)介绍如何读取旧数据 |
| DragonBones | 不支持 | 支持 Spine：`@egret/spine`，JSON 或二进制。见 [Spine 支持](Spine动画支持需求与验收.md) |
| 粒子（`particle.GravityParticleSystem`） | `@egret/engine/particles` 的 `createParticleEmitter` | 见[粒子](particles.md) |

## 文本

| 白鹭 5 | 现在 | 说明 |
| --- | --- | --- |
| `new egret.TextField()`、`.text = ...` | `@egret/engine/text` 的 `createTextField(engine, scope, cache)`，然后 `field.setRequest({ ... })` 并 `await field.prepare()` | 文本先光栅化再显示；`@egret/engine/web/text` 提供页面的光栅化器 |
| `textFlow`、混合样式、换行 | `@egret/engine/paragraph` 的 `createParagraph` | 见[段落](paragraph-layout-controls.md) |
| `egret.BitmapText` | `@egret/engine/bitmapfont` 的 `createBitmapText` | 见[位图字体](bitmap-font.md) |
| `type = egret.TextFieldType.INPUT` | `@egret/engine/web/text-input` 的 `createBrowserTextInput` | 盖在舞台上的平台文本框 |

## UI、声音和其他

| 白鹭 5 | 现在 | 说明 |
| --- | --- | --- |
| `eui.Button`、`eui.ToggleButton`、`eui.HSlider`、`eui.Scroller`、`eui.List` | `@egret/engine/ui` 的控件：`createActionControl`、`createToggleControl`、`createRangeControl`、`createScrollControl`、列表 | 见 [UI 控件](ui-controls.md)。控件提供行为，外观由你绘制 |
| EXML 皮肤、`eui.Skin`、数据绑定 | 没有 | 用代码构建界面树 |
| 带 `HorizontalLayout`、`VerticalLayout` 的 `eui.Group` | `@egret/engine/layout` 的 `planLinearLayout` | |
| `eui.UILayer`、弹窗 | `createUiLayerManager` | 见 [UI 层](ui-layers.md) |
| `egret.Sound`、`SoundChannel` | `@egret/engine/audio` 的 `createAudioMixer`，由 `@egret/engine/web/audio` 的 `createBrowserAudio` 播放 | 见[音频](audio.md) |
| `egret.Video` | `createVideo` 和 `createBrowserVideo` | 见[视频](video.md) |
| `egret.HttpRequest`、`egret.ImageLoader` | 页面的 `fetch` | |
| `egret.ByteArray` | `ByteReader`、`ByteWriter` | |
| `egret.localStorage` | 页面的 `localStorage` | |
| `egret.WebSocket` | 页面的 `WebSocket` | |
| Tiled 地图（`tiled.TMXTilemap`） | `@egret/engine/tilemap` 的 `importTiledMap` 和 `createTileMap` | 见[瓦片地图](tilemap.md) |
| 物理（p2、Box2D 绑定） | `@egret/engine/physics2d` 的 `createPhysicsWorld` | 见[物理](physics-2d.md)。不是同一个求解器 |

## 一个界面的前后对比

白鹭 5：

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

现在：

```js
function createMenu(game, onStart) {
  const scope = game.engine.createScope(), menu = scope.use(new DisplayObjectContainer());
  const button = menu.addChild(scope.use(new Sprite()));
  button.graphics.beginFill(0x4a7bd0).drawRoundRect(0, 0, 160, 48, 16).endFill();
  button.touchEnabled = true;
  button.on(game.pointer.events.tap, onStart);
  game.engine.createTween(scope, { from: 1, to: 0.5, durationSeconds: 0.3, onUpdate: v => { button.alpha = v; } }).start();
  game.stage.addChild(menu);
  // 关闭界面：一次调用移除按钮、它的监听器和它的缓动。
  return () => scope.dispose();
}
```

第二段在第一段依赖全局对象的地方写明了 Engine，其中没有任何东西需要手工移除。
