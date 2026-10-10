# 工程事务核心

[English](README.md) | 简体中文

`@egret/project` 提供同步 headless 工程事务核心：不可变创作快照、原子编辑、保留目标恢复、通过规范历史持久重试及有界准入。私有 workspace 包保持版本 `0.0.0`，工程／历史／工具协议保持 `1.0`。依赖 `@egret/contracts` 及下文说明的固定解析器。编辑器、旧工程迁移和目标交付须分别验收。

## 公开 API

包根恰好导出`DEFAULT_PROJECT_LIMITS`、`parseProjectSnapshot`、`serializeProjectSnapshot`、`parseProjectTransaction`、`createProjectStore`及`openProjectHistory`，另有29项仅类型声明。Store提供`limits`、`earliestRevision`、`getSnapshot`、`commit`和`exportHistory`。预期失败返回有界诊断；提交及重放结果包含不可变回执。实验性接口不承诺API稳定。

[完整合同](../../knowledge-base/Cns/docs/工程事务核心合同.md)规定全部字段、操作、诊断、限额和公共签名；[实现证据](../../knowledge-base/Cns/docs/工程事务核心实现证据.md)区分历史范围审阅、当前oracle检查与内存观察。使用公共包根导入，不支持私有辅助接口或深路径导入。

## 创作权威与限额

唯一人工编写的格式权威是[project-format.schema.json](../contracts/schema/project-format.schema.json)。封闭生成器输出readonly合同类型及私有有序描述符，保留来源指针/哈希。仓库根执行`node tools/generate-project-format.mjs --check`检查漂移；编辑schema后使用正常生成。结构schema相符本身不证明语义有效。

严格文本适配器拒绝解码重复键、孤立代理项及尾随输入；整数字段在Number舍入之前依据精确数学词元判断。实值适配器仅读取检查过的自有数据描述符，绝不调用getter，并对每个共享别名展开计费。普通有限data负零变为0。自定义规范字节采用UTF-16键顺序、保留roots/references/operations编写顺序并归一化身份集合；不声称RFC8785认证。

已知规范重试先于CAS，不新增历史或工作量。新指令在最终验证及完整字节/数量/工作量准入之后，一次发布耦合head/指令/回执状态。恢复取回目标创作内容，同时增加revision并保留身份退役知识。导出仅保存基线与成功指令，重开在交付store前重建回执及重试索引。独立快照形成新历史边界；历史不提供认证防篡改或崩溃安全持久化。

配置限额是准入边界，不是 RAM 承诺。同步 API 工作会阻塞轮询，观察与 GC 可能漏掉瞬时峰值。绑定版本的内存观察保留在实现证据中，不据此设定 RAM 门槛、接受生产性能或保证普遍 OOM 安全。

## 依赖与交付范围

第一方适配器、schema生成工具及工程语义在Codex辅助下独立编写。精确固定的Microsoft Corporation `jsonc-parser`3.3.1适用MIT，仅在私有适配器通过公共包根使用`createScanner`/`visit`。保留[未经修改的MIT声明](../../third-party/jsonc-parser-3.3.1.LICENSE)、[NOTICE](../../NOTICE)及[来源记录](../../source-origin.json)。安装仍遵循既有固定工具/lock及禁用生命周期脚本政策。

Native Node公共包根导入与依赖随包CommonJS入口互操作；直接原生导入随包ESM入口因内部无扩展名导入失败，实际bundler/浏览器交付尚未接受。无宿主VM/CJS桥是模拟模块集成证据；已知Experimental VM Modules警告明确保留，并有精确警告/意外stderr控制，不是产品运行时要求。允许纯依赖缓存初始化，但不证明零内存。

未知实体kind/领域data schema及实际文件内容/摘要/授权仍未检查或未验证。反射无法隔离Proxy副作用；可恢复OOM、手机/Native SDK、生产性能、编辑器/V003及完整R008/V006迁移仍待完成。验证与发布分别记录；本指南不产生 npm 发布或完整引擎认证。

## 验证

在仓库根运行 `node tools/verify.mjs` 和 `node tools/generate-project-format.mjs --check`。设计与历史检查点见[知识库](../../knowledge-base/Cns/README.md)。包保持 `private: true`；第一方代码与本文采用 [Apache-2.0](../../LICENSE)。
