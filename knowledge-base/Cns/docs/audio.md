# 2D 游戏的声音

[English](../../en/docs/audio.md) | 简体中文

`@egret/engine/audio` 是一个混音器：声音、播放声音的发声位、同一时间只有一首的音乐，以及总音量之下若干个有名字的音量。它不依赖 DOM，自己不发出任何声音；发声的是后端。`@egret/engine/web/audio` 是网页上的后端，基于 Web Audio。两者都是可选入口：不导入它们的游戏不会加载其中任何代码。

**验证了什么，没有验证什么。** 混音器和适配器在 Node 中验证，示例在无头 Chromium 中验证，并测量了浏览器渲染出的样本。没有任何东西去听扬声器，也没有运行手机、平板、Safari 或 Firefox。见[实际运行了什么](#实际运行了什么)。

## 在网页上

```js
import { createBrowserAudio } from '@egret/engine/web/audio';

const audio = scope.use(createBrowserAudio({ buses: [{ name: 'music', volume: 0.6 }, 'effects'] }));
const mixer = audio.mixer;
const bytes = async url => new Uint8Array(await (await fetch(url)).arrayBuffer());
const click = await mixer.decode(await bytes('click.wav'));   // 短：解码进内存
const theme = await mixer.stream('music/theme.ogg');          // 长：边读边播

mixer.playMusic(theme, { fade: 1 });      // 页面还不能发声时，会等到第一次点击
button.onActivate = () => mixer.play(click, { maxInstances: 2 });
```

`createBrowserAudio` 会创建一个 `AudioContext`；如果通过 `context` 传入了一个，就使用它，并且不会关闭它。它返回 `mixer`、`context`、`output`（所有声音输出前都会经过的节点，页面自己的分析器可以接在这里）和 `dispose()`。

适配器不会为 `decode` 发起任何网络请求：游戏按读取其他文件的方式读取声音文件的字节，再交给它。只有流需要给出地址，因为那个文件是浏览器自己读取的。

**第一次点击。** 浏览器只在用户触碰过页面之后才允许页面发声。在那之前 `mixer.state` 是 `'locked'`。适配器在 document 上（或在 `unlockTarget` 上）监听 `pointerdown`、`pointerup`、`touchend`、`keydown` 和 `click`，并在其中第一个事件里请求输出开始。输出运行起来后，状态变为 `'running'`，监听器随即移除。之后如果系统把输出收走（例如手机来电），混音器会再次锁定，直到输出恢复，或下一次点击把它带回来。

**隐藏的页面**是静音的：`document.visibilityState` 为 `'hidden'` 期间，适配器以 `'hidden'` 这个名字请求静音。`pauseWhenHidden: false` 可以关闭这一行为。

在无法返回结果的地方发生的失败（页面的监听器里，或请求输出开始、停止之后）会交给 `onError`；没有提供时交给页面的 `reportError`。

## 声音

`mixer.decode(bytes)` 接收一个已编码文件的字节（`Uint8Array` 或 `ArrayBuffer`），完成时得到一个整体解码的声音。这些字节仍然属于调用方，并且不会被改动。能解码哪些格式由浏览器决定：WAV、MP3 和 MP4 中的 AAC 在所有当前浏览器中都能解码，Ogg Vorbis 和 Opus 在大多数浏览器中可以。

一个声音就是内存中已解码的样本。`sound.decodedBytes` 是它的计量值：秒数 × 采样率 × 声道数 × 4。44.1 kHz 的三分钟立体声约为 63.5 MB。混音器最多持有 `maxDecodedBytes`（默认 128 MiB）和 `maxSounds`（默认 256）；会超出任何一项的解码都会被拒绝，样本也会被归还。短的、需要立刻开始或无缝循环的声音用解码；长音乐[以流的方式播放](#以流的方式播放长音乐)；场景不再需要的声音要释放。

### 以流的方式播放长音乐

```js
const theme = await mixer.stream('music/theme.ogg');
mixer.playMusic(theme, { fade: 1 });
```

`mixer.stream(url)` 打开一个边读边播的文件。文件给出自己的时长之后，它以一个声音完成。这样的声音带有 `streamed`，不占用已解码样本的预算，播放、渐变、暂停、声像和音量调节都和其他声音一样。

不同之处：

- **只有一个位置。** 流只在一个位置被读取，所以同一时间只有一个发声位：它的新发声位会让之前的那个以 `'stolen'` 结束，即使那是音乐。重新开始同一个流时，无法从它自己渐变过来。
- **位置以文件为准。** `voice.position` 是浏览器在文件中的位置。流的循环处可能有一小段空隙，已解码的循环则没有；必须无缝循环的音乐应当解码。
- **其他来源。** 文件以 `crossOrigin = 'anonymous'` 请求。来自其他来源的文件必须带有允许这样做的响应头，否则会被拒绝。
- **它自己的锁。** 即使输出已经在运行，浏览器也可能拒绝在触碰之外启动媒体元素。这时发声位会等待，适配器重新监听触碰，下一次触碰会让它开始。

在网页上，流是一个被接入音频图的 `<audio>` 元素。输出挂起并不会让媒体元素自己停下，所以只要输出不在运行，适配器就暂停它，输出运行时再播放：游戏暂停或页面隐藏时，它会停在原来的位置。渐出按输出的时钟结束，和已解码的发声位一样。

后端没有 `openStream` 的宿主会以 `AUDIO_STREAM_UNSUPPORTED` 拒绝。提前渲染的输出没有这个能力。

### 释放

`sound.release()` 结束这个声音的所有发声位并归还样本；对于流，则是放开它的文件。声音可以归某个 scope 所有：`sceneScope.use(await mixer.decode(bytes))` 会在场景的 scope 被销毁时释放它。

## 音效

```js
const voice = mixer.play(sound, { bus: 'effects', volume: 0.8, rate: 1.2, pan: -0.5, loop: false, offset: 0, fadeIn: 0, maxInstances: 2 });
voice.setVolume(0.4, { fade: 0.3 });
voice.stop({ fade: 0.2 });
const reason = await voice.ended;         // 'finished'、'stopped'、'stolen'、'limit'、'silent'、'released' 或 'closed'
```

| 选项 | 含义 | 默认值 |
| --- | --- | --- |
| `bus` | 这个发声位所属的有名字的音量 | 混音器有 `'effects'` 时用它，否则用第一个总线 |
| `volume` | 0 到 1 | 1 |
| `rate` | 速度和音高一起变化，0.25 到 4 | 1 |
| `pan` | 左右平衡。-1 时只听到左侧，1 时只听到右侧；偏向一侧时另一侧按直线减弱。0 时声音保持原样 | 0 |
| `loop` | 到结尾后从头再来 | `false` |
| `offset` | 从声音的第几秒开始，小于它的时长 | 0 |
| `fadeIn` | 从无声升起所用的秒数，最多 60 | 0 |
| `maxInstances` | 这个声音最多同时有这么多个发声位；最早的那个让位 | 无 |
| `whileSilent` | 听不到声音时：`'drop'` 立刻结束这个发声位；`'start'` 照常开始，等输出恢复运行时就能听到 | `'drop'` |

发声位有 `state`（`'playing'`、`'paused'`、渐出期间的 `'stopping'`、`'ended'`）、`endReason`、按输出时钟计算的秒数 `position`，以及 `setVolume`、`setRate`、`setPan`、`pause()`、`resume()` 和 `stop()`。`ended` 是一个 promise，以结束原因完成，永远不会被拒绝。对已经结束的发声位做的任何请求都不起作用。

音量从不跳变。不指定渐变时，它在五毫秒内变化：短到听不出是渐变，又长到不会产生爆音。

## 音乐

```js
mixer.playMusic(battle, { fade: 1.5 });   // 之前的音乐在同样的时间内渐出
mixer.stopMusic({ fade: 1 });
```

音乐只有一首。`playMusic` 在 `'music'` 总线上把这个声音作为循环开始播放，用 `fade` 的时间渐入，并用同样的时间让之前的音乐渐出。如果请求的声音已经是当前音乐，除了给出的音量之外什么都不变，所以场景可以在每次进入时都请求自己的音乐；`restart: true` 会让它从头开始。可以使用 `loop: false`、`volume`、`offset` 和 `bus`；不接受速率、声像和发声位数量。`mixer.music` 是当前作为音乐的发声位，直到它被停止或结束。

听不到声音时请求的音乐照样会开始，等输出运行时从头听到：页面一打开就请求的音乐，就是这样随第一次点击开始的。

## 音量

```js
mixer.bus('music').setVolume(0.5, { fade: 0.3 });
mixer.bus('effects').setMuted(true);
mixer.master.setVolume(0.8);
```

`buses` 给出总音量之下各个音量的名字：可以只写名字，也可以写名字加上起始的 `volume` 和 `muted`。不提供时有 `'music'` 和 `'effects'`。最多可以有十六个；`'master'` 这个名字已被占用。被静音的总线会保留自己的音量，等到再次出声时使用。

混音器不会在两次访问之间保存任何东西。让用户选择音量的游戏要自己保存，并在下次以 `volume`、`muted` 和 `buses` 传回来，示例就是这样做的。

## 静音

| `mixer.state` | 含义 |
| --- | --- |
| `'running'` | 有声音输出 |
| `'locked'` | 宿主还没有允许输出开始。它优先于 `'suspended'` |
| `'suspended'` | 有人请求了静音 |
| `'closed'` | 混音器已被销毁 |

`mixer.suspend(reason)` 以某个名字请求静音，`mixer.resume(reason)` 撤回这个请求；不给名字时是 `'game'`。所有请求过的名字都撤回之后声音才会回来，所以在隐藏的页面上被暂停的游戏，页面重新显示时仍然保持静音。挂起期间输出的时钟停住：每个发声位都会从原来的位置继续。

`mixer.subscribe(listener)` 会告知每一个新状态；`mixer.snapshot()` 是一份冻结的快照：状态、`locked`、`suspendedBy`、各个音量，以及发声位、声音和已解码字节的数量，已开始的发声位数量，和因为听不到、因为腾不出位置或因为让位而被丢弃的发声位数量。

## 上限

同一时间最多有 `maxVoices` 个尚未结束的发声位（默认 32，最多 256）。位置全部占满时，最早的那个既不是循环也不是音乐的发声位让位，并以 `'stolen'` 结束。没有这样的发声位时，新的发声位立刻以 `'limit'` 结束。`maxInstances` 在同一个声音的发声位之间做同样的事，循环也会让位，音乐永远不会。

## 所有权

`mixer.dispose()` 结束所有发声位、释放所有声音并关闭后端。`scope.use(mixer)`（在网页上是 `scope.use(audio)`）把这件事交给引擎的某个 scope。在那之后，会开始某件事的调用抛出 `AUDIO_CLOSED`，会让某件事安静下来的调用什么都不做。

## 其他宿主

`createAudioMixer({ backend, ... })` 接受任何实现了 `AudioBackend` 的对象：一个以秒为单位、在输出挂起期间停住的时钟，以及 `decode`、`createBus`、`start`、`suspend`、`resume` 和 `close`。`openStream` 是可选的；发声位的 `position` 也是可选的，供比时钟更清楚声音位置的宿主使用。不是网页的宿主写出这些，就能使用同一个混音器。宿主通过 `locked: true` 和 `mixer.setLocked(...)` 说明自己是否允许输出开始。

## 错误

所有错误都是 `EgretError`，带有以下代码之一。

| 代码 | 何时出现 |
| --- | --- |
| `AUDIO_OPTIONS_INVALID` | 混音器、总线、音量或渐变的某个选项不在允许范围内 |
| `AUDIO_PLAY_OPTIONS` | `play` 或 `playMusic` 的某个选项不在允许范围内 |
| `AUDIO_BUS_UNKNOWN` | 没有这个名字的总线 |
| `AUDIO_BYTES_INVALID` | 没有给 `decode` 任何字节 |
| `AUDIO_DECODE_FAILED` | 后端无法解码这些字节；`cause` 是它给出的原因 |
| `AUDIO_URL_INVALID` | 没有给 `stream` 地址，或者地址超过 4096 个字符 |
| `AUDIO_STREAM_UNSUPPORTED` | 后端不能边读边播一个文件 |
| `AUDIO_STREAM_FAILED` | 文件无法打开；`cause` 是后端给出的原因 |
| `AUDIO_BUDGET`、`AUDIO_SOUND_LIMIT` | 已解码的样本或声音的数量会超过混音器可以持有的量 |
| `AUDIO_SOUND_INVALID`、`AUDIO_SOUND_RELEASED` | 这个值不是本混音器的声音，或者是已经释放的声音 |
| `AUDIO_REASON_INVALID`、`AUDIO_REASON_LIMIT` | 请求静音的名字不是 1 到 32 个字符的字符串，或者已经有八个名字在请求 |
| `AUDIO_BACKEND_FAILED` | 后端抛出了错误，或返回了不符合要求的东西；`cause` 是它抛出的内容 |
| `AUDIO_LISTENER_FAILED` | 交给 `subscribe` 的某个监听器抛出了错误。状态已经改变，其他监听器也都先被告知了 |
| `AUDIO_CLEANUP_FAILED` | 销毁过程中有东西失败了。其余的仍然都已放开；`cleanupErrors` 里是其余的失败 |
| `AUDIO_CLOSED` | 混音器已被销毁 |
| `AUDIO_HOST_UNAVAILABLE` | 页面没有 `AudioContext`，也没有传入一个 |

## 实际运行了什么

| 内容 | 环境 | 结果 |
| --- | --- | --- |
| 用一个记录请求的后端验证混音器，以及真实引擎的 scope 拥有一个混音器和一个声音 | Node，[`tests/audio-mixer.test.mjs`](https://github.com/cnedwin/Egret_rebuild/blob/main/tests/audio-mixer.test.mjs) | 37 个用例 |
| 用替身页面和替身输出验证 Web Audio 适配器，用于流的页面媒体元素，两个入口的严格 TypeScript 使用方（含十一处被拒绝的误用），以及两个入口的导出 | Node，[`tests/browser-audio.test.mjs`](https://github.com/cnedwin/Egret_rebuild/blob/main/tests/browser-audio.test.mjs) | 31 个用例 |
| 把两个模块中的每个比较、布尔和逻辑运算符逐个改掉 | Node | 314 处改动，309 处被发现。剩下的 5 处不会改变任何可观察的行为：从未开始的发声位没有什么可以静音的；恰好在音量直线的端点读取时，两种写法得到的值相同 |
| [示例](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/audio-mixer/README.zh-CN.md)：第一次点击、按键或轻触之前保持锁定；音效叠加在音乐上；同一个声音只占两个发声位；能听出音量和静音的变化；一首音乐让位给下一首；游戏暂停；以流播放的长音乐以渐变接替、被按住、随游戏暂停而停住并渐出停止；等待第一次点击的流；音量保留到下次访问；手机配置 | 无头 Chromium 153 | 10 个场景 |
| 提前渲染并逐个样本测量：经过发声位、总线和总音量之后的电平；声像的左右两侧，包括播放中改变；渐入和渐出；循环；两种速率下的音高；从中途开始；一首音乐让位给下一首；总线的静音和渐变；暂停 | 无头 Chromium 153，`OfflineAudioContext` | 1 个场景，57 项检查 |
| 隐藏的页面 | 无头 Chromium 153 | 未运行：没有窗口的浏览器会让页面一直可见。适配器这一部分已用替身页面覆盖 |
| 人从扬声器里实际听到的声音；手机或平板；Safari 和 Firefox；输出被来电收走；其他来源的流；WAV 以外的格式 | — | 未运行 |

锁定的检查明确指定了普通浏览器的策略（`--autoplay-policy=document-user-activation-required`），并且由页面之外的时钟给页面留出启动时间，因为这个浏览器会把自动化协议发来的询问算作一次触碰。

## 不在本次范围内

- **手机上的流。** 在 iOS 和 Android 上媒体元素是否随第一次触碰开始，以及来电之后的表现，都没有运行过。
- **资源清单中的声音。** 声音的字节由游戏自己读取；清单及其字节来源还不认识声音文件。
- **空间位置。** 2D 的声像是左右两侧之间的平衡。World3D 有自己的监听者和定位声音。
- 总线上的效果（如混响或滤波）、语音播放时压低音乐、一个文件里放多个声音，以及录音。
- **其他宿主。** 目前只有网页的后端。小游戏宿主需要自己的后端。
