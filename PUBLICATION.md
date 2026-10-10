# 本地候选与发布状态

[English](PUBLICATION.en.md) | 简体中文

## 当前本地工程预览：0.18.0

新增单个具名旧 MovieClip 的有界 CPU 转换，保留图集裁剪、显示偏移和作者持续段时间；28/28 专项测试通过，输出已由真实序列帧工厂重新准入。阅读[契约](knowledge-base/docs/legacy-movieclip-contract.zh-CN.md)、[证据](knowledge-base/docs/legacy-movieclip-evidence.zh-CN.md)和[精简记录](knowledge-base/evidence/legacy-movieclip-focused.json)。API 保持内部使用，图片读取、解码和播放仍未验证。

0.17.0 及更早结果保留为各自源码身份下的历史证据。此次增量的默认模式、全仓回归和完整 prepush 未运行；当前浏览器／设备像素、性能及完整 R008/V006 迁移仍待验收。0.18.0 是本地工程标签，包 0.0.0／协议 1.0 不变；GitHub 交付继续保持 HOLD_HTTP_403。

## 历史本地工程预览：0.17.0

本预览新增自有 CPU 场景快照、固定网格辅助函数、有界 B1 宿主源码／模拟整合、CPU 序列帧采样与纯 RES 转换意图。阅读[CPU 场景](knowledge-base/docs/3d-cpu-scene-contract.md)、[网格](knowledge-base/docs/3d-webgpu-mesh-contract.md)、[宿主](knowledge-base/docs/b1-host-contract.zh-CN.md)、[序列帧](knowledge-base/docs/sequence-clip-contract.zh-CN.md)及[RES 意图](knowledge-base/docs/legacy-res-plan-contract.zh-CN.md)与配对证据。这些接口保持内部使用；公开入口与包 0.0.0／协议 1.0 不变。

已记录默认宿主验证通过 13/13 项，CPU 序列帧采样通过 25/25，RES 意图规划通过 14/14。所选整仓运行通过 901/901 项测试、编译、282 个边界文件及类型门禁；901 项包含宿主回归。源码绑定、仅格式后继及保留的早期失败见[配对宿主证据](knowledge-base/docs/b1-host-evidence.zh-CN.md)。此次文档采用未重跑产品检查。

GitHub 交付因已记录的 403 响应保持 HOLD；当前文档最终审阅与完整 prepush 仍待完成。此前 0.13.0–0.16.0 检查点保留身份及结果。Native SDK、当前浏览器／设备像素、性能、字体、DragonBones、完整 R008/V006 迁移、V003／编辑器及完整产品验收仍未验证或保持开放。

## 0.16.0 文档整合检查点

本地工程预览在[当前概览](knowledge-base/docs/core-progress.md)整理已接受的图片源码／模拟逻辑、CPU 纹理公式／边界、CPU 3D 基础及 RES 声明分析。当前源码基线已本地提交；本次整理不推送、上传、创建 PR、发布 npm 或登记 CI 结果，目标仍为既有公开仓库。根代理的独立审查及既有完整 prepush 必须绑定最终候选后，才进行新的 GitHub 提交。包 0.0.0／协议 1.0 和全部历史许可／证据身份保持不变。

新摘要提供公开逻辑源码身份和限定历史结果，不包含私有工程包、原始日志或内部推敲过程。CPU Task 5a 不认证浏览器精度；Task 5b／Task 6 和 P0–P7 仍为 UNRUN。R008／V006 完整迁移、V003／编辑器、真实设备／文字／动画／3D GPU／Native 性能及完整产品验收继续开放。下文旧章节描述原检查点，包括原 export-manifest 范围。

## 0.13.0 WebGPU矩形本地检查点 — 2026年10月9日

显式 `@egret/engine/webgpu` 入口同步执行不可变 `RenderFrame2D` 矩形命令。根入口保持无DOM；`@egret/engine/web`保持Canvas-only，实际请求不包含WebGPU或robust-predicates模块。无DOM准备层通过公共 `orient2d` 接入精确固定的基础依赖robust-predicates 3.0.3，适用Unlicense。复制、有界交点构造、打包、WGSL及宿主生命周期属于独立编写的第一方代码。见[完整0.6合同](knowledge-base/docs/WebGPU矩形执行合同.md)、[实施计划](knowledge-base/docs/WebGPU矩形实施计划.md)与[有限证据](knowledge-base/docs/WebGPU矩形实现证据.md)。

已接受的桌面构建记录177/177 CPU/mock/核心检查、28项预期负类型诊断及123个边界文件；独立真实WebGPU门禁记录42帧、1709项原始断言、84张截图、6808项合成断言、8项预期反例及0项意外错误。其中7项变异实际生产代码副本，1项仅为合成断言。实际结果与有限独立实现审阅由[验证](verification/webgpu-verification.json)与[审阅](verification/webgpu-review.json)绑定已接受的源码身份；文档整合没有重跑这些检查。

本experimental检查点记录于2026-10-08T21:23:54.294Z最终原生运行之前，核心/headless与桌面Canvas结果分别记录。随后仅注释入口重建的真实浏览器WebGPU运行在 `1aa0248a1ff6d8e54c42d631072223bb50483814`、2026-10-08T21:23:54.294Z以0退出并记录PASS：42帧、1709项原始断言、84张PNG截图、6808项合成断言、8项预期反例及0项意外错误。7项反例变异生产代码副本，1项为合成断言。233项源码/构建/工具/依赖清单身份在该运行前后相等，且与当时仅文档和元数据变更的后继版本一致。实际运行由验证作者执行；独立修正及原生绑定复审、最终语义凭据和发布仍待完成。浏览器WebGPU与Native App/SDK分别验收；截图合成不证明实体扫描输出、硬件加速、手机或性能。纹理/文字/UI/动画/3D、编辑器/Agent创作、CI、完整迁移与完整产品仍待实施或验收；R008/V006及V003保留既有义务。下文0.9–0.12历史记录保留原日期、身份与结果范围。


## 历史0.12.0显示与帧候选范围

后续工作包按[显示与帧合同](knowledge-base/docs/显示与帧执行合同.md)及[实现计划](knowledge-base/docs/显示与帧执行实现计划.md)推进：显示变换、继承可见性/透明度与本地矩形裁剪、Sprite 所属 Graphics 的矩形填充，以及不可变 CPU 帧捕获/提交。首个已实现执行适配器为独立 @egret/engine/web 入口的 Canvas，核心根入口保留无 DOM 边界。限定实现检查已通过：97/97核心行为测试、25项负类型诊断及真实桌面Canvas像素/指针交互。跨realm拒绝修正后有限独立审阅通过；远端发布另行记录。最终限定结果由[实现记录](knowledge-base/docs/显示与帧执行实现记录.md)和[验证](verification/display-frame-verification.json)承载。

本包不验收完整文本/纹理/动画/UI/3D 执行、GPU 或 Native 支持、目标设备性能、编辑器、Agent 服务或完整迁移。此前 headless、CPU 资源与第三方研究记录保留原版本、数量、hash 和范围，不转为新显示帧验收。

记录日期：2026年10月8日。

目标远端为[cnedwin/Egret_rebuild](https://github.com/cnedwin/Egret_rebuild)，仓库已经存在且为public，main已有完整Apache-2.0 LICENSE。原LICENSE的Git blob为`261eeb9e9f8b2b4b0d119366dda99c6fd7d35c64`；第一方代码与文档沿用该配置，第三方保留各自声明。

本记录描述2026年10月8日的本地候选打包时点。该次导出未初始化Git、推送、上传或发布npm包；原型和现有知识库保持独立。后续提交、草稿PR与发行状态见仓库分支及实际记录，main与既有许可证不由该次导出覆盖。

## 历史 0.11.0 资源核心修订

本轮在保留的 0.10.0 候选基础上新增独立编写的 CPU 资源获取与租约代码，当前规格、审阅、测试和身份见[实现记录](knowledge-base/docs/资源核心实现记录.md)、[验证](verification/asset-core-verification.json)与 source-origin.json。下文原字节导出声明描述历史首批导出，不代表本轮资源代码没有改变；依赖和原 LICENSE 不变。本地修订不等于远端提交或 CI 已运行。

## 历史首批导出

原型source-origin.json的白名单决定代码、测试、示例、工具和配置范围。这些内容保持原字节；根说明与包内README作公开投影，来源记录说明原hash与投影角色。node_modules、dist、tsbuildinfo和内部work没有纳入候选。

根source-origin.json保留原来源记录SHA、0.7.0输入规格的身份和hash。内部brief、审阅、反例与日志仅按identity-only/not-distributed登记，不作为公开文件链接。知识库已以0.9.0公开版本整合，其当前规格与原型历史输入分别版本化。

## 验证与后续整合

导出阶段的动作按上文打包时点登记。随后已在独立候选目录安装固定依赖，完成44/44行为检查、11项负类型断言、实际包解析与headless示例，见[整合验证](verification/headless-verification.json)。知识库结构、来源身份和历史结果的检查见[整合完整性记录](verification/community-integrity.json)。总发行范围与文件摘要见[发行清单](EXPORT-MANIFEST.json)。这些结果仍限于所列CPU与模拟host范围。

GPU、Native、生产浏览器/小游戏宿主、设备互操作、性能、CI和完整产品仍待对应验收。source-origin.json提供有限范围的作者声明与来源复核线索，不作全量原创性、权利或产品性能保证。

历史 0.10.0 双语修订对应当时的知识库0.10.0。每次推送须遵循[双语与公开检查](knowledge-base/docs/双语文档与推送前检查.md)，执行`node tools/prepush.mjs`；语言和注释完善不会扩大产品技术验收范围。

本检查点的根EXPORT-MANIFEST.json保留封存0.12历史清单；尚未创建最终0.13清单/归档。临时身份与待审元数据不表示已完成打包发行。
