# Agent协作约定

[English](AGENTS.en.md) | 简体中文

## 0.13.0 WebGPU矩形本地检查点 — 2026年10月9日

显式 `@egret/engine/webgpu` 入口同步执行不可变 `RenderFrame2D` 矩形命令。根入口保持无DOM；`@egret/engine/web`保持Canvas-only，实际请求不包含WebGPU或robust-predicates模块。无DOM准备层通过公共 `orient2d` 接入精确固定的基础依赖robust-predicates 3.0.3，适用Unlicense。复制、有界交点构造、打包、WGSL及宿主生命周期属于独立编写的第一方代码。见[完整0.6合同](knowledge-base/docs/WebGPU矩形执行合同.md)、[实施计划](knowledge-base/docs/WebGPU矩形实施计划.md)与[有限证据](knowledge-base/docs/WebGPU矩形实现证据.md)。

已接受的桌面构建记录177/177 CPU/mock/核心检查、28项预期负类型诊断及123个边界文件；独立真实WebGPU门禁记录42帧、1709项原始断言、84张截图、6808项合成断言、8项预期反例及0项意外错误。其中7项变异实际生产代码副本，1项仅为合成断言。实际结果与有限独立实现审阅由[验证](verification/webgpu-verification.json)与[审阅](verification/webgpu-review.json)绑定已接受的源码身份；文档整合没有重跑这些检查。

本experimental检查点记录于2026-10-08T21:23:54.294Z最终原生运行之前，核心/headless与桌面Canvas结果分别记录。随后仅注释入口重建的真实浏览器WebGPU运行在 `1aa0248a1ff6d8e54c42d631072223bb50483814`、2026-10-08T21:23:54.294Z以0退出并记录PASS：42帧、1709项原始断言、84张PNG截图、6808项合成断言、8项预期反例及0项意外错误。7项反例变异生产代码副本，1项为合成断言。233项源码/构建/工具/依赖清单身份在该运行前后相等，且与当前仅文档和元数据变更的后继版本一致。实际运行由验证作者执行；独立修正及原生绑定复审、最终语义凭据和发布仍待完成。浏览器WebGPU与Native App/SDK分别验收；截图合成不证明实体扫描输出、硬件加速、手机或性能。纹理/文字/UI/动画/3D、编辑器/Agent创作、CI、完整迁移与完整产品仍待实施或验收；R008/V006及V003保留既有义务。下文0.9–0.12历史记录保留原日期、身份与结果范围。

本仓库包含自主核心切片与公开知识库。先读README、CONTRIBUTING、source-origin.json及相关规格；按当前用户已授权范围完成工作。

- 自主核心按规格独立设计。资料研究、第三方依赖、白鹭适配和自主代码分别记录来源、版本与验证。
- engine依赖runtime/contracts，runtime仅依赖contracts，contracts不依赖其他包。公共示例与行为测试从`@egret/engine`入口使用构建产物，保持包exports、strict配置和无DOM/Node环境全局的核心边界。
- 私有几何单元测试可直接导入构建后的`engine/dist/rendering`辅助模块；公共行为测试仍使用公共入口。rendering独立编译项目保持无DOM，仅引用contracts。engine精确固定的外部依赖`robust-predicates` 3.0.3仅允许在rendering通过包根入口导入，与内部包依赖图及项目引用分别检查。
- 公共行为变化同步规格、来源记录与必要回归。说明实际运行环境与未验证项，保留反例和修复记录。
- AI参与按实际资料、生成范围和作者复核声明；私有资料只保留可公开的必要摘要，凭据和个人数据不进入仓库。
- 使用固定工具和lockfile，安装禁用生命周期脚本。版本、依赖、许可证或发布设置的变化单独说明理由和影响。
- 第一方代码与文档沿用Apache-2.0，保留第三方版权、许可、NOTICE和资产归属。历史身份hash不因公开投影而改写。
- 推送、发布、部署与仓库管理以用户实际授权为准。本地文件生成或验证不代表远端发布完成。

原型的44/44行为检查与11项负类型断言是已记录的headless基线；GPU、Native、真实宿主、性能与CI需各自验收。知识库中的Three运行链属于第三方研究，不替代自主核心验证。

## 每次推送前的双语与公开检查

每次推送到GitHub前，整理全部可公开的文档和知识库，保持完整中文及英文阅读版本，并补全关键代码的英文注释。登记册英文视图从中文权威记录生成，保持ID、状态、数字与来源一致；原始证据、代码快照和上游许可保持原始身份。完成来源、归属、可公开内容与翻译语义复核后，运行`node tools/prepush.mjs`，该命令包含双语检查及核心验证。机器检查不能替代作者对公开授权和翻译含义的复核。

本地克隆后可执行`git config --local core.hooksPath .githooks`启用仓库推送钩子；钩子执行同一检查。CI与贡献者均执行该命令，禁止以跳过钩子代替修复。该约定适用于所有后续推送，详情见[双语规范](knowledge-base/docs/双语文档与推送前检查.md)。

0.12.0限定显示/帧及独立Canvas实现已通过97/97行为检查及25项负类型诊断；原44项仍是历史基线。渲染变更另须运行`node tools/verify-canvas.mjs --playwright <installed-playwright-module> --channel msedge --output <private-output-directory>`；默认prepush不包含真实浏览器。

## 浏览器门禁与公开清单

每次推送必须执行`node tools/prepush.mjs`，检查公开结构、核心/类型/边界、headless行为与知识库结构；它不启动浏览器。渲染变更按影响另执行`node tools/verify-canvas.mjs --playwright <installed-playwright-module> --channel msedge --output <private-output-directory>`与独立`node tools/verify-webgpu.mjs --playwright <installed-playwright-module> --channel msedge --output <private-output-directory>`。使用已接受的固定依赖，浏览器默认启动无附加flags；源码身份比对相同的既有构建结果可明确注明后保留。

发现与登记路径均按Windows大小写不敏感方式排除私有执行、依赖及生成目录；清单不能覆盖排除规则。普通公开AGENTS文档仍有效；仅保留两个精确路径/hash的Three r186历史研究构建例外。结构检查不能产生翻译含义或公开审阅批准。
