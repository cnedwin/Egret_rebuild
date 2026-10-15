# WC1 Canvas 文字预览

[English](../../en/docs/canvas-text-wc1-canvas.md) | 简体中文 · [T1 缓存](文字栅格T1契约.md) · [TF1 显示](文字显示TF1契约.md)

工程预览 **0.28.0** 为既有 TextRasterCache、TextField、Scope、Engine 与 CanvasHost 新增显式 Canvas 文字提供者。当前 CPU／类型检查、完整当前验证与固定原生 Canvas 观察在下述范围内通过；独立双语语义审阅、必要 Git 推送钩子与交付单独记录。工作区包保持 private `0.0.0`，协议固定值保持 `1.0`。 下方执行结果与待交付状态属于原始 0.28.0 记录，不是新的交付评估。

## 公开使用与字体所有权

唯一新增导出为 `@egret/engine/web/text` 的 `createCanvasTextRasterProvider(): TextRasterProvider`。返回类型沿用 T1 协议，不新增具名类型再导出或默认根入口工厂。导入保持惰性；调用工厂捕获当前 Window document 并检查能力，不创建 Canvas、不加载字体、不安排任务。

```ts
import { createCanvasTextRasterProvider } from '@egret/engine/web/text';
import { createTextRasterCache, createTextField } from '@egret/engine/text';

// Supply a genuine open Engine, its Scope, and an admitted complete request.
const cache = createTextRasterCache(engine.assets, {
  provider: createCanvasTextRasterProvider(),
});
const field = createTextField(engine, scope, cache);
field.setRequest(input);
await field.prepare();
engine.stage.addChild(field);
engine.renderFrame();
```

示意省略初始化和清理。[第一方示例](../../../examples/canvas-text/README.zh-CN.md)持有 Engine、CanvasHost、缓存及 Ahem FontFace，Scope 持有 field。提供者不获取、安装、等待或删除字体。应用稳定字体环境，在相关变化后显式调用 `cache.invalidate()`，再准备各 field。替换成功前保留已提交内容；空白成功清除绘制而保留准入布局。准备和渲染始终显式执行。

每个原生测量／栅格阶段前，`document.fonts.check()` 必须成功；失败以 `WEB_TEXT_FONT_NOT_READY` 拒绝，且该阶段未执行 Canvas 工作。就绪为 true 仍可能使用 fallback，不能证明 face 成员关系、选择或字符覆盖。验收夹具另外确认自身精确已加载 Ahem face 及选中 advance。完整行测量／绘制保留源码范围、原生有符号指标和 em 原点基线 `fontSize + lineIndex * lineHeight`。既有 T1／TF1 所有权、图像及分配上限继续有效；同一提供者的缓存共享四个 active／quarantined 准入槽。这些是逻辑限制，不是物理内存测量。

## 原生 Canvas 范围

已记录基线包含 **14 行**：`X`、`p`、`É`、空格、空文本、LF 与 CRLF，各采用密度 **1** 和 **1.5**。六个全新默认 msedge context 分别执行下列义务：

| 模式 | 必需证据 |
| --- | --- |
| `baseline` | 全部自有栅格字节和全部 80×80 帧字节；半透明、裁剪与 painter 顺序组合；空白替换与字体代次重新准备。 |
| `omitFill` | C01：X／density1 预先指定的错误自有栅格像素。 |
| `omitOrigin` | C02：p／density1 预先指定的错误自有栅格像素。 |
| `noOp` | C03：X／density1 预先指定的错误完整帧像素。 |
| `holdRaster` | 真实 provider／cache／field 集成，保留旧帧、关闭 Scope 拒绝及迟到图像退出。 |
| `notReady` | 在原生测量或提供者 Canvas context 分配之前拒绝字体未就绪。 |

独立第一方原生 Canvas／Ahem 参考不导入 Egret，也不从目标结果取得预期像素。每个模式都必须**在任何目标 acquire 前**持久保存并读回参考元数据及 **28 个自有栅格／完整帧缓冲**，包括明确的空缓冲证据。每个实际／预期缓冲必须解析至具名的已保存清单条目；每个控制的预定坐标必须绑定正确的已保存图像。完整字节比较采用**零容差**。C01–C03 各控制必须只暴露自身指定见证，不出现无关失败；声明比较通过的布尔值不能代替实际读回字节。

清理必须证明计划已释放、actor 已完成、缓存空闲／关闭、原生方法恢复、自有字体删除、参考缓冲退出及 context／浏览器／服务器关闭。继续每项必要尝试并保留首个失败，包括抛出 `undefined`。证据或清理不完整都不能通过；本验证器不包含 GPU 导入、命令、结果或验收。

在真实公共构建更新后，独立命令为：

```text
node tools/verify-canvas-text-canvas.mjs --playwright <absolute-installed-package> --output <absolute-fresh-directory-outside-repo>
```

当前验证器要求 Windows、Node.js **24.19.0**、Playwright **1.62.1** 与默认 Edge profile；这些是验证器要求，运行时提供者另须具备上述当前 Window document 及有效 Canvas 2D／字体能力。验证器在提供捕获字节前固定选中的已安装工具、夹具／资产、已编译公共模块及对应源码，并在完成后重新核对哈希。构建与源码对应是明确前提。动作、操作与清理上限分别为 **20**、**240**、**270 秒**；单个产物至多 **4 MiB**，合计 **16 MiB**。要求 scope 为 `wc1-canvas-explicit-lines-v1`；`PASS_WC1_CANVAS_SUBSET` 标记这一有界结果。

## 已记录验证与待完成门禁

真实采用前 Main 公共入口回归以 `ERR_PACKAGE_PATH_NOT_EXPORTED` 造成 **1 项测试**失败。随后 Main 公共行为／边界检查通过 **288/288**；完整严格类型运行通过，包括新增 **12** 条普通、**8** 条导入诊断及保留的 **18** 条 BR1 诊断。生产边界扫描通过 **420 文件**，当前纯验证器契约套件通过 **12/12**。这些范围重叠，不合计。

实际原生结果为 **`PASS_WC1_CANVAS_SUBSET`**，环境为默认 headless **Edge 154.0.4258.62**、Windows、Node.js **24.19.0** 与 Playwright **1.62.1**。六个 context 均完成指定义务：14 行基线完整栅格／帧字节以零容差匹配；C01–C03 暴露精确错误见证；组合、空白替换、字体代次重新准备、延迟栅格生命周期及字体未就绪拒绝均通过。已记录清理释放计划、关闭缓存并完成 actor，自有字体／参考缓冲剩余为零；六个 context、浏览器和服务器均关闭。基线执行 14 次初始 acquire，附加流程后 measure／plan／raster／release 各为 21 次，不是测试总数。延迟 prepare 以 `TEXT_FIELD_DISPOSED` 拒绝，Scope／重入以 `SCOPE_CLOSED` 拒绝。关闭后元数据计费仍为 4,096 字节。OS 后代进程退出与物理回收仍未验证。

第一方应用冒烟通过初始渲染、替换、空文本和显式关闭，浏览器错误为零。保存的关闭状态记录缓存 idle 与 Engine 释放，无剩余自有字体／Canvas，context／浏览器／服务器关闭。这项应用观察不提供独立像素 oracle。共享[验证记录](../../evidence/canvas-text-wc1-canvas-verification.json)保留精确源码、夹具与保存结果身份。

| 门禁 | 当前状态 |
| --- | --- |
| 有限源码及实际保存原生结果审阅 | **PASS**，未解决问题为 **0**。 |
| 独立双语语义审阅，包含公开共享 JSON | **PASS**，未解决问题为 **0**。 |
| 五项受影响既有浏览器回归门禁 | 既有 Canvas、矩形 WebGPU、B1、textured WebGPU 与 SequencePlayer 链路均为 **PASS**。 |
| 完整当前验证 | **PASS**：2,285/2,285 项核心测试、59/59 项公开检查、构建、严格类型、生产边界、知识库检查及 headless 示例。 |
| 必要 Git 推送钩子与交付 | **PENDING**。 |

首轮完整 prepush 保留 2,285/2,285 项核心及 52/52 项公开检查通过，但九项知识库路径检查失败。登记册产物从共享知识库根目录解析。有限修复校正示例产物路径，准入精确五个具名仓库阅读文件，并仅将清单中的精确语言对映射为仓库根目录及共享知识库相对两种形式。实际修复对照中，知识库读取由 3/5 变为 5/5，公开路径对应由 53/54 变为 54/54；其他向外路径与未配对翻译继续拒绝。这些检查只证明所述路径行为，不证明一般文件系统安全。失败截止点继续保留，后续完整运行作为独立后继记录。

随后受限进程运行通过 59/59 项公开检查，但核心记录为 2,002/2,285 通过及 283 项聚合核心失败。指定探针前的 EPERM 准备观察包括 172 条隔离包目录链接错误与 103 条临时目录 realpath 错误，这些错误观察不等于聚合测试数量。经授权的宿主进程后继运行成功执行未改变的完整门禁，没有弱化产品代码或测试；两个截止点分别保留。

这些既有渲染回归保留原链路范围，不扩展 WC1 文字的 WebGPU 验收。此前混合 Canvas／textured-WebGPU 运行仍为 **FAIL**：**512 个 GPU 组合字节不同**，最大通道差为 **1**。Native7／OR1 验收独立保留待完成。本次仅 Canvas 增量不闭合这些义务，也不证明完整 WC1、CJK／手机、完整 UI、Spine、3D、性能、物理回收或完整迁移验收。

## 来源

提供者、应用、参考、夹具与文档是 AI 辅助的独立第一方白鹭工程，组合公开 T1／TF1、图像与生命周期 API，采用 **Apache-2.0**；既有依赖保留自身声明。几何测试字体 Ahem 为外部资产：**Todd Fahrner 与 Myles C. Maxfield** 的原始 public-domain 声明及在不承认公有领域时适用的原始 **CC0 后备声明**全部保留。未改变的 [Ahem 声明](../../../examples/canvas-text/assets/Ahem-COPYING.txt)、[README](../../../examples/canvas-text/assets/Ahem-README.txt) 与[来源记录](../../../examples/canvas-text/assets/provenance.json)随资产保留。Ahem 不改授 Apache-2.0，也不证明通用语言字形质量。
