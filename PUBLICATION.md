# 本地候选与发布状态

[English](PUBLICATION.en.md) | 简体中文


## 0.12.0 显示与帧候选范围

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
