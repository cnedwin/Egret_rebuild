# 原版白鹭 5 图集与原生显示验证

这个示例使用原版 5.3.10 WebGL 和 Android Runtime 跑同一段业务代码。原版引擎、EUI、RES 和 game 模块由使用者从有权使用的发行包提供。示例自带游戏代码，构建时生成含两个区域的 PNG。

```sh
node runtime-sdk/examples/original5-atlas/prepare.mjs --modules <5.3.10-libs/modules> --out <新目录>
node runtime-sdk/examples/original5-atlas/prepare.mjs --modules <5.3.10-libs/modules> --out <另一个新目录> --nine-slice
```

用本地 HTTP 服务打开生成目录中的 `reference.html`，再将同一目录作为 `--project` 交给 [Android 播放器导出工具](https://github.com/cnedwin/Egret_rebuild/blob/main/runtime-sdk/android/README.zh-CN.md)。默认场景中，点击圆形 Shape 或 EUI 图片会切换图集区域和双色标签。切后台、重开应用后均可恢复画面。[Fold7 记录](https://github.com/cnedwin/Egret_rebuild/blob/main/runtime-sdk/measurements/fold7-original5-atlas.json) 包含与原版浏览器的像素对照、文字覆盖、未命中触控、恢复与纹理回收数据。

九宫格场景从普通图片开始。依次点击黄色矩形五次，可观察 44 × 32 面板、比边角还小的 3 × 3 面板、替换图集区域、清除九宫格及仍在显示时释放图集。浏览器使用 1236 × 824 视口、设备像素比 1，打开 `reference-fold7.html` 即可匹配手机上的显示尺寸。在对应逻辑像素中心采集的 779 个 RGB 样本完全一致。另用 192 × 128 参考图对照时，3 × 3 面板有四个边缘像素不同。[九宫格记录](https://github.com/cnedwin/Egret_rebuild/blob/main/runtime-sdk/measurements/fold7-original5-nine-slice.json) 保留了两组结果。

原版 5.x 位图布局负责选择采样区域和目标矩形，Runtime 将这些区域合成一个带索引的网格，复用已有纹理页。图集释放后，仍在舞台上的图片消失，纹理页也被回收。此次实测范围为轴对齐图集、模拟点击和记录中的设备。

## 原版 5.3 各发行标签对照

Windows Edge 158 分别运行了 5.3.1、5.3.2 及 5.3.5 至 5.3.10 的原版 WebGL 宿主。Galaxy Z Fold7 上的 Android 播放器为每个标签另起应用进程，使用同一份原引擎、EUI、RES 和棋盘脚本。八个标签在开场和点击 EUI 图片后各取五个 RGB 样本，均与对应的浏览器结果一致。每次点击只推进一步。正常关闭前后，每次共上传四次，其中一次替换已有页，显式释放三页，最终驻留页和遗弃上下文均为零。

Android 调试包使用裁剪 V8 和 GLES3，点击由工具注入实体手机。记录保留了各标签的提交、脚本摘要和取样位置。此项对照覆盖指定采样点；5.3.3、5.3.4、全画面逐像素比较、真人操作和线上渠道 SDK 仍需另外验证。[逐版本测量记录](https://github.com/cnedwin/Egret_rebuild/blob/main/runtime-sdk/measurements/fold7-original5-family.json)
