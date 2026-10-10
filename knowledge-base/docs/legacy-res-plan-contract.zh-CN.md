# 旧版 RES 转换意图契约

[English](legacy-res-plan-contract.en.md) · [验证证据](legacy-res-plan-evidence.zh-CN.md)

白鹭自主实现的 `packages/project/src/legacy-res-plan.ts` 将已识别的旧版资源声明报告转为不可变复制、引用意图。旧版 RES 声明语义是兼容目标。这项内部规划 API 尚未由 project 包入口集中导出，也不执行迁移。

```ts
planLegacyResourceManifestConversion(text: unknown, resourceRoot: unknown)
  : LegacyResourceConversionResult
```

## 准入与结果

规划器在任何规划工作前，把实际输入交给`packages/project/src/legacy-res-report.ts`，只调用一次。它不接受调用者编造的报告或报告生成回调。既有严格 JSON、模式、声明、路径及诊断优先级继续由分析器负责。可规划子集是已准入的本地 `image`、`json` 资源及已解析的分组引用；精灵图集、九宫格声明等格式仍不支持。

结果包含 `planVersion: "0.1"`、`scope: "legacy-res-conversion-intents"`、实际不可变 `report` 和 `plan`。只有 `recognized` 报告产生 `status: "planned"` 和非空计划，包括已识别的空清单。`unsupported`、`invalid`、`incomplete` 保留报告状态，并返回 `plan: null`。不发布部分构造的计划。

沿用的额度是 4096 条资源声明／文件、1024 个分组、16,384 条分组引用。路径继续按分析器的长度、Unicode 和碰撞规则准入为本地相对路径。规划阶段不另做路径规范化、百分号解码，也不证明文件系统包含关系。

`resourceRoot` 须为基础字符串类型、非空的可移植相对前缀。分析器先检查 text/root 的基础类型、Unicode及早期 text/root 额度，再检查严格 JSON，最后准入可移植根路径。根路径的早期4096代码单元／UTF-8字节额度，不放宽最终可移植路径界限：已准入根路径和每条拼接工程路径均须在1024 UTF-8字节内。路径段拒绝反斜杠、空段、`.`、`..`、尾部空格／点、保留名称及非法字符。这是工程路径的词法规则，不是平台文件系统解析。

例如一条独立编写的声明使用 URL `images/hero.png`、资源根 `assets`，复制意图的 `sourcePath` 和 `destinationPath` 都为 `assets/images/hero.png`，分别相对于原工程根与输出工程根解释。此例不检查文件，也不再次添加 `assets` 前缀。

`incomplete` 是分析器报告状态。规划器的不变式或原生分配／发布故障可以抛出；API不保证将所有这类故障转换为incomplete报告，但仍不发布部分计划。

## 稳定映射

`plan.resourceRoot` 保留已准入根路径。`files` 按首次出现顺序，对已经带根前缀的工程路径精确去重。每个文件的相对 `sourcePath`、`destinationPath` 名称相同，分别在原工程根和输出工程根下解释，不重复添加资源根前缀。

`resources` 保持声明顺序、名称和类型，以 `fileIndex` 引用 `files`。别名可共享索引；图片与 JSON 声明可引用同一路径，但不认证文件同时符合两种内容类型。`groups` 保持分组顺序和已准入键顺序，包括重复引用；键映射为资源索引，不再次拆分或去重。

每个结果、计划、数组和计划记录均为新鲜自有、冻结对象。内部生成的报告继续作为证据和诊断依据。文件存在性、解码、执行、迁移的验收状态仍全部为 **unverified（未验证）**。

## 执行边界

复制意图不授予覆盖文件权限，不承诺真实路径、符号链接的包含关系或文件内容。文件读取、哈希、解码、复制、事务、运行时资源安装、完整工程迁移均需另行实现和验证。专项 CPU 证据覆盖意图映射，所选组合源码已通过整仓验证：901/901项测试以及编译、边界、类型门禁。此结果不证明迁移验收；配对证据保留此前未通过的整仓尝试。
