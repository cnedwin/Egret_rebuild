# 图集导入计划：证据与限制

[English](../../en/docs/atlas-import-plan-evidence.md) | 简体中文 · [公开契约](atlas-import-plan-contract.md)

**0.60.0 工程预览**增加可选 `@egret/project/atlas` 元数据 planner。精确的 `aseprite-json-array-1.3.18.6-v1` profile 为既有 SpriteSheet、SequenceClip 工厂生成自有输入。工作区包仍为 private、版本 0.0.0，Host 协议仍为 1.0。[示例指南](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/atlas-import-playback/README.md)说明另行组合的 session。

## 已记录的证据领域

| 领域 | 已记录结果与限制 |
| --- | --- |
| Planner 源码与聚焦公开行为 | Planner 源码及保存的后继运行已独立接受：47/47 项测试，failed/cancelled/skipped/todo 为 0。malformed-profile 修复在完整 descriptor 捕获后才做 Unicode 准入；well-formed 未知 profile 仍延后至完整 JSON 与必需结构之后。 |
| 严格公开消费者与源码/包策略 | 已独立接受的 strict-consumer 与源码策略工作验证十六个擦除名称、两个运行时值、旋转字面量 0、readonly 工厂输入、七个普通 negative compiler tuple 和四个根入口导入 negative tuple。五个指定对照将直接 compiler/行为观察与正常身份拒绝分开。 |
| 完整正常 SDK 验证 | 已接受的十四阶段运行通过核心 3625/3625，以及单独的 Spine F2 实验 160/160；两套 failed/cancelled/skipped/todo 均为 0。这些相互重叠的领域不与聚焦 47 项相加。该运行早于之后的 CPU/Native 与公开文档集成，不是最终 prepush。 |
| 公开 SDK CPU 组合 | 已独立接受的首次实际 CPU 运行通过 5/5，failed/cancelled/skipped/todo 为 0。覆盖字面 plan 等值、once/loop 时间、capture 放置、原始资源退役，以及包含 `undefined` 的真实 Scope cleanup cause。接受仅覆盖冻结的 CPU source 与保存结果。 |
| 新的有限 Native 组合 | 两份保存的 R2 浏览器报告均记录 PASS：两个全新上下文、两个页面，四次完整 24×16 RGBA 读回，每份 1536 字节，容差 0、差异字节 0。console、pageError、failure、cleanup 及 pending-original-task 数均为 0。冻结后继 Source、两组全新 Node preparation/snapshot profile 及所选保存浏览器结果均已独立接受。 |
| 最终本地门禁与仓库交付 | 最终集成验证、公开内容/知识库检查、prepush/hooks、0.60 commit/push/PR/Main 及远端 CI 仍待完成；没有远端检查不等于 CI 成功。 |

既有 0.59 标准化布局增量已通过 [PR #48](https://github.com/cnedwin/Egret_rebuild/pull/48) 交付，Main 为 `44f49f9d97a7baebc400fd4940541529dc33d147`。原[图集帧证据](atlas-frame-layout-evidence.md)保留历史截止点，包括另经接受的六个上下文和 30 次读回。它们不接受新的 JSON 路径，也不改称 34 次读回。交付记录没有报告远端 status 或 check run，不据此推断远端 CI 通过。

## 保留的失败与修复

Parser 最初的缺入口 resolution 及早期 compiler/setup 失败与语义 RED 分开。真实 working-parser 累计名称对照先暴露 32769 UTF-16 码元仍被接纳，随后补入必需 guard，同时保留合法的 32768 对照。后来的 profile-Unicode 回归记录四个真实断言失败，再完成最小 Unicode 准入修复及后继 47 项 GREEN。较早的核心 15 项和首次 heldout 26 项保留各自范围。

严格消费者集成保留两次失败的完整验证。首次停止于 retained gate 的旧精确 project-package 身份；后一次 test 阶段记录 aggregate 275 个失败及 273 个详细 failure group，两者是不同观察。经审查的有限身份后继、一个 fixture-copy 条目和一条 synthetic export route 恢复既有检查，之后才取得最终十四阶段 GREEN。首轮 readonly/scanner 对照派生件还改变了 emitted final-newline bytes，未作为精确对照接受；新建精确字节的 R2 对照取代它们，产品 oracle 未改。原失败记录继续保留。

CPU 组合首次即 GREEN，没有制造语义 RED。此前 CJS resolution 事件发生在 Source 安装和 SDK 执行之前，仍仅为 setup 事件。CPU 图像 payload 与 controlled host trace 不能证明浏览器 PNG 解码或 Native 像素。

## 有限 Native 观察

首次浏览器截止点保留四份原始帧：WebGPU 通过，Canvas 则仅因频繁 `getImageData` 读回产生 `willReadFrequently` 性能警告而未通过整个严格运行。其像素比较与资源退役通过，不使该 Canvas 运行成为已接受结果。警告门禁保持原样。后继仅在 Host 构造前，将夹具首次 Canvas 读回上下文选为 `willReadFrequently: true`，断言实际仍为同一上下文并记录属性。[HTML 标准的上下文选项](https://html.spec.whatwg.org/multipage/canvas.html#concept-canvas-will-read-frequently)说明该范围；它不证明 Engine 默认值、backing-store 选择或性能提升。

所选后继的 Canvas 上下文记录 `alpha=true`、`colorSpace=srgb`、`colorType=unorm8`、`willReadFrequently=true`；WebGPU 在这个 Canvas 专用字段记录 `null`。两份保存报告使用同一冻结 Source。此前四份原始帧、历史 0.59 的三十次读回与本次所选四次分开，不改称新增已接受覆盖。

实际身份链绑定 934 字节 metadata 原文、1884 字节完整调用输入、一次真实公开入口 Node planner 调用、自有冻结的 live result 及完整 4418 字节保存 plan。浏览器以 HTTP 200 接收相同字节的 immutable plan route，加载原始 218 字节 6×6 PNG，通过 `createImageBitmap` 与 Canvas2D 解码，并组合真实 Engine、Scope、full-atlas lease、Texture、SpriteSheet、SequenceClip。浏览器消费 plan 不证明在浏览器执行 parser。两份字面整帧 oracle 对每次读回的全部 1536 个通道比较，而非仅检查选定像素。

原资源退役记录 owner/scope、controller、Bitmap、parent、sheet、lease、Texture 全部关闭，一次 provider load、一次原始 disposal attempt 与 disposal，clock/stage/Host 关闭，surface 脱离且尺寸归零，browser/context/server 关闭。WebGPU 记录 pending frame/upload/readback/geometry 工作为 0，无 first failure 或 callback failure。这些观察证明有限资源生命周期，不证明物理 VRAM 回收。

记录环境为 Node 24.19.0、Windows 10.0.26300 x64、Edge 155.0.4283.45、Playwright 1.62.1，viewport 640×480、DPR 1，无额外浏览器 flags。浏览器可执行文件原始身份未绑定。该证据仅为有限桌面组合，不声明手机/设备覆盖、性能、能耗、物理 GPU 内存、通用恢复或 exporter 兼容性。

保留的一份运行后记录错误地沿用了运行前记录的两个输出不存在值。原错误与封存制品继续保留。另行计时的稍后观察为 2026-10-16T21:50:57.598Z–21:51:19.717Z，确认两个原输出目录及报告均存在（`nativeOutputAbsent=false`、`reportExists=true`），Source、输入、报告及原始帧身份保持一致。独立审查关闭该证据错误，仅接受所选后继四帧结果；该闭环没有重新运行浏览器或重复像素比较。

## 复现与所有权

在仓库根目录运行 `node tools/verify.mjs` 可执行正常 SDK 流程。`node --test tests/atlas-import.test.mjs tests/atlas-import-admission.test.mjs tests/atlas-import-heldout.test.mjs` 选择聚焦 planner 套件，`node --test tests/atlas-import-composition.test.mjs` 选择 CPU 组合。上方实际数量属于其保存候选及输入身份；在其他 tree 执行这些命令须重新留证。

Planner 不导入 Engine/Runtime/Host，不加载 PNG，也不认证 lease。可选入口仅复用既有私有 public-root jsonc-parser 3.3.1 foundation，不新增运行时依赖。Engine 工厂在 `trim-rotation-v1` 下重新接纳标准化帧。调用者提供并拥有 full-atlas lease；示例通过真实 Scope 接纳其创建的资源，并将完成与退役分开。

有限 Native 流程在 Node 解析 metadata，封存 plan，再向浏览器 session 提供固定制品。任何结果声明都需要自身经过审查的 source/config/route 闭包、parser-text-plan-HTTP 身份链、字面 pixel oracle、原始 RGBA 和 cleanup 记录。浏览器消费 plan 不证明浏览器执行 parser。已接受的 collector Source 与 preparation 接口见示例指南。已独立接受的保存浏览器结果与 CPU 证据仍为不同领域。

## 来源与剩余工作

[契约的 E01–E09 来源](atlas-import-plan-contract.md#官方来源与接受边界)保留精确官方 source/tag/commit 与许可范围。exporter/app/ver 研究遵循 Aseprite EULA，src/doc MIT 不覆盖整个应用。第一方夹具与代码由 Codex 辅助独立编写；格式词汇和合成 stable marker 不证明合法商业 exporter 输出、权利、声明哈希或像素。planner 不复制上游实现或美术。

商业 `meta.version`、实际 exporter 输出兼容性、声明 hash 核验及许可资格仍未验证。旋转、多页、pivot/nine-slice 导入、TexturePacker hash 格式、完整 P04、Spine R020/V020、迁移 R008/V006、动画资源替换、生产宿主、移动性能、物理 GPU 内存与设备恢复均不属于本次接受。最终公开 source/translation 复核、集成门禁与交付仍是独立义务。
