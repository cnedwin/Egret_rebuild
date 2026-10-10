# 鸣谢与参考项目

[English](../en/ACKNOWLEDGEMENTS.md) | 简体中文

## 0.16.0 声明与 3D 参考来源

Microsoft Corporation 的 [jsonc-parser](https://github.com/microsoft/node-jsonc-parser/tree/v3.3.1) 3.3.1 以 MIT 提供公共根 createScanner／visit，供既有私有工程适配器与声明分析使用。已有 MIT 声明和依赖固定值继续适用。RES profile／报告／fixture 与 CPU 3D 契约／实现独立编写。创始人提供的历史 RES 声明语义用于兼容性研究；准确版本／模块闭合仍未验证，不分发历史私有源码。见[声明范围](docs/legacy-res-declarations.md)。

选定的 [GPUWeb 草案](https://github.com/gpuweb/gpuweb/blob/25a5dc4537074c9b3844dd95891f5cfd193f4407/spec/index.bs)固定在 commit 25a5dc4537074c9b3844dd95891f5cfd193f4407，为九个选定 3D 设计语义区间提供依据。这份固定阅读及选定 TypeScript 声明不产生最新最终标准、GPU 宿主、像素或性能验收。无 depth UI 和选定 pass 后 readback 是白鹭架构选择，不是 WebGPU 的普遍要求。见[3D 基础](docs/3d-foundation.md)。已有研究／依赖鸣谢及历史限制继续适用。

版本：1.1 · 所属知识库：0.9.0 · 更新：2026年10月8日。

感谢下列项目、标准组织及其社区公开的源码、文档、测试和维护经验。它们为新白鹭的机制研究、独立设计与验证提供了依据。本文按实际使用角色列出来源；鸣谢表示知识与工具来源，不表示合作、上游参与或背书。完整版本、已读范围与限制见[来源登记册](registry/来源.json)。

## 已开展的机制与产品研究

| 项目 | 已有研究范围与版本依据 | 官方来源与证据 |
| --- | --- | --- |
| Cocos | Creator 3.8.8下载快照、3.8文档、Cocos4 alpha.34与CLI alpha.42官方发行；渲染/UI合批、桥接与工程自动化。对应发行和文档快照已记录，未登记完整源码SHA或执行这些引擎 | [Creator资料](https://www.cocos.com/creator-download)、[Cocos4发行](https://github.com/cocos/cocos4/releases/tag/4.0.0-alpha.34)、[CLI发行](https://github.com/cocos/cocos-cli/releases/tag/0.0.1-alpha.42)、[UI合批](https://docs.cocos.com/creator/3.8/manual/en/ui-system/components/engine/ui-batch.html)；[版本核查](../evidence/research-refresh-2026-10-08.json)，S004/S005 |
| LayaAir | 引擎v3.4.1官方发行，3.x架构与AI工具分层，以及v3.3.0/v3.3.1演进记录。IDE下载版本及部分日期仍保留原核查限制；未登记完整源码SHA或执行引擎 | [引擎发行](https://github.com/layabox/LayaAir/releases/tag/v3.4.1)、[架构文档](https://www.layaair.com/3.x/doc/basics/architecture/)、[AI路线](https://layaair.com/3.x/doc/guides/roadmap/ai/)、[CLI](https://github.com/layabox/layaair-cli)；[版本核查](../evidence/research-refresh-2026-10-08.json)，S006 |
| Godot | 4.7.2-stable发行及4.7版本化渲染、Web导出、管线编译文档；对象身份与模块演进。文档研究未扩展为源码SHA审阅或运行验收 | [官方发行](https://github.com/godotengine/godot/releases/tag/4.7.2-stable)、[渲染文档](https://docs.godotengine.org/en/4.7/tutorials/rendering/renderers.html)、[Web导出](https://docs.godotengine.org/en/4.7/tutorials/export/exporting_for_web.html)；[版本核查](../evidence/research-refresh-2026-10-08.json)，S007 |
| Three.js | r180固定commit `0af9729d0c143a86a1d725d6e2c3ad83301f3f34`：渲染排序、状态、恢复、glTF/KTX2与动画入口的窄范围静态研究；与r186运行链分别记录 | [固定仓库](https://github.com/mrdoob/three.js/tree/0af9729d0c143a86a1d725d6e2c3ad83301f3f34)、[WebGPU手册](https://threejs.org/manual/pages/webgpurenderer)；[渲染研究](../evidence/reference-render-lifecycle.json)、[资源动画研究](../evidence/reference-assets-animation.json) |
| Babylon.js | 9.29.0 / `cbe5bb36998fdde6bd93d76e67813ff571a535db`：渲染生命周期与GUI；8.26.0 / `09876696f9942657ec9da5a72ec16c9d3de54365`：资源动画。两套历史快照分别维护，均为静态研究 | [9.29.0固定仓库](https://github.com/BabylonJS/Babylon.js/tree/cbe5bb36998fdde6bd93d76e67813ff571a535db)、[8.26.0固定仓库](https://github.com/BabylonJS/Babylon.js/tree/09876696f9942657ec9da5a72ec16c9d3de54365)；[渲染研究](../evidence/reference-render-lifecycle.json)、[文字UI研究](../evidence/reference-text-ui.json)、[资源动画研究](../evidence/reference-assets-animation.json) |
| PlayCanvas | v2.23.0 / `cfef43d306b2b55a2c0742e4994221f6d2463957`：渲染与资源；v2.23.1 / `c3eb40348be7e80617164e4f2fea0b139ad42ebb`：字体图集、文字与所读测试。已读测试保持未执行状态 | [v2.23.0固定仓库](https://github.com/playcanvas/engine/tree/cfef43d306b2b55a2c0742e4994221f6d2463957)、[v2.23.1固定仓库](https://github.com/playcanvas/engine/tree/c3eb40348be7e80617164e4f2fea0b139ad42ebb)、[设备恢复文档](https://developer.playcanvas.com/user-manual/graphics/advanced-rendering/device-loss/)；[渲染研究](../evidence/reference-render-lifecycle.json)、[文字UI研究](../evidence/reference-text-ui.json) |
| PixiJS | v8.22.0 / `5b41ee37fd36c61e089113345a8f12cf1c3323cf`：Canvas文字、批次、缓存与恢复的固定文件研究；维护PR作为反例与修复依据 | [固定仓库](https://github.com/pixijs/pixijs/tree/5b41ee37fd36c61e089113345a8f12cf1c3323cf)、[PR12170](https://github.com/pixijs/pixijs/pull/12170)、[PR12194](https://github.com/pixijs/pixijs/pull/12194)；[文字研究](../evidence/reference-pixi-text.json) |
| DragonBonesJS | `64b6c69ae35777c2404be68c9192e2c56906079e`：历史2D骨骼、Slot与附件顺序的迁移语义研究 | [固定源码](https://github.com/DragonBones/DragonBonesJS/blob/64b6c69ae35777c2404be68c9192e2c56906079e/DragonBones/src/dragonBones/armature/Slot.ts)、[固定许可](https://github.com/DragonBones/DragonBonesJS/blob/64b6c69ae35777c2404be68c9192e2c56906079e/LICENSE)；[资源动画研究](../evidence/reference-assets-animation.json)，S027 |
| Shaders | v4.0.2 / `9435282c29d3505c67eef427470c8d835095a199`：参数化效果、组件、MCP与CLI的窄源码和官方资料研究，未安装或执行 | [固定仓库](https://github.com/shader-effects-inc/shaders/tree/9435282c29d3505c67eef427470c8d835095a199)、[官方公告](https://shaders.com/updates/shaders-is-open-source)；[研究记录](../evidence/shaders-reference-research.json)，S040 |

上述研究贡献已知机制、边界与反例；白鹭核心的数据组织、接口及实现依据自有规格设计。当前项目角色和采用状态见[参考采用方案](docs/开源参考实现与采用方案.md)，各项目许可证以实际取得版本及所分发文件的声明为准。

## 实际研究运行依赖与资产

| 对象 | 实际角色 | 固定来源与声明 |
| --- | --- | --- |
| Three.js r186 | WebGLRenderer、GLTFLoader、AnimationMixer和SkeletonUtils实际执行于研究对照链。第三方执行能力保留Three.js归属，白鹭适配单独保存 | commit `9b4a2ac29c63ccb43fd51c5661f2f873ac2c39b8`；[官方固定来源](https://github.com/mrdoob/three.js/tree/9b4a2ac29c63ccb43fd51c5661f2f873ac2c39b8)、[来源与文件hash](../experiments/asset-reference-probe/sources.json)、[随附MIT声明](../experiments/asset-reference-probe/vendor/three/r186/LICENSE)、[第三方声明](experiments/asset-reference-probe/THIRD_PARTY_NOTICES.md) |
| Rigged Simple — Cesium (2017) | 研究链使用的未修改embedded glTF资产，1skin/2joint/1clip蒙皮圆柱 | KhronosGroup/glTF-Sample-Assets commit `edc7c9e67c639d230715049ee31f9a96a6babbbe`；[官方固定资产](https://github.com/KhronosGroup/glTF-Sample-Assets/blob/edc7c9e67c639d230715049ee31f9a96a6babbbe/Models/RiggedSimple/glTF-Embedded/RiggedSimple.gltf)、[CC-BY-4.0许可](../en/experiments/asset-reference-probe/assets/RiggedSimple/LICENSE.md)、[归属元数据](../experiments/asset-reference-probe/assets/RiggedSimple/metadata.json) |

已有17/17检查限于本地桌面WebGL2研究链及原条件，见[第三轮集成记录](docs/第三轮集成记录.md)。这些依赖尚未作为白鹭生产内核选择；KTX2/Basis、完整2D骨骼、复杂UI和生产宿主另有验收范围。

## 公开标准与文字基础资料

| 来源 | 目前已读或核对范围 | 官方入口与证据 |
| --- | --- | --- |
| HarfBuzz | 已读shaping/cluster官方说明，源码只核对入口；版本与SHA尚未固定，尚未运行或采用依赖 | [仓库入口](https://github.com/harfbuzz/harfbuzz/blob/main/src/hb-shape.cc)、[cluster说明](https://harfbuzz.github.io/working-with-harfbuzz-clusters.html)、[职责说明](https://harfbuzz.github.io/what-does-harfbuzz-do.html)；[G002/G007记录](../evidence/core-evidence-gaps.json) |
| FreeType | 已读字符覆盖API说明，实现入口尚待固定版本审读；尚未运行或采用依赖 | [字符映射API](https://freetype.org/freetype2/docs/reference/ft2-character_mapping.html)；[G002记录](../evidence/core-evidence-gaps.json) |
| Unicode | UAX #14断行与UAX #29字素边界入口已核对；对应版本与测试数据待固定 | [UAX #14](https://www.unicode.org/reports/tr14/)、[UAX #29](https://www.unicode.org/reports/tr29/)；[G002记录](../evidence/core-evidence-gaps.json) |
| WebGPU、WGSL与WebGL | 官方API、能力与设备丢失说明及规范入口研究；资料的具体访问与已读范围按记录保留，历史记录当时未验收WebGPU；当前矩形范围另见新增证据 | [WebGPU规范](https://www.w3.org/TR/webgpu/)、[GPUWeb API](https://gpuweb.github.io/types/interfaces/GPUDevice)、[explainer](https://gpuweb.github.io/gpuweb/explainer/)、[WGSL规范](https://www.w3.org/TR/WGSL/)、[WebGL2规范](https://registry.khronos.org/webgl/specs/latest/2.0/)；[首轮记录](../evidence/research-refresh-2026-10-08.json)、[图形研究](../evidence/backend-graphics-research.json)、[GPU/宿主资料](../evidence/backend-host-ai-research.json)、[G003记录](../evidence/core-evidence-gaps.json) |
| glTF / Khronos | glTF扩展规则、真实资产格式与加载边界的研究依据 | [glTF 2.0规范](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#specifying-extensions)；[资源动画研究](../evidence/reference-assets-animation.json) |
| WHATWG与W3C输入事件 | AbortSignal与composition/IME的接口研究入口，实际宿主适配待验证 | [AbortSignal](https://dom.spec.whatwg.org/#interface-abortsignal)、[composition事件](https://www.w3.org/TR/uievents/#events-compositionevents)；[G001/G007记录](../evidence/core-evidence-gaps.json) |
| MCP | 按2025-06-18版工具与取消协议研究工程接口；协议与白鹭事务合同分别管理 | [工具规范](https://modelcontextprotocol.io/specification/2025-06-18/server/tools)、[取消规范](https://modelcontextprotocol.io/specification/2025-06-18/basic/utilities/cancellation)；[G006记录](../evidence/core-evidence-gaps.json) |

标准资料提供接口与语义依据；链接到可变页面的条目不视为已固定版本。HarfBuzz和FreeType目前属于后续候选，其官方资料阅读与库采用分别记录。

## 实际开发工具

| 工具 | 实际角色与固定版本 | 官方入口与本地证据 |
| --- | --- | --- |
| TypeScript | 7.0.2及本机实际安装的`@typescript/typescript-win32-x64` 7.0.2；编译与类型检查开发工具，记录为Apache-2.0，未修改 | [官方仓库](https://github.com/microsoft/TypeScript)、[下载文档](https://www.typescriptlang.org/download/)；[工具核对](../evidence/core-framework-tooling.json)、[原型来源与声明位置](../evidence/core-framework-implementation.json) |
| pnpm | 11.25.0；宿主提供的包管理工具，记录为MIT，未修改；原型lockfile固定依赖 | [workspace文档](https://pnpm.io/workspaces)；[原型配置](../evidence/core-framework-implementation.json)、[lockfile](../evidence/core-framework-implementation.json)、[来源记录](../evidence/core-framework-implementation.json) |
| Node.js | 24.19.0；开发、测试和显式headless示例的宿主运行时，来源记录保留MIT及上游第三方声明范围 | [官方文档入口](https://nodejs.org/api/)；[工具核对](../evidence/core-framework-tooling.json)、[原型来源记录](../evidence/core-framework-implementation.json) |

Node.js链接用于官方文档导航；实际版本依据来自本地工具记录。contracts/runtime没有第三方运行时依赖；engine的WebGPU准备层现在显式依赖robust-predicates 3.0.3，开发工具身份与自主运行时代码分别登记。

## 已研究的候选与待继续验证的对象

原生图形与脚本运行时的既有静态研究包括[wgpu](https://github.com/gfx-rs/wgpu)、[Dawn](https://dawn.googlesource.com/dawn/+/refs/heads/main/README.md)、[bgfx](https://bkaradzic.github.io/bgfx/overview.html)、[ANGLE](https://chromium.googlesource.com/angle/angle/+/main/README.md)、[V8](https://v8.dev/docs/embed)、[JavaScriptCore](https://developer.apple.com/documentation/javascriptcore)、[QuickJS](https://bellard.org/quickjs/)和[Hermes](https://github.com/facebook/hermes)。wgpu资料中引用30.0.1 API，其他候选的已读版本与主分支范围按[原生研究记录](../evidence/backend-native-research.json)及[G004记录](../evidence/core-evidence-gaps.json)保留。它们尚未作为原生生产依赖集成；SDK、VM、FFI、设备互操作、包体与性能待实际验证。Dawn和JavaScriptCore的访问限制仍在证据中保留。

历史白鹭资料仅按授权的来源种类、命名/行为摘要与迁移问题记录，见[命名合同摘要](../evidence/egret-naming-contract-summary.json)。公开的[Egret仓库入口](https://github.com/egret-labs/egret-core/blob/master/src/egret/events/EventDispatcher.ts)可供后续按样本版本研究；该可变入口不替代实际历史版本，也不列为新核心依赖。

每次新增实际依赖、研究对象或分发资产时，同步更新本页、[实现来源记录](templates/实现来源记录.md)与适用第三方声明。第一方源码与文档沿用指定仓库既有Apache-2.0许可，第三方材料按自身声明分发；本页的鸣谢不替代第三方原有声明与发行权利复核。

## WebGPU基础依赖与标准

Vladimir Agafonkin的[robust-predicates](https://github.com/mourner/robust-predicates/tree/v3.0.3) 3.0.3通过公共 `orient2d` 提供已表示binary64坐标的方向判断；它保持明确归属的外部依赖并适用[Unlicense](https://raw.githubusercontent.com/mourner/robust-predicates/v3.0.3/LICENSE)，其源码未移植入第一方模块。精确40820字节npm产物、SRI、已安装manifest/类型/许可及6模块73171字节安装ESM图分别记录，与浏览器实际请求区分；这些数字不是实际传输或tree-shaken包体。

GPUWeb的canvas配置/current texture、queue、buffer及device错误API资料和W3C WGSL文献，为独立编写的pass与生命周期合同提供依据。读取日期、实际URL、完整规范获取限制及此前类型/latest抓取失败保留于[来源证据](../evidence/webgpu-source-evidence.json)。真实浏览器门禁另列；鸣谢不表示上游背书或手机/性能/Native SDK验收。
