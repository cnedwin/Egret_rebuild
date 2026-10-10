# 贡献指南

[English](CONTRIBUTING.en.md) | 简体中文

## 0.13.0 WebGPU矩形本地检查点 — 2026年10月9日

显式 `@egret/engine/webgpu` 入口同步执行不可变 `RenderFrame2D` 矩形命令。根入口保持无DOM；`@egret/engine/web`保持Canvas-only，实际请求不包含WebGPU或robust-predicates模块。无DOM准备层通过公共 `orient2d` 接入精确固定的基础依赖robust-predicates 3.0.3，适用Unlicense。复制、有界交点构造、打包、WGSL及宿主生命周期属于独立编写的第一方代码。见[完整0.6合同](docs/WebGPU矩形执行合同.md)、[实施计划](docs/WebGPU矩形实施计划.md)与[有限证据](docs/WebGPU矩形实现证据.md)。

已接受的桌面构建记录177/177 CPU/mock/核心检查、28项预期负类型诊断及123个边界文件；独立真实WebGPU门禁记录42帧、1709项原始断言、84张截图、6808项合成断言、8项预期反例及0项意外错误。其中7项变异实际生产代码副本，1项仅为合成断言。实际结果与有限独立实现审阅由[验证](evidence/webgpu-verification.json)与[审阅](evidence/webgpu-review.json)绑定已接受的源码身份；文档整合没有重跑这些检查。

本experimental检查点记录于2026-10-08T21:23:54.294Z最终原生运行之前，核心/headless与桌面Canvas结果分别记录。随后仅注释入口重建的真实浏览器WebGPU运行在 `1aa0248a1ff6d8e54c42d631072223bb50483814`、2026-10-08T21:23:54.294Z以0退出并记录PASS：42帧、1709项原始断言、84张PNG截图、6808项合成断言、8项预期反例及0项意外错误。7项反例变异生产代码副本，1项为合成断言。233项源码/构建/工具/依赖清单身份在该运行前后相等，且与当时仅文档和元数据变更的后继版本一致。实际运行由验证作者执行；独立修正及原生绑定复审、最终语义凭据和发布仍待完成。浏览器WebGPU与Native App/SDK分别验收；截图合成不证明实体扫描输出、硬件加速、手机或性能。纹理/文字/UI/动画/3D、编辑器/Agent创作、CI、完整迁移与完整产品仍待实施或验收；R008/V006及V003保留既有义务。下文0.9–0.12历史记录保留原日期、身份与结果范围。

版本：1.1 · 所属知识库0.10.0 · 更新：2026年10月8日。

新白鹭从开发第一天按公开协作推进，源代码、设计、文档、知识库、测试和可公开的验证记录共同维护。请从[README](README.md)、[当前版本](当前版本.json)和[需求登记册](registry/需求.json)了解项目，再查看[核心框架实现记录](docs/核心框架实现记录.md)。设计文档解释技术方案，登记册与验证记录说明当前状态。

项目仓库为[cnedwin/Egret_rebuild](https://github.com/cnedwin/Egret_rebuild)，第一方代码与文档沿用仓库既有Apache-2.0许可；第三方材料保留各自声明。现有三个headless核心包为开发预览，维护职责与贡献评审逐步明确，npm包尚未发布。

## 现在可以贡献

- 改进`@egret/contracts`、`@egret/runtime`、`@egret/engine`的生命周期、显示树、类型化事件与headless接口，在现有切片内补充有意义的行为反例和修复。
- 校勘设计、API和知识库文档，补充可核实的官方来源、固定版本与证据边界。
- 提交自有或获授权的复杂UI、轻量3D、文字与旧工程迁移样本，说明可公开范围和预期结果。
- 用[RFC模板](templates/RFC提案.md)讨论接口和设计取舍，用[ADR模板](templates/ADR决策记录.md)记录通过评审的技术选择。
- 扩展研究对照、集成回归或真实宿主验证，明确第三方依赖、实验输入与结果范围。

核心原型位于[核心框架实现记录](docs/核心框架实现记录.md)，公共入口为`@egret/engine`，接口支持级别为experimental。已有44/44行为检查和11项负类型断言，限于CPU与模拟host；GPU、Native、真实浏览器/小游戏、性能和CI尚待验收。完整渲染、文字、动画、迁移、编辑器和Agent服务按对应工作包推进，切片验证不替代这些交付。

## 提交与评审

当前可将提案存入[待审提案目录](proposals/README.md)，按日期与主题命名，附范围、关联需求、来源、变化和验证。维护者任命前，目录条目保持待审状态。远端启用后使用Issue和PR，并公开评审职责与合入规则；现有本地提案可保留版本与证据后转入该流程。

每项代码贡献同时说明公共行为、依赖方向、生命周期、兼容影响和来源；涉及合同变化时同步规格、迁移信息及验证。评审记录区分研究建议、候选设计、实现修订和正式决策。沟通围绕问题、证据和可复现步骤，描述技术影响并尊重作者与上游社区。

## 重现现有核心检查

固定开发工具为Node.js 24.19.0、pnpm 11.25.0和TypeScript 7.0.2，见[工具证据](evidence/core-framework-tooling.json)与[原型来源记录](evidence/core-framework-implementation.json)。在原型目录执行：

```text
pnpm install --frozen-lockfile --ignore-scripts
node tools/verify.mjs
node examples/headless.mjs
```

`verify`顺序检查构建、实际包解析与依赖边界、正负类型样例和Node行为测试。变更按实际影响选择回归，结果写明命令、环境、输入、输出及未验证项。固定工具版本与lockfile的升级单独说明理由和影响；CI接入后再登记远端执行结果。

## 工程与API规范

参见[工程结构](docs/工程技术架构与项目结构.md)、[公共API与命名](docs/公共API设计与命名规范.md)和[代码规范与门禁](docs/代码规范与质量门禁.md)。保留白鹭领域命名，按明确合同讨论现代化实现。当前已实现包与候选设计分别标注；尚未执行的工具或门禁保持待配置状态。

## 来源、AI与公开内容

执行[独立实现与第三方依赖规范](docs/独立实现与第三方依赖规范.md)。自主核心依白鹭规格独立设计和编写；研究来源与设计理由随变更保留。第三方库作为显式依赖登记版本、适用声明与修改，其内部能力保留上游归属。现有Three r186实验是第三方研究链，白鹭适配代码单独记录。

代码贡献附[实现来源记录](templates/实现来源记录.md)，说明规格、自主范围、已读资料、依赖、生成工具、AI参与、来源复核和验证。作者核对AI输出、样本权限和声明，并保留可回滚修改；需确认的来源问题在评审中解决并留存依据。

公开贡献使用可分发资料。私有原包、凭据、个人数据和未获公开授权的内容不进入仓库；必要历史研究以来源种类和技术摘要表述。第一方源码与文档沿用指定仓库既有Apache-2.0许可；第三方声明、资产归属及适用许可证随各自文件保留。鸣谢见[ACKNOWLEDGEMENTS](ACKNOWLEDGEMENTS.md)，参与方式见[社区参与](docs/社区参与.md)和[知识库维护](docs/知识库维护.md)。

每次推送前执行[双语文档与推送前检查](docs/双语文档与推送前检查.md)，同步中英文阅读版本、共同登记状态与关键代码英文注释。

## 双语与推送钩子

在仓库根目录运行`node tools/prepush.mjs`完成双语与核心检查。需要安装已记录的Node、pnpm与依赖，并提供PowerShell 7（`pwsh`）。该命令同时运行现有知识库结构检查。执行`git config --local core.hooksPath .githooks`即可为本地克隆启用推送钩子。

维护`localization.json`中的文档配对和最新摘要；新增文件也须登记。摘要更新只记录文件身份，不能代替全文翻译、公开范围和语义复核。登记册英文JSON记录中文来源及摘要，机器状态、编号、日期、依赖和数字保持一致。文档语言入口见本目录README；实验原始证据和上游许可不改写。

## 浏览器门禁与公开清单

每次推送必须执行`node tools/prepush.mjs`，检查公开结构、核心/类型/边界、headless行为与知识库结构；它不启动浏览器。渲染变更按影响另执行`node tools/verify-canvas.mjs --playwright <installed-playwright-module> --channel msedge --output <private-output-directory>`与独立`node tools/verify-webgpu.mjs --playwright <installed-playwright-module> --channel msedge --output <private-output-directory>`。使用已接受的固定依赖，浏览器默认启动无附加flags；源码身份比对相同的既有构建结果可明确注明后保留。

发现与登记路径均按Windows大小写不敏感方式排除私有执行、依赖及生成目录；清单不能覆盖排除规则。普通公开AGENTS文档仍有效；仅保留两个精确路径/hash的Three r186历史研究构建例外。结构检查不能产生翻译含义或公开审阅批准。
