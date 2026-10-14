# 白鹭引擎 Egret Engine 社区重建

[English](README.md) | 简体中文

I'm Edwin, the founder of Egret Engine. In late 2013, WanderWang and I founded Egret Labs and started the Egret Engine project. After twelve years of development, the venture ultimately failed for a variety of reasons.

Years later, as times change and technology advances, many developers continue to encourage us. I hope to rebuild this game engine with the help of AI and the community.

### 中文介绍

我是白鹭引擎的创始人 Edwin，从 2013 年底开始和 WanderWang 一起创建了 Egret Labs 和 Egret Engine 项目。历经 12 年的发展，最终因为种种原因失败了。

多年以后，时代变迁，技术革新，依然有很多开发者在鼓励我们。我希望借助 AI 和社区的力量，重建这个游戏引擎。

<!-- AAP-0.53.0-BEGIN -->
## 构建并运行当前示例

工程预览 **0.53.0** · S107 / V058。[锚点图集示例](examples/anchored-atlas-playback/README.zh-CN.md) 获取唯一真实资源租约、创建红／蓝具名帧、通过 Engine 时钟播放，并围绕指定枢轴放置 Bitmap。手动前进／暂停／恢复与保存／当前呈现，使资源 → 动画 → 显示 → 宿主完整链路可见。

使用固定 Node 构建（`node tools/build.mjs`），通过本地 HTTP 提供仓库根目录，再打开 `/examples/anchored-atlas-playback/`。默认 Canvas；显式选择 WebGPU，不可用时明确显示。不新增自动定时器、Engine API 或依赖。

当前独立 CPU／代码接受覆盖 16 项公开消费者测试、全部 9 个代码阶段、Core 3147/3147 和保留 Spine 源码 160/160。桌面 Edge 155.0.4283.45 Canvas/WebGPU 验收覆盖 14 次主读取、32256 通道，在容差 0 下零差异；独立全新 Canvas 对照计入 0 个主案例。公开源码／双语评审、正常完整 prepush、强制 hook 与新增 0.53 交付仍为 PENDING，不声明远端 CI PASS。

阅读[契约](knowledge-base/Cns/docs/锚点图集播放契约.md)、[证据](knowledge-base/Cns/docs/锚点图集播放证据.md)和[剩余计划](knowledge-base/Cns/docs/锚点图集播放工程计划.md)。前次 0.52 枢轴包已通过 [PR #40](https://github.com/cnedwin/Egret_rebuild/pull/40) 交付，早先的 PENDING 段落保留为历史。

## 最近五项变化

| 预览 | 实用能力 |
| --- | --- |
| 0.53.0 | [可运行锚点图集组合](examples/anchored-atlas-playback/README.zh-CN.md)，具有显式时间和唯一资源所有权链。 |
| 0.52.0 | [显示枢轴](knowledge-base/Cns/docs/显示锚点偏移契约.md)，由捕获、坐标、边界、裁剪与拾取共同使用。 |
| 0.51.0 | [按索引插入子节点](knowledge-base/Cns/docs/容器按索引插入契约.md)，支持同父最终位置与换父节点。 |
| 0.50.0 | [直接子节点索引查询](knowledge-base/Cns/docs/容器子节点索引契约.md)，读取真实当前顺序。 |
| 0.49.0 | [分离全部直接子节点](knowledge-base/Cns/docs/容器清空子节点契约.md)，保留其清理所有者。 |

参阅[完整更新日志](knowledge-base/Cns/CHANGELOG.md)、[知识库](knowledge-base/Cns/README.md)及[截至 0.52 的 README 原始快照](knowledge-base/Cns/archive/根说明截至0.52.0.md.txt)。快照保留完整旧 README 字节，包括原链接与记录截止点；它是历史原始数据，不是当前导航。

## 范围与贡献

本项目依据 Egret 规格与熟悉 API 独立开展社区重建，采用第一方 Apache-2.0 代码、明确归属的 AI 辅助，并将源码／执行／交付证据分别记录。包保持私有 0.0.0，宿主协议为 1.0。阅读[贡献指引](CONTRIBUTING.zh-CN.md)和[致谢](ACKNOWLEDGEMENTS.zh-CN.md)。

完整 Spine R020/V020、迁移 R008/V006、完整 EUI／布局、高级 3D、AI、字体／IME、目标设备／Native SDK 及性能保持 OPEN 或未验证；当前示例和有界检查不等于完整产品接受。

两份精确原始档案：[English raw](knowledge-base/en/archive/root-readme-through-0.52.0.md.txt) · [Cns raw](knowledge-base/Cns/archive/根说明截至0.52.0.md.txt)。它们是未改写的历史数据，不是新翻译的阅读页。
<!-- AAP-0.53.0-END -->
