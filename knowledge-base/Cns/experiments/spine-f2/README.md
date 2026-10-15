# F2-A 源规划复现

简体中文 | [English](../../../en/experiments/spine-f2/README.md)

本同步源规划指南保留工程预览 0.42.0 记录。保存的开发运行成功；在原稿截止时，独立接纳与发布仍待完成。状态见本语言[契约](../../docs/Spine网格源规划契约.md)、[证据](../../docs/Spine网格源规划证据.md)及[共享验证记录](../../../evidence/spine-mesh-source-plan-verification.json)。

## 安装与验证

使用 Node **24.19.0**、pnpm **11.25.0**、TypeScript **7.0.2** 和 jsonc-parser **3.3.1**，由根清单及锁文件固定。检查使用 TS7 不稳定的公开 AST API，变更版本需重新验证。

在仓库根目录运行：

```sh
pnpm install --frozen-lockfile --ignore-scripts
git config --local core.hooksPath .githooks
node tools/build.mjs
node tools/verify-spine-f2-source.mjs
```

最后一条也可使用 `pnpm verify:spine-f2-source`。非交互安装需要重新链接受管理的依赖目录时：

```sh
pnpm install --frozen-lockfile --ignore-scripts --config.confirmModulesPurge=false
```

此选项仅授权依赖目录重新链接，不授权删除源码。使用安装器，不手工创建 aliases。A 无需私人缓存路径、Playwright、浏览器或实体手机。

`node tools/verify.mjs` 已在保留的 SDK 检查后包含 F2。推送前运行 `node tools/prepush.mjs`，保留 hook。不得导入 SDK 私有路径、跳过类型/源码检查或绕过 hook。实验与核心统计分开。

## 读取计划

仓库根目录下的 TypeScript 用法只导入实验构建入口与公开 SP1 类型。此请求没有网格/setup 引用；页面 ID 只是声明，不加载图像。

```ts
import {createF2MeshSourcePlan} from './knowledge-base/experiments/spine-f2/dist/index.js';
import type {SpineImportInput} from '@egret/project/spine';

const provenance = {
  origin: 'Original contributor sample', license: 'Apache-2.0',
  notice: 'Source-plan example, not an Editor export.',
};
const input: SpineImportInput = {
  skeleton: {id: 'sample', text: '{"skeleton":{"spine":"4.3.13"}}', provenance},
  atlas: {id: 'atlas', text: 'sample.png\nsize: 1,1\n', provenance},
  pages: [{pageName: 'sample.png', assetId: 'sample:page', provenance}],
};
const result = createF2MeshSourcePlan(input);
if (result.ok) console.log(result.value.meshes, result.value.setup);
else console.log(result.diagnostics);
```

[SP1 公共契约](../../docs/Spine导入计划契约.md)定义 owned 输入。冻结摘要不授予执行或权限。A 接纳精确 **4.3.13**、独立非加权网格坐标/UV/索引及保守的静态 setup 数量，保留原位置和 SP1 拒绝/warnings。

## 结果与界线

保存的验证器退出 **0**：**22/22** = **16 项行为 + 6 项边界**（一个 baseline、五个控制）。类型正例 **0** 条诊断；负例全部 **39** 个文件/行/列/code/完整 message 元组匹配。负例编译器退出 **1** 是预期拒绝；验证器成功须退出 **0**。共享记录保留失败/后继；这些数字不代表发布或 Main 交付。

完整 profile、deform、动画语义、Core 兼容性、真实资源、渲染及许可资格仍待验收；R020/V020 保持 **OPEN**。`F2_SOURCE_VIEW` 与 `F2_INTERNAL_ERROR` 的受控见证也保持 **PENDING**。不得用源准入直接启动播放。

七份[共享资产](../../../experiments/spine-f2/assets/egret-original-unfold.spine.json)是原创 Apache-2.0 样本，不是 Editor 导出或 canonical Core 输出。本切片不打包第三方 Core。参见仓库根目录的 `LICENSE` 与 `NOTICE`、[官方格式源码](https://github.com/EsotericSoftware/spine-runtimes/blob/b7beb2ccbbce667a12c02f44d070644f59b04968/spine-ts/spine-core/src/SkeletonJson.ts)、[图集格式](https://esotericsoftware.com/spine-atlas-format)及[运行库许可](https://esotericsoftware.com/spine-runtimes-license)。上游条款和资源权利需要分别取得资格。

<!-- F2-B-GUIDE-0.43.0-BEGIN -->
## Current F2-B opt-in entry / 当前 F2-B 可选入口

当前已构建的可选实验提供 2 个运行时值：`createF2MeshSourcePlan`（A）与 `createF2MeshProfilePlan`（B），以及 10 个擦除类型：A 原有的 6 个保持不变，新增 `F2MeshProfilePlan`、`F2MeshProfileResult`、`F2MeshProfileDiagnostic` 和 `F2MeshProfileDiagnosticCode`。B 接收同一公共 `SpineImportInput`；参见 [B 契约](../../docs/Spine线性动画源规格契约.md)、[B 证据](../../docs/Spine线性动画源规格证据.md)与[共享验证](../../../evidence/spine-linear-profile-verification.json)。当前完整开发验证器已接受 160 项检查及精确 A39/B100 类型元组；当前完整 prepush/push/PR/Main 仍为 PENDING。上文 A 较早的 source-only 与 Pending 截止点保持不变。Core、pose、资源、播放、渲染和许可资格尚未验收；受控故障仍待完成，R020/V020 与 R008/V006 保持 OPEN。
<!-- F2-B-GUIDE-0.43.0-END -->
