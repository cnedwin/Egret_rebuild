# 工程事务核心

[English](README.md) | 简体中文

## 当前本地工程预览：0.18.0

新增单个具名旧 MovieClip 的有界 CPU 转换，保留图集裁剪、显示偏移和作者持续段时间；28/28 专项测试通过，输出已由真实序列帧工厂重新准入。阅读[契约](../../knowledge-base/Cns/docs/legacy-movieclip-contract.md)、[证据](../../knowledge-base/Cns/docs/legacy-movieclip-evidence.md)和[精简记录](../../knowledge-base/evidence/legacy-movieclip-focused.json)。API 保持内部使用，图片读取、解码和播放仍未验证。

0.17.0 及更早结果保留为各自源码身份下的历史证据。此次增量的默认模式、全仓回归和完整 prepush 未运行；当前浏览器／设备像素、性能及完整 R008/V006 迁移仍待验收。0.18.0 是本地工程标签，包 0.0.0／协议 1.0 不变；GitHub 交付继续保持 HOLD_HTTP_403。

## 历史本地工程预览：0.17.0

本预览新增自有 CPU 场景快照、固定网格辅助函数、有界 B1 宿主源码／模拟整合、CPU 序列帧采样与纯 RES 转换意图。阅读[CPU 场景](../../knowledge-base/Cns/docs/3d-cpu-scene-contract.md)、[网格](../../knowledge-base/Cns/docs/3d-webgpu-mesh-contract.md)、[宿主](../../knowledge-base/Cns/docs/b1-host-contract.md)、[序列帧](../../knowledge-base/Cns/docs/sequence-clip-contract.md)及[RES 意图](../../knowledge-base/Cns/docs/legacy-res-plan-contract.md)与配对证据。这些接口保持内部使用；公开入口与包 0.0.0／协议 1.0 不变。

已记录默认宿主验证通过 13/13 项，CPU 序列帧采样通过 25/25，RES 意图规划通过 14/14。所选整仓运行通过 901/901 项测试、编译、282 个边界文件及类型门禁；901 项包含宿主回归。源码绑定、仅格式后继及保留的早期失败见[配对宿主证据](../../knowledge-base/Cns/docs/b1-host-evidence.md)。此次文档采用未重跑产品检查。

GitHub 交付因已记录的 403 响应保持 HOLD；当前文档最终审阅与完整 prepush 仍待完成。此前 0.13.0–0.16.0 检查点保留身份及结果。Native SDK、当前浏览器／设备像素、性能、字体、DragonBones、完整 R008/V006 迁移、V003／编辑器及完整产品验收仍未验证或保持开放。

## 历史本地工程预览：0.16.0

当前增量覆盖已接受的有界图片源码／模拟逻辑、CPU 纹理参考公式、CPU 3D 数学／几何／打包，以及旧 RES 声明分析。阅读[核心进展](../../knowledge-base/Cns/docs/core-progress.md)、[3D CPU 基础](../../knowledge-base/Cns/docs/3d-foundation.md)和[旧 RES 声明](../../knowledge-base/Cns/docs/legacy-res-declarations.md)，查看契约、准确历史证据与开放任务。标签为工程预览；包 0.0.0 与协议 1.0 不变。最终独立公开审查、prepush 及本预览的 GitHub 交付仍待完成。

此前 0.13.0／0.14.0／0.15.0 章节是各自有源码身份和结果的历史检查点，其矩形／浏览器观察不能验证当前图片或 3D 的 native 像素。Task 5a 仅提供 CPU 公式／边界；A2 Task 5b／Task 6、P0–P7、设备／文字／动画／Native、V003 和完整 R008／V006 迁移保持开放或 UNRUN。

0.14.0工程预览提供同步headless工程事务核心。私有workspace包仍为`@egret/project`0.0.0，工程/历史/工具协议仍为`1.0`。本预览支持不可变创作快照、原子编辑、保留目标恢复、通过规范历史持久重试及有界准入；不完成编辑器、旧工程迁移或目标交付验收。

## 公开API

包根恰好导出`DEFAULT_PROJECT_LIMITS`、`parseProjectSnapshot`、`serializeProjectSnapshot`、`parseProjectTransaction`、`createProjectStore`及`openProjectHistory`，另有29项仅类型声明。Store提供`limits`、`earliestRevision`、`getSnapshot`、`commit`和`exportHistory`。预期失败返回有界诊断；提交及重放结果包含不可变回执。实验性接口不承诺API稳定。

[完整合同](../../knowledge-base/Cns/docs/工程事务核心合同.md)规定全部字段、操作、诊断、限额和公共签名；[实现证据](../../knowledge-base/Cns/docs/工程事务核心实现证据.md)区分历史范围审阅、当前oracle检查与内存观察。使用公共包根导入，不支持私有辅助接口或深路径导入。

## 创作权威与限额

唯一人工编写的格式权威是[project-format.schema.json](../contracts/schema/project-format.schema.json)。封闭生成器输出readonly合同类型及私有有序描述符，保留来源指针/哈希。仓库根执行`node tools/generate-project-format.mjs --check`检查漂移；编辑schema后使用正常生成。结构schema相符本身不证明语义有效。

严格文本适配器拒绝解码重复键、孤立代理项及尾随输入；整数字段在Number舍入之前依据精确数学词元判断。实值适配器仅读取检查过的自有数据描述符，绝不调用getter，并对每个共享别名展开计费。普通有限data负零变为0。自定义规范字节采用UTF-16键顺序、保留roots/references/operations编写顺序并归一化身份集合；不声称RFC8785认证。

已知规范重试先于CAS，不新增历史或工作量。新指令在最终验证及完整字节/数量/工作量准入之后，一次发布耦合head/指令/回执状态。恢复取回目标创作内容，同时增加revision并保留身份退役知识。导出仅保存基线与成功指令，重开在交付store前重建回执及重试索引。独立快照形成新历史边界；历史不提供认证防篡改或崩溃安全持久化。

配置限额是准入边界，不是RAM承诺。一次Windows x64/Node24.19.0观察中，100000份小实体达到采样heap1071184632/RSS1501483008字节。10ms轮询在全部测量案例中仍出现最大7058.9561ms观察间隔，同步API工作会阻塞轮询；观察与GC可能漏掉瞬时峰值。不据此设定RAM门槛、接受生产性能或保证普遍OOM安全。

## 依赖与交付范围

第一方适配器、schema生成工具及工程语义在Codex辅助下独立编写。精确固定的Microsoft Corporation `jsonc-parser`3.3.1适用MIT，仅在私有适配器通过公共包根使用`createScanner`/`visit`。保留[未经修改的MIT声明](../../third-party/jsonc-parser-3.3.1.LICENSE)、[NOTICE](../../NOTICE)及[来源记录](../../source-origin.json)。安装仍遵循既有固定工具/lock及禁用生命周期脚本政策。

Native Node公共包根导入与依赖随包CommonJS入口互操作；直接原生导入随包ESM入口因内部无扩展名导入失败，实际bundler/浏览器交付尚未接受。无宿主VM/CJS桥是模拟模块集成证据；已知Experimental VM Modules警告明确保留，并有精确警告/意外stderr控制，不是产品运行时要求。允许纯依赖缓存初始化，但不证明零内存。

未知实体kind/领域data schema及实际文件内容/摘要/授权仍未检查或未验证。反射无法隔离Proxy副作用；可恢复OOM、手机/Native SDK、生产性能、编辑器/V003及完整R008/V006迁移仍待完成。本段文档编写检查点的最终独立预览审阅及公开交付仍待完成，后续证据另行记录；标签不产生npm发布或完整引擎认证。
