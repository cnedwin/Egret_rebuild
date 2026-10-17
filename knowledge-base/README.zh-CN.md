# 白鹭引擎知识库

[English](README.md) | 简体中文

## 实验性 WebGPU 图像驻留 — 0.61.0

**0.61.0 工程预览**增加由各 WebGPU Host 独立管理的内部图像缓存，复用已安全完成的精确裁剪 GPU 图像。LRU 机制维持 32 MiB 逻辑图像池和最多 256 个可复用条目，保留原公开准入、渲染模式与生命周期管理，不增加公开 API 或依赖。

参阅[契约](Cns/docs/gpu-image-residency-contract.md)及[证据与限制](Cns/docs/gpu-image-residency-evidence.md)。受控规格/所有权结果和实际当前桌面回归结果具有各自范围。新增缓存专用浏览器矩阵延期并保持 OPEN。物理 GPU 内存、性能、目标设备与实际 device-loss 恢复仍未验证。工作区包仍为 private、版本 0.0.0，Host 协议仍为 1.0。

## 图集导入规划 — 0.60.0

**0.60.0 工程预览**增加可选 `@egret/project/atlas` 入口，以一个显式 PNG 绑定规划严格单页 Aseprite stable-marker JSON-array。两个运行时值与十六个擦除类型为既有 SpriteSheet、SequenceClip 工厂生成自有、冻结的输入。精确 profile 为 `aseprite-json-array-1.3.18.6-v1`；exporter 输出兼容性、声明 hash 与许可资格仍未验证。

参阅[契约](Cns/docs/atlas-import-plan-contract.md)及[证据与限制](Cns/docs/atlas-import-plan-evidence.md)。

已独立接受的保存结果分别为聚焦 planner 47/47、较早正常 SDK 核心 3625/3625 与单独 F2 160/160，以及独立 CPU firstGREEN 5/5；这些重叠范围不相加。独立审查还接受所选新增 Native Canvas/WebGPU 四次读回结果。最终集成门禁/prepush 及 0.60 Git/远端交付仍待完成。工作区包仍为 private、版本 0.0.0，Host 协议仍为 1.0。

0.56.0 的[位图资源槽](Cns/docs/位图资源槽规格.md)为同一个持久 Bitmap 增加显式替换：借用初始绑定，在请求等待或拒绝时保留先前可用绑定，只有最新已接受意图可以提交。参阅[证据记录](Cns/docs/位图资源槽核验.md)和[组合示例](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/bitmap-resource-slot/README.md)。聚焦行为、严格消费者及记录的桌面 Canvas/WebGPU 组合已通过各自限定检查；完整本地／公开门禁及仓库交付在所链接证据中分别记录。

知识库围绕产品定位、技术架构、公共契约和交付组织，提供两套完整阅读版本：

- [English](en/README.md)
- [简体中文](Cns/README.md)

建议先阅读[产品定位](Cns/docs/设计理念与定位.md)、[产品需求](Cns/docs/产品需求说明书.md)和[技术白皮书](Cns/docs/技术白皮书.md)。[能力与进展总览](Cns/docs/core-progress.md)和[变更记录](Cns/CHANGELOG.md)说明实现情况与版本演进。

设计文档解释产品选择的理由；接口契约定义行为；验证记录说明实际检查的范围；登记册维护需求、决策与交付状态。研究资料和历史实验可从各语言入口查阅。
