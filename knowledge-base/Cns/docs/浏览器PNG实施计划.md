# 浏览器 PNG 实施与验证计划 — BIP1

[English](../../en/docs/browser-png-implementation-plan.md) | 简体中文

## 当前 0.46.0 公开材料截止点 — 2026-10-14

可选浏览器 PNG 适配器的源码、4/4 终态回归、95/95 公开 CPU／冷导入用例、五组严格类型诊断（0/32/54/0/6）、公开类型门禁、17/17 新策略用例及 272/272 保留边界用例、39/39 观察器 UNIT 用例均已独立接受。各计数属于不同范围，不合并。原生采集器 R2 源码、采用／语法及输入准备已接受。独立保存结果评审已按 PASS_ACTUAL_BOUNDED_NATIVE_PNG_BROWSER_SUBSET_ONLY 接受限定默认浏览器 Canvas／WebGPU PNG 子集，包含 6 次提交／192 个像素／768 个通道，容差 0。当前完整仓库／推送门禁、本增量推送／PR／Main 与远端 CI 验收仍为 PENDING。

下方保留章节记录原 2026-10-13 源码／文档截止点，其中 NOT_RUN 保留当时的历史范围；当前状态以本后继章节为准，行为契约与冻结的数值安排不变。

当前公开文档草稿，2026-10-13。源码、公开 CPU／冷导入行为、严格消费者、公开类型门禁及自有副本策略对照已获独立证据接受；操作观察器的受控 UNIT 证据已接受。原生采集器正在进行源码工作；真实浏览器运行、完整仓库门禁及本增量交付均为 NOT_RUN。[契约](浏览器PNG纹理Provider契约.md) 定义行为，[证据](浏览器PNG验证证据.md) 记录当前接受截止点和保留的失败。

## 架构与开发者链路

适配器把调用者提供的 PNG 字节接入既有引擎资源：

`应用 reader → 自有编码副本 → 结构／profile 准入 → 浏览器 ImageBitmap → 临时 Canvas → 自有 ImageData2D → Texture → engine.assets 租约 → SpriteSheet/Bitmap/序列 → 捕获帧`

`packages/engine/web/image.ts` 是可选门面，`packages/engine/web/BrowserTextureProvider.ts` 实现适配器，`packages/engine/package.json` 提供精确的 `./web/image` types/import 映射。既有 contracts/runtime 身份、资源所有权、时钟、渲染命令及依赖仍为依据。适配器不增加运行时依赖或第二套资源缓存；既有 web build 拥有 DOM 类型，默认核心入口继续保持 DOM/Node-free。

从 `@egret/engine/web/image` 创建 `createBrowserTextureProvider({ readBytes })`，为真实纹理资源类型登记 provider，再通过 `engine.assets` 获取原 ref。在该 Engine 的 Scope 中保留返回租约，并把同一租约交给既有 SpriteSheet/Bitmap API。应用拥有字节获取及网络策略；provider 在浏览器 callback 开始前拥有精确的私有副本，不实现 URL 下载或重试调度。

既有 manager 拥有已交付 Texture 的需求与 dispose；应用独立拥有 `provider.close()`：先关闭 Engine／manager 需求，再等待 provider。Scope 的同步 dispose 不能代替这个 Promise。Provider close 保留已交付值，未结算的原始 source/decode 工作会使 close 继续 pending。参见[资源契约](资源核心合同.md)、[命名图集契约](命名图集契约.md)及[时钟驱动序列动画契约](时钟驱动序列动画契约.md)。

## 工作包与当前状态

| 工作 | 结果或剩余接受条件 |
| --- | --- |
| 公开 API 与适配器 | 独立源码评审；一个可选运行时值与四个擦除接口。公开 CPU／冷导入与终止退休回归已接受。 |
| 严格消费者 | 五条无 suppression 通道及完整诊断 tuple 已接受；公开独立类型门禁重放已接受。负例退出码为 1，不是 2。 |
| 包策略 | 当前仓库基线、16 个独立自有副本拒绝对照及精确逆操作已接受；既有 core／图集／序列检查器和保留边界 suite 在各自范围已接受。 |
| 原生操作观察器 | 六项精确操作的源码／权限及 39 个受控 UNIT 测试已接受；尚未测量真实浏览器操作。 |
| 原生资源／绘制链路 | [原生日程](浏览器PNG原生验证计划.md) 已冻结；仍需采集器源码／闭包评审及默认真实浏览器执行。 |
| 公开交付 | 本增量仍需最终中英／source-origin 整理、关键英文注释、完整 publication/prepush/hook、推送、PR 与 Main 证据。 |

这些是不同证据类别，重放与重叠 suite 不合并为一个验收数量。类型或策略通过不能证明原生解码或绘制像素。

## 固定验证类别

| 类别 | 必需行为 |
| --- | --- |
| BIP01 | 精确可选值／类型、惰性 cold import、默认路由保持及 DOM/Node-free roots。 |
| BIP02 | 顺序快照、内建 byte view 准入、shared/detached/resizable 拒绝、callback 前副本、有意义的端点与 one-over 拒绝。 |
| BIP03 | Decode 前完成 framing/profile；精确 RGB/RGBA8 子集与颜色元数据；unsupported/malformed 输入不静默剥离。CRC 存储不等于校验。 |
| BIP04 | 原 reader receiver/ref/context、四 occupied jobs 无队列、取消／关闭优先级、晚到结算及容量保留。 |
| BIP05 | 临时归属、含 undefined 的原 cause、每个实际 close/reset 尝试、隔离及 close 专用原因次序。 |
| BIP06 | 真实 manager 共享、独立租约、invalidate 新旧代、Engine／晚到值归属及 provider close 保留交付值。 |
| BIP07 | 同租约图集／Bitmap／clip／clock、默认原生 decode/readback、Canvas/WebGPU 字面像素及保留帧生命周期；原生部分 pending。 |
| BIP08 | 完整严格 tuple、基线 → 单处指定策略变体 → 精确逆操作 → 恢复基线、独立源码／结果及双语／完整交付门禁。 |

四 job 与单次字节限制使独立 aggregate one-over 输入不可达：总上限等于四个最大 payload。应验证合法四 payload 端点和真实 job／单次拒绝路径。这些上限约束准入记账，不约束实体浏览器／GPU 内存或 OOM 行为。

## 重现聚焦检查

使用仓库固定依赖，先做 stock build，再运行消费者。公开聚焦命令为：

```sh
node tools/build.mjs
node --test tests/browser-png-terminal-retirement.test.mjs
node --test tests/browser-png.test.mjs tests/browser-png-lifecycle.test.mjs tests/browser-png-assets.test.mjs tests/browser-png-api.test.mjs
node tools/browser-png-types.mjs
node tools/browser-png-boundary.mjs
node --test tests/browser-png-boundaries.test.mjs
node --test tests/browser-png-native-observer.test.mjs
```

受控 image ports 使 callback／错误／所有权行为可复现；受控观察器 owner 是 UNIT 样例，两者不能替代原生接受。类型门禁重放完整 file/line/column/code/message 对象，在编译前后验证当前 stock compiler／native package／声明库 owner，不把 Windows executable 哈希强加给其他 OS。策略变体从全新的完整构建副本开始，必须在一般指纹拒绝之前命中指定规则。

必需 verifier 在 `sequence-playback-boundary` 后加入 `browser-png-boundary`，在 `check-types` 后加入 `browser-png-types`，保留原七阶段及失败行为。完整 `tools/verify.mjs`、publication、prepush/hook 执行与这里的聚焦结果分开。遵守[仓库身份与换行规范](仓库路径身份与换行规范.md)：新写文本使用共享规范写入器；原始证据字节与 SHA-256 身份保持不变。

## 原生及交付完成条件

原生准入须绑定已接受实现／构建输出、CPU／冷导入／类型／策略／观察器证据、两个原始 PNG、字面 oracle、完整公开模块闭包及已安装工具 owner。不传 image ports，使用真实 Engine assets／租约和冻结的采样／时间日程。比较前保存原 source-image 输出、完整渲染缓冲、操作／退休观察及失败；独立审查采集器源码和保存的实际结果。

之后在新截止点完成四组配对文档与公开来源账本，验证关键英文注释与双语链接，运行完整仓库／publication/prepush 及必需 push hook，记录真实 GitHub PR/Main 交付。原生、公开门禁或交付失败保留其独立未完成边界与原始产物。

实现由 Egret 独立开发。格式参考为 [PNG 3，2025-06-24 Recommendation](https://www.w3.org/TR/2025/REC-png-3-20250624/)、[HTML ImageBitmap](https://html.spec.whatwg.org/multipage/imagebitmap-and-animations.html#imagebitmap) 及 [Canvas 预乘 alpha 规则](https://html.spec.whatwg.org/multipage/canvas.html#premultiplied-alpha-and-the-2d-rendering-context)，本设计于 2026-10-13 查阅。浏览器归一化可损失隐藏 RGB 或半透明精度；完整 PNG／颜色／alpha、目标设备性能、完整 Spine R020/V020 及一键迁移 R008/V006 保持 OPEN。
