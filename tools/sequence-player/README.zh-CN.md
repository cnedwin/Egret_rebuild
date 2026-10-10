# 公共 SequencePlayer 不透明像素浏览器验证器

[English](README.md) | 简体中文

本第一方工具把既有不透明 Bitmap collector 投影为公共 [SequencePlayer 合同](../../knowledge-base/Cns/docs/显式时间序列播放器契约.md) 的验证器。它使用 root 公共入口的 `egret.createSequenceClip` 和 `egret.SequencePlayer`，以及选定的 `/web` 或 `/webgpu` 公共宿主入口，不导入私有 sampler，也不手工赋值 Bitmap 裁剪区域。另行审阅的公共播放器新观察及其确切源码身份见[契约验收段](../../knowledge-base/Cns/docs/显式时间序列播放器契约.md#已记录验收--2026-10-10)；此前 Bitmap 证据保持为独立前置验证。

## 前置条件与命令

使用已安装的 Node.js 24.19.0、Playwright 及相邻 playwright-core 1.62.1、标准安装的 Microsoft Edge，以及仓库固定依赖。collector 不安装依赖、不下载文件。先在仓库根目录运行 `node tools/build.mjs` 构建当前源码；依赖准备见[仓库指南](../../README.zh-CN.md)。

在仓库根目录执行：

```text
node tools/sequence-player/collector.mjs --playwright <installed module> --channel msedge --output <fresh output directory>
```

两个路径占位符都须替换为绝对路径；包含空格时加引号。`--playwright` 指定已安装的 `playwright` 包目录，相邻目录须为 `playwright-core`。输出父目录须已存在，候选目录须尚不存在，并且位于仓库与两个已安装模块根目录之外。每次尝试使用新目录，不能覆盖旧结果。

collector 保留原 Windows x64 / Node.js 24.19.0 / Playwright 1.62.1 准入范围和标准 Edge 可执行文件位置。它以默认选项无头启动已安装的 `msedge`，不增加 flags。每次尝试记录实际浏览器版本、OS release 与 WebGPU adapter 观察。该固定环境范围不能推广为可移植或全设备验收。已记录的公共播放器原生尝试只验收当时设备配置下的固定不透明子集；运行时的阅读文件身份与后续仅阅读变更保持区分。

## 固定观察范围

使用字面定义的 6×2 不透明图集：红色 2×2、绿色 1×2、蓝色 3×1。once 播放器在实际 Bitmap 上准确应用 0、0.125、0.375 秒，随后先 dispose 播放器，再执行调用方所有的 Bitmap／lease／Texture／Engine 退役。播放器 dispose 须保持 Bitmap 存活、原精确 lease 仍有权读取，并保持 `lastSample` 与缓存的不可变返回 sample 为同一对象。另一兼容宿主回放保存的红帧，不重新采样、不重新捕获。

每后端提交四份 8×4、DPR 1 帧：合计八帧、256 像素、1,024 次原始通道比较。[oracle.mjs](oracle.mjs) 保留独立字面坐标／RGBA 期望与零容差。不透明内部像素与透明清屏背景属于本子集；部分透明混合、插值、性能、物理显示、硬件加速、生产设备与完整 A2 均未证明。

采用的[文件图](file-graph.mjs)、像素 oracle 与 [console policy](console-policy.mjs) 保留原字节及算法。collector 启动前绑定七份公共工具源码／阅读文件、已安装依赖以及选定源码／构建／runtime 输入，启动前保存 oracle，采集后复查全部选定输入身份。它保留原始 `.rgba`、元数据、请求、事件、宿主／device 清理与明确结果。缺失播放器证明、身份变化、预算超限、意外故障或不安全清理均阻止完成。

只有 Canvas 后端、warning 级别且全文准确等于以下文字才是 advisory：

```text
Canvas2D: Multiple readback operations using getImageData are faster with the willReadFrequently attribute set to true. See: https://html.spec.whatwg.org/multipage/canvas.html#concept-canvas-will-read-frequently
```

分类先对全文做精确相等判断，再进行记录文本截断；不 trim，不做子串或 URL 匹配。同一文字若为 error 或来自 WebGPU，仍为 fatal；其他所有 warning／error 也仍为 fatal。建议文字以 `performanceEvidence:false` 保存，不能证明性能收益。128 条事件与 8,192 字符限制仍在超限时阻止完成。

## 外部退役与结果边界

须使用独立外部 owner、最长 300,000 ms 的有限外层 watchdog，以及明确 Windows Job／进程退役 receipt。单操作、采集、清理和硬截止仍分别为 20,000／240,000／280,000／295,000 ms。collector 关闭不能证明 OS 进程退役。外部 receipt 须证明 assigned ownership、完整输出流、active-zero 和 Job 关闭，并与工具结果分别审阅。

`result.json` 报告 `PASS_OPAQUE_REGION_SUBSET`、`FAIL_OPAQUE_REGION_SUBSET` 或 `INCOMPLETE`，退出码分别为 0、1、2。子集结果只适用于所记录的当前构建输入、环境与观察，不能推广为完整播放器生命周期验收、可移植浏览器资格、alpha 精度、GPU 性能或生产就绪。外部 owner 的 native 运行与独立保存产物审阅仍是单独义务。
