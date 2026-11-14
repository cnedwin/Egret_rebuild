# 音乐与音效

[English](README.md) | 简体中文

同一时间只有一首音乐，音效叠加在音乐之上；两者各有自己的音量，并共同受总音量控制。页面一打开就请求播放音乐；浏览器在页面被触碰之前不允许发声，所以音乐会等待，在第一次点击或按键时开始。页面上的控件就是普通的网页控件：这个示例关注的是听到的声音。

示例里的声音由页面用正弦波生成，是游戏从文件加载的那种 WAV 字节。仓库里没有任何录音。

## 运行

构建各个包，以仓库根目录启动服务，然后打开页面：

```text
node tools/build.mjs
node tools/serve-canvas.mjs
```

记下服务器打印的主机和端口，在那里打开 `/examples/audio-mixer/index.html`。

## 可以试什么

- 打开页面后先等一等。文字下面的一行说明现在还没有声音。在任意位置点一下，或按任意键：音乐从头开始，用一秒钟渐入。
- **演武 / Drill** 让另一首音乐渐入，同时第一首渐出。音乐已经在播放时再按 **山门 / Gate** 不会有任何变化。**停止 / Stop** 让音乐渐出。
- 三个钟是同一个声音，分别在左边、中间和右边。它们叠加在音乐上，并且会自己结束。
- 快速连按 **点击声 / Tick**。它最多只占两个发声位：第三次按下会结束最早的那一个，所以这个声音不会自己叠成一片。
- 拖动某个音量，或把它静音。音乐和音效分别调节，总音量同时调节两者。刷新页面：音量保持上次留下的样子。
- **暂停 / Pause** 让一切静音，并让声音的时钟停住：恢复后音乐从原来的位置继续。暂停期间请求的钟声会被丢弃，不会留到以后再响。
- 切换到别的标签页，或把窗口最小化，然后再回来。页面隐藏期间是静音的。

## 工作方式

| 部分 | 来自 |
| --- | --- |
| 输出、第一次点击、隐藏的页面 | `@egret/engine/web/audio` 的 `createBrowserAudio` |
| 音量、发声位、音乐 | `audio.mixer`，也就是 `@egret/engine/audio` 的 `createAudioMixer` 在任何后端上创建的同一种混音器 |
| 一个声音 | `mixer.decode(bytes)`，传入一个已编码文件的字节 |
| 一个音效 | `mixer.play(sound, { pan, rate, maxInstances })` |
| 音乐 | `mixer.playMusic(sound, { fade })` 和 `mixer.stopMusic({ fade })` |
| 一个音量 | `mixer.bus('music').setVolume(value, { fade })`、`setMuted`，以及 `mixer.master` |
| 暂停 | `mixer.suspend()` 和 `mixer.resume()` |
| 说明页面是否在发声的那一行 | `mixer.subscribe` 和 `mixer.state` |
| 电平表 | 页面自己的 `AnalyserNode`，连接到 `audio.output` |
| 下次访问时的音量 | 页面的 `localStorage`；混音器自己不保存任何东西 |

参见[声音指南](../../knowledge-base/Cns/docs/audio.md)。

## 检查

```text
node examples/audio-mixer/verify.mjs <Playwright index.mjs 的绝对路径> <新的输出目录的绝对路径> [software]
```

验证脚本通过真实浏览器的自动化协议点击、轻触和按键，并读取页面对自身的描述。其中一个用例提前渲染并逐个样本测量：经过发声位、总线和总音量之后的电平，声像的左右两侧，渐入和渐出，循环，某个速率下的音高，从中途开始，一首音乐让位给下一首，静音，以及暂停。没有任何东西去听扬声器，也没有使用手机或平板。浏览器无法进入的用例会报告为 `NOT RUN` 并附上原因：没有窗口的浏览器会让页面一直可见，所以在那里“隐藏的页面”就是这样的用例。
