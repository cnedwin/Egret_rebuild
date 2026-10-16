# 图集导入播放组合

[English](README.md) | 简体中文

本示例通过既有公开 Engine 工厂消费冻结的标准化 atlas plan。metadata 由可选 `@egret/project/atlas` 入口另行解析；`createAtlasImportSession({host, profile, image, sequenceInput, spriteSheetFrames})` 是 `session.mjs` 导出的示例 helper，不是新增 SDK API。固定 profile 为 `canvas-2d` 与 `webgpu-textured-2d`。

使用仓库固定工具链执行 `node tools/verify.mjs`，或用 `node --test tests/atlas-import-composition.test.mjs` 选择 CPU 组合。已独立接受的保存 CPU firstGREEN 为 5/5，仅对应冻结的 source 与结果。正常 SDK 较早接受的核心 3625 项与单独 F2 160 项是不同且重叠的范围。独立审查接受所选新增 Native Canvas/WebGPU 四次读回结果；最终 prepush/交付仍待完成。

提供真实 Host、原始完整 6×6 图像 payload，以及成功 planner 的 `sequenceInput`、`spriteSheetFrames`。session 创建真实 Engine/AssetType/Texture/Scope，获取 full-atlas lease，并在既有 (2,2) parent 下组合一个 once actor。时间初始化为 0；`advanceTo(0.125)` 选择 B，`advanceTo(0.375)` 完成 once 播放。`capture()` 返回该 profile 的自有 frame，`inspect()` 报告状态。调用并 await `close()`，退役原始资源和 Host。重复 close 使用同一 promise，cleanup 拒绝保留原 cause 及独立诊断。

帧逻辑尺寸为 4×5，未旋转 packed 2×3 crop 位于 (0,0)、(3,0)。trim (1,1)/(1,2) 对应字面 image matrix [1,0,0,1,3,3]/[1,0,0,1,3,4]。CPU 套件另行构造真实 loop 组合，在 0/.125/.375 观察 A/B/A；示例 helper 的 once-only 签名不变。播放完成不证明 lease/Texture 已退役。

本目录提供 `session.mjs`，没有独立 `index.html` 或 `main.mjs`。有限 Native verifier 生成 browser harness，并提供封存的 Node 生成 plan。冻结后继 Source 与两组全新 preparation/config/snapshot profile 已独立接受。独立审查接受保存的 Canvas/WebGPU 所选四次零差异读回。浏览器消费 plan，不运行 metadata parser。社区复现使用公开 Source 与原创第一方素材，不依赖私有审查 receipt 或私有 oracle。[Preparation 工具](https://github.com/cnedwin/Egret_rebuild/blob/main/tools/atlas-frame/prepare-native.mjs)接收唯一的 `--repository`、`--task-root`、`--destination`、`--playwright-root`、`--profile`、`--kind` 参数：前四项为本地绝对目录，profile 为 `canvas-2d` 或 `webgpu-textured-2d`，kind 为 `atlas-import-v1`。它为[有限 verifier](https://github.com/cnedwin/Egret_rebuild/blob/main/tools/verify-atlas-frame.mjs)生成全新封存用例；保存 config/snapshot 及新的实际执行各有自身截止点。夹具在 Host 构造前选择 frequent-read Canvas 上下文，记录实际属性并保留严格零警告门禁。这是读回夹具设置，不声明 Engine 默认值或性能。

metadata 和 tiny artwork 是第一方程序化夹具，不是认证的 Aseprite exporter 输出。复用[裁边图集示例素材](../trimmed-atlas-playback/assets/atlas.png)的原始 6×6 PNG，保留[来源声明](../trimmed-atlas-playback/assets/provenance.json)与既有原字节。第一方材料采用 Apache-2.0。参阅[planner 契约](../../knowledge-base/Cns/docs/atlas-import-plan-contract.md)及[证据与限制](../../knowledge-base/Cns/docs/atlas-import-plan-evidence.md)。旋转、多页、真实 exporter 兼容性、许可资格、hash 核验、通用恢复与性能另行处理。
