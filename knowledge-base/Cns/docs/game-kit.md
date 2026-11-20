# 游戏工具包：动作、存档、随机数、音效提示、资源包和触屏控件

[English](../../en/docs/game-kit.md) | 简体中文

大多数游戏在规则之外都需要同样几样小东西：按动作而不是按键读取输入、新版本也能读的存档、可以复现的随机数、听起来不机械的音效，以及触屏上的控件。`@egret/engine/kit` 提供不需要页面的部分，`@egret/engine/web/kit` 从页面为它们提供输入。

**验证了什么、没验证什么。** 两部分都在 Node 中验证，浏览器部分用替身事件目标、手柄和存储。在无头 Chromium 中：通过自动化协议按下的按键驱动了一个按钮和长度为 1 的斜向向量，页面没有滚动；用 `encodeWav` 合成的一声点击由 Web Audio 解码，经音效提示和限幅器在离线输出中播放，峰值 0.26；资源包按字节范围读回；存档写入了页面存储。另一次运行中，8 MB 的存档写入 IndexedDB，重新打开后读回；读过一次的资源包条目在网络被拒绝时从 Cache API 再次读出。没有在手机、Safari 和实体手柄上运行。

## 按动作读取输入

```js
import { createInputActions } from '@egret/engine/kit';
import { bindBrowserInputActions, createTouchButton, createTouchStick } from '@egret/engine/web/kit';

const input = createInputActions({
  jump: { bindings: ['Key:Space', 'Pad:a', 'Touch:jump'] },
  fire: { bindings: ['Mouse:0', 'Pad:rightTrigger'] },
  move: { kind: 'vector', up: ['Key:KeyW'], down: ['Key:KeyS'], left: ['Key:KeyA'], right: ['Key:KeyD'], sticks: ['Pad:leftStick', 'Touch:stick'] },
});
const page = bindBrowserInputActions(input, { pointerTarget: canvas });
createTouchStick(touchLayer, input);
createTouchButton(jumpButton, input, 'Touch:jump');

function frame(seconds) {
  page.poll();                       // 读取手柄
  const { x, y } = input.vector('move');
  if (input.justPressed('jump')) hero.jump();
  input.endFrame();
}
```

绑定是一段短字符串：`Key:` 加 `KeyboardEvent.code`，`Mouse:` 加按钮编号，`Pad:` 加标准按钮名或编号，`Pad:leftStick`、`Pad:rightStick` 表示整个摇杆，`Pad:leftStickX+` 表示一个轴的一半，`Touch:` 表示屏幕上的控件。

| 类型 | 读取方式 | 绑定 |
| --- | --- | --- |
| `button`（默认） | `pressed`、`justPressed`、`justReleased` | `bindings` |
| `axis` | `value`，从 -1 到 1 | `negative`、`positive` |
| `vector` | `vector`，长度不超过 1，y 向下 | `up`、`down`、`left`、`right`、`sticks` |

同时按住两个方向键得到长度为 1 的向量，所以斜着走不会更快。摇杆的死区（默认 0.2）被去掉，其余部分拉伸，所以轻推从零开始。模拟扳机超过一半算按下。

页面绑定在窗口失去焦点或页面隐藏时松开所有控件；阻止已绑定的按键滚动页面；玩家在输入框里打字时不处理按键。`dispose()` 移除所有监听。

**焦点控件已经用掉的键。** 游戏的键盘输入把按键交给拥有焦点的控件——空格按下焦点按钮，方向键调节焦点滑条——并在按键到达窗口之前用 `preventDefault` 标记它。给 `bindBrowserInputActions(input, { skipPrevented: true })` 后，这样的键不会再触发动作：焦点在按钮上时空格不会同时"发射"，焦点在滑条上时方向键不会同时"转向"。默认关闭。

鼠标可以同时按住多个键。例如，按住右键（`Mouse:2`）瞄准时，可以单独按下和松开左键（`Mouse:0`）射击，瞄准会一直保持。每个键从绑定区域内按下，在同一窗口内移出该区域再松开，也能结束对应动作。

## 改键

`input.rebind(action, binding, { slot, index })` 把一个控件放到某个动作上，并从其他动作上移除，所以一个键不会同时做两件事。`input.lastPressed` 给出这一帧按下的控件，供“请按一个键”的界面使用；`describeInputBinding(binding)` 给出可读的名字（`W`、`Shift`、`Right button`）。`saveBindings()` 以普通数据返回与默认映射不同的部分；`loadBindings(data)` 应用它，跳过未知动作和格式不对的条目；`resetBindings()` 恢复默认映射。

## 存档

```js
import { createSaveStore } from '@egret/engine/kit';
import { browserSaveStorage } from '@egret/engine/web/kit';

const save = createSaveStore({
  key: 'snow-temple',
  version: 3,
  defaults: () => ({ tier: 1, best: {}, settings: { quality: 'auto' } }),
  migrations: {
    1: old => ({ tier: old.level, best: {} }),
    2: old => ({ ...old, settings: { quality: 'auto' } }),
  },
  storage: browserSaveStorage(),
  onProblem: problem => console.warn(problem.kind),
});
save.update(data => { data.tier = 2; });
```

存档保存为 `{ version, savedAt, data }`。旧存档逐步升级并写回。读不出、没通过 `validate`、比当前版本新，或比最早的升级步骤还旧的存档，从 `defaults` 重新开始，原文保存在 `<key>.unread` 下，不会丢失。存储拒绝写入（例如已满）时返回 `false` 并报告给 `onProblem`，不会抛出异常。`export()` 和 `import(text)` 用于手动导出导入。

**`update(change)`** 要么原地修改数据、不返回值，要么返回新数据。返回的值必须通过 `validate`（默认要求是对象），原地修改后的数据也一样；不通过时什么也不写入，内存里的存档保持原样，返回 `false`，并以 `invalid` 报告给 `onProblem`。请把修改写成块体：`data => (data.tier = 2)` 这样的箭头函数会返回 `2`，会被拒绝。`save(next)` 对 `next` 做同样的检查。修改是在副本上做的，副本通过检查后才成为存档数据，所以被拒绝的修改、或中途抛错的修改，都不会改动内存里的存档；每次 update 之后 `save.data` 是一个新对象，请重新读取，不要留着旧的引用。

`browserSaveStorage()` 是页面的本地存储；页面没有可用存储时（无痕窗口、被屏蔽的站点）改用内存，`persistent` 说明是哪一种。`createMemorySaveStorage()` 是供测试使用的同类存储。

## 可以复现的随机数

```js
import { createRandom } from '@egret/engine/kit';

const dice = createRandom(seed);       // 数字或字符串
const loot = dice.fork();              // 独立的序列，不受 dice 之后的抽取影响
dice.int(1, 6); dice.range(0, 1); dice.chance(0.25); dice.pick(items); dice.weighted(items, weights); dice.shuffle(items); dice.normal(10, 2);
const saved = dice.state();            // createRandom(saved) 从这里继续
```

同一个种子在任何引擎和设备上都给出同样的数。生成器是 sfc32：速度快，适合游戏，不能用于加密。

## 按名字播放音效

```js
import { createAudioCues, encodeWav } from '@egret/engine/kit';
import { createBrowserAudio } from '@egret/engine/web/audio';

const audio = createBrowserAudio({ limiter: true });
const steps = await Promise.all(stepTakes.map(bytes => audio.mixer.decode(bytes)));
const cues = createAudioCues(audio.mixer, {
  step: { sounds: steps, rate: [0.92, 1.08], volume: [0.6, 0.8], cooldown: 0.06, maxVoices: 3 },
  hit: { sounds: hits, rate: [0.95, 1.05], maxVoices: 4 },
});
cues.play('step', { volume: 1 - distance / 30, pan: side });
```

一个音效提示每次从几段录音中选一段，不会连续两次选同一段，并在给定范围内选取音量和速率。在 `cooldown` 之内的播放会被跳过。超过 `maxVoices` 时，这个提示最早的声音淡出让位。`createBrowserAudio({ limiter: true })` 在总音量和扬声器之间加一个温和的限幅器，许多声音同时响时不会削波；传对象可自行设置 `threshold`、`knee`、`ratio`、`attack` 和 `release`。

用代码合成声音的游戏，为每个声道填一个 `Float32Array`，再调用 `encodeWav(channels, sampleRate)`。得到的 16 位 WAV 字节像普通文件一样交给 `mixer.decode`，所以合成的声音和录制的声音共用同样的总线、音效提示和限幅器。

## 资源包

一个关卡的模型、图片和声音可以合成一个文件传输。服务器支持字节范围请求时只取需要的部分；不支持时，整个文件只取一次。

```js
// 构建脚本中（Node）
import { writeAssetBundle } from '@egret/engine/kit';
const file = writeAssetBundle([
  { name: 'models/hero-high.glb', bytes: heroHigh, type: 'model/gltf-binary', tags: ['hero', 'high'] },
  { name: 'models/hero-low.glb', bytes: heroLow, type: 'model/gltf-binary', tags: ['hero', 'low'] },
]);

// 游戏中
import { openBrowserAssetBundle } from '@egret/engine/web/kit';
const bundle = await openBrowserAssetBundle('assets/level1.pack');
const wanted = bundle.entries('hero', quality).map(entry => entry.name);
const files = await bundle.read(wanted);
```

文件由 12 字节的文件头、记录名称、偏移、大小、类型、标签和校验值的 JSON 索引，以及依次排列的各条目组成，每个条目从 4 字节的整数倍处开始。打开时先请求前 64 KB，索引更长时再请求一次。`read` 取回指定条目，相距不到 64 KB 的条目合并为一次请求，并逐个按索引校验。`bundle.ranged` 说明服务器是否响应了范围请求，`bundle.transferred` 给出已传输的字节数。游戏手头已有字节时，可用 `readAssetBundleIndex`、`sliceAssetBundle` 和 `planAssetBundleRanges` 做同样的处理。

## 按画质选择模型

```js
import { pickQualityFiles, pickQualityVariant } from '@egret/engine/kit';

const hero = pickQualityVariant({ low: 'hero-low.glb', high: 'hero-high.glb' }, app.quality);  // medium 取 low
const wanted = pickQualityFiles(bundle.index.entries.map(e => e.name), app.quality);
```

`pickQualityVariant` 取所要的档位；没有时取下面最近的一档，再没有时取上面最近的一档。`pickQualityFiles` 把形如 `<名称>-<档位>.<扩展名>` 的名称分组，每组按画质只保留一个，没有档位的名称原样保留；所以带有 `hero-high.glb`、`hero-medium.glb` 和 `hero-low.glb` 的资源包或目录只会加载一个主角。`createWorld3DApp` 的 `app.quality` 就是档位名。

## 不开页面跑整局规则

```js
import { runHeadless } from '@egret/engine/kit';

const runs = runHeadless({
  createGame: seed => createGame({ seed }),
  createPlayer: (game, seed) => createBot(game, { seed }).think,
  done: game => game.state === 'won' || game.state === 'dead',
  seeds: 8,
  summary: game => ({ state: game.state, time: Math.round(game.t), kills: game.stats.kills }),
});
console.table(runs.map(run => ({ seed: run.seed, ...run.summary, ms: run.averageMs.toFixed(3) })));
```

每个种子一局新游戏和一个代打玩家，按 `step` 秒一步（默认 1/60）一直跑到 `done` 或 `maxSeconds`（默认 1,200）。每局报告是否结束、游戏秒数、步数、每步的平均与最慢毫秒数，以及游戏的 `summary`。规则与画面分开，再配合 `vendor/node-register.mjs`，整局游戏就可以在 Node 里测试和调数值。

## 大存档与离线游玩

`openIndexedDBSaveStorage({ database })` 是基于 IndexedDB 的存档存储，用于本地存储放不下的大存档。打开时把所有存档字符串读入内存，所以 `createSaveStore` 用它和用本地存储一样；每次写入立即进内存，随后写入数据库。`flush()` 等待写入完成；数据库拒绝的写入会告诉 `onError`，并在下一次写入时报错。

`openBrowserBundleCache(name)` 用 Cache API 保存资源包的索引和读过的每个条目，传给 `openBrowserAssetBundle(url, { cache })` 即可。条目按资源包地址和校验值保存，所以重新构建的资源包不会读到旧字节。资源包取不到时，已保存的索引仍能打开它，`bundle.offline` 为 true，已保存的条目照常读取。`cache.prune(keep)` 清除其他地址的条目。

## 把引擎拷贝进游戏

不用包管理器发布的游戏目录，需要带上它加载的那部分引擎。在已构建的引擎仓库中运行：

```
node tools/vendor-game.mjs ../MyGame @egret/engine @egret/engine/webgl2/world3d @egret/engine/kit @egret/engine/web/kit
```

只有这些入口直接或间接导入的 JavaScript 文件会被拷贝到 `../MyGame/vendor`，同时带上引擎的许可证和每个第三方包自己的许可证。源码映射注释被去掉，代码本身不变。一同生成的文件：

| 文件 | 用途 |
| --- | --- |
| `vendor/importmap.json` | 页面的 import map，粘贴进去即可 |
| `vendor/importmap.js` | 一个普通的 `<script src>`，加入同样的映射，适合不想粘贴的页面 |
| `vendor/node-register.mjs` | `node --import ./vendor/node-register.mjs rules.test.mjs`：游戏的规则和测试在 Node 中用与页面相同的名字运行 |
| `vendor/SOURCE.md` | 记录生成时的提交和入口 |

再运行一次会刷新拷贝，并移除已不被任何入口需要的文件。

## 错误

| 错误码 | 含义 |
| --- | --- |
| `INPUT_ACTIONS_INVALID` | 映射、绑定、槽位或数值格式不对，或动作不存在 |
| `SAVE_STORE_OPTIONS_INVALID` | 缺少 key、version、defaults 或 storage |
| `RANDOM_SEED_INVALID` | 种子不是有限数字、字符串或四个字 |
| `RANDOM_RANGE_INVALID` | 空列表、颠倒的范围或无效的权重 |
| `AUDIO_CUES_INVALID` | 提示没有声音、范围越界，或提示不存在 |
| `ASSET_BUNDLE_INVALID` | 名称不对、重复，或字节不是 `Uint8Array` |
| `ASSET_BUNDLE_FORMAT_INVALID` | 不是资源包，或索引损坏 |
| `ASSET_BUNDLE_ENTRY_MISSING` | 没有这个名称的条目 |
| `ASSET_BUNDLE_CHECK_FAILED` | 条目字节与校验值不符 |
| `ASSET_BUNDLE_RANGE_INVALID` | 服务器返回的范围与请求不同 |
| `ASSET_BUNDLE_FETCH_FAILED` | 服务器返回错误；`cause` 中有状态码 |
| `QUALITY_VARIANT_INVALID`、`QUALITY_VARIANT_MISSING` | 档位不是 low、medium 或 high；一个变体也没有 |
| `HEADLESS_RUN_INVALID` | 缺少函数，或步长、上限、种子列表不对 |
| `BROWSER_STORAGE_UNAVAILABLE`、`BROWSER_STORAGE_WRITE_FAILED`、`BROWSER_STORAGE_CLOSED` | 没有 IndexedDB；数据库拒绝了写入；`close` 之后还在写 |
| `AUDIO_WAV_INVALID` | 声道长度不一、没有采样，或采样率超出范围 |
